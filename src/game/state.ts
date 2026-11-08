import { FLOORS, START } from './levels';
import { buildMaps, type FloorMap } from './map';
import { findPath } from './path';
import { canSee, angleDiff } from './vision';
import {
  DIFFICULTY, KEY_INFO, KEY_ORDER,
  type Difficulty, type DifficultySettings, type FamilyDef, type FloorDef, type KeyColor, type Vec,
} from './types';

export const PLAYER_RADIUS = 0.28;
export const FAMILY_RADIUS = 0.34;
export const PLAYER_SPEED = 4.3;
export const DASH_MULT = 2.1;
export const DASH_TIME = 0.22;
export const DASH_COOLDOWN = 1.6;
export const INTRO_TIME = 1.3;
export const CAUGHT_TIME = 1.7;
export const INVULN_TIME = 2.2;

export interface Input {
  mx: number;
  my: number;
  /** True only on the frame dash was pressed. */
  dash: boolean;
}

export type GameEvent =
  | { type: 'key'; color: KeyColor; x: number; y: number }
  | { type: 'unlock'; color: KeyColor; x: number; y: number }
  | { type: 'locked'; color: KeyColor }
  | { type: 'alert'; id: string }
  | { type: 'lost'; id: string }
  | { type: 'caught'; by: string }
  | { type: 'floor'; floor: number }
  | { type: 'dash' }
  | { type: 'respawn' }
  | { type: 'win' }
  | { type: 'gameover' };

export type ChaserMode = 'patrol' | 'alert' | 'chase' | 'search' | 'return';

export interface Chaser {
  def: FamilyDef;
  floor: number;
  pos: Vec;
  facing: number;
  mode: ChaserMode;
  timer: number;
  pause: number;
  lookBase: number;
  wp: number;
  path: Vec[];
  pathTimer: number;
  lastSeen: Vec | null;
  sinceSeen: number;
  seesPlayer: boolean;
  moving: boolean;
  walkPhase: number;
}

export interface Player {
  floor: number;
  pos: Vec;
  facing: number;
  moving: boolean;
  hidden: boolean;
  dashTime: number;
  dashCd: number;
  invuln: number;
  walkPhase: number;
  /** Stairs ignore the nugget right after arriving until the player lets go or turns. */
  stairsArmed: boolean;
  arriveDir: Vec;
}

export interface KeyItem {
  color: KeyColor;
  floor: number;
  x: number;
  y: number;
  taken: boolean;
}

export type Status = 'intro' | 'playing' | 'caught' | 'won' | 'gameover';

export interface GameOptions {
  noFamily?: boolean;
  floors?: FloorDef[];
}

export interface GameState {
  maps: FloorMap[];
  difficulty: Difficulty;
  settings: DifficultySettings;
  player: Player;
  chasers: Chaser[];
  keys: KeyItem[];
  held: Set<KeyColor>;
  unlocked: Set<KeyColor>;
  lives: number;
  status: Status;
  statusTimer: number;
  time: number;
  timesSpotted: number;
  timesCaught: number;
  checkpoint: { floor: number; x: number; y: number };
  events: GameEvent[];
  lockedCd: number;
  caughtBy: string | null;
}

const makeChaser = (def: FamilyDef, floor: number): Chaser => ({
  def,
  floor,
  pos: { x: def.start[0] + 0.5, y: def.start[1] + 0.5 },
  facing: Math.PI / 2,
  mode: 'patrol',
  timer: 0,
  pause: 0.6,
  lookBase: Math.PI / 2,
  wp: 0,
  path: [],
  pathTimer: 0,
  lastSeen: null,
  sinceSeen: 0,
  seesPlayer: false,
  moving: false,
  walkPhase: 0,
});

export function createGame(difficulty: Difficulty = 'normal', opts: GameOptions = {}): GameState {
  const floors = opts.floors ?? FLOORS;
  const maps = buildMaps(floors);
  const settings = DIFFICULTY[difficulty];
  return {
    maps,
    difficulty,
    settings,
    player: {
      floor: START.floor,
      pos: { x: START.x, y: START.y },
      facing: Math.PI / 2,
      moving: false,
      hidden: false,
      dashTime: 0,
      dashCd: 0,
      invuln: 0,
      walkPhase: 0,
      stairsArmed: true,
      arriveDir: { x: 0, y: 0 },
    },
    chasers: opts.noFamily ? [] : floors.flatMap((fl) => fl.family.map((d) => makeChaser(d, fl.id))),
    keys: floors.flatMap((fl) => fl.keys.map((k) => ({ ...k, x: k.x + 0.5, y: k.y + 0.5, floor: fl.id, taken: false }))),
    held: new Set(),
    unlocked: new Set(),
    lives: settings.lives,
    status: 'intro',
    statusTimer: INTRO_TIME,
    time: 0,
    timesSpotted: 0,
    timesCaught: 0,
    checkpoint: { floor: START.floor, x: START.x, y: START.y },
    events: [],
    lockedCd: 0,
    caughtBy: null,
  };
}

