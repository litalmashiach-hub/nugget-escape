/**
 * Low-poly 3D characters built from primitives: the nugget, the family and Biscuit the dog.
 * Every model faces +z by default; `faceAngle` converts a map facing angle to rotation.y.
 */
import { THREE, GEO, mat, builder, ball, cyl, cbox, labelTexture, type Builder } from './kit';
import { rng, shade } from './paint';
import type { FamilyKind } from '../game/types';

/** Map facing (atan2 of map dy, dx) to a rotation around +y for a model that faces +z. */
export const faceAngle = (facing: number) => Math.PI / 2 - facing;

function pivot(parent: THREE.Object3D, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

function limb(b: Builder, parent: THREE.Object3D, r: number, len: number, color: string) {
  const m = new THREE.Mesh(GEO.cyl, mat(color, { rough: 0.85 }));
  m.scale.set(r * 2, len, r * 2);
  m.position.y = -len / 2;
  m.castShadow = true;
  parent.add(m);
  void b;
  return m;
}

// ---------------------------------------------------------------- nugget

function nuggetGeometry() {
  const g = new THREE.SphereGeometry(0.5, 30, 20);
  const pos = g.attributes.position;
  const colors: number[] = [];
  const R = rng(11);
  const light = new THREE.Color('#f6c25a'), dark = new THREE.Color('#c27420'), crumb = new THREE.Color('#ffe39a');
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const a = Math.atan2(v.z, v.x), e = Math.asin(Math.max(-1, Math.min(1, v.y / 0.5)));
    const bump = 1 + Math.sin(a * 5 + 1.3) * 0.05 + Math.sin(e * 7 + a * 3) * 0.04 + (R() - 0.5) * 0.05;
    v.multiplyScalar(bump);
    pos.setXYZ(i, v.x, v.y, v.z);
    const c = dark.clone().lerp(light, Math.min(1, Math.max(0, 0.45 + v.y * 1.1 + (R() - 0.5) * 0.4)));
    if (R() < 0.12) c.lerp(crumb, 0.6);
    colors.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  g.computeVertexNormals();
  return g;
}

let nuggetGeo: THREE.BufferGeometry | null = null;

export class NuggetModel {
  readonly root = new THREE.Group();
  readonly inner = new THREE.Group();
  private bodyMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, transparent: true });
  private body: THREE.Mesh;
  private legL: THREE.Group;
  private legR: THREE.Group;
  private armL: THREE.Group;
  private armR: THREE.Group;
  private eyes: THREE.Group;
  private smile: THREE.Mesh;
  private ooh: THREE.Mesh;
  private allMats: THREE.Material[] = [];
  private blinkT = 2;
  mood: 'happy' | 'scared' = 'happy';
  /** 0 = asleep (eyes shut, it's just food), 1 = wide awake. */
  awake = 1;
  opacity = 1;
  /** 0..1: how far the ketchup bottle is pulled out (boss fight). */
  bottleOut = 0;
  /** Recoil from the last squirt, decays to 0. */
  recoil = 0;
  readonly bottle = new THREE.Group();

  constructor() {
    nuggetGeo ??= nuggetGeometry();
    const b = builder(false, false);
    this.root.add(this.inner);
    this.body = new THREE.Mesh(nuggetGeo, this.bodyMat);
    this.body.scale.set(0.5, 0.4, 0.38);
    this.body.position.y = 0.3;
    this.body.castShadow = true;
    this.inner.add(this.body);

    const legCol = '#8a4a12';
    this.legL = pivot(this.inner, -0.09, 0.16, 0);
    this.legR = pivot(this.inner, 0.09, 0.16, 0);
    for (const leg of [this.legL, this.legR]) {
      limb(b, leg, 0.022, 0.14, legCol);
      leg.add(ball(b, 0, -0.15, 0.02, 0.07, 0.04, 0.09, legCol));
    }
    this.armL = pivot(this.inner, -0.24, 0.32, 0);
    this.armR = pivot(this.inner, 0.24, 0.32, 0);
    for (const [arm, s] of [[this.armL, -1], [this.armR, 1]] as const) {
      limb(b, arm, 0.018, 0.12, legCol);
      arm.add(ball(b, 0, -0.13, 0, 0.05, 0.05, 0.05, legCol));
      arm.rotation.z = s * 0.5;
    }

    this.eyes = pivot(this.inner, 0, 0.36, 0.155);
    for (const s of [-1, 1]) {
      this.eyes.add(ball(b, s * 0.075, 0, 0, 0.09, 0.105, 0.05, '#ffffff', { rough: 0.3 }));
      this.eyes.add(ball(b, s * 0.075, -0.005, 0.022, 0.045, 0.05, 0.02, '#2a1606', { rough: 0.2 }));
      this.eyes.add(ball(b, s * 0.075 - 0.012, 0.012, 0.03, 0.014, 0.014, 0.01, '#ffffff', { emissive: '#ffffff' }));
      this.eyes.add(ball(b, s * 0.14, -0.07, 0.0, 0.05, 0.03, 0.02, '#f06e50', { rough: 0.9 }));
    }
    const smileGeo = new THREE.TorusGeometry(0.045, 0.011, 6, 14, Math.PI);
    this.smile = new THREE.Mesh(smileGeo, mat('#5a2c06'));
    this.smile.rotation.z = Math.PI;
    this.smile.position.set(0, 0.29, 0.178);
    this.inner.add(this.smile);
    this.ooh = new THREE.Mesh(GEO.sphere, mat('#7a2a10'));
    this.ooh.scale.set(0.04, 0.05, 0.02);
    this.ooh.position.set(0, 0.27, 0.178);
    this.inner.add(this.ooh);
    // Ketchup bottle, held out in front, pointing forward (+z)
    const bb = builder(false, false);
    const btl = new THREE.Group();
    btl.add(cyl(bb, 0, 0, 0, 0.075, 0.24, '#d91e1e', { rough: 0.35 }));
    btl.add(cyl(bb, 0, 0.24, 0, 0.06, 0.05, '#ffffff', { rough: 0.4 }));
    btl.add(cyl(bb, 0, 0.29, 0, 0.012, 0.07, '#ffffff', { rough: 0.4 }, 0.03));
    btl.add(cbox(bb, 0, 0.12, 0.074, 0.09, 0.09, 0.01, '#fff3c4'));
    btl.rotation.x = Math.PI / 2;
    btl.position.set(0, 0, -0.12);
    this.bottle.add(btl);
    this.bottle.position.set(0.17, 0.27, 0.2);
    this.inner.add(this.bottle);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) {
        o.castShadow = true;
        if (!this.allMats.includes(o.material)) {
          // own materials so the nugget can fade while hidden
          if (o !== this.body) o.material = (o.material as THREE.Material).clone();
          this.allMats.push(o.material as THREE.Material);
        }
      }
    });
    for (const m of this.allMats) m.transparent = true;
  }

  animate(facing: number, moving: boolean, phase: number, dt: number, dashing = false) {
    this.root.rotation.y = faceAngle(facing);
    const swing = moving ? Math.sin(phase) * 0.9 : 0;
    this.legL.rotation.x = swing;
    this.legR.rotation.x = -swing;
    this.armL.rotation.x = -swing * 0.8;
    this.armR.rotation.x = swing * 0.8;
    this.inner.position.y = moving ? Math.abs(Math.sin(phase)) * 0.05 : Math.sin(phase * 0.3) * 0.004;
    this.inner.rotation.x = dashing ? 0.35 : moving ? 0.12 : 0;
    const scared = this.mood === 'scared';
    this.smile.visible = !scared;
    this.ooh.visible = scared;
    this.armL.rotation.z = scared ? -2.2 : -0.5;
    this.armR.rotation.z = scared ? 2.2 : 0.5;
    // blinking
    this.blinkT -= dt;
    if (this.blinkT < -0.12) this.blinkT = 2 + Math.random() * 3;
    const blink = this.blinkT < 0 ? 0.1 : 1;
    this.eyes.scale.y = Math.max(0.06, this.awake * blink * (scared ? 1.2 : 1));
    this.smile.visible &&= this.awake > 0.5;
    this.bottle.visible = this.bottleOut > 0.01;
    this.bottle.scale.setScalar(Math.max(0.01, this.bottleOut));
    this.recoil = Math.max(0, this.recoil - dt * 8);
    this.bottle.position.z = 0.2 - this.recoil * 0.06;
    if (this.bottleOut > 0.5) {
      this.armR.rotation.x = -1.3;
      this.armR.rotation.z = 0.2;
      this.armL.rotation.x = -1.1;
      this.armL.rotation.z = -0.3;
    }
    for (const m of this.allMats) m.opacity = this.opacity;
  }
}

