import { THREE, builder, ball, box, cyl, cone } from './kit';
import type { SecretId } from '../game/secrets';
import { secretsFor } from '../game/secrets';
import type { GameState, Chaser } from '../game/state';
import { buildFurniture } from './furniture';

/** A painted Easter egg (it is an easter egg, after all). */
function eggModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  g.add(ball(b, 0, 0, 0, 0.12, 0.16, 0.12, '#fff6e6', { rough: 0.5 }));
  const bands: [number, string][] = [[0.07, '#ff9ec7'], [0, '#8fd3ff'], [-0.07, '#b9f27c']];
  for (const [y, c] of bands) {
    const r = 0.12 * Math.sqrt(1 - (y / 0.16) ** 2) + 0.004;
    g.add(cyl(b, 0, y, 0, r, 0.028, c, { rough: 0.5 }));
  }
  return g;
}

function bookModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  g.add(box(b, 0, 0, 0, 0.26, 0.06, 0.34, '#c0392b', { rough: 0.7 }));
  g.add(box(b, 0.012, 0, 0, 0.24, 0.045, 0.32, '#fbf3df', { rough: 0.9 }));
  g.add(box(b, -0.125, 0, 0, 0.022, 0.064, 0.345, '#a52f22', { rough: 0.7 }));
  g.add(box(b, -0.126, 0, 0.1, 0.024, 0.066, 0.03, '#f5c518', { metal: 0.4 }));
  g.add(box(b, -0.126, 0, -0.1, 0.024, 0.066, 0.03, '#f5c518', { metal: 0.4 }));
  g.add(box(b, 0.03, 0.032, 0, 0.12, 0.004, 0.12, '#f5c518', { metal: 0.4 }));
  return g;
}

function duckModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  g.add(ball(b, 0, 0, 0, 0.16, 0.12, 0.2, '#ffd23f', { rough: 0.35 }));
  g.add(ball(b, 0, 0.06, -0.15, 0.06, 0.08, 0.06, '#ffd23f', { rough: 0.35 })); // tail
  g.add(ball(b, 0, 0.15, 0.09, 0.1, 0.1, 0.1, '#ffd23f', { rough: 0.35 }));
  const beak = cone(b, 0, 0.13, 0.2, 0.045, 0.09, '#ff8c1a', { rough: 0.4 });
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  g.add(ball(b, 0.05, 0.18, 0.165, 0.018, 0.022, 0.018, '#1b1b1b'));
  g.add(ball(b, -0.05, 0.18, 0.165, 0.018, 0.022, 0.018, '#1b1b1b'));
  g.add(ball(b, 0.13, 0.03, 0, 0.04, 0.05, 0.1, '#f2be2c', { rough: 0.35 })); // wings
  g.add(ball(b, -0.13, 0.03, 0, 0.04, 0.05, 0.1, '#f2be2c', { rough: 0.35 }));
  return g;
}

function boxModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  g.add(box(b, 0, 0, 0, 0.3, 0.22, 0.26, '#c89a5e', { rough: 0.95 }));
  g.add(box(b, 0, 0.112, 0, 0.302, 0.004, 0.05, '#d9c27a', { rough: 0.6 })); // tape
  // flaps sticking up a little: it is a curious box
  const f1 = box(b, 0, 0.11, 0.09, 0.3, 0.004, 0.13, '#b88a50', { rough: 0.95 });
  f1.rotation.x = -0.5;
  f1.position.set(0, 0.14, 0.15);
  g.add(f1);
  g.add(box(b, 0.08, 0.02, 0.131, 0.08, 0.06, 0.002, '#7a5530', { rough: 0.9 })); // "this side up" label
  return g;
}

function denturesModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  for (const [y, flip] of [[0.035, 1], [-0.035, -1]] as const) {
    for (let i = 0; i < 9; i++) {
      const a = -1.2 + (i / 8) * 2.4;
      const x = Math.sin(a) * 0.13, z = Math.cos(a) * 0.1;
      g.add(ball(b, x, y, z, 0.034, 0.03, 0.034, '#ff8fa3', { rough: 0.4 })); // gums
      g.add(box(b, x * 1.02, y - flip * 0.03, z * 1.05, 0.028, 0.035, 0.022, '#fffdf4', { rough: 0.2 })); // teeth
    }
  }
  return g;
}

