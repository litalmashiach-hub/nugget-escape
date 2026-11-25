/**
 * Level 4's opening cutscene: out on the country road the Farmer gets back on his feet and
 * remembers the nugget: "the chicken that was taken to the laboratory for some secret testing".
 * The nugget walks into town thinking it over, finds a newspaper stapled to a tree with the
 * laboratory's address on it, and heads straight there.
 *
 * Like the other cutscenes, everything is a pure function of the clock `t`.
 */
import { THREE, canvasTexture, labelTexture, builder, box, cyl, cone, ball } from './kit';
import { NuggetModel, PersonModel, faceAngle } from './characters';
import { bakeBubble, makeCanvas, rng, rr, shade } from './paint';
import type { Caption, CutEvent } from './cutscene';

export const LAB_LENGTH = 37;

/** The trip sits far from the levels and the other cutscenes so nothing overlaps. */
const O = new THREE.Vector3(400, 0, 0);
const WALK_Z = 0.35;
const FARMER = { x: 3, z: -0.4 };
const TALK_X = 5.6; // where the nugget stands while the Farmer talks
const TREE = { x: 34.6, z: -0.75 };
const READ_X = 34.2; // where the nugget stops to read the newspaper
const LAB_DOOR = 51;
const LAB_FRONT = -2.2;

/** What the newspaper on the tree says. */
export const NEWSPAPER = {
  masthead: 'THE DAILY CLUCK',
  headline: 'MYSTERY AT THE LAB!',
  subhead: 'Strange lights at night. Secret tests on chickens?',
  address: 'Featherstone Labs, 7 Beaker Lane',
};

export const LAB_CAPTIONS: { a: number; b: number; who: string; text: string }[] = [
  { a: 0.3, b: 2.3, who: '', text: 'Out on the country road, the Farmer gets back on his feet…' },
  { a: 2.4, b: 6.6, who: 'The Farmer', text: 'Hey, I remember you! You are the chicken that was taken to the laboratory for some secret testing.' },
  { a: 6.7, b: 9.4, who: 'The Farmer', text: 'How are you still alive?! Did their experiment work?!' },
  { a: 9.5, b: 11.6, who: 'Nugget', text: 'Me? A chicken? A secret experiment?!' },
  { a: 11.8, b: 14.8, who: '', text: 'The nugget walks into town, thinking really hard about what the farmer said…' },
  { a: 14.9, b: 17.8, who: 'Nugget', text: "A laboratory… secret testing… is THAT why I'm alive?" },
  { a: 17.9, b: 20.4, who: 'Nugget', text: 'But where would I even find a laboratory?' },
  { a: 20.5, b: 22.4, who: 'Nugget', text: "Hey, what's this? A newspaper, stapled to a tree!" },
  { a: 22.5, b: 26.0, who: NEWSPAPER.masthead, text: `"${NEWSPAPER.headline} ${NEWSPAPER.subhead}" ${NEWSPAPER.address}.` },
  { a: 26.1, b: 28.6, who: 'Nugget', text: "It's about the laboratory! And it has the address on it!" },
  { a: 28.7, b: 31.0, who: 'Nugget', text: "If they did an experiment on me, the answers are in there. I'm going!" },
  { a: 31.1, b: 33.6, who: '', text: '…and the nugget heads straight for 7 Beaker Lane.' },
  { a: 33.7, b: LAB_LENGTH, who: 'Level 4', text: "Sneak through Featherstone Labs! Find the keys and don't trip the laser alarms!" },
];

const EVENTS: { t: number; e: CutEvent }[] = [
  { t: 1.0, e: 'thud' },
  { t: 2.5, e: 'gasp' },
  { t: 9.6, e: 'pop' },
  { t: 13.0, e: 'pop' },
  { t: 15.0, e: 'pop' },
  { t: 20.5, e: 'gasp' },
  { t: 26.1, e: 'pop' },
  { t: 28.8, e: 'jump' },
  { t: 29.3, e: 'land' },
];

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
const seg = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

