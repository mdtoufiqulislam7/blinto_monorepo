// Feature 1 logic — written by hand, no graph libraries.
// `prereqMap` is a Map<number, number[]>: movie id -> ids of its direct prerequisites.

/**
 * Would giving `movieId` the prerequisites `newPrereqs` create a cycle?
 * A cycle exists iff some new prerequisite is the movie itself, or
 * (transitively) already depends on the movie.
 */
export type PrereqMap = Map<number, number[]>;

export function wouldCreateCycle(
  movieId: number,
  newPrereqs: number[],
  prereqMap: PrereqMap,
): boolean {
  const visited = new Set<number>();
  const stack: number[] = [];
  for (const p of newPrereqs) {
    if (p === movieId) return true;
    stack.push(p);
  }
  while (stack.length) {
    const current = stack.pop()!;
    if (current === movieId) return true;
    if (visited.has(current)) continue;
    visited.add(current);
    for (const next of prereqMap.get(current) ?? []) stack.push(next);
  }
  return false;
}

/**
 * All transitive prerequisites of `targetId`, each exactly once, ordered so every
 * movie appears after its own prerequisites. The target is not included.
 * Iterative DFS post-order (no recursion => no stack overflow on long chains).
 * Children are visited in ascending id order so the result is deterministic.
 */
export function rewatchOrder(targetId: number, prereqMap: PrereqMap): number[] {
  const order: number[] = [];
  const visited = new Set<number>([targetId]);
  const sortedChildren = (id: number) => [...(prereqMap.get(id) ?? [])].sort((a, b) => a - b);

  type Frame = { id: number; children: number[]; i: number };
  const stack: Frame[] = [{ id: targetId, children: sortedChildren(targetId), i: 0 }];
  while (stack.length) {
    const frame = stack[stack.length - 1]!;
    if (frame.i < frame.children.length) {
      const child = frame.children[frame.i++]!;
      if (!visited.has(child)) {
        visited.add(child);
        stack.push({ id: child, children: sortedChildren(child), i: 0 });
      }
    } else {
      stack.pop();
      if (frame.id !== targetId) order.push(frame.id);
    }
  }
  return order;
}
