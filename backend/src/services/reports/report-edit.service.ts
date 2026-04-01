import type { Firestore, Transaction } from 'firebase-admin/firestore';
import type { EditableReportResponse, Report, UpdateReportByReferenceRequest } from '../../contracts/index.js';
import { createChangesFromPatch, recordItemHistoryEvent } from '../item-history.service.js';
import { ReportEditConflictError, ReportNotFoundError } from './report-errors.js';
import { isEditableReportStatus } from './report-shared.js';

const mapEditableReport = (id: string, report: Report): EditableReportResponse => ({
  id,
  referenceCode: report.referenceCode,
  kind: report.kind,
  status: report.status,
  title: report.title,
  category: report.category,
  description: report.description,
  location: report.location,
  dateReported: report.dateReported,
  contactEmail: report.contactEmail,
});

export const getReportByReferenceCode = async (
  db: Firestore,
  referenceCode: string,
): Promise<EditableReportResponse> => {
  const snapshot = await db
    .collection('reports')
    .where('referenceCode', '==', referenceCode)
    .limit(1)
    .get();

  if (snapshot.empty) {
    throw new ReportNotFoundError();
  }

  const doc = snapshot.docs[0];
  const report = doc.data() as Report;

  return mapEditableReport(doc.id, report);
};

const buildUpdatePatch = (payload: UpdateReportByReferenceRequest): Partial<Report> => {
  const updatePatch: Partial<Report> = {};
  if (payload.title !== undefined) updatePatch.title = payload.title;
  if (payload.category !== undefined) updatePatch.category = payload.category;
  if (payload.description !== undefined) updatePatch.description = payload.description;
  if (payload.location !== undefined) updatePatch.location = payload.location;
  if (payload.dateReported !== undefined) updatePatch.dateReported = payload.dateReported;
  if (payload.contactEmail !== undefined) updatePatch.contactEmail = payload.contactEmail;
  return updatePatch;
};

export const updateReportByReferenceCode = async (
  db: Firestore,
  referenceCode: string,
  payload: UpdateReportByReferenceRequest,
): Promise<EditableReportResponse> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const snapshot = await transaction.get(
      db.collection('reports').where('referenceCode', '==', referenceCode).limit(1),
    );

    if (snapshot.empty) {
      throw new ReportNotFoundError();
    }

    const doc = snapshot.docs[0];
    const report = doc.data() as Report;

    if (!isEditableReportStatus(report.status)) {
      throw new ReportEditConflictError('Only reports still under review can be edited.');
    }

    const updatePatch = buildUpdatePatch(payload);
    transaction.update(doc.ref, updatePatch);

    const changes = createChangesFromPatch(report as Record<string, unknown>, updatePatch as Record<string, unknown>);
    if (changes.length > 0) {
      await recordItemHistoryEvent(db, {
        itemId: doc.id,
        entityType: 'REPORT',
        entityId: doc.id,
        actionType: 'REPORT_UPDATED',
        timestamp: new Date().toISOString(),
        summary: 'Report details updated.',
        actor: {
          type: 'USER',
          email: payload.contactEmail ?? report.contactEmail,
        },
        metadata: {
          referenceCode: report.referenceCode,
          reportKind: report.kind,
          itemStatus: report.status,
        },
        changes,
      }, { transaction });
    }

    return mapEditableReport(doc.id, { ...report, ...updatePatch });
  });
};
