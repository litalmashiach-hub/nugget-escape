import type { FloorDef, Furniture, FurnitureKind, BlockKind } from './types';

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
      { id: 'parents', name: "Parents' Bedroom", seed: [24, 5], style: 'carpetRose', wall: '#e6c3d0', door: 'pink' },
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
      // Parents room
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
