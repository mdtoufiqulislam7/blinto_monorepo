import test from 'node:test';
import assert from 'node:assert/strict';
import { rewatchOrder, wouldCreateCycle } from '../src/lib/graph.js';
import { bookingQuote } from '../src/lib/booking.js';

// 1 Iron Man, 2 First Avenger, 3 Avengers, 4 Civil War, 5 Ragnarok, 6 Infinity War, 7 Endgame, 8 Doomsday
const g = new Map<number, number[]>([
  [3, [1, 2]],
  [4, [3]],
  [6, [4, 5]],
  [7, [6]],
  [8, [7]],
]);

const validOrder = (order: number[]) => {
  const pos = new Map(order.map((id, i) => [id, i]));
  assert.equal(pos.size, order.length, 'each movie exactly once');
  for (const id of order) for (const p of g.get(id) ?? []) assert.ok(pos.get(p)! < pos.get(id)!);
};

test('rewatch order for Doomsday has all 7 others, valid order', () => {
  const o = rewatchOrder(8, g);
  assert.equal(o.length, 7);
  assert.ok(!o.includes(8));
  validOrder(o);
});
test('rewatch order Civil War', () => {
  const o = rewatchOrder(4, g);
  assert.deepEqual([...o].sort(), [1, 2, 3]);
  assert.equal(o[2], 3);
});
test('rewatch order Ragnarok is empty', () => assert.deepEqual(rewatchOrder(5, g), []));
test('diamond dependencies appear once', () => {
  const d = new Map<number, number[]>([[4, [2, 3]], [2, [1]], [3, [1]]]);
  assert.deepEqual(rewatchOrder(4, d), [1, 2, 3]);
});

test('cycle detection', () => {
  assert.equal(wouldCreateCycle(1, [7], g), true); // Endgame before Iron Man
  assert.equal(wouldCreateCycle(1, [1], g), true); // self
  assert.equal(wouldCreateCycle(5, [1], g), false);
  assert.equal(wouldCreateCycle(8, [1, 5], g), false);
});

const show = (r: ReturnType<typeof bookingQuote>) => r.bundles.map((b) => `${b.size}x${b.count}`).join(',');
test('booking examples', () => {
  let r = bookingQuote([1, 3, 4], 6);
  assert.equal(r.totalBundles, 2);
  assert.equal(show(r), '3x2');
  r = bookingQuote([2, 5], 11);
  assert.equal(r.totalBundles, 4);
  assert.equal(show(r), '5x1,2x3');
  r = bookingQuote([6, 9, 20], 44);
  assert.equal(r.totalBundles, 4);
  assert.equal(show(r), '20x1,9x2,6x1');
  assert.equal(bookingQuote([4, 6], 7).possible, false);
});
test('booking large group is fast', () => {
  const r = bookingQuote([1, 500, 499, 3, 7, 11, 13, 17, 19, 23], 10_000);
  assert.equal(r.possible, true);
  assert.equal(r.bundles.reduce((s, b) => s + b.size * b.count, 0), 10_000);
});
