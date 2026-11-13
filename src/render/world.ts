/**
 * Builds the 3D house: one group per floor with floors, walls, doors, stairs,
 * furniture and the garden outside.
 */
import { THREE, mat, cutaway, floorTexture, grassTexture, labelTexture, canvasTexture, builder, box, cyl, cone, ball } from './kit';
import { buildFurniture } from './furniture';
import { drawSymbol, makeCanvas, rng, shade } from './paint';
import type { FloorMap } from '../game/map';
import { KEY_INFO, type FloorStyle, type KeyColor } from '../game/types';
import { ARENA, ROAD_ARENA } from '../game/boss';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const WALL_H = 2.3;
const DOOR_H = 1.9;
/** Farm fences and their gates. */
const FENCE_H = 1.15;
const GATE_H = 1.1;

export interface DoorView {
  color: KeyColor;
  x: number;
  y: number;
  hinge: THREE.Group;
  /** 0 closed .. 1 open (animated). */
  amount: number;
  swing: number;
}

export interface HideView {
  x: number;
  y: number;
  w: number;
  h: number;
  mats: THREE.Material[];
  fade: number;
}

export interface FloorView {
  id: number;
  group: THREE.Group;
  doors: DoorView[];
  hides: HideView[];
  lights: [number, number][];
}

/** Collects colored quads into one BufferGeometry. */
class QuadBatch {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  uv: number[] = [];
  idx: number[] = [];

  quad(a: number[], b: number[], c: number[], d: number[], n: number[], color: THREE.Color, uvs?: number[][]) {
    const base = this.pos.length / 3;
    for (const p of [a, b, c, d]) {
      this.pos.push(p[0], p[1], p[2]);
      this.nor.push(n[0], n[1], n[2]);
      this.col.push(color.r, color.g, color.b);
    }
    const u = uvs ?? [[a[0], a[2]], [b[0], b[2]], [c[0], c[2]], [d[0], d[2]]];
    for (const t of u) this.uv.push(t[0] / 2, t[1] / 2);
    this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.idx);
    return g;
  }
}

const WHITE = new THREE.Color('#ffffff');

function doorTexture(color: KeyColor) {
  const info = KEY_INFO[color];
  const { c, ctx } = makeCanvas(128, 240, 2);
  ctx.fillStyle = info.hex;
  ctx.fillRect(0, 0, 128, 240);
  ctx.strokeStyle = shade(info.dark, -0.2);
  ctx.lineWidth = 5;
  ctx.strokeRect(16, 18, 96, 80);
  ctx.strokeRect(16, 130, 96, 92);
  ctx.fillStyle = shade(info.hex, 0.15);
  ctx.fillRect(19, 21, 90, 74);
  ctx.fillRect(19, 133, 90, 86);
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(64, 58, 28, 0, Math.PI * 2);
  ctx.fill();
  drawSymbol(ctx, info.symbol, 64, 59, 36, info.dark);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(104, 124, 7, 0, Math.PI * 2);
  ctx.fill();
  return canvasTexture(c);
}

function stairBlocks(map: FloorMap) {
  const seen = new Set<number>();
  const blocks: { dir: 'up' | 'down'; x0: number; y0: number; x1: number; y1: number }[] = [];
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const s = map.isStairs(x, y);
      if (!s || seen.has(y * map.w + x)) continue;
      let x1 = x, y1 = y;
      while (map.isStairs(x1 + 1, y) === s) x1++;
      while (map.isStairs(x, y1 + 1) === s) y1++;
      for (let yy = y; yy <= y1; yy++) for (let xx = x; xx <= x1; xx++) seen.add(yy * map.w + xx);
      blocks.push({ dir: s, x0: x, y0: y, x1, y1 });
    }
  return blocks;
}

export type OutsideKind = 'garden' | 'parking' | 'farm';

/**
 * Bakes every mesh under `root` into one mesh per material, so scenery made of hundreds of
 * little boxes (corn rows, fences) costs a handful of draw calls.
 */
export function mergeByMaterial(root: THREE.Object3D): THREE.Group {
  root.updateMatrixWorld(true);
  const buckets = new Map<THREE.Material, THREE.BufferGeometry[]>();
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || Array.isArray(o.material)) return;
    const g = o.geometry.clone().applyMatrix4(o.matrixWorld);
    for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    let list = buckets.get(o.material);
    if (!list) buckets.set(o.material, (list = []));
    list.push(g);
  });
  const out = new THREE.Group();
  for (const [m, geos] of buckets) {
    const merged = mergeGeometries(geos);
    for (const g of geos) g.dispose();
    if (!merged) continue;
    const mesh = new THREE.Mesh(merged, m);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    out.add(mesh);
  }
  return out;
}

