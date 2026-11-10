/**
 * Level 2 ending cutscene, in the Manager's Office: the nugget hops onto the desk and
 * watches the security cameras, finding out it was NOT alive on the frozen food shelf when
 * it was bought. Then the Manager walks in, and the boss fight starts.
 *
 * Like the other cutscenes, everything is a pure function of the clock `t`.
 */
import { THREE, canvasTexture, builder, box } from './kit';
import { BossModel, NuggetModel } from './characters';
import { CAM_OFFSET, type Caption, type CutEvent } from './cutscene';
import { MANAGER } from '../game/boss';

export const OFFICE_INTRO_LENGTH = 24;

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const seg = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** The desk with the camera screens, in store map coordinates. */
const DESK = { x: 69, z: 4.2, top: 0.78 };
const ON_DESK = { x: 69.5, z: 4.75 };
const DOOR = { x: 69.5, z: 17.2 };
/** Footage plays full screen between these times. */
const TAPE_A = 4.4, TAPE_B = 11.6;

const CAPTIONS: { a: number; b: number; who: string; text: string }[] = [
  { a: 0.2, b: 2.4, who: 'Nugget', text: 'So this is the Manager’s Office… what are all those screens?' },
  { a: 2.6, b: 4.3, who: 'Nugget', text: 'Security cameras! Let’s have a look…' },
  { a: 4.6, b: 6.8, who: 'Nugget', text: 'Hey, that’s the frozen food shelf… and that’s ME in the bag!' },
  { a: 6.9, b: 9.4, who: 'Nugget', text: 'No eyes, no smile… I wasn’t even alive when they bought me!' },
  { a: 9.5, b: 11.5, who: 'Nugget', text: 'Then how did I wake up?!' },
  { a: 11.7, b: 13.9, who: '', text: 'Uh oh… footsteps!' },
  { a: 14.0, b: 17.6, who: 'The Manager', text: 'You are not supposed to be here snooping around my office. I might just have to fire you!' },
  { a: 17.7, b: 20.4, who: 'Nugget', text: 'I’m a chicken nugget! I’m not even working here!' },
  { a: 20.5, b: 21.8, who: 'The Manager', text: 'Whatever.' },
  { a: 21.9, b: OFFICE_INTRO_LENGTH, who: 'Boss fight', text: 'Squirt ketchup at the Manager and dodge the pink slips!' },
];

const EVENTS: { t: number; e: CutEvent }[] = [
  { t: 2.5, e: 'jump' },
  { t: 3.0, e: 'land' },
  { t: 6.9, e: 'gasp' },
  { t: 11.7, e: 'thud' },
  { t: 12.4, e: 'jump' },
  { t: 12.9, e: 'land' },
  { t: 14.0, e: 'gasp' },
  { t: 22.2, e: 'pop' },
  { t: 22.8, e: 'squirt' },
  { t: 22.95, e: 'squirt' },
];

const MID = { x: (MANAGER.entry.x + MANAGER.start.x) / 2, y: (MANAGER.entry.y + MANAGER.start.y) / 2 };

const SHOTS: [number, [number, number, number], [number, number, number]][] = [
  [0, [72.5, 2.2, 6.5], [69.5, 0.4, 12]],
  [2.2, [71.8, 1.7, 7.4], [69.5, 0.9, 4.6]],
  [3.4, [70.4, 1.5, 6.4], [69.2, 1.2, 4.2]],
  [TAPE_A, [69.6, 1.45, 5.5], [69.2, 1.25, 4.2]],
  [TAPE_B, [69.6, 1.45, 5.5], [69.2, 1.25, 4.2]],
  [TAPE_B + 0.01, [72.6, 1.9, 6.0], [69.5, 1.0, 11.0]],
  [13.6, [72.0, 1.9, 6.4], [69.5, 1.4, 11.2]],
  [14.0, [69.0, 1.0, 8.2], [69.5, 2.0, 11.6]],
  [17.6, [69.2, 1.1, 8.4], [69.5, 2.0, 11.6]],
  [17.61, [69.9, 0.85, 8.6], [69.5, 0.45, 6.4]],
  [20.4, [69.9, 0.85, 8.4], [69.5, 0.45, 6.4]],
  [20.41, [70.6, 1.6, 8.0], [69.5, 1.9, 11.6]],
  [21.8, [70.5, 1.6, 8.2], [69.5, 1.9, 11.6]],
  [21.81, [70.2, 0.9, 8.4], [69.5, 0.45, 6.4]],
  [22.9, [70.2, 1.2, 8.8], [69.5, 0.45, 6.6]],
  [OFFICE_INTRO_LENGTH, [MID.x + CAM_OFFSET.x, CAM_OFFSET.y, MID.y + CAM_OFFSET.z], [MID.x, 0, MID.y]],
];

