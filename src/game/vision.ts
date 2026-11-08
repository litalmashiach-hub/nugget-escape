import type { FloorMap } from './map';
import type { KeyColor, Vec } from './types';

/** True when nothing opaque (walls, closed doors) lies between a and b. */
export function lineOfSight(map: FloorMap, unlocked: ReadonlySet<KeyColor>, a: Vec, b: Vec): boolean {
  const dx = b.x - a.x, dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const steps = Math.ceil(dist / 0.1);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (map.opaque(Math.floor(a.x + dx * t), Math.floor(a.y + dy * t), unlocked)) return false;
  }
  return true;
}

/** Distance a ray travels from origin at angle before hitting something opaque. */
export function castRay(map: FloorMap, unlocked: ReadonlySet<KeyColor>, o: Vec, angle: number, range: number): number {
  const cx = Math.cos(angle), cy = Math.sin(angle);
  for (let d = 0.05; d < range; d += 0.08) {
    if (map.opaque(Math.floor(o.x + cx * d), Math.floor(o.y + cy * d), unlocked)) return Math.max(0, d - 0.04);
  }
  return range;
}

export const angleDiff = (a: number, b: number) => {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
};

export interface Viewer {
  pos: Vec;
  facing: number;
  range: number;
  fov: number; // radians
}

/** Can the viewer see a target point? Checks range, field of view and walls. */
export function canSee(map: FloorMap, unlocked: ReadonlySet<KeyColor>, v: Viewer, target: Vec): boolean {
  const dx = target.x - v.pos.x, dy = target.y - v.pos.y;
  const dist = Math.hypot(dx, dy);
  if (dist > v.range) return false;
  // Very close: everyone notices a nugget at their feet.
  if (dist > 1.1 && v.fov < Math.PI * 2 - 0.01 && angleDiff(Math.atan2(dy, dx), v.facing) > v.fov / 2) return false;
  return lineOfSight(map, unlocked, v.pos, target);
}
