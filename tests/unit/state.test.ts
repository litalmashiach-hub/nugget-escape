import { describe, expect, it } from 'vitest';
import {
  createGame, update, currentObjective, circleBlocked, moveCircle,
  CAUGHT_TIME, INTRO_TIME, type GameState, type Input,
} from '../../src/game/state';
import { botInput } from '../../src/game/bot';
import { beginBossFight } from '../../src/game/boss';
import type { KeyColor } from '../../src/game/types';
import { START } from '../../src/game/levels';

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

describe('starting a game', () => {
  it('starts with an intro, full lives and no keys', () => {
    const s = createGame('normal');
    expect(s.status).toBe('intro');
    expect(s.lives).toBe(3);
    expect(s.held.size).toBe(0);
    skipIntro(s);
  });

  it('after the opening cutscene the game starts at once, with the nugget off the plate', () => {
    const s = createGame('normal', { skipIntro: true });
    expect(s.status).toBe('playing');
    expect(s.player.pos).toEqual({ x: START.x, y: START.y });
    update(s, { mx: -1, my: 0, dash: false }, DT);
    expect(s.player.pos.x).toBeLessThan(START.x);
  });

  it('difficulty changes lives', () => {
    expect(createGame('easy').lives).toBe(5);
    expect(createGame('hard').lives).toBe(2);
  });

  it('first objective is the red key in the dining room', () => {
    const o = currentObjective(createGame())!;
    expect(o.color).toBe('red');
    expect(o.action).toBe('find');
    expect(o.hint).toContain('Dining Room');
  });
});

describe('movement and collision', () => {
  it('cannot walk through walls', () => {
    const s = createGame('normal', { noFamily: true });
    skipIntro(s);
    run(s, 3, () => ({ mx: 0, my: -1, dash: false })); // walk north into the dining table / wall
    const m = s.maps[0];
    expect(m.isWall(Math.floor(s.player.pos.x), Math.floor(s.player.pos.y))).toBe(false);
    run(s, 4, () => ({ mx: 1, my: 0, dash: false }));
    expect(s.player.pos.x).toBeLessThan(22); // dining room east wall is at x=22
  });

  it('circle collision detects overlap with blocked tiles', () => {
    const walk = (x: number, y: number) => !(x === 1 && y === 0);
    expect(circleBlocked(walk, 0.9, 0.5, 0.2)).toBe(true);
    expect(circleBlocked(walk, 0.5, 0.5, 0.2)).toBe(false);
    const pos = { x: 0.5, y: 0.5 };
    moveCircle(walk, pos, 1, 0, 0.2);
    expect(pos.x).toBeLessThanOrEqual(0.8 + 1e-6);
  });

  it('dash makes the nugget faster for a moment', () => {
    const a = createGame('normal', { noFamily: true });
    const b = createGame('normal', { noFamily: true });
    skipIntro(a); skipIntro(b);
    update(a, { mx: -1, my: 0, dash: false }, DT);
    update(b, { mx: -1, my: 0, dash: true }, DT);
    expect(b.events.some((e) => e.type === 'dash')).toBe(true);
    for (let i = 0; i < 10; i++) { update(a, { mx: -1, my: 0, dash: false }, DT); update(b, { mx: -1, my: 0, dash: false }, DT); }
    expect(b.player.pos.x).toBeLessThan(a.player.pos.x);
  });
});

describe('keys and doors', () => {
  it('a locked door stays shut without its key and says which key is needed', () => {
    const s = createGame('normal', { noFamily: true });
    skipIntro(s);
    s.player.pos = { x: 16.5, y: 8.5 };
    const ev = run(s, 1, () => ({ mx: 0, my: 1, dash: false }));
    expect(ev).toContain('locked');
    expect(s.player.pos.y).toBeLessThan(9);
    expect(s.unlocked.has('red')).toBe(false);
  });

  it('a key of the wrong color does not open a door', () => {
    const s = createGame('normal', { noFamily: true });
    skipIntro(s);
    s.held.add('blue');
    s.player.pos = { x: 16.5, y: 8.5 };
    run(s, 1, () => ({ mx: 0, my: 1, dash: false }));
    expect(s.unlocked.size).toBe(0);
  });

  it('walking over a key picks it up and the matching door then opens', () => {
    const s = createGame('normal', { noFamily: true });
    skipIntro(s);
    s.player.pos = { x: 20.5, y: 7.2 };
    run(s, 0.2, () => idle);
    expect(s.held.has('red')).toBe(true);
    expect(currentObjective(s)!.action).toBe('open');
    s.player.pos = { x: 16.5, y: 8.5 };
    const ev = run(s, 1.5, () => ({ mx: 0, my: 1, dash: false }));
    expect(ev).toContain('unlock');
    expect(s.player.pos.y).toBeGreaterThan(9.5);
  });
});

