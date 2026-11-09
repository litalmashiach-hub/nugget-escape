import type { Vec } from './types';

/**
 * Easter eggs hidden around the house. Walk up to the right piece of furniture
 * and a little surprise pops out. They are just for fun: no keys or lives involved.
 */
export type SecretId = 'egg' | 'book' | 'duck' | 'box' | 'dentures';

export interface SecretDef {
  id: SecretId;
  /** What the nugget finds, e.g. "an egg". */
  name: string;
  /** Where it was hiding, e.g. "in the fridge". */
  where: string;
  emoji: string;
  floor: number;
  /** The furniture's tiles (same rectangle as in levels.ts). */
  rect: { x: number; y: number; w: number; h: number };
  /** Furniture kind it hides in, kept in sync with levels.ts by a test. */
  furniture: 'fridge' | 'bookshelf' | 'bathtub' | 'boxes' | 'nightstand';
}

export const SECRETS: SecretDef[] = [
  { id: 'egg', name: 'an egg', where: 'in the fridge', emoji: '🥚', floor: 0, rect: { x: 10, y: 1, w: 1, h: 2 }, furniture: 'fridge' },
  { id: 'book', name: 'a book', where: 'on the bookshelf', emoji: '📖', floor: 0, rect: { x: 30, y: 10, w: 1, h: 4 }, furniture: 'bookshelf' },
  { id: 'duck', name: 'a rubber duck', where: 'in the bathtub', emoji: '🦆', floor: 1, rect: { x: 10, y: 1, w: 3, h: 2 }, furniture: 'bathtub' },
  { id: 'box', name: 'a box', where: 'in the attic storage room', emoji: '📦', floor: 2, rect: { x: 1, y: 1, w: 2, h: 2 }, furniture: 'boxes' },
  { id: 'dentures', name: "Grandma's dentures", where: 'in the corner of her bedroom', emoji: '🦷', floor: 1, rect: { x: 29, y: 1, w: 1, h: 1 }, furniture: 'nightstand' },
];

/** How close (beyond the nugget's own size) it has to get to the furniture. */
export const SECRET_REACH = 0.32;

/** The point on the furniture closest to `pos`. */
export function closestPoint(def: SecretDef, pos: Vec): Vec {
  const { x, y, w, h } = def.rect;
  return { x: Math.max(x, Math.min(x + w, pos.x)), y: Math.max(y, Math.min(y + h, pos.y)) };
}

export function touchingSecret(def: SecretDef, floor: number, pos: Vec, radius: number) {
  if (def.floor !== floor) return false;
  const c = closestPoint(def, pos);
  return Math.hypot(c.x - pos.x, c.y - pos.y) < radius + SECRET_REACH;
}

/** Find every easter egg and you can make chicken nuggets rain from the ceiling. */
export const FEAST_TIME = 14;
/** Seconds before the nugget rain can be used again. */
export const FEAST_RECHARGE = 40;
