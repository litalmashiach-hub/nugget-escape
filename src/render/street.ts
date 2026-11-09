/**
 * Level 2's opening cutscene: the nugget wanders down the street wondering why it is
 * alive, spots the FreshMart and decides the answer must be in the grocery store.
 *
 * Like the dinner cutscene, everything is a pure function of the clock `t`.
 */
import { THREE, canvasTexture, labelTexture, builder, box, cyl, cone, ball } from './kit';
import { NuggetModel } from './characters';
import { bakeBubble, makeCanvas, rng, shade } from './paint';
import type { Caption, CutEvent } from './cutscene';

export const STREET_LENGTH = 16;

/** The street sits far from the levels so the two never overlap. */
const O = new THREE.Vector3(200, 0, 0);
const STORE_X = 30; // the store's doors, along the sidewalk
const WALK_Z = 1.2;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const seg = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

const CAPTIONS: { a: number; b: number; who: string; text: string }[] = [
  { a: 0.3, b: 3.2, who: '', text: 'Free at last! The nugget wanders down the street…' },
  { a: 3.3, b: 6.1, who: 'Nugget', text: 'Hmm… why am I alive? What is a nugget even FOR?' },
  { a: 6.2, b: 8.8, who: 'Nugget', text: 'To be dipped in sauce? No way. There has to be more to life!' },
  { a: 8.9, b: 11.4, who: 'Nugget', text: 'The grocery store! They have EVERYTHING in there. They must have the answer!' },
  { a: 11.5, b: 13.6, who: 'Nugget', text: 'Whoever runs that place must know. I just need to get to the manager!' },
  { a: 13.7, b: STREET_LENGTH, who: 'Level 2', text: "Find the key to the Manager's Office. The staff will try to put you back on the shelf!" },
];

const EVENTS: { t: number; e: CutEvent }[] = [
  { t: 3.4, e: 'pop' },
  { t: 8.9, e: 'gasp' },
  { t: 11.6, e: 'jump' },
  { t: 12.1, e: 'land' },
  { t: 12.6, e: 'jump' },
  { t: 13.1, e: 'land' },
];

/** Where the nugget is along the sidewalk at time t. */
function nuggetX(t: number) {
  // slow thoughtful walk, a long stop to wonder, then a happy run to the doors
  if (t < 6.2) return lerp(4, 15, t / 6.2);
  if (t < 9.6) return 15 + seg(t, 6.2, 9.6) * 0.6;
  return lerp(15.6, STORE_X, seg(t, 9.6, 14.4));
}

/**
 * Camera keyframes: [time, position, look-at, follow]. With `follow`, x is measured from
 * the nugget so the close-ups walk along with it.
 */
type Shot = [number, [number, number, number], [number, number, number], boolean?];
const SHOTS: Shot[] = [
  [0, [2, 5.5, 12], [9, 0.8, 0]],
  [3.2, [1.6, 1.9, 5.2], [0, 0.6, 1.0], true],
  [4.2, [1.3, 0.95, 3.6], [0, 0.55, WALK_Z], true],
  [8.7, [1.1, 0.9, 3.3], [0, 0.6, WALK_Z], true],
  [9.6, [11.5, 1.6, 5.5], [STORE_X, 3.2, -0.5]],
  [11.4, [17, 2.2, 7.5], [STORE_X - 1, 2.4, -1]],
  [14.2, [26, 2.8, 8.5], [30, 1.2, -1]],
  [STREET_LENGTH, [30, 3.5, 7], [30, 1.6, -2]],
];

function windowsTexture(seed: number, wall: string) {
  const { c, ctx } = makeCanvas(128, 256, 1);
  const R = rng(seed);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 20; y < 236; y += 44)
    for (let x = 14; x < 114; x += 38) {
      ctx.fillStyle = R() < 0.55 ? '#ffe7a3' : '#2c3550';
      ctx.fillRect(x, y, 24, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + 26, 24, 3);
    }
  return canvasTexture(c);
}

export class StreetCutscene {
  readonly group = new THREE.Group();
  readonly nugget = new NuggetModel();
  private thought: THREE.Sprite[] = [];
  private idea: THREE.Sprite;
  private doorL: THREE.Mesh;
  private doorR: THREE.Mesh;
  t = 0;
  fade = 0;
  caption: Caption | null = null;
  events: CutEvent[] = [];