describe('stairs', () => {
  it('stairs move the nugget between floors', () => {
    const s = createGame('normal', { noFamily: true });
    skipIntro(s);
    s.unlocked.add('red');
    s.player.pos = { x: 3.5, y: 14.5 };
    const ev = run(s, 1, () => ({ mx: -1, my: 0, dash: false }));
    expect(ev).toContain('floor');
    expect(s.player.floor).toBe(1);
    expect(s.checkpoint.floor).toBe(1);
  });
});

describe('arriving on a new floor', () => {
  it('the nugget turns around to face away from the stairs and does not walk straight back onto them', () => {
    const s = createGame('normal', { noFamily: true });
    skipIntro(s);
    s.unlocked.add('red');
    s.player.pos = { x: 3.5, y: 14.5 };
    run(s, 1, () => ({ mx: -1, my: 0, dash: false })); // walk west up the stairs
    expect(s.player.floor).toBe(1);
    // the stairs down are to the west, so the nugget now looks east into the hall
    expect(Math.cos(s.player.facing)).toBeGreaterThan(0.7);
    const x0 = s.player.pos.x;
    run(s, 1, () => ({ mx: -1, my: 0, dash: false })); // still holding west
    expect(s.player.floor).toBe(1);
    expect(s.player.pos.x).toBeCloseTo(x0, 5);
    run(s, 0.5, () => ({ mx: 1, my: 0, dash: false })); // walk on into the hall
    expect(s.player.pos.x).toBeGreaterThan(x0 + 0.5);
    expect(s.player.floor).toBe(1);
  });
});

