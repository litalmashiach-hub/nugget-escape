/**
 * The boss fights. Level 1: right outside the front door, Uncle Gus (eating from a bucket
 * of fried chicken) blocks the way, throwing drumsticks and doing belly slams.
 * Level 2: the store Manager catches the nugget snooping in the office and throws pink
 * slips ("YOU'RE FIRED!") and stomps. Level 3: out on the country road the Farmer comes
 * roaring up on his tractor (phase 1: fast, with charge attacks). When the tractor blows up
 * he grabs his rake (phase 2): if the rake hooks the nugget he pulls it in for a bite, unless
 * the nugget wriggles free. The nugget squirts ketchup back.
 * Pure game rules: no rendering here.
 */
import type { GameState, Input } from './state';
import type { Vec } from './types';

export interface Arena { x0: number; x1: number; y0: number; y1: number }

/** The fenced front garden, in ground-floor map coordinates (south of the house). */
export const ARENA: Arena = { x0: 7.6, x1: 24.4, y0: 22.7, y1: 31.4 };
export const BOSS_NAME = 'Uncle Gus';
export const BOSS_RADIUS = 0.8;
export const BOSS_HP = { easy: 16, normal: 24, hard: 30 } as const;
export const FIRE_COOLDOWN = 0.25;
/** Squirts in a full bottle. */
export const BOTTLE_SIZE = 8;
/** While the bottle is empty, a new ketchup bottle appears in the garden this often (seconds). */
export const BOTTLE_EVERY = 5;
/** At most this many bottles lying around at once. */
export const MAX_BOTTLES = 3;
/** How close the nugget has to get to grab a bottle. */
export const GRAB_RADIUS = 0.6;
export const KETCHUP_SPEED = 10;
export const DRUMSTICK_SPEED = 5.2;
export const SLAM_RADIUS = 1.7;
export const HURT_INVULN = 1.6;
export const BOSS_DOWN_TIME = 2.6;
const PLAYER_R = 0.28;

export type BossMode = 'walk' | 'throwWindup' | 'slamWindup' | 'jump' | 'recover' | 'stampWindup' | 'stamp' | 'defeated'
  // the Farmer: on the tractor...
  | 'arrive' | 'drive' | 'chargeWindup' | 'charge' | 'stunned' | 'explode'
  // ...and on foot with the rake
  | 'rakeWindup' | 'rake' | 'pull' | 'bite';

/** A shock wave from the Manager's FIRED stamp: a ring that grows from where it landed. */
export interface Wave {
  x: number;
  y: number;
  r: number;
  /** The ring has already gone past the nugget (it hit, or the nugget dashed through). */
  done: boolean;
}

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
  /** Shock waves spreading out from the stamp. */
  waves: Wave[];
  /** The Farmer: 1 on the tractor, 2 on foot with the rake. Always 1 for the others. */
  phase: 1 | 2;
  /** Which way a tractor charge or a rake swipe goes (radians). */
  dir: number;
  /** How far the rake reaches out right now (tiles from the Farmer). */
  rake: number;
  /** DASH presses so far while hooked on the rake. */
  wiggles: number;
}

/** How fast homing ketchup turns toward Gus (radians per second, roughly). */
const HOMING_TURN = 9;

/** Easy mode: ketchup aims itself at Uncle Gus and follows him. */
export function autoAim(state: GameState) {
  return state.difficulty === 'easy';
}

export interface Shot {
  /** The nugget's ketchup, or what the boss throws. */
  kind: 'ketchup' | 'drumstick' | 'slip';
  /** Easy mode ketchup: follows Uncle Gus. */
  homing?: boolean;
  pos: Vec;
  vel: Vec;
  life: number;
  spin: number;
}

/** A full ketchup bottle lying in the garden, waiting to be grabbed. */
export interface Bottle {
  pos: Vec;
  /** Seconds since it appeared (for the pop-in animation). */
  age: number;
}

export const ENTRY = { x: 15, y: 23.3 };
const BOSS_START = { x: 15, y: 26.4 };

/** Who the boss is and where the fight happens. */
export interface BossDef {
  /** Name as a heading ("Uncle Gus", "The Manager"). */
  name: string;
  /** Name inside a sentence ("Uncle Gus", "the Manager"). */
  the: string;
  /** Where the fight happens: nobody can leave this box. */
  arena: Arena;
  /** Where the nugget and the boss stand when the fight starts. */
  entry: Vec;
  start: Vec;
  /** What the boss throws ('drumstick' for Gus, 'slip' for the Manager's pink slips). */
  shot: 'drumstick' | 'slip';
  /** Words for the hints. */
  throws: string;
  slam: string;
  /** Name of the place, for the HUD. */
  place: string;
  /** The Manager's giant FIRED stamp: slams the floor and sends out a shock wave to dash through. */
  stamp: boolean;
  /** The Farmer: a tractor first, then the rake (see updateFarmer). */
  farmer?: boolean;
}

