# Server (REST API)

Node 22 · TypeScript · Express · PostgreSQL (raw SQL via `pg`) · Redis · Zod

## Folder structure

```
server/
├── Dockerfile
├── package.json
├── .env.example
├── test/                        unit tests (graph + booking logic)
└── src/
    ├── index.ts                 entry: init DB, seed, start HTTP server, graceful shutdown
    ├── app.ts                   builds the Express app (security middleware, /health, /api)
    ├── config.ts                reads environment variables
    ├── db.ts                    pg pool, table schema (CREATE TABLE IF NOT EXISTS), withTransaction()
    ├── redis.ts                 Redis client, cached() and invalidate()
    ├── middleware.ts            ApiError, rateLimit, requireJson, notFound, errorHandler, wrap
    ├── seed.ts                  sample movies + cinemas for an empty database
    ├── routes/                  URL -> controller wiring only
    │   ├── movies.ts
    │   └── cinemas.ts
    ├── controllers/             parse request, call service, cache + response
    │   ├── movie.controller.ts
    │   └── cinema.controller.ts
    ├── services/                raw SQL queries, transactions, business logic
    │   ├── movie.service.ts
    │   └── cinema.service.ts
    ├── models/                  TypeScript types + Zod validation schemas
    │   ├── movie.ts
    │   └── cinema.ts
    └── lib/                     pure algorithms (no I/O)
        ├── graph.ts             cycle detection + rewatch order
        └── booking.ts           bundle combination (booking quote)
```

Request flow: `route -> controller -> (model validates) -> service -> PostgreSQL`, and on reads `controller -> Redis cache -> service`.

## API

Base path: `/api`. All bodies are JSON.

| Method | Path | Description |
|---|---|---|
| GET | `/health` | DB + Redis status (`200 ok`, `503 degraded`) |
| POST | `/api/movies` | Create one movie or an array (max 50). Prerequisites by id or title |
| GET | `/api/movies` | List movies with prerequisite ids |
| PATCH | `/api/movies/:id` | Update fields / prerequisites. `409 CIRCULAR_DEPENDENCY` on a cycle |
| GET | `/api/movies/:id/rewatch-order` | Ordered watch list, counts, remaining runtime |
| POST | `/api/cinemas` | Create one cinema or an array (max 50) with `bundleSizes` |
| GET | `/api/cinemas` | List cinemas |
| GET | `/api/cinemas/:id/booking?groupSize=N` | Fewest bundles that cover exactly N seats |

Errors share one shape:

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Invalid request", "details": [] } }
```

Codes: `VALIDATION_ERROR` 400, `INVALID_JSON` 400, `UNKNOWN_PREREQUISITE` 400, `MOVIE_NOT_FOUND` / `CINEMA_NOT_FOUND` / `NOT_FOUND` 404, `CIRCULAR_DEPENDENCY` / `DUPLICATE` 409, `PAYLOAD_TOO_LARGE` 413, `UNSUPPORTED_MEDIA_TYPE` 415, `RATE_LIMITED` 429, `INTERNAL_ERROR` 500.

## Security

- **helmet** sets secure HTTP headers; `x-powered-by` is disabled.
- **CORS allowlist**: only origins in `CORS_ORIGINS` are allowed; methods limited to GET, POST, PATCH; only the `Content-Type` header is accepted.
- **JSON only**: POST/PATCH without `Content-Type: application/json` get `415`. This blocks form-encoded and `text/plain` cross-site posts (CSRF).
- **Body limit** of 20 KB and strict JSON parsing.
- **Input validation** with Zod on every body, query and id. Schemas are `.strict()`, so unknown fields are rejected. Lengths, ranges and array sizes are capped.
- **SQL injection safe**: every query is parameterised (`$1, $2, ...`). No user input is concatenated into SQL.
- **Rate limiting** per IP (see Redis below), with a stricter limit for writes.
- **Safe errors**: unexpected errors are logged on the server and the client only sees `INTERNAL_ERROR`. No stack traces or SQL leak out.
- **Database protection**: 5 s statement timeout, pool capped at 10 connections, `CHECK` constraints on years, runtimes and self-references.
- **Concurrency safety**: movie graph writes run in one transaction under a Postgres advisory lock, so two requests cannot together create a cycle.
- **Container**: multi-stage build, production dependencies only, runs as the non-root `node` user, has a healthcheck.
- `TRUST_PROXY` must match the number of proxies in front of the API, otherwise rate limiting sees the wrong client IP.

## Redis

Redis is used for two things. If Redis is down, the API keeps working (it fails open).

**1. Read-through cache** (`src/redis.ts`)

- Cached GET endpoints: movie list, rewatch order, cinema list, booking quote.
- Key format: `cache:<resource>:<version>:<suffix>`, for example `cache:movies:3:list`.
- A version counter `ver:<resource>` is part of the key. Every successful POST/PATCH calls `invalidate()`, which increments the counter. Old keys are never read again and expire after `CACHE_TTL_SECONDS` (default 60).
- The response header `X-Cache: HIT` or `MISS` shows what happened.

**2. Rate limiting** (`src/middleware.ts`)

- Fixed window per IP: `rl:<scope>:<ip>`, window `RATE_LIMIT_WINDOW_SECONDS` (default 60).
- Reads: `RATE_LIMIT_READ_MAX` (default 300). Writes: extra limit `RATE_LIMIT_WRITE_MAX` (default 40).
- Over the limit returns `429` with `Retry-After`. Headers `RateLimit-Limit` and `RateLimit-Remaining` are sent.
- Counters live in Redis, so the limit is shared across several API instances.

Inspect keys: `docker compose exec redis redis-cli keys "*"`

## Raw SQL (no ORM)

All SQL is written by hand and lives in `services/` (table creation is in `db.ts`).

Tables (`db.ts`):

| Table | Columns |
|---|---|
| `movies` | `id`, `title` (unique, case-insensitive), `release_year`, `runtime_minutes`, `watched`, `created_at` |
| `movie_prerequisites` | `movie_id`, `prerequisite_id` (both FK to `movies`, `ON DELETE CASCADE`, no self-reference) |
| `cinemas` | `id`, `name` (unique, case-insensitive), `bundle_sizes INTEGER[]`, `created_at` |

Example: list movies with their prerequisites in one query (`movie.service.ts`):

```sql
SELECT m.id, m.title, m.release_year AS "releaseYear", m.runtime_minutes AS "runtimeMinutes",
       m.watched,
       COALESCE(array_agg(p.prerequisite_id ORDER BY p.prerequisite_id)
                FILTER (WHERE p.prerequisite_id IS NOT NULL), '{}') AS prerequisites
FROM movies m
LEFT JOIN movie_prerequisites p ON p.movie_id = m.id
GROUP BY m.id
ORDER BY m.id;
```

Transactions use `withTransaction(fn)` from `db.ts` (BEGIN / COMMIT / ROLLBACK, client always released).

Look at the data:

```
docker compose exec postgres psql -U postgres -d doomsday
\dt
SELECT * FROM movies;
```

## Run

```
cp .env.example .env
npm install
npm run dev        # tsx watch
npm run typecheck
npm test
npm run build && npm start
```

Or run everything with Docker from the repo root: `docker compose up --build`.

See [.env.example](.env.example) for all environment variables.
