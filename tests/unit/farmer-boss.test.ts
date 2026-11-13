import { describe, expect, it } from 'vitest';
import { createGame, update, currentObjective, type GameState, type Input } from '../../src/game/state';
import {
  beginBossFight, bossBotInput, bossDef, makeBoss, FARMER, GUS, MANAGER, ROAD_ARENA, TRACTOR_HP, RAKE_HP, TRACTOR_SPEED,
  BOOM_RADIUS, RAKE_REACH, WIGGLES, ARRIVE_TIME, BOOM_TIME,
} from '../../src/game/boss';
import type { Difficulty } from '../../src/game/types';

const DT = 1 / 60;
const idle: Input = { mx: 0, my: 0, dash: false };

/** Level 3, out on the country road with the Farmer: the fight has started. */
function onTheRoad(difficulty: Difficulty = 'normal', { skipArrive = true } = {}) {
  const s = createGame(difficulty, { level: 3, noFamily: true, seed: 1, skipIntro: true });
  for (const c of s.level.keyOrder) { s.held.add(c); s.unlocked.add(c); }
  s.status = 'bossIntro';
  s.boss = makeBoss(s);
  beginBossFight(s);
  s.player.invuln = 0;
  if (skipArrive) {
    s.boss.mode = 'drive';
    s.boss.pos = { ...FARMER.start };
    s.boss.timer = 99;
  }
  return s;
}

function fight(s: GameState, seconds: number, input: (s: GameState) => Input) {
  const events: string[] = [];
  for (let t = 0; t < seconds && s.status === 'boss'; t += DT) {
    update(s, input(s), DT);
    events.push(...s.events.map((e) => e.type));
  }
  return events;
}

/** Squirt straight at the Farmer from where the nugget stands. */
function squirtAt(s: GameState): Input {
  const b = s.boss!;
  s.player.facing = Math.atan2(b.pos.y - s.player.pos.y, b.pos.x - s.player.pos.x);
  return { mx: 0, my: 0, dash: false, fire: true };
}