/** Where the nugget is along the road at time t. */
export function labNuggetX(t: number) {
  if (t < 11.7) return TALK_X;
  if (t < 20.2) return lerp(TALK_X, READ_X, clamp01((t - 11.7) / 8.5) * 0.15 + seg(t, 11.7, 20.2) * 0.85);
  if (t < 31.0) return READ_X;
  return lerp(READ_X, LAB_DOOR, seg(t, 31.0, 35.0));
}

/** 1 in the morning sun, down to dusk by the time the nugget reaches the lab. */
export function labSky(t: number) {
  return 1 - seg(t, 26, 34) * 0.7;
}

/** Camera keyframes: [time, position, look-at, follow]. With follow, x is measured from the nugget. */
type Shot = [number, [number, number, number], [number, number, number], boolean?];
const NEWS_Z = TREE.z + 0.36;
const SHOTS: Shot[] = [
  [0, [4.4, 2.3, 5.6], [4.2, 0.7, -0.4]],
  [2.4, [4.7, 1.55, 2.7], [3.0, 1.45, -0.4]],
  [6.6, [4.4, 1.6, 2.4], [3.0, 1.5, -0.4]],
  [9.5, [7.0, 0.95, 2.3], [TALK_X, 0.55, WALK_Z]],
  [11.7, [7.0, 0.95, 2.3], [TALK_X, 0.55, WALK_Z]],
  [12.8, [1.6, 1.6, 4.6], [0, 0.65, WALK_Z], true],
  [19.6, [1.4, 1.3, 3.9], [0, 0.6, WALK_Z], true],
  [21.0, [32.4, 1.25, 2.6], [34.4, 0.75, -0.5]],
  [22.4, [TREE.x, 0.82, NEWS_Z + 1.25], [TREE.x, 0.82, NEWS_Z]],
  [26.0, [TREE.x, 0.82, NEWS_Z + 1.15], [TREE.x, 0.82, NEWS_Z]],
  [26.9, [33.0, 0.95, 2.2], [READ_X, 0.6, WALK_Z]],
  [30.6, [33.2, 1.0, 2.4], [READ_X, 0.6, WALK_Z]],
  [31.6, [1.4, 1.5, 4.2], [0.6, 0.65, WALK_Z], true],
  [33.4, [44.5, 3.0, 10.5], [LAB_DOOR, 2.6, -3.5]],
  [LAB_LENGTH, [47.5, 2.3, 8.0], [LAB_DOOR, 1.9, -2.5]],
];

/** The front page: masthead, headline, a photo of the lab and the address in a box. */
function newspaperTexture() {
  const W = 400, H = 500;
  const { c, ctx } = makeCanvas(W, H, 2);
  ctx.fillStyle = '#f3eedf';
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = '#e7dfc8';
  for (let i = 0; i < 30; i++) ctx.fillRect(0, i * 17, W, 1);
  ctx.fillStyle = '#1d1d1d';
  ctx.textAlign = 'center';
  ctx.font = '900 40px Georgia, "Times New Roman", serif';
  ctx.fillText(NEWSPAPER.masthead, W / 2, 50);
  ctx.fillRect(18, 62, W - 36, 3);
  ctx.font = '700 13px Georgia, serif';
  ctx.fillText('NEWS FROM ALL OVER TOWN  ·  ONLY 50¢', W / 2, 80);
  ctx.fillRect(18, 88, W - 36, 1.5);
  ctx.font = '900 31px "Arial Black", Impact, sans-serif';
  ctx.fillStyle = '#b3201b';
  ctx.fillText(NEWSPAPER.headline, W / 2, 132);
  ctx.fillStyle = '#1d1d1d';
  ctx.font = 'italic 700 17px Georgia, serif';
  ctx.fillText(NEWSPAPER.subhead, W / 2, 160);
  // photo of the lab: grey building, glowing windows, a satellite dish, a question mark
  ctx.fillStyle = '#2b3550';
  ctx.fillRect(22, 176, 210, 160);
  ctx.fillStyle = '#c9d2dc';
  ctx.fillRect(40, 236, 175, 100);
  ctx.fillStyle = '#7ef7d0';
  for (let y = 0; y < 3; y++) for (let x = 0; x < 5; x++) ctx.fillRect(50 + x * 33, 248 + y * 26, 20, 14);
  ctx.strokeStyle = '#c9d2dc';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(176, 214, 22, Math.PI * 0.85, Math.PI * 1.85);
  ctx.stroke();
  ctx.fillStyle = '#c9d2dc';
  ctx.fillRect(173, 214, 6, 22);
  ctx.fillStyle = '#ffe066';
  ctx.font = '900 48px "Arial Black", sans-serif';
  ctx.fillText('?', 82, 222);
  // the story: lines of tiny text
  ctx.fillStyle = '#8a8476';
  for (let i = 0; i < 9; i++) ctx.fillRect(246, 180 + i * 17, i % 3 === 2 ? 90 : 130, 7);
  for (let i = 0; i < 4; i++) ctx.fillRect(22, 350 + i * 17, i === 3 ? 220 : W - 44, 7);
  // the address, in a box
  ctx.strokeStyle = '#b3201b';
  ctx.lineWidth = 4;
  rr(ctx, 22, 424, W - 44, 58, 8);
  ctx.stroke();
  ctx.fillStyle = '#1d1d1d';
  ctx.font = '900 21px "Arial Black", sans-serif';
  ctx.fillText('Featherstone Labs', W / 2, 449);
  ctx.font = '800 20px Georgia, serif';
  ctx.fillText('7 Beaker Lane', W / 2, 473);
  return canvasTexture(c);
}

