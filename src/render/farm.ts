/**
 * Level 3's opening cutscene: the nugget walks out of FreshMart, works out that chickens come
 * from farms, rides the night bus to the countryside and gets off at Clover Hill Farm in the
 * morning. The farmer mistakes it for a runaway chicken, chases it, grabs it and drops it in the pen.
 *
 * Like the other cutscenes, everything is a pure function of the clock `t`.
 */
import { THREE, canvasTexture, labelTexture, builder, box, cyl, cone, ball } from './kit';
import { NuggetModel, PersonModel, faceAngle } from './characters';
import { buildFurniture } from './furniture';
import { bakeBubble, rng, shade } from './paint';
import type { Caption, CutEvent } from './cutscene';

export const FARM_LENGTH = 31;

/** The trip sits far from the levels (and the street cutscene) so nothing overlaps. */
const O = new THREE.Vector3(300, 0, 0);
const WALK_Z = 0.8;
const BUS_Z = 2.7;
/** The bus door is this far ahead of the bus's middle. */
const DOOR_DX = 2.6;
const STOP_X = 6.4; // the city bus stop
const FARM_STOP = 85; // where the bus lets the nugget off
const GATE_X = 91.2; // the farm gate in the roadside fence
const FENCE_Z = -0.5;
const PEN = { x0: 95, x1: 100, z0: -5, drop: new THREE.Vector3(97.5, 0, -2.8) };

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const seg = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const CAPTIONS: { a: number; b: number; who: string; text: string }[] = [
  { a: 0.3, b: 3.5, who: '', text: 'The nugget walks out of FreshMart, still wondering: why am I alive?' },
  { a: 3.6, b: 6.0, who: 'Nugget', text: 'Wait a minute… nuggets come from chickens. And chickens live on FARMS!' },
  { a: 6.1, b: 8.8, who: 'Nugget', text: 'The answers must be at the farm! Here comes the bus!' },
  { a: 9.2, b: 11.6, who: '', text: 'The bus rumbles out of the city, all through the night…' },
  { a: 11.7, b: 14.2, who: '', text: '…and by morning, it reaches the countryside.' },
  { a: 14.4, b: 17.4, who: 'Nugget', text: "A real farm! Somebody here must know why I'm alive." },
  { a: 17.5, b: 21.0, who: 'The Farmer', text: "Huh, you're a chicken, right? Aren't you supposed to be in your pen?" },
  { a: 21.1, b: 22.8, who: 'Nugget', text: "A chicken? No, no, I'm a nugg… AAAH!" },
  { a: 22.9, b: 25.0, who: 'The Farmer', text: 'Come back here, little chicken!' },
  { a: 25.1, b: 27.9, who: 'The Farmer', text: 'Gotcha! Back in the pen you go.' },
  { a: 28.0, b: FARM_LENGTH, who: 'Level 3', text: "You're locked in the pen! Escape it, then escape the farm. Watch out for the farmer and his rake!" },
];

const EVENTS: { t: number; e: CutEvent }[] = [
  { t: 3.7, e: 'pop' },
  { t: 5.4, e: 'pop' },
  { t: 7.9, e: 'pop' },
  { t: 8.35, e: 'jump' },
  { t: 8.85, e: 'land' },
  { t: 14.35, e: 'jump' },
  { t: 14.95, e: 'land' },
  { t: 17.45, e: 'gasp' },
  { t: 21.9, e: 'gasp' },
  { t: 25.05, e: 'jump' },
  { t: 26.45, e: 'jump' },
  { t: 27.25, e: 'land' },
  { t: 27.35, e: 'thud' },
];

/** Where the bus is (its middle, along the road) at time t. */
export function busX(t: number) {
  if (t < 8) return lerp(-30, STOP_X - DOOR_DX, seg(t, 6, 8));
  if (t < 14.1) return lerp(STOP_X - DOOR_DX, FARM_STOP - DOOR_DX, seg(t, 9.2, 14.0));
  return lerp(FARM_STOP - DOOR_DX, 140, seg(t, 15.3, 18.5));
}

