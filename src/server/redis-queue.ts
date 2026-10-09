export interface RedisLike {
  lpush(key: string, value: string): Promise<number>;
  brpop(key: string, timeoutSec: number): Promise<[string, string] | null>;
  ping(): Promise<string>;
}

let client: RedisLike | null | undefined;

export async function getRedis(): Promise<RedisLike | null> {
  if (client !== undefined) return client;
  const url = process.env.REDIS_URL;
  if (!url) {
    client = null;
    return null;
  }
  try {
    const Redis = (await import("ioredis")).default;
    const redis = new Redis(url, { maxRetriesPerRequest: 2, lazyConnect: true });
    await redis.connect();
    client = {
      lpush: (key, value) => redis.lpush(key, value),
      brpop: async (key, timeoutSec) => {
        const r = await redis.brpop(key, timeoutSec);
        return r as [string, string] | null;
      },
      ping: () => redis.ping(),
    };
    return client;
  } catch {
    client = null;
    return null;
  }
}

export async function enqueueRedisJob(id: string): Promise<boolean> {
  const redis = await getRedis();
  if (!redis) return false;
  await redis.lpush("atcc:jobs", id);
  return true;
}

export async function redisHealth(): Promise<{ ok: boolean; message: string }> {
  const redis = await getRedis();
  if (!redis) return { ok: false, message: "REDIS_URL not set; using durable SQL job table" };
  try {
    await redis.ping();
    return { ok: true, message: "redis reachable" };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "redis error" };
  }
}