function windowsTexture(seed: number, wall: string, lit: string) {
  const { c, ctx } = makeCanvas(128, 256, 1);
  const R = rng(seed);
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, 128, 256);
  for (let y = 20; y < 236; y += 44)
    for (let x = 14; x < 114; x += 38) {
      ctx.fillStyle = R() < 0.55 ? lit : '#2c3550';
      ctx.fillRect(x, y, 24, 28);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(x, y + 26, 24, 3);
    }
  return canvasTexture(c);
}

export class LabTripCutscene {
  readonly group = new THREE.Group();
  readonly nugget = new NuggetModel();
  readonly farmer = new PersonModel('farmer');
  /** Turns the farmer to face the nugget while he lies on his back and gets up. */
  private farmerTurn = new THREE.Group();
  private thought: THREE.Sprite[] = [];
  private idea: THREE.Sprite;
  private alarm: THREE.Sprite;
  private stars = new THREE.Group();
  private smoke: THREE.Mesh[] = [];
  private labDoor: THREE.Mesh;
  private dish: THREE.Group;
  private beacon: THREE.Mesh;
  private hemi = new THREE.HemisphereLight('#e4f3ff', '#6f8a4a', 1.4);
  t = 0;
  fade = 0;
  caption: Caption | null = null;
  events: CutEvent[] = [];

