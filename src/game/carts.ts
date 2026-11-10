/**
 * Level 2 hazard: when the nugget gets close to a key, a shopper with a cart spots it,
 * shouts and charges straight at it. Step out of the way! Being run over costs a life.
 * Pure game logic, no rendering.
 */
import type { GameState } from './state';
import type { KeyColor, Vec } from './types';

export interface Cart {
  /** The shopper's position (the cart is just in front of them). */
  pos: Vec;
  /** Direction of travel (unit vector), locked in when the charge starts. */
  dir: Vec;
  facing: number;
  mode: 'windup' | 'charge' | 'stop';
  timer: number;
  key: KeyColor;
  walkPhase: number;
}

/** How close to a key the nugget has to be before a shopper charges. */
export const CART_TRIGGER = 3.6;
/** Seconds the shopper shouts before charging: time to get ready to dodge. */
export const CART_WINDUP = 0.8;
export const CART_SPEED = { easy: 5.2, normal: 6.4, hard: 7.4 } as const;
/** How long a charge lasts at most, and how long a stopped cart stays around. */
export const CART_CHARGE_TIME = 3;
const CART_STOP_TIME = 1.1;
/** Distance between the nugget and the front of the cart that counts as a hit. */
export const CART_HIT = 0.6;
/** The cart sticks out this far in front of the shopper. */
export const CART_REACH = 0.75;
const RE_ARM = 6;

/** Can a cart roll over this tile? Not through walls, closed doors or furniture. Spills are fine. */
function rollable(state: GameState, floor: number, x: number, y: number) {
  const m = state.maps[floor];
  return m.walkableForPlayer(x, y, state.unlocked) && !m.isHide(x, y) && !m.isStairs(x, y);
}

/** Is the straight line from a to b clear for a cart (about a cart's width)? */
export function clearLane(state: GameState, floor: number, a: Vec, b: Vec) {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  const nx = (b.x - a.x) / d, ny = (b.y - a.y) / d;
  for (let t = 0; t <= d; t += 0.2)
    for (const side of [-0.3, 0, 0.3]) {
      const x = a.x + nx * t - ny * side, y = a.y + ny * t + nx * side;
      if (!rollable(state, floor, Math.floor(x), Math.floor(y))) return false;
    }
  return true;
}

/** Where a shopper can appear: far enough to see coming, with a clear run at the nugget. */
export function cartSpawn(state: GameState): Vec | null {
  const p = state.player;
  const start = state.rand() * Math.PI * 2;
  for (const dist of [8, 7, 6, 5]) {
    for (let i = 0; i < 16; i++) {
      const a = start + (i * Math.PI * 2) / 16;
      const s = { x: p.pos.x + Math.cos(a) * dist, y: p.pos.y + Math.sin(a) * dist };
      if (!rollable(state, p.floor, Math.floor(s.x), Math.floor(s.y))) continue;
      if (clearLane(state, p.floor, s, p.pos)) return s;
    }
  }
  return null;
}

export function updateCarts(state: GameState, dt: number) {
  const p = state.player;

  // A shopper charges when the nugget gets close to a key (once per visit).
  for (const k of state.keys) {
    if (k.taken || k.floor !== p.floor) continue;
    const d = Math.hypot(k.x - p.pos.x, k.y - p.pos.y);
    const busy = state.carts.some((c) => c.key === k.color);
    if (k.rush === 'used') {
      if (!busy && d > RE_ARM) k.rush = 'armed';
      continue;
    }
    if (d > CART_TRIGGER || p.hidden || busy) continue;
    const s = cartSpawn(state);
    if (!s) continue;
    k.rush = 'used';
    const a = Math.atan2(p.pos.y - s.y, p.pos.x - s.x);
    state.carts.push({ pos: s, dir: { x: Math.cos(a), y: Math.sin(a) }, facing: a, mode: 'windup', timer: CART_WINDUP, key: k.color, walkPhase: 0 });
    state.events.push({ type: 'rush', x: s.x, y: s.y });
  }

  const speed = CART_SPEED[state.difficulty];
  for (const c of state.carts) {
    c.timer -= dt;
    if (c.mode === 'windup') {
      // keep turning toward the nugget, then lock the direction and go
      const a = Math.atan2(p.pos.y - c.pos.y, p.pos.x - c.pos.x);
      c.facing = a;
      c.dir = { x: Math.cos(a), y: Math.sin(a) };
      if (c.timer <= 0) { c.mode = 'charge'; c.timer = CART_CHARGE_TIME; }
      continue;
    }
    if (c.mode === 'stop') continue;
    // charging
    const nx = c.pos.x + c.dir.x * speed * dt, ny = c.pos.y + c.dir.y * speed * dt;
    const fx = nx + c.dir.x * (CART_REACH + 0.25), fy = ny + c.dir.y * (CART_REACH + 0.25);
    c.walkPhase += dt * speed * 3;
    if (!rollable(state, p.floor, Math.floor(fx), Math.floor(fy)) || c.timer <= 0) {
      c.mode = 'stop';
      c.timer = CART_STOP_TIME;
      state.events.push({ type: 'cartCrash', x: fx, y: fy });
      continue;
    }
    c.pos.x = nx; c.pos.y = ny;
    const front = { x: c.pos.x + c.dir.x * CART_REACH, y: c.pos.y + c.dir.y * CART_REACH };
    // the cart is about a tile wide: test the nugget against the cart's front edge
    const rx = p.pos.x - front.x, ry = p.pos.y - front.y;
    const along = rx * c.dir.x + ry * c.dir.y;
    const side = Math.abs(rx * -c.dir.y + ry * c.dir.x);
    if (p.invuln <= 0 && !p.hidden && along > -0.7 && along < 0.45 && side < CART_HIT) bump(state, c);
  }
  state.carts = state.carts.filter((c) => !(c.mode === 'stop' && c.timer <= 0));
}

/** Run over by a cart: a life lost and knocked aside, but the nugget keeps its place. */
function bump(state: GameState, c: Cart) {
  const p = state.player;
  state.lives--;
  state.timesCaught++;
  p.invuln = 2.2;
  p.slip = 0.4; // sent spinning along with the cart
  p.slipDir = { ...c.dir };
  c.mode = 'stop';
  c.timer = CART_STOP_TIME;
  state.events.push({ type: 'bumped' });
  if (state.lives <= 0) {
    state.status = 'gameover';
    state.caughtBy = 'A shopper with a cart';
    state.events.push({ type: 'gameover' });
  }
}
