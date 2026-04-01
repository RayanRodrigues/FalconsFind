import { describe, expect, it, vi } from 'vitest';
import {
  buildAdminReportsCacheKey,
  invalidateAdminReportsCache,
} from './report-admin-query-cache.service.js';

describe('report admin query cache', () => {
  it('builds different keys when filters change', () => {
    const base = buildAdminReportsCacheKey({ page: 1, limit: 20, search: 'wallet' });
    const flagged = buildAdminReportsCacheKey({ page: 1, limit: 20, search: 'wallet', flagged: true });

    expect(base).not.toBe(flagged);
  });

  it('invalidates cached admin report lists by prefix', async () => {
    const redis = {
      keys: vi.fn().mockResolvedValue([
        'reports_admin:list:v1:{"page":1}',
        'reports_admin:list:v1:{"page":2}',
      ]),
      del: vi.fn().mockResolvedValue(2),
    };

    await invalidateAdminReportsCache(redis as never);

    expect(redis.keys).toHaveBeenCalledWith('reports_admin:list:v1:*');
    expect(redis.del).toHaveBeenCalledWith([
      'reports_admin:list:v1:{"page":1}',
      'reports_admin:list:v1:{"page":2}',
    ]);
  });
});
