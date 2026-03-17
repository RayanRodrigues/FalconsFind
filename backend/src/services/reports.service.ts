import type { Firestore, Query, Transaction } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type {
  AdminReportResponse,
  CreateFoundReportRequest,
  CreateLostReportRequest,
  EditableReportResponse,
  Report,
  UpdateReportByReferenceRequest,
} from '../contracts/index.js';
import { ItemStatus } from '../contracts/index.js';
import { randomUUID } from 'node:crypto';

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

type ListAdminReportsParams = {
  page: number;
  limit: number;
  kind?: Report['kind'];
  status?: Report['status'];
  search?: string;
};

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

const uploadPhotoFromDataUrl = async (bucket: Bucket, photoDataUrl: string): Promise<string> => {
  const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new ReportPhotoUploadError('INVALID_PHOTO_DATA_URL', 'Invalid photo data URL');
  }

  const contentType = match[1];
  const base64 = match[2];
  const extension = contentType.split('/')[1] ?? 'jpg';
  const fileName = `reports/lost/${Date.now()}-${randomUUID()}.${extension}`;
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length === 0) {
    throw new ReportPhotoUploadError('INVALID_PHOTO_DATA_URL', 'Invalid photo data URL');
  }
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

const normalizeDateReported = (value: unknown): string | undefined => {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (
    typeof value === 'object'
    && value !== null
    && typeof (value as { toDate?: unknown }).toDate === 'function'
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }

  return undefined;
};

const isItemStatus = (value: unknown): value is ItemStatus => {
  return typeof value === 'string' && Object.values(ItemStatus).includes(value as ItemStatus);
};

const mapAdminReport = (id: string, source: Partial<Report>): AdminReportResponse | null => {
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
    photoUrl: source.photoUrl,
  };
};

export const createLostReport = async (
  db: Firestore,
  bucket: Bucket,
  payload: CreateLostReportRequest,
) => {
  let photoUrl: string | undefined;
  if (payload.photoDataUrl) {
    photoUrl = await uploadPhotoFromDataUrl(bucket, payload.photoDataUrl);
  }
  const createdAt = new Date();
  const docRef = db.collection('reports').doc();

  const reportToSave: Omit<Report, 'id'> = {
    kind: 'LOST' as const,
    title: payload.title,
    status: ItemStatus.REPORTED,
    referenceCode: createReferenceCode('LST', docRef.id, createdAt),
    dateReported: payload.lastSeenAt ?? createdAt.toISOString(),
  };
  if (payload.description) {
    reportToSave.description = payload.description;
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
) => {
  const photoUrl = await uploadPhotoFromDataUrl(bucket, payload.photoDataUrl);
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

    return {
      id: reportId,
      report: {
        status: ItemStatus.VALIDATED,
        referenceCode: report.referenceCode,
      },
    };
  });
};

export const listAdminReports = async (
  db: Firestore,
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
  const allReports = reportsSnap.docs
    .map((doc) => mapAdminReport(doc.id, doc.data() as Partial<Report>))
    .filter((report): report is AdminReportResponse => report !== null)
    .sort((a, b) => b.dateReported.localeCompare(a.dateReported));

  const filteredReports = allReports.filter((report) => {
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