/** 0 at night .. 1 in the morning: the sky brightens while the bus drives. */
export function farmSky(t: number) {
  return seg(t, 11.6, 14.0);
}

interface Pose { x: number; z: number; y: number; facing: number; moving: boolean }

function farmerPose(t: number): Pose {
  // waiting by the pen, then over to the gate, a chat, the chase, the grab and the walk back
  if (t < 16.8) return { x: 93.5, z: -3.2, y: 0, facing: Math.PI, moving: false };
  if (t < 17.6) {
    const k = seg(t, 16.8, 17.6);
    return { x: lerp(93.5, GATE_X, k), z: lerp(-3.2, -1.0, k), y: 0, facing: Math.atan2(1.5, -1.9), moving: true };
  }
  if (t < 22.6) return { x: GATE_X, z: -1.0, y: 0, facing: Math.atan2(1.5, -2), moving: false };
  if (t < 23.2) {
    const k = seg(t, 22.6, 23.2);
    return { x: lerp(GATE_X, 91.5, k), z: lerp(-1.0, 0.5, k), y: 0, facing: Math.PI / 2 - k * 1.2, moving: true };
  }
  if (t < 25.0) return { x: lerp(91.5, 95.7, (t - 23.2) / 1.8), z: lerp(0.5, 0.7, (t - 23.2) / 1.8), y: 0, facing: 0, moving: true };
  if (t < 25.6) return { x: 95.7, z: 0.7, y: 0, facing: 0, moving: false };
  if (t < 26.4) {
    const k = seg(t, 25.6, 26.4);
    return { x: lerp(95.7, 96.6, k), z: lerp(0.7, 0.25, k), y: 0, facing: lerp(0, -Math.PI / 2, k), moving: true };
  }
  if (t < 27.8) return { x: 96.6, z: 0.25, y: 0, facing: -Math.PI / 2, moving: false };
  const k = seg(t, 27.8, 30.5);
  return { x: lerp(96.6, 92.5, k), z: 0.25, y: 0, facing: Math.PI, moving: k > 0 && k < 1 };
}

function nuggetPose(t: number): Pose & { opacity: number; carried: boolean } {
  const base = { y: 0, opacity: 1, carried: false };
  if (t < 1.6) return { ...base, x: 0, z: lerp(-0.9, WALK_Z, seg(t, 0, 1.6)), facing: Math.PI / 2, moving: true };
  if (t < 4.6) return { ...base, x: lerp(0, STOP_X, seg(t, 1.6, 4.6)), z: WALK_Z, facing: 0, moving: true };
  if (t < 8.3) {
    // wondering at the camera, then watching the bus pull in
    const facing = t < 6 ? Math.PI / 2 + Math.sin(t * 2.2) * 0.5 : Math.PI * 0.85;
    return { ...base, x: STOP_X, z: WALK_Z, facing, moving: false };
  }
  if (t < 8.9) {
    const k = seg(t, 8.3, 8.9);
    return { ...base, x: STOP_X, z: lerp(WALK_Z, BUS_Z - 1.1, k), y: Math.sin(k * Math.PI) * 0.45, facing: Math.PI / 2, moving: true, opacity: 1 - seg(t, 8.7, 8.9) };
  }
  if (t < 14.3) return { ...base, x: FARM_STOP, z: BUS_Z - 1.1, facing: -Math.PI / 2, moving: false, opacity: 0 };
  if (t < 15.0) {
    const k = seg(t, 14.3, 15.0);
    return { ...base, x: FARM_STOP, z: lerp(BUS_Z - 1.1, 0.7, k), y: Math.sin(k * Math.PI) * 0.45, facing: -Math.PI / 2, moving: true, opacity: seg(t, 14.3, 14.45) };
  }
  if (t < 17.0) {
    const k = seg(t, 15.0, 17.0);
    return { ...base, x: lerp(FARM_STOP, 89.2, k), z: lerp(0.7, 0.5, k), facing: t < 16.4 ? 0 : -Math.PI / 2, moving: k < 0.98 };
  }
  if (t < 22.8) return { ...base, x: 89.2, z: 0.5, facing: Math.atan2(-1.5, 2), moving: false };
  if (t < 24.8) return { ...base, x: lerp(89.2, 96.2, (t - 22.8) / 2), z: lerp(0.5, 0.8, (t - 22.8) / 2), facing: 0, moving: true };
  const f = farmerPose(t);
  const hand = (p: Pose) => ({ x: p.x + Math.cos(p.facing) * 0.55, z: p.z + Math.sin(p.facing) * 0.55 });
  if (t < 25.0) return { ...base, x: 96.2, z: 0.8, facing: Math.PI, moving: false };
  if (t < 26.4) {
    const h = hand(f);
    return { ...base, ...h, y: lerp(0, 1.3, seg(t, 25.0, 25.4)), facing: f.facing + Math.PI, moving: true, carried: true };
  }
  if (t < 27.2) {
    const h = hand(farmerPose(26.4));
    const k = (t - 26.4) / 0.8;
    return { ...base, x: lerp(h.x, PEN.drop.x, k), z: lerp(h.z, PEN.drop.z, k), y: lerp(1.3, 0, k) + Math.sin(k * Math.PI) * 1.1, facing: -Math.PI / 2, moving: true, carried: true };
  }
  const bounce = t < 27.6 ? Math.abs(Math.sin((t - 27.2) * Math.PI * 2.5)) * 0.25 * (1 - (t - 27.2) / 0.4) : 0;
  return { ...base, x: PEN.drop.x, z: PEN.drop.z, y: bounce, facing: t < 28.6 ? Math.PI / 2 : Math.PI / 2 + Math.sin((t - 28.6) * 1.6) * 0.9, moving: false };
}

