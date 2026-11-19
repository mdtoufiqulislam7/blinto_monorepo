import pg from 'pg';
import type { PoolClient } from 'pg';
import { config } from './config.js';

export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
  statement_timeout: 5_000,
});

pool.on('error', (err) => console.error('Unexpected pg pool error', err.message));

const SCHEMA = `
CREATE TABLE IF NOT EXISTS movies (
  id              SERIAL PRIMARY KEY,
  title           VARCHAR(200) NOT NULL,
  release_year    INTEGER NOT NULL CHECK (release_year BETWEEN 1888 AND 2100),
  runtime_minutes INTEGER NOT NULL CHECK (runtime_minutes BETWEEN 1 AND 300),
  watched         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS movies_title_unique ON movies (lower(title));

CREATE TABLE IF NOT EXISTS movie_prerequisites (
  movie_id        INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  prerequisite_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  PRIMARY KEY (movie_id, prerequisite_id),
  CHECK (movie_id <> prerequisite_id)
);
CREATE INDEX IF NOT EXISTS movie_prereq_by_prereq ON movie_prerequisites (prerequisite_id);

CREATE TABLE IF NOT EXISTS cinemas (
  id           SERIAL PRIMARY KEY,
  name         VARCHAR(100) NOT NULL,
  bundle_sizes INTEGER[] NOT NULL CHECK (cardinality(bundle_sizes) BETWEEN 1 AND 10),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS cinemas_name_unique ON cinemas (lower(name));
`;

export async function initDb({ retries = 30, delayMs = 2000 } = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      await pool.query(SCHEMA);
      return;
    } catch (err) {
      if (attempt >= retries) throw err;
      console.log(`Database not ready (${(err as Error).message}), retry ${attempt}/${retries}...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

/** Run `fn(client)` inside a transaction. */
export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}
