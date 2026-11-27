import type { Vec, FurnitureKind } from './types';
import { STORE, FARM } from './levels';

/**
 * Easter eggs. Walk up to the right piece of furniture and a little surprise
 * pops out. Level 1 (the house) has five, Level 2 (the grocery store) has three,
 * Level 3 (the farm) has four: one scarecrow, one cow, one crate, and dashing in the mud.
 */
export type SecretId = 'egg' | 'book' | 'duck' | 'box' | 'dentures' | 'cart' | 'grapes' | 'crate'
  | 'crow' | 'milk' | 'chick' | 'piggy';

export interface Rect { x: number; y: number; w: number; h: number }

export interface SecretDef {
  id: SecretId;
  /** The level it is hidden in. */
  level: 1 | 2 | 3;
  /** What the nugget finds, e.g. "an egg". */
  name: string;
  /** Where it was hiding, e.g. "in the fridge". */
  where: string;
  emoji: string;
  floor: number;
  /** The tiles of the furniture it hides in (same rectangles as in levels.ts). Touch any one of them. */
  rects: Rect[];
  /** Furniture kinds it hides in, kept in sync with levels.ts by a test. */
  furniture: FurnitureKind[];
  /**
   * Found by dashing this many times while standing in the mud instead of by
   * touching something. `rects` are then the mud puddles (where it twinkles).
   */
  mudDashes?: number;
}

const r = (x: number, y: number, w: number, h: number): Rect => ({ x, y, w, h });

/** Level 2: every piece of `kinds` furniture on the store floor inside the given area. */
function storeRects(kinds: FurnitureKind[], area: Rect = r(0, 0, 999, 999)): Rect[] {
  return STORE[0].furniture
    .filter((f) => kinds.includes(f.kind) && f.x >= area.x && f.y >= area.y && f.x + f.w <= area.x + area.w && f.y + f.h <= area.y + area.h)
    .map((f) => r(f.x, f.y, f.w, f.h));
}

/** The Stockroom (behind the orange door) on the store floor. */
export const STOCKROOM_AREA = r(21, 1, 19, 9);

/** Level 3: every mud puddle on the farm, as rectangles. */
function farmMud(): Rect[] {
  return (FARM[0].mud ?? []).map(([x, y, w, h]) => r(x, y, w, h));
}

/** Dashes in the mud it takes to find the piggy. */
export const MUD_DASHES = 3;

export const SECRETS: SecretDef[] = [
  // Level 1: the house
  { id: 'egg', level: 1, name: 'an egg', where: 'in the fridge', emoji: '🥚', floor: 0, rects: [r(10, 1, 1, 2)], furniture: ['fridge'] },
  { id: 'book', level: 1, name: 'a book', where: 'on the bookshelf', emoji: '📖', floor: 0, rects: [r(30, 10, 1, 4)], furniture: ['bookshelf'] },
  { id: 'duck', level: 1, name: 'a rubber duck', where: 'in the bathtub', emoji: '🦆', floor: 1, rects: [r(10, 1, 3, 2)], furniture: ['bathtub'] },
  { id: 'box', level: 1, name: 'a box', where: 'in the attic storage room', emoji: '📦', floor: 2, rects: [r(1, 1, 2, 2)], furniture: ['boxes'] },
  { id: 'dentures', level: 1, name: "Grandma's dentures", where: 'in the corner of her bedroom', emoji: '🦷', floor: 1, rects: [r(29, 1, 1, 1)], furniture: ['nightstand'] },
  // Level 2: the grocery store
  { id: 'cart', level: 2, name: 'a grocery cart', where: 'from a chatty checkout register', emoji: '🛒', floor: 0, rects: storeRects(['checkout']), furniture: ['checkout'] },
  { id: 'grapes', level: 2, name: 'a box of grapes', where: 'on a store shelf', emoji: '🍇', floor: 0, rects: storeRects(['shelf']), furniture: ['shelf'] },
  { id: 'crate', level: 2, name: 'a box', where: 'on the shelves in the Stockroom', emoji: '📦', floor: 0, rects: storeRects(['boxes', 'rack'], STOCKROOM_AREA), furniture: ['boxes', 'rack'] },
  // Level 3: the farm. Only one scarecrow, one cow and one crate are the special ones.
  { id: 'crow', level: 3, name: 'a little crow', where: "hiding in the Cornfield scarecrow's hat", emoji: '🐦', floor: 0, rects: [r(52, 26, 1, 1)], furniture: ['scarecrow'] },
  { id: 'milk', level: 3, name: 'chocolate milk', where: 'from the brown cow in the barn', emoji: '🥛', floor: 0, rects: [r(15, 11, 2, 1)], furniture: ['cow'] },
  { id: 'chick', level: 3, name: 'a baby chick', where: 'in a crate in the Tool Shed', emoji: '🐣', floor: 0, rects: [r(53, 8, 1, 1)], furniture: ['boxes'] },
  { id: 'piggy', level: 3, name: 'a muddy piggy', where: 'splashing in the mud', emoji: '🐷', floor: 0, rects: farmMud(), furniture: [], mudDashes: MUD_DASHES },
];

/** The easter eggs hidden in one level. */
export function secretsFor(level: number): SecretDef[] {
  return SECRETS.filter((s) => s.level === level);
}

/** How close (beyond the nugget's own size) it has to get to the furniture. */
export const SECRET_REACH = 0.32;

/** The point on the furniture closest to `pos`. */
export function closestPoint(def: SecretDef, pos: Vec): Vec {
  let best: Vec = pos, bestD = Infinity;
  for (const { x, y, w, h } of def.rects) {
    const c = { x: Math.max(x, Math.min(x + w, pos.x)), y: Math.max(y, Math.min(y + h, pos.y)) };
    const d = Math.hypot(c.x - pos.x, c.y - pos.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

export function touchingSecret(def: SecretDef, floor: number, pos: Vec, radius: number) {
  if (def.floor !== floor) return false;
  const c = closestPoint(def, pos);
  return Math.hypot(c.x - pos.x, c.y - pos.y) < radius + SECRET_REACH;
}

/** Find every easter egg in the house and you can make chicken nuggets rain from the ceiling. */
export const FEAST_TIME = 14;
/** Seconds before the nugget rain can be used again. */
export const FEAST_RECHARGE = 40;
