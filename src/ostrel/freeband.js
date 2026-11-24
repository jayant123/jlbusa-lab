// The largest band of screen height not covered by any of the given [top, bottom] intervals.
export function largestGap(intervals, h) {
  const iv = intervals.map(([a, b]) => [Math.max(0, a), Math.min(h, b)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  let best = [0, 0], at = 0;
  for (const [a, b] of iv) { if (a - at > best[1] - best[0]) best = [at, a]; at = Math.max(at, b); }
  if (h - at > best[1] - best[0]) best = [at, h];
  return best;
}