  constructor() {
    this.group.position.copy(O);
    this.group.visible = false;
    const b = builder(false, false);
    // road, curb and sidewalk
    box(b, -20, -0.03, 2.6, 80, 0.03, 9, '#3a3d42', { rough: 0.95 });
    for (let x = -18; x < 60; x += 3) box(b, x, 0.0, 6.8, 1.6, 0.01, 0.15, '#f4f1e8');
    box(b, -20, 0, 0, 80, 0.08, 2.6, '#c9c4b8');
    box(b, -20, 0, 2.5, 80, 0.12, 0.12, '#9e988a');
    for (let x = -20; x < 60; x += 1.3) box(b, x, 0.081, 0, 0.02, 0.001, 2.6, '#a9a395');

    // houses and shops along the back of the sidewalk
    const R = rng(77);
    const walls = ['#e9b872', '#9fd3c7', '#e6c3d0', '#c9d6f0', '#f2e2b6', '#d6c6a8'];
    for (let x = -18; x < STORE_X - 7; ) {
      const w = 4 + R() * 3, h = 3 + R() * 4;
      const col = walls[Math.floor(R() * walls.length)];
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), [
        new THREE.MeshStandardMaterial({ color: shade(col, -0.15) }),
        new THREE.MeshStandardMaterial({ color: shade(col, -0.15) }),
        new THREE.MeshStandardMaterial({ color: '#6b4a3a' }),
        new THREE.MeshStandardMaterial({ color: col }),
        new THREE.MeshStandardMaterial({ map: windowsTexture(Math.floor(x * 13), col) }),
        new THREE.MeshStandardMaterial({ color: col }),
      ]);
      m.position.set(x + w / 2, h / 2, -2.05);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      cone(b, x + w / 2, h, -2.05, w * 0.62, 1.4, shade('#a3473a', (R() - 0.5) * 0.3));
      x += w + 0.4;
    }
    // trees and street lamps
    for (let x = -10; x < STORE_X - 6; x += 7) {
      cyl(b, x, 0, 0.4, 0.1, 1.2, '#6b4a2a');
      ball(b, x, 1.7, 0.4, 1.3, 1.3, 1.3, shade('#3f8f4a', (R() - 0.5) * 0.3));
      cyl(b, x + 3.5, 0, 2.2, 0.06, 3, '#555');
      ball(b, x + 3.5, 3.05, 2.2, 0.3, 0.3, 0.3, '#fff2c4', { emissive: '#ffcc66', emissiveIntensity: 2 });
    }

    // the FreshMart: wide glass front, green awning and a big sign
    const sx = STORE_X - 7;
    box(b, sx, 0, -6, 14, 4.2, 5.5, '#f3eedd');
    box(b, sx + 0.5, 0.2, -0.53, 13, 2.6, 0.05, '#bfe6ff', { rough: 0.05, metal: 0.3, emissive: '#7fb8dd', emissiveIntensity: 0.35 });
    for (let i = 0; i < 6; i++) box(b, sx + 0.5 + i * 2.6, 0.2, -0.56, 0.08, 2.6, 0.08, '#9aa3ad', { metal: 0.6 });
    for (let i = 0; i < 7; i++) box(b, sx + i * 2, 2.9, -0.5, 2, 0.12, 1.4, i % 2 ? '#ffffff' : '#2e9e5b');
    box(b, sx + 2, 3.2, -0.48, 10, 1.0, 0.1, '#2e9e5b', { emissive: '#2e9e5b', emissiveIntensity: 0.4 });
    box(b, sx - 0.2, 4.2, -6, 14.4, 0.3, 5.7, '#d9d2bd');
    // shelves seen through the glass
    for (let i = 0; i < 5; i++) {
      for (let k = 0; k < 3; k++) box(b, sx + 1 + i * 2.6, 0.3 + k * 0.7, -2.2, 1.8, 0.4, 0.5, ['#e8424a', '#f5c518', '#3d7df0', '#58c13f'][(i + k) % 4]);
    }
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.2), new THREE.MeshBasicMaterial({ map: labelTexture('FreshMart', '#ffffff'), transparent: true }));
    sign.position.set(STORE_X, 3.7, -0.3);
    this.group.add(sign);
    // sliding doors that open as the nugget arrives
    const glass = new THREE.MeshStandardMaterial({ color: '#d8f1ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.6 });
    this.doorL = new THREE.Mesh(new THREE.BoxGeometry(1, 2.3, 0.06), glass);
    this.doorR = new THREE.Mesh(new THREE.BoxGeometry(1, 2.3, 0.06), glass);
    this.group.add(this.doorL, this.doorR);
    box(b, STORE_X - 1.1, 0.0, -0.45, 2.2, 0.02, 0.9, '#2e9e5b');
    this.group.add(b.group);

    // gentle evening light just for the street
    const hemi = new THREE.HemisphereLight('#cfe3ff', '#5a4a3a', 1.1);
    this.group.add(hemi);
    const lamp = new THREE.PointLight('#ffe2a8', 6, 14, 1.6);
    lamp.position.set(STORE_X, 3, 1.5);
    this.group.add(lamp);

    // the nugget, its thought bubbles and the big idea
    this.group.add(this.nugget.root);
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
    this.group.add(this.idea);
  }

  reset() {
    this.t = 0;
    this.fade = 0;
    this.caption = null;
    this.events = [];
  }

  get done() {
    return this.t >= STREET_LENGTH;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, time: number) {
    const prev = this.t;
    this.t = Math.min(STREET_LENGTH, this.t + dt);
    const t = this.t;
    this.events = EVENTS.filter((e) => e.t > prev && e.t <= t).map((e) => e.e);
    const cap = CAPTIONS.find((c) => t >= c.a && t < c.b);
    this.caption = cap ? { who: cap.who, text: cap.text } : null;
    this.fade = seg(t, STREET_LENGTH - 0.6, STREET_LENGTH);
    this.pose(t, time, dt);

    let i = 0;
    while (i < SHOTS.length - 2 && t >= SHOTS[i + 1][0]) i++;
    const nx = nuggetX(t);
    const at = (sh: Shot) => {
      const dx = sh[3] ? nx : 0;
      return { p: [sh[1][0] + dx, sh[1][1], sh[1][2]], l: [sh[2][0] + dx, sh[2][1], sh[2][2]] };
    };
    const t0 = SHOTS[i][0], t1 = SHOTS[i + 1][0];
    const { p: p0, l: l0 } = at(SHOTS[i]);
    const { p: p1, l: l1 } = at(SHOTS[i + 1]);
    const k = seg(t, t0, t1);
    camera.position.set(O.x + lerp(p0[0], p1[0], k), O.y + lerp(p0[1], p1[1], k), O.z + lerp(p0[2], p1[2], k));
    camera.lookAt(O.x + lerp(l0[0], l1[0], k), O.y + lerp(l0[1], l1[1], k), O.z + lerp(l0[2], l1[2], k));
  }

  /** Point the shadow light should follow (world space). */
  get focus() {
    return new THREE.Vector3(O.x + nuggetX(this.t), 0, O.z + WALK_Z);
  }

  private pose(t: number, time: number, dt: number) {
    const n = this.nugget;
    const x = nuggetX(t);
    const prevX = nuggetX(Math.max(0, t - 0.05));
    const moving = x - prevX > 0.004;
    const intoStore = seg(t, 13.6, 14.8);
    const hop = t > 11.5 && t < 13.6 ? Math.abs(Math.sin((t - 11.5) * Math.PI)) * 0.35 : 0;
    n.root.position.set(x, hop, lerp(WALK_Z, -0.9, intoStore));
    n.root.scale.setScalar(1.15);
    n.awake = 1;
    n.opacity = 1 - seg(t, 14.4, 15.0);
    n.mood = 'happy';
    n.bottleOut = 0;
    // walks along +x; turns to the camera to wonder, looks at the store, then heads inside
    let facing = 0;
    if (t > 6.2 && t < 8.8) facing = Math.PI / 2 + Math.sin(t * 2.2) * 0.6; // looking around
    else if (t >= 8.8 && t < 9.6) facing = -0.6;
    else if (t >= 13.6) facing = -Math.PI / 2;
    n.animate(facing, moving, time * (t < 9.6 ? 9 : 16), dt);
    // slumped while pondering
    n.inner.rotation.x = t > 3.3 && t < 8.8 ? 0.18 : 0;
    n.inner.position.x = 0;

    // "?" bubbles drift up while it wonders; "!" pops when it sees the store
    this.thought.forEach((s, i) => {
      const a = 3.4 + i * 0.9;
      const on = t > a && t < 8.8;
      s.visible = on;
      if (!on) return;
      const k = ((t - a) % 2.7) / 2.7;
      s.position.set(x + 0.15 + i * 0.18, 0.9 + k * 0.6, WALK_Z);
      s.scale.setScalar(0.22 + Math.sin(k * Math.PI) * 0.06);
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
    });
    const ideaOn = t > 8.9 && t < 11.5;
    this.idea.visible = ideaOn;
    if (ideaOn) {
      const pop = Math.min(1, (t - 8.9) * 5);
      this.idea.position.set(x, 1.05 + Math.sin(time * 6) * 0.03, WALK_Z);
      this.idea.scale.setScalar(0.4 * pop);
    }
    // the sliding doors part as the nugget arrives
    const open = seg(t, 12.6, 13.6);
    this.doorL.position.set(STORE_X - 0.5 - open * 0.95, 1.35, -0.5);
    this.doorR.position.set(STORE_X + 0.5 + open * 0.95, 1.35, -0.5);
  }
}
