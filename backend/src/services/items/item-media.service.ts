import type { Bucket } from '@google-cloud/storage';
import type { RedisClient } from '../../bootstrap/redis.js';
import type { StoredItem } from './item-types.js';

const SIGNED_URL_CACHE_TTL_SECONDS = 3000;

const parseGsUrl = (value: string): { bucketName: string; filePath: string } | null => {
  if (!value.startsWith('gs://')) return null;
  const normalized = value.slice('gs://'.length);
  const slashIndex = normalized.indexOf('/');
  if (slashIndex <= 0 || slashIndex === normalized.length - 1) return null;
  return { bucketName: normalized.slice(0, slashIndex), filePath: normalized.slice(slashIndex + 1) };
};

export const toPublicImageUrl = async (
  defaultBucket: Bucket,
  value: string,
  redis: RedisClient | null,
): Promise<string> => {
  const gs = parseGsUrl(value);
  if (!gs) return value;

  const cacheKey = `signed_url:v1:${Buffer.from(value).toString('base64')}`;
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return cached;
    } catch {}
  }

  const targetBucket = gs.bucketName === defaultBucket.name ? defaultBucket : defaultBucket.storage.bucket(gs.bucketName);
  const [url] = await targetBucket.file(gs.filePath).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + 1000 * 60 * 60,
  });

  if (redis) {
    try {
      await redis.set(cacheKey, url, { EX: SIGNED_URL_CACHE_TTL_SECONDS });
    } catch {}
  }

  return url;
};

export const resolveImageUrls = async (
  bucket: Bucket,
  source: StoredItem,
  redis: RedisClient | null,
): Promise<string[] | undefined> => {
  const rawUrls = source.imageUrls ?? (source.photoUrl ? [source.photoUrl] : undefined);
  if (!rawUrls || rawUrls.length === 0) return undefined;

  const urls = await Promise.all(
    rawUrls
      .filter((url) => typeof url === 'string' && url.trim().length > 0)
      .map(async (url) => {
        try {
          return await toPublicImageUrl(bucket, url, redis);
        } catch {
          return url;
        }
      }),
  );

  return urls.length > 0 ? urls : undefined;
};
