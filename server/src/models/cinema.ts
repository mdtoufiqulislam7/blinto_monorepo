import { z } from 'zod';
import { ApiError } from '../middleware.js';

export interface Cinema {
  id: number;
  name: string;
  bundleSizes: number[];
}

const createSchema = z
  .object({
    name: z.string().trim().min(1).max(100),
    bundleSizes: z
      .array(z.number().int().min(1).max(500))
      .min(1)
      .max(10)
      .refine((a) => new Set(a).size === a.length, { message: 'Bundle sizes must be different' }),
  })
  .strict();

export const createCinemaBody = z.union([createSchema, z.array(createSchema).min(1).max(50)]);
export type CreateCinemaInput = z.infer<typeof createSchema>;

export const groupSizeQuery = z
  .string()
  .regex(/^\d{1,5}$/, 'groupSize must be a whole number')
  .transform(Number)
  .pipe(z.number().int().min(1).max(10_000));

export const parseCinemaId = (raw: string): number => {
  if (!/^\d{1,10}$/.test(raw) || Number(raw) > 2_147_483_647) {
    throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid cinema id');
  }
  return Number(raw);
};
