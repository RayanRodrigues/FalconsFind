import type { Bucket } from '@google-cloud/storage';
import type { Firestore } from 'firebase-admin/firestore';
import type { CreateFoundReportRequest, CreateLostReportRequest, Report } from '../../contracts/index.js';
import { ItemStatus } from '../../contracts/index.js';
import { recordItemHistoryEvent } from '../item-history.service.js';
import type { SupportedPhotoMimeType } from './report-types.js';
import { createReferenceCode, currentSourceEnv } from './report-shared.js';
import { uploadPhotoBuffer } from './report-media.js';

export const createLostReport = async (
  db: Firestore,
  bucket: Bucket,
  payload: CreateLostReportRequest,
  photo?: { buffer: Buffer; mimeType: SupportedPhotoMimeType },
) => {
  const photoUrl = photo ? await uploadPhotoBuffer(bucket, photo.buffer, photo.mimeType) : undefined;
  const createdAt = new Date();
  const docRef = db.collection('reports').doc();

  const reportToSave: Omit<Report, 'id'> = {
    kind: 'LOST',
    title: payload.title,
    status: ItemStatus.REPORTED,
    referenceCode: createReferenceCode('LST', docRef.id, createdAt),
    dateReported: payload.lastSeenAt ?? createdAt.toISOString(),
    sourceEnv: currentSourceEnv,
  };

  if (payload.description) reportToSave.description = payload.description;
  if (payload.category) reportToSave.category = payload.category;
  if (payload.additionalInfo) reportToSave.additionalInfo = payload.additionalInfo;
  if (payload.lastSeenLocation) reportToSave.location = payload.lastSeenLocation;
  if (payload.contactEmail) reportToSave.contactEmail = payload.contactEmail;
  if (photoUrl) reportToSave.photoUrl = photoUrl;

  await docRef.set(reportToSave);

  try {
    await recordItemHistoryEvent(db, {
      itemId: docRef.id,
      entityType: 'REPORT',
      entityId: docRef.id,
      actionType: 'REPORT_CREATED',
      timestamp: createdAt.toISOString(),
      summary: 'Lost-item report created.',
      actor: { type: 'USER', email: payload.contactEmail },
      metadata: {
        referenceCode: reportToSave.referenceCode,
        reportKind: reportToSave.kind,
        itemStatus: reportToSave.status,
      },
      changes: [{ field: 'status', newValue: reportToSave.status }],
    });
  } catch (error) {
    console.error('Failed to record item history event for lost report', {
      reportId: docRef.id,
      referenceCode: reportToSave.referenceCode,
      error,
    });
  }

  return { id: docRef.id, report: { id: docRef.id, ...reportToSave } };
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
    kind: 'FOUND',
    title: payload.title,
    status: ItemStatus.PENDING_VALIDATION,
    referenceCode: createReferenceCode('FND', docRef.id, createdAt),
    location: payload.foundLocation,
    dateReported: payload.foundAt ?? createdAt.toISOString(),
    photoUrl,
    sourceEnv: currentSourceEnv,
  };

  if (payload.category) reportToSave.category = payload.category;
  if (payload.description) reportToSave.description = payload.description;
  if (payload.contactEmail) reportToSave.contactEmail = payload.contactEmail;

  await docRef.set(reportToSave);

  try {
    await recordItemHistoryEvent(db, {
      itemId: docRef.id,
      entityType: 'REPORT',
      entityId: docRef.id,
      actionType: 'REPORT_CREATED',
      timestamp: createdAt.toISOString(),
      summary: 'Found-item report created.',
      actor: { type: 'USER', email: payload.contactEmail },
      metadata: {
        referenceCode: reportToSave.referenceCode,
        reportKind: reportToSave.kind,
        itemStatus: reportToSave.status,
      },
      changes: [{ field: 'status', newValue: reportToSave.status }],
    });
  } catch (error) {
    console.error('Failed to record item history event for found report', {
      reportId: docRef.id,
      referenceCode: reportToSave.referenceCode,
      error,
    });
  }

  return { id: docRef.id, report: { id: docRef.id, ...reportToSave } };
};