  constructor() {
    this.group.position.copy(O);
    this.group.visible = false;
    const b = builder(false, false);
    const R = rng(404);

    // the road from the farm into town, with a sidewalk on the town side
    box(b, -20, -0.03, 0.8, 90, 0.03, 3.2, '#3a3d42', { rough: 0.95 });
    for (let x = -18; x < 68; x += 3) box(b, x, 0.0, 2.35, 1.6, 0.01, 0.12, '#f4f1e8');
    box(b, -20, -0.02, -30, 34, 0.02, 30.8, '#5d9a45', { rough: 1 });
    box(b, -20, -0.02, 4, 90, 0.02, 30, '#5d9a45', { rough: 1 });
    box(b, 14, 0, -1.5, 56, 0.08, 2.3, '#c9c4b8');
    box(b, 14, -0.02, -30, 56, 0.02, 28.5, '#8f9a7d', { rough: 1 });

    // the farm side: the fence along the road, the wrecked tractor still smoking
    for (let x = -14; x <= 12; x += 1) box(b, x - 0.08, 0, -1.6, 0.16, 1.15, 0.16, '#d8c7a6');
    for (const h of [0.3, 0.62, 0.94]) box(b, -14, h, -1.55, 26, 0.16, 0.1, '#f1e6cf');
    box(b, -4.2, 0, -1.3, 2.2, 0.9, 1.4, '#232622', { rough: 0.9 });
    box(b, -3.9, 0.9, -1.0, 0.9, 0.5, 0.9, '#1b1d1a', { rough: 0.9 });
    for (const [dx, r] of [[-4.0, 0.55], [-2.2, 0.36]] as const) {
      const w = cyl(b, dx, r, -0.55, r, 0.3, '#151515');
      w.rotation.x = Math.PI / 2;
    }
    const puff = new THREE.MeshStandardMaterial({ color: '#555b60', transparent: true, opacity: 0.5, depthWrite: false, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), puff);
      this.smoke.push(m);
      this.group.add(m);
    }
    // the farmer's rake, dropped on the road
    const rakeStick = box(b, 0.5, 0.02, -0.15, 1.6, 0.05, 0.05, '#b07a4c');
    rakeStick.rotation.y = 0.3;
    box(b, 0.35, 0.02, -0.55, 0.08, 0.06, 0.6, '#7c858f', { metal: 0.6 });
    // fields and hills behind the farm
    for (let i = 0; i < 5; i++) ball(b, -16 + i * 7, -2, -18 - R() * 4, 14, 8 + R() * 4, 9, shade('#6aa84f', (R() - 0.5) * 0.2), { rough: 1 });
    for (let x = 8; x < 16; x += 2.6) {
      cyl(b, x, 0, -3 - R() * 3, 0.14, 1.1, '#6b4a2a');
      ball(b, x, 1.7, -3 - R() * 3, 1.2, 1.3, 1.2, shade('#3f8f4a', (R() - 0.5) * 0.3));
    }

