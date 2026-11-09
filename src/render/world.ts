/**
 * Builds the 3D house: one group per floor with floors, walls, doors, stairs,
 * furniture and the garden outside.
 */
import { THREE, mat, cutaway, floorTexture, grassTexture, labelTexture, canvasTexture, builder, box, cyl, cone, ball } from './kit';
import { buildFurniture } from './furniture';
import { drawSymbol, makeCanvas, rng, shade } from './paint';
import type { FloorMap } from '../game/map';
import { KEY_INFO, type FloorStyle, type KeyColor } from '../game/types';
import { ARENA } from '../game/boss';

export const WALL_H = 2.3;
const DOOR_H = 1.9;

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

export function buildFloor(map: FloorMap): FloorView {
  const group = new THREE.Group();
  const id = map.def.id;
  const roomOf = (x: number, y: number) => {
    if (!map.inBounds(x, y)) return undefined;
    const r = map.room[y * map.w + x];
    return r >= 0 ? map.def.rooms[r] : undefined;
  };
  const hallStyle: FloorStyle = map.def.rooms.find((r) => !r.door)?.style ?? 'wood';
  const hallWall = map.def.rooms.find((r) => !r.door)?.wall ?? '#d9cbb0';

  // ---------------------------------------------------------------- floors
  const floors = new Map<FloorStyle, QuadBatch>();
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (map.isWall(x, y) || map.isStairs(x, y) === 'down') continue;
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
  const solidWall = (x: number, y: number) => map.isWall(x, y) && map.inBounds(x, y);
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const isDoor = !!map.door(x, y);
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
    const panel = new THREE.Mesh(new THREE.BoxGeometry(0.96, DOOR_H - 0.04, 0.1), [edge, edge, edge, edge, faceMat, faceMat]);
    panel.castShadow = true;
    panel.receiveShadow = true;
    const hinge = new THREE.Group();
    // Panels are modelled along +x; vertical doors get turned 90 degrees.
    panel.position.set(0.48, DOOR_H / 2, 0);
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
    const behindPlus = d.color === 'gold' ? true
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
  for (const it of map.def.furniture) {
    const f = buildFurniture(it);
    group.add(f.group);
    if (it.block === 'hide') {
      for (const m of f.mats) m.transparent = true;
      hides.push({ x: it.x, y: it.y, w: it.w, h: it.h, mats: f.mats, fade: 1 });
    }
  }

  // ---------------------------------------------------------------- outside
  const M = 14;
  const grass = mat('#ffffff', { map: grassTexture(), rough: 1 });
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
  for (let i = 0; i < 26; i++) {
    const side = i % 4;
    const along = R();
    const out = 1.6 + R() * 6;
    const x = side < 2 ? along * (map.w + 8) - 4 : side === 2 ? -out : map.w + out;
    const z = side >= 2 ? along * (map.h + 8) - 4 : side === 0 ? -out : map.h + out;
    // keep the fenced front garden (the boss arena) clear
    if (id === 0 && x > ARENA.x0 - 1 && x < ARENA.x1 + 1 && z > map.h - 0.5 && z < ARENA.y1 + 1) continue;
    const s = 0.8 + R() * 0.8;
    cyl(yard, x, 0, z, 0.12 * s, 1.0 * s, '#6b4a2a');
    cone(yard, x, 0.8 * s, z, 0.9 * s, 1.6 * s, shade('#2f6b3a', (R() - 0.5) * 0.3));
    cone(yard, x, 1.6 * s, z, 0.65 * s, 1.2 * s, shade('#3a7d45', (R() - 0.5) * 0.3));
  }
  if (id === 0) {
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

  const lights: [number, number][] = [...map.def.lights];
  return { id, group, doors, hides, lights };
}
