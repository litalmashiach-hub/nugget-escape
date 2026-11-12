/**
 * Small Three.js toolkit shared by the 3D renderer: cached materials and geometries,
 * box/sphere helpers, procedural canvas textures and the "cutaway" wall shader.
 *
 * World units: one map tile = 1 unit. Map x -> three x, map y -> three z, up is +y.
 */
import * as THREE from 'three';
import { makeCanvas, rng, shade } from './paint';
import type { FloorStyle } from '../game/types';

export { THREE };

// ---------------------------------------------------------------- cutaway

/**
 * Walls and tall furniture between the camera and the nugget are cut down so the
 * nugget is never hidden. Every material that should be cut gets patched with this.
 */
export const cutUniforms = {
  uPlayer: { value: new THREE.Vector3(0, 0, -999) },
  uCutOn: { value: 1 },
};

export function cutaway<M extends THREE.Material>(m: M): M {
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uPlayer = cutUniforms.uPlayer;
    shader.uniforms.uCutOn = cutUniforms.uCutOn;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWorld;')
      .replace(
        '#include <worldpos_vertex>',
        '#include <worldpos_vertex>\nvCutWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vCutWorld;\nuniform vec3 uPlayer;\nuniform float uCutOn;')
      .replace(
        'void main() {',
        `void main() {
  if (uCutOn > 0.5) {
    vec2 d = vCutWorld.xz - uPlayer.xz;
    if (d.y > 0.3 && vCutWorld.y > 0.56 && length(d * vec2(0.55, 0.8)) < 2.6) discard;
  }`,
      );
  };
  m.customProgramCacheKey = () => 'cutaway';
  return m;
}

// ---------------------------------------------------------------- materials

const matCache = new Map<string, THREE.MeshStandardMaterial>();

export interface MatOpts {
  rough?: number;
  metal?: number;
  emissive?: string;
  emissiveIntensity?: number;
  cut?: boolean;
  map?: THREE.Texture;
  unique?: boolean;
  side?: THREE.Side;
}

/** Cached standard material by color + options. `unique` returns a fresh copy (for fading). */
export function mat(color: string, o: MatOpts = {}): THREE.MeshStandardMaterial {
  const key = `${color}|${o.rough ?? 0.8}|${o.metal ?? 0}|${o.emissive ?? ''}|${o.emissiveIntensity ?? 1}|${o.cut ? 1 : 0}|${o.map?.uuid ?? ''}|${o.side ?? 0}`;
  let m = matCache.get(key);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: o.rough ?? 0.8,
      metalness: o.metal ?? 0,
      emissive: o.emissive ?? '#000000',
      emissiveIntensity: o.emissiveIntensity ?? 1,
      map: o.map ?? null,
      side: o.side ?? THREE.FrontSide,
    });
    if (o.cut) cutaway(m);
    matCache.set(key, m);
  }
  if (o.unique) {
    const c = m.clone();
    if (o.cut) cutaway(c);
    return c;
  }
  return m;
}

// ---------------------------------------------------------------- geometry

export const GEO = {
  box: new THREE.BoxGeometry(1, 1, 1),
  sphere: new THREE.SphereGeometry(0.5, 20, 14),
  lowSphere: new THREE.SphereGeometry(0.5, 12, 8),
  cyl: new THREE.CylinderGeometry(0.5, 0.5, 1, 18),
  cone: new THREE.ConeGeometry(0.5, 1, 18),
  plane: new THREE.PlaneGeometry(1, 1),
};

export interface Builder {
  group: THREE.Group;
  /** Every material created through this builder (used for fading). */
  mats: THREE.Material[];
  unique: boolean;
  cut: boolean;
}

export function builder(unique = false, cut = true): Builder {
  return { group: new THREE.Group(), mats: [], unique, cut };
}

function material(b: Builder, color: string | THREE.Material, o: MatOpts = {}) {
  if (typeof color !== 'string') return color;
  const m = mat(color, { cut: b.cut, ...o, unique: b.unique });
  if (!b.mats.includes(m)) b.mats.push(m);
  return m;
}

function add(b: Builder | THREE.Object3D, mesh: THREE.Mesh, shadow = true) {
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  (b instanceof THREE.Object3D ? b : b.group).add(mesh);
  return mesh;
}

/** Box from its minimum corner (x, y, z) and size, in the builder's local space. */
export function box(b: Builder, x: number, y: number, z: number, w: number, h: number, d: number, color: string | THREE.Material, o: MatOpts = {}) {
  const m = new THREE.Mesh(GEO.box, material(b, color, o));
  m.scale.set(w, h, d);
  m.position.set(x + w / 2, y + h / 2, z + d / 2);
  return add(b, m);
}

/** Box centered at (x, y, z). */
export function cbox(b: Builder, x: number, y: number, z: number, w: number, h: number, d: number, color: string | THREE.Material, o: MatOpts = {}) {
  return box(b, x - w / 2, y - h / 2, z - d / 2, w, h, d, color, o);
}