/** Camera keyframes: [time, position, look-at, follow]. With follow, x is measured from the nugget or the bus. */
type Shot = [number, [number, number, number], [number, number, number], ('n' | 'b')?];
const SHOTS: Shot[] = [
  [0, [-2.5, 2.4, 7.5], [1, 1, 0]],
  [1.6, [-0.6, 1.3, 4.2], [0.6, 0.6, 0.6], 'n'],
  [4.6, [0.8, 1.0, 3.2], [0, 0.6, WALK_Z], 'n'],
  [5.9, [0.8, 1.0, 3.2], [0, 0.6, WALK_Z], 'n'],
  [6.6, [-1.5, 2.6, 9.5], [3, 1.2, 1.2]],
  [9.0, [-1.5, 2.6, 9.5], [3, 1.2, 1.2]],
  [9.6, [-7, 3.4, 10.5], [0, 1.4, BUS_Z], 'b'],
  [13.98, [-4, 2.6, 9], [0, 1.4, BUS_Z], 'b'],
  [14.0, [79, 2.4, 9], [85.5, 1, 0]],
  [15.3, [82, 3.6, 9.5], [91, 1.2, -3]],
  [17.2, [87.4, 1.7, 4.2], [90.3, 1.1, -0.4]],
  [20.8, [88.2, 1.25, 3.1], [89.3, 0.7, 0.3]],
  [22.7, [91.5, 3.6, 8.8], [93, 0.8, 0]],
  [25.0, [94.6, 2.3, 5.6], [96.4, 1.3, -0.6]],
  [27.0, [97.5, 3.8, 3.6], [97.5, 0.3, -2.6]],
  [FARM_LENGTH, [97.5, 2.6, 2.6], [97.5, 0.4, -2.8]],
];

function windowsTexture(seed: number, wall: string) {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 256;
  const ctx = c.getContext('2d')!;
  const R = rng(seed);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 20; y < 236; y += 44)
    for (let x = 14; x < 114; x += 38) {
      ctx.fillStyle = R() < 0.55 ? '#ffe7a3' : '#2c3550';
      ctx.fillRect(x, y, 24, 28);
    }
  return canvasTexture(c);
}

