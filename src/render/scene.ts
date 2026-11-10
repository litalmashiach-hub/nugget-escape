/**
 * The 3D renderer. Reads the game state every frame and draws it with Three.js:
 * the current floor of the house, the nugget, the family with their vision cones,
 * keys, doors and effects. Gameplay itself lives in src/game and knows nothing about this.
 */
import { THREE, cutUniforms, canvasTexture, glowTexture, GEO } from './kit';
import { buildFloor, type FloorView } from './world';
import { buildFurniture } from './furniture';
import { CART_REACH } from '../game/carts';
import { SecretFx, FoodFx, SECRET_COLORS } from './secrets';
import { NuggetModel, PersonModel, BossModel, drumstick, pinkSlip, ketchupBottle, makeFamily, type FamilyModel } from './characters';
import { OfficeCutscene } from './office';
import { Cutscene, BossCutscene, CAM_OFFSET } from './cutscene';
import { bakeBubble, drawSymbol, makeCanvas } from './paint';
import { LEVEL1, type LevelId } from '../game/levels';
import { StreetCutscene } from './street';

const START = LEVEL1.start as Required<typeof LEVEL1.start>;
import { INTRO_TIME, type Chaser, type GameEvent, type GameState } from '../game/state';
import { castRay } from '../game/vision';
import { SLAM_RADIUS, autoAim, bossDef } from '../game/boss';
import { KEY_INFO, type KeyColor } from '../game/types';

export type View = 'game' | 'menu' | 'cutscene' | 'bossIntro' | 'street';

export interface SceneOptions {
  /** Cheaper rendering for slow or software GPUs: no shadows, no lamp lights. */
  lowFx: boolean;
  /** Phones and tablets: shadows stay, but smaller and without lamp lights. */
  phone?: boolean;
}

const MAX_RAYS = 48;
const MAX_PARTICLES = 600;

interface ChaserView {
  model: FamilyModel;
  bubble: THREE.Sprite;
  bubbleKind: string;
  pop: number;
  cone: THREE.Mesh;
  coneMat: THREE.MeshBasicMaterial;
}

interface KeyView {
  root: THREE.Group;
  spin: THREE.Group;
  glow: THREE.Sprite;
}

class Particles {
  readonly mesh: THREE.InstancedMesh;
  private pos = new Float32Array(MAX_PARTICLES * 3);
  private vel = new Float32Array(MAX_PARTICLES * 3);
  private life = new Float32Array(MAX_PARTICLES);
  private max = new Float32Array(MAX_PARTICLES);
  private size = new Float32Array(MAX_PARTICLES);
  private grav = new Float32Array(MAX_PARTICLES);
  private spin = new Float32Array(MAX_PARTICLES);
  private next = 0;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private e = new THREE.Euler();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3();
  private c = new THREE.Color();

  constructor() {
    this.mesh = new THREE.InstancedMesh(GEO.box, new THREE.MeshBasicMaterial({ toneMapped: false }), MAX_PARTICLES);
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
      this.mesh.setColorAt(i, this.c.set('#ffffff'));
    }
  }

  emit(x: number, y: number, z: number, o: { vx?: number; vy?: number; vz?: number; life?: number; size?: number; grav?: number; color: string | number }) {
    const i = this.next;
    this.next = (this.next + 1) % MAX_PARTICLES;
    this.pos.set([x, y, z], i * 3);
    this.vel.set([o.vx ?? 0, o.vy ?? 0, o.vz ?? 0], i * 3);
    this.life[i] = this.max[i] = o.life ?? 1;
    this.size[i] = o.size ?? 0.06;
    this.grav[i] = o.grav ?? 0;
    this.spin[i] = Math.random() * 6;
    this.mesh.setColorAt(i, this.c.set(o.color));
    this.mesh.instanceColor!.needsUpdate = true;
  }

  clear() {
    this.life.fill(0);
  }

  update(dt: number) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.life[i] <= 0) {
        if (this.max[i] > 0) {
          this.mesh.setMatrixAt(i, this.m.makeScale(0, 0, 0));
          this.max[i] = 0;
        }
        continue;
      }
      this.life[i] -= dt;
      const k = i * 3;
      this.vel[k + 1] -= this.grav[i] * dt;
      const drag = 1 - dt * 1.2;
      this.vel[k] *= drag;
      this.vel[k + 2] *= drag;
      this.pos[k] += this.vel[k] * dt;
      this.pos[k + 1] = Math.max(0.01, this.pos[k + 1] + this.vel[k + 1] * dt);
      this.pos[k + 2] += this.vel[k + 2] * dt;
      const a = Math.max(0, this.life[i] / this.max[i]);
      const s = this.size[i] * Math.min(1, a * 2.5);
      this.e.set(this.spin[i] * this.life[i] * 3, this.spin[i], this.spin[i] * this.life[i] * 2);
      this.m.compose(this.v.set(this.pos[k], this.pos[k + 1], this.pos[k + 2]), this.q.setFromEuler(this.e), this.s.set(s, s, s));
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

function keyModel(color: KeyColor) {
  const info = KEY_INFO[color];
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: info.hex, metalness: 0.55, roughness: 0.3, emissive: info.hex, emissiveIntensity: 0.4 });
  const bow = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.045, 10, 24), m);
  bow.position.x = -0.17;
  const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.06, 0.06), m);
  shaft.position.x = 0.1;
  const t1 = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.1, 0.05), m);
  t1.position.set(0.22, -0.07, 0);
  const t2 = t1.clone();
  t2.position.x = 0.13;
  const { c, ctx } = makeCanvas(64, 64, 2);
  ctx.fillStyle = '#fffaf0';
  ctx.beginPath();
  ctx.arc(32, 32, 32, 0, Math.PI * 2);
  ctx.fill();
  drawSymbol(ctx, info.symbol, 32, 33, 40, info.dark);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshBasicMaterial({ map: canvasTexture(c), side: THREE.DoubleSide }));
  disc.position.x = -0.17;
  g.add(bow, shaft, t1, t2, disc);
  g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  g.scale.setScalar(1.25);
  return g;
}