describe('family members', () => {
  function withOnlyDad() {
    const s = createGame('normal');
    s.chasers = s.chasers.filter((c) => c.def.id === 'dad');
    s.unlocked.add('red');
    skipIntro(s);
    return s;
  }

  it('spot the nugget in their view and chase it', () => {
    const s = withOnlyDad();
    const dad = s.chasers[0];
    dad.pos = { x: 6.5, y: 12.5 };
    dad.facing = 0; // looking east
    dad.pause = 5;
    dad.lookBase = 0;
    s.player.pos = { x: 10.5, y: 12.5 };
    const ev = run(s, 0.1, () => idle);
    expect(ev).toContain('alert');
    expect(s.timesSpotted).toBe(1);
    run(s, 1, () => idle);
    expect(dad.mode).toBe('chase');
  });

  it('do not see the nugget behind them', () => {
    const s = withOnlyDad();
    const dad = s.chasers[0];
    dad.pos = { x: 10.5, y: 12.5 };
    dad.facing = 0; dad.lookBase = 0; dad.pause = 5;
    s.player.pos = { x: 6.5, y: 12.5 };
    const ev = run(s, 0.05, () => idle);
    expect(ev).not.toContain('alert');
  });

  it('do not see through walls', () => {
    const s = withOnlyDad();
    s.unlocked.clear();
    const dad = s.chasers[0];
    dad.pos = { x: 16.5, y: 11.5 };
    dad.facing = -Math.PI / 2; dad.lookBase = -Math.PI / 2; dad.pause = 5; // looking north at the dining wall
    s.player.pos = { x: 16.5, y: 7.5 };
    const ev = run(s, 0.05, () => idle);
    expect(ev).not.toContain('alert');
  });

  it('cannot see a hidden nugget under furniture', () => {
    const s = withOnlyDad();
    const dad = s.chasers[0];
    dad.pos = { x: 8.5, y: 15.5 };
    dad.facing = 0; dad.lookBase = 0; dad.pause = 5;
    s.player.pos = { x: 10.5, y: 15.5 }; // under the round hall table
    run(s, 0.05, () => idle);
    expect(s.player.hidden).toBe(true);
    expect(s.events.map((e) => e.type)).not.toContain('alert');
  });

  it('catching the nugget costs a life and respawns it at the checkpoint', () => {
    const s = withOnlyDad();
    const dad = s.chasers[0];
    dad.pos = { x: 8.5, y: 12.5 };
    dad.facing = 0; dad.lookBase = 0; dad.pause = 5;
    s.player.pos = { x: 11.5, y: 12.5 };
    s.checkpoint = { floor: 0, x: 16.5, y: 6.5 };
    const ev = run(s, 4, () => idle);
    expect(ev).toContain('caught');
    expect(s.lives).toBe(2);
    expect(ev).toContain('respawn');
    expect(s.player.pos).toEqual({ x: 16.5, y: 6.5 });
    expect(s.player.invuln).toBeGreaterThan(0);
  });

  it('give up the chase when the nugget escapes their sight', () => {
    const s = withOnlyDad();
    const dad = s.chasers[0];
    dad.mode = 'chase';
    dad.lastSeen = { x: 12.5, y: 12.5 };
    dad.pos = { x: 6.5, y: 18.5 };
    s.player.floor = 1; // nugget went upstairs
    s.player.pos = { x: 3.5, y: 13.5 };
    const ev = run(s, 8, () => idle);
    expect(ev).toContain('lost');
    expect(['search', 'return', 'patrol']).toContain(dad.mode);
  });

  it('patrol around the house when nothing is happening', () => {
    const s = createGame('normal');
    skipIntro(s);
    s.player.hidden = true;
    const dad = s.chasers.find((c) => c.def.id === 'dad')!;
    const start = { ...dad.pos };
    run(s, 6, () => idle);
    expect(Math.hypot(dad.pos.x - start.x, dad.pos.y - start.y)).toBeGreaterThan(2);
  });

  it('never walk into walls while patrolling for a long time', () => {
    const s = createGame('hard');
    skipIntro(s);
    s.player.floor = 2; s.player.pos = { x: 5.5, y: 3.5 }; // safely locked in storage
    for (const k of ['red', 'teal', 'orange', 'green', 'pink', 'blue'] as KeyColor[]) s.unlocked.add(k);
    for (let i = 0; i < 60 * 60; i++) {
      update(s, idle, DT);
      for (const c of s.chasers) {
        const m = s.maps[c.floor];
        expect(m.walkableForFamily(Math.floor(c.pos.x), Math.floor(c.pos.y), s.unlocked), `${c.def.name} at ${c.pos.x},${c.pos.y}`).toBe(true);
      }
    }
  });

  it('losing every life ends the game', () => {
    const s = withOnlyDad();
    s.lives = 1;
    const dad = s.chasers[0];
    dad.pos = { x: 8.5, y: 12.5 };
    dad.facing = 0; dad.lookBase = 0; dad.pause = 5;
    s.player.pos = { x: 11.5, y: 12.5 };
    const ev = run(s, 2 + CAUGHT_TIME, () => idle);
    expect(ev).toContain('gameover');
    expect(s.status).toBe('gameover');
  });
});

describe('full escape', () => {
  it('the autopilot collects every key across all floors, gets out the front door and beats the boss', () => {
    const s = createGame('normal', { noFamily: true });
    skipIntro(s);
    let ev = run(s, 240, botInput);
    expect(s.status).toBe('bossIntro');
    beginBossFight(s);
    ev = ev.concat(run(s, 120, botInput));
    expect(ev).toContain('bossDown');
    expect(s.status).toBe('won');
    expect(ev.filter((e) => e === 'key')).toHaveLength(8);
    expect(ev.filter((e) => e === 'unlock')).toHaveLength(8);
    expect(ev.filter((e) => e === 'floor').length).toBeGreaterThanOrEqual(6);
    expect(s.time).toBeGreaterThan(30);
  });
});