export function buildFloor(map: FloorMap, outsideKind: OutsideKind = 'garden'): FloorView {
  const house = outsideKind === 'garden';
  const farm = outsideKind === 'farm';
  const group = new THREE.Group();
  const id = map.def.id;
  const roomOf = (x: number, y: number) => {
    if (!map.inBounds(x, y)) return undefined;
    const r = map.room[y * map.w + x];
    return r >= 0 ? map.def.rooms[r] : undefined;
  };
  const hallStyle: FloorStyle = map.def.rooms.find((r) => !r.door)?.style ?? 'wood';
  const hallWall = map.def.rooms.find((r) => !r.door)?.wall ?? '#d9cbb0';
  // On the farm, walls out in the open are wooden fences (and their doors are gates):
  // only the barn and the shed get real walls.
  const indoorNear = (x: number, y: number) => {
    for (let dy = -1; dy <= 1; dy++)
      for (let dx = -1; dx <= 1; dx++) {
        const r = roomOf(x + dx, y + dy);
        if (r && !r.outdoor) return true;
      }
    return false;
  };
  const isFence = (x: number, y: number) => farm && map.inBounds(x, y) && (map.isWall(x, y) || !!map.door(x, y)) && !indoorNear(x, y);

  // ---------------------------------------------------------------- floors
  const floors = new Map<FloorStyle, QuadBatch>();
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      // (farm fences and gates stand on the grass)
      if ((map.isWall(x, y) && !isFence(x, y)) || map.isStairs(x, y) === 'down') continue;
      const style = roomOf(x, y)?.style ?? hallStyle;
      let q = floors.get(style);
      if (!q) floors.set(style, (q = new QuadBatch()));
      q.quad([x, 0, y], [x, 0, y + 1], [x + 1, 0, y + 1], [x + 1, 0, y], [0, 1, 0], WHITE);
    }
  for (const [style, q] of floors) {
    const m = new THREE.Mesh(q.geometry(), mat('#ffffff', { map: floorTexture(style), rough: style === 'bathTile' || style === 'checker' ? 0.4 : 0.75 }));
    m.receiveShadow = true;
    group.add(m);
  }

  // ---------------------------------------------------------------- walls
  const walls = new QuadBatch();
  const top = new THREE.Color('#7a6150');
  const outside = new THREE.Color('#d8b48a');
  const H = WALL_H;
  const sideColor = (x: number, y: number) => {
    if (!map.inBounds(x, y)) return outside;
    if (map.door(x, y)) return new THREE.Color(hallWall);
    return new THREE.Color(roomOf(x, y)?.wall ?? hallWall);
  };
  const face = (x: number, y: number, side: 'n' | 's' | 'e' | 'w', y0: number, y1: number, c: THREE.Color) => {
    const base = c.clone().multiplyScalar(0.55);
    const bands: [number, number, THREE.Color][] = y0 === 0 ? [[0, 0.16, base], [0.16, y1, c]] : [[y0, y1, c]];
    for (const [a, b2, col] of bands) {
      if (side === 'n') walls.quad([x + 1, a, y], [x, a, y], [x, b2, y], [x + 1, b2, y], [0, 0, -1], col);
      if (side === 's') walls.quad([x, a, y + 1], [x + 1, a, y + 1], [x + 1, b2, y + 1], [x, b2, y + 1], [0, 0, 1], col);
      if (side === 'w') walls.quad([x, a, y], [x, a, y + 1], [x, b2, y + 1], [x, b2, y], [-1, 0, 0], col);
      if (side === 'e') walls.quad([x + 1, a, y + 1], [x + 1, a, y], [x + 1, b2, y], [x + 1, b2, y + 1], [1, 0, 0], col);
    }
  };
  const solidWall = (x: number, y: number) => map.isWall(x, y) && map.inBounds(x, y) && !isFence(x, y);
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const isDoor = !!map.door(x, y);
      if (isFence(x, y)) continue;
      if (!solidWall(x, y) && !isDoor) continue;
      const y0 = isDoor ? DOOR_H : 0;
      walls.quad([x, H, y], [x, H, y + 1], [x + 1, H, y + 1], [x + 1, H, y], [0, 1, 0], top);
      // cap at the cutaway height, seen only when the wall in front of the nugget is cut down
      if (!isDoor) walls.quad([x, 0.55, y], [x, 0.55, y + 1], [x + 1, 0.55, y + 1], [x + 1, 0.55, y], [0, 1, 0], top);
      if (isDoor) walls.quad([x, y0, y + 1], [x, y0, y], [x + 1, y0, y], [x + 1, y0, y + 1], [0, -1, 0], top);
      const sides: [number, number, 'n' | 's' | 'e' | 'w'][] = [[x, y - 1, 'n'], [x, y + 1, 's'], [x - 1, y, 'w'], [x + 1, y, 'e']];
      for (const [nx, ny, side] of sides) {
        if (solidWall(nx, ny)) continue;
        if (map.door(nx, ny) && !isDoor) {
          face(x, y, side, 0, H, sideColor(nx, ny));
          continue;
        }
        if (isDoor && map.door(nx, ny)) continue;
        face(x, y, side, y0, H, sideColor(nx, ny));
      }
    }
  const wallMesh = new THREE.Mesh(walls.geometry(), cutaway(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 })));
  wallMesh.castShadow = true;
  wallMesh.receiveShadow = true;
  group.add(wallMesh);

  // ---------------------------------------------------------------- doors
  const doors: DoorView[] = map.doors.map((d) => {
    const texture = doorTexture(d.color);
    const info = KEY_INFO[d.color];
    const edge = mat(info.dark, { cut: true });
    const faceMat = cutaway(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.6, emissive: info.hex, emissiveIntensity: 0.12 }));
    // farm gates in the fences are only waist high
    const ph = isFence(d.x, d.y) ? GATE_H : DOOR_H;
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.96, ph - 0.04, 0.1), [edge, edge, edge, edge, faceMat, faceMat]);
    panel.castShadow = true;
    panel.receiveShadow = true;
    const hinge = new THREE.Group();
    // Panels are modelled along +x; vertical doors get turned 90 degrees.
    panel.position.set(0.48, ph / 2, 0);
    hinge.add(panel);
    const holder = new THREE.Group();
    if (d.orient === 'h') holder.position.set(d.x + 0.02, 0, d.y + 0.5);
    else {
      holder.position.set(d.x + 0.5, 0, d.y + 0.98);
      holder.rotation.y = Math.PI / 2;
    }
    holder.add(hinge);
    // threshold glow strip so locked doors read from far away
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.96, 0.03, 0.5), new THREE.MeshBasicMaterial({ color: info.hex, transparent: true, opacity: 0.55 }));
    strip.position.set(0.48, 0.015, 0);
    holder.add(strip);
    group.add(holder);
    // Swing into the room behind the door (local +z is south for 'h', east for 'v').
    const behindPlus = d.color === 'gold' && house ? true
      : d.orient === 'h' ? roomOf(d.x, d.y + 1)?.door === d.color : roomOf(d.x + 1, d.y)?.door === d.color;
    return { color: d.color, x: d.x, y: d.y, hinge, amount: 0, swing: behindPlus ? -1 : 1 };
  });
  // The front door is a pair: mirror the right-hand one so they open like French doors.
  const golds = doors.filter((d) => d.color === 'gold').sort((a, b) => a.x - b.x);
  if (golds.length === 2) {
    const right = golds[1].hinge.parent!;
    right.position.x += 0.96;
    right.rotation.y = Math.PI;
    golds[1].swing = 1;
  }

  // ---------------------------------------------------------------- stairs
  for (const s of stairBlocks(map)) {
    const w = s.x1 - s.x0 + 1, h = s.y1 - s.y0 + 1;
    const toWest = s.x0 - 0 < map.w - 1 - s.x1;
    const steps = 6;
    const b = builder(false, true);
    for (let i = 0; i < steps; i++) {
      const t = (i + 1) / steps;
      const sx = toWest ? s.x0 + w - (i + 1) * (w / steps) : s.x0 + i * (w / steps);
      if (s.dir === 'up') box(b, sx, 0, s.y0, w / steps, t * 1.3, h, i % 2 ? '#a77a52' : '#b98a5e');
      else box(b, sx, -3, s.y0, w / steps, 3 - t * 1.5, h, i % 2 ? '#7a5638' : '#8a6444');
    }
    if (s.dir === 'down') {
      // dark pit walls around the descending steps
      box(b, s.x0, -3, s.y0 - 0.05, w, 3, 0.05, '#2a1d14');
      box(b, s.x0, -3, s.y1 + 1, w, 3, 0.05, '#2a1d14');
    }
    // banister
    for (const z of [s.y0 + 0.05, s.y1 + 0.95]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, 0.06), mat('#5e3b22', { cut: true }));
      rail.position.set(s.x0 + w / 2, s.dir === 'up' ? 1.3 : 0.9, z);
      rail.rotation.z = s.dir === 'up' ? (toWest ? -1 : 1) * 0.5 : (toWest ? 1 : -1) * 0.5;
      rail.castShadow = true;
      b.group.add(rail);
    }
    group.add(b.group);
    const sign = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(s.dir === 'up' ? '▲ Upstairs' : '▼ Downstairs', s.dir === 'up' ? '#9fe6a0' : '#f5b942'), depthTest: false }));
    sign.scale.set(1.6, 0.45, 1);
    sign.position.set(s.x0 + w / 2, 2.0, s.y0 + h / 2);
    sign.renderOrder = 5;
    group.add(sign);
  }

  // ---------------------------------------------------------------- furniture
  const hides: HideView[] = [];
  const staticFurniture = new THREE.Group();
  for (const it of map.def.furniture) {
    const f = buildFurniture(it);
    // farm scenery is made of lots of little pieces: bake the ones that never fade
    if (farm && it.block !== 'hide') staticFurniture.add(f.group);
    else group.add(f.group);
    if (it.block === 'hide') {
      for (const m of f.mats) m.transparent = true;
      hides.push({ x: it.x, y: it.y, w: it.w, h: it.h, mats: f.mats, fade: 1 });
    }
  }

  if (staticFurniture.children.length) group.add(mergeByMaterial(staticFurniture));

  // ---------------------------------------------------------------- fences (farm)
  if (farm) group.add(buildFences(map, isFence));

  // ---------------------------------------------------------------- outside
  const M = 14;
  const grass = house || farm ? mat('#ffffff', { map: grassTexture(farm), rough: 1 }) : mat('#4a4d52', { rough: 0.95 });
  const strips: [number, number, number, number][] = [
    [-M, -M, map.w + 2 * M, M], [-M, map.h, map.w + 2 * M, M], [-M, 0, M, map.h], [map.w, 0, M, map.h],
  ];
  for (const [x, z, w, d] of strips) {
    const g = new THREE.PlaneGeometry(w, d);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (uv.getX(i) * w) / 3, (uv.getY(i) * d) / 3);
    const m = new THREE.Mesh(g, grass);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x + w / 2, -0.02, z + d / 2);
    m.receiveShadow = true;
    group.add(m);
  }
  const R = rng(id * 101 + 5);
  const yard = builder(false, false);
  for (let i = 0; i < (house ? 26 : farm ? 40 : 0); i++) {
    const side = i % 4;
    const along = R();
    const out = 1.6 + R() * 6;
    const x = side < 2 ? along * (map.w + 8) - 4 : side === 2 ? -out : map.w + out;
    const z = side >= 2 ? along * (map.h + 8) - 4 : side === 0 ? -out : map.h + out;
    // keep the fenced front garden (the boss arena) clear
    if (house && id === 0 && x > ARENA.x0 - 1 && x < ARENA.x1 + 1 && z > map.h - 0.5 && z < ARENA.y1 + 1) continue;
    // the farm: keep the road in front and the farmhouse behind clear
    if (farm && (z > map.h - 1 && z < map.h + 4 || (z < 0 && x > map.w - 18 && x < map.w + 2))) continue;
    // ...and the field across the road, where the Farmer boss fight happens
    if (farm && x > ROAD_ARENA.x0 - 1.5 && x < ROAD_ARENA.x1 + 1.5 && z > map.h - 1 && z < ROAD_ARENA.y1 + 1.5) continue;
    const s = 0.8 + R() * 0.8;
    cyl(yard, x, 0, z, 0.12 * s, 1.0 * s, '#6b4a2a');
    cone(yard, x, 0.8 * s, z, 0.9 * s, 1.6 * s, shade('#2f6b3a', (R() - 0.5) * 0.3));
    cone(yard, x, 1.6 * s, z, 0.65 * s, 1.2 * s, shade('#3a7d45', (R() - 0.5) * 0.3));
  }
  if (outsideKind === 'parking') storefront(yard, map, R);
  if (farm) farmland(yard, map, R);
  if (house && id === 0) {
    const gold = map.doors.find((d) => d.color === 'gold');
    if (gold) {
      box(yard, gold.x - 0.1, -0.01, map.h, 2.2, 0.03, ARENA.y1 - map.h + 4, '#cdb89a');
      // flower beds along the house wall
      for (let i = 0; i < 7; i++) {
        ball(yard, ARENA.x0 + 0.5 + i * 0.8, 0.15, map.h + 0.35, 0.3, 0.3, 0.3, ['#f2679f', '#f5c518', '#e8424a'][i % 3]);
        ball(yard, ARENA.x1 - 0.5 - i * 0.8, 0.15, map.h + 0.35, 0.3, 0.3, 0.3, ['#9b5de5', '#f68b2a', '#ffffff'][i % 3]);
      }
      // white picket fence around the front garden, with a gate at the end of the path
      const post = (x: number, z: number) => {
        box(yard, x - 0.05, 0, z - 0.05, 0.1, 0.7, 0.1, '#f4f1e8');
        cone(yard, x, 0.7, z, 0.07, 0.12, '#f4f1e8');
      };
      for (let x = ARENA.x0; x <= ARENA.x1 + 0.01; x += 0.4) {
        if (Math.abs(x - (gold.x + 1)) > 1.1) post(x, ARENA.y1);
      }
      for (let z = map.h + 0.4; z <= ARENA.y1; z += 0.4) { post(ARENA.x0, z); post(ARENA.x1, z); }
      for (const h of [0.25, 0.5]) {
        box(yard, ARENA.x0, h, ARENA.y1 - 0.03, gold.x + 1 - 1.1 - ARENA.x0, 0.06, 0.06, '#f4f1e8');
        box(yard, gold.x + 2.1, h, ARENA.y1 - 0.03, ARENA.x1 - gold.x - 2.1, 0.06, 0.06, '#f4f1e8');
        box(yard, ARENA.x0 - 0.03, h, map.h + 0.4, 0.06, 0.06, ARENA.y1 - map.h - 0.4, '#f4f1e8');
        box(yard, ARENA.x1 - 0.03, h, map.h + 0.4, 0.06, 0.06, ARENA.y1 - map.h - 0.4, '#f4f1e8');
      }
      // a picnic table and a barbecue: just past the fence, where Uncle Gus was having his feast
      box(yard, ARENA.x1 - 3.2, 0.7, ARENA.y1 + 1.0, 2.2, 0.08, 1.0, '#8a5a36');
      for (const [dx, dz] of [[0.15, 0.1], [2.0, 0.1], [0.15, 0.85], [2.0, 0.85]]) box(yard, ARENA.x1 - 3.2 + dx, 0, ARENA.y1 + 1.0 + dz, 0.08, 0.7, 0.08, '#5e3b22');
      cyl(yard, ARENA.x1 - 2.1, 0.78, ARENA.y1 + 1.5, 0.2, 0.1, '#d62828');
      cyl(yard, ARENA.x0 + 1.4, 0, ARENA.y1 + 1.6, 0.05, 0.8, '#333');
      ball(yard, ARENA.x0 + 1.4, 0.95, ARENA.y1 + 1.6, 0.7, 0.45, 0.7, '#2d2d2d', { rough: 0.4, metal: 0.4 });
      // porch lamp
      cyl(yard, gold.x - 0.3, 0, map.h + 0.4, 0.05, 1.6, '#333');
      ball(yard, gold.x - 0.3, 1.7, map.h + 0.4, 0.22, 0.22, 0.22, '#fff2c4', { emissive: '#ffcc66', emissiveIntensity: 2 });
    }
  }
  group.add(yard.group);

  if (map.def.spills?.length) group.add(buildSpills(map));
  if (map.def.mud?.length) group.add(buildMud(map));

  const lights: [number, number][] = [...map.def.lights];
  return { id, group, doors, hides, lights };
}

