/**
 * 3D furniture, one builder per furniture kind. Each builder works in local space where
 * (0, 0) is the item's top-left tile corner and (w, h) its footprint in tiles.
 */
import { box, cbox, cyl, ball, cone, builder, type Builder } from './kit';
import { rng, shade } from './paint';
import type { Furniture } from '../game/types';

const WOOD = '#8a5a36';
const WOOD_L = '#b07a4c';
const WOOD_D = '#5e3b22';

function legs(b: Builder, w: number, d: number, h: number, inset: number, color: string, r = 0.05) {
  for (const [x, z] of [[inset, inset], [w - inset, inset], [inset, d - inset], [w - inset, d - inset]]) cyl(b, x, 0, z, r, h, color);
}

/** A table: top at height `h` on four legs (the nugget fits underneath). */
function table(b: Builder, w: number, d: number, h: number, top: string, leg = WOOD_D) {
  box(b, 0.04, h - 0.08, 0.04, w - 0.08, 0.08, d - 0.08, top);
  legs(b, w, d, h - 0.08, 0.18, leg);
}

function plant(b: Builder, x: number, z: number, s: number, seed: number, y = 0) {
  const R = rng(seed);
  cyl(b, x, y, z, 0.22 * s, 0.38 * s, '#c56b3c', {}, 0.27 * s);
  cyl(b, x, y + 0.36 * s, z, 0.25 * s, 0.04, '#5a3a22');
  for (let i = 0; i < 5; i++) {
    const a = R() * Math.PI * 2;
    ball(b, x + Math.cos(a) * 0.14 * s, y + (0.62 + R() * 0.45) * s, z + Math.sin(a) * 0.14 * s, 0.36 * s, 0.36 * s, 0.36 * s, shade('#3f8f4a', (R() - 0.5) * 0.3));
  }
}

