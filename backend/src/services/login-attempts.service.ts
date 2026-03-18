import type { RedisClient } from '../bootstrap/redis.js';

type LoginAttemptState = {
  failures: number;
  lockedUntil?: number;
};

const ATTEMPT_WINDOW_SECONDS = 15 * 60;
const LOCKOUT_SECONDS = 30 * 60;
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

const inMemoryAttempts = new Map<string, LoginAttemptState>();

const normalizeAttemptKey = (email: string, ipAddress: string): string => (
  `auth_login:v1:${email.trim().toLowerCase()}:${ipAddress.trim() || 'unknown'}`
);

const safeJsonParse = (raw: string | null): LoginAttemptState | null => {
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<LoginAttemptState>;
    const failures = typeof parsed.failures === 'number' && Number.isInteger(parsed.failures)
      ? parsed.failures
      : 0;
    return {
      failures,
      lockedUntil: typeof parsed.lockedUntil === 'number' ? parsed.lockedUntil : undefined,
    };
  } catch {
    return null;
  }
};

export const createLoginAttemptsService = (redis: RedisClient | null) => {
  const getState = async (email: string, ipAddress: string): Promise<LoginAttemptState> => {
    const key = normalizeAttemptKey(email, ipAddress);

    if (redis) {
      try {
        return safeJsonParse(await redis.get(key)) ?? { failures: 0 };
      } catch {
        // Fall through to in-memory fallback.
      }
    }

    return inMemoryAttempts.get(key) ?? { failures: 0 };
  };

  const saveState = async (
    email: string,
    ipAddress: string,
    state: LoginAttemptState,
    ttlSeconds: number,
  ): Promise<void> => {
    const key = normalizeAttemptKey(email, ipAddress);

    if (redis) {
      try {
        await redis.set(key, JSON.stringify(state), { EX: ttlSeconds });
        return;
      } catch {
        // Fall through to in-memory fallback.
      }
    }

    inMemoryAttempts.set(key, state);
    setTimeout(() => {
      if (inMemoryAttempts.get(key) === state) {
        inMemoryAttempts.delete(key);
      }
    }, ttlSeconds * 1000).unref?.();
  };

  const clear = async (email: string, ipAddress: string): Promise<void> => {
    const key = normalizeAttemptKey(email, ipAddress);

    if (redis) {
      try {
        await redis.del(key);
      } catch {
        // Ignore and continue with in-memory cleanup.
      }
    }

    inMemoryAttempts.delete(key);
  };

  const getLockState = async (email: string, ipAddress: string): Promise<{ locked: boolean; retryAfterSeconds?: number }> => {
    const state = await getState(email, ipAddress);
    const now = Date.now();

    if (state.lockedUntil && state.lockedUntil > now) {
      return {
        locked: true,
        retryAfterSeconds: Math.max(1, Math.ceil((state.lockedUntil - now) / 1000)),
      };
    }

    if (state.lockedUntil && state.lockedUntil <= now) {
      await clear(email, ipAddress);
    }

    return { locked: false };
  };

  const recordFailure = async (email: string, ipAddress: string): Promise<{ locked: boolean; retryAfterSeconds?: number }> => {
    const state = await getState(email, ipAddress);
    const nextFailures = state.failures + 1;

    if (nextFailures >= MAX_FAILED_LOGIN_ATTEMPTS) {
      const lockedUntil = Date.now() + (LOCKOUT_SECONDS * 1000);
      await saveState(email, ipAddress, { failures: nextFailures, lockedUntil }, LOCKOUT_SECONDS);
      return {
        locked: true,
        retryAfterSeconds: LOCKOUT_SECONDS,
      };
    }

    await saveState(email, ipAddress, { failures: nextFailures }, ATTEMPT_WINDOW_SECONDS);
    return { locked: false };
  };

  return {
    clear,
    getLockState,
    recordFailure,
  };
};