/** Outside the grocery store: a parking lot with cars, lamps, a cart corral and the sliding entrance doors. */
function storefront(yard: ReturnType<typeof builder>, map: FloorMap, R: () => number) {
  const W = map.w, H = map.h;
  const ex = Math.floor(W / 2) - 2; // entrance: 4 tiles in the middle of the bottom wall
  // sidewalk along the front
  box(yard, -2, -0.005, H, W + 4, 0.03, 2, '#c9c4b8');
  // parking stripes
  for (let x = -1; x < W + 1; x += 2.6) {
    if (x > ex - 1 && x < ex + 5) continue;
    box(yard, x, 0.0, H + 2.6, 0.08, 0.02, 3.6, '#f4f1e8');
  }
  // crosswalk to the doors
  for (let i = 0; i < 6; i++) box(yard, ex + 0.2 + i * 0.65, 0.0, H + 2.2, 0.38, 0.02, 4, '#f4f1e8');
  // parked cars
  const colors = ['#e8424a', '#3d7df0', '#f5c518', '#ffffff', '#58c13f', '#9b5de5', '#222831'];
  for (let x = -0.2; x < W; x += 2.6) {
    if (x > ex - 1.5 && x < ex + 5 || R() < 0.3) continue;
    const c = colors[Math.floor(R() * colors.length)];
    const z = H + 3;
    box(yard, x + 0.45, 0.25, z, 1.7, 0.55, 3.2, c, { rough: 0.35, metal: 0.4 });
    box(yard, x + 0.6, 0.8, z + 0.7, 1.4, 0.5, 1.7, '#a9d6f5', { rough: 0.05, metal: 0.3 });
    box(yard, x + 0.6, 1.28, z + 0.7, 1.4, 0.04, 1.7, c, { rough: 0.35, metal: 0.4 });
    for (const [dx, dz] of [[0.4, 0.5], [2.1, 0.5], [0.4, 2.7], [2.1, 2.7]]) {
      const w = cyl(yard, x + dx, 0.25, z + dz, 0.25, 0.2, '#1d1d1d');
      w.rotation.z = Math.PI / 2;
    }
  }
  // street lamps
  for (const x of [-1.5, W / 4, (3 * W) / 4, W + 1.5]) {
    cyl(yard, x, 0, H + 7.5, 0.07, 3.2, '#555');
    box(yard, x - 0.3, 3.2, H + 7.3, 0.6, 0.12, 0.4, '#444');
    box(yard, x - 0.25, 3.15, H + 7.35, 0.5, 0.05, 0.3, '#fff2c4', { emissive: '#ffdd88', emissiveIntensity: 2 });
  }
  // cart corral
  for (let i = 0; i < 4; i++) box(yard, ex + 6 + i * 0.05, 0.42, H + 1.2 + i * 0.25, 0.8, 0.45, 0.8, '#c9ced6', { metal: 0.6, rough: 0.3 });
  // sliding glass doors (both faces of the wall) and the FreshMart sign
  // (outside face only, so nothing stands between the camera and the nugget inside)
  box(yard, ex, 0, H, 4, 2.2, 0.03, '#bfe6ff', { rough: 0.05, metal: 0.3, emissive: '#4a8bb8', emissiveIntensity: 0.15 });
  box(yard, ex + 1.98, 0, H - 0.01, 0.04, 2.2, 0.05, '#9aa3ad', { metal: 0.6 });
  box(yard, ex - 1, 2.25, H + 0.02, 6, 0.7, 0.1, '#2e9e5b', { emissive: '#2e9e5b', emissiveIntensity: 0.3 });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 0.62), new THREE.MeshBasicMaterial({ map: labelTexture('FreshMart', '#ffffff'), transparent: true }));
  sign.position.set(ex + 2, 2.6, H + 0.13);
  yard.group.add(sign);
  // welcome mat inside
  box(yard, ex + 0.3, 0.005, H - 2.4, 3.4, 0.02, 1.2, '#2e9e5b', { rough: 1 });
}