export function cyl(b: Builder, x: number, y: number, z: number, r: number, h: number, color: string | THREE.Material, o: MatOpts = {}, rTop?: number) {
  const g = rTop === undefined ? GEO.cyl : new THREE.CylinderGeometry(rTop, r, 1, 18);
  const m = new THREE.Mesh(g, material(b, color, o));
  m.scale.set(rTop === undefined ? r * 2 : 1, h, rTop === undefined ? r * 2 : 1);
  m.position.set(x, y + h / 2, z);
  return add(b, m);
}

export function ball(b: Builder, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string | THREE.Material, o: MatOpts = {}) {
  const m = new THREE.Mesh(GEO.sphere, material(b, color, o));
  m.scale.set(sx, sy, sz);
  m.position.set(x, y, z);
  return add(b, m);
}

export function cone(b: Builder, x: number, y: number, z: number, r: number, h: number, color: string | THREE.Material, o: MatOpts = {}) {
  const m = new THREE.Mesh(GEO.cone, material(b, color, o));
  m.scale.set(r * 2, h, r * 2);
  m.position.set(x, y + h / 2, z);
  return add(b, m);
}

// ---------------------------------------------------------------- textures

const texCache = new Map<string, THREE.Texture>();

export function canvasTexture(c: HTMLCanvasElement, repeat = false) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const FLOOR_BASE: Record<FloorStyle, string> = {
  wood: '#b98252',
  living: '#93603d',
  parquet: '#c49261',
  checker: '#efe4cf',
  bathTile: '#d9f0ee',
  carpetBlue: '#7d9ad6',
  carpetRose: '#cf9aae',
  attic: '#8f6c4b',
  storeTile: '#f4f1ea',
  concrete: '#a9aeb2',
  officeCarpet: '#6f7f9e',
  grass: '#5d9a45',
  dirt: '#8a6a45',
  straw: '#d9b65e',
  barn: '#9a6a42',
  road: '#7b7166',
};

