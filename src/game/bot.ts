import { findPath } from './path';
import { currentObjective, findDoor, type GameState, type Input } from './state';
import { KEY_ORDER, type KeyColor } from './types';
import { bossBotInput } from './boss';
import { buildMaps } from './map';
import type { FloorDef } from './types';

/**
 * Autopilot that walks the nugget to the next objective. Used by the automated tests
 * (and handy for demos): it produces the same input a player would.
 */
export function botInput(state: GameState): Input {
  if (state.status === 'boss') return bossBotInput(state);
  const obj = currentObjective(state);
  const p = state.player;
  if (!obj || obj.action === 'boss' || state.status !== 'playing') return { mx: 0, my: 0, dash: false };

  let goalFloor: number, gx: number, gy: number;
  if (obj.action === 'find') {
    const k = state.keys.find((k) => k.color === obj.color)!;
    goalFloor = k.floor; gx = Math.floor(k.x); gy = Math.floor(k.y);
  } else {
    const d = findDoor(state, obj.color)!;
    goalFloor = d.floor; gx = d.door.x; gy = d.door.y;
  }

  const map = state.maps[p.floor];
  if (goalFloor !== p.floor) {
    const want = goalFloor > p.floor ? 'up' : 'down';
    let best: { x: number; y: number } | null = null;
    let bestD = Infinity;
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++)
        if (map.isStairs(x, y) === want) {
          const d = Math.hypot(x + 0.5 - p.pos.x, y + 0.5 - p.pos.y);
          if (d < bestD) { bestD = d; best = { x, y }; }
        }
    if (!best) return { mx: 0, my: 0, dash: false };
    gx = best.x; gy = best.y;
  }

  const walk = (x: number, y: number) =>
    (x === gx && y === gy) || (map.walkableForPlayer(x, y, state.unlocked) && !map.isStairs(x, y));
  const path = findPath(map.w, map.h, walk, Math.floor(p.pos.x), Math.floor(p.pos.y), gx, gy);
  if (!path) return { mx: 0, my: 0, dash: false };

  // Aim for the first node that is still meaningfully ahead.
  let node = path[0];
  if (path.length > 1 && Math.hypot(node.x - p.pos.x, node.y - p.pos.y) < 0.15) node = path[1];
  // When opening the front door, keep walking south through it.
  let tx = node.x, ty = node.y;
  if (obj.action === 'escape' && path.length <= 1) ty += 1;
  if (obj.action === 'open' && path.length <= 1 && goalFloor === p.floor && !state.unlocked.has(obj.color)) {
    tx = gx + 0.5; ty = gy + 0.5;
  }
  const dx = tx - p.pos.x, dy = ty - p.pos.y;
  const len = Math.hypot(dx, dy) || 1;
  return { mx: dx / len, my: dy / len, dash: false };
}

/**
 * Checks that the house can be escaped: starting with no keys, repeatedly explore
 * everything reachable (including stairs), pick up keys, open matching doors.
 * Returns the order keys were collected and whether the front door was reached.
 */
export function solveHouse(floors: FloorDef[], start: { floor: number; x: number; y: number }) {
  const maps = buildMaps(floors);
  const unlocked = new Set<KeyColor>();
  const held = new Set<KeyColor>();
  const order: KeyColor[] = [];
  for (let round = 0; round < 32; round++) {
    // Flood fill over all floors.
    const seen = maps.map((m) => new Uint8Array(m.w * m.h));
    const stack: [number, number, number][] = [[start.floor, Math.floor(start.x), Math.floor(start.y)]];
    const reachableDoors = new Set<KeyColor>();
    while (stack.length) {
      const [fl, x, y] = stack.pop()!;
      const m = maps[fl];
      if (!m.inBounds(x, y) || seen[fl][y * m.w + x]) continue;
      const d = m.door(x, y);
      if (d && !unlocked.has(d.color)) { reachableDoors.add(d.color); continue; }
      if (!m.walkableForPlayer(x, y, unlocked)) continue;
      seen[fl][y * m.w + x] = 1;
      const st = m.isStairs(x, y);
      if (st) {
        const to = fl + (st === 'up' ? 1 : -1);
        const arrive = st === 'up' ? maps[to]?.def.arriveFromBelow : maps[to]?.def.arriveFromAbove;
        if (arrive) stack.push([to, arrive[0], arrive[1]]);
      }
      stack.push([fl, x + 1, y], [fl, x - 1, y], [fl, x, y + 1], [fl, x, y - 1]);
    }
    let progress = false;
    for (const m of maps)
      for (const k of m.def.keys)
        if (!held.has(k.color) && seen[m.def.id][k.y * m.w + k.x]) {
          held.add(k.color);
          order.push(k.color);
          progress = true;
        }
    for (const c of reachableDoors)
      if (held.has(c) && !unlocked.has(c)) { unlocked.add(c); progress = true; }
    if (unlocked.has('gold')) return { escaped: true, order, unlocked: [...unlocked] };
    if (!progress) break;
  }
  return { escaped: false, order, unlocked: [...unlocked] };
}

export { KEY_ORDER };