/** Shiny water puddles over the spill tiles, each spill with a yellow wet-floor sign. */
function buildSpills(map: FloorMap) {
  const g = new THREE.Group();
  const water = new THREE.MeshStandardMaterial({
    color: '#8fd3ff', roughness: 0.04, metalness: 0.35, transparent: true, opacity: 0.72,
    emissive: '#2a7ab8', emissiveIntensity: 0.35, depthWrite: false,
  });
  const disc = new THREE.CircleGeometry(0.5, 20);
  const R = rng(map.def.id * 7 + 3);
  for (const [sx, sy, sw, sh] of map.def.spills ?? []) {
    for (let y = sy; y < sy + sh; y++)
      for (let x = sx; x < sx + sw; x++)
        for (let k = 0; k < 2; k++) {
          const m = new THREE.Mesh(disc, water);
          m.rotation.x = -Math.PI / 2;
          m.rotation.z = R() * Math.PI;
          m.scale.set(0.95 + R() * 0.5, 0.75 + R() * 0.45, 1);
          m.position.set(x + 0.5 + (R() - 0.5) * 0.35, 0.012 + k * 0.002, y + 0.5 + (R() - 0.5) * 0.35);
          m.renderOrder = 1;
          g.add(m);
        }
    // a little splash of droplets
    const b = builder(false, false);
    for (let i = 0; i < sw * sh * 2; i++)
      ball(b, sx + R() * sw, 0.02, sy + R() * sh, 0.08, 0.02, 0.08, '#cfeeff', { rough: 0.05, metal: 0.3 });
    // yellow "wet floor" A-frame sign on the first spill tile
    const sign = builder(false, false);
    for (const t of [-0.32, 0.32]) {
      const pane = box(sign, -0.18, 0, -0.025, 0.36, 0.62, 0.05, '#f5c518', { rough: 0.5 });
      pane.rotation.x = t;
      pane.position.z += t * 0.25;
      const stripe = box(sign, -0.15, 0.36, -0.03, 0.3, 0.08, 0.06, '#1d1d1d');
      stripe.rotation.x = t;
      stripe.position.z += t * 0.25;
    }
    sign.group.position.set(sx + 0.5, 0, sy + 0.5);
    sign.group.rotation.y = R() * Math.PI;
    g.add(b.group, sign.group);
  }
  return g;
}

