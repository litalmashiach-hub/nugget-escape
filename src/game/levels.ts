import type { FloorDef, Furniture, FurnitureKind, BlockKind, KeyColor } from './types';

const f = (kind: FurnitureKind, x: number, y: number, w: number, h: number, block: BlockKind, color?: string): Furniture => ({
  kind, x, y, w, h, block, color,
});

/**
 * Legend
 *  #  wall          .  floor
 *  >  stairs up     <  stairs down
 *  r t o g p b k f  locked doors (red, teal, orange, green, purple, blue, pink, gold front door)
 *
 * Key chain: red (dining) -> teal (hall) -> orange (kids room) -> green (kitchen)
 *   -> purple (bathroom) -> blue (attic storage) -> pink (living room) -> gold (parents' room) -> front door.
 */
export const FLOORS: FloorDef[] = [
  {
    id: 0,
    name: 'Ground Floor',
    rows: [
      '################################',
      '#..........#..........#........#',
      '#..........#..........#........#',
      '#..........#..........#........#',
      '#..........#..........#........#',
      '#..........#..........#........#',
      '#..........#..........#........#',
      '#..........#..........#........#',
      '#..........#..........#........#',
      '#####o##########r######........#',
      '#.....................#........#',
      '#.....................b........#',
      '#.....................#........#',
      '#.....................#........#',
      '#>>...................#........#',
      '#>>...................#........#',
      '#.....................#........#',
      '#.....................#........#',
      '#.....................#........#',
      '#.....................#........#',
      '#.....................#........#',
      '##############ff################',
    ],
    rooms: [
      { id: 'kitchen', name: 'Kitchen', seed: [5, 5], style: 'checker', wall: '#9fd3c7', door: 'orange' },
      { id: 'dining', name: 'Dining Room', seed: [16, 6], style: 'wood', wall: '#e9b872', door: 'red' },
      { id: 'living', name: 'Living Room', seed: [26, 10], style: 'living', wall: '#7fa4c9', door: 'blue' },
      { id: 'hall0', name: 'Front Hall', seed: [10, 12], style: 'parquet', wall: '#d6c6a8' },
    ],
    furniture: [
      // Kitchen
      f('counter', 1, 1, 9, 1, 'solid'),
      f('fridge', 10, 1, 1, 2, 'solid'),
      f('island', 4, 4, 4, 2, 'solid'),
      f('kitchenTable', 2, 6, 2, 2, 'hide'),
      f('plant', 1, 8, 1, 1, 'solid'),
      // Dining room
      f('rug', 13, 2, 8, 5, 'none', '#8c2f39'),
      f('diningTable', 14, 3, 6, 3, 'hide'),
      f('sideboard', 13, 1, 5, 1, 'solid'),
      f('cabinet', 20, 1, 2, 1, 'solid'),
      f('plant', 12, 8, 1, 1, 'solid'),
      f('plant', 21, 8, 1, 1, 'solid'),
      // Front hall
      f('rug', 6, 13, 12, 6, 'none', '#3a7d86'),
      f('bookshelf', 1, 10, 3, 1, 'solid'),
      f('console', 8, 10, 4, 1, 'solid'),
      f('piano', 18, 13, 3, 2, 'solid'),
      f('roundTable', 10, 15, 2, 2, 'hide'),
      f('clock', 21, 16, 1, 1, 'solid'),
      f('bench', 3, 20, 3, 1, 'solid'),
      f('plant', 12, 20, 1, 1, 'solid'),
      f('plant', 17, 20, 1, 1, 'solid'),
      // Living room
      f('rug', 24, 2, 6, 6, 'none', '#c97b63'),
      f('tv', 25, 1, 4, 1, 'solid'),
      f('plant', 23, 1, 1, 1, 'solid'),
      f('coffeeTable', 26, 4, 2, 2, 'hide'),
      f('armchair', 29, 4, 2, 2, 'solid'),
      f('sofa', 25, 7, 4, 1, 'solid'),
      f('bookshelf', 30, 10, 1, 4, 'solid'),
      f('gameTable', 26, 13, 2, 2, 'hide'),
      f('fireplace', 30, 16, 1, 2, 'solid'),
      f('dogBed', 24, 18, 2, 2, 'none'),
      f('plant', 30, 20, 1, 1, 'solid'),
    ],
    keys: [
      { color: 'red', x: 20, y: 7 },
      { color: 'teal', x: 20, y: 19 },
      { color: 'green', x: 8, y: 7 },
      { color: 'pink', x: 28, y: 18 },
    ],
    family: [
      {
        id: 'dad', name: 'Dad', kind: 'dad', start: [4, 12],
        waypoints: [[4, 12], [16, 12], [16, 18], [4, 18]],
        patrolSpeed: 1.8, chaseSpeed: 3.7, visionRange: 6, fovDeg: 80, giveUp: 3,
      },
      {
        id: 'mom', name: 'Mom', kind: 'mom', start: [5, 7],
        waypoints: [[5, 7], [9, 7], [9, 3], [2, 3], [5, 7], [5, 11], [13, 11]],
        patrolSpeed: 1.8, chaseSpeed: 3.6, visionRange: 6, fovDeg: 90, giveUp: 3,
      },
      {
        id: 'dog', name: 'Biscuit the dog', kind: 'dog', start: [24, 10],
        waypoints: [[24, 10], [28, 10], [28, 17], [24, 17]],
        patrolSpeed: 2.4, chaseSpeed: 4.6, visionRange: 3.2, fovDeg: 360, giveUp: 1.6,
      },
    ],
    arriveFromAbove: [3, 15],
    lights: [[6, 3], [16, 4], [26, 5], [26, 15], [8, 12], [15, 18]],
  },
  {
    id: 1,
    name: 'Upstairs',
    rows: [
      '################################',
      '#........#.........#...........#',
      '#........#.........#...........#',
      '#........#.........#...........#',
      '#........#.........#...........#',
      '#........#.........#...........#',
      '#........#.........#...........#',
      '#........#.........#...........#',
      '####t#########g#########k#######',
      '#..............................#',
      '#..............................#',
      '#..............................#',
      '#<<.........................>>.#',
      '#<<.........................>>.#',
      '#..............................#',
      '################################',
    ],
    rooms: [
      { id: 'kids', name: "Kids' Bedroom", seed: [4, 4], style: 'carpetBlue', wall: '#a7d8f0', door: 'teal' },
      { id: 'bath', name: 'Bathroom', seed: [14, 5], style: 'bathTile', wall: '#cfeee6', door: 'green' },
      { id: 'parents', name: "Grandma's Bedroom", seed: [24, 5], style: 'carpetRose', wall: '#e6c3d0', door: 'pink' },
      { id: 'hall1', name: 'Upstairs Hall', seed: [15, 11], style: 'wood', wall: '#d9cbb0' },
    ],
    furniture: [
      // Kids room
      f('rug', 3, 3, 4, 3, 'none', '#f6c453'),
      f('bed', 1, 1, 2, 3, 'hide', '#3d7df0'),
      f('desk', 5, 1, 2, 1, 'solid'),
      f('toyChest', 7, 1, 2, 1, 'solid'),
      f('beanbag', 7, 6, 2, 1, 'solid'),
      // Bathroom
      f('bathtub', 10, 1, 3, 2, 'solid'),
      f('sink', 15, 1, 2, 1, 'solid'),
      f('toilet', 17, 1, 1, 1, 'solid'),
      f('towelCabinet', 18, 2, 1, 2, 'solid'),
      f('bathMat', 11, 3, 3, 1, 'none'),
      f('laundry', 18, 6, 1, 1, 'solid'),
      // Grandma's room (Grandma patrols here)
      f('rug', 23, 5, 7, 2, 'none', '#8e6c88'),
      f('bigBed', 26, 1, 3, 4, 'hide', '#e6c3d0'),
      f('nightstand', 25, 1, 1, 1, 'solid'),
      f('nightstand', 29, 1, 1, 1, 'solid'),
      f('wardrobe', 20, 1, 3, 1, 'solid'),
      f('dresser', 30, 5, 1, 2, 'solid'),
      f('rocker', 20, 6, 1, 1, 'solid'),
      // Hall
      f('runner', 3, 11, 25, 1, 'none', '#7a3b2e'),
      f('bookshelf', 9, 9, 3, 1, 'solid'),
      f('console', 18, 9, 3, 1, 'solid'),
      f('plant', 30, 9, 1, 1, 'solid'),
      f('roundTable', 15, 13, 2, 2, 'hide'),
    ],
    keys: [
      { color: 'orange', x: 2, y: 6 },
      { color: 'purple', x: 11, y: 6 },
      { color: 'gold', x: 30, y: 3 },
    ],
    family: [
      {
        id: 'sister', name: 'Big Sister', kind: 'sister', start: [25, 10],
        waypoints: [[25, 10], [8, 10], [8, 12], [25, 12]],
        patrolSpeed: 2.0, chaseSpeed: 3.8, visionRange: 6.5, fovDeg: 80, giveUp: 3,
      },
      {
        id: 'grandma', name: 'Grandma', kind: 'grandma', start: [23, 3],
        waypoints: [[23, 3], [23, 6], [29, 6], [25, 6]],
        patrolSpeed: 1.0, chaseSpeed: 2.6, visionRange: 7.5, fovDeg: 70, giveUp: 4,
      },
    ],
    arriveFromBelow: [3, 13],
    arriveFromAbove: [26, 13],
    lights: [[4, 4], [14, 4], [25, 4], [8, 11], [22, 11]],
  },
  {
    id: 2,
    name: 'Attic',
    rows: [
      '########################',
      '#.........#............#',
      '#.........#............#',
      '#.........#............#',
      '#.........#............#',
      '#.........#............#',
      '#.........#............#',
      '#####p#####............#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#...................<<.#',
      '#...................<<.#',
      '########################',
    ],
    rooms: [
      { id: 'storage', name: 'Storage Room', seed: [5, 4], style: 'attic', wall: '#b59a7a', door: 'purple' },
      { id: 'attic', name: 'Attic Playroom', seed: [15, 9], style: 'attic', wall: '#c9ab88' },
    ],
    furniture: [
      // Storage
      f('boxes', 1, 1, 2, 2, 'solid'),
      f('trunk', 7, 1, 3, 1, 'solid'),
      f('coveredSofa', 1, 5, 2, 2, 'hide'),
      f('mannequin', 9, 5, 1, 1, 'solid'),
      // Attic playroom
      f('rug', 12, 3, 6, 3, 'none', '#4f9d69'),
      f('teepee', 12, 1, 2, 2, 'hide'),
      f('toyBox', 20, 1, 3, 1, 'solid'),
      f('rockingHorse', 18, 3, 1, 1, 'solid'),
      f('wardrobe', 21, 4, 2, 2, 'solid'),
      f('boxes', 14, 9, 2, 2, 'solid'),
      f('boxes', 1, 11, 2, 2, 'solid'),
    ],
    keys: [{ color: 'blue', x: 8, y: 4 }],
    family: [
      {
        id: 'brother', name: 'Little Brother', kind: 'brother', start: [12, 10],
        waypoints: [[12, 10], [19, 9], [19, 6], [14, 6]],
        patrolSpeed: 2.2, chaseSpeed: 3.9, visionRange: 5, fovDeg: 100, giveUp: 2.5,
      },
    ],
    arriveFromBelow: [18, 12],
    lights: [[5, 3], [15, 4], [10, 10], [19, 10]],
  },
];

