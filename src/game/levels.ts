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
 * A big supermarket. Key chain: green (far corner of the sales floor) -> Cold Room
 *   -> orange -> Stockroom -> purple -> Bakery Kitchen -> gold -> Manager's Office (the goal).
 * Shelves and racks are tall: the employees can't see through them.
 * Every key sits behind a slippery water spill: step on one and the nugget slides
 * out of control (and makes a splash the staff can hear), so go around.
 */
export const STORE: FloorDef[] = [
  {
    id: 0,
    name: 'FreshMart',
    rows: [
      '################################################################################',
      '#...................#...................#...................#..................#',
      '#...................#...................#...................#..................#',
      '#...................#...................#...................#..................#',
      '#...................#...................#...................#..................#',
      '#...................#...................#...................#..................#',
      '#...................#...................#...................#..................#',
      '#...................#...................#...................#..................#',
      '#...................#...................#...................#..................#',
      '#...................#...................#...................#..................#',
      '##########g###################o###################p##########..................#',
      '#...........................................................#..................#',
      '#...........................................................#..................#',
      '#...........................................................#..................#',
      '#...........................................................#..................#',
      '#...........................................................#..................#',
      '#...........................................................#########f##########',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '#..............................................................................#',
      '################################################################################',
    ],
    rooms: [
      { id: 'cold', name: 'Cold Room', seed: [5, 4], style: 'concrete', wall: '#bfe3f2', door: 'green' },
      { id: 'stock', name: 'Stockroom', seed: [25, 4], style: 'concrete', wall: '#cdb999', door: 'orange' },
      { id: 'kitchen', name: 'Bakery Kitchen', seed: [45, 4], style: 'checker', wall: '#f6d9b8', door: 'purple' },
      { id: 'office', name: "Manager's Office", seed: [69, 8], style: 'officeCarpet', wall: '#d9c8ef', door: 'gold' },
      { id: 'sales', name: 'Sales Floor', seed: [20, 46], style: 'storeTile', wall: '#f3eedd' },
    ],
    furniture: [
      // Cold Room: walk-in freezers and stacked crates
      f('freezer', 1, 1, 8, 1, 'solid', '#5fb7e8'),
      f('freezer', 11, 1, 8, 1, 'solid', '#5fb7e8'),
      f('pallet', 1, 4, 2, 2, 'hide'),
      f('pallet', 6, 6, 2, 1, 'hide'),
      f('boxes', 9, 3, 2, 2, 'solid'),
      // Stockroom
      f('rack', 21, 1, 8, 1, 'solid'),
      f('rack', 31, 1, 8, 1, 'solid'),
      f('boxes', 22, 4, 2, 2, 'solid'),
      f('boxes', 27, 6, 3, 1, 'solid'),
      f('pallet', 25, 3, 2, 1, 'hide'),
      // Bakery Kitchen: ovens along the back, a flour-dusted worktable
      f('counter', 41, 1, 9, 1, 'solid'),
      f('bakery', 43, 4, 2, 2, 'hide'),
      f('island', 46, 6, 4, 1, 'solid'),
      f('boxes', 41, 8, 2, 1, 'solid'),
      // Manager's Office
      f('rug', 64, 4, 11, 8, 'none', '#6a5acd'),
      f('officeDesk', 66, 4, 6, 1, 'hide'),
      f('bookshelf', 78, 1, 1, 4, 'solid'),
      f('trophyCase', 61, 1, 3, 1, 'solid'),
      // (the rest of the office stays clear: it's where the Manager boss fight happens)
      f('plant', 64, 1, 1, 1, 'solid'),
      f('plant', 77, 1, 1, 1, 'solid'),
      f('armchair', 73, 1, 2, 2, 'solid'),
      // Sales floor: a long row of fruit and veg stands up top
      f('produce', 3, 12, 3, 2, 'hide', '#e74c3c'),
      f('produce', 10, 12, 3, 2, 'hide', '#f1c40f'),
      f('produce', 17, 12, 3, 2, 'hide', '#58c13f'),
      f('produce', 24, 12, 3, 2, 'hide', '#f68b2a'),
      f('produce', 31, 12, 3, 2, 'hide', '#9b5de5'),
      f('produce', 38, 12, 3, 2, 'hide', '#e74c3c'),
      f('produce', 45, 12, 3, 2, 'hide', '#58c13f'),
      f('produce', 52, 12, 3, 2, 'hide', '#f1c40f'),
      f('cart', 57, 14, 1, 1, 'hide'),
      // Nine aisles in two blocks (tall shelves), with a cross aisle in between
      f('shelf', 4, 18, 2, 9, 'solid', '#e8424a'),
      f('shelf', 4, 30, 2, 9, 'solid', '#22c3b8'),
      f('shelf', 10, 18, 2, 9, 'solid', '#3d7df0'),
      f('shelf', 10, 30, 2, 9, 'solid', '#f2679f'),
      f('shelf', 16, 18, 2, 9, 'solid', '#f68b2a'),
      f('shelf', 16, 30, 2, 9, 'solid', '#58c13f'),
      f('shelf', 22, 18, 2, 9, 'solid', '#9b5de5'),
      f('shelf', 22, 30, 2, 9, 'solid', '#f5c518'),
      f('shelf', 28, 18, 2, 9, 'solid', '#22c3b8'),
      f('shelf', 28, 30, 2, 9, 'solid', '#5fb7e8'),
      f('shelf', 34, 18, 2, 9, 'solid', '#f2679f'),
      f('shelf', 34, 30, 2, 9, 'solid', '#e8424a'),
      f('shelf', 40, 18, 2, 9, 'solid', '#58c13f'),
      f('shelf', 40, 30, 2, 9, 'solid', '#3d7df0'),
      f('shelf', 46, 18, 2, 9, 'solid', '#f5c518'),
      f('shelf', 46, 30, 2, 9, 'solid', '#f68b2a'),
      f('shelf', 52, 18, 2, 9, 'solid', '#5fb7e8'),
      f('shelf', 52, 30, 2, 9, 'solid', '#9b5de5'),
      // Checkouts by the entrance (the doors are in the middle of the front wall)
      f('checkout', 6, 43, 2, 1, 'solid'),
      f('checkout', 12, 43, 2, 1, 'solid'),
      f('checkout', 18, 43, 2, 1, 'solid'),
      f('checkout', 24, 43, 2, 1, 'solid'),
      f('checkout', 30, 43, 2, 1, 'solid'),
      f('checkout', 47, 43, 2, 1, 'solid'),
      f('checkout', 53, 43, 2, 1, 'solid'),
      f('cart', 45, 49, 1, 1, 'hide'),
      f('cart', 46, 49, 1, 1, 'hide'),
      f('cart', 47, 49, 1, 1, 'hide'),
      f('cart', 10, 48, 1, 1, 'hide'),
      // Frozen food (the nugget shelf), the deli and the bakery corner
      f('freezer', 63, 20, 11, 1, 'solid', '#5fb7e8'),
      f('freezer', 63, 25, 11, 1, 'solid', '#5fb7e8'),
      f('deli', 78, 28, 1, 11, 'solid'),
      f('bakery', 64, 32, 2, 2, 'hide'),
      f('bakery', 69, 32, 2, 2, 'hide'),
      f('produce', 64, 37, 2, 2, 'hide', '#f68b2a'),
      f('produce', 66, 46, 2, 2, 'hide', '#e74c3c'),
      f('plant', 78, 50, 1, 1, 'solid'),
      f('plant', 61, 17, 1, 1, 'solid'),
      f('plant', 1, 50, 1, 1, 'solid'),
    ],
    keys: [
      { color: 'green', x: 74, y: 45 },
      { color: 'orange', x: 16, y: 4 },
      { color: 'purple', x: 37, y: 4 },
      { color: 'gold', x: 57, y: 3 },
    ],
    spills: [
      // around the green key: a puddle wall on its top and left, get in from below
      [72, 43, 7, 1],
      [72, 44, 1, 4],
      // Cold Room: a stripe in front of the orange key, with a gap below
      [13, 2, 1, 5],
      [14, 6, 4, 1],
      // Stockroom: a zig-zag in front of the purple key
      [33, 2, 1, 4],
      [35, 3, 1, 1],
      [34, 6, 4, 1],
      // Bakery Kitchen: spilled milk all round the gold key
      [52, 1, 1, 3],
      [52, 5, 6, 1],
      [55, 2, 1, 2],
      // leaky bottles in the aisles, the cross aisle and by the checkouts
      [7, 22, 1, 2],
      [36, 33, 2, 1],
      [25, 28, 3, 1],
      [50, 40, 2, 1],
      [66, 28, 2, 1],
    ],
    family: [
      {
        id: 'kevin', name: 'Kevin the cashier', kind: 'cashier', start: [9, 45],
        waypoints: [[4, 45], [9, 44], [15, 45], [21, 44], [27, 45], [33, 41], [21, 41], [4, 41]],
        patrolSpeed: 1.7, chaseSpeed: 3.5, visionRange: 5, fovDeg: 85, giveUp: 3,
      },
      {
        id: 'gina', name: 'Gina the cashier', kind: 'cashier', start: [50, 45],
        waypoints: [[44, 45], [50, 44], [56, 45], [59, 41], [44, 41]],
        patrolSpeed: 1.7, chaseSpeed: 3.5, visionRange: 5, fovDeg: 85, giveUp: 3,
      },
      {
        id: 'brenda', name: 'Brenda the stocker', kind: 'stocker', start: [7, 28],
        waypoints: [[7, 17], [7, 39], [13, 39], [13, 17], [19, 17], [19, 39]],
        patrolSpeed: 1.9, chaseSpeed: 3.5, visionRange: 5, fovDeg: 80, giveUp: 3,
      },
      {
        id: 'tom', name: 'Tom the stocker', kind: 'stocker', start: [31, 28],
        waypoints: [[25, 17], [25, 39], [31, 39], [31, 17], [37, 17], [37, 39]],
        patrolSpeed: 1.9, chaseSpeed: 3.5, visionRange: 5, fovDeg: 80, giveUp: 3,
      },
      {
        id: 'lucy', name: 'Lucy the stocker', kind: 'stocker', start: [49, 28],
        waypoints: [[43, 17], [43, 39], [49, 39], [49, 17], [55, 17], [55, 39]],
        patrolSpeed: 1.9, chaseSpeed: 3.5, visionRange: 5, fovDeg: 80, giveUp: 3,
      },
      {
        id: 'priya', name: 'Priya the clerk', kind: 'clerk', start: [20, 15],
        waypoints: [[2, 16], [20, 15], [36, 11], [50, 16], [57, 11], [29, 16]],
        patrolSpeed: 1.6, chaseSpeed: 3.4, visionRange: 4.5, fovDeg: 80, giveUp: 2.5,
      },
      {
        id: 'olga', name: 'Olga from frozen food', kind: 'clerk', start: [68, 22],
        waypoints: [[62, 22], [75, 22], [75, 18], [62, 18], [62, 27], [75, 27]],
        patrolSpeed: 1.6, chaseSpeed: 3.4, visionRange: 4.5, fovDeg: 80, giveUp: 2.5,
      },
      {
        id: 'dan', name: 'Deli Dan', kind: 'butcher', start: [74, 33],
        waypoints: [[76, 29], [76, 38], [72, 35], [67, 30], [62, 35]],
        patrolSpeed: 1.8, chaseSpeed: 3.5, visionRange: 5, fovDeg: 85, giveUp: 3,
      },
      {
        id: 'rosa', name: 'Rosa from the bakery', kind: 'clerk', start: [66, 42],
        waypoints: [[62, 41], [70, 41], [62, 49], [70, 50], [76, 50]],
        patrolSpeed: 1.5, chaseSpeed: 3.3, visionRange: 4.5, fovDeg: 75, giveUp: 2.5,
      },
      {
        id: 'fred', name: 'Frosty Fred', kind: 'stocker', start: [5, 7],
        waypoints: [[3, 2], [8, 7], [11, 6], [4, 8], [10, 2]],
        patrolSpeed: 1.6, chaseSpeed: 3.5, visionRange: 5, fovDeg: 90, giveUp: 2.5,
      },
      {
        id: 'stan', name: 'Stan the stockroom boss', kind: 'stocker', start: [25, 7],
        waypoints: [[21, 3], [26, 8], [32, 8], [29, 4], [24, 2]],
        patrolSpeed: 1.6, chaseSpeed: 3.5, visionRange: 5, fovDeg: 90, giveUp: 2.5,
      },
      {
        id: 'bea', name: 'Baker Bea', kind: 'clerk', start: [45, 8],
        waypoints: [[42, 3], [47, 3], [51, 8], [44, 7], [50, 4]],
        patrolSpeed: 1.6, chaseSpeed: 3.4, visionRange: 5, fovDeg: 90, giveUp: 2.5,
      },
    ],
    lights: [[10, 5], [30, 5], [50, 5], [69, 8], [12, 15], [40, 15], [16, 28], [42, 28], [68, 22], [70, 34], [20, 46], [60, 46]],
  },
];

