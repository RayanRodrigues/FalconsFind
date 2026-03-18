import { createClient } from 'redis';

export type RedisClient = ReturnType<typeof createClient>;

export const createRedisClient = async (redisUrl: string | undefined): Promise<RedisClient | null> => {
  if (!redisUrl) {
    console.log('[redis] REDIS_URL not set – signed URL caching disabled');
    return null;
  }

  const client = createClient({ url: redisUrl });

  client.on('error', (err: Error) => console.error('[redis] error:', err.message));

  try {
    await client.connect();
    console.log('[redis] connected');
    return client;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[redis] connection failed, caching disabled:', message);
    return null;
  }
};
