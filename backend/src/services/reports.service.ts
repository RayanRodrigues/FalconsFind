import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type {
  AdminReportResponse,
  CreateFoundReportRequest,
  CreateLostReportRequest,
  Report,
} from '../contracts/index.js';
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

const mapAdminReport = (id: string, source: Partial<Report>): AdminReportResponse | null => {
  const dateReported = normalizeDateReported(source.dateReported);

  if (
    (source.kind !== 'LOST' && source.kind !== 'FOUND')
    || typeof source.title !== 'string'
    || source.title.trim().length === 0
    || typeof source.referenceCode !== 'string'
    || source.referenceCode.trim().length === 0
    || typeof source.status !== 'string'
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
    status: 'REPORTED' as Report['status'],
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
    status: 'REPORTED' as Report['status'],
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
    byStatus: Record<string, number>;
  };
}> => {
  const page = Math.max(1, Math.floor(params.page));
  const limit = Math.max(1, Math.floor(params.limit));
  const offset = (page - 1) * limit;
  const search = typeof params.search === 'string' ? params.search.trim().toLowerCase() : '';

  const reportsSnap = await db.collection('reports').get();
  const allReports = reportsSnap.docs
    .map((doc) => mapAdminReport(doc.id, doc.data() as Partial<Report>))
    .filter((report): report is AdminReportResponse => report !== null)
    .sort((a, b) => b.dateReported.localeCompare(a.dateReported));

  const filteredReports = allReports.filter((report) => {
    if (params.kind && report.kind !== params.kind) {
      return false;
    }

    if (params.status && report.status !== params.status) {
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

  const byStatus = filteredReports.reduce<Record<string, number>>((acc, report) => {
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
