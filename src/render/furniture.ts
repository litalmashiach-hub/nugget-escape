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
    default:
      box(b, 0.05, 0, 0.05, w - 0.1, 0.8, h - 0.1, WOOD);
  }
  b.group.position.set(it.x, 0, it.y);
  return b;
}
