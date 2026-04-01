import type { RedisClient } from '../../bootstrap/redis.js';

const PUBLIC_ITEMS_CACHE_TTL_SECONDS = 30;

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
  `items_public:list:v1:${JSON.stringify({
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
