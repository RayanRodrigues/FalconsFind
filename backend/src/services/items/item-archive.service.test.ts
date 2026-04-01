import { describe, expect, it, vi } from 'vitest';

vi.mock('./item-query-cache.service.js', () => ({
  invalidatePublicItemsCache: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../reports/report-admin-query-cache.service.js', () => ({
  invalidateAdminReportsCache: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateAdminReportsCache } from '../reports/report-admin-query-cache.service.js';
import { invalidatePublicItemsCache } from './item-query-cache.service.js';
import { invalidateCachesAfterAutoArchive } from './item-archive.service.js';

describe('invalidateCachesAfterAutoArchive', () => {
  it('invalidates caches when expired items are archived', async () => {
    await invalidateCachesAfterAutoArchive({} as never, 1);

    expect(invalidatePublicItemsCache).toHaveBeenCalled();
    expect(invalidateAdminReportsCache).toHaveBeenCalled();
  });

  it('does not invalidate caches when nothing is archived', async () => {
    vi.mocked(invalidatePublicItemsCache).mockClear();
    vi.mocked(invalidateAdminReportsCache).mockClear();

    await invalidateCachesAfterAutoArchive({} as never, 0);

    expect(invalidatePublicItemsCache).not.toHaveBeenCalled();
    expect(invalidateAdminReportsCache).not.toHaveBeenCalled();
  });
});
