import { describe, expect, it } from 'vitest';
import { createGame, update, startFeast, canFeast, INTRO_TIME, type GameState, type Input } from '../../src/game/state';
import { SECRETS, FEAST_TIME, FEAST_RECHARGE } from '../../src/game/secrets';
import { FLOORS } from '../../src/game/levels';

const DT = 1 / 60;

function ready(floor = 0, x: number, y: number) {
  const s = createGame('normal', { noFamily: true, skipIntro: true });
  for (const k of ['red', 'teal', 'orange', 'green', 'purple', 'blue', 'pink'] as const) s.unlocked.add(k);
  s.player.floor = floor;
  s.player.pos = { x, y };
  return s;
}

function walk(s: GameState, input: Input, seconds: number) {
  const found: string[] = [];
  for (let t = 0; t < seconds; t += DT) {
    update(s, input, DT);
    for (const e of s.events) if (e.type === 'secret') found.push(e.id);
  }
  return found;
}

describe('easter eggs', () => {
  it('each one sits on the furniture it is named after', () => {
    for (const sd of SECRETS) {
      const f = FLOORS[sd.floor].furniture.find((f) => f.kind === sd.furniture && f.x === sd.rect.x && f.y === sd.rect.y);
      expect(f, sd.id).toBeDefined();
      expect({ w: f!.w, h: f!.h }).toEqual({ w: sd.rect.w, h: sd.rect.h });
    }
  });

  it('walking up to the kitchen fridge finds an egg', () => {
    const s = ready(0, 10.5, 4.5);
    expect(walk(s, { mx: 0, my: -1, dash: false }, 1.5)).toEqual(['egg']);
    expect(s.secrets.has('egg')).toBe(true);
  });

  it('the living room bookshelf (where Biscuit lives) has a book', () => {
    const s = ready(0, 27.5, 11.5);
    expect(walk(s, { mx: 1, my: 0, dash: false }, 1.5)).toEqual(['book']);
  });

  it('touching the bathtub finds a rubber duck', () => {
    const s = ready(1, 11.5, 5.5);
    expect(walk(s, { mx: 0, my: -1, dash: false }, 1.5)).toEqual(['duck']);
  });

  it('the attic storage room (behind the purple door) has a box', () => {
    const s = ready(2, 3.5, 5.5);
    expect(walk(s, { mx: 0, my: -1, dash: false }, 2)).toEqual(['box']);
  });

  it("Grandma's dentures are in the corner of her bedroom", () => {
    const s = ready(1, 29.5, 4.5);
    expect(walk(s, { mx: 0, my: -1, dash: false }, 2)).toEqual(['dentures']);
  });

  it('each one is found only once, and not from across the room', () => {
    const s = ready(0, 10.5, 6.5);
    expect(walk(s, { mx: 0, my: 0, dash: false }, 0.5)).toEqual([]);
    walk(s, { mx: 0, my: -1, dash: false }, 1.5);
    expect(walk(s, { mx: 0, my: -1, dash: false }, 1.5)).toEqual([]);
    expect(s.secrets.size).toBe(1);
  });

  it('a new game starts with none found', () => {
    const s = createGame();
    for (let t = 0; t <= INTRO_TIME; t += DT) update(s, { mx: 0, my: 0, dash: false }, DT);
    expect(s.secrets.size).toBe(0);
  });
});

describe('nugget rain (all easter eggs found)', () => {
  const allFound = () => {
    const s = createGame('normal', { skipIntro: true });
    for (const sd of SECRETS) s.secrets.add(sd.id);
    return s;
  };
  const idle: Input = { mx: 0, my: 0, dash: false };

  it('is locked until every easter egg is found', () => {
    const s = createGame('normal', { skipIntro: true });
    s.secrets.add('egg');
    expect(canFeast(s)).toBe(false);
    expect(startFeast(s)).toBe(false);
    expect(s.food).toHaveLength(0);
  });

  it('rains nuggets on every floor and the family stops chasing to eat them', () => {
    const s = allFound();
    const dad = s.chasers.find((c) => c.def.id === 'dad')!;
    dad.mode = 'chase';
    dad.lastSeen = { ...s.player.pos };
    expect(startFeast(s)).toBe(true);
    expect(s.events.map((e) => e.type)).toContain('feast');
    expect(new Set(s.food.map((f) => f.floor))).toEqual(new Set([0, 1, 2]));
    expect(s.chasers.every((c) => c.mode === 'feast')).toBe(true);
    // Dad stands right next to the nugget and still does not catch it.
    dad.pos = { x: s.player.pos.x + 0.5, y: s.player.pos.y };
    const seen: string[] = [];
    for (let t = 0; t < FEAST_TIME - 0.5; t += DT) {
      update(s, idle, DT);
      seen.push(...s.events.map((e) => (e.type === 'chomp' ? `chomp:${e.id}` : e.type)));
    }
    expect(seen).not.toContain('caught');
    expect(seen).not.toContain('alert');
    for (const who of ['dad', 'mom', 'dog', 'sister', 'grandma', 'brother']) expect(seen, who).toContain(`chomp:${who}`);
  });

  it('wears off after a while, then needs to recharge', () => {
    const s = allFound();
    startFeast(s);
    const seen: string[] = [];
    for (let t = 0; t < FEAST_TIME + 0.2; t += DT) { update(s, idle, DT); seen.push(...s.events.map((e) => e.type)); }
    expect(seen).toContain('feastEnd');
    expect(s.chasers.some((c) => c.mode === 'feast')).toBe(false);
    expect(startFeast(s)).toBe(false);
    for (let t = 0; t < FEAST_RECHARGE; t += DT) update(s, idle, DT);
    if (s.status === 'playing') expect(canFeast(s)).toBe(true);
  });
});