// ---------------------------------------------------------------- movement

/** Does a circle at (x, y) overlap any tile that is not walkable? */
export function circleBlocked(walk: (x: number, y: number) => boolean, x: number, y: number, r: number): boolean {
  const x0 = Math.floor(x - r), x1 = Math.floor(x + r);
  const y0 = Math.floor(y - r), y1 = Math.floor(y + r);
  for (let ty = y0; ty <= y1; ty++)
    for (let tx = x0; tx <= x1; tx++) {
      if (walk(tx, ty)) continue;
      const cx = Math.max(tx, Math.min(x, tx + 1));
      const cy = Math.max(ty, Math.min(y, ty + 1));
      if ((cx - x) ** 2 + (cy - y) ** 2 < r * r - 1e-9) return true;
    }
  return false;
}

/** Moves with wall sliding, plus a gentle nudge around corners so doorways are easy to enter. */
export function moveCircle(walk: (x: number, y: number) => boolean, pos: Vec, dx: number, dy: number, r: number): boolean {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 0.05));
  const sx = dx / steps, sy = dy / steps;
  let moved = false;
  for (let i = 0; i < steps; i++) {
    if (sx) {
      if (!circleBlocked(walk, pos.x + sx, pos.y, r)) { pos.x += sx; moved = true; }
      else if (!sy) moved = nudge(walk, pos, 'y', sx, r) || moved;
    }
    if (sy) {
      if (!circleBlocked(walk, pos.x, pos.y + sy, r)) { pos.y += sy; moved = true; }
      else if (!sx) moved = nudge(walk, pos, 'x', sy, r) || moved;
    }
  }
  return moved;
}

function nudge(walk: (x: number, y: number) => boolean, pos: Vec, axis: 'x' | 'y', push: number, r: number) {
  // Pushing into a wall: if an opening is close by, slide sideways toward it.
  const along = axis === 'x' ? pos.x : pos.y;
  const base = Math.floor(along);
  let target: number | null = null;
  for (const c of [base + 0.5, base - 0.5, base + 1.5]) {
    if (Math.abs(c - along) > 0.75) continue;
    const free = axis === 'y' ? !circleBlocked(walk, pos.x + push, c, r) : !circleBlocked(walk, c, pos.y + push, r);
    if (free && (target === null || Math.abs(c - along) < Math.abs(target - along))) target = c;
  }
  if (target === null) return false;
  const off = target - along;
  if (Math.abs(off) < 1e-3) return false;
  const step = Math.sign(off) * Math.min(Math.abs(off), Math.abs(push));
  const nx = axis === 'x' ? pos.x + step : pos.x, ny = axis === 'y' ? pos.y + step : pos.y;
  if (circleBlocked(walk, nx, ny, r)) return false;
  pos.x = nx;
  pos.y = ny;
  return true;
}

const lerpAngle = (a: number, b: number, t: number) => {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(1, t);
};

// ---------------------------------------------------------------- objective / hints

export function roomNameOf(state: GameState, floor: number, x: number, y: number) {
  return state.maps[floor].roomAt(x, y)?.name ?? 'the house';
}

/** Room that sits behind a door of this color. */
export function doorRoom(state: GameState, color: KeyColor) {
  for (const m of state.maps) {
    const r = m.def.rooms.find((r) => r.door === color);
    if (r) return { floor: m.def.id, room: r };
  }
  return null;
}

export function findDoor(state: GameState, color: KeyColor) {
  for (const m of state.maps) {
    const d = m.doors.find((d) => d.color === color);
    if (d) return { floor: m.def.id, door: d };
  }
  return null;
}

export interface Objective {
  color: KeyColor;
  action: 'find' | 'open' | 'escape';
  text: string;
  hint: string;
}

