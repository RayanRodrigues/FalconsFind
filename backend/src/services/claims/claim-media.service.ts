import type { Bucket } from '@google-cloud/storage';
import { randomUUID } from 'node:crypto';
import type { SupportedPhotoMimeType } from './claim-types.js';

export const uploadProofPhotoBuffer = async (
  bucket: Bucket,
  buffer: Buffer,
  contentType: SupportedPhotoMimeType,
): Promise<string> => {
  const extension = contentType === 'image/png' ? 'png' : 'jpg';
  const fileName = `claims/${Date.now()}-${randomUUID()}.${extension}`;
  const file = bucket.file(fileName);

  await file.save(buffer, {
    metadata: { contentType },
    resumable: false,
    public: false,
  });

  return `gs://${bucket.name}/${fileName}`;
};

const parseGsUrl = (value: string): { bucketName: string; filePath: string } | null => {
  if (!value.startsWith('gs://')) return null;

  const normalized = value.slice('gs://'.length);
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) return null;

  return {
    bucketName: normalized.slice(0, slashIndex),
    filePath: normalized.slice(slashIndex + 1),
  };
};

const toClaimPhotoUrl = async (defaultBucket: Bucket, value: string): Promise<string> => {
  const gs = parseGsUrl(value);
  if (!gs) return value;

  const targetBucket = gs.bucketName === defaultBucket.name
    ? defaultBucket
    : defaultBucket.storage.bucket(gs.bucketName);

  const [url] = await targetBucket.file(gs.filePath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60,
  });

  return url;
};

export const toClaimPhotoUrls = async (bucket: Bucket, values: string[] | undefined): Promise<string[] | undefined> => {
  if (!Array.isArray(values) || values.length === 0) return undefined;

  const urls = await Promise.all(
    values
      .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      .map((value) => toClaimPhotoUrl(bucket, value)),
  );

  return urls.length > 0 ? urls : undefined;
};