// ---------------------------------------------------------------- boss: Uncle Gus

/** A fried chicken drumstick (used in the bucket and as a thrown projectile). */
/** A full ketchup bottle standing upright (the pickup in the boss fight). */
export function ketchupBottle() {
  const b = builder(false, false);
  const g = new THREE.Group();
  g.add(cyl(b, 0, 0, 0, 0.11, 0.34, '#d91e1e', { rough: 0.3 }));
  g.add(cyl(b, 0, 0.34, 0, 0.085, 0.07, '#ffffff', { rough: 0.4 }));
  g.add(cyl(b, 0, 0.41, 0, 0.018, 0.1, '#ffffff', { rough: 0.4 }, 0.045));
  g.add(cbox(b, 0, 0.17, 0.108, 0.13, 0.13, 0.012, '#fff3c4'));
  g.add(ball(b, 0, 0.17, 0.116, 0.035, 0.035, 0.01, '#e0201c')); // tomato on the label
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}

export function drumstick(scale = 1) {
  const b = builder(false, false);
  const g = new THREE.Group();
  g.add(ball(b, 0, 0, 0.06, 0.2, 0.17, 0.26, '#c8731f', { rough: 0.95 }));
  g.add(ball(b, 0.03, 0.05, 0.02, 0.1, 0.06, 0.12, '#e09a3a', { rough: 0.95 }));
  const bone = cyl(b, 0, 0, 0, 0.022, 0.18, '#f6efe0');
  bone.rotation.x = -Math.PI / 2;
  bone.position.set(0, 0, -0.06);
  g.add(bone);
  g.add(ball(b, -0.02, 0, -0.16, 0.06, 0.06, 0.06, '#f6efe0'));
  g.add(ball(b, 0.02, 0, -0.16, 0.06, 0.06, 0.06, '#f6efe0'));
  g.scale.setScalar(scale);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  return g;
}