/** Wooden board fences along every fence tile, joined to their neighbours. */
function buildFences(map: FloorMap, isFence: (x: number, y: number) => boolean) {
  const b = builder(false, true);
  const wood = '#f1e6cf', post = '#d8c7a6';
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (!isFence(x, y) || map.door(x, y)) continue;
      box(b, x + 0.4, 0, y + 0.4, 0.2, FENCE_H, 0.2, post);
      box(b, x + 0.37, FENCE_H, y + 0.37, 0.26, 0.05, 0.26, shade(post, -0.15));
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy;
        if (!map.inBounds(nx, ny) || !(map.isWall(nx, ny) || map.door(nx, ny))) continue;
        const post2 = isFence(nx, ny) && !map.door(nx, ny);
        // boards run to the next post (drawn once, from the west / north one), or up to a gate or wall
        if (post2 && (dx < 0 || dy < 0)) continue;
        const len = post2 ? 1 : 0.5;
        for (const h of [0.3, 0.62, 0.94]) {
          if (dx) box(b, dx > 0 ? x + 0.5 : x, h, y + 0.45, len, 0.16, 0.1, wood);
          else box(b, x + 0.45, h, dy > 0 ? y + 0.5 : y, 0.1, 0.16, len, wood);
        }
      }
    }
  return mergeByMaterial(b.group);
}

