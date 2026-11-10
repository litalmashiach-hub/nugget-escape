import { describe, expect, it } from 'vitest';
import {
  createGame, update, currentObjective, canFeast, CAUGHT_TIME, INTRO_TIME, type GameState, type Input,
} from '../../src/game/state';
import { botInput, solveHouse } from '../../src/game/bot';
import { canSee } from '../../src/game/vision';
import { CART_WINDUP, cartSpawn } from '../../src/game/carts';
import { beginBossFight, bossBotInput, MANAGER, OFFICE_ARENA } from '../../src/game/boss';
import { LEVEL1, LEVEL2, LEVELS, STORE } from '../../src/game/levels';
import { buildMaps } from '../../src/game/map';
import type { Difficulty } from '../../src/game/types';

const DT = 1 / 60;
const idle: Input = { mx: 0, my: 0, dash: false };

function skipIntro(s: GameState) {
  for (let t = 0; t <= INTRO_TIME + DT; t += DT) update(s, idle, DT);
  expect(s.status).toBe('playing');
}

function run(s: GameState, seconds: number, input: (s: GameState) => Input) {
  const events: string[] = [];
  for (let t = 0; t < seconds && s.status !== 'won' && s.status !== 'gameover' && s.status !== 'bossIntro'; t += DT) {
    update(s, input(s), DT);
    events.push(...s.events.map((e) => e.type));
  }
  return events;
}

/** Level 2 with only one employee, placed by the test. */
function withOne(id: string) {
  const s = createGame('normal', { level: 2, seed: 1 });
  skipIntro(s);
  s.chasers = s.chasers.filter((c) => c.def.id === id);
  return s;
}