/** The Manager's pink slip: "YOU'RE FIRED!" (thrown in the Level 2 boss fight). */
let slipTex: THREE.Texture | null = null;
export function pinkSlip(scale = 1) {
  slipTex ??= labelTexture('FIRED!', '#b0103a');
  const g = new THREE.Group();
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.015, 0.3), mat('#ff8fb8', { rough: 0.9 }));
  const words = new THREE.Mesh(new THREE.PlaneGeometry(0.38, 0.1), new THREE.MeshBasicMaterial({ map: slipTex, transparent: true }));
  words.rotation.x = -Math.PI / 2;
  words.position.y = 0.009;
  paper.castShadow = true;
  g.add(paper, words);
  g.scale.setScalar(scale);
  return g;
}

function bucketTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 ? '#ffffff' : '#d62828';
    ctx.fillRect(i * 16, 0, 16, 128);
  }
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(64, 64, 46, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#d62828';
  ctx.font = '900 22px "Lilita One", "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('YUM!', 64, 66);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export type BossLook = 'gus' | 'manager';

export class BossModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly height = 2.35;
  private hipL: THREE.Group;
  private hipR: THREE.Group;
  readonly armL: THREE.Group;
  readonly armR: THREE.Group;
  readonly head: THREE.Group;
  private mouth: THREE.Mesh;
  private hand: THREE.Group;
  private stars = new THREE.Group();
  private flashMats: THREE.MeshStandardMaterial[] = [];
  /** 0..1 poses the renderer and cutscene set. */
  windup = 0;
  crouch = 0;
  eat = 0;
  fallen = 0;
  flash = 0;
  chew = 0;

  constructor(readonly look: BossLook = 'gus') {
    const b = builder(true, false);
    this.root.add(this.body);
    if (look === 'manager') {
      ({ hand: this.hand, mouth: this.mouth } = this.buildManager(b));
      this.hipL = this.body.children[0] as THREE.Group;
      this.hipR = this.body.children[1] as THREE.Group;
      this.armL = this.body.getObjectByName('armL') as THREE.Group;
      this.armR = this.body.getObjectByName('armR') as THREE.Group;
      this.head = this.body.getObjectByName('head') as THREE.Group;
      this.finish(b);
      return;
    }
    const skin = '#f0b98a', shirt = '#3fa7d6', shorts = '#e07a2e';
    this.hipL = pivot(this.body, -0.28, 0.75, 0);
    this.hipR = pivot(this.body, 0.28, 0.75, 0);
    for (const hip of [this.hipL, this.hipR]) {
      limb(b, hip, 0.15, 0.7, skin);
      hip.add(cbox(b, 0, -0.72, 0.08, 0.3, 0.14, 0.42, '#f5f5f5'));
      hip.add(cyl(b, 0, -0.25, 0, 0.19, 0.3, shorts));
    }
    // big round belly in a sky-blue shirt, with a napkin bib
    this.body.add(ball(b, 0, 1.3, 0.05, 1.45, 1.35, 1.25, shirt, { rough: 0.85 }));
    this.body.add(ball(b, 0, 0.95, 0.05, 1.3, 0.7, 1.15, shorts));
    const bib = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.55, 3), mat('#ffffff', { rough: 1 }));
    bib.rotation.set(Math.PI, Math.PI / 6, 0);
    bib.scale.z = 0.15;
    bib.position.set(0, 1.62, 0.6);
    this.body.add(bib);
    this.body.add(ball(b, 0.08, 1.6, 0.64, 0.08, 0.08, 0.03, '#d62828'));
    this.body.add(ball(b, -0.1, 1.48, 0.66, 0.07, 0.07, 0.03, '#d62828'));
    // arms
    this.armL = pivot(this.body, -0.72, 1.75, 0);
    this.armR = pivot(this.body, 0.72, 1.75, 0);
    for (const arm of [this.armL, this.armR]) {
      limb(b, arm, 0.13, 0.75, skin);
      arm.add(ball(b, 0, -0.08, 0, 0.36, 0.3, 0.36, shirt));
      arm.add(ball(b, 0, -0.8, 0, 0.26, 0.26, 0.26, skin));
    }
    // bucket of fried chicken in the left arm
    const bucket = new THREE.Group();
    const bm = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.55, 24, 1, true), new THREE.MeshStandardMaterial({ map: bucketTexture(), roughness: 0.6, side: THREE.DoubleSide }));
    bm.castShadow = true;
    bucket.add(bm);
    bucket.add(cyl(b, 0, -0.275, 0, 0.26, 0.02, '#d62828'));
    for (let i = 0; i < 5; i++) {
      const d = drumstick(0.9);
      d.position.set(Math.cos(i * 1.3) * 0.15, 0.25, Math.sin(i * 1.3) * 0.15);
      d.rotation.set(-1.1 + (i % 2) * 0.4, i * 1.3, 0);
      bucket.add(d);
    }
    bucket.position.set(0.15, -0.75, 0.32);
    bucket.rotation.x = 0.2;
    this.armL.add(bucket);
    // a drumstick in the right hand
    this.hand = new THREE.Group();
    this.hand.position.set(0, -0.85, 0.08);
    const held = drumstick(1.1);
    held.rotation.x = -Math.PI / 2;
    this.hand.add(held);
    this.armR.add(this.hand);
    // head with a backwards cap and a big grin
    this.head = pivot(this.body, 0, 2.15, 0.05);
    this.head.add(ball(b, 0, 0, 0, 0.62, 0.6, 0.6, skin, { rough: 0.7 }));
    this.head.add(ball(b, 0, -0.16, 0.12, 0.5, 0.3, 0.42, skin));
    for (const sx of [-1, 1]) {
      this.head.add(ball(b, sx * 0.12, 0.06, 0.27, 0.08, 0.1, 0.04, '#1d1410', { rough: 0.2 }));
      this.head.add(ball(b, sx * 0.11, 0.085, 0.29, 0.025, 0.025, 0.01, '#ffffff', { emissive: '#ffffff' }));
      this.head.add(ball(b, sx * 0.2, -0.05, 0.25, 0.1, 0.06, 0.03, '#ee8a7a'));
      this.head.add(ball(b, sx * 0.3, 0, 0, 0.1, 0.14, 0.1, skin));
      this.head.add(cbox(b, sx * 0.12, 0.17, 0.27, 0.14, 0.03, 0.03, '#5b3a29'));
    }
    this.head.add(ball(b, 0, -0.01, 0.31, 0.11, 0.1, 0.1, '#e8a27a'));
    this.mouth = new THREE.Mesh(GEO.sphere, mat('#7a2a20'));
    this.mouth.scale.set(0.2, 0.05, 0.05);
    this.mouth.position.set(0, -0.15, 0.27);
    this.head.add(this.mouth);
    this.head.add(ball(b, 0, 0.17, -0.02, 0.63, 0.36, 0.62, '#2e4fa3'));
    this.head.add(cbox(b, 0, 0.2, -0.32, 0.3, 0.04, 0.24, '#2e4fa3'));
    // dizzy stars when beaten (added in finish)
    this.finish(b);
  }

  /** Dizzy stars, shadows and the red hit flash: shared by both bosses. */
  private finish(b: Builder) {
    for (let i = 0; i < 4; i++) {
      const st = new THREE.Mesh(new THREE.OctahedronGeometry(0.09), new THREE.MeshBasicMaterial({ color: '#ffd84a', toneMapped: false }));
      st.position.set(Math.cos(i * 1.57) * 0.45, 0, Math.sin(i * 1.57) * 0.45);
      this.stars.add(st);
    }
    this.stars.position.y = 0.55;
    this.head.add(this.stars);
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh) o.castShadow = true;
    });
    this.flashMats = b.mats.filter((m): m is THREE.MeshStandardMaterial => m instanceof THREE.MeshStandardMaterial);
  }

  /** The store Manager: grey suit, red tie, glasses, a clipboard and a fistful of pink slips. */
  private buildManager(b: Builder) {
    const skin = '#e8b48c', suit = '#3b4252', trousers = '#2e3440', hair = '#4a4038';
    const hipL = pivot(this.body, -0.2, 0.85, 0);
    const hipR = pivot(this.body, 0.2, 0.85, 0);
    for (const hip of [hipL, hipR]) {
      limb(b, hip, 0.13, 0.8, trousers);
      hip.add(cbox(b, 0, -0.82, 0.08, 0.24, 0.12, 0.4, '#111111'));
    }
    // suit jacket over a white shirt, with a red tie and a gold name badge
    this.body.add(ball(b, 0, 1.4, 0, 0.95, 1.1, 0.72, suit, { rough: 0.7 }));
    this.body.add(ball(b, 0, 0.98, 0, 0.82, 0.45, 0.62, trousers));
    this.body.add(cbox(b, 0, 1.62, 0.33, 0.28, 0.5, 0.06, '#ffffff'));
    this.body.add(cbox(b, 0, 1.52, 0.37, 0.09, 0.42, 0.03, '#d62828'));
    this.body.add(cbox(b, 0, 1.8, 0.37, 0.12, 0.07, 0.03, '#d62828'));
    this.body.add(cbox(b, 0.26, 1.68, 0.34, 0.16, 0.07, 0.03, '#f5c518', { metal: 0.6 }));
    const armL = pivot(this.body, -0.56, 1.85, 0);
    const armR = pivot(this.body, 0.56, 1.85, 0);
    armL.name = 'armL';
    armR.name = 'armR';
    for (const arm of [armL, armR]) {
      limb(b, arm, 0.12, 0.78, suit);
      arm.add(ball(b, 0, -0.06, 0, 0.3, 0.26, 0.3, suit));
      arm.add(ball(b, 0, -0.84, 0, 0.13, 0.13, 0.13, skin));
    }
    // clipboard in the left hand
    const board = new THREE.Group();
    board.add(cbox(b, 0, 0, 0, 0.42, 0.56, 0.03, '#a0703c'));
    board.add(cbox(b, 0, -0.02, 0.02, 0.36, 0.46, 0.01, '#ffffff'));
    board.add(cbox(b, 0, 0.26, 0.03, 0.14, 0.05, 0.03, '#c0c0c0', { metal: 0.7 }));
    board.position.set(0.1, -0.8, 0.22);
    board.rotation.set(-0.5, 0, 0);
    armL.add(board);
    // pink slips in the right hand
    const hand = new THREE.Group();
    hand.position.set(0, -0.9, 0.08);
    const slips = pinkSlip(1.1);
    slips.rotation.x = -Math.PI / 2;
    hand.add(slips);
    armR.add(hand);
    // head: neat side-parted hair, glasses and a stern mustache
    const head = pivot(this.body, 0, 2.3, 0.02);
    head.name = 'head';
    head.add(ball(b, 0, 0, 0, 0.5, 0.56, 0.5, skin, { rough: 0.7 }));
    head.add(ball(b, 0, 0.16, -0.04, 0.52, 0.36, 0.52, hair));
    head.add(ball(b, 0.12, 0.27, 0.12, 0.3, 0.12, 0.3, hair));
    for (const sx of [-1, 1]) {
      head.add(ball(b, sx * 0.1, 0.03, 0.24, 0.06, 0.07, 0.03, '#1d1410', { rough: 0.2 }));
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.014, 6, 16), mat('#222222', { metal: 0.5 }));
      rim.position.set(sx * 0.1, 0.03, 0.26);
      head.add(rim);
      head.add(cbox(b, sx * 0.1, 0.13, 0.25, 0.14, 0.03, 0.03, hair)); // frowning eyebrows
      head.add(ball(b, sx * 0.26, 0, 0, 0.08, 0.12, 0.08, skin));
    }
    head.add(cbox(b, 0, 0.03, 0.27, 0.06, 0.02, 0.02, '#222222'));
    head.add(ball(b, 0, -0.03, 0.27, 0.08, 0.08, 0.08, '#d9987a'));
    head.add(ball(b, 0, -0.12, 0.25, 0.17, 0.05, 0.05, hair));
    const mouth = new THREE.Mesh(GEO.sphere, mat('#7a2a20'));
    mouth.scale.set(0.12, 0.03, 0.04);
    mouth.position.set(0, -0.2, 0.23);
    head.add(mouth);
    return { hand, mouth };
  }

  animate(facing: number | null, moving: boolean, phase: number, dt: number, time: number) {
    void dt;
    if (facing !== null) this.root.rotation.y = faceAngle(facing);
    const swing = moving ? Math.sin(phase) * 0.45 : 0;
    const crouch = this.crouch;
    this.hipL.rotation.x = swing - crouch * 0.5;
    this.hipR.rotation.x = -swing - crouch * 0.5;
    this.body.position.y = (moving ? Math.abs(Math.cos(phase)) * 0.08 : Math.sin(time * 2) * 0.02) - crouch * 0.22;
    this.body.rotation.z = moving ? Math.sin(phase) * 0.06 : 0;
    // left arm hugs the bucket; right arm eats or winds up a throw
    this.armL.rotation.set(-0.9, 0, -0.35);
    const eat = Math.max(0, Math.sin(this.eat * Math.PI));
    this.armR.rotation.x = -0.4 - eat * 2.0 - this.windup * 2.6 + (this.windup > 0.95 ? 0 : 0);
    this.armR.rotation.z = 0.3 + eat * 0.3;
    this.hand.visible = this.windup < 0.98;
    const chew = this.chew > 0 ? Math.abs(Math.sin(time * 14)) : 0;
    this.mouth.scale.set(0.2, 0.05 + chew * 0.08 + eat * 0.1, 0.05);
    this.head.rotation.x = -eat * 0.25;
    this.body.rotation.x = -this.fallen * 1.45 + crouch * 0.2;
    this.root.position.y = Math.max(this.root.position.y, 0);
    this.stars.visible = this.fallen > 0.5;
    this.stars.rotation.y = time * 4;
    for (const m of this.flashMats) m.emissive.setRGB(this.flash, 0, 0);
  }
}

