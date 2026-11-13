import { describe, expect, it } from 'vitest';
import {
  createGame, update, currentObjective, canFeast, INTRO_TIME, MUD_SPEED, PLAYER_SPEED, PLAYER_RADIUS, FAMILY_RADIUS,
  type GameState, type Input,
} from '../../src/game/state';
import { botInput, solveHouse } from '../../src/game/bot';
import { canSee } from '../../src/game/vision';
import { FARM, LEVEL3, LEVELS } from '../../src/game/levels';
import { buildMaps } from '../../src/game/map';
import { busX, farmSky, FARM_LENGTH } from '../../src/render/farm';

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

/** Level 3 with only one chaser, placed by the test. */
function withOne(id: string) {
  const s = createGame('normal', { level: 3, seed: 1 });
  skipIntro(s);
  s.chasers = s.chasers.filter((c) => c.def.id === id);
  return s;
}

describe('level 3: the farm', () => {
  it('is a farmyard with a chicken pen, a cornfield, a barn, a tool shed, an orchard, a garden, a pumpkin patch and the country road', () => {
    expect(LEVELS[3]).toBe(LEVEL3);
    const [m] = buildMaps(FARM);
    expect(m.def.rooms.map((r) => r.name)).toEqual(['Chicken Pen', 'Cornfield', 'Big Red Barn', 'Tool Shed', 'Apple Orchard', 'Vegetable Garden', 'Pumpkin Patch', 'Country Road', 'Farmyard']);
    for (const k of m.def.keys) expect(m.walkableForPlayer(k.x, k.y, new Set()), `${k.color} key`).toBe(true);
    const all = new Set(LEVEL3.keyOrder);
    for (const f of m.def.family)
      for (const [x, y] of [f.start, ...f.waypoints])
        expect(m.walkableForFamily(x, y, all), `${f.name} at ${x},${y}`).toBe(true);
  });

  it('can be solved with eight keys: red (pen) -> orange (yard) -> teal (cornfield) -> green (barn) -> purple (shed) -> blue (orchard) -> pink (garden) -> gold (pumpkin patch) -> the road', () => {
    const r = solveHouse(FARM, LEVEL3.start);
    expect(r.escaped).toBe(true);
    expect(r.order).toEqual(['red', 'orange', 'teal', 'green', 'purple', 'blue', 'pink', 'gold']);
  });

  it('starts locked in the chicken pen with eight keys to find, chased by the farmer, two dogs and the farmhand', () => {
    const s = createGame('normal', { level: 3 });
    expect(s.level.id).toBe(3);
    expect(s.status).toBe('intro');
    expect(s.maps[0].roomAt(s.player.pos.x, s.player.pos.y)?.id).toBe('pen');
    expect(s.keys.map((k) => k.color)).toEqual(['red', 'orange', 'teal', 'green', 'purple', 'blue', 'pink', 'gold']);
    expect(s.chasers.map((c) => c.def.kind)).toEqual(['farmer', 'dog', 'farmhand', 'dog']);
    expect(currentObjective(s)?.text).toBe('Find the Red key');
    expect(currentObjective(s)?.hint).toContain('Chicken Pen');
    // no boss on the farm, no easter eggs either
    expect(s.noBoss).toBe(true);
    expect(canFeast(s)).toBe(false);
  });

  it('the red key opens the pen gate from the inside', () => {
    const s = createGame('normal', { level: 3, noFamily: true, seed: 1 });
    skipIntro(s);
    s.held.add('red');
    expect(currentObjective(s)?.text).toBe('Open the Red gate');
    expect(currentObjective(s)?.hint).toBe('The Red gate is the way out of the Chicken Pen.');
    s.player.pos = { x: 28.5, y: 10.4 };
    const ev = run(s, 1.5, () => ({ mx: 0, my: 1, dash: false }));
    expect(ev).toContain('unlock');
    expect(s.unlocked.has('red')).toBe(true);
    expect(s.maps[0].roomAt(s.player.pos.x, s.player.pos.y)?.id).toBe('yard');
  });

  it('mud slows the nugget down to half speed, with a squelch the first time', () => {
    const s = createGame('normal', { level: 3, noFamily: true, seed: 1 });
    skipIntro(s);
    s.unlocked.add('red');
    // the mud patch at 17..19, 23..24: walk east across it
    s.player.pos = { x: 15.5, y: 23.5 };
    const ev: string[] = [];
    let mudSteps = 0, mudDist = 0, dryDist = 0, drySteps = 0;
    for (let i = 0; i < 90; i++) {
      const x0 = s.player.pos.x;
      update(s, { mx: 1, my: 0, dash: false }, DT);
      ev.push(...s.events.map((e) => e.type));
      if (s.player.inMud) { mudSteps++; mudDist += s.player.pos.x - x0; } else { drySteps++; dryDist += s.player.pos.x - x0; }
    }
    expect(ev.filter((e) => e === 'mud')).toHaveLength(1);
    expect(mudSteps).toBeGreaterThan(10);
    expect(mudDist / mudSteps).toBeCloseTo(PLAYER_SPEED * MUD_SPEED * DT, 2);
    expect(dryDist / drySteps).toBeGreaterThan(PLAYER_SPEED * DT * 0.9);
  });

  it('the farmer catches the nugget from further away with his rake, and puts it back in the pen', () => {
    const s = withOne('farmer');
    s.unlocked.add('red');
    const f = s.chasers[0];
    expect(f.def.reach).toBeGreaterThan(0.3);
    f.pos = { x: 20.5, y: 18.5 };
    f.facing = 0; f.lookBase = 0; f.pause = 5;
    // a little further than an arm can reach, but inside the rake's reach
    s.player.pos = { x: 20.5 + PLAYER_RADIUS + FAMILY_RADIUS + 0.3, y: 18.5 };
    const ev = run(s, 2, () => idle);
    expect(ev).toContain('alert');
    expect(ev).toContain('caught');
    expect(s.caughtBy).toBe('The Farmer');
    run(s, 2.5, () => idle);
    expect(s.status).toBe('playing');
    expect(s.lives).toBe(2);
    expect(s.maps[0].roomAt(s.player.pos.x, s.player.pos.y)?.id).toBe('pen');
  });

  it('corn rows and haystacks block the farmer\'s view, fences too', () => {
    const [m] = buildMaps(FARM);
    const all = new Set(LEVEL3.keyOrder);
    // standing in the cross path of the cornfield, looking north up an aisle past a corn row
    expect(canSee(m, all, { pos: { x: 40, y: 29 }, facing: 0, range: 8, fov: Math.PI }, { x: 44, y: 25 })).toBe(false);
    expect(canSee(m, all, { pos: { x: 40, y: 29 }, facing: 0, range: 8, fov: Math.PI }, { x: 44, y: 29 })).toBe(true);
    // a haystack in the farmyard
    expect(canSee(m, all, { pos: { x: 12, y: 16 }, facing: 0, range: 8, fov: Math.PI }, { x: 17.5, y: 16 })).toBe(false);
  });

  it('each new gate opens with its key: purple orchard, blue garden, pink pumpkin patch', () => {
    const s = createGame('normal', { level: 3, noFamily: true, seed: 1 });
    skipIntro(s);
    const m = s.maps[0];
    for (const [color, room, x, y, dx, dy] of [
      ['purple', 'orchard', 8.5, 27.4, 0, 1],
      ['blue', 'garden', 39.5, 10.6, 0, -1],
      ['pink', 'patch', 25.5, 33.6, 0, -1],
    ] as const) {
      s.held.add(color);
      s.player.pos = { x, y };
      const ev = run(s, 1.5, () => ({ mx: dx, my: dy, dash: false }));
      expect(ev, color).toContain('unlock');
      expect(m.roomAt(s.player.pos.x, s.player.pos.y)?.id, color).toBe(room);
    }
  });

  it('the gold gate leads out to the country road, and stepping onto it wins (no boss)', () => {
    const s = createGame('normal', { level: 3, noFamily: true, seed: 1 });
    skipIntro(s);
    for (const c of LEVEL3.keyOrder) s.held.add(c);
    for (const c of ['red', 'orange', 'teal', 'green', 'purple', 'blue', 'pink'] as const) s.unlocked.add(c);
    expect(currentObjective(s)?.text).toBe('Open the Gold farm gate!');
    s.player.pos = { x: 28, y: 35.5 };
    const ev = run(s, 3, () => ({ mx: 0, my: 1, dash: false }));
    expect(ev).toContain('unlock');
    expect(ev).toContain('win');
    expect(ev).not.toContain('bossIntro');
    expect(s.status).toBe('won');
    expect(s.boss).toBeNull();
  });

  it('the robot player escapes the whole farm with nobody around', () => {
    for (const d of ['easy', 'normal', 'hard'] as const) {
      const s = createGame(d, { level: 3, noFamily: true, seed: 3 });
      run(s, 240, botInput);
      expect(s.status, d).toBe('won');
      expect(s.held.size).toBe(8);
    }
  });

  it('the bus cutscene: night in the city, morning at the farm', () => {
    expect(farmSky(0)).toBe(0);
    expect(farmSky(FARM_LENGTH)).toBe(1);
    expect(busX(7.9)).toBeLessThan(busX(13));
    expect(busX(14.2)).toBeGreaterThan(80);
  });
});