/** A little grocery cart, just the right size for a nugget. */
function cartModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  const wire = '#c9d3dc', red = '#e8424a';
  g.add(box(b, 0, 0.06, 0, 0.3, 0.012, 0.2, wire, { metal: 0.6, rough: 0.3 })); // floor of the basket
  g.add(box(b, 0, 0.13, 0.1, 0.32, 0.15, 0.012, wire, { metal: 0.6, rough: 0.3 }));
  g.add(box(b, 0, 0.13, -0.1, 0.32, 0.15, 0.012, wire, { metal: 0.6, rough: 0.3 }));
  g.add(box(b, 0.155, 0.13, 0, 0.012, 0.15, 0.2, wire, { metal: 0.6, rough: 0.3 }));
  g.add(box(b, -0.155, 0.13, 0, 0.012, 0.15, 0.2, wire, { metal: 0.6, rough: 0.3 }));
  g.add(box(b, 0, 0.2, 0, 0.33, 0.02, 0.21, red, { rough: 0.4 })); // red rim
  g.add(box(b, -0.2, 0.24, 0, 0.012, 0.012, 0.2, red, { rough: 0.4 })); // handle
  g.add(box(b, -0.18, 0.22, 0.09, 0.05, 0.012, 0.012, wire, { metal: 0.6 }));
  g.add(box(b, -0.18, 0.22, -0.09, 0.05, 0.012, 0.012, wire, { metal: 0.6 }));
  for (const [x, z] of [[0.12, 0.08], [0.12, -0.08], [-0.12, 0.08], [-0.12, -0.08]]) {
    const w = cyl(b, x, 0.025, z, 0.025, 0.018, '#333', { rough: 0.6 });
    w.rotation.x = Math.PI / 2;
    g.add(w);
  }
  return g;
}

/** A little box of green grapes. */
function grapesModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  g.add(box(b, 0, 0, 0, 0.3, 0.1, 0.22, '#f3e3c3', { rough: 0.9 })); // the punnet
  g.add(box(b, 0, -0.01, 0.112, 0.22, 0.05, 0.004, '#9b5de5', { rough: 0.7 })); // label
  const cols = ['#7fc96b', '#9ad66f', '#6bb85a'];
  let i = 0;
  for (let x = -0.1; x <= 0.1; x += 0.05) {
    for (let z = -0.07; z <= 0.07; z += 0.05) {
      const y = 0.07 + ((i * 7) % 3) * 0.012;
      g.add(ball(b, x, y, z, 0.03, 0.034, 0.03, cols[i++ % cols.length], { rough: 0.25 }));
    }
  }
  g.add(cyl(b, 0, 0.12, 0, 0.006, 0.06, '#6b4a2a', { rough: 0.8 })); // stem
  return g;
}

/** Like `ball`, but sized by radius instead of diameter. */
const rball = (b: ReturnType<typeof builder>, x: number, y: number, z: number, rx: number, ry: number, rz: number, c: string, o: Parameters<typeof ball>[8] = {}) =>
  ball(b, x, y, z, rx * 2, ry * 2, rz * 2, c, o);

/** A little black crow, the scarecrow's secret friend. */
function crowModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  const black = '#26262e';
  g.add(rball(b, 0, 0, 0, 0.11, 0.1, 0.16, black, { rough: 0.4 }));
  g.add(rball(b, 0, 0.1, 0.1, 0.08, 0.08, 0.08, black, { rough: 0.4 }));
  const beak = cone(b, 0, 0.09, 0.19, 0.03, 0.08, '#f5c518', { rough: 0.4 });
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  for (const x of [0.04, -0.04]) g.add(rball(b, x, 0.13, 0.16, 0.015, 0.018, 0.015, '#ffffff'));
  for (const s of [1, -1]) {
    const wing = rball(b, s * 0.12, 0.03, -0.01, 0.1, 0.025, 0.12, '#3a3a46', { rough: 0.4 });
    wing.rotation.z = s * 0.5; // flapping wide open
    g.add(wing);
  }
  g.add(box(b, 0, 0.01, -0.17, 0.1, 0.02, 0.08, black, { rough: 0.4 })); // tail
  return g;
}

/** A bottle of chocolate milk with a straw. */
function milkModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  g.add(cyl(b, 0, -0.12, 0, 0.08, 0.22, '#fbfaf4', { rough: 0.2 }));
  g.add(cyl(b, 0, -0.07, 0, 0.083, 0.1, '#7b4a2a', { rough: 0.6 })); // brown label
  g.add(cyl(b, 0, 0.1, 0, 0.05, 0.04, '#7b4a2a', { rough: 0.6 }, 0.04)); // cap
  const straw = cyl(b, 0.02, 0.12, 0, 0.012, 0.16, '#ff8fa3', { rough: 0.4 });
  straw.rotation.z = -0.3;
  g.add(straw);
  return g;
}

