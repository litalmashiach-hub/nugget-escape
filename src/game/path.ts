/** A* path finding on a tile grid with 8-way moves (no corner cutting). Returns tile centers. */
export function findPath(
  w: number,
  h: number,
  walkable: (x: number, y: number) => boolean,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  maxNodes = 4000,
): { x: number; y: number }[] | null {
  if (!walkable(tx, ty)) return null;
  if (sx === tx && sy === ty) return [{ x: tx + 0.5, y: ty + 0.5 }];
  const n = w * h;
  const g = new Float32Array(n).fill(Infinity);
  const came = new Int32Array(n).fill(-1);
  const closed = new Uint8Array(n);
  const open: number[] = [];
  const fScore = new Float32Array(n).fill(Infinity);
  const start = sy * w + sx;
  const goal = ty * w + tx;
  const heur = (i: number) => {
    const dx = Math.abs((i % w) - tx), dy = Math.abs(Math.floor(i / w) - ty);
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy);
  };
  g[start] = 0;
  fScore[start] = heur(start);
  open.push(start);
  let expanded = 0;
  while (open.length) {
    // Small grids: a linear scan is fast enough and keeps the code simple.
    let best = 0;
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[best]]) best = i;
    const cur = open[best];
    open[best] = open[open.length - 1];
    open.pop();
    if (cur === goal) break;
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++expanded > maxNodes) return null;
    const cx = cur % w, cy = Math.floor(cur / w);
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        if (!walkable(nx, ny)) continue;
        if (dx && dy && (!walkable(cx + dx, cy) || !walkable(cx, cy + dy))) continue;
        const ni = ny * w + nx;
        if (closed[ni]) continue;
        const ng = g[cur] + (dx && dy ? Math.SQRT2 : 1);
        if (ng < g[ni]) {
          g[ni] = ng;
          came[ni] = cur;
          fScore[ni] = ng + heur(ni);
          open.push(ni);
        }
      }
  }
  if (came[goal] === -1) return null;
  const out: { x: number; y: number }[] = [];
  for (let c = goal; c !== start; c = came[c]) out.push({ x: (c % w) + 0.5, y: Math.floor(c / w) + 0.5 });
  out.reverse();
  return out;
}
