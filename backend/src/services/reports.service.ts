import type { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type {
  AdminReportResponse,
  FlagReportRequest,
  CreateFoundReportRequest,
  CreateLostReportRequest,
  EditableReportResponse,
  Report,
  UpdateReportByReferenceRequest,
} from '../contracts/index.js';
import { ItemStatus } from '../contracts/index.js';
import { randomUUID } from 'node:crypto';
import { resolveSourceEnv } from '../utils/app-env.js';
import { normalizeDateReported } from '../utils/date-normalization.js';
import { createChangesFromPatch, recordItemHistoryEvent } from './item-history.service.js';

export class ReportPhotoUploadError extends Error {
  constructor(
    public readonly code: 'INVALID_PHOTO_DATA_URL' | 'PHOTO_UPLOAD_FAILED',
    message: string,
  ) {
    super(message);
    this.name = 'ReportPhotoUploadError';
  }
}

export class ReportNotFoundError extends Error {
  constructor() {
    super('Report not found');
    this.name = 'ReportNotFoundError';
  }
}

export class ReportEditConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportEditConflictError';
  }
}

export class ReportValidationConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportValidationConflictError';
  }
}

type ReportFlagActor = {
  uid: string;
  email?: string | null;
  role: 'ADMIN' | 'SECURITY';
};

type ListAdminReportsParams = {
  page: number;
  limit: number;
  kind?: Report['kind'];
  status?: Report['status'];
  search?: string;
  flagged?: boolean;
};

const currentSourceEnv: NonNullable<Report['sourceEnv']> = resolveSourceEnv();

const formatDateSegment = (date: Date): string => {
  const year = date.getUTCFullYear().toString();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const createReferenceCode = (prefix: 'LST' | 'FND', docId: string, createdAt: Date): string => {
  const normalizedId = docId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = normalizedId.slice(-8);
  return `${prefix}-${formatDateSegment(createdAt)}-${suffix}`;
};

type SupportedPhotoMimeType = 'image/jpeg' | 'image/png';

const parseGsUrl = (value: string): { bucketName: string; filePath: string } | null => {
  if (!value.startsWith('gs://')) {
    return null;
  }

  const normalized = value.slice('gs://'.length);
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) {
    return null;
  }

  return {
    bucketName: normalized.slice(0, slashIndex),
    filePath: normalized.slice(slashIndex + 1),
  };
};

const toAdminPhotoUrl = async (
  defaultBucket: Bucket,
  value: string | undefined,
): Promise<string | undefined> => {
  if (!value) {
    return undefined;
  }

  const gs = parseGsUrl(value);
  if (!gs) {
    return value;
  }

  const targetBucket =
    gs.bucketName === defaultBucket.name
      ? defaultBucket
      : defaultBucket.storage.bucket(gs.bucketName);

  const [url] = await targetBucket.file(gs.filePath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60,
  });

  return url;
};

const toAdminPhotoUrls = async (
  defaultBucket: Bucket,
  source: Partial<Report> & { imageUrls?: string[] },
): Promise<string[] | undefined> => {
  const rawValues = [
    ...(Array.isArray(source.imageUrls) ? source.imageUrls : []),
    ...(source.photoUrl ? [source.photoUrl] : []),
  ].filter((value, index, all) => typeof value === 'string' && value.trim().length > 0 && all.indexOf(value) === index);

  if (rawValues.length === 0) {
    return undefined;
  }

  const urls = await Promise.all(rawValues.map((value) => toAdminPhotoUrl(defaultBucket, value)));
  const validUrls = urls.filter((value): value is string => typeof value === 'string' && value.length > 0);
  return validUrls.length > 0 ? validUrls : undefined;
};

