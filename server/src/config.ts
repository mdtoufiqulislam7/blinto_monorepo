const int = (v: string | undefined, d: number): number => (v !== undefined && v !== '' && !Number.isNaN(Number(v)) ? Number(v) : d);

export const config = {
  port: int(process.env.PORT, 4000),
  databaseUrl:
    process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/doomsday',
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
  // Comma separated list of allowed browser origins for CORS.
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  // Number of reverse proxies in front of the API (nginx in docker-compose = 1).
  trustProxy: int(process.env.TRUST_PROXY, 0),
  cacheTtlSeconds: int(process.env.CACHE_TTL_SECONDS, 60),
  rateLimit: {
    windowSeconds: int(process.env.RATE_LIMIT_WINDOW_SECONDS, 60),
    readMax: int(process.env.RATE_LIMIT_READ_MAX, 300),
    writeMax: int(process.env.RATE_LIMIT_WRITE_MAX, 40),
  },
  seed: process.env.SEED === 'true',
};
