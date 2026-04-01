import { describe, expect, it, vi } from 'vitest';
import {
  buildUserClaimsCacheKey,
  invalidateAdminClaimsCache,
  invalidateUserClaimsCache,
} from './claim-query-cache.service.js';

describe('claim query cache', () => {
  it('builds a stable per-user cache key', () => {
    expect(buildUserClaimsCacheKey(' user-1 ')).toBe('claims_user:list:v1:user-1');
  });

  it('invalidates admin claims list cache by prefix', async () => {
    const redis = {
      keys: vi.fn().mockResolvedValue(['claims_admin:list:v1:all']),
      del: vi.fn().mockResolvedValue(1),
    };

    await invalidateAdminClaimsCache(redis as never);

    expect(redis.keys).toHaveBeenCalledWith('claims_admin:list:v1:*');
    expect(redis.del).toHaveBeenCalledWith(['claims_admin:list:v1:all']);
  });

  it('invalidates only one user cache key when uid is provided', async () => {
    const redis = {
      keys: vi.fn(),
      del: vi.fn().mockResolvedValue(1),
    };

    await invalidateUserClaimsCache(redis as never, 'user-1');

    expect(redis.keys).not.toHaveBeenCalled();
    expect(redis.del).toHaveBeenCalledWith('claims_user:list:v1:user-1');
  });
});