export class Scene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
  readonly cutscene = new Cutscene();
  readonly bossCut = new BossCutscene();
  readonly officeCut = new OfficeCutscene();
  readonly street = new StreetCutscene();
  private secretFx = new SecretFx();
  private foodFx = new FoodFx();
  private gus = new BossModel();
  private manager = new BossModel('manager');
  private flyingSlips: THREE.Group[] = [];
  private ketchupBlobs: THREE.Mesh[] = [];
  private flyingSticks: THREE.Group[] = [];
  private slamRing: THREE.Mesh;
  /** Ketchup bottles to grab when the nugget's bottle is empty. */
  private pickups: { root: THREE.Group; bottle: THREE.Group; glow: THREE.Sprite }[] = [];
  /** Shows where the next squirt will go. */
  private aimLine: THREE.Mesh;
  readonly opts: SceneOptions;
  private host: HTMLElement;
  /** Built floors per level: level id -> floor id -> view. */
  private levels = new Map<LevelId, Map<number, FloorView>>();
  private shownFloor = '';
  private nugget = new NuggetModel();
  private plate = new THREE.Group();
  private chasers = new Map<string, ChaserView>();
  private keys = new Map<KeyColor, KeyView>();
  private particles = new Particles();
  private sun = new THREE.DirectionalLight('#c9d4ff', 1.25);
  private hemi = new THREE.HemisphereLight('#c9d3ff', '#5a4632', 1.1);
  private lamps: THREE.PointLight[] = [];
  private bubbleTex: Record<string, THREE.Texture> = {};
  /** Shoppers with carts (Level 2), reused from a small pool. */
  private cartViews: { root: THREE.Group; shopper: PersonModel; bubble: THREE.Sprite }[] = [];
  private camTarget = new THREE.Vector3();
  private camReady = false;
  private shake = 0;
  private time = 0;
  private wonTime = 0;
  private dangerLevel = 0;
  private dangerEl = document.getElementById('danger');
  private glow = glowTexture();

  constructor(host: HTMLElement, opts: SceneOptions) {
    this.host = host;
    this.opts = opts;
    this.renderer = new THREE.WebGLRenderer({ antialias: !opts.lowFx, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(opts.lowFx ? 1 : Math.min(opts.phone ? 1.5 : 2, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = !opts.lowFx;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    host.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color('#0e1324');
    this.scene.fog = new THREE.Fog('#0e1324', 26, 60);
    this.hemi.intensity = opts.lowFx ? 1.7 : opts.phone ? 1.35 : 1.1;
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.sun.castShadow = !opts.lowFx;
    this.sun.shadow.mapSize.setScalar(opts.phone ? 1024 : 2048);
    const sc = this.sun.shadow.camera;
    sc.left = sc.bottom = -16;
    sc.right = sc.top = 16;
    sc.near = 1;
    sc.far = 50;
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.03;
    if (!opts.lowFx && !opts.phone) {
      for (let i = 0; i < 7; i++) {
        const l = new THREE.PointLight('#ffc88a', 0, 9, 1.4);
        this.lamps.push(l);
        this.scene.add(l);
      }
    }

    for (const k of ['!', '?', 'yum'] as const) this.bubbleTex[k] = canvasTexture(bakeBubble(k));
    this.scene.add(this.nugget.root, this.particles.mesh, this.cutscene.group, this.street.group, this.gus.root, this.manager.root, this.officeCut.group, this.secretFx.group, this.foodFx.group);
    this.gus.root.visible = false;
    this.manager.root.visible = false;
    for (let i = 0; i < 16; i++) {
      const sl = pinkSlip(1.3);
      sl.visible = false;
      this.flyingSlips.push(sl);
      this.scene.add(sl);
    }
    const blobMat = new THREE.MeshStandardMaterial({ color: '#e0201c', roughness: 0.25, emissive: '#7a0a08', emissiveIntensity: 0.5 });
    for (let i = 0; i < 24; i++) {
      const m = new THREE.Mesh(GEO.lowSphere, blobMat);
      m.scale.set(0.16, 0.13, 0.22);
      m.visible = false;
      m.castShadow = true;
      this.ketchupBlobs.push(m);
      this.scene.add(m);
    }
    for (let i = 0; i < 16; i++) {
      const d = drumstick(1.5);
      d.visible = false;
      this.flyingSticks.push(d);
      this.scene.add(d);
    }
    this.slamRing = new THREE.Mesh(new THREE.RingGeometry(SLAM_RADIUS - 0.12, SLAM_RADIUS, 40), new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false }));
    const fill = new THREE.Mesh(new THREE.CircleGeometry(SLAM_RADIUS - 0.12, 40), new THREE.MeshBasicMaterial({ color: '#ff3030', transparent: true, opacity: 0.18, depthWrite: false, toneMapped: false }));
    this.slamRing.add(fill);
    this.slamRing.rotation.x = -Math.PI / 2;
    this.slamRing.renderOrder = 3;
    this.slamRing.visible = false;
    this.scene.add(this.slamRing);

    for (let i = 0; i < 3; i++) {
      const root = new THREE.Group();
      const bottle = ketchupBottle();
      bottle.scale.setScalar(2);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: '#ff5a4a', transparent: true, depthWrite: false, toneMapped: false }));
      glow.scale.set(1.6, 1.6, 1);
      glow.position.y = 0.45;
      root.add(bottle, glow);
      root.visible = false;
      this.pickups.push({ root, bottle, glow });
      this.scene.add(root);
    }
    // a row of fading dashes in front of the nugget: the squirt goes this way
    const dash = document.createElement('canvas');
    dash.width = 256; dash.height = 16;
    const dctx = dash.getContext('2d')!;
    for (let i = 0; i < 8; i++) {
      dctx.fillStyle = `rgba(255,60,50,${1 - i * 0.09})`;
      dctx.fillRect(i * 32 + 4, 2, 20, 12);
    }
    const aimTex = canvasTexture(dash);
    this.aimLine = new THREE.Mesh(new THREE.PlaneGeometry(3, 0.24), new THREE.MeshBasicMaterial({ map: aimTex, transparent: true, depthWrite: false, toneMapped: false }));
    this.aimLine.geometry.translate(1.5 + 0.35, 0, 0);
    this.aimLine.rotation.x = -Math.PI / 2;
    this.aimLine.renderOrder = 3;
    this.aimLine.visible = false;
    this.scene.add(this.aimLine);

    // Dad's plate on the dining table: where the nugget starts.
    const plateMesh = new THREE.Mesh(GEO.cyl, new THREE.MeshStandardMaterial({ color: '#fbfbf7', roughness: 0.3 }));
    plateMesh.scale.set(0.42, 0.025, 0.42);
    plateMesh.position.y = 0.012;
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.012, 6, 28), plateMesh.material);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.025;
    this.plate.add(plateMesh, rim);
    this.plate.position.set(START.plate.x, 0.862, START.plate.y);
    this.plate.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  }

  /** Build every floor up-front (call during the loading screen). */
  prepare(state: GameState) {
    const lv = state.level;
    let floors = this.levels.get(lv.id);
    if (!floors) this.levels.set(lv.id, (floors = new Map()));
    let built = false;
    for (const m of state.maps) {
      if (floors.has(m.def.id)) continue;
      const v = buildFloor(m, lv.outside);
      v.group.visible = false;
      if (lv.start.plate && m.def.id === lv.start.floor) v.group.add(this.plate);
      floors.set(m.def.id, v);
      this.scene.add(v.group);
      built = true;
    }
    if (!built) return;
    // compile shaders now rather than on the first frame of play
    this.showFloor(lv.id, lv.start.floor);
    this.renderer.compile(this.scene, this.camera);
  }

  private floorView(level: LevelId, floor: number) {
    return this.levels.get(level)?.get(floor);
  }

  /** Clear per-game objects so a new game starts clean. */
  reset() {
    for (const c of this.chasers.values()) {
      this.scene.remove(c.model.root, c.bubble, c.cone);
      c.cone.geometry.dispose();
    }
    this.chasers.clear();
    for (const k of this.keys.values()) this.scene.remove(k.root);
    this.keys.clear();
    this.particles.clear();
    for (const fl of this.levels.values()) for (const v of fl.values()) for (const d of v.doors) { d.amount = 0; d.hinge.rotation.y = 0; }
    this.shake = 0;
    this.wonTime = 0;
    this.gus.fallen = 0;
    this.manager.fallen = 0;
    this.bossCut.reset();
    this.officeCut.reset();
    this.secretFx.reset();
  }

  snapCamera() {
    this.camReady = false;
  }

  /** Show one floor of one level (or nothing, for the street cutscene). */
  private showFloor(level: LevelId | 0, floor: number) {
    const key = `${level}:${floor}`;
    if (key === this.shownFloor) return;
    this.shownFloor = key;
    for (const [lid, fl] of this.levels) for (const [id, v] of fl) v.group.visible = lid === level && id === floor;
    const v = level ? this.floorView(level, floor) : undefined;
    const spots: [number, number][] = v ? [...v.lights] : [];
    if (v && level === 1 && floor === 0) {
      const gold = v.doors.find((d) => d.color === 'gold');
      if (gold) spots.push([gold.x, gold.y + 1.2]);
    }
    this.lamps.forEach((l, i) => {
      const s = spots[i];
      l.intensity = s ? 5.5 : 0;
      if (s) l.position.set(s[0] + 0.5, 2.0, s[1] + 0.5);
    });
    this.particles.clear();
  }

  private ensureEntities(state: GameState) {
    for (const c of state.chasers) {
      if (this.chasers.has(c.def.id)) continue;
      const model = makeFamily(c.def.kind);
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex['!'], depthTest: false }));
      bubble.renderOrder = 10;
      bubble.visible = false;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((MAX_RAYS + 1) * 9), 3));
      const coneMat = new THREE.MeshBasicMaterial({ color: '#fff3a0', transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
      const cone = new THREE.Mesh(g, coneMat);
      cone.frustumCulled = false;
      cone.renderOrder = 2;
      this.scene.add(model.root, bubble, cone);
      this.chasers.set(c.def.id, { model, bubble, bubbleKind: '', pop: 0, cone, coneMat });
    }
    for (const k of state.keys) {
      if (this.keys.has(k.color)) continue;
      const root = new THREE.Group();
      const spin = keyModel(k.color);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glow, color: KEY_INFO[k.color].hex, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
      glow.scale.set(1.4, 1.4, 1);
      glow.position.y = 0.55;
      root.add(spin, glow);
      this.scene.add(root);
      this.keys.set(k.color, { root, spin, glow });
    }
  }

  // ---------------------------------------------------------------- effects

  burst(x: number, y: number, z: number, color: string, n = 22) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const sp = 1 + Math.random() * 2;
      this.particles.emit(x, y, z, { vx: Math.cos(a) * sp, vy: 1.5 + Math.random() * 2.5, vz: Math.sin(a) * sp, grav: 5, life: 0.8 + Math.random() * 0.5, size: 0.07 + Math.random() * 0.05, color });
    }
  }

  confetti(x: number, z: number) {
    const cols = Object.values(KEY_INFO).map((k) => k.hex);
    for (let i = 0; i < 160; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 1 + Math.random() * 3;
      this.particles.emit(x, 0.5, z, { vx: Math.cos(a) * sp, vy: 4 + Math.random() * 5, vz: Math.sin(a) * sp, grav: 6, life: 2.2 + Math.random() * 1.5, size: 0.09, color: cols[i % cols.length] });
    }
  }

  handle(state: GameState, e: GameEvent) {
    const p = state.player.pos;
    switch (e.type) {
      case 'secret': {
        const cols = SECRET_COLORS[e.id];
        // pop out just in front of the furniture, toward the nugget, so it is not hidden inside it
        const x = e.x + (p.x - e.x) * 0.7, z = e.y + (p.y - e.y) * 0.7;
        for (let i = 0; i < 2; i++) this.burst(x, 1, z, cols[i % cols.length], 9);
        this.secretFx.start(e.id, x, z);
        break;
      }
      case 'chomp':
        if (e.floor === state.player.floor) for (let i = 0; i < 10; i++) this.particles.emit(e.x, 0.15, e.y, { vx: (Math.random() - 0.5) * 2, vy: 1 + Math.random() * 1.5, vz: (Math.random() - 0.5) * 2, grav: 7, life: 0.6, size: 0.05, color: '#e0a03c' });
        break;
      case 'key':
        this.burst(e.x, 0.6, e.y, KEY_INFO[e.color].hex, 30);
        break;
      case 'unlock':
        this.burst(e.x, 1, e.y, KEY_INFO[e.color].hex, 34);
        for (let i = 0; i < 12; i++) this.particles.emit(e.x + (Math.random() - 0.5), 0.2, e.y + (Math.random() - 0.5), { vy: 0.6 + Math.random(), life: 1, size: 0.12, color: '#d8c8b0' });
        this.shake = Math.max(this.shake, 0.08);
        break;
      case 'caught': {
        this.shake = 0.22;
        const s = this.chasers.get(e.by);
        if (s && s.model instanceof PersonModel) s.model.lunge = 1;
        for (let i = 0; i < 26; i++) this.particles.emit(p.x, 0.3, p.y, { vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, grav: 9, life: 1, size: 0.05, color: '#d99a3a' });
        break;
      }
      case 'win':
        this.confetti(p.x, p.y);
        break;
      case 'slip':
        for (let i = 0; i < 22; i++) {
          const a = Math.random() * Math.PI * 2, sp = 0.8 + Math.random() * 1.8;
          this.particles.emit(e.x, 0.1, e.y, { vx: Math.cos(a) * sp, vy: 1.2 + Math.random() * 2, vz: Math.sin(a) * sp, grav: 8, life: 0.7, size: 0.06, color: '#9fdcff' });
        }
        break;
      case 'cartCrash':
        this.shake = Math.max(this.shake, 0.1);
        for (let i = 0; i < 14; i++) this.particles.emit(e.x, 0.4, e.y, { vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 2, vz: (Math.random() - 0.5) * 3, grav: 8, life: 0.7, size: 0.07, color: ['#e8424a', '#f5c518', '#58c13f', '#3d7df0'][i % 4] });
        break;
      case 'bumped':
        this.shake = 0.2;
        for (let i = 0; i < 20; i++) this.particles.emit(p.x, 0.3, p.y, { vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, grav: 9, life: 0.9, size: 0.05, color: '#d99a3a' });
        break;
      case 'dash':
        for (let i = 0; i < 10; i++) this.particles.emit(p.x, 0.1, p.y, { vx: (Math.random() - 0.5) * 2, vy: 0.4, vz: (Math.random() - 0.5) * 2, life: 0.45, size: 0.1, color: '#fff0c0' });
        break;
      case 'locked':
        this.shake = Math.max(this.shake, 0.05);
        break;
      case 'squirt':
        this.nugget.recoil = 1;
        for (let i = 0; i < 4; i++) {
          const a = state.player.facing + (Math.random() - 0.5) * 0.6;
          this.particles.emit(p.x + Math.cos(a) * 0.3, 0.32, p.y + Math.sin(a) * 0.3, { vx: Math.cos(a) * 2, vy: 0.8, vz: Math.sin(a) * 2, grav: 6, life: 0.35, size: 0.05, color: '#e0201c' });
        }
        break;
      case 'bossHit':
        for (let i = 0; i < 14; i++) this.particles.emit(e.x, 1.2 + Math.random() * 0.6, e.y, { vx: (Math.random() - 0.5) * 4, vy: 1 + Math.random() * 2.5, vz: (Math.random() - 0.5) * 4, grav: 9, life: 0.7, size: 0.08, color: i % 3 ? '#e0201c' : '#ff6a4a' });
        this.shake = Math.max(this.shake, 0.04);
        break;
      case 'slam':
        this.shake = 0.35;
        for (let i = 0; i < 40; i++) {
          const a = (i / 40) * Math.PI * 2;
          this.particles.emit(e.x + Math.cos(a) * 0.8, 0.1, e.y + Math.sin(a) * 0.8, { vx: Math.cos(a) * 4, vy: 0.8 + Math.random(), vz: Math.sin(a) * 4, grav: 4, life: 0.7, size: 0.12, color: '#c9b48a' });
        }
        break;
      case 'hurt':
        this.shake = 0.25;
        for (let i = 0; i < 20; i++) this.particles.emit(p.x, 0.3, p.y, { vx: (Math.random() - 0.5) * 3, vy: 1 + Math.random() * 3, vz: (Math.random() - 0.5) * 3, grav: 9, life: 0.9, size: 0.05, color: '#d99a3a' });
        break;
      case 'bossDown': {
        const b = state.boss!;
        this.shake = 0.3;
        this.burst(b.pos.x, 2, b.pos.y, '#ffd84a', 40);
        break;
      }
    }
  }

  // ---------------------------------------------------------------- frame

  private resize() {
    const w = this.host.clientWidth || window.innerWidth, h = this.host.clientHeight || window.innerHeight;
    const size = this.renderer.getSize(new THREE.Vector2());
    if (size.x !== w || size.y !== h) {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }
  }

  render(state: GameState, dt: number, view: View = 'game') {
    this.time += dt;
    this.resize();
    this.ensureEntities(state);
    const p = state.player;
    const bossIntro = view === 'bossIntro';
    const street = view === 'street';
    const story = view === 'cutscene' || view === 'menu' || street;
    if (street) this.showFloor(0, 0);
    else if (story) this.showFloor(1, START.floor);
    else this.showFloor(state.level.id, p.floor);
    const fv = this.floorView(story ? 1 : state.level.id, story ? START.floor : p.floor)!;

    this.cutscene.group.visible = story && !street;
    this.street.group.visible = street;
    this.nugget.root.visible = !story;
    this.gus.root.visible = !story && !!state.boss && p.floor === 0 && state.level.id === 1;
    this.manager.root.visible = !story && !!state.boss && state.level.id === 2;
    // the security monitors live on the Manager's desk; the full-screen footage only in the cutscene
    this.officeCut.group.visible = !story && state.level.id === 2;
    if (!bossIntro) this.officeCut.hideTape();
    this.plate.visible = true;
    cutUniforms.uCutOn.value = story ? 0 : 1;

    // Doors swing open once unlocked
    for (const d of fv.doors) {
      const target = state.unlocked.has(d.color) ? 1 : 0;
      d.amount += (target - d.amount) * Math.min(1, dt * 4);
      d.hinge.rotation.y = d.swing * d.amount * Math.PI * 0.47;
    }

    // Lamps flicker gently
    this.lamps.forEach((l, i) => {
      if (l.intensity > 0) l.intensity = 5.5 + Math.sin(this.time * 2.3 + i * 1.7) * 0.3 + Math.sin(this.time * 7.1 + i) * 0.15;
    });

    // Keys
    for (const k of state.keys) {
      const kv = this.keys.get(k.color)!;
      kv.root.visible = !story && !k.taken && k.floor === p.floor;
      if (!kv.root.visible) continue;
      kv.root.position.set(k.x, 0, k.y);
      kv.spin.position.y = 0.6 + Math.sin(this.time * 3 + k.x) * 0.1;
      kv.spin.rotation.y = this.time * 2;
      kv.glow.material.opacity = 0.55 + Math.sin(this.time * 4 + k.x) * 0.2;
      if (Math.random() < dt * 4) this.particles.emit(k.x + (Math.random() - 0.5) * 0.5, 0.4 + Math.random() * 0.4, k.y + (Math.random() - 0.5) * 0.5, { vy: 0.5, life: 0.8, size: 0.04, color: KEY_INFO[k.color].hex });
    }

    if (street) this.renderStreet(dt);
    else if (story) this.renderStory(dt, view);
    else if (bossIntro) this.renderBossIntro(state, dt);
    else this.renderGame(state, dt, fv);
    this.foodFx.group.visible = !story && !bossIntro;
    if (!story && !bossIntro) {
      this.foodFx.update(state, this.time);
      this.secretFx.group.visible = true;
      this.secretFx.update(state, dt, this.time, (x, y, z, color) => this.particles.emit(x, y, z, { vy: 0.4, life: 0.9, size: 0.045, color }));
    } else this.secretFx.group.visible = false;
    if (!story) this.renderBossFight(state, dt, bossIntro);
    this.renderCarts(state, dt, !story && !bossIntro);

    this.particles.update(dt);

    // Shadow-casting moonlight follows the camera focus
    const focus = street ? this.street.focus : story ? new THREE.Vector3(17, 0, 4.5) : bossIntro ? (state.level.id === 2 ? this.officeCut.focus : new THREE.Vector3(15, 0, 24.5)) : this.camTarget;
    this.sun.position.set(focus.x - 7, 16, focus.z + 9);
    this.sun.target.position.copy(focus);

    this.renderer.render(this.scene, this.camera);
  }

  private renderCarts(state: GameState, dt: number, show: boolean) {
    const carts = show ? state.carts : [];
    while (this.cartViews.length < carts.length) {
      const root = new THREE.Group();
      const shopper = new PersonModel('shopper');
      const cart = buildFurniture({ kind: 'cart', x: 0, y: 0, w: 1, h: 1, block: 'solid' });
      // the cart model faces +z in local space; put it in front of the shopper
      cart.group.position.set(0.5, 0, CART_REACH + 0.5);
      cart.group.rotation.y = Math.PI; // handle toward the shopper
      cart.group.scale.setScalar(1.1);
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex['!'], depthTest: false }));
      bubble.renderOrder = 10;
      bubble.scale.setScalar(0.55);
      bubble.position.y = 2.3;
      root.add(shopper.root, cart.group, bubble);
      root.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      this.scene.add(root);
      this.cartViews.push({ root, shopper, bubble });
    }
    this.cartViews.forEach((v, i) => {
      const c = carts[i];
      v.root.visible = !!c;
      if (!c) return;
      v.root.position.set(c.pos.x, 0, c.pos.y);
      // the whole group turns: shopper and cart face the way they are going
      v.root.rotation.y = Math.PI / 2 - c.facing;
      v.shopper.armPose = { l: -1.2, r: -1.2 }; // both hands on the handle
      v.shopper.animate(null, c.mode === 'charge', c.walkPhase, dt);
      v.shopper.root.rotation.y = 0;
      v.bubble.visible = c.mode === 'windup' || (c.mode === 'charge' && Math.floor(this.time * 6) % 2 === 0);
    });
  }

  private renderStreet(dt: number) {
    for (const c of this.chasers.values()) { c.model.root.visible = false; c.bubble.visible = false; c.cone.visible = false; }
    this.street.update(dt, this.camera, this.time);
    if (this.camera.aspect < 0.8) {
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      this.camera.position.addScaledVector(dir, -2.5);
    }
    this.camReady = false;
    this.setDanger(0, dt);
  }

  private renderStory(dt: number, view: View) {
    for (const c of this.chasers.values()) { c.model.root.visible = false; c.bubble.visible = false; c.cone.visible = false; }
    if (view === 'cutscene') this.cutscene.update(dt, this.camera, this.time);
    else this.cutscene.idle(this.camera, this.time, dt);
    if (this.camera.aspect < 0.8) {
      // portrait phones: pull back so the whole table fits
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      this.camera.position.addScaledVector(dir, -2.2);
    }
    this.camTarget.set(START.x, 0, START.y);
    this.camReady = false;
    this.setDanger(0, dt);
  }

  private renderBossIntro(state: GameState, dt: number) {
    for (const c of this.chasers.values()) { c.model.root.visible = false; c.bubble.visible = false; c.cone.visible = false; }
    if (state.level.id === 2) {
      // inside the store: keep the wall cutaway on around the nugget
      this.manager.root.visible = true;
      this.officeCut.update(dt, this.camera, this.time, this.nugget, this.manager);
      cutUniforms.uCutOn.value = 1;
      cutUniforms.uPlayer.value.copy(this.officeCut.focus);
    } else {
      this.gus.root.visible = true;
      cutUniforms.uCutOn.value = 0;
      this.bossCut.update(dt, this.camera, this.time, this.nugget, this.gus);
    }
    if (this.camera.aspect < 0.8) {
      const dir = this.camera.getWorldDirection(new THREE.Vector3());
      this.camera.position.addScaledVector(dir, -2.0);
    }
    this.camReady = false;
    this.setDanger(0, dt);
    void state;
  }

  /** Uncle Gus, flying ketchup and drumsticks, the slam warning ring. */
  private renderBossFight(state: GameState, dt: number, intro: boolean) {
    const b = state.boss;
    const fighting = !!b && !intro && state.player.floor === 0;
    let ki = 0, di = 0, si = 0;
    if (fighting) {
      const g = state.level.id === 2 ? this.manager : this.gus;
      g.root.position.set(b.pos.x, b.mode === 'jump' ? Math.sin(b.jump * Math.PI) * 2.6 : 0, b.pos.y);
      g.windup = b.mode === 'throwWindup' ? Math.min(1, g.windup + dt * 4) : Math.max(0, g.windup - dt * 6);
      g.crouch = b.mode === 'slamWindup' ? Math.min(1, g.crouch + dt * 3) : b.mode === 'recover' ? Math.max(0, g.crouch - dt * 1.5) : b.mode === 'jump' ? 0.3 : Math.max(0, g.crouch - dt * 4);
      if (b.mode === 'recover' && b.timer > 0.6) g.crouch = 0.8;
      g.fallen = b.mode === 'defeated' || (state.status === 'won' && b.hp <= 0) ? Math.min(1, g.fallen + dt * 2.5) : 0;
      g.flash = b.flash > 0 ? 0.9 : 0;
      g.eat = 0;
      g.chew = 0;
      g.animate(b.facing, b.mode === 'walk', b.walkPhase, dt, this.time);
      for (const s of state.shots) {
        if (s.kind === 'ketchup' && ki < this.ketchupBlobs.length) {
          const m = this.ketchupBlobs[ki++];
          m.visible = true;
          m.position.set(s.pos.x, 0.35 + (1.4 - s.life) * 0.4, s.pos.y);
          m.rotation.y = Math.atan2(s.vel.x, s.vel.y);
        } else if (s.kind === 'drumstick' && di < this.flyingSticks.length) {
          const d = this.flyingSticks[di++];
          d.visible = true;
          d.position.set(s.pos.x, 0.6, s.pos.y);
          d.rotation.set(s.spin, s.spin * 0.7, 0);
        } else if (s.kind === 'slip' && si < this.flyingSlips.length) {
          const d = this.flyingSlips[si++];
          d.visible = true;
          d.position.set(s.pos.x, 0.7 + Math.sin(s.spin * 0.5) * 0.08, s.pos.y);
          d.rotation.set(Math.sin(s.spin) * 0.4, s.spin * 0.8, Math.cos(s.spin * 0.7) * 0.3);
        }
      }
      const ring = b.target && (b.mode === 'slamWindup' || b.mode === 'jump');
      this.slamRing.visible = !!ring;
      if (ring) {
        this.slamRing.position.set(b.target!.x, 0.05, b.target!.y);
        const pulse = 1 + Math.sin(this.time * 18) * 0.04;
        this.slamRing.scale.set(pulse, pulse, 1);
      }
      // squirt direction
      const p = state.player;
      this.aimLine.visible = state.status === 'boss' && state.ketchup > 0 && b.mode !== 'defeated';
      this.aimLine.position.set(p.pos.x, 0.06, p.pos.y);
      // on Easy the ketchup flies at Gus by itself, so the line points at him
      const aim = autoAim(state) ? Math.atan2(b.pos.y - p.pos.y, b.pos.x - p.pos.x) : p.facing;
      this.aimLine.rotation.set(-Math.PI / 2, 0, -aim);
      // bottles to grab
      this.pickups.forEach((pk, i) => {
        const bt = state.bottles[i];
        pk.root.visible = !!bt && state.status === 'boss';
        if (!bt) return;
        const pop = Math.min(1, bt.age * 3);
        pk.root.position.set(bt.pos.x, 0, bt.pos.y);
        pk.bottle.position.y = (1 - pop) * 2.5 + 0.12 + Math.sin(this.time * 4 + i) * 0.08;
        pk.bottle.rotation.y = this.time * 2 + i;
        pk.glow.material.opacity = 0.45 + Math.sin(this.time * 6 + i) * 0.2;
      });
    } else {
      this.slamRing.visible = false;
      this.aimLine.visible = false;
      for (const pk of this.pickups) pk.root.visible = false;
    }
    for (; ki < this.ketchupBlobs.length; ki++) this.ketchupBlobs[ki].visible = false;
    for (; di < this.flyingSticks.length; di++) this.flyingSticks[di].visible = false;
    for (; si < this.flyingSlips.length; si++) this.flyingSlips[si].visible = false;
  }

  private renderGame(state: GameState, dt: number, fv: FloorView) {
    const p = state.player;
    const map = state.maps[p.floor];

    // ------------------------------------------------ nugget
    const n = this.nugget;
    let nx = p.pos.x, nz = p.pos.y, ny = 0;
    const st = state.level.start;
    if (state.status === 'intro' && !st.plate) {
      // walks in through the sliding doors
      const t = 1 - Math.max(0, state.statusTimer) / INTRO_TIME;
      nz = st.y + 1.6 * (1 - t);
      p.walkPhase += dt * 12;
    } else if (state.status === 'intro') {
      const t = 1 - Math.max(0, state.statusTimer) / INTRO_TIME;
      const e = t < 0.3 ? 0 : (t - 0.3) / 0.7;
      nx = START.plate.x + (START.x - START.plate.x) * e;
      nz = START.plate.y + (START.y - START.plate.y) * e;
      ny = 0.9 * (1 - e) + Math.sin(Math.min(1, e) * Math.PI) * 0.7;
    }
    // after the boss fight, or in the Manager's Office, the nugget hops for joy
    const afterBoss = !!state.boss;
    const hopForJoy = afterBoss || state.level.goal !== 'frontDoor';
    if (state.status === 'won') {
      this.wonTime += dt;
      // without a boss the nugget runs off down the garden path; after the fight it hops for joy
      if (hopForJoy) ny = Math.abs(Math.sin(this.wonTime * 7)) * 0.35;
      else nz += Math.min(this.wonTime, 2.4) * 3;
    } else this.wonTime = 0;
    n.root.position.set(nx, ny, nz);
    const anyChase = state.chasers.some((c) => c.floor === p.floor && (c.mode === 'chase' || c.mode === 'alert'));
    n.mood = anyChase || state.status === 'caught' ? 'scared' : 'happy';
    n.awake = 1;
    const won = state.status === 'won' && this.wonTime < 2.4 && !hopForJoy;
    if (won) p.walkPhase += dt * 14;
    const fighting = state.status === 'boss';
    n.bottleOut = afterBoss ? 1 : 0;
    if (fighting && state.boss!.mode === 'jump') n.mood = 'scared';
    n.animate(won ? Math.PI / 2 : hopForJoy && state.status === 'won' ? Math.PI / 2 : p.facing, (p.moving && (state.status === 'playing' || fighting)) || won, p.walkPhase, dt, p.dashTime > 0);
    if (fighting && state.boss!.mode === 'jump') n.mood = 'scared';
    n.opacity = p.hidden ? 0.5 : 1;
    n.root.visible = !(p.invuln > 0 && (state.status === 'playing' || fighting) && Math.floor(this.time * 12) % 2);
    if (state.status === 'caught') {
      const k = Math.max(0, state.statusTimer) / 1.7;
      n.root.scale.setScalar(0.4 + k * 0.6);
      n.inner.position.x = Math.sin(this.time * 60) * 0.03;
    } else {
      n.root.scale.setScalar(1);
      n.inner.position.x = 0;
    }
    if (p.moving && (state.status === 'playing' || fighting) && Math.random() < dt * (p.dashTime > 0 ? 40 : 6)) {
      this.particles.emit(p.pos.x + (Math.random() - 0.5) * 0.15, 0.03, p.pos.y + (Math.random() - 0.5) * 0.15, { vy: 0.3, life: 0.5, size: 0.05, color: '#d9a54a' });
    }

    // ------------------------------------------------ hiding spots fade when the nugget is underneath
    for (const h of fv.hides) {
      const under = p.pos.x > h.x - 0.4 && p.pos.x < h.x + h.w + 0.4 && p.pos.y > h.y - 0.4 && p.pos.y < h.y + h.h + 0.7;
      const target = under && state.status !== 'intro' ? 0.3 : 1;
      if (Math.abs(target - h.fade) < 0.001) continue;
      h.fade += (target - h.fade) * Math.min(1, dt * 10);
      for (const m of h.mats) m.opacity = h.fade;
    }

    // ------------------------------------------------ family + vision cones
    let danger = 0;
    for (const c of state.chasers) {
      const cv = this.chasers.get(c.def.id)!;
      // in the Manager boss fight the staff are left out on the shop floor
      const here = c.floor === p.floor && !(state.boss && state.level.id === 2);
      cv.model.root.visible = here;
      cv.cone.visible = here;
      cv.bubble.visible = false;
      if (!here) continue;
      cv.model.root.position.set(c.pos.x, 0, c.pos.y);
      if (cv.model instanceof PersonModel) cv.model.animate(c.facing, c.moving, c.walkPhase, dt);
      else cv.model.animate(c.facing, c.moving, c.walkPhase, dt, this.time);
      const feasting = c.mode === 'feast';
      const chewing = feasting && c.timer > 0 && !c.moving;
      if (!(cv.model instanceof PersonModel)) cv.model.excited = c.mode === 'chase' || c.mode === 'alert' || feasting ? 1 : 0;
      else cv.model.mouthOpen = chewing ? Math.abs(Math.sin(this.time * 12)) : 0;
      cv.cone.visible = !feasting;
      if (!feasting) this.updateCone(state, c, cv);
      const kind = chewing ? 'yum' : c.mode === 'alert' || (c.mode === 'chase' && c.seesPlayer) ? '!' : c.mode === 'search' || c.mode === 'chase' ? '?' : '';
      const showKind = state.status === 'caught' && state.caughtBy === c.def.name ? 'yum' : kind;
      if (showKind) {
        if (showKind !== cv.bubbleKind) { cv.pop = 0; cv.bubble.material.map = this.bubbleTex[showKind]; }
        cv.pop = Math.min(1, cv.pop + dt * 6);
        const s = 0.5 * (cv.pop < 1 ? 0.5 + Math.sin(cv.pop * Math.PI * 0.75) * 0.7 : 1);
        cv.bubble.scale.set(s * 0.9, s, 1);
        cv.bubble.visible = true;
        cv.bubble.position.set(c.pos.x, cv.model.height + 0.4 + Math.sin(this.time * 6) * 0.03, c.pos.y);
      }
      cv.bubbleKind = showKind;
      if (c.mode === 'chase' || c.mode === 'alert') danger = 1;
    }

    // ------------------------------------------------ camera
    const target = new THREE.Vector3(nx, 0, nz);
    if (afterBoss) {
      // frame both the nugget and the boss inside the arena
      const b = state.boss!;
      const ARENA = bossDef(state).arena;
      target.set((nx + b.pos.x) / 2, 0, (nz + b.pos.y) / 2);
      target.x = Math.max(ARENA.x0 + 3, Math.min(ARENA.x1 - 3, target.x));
      target.z = Math.max(ARENA.y0 + 1.5, Math.min(ARENA.y1 - 2, target.z));
    } else {
      const margin = 4.5;
      if (map.w > margin * 2) target.x = Math.max(margin, Math.min(map.w - margin, target.x));
      target.z = Math.max(2.5, Math.min(map.h - 1, target.z));
      if (state.status === 'won' && !hopForJoy) target.z = nz;
    }
    if (!this.camReady) { this.camTarget.copy(target); this.camReady = true; }
    this.camTarget.lerp(target, Math.min(1, dt * 5));
    const portrait = this.camera.aspect < 0.8;
    const off = CAM_OFFSET.clone().multiplyScalar((portrait ? 1.45 : this.camera.aspect < 1.2 ? 1.15 : 1) * (afterBoss ? 1.08 : 1));
    this.shake = Math.max(0, this.shake - dt * 0.6);
    const jitter = new THREE.Vector3((Math.random() - 0.5) * this.shake, 0, (Math.random() - 0.5) * this.shake);
    this.camera.position.copy(this.camTarget).add(off).add(jitter);
    this.camera.lookAt(this.camTarget.clone().add(jitter));
    cutUniforms.uPlayer.value.set(nx, 0, nz);

    if (fighting && (state.boss!.mode === 'slamWindup' || state.boss!.mode === 'jump')) danger = 1;
    this.setDanger(danger, dt);
  }

  private setDanger(target: number, dt: number) {
    this.dangerLevel += (target - this.dangerLevel) * Math.min(1, dt * 4);
    if (this.dangerEl) this.dangerEl.style.opacity = String(this.dangerLevel * (0.6 + Math.sin(this.time * 8) * 0.25));
  }

  private updateCone(state: GameState, c: Chaser, cv: ChaserView) {
    const map = state.maps[c.floor];
    const s = state.settings;
    const range = c.def.visionRange * s.visionMult;
    const fov = Math.min(Math.PI * 2, ((c.def.fovDeg >= 360 ? 360 : c.def.fovDeg * s.visionMult) * Math.PI) / 180);
    const rays = c.def.fovDeg >= 360 ? MAX_RAYS : 28;
    const attr = cv.cone.geometry.getAttribute('position') as THREE.BufferAttribute;
    const arr = attr.array as Float32Array;
    const y = 0.04;
    let px = 0, pz = 0;
    for (let i = 0; i <= rays; i++) {
      const a = c.facing - fov / 2 + (fov * i) / rays;
      const d = castRay(map, state.unlocked, c.pos, a, range);
      const x = c.pos.x + Math.cos(a) * d, z = c.pos.y + Math.sin(a) * d;
      if (i > 0) {
        const k = (i - 1) * 9;
        arr[k] = c.pos.x; arr[k + 1] = y; arr[k + 2] = c.pos.y;
        arr[k + 3] = px; arr[k + 4] = y; arr[k + 5] = pz;
        arr[k + 6] = x; arr[k + 7] = y; arr[k + 8] = z;
      }
      px = x;
      pz = z;
    }
    attr.needsUpdate = true;
    cv.cone.geometry.setDrawRange(0, rays * 3);
    const hot = c.mode === 'chase' || c.mode === 'alert';
    cv.coneMat.color.setHex(hot ? 0xff3b3b : c.mode === 'search' ? 0xffa53b : 0xfff3a0);
    cv.coneMat.opacity = hot ? 0.28 : 0.17;
  }
}

