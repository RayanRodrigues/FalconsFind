import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listValidatedItems } from './items.service.js';

type FakeDoc = { id: string; data: () => unknown };
type FakeSnap = { docs: FakeDoc[] };

describe('listValidatedItems', () => {
  let db: unknown;
  let bucket: unknown;

  let collectionFn: ReturnType<typeof vi.fn>;
  let where1Fn: ReturnType<typeof vi.fn>;
  let where2Fn: ReturnType<typeof vi.fn>;
  let countFn: ReturnType<typeof vi.fn>;
  let countGetFn: ReturnType<typeof vi.fn>;

  let orderByFn: ReturnType<typeof vi.fn>;
  let offsetFn: ReturnType<typeof vi.fn>;
  let limitFn: ReturnType<typeof vi.fn>;
  let getPageFn: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    const pageSnap: FakeSnap = {
      docs: [
        {
          id: 'b',
          data: () => ({
            kind: 'FOUND',
            status: 'VALIDATED',
            title: 'B',
            referenceCode: 'REF-B',
            dateReported: { toDate: () => new Date('2026-02-01T10:00:00.000Z') },
          }),
        },
      ],
    };

    getPageFn = vi.fn().mockResolvedValue(pageSnap);

    const queryAfterLimit = { get: getPageFn };
    limitFn = vi.fn().mockReturnValue(queryAfterLimit);

    const queryAfterOffset = { limit: limitFn };
    offsetFn = vi.fn().mockReturnValue(queryAfterOffset);

    const queryAfterOrderBy = { offset: offsetFn };
    orderByFn = vi.fn().mockReturnValue(queryAfterOrderBy);

    countGetFn = vi.fn().mockResolvedValue({
      data: () => ({ count: 2 }),
    });
    countFn = vi.fn().mockReturnValue({ get: countGetFn });

    const baseQuery = {
      count: countFn,
      orderBy: orderByFn,
    };

    where2Fn = vi.fn().mockReturnValue(baseQuery);
    const queryAfterWhere1 = { where: where2Fn };

    where1Fn = vi.fn().mockReturnValue(queryAfterWhere1);
    const collectionObj = { where: where1Fn };

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

  it('filters FOUND + VALIDATED, returns total + paged items', async () => {
    const result = await listValidatedItems(db as never, bucket as never, { page: 1, limit: 10 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('b');
    expect(result.items[0].title).toBe('B');
    expect(result.items[0].dateReported).toBe('2026-02-01T10:00:00.000Z');
    expect(result.items[0].thumbnailUrl).toBeUndefined();

    expect(collectionFn).toHaveBeenCalledWith('reports');
    expect(where1Fn).toHaveBeenCalledWith('kind', '==', 'FOUND');
    expect(where2Fn).toHaveBeenCalledWith('status', '==', 'VALIDATED');

    expect(countFn).toHaveBeenCalledTimes(1);
    expect(countGetFn).toHaveBeenCalledTimes(1);

    expect(orderByFn).toHaveBeenCalledWith('dateReported', 'desc');
    expect(offsetFn).toHaveBeenCalledWith(0);
    expect(limitFn).toHaveBeenCalledWith(10);
    expect(getPageFn).toHaveBeenCalledTimes(1);
  });

  it('clamps page and limit to at least 1', async () => {
    await listValidatedItems(db as never, bucket as never, { page: 0, limit: 0 });

    expect(offsetFn).toHaveBeenCalledWith(0);
    expect(limitFn).toHaveBeenCalledWith(1);
  });

  it('uses correct offset for page 3 with limit 5', async () => {
    await listValidatedItems(db as never, bucket as never, { page: 3, limit: 5 });

    expect(offsetFn).toHaveBeenCalledWith(10);
    expect(limitFn).toHaveBeenCalledWith(5);
  });
});
