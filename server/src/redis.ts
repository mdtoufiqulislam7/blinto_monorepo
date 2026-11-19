import { Redis } from 'ioredis';
import type { Response } from 'express';
import { config } from './config.js';

export const redis = new Redis(config.redisUrl, {
  maxRetriesPerRequest: 1,
  enableOfflineQueue: false, // fail fast when redis is down; callers degrade gracefully
  lazyConnect: false,
});
redis.on('error', (err: Error) => console.error('Redis error:', err.message));

/**
 * Read-through cache. Keys embed a per-resource "version" counter; writes bump the
 * counter (invalidate()) so stale entries are never read and simply expire via TTL.
 * If Redis is unavailable the loader runs directly — the API stays up.
 */
export async function cached<T>(
  res: Response,
  resource: string,
  suffix: string,
  loader: () => Promise<T>,
): Promise<T> {
  let key: string | null = null;
  try {
    const version = (await redis.get(`ver:${resource}`)) ?? '0';
    key = `cache:${resource}:${version}:${suffix}`;
    const hit = await redis.get(key);
    if (hit !== null) {
      res.set('X-Cache', 'HIT');
      return JSON.parse(hit);
    }
  } catch {
    key = null;
  }
  const value = await loader();
  res.set('X-Cache', 'MISS');
  if (key) {
    redis.set(key, JSON.stringify(value), 'EX', config.cacheTtlSeconds).catch(() => {});
  }
  return value;
}

export async function invalidate(resource: string) {
  try {
    await redis.incr(`ver:${resource}`);
  } catch {
    /* cache is best-effort */
  }
}
