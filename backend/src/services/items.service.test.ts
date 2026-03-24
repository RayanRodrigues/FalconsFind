import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getPublicItemStatus, listValidatedItems } from './items.service.js';
import { ClaimStatus, ItemStatus } from '../contracts/index.js';

type FakeDoc = { id: string; data: () => unknown };
type FakeSnap = { docs: FakeDoc[] };

describe('listValidatedItems', () => {
  let db: unknown;
  let bucket: unknown;

  let collectionFn: ReturnType<typeof vi.fn>;
  let whereFn: ReturnType<typeof vi.fn>;
  let countFn: ReturnType<typeof vi.fn>;
  let countGetFn: ReturnType<typeof vi.fn>;

  let orderByFn: ReturnType<typeof vi.fn>;
  let orderedLimitFn: ReturnType<typeof vi.fn>;
  let startAfterFn: ReturnType<typeof vi.fn>;
  let limitFn: ReturnType<typeof vi.fn>;
  let getPageFn: ReturnType<typeof vi.fn>;
  let getOrderedFn: ReturnType<typeof vi.fn>;
  let whereCalls: Array<[string, string, unknown]>;

  beforeEach(() => {
    const pageSnap: FakeSnap = {
      docs: [
        {
          id: 'b',
          data: () => ({
            kind: 'FOUND',
            status: 'VALIDATED',
            title: 'B',
            category: 'Accessories',
            referenceCode: 'REF-B',
            dateReported: { toDate: () => new Date('2026-02-01T10:00:00.000Z') },
          }),
        },
      ],
    };

    getPageFn = vi.fn().mockResolvedValue(pageSnap);
    getOrderedFn = vi.fn().mockResolvedValue(pageSnap);

    const queryAfterLimit = { get: getPageFn };
    limitFn = vi.fn().mockReturnValue(queryAfterLimit);

    const queryAfterOrderedLimit = { get: getOrderedFn };
    orderedLimitFn = vi.fn().mockReturnValue(queryAfterOrderedLimit);

    const queryAfterStartAfter = { limit: limitFn };
    startAfterFn = vi.fn().mockReturnValue(queryAfterStartAfter);

    const queryAfterOrderBy = { startAfter: startAfterFn, limit: orderedLimitFn, get: getOrderedFn };
    orderByFn = vi.fn().mockReturnValue(queryAfterOrderBy);

    countGetFn = vi.fn().mockResolvedValue({
      data: () => ({ count: 2 }),
    });
    countFn = vi.fn().mockReturnValue({ get: countGetFn });

    whereCalls = [];
    const query = {
      where: vi.fn((field: string, operator: string, value: unknown) => {
        whereCalls.push([field, operator, value]);
        return query;
      }),
      count: countFn,
      orderBy: orderByFn,
    };
    whereFn = query.where;
    const collectionObj = { where: whereFn };

    collectionFn = vi.fn().mockReturnValue(collectionObj);
    db = { collection: collectionFn };
    bucket = {
      name: 'test-bucket',
      file: (filePath: string) => ({
        getSignedUrl: vi.fn().mockResolvedValue([`https://signed.local/${filePath}`]),
      }),
      storage: {
        bucket: (bucketName: string) => ({
          file: (filePath: string) => ({
            getSignedUrl: vi
              .fn()
              .mockResolvedValue([`https://signed.local/${bucketName}/${filePath}`]),
          }),
        }),
      },
    };
  });

  it('filters FOUND items that are available or claimed, returns total + paged items', async () => {
    const result = await listValidatedItems(db as never, bucket as never, null, { page: 1, limit: 10 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('b');
    expect(result.items[0].title).toBe('B');
    expect(result.items[0].category).toBe('Accessories');
    expect(result.items[0].dateReported).toBe('2026-02-01T10:00:00.000Z');
    expect(result.items[0].availability).toBe('AVAILABLE');
    expect(result.items[0].thumbnailUrl).toBeUndefined();

    expect(collectionFn).toHaveBeenCalledWith('reports');
    expect(whereCalls).toEqual([
      ['kind', '==', 'FOUND'],
      ['status', 'in', ['VALIDATED', 'CLAIMED']],
    ]);

    expect(countFn).toHaveBeenCalledTimes(1);
    expect(countGetFn).toHaveBeenCalledTimes(1);

    expect(orderByFn).toHaveBeenCalledWith('dateReported', 'desc');
    expect(startAfterFn).not.toHaveBeenCalled();
    expect(orderedLimitFn).toHaveBeenCalledWith(10);
    expect(getOrderedFn).toHaveBeenCalledTimes(1);
  });

  it('clamps page and limit to at least 1', async () => {
    await listValidatedItems(db as never, bucket as never, null, { page: 0, limit: 0 });

    expect(startAfterFn).not.toHaveBeenCalled();
    expect(orderedLimitFn).toHaveBeenCalledWith(1);
  });

  it('uses startAfter to walk to page 3 with limit 5', async () => {
    await listValidatedItems(db as never, bucket as never, null, { page: 3, limit: 5 });

    expect(startAfterFn).toHaveBeenCalledTimes(2);
    expect(limitFn).toHaveBeenCalledWith(5);
    expect(getPageFn).toHaveBeenCalledTimes(2);
  });

  it('applies optional category, location and date filters before paging', async () => {
    await listValidatedItems(db as never, bucket as never, null, {
      page: 1,
      limit: 10,
      category: 'Accessories',
      location: 'Library',
      dateFrom: '2026-02-01T00:00:00.000Z',
      dateTo: '2026-02-28T23:59:59.999Z',
    });

    expect(whereCalls).toEqual([
      ['kind', '==', 'FOUND'],
      ['status', 'in', ['VALIDATED', 'CLAIMED']],
      ['category', '==', 'Accessories'],
      ['location', '==', 'Library'],
      ['dateReported', '>=', '2026-02-01T00:00:00.000Z'],
      ['dateReported', '<=', '2026-02-28T23:59:59.999Z'],
    ]);
  });

  it('filters validated items by keyword across title and description', async () => {
    getOrderedFn.mockResolvedValue({
      docs: [
        {
          id: 'match-title',
          data: () => ({
            kind: 'FOUND',
            status: 'VALIDATED',
            title: 'Black Macbook Air',
            description: 'Left near the atrium',
            referenceCode: 'REF-TITLE',
            dateReported: '2026-02-01T10:00:00.000Z',
          }),
        },
        {
          id: 'match-description',
          data: () => ({
            kind: 'FOUND',
            status: 'VALIDATED',
            title: 'Laptop sleeve',
            description: 'Contains a silver macbook charger',
            referenceCode: 'REF-DESC',
            dateReported: '2026-02-01T09:00:00.000Z',
          }),
        },
        {
          id: 'no-match',
          data: () => ({
            kind: 'FOUND',
            status: 'VALIDATED',
            title: 'Blue bottle',
            description: 'Found in the gym',
            referenceCode: 'REF-NOPE',
            dateReported: '2026-02-01T08:00:00.000Z',
          }),
        },
      ],
    });

    const result = await listValidatedItems(
      db as never,
      bucket as never,
      null,
      { page: 1, limit: 10, keyword: 'MacBook' },
    );

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(2);
    expect(result.items.map((item) => item.id)).toEqual(['match-title', 'match-description']);
    expect(getOrderedFn).toHaveBeenCalledTimes(1);
    expect(orderedLimitFn).toHaveBeenCalledWith(10);
    expect(startAfterFn).not.toHaveBeenCalled();
    expect(countFn).not.toHaveBeenCalled();
  });

  it('maps public item status into an availability response', () => {
    const result = getPublicItemStatus({
      id: 'item-claimed',
      title: 'Headphones',
      status: ItemStatus.CLAIMED,
      availability: 'CLAIMED' as const,
      referenceCode: 'FND-20260201-CLAIMED1',
      dateReported: '2026-02-01T10:00:00.000Z',
      claimStatus: ClaimStatus.APPROVED,
    });

    expect(result).toEqual({
      id: 'item-claimed',
      status: 'CLAIMED',
      availability: 'CLAIMED',
      claimStatus: 'APPROVED',
    });
  });
});