export const GUS: BossDef = {
  name: BOSS_NAME, the: BOSS_NAME, arena: ARENA, entry: ENTRY, start: BOSS_START,
  shot: 'drumstick', throws: 'drumsticks', slam: 'belly slam', place: 'Front Garden', stamp: false,
};

/** The Manager's Office (Level 2), in store map coordinates: below the desk, inside the walls. */
export const OFFICE_ARENA: Arena = { x0: 61.3, x1: 78.7, y0: 5.3, y1: 15.7 };

export const MANAGER: BossDef = {
  name: 'The Manager', the: 'the Manager', arena: OFFICE_ARENA,
  entry: { x: 69.5, y: 6.4 }, start: { x: 69.5, y: 11.6 },
  shot: 'slip', throws: 'pink slips', slam: 'big stomp', place: "Manager's Office", stamp: true,
};

/** How fast the stamp's shock wave spreads (tiles per second), and how far it goes. */
export const WAVE_SPEED = 6;
export const WAVE_MAX = 12;
/** Half the thickness of the ring that hurts. */
export const WAVE_BAND = 0.3;
/** How long the Manager holds the stamp up before slamming it down. */
export const STAMP_WINDUP = 1.0;

/** The country road and the field in front of the farm gate (Level 3), in farm map coordinates. */
export const ROAD_ARENA: Arena = { x0: 13, x1: 43, y0: 40.5, y1: 52 };

export const FARMER: BossDef = {
  name: 'The Farmer', the: 'the Farmer', arena: ROAD_ARENA,
  entry: { x: 28, y: 41.3 }, start: { x: 38, y: 47 },
  shot: 'drumstick', throws: 'tractor', slam: 'charge', place: 'Country Road', stamp: false, farmer: true,
};

/** Ketchup it takes to wreck the tractor (phase 1), then to beat the Farmer on foot (phase 2). */
export const TRACTOR_HP = { easy: 9, normal: 13, hard: 16 } as const;
export const RAKE_HP = { easy: 8, normal: 11, hard: 14 } as const;
export const TRACTOR_RADIUS = 1.0;
export const FARMER_RADIUS = 0.6;
/** The tractor is fast: almost as quick as the nugget when he's angry. */
export const TRACTOR_SPEED = 2.6;
export const CHARGE_SPEED = 11;
export const CHARGE_WINDUP = 1.0;
/** Dizzy after crashing into the fence at the end of a charge: squirt away! */
export const STUN_TIME = 1.7;
/** The wrecked tractor smokes for this long, then BOOM: keep out of the ring. */
export const BOOM_TIME = 2.0;
export const BOOM_RADIUS = 2.6;
export const RAKE_REACH = 5;
export const RAKE_WINDUP = 0.8;
/** The rake shoots out this fast (seconds), then comes back. */
export const RAKE_OUT = 0.3;
export const RAKE_BACK = 0.45;
/** How wide the rake head is: it hooks anything this close to the handle. */
export const RAKE_WIDTH = 0.3;
/** Hooked: the Farmer reels the nugget in this fast (tiles per second). */
export const PULL_SPEED = 2.3;
/** DASH presses that wriggle the nugget off the rake. */
export const WIGGLES = { easy: 2, normal: 3, hard: 4 } as const;
/** The bite at the end of the rake pull, before the level ends. */
export const BITE_TIME = 0.9;
/** The tractor drives in from the side of the road at the start. */
export const ARRIVE_TIME = 1.6;

/** The boss of the level being played. */
export function bossDef(state: GameState): BossDef {
  return state.level.id === 3 ? FARMER : state.level.id === 2 ? MANAGER : GUS;
}

/** How big the boss is right now (the tractor is bigger than the Farmer on foot). */
export function bossRadius(state: GameState) {
  const b = state.boss;
  if (!bossDef(state).farmer || !b) return BOSS_RADIUS;
  return b.phase === 1 ? TRACTOR_RADIUS : FARMER_RADIUS;
}

export function makeBoss(state: GameState): Boss {
  const def = bossDef(state);
  const hp = def.farmer ? TRACTOR_HP[state.difficulty] : BOSS_HP[state.difficulty];
  const boss: Boss = {
    pos: { ...def.start }, facing: -Math.PI / 2, hp, maxHp: hp, mode: 'walk', timer: 1.2,
    target: null, jumpFrom: null, jump: 0, flash: 0, walkPhase: 0, attacks: 0, waves: [],
    phase: 1, dir: 0, rake: 0, wiggles: 0,
  };
  if (def.farmer) {
    // roaring in along the road from the east
    boss.mode = 'arrive';
    boss.timer = ARRIVE_TIME;
    boss.pos = { x: def.arena.x1 + 4, y: def.start.y };
    boss.facing = Math.PI;
  }
  return boss;
}

