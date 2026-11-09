import { describe, expect, it } from 'vitest';
import { createGame, update, type GameState, type Input } from '../../src/game/state';
import { beginBossFight, bossBotInput, ARENA, BOSS_HP, ENTRY, SLAM_RADIUS, BOTTLE_EVERY, BOTTLE_SIZE } from '../../src/game/boss';
import { botInput } from '../../src/game/bot';
import type { Difficulty } from '../../src/game/types';

const DT = 1 / 60;
const idle: Input = { mx: 0, my: 0, dash: false };

/** A game standing in the open front doorway, all keys used. */
function atFrontDoor(difficulty: Difficulty = 'normal', seed = 1) {
  const s = createGame(difficulty, { noFamily: true, skipIntro: true, seed });
  for (const c of ['red', 'teal', 'orange', 'green', 'purple', 'blue', 'pink', 'gold'] as const) {
    s.held.add(c);
    s.unlocked.add(c);
  }
  s.player.pos = { x: 15, y: 20.6 };
  return s;
}

function walkOut(s: GameState) {
  for (let i = 0; i < 120 && s.status === 'playing'; i++) update(s, { mx: 0, my: 1, dash: false }, DT);
}

function fight(s: GameState, seconds: number, input: (s: GameState) => Input) {
  const events: string[] = [];
  for (let t = 0; t < seconds && s.status === 'boss'; t += DT) {
    update(s, input(s), DT);
    events.push(...s.events.map((e) => e.type));
  }
  return events;
}

describe('the boss fight at the front door', () => {
  it('stepping out of the front door starts the boss cutscene instead of winning', () => {
    const s = atFrontDoor();
    walkOut(s);
    expect(s.status).toBe('bossIntro');
    expect(s.boss).not.toBeNull();
    expect(s.boss!.hp).toBe(BOSS_HP.normal);
    // the game waits for the cutscene
    const t = s.time;
    update(s, idle, DT);
    expect(s.time).toBe(t);
    beginBossFight(s);
    expect(s.status).toBe('boss');
    expect(s.player.pos).toEqual(ENTRY);
  });

  it('can be turned off: the front door wins straight away', () => {
    const s = createGame('normal', { noFamily: true, skipIntro: true, noBoss: true });
    for (const c of ['gold'] as const) { s.held.add(c); s.unlocked.add(c); }
    s.player.pos = { x: 15, y: 20.6 };
    walkOut(s);
    expect(s.status).toBe('won');
  });

  it('ketchup squirted at Uncle Gus hurts him', () => {
    const s = atFrontDoor();
    walkOut(s);
    beginBossFight(s);
    const ev = fight(s, 1.0, () => ({ mx: 0, my: 0, dash: false, fire: true }));
    expect(ev).toContain('squirt');
    expect(ev).toContain('bossHit');
    expect(s.boss!.hp).toBeLessThan(BOSS_HP.normal);
  });

  it('ketchup only goes where the nugget is facing', () => {
    const s = atFrontDoor();
    walkOut(s);
    beginBossFight(s);
    s.player.facing = -Math.PI / 2; // facing back at the house, away from Gus
    const ev = fight(s, 1.0, () => ({ mx: 0, my: 0, dash: false, fire: true }));
    expect(ev).toContain('squirt');
    expect(ev).not.toContain('bossHit');
    expect(s.boss!.hp).toBe(BOSS_HP.normal);
  });

  it('an empty bottle does not refill by itself: a new bottle appears every 5 seconds, grab it to refill', () => {
    const s = atFrontDoor();
    walkOut(s);
    beginBossFight(s);
    s.ketchup = 0;
    s.boss!.timer = 999; // keep Gus calm for this test
    s.player.invuln = 999;
    let ev = fight(s, BOTTLE_EVERY - 0.2, () => idle);
    expect(s.ketchup).toBe(0);
    expect(ev).not.toContain('bottle');
    ev = fight(s, 0.4, () => idle);
    expect(ev).toContain('bottle');
    expect(s.bottles).toHaveLength(1);
    fight(s, BOTTLE_EVERY, () => idle);
    expect(s.bottles).toHaveLength(2);
    // walk over to the first bottle
    const b = s.bottles[0].pos;
    s.player.pos = { x: b.x - 0.3, y: b.y };
    ev = fight(s, 0.2, () => ({ mx: 1, my: 0, dash: false }));
    expect(ev).toContain('refill');
    expect(s.ketchup).toBe(BOTTLE_SIZE);
    expect(s.bottles).toHaveLength(0);
  });

  it('standing still gets the nugget hit and costs lives', () => {
    const s = atFrontDoor('normal');
    walkOut(s);
    beginBossFight(s);
    const ev = fight(s, 40, () => idle);
    expect(ev).toContain('hurt');
    expect(s.status).toBe('gameover');
    expect(s.caughtBy).toBe('Uncle Gus');
  });

  it('a belly slam hurts only inside its ring', () => {
    const s = atFrontDoor();
    walkOut(s);
    beginBossFight(s);
    const b = s.boss!;
    b.mode = 'jump';
    b.timer = 0.001;
    b.jumpFrom = { ...b.pos };
    b.target = { x: s.player.pos.x + SLAM_RADIUS + 1, y: s.player.pos.y + 2 };
    s.player.invuln = 0;
    update(s, idle, DT);
    expect(s.lives).toBe(3);
    b.mode = 'jump';
    b.timer = 0.001;
    b.target = { x: s.player.pos.x + 0.5, y: s.player.pos.y + 0.5 };
    update(s, idle, DT);
    expect(s.lives).toBe(2);
  });

  it('the nugget and Gus stay inside the fenced garden', () => {
    const s = atFrontDoor();
    walkOut(s);
    beginBossFight(s);
    fight(s, 3, () => ({ mx: -1, my: -1, dash: true }));
    expect(s.player.pos.x).toBeGreaterThanOrEqual(ARENA.x0);
    expect(s.player.pos.y).toBeGreaterThanOrEqual(ARENA.y0);
  });

  for (const d of ['easy', 'normal', 'hard'] as const) {
    it(`the autopilot beats Uncle Gus on ${d}`, () => {
      const s = atFrontDoor(d);
      walkOut(s);
      beginBossFight(s);
      const ev = fight(s, 120, bossBotInput);
      for (let i = 0; i < 400 && s.status === 'boss'; i++) update(s, idle, DT);
      expect(ev).toContain('bossDown');
      expect(s.status).toBe('won');
    });
  }

  it('the full autopilot (house + boss) uses the same entry point', () => {
    const s = atFrontDoor();
    walkOut(s);
    beginBossFight(s);
    expect(botInput(s)).toEqual(bossBotInput(s));
  });
});