describe('level 2: the grocery store', () => {
  it('Level 1 is still the default and is the house', () => {
    const s = createGame('normal');
    expect(s.level.id).toBe(1);
    expect(s.maps).toHaveLength(3);
    expect(LEVELS[1]).toBe(LEVEL1);
  });

  it('is one big store with a cold room, a stockroom, a bakery kitchen and the Manager\'s Office', () => {
    const [m] = buildMaps(STORE);
    expect(m.def.rooms.map((r) => r.name)).toEqual(['Cold Room', 'Stockroom', 'Bakery Kitchen', "Manager's Office", 'Sales Floor']);
    for (const k of m.def.keys) expect(m.walkableForPlayer(k.x, k.y, new Set()), `${k.color} key`).toBe(true);
    // every waypoint of every employee is somewhere they can stand
    for (const f of m.def.family)
      for (const [x, y] of [f.start, ...f.waypoints])
        expect(m.walkableForFamily(x, y, new Set(['green', 'orange', 'purple', 'gold'])), `${f.name} at ${x},${y}`).toBe(true);
  });

  it('can be solved: green -> Cold Room -> orange -> Stockroom -> purple -> Bakery Kitchen -> gold -> office', () => {
    const r = solveHouse(STORE, LEVEL2.start);
    expect(r.escaped).toBe(true);
    expect(r.order).toEqual(['green', 'orange', 'purple', 'gold']);
  });

  it('starts at the entrance with four keys to find and twelve store employees', () => {
    const s = createGame('normal', { level: 2 });
    expect(s.level.id).toBe(2);
    expect(s.status).toBe('intro');
    expect(s.player.pos).toEqual({ x: LEVEL2.start.x, y: LEVEL2.start.y });
    expect(s.keys.map((k) => k.color)).toEqual(['green', 'orange', 'purple', 'gold']);
    expect(s.chasers.map((c) => c.def.kind)).toEqual([
      'cashier', 'cashier', 'stocker', 'stocker', 'stocker', 'clerk', 'clerk', 'butcher', 'clerk', 'stocker', 'stocker', 'clerk',
    ]);
    expect(currentObjective(s)?.text).toBe('Find the Green key');
  });

  it('the gold key opens the Manager\'s Office, and walking in starts the Manager boss fight', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 1 });
    skipIntro(s);
    for (const c of ['green', 'orange', 'purple', 'gold'] as const) s.held.add(c);
    s.unlocked.add('green'); s.unlocked.add('orange'); s.unlocked.add('purple');
    expect(currentObjective(s)?.text).toBe("Open the Manager's Office!");
    // stand under the gold door and walk north
    s.player.pos = { x: 69.5, y: 17.6 };
    const ev = run(s, 3, () => ({ mx: 0, my: -1, dash: false }));
    expect(ev).toContain('unlock');
    expect(ev).toContain('bossIntro');
    expect(s.status).toBe('bossIntro');
    expect(s.boss).not.toBeNull();
    expect(s.player.pos).toEqual(MANAGER.entry);
    beginBossFight(s);
    expect(s.status).toBe('boss');
    expect(currentObjective(s)?.text).toBe('Squirt ketchup at the Manager!');
    expect(currentObjective(s)?.hint).toContain('pink slips');
  });

  it('with ?noboss walking into the office wins straight away', () => {
    const s = createGame('normal', { level: 2, noFamily: true, noBoss: true, seed: 1 });
    skipIntro(s);
    for (const c of ['green', 'orange', 'purple', 'gold'] as const) { s.held.add(c); s.unlocked.add(c); }
    s.player.pos = { x: 69.5, y: 16.5 };
    const ev = run(s, 2, () => ({ mx: 0, my: -1, dash: false }));
    expect(ev).toContain('win');
    expect(s.status).toBe('won');
    expect(s.boss).toBeNull();
  });

  it('the Manager throws pink slips, stamps and stomps, and everyone stays inside the office', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 4 });
    s.status = 'bossIntro' as GameState['status'];
    beginBossFight(s);
    s.lives = 99; // stand still and take it, to see every attack
    const kinds = new Set<string>();
    const ev: string[] = [];
    for (let t = 0; t < 12 && s.status === 'boss'; t += DT) {
      update(s, idle, DT);
      for (const sh of s.shots) kinds.add(sh.kind);
      ev.push(...s.events.map((e) => e.type));
      for (const v of [s.player.pos, s.boss!.pos]) {
        expect(v.x).toBeGreaterThanOrEqual(OFFICE_ARENA.x0);
        expect(v.x).toBeLessThanOrEqual(OFFICE_ARENA.x1);
        expect(v.y).toBeGreaterThanOrEqual(OFFICE_ARENA.y0);
        expect(v.y).toBeLessThanOrEqual(OFFICE_ARENA.y1);
      }
    }
    expect(kinds.has('slip')).toBe(true);
    expect(kinds.has('drumstick')).toBe(false);
    expect(ev).toContain('slam');
    expect(ev).toContain('stamp');
    expect(s.lives).toBeLessThan(99);
  });

  /** A Manager fight where the very next attack is the FIRED stamp. */
  function stampFight() {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 4 });
    s.status = 'bossIntro' as GameState['status'];
    beginBossFight(s);
    s.boss!.attacks = 1;
    s.boss!.timer = 0;
    const ev: string[] = [];
    for (let t = 0; t < 2 && !ev.includes('stamp'); t += DT) { update(s, idle, DT); ev.push(...s.events.map((e) => e.type)); }
    expect(ev).toContain('stamp');
    expect(s.boss!.mode).toBe('stamp');
    expect(s.boss!.waves).toHaveLength(1);
    return s;
  }

  it('the Manager slams the FIRED stamp, and its shock wave hurts a nugget that stands still', () => {
    const s = stampFight();
    const ev: string[] = [];
    for (let t = 0; t < 1.5; t += DT) { update(s, idle, DT); ev.push(...s.events.map((e) => e.type)); }
    expect(ev).toContain('hurt');
    expect(ev).not.toContain('dodgeWave');
    expect(s.lives).toBe(2);
  });

  it('dashing through the shock wave is safe', () => {
    const s = stampFight();
    const ev: string[] = [];
    for (let t = 0; t < 1.5; t += DT) {
      const w = s.boss!.waves[0];
      const gap = w ? Math.hypot(w.x - s.player.pos.x, w.y - s.player.pos.y) - w.r : 9;
      // dash (standing still: it goes the way the nugget faces, toward the Manager) just before it arrives
      update(s, { mx: 0, my: 0, dash: gap > 0 && gap < 0.7 }, DT);
      ev.push(...s.events.map((e) => e.type));
    }
    expect(ev).toContain('dodgeWave');
    expect(ev).not.toContain('hurt');
    expect(s.lives).toBe(3);
  });

  it('Uncle Gus has no stamp', () => {
    const s = createGame('normal', { noFamily: true, seed: 4 });
    s.status = 'bossIntro' as GameState['status'];
    beginBossFight(s);
    const ev: string[] = [];
    for (let t = 0; t < 30 && s.status === 'boss'; t += DT) { update(s, bossBotInput(s), DT); ev.push(...s.events.map((e) => e.type)); }
    expect(ev).not.toContain('stamp');
  });

  it('losing every life to the Manager says who did it', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 4 });
    s.status = 'bossIntro' as GameState['status'];
    beginBossFight(s);
    for (let t = 0; t < 120 && s.status === 'boss'; t += DT) update(s, idle, DT);
    expect(s.status).toBe('gameover');
    expect(s.caughtBy).toBe('The Manager');
  });

  it('after the gold door opens the goal is to get into the office', () => {
    const s = createGame('normal', { level: 2, noFamily: true });
    for (const c of ['green', 'orange', 'purple', 'gold'] as const) { s.held.add(c); s.unlocked.add(c); }
    expect(currentObjective(s)?.text).toBe("Get into the Manager's Office!");
    expect(currentObjective(s)?.action).toBe('escape');
  });

  it('getting caught by staff puts the nugget back on the frozen food shelf', () => {
    const s = withOne('dan');
    const dan = s.chasers[0];
    dan.pos = { x: 70.5, y: 29.5 };
    dan.facing = 0; dan.lookBase = 0; dan.pause = 5;
    s.player.pos = { x: 73.0, y: 29.5 };
    s.checkpoint = { floor: 0, x: 5.5, y: 6.5 }; // the shelf wins over the last door opened
    const ev = run(s, 2 + CAUGHT_TIME + 1, () => idle);
    expect(ev).toContain('caught');
    expect(ev).toContain('respawn');
    expect(s.lives).toBe(2);
    expect(s.player.pos).toEqual({ x: LEVEL2.shelf!.x, y: LEVEL2.shelf!.y });
    expect(s.status).toBe('playing');
  });

  it('employees cannot see through the tall shelves', () => {
    const s = createGame('normal', { level: 2 });
    const [m] = s.maps;
    const viewer = { pos: { x: 13.5, y: 22.5 }, facing: Math.PI, range: 6, fov: Math.PI };
    // the nugget is on the other side of the shelf (x 10-11)
    expect(canSee(m, s.unlocked, viewer, { x: 8.5, y: 22.5 })).toBe(false);
    // but down the open aisle it is in plain sight
    expect(canSee(m, s.unlocked, { ...viewer, facing: Math.PI / 2 }, { x: 13.5, y: 26.5 })).toBe(true);
  });

  it('a nugget hiding under a fruit stand is not spotted', () => {
    const s = withOne('priya');
    const priya = s.chasers[0];
    priya.pos = { x: 14.5, y: 12.5 };
    priya.facing = 0; priya.lookBase = 0; priya.pause = 5;
    s.player.pos = { x: 18.5, y: 12.5 }; // under the green fruit stand
    run(s, 0.1, () => idle);
    expect(s.player.hidden).toBe(true);
    expect(s.events.map((e) => e.type)).not.toContain('alert');
  });

  it('has no easter eggs or nugget rain (those live in the house)', () => {
    const s = createGame('normal', { level: 2 });
    skipIntro(s);
    s.secrets = new Set(['egg', 'book', 'duck', 'box', 'dentures']);
    expect(canFeast(s)).toBe(false);
  });

  it('staff never walk into walls or shelves while wandering for a long time', () => {
    const s = createGame('hard', { level: 2, seed: 3 });
    skipIntro(s);
    s.player.pos = { x: 69.5, y: 8.5 }; // tucked away in the locked office
    s.player.hidden = true;
    for (let i = 0; i < 60 * 60; i++) {
      update(s, idle, DT);
      for (const c of s.chasers) {
        expect(s.maps[0].walkableForFamily(Math.floor(c.pos.x), Math.floor(c.pos.y), s.unlocked), `${c.def.name} at ${c.pos.x},${c.pos.y}`).toBe(true);
      }
    }
  });

  it('the autopilot finds all four keys, reaches the Manager\'s Office and beats the Manager', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 1 });
    skipIntro(s);
    const ev = run(s, 240, botInput);
    expect(s.status).toBe('bossIntro');
    expect(s.maps[0].roomAt(s.player.pos.x, s.player.pos.y)?.id).toBe('office');
    beginBossFight(s);
    ev.push(...run(s, 180, bossBotInput));
    expect(s.status).toBe('won');
    expect(ev).toContain('bossDown');
    expect(ev.filter((e) => e === 'key')).toHaveLength(4);
    expect(ev.filter((e) => e === 'unlock')).toHaveLength(4);
    expect(s.maps[0].roomAt(s.player.pos.x, s.player.pos.y)?.id).toBe('office');
  });

  it('is a big supermarket: 80 by 52 tiles', () => {
    const [m] = buildMaps(STORE);
    expect(m.w).toBe(80);
    expect(m.h).toBe(52);
  });

  it('every key sits behind a water spill: there is a way around, but the short way is wet', () => {
    const [m] = buildMaps(STORE);
    const all = new Set(['green', 'orange', 'purple', 'gold'] as const);
    for (const k of m.def.keys) {
      // some spill tile within 2 tiles of the key
      let near = false;
      for (let y = k.y - 2; y <= k.y + 2; y++) for (let x = k.x - 2; x <= k.x + 2; x++) if (m.isSpill(x, y)) near = true;
      expect(near, `${k.color} key`).toBe(true);
    }
    // the dry way around exists: the solver ignores spills, so check with spills as walls
    const dry = STORE.map((f) => ({ ...f, rows: f.rows.map((r, y) => [...r].map((ch, x) => (m.isSpill(x, y) ? '#' : ch)).join('')) }));
    expect(solveHouse(dry, LEVEL2.start).escaped).toBe(true);
    // staff never step in the water
    for (const [x, y] of [[72, 44], [13, 4], [33, 4], [52, 2]]) expect(m.walkableForFamily(x, y, all)).toBe(false);
  });

  it('stepping on a spill sends the nugget sliding out of control, and nearby staff hear the splash', () => {
    const s = withOne('dan');
    const dan = s.chasers[0];
    dan.pos = { x: 70.5, y: 42.5 }; dan.facing = Math.PI; dan.lookBase = Math.PI; dan.pause = 9; // looking away
    s.player.pos = { x: 75.5, y: 42.3 }; // just above the spill wall by the green key
    let ev: string[] = [];
    for (let i = 0; i < 20; i++) { update(s, { mx: 0, my: 1, dash: false }, DT); ev = ev.concat(s.events.map((e) => e.type)); }
    expect(ev).toContain('slip');
    expect(s.player.slip).toBeGreaterThan(0);
    // steering does nothing while sliding: it keeps going down
    const y0 = s.player.pos.y;
    for (let i = 0; i < 10; i++) update(s, { mx: 1, my: 0, dash: false }, DT);
    expect(s.player.pos.y).toBeGreaterThan(y0 + 0.5);
    expect(dan.mode === 'search' || dan.mode === 'alert' || dan.mode === 'chase').toBe(true);
  });

  it('getting near a key makes a shopper charge with a cart; standing still gets you run over', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 1 });
    skipIntro(s);
    s.player.pos = { x: 75.5, y: 48.0 }; // right below the green key
    const ev = run(s, 0.1, () => idle);
    expect(ev).toContain('rush');
    expect(s.carts).toHaveLength(1);
    const ev2 = run(s, CART_WINDUP + 2.5, () => idle);
    expect(ev2).toContain('bumped');
    expect(s.lives).toBe(2);
    expect(s.status).toBe('playing'); // knocked aside, not sent back to the shelf
  });

  it('a cart can be dodged by stepping out of its lane', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 1 });
    skipIntro(s);
    s.player.pos = { x: 75.5, y: 48.0 };
    run(s, 0.1, () => idle);
    const c = s.carts[0];
    // wait for the charge to start, then sidestep
    run(s, CART_WINDUP + 0.05, () => idle);
    const ev = run(s, 2.5, (st) => (st.carts.length ? { mx: -c.dir.y, my: c.dir.x, dash: false } : idle));
    expect(ev).not.toContain('bumped');
    expect(s.lives).toBe(3);
  });

  it('shoppers come from a spot with a clear run at the nugget', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 2 });
    s.player.pos = { x: 31.5, y: 4.5 };
    s.unlocked.add('green'); s.unlocked.add('orange');
    const spot = cartSpawn(s)!;
    expect(spot).not.toBeNull();
    expect(s.maps[0].roomAt(spot.x, spot.y)?.id).toBe('stock');
  });

  it.each(['easy'] as Difficulty[])('the autopilot can beat the store with the staff around (%s)', (d) => {
    let wins = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = createGame(d, { level: 2, seed });
      skipIntro(s);
      run(s, 240, botInput);
      if (s.status === 'bossIntro') { beginBossFight(s); run(s, 180, botInput); }
      if (s.status === 'won') wins++;
    }
    expect(wins).toBeGreaterThan(0);
  });
});
