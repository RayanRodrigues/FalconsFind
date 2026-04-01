import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { AdminReportResponse, FlagReportRequest, MergeDuplicateReportsResponse, Report } from '../../contracts/index.js';
import { ItemStatus } from '../../contracts/index.js';
import { createChangesFromPatch, recordItemHistoryEvent } from '../item-history.service.js';
import { getStatusSyncTargets, writeStatusHistoryRecord } from '../items/item-shared.js';
import { ReportMergeConflictError, ReportNotFoundError, ReportValidationConflictError } from './report-errors.js';
import { buildPrimaryMergePatch } from './report-shared.js';
import type { ReportFlagActor, ReportMergeActor, ReportValidationActor } from './report-types.js';

export const validateFoundReport = async (
  db: Firestore,
  reportId: string,
  actor?: ReportValidationActor,
): Promise<{ id: string; report: Pick<Report, 'status' | 'referenceCode'> }> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const reportRef = db.collection('reports').doc(reportId);
    const reportSnap = await transaction.get(reportRef);

    if (!reportSnap.exists) throw new ReportNotFoundError();

    const report = reportSnap.data() as Report | undefined;
    if (!report) throw new ReportNotFoundError();
    if (report.kind !== 'FOUND') throw new ReportValidationConflictError('Only found-item reports can be validated.');
    if (report.status !== ItemStatus.PENDING_VALIDATION) {
      throw new ReportValidationConflictError('Only pending validation found-item reports can be validated.');
    }

    const validatedAt = new Date().toISOString();
    const { primaryRef, targetRefs } = await getStatusSyncTargets(transaction, db, reportId);
    for (const targetRef of targetRefs) transaction.update(targetRef, { status: ItemStatus.VALIDATED });
    writeStatusHistoryRecord(
      db,
      transaction,
      primaryRef.id,
      report.status,
      ItemStatus.VALIDATED,
      actor ? { uid: actor.uid, email: actor.email ?? null, role: actor.role } : { type: 'SYSTEM', role: 'SYSTEM' },
      validatedAt,
    );

    await recordItemHistoryEvent(db, {
      itemId: reportId,
      entityType: 'REPORT',
      entityId: reportId,
      actionType: 'REPORT_VALIDATED',
      timestamp: validatedAt,
      summary: 'Found-item report validated by staff.',
      actor: actor
        ? { type: actor.role, uid: actor.uid, email: actor.email ?? undefined, role: actor.role }
        : { type: 'SECURITY' },
      metadata: {
        referenceCode: report.referenceCode,
        reportKind: report.kind,
        itemStatus: ItemStatus.VALIDATED,
      },
      changes: [{ field: 'status', previousValue: report.status, newValue: ItemStatus.VALIDATED }],
    }, { transaction });

    return { id: reportId, report: { status: ItemStatus.VALIDATED, referenceCode: report.referenceCode } };
  });
};

export const flagReport = async (
  db: Firestore,
  reportId: string,
  payload: FlagReportRequest,
  actor: ReportFlagActor,
): Promise<{
  id: string;
  report: Pick<
    AdminReportResponse,
    | 'isSuspicious'
    | 'suspiciousReason'
    | 'suspiciousFlaggedAt'
    | 'suspiciousFlaggedByUid'
    | 'suspiciousFlaggedByEmail'
    | 'suspiciousFlaggedByRole'
  >;
}> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const reportRef = db.collection('reports').doc(reportId);
    const reportSnap = await transaction.get(reportRef);
    if (!reportSnap.exists) throw new ReportNotFoundError();

    const report = reportSnap.data() as Report | undefined;
    if (!report) throw new ReportNotFoundError();

    const patch: Partial<Report> = payload.flagged
      ? {
        isSuspicious: true,
        suspiciousReason: payload.reason?.trim() || null,
        suspiciousFlaggedAt: new Date().toISOString(),
        suspiciousFlaggedByUid: actor.uid,
        suspiciousFlaggedByEmail: actor.email ?? null,
        suspiciousFlaggedByRole: actor.role,
      }
      : {
        isSuspicious: false,
        suspiciousReason: null,
        suspiciousFlaggedAt: null,
        suspiciousFlaggedByUid: null,
        suspiciousFlaggedByEmail: null,
        suspiciousFlaggedByRole: null,
      };

    transaction.update(reportRef, patch);
    await recordItemHistoryEvent(db, {
      itemId: reportId,
      entityType: 'REPORT',
      entityId: reportId,
      actionType: payload.flagged ? 'REPORT_FLAGGED' : 'REPORT_UNFLAGGED',
      timestamp: new Date().toISOString(),
      summary: payload.flagged ? 'Report flagged as suspicious.' : 'Suspicious flag removed from report.',
      actor: { type: actor.role, uid: actor.uid, email: actor.email ?? undefined, role: actor.role },
      metadata: {
        referenceCode: report.referenceCode,
        reportKind: report.kind,
        itemStatus: report.status,
        isSuspicious: payload.flagged,
        flagReason: patch.suspiciousReason,
        flaggedAt: patch.suspiciousFlaggedAt,
      },
      changes: createChangesFromPatch(report as Record<string, unknown>, patch as Record<string, unknown>),
    }, { transaction });

    return {
      id: reportId,
      report: {
        isSuspicious: payload.flagged,
        suspiciousReason: patch.suspiciousReason,
        suspiciousFlaggedAt: patch.suspiciousFlaggedAt,
        suspiciousFlaggedByUid: patch.suspiciousFlaggedByUid,
        suspiciousFlaggedByEmail: patch.suspiciousFlaggedByEmail,
        suspiciousFlaggedByRole: patch.suspiciousFlaggedByRole,
      },
    };
  });
};

