export type KeyColor = 'red' | 'teal' | 'orange' | 'green' | 'purple' | 'blue' | 'pink' | 'gold';

export const KEY_ORDER: KeyColor[] = ['red', 'teal', 'orange', 'green', 'purple', 'blue', 'pink', 'gold'];

/** Display info for every key color. The symbol helps color-blind players. */
export const KEY_INFO: Record<KeyColor, { label: string; hex: string; dark: string; symbol: string }> = {
  red: { label: 'Red', hex: '#e8424a', dark: '#a3222a', symbol: 'heart' },
  teal: { label: 'Teal', hex: '#22c3b8', dark: '#12867e', symbol: 'drop' },
  orange: { label: 'Orange', hex: '#f68b2a', dark: '#b65c10', symbol: 'sun' },
  green: { label: 'Green', hex: '#58c13f', dark: '#357f22', symbol: 'leaf' },
  purple: { label: 'Purple', hex: '#9b5de5', dark: '#6435a6', symbol: 'moon' },
  blue: { label: 'Blue', hex: '#3d7df0', dark: '#2150a8', symbol: 'diamond' },
  pink: { label: 'Pink', hex: '#f2679f', dark: '#b33a6c', symbol: 'flower' },
  gold: { label: 'Gold', hex: '#f5c518', dark: '#b58a00', symbol: 'star' },
};

/** Map letters used for doors in the level text. */
export const DOOR_LETTERS: Record<string, KeyColor> = {
  r: 'red',
  t: 'teal',
  o: 'orange',
  g: 'green',
  p: 'purple',
  b: 'blue',
  k: 'pink',
  f: 'gold',
};

export interface Vec {
  x: number;
  y: number;
}

export type FloorStyle = 'wood' | 'parquet' | 'checker' | 'bathTile' | 'carpetBlue' | 'carpetRose' | 'attic' | 'living' | 'storeTile' | 'concrete' | 'officeCarpet'
  // farm (Level 3)
  | 'grass' | 'dirt' | 'straw' | 'barn' | 'road';

export type FurnitureKind =
  | 'counter' | 'fridge' | 'island' | 'kitchenTable' | 'diningTable' | 'sideboard' | 'cabinet' | 'plant'
  | 'rug' | 'console' | 'bookshelf' | 'piano' | 'clock' | 'bench' | 'tv' | 'sofa' | 'armchair'
  | 'coffeeTable' | 'fireplace' | 'dogBed' | 'bed' | 'bigBed' | 'toyChest' | 'desk' | 'beanbag'
  | 'bathtub' | 'toilet' | 'sink' | 'towelCabinet' | 'bathMat' | 'laundry' | 'wardrobe'
  | 'nightstand' | 'dresser' | 'rocker' | 'boxes' | 'trunk' | 'coveredSofa' | 'mannequin'
  | 'teepee' | 'toyBox' | 'rockingHorse' | 'roundTable' | 'gameTable' | 'runner'
  // grocery store (Level 2)
  | 'shelf' | 'freezer' | 'produce' | 'checkout' | 'deli' | 'cart' | 'rack' | 'pallet' | 'bakery' | 'officeDesk' | 'trophyCase'
  // farm (Level 3)
  | 'hay' | 'haystack' | 'trough' | 'coop' | 'hen' | 'tractor' | 'corn' | 'cow' | 'pigsty' | 'well' | 'scarecrow'
  | 'pumpkins' | 'workbench' | 'barrel' | 'wheelbarrow' | 'milkCans' | 'woodpile' | 'appleTree';

/** Furniture tall enough to block sight (store shelves and racks, rows of corn, haystacks, apple trees). */
export const TALL_FURNITURE: ReadonlySet<FurnitureKind> = new Set<FurnitureKind>(['shelf', 'rack', 'corn', 'haystack', 'appleTree']);

/**
 * solid: blocks everyone.
 * hide: the nugget can crawl underneath and hide; people cannot walk through.
 * none: decoration only (rugs).
 */
export type BlockKind = 'solid' | 'hide' | 'none';

export interface Furniture {
  kind: FurnitureKind;
  x: number;
  y: number;
  w: number;
  h: number;
  block: BlockKind;
  color?: string;
}

export interface RoomDef {
  id: string;
  name: string;
  seed: [number, number];
  style: FloorStyle;
  wall: string;
  /** Door color for rooms behind a locked door. Hallways have none. */
  door?: KeyColor;
  /** Out in the open (farm yards and fields): fenced in rather than walled. */
  outdoor?: boolean;
}

export type FamilyKind = 'dad' | 'mom' | 'sister' | 'grandma' | 'brother' | 'dog'
  // grocery store employees (Level 2)
  | 'cashier' | 'stocker' | 'butcher' | 'clerk'
  // a shopper pushing a cart (Level 2 hazard, not a chaser)
  | 'shopper'
  // the farm (Level 3): the farmer carries a rake
  | 'farmer' | 'farmhand';

export interface FamilyDef {
  id: string;
  name: string;
  kind: FamilyKind;
  start: [number, number];
  waypoints: [number, number][];
  patrolSpeed: number;
  chaseSpeed: number;
  visionRange: number;
  fovDeg: number;
  giveUp: number;
  /** Extra catching reach in tiles (the farmer's rake). */
  reach?: number;
}

export interface FloorDef {
  id: number;
  name: string;
  rows: string[];
  rooms: RoomDef[];
  furniture: Furniture[];
  keys: { color: KeyColor; x: number; y: number }[];
  family: FamilyDef[];
  /** Where the nugget appears when it arrives from the floor below / above. */
  arriveFromBelow?: [number, number];
  arriveFromAbove?: [number, number];
  lights: [number, number][];
  /** Slippery water spills as [x, y, w, h] tile rectangles (Level 2). */
  spills?: [number, number, number, number][];
  /** Sticky mud puddles as [x, y, w, h] tile rectangles (Level 3): the nugget wades through slowly. */
  mud?: [number, number, number, number][];
}

export type Difficulty = 'easy' | 'normal' | 'hard';

export interface DifficultySettings {
  lives: number;
  patrolMult: number;
  chaseMult: number;
  visionMult: number;
  alertDelay: number;
}

export const DIFFICULTY: Record<Difficulty, DifficultySettings> = {
  easy: { lives: 5, patrolMult: 0.8, chaseMult: 0.8, visionMult: 0.8, alertDelay: 0.8 },
  normal: { lives: 3, patrolMult: 1, chaseMult: 1, visionMult: 1, alertDelay: 0.5 },
  hard: { lives: 2, patrolMult: 1.1, chaseMult: 1.12, visionMult: 1.2, alertDelay: 0.3 },
};
