import { describe, expect, it } from 'vitest';
import { FLOORS, START } from '../../src/game/levels';
import { FloorMap, buildMaps } from '../../src/game/map';
import { KEY_ORDER, type KeyColor } from '../../src/game/types';

const maps = buildMaps(FLOORS);
const none = new Set<KeyColor>();

describe('house layout', () => {
  it('has three floors', () => {
    expect(FLOORS).toHaveLength(3);
    expect(FLOORS.map((f) => f.name)).toEqual(['Ground Floor', 'Upstairs', 'Attic']);
  });

  it('every floor is a closed rectangle of walls', () => {
    for (const m of maps) {
      for (let x = 0; x < m.w; x++) {
        expect('#f').toContain(m.charAt(x, 0));
        expect('#f').toContain(m.charAt(x, m.h - 1));
      }
      for (let y = 0; y < m.h; y++) {
        expect(m.charAt(0, y)).toBe('#');
        expect(m.charAt(m.w - 1, y)).toBe('#');
      }
    }
  });

  it('rejects a floor with uneven rows', () => {
    const bad = { ...FLOORS[2], rows: ['####', '#..', '####'] };
    expect(() => new FloorMap(bad)).toThrow(/width/);
  });

  it('has several different rooms on every floor, each with a distinct name', () => {
    const names = FLOORS.flatMap((f) => f.rooms.map((r) => r.name));
    expect(new Set(names).size).toBe(names.length);
    for (const f of FLOORS) expect(f.rooms.length).toBeGreaterThanOrEqual(2);
  });

  it('every room seed is inside its own flood-filled area', () => {
    for (const m of maps)
      m.def.rooms.forEach((r, i) => expect(m.room[r.seed[1] * m.w + r.seed[0]]).toBe(i));
  });

  it('every walkable tile belongs to exactly one room', () => {
    for (const m of maps)
      for (let y = 0; y < m.h; y++)
        for (let x = 0; x < m.w; x++) {
          const isFloor = !m.isWall(x, y) && !m.door(x, y);
          if (isFloor) expect(m.room[y * m.w + x], `floor ${m.def.id} tile ${x},${y}`).toBeGreaterThanOrEqual(0);
        }
  });
});

describe('colored doors and keys', () => {
  const allDoors = maps.flatMap((m) => m.doors.map((d) => ({ ...d, floor: m.def.id })));
  const allKeys = FLOORS.flatMap((f) => f.keys.map((k) => ({ ...k, floor: f.id })));

  it('every room behind a door has its own unique door color', () => {
    const colors = FLOORS.flatMap((f) => f.rooms.filter((r) => r.door).map((r) => r.door));
    expect(new Set(colors).size).toBe(colors.length);
    expect(colors.length).toBeGreaterThanOrEqual(7);
  });

  it('has exactly one key per door color, including the gold front door', () => {
    const doorColors = new Set(allDoors.map((d) => d.color));
    expect([...doorColors].sort()).toEqual([...KEY_ORDER].sort());
    expect(allKeys.map((k) => k.color).sort()).toEqual([...KEY_ORDER].sort());
  });

  it("each room's door touches that room and a hallway", () => {
    for (const m of maps)
      m.def.rooms.forEach((room, idx) => {
        if (!room.door) return;
        const doors = m.doors.filter((d) => d.color === room.door);
        expect(doors.length, room.name).toBeGreaterThan(0);
        for (const d of doors) {
          const around = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => m.room[(d.y + dy) * m.w + d.x + dx]);
          expect(around, room.name).toContain(idx);
          expect(around.some((r) => r >= 0 && r !== idx), room.name).toBe(true);
        }
      });
  });

  it('the gold front door is on the outside wall of the ground floor', () => {
    const gold = allDoors.filter((d) => d.color === 'gold');
    expect(gold.length).toBeGreaterThan(0);
    for (const d of gold) {
      expect(d.floor).toBe(0);
      expect(d.y).toBe(maps[0].h - 1);
    }
  });

  it('keys lie on tiles the nugget can reach (not inside walls or furniture)', () => {
    for (const k of allKeys) expect(maps[k.floor].walkableForPlayer(k.x, k.y, none), k.color).toBe(true);
  });

  it('each key sits in a different room from the door it opens (except the start room)', () => {
    for (const k of allKeys) {
      const m = maps[k.floor];
      const room = m.roomAt(k.x + 0.5, k.y + 0.5)!;
      if (k.color === 'red') expect(room.id).toBe('dining');
      else expect(room.door).not.toBe(k.color);
    }
  });

  it('locked doors block both the nugget and sight until opened', () => {
    const m = maps[0];
    const red = m.doors.find((d) => d.color === 'red')!;
    expect(m.walkableForPlayer(red.x, red.y, none)).toBe(false);
    expect(m.opaque(red.x, red.y, none)).toBe(true);
    const open = new Set<KeyColor>(['red']);
    expect(m.walkableForPlayer(red.x, red.y, open)).toBe(true);
    expect(m.opaque(red.x, red.y, open)).toBe(false);
  });
});

describe('furniture, stairs and family placement', () => {
  it('furniture stays inside rooms and never covers doors or stairs', () => {
    for (const m of maps)
      for (const it of m.def.furniture)
        for (let y = it.y; y < it.y + it.h; y++)
          for (let x = it.x; x < it.x + it.w; x++) {
            const c = m.charAt(x, y);
            expect(c, `${it.kind} at ${x},${y} floor ${m.def.id}`).toBe('.');
          }
  });

  it('tiles next to every door are free so doors can be used', () => {
    for (const m of maps)
      for (const d of m.doors) {
        const sides = d.orient === 'h' ? [[0, -1], [0, 1]] : [[-1, 0], [1, 0]];
        for (const [dx, dy] of sides) {
          const x = d.x + dx, y = d.y + dy;
          if (!m.inBounds(x, y)) continue; // front door opens to the outside
          expect(m.walkableForPlayer(x, y, none), `door ${d.color} side ${x},${y}`).toBe(true);
        }
      }
  });

  it('stairs connect floors with free arrival spots', () => {
    expect(FLOORS[1].arriveFromBelow).toBeDefined();
    expect(FLOORS[2].arriveFromBelow).toBeDefined();
    expect(FLOORS[0].arriveFromAbove).toBeDefined();
    expect(FLOORS[1].arriveFromAbove).toBeDefined();
    for (const m of maps)
      for (const a of [m.def.arriveFromAbove, m.def.arriveFromBelow])
        if (a) {
          expect(m.walkableForPlayer(a[0], a[1], none)).toBe(true);
          expect(m.isStairs(a[0], a[1])).toBeNull();
        }
  });

  it('family members start and patrol on tiles people can stand on', () => {
    const all = new Set<KeyColor>(KEY_ORDER);
    for (const m of maps)
      for (const fam of m.def.family) {
        expect(m.walkableForFamily(fam.start[0], fam.start[1], none), fam.name).toBe(true);
        for (const w of fam.waypoints) expect(m.walkableForFamily(w[0], w[1], all), `${fam.name} ${w}`).toBe(true);
      }
  });

  it('there are family members on every floor', () => {
    for (const f of FLOORS) expect(f.family.length).toBeGreaterThan(0);
  });

  it('there are hiding spots on every floor', () => {
    for (const f of FLOORS) expect(f.furniture.some((it) => it.block === 'hide')).toBe(true);
  });

  it('the nugget starts in the dining room next to the plate', () => {
    expect(maps[START.floor].roomAt(START.x, START.y)?.id).toBe('dining');
  });
});