// ---------------------------------------------------------------- people

interface Look {
  shirt: string;
  pants: string;
  skin: string;
  hair: string;
  scale: number;
  extra?: string;
}

const LOOKS: Record<Exclude<FamilyKind, 'dog'>, Look> = {
  dad: { shirt: '#4a6fa5', pants: '#3b3b4f', skin: '#f1c27d', hair: '#5b3a29', scale: 1.05 },
  mom: { shirt: '#2e9e74', pants: '#2c3e66', skin: '#e0ac69', hair: '#a0442a', scale: 1 },
  sister: { shirt: '#8e5cc9', pants: '#26262e', skin: '#c68642', hair: '#1d1d1d', scale: 0.92, extra: '#f2679f' },
  grandma: { shirt: '#d9779b', pants: '#6b5b95', skin: '#f3d2b3', hair: '#dcdcdc', scale: 0.93 },
  brother: { shirt: '#f68b2a', pants: '#3a6ea5', skin: '#ffdbac', hair: '#e6be5a', scale: 0.78, extra: '#d63c3c' },
  // store staff: green FreshMart aprons (extra), name tags
  cashier: { shirt: '#f2d16b', pants: '#2f3542', skin: '#e0ac69', hair: '#2b1d14', scale: 0.98, extra: '#2e9e5b' },
  stocker: { shirt: '#5b8bd6', pants: '#3b3b4f', skin: '#c68642', hair: '#1d1d1d', scale: 1.02, extra: '#2e9e5b' },
  butcher: { shirt: '#ffffff', pants: '#3b3b4f', skin: '#f1c27d', hair: '#8a5a36', scale: 1.08, extra: '#e8e8e8' },
  clerk: { shirt: '#e86f7a', pants: '#2c3e66', skin: '#8d5524', hair: '#141010', scale: 0.95, extra: '#2e9e5b' },
  shopper: { shirt: '#f5a623', pants: '#4a5a8a', skin: '#f1c27d', hair: '#c0392b', scale: 1.0, extra: '#ffffff' },
};

