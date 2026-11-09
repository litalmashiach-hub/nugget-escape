import { describe, expect, it } from 'vitest';
import {
  createGame, update, currentObjective, canFeast, CAUGHT_TIME, INTRO_TIME, type GameState, type Input,
} from '../../src/game/state';
import { botInput, solveHouse } from '../../src/game/bot';
import { canSee } from '../../src/game/vision';
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

  it('is one big store with a cold room, a stockroom and the Manager\'s Office', () => {
    const [m] = buildMaps(STORE);
    expect(m.def.rooms.map((r) => r.name)).toEqual(['Cold Room', 'Stockroom', "Manager's Office", 'Sales Floor']);
    for (const k of m.def.keys) expect(m.walkableForPlayer(k.x, k.y, new Set()), `${k.color} key`).toBe(true);
    // every waypoint of every employee is somewhere they can stand
    for (const f of m.def.family)
      for (const [x, y] of [f.start, ...f.waypoints])
        expect(m.walkableForFamily(x, y, new Set(['green', 'orange', 'gold'])), `${f.name} at ${x},${y}`).toBe(true);
  });

  it('can be solved: green key -> Cold Room -> orange key -> Stockroom -> gold key -> office', () => {
    const r = solveHouse(STORE, LEVEL2.start);
    expect(r.escaped).toBe(true);
    expect(r.order).toEqual(['green', 'orange', 'gold']);
  });

  it('starts at the entrance with three keys to find and five store employees', () => {
    const s = createGame('normal', { level: 2 });
    expect(s.level.id).toBe(2);
    expect(s.status).toBe('intro');
    expect(s.player.pos).toEqual({ x: LEVEL2.start.x, y: LEVEL2.start.y });
    expect(s.keys.map((k) => k.color)).toEqual(['green', 'orange', 'gold']);
    expect(s.chasers.map((c) => c.def.kind)).toEqual(['cashier', 'stocker', 'butcher', 'clerk', 'stocker']);
    expect(currentObjective(s)?.text).toBe('Find the Green key');
  });

  it('the gold key opens the Manager\'s Office, and walking in wins (no boss fight)', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 1 });
    skipIntro(s);
    for (const c of ['green', 'orange', 'gold'] as const) s.held.add(c);
    s.unlocked.add('green'); s.unlocked.add('orange');
    expect(currentObjective(s)?.text).toBe("Open the Manager's Office!");
    // stand under the gold door and walk north
    s.player.pos = { x: 29.5, y: 10.6 };
    const ev = run(s, 3, () => ({ mx: 0, my: -1, dash: false }));
    expect(ev).toContain('unlock');
    expect(ev).toContain('win');
    expect(ev).not.toContain('bossIntro');
    expect(s.status).toBe('won');
    expect(s.boss).toBeNull();
  });

  it('after the gold door opens the goal is to get into the office', () => {
    const s = createGame('normal', { level: 2, noFamily: true });
    for (const c of ['green', 'orange', 'gold'] as const) { s.held.add(c); s.unlocked.add(c); }
    expect(currentObjective(s)?.text).toBe("Get into the Manager's Office!");
    expect(currentObjective(s)?.action).toBe('escape');
  });

  it('getting caught by staff puts the nugget back on the frozen food shelf', () => {
    const s = withOne('dan');
    const dan = s.chasers[0];
    dan.pos = { x: 26.5, y: 19.5 };
    dan.facing = 0; dan.lookBase = 0; dan.pause = 5;
    s.player.pos = { x: 29.0, y: 21.5 };
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
    const viewer = { pos: { x: 6.5, y: 14.5 }, facing: Math.PI, range: 6, fov: Math.PI };
    // the nugget is on the other side of the red shelf (x 3-4)
    expect(canSee(m, s.unlocked, viewer, { x: 2.5, y: 14.5 })).toBe(false);
    // but down the open aisle it is in plain sight
    expect(canSee(m, s.unlocked, { ...viewer, facing: Math.PI / 2 }, { x: 6.5, y: 18.5 })).toBe(true);
  });

  it('a nugget hiding under a fruit stand is not spotted', () => {
    const s = withOne('priya');
    const priya = s.chasers[0];
    priya.pos = { x: 12.5, y: 7.5 };
    priya.facing = 0; priya.lookBase = 0; priya.pause = 5;
    s.player.pos = { x: 15.5, y: 7.5 }; // under the green fruit stand
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
    s.player.pos = { x: 30.5, y: 4.5 }; // tucked away in the locked office
    s.player.hidden = true;
    for (let i = 0; i < 60 * 60; i++) {
      update(s, idle, DT);
      for (const c of s.chasers) {
        expect(s.maps[0].walkableForFamily(Math.floor(c.pos.x), Math.floor(c.pos.y), s.unlocked), `${c.def.name} at ${c.pos.x},${c.pos.y}`).toBe(true);
      }
    }
  });

  it('the autopilot finds all three keys and reaches the Manager\'s Office', () => {
    const s = createGame('normal', { level: 2, noFamily: true, seed: 1 });
    skipIntro(s);
    const ev = run(s, 120, botInput);
    expect(s.status).toBe('won');
    expect(ev.filter((e) => e === 'key')).toHaveLength(3);
    expect(ev.filter((e) => e === 'unlock')).toHaveLength(3);
    expect(s.maps[0].roomAt(s.player.pos.x, s.player.pos.y)?.id).toBe('office');
  });

  it.each(['easy', 'normal'] as Difficulty[])('the autopilot can beat the store with the staff around (%s)', (d) => {
    let wins = 0;
    for (const seed of [1, 2, 3, 4, 5]) {
      const s = createGame(d, { level: 2, seed });
      skipIntro(s);
      run(s, 240, botInput);
      if (s.status === 'won') wins++;
    }
    expect(wins).toBeGreaterThan(0);
  });
});
