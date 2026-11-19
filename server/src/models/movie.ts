import { z } from 'zod';
import { ApiError } from '../middleware.js';

export interface Movie {
  id: number;
  title: string;
  releaseYear: number;
  runtimeMinutes: number;
  watched: boolean;
  prerequisites: number[];
}

const title = z.string().trim().min(1).max(200);
const releaseYear = z.number().int().min(1888).max(2100);
const runtimeMinutes = z.number().int().min(1).max(300);
// A prerequisite is referenced by id, or by title (handy when creating many movies at once).
const prereqRef = z.union([z.number().int().positive(), z.string().trim().min(1).max(200)]);
const prereqs = z.array(prereqRef).max(50);

const createSchema = z
  .object({
    title,
    releaseYear,
    runtimeMinutes,
    watched: z.boolean().default(false),
    prerequisites: prereqs.default([]),
  })
  .strict();

export const createMovieBody = z.union([createSchema, z.array(createSchema).min(1).max(50)]);
export type CreateMovieInput = z.infer<typeof createSchema>;

export const patchMovieBody = z
  .object({
    title: title.optional(),
    releaseYear: releaseYear.optional(),
    runtimeMinutes: runtimeMinutes.optional(),
    watched: z.boolean().optional(),
    prerequisites: prereqs.optional(),
  })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: 'Provide at least one field to update' });
export type PatchMovieInput = z.infer<typeof patchMovieBody>;

const idParam = z.coerce.number().int().positive().max(2_147_483_647);
export const parseMovieId = (raw: string): number => {
  const r = idParam.safeParse(/^\d+$/.test(raw) ? raw : NaN);
  if (!r.success) throw new ApiError(400, 'VALIDATION_ERROR', 'Invalid movie id');
  return r.data;
};