/** Repeating floor texture covering 2x2 tiles. */
export function floorTexture(style: FloorStyle): THREE.Texture {
  const hit = texCache.get('floor-' + style);
  if (hit) return hit;
  const S = 256;
  const { c, ctx } = makeCanvas(S, S, 1);
  const R = rng(style.length * 977);
  const base = FLOOR_BASE[style];
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, S, S);
  if (style === 'wood' || style === 'living' || style === 'attic') {
    const rows = style === 'attic' ? 7 : 9;
    const ph = S / rows;
    for (let r = 0; r < rows; r++) {
      let x = -R() * 120;
      while (x < S) {
        const len = 70 + R() * 110;
        ctx.fillStyle = shade(base, (R() - 0.5) * 0.24);
        ctx.fillRect(x, r * ph, len, ph);
        ctx.fillStyle = 'rgba(40,20,5,0.35)';
        ctx.fillRect(x, r * ph, 2, ph);
        for (let g = 0; g < 3; g++) {
          ctx.fillStyle = `rgba(60,30,10,${0.06 + R() * 0.08})`;
          ctx.fillRect(x + R() * len, r * ph + R() * ph, 20 + R() * 40, 1);
        }
        x += len;
      }
      ctx.fillStyle = 'rgba(40,20,5,0.4)';
      ctx.fillRect(0, r * ph, S, 1.5);
    }
    // seamless wrap: copy left strip handled by random offsets being small enough
  } else if (style === 'parquet') {
    const s = S / 8;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        const vertical = (x + y) % 2 === 0;
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = shade(base, (R() - 0.5) * 0.2);
          if (vertical) ctx.fillRect(x * s + (k * s) / 3, y * s, s / 3, s);
          else ctx.fillRect(x * s, y * s + (k * s) / 3, s, s / 3);
        }
        ctx.strokeStyle = 'rgba(60,30,10,0.35)';
        ctx.strokeRect(x * s, y * s, s, s);
      }
  } else if (style === 'checker') {
    const s = S / 4;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        ctx.fillStyle = (x + y) % 2 ? '#3f8f86' : base;
        ctx.fillRect(x * s, y * s, s, s);
      }
  } else if (style === 'bathTile') {
    const s = S / 8;
    for (let y = 0; y < 8; y++)
      for (let x = 0; x < 8; x++) {
        ctx.fillStyle = shade(base, (R() - 0.5) * 0.08);
        ctx.fillRect(x * s + 1, y * s + 1, s - 2, s - 2);
      }
    ctx.strokeStyle = '#a8cfcb';
    for (let i = 0; i <= 8; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(S, i * s); ctx.stroke();
    }
  } else if (style === 'storeTile') {
    // big shiny supermarket tiles with the odd colored one
    const s = S / 4;
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        ctx.fillStyle = (x * 3 + y * 5) % 7 === 0 ? '#cfe3d4' : shade(base, (R() - 0.5) * 0.05);
        ctx.fillRect(x * s, y * s, s, s);
      }
    ctx.strokeStyle = 'rgba(120,110,95,0.35)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(i * s, 0); ctx.lineTo(i * s, S); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i * s); ctx.lineTo(S, i * s); ctx.stroke();
    }
  } else if (style === 'concrete') {
    for (let i = 0; i < 2200; i++) {
      ctx.fillStyle = shade(base, (R() - 0.5) * 0.18);
      ctx.fillRect(R() * S, R() * S, 2 + R() * 3, 2 + R() * 3);
    }
    ctx.fillStyle = 'rgba(60,60,60,0.25)';
    ctx.fillRect(0, 0, S, 2);
    ctx.fillRect(0, 0, 2, S);
  } else if (style === 'grass') {
    // sunny meadow: blades in a few greens with the odd clover and daisy
    for (let i = 0; i < 3200; i++) {
      ctx.fillStyle = shade(base, (R() - 0.5) * 0.35);
      ctx.fillRect(R() * S, R() * S, 2, 3 + R() * 4);
    }
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = R() < 0.5 ? '#ffffff' : '#f5d64a';
      ctx.beginPath();
      ctx.arc(R() * S, R() * S, 2 + R() * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else if (style === 'dirt') {
    // tilled field: furrows running across
    for (let r = 0; r < 8; r++) {
      ctx.fillStyle = shade(base, -0.18);
      ctx.fillRect(0, r * 32 + 22, S, 7);
      ctx.fillStyle = shade(base, 0.1);
      ctx.fillRect(0, r * 32 + 4, S, 6);
    }
    for (let i = 0; i < 1600; i++) {
      ctx.fillStyle = shade(base, (R() - 0.5) * 0.3);
      ctx.fillRect(R() * S, R() * S, 2 + R() * 2, 2);
    }
  } else if (style === 'straw') {
    // straw strewn over packed earth
    ctx.fillStyle = shade(base, -0.25);
    ctx.fillRect(0, 0, S, S);
    for (let i = 0; i < 900; i++) {
      ctx.strokeStyle = shade(base, (R() - 0.5) * 0.4);
      ctx.lineWidth = 1.5 + R();
      const x = R() * S, y = R() * S, a = R() * Math.PI, l = 8 + R() * 14;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  } else if (style === 'barn') {
    // wide old floorboards with straw on them
    const rows = 6;
    const ph = S / rows;
    for (let r = 0; r < rows; r++) {
      ctx.fillStyle = shade(base, (R() - 0.5) * 0.2);
      ctx.fillRect(0, r * ph, S, ph);
      ctx.fillStyle = 'rgba(40,20,5,0.45)';
      ctx.fillRect(0, r * ph, S, 2);
    }
    for (let i = 0; i < 260; i++) {
      ctx.strokeStyle = shade('#e3c46e', (R() - 0.5) * 0.3);
      ctx.lineWidth = 1.5;
      const x = R() * S, y = R() * S, a = R() * Math.PI, l = 6 + R() * 10;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      ctx.stroke();
    }
  } else if (style === 'road') {
    for (let i = 0; i < 2400; i++) {
      ctx.fillStyle = shade(base, (R() - 0.5) * 0.3);
      ctx.fillRect(R() * S, R() * S, 2 + R() * 2, 2 + R() * 2);
    }
  } else {
    // carpets: soft speckle
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = shade(base, (R() - 0.5) * 0.25);
      ctx.fillRect(R() * S, R() * S, 2, 2);
    }
  }
  const t = canvasTexture(c, true);
  texCache.set('floor-' + style, t);
  return t;
}

/** Lawn outside the walls. `sunny` is the bright morning grass around the farm. */
export function grassTexture(sunny = false): THREE.Texture {
  const id = sunny ? 'grass-sunny' : 'grass';
  const hit = texCache.get(id);
  if (hit) return hit;
  const S = 256;
  const { c, ctx } = makeCanvas(S, S, 1);
  const R = rng(42);
  ctx.fillStyle = sunny ? '#4f8a3c' : '#2f5a35';
  ctx.fillRect(0, 0, S, S);
  for (let i = 0; i < 3000; i++) {
    ctx.fillStyle = shade(sunny ? '#64a34a' : '#3d7343', (R() - 0.5) * 0.5);
    ctx.fillRect(R() * S, R() * S, 2, 3 + R() * 3);
  }
  const t = canvasTexture(c, true);
  texCache.set(id, t);
  return t;
}

/** Soft round glow (white, tinted by the sprite color). */
export function glowTexture(): THREE.Texture {
  const hit = texCache.get('glow');
  if (hit) return hit;
  const { c, ctx } = makeCanvas(128, 128, 1);
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.45)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = canvasTexture(c);
  texCache.set('glow', t);
  return t;
}

/** Text label texture (for stairs signs). */
export function labelTexture(text: string, color: string) {
  const { c, ctx } = makeCanvas(256, 72, 2);
  ctx.fillStyle = 'rgba(16,20,38,0.82)';
  ctx.beginPath();
  ctx.roundRect(4, 4, 248, 64, 18);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.font = '900 34px "Lilita One", "Arial Rounded MT Bold", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, 128, 38);
  return canvasTexture(c);
}

export const hexNum = (s: string) => parseInt(s.slice(1), 16);