const STAFF = new Set(['cashier', 'stocker', 'butcher', 'clerk']);

export class PersonModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  readonly kind: Exclude<FamilyKind, 'dog'>;
  readonly height: number;
  private scale: number;
  private hipL: THREE.Group;
  private hipR: THREE.Group;
  private kneeL: THREE.Group;
  private kneeR: THREE.Group;
  readonly armL: THREE.Group;
  readonly armR: THREE.Group;
  readonly head: THREE.Group;
  private mouth: THREE.Mesh;
  lunge = 0;
  /** 0 standing .. 1 seated on a chair. */
  sit = 0;
  /** Cutscene overrides: when set, arms keep these x rotations. */
  armPose: { l: number; r: number } | null = null;
  mouthOpen = 0;
  talk = 0;

  constructor(kind: Exclude<FamilyKind, 'dog'>) {
    this.kind = kind;
    const L = LOOKS[kind];
    const b = builder(false, false);
    this.root.add(this.body);
    this.body.scale.setScalar(L.scale);
    this.height = 1.78 * L.scale;
    this.scale = L.scale;

    // legs: hip -> knee -> foot
    this.hipL = pivot(this.body, -0.11, 0.8, 0);
    this.hipR = pivot(this.body, 0.11, 0.8, 0);
    const knees: THREE.Group[] = [];
    for (const hip of [this.hipL, this.hipR]) {
      limb(b, hip, 0.075, 0.42, L.pants);
      const knee = pivot(hip, 0, -0.4, 0);
      limb(b, knee, 0.065, 0.38, L.pants);
      knee.add(cbox(b, 0, -0.38, 0.05, 0.13, 0.08, 0.24, '#2a211c'));
      knees.push(knee);
    }
    [this.kneeL, this.kneeR] = knees;

    // torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.38, 6, 14), mat(L.shirt, { rough: 0.85 }));
    torso.scale.set(1, 1, 0.75);
    torso.position.y = 1.12;
    torso.castShadow = true;
    this.body.add(torso);
    if (kind === 'grandma') {
      const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 0.42, 16), mat(L.pants));
      skirt.position.y = 0.78;
      skirt.castShadow = true;
      this.body.add(skirt);
    }
    // collar
    this.body.add(cbox(b, 0, 1.43, 0.12, 0.16, 0.05, 0.04, '#ffffff'));
    if (kind === 'dad') this.body.add(cbox(b, 0, 1.25, 0.165, 0.06, 0.28, 0.02, '#c0392b')); // tie
    if (STAFF.has(kind)) {
      // apron with a pocket, straps and a name tag ("employee of the month" hopefuls)
      this.body.add(cbox(b, 0, 1.0, 0.17, 0.36, 0.62, 0.03, L.extra!));
      this.body.add(cbox(b, 0, 0.92, 0.19, 0.16, 0.1, 0.01, shade(L.extra!, -0.2)));
      for (const sx of [-0.12, 0.12]) this.body.add(cbox(b, sx, 1.36, 0.15, 0.04, 0.14, 0.03, L.extra!));
      this.body.add(cbox(b, 0.1, 1.28, 0.195, 0.1, 0.05, 0.01, '#ffffff'));
      this.body.add(cbox(b, 0.1, 1.28, 0.2, 0.08, 0.012, 0.005, '#c0392b'));
    }

    // arms
    this.armL = pivot(this.body, -0.29, 1.4, 0);
    this.armR = pivot(this.body, 0.29, 1.4, 0);
    for (const arm of [this.armL, this.armR]) {
      limb(b, arm, 0.062, 0.56, L.shirt);
      arm.add(ball(b, 0, -0.6, 0, 0.13, 0.13, 0.13, L.skin));
    }

    // head
    this.head = pivot(this.body, 0, 1.68, 0);
    this.head.add(ball(b, 0, 0, 0, 0.36, 0.38, 0.36, L.skin, { rough: 0.7 }));
    for (const s of [-1, 1]) {
      this.head.add(ball(b, s * 0.07, 0.03, 0.165, 0.045, 0.055, 0.02, '#1d1410', { rough: 0.2 }));
      this.head.add(ball(b, s * 0.06, 0.045, 0.172, 0.014, 0.014, 0.008, '#ffffff', { emissive: '#ffffff' }));
      this.head.add(ball(b, s * 0.12, -0.04, 0.14, 0.05, 0.03, 0.02, '#e88a7a'));
      this.head.add(ball(b, s * 0.18, 0, 0, 0.06, 0.09, 0.06, L.skin)); // ears
    }
    this.head.add(ball(b, 0, -0.01, 0.185, 0.05, 0.05, 0.05, L.skin)); // nose
    this.mouth = new THREE.Mesh(GEO.sphere, mat('#7a2a20'));
    this.mouth.scale.set(0.08, 0.02, 0.02);
    this.mouth.position.set(0, -0.08, 0.165);
    this.head.add(this.mouth);

    // hair styles
    const hair = L.hair;
    switch (kind) {
      case 'dad':
        this.head.add(ball(b, 0, 0.08, -0.02, 0.38, 0.28, 0.38, hair));
        this.head.add(cbox(b, 0, -0.045, 0.18, 0.1, 0.025, 0.02, hair)); // mustache
        break;
      case 'mom':
        this.head.add(ball(b, 0, 0.07, -0.03, 0.4, 0.32, 0.4, hair));
        this.head.add(ball(b, 0, -0.12, -0.12, 0.34, 0.42, 0.2, hair));
        break;
      case 'sister':
        this.head.add(ball(b, 0, 0.07, -0.02, 0.39, 0.3, 0.39, hair));
        this.head.add(ball(b, 0, 0.0, -0.22, 0.12, 0.3, 0.12, hair)); // ponytail
        this.head.add(cbox(b, 0, 0.16, 0.0, 0.36, 0.04, 0.3, L.extra!)); // headband
        break;
      case 'grandma': {
        this.head.add(ball(b, 0, 0.07, -0.03, 0.39, 0.3, 0.39, hair));
        this.head.add(ball(b, 0, 0.2, -0.1, 0.16, 0.14, 0.16, hair)); // bun
        const glasses = new THREE.Mesh(new THREE.TorusGeometry(0.045, 0.008, 6, 16), mat('#6b4f3a', { metal: 0.4 }));
        for (const s of [-1, 1]) {
          const g = glasses.clone();
          g.position.set(s * 0.07, 0.035, 0.18);
          this.head.add(g);
        }
        break;
      }
      case 'cashier':
        this.head.add(ball(b, 0, 0.07, -0.02, 0.39, 0.3, 0.39, hair));
        this.head.add(ball(b, 0, 0.12, 0.02, 0.4, 0.2, 0.4, '#2e9e5b')); // store cap
        this.head.add(cbox(b, 0, 0.12, 0.2, 0.22, 0.03, 0.16, '#2e9e5b'));
        break;
      case 'stocker':
        this.head.add(ball(b, 0, 0.06, -0.02, 0.38, 0.27, 0.38, hair));
        this.head.add(cbox(b, 0, -0.1, 0.16, 0.18, 0.08, 0.06, hair)); // beard
        break;
      case 'butcher': {
        this.head.add(ball(b, 0, 0.06, -0.02, 0.38, 0.26, 0.38, hair));
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.2, 16), mat('#ffffff', { rough: 0.9 }));
        hat.position.set(0, 0.2, 0);
        this.head.add(hat); // paper deli hat
        this.head.add(cbox(b, 0, -0.045, 0.18, 0.12, 0.03, 0.02, hair)); // mustache
        break;
      }
      case 'shopper':
        // curly red hair and a headband: in a big hurry
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          this.head.add(ball(b, Math.cos(a) * 0.12, 0.12 + Math.sin(a * 2) * 0.02, Math.sin(a) * 0.12 - 0.03, 0.17, 0.17, 0.17, hair));
        }
        this.head.add(cbox(b, 0, 0.12, 0, 0.37, 0.05, 0.37, L.extra!));
        break;
      case 'clerk':
        this.head.add(ball(b, 0, 0.08, -0.03, 0.4, 0.3, 0.4, hair));
        this.head.add(ball(b, 0, 0.08, -0.2, 0.2, 0.2, 0.2, hair)); // puff
        break;
      case 'brother':
        this.head.add(ball(b, 0, 0.06, -0.02, 0.38, 0.28, 0.38, hair));
        this.head.add(ball(b, 0, 0.1, 0, 0.39, 0.22, 0.39, L.extra!)); // cap
        this.head.add(cbox(b, 0, 0.1, 0.2, 0.22, 0.03, 0.16, L.extra!)); // cap brim
        break;
    }
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  }

  animate(facing: number | null, moving: boolean, phase: number, dt: number) {
    if (facing !== null) this.root.rotation.y = faceAngle(facing);
    const swing = moving ? Math.sin(phase) * 0.7 : 0;
    const sit = this.sit;
    this.hipL.rotation.x = swing * (1 - sit) - sit * Math.PI / 2;
    this.hipR.rotation.x = -swing * (1 - sit) - sit * Math.PI / 2;
    this.kneeL.rotation.x = (moving ? Math.max(0, -Math.sin(phase)) * 0.6 : 0) + sit * Math.PI / 2;
    this.kneeR.rotation.x = (moving ? Math.max(0, Math.sin(phase)) * 0.6 : 0) + sit * Math.PI / 2;
    this.body.position.y = (moving ? Math.abs(Math.cos(phase)) * 0.04 : 0) - sit * (0.8 * this.scale - 0.6);
    this.lunge = Math.max(0, this.lunge - dt * 1.4);
    if (this.armPose) {
      this.armL.rotation.x = this.armPose.l;
      this.armR.rotation.x = this.armPose.r;
    } else {
      const reach = this.lunge > 0 ? -1.5 * Math.min(1, this.lunge * 2) : 0;
      this.armL.rotation.x = -swing + reach;
      this.armR.rotation.x = swing + reach;
    }
    this.armL.rotation.z = -0.08;
    this.armR.rotation.z = 0.08;
    this.body.rotation.x = this.lunge > 0 ? 0.25 * Math.min(1, this.lunge * 2) : 0;
    const talking = this.talk > 0 ? Math.abs(Math.sin(phase * 2.2)) : 0;
    const open = Math.max(this.mouthOpen, talking * 0.6);
    this.mouth.scale.set(0.08 - open * 0.02, 0.02 + open * 0.07, 0.02);
  }
}