/** Where the nugget begins: hopping off the dinner plate, just south of the dining table. */
export const START = { floor: 0, x: 16.5, y: 6.6, plate: { x: 17, y: 3.5 } };

// ================================================================ Level 2: the grocery store

/**
 * Key chain: green (on the sales floor, by the deli) -> Cold Room -> orange -> Stockroom
 *   -> gold -> Manager's Office (the goal).
 * Shelves and racks are tall: the employees can't see through them.
 */
export const STORE: FloorDef[] = [
  {
    id: 0,
    name: 'FreshMart',
    rows: [
      '####################################',
      '#...........#...........#..........#',
      '#...........#...........#..........#',
      '#...........#...........#..........#',
      '#...........#...........#..........#',
      '#####g###########o#######..........#',
      '#.......................#..........#',
      '#.......................#..........#',
      '#.......................#..........#',
      '#.......................#####f######',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '#..................................#',
      '####################################',
    ],
    rooms: [
      { id: 'cold', name: 'Cold Room', seed: [8, 2], style: 'concrete', wall: '#bfe3f2', door: 'green' },
      { id: 'stock', name: 'Stockroom', seed: [16, 2], style: 'concrete', wall: '#cdb999', door: 'orange' },
      { id: 'office', name: "Manager's Office", seed: [30, 5], style: 'officeCarpet', wall: '#d9c8ef', door: 'gold' },
      { id: 'sales', name: 'Sales Floor', seed: [12, 19], style: 'storeTile', wall: '#f3eedd' },
    ],
    furniture: [
      // Cold Room: walk-in freezers and stacked crates
      f('freezer', 1, 1, 4, 1, 'solid', '#5fb7e8'),
      f('freezer', 7, 1, 4, 1, 'solid', '#5fb7e8'),
      f('pallet', 1, 3, 2, 2, 'hide'),
      // Stockroom
      f('rack', 13, 1, 4, 1, 'solid'),
      f('rack', 19, 1, 5, 1, 'solid'),
      f('boxes', 13, 3, 2, 2, 'solid'),
      f('pallet', 19, 3, 2, 1, 'hide'),
      // Manager's Office
      f('rug', 27, 3, 6, 4, 'none', '#6a5acd'),
      f('officeDesk', 28, 2, 4, 1, 'hide'),
      f('bookshelf', 34, 1, 1, 3, 'solid'),
      f('trophyCase', 25, 1, 2, 1, 'solid'),
      f('plant', 25, 8, 1, 1, 'solid'),
      f('armchair', 33, 6, 2, 2, 'solid'),
      // Sales floor: fruit and veg up top
      f('produce', 1, 7, 2, 2, 'hide', '#e74c3c'),
      f('produce', 8, 7, 3, 2, 'hide', '#f1c40f'),
      f('produce', 15, 7, 3, 2, 'hide', '#58c13f'),
      f('cart', 21, 7, 1, 1, 'hide'),
      // Aisles (tall shelves)
      f('shelf', 3, 11, 2, 7, 'solid', '#e8424a'),
      f('shelf', 8, 11, 2, 7, 'solid', '#3d7df0'),
      f('shelf', 13, 11, 2, 7, 'solid', '#f68b2a'),
      f('shelf', 18, 11, 2, 7, 'solid', '#9b5de5'),
      // Checkouts by the entrance
      f('checkout', 3, 20, 2, 1, 'solid'),
      f('checkout', 8, 20, 2, 1, 'solid'),
      f('checkout', 13, 20, 2, 1, 'solid'),
      f('cart', 22, 21, 1, 1, 'hide'),
      f('cart', 23, 21, 1, 1, 'hide'),
      // Deli, frozen food (the nugget shelf) and bakery
      f('deli', 34, 11, 1, 6, 'solid'),
      f('freezer', 25, 14, 6, 1, 'solid', '#5fb7e8'),
      f('bakery', 28, 18, 2, 2, 'hide'),
      f('plant', 34, 22, 1, 1, 'solid'),
    ],
    keys: [
      { color: 'green', x: 33, y: 20 },
      { color: 'orange', x: 10, y: 3 },
      { color: 'gold', x: 22, y: 3 },
    ],
    family: [
      {
        id: 'kevin', name: 'Kevin the cashier', kind: 'cashier', start: [6, 21],
        waypoints: [[2, 22], [6, 21], [11, 22], [11, 19], [2, 19]],
        patrolSpeed: 1.7, chaseSpeed: 3.6, visionRange: 5.5, fovDeg: 85, giveUp: 3,
      },
      {
        id: 'brenda', name: 'Brenda the stocker', kind: 'stocker', start: [6, 14],
        waypoints: [[6, 10], [6, 18], [11, 18], [11, 10], [16, 10], [16, 18], [21, 10]],
        patrolSpeed: 1.9, chaseSpeed: 3.7, visionRange: 6, fovDeg: 80, giveUp: 3,
      },
      {
        id: 'dan', name: 'Deli Dan', kind: 'butcher', start: [30, 12],
        waypoints: [[26, 12], [32, 12], [33, 18], [26, 20], [24, 16], [24, 11]],
        patrolSpeed: 1.8, chaseSpeed: 3.6, visionRange: 6, fovDeg: 85, giveUp: 3,
      },
      {
        id: 'priya', name: 'Priya the clerk', kind: 'clerk', start: [12, 9],
        waypoints: [[3, 6], [12, 9], [22, 6], [17, 6], [6, 9]],
        patrolSpeed: 1.8, chaseSpeed: 3.7, visionRange: 5.5, fovDeg: 90, giveUp: 3,
      },
      {
        id: 'stan', name: 'Stan the stockroom boss', kind: 'stocker', start: [17, 3],
        waypoints: [[16, 2], [22, 2], [22, 4], [16, 4]],
        patrolSpeed: 1.6, chaseSpeed: 3.5, visionRange: 5, fovDeg: 90, giveUp: 2.5,
      },
    ],
    lights: [[6, 3], [18, 3], [30, 4], [6, 8], [17, 8], [6, 14], [16, 14], [29, 12], [29, 19], [10, 20]],
  },
];

