import type { Firestore } from 'firebase-admin/firestore';
import type { Bucket } from '@google-cloud/storage';
import type { CreateFoundReportRequest, CreateLostReportRequest, Report } from '../contracts/index.js';
import { saveReport } from '../repositories/reports.repository.js';

const createReferenceCode = (prefix: 'LST' | 'FND'): string => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).slice(2, 7).toUpperCase();
  return `${prefix}-${timestamp}-${random}`;
};

const uploadPhotoFromDataUrl = async (bucket: Bucket, photoDataUrl: string): Promise<string> => {
  const match = photoDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid photo data URL');
  }

  const contentType = match[1];
  const base64 = match[2];
  const extension = contentType.split('/')[1] ?? 'jpg';
  const fileName = `reports/lost/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${extension}`;
  const buffer = Buffer.from(base64, 'base64');
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
    public: false,
  });

  return `gs://${bucket.name}/${fileName}`;
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

  const reportToSave: Omit<Report, 'id'> = {
    kind: 'LOST' as const,
    title: payload.title,
    description: payload.description,
    status: 'REPORTED' as Report['status'],
    referenceCode: createReferenceCode('LST'),
    location: payload.lastSeenLocation,
    dateReported: payload.lastSeenAt ?? new Date().toISOString(),
    contactEmail: payload.contactEmail,
    photoUrl,
  };

  return saveReport(db, reportToSave);
};

export const createFoundReport = async (
  db: Firestore,
  bucket: Bucket,
  payload: CreateFoundReportRequest,
) => {
  const photoUrl = await uploadPhotoFromDataUrl(bucket, payload.photoDataUrl);

  const reportToSave: Omit<Report, 'id'> = {
    kind: 'FOUND' as const,
    title: payload.title,
    description: payload.description,
    status: 'REPORTED' as Report['status'],
    referenceCode: createReferenceCode('FND'),
    location: payload.foundLocation,
    dateReported: payload.foundAt ?? new Date().toISOString(),
    contactEmail: payload.contactEmail,
    photoUrl,
  };

  return saveReport(db, reportToSave);
};