// ---------------------------------------------------------------- security camera footage

const W = 640, H = 360;

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** A bag of frozen nuggets, with a window showing plain, face-less nuggets inside. */
function nuggetBag(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, glow = false) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  roundRect(ctx, -30, -40, 60, 80, 8);
  ctx.fillStyle = glow ? '#c8c8c8' : '#9a9a9a';
  ctx.fill();
  ctx.fillStyle = '#5a5a5a';
  ctx.font = 'bold 11px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NUGGETS', 0, -24);
  roundRect(ctx, -22, -14, 44, 40, 6);
  ctx.fillStyle = '#dcdcdc';
  ctx.fill();
  for (const [nx, ny] of [[-10, -3], [9, -4], [-1, 12], [13, 13], [-14, 14]]) {
    ctx.beginPath();
    ctx.ellipse(nx, ny, 8, 6, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#b5b5b5';
    ctx.fill();
  }
  ctx.restore();
}

/** The same frozen nugget, zoomed in: no eyes, no smile. */
function frozenNugget(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.ellipse(0, 0, 42 * s, 32 * s, 0.15, 0, Math.PI * 2);
  ctx.fillStyle = '#cfcfcf';
  ctx.fill();
  ctx.fillStyle = '#e8e8e8';
  for (const [fx, fy] of [[-14, -10], [10, 6], [-4, 14], [18, -8]]) {
    ctx.beginPath();
    ctx.arc(fx * s, fy * s, 3.5 * s, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function hand(ctx: CanvasRenderingContext2D, x: number, y: number) {
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(x, y - 14, 260, 28);
  ctx.beginPath();
  ctx.ellipse(x, y, 26, 22, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#a8a8a8';
  ctx.fill();
}

/** Draw one frame of the footage, ft seconds into the tape. */
export function drawFootage(ctx: CanvasRenderingContext2D, ft: number, noise: () => number) {
  ctx.fillStyle = '#1b1d1c';
  ctx.fillRect(0, 0, W, H);
  let cam: string, clock: string;
  if (ft < 4.4) {
    cam = 'CAM 4  FROZEN FOOD';
    clock = `TUE 09:41:${String(7 + Math.floor(ft)).padStart(2, '0')}`;
    // freezer doors with three shelves of bags
    for (let d = 0; d < 3; d++) {
      const dx = 70 + d * 170;
      ctx.strokeStyle = '#6c6c6c';
      ctx.lineWidth = 6;
      ctx.strokeRect(dx, 40, 160, 290);
      for (let sy = 0; sy < 3; sy++) {
        ctx.fillStyle = '#4a4a4a';
        ctx.fillRect(dx + 4, 130 + sy * 95, 152, 6);
        for (let i = 0; i < 3; i++) {
          const mine = d === 1 && sy === 1 && i === 1;
          if (mine && ft > 3.8) continue;
          nuggetBag(ctx, dx + 30 + i * 50, 95 + sy * 95, 0.75, mine);
        }
      }
    }
    // a hand reaches in and takes the bag
    if (ft > 3.4 && ft < 4.4) {
      const k = ft < 3.8 ? (ft - 3.4) / 0.4 : 1 - (ft - 3.8) / 0.6;
      const hx = 560 - k * 255;
      hand(ctx, hx, 190);
      if (ft > 3.8) nuggetBag(ctx, hx - 10, 205, 0.75, true);
    }
    // zoom box on "my" bag
    if (ft > 1.2 && ft < 3.4) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      ctx.strokeRect(275, 155, 70, 80);
      ctx.setLineDash([]);
      ctx.fillStyle = '#2a2c2b';
      ctx.fillRect(400, 50, 210, 150);
      ctx.strokeRect(400, 50, 210, 150);
      frozenNugget(ctx, 505, 115, 1.4);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.font = 'bold 14px monospace';
      ctx.fillText('EYES: NONE   SMILE: NONE', 505, 186);
    }
  } else {
    cam = 'CAM 1  CHECKOUT 3';
    clock = `TUE 09:52:${String(30 + Math.floor(ft - 4.4)).padStart(2, '0')}`;
    // conveyor belt
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(0, 230, W, 70);
    ctx.strokeStyle = '#2a2a2a';
    ctx.lineWidth = 4;
    for (let i = 0; i < 14; i++) {
      const x = ((i * 50 + (ft - 4.4) * 120) % (W + 50)) - 50;
      ctx.beginPath(); ctx.moveTo(x, 232); ctx.lineTo(x, 298); ctx.stroke();
    }
    // scanner
    ctx.fillStyle = '#5a5a5a';
    ctx.fillRect(360, 200, 90, 40);
    ctx.fillStyle = '#7a7a7a';
    ctx.fillRect(375, 205, 60, 6);
    // the bag slides to the scanner, beeps, and goes into a shopping bag
    const k = Math.min(1, (ft - 4.4) / 1.0);
    const bx = ft < 6.0 ? lerp(40, 400, k) : lerp(400, 560, Math.min(1, (ft - 6.0) / 0.8));
    const by = ft < 6.0 ? 200 : lerp(200, 250, Math.min(1, (ft - 6.0) / 0.8));
    if (ft < 6.8) nuggetBag(ctx, bx, by, 0.9, true);
    // shopping bag
    ctx.fillStyle = '#8c8c8c';
    ctx.beginPath(); ctx.moveTo(520, 330); ctx.lineTo(610, 330); ctx.lineTo(600, 230); ctx.lineTo(530, 230); ctx.closePath(); ctx.fill();
    if (ft > 5.4) {
      ctx.fillStyle = ft < 6.0 && Math.floor(ft * 10) % 2 ? '#ffffff' : '#bdbdbd';
      ctx.font = 'bold 34px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BEEP!', 405, 170);
      ctx.font = 'bold 22px monospace';
      ctx.fillText('NUGGETS  $4.99', 300, 80);
      ctx.font = '16px monospace';
      ctx.fillText('ITEM STATUS: FROZEN SOLID', 300, 108);
    }
  }
  // camera overlay: tint, scanlines, noise, REC dot and clock
  ctx.fillStyle = 'rgba(70, 255, 140, 0.10)';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let y = 0; y < H; y += 3) ctx.fillRect(0, y, W, 1);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  for (let i = 0; i < 120; i++) ctx.fillRect(noise() * W, noise() * H, 2, 2);
  ctx.textAlign = 'left';
  ctx.font = 'bold 18px monospace';
  ctx.fillStyle = '#e8f5ea';
  ctx.fillText(cam, 18, 30);
  ctx.textAlign = 'right';
  ctx.fillText(clock, W - 18, 30);
  if (Math.floor(ft * 2) % 2 === 0) {
    ctx.fillStyle = '#ff3b3b';
    ctx.beginPath(); ctx.arc(26, H - 26, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8f5ea';
    ctx.textAlign = 'left';
    ctx.fillText('REC', 42, H - 20);
  }
}

// ---------------------------------------------------------------- cutscene

export class OfficeCutscene {
  readonly group = new THREE.Group();
  t = 0;
  fade = 0;
  caption: Caption | null = null;
  events: CutEvent[] = [];
  private canvas = document.createElement('canvas');
  private ctx: CanvasRenderingContext2D;
  private tex: THREE.CanvasTexture;
  /** Full-screen copy of the footage, placed right in front of the camera. */
  private screen: THREE.Mesh;
  private backdrop: THREE.Mesh;
  private seed = 1;

  constructor() {
    this.canvas.width = W;
    this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d')!;
    this.tex = canvasTexture(this.canvas);
    drawFootage(this.ctx, 0, () => this.noise());
    // a bank of four security monitors on the Manager's desk, facing the chair (+z)
    const b = builder(false, false);
    box(b, DESK.x - 1.0, DESK.top, DESK.z, 2.0, 0.08, 0.3, '#2b2b2b');
    box(b, DESK.x - 0.06, DESK.top, DESK.z + 0.05, 0.12, 0.35, 0.08, '#2b2b2b');
    box(b, DESK.x - 1.0, DESK.top + 0.3, DESK.z + 0.05, 2.0, 1.0, 0.08, '#1a1a1a');
    this.group.add(b.group);
    const screenMat = new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.92, 0.44), screenMat);
      m.position.set(DESK.x - 0.48 + (i % 2) * 0.96, DESK.top + 1.05 - Math.floor(i / 2) * 0.48, DESK.z + 0.14);
      this.group.add(m);
    }
    this.screen = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.tex, toneMapped: false, depthTest: false, depthWrite: false, transparent: true }));
    this.screen.renderOrder = 999;
    this.screen.frustumCulled = false;
    this.screen.visible = false;
    this.backdrop = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: '#000000', depthTest: false, depthWrite: false, transparent: true }));
    this.backdrop.renderOrder = 998;
    this.backdrop.frustumCulled = false;
    this.backdrop.visible = false;
    this.group.add(this.screen, this.backdrop);
    this.group.visible = false;
  }

  private noise() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }

  /** Take the full-screen footage away (when the cutscene is skipped mid-tape). */
  hideTape() {
    this.screen.visible = false;
    this.backdrop.visible = false;
  }

  reset() {
    this.hideTape();
    this.t = 0;
    this.caption = null;
    this.events = [];
  }

  get done() {
    return this.t >= OFFICE_INTRO_LENGTH;
  }

  /** Where the nugget is, for the wall cutaway. */
  focus = new THREE.Vector3(ON_DESK.x, 0, 9);

  update(dt: number, camera: THREE.PerspectiveCamera, time: number, n: NuggetModel, boss: BossModel) {
    const prev = this.t;
    this.t = Math.min(OFFICE_INTRO_LENGTH, this.t + dt);
    const t = this.t;
    this.events = EVENTS.filter((e) => e.t > prev && e.t <= t).map((e) => e.e);
    const cap = CAPTIONS.find((c) => t >= c.a && t < c.b);
    this.caption = cap ? { who: cap.who, text: cap.text } : null;

    // ---- the nugget: runs in, hops onto the desk, watches, hops down to face the Manager
    const run = seg(t, 0, 2.3);
    let x = ON_DESK.x, z = lerp(15.0, 6.0, run), y = 0;
    let facing = -Math.PI / 2;
    if (t >= 2.4) {
      const up = clamp01((t - 2.4) / 0.6);
      z = lerp(6.0, ON_DESK.z, up);
      y = lerp(0, DESK.top, up) + Math.sin(up * Math.PI) * 0.5;
    }
    if (t >= 11.7) facing = lerp(-Math.PI / 2, Math.PI / 2, seg(t, 11.7, 12.3));
    if (t >= 12.4) {
      const down = clamp01((t - 12.4) / 0.5);
      z = lerp(ON_DESK.z, MANAGER.entry.y, down);
      y = lerp(DESK.top, 0, down) + Math.sin(down * Math.PI) * 0.45;
      x = lerp(ON_DESK.x, MANAGER.entry.x, down);
    }
    n.root.position.set(x, y, z);
    n.root.scale.setScalar(1);
    n.awake = 1;
    n.opacity = 1;
    n.mood = (t > 6.9 && t < 11.6) || (t > 13.9 && t < 17.6) ? 'scared' : 'happy';
    n.bottleOut = seg(t, 21.9, 22.3);
    if (this.events.includes('squirt')) n.recoil = 1;
    n.animate(facing, t < 2.3, time * 18, dt);
    n.inner.position.x = t > 7.3 && t < 9.4 ? Math.sin(t * 60) * 0.012 : 0;
    this.focus.set(x, 0, z);

    // ---- the Manager walks in through the door and stops in front of the nugget
    const walk = clamp01((t - 12.0) / 2.0);
    boss.root.visible = t > 11.9;
    boss.root.position.set(DOOR.x, 0, lerp(DOOR.z, MANAGER.start.y, walk));
    boss.crouch = 0;
    boss.fallen = 0;
    boss.flash = 0;
    boss.eat = 0;
    boss.chew = 0;
    // a wag of the finger while talking, a shrug on "Whatever."
    boss.windup = t > 14.6 && t < 17.4 ? 0.25 + Math.sin(t * 9) * 0.1 : t > 20.6 && t < 21.6 ? 0.45 : 0;
    boss.animate(-Math.PI / 2, walk > 0 && walk < 1, walk * 14, dt, time);

    // ---- the footage: on the desk screens, then full screen
    drawFootage(this.ctx, clamp01((t - TAPE_A) / (TAPE_B - TAPE_A)) * 7.2, () => this.noise());
    this.tex.needsUpdate = true;
    const tape = t >= TAPE_A && t < TAPE_B;
    this.fade = t > TAPE_A - 0.25 && t < TAPE_A ? (t - (TAPE_A - 0.25)) / 0.25 : t >= TAPE_B && t < TAPE_B + 0.25 ? 1 - (t - TAPE_B) / 0.25 : 0;

    // ---- camera
    let i = 0;
    while (i < SHOTS.length - 2 && t >= SHOTS[i + 1][0]) i++;
    const [t0, p0, l0] = SHOTS[i];
    const [t1, p1, l1] = SHOTS[i + 1];
    const k = seg(t, t0, t1);
    const shake = t > 11.7 && t < 12.0 ? (12.0 - t) * 0.2 : 0;
    camera.position.set(lerp(p0[0], p1[0], k) + (Math.random() - 0.5) * shake, lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k));
    camera.lookAt(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k));

    this.screen.visible = tape;
    this.backdrop.visible = tape;
    if (tape) {
      // fill the view, letterboxed to 16:9
      camera.updateMatrixWorld();
      const d = 0.2;
      const h = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
      const w = h * camera.aspect;
      // fit between the cutscene's letterbox bars
      const sw = Math.min(w * 0.94, (h * 0.6 * W) / H), sh = (sw * H) / W;
      this.screen.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(d));
      this.screen.quaternion.copy(camera.quaternion);
      this.screen.scale.set(sw, sh, 1);
      this.backdrop.position.copy(camera.position).add(camera.getWorldDirection(new THREE.Vector3()).multiplyScalar(d * 1.05));
      this.backdrop.quaternion.copy(camera.quaternion);
      this.backdrop.scale.set(w * 1.2, h * 1.2, 1);
    }
  }
}
