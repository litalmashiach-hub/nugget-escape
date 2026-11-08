/**
 * The boss fight in the front garden. Right outside the front door, Uncle Gus (eating
 * from a bucket of fried chicken) blocks the way. The nugget squirts ketchup at him while
 * dodging thrown drumsticks and belly slams. Pure game rules: no rendering here.
 */
import type { GameState, Input } from './state';
import type { Vec } from './types';

/** The fenced front garden, in ground-floor map coordinates (south of the house). */
export const ARENA = { x0: 7.6, x1: 24.4, y0: 22.7, y1: 31.4 };
export const BOSS_NAME = 'Uncle Gus';
export const BOSS_RADIUS = 0.8;
export const BOSS_HP = { easy: 16, normal: 24, hard: 30 } as const;
export const FIRE_COOLDOWN = 0.25;
/** Squirts in a full bottle; an empty bottle refills completely after REFILL_TIME. */
export const BOTTLE_SIZE = 8;
export const REFILL_TIME = 2.2;
export const KETCHUP_SPEED = 10;
export const DRUMSTICK_SPEED = 5.2;
export const SLAM_RADIUS = 1.7;
export const HURT_INVULN = 1.6;
export const BOSS_DOWN_TIME = 2.6;
const PLAYER_R = 0.28;

export type BossMode = 'walk' | 'throwWindup' | 'slamWindup' | 'jump' | 'recover' | 'defeated';

export interface Boss {
  pos: Vec;
  facing: number;
  hp: number;
  maxHp: number;
  mode: BossMode;
  timer: number;
  /** Where a belly slam will land (shown as a warning ring). */
  target: Vec | null;
  jumpFrom: Vec | null;
  /** 0..1 progress of the current jump, for the renderer. */
  jump: number;
  /** Seconds left of the red "ouch" flash after a ketchup hit. */
  flash: number;
  walkPhase: number;
  attacks: number;
}

export interface Shot {
  kind: 'ketchup' | 'drumstick';
  pos: Vec;
  vel: Vec;
  life: number;
  spin: number;
}

export const ENTRY = { x: 15, y: 23.3 };
const BOSS_START = { x: 15, y: 26.4 };

export function makeBoss(state: GameState): Boss {
  const hp = BOSS_HP[state.difficulty];
  return {
    pos: { ...BOSS_START }, facing: -Math.PI / 2, hp, maxHp: hp, mode: 'walk', timer: 1.2,
    target: null, jumpFrom: null, jump: 0, flash: 0, walkPhase: 0, attacks: 0,
  };
}

const clampArena = (p: Vec, r: number) => {
  p.x = Math.max(ARENA.x0 + r, Math.min(ARENA.x1 - r, p.x));
  p.y = Math.max(ARENA.y0 + r, Math.min(ARENA.y1 - r, p.y));
};

const angleTo = (a: Vec, b: Vec) => Math.atan2(b.y - a.y, b.x - a.x);
const dist = (a: Vec, b: Vec) => Math.hypot(b.x - a.x, b.y - a.y);

function turn(from: number, to: number, k: number) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return from + d * Math.min(1, k);
}

/** Called when the front door cutscene ends (or is skipped). */
export function beginBossFight(state: GameState) {
  if (state.status !== 'bossIntro') return;
  state.boss ??= makeBoss(state);
  state.player.pos = { ...ENTRY };
  state.player.facing = Math.PI / 2;
  state.player.invuln = 0.8;
  state.ketchup = BOTTLE_SIZE;
  state.refill = 0;
  state.status = 'boss';
  state.events.push({ type: 'bossStart' });
}

function hurtPlayer(state: GameState) {
  const p = state.player;
  if (p.invuln > 0 || state.status !== 'boss') return;
  state.lives--;
  state.timesCaught++;
  p.invuln = HURT_INVULN;
  state.events.push({ type: 'hurt' });
  if (state.lives <= 0) {
    state.status = 'gameover';
    state.caughtBy = BOSS_NAME;
    state.events.push({ type: 'gameover' });
  }
}