// ================================================================ Level 3: the farm

/**
 * Clover Hill Farm, on a sunny morning. The farmer has locked the nugget in the chicken pen.
 * Key chain: red (in the pen) -> pen gate -> orange (farmyard, by the pigsty) -> Cornfield -> teal
 *   -> Big Red Barn -> green -> Tool Shed -> purple -> Apple Orchard -> blue -> Vegetable Garden
 *   -> pink -> Pumpkin Patch -> gold -> the farm gate and the country road (the goal).
 * Rows of corn and haystacks are tall: nobody can see through them.
 * Sticky mud puddles slow the nugget right down.
 */
export const FARM: FloorDef[] = [
  {
    id: 0,
    name: 'Clover Hill Farm',
    rows: [
      '########################################################',
      '#..................#...............#.......#...........#',
      '#..................#...............#.......#...........#',
      '#..................#...#############.......#...........#',
      '#..................#...#..........##.......#...........#',
      '#..................#...#..........##.......#...........#',
      '#..................#...#..........##.......#...........#',
      '#..................#...#..........##.......#...........#',
      '#..................#...#..........##.......#...........#',
      '#..................#...#..........#####b########g#######',
      '#..................#...#..........#....................#',
      '#..................#...#####r######....................#',
      '#..................#...................................#',
      '#########tt#########...................................#',
      '#......................................................#',
      '#......................................................#',
      '#......................................................#',
      '#......................................................#',
      '#......................................................#',
      '#......................................................#',
      '#......................................................#',
      '#..................................#####################',
      '#..................................#...................#',
      '#..................................#...................#',
      '#..................................#...................#',
      '#...................###########....#...................#',
      '#...................#.........#....#...................#',
      '#...................#.........#....#...................#',
      '########p########...#.........#....o...................#',
      '#...............#...#.........#....#...................#',
      '#...............#...#.........#....#...................#',
      '#...............#...#.........#....#...................#',
      '#...............#...#####k#####....#...................#',
      '#...............#..................#...................#',
      '#...............#..................#...................#',
      '#...............#..................#...................#',
      '#...............#..................#...................#',
      '###########################ff###########################',
      '#......................................................#',
      '########################################################',
    ],
    rooms: [
      { id: 'pen', name: 'Chicken Pen', seed: [28, 7], style: 'straw', wall: '#c8a26b', door: 'red', outdoor: true },
      { id: 'corn', name: 'Cornfield', seed: [44, 29], style: 'dirt', wall: '#c8a26b', door: 'orange', outdoor: true },
      { id: 'barn', name: 'Big Red Barn', seed: [9, 6], style: 'barn', wall: '#f1dcc0', door: 'teal' },
      { id: 'shed', name: 'Tool Shed', seed: [49, 4], style: 'concrete', wall: '#cbd5dc', door: 'green' },
      { id: 'orchard', name: 'Apple Orchard', seed: [8, 32], style: 'grass', wall: '#c8a26b', door: 'purple', outdoor: true },
      { id: 'garden', name: 'Vegetable Garden', seed: [39, 5], style: 'dirt', wall: '#c8a26b', door: 'blue', outdoor: true },
      { id: 'patch', name: 'Pumpkin Patch', seed: [25, 29], style: 'straw', wall: '#c8a26b', door: 'pink', outdoor: true },
      { id: 'road', name: 'Country Road', seed: [10, 38], style: 'road', wall: '#c8a26b', door: 'gold', outdoor: true },
      { id: 'yard', name: 'Farmyard', seed: [12, 25], style: 'grass', wall: '#b5402f', outdoor: true },
    ],
    furniture: [
      // Chicken pen: the coop on stilts (hide underneath), a water trough, hay and the other hens
      f('coop', 24, 4, 3, 2, 'hide'),
      f('trough', 30, 9, 3, 1, 'solid'),
      f('hay', 33, 4, 1, 1, 'hide'),
      f('hen', 26, 8, 1, 1, 'none'),
      f('hen', 31, 6, 1, 1, 'none'),
      f('hen', 24, 9, 1, 1, 'none'),
      // Big Red Barn: haystacks, hay bales, cows in their stalls
      f('haystack', 1, 1, 2, 2, 'solid'),
      f('haystack', 16, 1, 2, 2, 'solid'),
      f('hay', 5, 1, 2, 1, 'hide'),
      f('hay', 12, 1, 2, 1, 'hide'),
      f('hay', 8, 6, 1, 1, 'hide'),
      f('hay', 11, 6, 1, 1, 'hide'),
      f('cow', 2, 8, 2, 1, 'solid'),
      f('cow', 2, 11, 2, 1, 'solid'),
      f('cow', 15, 8, 2, 1, 'solid'),
      f('cow', 15, 11, 2, 1, 'solid', '#5a3a22'),
      f('trough', 6, 11, 3, 1, 'solid'),
      f('milkCans', 17, 5, 1, 1, 'solid'),
      // Tool Shed
      f('workbench', 44, 1, 4, 1, 'solid'),
      f('barrel', 54, 1, 1, 1, 'solid'),
      f('barrel', 44, 7, 1, 1, 'solid'),
      f('barrel', 45, 8, 1, 1, 'solid'),
      f('wheelbarrow', 50, 6, 1, 1, 'hide'),
      f('woodpile', 50, 1, 2, 1, 'solid'),
      // Farmyard
      f('pigsty', 2, 15, 5, 4, 'solid'),
      f('tractor', 8, 21, 3, 2, 'hide'),
      f('haystack', 14, 15, 2, 2, 'solid'),
      f('haystack', 50, 17, 2, 2, 'solid'),
      f('hay', 21, 16, 2, 1, 'hide'),
      f('hay', 30, 14, 1, 1, 'hide'),
      f('hay', 5, 27, 2, 1, 'hide'),
      f('hay', 17, 32, 2, 1, 'hide'),
      f('hay', 39, 13, 2, 1, 'hide'),
      f('hay', 24, 24, 1, 1, 'hide'),
      f('well', 16, 26, 2, 2, 'solid'),
      f('trough', 12, 26, 3, 1, 'solid'),
      // Apple Orchard (behind the purple gate): apple trees, with a puppy keeping watch
      f('appleTree', 3, 30, 2, 2, 'solid'),
      f('appleTree', 10, 30, 2, 2, 'solid'),
      f('appleTree', 11, 34, 2, 2, 'solid'),
      f('appleTree', 6, 32, 1, 1, 'solid'),
      f('hay', 14, 29, 1, 1, 'hide'),
      f('wheelbarrow', 8, 35, 1, 1, 'hide'),
      // Vegetable Garden (behind the blue gate)
      f('woodpile', 37, 1, 4, 1, 'solid'),
      f('pumpkins', 36, 4, 2, 2, 'solid'),
      f('scarecrow', 40, 3, 1, 1, 'solid'),
      f('corn', 39, 5, 1, 3, 'solid'),
      f('hay', 36, 8, 1, 1, 'hide'),
      // Pumpkin Patch (behind the pink gate), where the gold key is
      f('pumpkins', 22, 27, 3, 2, 'solid'),
      f('pumpkins', 26, 26, 2, 2, 'solid'),
      f('scarecrow', 25, 29, 1, 1, 'solid'),
      f('hay', 22, 30, 1, 1, 'hide'),
      f('wheelbarrow', 33, 18, 1, 1, 'hide'),
      f('cow', 46, 14, 2, 1, 'solid'),
      f('milkCans', 13, 14, 1, 1, 'solid'),
      // Cornfield: tall rows with a cross path through the middle
      f('corn', 37, 22, 2, 6, 'solid'),
      f('corn', 37, 30, 2, 7, 'solid'),
      f('corn', 41, 22, 2, 6, 'solid'),
      f('corn', 41, 30, 2, 7, 'solid'),
      f('corn', 45, 22, 2, 6, 'solid'),
      f('corn', 45, 30, 2, 7, 'solid'),
      f('corn', 49, 22, 2, 6, 'solid'),
      f('corn', 49, 30, 2, 7, 'solid'),
      f('scarecrow', 52, 26, 1, 1, 'solid'),
      f('hay', 53, 29, 1, 1, 'hide'),
    ],
    keys: [
      { color: 'red', x: 32, y: 5 },
      { color: 'orange', x: 2, y: 25 },
      { color: 'teal', x: 53, y: 35 },
      { color: 'green', x: 17, y: 3 },
      { color: 'purple', x: 53, y: 3 },
      { color: 'blue', x: 2, y: 35 },
      { color: 'pink', x: 42, y: 7 },
      { color: 'gold', x: 28, y: 30 },
    ],
    mud: [
      [2, 33, 4, 1],
      [6, 34, 1, 3],
      [17, 23, 3, 2],
      [26, 18, 2, 1],
      [40, 18, 3, 1],
      [23, 35, 2, 1],
      [26, 30, 2, 1],
      [43, 32, 2, 1],
      [51, 33, 2, 1],
    ],
    family: [
      {
        id: 'farmer', name: 'The Farmer', kind: 'farmer', start: [16, 19],
        waypoints: [[16, 19], [28, 15], [40, 16], [50, 13], [39, 11], [30, 22], [18, 30], [8, 25], [26, 34], [32, 26]],
        patrolSpeed: 2.1, chaseSpeed: 3.9, visionRange: 7, fovDeg: 85, giveUp: 3.5, reach: 0.45,
      },
      {
        id: 'rusty', name: 'Rusty the farm dog', kind: 'dog', start: [39, 25],
        waypoints: [[39, 23], [39, 35], [47, 29], [52, 23], [52, 35], [43, 35], [43, 29]],
        patrolSpeed: 2.3, chaseSpeed: 4.4, visionRange: 3.4, fovDeg: 360, giveUp: 1.8,
      },
      {
        id: 'hank', name: 'Hank the farmhand', kind: 'farmhand', start: [9, 4],
        waypoints: [[3, 5], [9, 3], [15, 5], [13, 9], [6, 9], [9, 11]],
        patrolSpeed: 1.7, chaseSpeed: 3.6, visionRange: 5.5, fovDeg: 85, giveUp: 3,
      },
      {
        id: 'pip', name: 'Pip the puppy', kind: 'dog', start: [8, 32],
        waypoints: [[6, 30], [13, 32], [9, 36], [2, 29], [14, 36], [8, 29]],
        patrolSpeed: 2.2, chaseSpeed: 4.2, visionRange: 3, fovDeg: 360, giveUp: 1.6,
      },
    ],
    lights: [],
  },
];

