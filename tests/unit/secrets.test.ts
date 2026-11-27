import { describe, expect, it } from 'vitest';
import { createGame, update, startFeast, canFeast, INTRO_TIME, DASH_COOLDOWN, type GameState, type Input } from '../../src/game/state';
import { SECRETS, secretsFor, STOCKROOM_AREA, FEAST_TIME, FEAST_RECHARGE, MUD_DASHES } from '../../src/game/secrets';
import { STORE, FARM, LEVELS } from '../../src/game/levels';

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
      if (sd.mudDashes) {
        // found by dashing in the mud: it twinkles over every mud puddle
        expect(sd.rects).toEqual((floors[sd.floor].mud ?? []).map(([x, y, w, h]) => ({ x, y, w, h })));
        continue;
      }
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

describe('level 3 easter eggs: the animal stampede', () => {
  function farm(x: number, y: number, family = false) {
    const s = createGame('normal', { level: 3, noFamily: !family, skipIntro: true, seed: 1 });
    for (const k of ['red', 'orange', 'teal', 'green', 'purple', 'blue', 'pink'] as const) s.unlocked.add(k);
    s.player.pos = { x, y };
    return s;
  }
  const up: Input = { mx: 0, my: -1, dash: false };
  const down: Input = { mx: 0, my: 1, dash: false };
  const still: Input = { mx: 0, my: 0, dash: false };
  /** Dash once to the right from (x, y), then wait for the dash to recharge. */
  function dashFrom(s: GameState, x: number, y: number) {
    s.player.pos = { x, y };
    const found = walk(s, { mx: 1, my: 0, dash: true }, DT);
    return [...found, ...walk(s, still, DASH_COOLDOWN + 0.1)];
  }

  it('the farm has four: a crow, chocolate milk, a chick and a piggy', () => {
    expect(secretsFor(3).map((s) => s.id)).toEqual(['crow', 'milk', 'chick', 'piggy']);
    expect(LEVELS[3].secrets).toBe('stampede');
    // only one scarecrow, one cow and one crate out of several are special
    const count = (k: string) => FARM[0].furniture.filter((f) => f.kind === k).length;
    expect(count('scarecrow')).toBeGreaterThan(1);
    expect(count('cow')).toBeGreaterThan(1);
    expect(count('boxes')).toBeGreaterThan(1);
    for (const id of ['crow', 'milk', 'chick'] as const) expect(secretsFor(3).find((s) => s.id === id)!.rects).toHaveLength(1);
  });

  it('the scarecrow in the Cornfield has a crow in its hat (the other scarecrows do not)', () => {
    expect(walk(farm(52.5, 27.6), up, 1.5)).toEqual(['crow']);
    expect(walk(farm(40.5, 4.6), up, 1.5)).toEqual([]); // Vegetable Garden scarecrow
    expect(walk(farm(25.5, 30.6), up, 1.5)).toEqual([]); // Pumpkin Patch scarecrow
  });

  it('the brown cow in the barn gives chocolate milk (the other cows do not)', () => {
    expect(walk(farm(16, 12.6), up, 1.5)).toEqual(['milk']);
    expect(walk(farm(3, 12.6), up, 1.5)).toEqual([]);
    expect(walk(farm(47, 15.6), up, 1.5)).toEqual([]); // the cow out in the farmyard
  });

  it('the middle crate in the Tool Shed has a baby chick (the crates next to it do not)', () => {
    expect(walk(farm(53.5, 6.6), down, 1.5)).toEqual(['chick']);
    expect(walk(farm(52.4, 6.6), down, 1.5)).toEqual([]);
  });

  it(`dashing in the mud ${MUD_DASHES} times finds a muddy piggy`, () => {
    const s = farm(18.5, 23.5);
    const seen: number[] = [];
    let found: string[] = [];
    for (let i = 0; i < MUD_DASHES; i++) {
      s.player.pos = { x: 18.5, y: 23.5 };
      for (let t = 0; t < DT * 1.5; t += DT) {
        update(s, { mx: 1, my: 0, dash: true }, DT);
        for (const e of s.events) {
          if (e.type === 'mudDash') seen.push(e.count);
          if (e.type === 'secret') found.push(e.id);
        }
      }
      if (i < MUD_DASHES - 1) expect(found).toEqual([]);
      found = [...found, ...walk(s, still, DASH_COOLDOWN + 0.1)];
    }
    expect(seen).toEqual([1, 2, 3]);
    expect(found).toEqual(['piggy']);
    expect(s.secrets.has('piggy')).toBe(true);
  });

  it('dashing on dry ground does not count, and walking through mud is not enough', () => {
    const s = farm(30.5, 16.5);
    for (let i = 0; i < 4; i++) expect(dashFrom(s, 30.5, 16.5)).toEqual([]);
    expect(s.mudDashes).toBe(0);
    s.player.pos = { x: 16.6, y: 23.5 };
    expect(walk(s, { mx: 1, my: 0, dash: false }, 3)).toEqual([]);
  });

  it('finding all four lets every animal loose, and nobody chases the nugget for the rest of the level', () => {
    const s = farm(52.5, 27.6, true);
    for (const id of ['milk', 'chick', 'piggy'] as const) s.secrets.add(id);
    const farmer = s.chasers.find((c) => c.def.id === 'farmer')!;
    farmer.mode = 'chase';
    farmer.lastSeen = { ...s.player.pos };
    const seen: string[] = [];
    for (let t = 0; t < 1.5; t += DT) { update(s, up, DT); seen.push(...s.events.map((e) => e.type)); }
    expect(seen).toContain('stampede');
    expect(seen).not.toContain('employeeOfMonth');
    expect(s.happy).toBe(true);
    expect(s.chasers.some((c) => c.mode === 'chase' || c.mode === 'alert')).toBe(false);
    // The Farmer stands right next to the nugget, looking at it, and is too busy to care.
    farmer.pos = { x: s.player.pos.x, y: s.player.pos.y + 0.9 };
    farmer.facing = -Math.PI / 2;
    const later: string[] = [];
    for (let t = 0; t < 20; t += DT) { update(s, still, DT); later.push(...s.events.map((e) => e.type)); }
    expect(later).not.toContain('alert');
    expect(later).not.toContain('caught');
    expect(s.lives).toBe(3);
  });

  it('the farm folk still chase before all four are found', () => {
    const s = farm(52.5, 27.6, true);
    for (const id of ['milk', 'chick'] as const) s.secrets.add(id);
    walk(s, up, 1.5);
    expect(s.secrets.size).toBe(3);
    expect(s.happy).toBe(false);
  });
});