// ---------------------------------------------------------------- dog

export class DogModel {
  readonly root = new THREE.Group();
  readonly body = new THREE.Group();
  private legs: THREE.Group[] = [];
  private tail: THREE.Group;
  readonly head: THREE.Group;
  private earL: THREE.Group;
  private earR: THREE.Group;
  readonly height = 0.75;
  /** 0 standing .. 1 sitting (begging at dinner). */
  sit = 0;
  excited = 0;

  constructor() {
    const b = builder(false, false);
    const fur = '#c8955a', dark = '#7a4f2a', light = '#f1dcc0';
    this.root.add(this.body);
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.42, 6, 14), mat(fur));
    torso.rotation.x = Math.PI / 2;
    torso.position.y = 0.45;
    torso.castShadow = true;
    this.body.add(torso);
    this.body.add(ball(b, 0, 0.4, 0.12, 0.26, 0.24, 0.3, light)); // chest patch
    for (const [x, z] of [[-0.1, 0.22], [0.1, 0.22], [-0.1, -0.22], [0.1, -0.22]]) {
      const leg = pivot(this.body, x, 0.38, z);
      limb(b, leg, 0.045, 0.34, fur);
      leg.add(ball(b, 0, -0.35, 0.02, 0.1, 0.06, 0.12, light));
      this.legs.push(leg);
    }
    this.tail = pivot(this.body, 0, 0.52, -0.36);
    const t = limb(b, this.tail, 0.03, 0.26, fur);
    t.rotation.x = 0;
    this.tail.rotation.x = -2.3;
    this.head = pivot(this.body, 0, 0.66, 0.34);
    this.head.add(ball(b, 0, 0, 0, 0.3, 0.28, 0.3, fur));
    this.head.add(ball(b, 0, -0.05, 0.16, 0.16, 0.13, 0.18, light)); // snout
    this.head.add(ball(b, 0, -0.01, 0.25, 0.06, 0.05, 0.05, '#1d1410', { rough: 0.3 })); // nose
    for (const s of [-1, 1]) {
      this.head.add(ball(b, s * 0.07, 0.06, 0.13, 0.05, 0.06, 0.03, '#1d1410', { rough: 0.2 }));
      this.head.add(ball(b, s * 0.06, 0.075, 0.143, 0.015, 0.015, 0.01, '#ffffff', { emissive: '#ffffff' }));
    }
    this.earL = pivot(this.head, -0.13, 0.08, -0.02);
    this.earR = pivot(this.head, 0.13, 0.08, -0.02);
    for (const ear of [this.earL, this.earR]) ear.add(ball(b, 0, -0.1, 0, 0.08, 0.22, 0.12, dark));
    this.head.add(cyl(b, 0, -0.17, 0.0, 0.13, 0.05, '#d63c3c')); // collar
    const tag = ball(b, 0, -0.2, 0.13, 0.05, 0.05, 0.02, '#f5c518', { metal: 0.7, rough: 0.3 });
    this.head.add(tag);
    this.root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  }

  animate(facing: number | null, moving: boolean, phase: number, dt: number, time: number) {
    void dt;
    if (facing !== null) this.root.rotation.y = faceAngle(facing);
    const swing = moving ? Math.sin(phase * 1.3) * 0.8 : 0;
    const sit = this.sit;
    this.legs[0].rotation.x = swing;
    this.legs[3].rotation.x = swing;
    this.legs[1].rotation.x = -swing;
    this.legs[2].rotation.x = -swing;
    // sitting: tip the body back, fold the back legs
    this.body.rotation.x = -sit * 0.6;
    this.body.position.set(0, (moving ? Math.abs(Math.sin(phase * 1.3)) * 0.05 : 0) - sit * 0.08, -sit * 0.05);
    this.legs[2].rotation.x += sit * 1.2;
    this.legs[3].rotation.x += sit * 1.2;
    this.legs[0].rotation.x += sit * 0.6;
    this.legs[1].rotation.x += sit * 0.6;
    const wag = 6 + this.excited * 10;
    this.tail.rotation.z = Math.sin(time * wag) * (0.4 + this.excited * 0.4);
    this.earL.rotation.z = -0.15 + (moving ? Math.sin(phase * 1.3) * 0.25 : 0);
    this.earR.rotation.z = 0.15 - (moving ? Math.sin(phase * 1.3) * 0.25 : 0);
    this.head.rotation.x = sit * 0.5 + (this.excited ? Math.sin(time * 18) * 0.06 * this.excited : 0);
  }
}

export type FamilyModel = PersonModel | DogModel;

export function makeFamily(kind: FamilyKind): FamilyModel {
  return kind === 'dog' ? new DogModel() : new PersonModel(kind);
}