export const mergeDuplicateReports = async (
  db: Firestore,
  payload: { primaryReportId: string; duplicateReportIds: string[] },
  actor: ReportMergeActor,
): Promise<MergeDuplicateReportsResponse> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const primaryRef = db.collection('reports').doc(payload.primaryReportId);
    const primarySnap = await transaction.get(primaryRef);
    if (!primarySnap.exists) throw new ReportNotFoundError();

    const primaryReport = primarySnap.data() as Report | undefined;
    if (!primaryReport) throw new ReportNotFoundError();
    if (primaryReport.status === ItemStatus.ARCHIVED) throw new ReportMergeConflictError('Primary report cannot be archived.');
    if (primaryReport.mergedIntoReportId) throw new ReportMergeConflictError('Primary report has already been merged into another report.');

    const duplicateDocs = await Promise.all(payload.duplicateReportIds.map(async (reportId) => {
      const reportRef = db.collection('reports').doc(reportId);
      const reportSnap = await transaction.get(reportRef);
      if (!reportSnap.exists) throw new ReportNotFoundError();
      const report = reportSnap.data() as Report | undefined;
      if (!report) throw new ReportNotFoundError();
      return { id: reportId, ref: reportRef, report };
    }));

    for (const duplicate of duplicateDocs) {
      if (duplicate.report.kind !== primaryReport.kind) throw new ReportMergeConflictError('Only reports of the same kind can be merged.');
      if (duplicate.report.status === ItemStatus.ARCHIVED) throw new ReportMergeConflictError('Archived reports cannot be merged as duplicates.');
      if (duplicate.report.mergedIntoReportId) throw new ReportMergeConflictError('A selected duplicate report has already been merged.');
    }

    const mergedAt = new Date().toISOString();
    const primaryPatch = buildPrimaryMergePatch(primaryReport, duplicateDocs.map((entry) => entry.report));
    if (Object.keys(primaryPatch).length > 0) transaction.update(primaryRef, primaryPatch);

    await recordItemHistoryEvent(db, {
      itemId: primaryRef.id,
      entityType: 'REPORT',
      entityId: primaryRef.id,
      actionType: 'REPORT_MERGED',
      timestamp: mergedAt,
      summary: `Merged ${duplicateDocs.length} duplicate report(s) into this primary report.`,
      actor: { type: actor.role, uid: actor.uid, email: actor.email ?? undefined, role: actor.role },
      metadata: {
        referenceCode: primaryReport.referenceCode,
        reportKind: primaryReport.kind,
        itemStatus: primaryReport.status,
        mergedCount: duplicateDocs.length,
        duplicateReportIds: duplicateDocs.map((entry) => entry.id).join(','),
        duplicateReferenceCodes: duplicateDocs.map((entry) => entry.report.referenceCode).join(','),
      },
      changes: createChangesFromPatch(primaryReport as Record<string, unknown>, primaryPatch as Record<string, unknown>).length > 0
        ? createChangesFromPatch(primaryReport as Record<string, unknown>, primaryPatch as Record<string, unknown>)
        : [{ field: 'duplicateReportsMerged', previousValue: 0, newValue: duplicateDocs.length }],
    }, { transaction });

    for (const duplicate of duplicateDocs) {
      const duplicatePatch: Partial<Report> = {
        status: ItemStatus.ARCHIVED,
        archivedAt: mergedAt,
        mergedIntoReportId: primaryRef.id,
        mergedIntoReferenceCode: primaryReport.referenceCode,
        mergedAt,
        mergedByUid: actor.uid,
        mergedByEmail: actor.email ?? null,
        mergedByRole: actor.role,
      };

      transaction.update(duplicate.ref, duplicatePatch);
      await recordItemHistoryEvent(db, {
        itemId: duplicate.id,
        entityType: 'REPORT',
        entityId: duplicate.id,
        actionType: 'REPORT_MERGED',
        timestamp: mergedAt,
        summary: `Report merged into primary report ${primaryReport.referenceCode}.`,
        actor: { type: actor.role, uid: actor.uid, email: actor.email ?? undefined, role: actor.role },
        metadata: {
          referenceCode: duplicate.report.referenceCode,
          reportKind: duplicate.report.kind,
          itemStatus: ItemStatus.ARCHIVED,
          mergedIntoReportId: primaryRef.id,
          mergedIntoReferenceCode: primaryReport.referenceCode,
        },
        changes: createChangesFromPatch(duplicate.report as Record<string, unknown>, duplicatePatch as Record<string, unknown>),
      }, { transaction });
    }

    return {
      primaryReportId: primaryRef.id,
      mergedReportIds: duplicateDocs.map((entry) => entry.id),
      primaryReport: {
        id: primaryRef.id,
        referenceCode: primaryReport.referenceCode,
        kind: primaryReport.kind,
        status: primaryReport.status,
        title: primaryReport.title,
      },
    };
  });
};
