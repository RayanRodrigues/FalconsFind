import type { RedisClient } from '../../bootstrap/redis.js';
import type { ListAdminReportsParams } from './report-types.js';

const ADMIN_REPORTS_CACHE_TTL_SECONDS = 30;
const ADMIN_REPORTS_CACHE_PREFIX = 'reports_admin:list:v1:';

export const buildAdminReportsCacheKey = (params: ListAdminReportsParams): string => (
  `${ADMIN_REPORTS_CACHE_PREFIX}${JSON.stringify({
    page: params.page,
    limit: params.limit,
    kind: params.kind ?? '',
    status: params.status ?? '',
    search: params.search ?? '',
    flagged: typeof params.flagged === 'boolean' ? params.flagged : '',
  })}`
);

export const getCachedAdminReportsQuery = async <T>(
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

export const setCachedAdminReportsQuery = async <T>(
  redis: RedisClient | null,
  cacheKey: string,
  value: T,
): Promise<void> => {
  if (!redis) {
    return;
  }

  try {
    await redis.set(cacheKey, JSON.stringify(value), { EX: ADMIN_REPORTS_CACHE_TTL_SECONDS });
  } catch {
    // Ignore cache write failures and continue serving live data.
  }
};

export const invalidateAdminReportsCache = async (
  redis: RedisClient | null,
): Promise<void> => {
  if (!redis) {
    return;
  }

  try {
    const keys = await redis.keys(`${ADMIN_REPORTS_CACHE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(keys);
    }
  } catch {
    // Ignore cache invalidation failures and continue serving live data.
  }
};