const uploadPhotoBuffer = async (
  bucket: Bucket,
  buffer: Buffer,
  contentType: SupportedPhotoMimeType,
): Promise<string> => {
  const extension = contentType === 'image/png' ? 'png' : 'jpg';
  const fileName = `reports/${Date.now()}-${randomUUID()}.${extension}`;
  const file = bucket.file(fileName);

  try {
    await file.save(buffer, {
      metadata: { contentType },
      resumable: false,
      public: false,
    });
  } catch {
    throw new ReportPhotoUploadError(
      'PHOTO_UPLOAD_FAILED',
      'Could not upload the photo right now. Please try again or submit without photo.',
    );
  }

  return `gs://${bucket.name}/${fileName}`;
};

const isEditableReportStatus = (status: Report['status']): boolean => {
  return status === ItemStatus.REPORTED || status === ItemStatus.PENDING_VALIDATION;
};

const mapEditableReport = (id: string, report: Report): EditableReportResponse => {
  return {
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
  };
};

const isItemStatus = (value: unknown): value is ItemStatus => {
  return typeof value === 'string' && Object.values(ItemStatus).includes(value as ItemStatus);
};

const mapAdminReport = async (
  bucket: Bucket,
  id: string,
  source: Partial<Report> & { imageUrls?: string[] },
): Promise<AdminReportResponse | null> => {
  const dateReported = normalizeDateReported(source.dateReported);

  if (
    (source.kind !== 'LOST' && source.kind !== 'FOUND')
    || typeof source.title !== 'string'
    || source.title.trim().length === 0
    || typeof source.referenceCode !== 'string'
    || source.referenceCode.trim().length === 0
    || !isItemStatus(source.status)
    || !dateReported
  ) {
    return null;
  }

  const photoUrls = await toAdminPhotoUrls(bucket, source);

  return {
    id,
    kind: source.kind,
    title: source.title,
    category: source.category,
    description: source.description,
    status: source.status,
    referenceCode: source.referenceCode,
    location: source.location,
    dateReported,
    contactEmail: source.contactEmail,
    photoUrl: photoUrls?.[0],
    photoUrls,
    isSuspicious: source.isSuspicious === true,
    suspiciousReason: source.suspiciousReason,
    suspiciousFlaggedByUid: source.suspiciousFlaggedByUid,
    suspiciousFlaggedByEmail: source.suspiciousFlaggedByEmail,
    suspiciousFlaggedByRole: source.suspiciousFlaggedByRole,
    suspiciousFlaggedAt: source.suspiciousFlaggedAt,
  };
};

export const createLostReport = async (
  db: Firestore,
  bucket: Bucket,
  payload: CreateLostReportRequest,
  photo?: { buffer: Buffer; mimeType: SupportedPhotoMimeType },
) => {
  let photoUrl: string | undefined;
  if (photo) {
    photoUrl = await uploadPhotoBuffer(bucket, photo.buffer, photo.mimeType);
  }
  const createdAt = new Date();
  const docRef = db.collection('reports').doc();

  const reportToSave: Omit<Report, 'id'> = {
    kind: 'LOST' as const,
    title: payload.title,
    status: ItemStatus.REPORTED,
    referenceCode: createReferenceCode('LST', docRef.id, createdAt),
    dateReported: payload.lastSeenAt ?? createdAt.toISOString(),
    sourceEnv: currentSourceEnv,
  };
  if (payload.description) {
    reportToSave.description = payload.description;
  }
  if (payload.category) {
    reportToSave.category = payload.category;
  }
  if (payload.additionalInfo) {
    reportToSave.additionalInfo = payload.additionalInfo;
  }
  if (payload.lastSeenLocation) {
    reportToSave.location = payload.lastSeenLocation;
  }
  if (payload.contactEmail) {
    reportToSave.contactEmail = payload.contactEmail;
  }
  if (photoUrl) {
    reportToSave.photoUrl = photoUrl;
  }

  await docRef.set(reportToSave);
  try {
    await recordItemHistoryEvent(db, {
      itemId: docRef.id,
      entityType: 'REPORT',
      entityId: docRef.id,
      actionType: 'REPORT_CREATED',
      timestamp: createdAt.toISOString(),
      summary: 'Lost-item report created.',
      actor: {
        type: 'USER',
        email: payload.contactEmail,
      },
      metadata: {
        referenceCode: reportToSave.referenceCode,
        reportKind: reportToSave.kind,
        itemStatus: reportToSave.status,
      },
      changes: [{
        field: 'status',
        newValue: reportToSave.status,
      }],
    });
  } catch (error) {
    console.error('Failed to record item history event for lost report', {
      reportId: docRef.id,
      referenceCode: reportToSave.referenceCode,
      error,
    });
  }
  return {
    id: docRef.id,
    report: {
      id: docRef.id,
      ...reportToSave,
    },
  };
};

