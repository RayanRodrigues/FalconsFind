import type { RedisClient } from '../../bootstrap/redis.js';

const PUBLIC_ITEMS_CACHE_TTL_SECONDS = 30;
const PUBLIC_ITEMS_LIST_CACHE_PREFIX = 'items_public:list:v1:';

type PublicItemsListCacheKeyParams = {
  page: number;
  limit: number;
  keyword?: string;
  category?: string;
  location?: string;
  dateFrom?: string;
  dateTo?: string;
  sort?: 'most_recent' | 'oldest';
};

export const buildPublicItemDetailCacheKey = (itemId: string): string => (
  `items_public:detail:v1:${itemId.trim()}`
);

export const buildPublicItemsListCacheKey = (params: PublicItemsListCacheKeyParams): string => (
  `${PUBLIC_ITEMS_LIST_CACHE_PREFIX}${JSON.stringify({
    page: params.page,
    limit: params.limit,
    keyword: params.keyword ?? '',
    category: params.category ?? '',
    location: params.location ?? '',
    dateFrom: params.dateFrom ?? '',
    dateTo: params.dateTo ?? '',
    sort: params.sort ?? 'most_recent',
  })}`
);

export const getCachedPublicItemQuery = async <T>(
  redis: RedisClient | null,
  cacheKey: string,
): Promise<T | null> => {
  if (!redis) {
    return null;
  }

  try {
    const cached = await redis.get(cacheKey);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached) as T;
  } catch {
    return null;
  }
};

export const setCachedPublicItemQuery = async <T>(
  redis: RedisClient | null,
  cacheKey: string,
  value: T,
): Promise<void> => {
  if (!redis) {
    return;
  }

  try {
    await redis.set(cacheKey, JSON.stringify(value), { EX: PUBLIC_ITEMS_CACHE_TTL_SECONDS });
  } catch {
    // Ignore cache write failures and continue serving live data.
  }
};

export const invalidatePublicItemsCache = async (
  redis: RedisClient | null,
  itemId?: string,
): Promise<void> => {
  if (!redis) {
    return;
  }

  try {
    const keysToDelete = new Set<string>();

    if (itemId?.trim()) {
      keysToDelete.add(buildPublicItemDetailCacheKey(itemId));
    }

    const listKeys = await redis.keys(`${PUBLIC_ITEMS_LIST_CACHE_PREFIX}*`);
    for (const key of listKeys) {
      keysToDelete.add(key);
    }

    if (keysToDelete.size > 0) {
      await redis.del([...keysToDelete]);
    }
  } catch {
    // Ignore cache invalidation failures and continue serving live data.
  }
};