export function updateBossFight(state: GameState, input: Input, dt: number) {
  const boss = state.boss!;
  const p = state.player;
  state.time += dt;
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  boss.flash = Math.max(0, boss.flash - dt);

  // ------------------------------------------------ the nugget
  let mx = input.mx, my = input.my;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  p.moving = len > 0.1;
  p.hidden = false;
  if (input.dash && p.dashCd <= 0 && p.moving) {
    p.dashTime = 0.22;
    p.dashCd = 1.4;
    state.events.push({ type: 'dash' });
  }
  if (p.moving) {
    const speed = 4.4 * (p.dashTime > 0 ? 2.1 : 1);
    p.pos.x += mx * speed * dt;
    p.pos.y += my * speed * dt;
    clampArena(p.pos, PLAYER_R);
    p.facing = turn(p.facing, Math.atan2(my, mx), dt * 14);
    p.walkPhase += dt * speed * 3.2;
  }
  // Can't walk through Uncle Gus.
  if (boss.mode !== 'jump' && boss.mode !== 'defeated') {
    const d = dist(boss.pos, p.pos);
    const min = BOSS_RADIUS + PLAYER_R;
    if (d < min && d > 1e-6) {
      p.pos.x = boss.pos.x + ((p.pos.x - boss.pos.x) / d) * min;
      p.pos.y = boss.pos.y + ((p.pos.y - boss.pos.y) / d) * min;
      clampArena(p.pos, PLAYER_R);
    }
  }

  // Ketchup! The bottle always aims at Gus, so younger players only have to dodge.
  if (state.ketchup <= 0) {
    state.refill += dt;
    if (state.refill >= REFILL_TIME) {
      state.ketchup = BOTTLE_SIZE;
      state.refill = 0;
      state.events.push({ type: 'refill' });
    }
  }
  if (input.fire && p.fireCd <= 0 && state.ketchup > 0 && boss.mode !== 'defeated') {
    state.ketchup--;
    const aim = angleTo(p.pos, boss.pos);
    p.facing = aim;
    p.fireCd = FIRE_COOLDOWN;
    state.shots.push({
      kind: 'ketchup',
      pos: { x: p.pos.x + Math.cos(aim) * 0.35, y: p.pos.y + Math.sin(aim) * 0.35 },
      vel: { x: Math.cos(aim) * KETCHUP_SPEED, y: Math.sin(aim) * KETCHUP_SPEED },
      life: 1.4,
      spin: 0,
    });
    state.events.push({ type: 'squirt' });
  }

  // ------------------------------------------------ shots
  for (const s of state.shots) {
    s.life -= dt;
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    s.spin += dt * 12;
    if (s.pos.x < ARENA.x0 - 1 || s.pos.x > ARENA.x1 + 1 || s.pos.y < ARENA.y0 - 0.5 || s.pos.y > ARENA.y1 + 1) s.life = 0;
    if (s.life <= 0) continue;
    if (s.kind === 'ketchup') {
      const airborne = boss.mode === 'jump' && boss.jump > 0.15 && boss.jump < 0.85;
      if (boss.mode !== 'defeated' && !airborne && dist(s.pos, boss.pos) < BOSS_RADIUS + 0.12) {
        s.life = 0;
        boss.hp--;
        boss.flash = 0.18;
        state.events.push({ type: 'bossHit', x: s.pos.x, y: s.pos.y, hp: boss.hp });
        if (boss.hp <= 0) {
          boss.mode = 'defeated';
          boss.timer = BOSS_DOWN_TIME;
          state.shots = state.shots.filter((o) => o.kind === 'ketchup');
          state.events.push({ type: 'bossDown' });
        }
      }
    } else if (dist(s.pos, p.pos) < PLAYER_R + 0.22) {
      s.life = 0;
      hurtPlayer(state);
    }
  }
  state.shots = state.shots.filter((s) => s.life > 0);
  if (state.status !== 'boss') return;

  // ------------------------------------------------ Uncle Gus
  const angry = boss.hp <= boss.maxHp / 2;
  const mult = state.settings.chaseMult;
  boss.timer -= dt;
  switch (boss.mode) {
    case 'walk': {
      const a = angleTo(boss.pos, p.pos);
      boss.facing = turn(boss.facing, a, dt * 4);
      if (dist(boss.pos, p.pos) > 1.2) {
        const sp = (angry ? 1.55 : 1.25) * mult;
        boss.pos.x += Math.cos(boss.facing) * sp * dt;
        boss.pos.y += Math.sin(boss.facing) * sp * dt;
        clampArena(boss.pos, BOSS_RADIUS);
        boss.walkPhase += dt * sp * 2.4;
      }
      if (dist(boss.pos, p.pos) < BOSS_RADIUS + PLAYER_R + 0.05) hurtPlayer(state);
      if (boss.timer <= 0) {
        boss.attacks++;
        if (boss.attacks % 3 === 0) {
          boss.mode = 'slamWindup';
          boss.timer = angry ? 0.6 : 0.8;
          boss.target = { x: p.pos.x, y: p.pos.y };
          clampArena(boss.target, BOSS_RADIUS);
        } else {
          boss.mode = 'throwWindup';
          boss.timer = angry ? 0.45 : 0.6;
        }
      }
      break;
    }
    case 'throwWindup':
      boss.facing = turn(boss.facing, angleTo(boss.pos, p.pos), dt * 6);
      if (boss.timer <= 0) {
        const n = angry ? 5 : 3;
        const spread = angry ? 0.32 : 0.36;
        const base = angleTo(boss.pos, p.pos);
        for (let i = 0; i < n; i++) {
          const a = base + (i - (n - 1) / 2) * spread;
          state.shots.push({
            kind: 'drumstick',
            pos: { x: boss.pos.x + Math.cos(a) * 0.9, y: boss.pos.y + Math.sin(a) * 0.9 },
            vel: { x: Math.cos(a) * DRUMSTICK_SPEED * mult, y: Math.sin(a) * DRUMSTICK_SPEED * mult },
            life: 3,
            spin: 0,
          });
        }
        state.events.push({ type: 'throw' });
        boss.mode = 'walk';
        boss.timer = angry ? 1.5 : 2.0;
      }
      break;
    case 'slamWindup':
      boss.facing = turn(boss.facing, angleTo(boss.pos, boss.target!), dt * 6);
      if (boss.timer <= 0) {
        boss.mode = 'jump';
        boss.timer = 0.95;
        boss.jump = 0;
        boss.jumpFrom = { ...boss.pos };
      }
      break;
    case 'jump': {
      boss.jump = Math.min(1, 1 - boss.timer / 0.95);
      const f = boss.jumpFrom!, t = boss.target!;
      boss.pos.x = f.x + (t.x - f.x) * boss.jump;
      boss.pos.y = f.y + (t.y - f.y) * boss.jump;
      if (boss.timer <= 0) {
        boss.jump = 1;
        boss.pos = { ...t };
        state.events.push({ type: 'slam', x: t.x, y: t.y });
        if (dist(t, p.pos) < SLAM_RADIUS) hurtPlayer(state);
        boss.mode = 'recover';
        boss.timer = angry ? 0.8 : 1.1;
        boss.target = null;
      }
      break;
    }
    case 'recover':
      if (boss.timer <= 0) {
        boss.mode = 'walk';
        boss.timer = angry ? 1.4 : 1.8;
        boss.jump = 0;
      }
      break;
    case 'defeated':
      if (boss.timer <= 0 && state.status === 'boss') {
        state.status = 'won';
        state.events.push({ type: 'win' });
      }
      break;
  }
}

