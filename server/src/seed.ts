import { pool, withTransaction } from './db.js';

// Sample data from the assignment brief. Only inserted into an empty database.
const MOVIES: [string, number, number, string[]][] = [
  ['Iron Man', 2008, 126, []],
  ['Captain America: The First Avenger', 2011, 124, []],
  ['The Avengers', 2012, 143, ['Iron Man', 'Captain America: The First Avenger']],
  ['Captain America: Civil War', 2016, 147, ['The Avengers']],
  ['Thor: Ragnarok', 2017, 130, []],
  ['Avengers: Infinity War', 2018, 149, ['Captain America: Civil War', 'Thor: Ragnarok']],
  ['Avengers: Endgame', 2019, 181, ['Avengers: Infinity War']],
  ['Avengers: Doomsday', 2026, 150, ['Avengers: Endgame']],
];
const CINEMAS: [string, number[]][] = [
  ['Star Cineplex', [1, 3, 4]],
  ['Blockbuster Hall', [2, 5]],
  ['Grand Premiere', [6, 9, 20]],
  ['Duo Screens', [4, 6]],
];

export async function seedIfEmpty() {
  const { rows } = await pool.query(
    'SELECT (SELECT count(*) FROM movies) AS m, (SELECT count(*) FROM cinemas) AS c',
  );
  await withTransaction(async (db) => {
    if (Number(rows[0].m) === 0) {
      const ids = new Map<string, number>();
      for (const [title, year, runtime, prereqs] of MOVIES) {
        const r = await db.query(
          'INSERT INTO movies (title, release_year, runtime_minutes) VALUES ($1,$2,$3) RETURNING id',
          [title, year, runtime],
        );
        ids.set(title, r.rows[0].id);
        for (const p of prereqs) {
          await db.query('INSERT INTO movie_prerequisites VALUES ($1,$2)', [r.rows[0].id, ids.get(p)]);
        }
      }
    }
    if (Number(rows[0].c) === 0) {
      for (const [name, sizes] of CINEMAS) {
        await db.query('INSERT INTO cinemas (name, bundle_sizes) VALUES ($1,$2)', [name, sizes]);
      }
    }
  });
  console.log('Seed data checked/applied');
}
