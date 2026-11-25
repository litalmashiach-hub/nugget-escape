import { describe, expect, it } from 'vitest';
import {
  createGame, update, currentObjective, canFeast, INTRO_TIME, ALARM_RANGE, ALARM_COOLDOWN,
  type GameState, type Input,
} from '../../src/game/state';
import { botInput, solveHouse } from '../../src/game/bot';
import { canSee } from '../../src/game/vision';
import { LAB, LEVEL4, LEVELS } from '../../src/game/levels';
import { buildMaps } from '../../src/game/map';
import { laserOn, laserWarning, type Laser } from '../../src/game/types';
import { LAB_LENGTH, LAB_CAPTIONS, labNuggetX, NEWSPAPER } from '../../src/render/labtrip';

const DT = 1 / 60;
const idle: Input = { mx: 0, my: 0, dash: false };

function skipIntro(s: GameState) {
  for (let t = 0; t <= INTRO_TIME + DT; t += DT) update(s, idle, DT);
  expect(s.status).toBe('playing');
}

function run(s: GameState, seconds: number, input: (s: GameState) => Input) {
  const events: string[] = [];
  for (let t = 0; t < seconds && s.status !== 'won' && s.status !== 'gameover'; t += DT) {
    update(s, input(s), DT);
    events.push(...s.events.map((e) => e.type));
  }
  return events;
}

/** The laser curtain across the lobby. */
const CURTAIN = LAB[1].lasers!.find((l) => l.x === 30 && l.h === 17)!;

/** The moment a laser has just switched on (or off). */
function justSwitched(l: Laser, on: boolean) {
  for (let t = 0.05; t < 60; t += 0.01) if (laserOn(l, t) === on && laserOn(l, t - 0.02) !== on) return t + 0.01;
  throw new Error('no such moment');
}

