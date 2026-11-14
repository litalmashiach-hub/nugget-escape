import { describe, expect, it } from 'vitest';
import { createGame, update, startFeast, canFeast, INTRO_TIME, type GameState, type Input } from '../../src/game/state';
import { SECRETS, secretsFor, STOCKROOM_AREA, FEAST_TIME, FEAST_RECHARGE } from '../../src/game/secrets';
import { STORE, LEVELS } from '../../src/game/levels';

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
      const floors = LEVELS[sd.level].floors;
      expect(sd.rects.length, sd.id).toBeGreaterThan(0);
      for (const rect of sd.rects) {
        const f = floors[sd.floor].furniture.find((f) => sd.furniture.includes(f.kind) && f.x === rect.x && f.y === rect.y);
        expect(f, sd.id).toBeDefined();
        expect({ w: f!.w, h: f!.h }).toEqual({ w: rect.w, h: rect.h });
      }
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
    const s = createGame('normal', { skipIntro: true, seed: 1 });
    for (const sd of secretsFor(1)) s.secrets.add(sd.id);
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

describe('level 2 easter eggs: Employee of the Month', () => {
  function store(x: number, y: number, family = false) {
    const s = createGame('normal', { level: 2, noFamily: !family, skipIntro: true, seed: 1 });
    for (const k of ['green', 'orange', 'purple'] as const) s.unlocked.add(k);
    s.player.pos = { x, y };
    return s;
  }
  const up: Input = { mx: 0, my: -1, dash: false };
  const left: Input = { mx: -1, my: 0, dash: false };

  it('the store has three: a cart, a box of grapes and a box', () => {
    expect(secretsFor(2).map((s) => s.id)).toEqual(['cart', 'grapes', 'crate']);
    expect(secretsFor(1)).toHaveLength(5);
    // every checkout and every aisle shelf counts, and only the Stockroom's boxes and racks
    expect(secretsFor(2)[0].rects).toHaveLength(STORE[0].furniture.filter((f) => f.kind === 'checkout').length);
    expect(secretsFor(2)[1].rects).toHaveLength(STORE[0].furniture.filter((f) => f.kind === 'shelf').length);
    const crate = secretsFor(2)[2].rects;
    expect(crate.length).toBe(4);
    for (const r of crate) expect(r.x >= STOCKROOM_AREA.x && r.x + r.w <= STOCKROOM_AREA.x + STOCKROOM_AREA.w && r.y + r.h <= 10).toBe(true);
  });

  it('talking to a checkout register gives a grocery cart', () => {
    const s = store(7, 45.5);
    expect(walk(s, up, 1.5)).toEqual(['cart']);
  });

  it('touching any shelf in the aisles gives a box of grapes', () => {
    expect(walk(store(7.5, 20.5), left, 1.5)).toEqual(['grapes']);
    expect(walk(store(51, 34.5), { mx: 1, my: 0, dash: false }, 1.5)).toEqual(['grapes']);
  });

  it('touching the boxes in the Stockroom gives a box (but boxes in other rooms do not)', () => {
    expect(walk(store(23, 7.5), up, 1.5)).toEqual(['crate']);
    expect(walk(store(10, 6.5), up, 1.5)).toEqual([]); // Cold Room boxes
  });

  it('the house easter eggs are not in the store, and the store has no nugget rain', () => {
    const s = store(7, 45.5);
    for (const sd of secretsFor(2)) s.secrets.add(sd.id);
    expect(canFeast(s)).toBe(false);
    expect(startFeast(s)).toBe(false);
  });

  it('finding all three makes every employee Employee of the Month, too happy to chase', () => {
    const s = store(7.5, 20.5, true);
    s.secrets.add('cart');
    s.secrets.add('crate');
    const kevin = s.chasers.find((c) => c.def.id === 'kevin')!;
    kevin.mode = 'chase';
    kevin.lastSeen = { ...s.player.pos };
    const seen: string[] = [];
    for (let t = 0; t < 1.5; t += DT) { update(s, left, DT); seen.push(...s.events.map((e) => e.type)); }
    expect(seen).toContain('employeeOfMonth');
    expect(s.happy).toBe(true);
    expect(s.chasers.some((c) => c.mode === 'chase' || c.mode === 'alert')).toBe(false);
    // Kevin stands right in front of the nugget, looking at it, and does not care.
    kevin.pos = { x: s.player.pos.x + 0.9, y: s.player.pos.y };
    kevin.facing = Math.PI;
    const later: string[] = [];
    for (let t = 0; t < 20; t += DT) { update(s, { mx: 0, my: 0, dash: false }, DT); later.push(...s.events.map((e) => e.type)); }
    expect(later).not.toContain('alert');
    expect(later).not.toContain('caught');
    expect(s.lives).toBe(3);
  });

  it('staff still chase before all three are found', () => {
    const s = store(7.5, 20.5, true);
    expect(s.happy).toBe(false);
    for (const lv of [1, 3] as const) expect(LEVELS[lv].secrets).not.toBe('employee');
  });
});