export function currentObjective(state: GameState): Objective | null {
  for (const color of KEY_ORDER) {
    if (state.unlocked.has(color)) {
      if (color === 'gold') return { color, action: 'escape', text: 'Run out the front door!', hint: 'The front door is open. Run outside to freedom!' };
      continue;
    }
    const label = KEY_INFO[color].label;
    if (!state.held.has(color)) {
      const k = state.keys.find((k) => k.color === color)!;
      return {
        color,
        action: 'find',
        text: `Find the ${label} key`,
        hint: `The ${label} key is in the ${roomNameOf(state, k.floor, k.x, k.y)} (${state.maps[k.floor].def.name}).`,
      };
    }
    if (color === 'gold') return { color, action: 'open', text: 'Open the Gold front door!', hint: 'The front door is at the bottom of the Front Hall (Ground Floor).' };
    const dr = doorRoom(state, color)!;
    return {
      color,
      action: 'open',
      text: `Open the ${label} door`,
      hint: `The ${label} door leads to the ${dr.room.name} (${state.maps[dr.floor].def.name}).`,
    };
  }
  return null;
}

// ---------------------------------------------------------------- update

export function update(state: GameState, input: Input, dt: number) {
  state.events = [];
  if (state.status === 'won' || state.status === 'gameover') return;

  if (state.status === 'intro') {
    state.statusTimer -= dt;
    if (state.statusTimer <= 0) state.status = 'playing';
    return;
  }

  if (state.status === 'caught') {
    state.statusTimer -= dt;
    if (state.statusTimer <= 0) {
      if (state.lives <= 0) {
        state.status = 'gameover';
        state.events.push({ type: 'gameover' });
      } else respawn(state);
    }
    return;
  }

  state.time += dt;
  state.lockedCd = Math.max(0, state.lockedCd - dt);
  updatePlayer(state, input, dt);
  if (state.status !== 'playing') return;
  for (const c of state.chasers) updateChaser(state, c, dt);
}

function respawn(state: GameState) {
  const p = state.player;
  p.floor = state.checkpoint.floor;
  p.pos = { x: state.checkpoint.x, y: state.checkpoint.y };
  p.invuln = INVULN_TIME;
  p.dashTime = 0;
  for (const c of state.chasers) if (c.floor === p.floor) Object.assign(c, makeChaser(c.def, c.floor));
  state.status = 'playing';
  state.caughtBy = null;
  state.events.push({ type: 'respawn' });
}

function updatePlayer(state: GameState, input: Input, dt: number) {
  const p = state.player;
  const map = state.maps[p.floor];
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);

  let mx = input.mx, my = input.my;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  p.moving = len > 0.1;
  if (!p.stairsArmed && (!p.moving || mx * p.arriveDir.x + my * p.arriveDir.y < 0.7)) p.stairsArmed = true;

  if (input.dash && p.dashCd <= 0 && p.moving) {
    p.dashTime = DASH_TIME;
    p.dashCd = DASH_COOLDOWN;
    state.events.push({ type: 'dash' });
  }

  if (p.moving) {
    const speed = PLAYER_SPEED * (p.dashTime > 0 ? DASH_MULT : 1);
    p.facing = lerpAngle(p.facing, Math.atan2(my, mx), dt * 14);
    const walk = (x: number, y: number) => map.walkableForPlayer(x, y, state.unlocked);
    moveCircle(walk, p.pos, mx * speed * dt, my * speed * dt, PLAYER_RADIUS);
    p.walkPhase += dt * speed * 3.2;

    // Bumping into a locked door: open it if we carry the matching key.
    const nl = Math.hypot(mx, my) || 1;
    const probe = { x: p.pos.x + (mx / nl) * (PLAYER_RADIUS + 0.2), y: p.pos.y + (my / nl) * (PLAYER_RADIUS + 0.2) };
    const door = map.door(Math.floor(probe.x), Math.floor(probe.y));
    if (door && !state.unlocked.has(door.color)) {
      if (state.held.has(door.color)) {
        state.unlocked.add(door.color);
        state.checkpoint = { floor: p.floor, x: p.pos.x, y: p.pos.y };
        state.events.push({ type: 'unlock', color: door.color, x: door.x + 0.5, y: door.y + 0.5 });
      } else if (state.lockedCd <= 0) {
        state.lockedCd = 1.6;
        state.events.push({ type: 'locked', color: door.color });
      }
    }
  }

  // Keys
  for (const k of state.keys) {
    if (k.taken || k.floor !== p.floor) continue;
    if (Math.hypot(k.x - p.pos.x, k.y - p.pos.y) < 0.62) {
      k.taken = true;
      state.held.add(k.color);
      state.events.push({ type: 'key', color: k.color, x: k.x, y: k.y });
    }
  }

  const tx = Math.floor(p.pos.x), ty = Math.floor(p.pos.y);
  p.hidden = map.isHide(tx, ty);

  // Escape through the front door
  const door = map.door(tx, ty);
  if (door && door.color === 'gold' && state.unlocked.has('gold') && p.pos.y > ty + 0.45) {
    state.status = 'won';
    state.events.push({ type: 'win' });
    return;
  }

  // Stairs
  const stairs = map.isStairs(tx, ty);
  if (stairs && p.stairsArmed) {
    const to = p.floor + (stairs === 'up' ? 1 : -1);
    const dest = state.maps[to]?.def;
    const arrive = stairs === 'up' ? dest?.arriveFromBelow : dest?.arriveFromAbove;
    if (dest && arrive) {
      for (const c of state.chasers) {
        if (c.floor === p.floor && (c.mode === 'chase' || c.mode === 'alert')) {
          c.mode = 'search';
          c.timer = 2.5;
          c.seesPlayer = false;
        }
      }
      p.floor = to;
      p.pos = { x: arrive[0] + 0.5, y: arrive[1] + 0.5 };
      p.invuln = Math.max(p.invuln, 0.8);
      p.stairsArmed = false;
      p.arriveDir = { x: mx, y: my };
      state.checkpoint = { floor: to, x: p.pos.x, y: p.pos.y };
      state.events.push({ type: 'floor', floor: to });
    }
  }
}

