import { DOOR_LETTERS, type FloorDef, type KeyColor } from './types';

export interface Door {
  x: number;
  y: number;
  color: KeyColor;
  /** 'h' = door sits in a horizontal wall (you walk north/south through it). */
  orient: 'h' | 'v';
}

/** Static, parsed view of one floor. Door open state lives in the game state. */
export class FloorMap {
  readonly def: FloorDef;
  readonly w: number;
  readonly h: number;
  readonly doors: Door[] = [];
  /** Room index per tile, or -1 for walls/doors. */
  readonly room: Int16Array;
  private readonly wall: Uint8Array;
  private readonly solid: Uint8Array;
  private readonly hide: Uint8Array;
  private readonly doorAt = new Map<number, Door>();

  constructor(def: FloorDef) {
    this.def = def;
    this.h = def.rows.length;
    this.w = def.rows[0].length;
    const n = this.w * this.h;
    this.wall = new Uint8Array(n);
    this.solid = new Uint8Array(n);
    this.hide = new Uint8Array(n);
    this.room = new Int16Array(n).fill(-1);

    for (let y = 0; y < this.h; y++) {
      const row = def.rows[y];
      if (row.length !== this.w) throw new Error(`Floor ${def.id} row ${y} has width ${row.length}, expected ${this.w}`);
      for (let x = 0; x < this.w; x++) {
        const c = row[x];
        if (c === '#') this.wall[y * this.w + x] = 1;
        const color = DOOR_LETTERS[c];
        if (color) {
          const left = this.charAt(x - 1, y), right = this.charAt(x + 1, y);
          const horizontalWall = (left === '#' || DOOR_LETTERS[left]) && (right === '#' || DOOR_LETTERS[right]);
          const door: Door = { x, y, color, orient: horizontalWall ? 'h' : 'v' };
          this.doors.push(door);
          this.doorAt.set(y * this.w + x, door);
        }
      }
    }
    for (const it of def.furniture) {
      if (it.block === 'none') continue;
      for (let y = it.y; y < it.y + it.h; y++)
        for (let x = it.x; x < it.x + it.w; x++) {
          if (!this.inBounds(x, y)) continue;
          if (it.block === 'solid') this.solid[y * this.w + x] = 1;
          else this.hide[y * this.w + x] = 1;
        }
    }
    def.rooms.forEach((r, i) => this.flood(r.seed[0], r.seed[1], i));
  }

  charAt(x: number, y: number): string {
    if (!this.inBounds(x, y)) return '#';
    return this.def.rows[y][x];
  }

  inBounds(x: number, y: number) {
    return x >= 0 && y >= 0 && x < this.w && y < this.h;
  }

  private flood(sx: number, sy: number, idx: number) {
    const stack: [number, number][] = [[sx, sy]];
    while (stack.length) {
      const [x, y] = stack.pop()!;
      if (!this.inBounds(x, y)) continue;
      const i = y * this.w + x;
      if (this.room[i] !== -1 || this.wall[i] || this.doorAt.has(i)) continue;
      this.room[i] = idx;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }

  isWall(x: number, y: number) {
    return !this.inBounds(x, y) || this.wall[y * this.w + x] === 1;
  }
  isSolidFurniture(x: number, y: number) {
    return this.inBounds(x, y) && this.solid[y * this.w + x] === 1;
  }
  isHide(x: number, y: number) {
    return this.inBounds(x, y) && this.hide[y * this.w + x] === 1;
  }
  door(x: number, y: number): Door | undefined {
    return this.doorAt.get(y * this.w + x);
  }
  isStairs(x: number, y: number): 'up' | 'down' | null {
    const c = this.charAt(x, y);
    return c === '>' ? 'up' : c === '<' ? 'down' : null;
  }
  roomAt(x: number, y: number) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (!this.inBounds(tx, ty)) return undefined;
    const r = this.room[ty * this.w + tx];
    return r >= 0 ? this.def.rooms[r] : undefined;
  }

  /** Can the nugget stand on this tile? */
  walkableForPlayer(x: number, y: number, unlocked: ReadonlySet<KeyColor>) {
    if (this.isWall(x, y) || this.isSolidFurniture(x, y)) return false;
    const d = this.door(x, y);
    return !d || unlocked.has(d.color);
  }

  /** Can a family member stand on this tile? They can't crawl under furniture or take stairs. */
  walkableForFamily(x: number, y: number, unlocked: ReadonlySet<KeyColor>) {
    if (!this.walkableForPlayer(x, y, unlocked)) return false;
    return !this.isHide(x, y) && !this.isStairs(x, y);
  }

  /** Blocks sight: walls and closed doors. */
  opaque(x: number, y: number, unlocked: ReadonlySet<KeyColor>) {
    if (this.isWall(x, y)) return true;
    const d = this.door(x, y);
    return !!d && !unlocked.has(d.color);
  }
}

export const buildMaps = (defs: FloorDef[]) => defs.map((d) => new FloorMap(d));
