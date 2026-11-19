import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { ZodError } from 'zod';
import { config } from './config.js';
import { redis } from './redis.js';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Fixed-window rate limiter backed by Redis (shared across API instances). Fails open. */
export function rateLimit({ max, scope }: { max: number; scope: string }): RequestHandler {
  const { windowSeconds } = config.rateLimit;
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const key = `rl:${scope}:${req.ip}`;
      const count = await redis.incr(key);
      if (count === 1) await redis.expire(key, windowSeconds);
      const ttl = await redis.ttl(key);
      if (ttl < 0) await redis.expire(key, windowSeconds); // never leave a key without expiry
      res.set('RateLimit-Limit', String(max));
      res.set('RateLimit-Remaining', String(Math.max(0, max - count)));
      if (count > max) {
        res.set('Retry-After', String(Math.max(ttl, 1)));
        return next(new ApiError(429, 'RATE_LIMITED', 'Too many requests, slow down.'));
      }
    } catch {
      /* redis down -> do not block traffic */
    }
    next();
  };
}

/** POST/PATCH must be JSON. Blocks form-encoded / text/plain "simple" cross-site posts (CSRF). */
export function requireJson(req: Request, _res: Response, next: NextFunction) {
  if (['POST', 'PATCH', 'PUT'].includes(req.method)) {
    if (!req.is('application/json')) {
      return next(
        new ApiError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Content-Type must be application/json'),
      );
    }
  }
  next();
}

export function notFound(_req: Request, _res: Response, next: NextFunction) {
  next(new ApiError(404, 'NOT_FOUND', 'Route not found'));
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid request',
        details: err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
    });
  }
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details ? { details: err.details } : {}) },
    });
  }
  if (err.type === 'entity.too.large') {
    return res
      .status(413)
      .json({ error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } });
  }
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return res
      .status(400)
      .json({ error: { code: 'INVALID_JSON', message: 'Malformed JSON body' } });
  }
  if (err.code === '23505') {
    return res
      .status(409)
      .json({ error: { code: 'DUPLICATE', message: 'A record with that name already exists' } });
  }
  console.error(err); // never leak internals to the client
  res.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' } });
}

export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    fn(req, res, next).catch(next);
  };