function pathTo(state: GameState, c: Chaser, target: Vec): Vec[] | null {
  const map = state.maps[c.floor];
  const walk = (x: number, y: number) => map.walkableForFamily(x, y, state.unlocked);
  const sx = Math.floor(c.pos.x), sy = Math.floor(c.pos.y);
  const tx = Math.floor(target.x), ty = Math.floor(target.y);
  // Target may be under a table or on the stairs: aim for the closest tile a person can stand on.
  for (let ring = 0; ring <= 2; ring++) {
    let best: Vec[] | null = null;
    for (let dy = -ring; dy <= ring; dy++)
      for (let dx = -ring; dx <= ring; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== ring) continue;
        const p = findPath(map.w, map.h, walk, sx, sy, tx + dx, ty + dy);
        if (p && (!best || p.length < best.length)) best = p;
      }
    if (best) return best;
  }
  return null;
}

function followPath(state: GameState, c: Chaser, speed: number, dt: number) {
  const map = state.maps[c.floor];
  c.moving = false;
  if (!c.path.length) return true;
  const next = c.path[0];
  const dx = next.x - c.pos.x, dy = next.y - c.pos.y;
  const d = Math.hypot(dx, dy);
  const stepLen = speed * dt;
  if (d <= stepLen + 0.02) {
    c.pos.x = next.x;
    c.pos.y = next.y;
    c.path.shift();
  } else {
    const walk = (x: number, y: number) => map.walkableForFamily(x, y, state.unlocked);
    if (!moveCircle(walk, c.pos, (dx / d) * stepLen, (dy / d) * stepLen, FAMILY_RADIUS * 0.8)) {
      // Stuck (a door changed or something) — snap along the path.
      c.pos.x += (dx / d) * stepLen;
      c.pos.y += (dy / d) * stepLen;
    }
  }
  c.facing = lerpAngle(c.facing, Math.atan2(dy, dx), dt * 8);
  c.moving = true;
  c.walkPhase += dt * speed * 3;
  return c.path.length === 0;
}