export const createFoundReport = async (
  db: Firestore,
  bucket: Bucket,
  payload: CreateFoundReportRequest,
  photo: { buffer: Buffer; mimeType: SupportedPhotoMimeType },
) => {
  const photoUrl = await uploadPhotoBuffer(bucket, photo.buffer, photo.mimeType);
  const createdAt = new Date();
  const docRef = db.collection('reports').doc();

  const reportToSave: Omit<Report, 'id'> = {
    kind: 'FOUND' as const,
    title: payload.title,
    status: ItemStatus.PENDING_VALIDATION,
    referenceCode: createReferenceCode('FND', docRef.id, createdAt),
    location: payload.foundLocation,
    dateReported: payload.foundAt ?? createdAt.toISOString(),
    photoUrl,
    sourceEnv: currentSourceEnv,
  };

  if (payload.category) {
    reportToSave.category = payload.category;
  }
  if (payload.description) {
    reportToSave.description = payload.description;
  }
  if (payload.contactEmail) {
    reportToSave.contactEmail = payload.contactEmail;
  }

  await docRef.set(reportToSave);
  try {
    await recordItemHistoryEvent(db, {
      itemId: docRef.id,
      entityType: 'REPORT',
      entityId: docRef.id,
      actionType: 'REPORT_CREATED',
      timestamp: createdAt.toISOString(),
      summary: 'Found-item report created.',
      actor: {
        type: 'USER',
        email: payload.contactEmail,
      },
      metadata: {
        referenceCode: reportToSave.referenceCode,
        reportKind: reportToSave.kind,
        itemStatus: reportToSave.status,
      },
      changes: [{
        field: 'status',
        newValue: reportToSave.status,
      }],
    });
  } catch (error) {
    console.error('Failed to record item history event for found report', {
      reportId: docRef.id,
      referenceCode: reportToSave.referenceCode,
      error,
    });
  }
  return {
    id: docRef.id,
    report: {
      id: docRef.id,
      ...reportToSave,
    },
  };
};

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

export const updateReportByReferenceCode = async (
  db: Firestore,
  referenceCode: string,
  payload: UpdateReportByReferenceRequest,
): Promise<EditableReportResponse> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const snapshot = await transaction.get(
      db.collection('reports')
        .where('referenceCode', '==', referenceCode)
        .limit(1),
    );

    if (snapshot.empty) {
      throw new ReportNotFoundError();
    }

    const doc = snapshot.docs[0];
    const report = doc.data() as Report;

    if (!isEditableReportStatus(report.status)) {
      throw new ReportEditConflictError('Only reports still under review can be edited.');
    }

    const updatePatch: Partial<Report> = {};

    if (payload.title !== undefined) {
      updatePatch.title = payload.title;
    }
    if (payload.category !== undefined) {
      updatePatch.category = payload.category;
    }
    if (payload.description !== undefined) {
      updatePatch.description = payload.description;
    }
    if (payload.location !== undefined) {
      updatePatch.location = payload.location;
    }
    if (payload.dateReported !== undefined) {
      updatePatch.dateReported = payload.dateReported;
    }
    if (payload.contactEmail !== undefined) {
      updatePatch.contactEmail = payload.contactEmail;
    }

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
      }, {
        transaction,
      });
    }

    return mapEditableReport(doc.id, {
      ...report,
      ...updatePatch,
    });
  });
};

