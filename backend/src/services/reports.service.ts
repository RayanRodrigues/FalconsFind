import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type {
  CreateFoundReportRequest,
  CreateLostReportRequest,
  EditableReportResponse,
  Report,
  UpdateReportByReferenceRequest,
} from '../contracts/index.js';
import { randomUUID } from 'node:crypto';
import { ItemStatus } from '../contracts/index.js';

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

  await doc.ref.update(updatePatch);

  return mapEditableReport(doc.id, {
    ...report,
    ...updatePatch,
  });
};