/** Around the farm: the farmhouse behind, fields and a duck pond to the sides, the country road in front. */
function farmland(yard: ReturnType<typeof builder>, map: FloorMap, R: () => number) {
  const W = map.w, H = map.h;
  // the country road along the front, with a bus stop down the road
  box(yard, -14, -0.01, H + 0.2, W + 28, 0.02, 2.6, '#7b7166', { rough: 1 });
  for (let x = -12; x < W + 12; x += 3) box(yard, x, 0.012, H + 1.45, 1.4, 0.005, 0.12, '#f4f1e8');
  // (off to the side, out of the way of the Farmer's tractor)
  const sx = ROAD_ARENA.x0 - 2;
  cyl(yard, sx, 0, H + 0.6, 0.05, 2.2, '#555');
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: labelTexture('BUS STOP', '#f5c518'), transparent: true }));
  sign.position.set(sx, 2.2, H + 0.66);
  yard.group.add(sign);
  // the farmhouse behind the barn and shed: white walls, red roof, a porch
  const fx = W - 16, fz = -9;
  box(yard, fx, 0, fz, 11, 3.2, 6, '#f4efe4');
  const roof = box(yard, fx - 0.4, 3.2, fz - 0.4, 11.8, 0.25, 6.8, '#a3473a');
  roof.rotation.x = 0.05;
  cone(yard, fx + 5.5, 3.4, fz + 3, 6.4, 2, '#a3473a').rotation.y = Math.PI / 4;
  for (let i = 0; i < 4; i++) box(yard, fx + 1 + i * 2.6, 1.2, fz + 6.01, 1, 1.1, 0.04, '#bfe6ff', { rough: 0.1 });
  box(yard, fx + 4.6, 0, fz + 6.01, 1.4, 2.1, 0.05, '#6b4a3a');
  box(yard, fx + 8.5, 3.6, fz + 2, 0.7, 1.4, 0.7, '#9e988a'); // chimney
  // a red silo next to the barn
  cyl(yard, -3.2, 0, 5, 1.6, 6.5, '#b5402f');
  ball(yard, -3.2, 6.5, 5, 3.2, 2.0, 3.2, '#c9ced6', { metal: 0.5, rough: 0.4 });
  // fields: rows of crops to the left and right
  for (const [x0, z0] of [[-13, 12], [W + 2, 12], [W + 2, 26]] as const)
    for (let r = 0; r < 6; r++) {
      box(yard, x0, 0, z0 + r * 1.6, 10, 0.05, 0.9, '#6e4f30', { rough: 1 });
      for (let i = 0; i < 12; i++) ball(yard, x0 + 0.4 + i * 0.8, 0.22, z0 + r * 1.6 + 0.45, 0.4, 0.35, 0.4, shade('#58a05a', (R() - 0.5) * 0.3));
    }
  // the field across the road, where the Farmer comes after the nugget on his tractor:
  // a wooden rail fence round the sides and the back, mown grass and a few tyre tracks
  const A = ROAD_ARENA;
  const rail = (x0: number, z0: number, x1: number, z1: number) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    for (let t = 0; t <= len + 0.01; t += 1.5) {
      const k = len ? t / len : 0;
      box(yard, x0 + (x1 - x0) * k - 0.06, 0, z0 + (z1 - z0) * k - 0.06, 0.12, 0.9, 0.12, '#8a6a45');
    }
    for (const h of [0.35, 0.7]) {
      const m = box(yard, Math.min(x0, x1) - 0.03, h, Math.min(z0, z1) - 0.03, Math.abs(x1 - x0) + 0.06, 0.08, Math.abs(z1 - z0) + 0.06, '#a5825a');
      m.castShadow = true;
    }
  };
  rail(A.x0 - 0.15, H + 3, A.x0 - 0.15, A.y1 + 0.15);
  rail(A.x1 + 0.15, H + 3, A.x1 + 0.15, A.y1 + 0.15);
  rail(A.x0 - 0.15, A.y1 + 0.15, A.x1 + 0.15, A.y1 + 0.15);
  for (let i = 0; i < 5; i++) box(yard, A.x0 + 3 + i * 5.5, 0.005, H + 4 + (i % 2) * 3, 4, 0.01, 0.35, '#6e5a3c', { rough: 1 });
  // a duck pond
  ball(yard, -7, -0.02, 28, 7, 0.1, 5, '#5fb7e8', { rough: 0.05, metal: 0.2 });
  for (const [x, z] of [[-8, 27.5], [-6, 29]]) {
    ball(yard, x, 0.12, z, 0.3, 0.22, 0.4, '#fbfaf4');
    ball(yard, x, 0.3, z + 0.18, 0.14, 0.14, 0.14, '#3f8f4a');
  }
}

/** Squelchy brown mud puddles. */
function buildMud(map: FloorMap) {
  const b = builder(false, false);
  const R = rng(map.def.id * 13 + 9);
  const mud = mat('#5e4026', { rough: 0.35 });
  for (const [sx, sy, sw, sh] of map.def.mud ?? [])
    for (let y = sy; y < sy + sh; y++)
      for (let x = sx; x < sx + sw; x++) {
        ball(b, x + 0.5 + (R() - 0.5) * 0.2, 0.0, y + 0.5 + (R() - 0.5) * 0.2, 1.25 + R() * 0.3, 0.05, 1.1 + R() * 0.3, mud);
        if (R() < 0.6) ball(b, x + R(), 0.02, y + R(), 0.18, 0.04, 0.14, '#7a5636', { rough: 0.3 });
      }
  const g = mergeByMaterial(b.group);
  g.traverse((o) => { if (o instanceof THREE.Mesh) { o.castShadow = false; o.renderOrder = 1; } });
  return g;
}
