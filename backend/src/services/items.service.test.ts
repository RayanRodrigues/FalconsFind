import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listValidatedItems } from './items.service.js';

// Minimal shapes we need for the function
type FakeDoc = { id: string; data: () => any };
type FakeSnap = { size: number; docs: FakeDoc[] };

describe('listValidatedItems', () => {
  let db: any;

  // We’ll capture calls to ensure query methods were used correctly
  let collectionFn: any;
  let where1Fn: any;
  let where2Fn: any;
  let getTotalFn: any;

  let orderByFn: any;
  let offsetFn: any;
  let limitFn: any;
  let getPageFn: any;

  beforeEach(() => {
    // ---- Fake snapshots returned by Firestore ----
    const totalSnap: FakeSnap = {
      size: 2,
      docs: [
        { id: 'a', data: () => ({ kind: 'FOUND', status: 'VALIDATED', title: 'A' }) },
        { id: 'b', data: () => ({ kind: 'FOUND', status: 'VALIDATED', title: 'B' }) },
      ],
    };

    const pageSnap: FakeSnap = {
      size: 1,
      docs: [
        {
          id: 'b',
          data: () => ({
            kind: 'FOUND',
            status: 'VALIDATED',
            title: 'B',
            dateReported: { _seconds: 1, _nanoseconds: 0 },
          }),
        },
      ],
    };

    // ---- Build the chainable query mocks ----
    getPageFn = vi.fn().mockResolvedValue(pageSnap);

    const queryAfterLimit = {
      get: getPageFn,
    };

    limitFn = vi.fn().mockReturnValue(queryAfterLimit);

    const queryAfterOffset = {
      limit: limitFn,
    };

    offsetFn = vi.fn().mockReturnValue(queryAfterOffset);

    const queryAfterOrderBy = {
      offset: offsetFn,
    };

    orderByFn = vi.fn().mockReturnValue(queryAfterOrderBy);

    getTotalFn = vi.fn().mockResolvedValue(totalSnap);

    const baseQuery = {
      get: getTotalFn,
      orderBy: orderByFn,
    };

    where2Fn = vi.fn().mockReturnValue(baseQuery);

    const queryAfterWhere1 = {
      where: where2Fn,
    };

    where1Fn = vi.fn().mockReturnValue(queryAfterWhere1);

    const collectionObj = {
      where: where1Fn,
    };

    collectionFn = vi.fn().mockReturnValue(collectionObj);

    db = {
      collection: collectionFn,
    };
  });

  it('filters FOUND + VALIDATED, returns total + paged items', async () => {
    const result = await listValidatedItems(db, { page: 1, limit: 10 });

    // Returned shape
    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe('b');
    expect(result.items[0].title).toBe('B');

    // Query chain verification
    expect(collectionFn).toHaveBeenCalledWith('reports');

    expect(where1Fn).toHaveBeenCalledWith('kind', '==', 'FOUND');
    expect(where2Fn).toHaveBeenCalledWith('status', '==', 'VALIDATED');

    expect(getTotalFn).toHaveBeenCalledTimes(1);

    expect(orderByFn).toHaveBeenCalledWith('dateReported', 'desc');
    expect(offsetFn).toHaveBeenCalledWith(0); // page 1 => offset 0
    expect(limitFn).toHaveBeenCalledWith(10);
    expect(getPageFn).toHaveBeenCalledTimes(1);
  });

  it('clamps page and limit to at least 1', async () => {
    // page 0 + limit 0 should clamp to page=1, limit=1
    await listValidatedItems(db, { page: 0, limit: 0 });

    // offset should be 0 and limit should be 1
    expect(offsetFn).toHaveBeenCalledWith(0);
    expect(limitFn).toHaveBeenCalledWith(1);
  });

  it('uses correct offset for page 3 with limit 5', async () => {
    await listValidatedItems(db, { page: 3, limit: 5 });

    // offset = (3-1)*5 = 10
    expect(offsetFn).toHaveBeenCalledWith(10);
    expect(limitFn).toHaveBeenCalledWith(5);
  });
});