export const validateFoundReport = async (
  db: Firestore,
  reportId: string,
): Promise<{ id: string; report: Pick<Report, 'status' | 'referenceCode'> }> => {
  return db.runTransaction(async (transaction: Transaction) => {
    const reportRef = db.collection('reports').doc(reportId);
    const reportSnap = await transaction.get(reportRef);

    if (!reportSnap.exists) {
      throw new ReportNotFoundError();
    }

    const report = reportSnap.data() as Report | undefined;
    if (!report) {
      throw new ReportNotFoundError();
    }

    if (report.kind !== 'FOUND') {
      throw new ReportValidationConflictError('Only found-item reports can be validated.');
    }

    if (report.status !== ItemStatus.PENDING_VALIDATION) {
      throw new ReportValidationConflictError('Only pending validation found-item reports can be validated.');
    }

    transaction.update(reportRef, { status: ItemStatus.VALIDATED });
    await recordItemHistoryEvent(db, {
      itemId: reportId,
      entityType: 'REPORT',
      entityId: reportId,
      actionType: 'REPORT_VALIDATED',
      timestamp: new Date().toISOString(),
      summary: 'Found-item report validated by staff.',
      actor: {
        type: 'SECURITY',
      },
      metadata: {
        referenceCode: report.referenceCode,
        reportKind: report.kind,
        itemStatus: ItemStatus.VALIDATED,
      },
      changes: [{
        field: 'status',
        previousValue: report.status,
        newValue: ItemStatus.VALIDATED,
      }],
    }, {
      transaction,
    });

    return {
      id: reportId,
      report: {
        status: ItemStatus.VALIDATED,
        referenceCode: report.referenceCode,
      },
    };
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

    if (!reportSnap.exists) {
      throw new ReportNotFoundError();
    }

    const report = reportSnap.data() as Report | undefined;
    if (!report) {
      throw new ReportNotFoundError();
    }

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

export const listAdminReports = async (
  db: Firestore,
  bucket: Bucket,
  params: ListAdminReportsParams,
): Promise<{
  reports: AdminReportResponse[];
  total: number;
  summary: {
    totalReports: number;
    lostReports: number;
    foundReports: number;
    byStatus: Partial<Record<ItemStatus, number>>;
  };
}> => {
  const page = Math.max(1, Math.floor(params.page));
  const limit = Math.max(1, Math.floor(params.limit));
  const offset = (page - 1) * limit;
  const search = typeof params.search === 'string' ? params.search.trim().toLowerCase() : '';

  let reportsQuery: Query = db.collection('reports');
  if (params.kind) {
    reportsQuery = reportsQuery.where('kind', '==', params.kind);
  }
  if (params.status) {
    reportsQuery = reportsQuery.where('status', '==', params.status);
  }

  const reportsSnap = await reportsQuery.get();
  const allReports = (await Promise.all(
    reportsSnap.docs.map((doc) => mapAdminReport(bucket, doc.id, doc.data() as Partial<Report>)),
  ))
    .filter((report): report is AdminReportResponse => report !== null)
    .sort((a, b) => b.dateReported.localeCompare(a.dateReported));

  const filteredReports = allReports.filter((report) => {
    if (typeof params.flagged === 'boolean' && report.isSuspicious !== params.flagged) {
      return false;
    }

    if (search.length > 0) {
      const searchableText = [
        report.title,
        report.description ?? '',
        report.referenceCode,
        report.location ?? '',
        report.contactEmail ?? '',
      ].join(' ').toLowerCase();

      return searchableText.includes(search);
    }

    return true;
  });

  const byStatus = filteredReports.reduce<Partial<Record<ItemStatus, number>>>((acc, report) => {
    acc[report.status] = (acc[report.status] ?? 0) + 1;
    return acc;
  }, {});

  return {
    reports: filteredReports.slice(offset, offset + limit),
    total: filteredReports.length,
    summary: {
      totalReports: filteredReports.length,
      lostReports: filteredReports.filter((report) => report.kind === 'LOST').length,
      foundReports: filteredReports.filter((report) => report.kind === 'FOUND').length,
      byStatus,
    },
  };
};