/** A fluffy yellow baby chick, with a bit of eggshell still on its head. */
function chickModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  g.add(rball(b, 0, 0, 0, 0.12, 0.11, 0.12, '#ffe066', { rough: 0.8 }));
  g.add(rball(b, 0, 0.13, 0.03, 0.08, 0.08, 0.08, '#ffe066', { rough: 0.8 }));
  const beak = cone(b, 0, 0.12, 0.12, 0.025, 0.05, '#ff8c1a', { rough: 0.4 });
  beak.rotation.x = Math.PI / 2;
  g.add(beak);
  for (const x of [0.035, -0.035]) g.add(rball(b, x, 0.15, 0.1, 0.014, 0.016, 0.012, '#1b1b1b'));
  g.add(cone(b, 0, 0.2, 0.03, 0.06, 0.05, '#fff6e6', { rough: 0.5 })); // eggshell hat
  return g;
}

/** A round pink pig (with some mud on it). Faces +x. */
function pigParts(b: ReturnType<typeof builder>, g: THREE.Group, s = 1, muddy = true) {
  const pink = '#f4a6b8';
  g.add(rball(b, 0, 0.2 * s, 0, 0.26 * s, 0.18 * s, 0.18 * s, pink, { rough: 0.6 }));
  g.add(rball(b, 0.24 * s, 0.24 * s, 0, 0.12 * s, 0.12 * s, 0.12 * s, pink, { rough: 0.6 }));
  const snout = cyl(b, 0.35 * s, 0.22 * s, 0, 0.05 * s, 0.04 * s, '#ee8ca2', { rough: 0.5 });
  snout.rotation.z = Math.PI / 2;
  g.add(snout);
  for (const z of [0.05, -0.05]) {
    g.add(rball(b, 0.32 * s, 0.29 * s, z * s, 0.015 * s, 0.018 * s, 0.015 * s, '#1b1b1b'));
    g.add(cone(b, 0.24 * s, 0.35 * s, z * 1.4 * s, 0.035 * s, 0.07 * s, '#ee8ca2'));
  }
  for (const [x, z] of [[0.13, 0.09], [0.13, -0.09], [-0.13, 0.09], [-0.13, -0.09]]) g.add(cyl(b, x * s, 0, z * s, 0.035 * s, 0.1 * s, pink));
  if (muddy) for (const [x, y, z] of [[0.05, 0.33, 0.06], [-0.12, 0.25, -0.12], [0.1, 0.12, 0.14]]) g.add(rball(b, x * s, y * s, z * s, 0.07 * s, 0.035 * s, 0.06 * s, '#6b4a2a', { rough: 1 }));
}

function piggyModel() {
  const b = builder(true, false);
  const g = new THREE.Group();
  pigParts(b, g, 0.7);
  g.rotation.y = -Math.PI / 2; // face the camera
  const outer = new THREE.Group();
  outer.add(g);
  return outer;
}

const MAKERS: Record<SecretId, () => THREE.Group> = {
  egg: eggModel, book: bookModel, duck: duckModel, box: boxModel, dentures: denturesModel,
  cart: cartModel, grapes: grapesModel, crate: boxModel,
  crow: crowModel, milk: milkModel, chick: chickModel, piggy: piggyModel,
};
/** Height the surprise pops out at: top of the fridge door, the shelf, the tub rim. */
const START_Y: Record<SecretId, number> = { egg: 1.0, book: 1.1, duck: 0.55, box: 0.9, dentures: 0.7, cart: 0.6, grapes: 1.2, crate: 1.0,
  crow: 1.5, milk: 1.0, chick: 0.9, piggy: 0.15 };
export const SECRET_COLORS: Record<SecretId, string[]> = {
  egg: ['#ff9ec7', '#8fd3ff', '#b9f27c', '#fff6e6'],
  book: ['#f5c518', '#c0392b', '#fbf3df'],
  duck: ['#ffd23f', '#ff8c1a', '#8fd3ff'],
  box: ['#c89a5e', '#f5c518', '#ffffff'],
  dentures: ['#fffdf4', '#ff8fa3', '#8fd3ff'],
  cart: ['#e8424a', '#c9d3dc', '#f5c518'],
  grapes: ['#7fc96b', '#9b5de5', '#f3e3c3'],
  crate: ['#c89a5e', '#f5c518', '#ffffff'],
  crow: ['#26262e', '#f5c518', '#ffffff'],
  milk: ['#7b4a2a', '#fbfaf4', '#ff8fa3'],
  chick: ['#ffe066', '#fff6e6', '#ff8c1a'],
  piggy: ['#f4a6b8', '#6b4a2a', '#ffffff'],
};

