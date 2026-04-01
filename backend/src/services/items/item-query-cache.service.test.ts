import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listValidatedItems } from '../items.service.js';
import { invalidatePublicItemsCache } from './item-query-cache.service.js';

describe('listValidatedItems cache', () => {
  let countFn: ReturnType<typeof vi.fn>;
  let countGetFn: ReturnType<typeof vi.fn>;
  let orderByFn: ReturnType<typeof vi.fn>;
  let orderedLimitFn: ReturnType<typeof vi.fn>;
  let getOrderedFn: ReturnType<typeof vi.fn>;
  let db: unknown;
  let bucket: unknown;
  let redis: {
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    const pageSnap = {
      docs: [
        {
          id: 'item-1',
          data: () => ({
            kind: 'FOUND',
            status: 'VALIDATED',
            title: 'Wallet',
            category: 'Accessories',
            referenceCode: 'FND-1',
            location: 'Library',
            dateReported: '2026-02-01T10:00:00.000Z',
          }),
        },
      ],
    };

    getOrderedFn = vi.fn().mockResolvedValue(pageSnap);
    orderedLimitFn = vi.fn().mockReturnValue({ get: getOrderedFn });
    orderByFn = vi.fn().mockReturnValue({
      get: getOrderedFn,
      limit: orderedLimitFn,
      startAfter: vi.fn(),
    });

    countGetFn = vi.fn().mockResolvedValue({
      data: () => ({ count: 1 }),
    });
    countFn = vi.fn().mockReturnValue({ get: countGetFn });

    const reportsQuery = {
      where: vi.fn((_field: string, _operator: string, _value: unknown) => reportsQuery),
      get: vi.fn().mockResolvedValue({ docs: [] }),
      count: countFn,
      orderBy: orderByFn,
    };

    db = {
      collection: vi.fn((collectionName: string) => {
        if (collectionName === 'reports') {
          return { where: reportsQuery.where };
        }

        throw new Error(`Unexpected collection: ${collectionName}`);
      }),
    };

    bucket = {
      name: 'test-bucket',
      file: vi.fn(),
      storage: { bucket: vi.fn() },
    };

    redis = {
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue('OK'),
      keys: vi.fn().mockResolvedValue([]),
      del: vi.fn().mockResolvedValue(0),
    };
  });

  it('stores first public items response in redis and reuses it on the next call', async () => {
    const first = await listValidatedItems(db as never, bucket as never, redis as never, {
      page: 1,
      limit: 10,
      sort: 'most_recent',
    });

    expect(first.total).toBe(1);
    expect(orderByFn).toHaveBeenCalledTimes(1);
    expect(redis.get).toHaveBeenCalledTimes(1);
    expect(redis.set).toHaveBeenCalledTimes(1);

    const cachedPayload = redis.set.mock.calls[0][1];
    redis.get.mockResolvedValueOnce(cachedPayload);

    const second = await listValidatedItems(db as never, bucket as never, redis as never, {
      page: 1,
      limit: 10,
      sort: 'most_recent',
    });

    expect(second).toEqual(first);
    expect(orderByFn).toHaveBeenCalledTimes(1);
    expect(countFn).toHaveBeenCalledTimes(1);
    expect(redis.get).toHaveBeenCalledTimes(2);
  });

  it('uses different cache entries for different sort options', async () => {
    await listValidatedItems(db as never, bucket as never, redis as never, {
      page: 1,
      limit: 10,
      sort: 'most_recent',
    });

    await listValidatedItems(db as never, bucket as never, redis as never, {
      page: 1,
      limit: 10,
      sort: 'oldest',
    });

    expect(redis.set).toHaveBeenCalledTimes(2);
    expect(orderByFn).toHaveBeenNthCalledWith(1, 'dateReported', 'desc');
    expect(orderByFn).toHaveBeenNthCalledWith(2, 'dateReported', 'asc');
  });

  it('invalidates detail and list caches together after item writes', async () => {
    redis.keys.mockResolvedValueOnce([
      'items_public:list:v1:{"page":1,"limit":10}',
      'items_public:list:v1:{"page":2,"limit":10}',
    ]);

    await invalidatePublicItemsCache(redis as never, 'item-123');

    expect(redis.keys).toHaveBeenCalledWith('items_public:list:v1:*');
    expect(redis.del).toHaveBeenCalledWith([
      'items_public:detail:v1:item-123',
      'items_public:list:v1:{"page":1,"limit":10}',
      'items_public:list:v1:{"page":2,"limit":10}',
    ]);
  });
});