describe('level 4: the laboratory', () => {
  it('has a ground floor with four labs and a top secret basement with the Secret Archive', () => {
    expect(LEVELS[4]).toBe(LEVEL4);
    const maps = buildMaps(LAB);
    expect(maps.map((m) => m.def.id)).toEqual([0, 1]);
    expect(maps[1].def.rooms.map((r) => r.name)).toEqual(['Chemistry Lab', 'Robotics Lab', 'Server Room', 'Staff Stairwell', 'Lobby']);
    expect(maps[0].def.rooms.map((r) => r.name)).toEqual(['Specimen Room', 'Secret Archive', 'Basement Hall']);
    const all = new Set(LEVEL4.keyOrder);
    for (const m of maps) {
      for (const k of m.def.keys) expect(m.walkableForPlayer(k.x, k.y, new Set()), `${k.color} key`).toBe(true);
      for (const f of m.def.family)
        for (const [x, y] of [f.start, ...f.waypoints])
          expect(m.walkableForFamily(x, y, all), `${f.name} at ${x},${y}`).toBe(true);
      // every room was flood-filled from its seed
      for (const r of m.def.rooms) expect(m.roomAt(r.seed[0] + 0.5, r.seed[1] + 0.5)?.id, r.name).toBe(r.id);
    }
  });

  it('can be solved with six keys: red -> teal -> orange -> purple, down the stairs, blue -> gold -> the Secret Archive', () => {
    const r = solveHouse(LAB, LEVEL4.start);
    expect(r.escaped).toBe(true);
    expect(r.order).toEqual(['red', 'teal', 'orange', 'purple', 'blue', 'gold']);
  });

  it('starts in the lobby on the ground floor, chased by scientists and security guards, with no boss', () => {
    const s = createGame('normal', { level: 4 });
    expect(s.level.id).toBe(4);
    expect(s.player.floor).toBe(1);
    expect(s.maps[1].roomAt(s.player.pos.x, s.player.pos.y)?.id).toBe('lobby');
    expect(s.chasers.map((c) => c.def.kind).sort()).toEqual(['guard', 'guard', 'scientist', 'scientist', 'scientist', 'scientist', 'scientist', 'scientist']);
    expect(currentObjective(s)?.text).toBe('Find the Red key');
    expect(currentObjective(s)?.hint).toContain('Lobby');
    expect(s.noBoss).toBe(true);
    expect(canFeast(s)).toBe(false);
  });

  it('every key is fenced in by blinking laser beams', () => {
    const maps = buildMaps(LAB);
    for (const m of maps)
      for (const k of m.def.keys) {
        // the four tiles around the fence: at least one way in crosses a beam
        let crossings = 0;
        for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 0], [0, 3]])
          if (m.laserAt(k.x + Math.sign(dx), k.y + Math.sign(dy)) || m.laserAt(k.x + dx, k.y + dy)) crossings++;
        expect(crossings, `${k.color} key`).toBeGreaterThan(0);
      }
    // beams blink: on for part of the time, with a warning flicker just before they switch back on
    const l = LAB[1].lasers![0];
    expect(laserOn(l, 0)).toBe(true);
    expect(laserOn(l, l.on + 0.01)).toBe(false);
    expect(laserWarning(l, l.period - 0.1)).toBeGreaterThan(0.5);
    expect(laserWarning(l, 0.1)).toBe(0);
  });

  it('walking into a beam while it is on sets off the alarm, and everyone close by comes running', () => {
    const s = createGame('normal', { level: 4, seed: 1 });
    skipIntro(s);
    s.chasers = s.chasers.filter((c) => c.def.id === 'bolt' || c.def.id === 'beaker');
    const bolt = s.chasers.find((c) => c.def.id === 'bolt')!;
    bolt.pos = { x: 18.5, y: 20.5 };
    // the laser curtain across the lobby at x = 30
    s.time = justSwitched(CURTAIN, true);
    s.player.pos = { x: 29.4, y: 24.5 };
    const ev: string[] = [];
    for (let i = 0; i < 20; i++) {
      update(s, { mx: 1, my: 0, dash: false }, DT);
      ev.push(...s.events.map((e) => e.type));
    }
    expect(ev.filter((e) => e === 'alarm')).toHaveLength(1);
    expect(s.alarms).toBe(1);
    expect(Math.hypot(bolt.pos.x - 29.4, bolt.pos.y - 24.5)).toBeLessThan(ALARM_RANGE);
    expect(bolt.mode).toBe('chase');
    // Dr. Beaker is far away in the Chemistry Lab: he doesn't hear it
    const beaker = s.chasers.find((c) => c.def.id === 'beaker')!;
    expect(beaker.mode).toBe('patrol');
    // no second alarm straight away
    expect(s.alarmCd).toBeGreaterThan(ALARM_COOLDOWN - 0.5);
  });

  it('a beam that is switched off is safe to walk through', () => {
    const s = createGame('normal', { level: 4, noFamily: true, seed: 1 });
    skipIntro(s);
    s.time = justSwitched(CURTAIN, false);
    s.player.pos = { x: 29.4, y: 24.5 };
    const ev = run(s, 0.4, () => ({ mx: 1, my: 0, dash: false }));
    expect(s.player.pos.x).toBeGreaterThan(30.2);
    expect(ev).not.toContain('alarm');
  });

  it('server racks and specimen tanks block the view', () => {
    const [b, g] = buildMaps(LAB);
    const all = new Set(LEVEL4.keyOrder);
    // across the server room, between two racks
    expect(canSee(g, all, { pos: { x: 30.5, y: 4.5 }, facing: 0, range: 9, fov: Math.PI }, { x: 35.5, y: 4.5 })).toBe(false);
    expect(canSee(g, all, { pos: { x: 32.5, y: 4.5 }, facing: 0, range: 9, fov: Math.PI }, { x: 33.5, y: 4.5 })).toBe(true);
    // a specimen tank in the lobby
    expect(canSee(g, all, { pos: { x: 10.5, y: 13.5 }, facing: 0, range: 9, fov: Math.PI }, { x: 15.5, y: 13.8 })).toBe(false);
    // a tank in the basement Specimen Room
    expect(canSee(b, all, { pos: { x: 1.5, y: 2.5 }, facing: 0, range: 9, fov: Math.PI }, { x: 6.5, y: 2.5 })).toBe(false);
  });

  it('the purple door opens the stairwell, and the stairs lead down to the basement', () => {
    const s = createGame('normal', { level: 4, noFamily: true, seed: 1 });
    skipIntro(s);
    s.time = justSwitched(CURTAIN, false);
    s.held.add('purple');
    for (const c of ['red', 'teal', 'orange'] as const) { s.held.add(c); s.unlocked.add(c); }
    expect(currentObjective(s)?.text).toBe('Open the Purple door');
    s.player.pos = { x: 32.4, y: 22.5 };
    const ev = run(s, 2.4, () => ({ mx: 1, my: 0.25, dash: false }));
    expect(ev).toContain('unlock');
    expect(ev).toContain('floor');
    expect(s.player.floor).toBe(0);
    expect(s.maps[0].roomAt(s.player.pos.x, s.player.pos.y)?.id).toBe('bhall');
  });

  it('walking into the Secret Archive wins the level', () => {
    const s = createGame('normal', { level: 4, noFamily: true, seed: 1 });
    skipIntro(s);
    for (const c of LEVEL4.keyOrder) { s.held.add(c); s.unlocked.add(c); }
    expect(currentObjective(s)?.text).toBe('Get into the Secret Archive!');
    s.player.floor = 0;
    s.player.pos = { x: 26.5, y: 11.2 };
    const ev = run(s, 2, () => ({ mx: 0, my: -1, dash: false }));
    expect(ev).toContain('win');
    expect(ev).not.toContain('bossIntro');
    expect(s.status).toBe('won');
  });

  it('the robot player sneaks all the way to the Secret Archive with nobody around', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const s = createGame(d, { level: 4, noFamily: true, seed: 3 });
      run(s, 240, botInput);
      expect(s.status, d).toBe('won');
      expect(s.held.size).toBe(6);
    }
  }, 20_000);

  it('the autopilot (which never hides or waits for the lasers) can still beat the lab on Easy with everyone around', () => {
    for (const seed of [1, 2, 3]) {
      const s = createGame('easy', { level: 4, seed });
      run(s, 300, botInput);
      expect(s.status, `seed ${seed}`).toBe('won');
      expect(s.alarms).toBeGreaterThan(0);
    }
  }, 20_000);

  it('the cutscene: the farmer remembers, a walk through town, the newspaper on the tree', () => {
    const farmer = LAB_CAPTIONS.filter((c) => c.who === 'The Farmer').map((c) => c.text).join(' ');
    expect(farmer).toBe('Hey, I remember you! You are the chicken that was taken to the laboratory for some secret testing. How are you still alive?! Did their experiment work?!');
    expect(LAB_CAPTIONS.some((c) => /newspaper/i.test(c.text))).toBe(true);
    expect(NEWSPAPER.address).toMatch(/Beaker Lane/);
    // walks into town, stops at the tree, then heads to the lab
    expect(labNuggetX(LAB_LENGTH * 0.25)).toBeLessThan(labNuggetX(LAB_LENGTH * 0.55));
    expect(labNuggetX(LAB_LENGTH * 0.55)).toBeLessThan(labNuggetX(LAB_LENGTH));
  });
});