interface Pop { id: SecretId; model: THREE.Group; t: number; x: number; z: number }

const POP_TIME = 2.6;

/** Shows each easter egg popping out of its hiding place and flying to the nugget. */
export class SecretFx {
  readonly group = new THREE.Group();
  private models = new Map<SecretId, THREE.Group>();
  private pops: Pop[] = [];

  constructor() {
    for (const id of Object.keys(MAKERS) as SecretId[]) {
      const m = MAKERS[id]();
      m.visible = false;
      m.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      this.models.set(id, m);
      this.group.add(m);
    }
  }

  reset() {
    this.pops = [];
    for (const m of this.models.values()) m.visible = false;
  }

  start(id: SecretId, x: number, z: number) {
    this.pops = this.pops.filter((p) => p.id !== id);
    this.pops.push({ id, model: this.models.get(id)!, t: 0, x, z });
  }

  /** Twinkles near secrets not found yet on this floor, and animates the ones just found. */
  update(state: GameState, dt: number, time: number, emit: (x: number, y: number, z: number, color: string) => void) {
    const p = state.player;
    for (const sd of state.level.secrets ? secretsFor(state.level.id) : []) {
      if (sd.floor !== p.floor || state.secrets.has(sd.id) || Math.random() > dt * 1.4) continue;
      const rect = sd.rects[Math.floor(Math.random() * sd.rects.length)];
      const x = rect.x + Math.random() * rect.w;
      const z = rect.y + Math.random() * rect.h;
      emit(x, START_Y[sd.id] + Math.random() * 0.4, z, '#fff7d6');
    }
    for (const pop of this.pops) {
      pop.t += dt;
      const t = pop.t;
      const m = pop.model;
      m.visible = t < POP_TIME;
      if (!m.visible) continue;
      const y0 = START_Y[pop.id];
      if (t < 0.5) {
        const k = t / 0.5;
        const s = 1 + Math.sin(k * Math.PI) * 0.35; // springy pop
        m.position.set(pop.x, y0 + k * 1.1, pop.z);
        m.scale.setScalar(k * s * 2.6);
      } else if (t < 2.0) {
        m.position.set(pop.x, y0 + 1.1 + Math.sin(time * 4) * 0.06, pop.z);
        m.scale.setScalar(2.6);
      } else {
        // fly into the nugget's arms
        const k = (t - 2.0) / (POP_TIME - 2.0);
        m.position.set(pop.x + (p.pos.x - pop.x) * k, y0 + 1.1 + (0.4 - y0 - 1.1) * k + Math.sin(k * Math.PI) * 0.5, pop.z + (p.pos.y - pop.z) * k);
        m.scale.setScalar(2.6 * (1 - k * 0.85));
      }
      m.rotation.y = time * 3;
      if (Math.random() < dt * 6) {
        const cols = SECRET_COLORS[pop.id];
        emit(m.position.x + (Math.random() - 0.5) * 0.4, m.position.y + (Math.random() - 0.5) * 0.3, m.position.z + (Math.random() - 0.5) * 0.4, cols[Math.floor(Math.random() * cols.length)]);
      }
    }
    this.pops = this.pops.filter((p) => p.t < POP_TIME);
  }
}

const FOOD_POOL = 72;

/** The chicken nuggets that rain down from the ceiling when the nugget rain is used. */
export class FoodFx {
  readonly group = new THREE.Group();
  private meshes: THREE.Group[] = [];

  constructor() {
    const b = builder(false, false);
    for (let i = 0; i < FOOD_POOL; i++) {
      const g = new THREE.Group();
      g.add(ball(b, 0, 0.11, 0, 0.22, 0.11, 0.17, '#e0a03c', { rough: 0.95 }));
      g.add(ball(b, 0.05, 0.17, 0.03, 0.1, 0.05, 0.08, '#f0bd5c', { rough: 0.95 }));
      g.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      g.visible = false;
      g.rotation.y = i * 2.4;
      this.meshes.push(g);
      this.group.add(g);
    }
  }

  update(state: GameState, time: number) {
    let n = 0;
    for (const f of state.food) {
      if (f.eaten || f.floor !== state.player.floor || n >= FOOD_POOL) continue;
      const h = Math.min(2.6, f.drop * 3.2);
      const m = this.meshes[n++];
      m.visible = h < 2.25;
      m.position.set(f.x, h, f.y);
      m.rotation.x = h > 0 ? time * 9 + f.x : 0;
    }
    for (; n < FOOD_POOL; n++) this.meshes[n].visible = false;
  }
}

interface Runner { model: THREE.Group; kind: 'hen' | 'pig' | 'cow'; x: number; z: number; dir: number; speed: number; chaser: number; radius: number; phase: number }