export class FarmCutscene {
  readonly group = new THREE.Group();
  readonly nugget = new NuggetModel();
  readonly farmer = new PersonModel('farmer');
  private bus = new THREE.Group();
  private busDoor: THREE.Mesh;
  private wheels: THREE.Mesh[] = [];
  private doorL: THREE.Mesh;
  private doorR: THREE.Mesh;
  private thought: THREE.Sprite[] = [];
  private idea: THREE.Sprite;
  private alarm: THREE.Sprite;
  private hemi = new THREE.HemisphereLight('#cfe3ff', '#5a4a3a', 0.9);
  private lamp = new THREE.PointLight('#ffe2a8', 6, 14, 1.6);
  private sunDisc: THREE.Mesh;
  t = 0;
  fade = 0;
  caption: Caption | null = null;
  events: CutEvent[] = [];

  constructor() {
    this.group.position.copy(O);
    this.group.visible = false;
    const b = builder(false, false);
    const R = rng(303);

    // the road runs the whole way; city pavement first, then grassy verges
    box(b, -40, -0.03, 1.3, 200, 0.03, 2.9, '#3a3d42', { rough: 0.95 });
    for (let x = -38; x < 158; x += 3) box(b, x, 0.0, 2.68, 1.6, 0.01, 0.12, '#f4f1e8');
    box(b, -40, 0, -1, 62, 0.08, 2.3, '#c9c4b8');
    box(b, 22, -0.02, -30, 138, 0.02, 31.3, '#5d9a45', { rough: 1 });
    box(b, 22, -0.02, 4.2, 138, 0.02, 30, '#5d9a45', { rough: 1 });

    // the city: FreshMart and the houses around it
    const walls = ['#e9b872', '#9fd3c7', '#e6c3d0', '#c9d6f0', '#f2e2b6'];
    for (let x = -30; x < 20; ) {
      const w = 4 + R() * 3, h = 3 + R() * 4;
      if (x > -9 && x < 8) { x = 8; continue; }
      const col = walls[Math.floor(R() * walls.length)];
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), [
        new THREE.MeshStandardMaterial({ color: shade(col, -0.15) }),
        new THREE.MeshStandardMaterial({ color: shade(col, -0.15) }),
        new THREE.MeshStandardMaterial({ color: '#6b4a3a' }),
        new THREE.MeshStandardMaterial({ color: col }),
        new THREE.MeshStandardMaterial({ map: windowsTexture(Math.floor(x * 13), col) }),
        new THREE.MeshStandardMaterial({ color: col }),
      ]);
      m.position.set(x + w / 2, h / 2, -3.1);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      x += w + 0.4;
    }
    box(b, -7, 0, -7, 14, 4.2, 5.9, '#f3eedd');
    box(b, -6.5, 0.2, -1.13, 13, 2.6, 0.05, '#bfe6ff', { rough: 0.05, metal: 0.3, emissive: '#7fb8dd', emissiveIntensity: 0.35 });
    for (let i = 0; i < 7; i++) box(b, -7 + i * 2, 2.9, -1.1, 2, 0.12, 1.4, i % 2 ? '#ffffff' : '#2e9e5b');
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), new THREE.MeshBasicMaterial({ map: labelTexture('FreshMart', '#ffffff'), transparent: true }));
    sign.position.set(0, 3.7, -0.9);
    this.group.add(sign);
    const glass = new THREE.MeshStandardMaterial({ color: '#d8f1ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.6 });
    this.doorL = new THREE.Mesh(new THREE.BoxGeometry(1, 2.3, 0.06), glass);
    this.doorR = new THREE.Mesh(new THREE.BoxGeometry(1, 2.3, 0.06), glass);
    this.group.add(this.doorL, this.doorR);
    // the city bus stop
    cyl(b, STOP_X + 1.1, 0, 0.1, 0.05, 2.3, '#555');
    const stop = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.36), new THREE.MeshBasicMaterial({ map: labelTexture('BUS', '#f5c518'), transparent: true }));
    stop.position.set(STOP_X + 1.1, 2.25, 0.16);
    this.group.add(stop);
    for (let x = -26; x < 20; x += 8) {
      cyl(b, x, 0, 1.0, 0.06, 3, '#555');
      ball(b, x, 3.05, 1.0, 0.3, 0.3, 0.3, '#fff2c4', { emissive: '#ffcc66', emissiveIntensity: 2 });
    }

    // the countryside: rolling hills and trees on both sides of the road
    for (let i = 0; i < 26; i++) {
      const x = 24 + i * 5 + R() * 3;
      for (const z of [-4 - R() * 10, 6 + R() * 8]) {
        if (x > 78 && x < 106 && z < 0) continue; // the farm
        const s = 0.8 + R() * 0.9;
        cyl(b, x, 0, z, 0.14 * s, 1.1 * s, '#6b4a2a');
        ball(b, x, 1.6 * s, z, 1.4 * s, 1.5 * s, 1.4 * s, shade('#3f8f4a', (R() - 0.5) * 0.3));
      }
    }
    for (let i = 0; i < 9; i++) ball(b, 26 + i * 14, -2, -26 - R() * 4, 22, 10 + R() * 6, 12, shade('#6aa84f', (R() - 0.5) * 0.2), { rough: 1 });

    // Clover Hill Farm: roadside fence with a gate, the pen in its corner, a red barn, a silo and the farmhouse
    for (let x = 78; x <= 112; x += 1) {
      if (x > GATE_X - 1.4 && x < GATE_X + 1.4) continue;
      box(b, x - 0.08, 0, FENCE_Z - 0.08, 0.16, 1.15, 0.16, '#d8c7a6');
    }
    for (const h of [0.3, 0.62, 0.94]) {
      box(b, 78, h, FENCE_Z - 0.05, GATE_X - 1.4 - 78, 0.16, 0.1, '#f1e6cf');
      box(b, GATE_X + 1.4, h, FENCE_Z - 0.05, 112 - GATE_X - 1.4, 0.16, 0.1, '#f1e6cf');
      // the pen's three other sides
      box(b, PEN.x0, h, PEN.z0, PEN.x1 - PEN.x0, 0.16, 0.1, '#f1e6cf');
      box(b, PEN.x0, h, PEN.z0, 0.1, 0.16, FENCE_Z - PEN.z0, '#f1e6cf');
      box(b, PEN.x1, h, PEN.z0, 0.1, 0.16, FENCE_Z - PEN.z0, '#f1e6cf');
    }
    for (const [x, z] of [[PEN.x0, PEN.z0], [PEN.x1, PEN.z0], [PEN.x0, -2.7], [PEN.x1, -2.7]]) box(b, x - 0.08, 0, z - 0.08, 0.16, 1.15, 0.16, '#d8c7a6');
    box(b, PEN.x0 + 0.1, 0.005, PEN.z0 + 0.1, PEN.x1 - PEN.x0 - 0.2, 0.01, FENCE_Z - PEN.z0 - 0.2, '#c9a654', { rough: 1 });
    // the farm sign arching over the gate
    for (const s of [-1, 1]) box(b, GATE_X + s * 1.3 - 0.1, 0, FENCE_Z - 0.1, 0.2, 2.8, 0.2, '#8a5a36');
    box(b, GATE_X - 1.5, 2.6, FENCE_Z - 0.1, 3, 0.2, 0.2, '#8a5a36');
    const farmSign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.6), new THREE.MeshBasicMaterial({ map: labelTexture('Clover Hill Farm', '#9fe6a0'), transparent: true }));
    farmSign.position.set(GATE_X, 2.25, FENCE_Z + 0.12);
    this.group.add(farmSign);
    // big red barn
    box(b, 79, 0, -16, 10, 4.5, 8, '#b5402f');
    for (const s of [-1, 1]) {
      const r = box(b, 84 - 2.9 + s * 2.6, 4.2, -16.2, 5.8, 0.25, 8.4, '#6b4a3a');
      r.rotation.z = s * -0.6;
    }
    box(b, 82.5, 0, -8.03, 3, 3.2, 0.06, '#f4efe4');
    box(b, 82.7, 0.1, -7.99, 2.6, 3.0, 0.04, '#b5402f');
    cyl(b, 77, 0, -12, 1.5, 6.5, '#b5402f');
    ball(b, 77, 6.5, -12, 3.0, 2, 3.0, '#c9ced6', { metal: 0.5, rough: 0.4 });
    // the farmhouse
    box(b, 101, 0, -15, 9, 3.2, 6, '#f4efe4');
    cone(b, 105.5, 3.2, -12, 6.2, 2.2, '#a3473a').rotation.y = Math.PI / 4;
    for (let i = 0; i < 3; i++) box(b, 102 + i * 2.7, 1.2, -8.98, 1, 1.1, 0.04, '#bfe6ff', { rough: 0.1 });
    this.group.add(b.group);
    // hay and hens in the pen, a haystack and some corn in the farmyard
    const props = [
      buildFurniture({ kind: 'hen', x: PEN.x0 + 0.8, y: -4.4, w: 1, h: 1, block: 'none' }),
      buildFurniture({ kind: 'hen', x: PEN.x0 + 3.2, y: -4.0, w: 1, h: 1, block: 'none' }),
      buildFurniture({ kind: 'hen', x: PEN.x0 + 1.9, y: -2.3, w: 1, h: 1, block: 'none' }),
      buildFurniture({ kind: 'hay', x: PEN.x1 - 1.1, y: -4.9, w: 1, h: 1, block: 'solid' }),
      buildFurniture({ kind: 'trough', x: PEN.x0 + 0.2, y: -1.8, w: 2, h: 1, block: 'solid' }),
      buildFurniture({ kind: 'haystack', x: 88, y: -6, w: 2, h: 2, block: 'solid' }),
      buildFurniture({ kind: 'corn', x: 102, y: -6, w: 6, h: 2, block: 'solid' }),
    ];
    for (const p of props) this.group.add(p.group);

    // the country bus: green and cream, a destination sign, round wheels
    const bb = builder(false, false);
    box(bb, -3.5, 0.35, -1.2, 7, 1.1, 2.4, '#2e7d4f', { rough: 0.5, metal: 0.2 });
    box(bb, -3.5, 1.45, -1.2, 7, 1.15, 2.4, '#f4efe4', { rough: 0.5 });
    box(bb, -3.45, 2.6, -1.15, 6.9, 0.12, 2.3, '#2e7d4f');
    for (let i = 0; i < 6; i++) for (const z of [-1.21, 1.17]) box(bb, -3.1 + i * 1.0, 1.6, z, 0.8, 0.8, 0.04, '#9fd0f0', { rough: 0.05, metal: 0.3, emissive: '#ffe7a3', emissiveIntensity: 0.25 });
    box(bb, 3.48, 1.5, -1.0, 0.04, 1.0, 2.0, '#9fd0f0', { rough: 0.05, metal: 0.3 }); // windscreen
    for (const z of [-0.8, 0.8]) ball(bb, 3.52, 0.7, z, 0.1, 0.18, 0.18, '#fff2c4', { emissive: '#ffdd88', emissiveIntensity: 2 });
    this.bus.add(bb.group);
    const dest = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.4), new THREE.MeshBasicMaterial({ map: labelTexture('FARMS', '#f5c518'), transparent: true }));
    dest.position.set(3.53, 2.3, 0);
    dest.rotation.y = Math.PI / 2;
    this.bus.add(dest);
    const side = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.5), new THREE.MeshBasicMaterial({ map: labelTexture('Country Line', '#ffffff'), transparent: true }));
    side.position.set(-1, 0.9, -1.22);
    side.rotation.y = Math.PI;
    this.bus.add(side);
    this.busDoor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 2.1, 0.06), new THREE.MeshStandardMaterial({ color: '#3a4a5a', roughness: 0.2, metalness: 0.3 }));
    this.bus.add(this.busDoor);
    for (const x of [-2.4, 2.2])
      for (const z of [-1.15, 1.15]) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 18), new THREE.MeshStandardMaterial({ color: '#1d1d1d', roughness: 0.8 }));
        w.rotation.x = Math.PI / 2;
        w.position.set(x, 0.42, z);
        this.wheels.push(w);
        this.bus.add(w);
      }
    this.bus.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
    this.group.add(this.bus);

    // the sun that comes up while the bus drives
    this.sunDisc = new THREE.Mesh(new THREE.CircleGeometry(4, 32), new THREE.MeshBasicMaterial({ color: '#ffe08a', toneMapped: false, fog: false }));
    this.group.add(this.sunDisc);

    this.lamp.position.set(0, 3, 1.5);
    this.group.add(this.hemi, this.lamp, this.nugget.root, this.farmer.root);
    const qTex = canvasTexture(bakeBubble('?'));
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: qTex, depthTest: false }));
      s.renderOrder = 10;
      s.visible = false;
      this.thought.push(s);
      this.group.add(s);
    }
    this.idea = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(bakeBubble('!')), depthTest: false }));
    this.idea.renderOrder = 10;
    this.alarm = new THREE.Sprite(new THREE.SpriteMaterial({ map: canvasTexture(bakeBubble('!')), depthTest: false }));
    this.alarm.renderOrder = 10;
    this.group.add(this.idea, this.alarm);
  }

  reset() {
    this.t = 0;
    this.fade = 0;
    this.caption = null;
    this.events = [];
  }

  get done() {
    return this.t >= FARM_LENGTH;
  }

  /** 0 night .. 1 morning, for the scene's sky and sunlight. */
  get sky() {
    return farmSky(this.t);
  }

  update(dt: number, camera: THREE.PerspectiveCamera, time: number) {
    const prev = this.t;
    this.t = Math.min(FARM_LENGTH, this.t + dt);
    const t = this.t;
    this.events = EVENTS.filter((e) => e.t > prev && e.t <= t).map((e) => e.e);
    const cap = CAPTIONS.find((c) => t >= c.a && t < c.b);
    this.caption = cap ? { who: cap.who, text: cap.text } : null;
    this.fade = seg(t, FARM_LENGTH - 0.6, FARM_LENGTH);
    this.pose(t, time, dt);

    let i = 0;
    while (i < SHOTS.length - 2 && t >= SHOTS[i + 1][0]) i++;
    const nx = nuggetPose(t).x, bx = busX(t);
    const at = (sh: Shot) => {
      const dx = sh[3] === 'n' ? nx : sh[3] === 'b' ? bx : 0;
      return { p: [sh[1][0] + dx, sh[1][1], sh[1][2]], l: [sh[2][0] + dx, sh[2][1], sh[2][2]] };
    };
    const { p: p0, l: l0 } = at(SHOTS[i]);
    const { p: p1, l: l1 } = at(SHOTS[i + 1]);
    const k = seg(t, SHOTS[i][0], SHOTS[i + 1][0]);
    camera.position.set(O.x + lerp(p0[0], p1[0], k), O.y + lerp(p0[1], p1[1], k), O.z + lerp(p0[2], p1[2], k));
    camera.lookAt(O.x + lerp(l0[0], l1[0], k), O.y + lerp(l0[1], l1[1], k), O.z + lerp(l0[2], l1[2], k));
  }

  /** Point the shadow light should follow (world space). */
  get focus() {
    const n = nuggetPose(this.t);
    const x = n.opacity > 0 ? n.x : busX(this.t);
    return new THREE.Vector3(O.x + x, 0, O.z + Math.min(n.z, 1));
  }

  private pose(t: number, time: number, dt: number) {
    const sky = farmSky(t);
    this.hemi.intensity = lerp(0.8, 1.5, sky);
    this.hemi.color.set('#cfe3ff').lerp(new THREE.Color('#fff4dc'), sky);
    this.lamp.intensity = t < 9.5 ? 6 : 0;
    this.sunDisc.visible = sky > 0.02;
    const bx = busX(t);
    this.sunDisc.position.set(bx + 40, lerp(-6, 18, sky), -60);
    this.sunDisc.lookAt(this.group.position.x + bx, 2, 10);

    // the store doors slide open for the nugget, then close behind it
    const open = seg(t, 0, 0.5) * (1 - seg(t, 1.8, 2.4));
    this.doorL.position.set(-0.5 - open * 0.95, 1.35, -1.1);
    this.doorR.position.set(0.5 + open * 0.95, 1.35, -1.1);

    // the bus, its wheels and door
    this.bus.position.set(bx, 0, BUS_Z);
    this.bus.visible = t > 5.5 && t < 18.5;
    const prevX = busX(Math.max(0, t - 0.05));
    for (const w of this.wheels) w.rotation.y -= ((bx - prevX) / 0.05) * dt / 0.42;
    const doorOpen = seg(t, 8.0, 8.3) * (1 - seg(t, 8.95, 9.2)) + seg(t, 14.0, 14.3) * (1 - seg(t, 15.0, 15.3));
    this.busDoor.position.set(DOOR_DX - doorOpen * 0.85, 1.3, -1.22);

    // the nugget
    const n = this.nugget;
    const np = nuggetPose(t);
    n.root.position.set(np.x, np.y, np.z);
    n.root.scale.setScalar(1.15);
    n.awake = 1;
    n.opacity = np.opacity;
    n.root.visible = np.opacity > 0.01;
    n.mood = t > 21.1 && t < 28.4 ? 'scared' : 'happy';
    n.bottleOut = 0;
    n.animate(np.facing, np.moving, time * (t > 22.8 && t < 25 ? 18 : 10), dt);
    n.inner.rotation.x = t > 3.6 && t < 5.4 ? 0.18 : 0;
    n.inner.position.x = np.carried ? Math.sin(time * 40) * 0.03 : 0;

    // the farmer: rake by his side, then raised for the chase
    const f = this.farmer;
    const fp = farmerPose(t);
    f.root.position.set(fp.x, fp.y, fp.z);
    f.talk = t > 17.5 && t < 21 || t > 22.9 && t < 24.9 || t > 25.1 && t < 27.9 ? 1 : 0;
    f.rakeUp = t > 22.6 && t < 25.0 ? 1 : 0;
    f.lunge = t > 25.0 && t < 25.1 ? 1 : f.lunge;
    // after the grab both hands hold the nugget out in front, then toss it over the fence
    f.armPose = t > 25.2 && t < 27.0 ? { l: -1.45, r: -1.45 } : null;
    f.animate(fp.facing, fp.moving, time * (t > 22.6 && t < 25.2 ? 14 : 8), dt);

    // "?" thoughts while wondering, "!" when it figures it out, "!" again when the farmer spots it
    this.thought.forEach((s, i) => {
      const a = 3.6 + i * 0.5;
      const on = t > a && t < 5.4;
      s.visible = on;
      if (!on) return;
      const k = ((t - a) % 1.8) / 1.8;
      s.position.set(np.x + 0.15 + i * 0.18, 0.9 + k * 0.6, np.z);
      s.scale.setScalar(0.22 + Math.sin(k * Math.PI) * 0.06);
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
    });
    const ideaOn = t > 5.4 && t < 7.6;
    this.idea.visible = ideaOn;
    if (ideaOn) {
      this.idea.position.set(np.x, 1.05 + Math.sin(time * 6) * 0.03, np.z);
      this.idea.scale.setScalar(0.4 * Math.min(1, (t - 5.4) * 5));
    }
    const alarmOn = t > 21.9 && t < 23.4;
    this.alarm.visible = alarmOn;
    if (alarmOn) {
      this.alarm.position.set(np.x, 1.1 + Math.sin(time * 9) * 0.04, np.z);
      this.alarm.scale.setScalar(0.42 * Math.min(1, (t - 21.9) * 6));
    }
    void faceAngle;
  }
}