function updateChaser(state: GameState, c: Chaser, dt: number) {
  const p = state.player;
  const s = state.settings;
  const sameFloor = p.floor === c.floor;
  const viewer = {
    pos: c.pos,
    facing: c.facing,
    range: c.def.visionRange * s.visionMult,
    fov: (Math.min(360, c.def.fovDeg * (c.def.fovDeg >= 360 ? 1 : s.visionMult)) * Math.PI) / 180,
  };
  const sees =
    sameFloor && !p.hidden && p.invuln <= 0 && canSee(state.maps[c.floor], state.unlocked, viewer, p.pos);
  c.seesPlayer = sees;
  if (sees) {
    c.lastSeen = { x: p.pos.x, y: p.pos.y };
    c.sinceSeen = 0;
    if (c.mode === 'patrol' || c.mode === 'return' || c.mode === 'search') {
      c.mode = 'alert';
      c.timer = s.alertDelay;
      c.path = [];
      state.timesSpotted++;
      state.events.push({ type: 'alert', id: c.def.id });
    }
  }

  switch (c.mode) {
    case 'patrol': {
      if (c.pause > 0) {
        c.pause -= dt;
        c.moving = false;
        c.facing = c.lookBase + Math.sin(c.pause * 2.6) * 0.9;
        if (c.pause <= 0) c.wp = (c.wp + 1) % c.def.waypoints.length;
        break;
      }
      if (!c.path.length) {
        // Skip waypoints that are behind locked doors.
        for (let tries = 0; tries < c.def.waypoints.length; tries++) {
          const w = c.def.waypoints[c.wp];
          const path = pathTo(state, c, { x: w[0] + 0.5, y: w[1] + 0.5 });
          const exact = path && path.length && Math.floor(path[path.length - 1].x) === w[0] && Math.floor(path[path.length - 1].y) === w[1];
          if (path && exact) { c.path = path; break; }
          if (Math.floor(c.pos.x) === w[0] && Math.floor(c.pos.y) === w[1]) { c.path = []; break; }
          c.wp = (c.wp + 1) % c.def.waypoints.length;
        }
        if (!c.path.length) {
          c.pause = 1.2;
          c.lookBase = c.facing;
          break;
        }
      }
      if (followPath(state, c, c.def.patrolSpeed * s.patrolMult, dt)) {
        c.pause = 1.1;
        c.lookBase = c.facing;
      }
      break;
    }
    case 'alert': {
      c.moving = false;
      if (c.lastSeen) c.facing = lerpAngle(c.facing, Math.atan2(c.lastSeen.y - c.pos.y, c.lastSeen.x - c.pos.x), dt * 12);
      c.timer -= dt;
      if (c.timer <= 0) {
        c.mode = 'chase';
        c.pathTimer = 0;
      }
      break;
    }
    case 'chase': {
      if (!sees) c.sinceSeen += dt;
      const target = c.lastSeen!;
      const speed = c.def.chaseSpeed * s.chaseMult;
      const dist = Math.hypot(p.pos.x - c.pos.x, p.pos.y - c.pos.y);
      if (sees && dist < 1.6) {
        // Close enough to lunge straight at the nugget.
        const map = state.maps[c.floor];
        const walk = (x: number, y: number) => map.walkableForFamily(x, y, state.unlocked);
        const dx = p.pos.x - c.pos.x, dy = p.pos.y - c.pos.y;
        moveCircle(walk, c.pos, (dx / dist) * speed * dt, (dy / dist) * speed * dt, FAMILY_RADIUS * 0.8);
        c.facing = lerpAngle(c.facing, Math.atan2(dy, dx), dt * 12);
        c.moving = true;
        c.walkPhase += dt * speed * 3;
        c.path = [];
        c.pathTimer = 0;
      } else {
        c.pathTimer -= dt;
        if (c.pathTimer <= 0 || !c.path.length) {
          c.path = pathTo(state, c, target) ?? [];
          c.pathTimer = 0.25;
        }
        const arrived = followPath(state, c, speed, dt);
        if (!sees && (arrived || c.sinceSeen > c.def.giveUp)) {
          c.mode = 'search';
          c.timer = 2.4;
          c.lookBase = c.facing;
          state.events.push({ type: 'lost', id: c.def.id });
        }
      }
      if (sameFloor && !p.hidden && p.invuln <= 0 && dist < PLAYER_RADIUS + FAMILY_RADIUS + 0.04) {
        state.status = 'caught';
        state.statusTimer = CAUGHT_TIME;
        state.lives--;
        state.timesCaught++;
        state.caughtBy = c.def.name;
        state.events.push({ type: 'caught', by: c.def.id });
        for (const o of state.chasers) {
          if (o.floor === c.floor && o !== c) { o.mode = 'search'; o.timer = 1; }
        }
      }
      break;
    }
    case 'search': {
      c.moving = false;
      c.timer -= dt;
      c.facing = c.lookBase + Math.sin(c.timer * 3) * 1.3;
      if (c.timer <= 0) {
        c.mode = 'return';
        // Go back to the closest reachable patrol point.
        let best = 0, bestD = Infinity;
        c.def.waypoints.forEach((w, i) => {
          const d = Math.hypot(w[0] + 0.5 - c.pos.x, w[1] + 0.5 - c.pos.y);
          if (d < bestD) { bestD = d; best = i; }
        });
        c.wp = best;
        const w = c.def.waypoints[best];
        c.path = pathTo(state, c, { x: w[0] + 0.5, y: w[1] + 0.5 }) ?? [];
      }
      break;
    }
    case 'return': {
      if (followPath(state, c, c.def.patrolSpeed * s.patrolMult, dt)) {
        c.mode = 'patrol';
        c.pause = 0.8;
        c.lookBase = c.facing;
      }
      break;
    }
  }
}

/** Angle difference helper re-exported for the renderer. */
export { angleDiff };