/** Autopilot for the fight: circle around Gus at a safe distance and keep squirting. */
export function bossBotInput(state: GameState): Input {
  const boss = state.boss!;
  const p = state.player;
  if (state.status !== 'boss') return { mx: 0, my: 0, dash: false };
  const d = dist(p.pos, boss.pos);
  const a = angleTo(boss.pos, p.pos);
  // circle (tangent) plus a push to hold ~4.5 tiles away
  let mx = -Math.sin(a), my = Math.cos(a);
  const want = 5.5;
  mx += Math.cos(a) * (want - d) * 0.8;
  my += Math.sin(a) * (want - d) * 0.8;
  // stay out of the slam ring
  if (boss.target && dist(p.pos, boss.target) < SLAM_RADIUS + 0.8) {
    const b = angleTo(boss.target, p.pos);
    mx = Math.cos(b) * 2;
    my = Math.sin(b) * 2;
  }
  // keep off the fence: steer back toward the middle
  const cx = (ARENA.x0 + ARENA.x1) / 2, cy = (ARENA.y0 + ARENA.y1) / 2;
  if (p.pos.x < ARENA.x0 + 1.2 || p.pos.x > ARENA.x1 - 1.2 || p.pos.y < ARENA.y0 + 1.2 || p.pos.y > ARENA.y1 - 1.2) {
    mx += (cx - p.pos.x) * 0.25;
    my += (cy - p.pos.y) * 0.25;
  }
  // sidestep drumsticks heading our way
  let dash = false;
  for (const s of state.shots) {
    if (s.kind !== 'drumstick') continue;
    const rx = p.pos.x - s.pos.x, ry = p.pos.y - s.pos.y;
    const sp = Math.hypot(s.vel.x, s.vel.y);
    const along = (rx * s.vel.x + ry * s.vel.y) / sp;
    if (along < 0 || along > 3) continue;
    const side = (rx * s.vel.y - ry * s.vel.x) / sp;
    if (Math.abs(side) < 0.95) {
      const sgn = side >= 0 ? 1 : -1;
      mx += (s.vel.y / sp) * sgn * 2.5;
      my += (-s.vel.x / sp) * sgn * 2.5;
      dash = along < 1.2;
    }
  }
  const len = Math.hypot(mx, my) || 1;
  return { mx: mx / len, my: my / len, dash, fire: true };
}
