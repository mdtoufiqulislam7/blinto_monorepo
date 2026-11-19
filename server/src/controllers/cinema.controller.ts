import { cached, invalidate } from '../redis.js';
import { ApiError, wrap } from '../middleware.js';
import { createCinemaBody, groupSizeQuery, parseCinemaId } from '../models/cinema.js';
import * as cinemas from '../services/cinema.service.js';

export const create = wrap(async (req, res) => {
  const body = createCinemaBody.parse(req.body);
  const created = await cinemas.createCinemas(Array.isArray(body) ? body : [body]);
  await invalidate('cinemas');
  res.status(201).json(Array.isArray(body) ? created : created[0]);
});

export const list = wrap(async (_req, res) => {
  res.json(await cached(res, 'cinemas', 'list', () => cinemas.listCinemas()));
});

export const booking = wrap(async (req, res) => {
  const id = parseCinemaId(req.params.id);
  const groupSize = groupSizeQuery.parse(req.query.groupSize);
  const result = await cached(res, 'cinemas', `booking:${id}:${groupSize}`, () =>
    cinemas.getBooking(id, groupSize),
  );
  if (!result) throw new ApiError(404, 'CINEMA_NOT_FOUND', 'Cinema not found');
  res.json(result);
});