export type LevelId = 1 | 2 | 3;

export interface LevelDef {
  id: LevelId;
  name: string;
  floors: FloorDef[];
  /** Where the nugget begins (Level 1 adds the dinner plate it hops off). */
  start: { floor: number; x: number; y: number; plate?: { x: number; y: number } };
  /** Keys in the order the player needs them. The last one is gold. */
  keyOrder: KeyColor[];
  /** 'frontDoor': out the gold front door (then the boss). A room id: walk into that room (then the boss). */
  goal: 'frontDoor' | string;
  /** Caught by staff: put back on this shelf spot instead of the last checkpoint. */
  shelf?: { floor: number; x: number; y: number };
  /** What surrounds the building. */
  outside: 'garden' | 'parking' | 'farm';
  /** Where the nugget ends up when caught there (for the toasts), e.g. "back on the shelf". */
  caughtTo?: string;
  /** false: reaching the goal wins at once (no boss fight). */
  boss?: boolean;
  /** How the nugget arrives: walking in (default) or dropped into the pen by the farmer. */
  intro?: 'walk' | 'drop';
  /** Easter eggs and the nugget rain only live in the house. */
  secrets: boolean;
  /** Shoppers charge with their carts when the nugget gets near a key. */
  carts?: boolean;
}

export const LEVEL1: LevelDef = {
  id: 1, name: 'The House', floors: FLOORS, start: START,
  keyOrder: ['red', 'teal', 'orange', 'green', 'purple', 'blue', 'pink', 'gold'],
  goal: 'frontDoor', outside: 'garden', secrets: true,
};

export const LEVEL2: LevelDef = {
  id: 2, name: 'The Grocery Store', floors: STORE,
  start: { floor: 0, x: 40, y: 49.4 },
  keyOrder: ['green', 'orange', 'purple', 'gold'],
  goal: 'office',
  shelf: { floor: 0, x: 68.5, y: 21.6 }, caughtTo: 'back on the shelf',
  outside: 'parking', secrets: false, carts: true,
};

export const LEVEL3: LevelDef = {
  id: 3, name: 'The Farm', floors: FARM,
  start: { floor: 0, x: 27.5, y: 7.5 },
  keyOrder: ['red', 'orange', 'teal', 'green', 'purple', 'blue', 'pink', 'gold'],
  goal: 'road',
  // caught: the farmer puts the nugget back in the chicken pen
  shelf: { floor: 0, x: 28.5, y: 6.5 }, caughtTo: 'back in the pen',
  outside: 'farm', secrets: false, intro: 'drop',
};

export const LEVELS: Record<LevelId, LevelDef> = { 1: LEVEL1, 2: LEVEL2, 3: LEVEL3 };
