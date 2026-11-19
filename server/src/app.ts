import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config } from './config.js';
import { pool } from './db.js';
import { redis } from './redis.js';
import { errorHandler, notFound, rateLimit, requireJson } from './middleware.js';
import movies from './routes/movies.js';
import cinemas from './routes/cinemas.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  app.use(helmet());
  app.use(
    cors({
      origin(origin, cb) {
        // Non-browser clients (curl, server-to-server) send no Origin header.
        if (!origin || config.corsOrigins.includes(origin)) return cb(null, true);
        cb(null, false);
      },
      methods: ['GET', 'POST', 'PATCH'],
      allowedHeaders: ['Content-Type'],
      maxAge: 600,
    }),
  );

  app.get('/health', async (_req, res) => {
    const [db, cache] = await Promise.all([
      pool.query('SELECT 1').then(() => 'up', () => 'down'),
      redis.ping().then(() => 'up', () => 'down'),
    ]);
    res.status(db === 'up' ? 200 : 503).json({ status: db === 'up' ? 'ok' : 'degraded', db, redis: cache });
  });

  const api = express.Router();
  api.use(rateLimit({ max: config.rateLimit.readMax, scope: 'all' }));
  // Writes get an additional, much stricter limit.
  api.use((req, res, next) =>
    req.method === 'GET' ? next() : rateLimit({ max: config.rateLimit.writeMax, scope: 'write' })(req, res, next),
  );
  api.use(requireJson);
  api.use(express.json({ limit: '20kb', strict: true }));
  api.use('/movies', movies);
  api.use('/cinemas', cinemas);
  app.use('/api', api);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