const clampTo = (a: Arena, p: Vec, r: number) => {
  p.x = Math.max(a.x0 + r, Math.min(a.x1 - r, p.x));
  p.y = Math.max(a.y0 + r, Math.min(a.y1 - r, p.y));
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
  state.player.pos = { ...bossDef(state).entry };
  state.player.facing = Math.PI / 2;
  state.player.invuln = 0.8;
  state.ketchup = BOTTLE_SIZE;
  state.refill = 0;
  state.bottles = [];
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
    state.caughtBy = bossDef(state).name;
    state.events.push({ type: 'gameover' });
  }
}

export function updateBossFight(state: GameState, input: Input, dt: number) {
  const boss = state.boss!;
  const p = state.player;
  const def = bossDef(state);
  const ARENA = def.arena;
  const clampArena = (v: Vec, r: number) => clampTo(ARENA, v, r);
  state.time += dt;
  p.invuln = Math.max(0, p.invuln - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  boss.flash = Math.max(0, boss.flash - dt);

  // ------------------------------------------------ the nugget
  // hooked on the Farmer's rake: no running away, only wriggling (DASH)
  const hooked = boss.mode === 'pull' || boss.mode === 'bite';
  let mx = hooked ? 0 : input.mx, my = hooked ? 0 : input.my;
  const len = Math.hypot(mx, my);
  if (len > 1) { mx /= len; my /= len; }
  p.moving = len > 0.1;
  p.hidden = false;
  // In the boss fight a dash works standing still too: it goes the way the nugget faces.
  if (input.dash && p.dashCd <= 0 && !hooked) {
    p.dashTime = 0.22;
    p.dashCd = 1.4;
    state.events.push({ type: 'dash' });
  }
  if (!p.moving && p.dashTime > 0) {
    mx = Math.cos(p.facing);
    my = Math.sin(p.facing);
    p.moving = true;
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
  const R = bossRadius(state);
  if (boss.mode !== 'jump' && boss.mode !== 'defeated' && boss.mode !== 'arrive') {
    const d = dist(boss.pos, p.pos);
    const min = R + PLAYER_R;
    if (d < min && d > 1e-6) {
      p.pos.x = boss.pos.x + ((p.pos.x - boss.pos.x) / d) * min;
      p.pos.y = boss.pos.y + ((p.pos.y - boss.pos.y) / d) * min;
      clampArena(p.pos, PLAYER_R);
    }
  }

  // Ketchup! When the bottle runs dry, a fresh one appears in the garden every few seconds.
  for (const b of state.bottles) b.age += dt;
  if (state.ketchup <= 0) {
    state.refill += dt;
    if (state.refill >= BOTTLE_EVERY && state.bottles.length < MAX_BOTTLES) {
      state.refill = 0;
      const pos = bottleSpot(state);
      state.bottles.push({ pos, age: 0 });
      state.events.push({ type: 'bottle', x: pos.x, y: pos.y });
    }
    const got = state.bottles.find((b) => dist(b.pos, p.pos) < GRAB_RADIUS + PLAYER_R);
    if (got) {
      state.ketchup = BOTTLE_SIZE;
      state.refill = 0;
      state.bottles = [];
      state.events.push({ type: 'refill' });
    }
  }
  // The squirt goes straight where the nugget is facing: aim by turning.
  // On Easy it flies at Uncle Gus by itself and follows him.
  const homing = autoAim(state);
  if (input.fire && p.fireCd <= 0 && state.ketchup > 0 && boss.mode !== 'defeated' && !hooked) {
    state.ketchup--;
    const aim = homing ? angleTo(p.pos, boss.pos) : p.facing;
    p.fireCd = FIRE_COOLDOWN;
    state.shots.push({
      kind: 'ketchup',
      pos: { x: p.pos.x + Math.cos(aim) * 0.35, y: p.pos.y + Math.sin(aim) * 0.35 },
      vel: { x: Math.cos(aim) * KETCHUP_SPEED, y: Math.sin(aim) * KETCHUP_SPEED },
      life: homing ? 2.2 : 1.4,
      spin: 0,
      homing,
    });
    state.events.push({ type: 'squirt' });
  }

  // ------------------------------------------------ shots
  for (const s of state.shots) {
    s.life -= dt;
    if (s.homing && boss.mode !== 'defeated') {
      // steer toward Gus, keeping the same speed
      const want = angleTo(s.pos, boss.pos);
      const a = turn(Math.atan2(s.vel.y, s.vel.x), want, dt * HOMING_TURN);
      const sp = Math.hypot(s.vel.x, s.vel.y);
      s.vel = { x: Math.cos(a) * sp, y: Math.sin(a) * sp };
    }
    s.pos.x += s.vel.x * dt;
    s.pos.y += s.vel.y * dt;
    s.spin += dt * 12;
    if (s.pos.x < ARENA.x0 - 1 || s.pos.x > ARENA.x1 + 1 || s.pos.y < ARENA.y0 - 0.5 || s.pos.y > ARENA.y1 + 1) s.life = 0;
    if (s.life <= 0) continue;
    if (s.kind === 'ketchup') {
      const airborne = boss.mode === 'jump' && boss.jump > 0.15 && boss.jump < 0.85;
      // the smoking tractor is already done for: ketchup just splats on it
      const shielded = boss.mode === 'explode' || boss.mode === 'arrive' || boss.mode === 'bite';
      if (boss.mode !== 'defeated' && !airborne && dist(s.pos, boss.pos) < bossRadius(state) + 0.12) {
        s.life = 0;
        if (shielded) continue;
        boss.hp--;
        boss.flash = 0.18;
        state.events.push({ type: 'bossHit', x: s.pos.x, y: s.pos.y, hp: boss.hp });
        if (boss.hp <= 0 && def.farmer && boss.phase === 1) {
          // the tractor is wrecked: it smokes... and then it blows up
          boss.mode = 'explode';
          boss.timer = BOOM_TIME;
          state.shots = state.shots.filter((o) => o.kind === 'ketchup');
          state.events.push({ type: 'tractorSmoke', x: boss.pos.x, y: boss.pos.y });
        } else if (boss.hp <= 0) {
          boss.mode = 'defeated';
          boss.timer = BOSS_DOWN_TIME;
          boss.waves = [];
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

  // ------------------------------------------------ stamp shock waves
  for (const w of boss.waves) {
    w.r += WAVE_SPEED * state.settings.chaseMult * dt;
    if (w.done) continue;
    const d = dist(w, p.pos);
    if (Math.abs(d - w.r) < WAVE_BAND + PLAYER_R) {
      // dashing (or still blinking after a hit) carries the nugget safely through the ring
      if (p.dashTime > 0) { w.done = true; state.events.push({ type: 'dodgeWave' }); }
      else if (p.invuln <= 0) { w.done = true; hurtPlayer(state); }
    } else if (w.r > d + WAVE_BAND + PLAYER_R) w.done = true;
  }
  boss.waves = boss.waves.filter((w) => w.r < WAVE_MAX);
  if (state.status !== 'boss') return;

  // ------------------------------------------------ the boss
  if (def.farmer) return updateFarmer(state, input, dt);
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
        // Gus: throw, throw, slam. The Manager: throw, STAMP, throw, stomp.
        if (def.stamp && boss.attacks % 4 === 2) {
          boss.mode = 'stampWindup';
          boss.timer = angry ? STAMP_WINDUP * 0.8 : STAMP_WINDUP;
        } else if (def.stamp ? boss.attacks % 4 === 0 : boss.attacks % 3 === 0) {
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
            kind: def.shot,
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
    case 'stampWindup':
      // the giant stamp goes up over the Manager's head...
      boss.facing = turn(boss.facing, angleTo(boss.pos, p.pos), dt * 5);
      if (boss.timer <= 0) {
        // ...and THUMPS down in front of them: FIRED!
        const at = { x: boss.pos.x + Math.cos(boss.facing) * 0.9, y: boss.pos.y + Math.sin(boss.facing) * 0.9 };
        boss.waves.push({ x: at.x, y: at.y, r: 0, done: false });
        state.events.push({ type: 'stamp', x: at.x, y: at.y });
        boss.mode = 'stamp';
        boss.timer = 0.7;
      }
      break;
    case 'stamp':
      if (boss.timer <= 0) {
        boss.mode = 'walk';
        boss.timer = angry ? 1.3 : 1.7;
      }
      break;
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

/** Distance from point p to the segment a..b. */
function segDist(p: Vec, a: Vec, b: Vec) {
  const vx = b.x - a.x, vy = b.y - a.y;
  const L = vx * vx + vy * vy;
  const t = L > 0 ? Math.max(0, Math.min(1, ((p.x - a.x) * vx + (p.y - a.y) * vy) / L)) : 0;
  return Math.hypot(p.x - (a.x + vx * t), p.y - (a.y + vy * t));
}

/** How far a tractor charge from `from` heading `dir` goes before it hits the arena fence. */
export function chargeLength(a: Arena, from: Vec, dir: number, r = TRACTOR_RADIUS) {
  const dx = Math.cos(dir), dy = Math.sin(dir);
  let t = 99;
  if (dx > 1e-6) t = Math.min(t, (a.x1 - r - from.x) / dx);
  if (dx < -1e-6) t = Math.min(t, (a.x0 + r - from.x) / dx);
  if (dy > 1e-6) t = Math.min(t, (a.y1 - r - from.y) / dy);
  if (dy < -1e-6) t = Math.min(t, (a.y0 + r - from.y) / dy);
  return Math.max(0, t);
}

/** How far the rake reaches when it's swung (a bit further once the Farmer is angry). */
export function rakeReach(boss: Boss) {
  return boss.hp <= boss.maxHp / 2 ? RAKE_REACH * 1.12 : RAKE_REACH;
}

/**
 * The Farmer. Phase 1, on the tractor: drives after the nugget fast, and every few seconds
 * revs up and CHARGES in a straight line (shown as a red lane) until he crashes into the
 * fence, where he sits dizzy for a moment. Wreck the tractor with ketchup and it smokes,
 * then explodes. Phase 2, on foot: he swings his rake out along a red line; if it hooks the
 * nugget he reels it in for a bite (the end of the level!) unless the nugget wriggles free
 * by pressing DASH. A dash through the rake slips past it.
 */
function updateFarmer(state: GameState, input: Input, dt: number) {
  const boss = state.boss!;
  const p = state.player;
  const A = FARMER.arena;
  const angry = boss.hp <= boss.maxHp / 2;
  const mult = state.settings.chaseMult;
  const R = bossRadius(state);
  const touching = () => dist(boss.pos, p.pos) < R + PLAYER_R + 0.05;
  boss.timer -= dt;
  switch (boss.mode) {
    case 'arrive': {
      // in from the side of the road, to where the fight starts
      const k = Math.max(0, boss.timer / ARRIVE_TIME);
      boss.pos.x = FARMER.start.x + (A.x1 + 4 - FARMER.start.x) * k * k;
      boss.pos.y = FARMER.start.y;
      boss.walkPhase += dt * 12;
      if (boss.timer <= 0) {
        boss.pos = { ...FARMER.start };
        boss.mode = 'drive';
        boss.timer = 1.2;
      }
      break;
    }
    case 'drive': {
      // a tractor turns slowly, but it's fast in a straight line
      boss.facing = turn(boss.facing, angleTo(boss.pos, p.pos), dt * 2.2);
      const sp = TRACTOR_SPEED * (angry ? 1.2 : 1) * mult;
      if (dist(boss.pos, p.pos) > 0.8) {
        boss.pos.x += Math.cos(boss.facing) * sp * dt;
        boss.pos.y += Math.sin(boss.facing) * sp * dt;
        clampTo(A, boss.pos, R);
      }
      boss.walkPhase += dt * sp * 2.4;
      if (touching()) hurtPlayer(state);
      if (boss.timer <= 0) {
        boss.attacks++;
        boss.mode = 'chargeWindup';
        boss.timer = CHARGE_WINDUP * (angry ? 0.85 : 1);
        boss.dir = angleTo(boss.pos, p.pos);
        state.events.push({ type: 'rev' });
      }
      break;
    }
    case 'chargeWindup':
      // revving: aims at the nugget, then locks the direction just before going
      // (locked for the last 0.6 seconds, so there's time to get out of the red lane)
      if (boss.timer > 0.6) boss.dir = turn(boss.dir, angleTo(boss.pos, p.pos), dt * 5);
      boss.facing = turn(boss.facing, boss.dir, dt * 10);
      boss.walkPhase += dt * 30;
      if (boss.timer <= 0) {
        boss.facing = boss.dir;
        boss.mode = 'charge';
        boss.timer = 2.5;
        state.events.push({ type: 'charge' });
      }
      break;
    case 'charge': {
      const sp = CHARGE_SPEED * mult;
      const before = { ...boss.pos };
      boss.pos.x += Math.cos(boss.dir) * sp * dt;
      boss.pos.y += Math.sin(boss.dir) * sp * dt;
      clampTo(A, boss.pos, R);
      boss.walkPhase += dt * sp * 2.4;
      if (touching()) hurtPlayer(state);
      const moved = dist(before, boss.pos);
      if (moved < sp * dt * 0.5 || boss.timer <= 0) {
        // CRASH into the fence: dizzy!
        state.events.push({ type: 'crash', x: boss.pos.x, y: boss.pos.y });
        boss.mode = 'stunned';
        boss.timer = STUN_TIME * (angry ? 0.8 : 1);
      }
      break;
    }
    case 'stunned':
      if (boss.timer <= 0) {
        if (boss.phase === 1) {
          // angry: straight into the next charge sooner
          boss.mode = 'drive';
          boss.timer = angry ? 1.2 : 2.0;
        } else {
          boss.mode = 'walk';
          boss.timer = angry ? 1.2 : 1.7;
        }
      }
      break;
    case 'explode':
      boss.walkPhase += dt * 40;
      if (boss.timer <= 0) {
        // BOOM! The tractor's gone, and the Farmer comes out of the smoke with his rake.
        state.events.push({ type: 'tractorBoom', x: boss.pos.x, y: boss.pos.y });
        if (dist(boss.pos, p.pos) < BOOM_RADIUS) hurtPlayer(state);
        // blown clear of the wreck, toward the middle of the field
        const toMid = angleTo(boss.pos, { x: (A.x0 + A.x1) / 2, y: (A.y0 + A.y1) / 2 });
        boss.pos.x += Math.cos(toMid) * 2.2;
        boss.pos.y += Math.sin(toMid) * 2.2;
        boss.phase = 2;
        clampTo(A, boss.pos, bossRadius(state));
        boss.facing = toMid;
        boss.hp = boss.maxHp = RAKE_HP[state.difficulty];
        boss.mode = 'stunned';
        boss.timer = 1.4;
        boss.attacks = 0;
      }
      break;
    case 'walk': {
      boss.facing = turn(boss.facing, angleTo(boss.pos, p.pos), dt * 4);
      const sp = (angry ? 1.95 : 1.6) * mult;
      if (dist(boss.pos, p.pos) > 1.2) {
        boss.pos.x += Math.cos(boss.facing) * sp * dt;
        boss.pos.y += Math.sin(boss.facing) * sp * dt;
        clampTo(A, boss.pos, R);
        boss.walkPhase += dt * sp * 2.4;
      }
      if (touching()) hurtPlayer(state);
      if (boss.timer <= 0) {
        boss.attacks++;
        boss.mode = 'rakeWindup';
        boss.timer = RAKE_WINDUP * (angry ? 0.85 : 1);
        boss.dir = angleTo(boss.pos, p.pos);
      }
      break;
    }
    case 'rakeWindup':
      // the rake goes up over his shoulder, aimed at the nugget (locked just before the swing)
      if (boss.timer > 0.45) boss.dir = turn(boss.dir, angleTo(boss.pos, p.pos), dt * 6);
      boss.facing = turn(boss.facing, boss.dir, dt * 10);
      if (boss.timer <= 0) {
        boss.facing = boss.dir;
        boss.mode = 'rake';
        boss.timer = RAKE_OUT + RAKE_BACK;
        boss.rake = 0;
        state.events.push({ type: 'rakeSwipe' });
      }
      break;
    case 'rake': {
      const t = RAKE_OUT + RAKE_BACK - boss.timer;
      const reach = rakeReach(boss);
      const out = t < RAKE_OUT;
      boss.rake = out ? (reach * t) / RAKE_OUT : Math.max(0, reach * (1 - (t - RAKE_OUT) / RAKE_BACK));
      if (out) {
        const from = { x: boss.pos.x + Math.cos(boss.dir) * R, y: boss.pos.y + Math.sin(boss.dir) * R };
        const tip = { x: boss.pos.x + Math.cos(boss.dir) * boss.rake, y: boss.pos.y + Math.sin(boss.dir) * boss.rake };
        if (segDist(p.pos, from, tip) < PLAYER_R + RAKE_WIDTH) {
          if (p.dashTime > 0) {
            if (boss.wiggles >= 0) state.events.push({ type: 'dodgeRake' });
            boss.wiggles = -1; // (only one "nice dash" per swing)
          } else if (p.invuln <= 0) {
            // HOOKED!
            boss.mode = 'pull';
            boss.wiggles = 0;
            boss.timer = 99;
            state.events.push({ type: 'hooked' });
            break;
          }
        }
      }
      if (boss.timer <= 0) {
        boss.rake = 0;
        boss.wiggles = 0;
        boss.mode = 'walk';
        boss.timer = angry ? 1.4 : 2.0;
      }
      break;
    }
    case 'pull': {
      // reeling the nugget in... DASH to wriggle free!
      boss.facing = angleTo(boss.pos, p.pos);
      if (input.dash) {
        boss.wiggles++;
        state.events.push({ type: 'wiggle', left: WIGGLES[state.difficulty] - boss.wiggles });
        if (boss.wiggles >= WIGGLES[state.difficulty]) {
          // free! The Farmer stumbles backwards
          const a = angleTo(boss.pos, p.pos);
          p.pos.x += Math.cos(a) * 0.8;
          p.pos.y += Math.sin(a) * 0.8;
          clampTo(A, p.pos, PLAYER_R);
          p.invuln = 1.0;
          boss.rake = 0;
          boss.wiggles = 0;
          boss.mode = 'stunned';
          boss.timer = 1.3;
          state.events.push({ type: 'wriggleFree' });
          break;
        }
      }
      const d = dist(boss.pos, p.pos);
      const a = angleTo(p.pos, boss.pos);
      const step = Math.min(PULL_SPEED * mult * dt, Math.max(0, d - (R + PLAYER_R)));
      p.pos.x += Math.cos(a) * step;
      p.pos.y += Math.sin(a) * step;
      p.facing = a + Math.PI;
      boss.rake = Math.max(R, d);
      if (d - step <= R + PLAYER_R + 0.02) {
        // CHOMP.
        boss.mode = 'bite';
        boss.timer = BITE_TIME;
        boss.rake = 0;
        state.events.push({ type: 'bite' });
      }
      break;
    }
    case 'bite':
      if (boss.timer <= 0 && state.status === 'boss') {
        state.status = 'gameover';
        state.caughtBy = FARMER.name;
        state.bitten = true;
        state.events.push({ type: 'gameover' });
      }
      break;
    case 'defeated':
      if (boss.timer <= 0 && state.status === 'boss') {
        state.status = 'won';
        state.events.push({ type: 'win' });
      }
      break;
    default:
      boss.mode = boss.phase === 1 ? 'drive' : 'walk';
  }
}

/** A random open spot in the arena, away from the boss and not right under the nugget. */
function bottleSpot(state: GameState): Vec {
  const r = state.rand;
  const ARENA = bossDef(state).arena;
  let best: Vec = { x: (ARENA.x0 + ARENA.x1) / 2, y: (ARENA.y0 + ARENA.y1) / 2 };
  // (on the road, not in the corners where the tractor pins you)
  const m = bossDef(state).farmer ? 2.2 : 1;
  for (let i = 0; i < 20; i++) {
    const v = { x: ARENA.x0 + m + r() * (ARENA.x1 - ARENA.x0 - 2 * m), y: ARENA.y0 + m + r() * (ARENA.y1 - ARENA.y0 - 2 * m) };
    if (dist(v, state.boss!.pos) > 2.5 + (bossDef(state).farmer ? bossRadius(state) : 0) && dist(v, state.player.pos) > 2) return v;
    best = v;
  }
  return best;
}

/** Which way the autopilot is stepping out of the current charge or rake line. */
const dodgeMemo = new WeakMap<Boss, { key: number; sgn: number }>();

/** Autopilot for the fight: circle around Gus at a safe distance and keep squirting. */
export function bossBotInput(state: GameState): Input {
  const boss = state.boss!;
  const p = state.player;
  const ARENA = bossDef(state).arena;
  if (state.status !== 'boss') return { mx: 0, my: 0, dash: false };
  const def = bossDef(state);
  // hooked on the rake: wriggle, wriggle, wriggle
  if (boss.mode === 'pull') return { mx: 0, my: 0, dash: true, fire: false };
  const d = dist(p.pos, boss.pos);
  const a = angleTo(boss.pos, p.pos);
  const toGus = angleTo(p.pos, boss.pos);
  let mx: number, my: number;
  let fire = false;
  // the nearest bottle (against the Farmer: one that isn't right next to the tractor)
  const grabCost = (b: Bottle) => dist(b.pos, p.pos) + (def.farmer && dist(b.pos, boss.pos) < 4.5 ? 30 : 0);
  let bottle = state.ketchup <= 0
    ? state.bottles.slice().sort((x, y) => grabCost(x) - grabCost(y))[0]
    : undefined;
  // every bottle has the tractor parked next to it: keep circling until it moves off
  if (bottle && grabCost(bottle) >= 30) bottle = undefined;
  if (bottle) {
    // out of ketchup: run for the nearest bottle
    const b = angleTo(p.pos, bottle.pos);
    mx = Math.cos(b) * 1.5;
    my = Math.sin(b) * 1.5;
    // ...without running into Gus on the way
    if (d < 3.2) {
      mx += Math.cos(a) * (3.2 - d) * 1.6;
      my += Math.sin(a) * (3.2 - d) * 1.6;
    }
  } else {
    // circle (tangent) plus a push to hold ~5.5 tiles away
    mx = -Math.sin(a);
    my = Math.cos(a);
    const want = def.farmer ? (boss.phase === 1 ? 6.5 : 7.2) : 5.5;
    mx += Math.cos(a) * (want - d) * 0.8;
    my += Math.sin(a) * (want - d) * 0.8;
  }
  // stay out of the slam ring
  if (boss.target && dist(p.pos, boss.target) < SLAM_RADIUS + 0.8) {
    const b = angleTo(boss.target, p.pos);
    mx = Math.cos(b) * 2;
    my = Math.sin(b) * 2;
  }
  // keep off the fence: steer back toward the middle
  const cx = (ARENA.x0 + ARENA.x1) / 2, cy = (ARENA.y0 + ARENA.y1) / 2;
  // (more room from the fence against the tractor: it pins you there)
  const margin = def.farmer ? 2.2 : 1.2;
  if (p.pos.x < ARENA.x0 + margin || p.pos.x > ARENA.x1 - margin || p.pos.y < ARENA.y0 + margin || p.pos.y > ARENA.y1 - margin) {
    mx += (cx - p.pos.x) * 0.25;
    my += (cy - p.pos.y) * 0.25;
  }
  // sidestep drumsticks heading our way
  let dash = false;
  let threat = false;
  for (const s of state.shots) {
    if (s.kind === 'ketchup') continue;
    const rx = p.pos.x - s.pos.x, ry = p.pos.y - s.pos.y;
    const sp = Math.hypot(s.vel.x, s.vel.y);
    const along = (rx * s.vel.x + ry * s.vel.y) / sp;
    if (along < 0 || along > 3) continue;
    const side = (rx * s.vel.y - ry * s.vel.x) / sp;
    if (Math.abs(side) < 0.95) {
      threat = true;
      let sgn = side >= 0 ? 1 : -1;
      // never dodge into the fence: go the other way
      const ex = p.pos.x + (s.vel.y / sp) * sgn * 1.3, ey = p.pos.y + (-s.vel.x / sp) * sgn * 1.3;
      if (ex < ARENA.x0 + 0.5 || ex > ARENA.x1 - 0.5 || ey < ARENA.y0 + 0.5 || ey > ARENA.y1 - 0.5) sgn = -sgn;
      mx += (s.vel.y / sp) * sgn * 2.5;
      my += (-s.vel.x / sp) * sgn * 2.5;
      dash = along < 1.2;
    }
  }
  // a stamp shock wave coming: dash through it, toward the stamp
  for (const w of boss.waves) {
    if (w.done) continue;
    const gap = dist(w, p.pos) - w.r;
    if (gap > 0 && gap < 0.9) {
      // straight at the stamp is quickest through the ring, but sideways when the Manager is close
      const b = angleTo(p.pos, w) + (d < 3 ? Math.PI / 2 : 0);
      mx = Math.cos(b);
      my = Math.sin(b);
      dash = true;
      threat = true;
    }
  }
  if (def.farmer) {
    // get out of the tractor's charge lane, or the rake's line
    const R = bossRadius(state);
    const lane = boss.mode === 'chargeWindup' || boss.mode === 'charge' ? { len: chargeLength(ARENA, boss.pos, boss.dir), w: R + PLAYER_R + 0.9 }
      : boss.mode === 'rakeWindup' || boss.mode === 'rake' ? { len: rakeReach(boss) + 0.6, w: PLAYER_R + RAKE_WIDTH + 0.8 } : null;
    if (lane) {
      const dx = Math.cos(boss.dir), dy = Math.sin(boss.dir);
      const rx = p.pos.x - boss.pos.x, ry = p.pos.y - boss.pos.y;
      const along = rx * dx + ry * dy;
      const side = rx * dy - ry * dx;
      if (along > -R && along < lane.len + 0.6 && Math.abs(side) < lane.w) {
        threat = true;
        // step out sideways: the near side, unless the fence is in the way (then the roomy side)
        const n = Math.atan2(-dx, dy);
        const roomPlus = chargeLength(ARENA, p.pos, n, PLAYER_R + 0.2);
        const roomMinus = chargeLength(ARENA, p.pos, n + Math.PI, PLAYER_R + 0.2);
        let sgn = side >= 0 ? 1 : -1;
        const need = lane.w - Math.abs(side);
        if (Math.abs(side) < 0.5 || (sgn > 0 ? roomPlus : roomMinus) < need) sgn = roomPlus >= roomMinus ? 1 : -1;
        // once picked, stick with that side for this attack (no dithering on the middle line)
        const key = boss.attacks * 2 + boss.phase;
        const memo = dodgeMemo.get(boss);
        if (memo && memo.key === key) sgn = memo.sgn;
        else dodgeMemo.set(boss, { key, sgn });
        mx = dy * sgn * 2;
        my = -dx * sgn * 2;
        dash = (boss.mode === 'charge' && along < 6) || boss.mode === 'rake';
      }
    }
    // the wrecked tractor is about to blow: run!
    if (boss.mode === 'explode' && d < BOOM_RADIUS + 2) {
      threat = true;
      mx = Math.cos(a) * 2 + (cx - p.pos.x) * 0.1;
      my = Math.sin(a) * 2 + (cy - p.pos.y) * 0.1;
    }
  }
  const len = Math.hypot(mx, my) || 1;
  mx /= len;
  my /= len;
  // Safe moment with ketchup in the bottle: turn to face Gus (a tiny step toward him) and squirt.
  const danger = boss.mode === 'jump' || boss.mode === 'throwWindup' || boss.mode === 'chargeWindup' || boss.mode === 'charge' || boss.mode === 'rakeWindup' || boss.mode === 'rake';
  const safe = !threat && !boss.target && !danger && d > 3.4;
  if (state.ketchup > 0 && safe) {
    mx = Math.cos(toGus) * 0.12;
    my = Math.sin(toGus) * 0.12;
    let off = (toGus - p.facing) % (Math.PI * 2);
    if (off > Math.PI) off -= Math.PI * 2;
    if (off < -Math.PI) off += Math.PI * 2;
    fire = Math.abs(off) < 0.12;
  }
  return { mx, my, dash, fire };
}
