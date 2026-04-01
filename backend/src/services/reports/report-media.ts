import type { Bucket } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import type { AdminReportResponse, Report } from '../../contracts/index.js';
import { normalizeDateReported } from '../../utils/date-normalization.js';
import { ReportPhotoUploadError } from './report-errors.js';
import type { SupportedPhotoMimeType } from './report-types.js';
import { isItemStatus } from './report-shared.js';

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

export const toAdminPhotoUrl = async (
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

export const toAdminPhotoUrls = async (
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

export const uploadPhotoBuffer = async (
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

export const mapAdminReport = async (
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
    archivedAt: source.archivedAt ?? null,
    contactEmail: source.contactEmail,
    photoUrl: photoUrls?.[0],
    photoUrls,
    isSuspicious: source.isSuspicious === true,
    flagReason: source.suspiciousReason,
    flaggedAt: source.suspiciousFlaggedAt,
    suspiciousReason: source.suspiciousReason,
    suspiciousFlaggedByUid: source.suspiciousFlaggedByUid,
    suspiciousFlaggedByEmail: source.suspiciousFlaggedByEmail,
    suspiciousFlaggedByRole: source.suspiciousFlaggedByRole,
    suspiciousFlaggedAt: source.suspiciousFlaggedAt,
  };
};
