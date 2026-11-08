import { describe, expect, it } from 'vitest';
import { FLOORS, START } from '../../src/game/levels';
import { solveHouse } from '../../src/game/bot';

describe('house is escapable', () => {
  it('collects every key in a chain and opens the front door last', () => {
    const r = solveHouse(FLOORS, START);
    expect(r.escaped).toBe(true);
    expect(r.order).toEqual(['red', 'teal', 'orange', 'green', 'purple', 'blue', 'pink', 'gold']);
    expect(r.unlocked[r.unlocked.length - 1]).toBe('gold');
  });

  it('requires visiting all three floors', () => {
    const floorsOfKeys = new Set(FLOORS.flatMap((f) => f.keys.map(() => f.id)));
    expect(floorsOfKeys.size).toBe(3);
  });

  it('is not escapable if a key is missing', () => {
    const floors = FLOORS.map((f) => ({ ...f, keys: f.keys.filter((k) => k.color !== 'purple') }));
    expect(solveHouse(floors, START).escaped).toBe(false);
  });
});