describe('level 3 boss: the Farmer', () => {
  it('runs out of the farm gate into a boss fight with the Farmer on the country road', () => {
    expect(bossDef(createGame('normal', { level: 3 }))).toBe(FARMER);
    expect(bossDef(createGame('normal', { level: 2 }))).toBe(MANAGER);
    expect(bossDef(createGame('normal', { level: 1 }))).toBe(GUS);
    const s = createGame('normal', { level: 3, noFamily: true, seed: 1, skipIntro: true });
    for (const c of s.level.keyOrder) { s.held.add(c); s.unlocked.add(c); }
    s.status = 'playing';
    s.player.pos = { x: 28, y: 35.5 };
    for (let i = 0; i < 180 && s.status === 'playing'; i++) update(s, { mx: 0, my: 1, dash: false }, DT);
    expect(s.status).toBe('bossIntro');
    expect(s.boss!.hp).toBe(TRACTOR_HP.normal);
    expect(s.boss!.phase).toBe(1);
    beginBossFight(s);
    expect(s.status).toBe('boss');
    expect(s.player.pos).toEqual(FARMER.entry);
    expect(currentObjective(s)?.text).toBe('Squirt ketchup at the tractor!');
  });

  it('phase 1: the Farmer roars in on his tractor, which is fast', () => {
    const s = onTheRoad('normal', { skipArrive: false });
    expect(s.boss!.mode).toBe('arrive');
    expect(s.boss!.pos.x).toBeGreaterThan(ROAD_ARENA.x1);
    fight(s, ARRIVE_TIME + 0.05, () => idle);
    expect(s.boss!.mode).toBe('drive');
    expect(Math.hypot(s.boss!.pos.x - FARMER.start.x, s.boss!.pos.y - FARMER.start.y)).toBeLessThan(0.3);
    // drives after the nugget: much faster than Uncle Gus walks (1.25)
    s.player.pos = { x: 16, y: 47 };
    s.boss!.facing = Math.PI;
    s.boss!.timer = 99;
    const x0 = s.boss!.pos.x;
    fight(s, 1, () => idle);
    expect(TRACTOR_SPEED).toBeGreaterThan(2 * 1.25);
    expect(x0 - s.boss!.pos.x).toBeGreaterThan(2.4);
  });

  it('phase 1: the tractor revs up, CHARGES down the red lane and runs the nugget over', () => {
    const s = onTheRoad();
    s.player.pos = { x: 22, y: 47 };
    s.boss!.facing = Math.PI;
    s.boss!.timer = 0;
    const ev = fight(s, 3, () => idle);
    expect(ev).toContain('rev');
    expect(ev).toContain('charge');
    expect(ev).toContain('hurt');
    expect(s.lives).toBe(2);
  });

  it('phase 1: step out of the lane and the tractor crashes into the fence, dizzy', () => {
    const s = onTheRoad();
    s.player.pos = { x: 22, y: 47 };
    s.boss!.facing = Math.PI;
    s.boss!.timer = 0;
    // wait for the lane to lock, then step out sideways
    fight(s, 0.5, () => idle);
    expect(s.boss!.mode).toBe('chargeWindup');
    const ev = fight(s, 3, () => (s.boss!.mode === 'chargeWindup' || s.boss!.mode === 'charge' ? { mx: 0, my: -1, dash: false } : idle));
    expect(ev).toContain('crash');
    expect(ev).not.toContain('hurt');
    expect(s.boss!.pos.x).toBeLessThan(ROAD_ARENA.x0 + 1.1);
    // dizzy for a moment: the time to squirt
    const t = fight(s, 0.1, () => idle);
    expect(t).not.toContain('hurt');
    expect(s.boss!.mode).toBe('stunned');
  });

  it('wrecking the tractor: it smokes, then BLOWS UP, and the Farmer grabs his rake (phase 2)', () => {
    const s = onTheRoad();
    s.boss!.hp = 1;
    s.boss!.mode = 'stunned';
    s.boss!.timer = 5;
    s.ketchup = 8;
    s.player.pos = { x: 30, y: 47 };
    const ev = fight(s, 1, squirtAt);
    expect(ev).toContain('tractorSmoke');
    expect(s.boss!.mode).toBe('explode');
    expect(s.boss!.phase).toBe(1);
    // more ketchup does nothing now: it's done for. Run from the blast!
    const hp = s.boss!.hp;
    fight(s, 0.3, squirtAt);
    expect(s.boss!.hp).toBe(hp);
    s.player.pos = { x: s.boss!.pos.x - BOOM_RADIUS - 1, y: s.boss!.pos.y };
    const boom = fight(s, BOOM_TIME, () => idle);
    expect(boom).toContain('tractorBoom');
    expect(boom).not.toContain('hurt');
    expect(s.boss!.phase).toBe(2);
    expect(s.boss!.hp).toBe(RAKE_HP.normal);
    expect(s.boss!.maxHp).toBe(RAKE_HP.normal);
    expect(currentObjective(s)?.text).toBe('Squirt ketchup at the Farmer!');
  });

  it('the explosion hurts a nugget standing too close', () => {
    const s = onTheRoad();
    s.boss!.mode = 'explode';
    s.boss!.timer = 0.2;
    s.player.pos = { x: s.boss!.pos.x - 1.6, y: s.boss!.pos.y };
    const ev = fight(s, 0.5, () => idle);
    expect(ev).toContain('tractorBoom');
    expect(ev).toContain('hurt');
  });

  /** Phase 2, the Farmer about to swing his rake at a nugget 3.5 tiles to his west. */
  function rakeReady() {
    const s = onTheRoad();
    const b = s.boss!;
    b.phase = 2;
    b.hp = b.maxHp = RAKE_HP.normal;
    b.mode = 'walk';
    b.pos = { x: 30, y: 46 };
    b.facing = Math.PI;
    b.timer = 0;
    s.player.pos = { x: 26.5, y: 46 };
    return s;
  }

  it('phase 2: the rake hooks the nugget and the Farmer reels it in for a bite: the end of the level', () => {
    const s = rakeReady();
    expect(s.lives).toBe(3);
    const ev = fight(s, 6, () => idle);
    expect(ev).toContain('rakeSwipe');
    expect(ev).toContain('hooked');
    expect(ev).toContain('bite');
    expect(ev).toContain('gameover');
    expect(ev).not.toContain('hurt');
    // game over at once, however many lives were left
    expect(s.status).toBe('gameover');
    expect(s.bitten).toBe(true);
    expect(s.caughtBy).toBe('The Farmer');
  });

  it('phase 2: hooked, the nugget is pulled in and can\'t run away', () => {
    const s = rakeReady();
    fight(s, 2, () => (s.boss!.mode === 'pull' ? { mx: 1, my: 0, dash: false } : idle));
    expect(s.boss!.mode).toBe('pull');
    expect(s.player.pos.x).toBeGreaterThan(26.5);
  });

  for (const d of ['easy', 'normal', 'hard'] as const) {
    it(`phase 2: pressing DASH ${WIGGLES[d]} times wriggles off the rake (${d})`, () => {
      const s = rakeReady();
      s.difficulty = d;
      for (let i = 0; i < 600 && s.boss!.mode !== 'pull'; i++) update(s, idle, DT);
      fight(s, 0.3, () => idle);
      // (still being pulled in)
      expect(s.boss!.mode).toBe('pull');
      const ev: string[] = [];
      for (let i = 0; i < WIGGLES[d] - 1; i++) ev.push(...fight(s, DT, () => ({ mx: 0, my: 0, dash: true })), ...fight(s, DT, () => idle));
      expect(s.boss!.mode).toBe('pull');
      ev.push(...fight(s, DT, () => ({ mx: 0, my: 0, dash: true })));
      expect(ev).toContain('wriggleFree');
      expect(s.boss!.mode).toBe('stunned');
      expect(s.player.invuln).toBeGreaterThan(0);
      fight(s, 0.5, () => idle);
      expect(s.status).toBe('boss');
    });
  }

  it('phase 2: stepping out of the rake\'s line, or dashing through it, gets past the rake', () => {
    const side = rakeReady();
    const ev = fight(side, 1.6, () => (side.boss!.mode === 'rakeWindup' && side.boss!.timer < 0.4 ? { mx: 0, my: 1, dash: false } : idle));
    expect(ev).toContain('rakeSwipe');
    expect(ev).not.toContain('hooked');
    expect(side.boss!.mode).toBe('walk');

    const dash = rakeReady();
    // facing the Farmer, a dash goes straight along the rake, right as it reaches out
    dash.player.facing = 0;
    const ev2 = fight(dash, 1.6, () => (dash.boss!.mode === 'rake' && dash.boss!.rake > 1.8 ? { mx: 0, my: 0, dash: true } : idle));
    expect(ev2).toContain('dodgeRake');
    expect(ev2).not.toContain('hooked');
  });

  it('the rake reaches further than an arm, but not across the whole road', () => {
    expect(RAKE_REACH).toBeGreaterThan(3);
    const s = rakeReady();
    s.player.pos = { x: 30 - RAKE_REACH * 1.12 - 1.2, y: 46 };
    const ev = fight(s, 1.6, () => idle);
    expect(ev).toContain('rakeSwipe');
    expect(ev).not.toContain('hooked');
  });

  it('beating the Farmer on foot wins the level', () => {
    const s = rakeReady();
    s.boss!.hp = 1;
    s.boss!.mode = 'stunned';
    s.boss!.timer = 5;
    s.ketchup = 8;
    const ev = fight(s, 6, squirtAt);
    expect(ev).toContain('bossDown');
    expect(ev).toContain('win');
    expect(s.status).toBe('won');
  });

  for (const d of ['easy', 'normal', 'hard'] as const) {
    it(`the autopilot beats the Farmer on ${d}`, () => {
      const s = onTheRoad(d, { skipArrive: false });
      const ev = fight(s, 200, bossBotInput);
      expect(ev).toContain('tractorBoom');
      expect(ev).toContain('bossDown');
      expect(s.status).toBe('won');
    });
  }
});