function books(b: Builder, x: number, y: number, z: number, w: number, d: number, h: number, seed: number) {
  const R = rng(seed);
  const cols = ['#c0392b', '#2e86c1', '#f1c40f', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1'];
  let cx = x;
  while (cx < x + w - 0.06) {
    const bw = 0.05 + R() * 0.06;
    const bh = h * (0.7 + R() * 0.3);
    box(b, cx, y, z, bw, bh, d, cols[Math.floor(R() * cols.length)]);
    cx += bw + 0.005;
  }
}

function cushion(b: Builder, x: number, y: number, z: number, w: number, h: number, d: number, color: string) {
  box(b, x, y, z, w, h, d, color);
}

/** A sofa whose seat faces `face` ('n' = toward -z, 'e' = +x, 'w' = -x). */
function sofa(b: Builder, w: number, d: number, color: string, face: 'n' | 'e' | 'w') {
  const dark = shade(color, -0.25);
  if (face === 'n') {
    box(b, 0.05, 0, 0.1, w - 0.1, 0.4, d - 0.15, dark);
    cushion(b, 0.2, 0.4, 0.1, w - 0.4, 0.15, d - 0.4, color);
    box(b, 0.05, 0, d - 0.35, w - 0.1, 0.95, 0.3, dark);
    box(b, 0.05, 0, 0.1, 0.2, 0.65, d - 0.15, dark);
    box(b, w - 0.25, 0, 0.1, 0.2, 0.65, d - 0.15, dark);
  } else {
    const back = face === 'w' ? w - 0.35 : 0.05;
    box(b, 0.05, 0, 0.05, w - 0.1, 0.4, d - 0.1, dark);
    cushion(b, face === 'w' ? 0.1 : 0.35, 0.4, 0.25, w - 0.45, 0.15, d - 0.5, color);
    box(b, back, 0, 0.05, 0.3, 0.95, d - 0.1, dark);
    box(b, 0.05, 0, 0.05, w - 0.1, 0.65, 0.2, dark);
    box(b, 0.05, 0, d - 0.25, w - 0.1, 0.65, 0.2, dark);
  }
}

function bed(b: Builder, w: number, d: number, blanket: string, big: boolean) {
  const top = 0.68;
  // frame on posts: the nugget can crawl underneath
  legs(b, w, d, top - 0.2, 0.12, WOOD_D, 0.07);
  box(b, 0.05, top - 0.22, 0.05, w - 0.1, 0.12, d - 0.1, WOOD);
  box(b, 0.08, top - 0.1, 0.1, w - 0.16, 0.18, d - 0.15, '#f7f3ea');
  box(b, 0.04, top - 0.05, d * 0.35, w - 0.08, 0.2, d * 0.65 - 0.06, blanket);
  box(b, 0.04, top - 0.25, d - 0.08, w - 0.08, 0.25, 0.04, blanket);
  const pillows = big ? 2 : 1;
  for (let i = 0; i < pillows; i++) {
    const pw = (w - 0.4) / pillows;
    box(b, 0.2 + i * pw + 0.04, top + 0.08, 0.18, pw - 0.08, 0.13, 0.42, '#ffffff');
  }
  box(b, 0, 0, 0, w, 1.25, 0.1, WOOD_D); // headboard
}

function drawers(b: Builder, w: number, h: number, d: number, color: string, rows: number, face: 'z' | 'x' = 'z') {
  box(b, 0.05, 0, 0.05, w - 0.1, h, d - 0.1, color);
  for (let i = 0; i < rows; i++) {
    const y = ((i + 0.5) / rows) * h;
    if (face === 'z') cbox(b, w / 2, y, d - 0.04, 0.16, 0.04, 0.04, '#d4b483', { metal: 0.6, rough: 0.3 });
    else cbox(b, 0.04, y, d / 2, 0.04, 0.04, 0.16, '#d4b483', { metal: 0.6, rough: 0.3 });
    if (i) {
      if (face === 'z') cbox(b, w / 2, (i / rows) * h, d - 0.05, w - 0.14, 0.015, 0.02, shade(color, -0.35));
      else cbox(b, 0.05, (i / rows) * h, d / 2, 0.02, 0.015, d - 0.14, shade(color, -0.35));
    }
  }
}

function chair(b: Builder, x: number, z: number, rot: number) {
  // rot: direction the sitter faces, in map angle terms (0 = +x, PI/2 = +z)
  const c = builder(false, b.cut);
  box(c, -0.24, 0.5, -0.24, 0.48, 0.07, 0.48, WOOD_L);
  legs(c, 0.48, 0.48, 0.5, 0.06, WOOD_D, 0.03);
  for (const m of c.group.children.slice(1)) { m.position.x -= 0.24; m.position.z -= 0.24; }
  box(c, -0.24, 0.5, -0.27, 0.48, 0.65, 0.06, WOOD_L);
  c.group.position.set(x, 0, z);
  c.group.rotation.y = Math.PI / 2 - rot;
  b.group.add(c.group);
  b.mats.push(...c.mats);
}

function plateSet(b: Builder, x: number, y: number, z: number, food: boolean) {
  cyl(b, x, y, z, 0.2, 0.025, '#fbfbf7', { rough: 0.3 });
  cyl(b, x, y + 0.025, z, 0.15, 0.008, '#efe9dc', { rough: 0.3 });
  if (food) {
    ball(b, x - 0.05, y + 0.06, z, 0.12, 0.05, 0.1, '#7fbf4d');
    ball(b, x + 0.06, y + 0.06, z + 0.03, 0.1, 0.06, 0.08, '#e7c46a');
  }
}


// ---------------------------------------------------------------- grocery store (Level 2)

const PRODUCT_COLORS = ['#e8424a', '#f5c518', '#3d7df0', '#58c13f', '#f68b2a', '#9b5de5', '#ffffff', '#f2679f', '#22c3b8'];

/** Runs `fn(along, across)` in a frame where `along` follows the item's long side. */
function longSide(w: number, h: number) {
  const alongZ = h >= w;
  return {
    len: alongZ ? h : w,
    depth: alongZ ? w : h,
    vertical: alongZ,
    /** box helper in (along, y, across) coordinates */
    box: (b: Builder, a: number, y: number, c: number, la: number, hy: number, lc: number, color: string, o = {}) =>
      alongZ ? box(b, c, y, a, lc, hy, la, color, o) : box(b, a, y, c, la, hy, lc, color, o),
  };
}

/** Tall double-sided supermarket shelf, stocked with colorful boxes, cans and bottles. */
function storeShelf(b: Builder, w: number, h: number, sign: string, seed: number) {
  const L = longSide(w, h);
  const R = rng(seed);
  const H = 2.1;
  L.box(b, 0.05, 0, 0.1, L.len - 0.1, 0.14, L.depth - 0.2, '#5b6470');
  L.box(b, 0.05, 0.14, L.depth / 2 - 0.04, L.len - 0.1, H - 0.14, 0.08, '#dfe3e8'); // back panel
  for (const end of [0.05, L.len - 0.11]) L.box(b, end, 0, 0.1, 0.06, H, L.depth - 0.2, '#c9ced6');
  const levels = [0.14, 0.62, 1.1, 1.58];
  for (const y of levels) {
    L.box(b, 0.1, y, 0.12, L.len - 0.2, 0.04, L.depth - 0.24, '#eef0f3', { metal: 0.3, rough: 0.4 });
    for (const side of [0, 1]) {
      let a = 0.14;
      while (a < L.len - 0.3) {
        const pw = 0.16 + R() * 0.22;
        const ph = 0.2 + R() * 0.22;
        const col = PRODUCT_COLORS[Math.floor(R() * PRODUCT_COLORS.length)];
        const c0 = side ? L.depth / 2 + 0.06 : 0.16;
        L.box(b, a, y + 0.04, c0, pw - 0.03, ph, L.depth / 2 - 0.24, col, { rough: 0.6 });
        a += pw;
      }
    }
  }
  // colored aisle sign on top
  L.box(b, L.len / 2 - 0.9, H, L.depth / 2 - 0.03, 1.8, 0.32, 0.06, sign, { emissive: sign, emissiveIntensity: 0.25 });
}

function storeRack(b: Builder, w: number, h: number, seed: number) {
  const L = longSide(w, h);
  const R = rng(seed);
  for (const a of [0.08, L.len / 2, L.len - 0.14])
    for (const c of [0.08, L.depth - 0.14]) L.box(b, a, 0, c, 0.06, 2.2, 0.06, '#e07b24', { metal: 0.5, rough: 0.4 });
  for (const y of [0.25, 1.05, 1.85]) {
    L.box(b, 0.05, y, 0.05, L.len - 0.1, 0.05, L.depth - 0.1, '#7a6a55');
    let a = 0.15;
    while (a < L.len - 0.5) {
      const s = 0.35 + R() * 0.3;
      L.box(b, a, y + 0.05, 0.12, s, 0.25 + R() * 0.35, L.depth - 0.24, shade('#c8a26b', (R() - 0.5) * 0.3));
      a += s + 0.06;
    }
  }
}

function chestFreezer(b: Builder, w: number, h: number, glass: string, seed: number) {
  const L = longSide(w, h);
  const R = rng(seed);
  L.box(b, 0.05, 0, 0.08, L.len - 0.1, 0.85, L.depth - 0.16, '#f4f7fa', { rough: 0.3 });
  L.box(b, 0.05, 0.1, 0.06, L.len - 0.1, 0.12, L.depth - 0.12, glass); // colored kick stripe
  // packages inside, seen through the glass lid
  let a = 0.15;
  while (a < L.len - 0.35) {
    const pw = 0.25 + R() * 0.2;
    const col = R() < 0.4 ? '#f5b942' : PRODUCT_COLORS[Math.floor(R() * PRODUCT_COLORS.length)];
    L.box(b, a, 0.8, 0.18 + R() * 0.1, pw - 0.04, 0.07, L.depth - 0.5, col);
    a += pw;
  }
  L.box(b, 0.08, 0.88, 0.1, L.len - 0.16, 0.03, L.depth - 0.2, '#bfe6ff', { rough: 0.05, metal: 0.2, emissive: '#2b6f99', emissiveIntensity: 0.25 });
}

export interface FurnitureBuild extends Builder {
  /** Height of the top surface, for the hide-under fade test. */
  top: number;
}

export function buildFurniture(it: Furniture): FurnitureBuild {
  const hide = it.block === 'hide';
  const b = builder(hide, true) as FurnitureBuild;
  const { w, h } = it;
  const seed = it.x * 31 + it.y * 17;
  b.top = 1;
  switch (it.kind) {
    case 'rug':
    case 'runner': {
      const c = it.color ?? '#8c2f39';
      box(b, 0.15, 0, 0.15, w - 0.3, 0.02, h - 0.3, shade(c, -0.2), { rough: 1 });
      box(b, 0.3, 0.005, 0.3, w - 0.6, 0.02, h - 0.6, c, { rough: 1 });
      if (it.kind === 'rug') box(b, 0.55, 0.01, 0.55, Math.max(0.1, w - 1.1), 0.02, Math.max(0.1, h - 1.1), shade(c, 0.25), { rough: 1 });
      for (const m of b.group.children) m.castShadow = false;
      break;
    }
    case 'bathMat':
      box(b, 0.1, 0, 0.15, w - 0.2, 0.025, h - 0.3, '#f2a6b8', { rough: 1 });
      break;
    case 'counter':
      box(b, 0, 0, 0, w, 0.85, h - 0.05, '#e6dccb');
      box(b, -0.02, 0.85, -0.02, w + 0.04, 0.07, h + 0.02, '#5d6770', { rough: 0.35 });
      for (let x = 0.5; x < w; x += 1) cbox(b, x, 0.6, h - 0.04, 0.2, 0.03, 0.03, '#9aa4ad', { metal: 0.7 });
      cbox(b, 3.5, 0.93, 0.45, 0.6, 0.02, 0.4, '#b9c2c9', { metal: 0.8, rough: 0.2 }); // sink
      for (const x of [6.5, 7.1]) cyl(b, x, 0.92, 0.45, 0.14, 0.03, '#2d2d2d'); // stove
      break;
    case 'fridge':
      box(b, 0.05, 0, 0.05, w - 0.1, 2.0, h - 0.1, '#e4ebef', { rough: 0.35 });
      cbox(b, 0.85, 1.3, h - 0.05, 0.04, 0.5, 0.04, '#9aa4ad', { metal: 0.7 });
      cbox(b, 0.85, 0.5, h - 0.05, 0.04, 0.4, 0.04, '#9aa4ad', { metal: 0.7 });
      cbox(b, w / 2, 1.0, h - 0.06, w - 0.12, 0.02, 0.02, '#aab3ba');
      break;
    case 'island':
      box(b, 0.05, 0, 0.05, w - 0.1, 0.85, h - 0.1, '#7aa6a0');
      box(b, 0, 0.85, 0, w, 0.08, h, '#efefea', { rough: 0.3 });
      ball(b, w * 0.3, 1.0, h * 0.5, 0.35, 0.15, 0.35, '#c97a1e'); // bread
      ball(b, w * 0.7, 0.98, h * 0.4, 0.2, 0.2, 0.2, '#e8424a'); // apple
      break;
    case 'kitchenTable':
      table(b, w, h, 0.78, WOOD_L);
      b.top = 0.78;
      plateSet(b, w / 2, 0.78, h / 2, false);
      break;
    case 'diningTable': {
      table(b, w, h, 0.85, WOOD);
      box(b, 0.25, 0.85, 0.2, w - 0.5, 0.012, h - 0.4, '#f4efe4', { rough: 0.95 }); // cloth
      b.top = 0.85;
      // place settings (Dad's plate is the nugget's plate: added by the scene)
      plateSet(b, 1.2, 0.86, 0.5, true);
      plateSet(b, 4.8, 0.86, 0.5, true);
      plateSet(b, 0.45, 0.86, 1.5, true);
      plateSet(b, 5.55, 0.86, 1.5, true);
      cyl(b, w / 2, 0.86, h / 2 + 0.2, 0.32, 0.18, '#d0d8e0', { rough: 0.3 }, 0.38); // nugget bowl
      for (let i = 0; i < 6; i++) ball(b, w / 2 + Math.cos(i) * 0.15, 1.06, h / 2 + 0.2 + Math.sin(i) * 0.15, 0.16, 0.1, 0.13, '#d9993a');
      for (const [x, z] of [[2.2, 1.0], [3.8, 1.0]]) cyl(b, x, 0.86, z, 0.05, 0.4, '#f6f1e2', { emissive: '#ffcf80', emissiveIntensity: 0.3 }); // candles
      for (const [x, z] of [[2.2, 1.0], [3.8, 1.0]]) ball(b, x, 1.32, z, 0.05, 0.09, 0.05, '#ffcc55', { emissive: '#ffaa33', emissiveIntensity: 2 });
      cyl(b, 1.9, 0.86, 0.75, 0.05, 0.16, '#cfe8ff', { rough: 0.1 }); // glasses
      cyl(b, 4.1, 0.86, 0.75, 0.05, 0.16, '#cfe8ff', { rough: 0.1 });
      // chairs on the north side and both ends
      for (const x of [1.2, 3.0, 4.8]) chair(b, x, -0.45, Math.PI / 2);
      chair(b, -0.45, 1.5, 0);
      chair(b, w + 0.45, 1.5, Math.PI);
      break;
    }
    case 'sideboard':
    case 'console':
      drawers(b, w, 0.85, h, it.kind === 'sideboard' ? WOOD : '#6d4c3d', 2);
      if (it.kind === 'console') plant(b, 0.5, 0.5, 0.6, seed, 0.85);
      else for (let i = 0; i < 3; i++) cyl(b, 0.8 + i * 1.6, 0.85, 0.5, 0.12, 0.3, ['#3d7df0', '#f2679f', '#f5c518'][i]);
      if (it.kind === 'console') cyl(b, w - 0.6, 0.85, 0.5, 0.12, 0.5, '#f4e3c1', { emissive: '#ffcf80', emissiveIntensity: 0.6 });
      break;
    case 'cabinet':
    case 'dresser':
    case 'nightstand':
    case 'towelCabinet':
    case 'toyChest':
    case 'desk': {
      const heights: Record<string, number> = { cabinet: 1.4, dresser: 1.0, nightstand: 0.6, towelCabinet: 1.3, toyChest: 0.6, desk: 0.78 };
      const colors: Record<string, string> = { cabinet: WOOD, dresser: '#a8738b', nightstand: WOOD_L, towelCabinet: '#ffffff', toyChest: '#3d7df0', desk: '#f2d16b' };
      const side = it.kind === 'dresser' || it.kind === 'towelCabinet';
      drawers(b, w, heights[it.kind], h, colors[it.kind], it.kind === 'nightstand' ? 1 : 3, side ? 'x' : 'z');
      if (it.kind === 'nightstand') {
        cyl(b, w / 2, 0.6, h / 2, 0.08, 0.3, '#d4b483');
        cyl(b, w / 2, 0.9, h / 2, 0.18, 0.2, '#fff2d6', { emissive: '#ffcf80', emissiveIntensity: 0.8 }, 0.1);
      }
      if (it.kind === 'desk') {
        box(b, 0.4, 0.78, 0.2, 0.5, 0.3, 0.05, '#2d2d2d');
        books(b, 1.2, 0.78, 0.2, 0.6, 0.3, 0.25, seed);
      }
      break;
    }
    case 'plant':
      plant(b, 0.5, 0.5, 1, seed);
      break;
    case 'bookshelf': {
      const vertical = h > w;
      const W = vertical ? 0.5 : w, D = vertical ? h : 0.5;
      const ox = vertical ? w - 0.55 : 0, oz = 0;
      box(b, ox, 0, oz, W, 2.0, D, WOOD_D);
      for (let s = 0; s < 4; s++) {
        const y = 0.12 + s * 0.48;
        if (vertical) {
          for (let k = 0; k < D - 0.2; k += 0.9) books(b, ox - 0.02, y, oz + 0.1 + k, 0.1, 0.8, 0.38, seed + s * 7 + k);
        } else books(b, ox + 0.1, y, oz + 0.47, W - 0.2, 0.06, 0.38, seed + s * 7);
      }
      break;
    }
    case 'piano':
      box(b, 0.05, 0, 0.1, w - 0.1, 1.0, 0.7, '#1c1c22', { rough: 0.25 });
      box(b, 0.15, 0.7, 0.8, w - 0.3, 0.08, 0.35, '#1c1c22', { rough: 0.25 });
      box(b, 0.2, 0.78, 0.82, w - 0.4, 0.03, 0.25, '#fafafa', { rough: 0.3 });
      for (let x = 0.3; x < w - 0.3; x += 0.15) box(b, x, 0.8, 0.82, 0.06, 0.03, 0.14, '#111');
      box(b, 0.6, 0, 1.3, w - 1.2, 0.5, 0.45, '#2d1d14');
      break;
    case 'clock':
      box(b, 0.15, 0, 0.2, 0.7, 2.1, 0.6, WOOD_D);
      cyl(b, 0.5, 1.6, 0.8, 0.25, 0.03, '#fdf6e3').rotation.x = Math.PI / 2;
      cbox(b, 0.5, 0.9, 0.81, 0.08, 0.6, 0.02, '#d4b483', { metal: 0.7, rough: 0.3 });
      break;
    case 'bench':
      box(b, 0.1, 0.45, 0.15, w - 0.2, 0.08, h - 0.3, WOOD_L);
      legs(b, w, h, 0.45, 0.25, WOOD_D);
      break;
    case 'tv':
      drawers(b, w, 0.5, h, '#3a3a44', 1);
      box(b, 0.3, 0.6, 0.35, w - 0.6, 1.1, 0.08, '#111');
      box(b, 0.36, 0.66, 0.43, w - 0.72, 0.98, 0.01, '#5aa9e6', { emissive: '#3d7df0', emissiveIntensity: 0.9 });
      break;
    case 'sofa':
      sofa(b, w, h + 0.4, '#d65b5b', 'n');
      b.group.position.z -= 0.2;
      break;
    case 'armchair':
      sofa(b, w, h, '#6aa36f', 'w');
      break;
    case 'coveredSofa':
      sofa(b, w, h, '#ecebe4', 'e');
      // sheet that drapes to the floor except a gap the nugget can crawl into
      box(b, 0.02, 0.18, 0.02, w - 0.04, 0.8, h - 0.04, '#f4f3ee', { rough: 1 });
      b.top = 0.18;
      break;
    case 'coffeeTable':
      table(b, w, h, 0.55, WOOD);
      b.top = 0.55;
      ball(b, w / 2, 0.62, h / 2, 0.3, 0.12, 0.3, '#f2679f');
      break;
    case 'gameTable':
      table(b, w, h, 0.75, '#2f7d4f');
      b.top = 0.75;
      for (let i = 0; i < 6; i++) cbox(b, 0.5 + (i % 3) * 0.5, 0.78, 0.7 + Math.floor(i / 3) * 0.6, 0.12, 0.04, 0.12, i % 2 ? '#e8424a' : '#fafafa');
      break;
    case 'roundTable':
      cyl(b, w / 2, 0.72, h / 2, 0.9, 0.06, WOOD_L);
      cyl(b, w / 2, 0, h / 2, 0.06, 0.72, WOOD_D);
      cyl(b, w / 2, 0, h / 2, 0.4, 0.04, WOOD_D);
      b.top = 0.72;
      cyl(b, w / 2 + 0.2, 0.78, h / 2, 0.1, 0.25, '#3d7df0');
      plant(b, w / 2 - 0.3, h / 2, 0.35, seed, 0.78);
      break;
    case 'fireplace':
      box(b, 0.4, 0, 0, 0.6, 1.4, h, '#b5654a');
      box(b, 0.3, 1.3, -0.05, 0.75, 0.12, h + 0.1, '#e8d8c8');
      box(b, 0.39, 0.1, 0.45, 0.02, 0.7, h - 0.9, '#1a0d08');
      for (let i = 0; i < 3; i++) cone(b, 0.33, 0.1, 0.65 + i * 0.3, 0.1, 0.35 + (i % 2) * 0.15, i % 2 ? '#ffcc33' : '#ff6a1a', { emissive: '#ff6a1a', emissiveIntensity: 2.2 });
      break;
    case 'dogBed': {
      cyl(b, w / 2, 0, h / 2, 0.85, 0.22, '#8e5cc9');
      cyl(b, w / 2, 0.05, h / 2, 0.68, 0.2, '#e8d8f0');
      ball(b, w / 2 + 0.3, 0.28, h / 2, 0.25, 0.08, 0.1, '#f5f5f5'); // bone
      break;
    }
    case 'bed':
      bed(b, w, h, it.color ?? '#3d7df0', false);
      b.top = 0.45;
      break;
    case 'bigBed':
      bed(b, w, h, it.color ?? '#e6c3d0', true);
      b.top = 0.45;
      break;
    case 'beanbag':
      ball(b, w / 2, 0.3, h / 2, w * 0.85, 0.65, h * 0.95, '#f2679f', { rough: 0.95 });
      break;
    case 'bathtub':
      box(b, 0.05, 0, 0.05, w - 0.1, 0.65, h - 0.1, '#fdfdfd', { rough: 0.2 });
      box(b, 0.2, 0.55, 0.2, w - 0.4, 0.12, h - 0.4, '#8fd3f4', { rough: 0.05, emissive: '#245a7a', emissiveIntensity: 0.3 });
      for (let i = 0; i < 5; i++) ball(b, 0.5 + i * 0.45, 0.7, 0.6 + (i % 2) * 0.5, 0.25, 0.18, 0.25, '#ffffff');
      ball(b, 2.2, 0.75, 1.2, 0.12, 0.12, 0.12, '#f5c518'); // duck
      break;
    case 'toilet':
      box(b, 0.25, 0, 0.05, 0.5, 0.95, 0.22, '#fdfdfd', { rough: 0.2 });
      cyl(b, 0.5, 0, 0.55, 0.22, 0.45, '#fdfdfd', { rough: 0.2 });
      break;
    case 'sink':
      drawers(b, w, 0.8, h, '#ffffff', 1);
      cbox(b, w / 2, 0.86, 0.5, 0.8, 0.12, 0.55, '#eef6f8', { rough: 0.2 });
      box(b, 0.3, 1.0, 0.0, w - 0.6, 0.8, 0.04, '#cfe8ff', { rough: 0.05, metal: 0.6 }); // mirror
      break;
    case 'laundry':
      box(b, 0.05, 0, 0.05, 0.9, 0.9, 0.9, '#f5f5f5', { rough: 0.3 });
      cyl(b, 0.05, 0.45, 0.5, 0.28, 0.02, '#8fb7d4', { rough: 0.1 }).rotation.z = Math.PI / 2;
      break;
    case 'wardrobe':
      box(b, 0.05, 0, 0.05, w - 0.1, 2.1, h - 0.1, '#9a6a44');
      cbox(b, w / 2, 1.05, h - 0.04, 0.02, 1.9, 0.02, '#5e3b22');
      for (const s of [-1, 1]) cbox(b, w / 2 + s * 0.12, 1.1, h - 0.04, 0.04, 0.25, 0.04, '#d4b483', { metal: 0.6 });
      break;
    case 'rocker':
      chair(b, 0.5, 0.5, Math.PI / 2 + 0.6);
      break;
    case 'boxes': {
      const R = rng(seed);
      for (let i = 0; i < w * h + 1; i++) {
        const s = 0.5 + R() * 0.35;
        const x = 0.1 + R() * (w - s - 0.1), z = 0.1 + R() * (h - s - 0.1);
        box(b, x, i > w * h - 1 ? 0.75 : 0, z, s, 0.75, s, shade('#c8a26b', (R() - 0.5) * 0.25));
        box(b, x, (i > w * h - 1 ? 0.75 : 0) + 0.74, z + s / 2 - 0.04, s, 0.02, 0.08, '#e8d8a8');
      }
      break;
    }
    case 'trunk':
      box(b, 0.1, 0, 0.1, w - 0.2, 0.6, h - 0.2, '#6a4a2a');
      box(b, 0.08, 0.6, 0.08, w - 0.16, 0.12, h - 0.16, '#4a2f1a');
      cbox(b, w / 2, 0.55, h - 0.08, 0.15, 0.15, 0.04, '#d4b483', { metal: 0.7 });
      break;
    case 'mannequin':
      cyl(b, 0.5, 0, 0.5, 0.2, 0.05, '#333');
      cyl(b, 0.5, 0, 0.5, 0.03, 1.0, '#333');
      ball(b, 0.5, 1.3, 0.5, 0.42, 0.65, 0.3, '#e8d2b8');
      break;
    case 'teepee':
      cone(b, w / 2, 0, h / 2, 0.95, 1.8, '#f4e1c1', { rough: 1 });
      cone(b, w / 2, 0.6, h / 2, 0.64, 1.2, '#e8424a', { rough: 1 });
      for (let i = 0; i < 3; i++) cyl(b, w / 2, 1.6, h / 2, 0.02, 0.5, WOOD_D).rotation.z = (i - 1) * 0.35;
      b.top = 0.3;
      break;
    case 'toyBox':
      box(b, 0.05, 0, 0.05, w - 0.1, 0.6, h - 0.1, '#58c13f');
      ball(b, 0.6, 0.75, 0.5, 0.35, 0.35, 0.35, '#f68b2a');
      cbox(b, 1.5, 0.75, 0.5, 0.35, 0.3, 0.35, '#3d7df0');
      ball(b, 2.4, 0.72, 0.5, 0.3, 0.3, 0.3, '#f5c518');
      break;
    case 'rockingHorse':
      ball(b, 0.5, 0.55, 0.5, 0.6, 0.3, 0.25, '#e8424a');
      ball(b, 0.8, 0.8, 0.5, 0.2, 0.3, 0.18, '#e8424a');
      box(b, 0.1, 0, 0.35, 0.8, 0.08, 0.3, WOOD);
      break;
    case 'shelf':
      storeShelf(b, w, h, it.color ?? '#e8424a', seed);
      b.top = 2.1;
      break;
    case 'rack':
      storeRack(b, w, h, seed);
      b.top = 2.2;
      break;
    case 'freezer':
      chestFreezer(b, w, h, it.color ?? '#5fb7e8', seed);
      break;
    case 'produce': {
      // fruit stand on legs: the nugget hides underneath
      const R = rng(seed);
      table(b, w, h, 0.8, WOOD_L);
      box(b, 0.04, 0.8, 0.04, w - 0.08, 0.12, h - 0.08, WOOD);
      const fruit = it.color ?? '#e74c3c';
      for (let i = 0; i < w * h * 9; i++)
        ball(b, 0.2 + R() * (w - 0.4), 0.95 + R() * 0.08, 0.2 + R() * (h - 0.4), 0.17, 0.17, 0.17, shade(fruit, (R() - 0.5) * 0.25));
      box(b, w / 2 - 0.3, 0.95, -0.02, 0.6, 0.22, 0.03, '#ffffff'); // price card
      b.top = 0.8;
      break;
    }
    case 'checkout':
      box(b, 0.05, 0, 0.1, w - 0.1, 0.9, h - 0.2, '#2e9e5b');
      box(b, 0.1, 0.9, 0.15, w - 0.6, 0.03, h - 0.3, '#222831', { rough: 0.6 }); // belt
      box(b, w - 0.5, 0.9, 0.2, 0.4, 0.25, 0.45, '#dfe3e8'); // register
      box(b, w - 0.45, 1.15, 0.3, 0.3, 0.22, 0.04, '#1f2a36', { emissive: '#3aa3ff', emissiveIntensity: 0.5 });
      cyl(b, w - 0.3, 0.9, 0.15, 0.03, 0.9, '#c9ced6', { metal: 0.5 }); // lane light pole
      ball(b, w - 0.3, 1.85, 0.15, 0.14, 0.14, 0.14, '#f5c518', { emissive: '#f5c518', emissiveIntensity: 0.6 });
      break;
    case 'deli': {
      const L = longSide(w, h);
      const R = rng(seed);
      L.box(b, 0.05, 0, 0.1, L.len - 0.1, 0.8, L.depth - 0.2, '#b9443f');
      let a = 0.2;
      while (a < L.len - 0.4) {
        const col = ['#d9776c', '#f2c6a0', '#c9584b', '#efe0b0'][Math.floor(R() * 4)];
        L.box(b, a, 0.8, 0.2, 0.35, 0.12, L.depth - 0.4, col);
        a += 0.45;
      }
      L.box(b, 0.05, 0.8, 0.1, L.len - 0.1, 0.5, 0.04, '#cfeeff', { rough: 0.05, metal: 0.2, emissive: '#5aa8d8', emissiveIntensity: 0.15 });
      L.box(b, 0.05, 1.3, 0.1, L.len - 0.1, 0.04, L.depth - 0.2, '#e8e8e8');
      break;
    }
    case 'cart': {
      for (const [x, z] of [[0.2, 0.2], [0.8, 0.2], [0.2, 0.8], [0.8, 0.8]]) {
        cyl(b, x, 0, z, 0.05, 0.06, '#222');
        cyl(b, x, 0.06, z, 0.02, 0.36, '#b8bec7', { metal: 0.7 });
      }
      box(b, 0.1, 0.42, 0.1, 0.8, 0.04, 0.8, '#b8bec7', { metal: 0.7, rough: 0.3 });
      for (const [x, z, ww, dd] of [[0.1, 0.1, 0.8, 0.03], [0.1, 0.87, 0.8, 0.03], [0.1, 0.1, 0.03, 0.8], [0.87, 0.1, 0.03, 0.8]])
        box(b, x, 0.46, z, ww, 0.42, dd, '#c9ced6', { metal: 0.7, rough: 0.3 });
      box(b, 0.1, 0.95, 0.88, 0.8, 0.05, 0.05, '#e8424a'); // handle
      b.top = 0.42;
      break;
    }
    case 'pallet': {
      const R = rng(seed);
      for (const z of [0.1, h / 2 - 0.06, h - 0.22]) box(b, 0.05, 0, z, w - 0.1, 0.32, 0.12, WOOD_L);
      box(b, 0.05, 0.32, 0.05, w - 0.1, 0.05, h - 0.1, WOOD);
      for (let i = 0; i < w * h * 2; i++) {
        const s = 0.4 + R() * 0.2;
        box(b, 0.1 + R() * (w - s - 0.2), 0.37 + (i % 2) * 0.45, 0.1 + R() * (h - s - 0.2), s, 0.45, s, shade('#c8a26b', (R() - 0.5) * 0.3));
      }
      b.top = 0.32;
      break;
    }
    case 'bakery': {
      const R = rng(seed);
      table(b, w, h, 0.85, '#efe0c8');
      for (let i = 0; i < 10; i++)
        ball(b, 0.3 + R() * (w - 0.6), 0.92, 0.3 + R() * (h - 0.6), 0.32, 0.14, 0.18, shade('#c98a3c', (R() - 0.5) * 0.3));
      for (let i = 0; i < 6; i++) cyl(b, 0.3 + R() * (w - 0.6), 0.85, 0.3 + R() * (h - 0.6), 0.1, 0.06, '#f2679f'); // donuts
      b.top = 0.85;
      break;
    }
    case 'officeDesk':
      table(b, w, h, 0.78, '#6b4a32');
      box(b, w / 2 - 0.35, 0.78, 0.15, 0.7, 0.45, 0.05, '#1f2a36', { emissive: '#3a7bd5', emissiveIntensity: 0.4 }); // monitor
      box(b, w / 2 - 0.4, 0.78, 0.45, 0.8, 0.02, 0.25, '#333');
      box(b, 0.3, 0.78, 0.55, 0.5, 0.12, 0.12, '#f5c518', { metal: 0.6 }); // name plate
      cyl(b, w - 0.4, 0.78, 0.4, 0.06, 0.12, '#ffffff'); // coffee mug
      chair(b, w / 2, h + 0.1, -Math.PI / 2);
      b.top = 0.78;
      break;
    case 'trophyCase':
      box(b, 0.05, 0, 0.05, w - 0.1, 1.8, h - 0.1, '#5e3b22');
      for (const y of [0.6, 1.2]) box(b, 0.1, y, 0.1, w - 0.2, 0.03, h - 0.2, '#cfeeff', { rough: 0.1 });
      for (let i = 0; i < 3; i++) {
        cyl(b, 0.35 + i * 0.6, 1.23, 0.5, 0.08, 0.05, '#f5c518', { metal: 0.8, rough: 0.25 });
        cyl(b, 0.35 + i * 0.6, 1.28, 0.5, 0.04, 0.12, '#f5c518', { metal: 0.8, rough: 0.25 });
        ball(b, 0.35 + i * 0.6, 1.45, 0.5, 0.16, 0.14, 0.16, '#f5c518', { metal: 0.8, rough: 0.25 });
      }
      box(b, 0.3, 0.65, 0.5, 0.6, 0.45, 0.04, '#ffffff'); // "employee of the month" photo
      box(b, 0.36, 0.71, 0.53, 0.48, 0.33, 0.01, '#9fd3c7');
      break;
    // ------------------------------------------------ farm (Level 3)
    case 'hay': {
      // golden hay bales with twine: the nugget burrows in to hide
      const R = rng(seed);
      for (let x = 0; x < w; x++)
        for (let z = 0; z < h; z++) {
          const c = shade('#e3c46e', (R() - 0.5) * 0.15);
          box(b, x + 0.06, 0, z + 0.08, 0.88, 0.62, 0.84, c, { rough: 1 });
          for (const t of [0.3, 0.7]) box(b, x + 0.04, 0, z + t * 0.84 + 0.06, 0.92, 0.64, 0.03, '#a8742e');
          for (let i = 0; i < 6; i++) box(b, x + 0.1 + R() * 0.7, 0.62, z + 0.1 + R() * 0.7, 0.18, 0.02, 0.02, shade(c, 0.12));
        }
      b.top = 0.62;
      break;
    }
    case 'haystack': {
      // a round, beehive-shaped haystack with loose straws sticking out
      const R = rng(seed);
      const r = Math.min(w, h) * 0.48;
      cyl(b, w / 2, 0, h / 2, r, 1.0, '#e0bd62', { rough: 1 }, r * 0.92);
      cone(b, w / 2, 1.0, h / 2, r * 0.98, 1.05, '#e8c86e', { rough: 1 });
      for (let i = 0; i < 14; i++) {
        const a = R() * Math.PI * 2;
        const straw = box(b, w / 2 + Math.cos(a) * r * 0.95, 0.15 + R() * 0.8, h / 2 + Math.sin(a) * r * 0.95, 0.24, 0.025, 0.025, '#f2d886');
        straw.rotation.set(0, -a, (R() - 0.5) * 0.8);
      }
      b.top = 2;
      break;
    }
    case 'trough': {
      const L = longSide(w, h);
      L.box(b, 0.1, 0.12, 0.2, L.len - 0.2, 0.4, L.depth - 0.4, '#8a5a36');
      L.box(b, 0.18, 0.3, 0.28, L.len - 0.36, 0.23, L.depth - 0.56, '#5fb7e8', { rough: 0.1, metal: 0.2 });
      for (const a of [0.2, L.len - 0.3]) L.box(b, a, 0, 0.25, 0.1, 0.14, L.depth - 0.5, WOOD_D);
      break;
    }
    case 'coop': {
      // a little red hen house on stilts with a ramp
      legs(b, w, h, 0.62, 0.15, WOOD_D, 0.06);
      box(b, 0.05, 0.62, 0.05, w - 0.1, 0.75, h - 0.1, '#b5402f');
      box(b, 0.25, 0.75, h - 0.06, 0.4, 0.4, 0.03, '#3a2416'); // hatch
      for (let i = 0; i < 3; i++) box(b, 1.0 + i * 0.6, 0.85, h - 0.06, 0.35, 0.3, 0.02, '#f2d886');
      const roof = box(b, -0.1, 1.35, -0.1, w + 0.2, 0.08, h + 0.2, '#6b4a3a');
      roof.rotation.x = 0.12;
      box(b, w / 2 - 0.2, 0.0, h - 0.05, 0.4, 0.04, 0.7, WOOD_L).rotation.x = -0.75;
      b.top = 0.62;
      break;
    }
    case 'hen': {
      // a white hen: same shape as the nugget's cousins
      ball(b, 0.5, 0.22, 0.5, 0.3, 0.26, 0.36, '#fbfaf4');
      ball(b, 0.5, 0.42, 0.66, 0.16, 0.18, 0.16, '#fbfaf4');
      cone(b, 0.5, 0.4, 0.78, 0.03, 0.06, '#f5a623').rotation.x = Math.PI / 2;
      ball(b, 0.5, 0.53, 0.66, 0.05, 0.08, 0.1, '#d62828'); // comb
      ball(b, 0.5, 0.3, 0.3, 0.12, 0.2, 0.08, '#efe8d8'); // tail
      for (const x of [0.44, 0.56]) cyl(b, x, 0, 0.5, 0.015, 0.1, '#f5a623');
      break;
    }
    case 'tractor': {
      // a big green tractor: crawl under between the wheels
      const L = longSide(w, h);
      const body = '#3f8f4a';
      L.box(b, 0.3, 0.6, 0.35, L.len - 0.6, 0.45, L.depth - 0.7, body, { rough: 0.5, metal: 0.2 });
      L.box(b, L.len - 1.2, 1.05, 0.3, 0.9, 0.85, L.depth - 0.6, body, { rough: 0.5, metal: 0.2 }); // cab
      L.box(b, L.len - 1.15, 1.25, 0.28, 0.8, 0.5, L.depth - 0.56, '#bfe6ff', { rough: 0.05, metal: 0.3 });
      L.box(b, L.len - 1.3, 1.9, 0.2, 1.1, 0.06, L.depth - 0.4, '#f5c518');
      L.box(b, 0.5, 1.05, L.depth / 2 - 0.06, 0.12, 0.6, 0.12, '#333'); // exhaust
      const wheel = (a: number, d: number, r: number) => {
        const m = L.vertical ? cyl(b, d, r, a, r, 0.32, '#222') : cyl(b, a, r, d, r, 0.32, '#222');
        m.position.y = r;
        m.rotation.set(L.vertical ? 0 : Math.PI / 2, 0, L.vertical ? Math.PI / 2 : 0);
      };
      for (const d of [0.12, L.depth - 0.12]) { wheel(L.len - 0.75, d, 0.6); wheel(0.6, d, 0.38); }
      b.top = 0.6;
      break;
    }
    case 'corn': {
      // a row of tall corn: stalks, leaves and yellow cobs
      const R = rng(seed);
      for (let x = 0; x < w; x++)
        for (let z = 0; z < h; z++)
          for (let k = 0; k < 3; k++) {
            const px = x + 0.2 + R() * 0.6, pz = z + 0.2 + R() * 0.6;
            const tall = 1.9 + R() * 0.5;
            cyl(b, px, 0, pz, 0.04, tall, shade('#6aa84f', (R() - 0.5) * 0.2));
            for (let l = 0; l < 3; l++) {
              const leaf = box(b, px - 0.02, 0.5 + l * 0.45, pz - 0.25, 0.04, 0.05, 0.5, shade('#4f8a3c', (R() - 0.5) * 0.2));
              leaf.rotation.set(0.5, R() * Math.PI, 0);
            }
            if (R() < 0.6) ball(b, px + 0.06, 1.1 + R() * 0.4, pz, 0.08, 0.22, 0.08, '#f5c518');
            cone(b, px, tall, pz, 0.06, 0.3, '#d9b25a');
          }
      b.top = 2.2;
      break;
    }
    case 'cow': {
      // a friendly black and white cow (or brown, with a color)
      const L = longSide(w, h);
      const hide = it.color ?? '#fbfaf4';
      const spot = it.color ? shade(it.color, -0.3) : '#222222';
      const g = builder(false, true);
      ball(g, L.len / 2, 0.8, 0, L.len * 0.62, 0.62, 0.62, hide);
      ball(g, L.len / 2 - 0.25, 0.92, 0.24, 0.35, 0.3, 0.2, spot);
      ball(g, L.len / 2 + 0.3, 0.75, -0.25, 0.3, 0.32, 0.18, spot);
      ball(g, L.len - 0.15, 1.0, 0, 0.36, 0.34, 0.32, hide); // head
      ball(g, L.len + 0.02, 0.9, 0, 0.18, 0.16, 0.24, '#f2b8b0'); // nose
      for (const s of [-1, 1]) {
        ball(g, L.len - 0.05, 1.08, s * 0.1, 0.05, 0.06, 0.05, '#1d1410');
        cone(g, L.len - 0.2, 1.15, s * 0.14, 0.03, 0.14, '#efe0b0');
      }
      for (const [a, d] of [[0.35, -0.18], [0.35, 0.18], [L.len - 0.55, -0.18], [L.len - 0.55, 0.18]]) cyl(g, a, 0, d, 0.06, 0.55, hide);
      ball(g, L.len / 2 - 0.1, 0.48, 0, 0.18, 0.1, 0.16, '#f2b8b0');
      g.group.position.set(L.vertical ? w / 2 : 0, 0, L.vertical ? 0 : h / 2);
      g.group.rotation.y = L.vertical ? -Math.PI / 2 : 0;
      b.group.add(g.group);
      b.mats.push(...g.mats);
      break;
    }
    case 'pigsty': {
      // a low fence around a muddy patch with two pink pigs
      for (let x = 0; x <= w; x += 0.5) for (const z of [0.05, h - 0.05]) box(b, x - 0.04, 0, z - 0.04, 0.08, 0.6, 0.08, WOOD);
      for (let z = 0; z <= h; z += 0.5) for (const x of [0.05, w - 0.05]) box(b, x - 0.04, 0, z - 0.04, 0.08, 0.6, 0.08, WOOD);
      for (const y of [0.25, 0.5]) {
        box(b, 0, y, 0, w, 0.06, 0.05, WOOD_L);
        box(b, 0, y, h - 0.08, w, 0.06, 0.05, WOOD_L);
        box(b, 0, y, 0, 0.05, 0.06, h, WOOD_L);
        box(b, w - 0.08, y, 0, 0.05, 0.06, h, WOOD_L);
      }
      box(b, 0.2, 0, 0.2, w - 0.4, 0.03, h - 0.4, '#5e4026', { rough: 0.3 });
      for (const [px, pz, f] of [[1.4, 1.3, 0.4], [3.4, 2.5, -2.2]] as const) {
        const pig = builder(false, true);
        ball(pig, 0, 0.32, 0, 0.75, 0.5, 0.5, '#f4a7b9');
        ball(pig, 0.42, 0.38, 0, 0.32, 0.32, 0.32, '#f4a7b9');
        cyl(pig, 0.6, 0.34, 0, 0.08, 0.08, '#e88aa0').rotation.z = Math.PI / 2;
        for (const s of [-1, 1]) {
          ball(pig, 0.52, 0.47, s * 0.08, 0.04, 0.05, 0.04, '#1d1410');
          ball(pig, 0.38, 0.55, s * 0.12, 0.08, 0.1, 0.04, '#e88aa0');
        }
        for (const [a, d] of [[-0.2, -0.13], [-0.2, 0.13], [0.2, -0.13], [0.2, 0.13]]) cyl(pig, a, 0, d, 0.05, 0.18, '#f4a7b9');
        pig.group.position.set(px, 0, pz);
        pig.group.rotation.y = f;
        b.group.add(pig.group);
        b.mats.push(...pig.mats);
      }
      break;
    }
    case 'well': {
      cyl(b, w / 2, 0, h / 2, w * 0.42, 0.75, '#9e988a', { rough: 0.95 });
      cyl(b, w / 2, 0.74, h / 2, w * 0.34, 0.02, '#2a4a6a', { rough: 0.1 });
      for (const s of [-1, 1]) box(b, w / 2 + s * w * 0.36 - 0.05, 0.75, h / 2 - 0.05, 0.1, 1.0, 0.1, WOOD_D);
      cyl(b, w / 2 - w * 0.36, 1.45, h / 2, 0.06, w * 0.72, WOOD).rotation.z = Math.PI / 2;
      const roof = cone(b, w / 2, 1.65, h / 2, w * 0.55, 0.6, '#b5402f');
      roof.rotation.y = Math.PI / 4;
      cyl(b, w / 2, 0.95, h / 2, 0.12, 0.2, '#8a5a36'); // bucket
      break;
    }
    case 'scarecrow': {
      cyl(b, 0.5, 0, 0.5, 0.04, 1.8, WOOD_D);
      box(b, -0.1, 1.3, 0.47, 1.2, 0.06, 0.06, WOOD_D);
      box(b, 0.25, 0.85, 0.35, 0.5, 0.6, 0.3, '#5b8bd6'); // shirt
      box(b, -0.05, 1.25, 0.4, 1.1, 0.14, 0.2, '#5b8bd6');
      ball(b, 0.5, 1.68, 0.5, 0.32, 0.34, 0.32, '#e8d3a0'); // sack head
      for (const s of [-1, 1]) ball(b, 0.5 + s * 0.07, 1.72, 0.66, 0.04, 0.04, 0.02, '#1d1410');
      cyl(b, 0.5, 1.82, 0.5, 0.3, 0.03, '#d9b25a');
      cyl(b, 0.5, 1.84, 0.5, 0.14, 0.16, '#d9b25a');
      for (let i = 0; i < 4; i++) box(b, 0.1 + i * 0.25, 1.12, 0.48, 0.03, 0.14, 0.03, '#f2d886'); // straw
      b.top = 1.9;
      break;
    }
    case 'pumpkins': {
      const R = rng(seed);
      box(b, 0.05, 0, 0.05, w - 0.1, 0.02, h - 0.1, '#5e4026', { rough: 1 });
      for (let i = 0; i < w * h * 2; i++) {
        const x = 0.35 + R() * (w - 0.7), z = 0.35 + R() * (h - 0.7), s = 0.35 + R() * 0.25;
        ball(b, x, s * 0.4, z, s, s * 0.75, s, shade('#f68b2a', (R() - 0.5) * 0.2));
        cyl(b, x, s * 0.75, z, 0.03, 0.1, '#5e7a2a');
      }
      break;
    }
    case 'workbench':
      table(b, w, h, 0.85, WOOD_L);
      box(b, 0.1, 0.85, 0.1, w - 0.2, 0.02, 0.06, '#5e3b22');
      box(b, 0.3, 0.85, 0.3, 0.5, 0.08, 0.3, '#c0392b', { metal: 0.4 }); // toolbox
      box(b, 1.2, 0.85, 0.35, 0.35, 0.06, 0.06, '#7c858f', { metal: 0.6 }); // hammer
      box(b, 1.2, 0.85, 0.28, 0.06, 0.06, 0.22, '#b07a4c');
      // pegboard with tools behind it
      box(b, 0.05, 0.9, 0.02, w - 0.1, 1.0, 0.04, '#d2b48c');
      for (let i = 0; i < 5; i++) box(b, 0.4 + i * 0.7, 1.15, 0.06, 0.06, 0.5, 0.03, ['#7c858f', '#c0392b', '#f5c518'][i % 3], { metal: 0.4 });
      b.top = 0.85;
      break;
    case 'barrel':
      cyl(b, 0.5, 0, 0.5, 0.36, 0.95, WOOD, {}, 0.32);
      for (const y of [0.15, 0.75]) cyl(b, 0.5, y, 0.5, 0.37, 0.05, '#555', { metal: 0.5 });
      cyl(b, 0.5, 0.95, 0.5, 0.31, 0.02, WOOD_D);
      break;
    case 'wheelbarrow': {
      box(b, 0.1, 0.4, 0.15, 0.8, 0.3, 0.7, '#3d7df0', { metal: 0.3, rough: 0.4 });
      cyl(b, 0.5, 0.18, 0.92, 0.18, 0.08, '#222').rotation.x = Math.PI / 2;
      for (const x of [0.2, 0.8]) {
        box(b, x - 0.02, 0, 0.2, 0.04, 0.4, 0.04, '#555');
        box(b, x - 0.02, 0.45, -0.1, 0.04, 0.04, 0.3, '#555');
      }
      b.top = 0.4;
      break;
    }
    case 'milkCans':
      for (const [x, z] of [[0.3, 0.3], [0.7, 0.35], [0.45, 0.72]]) {
        cyl(b, x, 0, z, 0.15, 0.5, '#c9ced6', { metal: 0.7, rough: 0.3 });
        cyl(b, x, 0.5, z, 0.09, 0.12, '#c9ced6', { metal: 0.7, rough: 0.3 });
        cyl(b, x, 0.6, z, 0.11, 0.03, '#9aa3ad', { metal: 0.7 });
      }
      break;
    case 'woodpile': {
      const L = longSide(w, h);
      for (let r = 0; r < 3; r++)
        for (let i = 0; i < Math.floor(L.len * 3) - r; i++) {
          const a = 0.18 + r * 0.16 + i * 0.32;
          const log = L.vertical ? cyl(b, 0.5, 0.15 + r * 0.27, a, 0.15, 0.8, shade(WOOD_L, ((i * 7 + r) % 5) * 0.03), {}) : cyl(b, a, 0.15 + r * 0.27, 0.5, 0.15, 0.8, shade(WOOD_L, ((i * 7 + r) % 5) * 0.03));
          log.position.y = 0.15 + r * 0.27;
          log.rotation.set(L.vertical ? 0 : Math.PI / 2, 0, L.vertical ? Math.PI / 2 : 0);
        }
      break;
    }
    default:
      box(b, 0.05, 0, 0.05, w - 0.1, 0.8, h - 0.1, WOOD);
  }
  b.group.position.set(it.x, 0, it.y);
  return b;
}