/** How many of each animal break out in the Level 3 stampede. */
const HERD: Runner['kind'][] = ['hen', 'hen', 'pig', 'cow', 'hen', 'pig', 'hen', 'cow', 'hen', 'pig', 'hen', 'hen'];

/**
 * Level 3: once every easter egg is found, all the farm animals break out. Hens, pigs and
 * cows run rings around the Farmer, Hank and the dogs, who are far too busy to chase the nugget.
 */
export class StampedeFx {
  readonly group = new THREE.Group();
  private runners: Runner[] = [];
  private started = false;

  constructor() {
    const b = builder(false, false);
    HERD.forEach((kind, i) => {
      const outer = new THREE.Group();
      if (kind === 'pig') {
        const inner = new THREE.Group();
        pigParts(b, inner, 1.8, false);
        outer.add(inner);
      } else {
        // the same hens and cows that stand around the farm, centred so they can turn
        const w = kind === 'cow' ? 2 : 1;
        const f = buildFurniture({ kind, x: 0, y: 0, w, h: 1, block: 'none', color: kind === 'cow' && i % 2 ? '#8a5a3a' : undefined });
        f.group.position.set(-w / 2, 0, -0.5);
        f.group.scale.setScalar(kind === 'cow' ? 0.8 : 1.3);
        f.group.position.multiplyScalar(kind === 'cow' ? 0.8 : 1.3);
        const inner = new THREE.Group();
        inner.add(f.group);
        if (kind === 'hen') inner.rotation.y = -Math.PI / 2; // hens face +z, turn them to face +x like the rest
        outer.add(inner);
      }
      outer.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
      outer.visible = false;
      this.group.add(outer);
      this.runners.push({ model: outer, kind, x: 0, z: 0, dir: 0, speed: 0, chaser: 0, radius: 0, phase: i * 1.7 });
    });
  }

  reset() {
    this.started = false;
    for (const r of this.runners) r.model.visible = false;
  }

  private release(chasers: Chaser[]) {
    this.started = true;
    this.runners.forEach((r, i) => {
      const c = chasers[i % chasers.length];
      r.chaser = i % chasers.length;
      const a = (i / this.runners.length) * Math.PI * 2;
      r.radius = 1.3 + (i % 3) * 0.45;
      r.x = c.pos.x + Math.cos(a) * r.radius;
      r.z = c.pos.y + Math.sin(a) * r.radius;
      r.dir = i % 2 ? 1 : -1; // which way round they run
      r.speed = r.kind === 'cow' ? 2.2 : r.kind === 'pig' ? 2.8 : 3.4;
    });
  }

  update(state: GameState, dt: number, time: number) {
    const on = state.happy && state.level.secrets === 'stampede' && !state.boss && state.chasers.length > 0;
    this.group.visible = on;
    if (!on) { if (this.started && !state.happy) this.reset(); return; }
    const chasers = state.chasers.filter((c) => c.floor === state.player.floor);
    if (!chasers.length) return;
    if (!this.started) this.release(chasers);
    const map = state.maps[state.player.floor];
    const free = (x: number, z: number) => map.walkableForFamily(Math.floor(x), Math.floor(z), state.unlocked);
    for (const r of this.runners) {
      const c = chasers[r.chaser % chasers.length];
      // run in circles around the farm folk, with a bit of zigzag panic
      const dx = r.x - c.pos.x, dz = r.z - c.pos.y;
      const d = Math.hypot(dx, dz) || 1;
      const out = (r.radius - d) * 1.5;
      let vx = (-dz / d) * r.dir + (dx / d) * out, vz = (dx / d) * r.dir + (dz / d) * out;
      const zig = Math.sin(time * 5 + r.phase) * 0.35;
      vx += -vz * zig; vz += vx * zig;
      const l = Math.hypot(vx, vz) || 1;
      const nx = r.x + (vx / l) * r.speed * dt, nz = r.z + (vz / l) * r.speed * dt;
      if (free(nx, nz)) { r.x = nx; r.z = nz; }
      else if (d > r.radius * 2.5 || !free(r.x, r.z)) { r.x = c.pos.x; r.z = c.pos.y; } // lost behind a wall: catch up
      else r.dir = -r.dir; // bumped into something: turn around
      const hop = r.kind === 'hen' ? Math.abs(Math.sin(time * 14 + r.phase)) * 0.12 : Math.abs(Math.sin(time * 9 + r.phase)) * 0.05;
      r.model.visible = true;
      r.model.position.set(r.x, hop, r.z);
      r.model.rotation.y = -Math.atan2(vz, vx);
    }
  }
}
