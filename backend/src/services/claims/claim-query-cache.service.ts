import type { RedisClient } from '../../bootstrap/redis.js';

const ADMIN_CLAIMS_CACHE_PREFIX = 'claims_admin:list:v1:';
const USER_CLAIMS_CACHE_PREFIX = 'claims_user:list:v1:';
const CLAIMS_CACHE_TTL_SECONDS = 30;

export const buildAdminClaimsCacheKey = (): string => `${ADMIN_CLAIMS_CACHE_PREFIX}all`;

export const buildUserClaimsCacheKey = (uid: string): string => (
  `${USER_CLAIMS_CACHE_PREFIX}${uid.trim()}`
);

export const getCachedClaimsQuery = async <T>(
  redis: RedisClient | null,
  cacheKey: string,
): Promise<T | null> => {
  if (!redis) {
    return null;
  }

  try {
    const cached = await redis.get(cacheKey);
    return cached ? JSON.parse(cached) as T : null;
  } catch {
    return null;
  }
};

export const setCachedClaimsQuery = async <T>(
  redis: RedisClient | null,
  cacheKey: string,
  value: T,
): Promise<void> => {
  if (!redis) {
    return;
  }

  try {
    await redis.set(cacheKey, JSON.stringify(value), { EX: CLAIMS_CACHE_TTL_SECONDS });
  } catch {
    // Ignore cache write failures and continue serving live data.
  }
};

export const invalidateAdminClaimsCache = async (
  redis: RedisClient | null,
): Promise<void> => {
  if (!redis) {
    return;
  }

  try {
    const keys = await redis.keys(`${ADMIN_CLAIMS_CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch {
    // Ignore cache invalidation failures and continue serving live data.
  }
};

export const invalidateUserClaimsCache = async (
  redis: RedisClient | null,
  uid?: string,
): Promise<void> => {
  if (!redis) {
    return;
  }

  try {
    if (uid?.trim()) {
      await redis.del(buildUserClaimsCacheKey(uid));
      return;
    }

    const keys = await redis.keys(`${USER_CLAIMS_CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch {
    // Ignore cache invalidation failures and continue serving live data.
  }
};