    // town: houses and shops along the sidewalk
    const walls = ['#e9b872', '#9fd3c7', '#e6c3d0', '#c9d6f0', '#f2e2b6', '#d6c6a8'];
    for (let x = 15; x < 43; ) {
      const w = 3.5 + R() * 3, h = 3 + R() * 3.5;
      if (x < TREE.x + 1.5 && x + w > TREE.x - 1.5) { x = TREE.x + 1.6; continue; }
      const col = walls[Math.floor(R() * walls.length)];
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4), [
        new THREE.MeshStandardMaterial({ color: shade(col, -0.15) }),
        new THREE.MeshStandardMaterial({ color: shade(col, -0.15) }),
        new THREE.MeshStandardMaterial({ color: '#6b4a3a' }),
        new THREE.MeshStandardMaterial({ color: col }),
        new THREE.MeshStandardMaterial({ map: windowsTexture(Math.floor(x * 13), col, '#ffe7a3') }),
        new THREE.MeshStandardMaterial({ color: col }),
      ]);
      m.position.set(x + w / 2, h / 2, -3.6);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      cone(b, x + w / 2, h, -3.6, w * 0.62, 1.3, shade('#a3473a', (R() - 0.5) * 0.3));
      x += w + 0.5;
    }
    // street lamps and little trees
    for (let x = 17; x < 48; x += 6.5) {
      if (Math.abs(x - TREE.x) < 2) continue;
      cyl(b, x, 0, -1.3, 0.06, 3, '#555');
      ball(b, x, 3.05, -1.3, 0.3, 0.3, 0.3, '#fff2c4', { emissive: '#ffcc66', emissiveIntensity: 1.5 });
    }

    // the big tree with the newspaper stapled to it
    cyl(b, TREE.x, 0, TREE.z, 0.3, 2.4, '#6b4a2a', { rough: 0.95 }, 0.22);
    for (const [dx, dy, dz, s] of [[0, 3.0, 0, 1.6], [-0.9, 2.6, 0.2, 1.1], [0.9, 2.7, -0.2, 1.2], [0.2, 3.6, -0.3, 1.1]] as const)
      ball(b, TREE.x + dx, dy, TREE.z + dz, s, s * 0.9, s, shade('#3f8f4a', dx * 0.1));
    const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.5), new THREE.MeshStandardMaterial({ map: newspaperTexture(), roughness: 0.9, side: THREE.DoubleSide }));
    paper.position.set(TREE.x, 0.82, NEWS_Z);
    paper.rotation.set(0, 0, 0.03);
    paper.castShadow = true;
    this.group.add(paper);
    for (const sx of [-0.15, 0.15]) box(b, TREE.x + sx - 0.02, 1.04, NEWS_Z + 0.004, 0.04, 0.008, 0.006, '#9aa3ad', { metal: 0.8 }); // staples

    // Featherstone Labs at the end of the street: white walls, glowing windows, a dish on the roof
    const lx = LAB_DOOR - 7;
    box(b, lx, 0, -11, 14, 5.2, 8.8, '#e8edf1');
    box(b, lx - 0.2, 5.2, -11.2, 14.4, 0.3, 9.2, '#b8c2cc');
    for (let i = 0; i < 6; i++) {
      // glowing windows: a top row, and a bottom row either side of the doors
      box(b, lx + 0.8 + i * 2.15, 4.0, LAB_FRONT, 1.3, 0.8, 0.06, '#7ef7d0', { emissive: '#3fd8a8', emissiveIntensity: 0.9 });
      if (i !== 2 && i !== 3) box(b, lx + 0.8 + i * 2.15, 0.9, LAB_FRONT, 1.3, 1.1, 0.06, '#7ef7d0', { emissive: '#3fd8a8', emissiveIntensity: 0.9 });
    }
    box(b, LAB_DOOR - 1.6, 0, LAB_FRONT + 0.01, 3.2, 2.5, 0.06, '#1b2430', { rough: 0.6 }); // the dark lobby behind the doors
    box(b, LAB_DOOR - 1.75, 2.5, LAB_FRONT + 0.01, 3.5, 0.12, 0.12, '#9aa3ad', { metal: 0.6 });
    this.labDoor = new THREE.Mesh(new THREE.BoxGeometry(3.1, 2.4, 0.05), new THREE.MeshStandardMaterial({ color: '#cfeeff', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55 }));
    this.group.add(this.labDoor);
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(8.5, 0.95), new THREE.MeshBasicMaterial({ map: labelTexture('FEATHERSTONE LABS', '#7ef7d0', 640), transparent: true }));
    sign.position.set(LAB_DOOR, 3.25, LAB_FRONT + 0.1);
    this.group.add(sign);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), new THREE.MeshBasicMaterial({ map: labelTexture('7 Beaker Lane', '#f5c518'), transparent: true }));
    plate.position.set(LAB_DOOR + 2.7, 2.45, LAB_FRONT + 0.1);
    this.group.add(plate);
    // a fence with a KEEP OUT sign and the satellite dish
    for (let x = lx - 5; x < lx; x += 0.5) box(b, x, 0, LAB_FRONT + 0.2, 0.06, 1.6, 0.06, '#9aa3ad', { metal: 0.6 });
    box(b, lx - 5, 1.5, LAB_FRONT + 0.2, 5, 0.06, 0.06, '#9aa3ad', { metal: 0.6 });
    const keep = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.4), new THREE.MeshBasicMaterial({ map: labelTexture('KEEP OUT', '#ff6b6b'), transparent: true }));
    keep.position.set(lx - 2.5, 1.0, LAB_FRONT + 0.28);
    this.group.add(keep);
    this.dish = new THREE.Group();
    const db = builder(false, false);
    cyl(db, 0, 0, 0, 0.08, 1.0, '#c9d2dc', { metal: 0.6 });
    const bowl = ball(db, 0, 1.2, 0, 0.9, 0.35, 0.9, '#e8edf1', { metal: 0.3, rough: 0.4 });
    bowl.rotation.x = -0.7;
    this.dish.add(db.group);
    this.dish.position.set(lx + 11, 5.5, -7);
    this.group.add(this.dish);
    this.beacon = ball(b, lx + 2, 5.9, -6, 0.18, 0.18, 0.18, '#ff3b3b', { emissive: '#ff3b3b', emissiveIntensity: 2 });
    this.group.add(b.group);

    // the farmer and the nugget
    this.farmer.root.scale.setScalar(1.05);
    this.farmerTurn.position.set(FARMER.x, 0, FARMER.z);
    this.farmerTurn.add(this.farmer.root);
    for (let i = 0; i < 4; i++) this.stars.add(ball(builder(false, false), 0, 0, 0, 0.12, 0.12, 0.12, '#ffe066', { emissive: '#ffd23a', emissiveIntensity: 0.9 }));
    this.farmerTurn.add(this.stars);
    this.group.add(this.hemi, this.nugget.root, this.farmerTurn);
    const qTex = canvasTexture(bakeBubble('?'));
    for (let i = 0; i < 3; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: qTex, depthTest: false }));
      s.renderOrder = 10;
      s.visible = false;
      this.thought.push(s);
      this.group.add(s);
    }
    const bang = canvasTexture(bakeBubble('!'));
    this.idea = new THREE.Sprite(new THREE.SpriteMaterial({ map: bang, depthTest: false }));
    this.idea.renderOrder = 10;
    this.alarm = new THREE.Sprite(new THREE.SpriteMaterial({ map: bang, depthTest: false }));
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
    return this.t >= LAB_LENGTH;
  }

  /** 1 morning .. 0 night, for the scene's sky and sunlight. */
  get sky() {
    return labSky(this.t);
  }

  update(dt: number, camera: THREE.PerspectiveCamera, time: number) {
    const prev = this.t;
    this.t = Math.min(LAB_LENGTH, this.t + dt);
    const t = this.t;
    this.events = EVENTS.filter((e) => e.t > prev && e.t <= t).map((e) => e.e);
    const cap = LAB_CAPTIONS.find((c) => t >= c.a && t < c.b);
    this.caption = cap ? { who: cap.who, text: cap.text } : null;
    this.fade = seg(t, LAB_LENGTH - 0.6, LAB_LENGTH);
    this.pose(t, time, dt);

    let i = 0;
    while (i < SHOTS.length - 2 && t >= SHOTS[i + 1][0]) i++;
    const nx = labNuggetX(t);
    const at = (sh: Shot) => {
      const dx = sh[3] ? nx : 0;
      return { p: [sh[1][0] + dx, sh[1][1], sh[1][2]], l: [sh[2][0] + dx, sh[2][1], sh[2][2]] };
    };
    const { p: p0, l: l0 } = at(SHOTS[i]);
    const { p: p1, l: l1 } = at(SHOTS[i + 1]);
    const k = seg(t, SHOTS[i][0], SHOTS[i + 1][0]);
    camera.position.set(O.x + lerp(p0[0], p1[0], k), O.y + lerp(p0[1], p1[1], k), O.z + lerp(p0[2], p1[2], k));
    camera.lookAt(O.x + lerp(l0[0], l1[0], k), O.y + lerp(l0[1], l1[1], k), O.z + lerp(l0[2], l1[2], k));
  }

  /** True while the camera is up close on the newspaper (no pulling back on phones). */
  get closeUp() {
    return this.t > 21.8 && this.t < 26.4;
  }

  /** Point the shadow light should follow (world space). */
  get focus() {
    return new THREE.Vector3(O.x + labNuggetX(this.t), 0, O.z + WALK_Z);
  }

  private pose(t: number, time: number, dt: number) {
    const sky = labSky(t);
    this.hemi.intensity = lerp(0.7, 1.4, sky);

    // the farmer: flat on his back, sits up dizzy, gets up and talks
    const f = this.farmer;
    const fallen = 1 - seg(t, 0.8, 2.3);
    this.farmerTurn.rotation.y = faceAngle(0);
    f.talk = (t > 2.4 && t < 9.4) ? 1 : 0;
    f.armPose = t > 11.8 ? { l: -0.3, r: -2.6 + Math.sin(time * 5) * 0.15 } : null; // scratching his head
    f.animate(null, false, time * 8, dt);
    f.root.rotation.set(-fallen * Math.PI / 2 * 0.95, 0, 0);
    f.root.position.y = fallen * 0.25;
    if (f.rake) f.rake.visible = false;
    this.stars.visible = t < 4.2;
    this.stars.children.forEach((s, i) => {
      const a = time * 4 + (i / 4) * Math.PI * 2;
      s.position.set(Math.cos(a) * 0.4, lerp(0.5, 2.25, 1 - fallen) + Math.sin(a * 2) * 0.05, Math.sin(a) * 0.4 + fallen * -1.4);
    });
    // smoke curls up from the wrecked tractor
    this.smoke.forEach((m, i) => {
      const k = ((time * 0.35 + i / this.smoke.length) % 1);
      m.position.set(-3.4 + Math.sin(k * 5 + i) * 0.3, 1.2 + k * 3.2, -0.7 + k * 0.4);
      m.scale.setScalar(0.5 + k * 1.3);
      (m.material as THREE.MeshStandardMaterial).opacity = 0.45 * (1 - k);
    });

    // the nugget
    const n = this.nugget;
    const x = labNuggetX(t);
    const moving = Math.abs(x - labNuggetX(Math.max(0, t - 0.05))) > 0.004;
    const into = seg(t, 35.0, 36.2);
    const hop = t > 28.7 && t < 29.4 ? Math.sin(((t - 28.7) / 0.7) * Math.PI) * 0.4 : 0;
    n.root.position.set(x, hop, lerp(WALK_Z, LAB_FRONT - 0.6, into));
    n.root.scale.setScalar(1.15);
    n.awake = 1;
    n.opacity = 1 - seg(t, 35.9, 36.5);
    n.root.visible = n.opacity > 0.01;
    n.mood = t > 9.5 && t < 11.7 ? 'scared' : 'happy';
    n.bottleOut = 0;
    let facing = 0;
    if (t < 9.5) facing = Math.PI; // looking at the farmer
    else if (t < 11.7) facing = Math.PI / 2 + Math.sin(t * 2.4) * 0.5; // to the camera, puzzled
    else if (t >= 20.2 && t < 26.6) facing = -Math.PI / 2; // reading the newspaper
    else if (t >= 26.6 && t < 31.0) facing = Math.PI / 2; // to the camera: I'm going!
    else if (t >= 35.0) facing = -Math.PI / 2; // into the lab
    n.animate(facing, moving, time * (t > 31 ? 16 : 9), dt);
    n.inner.rotation.x = t > 12 && t < 20 ? 0.18 : 0; // head down, thinking hard
    n.inner.position.x = 0;

    // "?" thoughts while walking through town, "!" when it reads the address
    this.thought.forEach((s, i) => {
      const a = 9.6 + i * 0.6;
      const on = (t > a && t < 11.6) || (t > 12.4 + i * 0.7 && t < 20.2);
      s.visible = on;
      if (!on) return;
      const k = ((t - a) % 2.1) / 2.1;
      s.position.set(x + 0.15 + i * 0.18, 0.9 + k * 0.6, WALK_Z);
      s.scale.setScalar(0.22 + Math.sin(k * Math.PI) * 0.06);
      (s.material as THREE.SpriteMaterial).opacity = Math.sin(k * Math.PI);
    });
    const alarmOn = t > 20.5 && t < 21.8;
    this.alarm.visible = alarmOn;
    if (alarmOn) {
      this.alarm.position.set(x, 1.05 + Math.sin(time * 9) * 0.03, WALK_Z);
      this.alarm.scale.setScalar(0.36 * Math.min(1, (t - 20.5) * 6));
    }
    const ideaOn = t > 26.1 && t < 30.4;
    this.idea.visible = ideaOn;
    if (ideaOn) {
      this.idea.position.set(x, 1.05 + Math.sin(time * 6) * 0.03, WALK_Z);
      this.idea.scale.setScalar(0.42 * Math.min(1, (t - 26.1) * 5));
    }

    // the lab: the dish turns, the beacon blinks, the doors slide open for the nugget
    this.dish.rotation.y = Math.sin(time * 0.4) * 0.8;
    (this.beacon.material as THREE.MeshStandardMaterial).emissiveIntensity = Math.sin(time * 5) > 0 ? 2.5 : 0.2;
    const open = seg(t, 34.2, 35.0);
    this.labDoor.position.set(LAB_DOOR + open * 2.9, 1.2, LAB_FRONT + 0.08);
  }
}
