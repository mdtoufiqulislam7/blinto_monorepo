// Feature 2 logic — fewest bundles summing exactly to groupSize (bounded-by-nothing
// "coin change" DP). O(groupSize * bundleSizes) — at most 10,000 * 10 steps.

export interface BundleCount {
  size: number;
  count: number;
}
export interface Quote {
  possible: boolean;
  totalBundles: number | null;
  bundles: BundleCount[];
}

export function bookingQuote(bundleSizes: number[], groupSize: number): Quote {
  // Largest first, so on equal bundle counts we prefer bigger bundles (deterministic).
  const sizes = [...new Set(bundleSizes)].sort((a, b) => b - a);
  const INF = Infinity;
  const best = new Array(groupSize + 1).fill(INF); // best[s] = min bundles for s seats
  const pick = new Array(groupSize + 1).fill(0); // last bundle size used for s
  best[0] = 0;

  for (let s = 1; s <= groupSize; s++) {
    for (const size of sizes) {
      if (size > s) continue;
      const candidate = best[s - size] + 1;
      if (candidate < best[s]) {
        best[s] = candidate;
        pick[s] = size;
      }
    }
  }

  if (best[groupSize] === INF) {
    return { possible: false, totalBundles: null, bundles: [] };
  }

  const counts = new Map<number, number>();
  for (let s = groupSize; s > 0; s -= pick[s]!) {
    counts.set(pick[s]!, (counts.get(pick[s]!) ?? 0) + 1);
  }
  const bundles = [...counts.entries()]
    .map(([size, count]) => ({ size, count }))
    .sort((a, b) => b.size - a.size);

  return { possible: true, totalBundles: best[groupSize], bundles };
}