export type LevelId = 1 | 2;

export interface LevelDef {
  id: LevelId;
  name: string;
  floors: FloorDef[];
  /** Where the nugget begins (Level 1 adds the dinner plate it hops off). */
  start: { floor: number; x: number; y: number; plate?: { x: number; y: number } };
  /** Keys in the order the player needs them. The last one is gold. */
  keyOrder: KeyColor[];
  /** 'frontDoor': out the gold front door (then the boss). A room id: walk into that room to win. */
  goal: 'frontDoor' | string;
  /** Caught by staff: put back on this shelf spot instead of the last checkpoint. */
  shelf?: { floor: number; x: number; y: number };
  /** What surrounds the building. */
  outside: 'garden' | 'parking';
  /** Easter eggs and the nugget rain only live in the house. */
  secrets: boolean;
}

export const LEVEL1: LevelDef = {
  id: 1, name: 'The House', floors: FLOORS, start: START,
  keyOrder: ['red', 'teal', 'orange', 'green', 'purple', 'blue', 'pink', 'gold'],
  goal: 'frontDoor', outside: 'garden', secrets: true,
};

export const LEVEL2: LevelDef = {
  id: 2, name: 'The Grocery Store', floors: STORE,
  start: { floor: 0, x: 17.5, y: 20.6 },
  keyOrder: ['green', 'orange', 'gold'],
  goal: 'office',
  shelf: { floor: 0, x: 27.5, y: 15.6 },
  outside: 'parking', secrets: false,
};

export const LEVELS: Record<LevelId, LevelDef> = { 1: LEVEL1, 2: LEVEL2 };
