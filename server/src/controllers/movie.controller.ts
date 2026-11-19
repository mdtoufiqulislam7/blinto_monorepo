import { cached, invalidate } from '../redis.js';
import { ApiError, wrap } from '../middleware.js';
import { createMovieBody, parseMovieId, patchMovieBody } from '../models/movie.js';
import * as movies from '../services/movie.service.js';

export const create = wrap(async (req, res) => {
  const body = createMovieBody.parse(req.body);
  const created = await movies.createMovies(Array.isArray(body) ? body : [body]);
  await invalidate('movies');
  res.status(201).json(Array.isArray(body) ? created : created[0]);
});

export const list = wrap(async (_req, res) => {
  res.json(await cached(res, 'movies', 'list', () => movies.listMovies()));
});

export const update = wrap(async (req, res) => {
  const id = parseMovieId(req.params.id);
  const body = patchMovieBody.parse(req.body);
  const updated = await movies.updateMovie(id, body);
  await invalidate('movies');
  res.json(updated);
});

export const rewatchOrder = wrap(async (req, res) => {
  const id = parseMovieId(req.params.id);
  const result = await cached(res, 'movies', `rewatch:${id}`, () => movies.buildRewatchOrder(id));
  if (!result) throw new ApiError(404, 'MOVIE_NOT_FOUND', 'Movie not found');
  res.json(result);
});
