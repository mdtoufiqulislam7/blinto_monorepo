import type { Pool, PoolClient } from 'pg';
import { pool, withTransaction } from '../db.js';
import { ApiError } from '../middleware.js';
import { rewatchOrder, wouldCreateCycle } from '../lib/graph.js';
import type { CreateMovieInput, Movie, PatchMovieInput } from '../models/movie.js';

type Db = Pool | PoolClient;

// ---------- queries ----------
const SELECT_MOVIES = `
  SELECT m.id, m.title, m.release_year AS "releaseYear", m.runtime_minutes AS "runtimeMinutes",
         m.watched,
         COALESCE(array_agg(p.prerequisite_id ORDER BY p.prerequisite_id)
                  FILTER (WHERE p.prerequisite_id IS NOT NULL), '{}') AS prerequisites
  FROM movies m
  LEFT JOIN movie_prerequisites p ON p.movie_id = m.id`;

export const listMovies = async (db: Db = pool): Promise<Movie[]> =>
  (await db.query(`${SELECT_MOVIES} GROUP BY m.id ORDER BY m.id`)).rows;

const getMovie = async (db: Db, id: number): Promise<Movie | undefined> =>
  (await db.query(`${SELECT_MOVIES} WHERE m.id = $1 GROUP BY m.id`, [id])).rows[0];

async function loadPrereqMap(db: Db) {
  const { rows } = await db.query('SELECT movie_id, prerequisite_id FROM movie_prerequisites');
  const map = new Map<number, number[]>();
  for (const r of rows) {
    if (!map.has(r.movie_id)) map.set(r.movie_id, []);
    map.get(r.movie_id)!.push(r.prerequisite_id);
  }
  return map;
}

/** Turn ids/titles into a de-duplicated list of existing movie ids. */
async function resolvePrereqs(db: Db, refs: (number | string)[]): Promise<number[]> {
  const ids = new Set<number>();
  for (const ref of refs) {
    const { rows } =
      typeof ref === 'number'
        ? await db.query('SELECT id FROM movies WHERE id = $1', [ref])
        : await db.query('SELECT id FROM movies WHERE lower(title) = lower($1)', [ref]);
    if (!rows.length) {
      throw new ApiError(400, 'UNKNOWN_PREREQUISITE', `Prerequisite not found: ${ref}`);
    }
    ids.add(rows[0].id);
  }
  return [...ids];
}

async function replacePrereqs(db: Db, movieId: number, ids: number[]) {
  await db.query('DELETE FROM movie_prerequisites WHERE movie_id = $1', [movieId]);
  if (ids.length) {
    await db.query(
      `INSERT INTO movie_prerequisites (movie_id, prerequisite_id)
       SELECT $1, UNNEST($2::int[])`,
      [movieId, ids],
    );
  }
}

// Serialise graph mutations so two concurrent requests cannot together form a cycle.
const lockGraph = (db: Db) => db.query('SELECT pg_advisory_xact_lock(724001)');

const circular = () =>
  new ApiError(
    409,
    'CIRCULAR_DEPENDENCY',
    'This change would make a movie depend on itself (directly or through other movies).',
  );

// ---------- business logic ----------
export async function createMovies(items: CreateMovieInput[]): Promise<Movie[]> {
  return withTransaction(async (db) => {
    await lockGraph(db);
    const out: Movie[] = [];
    for (const item of items) {
      const { rows } = await db.query(
        `INSERT INTO movies (title, release_year, runtime_minutes, watched)
         VALUES ($1,$2,$3,$4) RETURNING id`,
        [item.title, item.releaseYear, item.runtimeMinutes, item.watched],
      );
      const id = rows[0].id;
      // A brand-new movie has no dependents yet, so it cannot be part of a cycle.
      await replacePrereqs(db, id, await resolvePrereqs(db, item.prerequisites));
      out.push((await getMovie(db, id))!);
    }
    return out;
  });
}

export async function updateMovie(id: number, body: PatchMovieInput): Promise<Movie> {
  return withTransaction(async (db) => {
    await lockGraph(db);
    const existing = await getMovie(db, id);
    if (!existing) throw new ApiError(404, 'MOVIE_NOT_FOUND', 'Movie not found');

    if (body.prerequisites !== undefined) {
      const ids = await resolvePrereqs(db, body.prerequisites);
      if (wouldCreateCycle(id, ids, await loadPrereqMap(db))) throw circular();
      await replacePrereqs(db, id, ids);
    }

    const merged = { ...existing, ...body };
    await db.query(
      `UPDATE movies SET title=$2, release_year=$3, runtime_minutes=$4, watched=$5 WHERE id=$1`,
      [id, merged.title, merged.releaseYear, merged.runtimeMinutes, merged.watched],
    );
    return (await getMovie(db, id))!;
  });
}

/** Returns null when the movie does not exist. */
export async function buildRewatchOrder(id: number) {
  const movies = await listMovies();
  const byId = new Map(movies.map((m) => [m.id, m]));
  const target = byId.get(id);
  if (!target) return null;

  const prereqMap = new Map(movies.map((m) => [m.id, m.prerequisites]));
  const order = rewatchOrder(id, prereqMap).map((mid) => byId.get(mid)!);
  const unwatched = order.filter((m) => !m.watched);
  return {
    target: { id: target.id, title: target.title },
    order,
    totalCount: order.length,
    watchedCount: order.length - unwatched.length,
    remainingRuntimeMinutes: unwatched.reduce((sum, m) => sum + m.runtimeMinutes, 0),
  };
}
