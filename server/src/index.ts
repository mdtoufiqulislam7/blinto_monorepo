import { config } from './config.js';
import { initDb, pool } from './db.js';
import { redis } from './redis.js';
import { createApp } from './app.js';
import { seedIfEmpty } from './seed.js';

await initDb();
if (config.seed) await seedIfEmpty();

const server = createApp().listen(config.port, () =>
  console.log(`API listening on :${config.port}`),
);

const shutdown = () => {
  server.close(async () => {
    await pool.end().catch(() => {});
    redis.disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
