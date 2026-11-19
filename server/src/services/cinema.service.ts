import { pool, withTransaction } from '../db.js';
import { bookingQuote } from '../lib/booking.js';
import type { Cinema, CreateCinemaInput } from '../models/cinema.js';

const SELECT = `SELECT id, name, bundle_sizes AS "bundleSizes" FROM cinemas`;
const sorted = <T extends { bundleSizes: number[] }>(row: T): T => ({
  ...row,
  bundleSizes: [...row.bundleSizes].sort((a, b) => a - b),
});

export async function createCinemas(items: CreateCinemaInput[]): Promise<Cinema[]> {
  return withTransaction(async (db) => {
    const out: Cinema[] = [];
    for (const c of items) {
      const sizes = [...c.bundleSizes].sort((a, b) => a - b);
      const { rows } = await db.query(
        `INSERT INTO cinemas (name, bundle_sizes) VALUES ($1,$2)
         RETURNING id, name, bundle_sizes AS "bundleSizes"`,
        [c.name, sizes],
      );
      out.push(rows[0]);
    }
    return out;
  });
}

export async function listCinemas(): Promise<Cinema[]> {
  return (await pool.query(`${SELECT} ORDER BY id`)).rows.map(sorted);
}

/** Returns null when the cinema does not exist. */
export async function getBooking(id: number, groupSize: number) {
  const { rows } = await pool.query(`${SELECT} WHERE id = $1`, [id]);
  if (!rows.length) return null;
  const cinema = sorted<Cinema>(rows[0]);
  const quote = bookingQuote(cinema.bundleSizes, groupSize);
  return {
    cinemaId: cinema.id,
    cinemaName: cinema.name,
    bundleSizes: cinema.bundleSizes,
    groupSize,
    ...quote,
    message: quote.possible
      ? `${quote.totalBundles} bundle(s) cover exactly ${groupSize} seats.`
      : `Not possible: no combination of bundles adds up to exactly ${groupSize} seats.`,
  };
}
