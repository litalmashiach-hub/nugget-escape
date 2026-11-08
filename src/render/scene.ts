import { Application, Container, Graphics, Sprite, Texture } from 'pixi.js';
import { START } from '../game/levels';
import type { FloorMap } from '../game/map';
import { INTRO_TIME, type Chaser, type GameEvent, type GameState } from '../game/state';
import { castRay } from '../game/vision';
import { KEY_INFO, type KeyColor } from '../game/types';
import { DogSprite, NuggetSprite, PersonSprite } from './characters';
import {
  MARGIN, T, bakeBubble, bakeDoor, bakeDot, bakeFloor, bakeFurniture, bakeRadial, bakeSparkle, drawKey, makeCanvas,
} from './paint';

interface Particle {
  s: Sprite;
  vx: number;
  vy: number;
  vr: number;
  life: number;
  max: number;
  grav: number;
  fade: boolean;
  grow: number;
}

interface FloorView {
  root: Container;
  floorSprite: Sprite;
  doors: { color: KeyColor; x: number; y: number; sprite: Sprite; open: boolean; orient: 'h' | 'v' }[];
  overlays: { sprite: Sprite; x: number; y: number; w: number; h: number }[];
  lights: Sprite[];
}

const hex = (s: string) => parseInt(s.slice(1), 16);

export class Scene {
  readonly app: Application;
  readonly world = new Container();
  private floorLayer = new Container();
  private doorLayer = new Container();
  private glowLayer = new Container();
  private coneLayer = new Graphics();
  private entityLayer = new Container();
  private overlayLayer = new Container();
  private tint = new Graphics();
  private lightLayer = new Container();
  private fxLayer = new Container();
  private bubbleLayer = new Container();
  private vignette = new Sprite();
  private danger = new Sprite();

  private views = new Map<number, FloorView>();
  private shownFloor = -1;
  private nugget = new NuggetSprite();
  private chaserSprites = new Map<string, { sprite: PersonSprite | DogSprite; bubble: Sprite; bubbleKind: string; pop: number }>();
  private keySprites = new Map<KeyColor, { root: Container; glow: Sprite; icon: Sprite }>();
  private particles: Particle[] = [];
  private tex: Record<string, Texture> = {};
  private doorTex = new Map<string, { tex: Texture; pad: number }>();
  private cam = { x: 0, y: 0 };
  private shake = 0;
  private time = 0;
  private dangerLevel = 0;
  private wonTime = 0;
  zoomMul = 1;

  constructor(app: Application) {
    this.app = app;
    this.tex.light = Texture.from(bakeRadial(256, 'rgba(255,200,130,0.55)', 'rgba(255,200,130,0)'));
    this.tex.keyGlow = Texture.from(bakeRadial(128, 'rgba(255,255,255,0.9)', 'rgba(255,255,255,0)'));
    this.tex.sparkle = Texture.from(bakeSparkle());
    this.tex.dot = Texture.from(bakeDot());
    const conf = makeCanvas(10, 6, 1);
    conf.ctx.fillStyle = '#fff';
    conf.ctx.fillRect(0, 0, 10, 6);
    this.tex.confetti = Texture.from(conf.c);
    for (const k of ['!', '?', 'yum'] as const) this.tex['bubble' + k] = Texture.from(bakeBubble(k));
    this.tex.vignette = Texture.from(bakeRadial(512, 'rgba(5,8,20,0)', 'rgba(5,8,20,0.7)', 1, 0.45));
    this.tex.danger = Texture.from(bakeRadial(512, 'rgba(230,30,50,0)', 'rgba(230,30,50,0.6)', 1, 0.6));

    this.tint.alpha = 1;
    this.world.addChild(
      this.floorLayer, this.doorLayer, this.glowLayer, this.coneLayer, this.entityLayer,
      this.overlayLayer, this.tint, this.lightLayer, this.fxLayer, this.bubbleLayer,
    );
    this.entityLayer.sortableChildren = true;
    this.lightLayer.blendMode = 'add';
    this.glowLayer.blendMode = 'add';
    this.vignette.texture = this.tex.vignette;
    this.danger.texture = this.tex.danger;
    this.danger.alpha = 0;
    app.stage.addChild(this.world, this.vignette, this.danger);
    this.entityLayer.addChild(this.nugget);
  }

  /** Remove every per-game sprite so a new game starts clean. */
  reset() {
    for (const { sprite, bubble } of this.chaserSprites.values()) { sprite.destroy(); bubble.destroy(); }
    this.chaserSprites.clear();
    for (const k of this.keySprites.values()) k.root.destroy({ children: true });
    this.keySprites.clear();
    for (const p of this.particles) p.s.destroy();
    this.particles = [];
    for (const v of this.views.values()) for (const d of v.doors) { d.open = false; d.sprite.texture = this.doorTexture(d.color, false, d.orient).tex; }
    this.shownFloor = -1;
    this.shake = 0;
  }

  private doorTexture(color: KeyColor, open: boolean, orient: 'h' | 'v') {
    const id = `${color}${open}${orient}`;
    let t = this.doorTex.get(id);
    if (!t) {
      const { canvas, pad } = bakeDoor(color, open, orient);
      t = { tex: Texture.from(canvas), pad };
      this.doorTex.set(id, t);
    }
    return t;
  }

  private view(map: FloorMap): FloorView {
    let v = this.views.get(map.def.id);
    if (v) return v;
    const root = new Container();
    const floorSprite = new Sprite(Texture.from(bakeFloor(map)));
    floorSprite.scale.set(0.5);
    floorSprite.position.set(-MARGIN * T, -MARGIN * T);
    root.addChild(floorSprite);
    const doors = map.doors.map((d) => {
      const { tex, pad } = this.doorTexture(d.color, false, d.orient);
      const sprite = new Sprite(tex);
      sprite.scale.set(0.5);
      sprite.position.set(d.x * T - pad, d.y * T - pad);
      return { color: d.color, x: d.x, y: d.y, sprite, open: false, orient: d.orient };
    });
    const overlays = map.def.furniture
      .filter((it) => it.block === 'hide')
      .map((it) => {
        const { canvas, pad } = bakeFurniture(it);
        const sprite = new Sprite(Texture.from(canvas));
        sprite.scale.set(0.5);
        sprite.position.set(it.x * T - pad, it.y * T - pad);
        return { sprite, x: it.x, y: it.y, w: it.w, h: it.h };
      });
    const lights = map.def.lights.map(([x, y]) => {
      const s = new Sprite(this.tex.light);
      s.anchor.set(0.5);
      s.position.set((x + 0.5) * T, (y + 0.5) * T);
      s.width = s.height = T * 9;
      return s;
    });
    // front-door porch light
    if (map.def.id === 0) {
      const gold = map.doors.find((d) => d.color === 'gold');
      if (gold) {
        const s = new Sprite(this.tex.light);
        s.anchor.set(0.5);
        s.position.set((gold.x + 1) * T, (gold.y + 1.4) * T);
        s.width = s.height = T * 5;
        lights.push(s);
      }
    }
    v = { root, floorSprite, doors, overlays, lights };
    this.views.set(map.def.id, v);
    return v;
  }

  /** Bake every floor up-front (call during a loading screen). */
  prepare(state: GameState) {
    for (const m of state.maps) this.view(m);
  }

  private showFloor(state: GameState, floor: number) {
    if (floor === this.shownFloor) return;
    this.shownFloor = floor;
    const map = state.maps[floor];
    const v = this.view(map);
    this.floorLayer.removeChildren();
    this.doorLayer.removeChildren();
    this.overlayLayer.removeChildren();
    this.lightLayer.removeChildren();
    this.floorLayer.addChild(v.floorSprite);
    for (const d of v.doors) this.doorLayer.addChild(d.sprite);
    for (const o of v.overlays) this.overlayLayer.addChild(o.sprite);
    for (const l of v.lights) this.lightLayer.addChild(l);
    this.tint.clear();
    this.tint.rect(-MARGIN * T, -MARGIN * T, (map.w + MARGIN * 2) * T, (map.h + MARGIN * 2) * T).fill({ color: 0x0b1030, alpha: 0.22 });
    for (const p of this.particles) p.life = 0;
  }

  private ensureEntities(state: GameState) {
    for (const c of state.chasers) {
      if (this.chaserSprites.has(c.def.id)) continue;
      const sprite = c.def.kind === 'dog' ? new DogSprite() : new PersonSprite(c.def.kind);
      const bubble = new Sprite(this.tex['bubble!']);
      bubble.anchor.set(0.5, 1);
      bubble.scale.set(1 / 3);
      bubble.visible = false;
      this.entityLayer.addChild(sprite);
      this.bubbleLayer.addChild(bubble);
      this.chaserSprites.set(c.def.id, { sprite, bubble, bubbleKind: '', pop: 0 });
    }
    for (const k of state.keys) {
      if (this.keySprites.has(k.color)) continue;
      const root = new Container();
      const glow = new Sprite(this.tex.keyGlow);
      glow.anchor.set(0.5);
      glow.tint = hex(KEY_INFO[k.color].hex);
      glow.width = glow.height = T * 1.6;
      glow.blendMode = 'add';
      const { c, ctx } = makeCanvas(56, 40, 3);
      drawKey(ctx, k.color, 28, 20, 1);
      const icon = new Sprite(Texture.from(c));
      icon.anchor.set(0.5);
      icon.scale.set(1 / 3);
      root.addChild(glow, icon);
      this.entityLayer.addChild(root);
      this.keySprites.set(k.color, { root, glow, icon });
    }
  }

  // ---------------------------------------------------------------- particles

  private emit(tex: Texture, x: number, y: number, opts: Partial<Omit<Particle, 's'>> & { tint?: number; scale?: number; add?: boolean; rot?: number }) {
    const s = new Sprite(tex);
    s.anchor.set(0.5);
    s.position.set(x, y);
    s.tint = opts.tint ?? 0xffffff;
    s.scale.set(opts.scale ?? 1);
    s.rotation = opts.rot ?? 0;
    if (opts.add) s.blendMode = 'add';
    this.fxLayer.addChild(s);
    const life = opts.life ?? 1;
    this.particles.push({
      s, vx: opts.vx ?? 0, vy: opts.vy ?? 0, vr: opts.vr ?? 0, life, max: life, grav: opts.grav ?? 0, fade: opts.fade ?? true, grow: opts.grow ?? 0,
    });
  }

  burst(x: number, y: number, color: number, n = 18) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.3;
      const sp = 40 + Math.random() * 90;
      this.emit(this.tex.sparkle, x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20, life: 0.7 + Math.random() * 0.5, tint: color, scale: 0.7 + Math.random() * 0.8, add: true, vr: 4 });
    }
  }

  confetti(x: number, y: number) {
    const cols = Object.values(KEY_INFO).map((k) => hex(k.hex));
    for (let i = 0; i < 120; i++) {
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const sp = 150 + Math.random() * 260;
      this.emit(this.tex.confetti, x, y, { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, grav: 380, life: 2 + Math.random() * 1.5, tint: cols[i % cols.length], scale: 0.8 + Math.random() * 0.6, vr: (Math.random() - 0.5) * 14, rot: Math.random() * 3 });
    }
  }

  private updateParticles(dt: number) {
    for (const p of this.particles) {
      p.life -= dt;
      p.vy += p.grav * dt;
      p.s.x += p.vx * dt;
      p.s.y += p.vy * dt;
      p.vx *= 1 - dt * 1.5;
      if (!p.grav) p.vy *= 1 - dt * 1.5;
      p.s.rotation += p.vr * dt;
      if (p.grow) p.s.scale.set(p.s.scale.x + p.grow * dt);
      if (p.fade) p.s.alpha = Math.max(0, p.life / p.max);
    }
    const dead = this.particles.filter((p) => p.life <= 0);
    if (dead.length) {
      for (const p of dead) p.s.destroy();
      this.particles = this.particles.filter((p) => p.life > 0);
    }
  }

  // ---------------------------------------------------------------- events

  handle(state: GameState, e: GameEvent) {
    switch (e.type) {
      case 'key':
        this.burst(e.x * T, e.y * T, hex(KEY_INFO[e.color].hex), 26);
        break;
      case 'unlock': {
        this.burst(e.x * T, e.y * T, hex(KEY_INFO[e.color].hex), 30);
        for (let i = 0; i < 10; i++) this.emit(this.tex.dot, e.x * T + (Math.random() - 0.5) * T, e.y * T + (Math.random() - 0.5) * T, { vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 30, life: 0.9, tint: 0xd8c8b0, scale: 1.2, grow: 2 });
        this.shake = Math.max(this.shake, 4);
        break;
      }
      case 'caught': {
        this.shake = 10;
        const s = this.chaserSprites.get(e.by);
        if (s && s.sprite instanceof PersonSprite) s.sprite.lunge = 1;
        const p = state.player.pos;
        for (let i = 0; i < 24; i++) this.emit(this.tex.dot, p.x * T, p.y * T - 14, { vx: (Math.random() - 0.5) * 160, vy: -Math.random() * 160, grav: 400, life: 0.9, tint: 0xd99a3a, scale: 0.6 + Math.random() * 0.6 });
        break;
      }
      case 'win':
        this.confetti(state.player.pos.x * T, state.player.pos.y * T);
        break;
      case 'dash': {
        const p = state.player.pos;
        for (let i = 0; i < 8; i++) this.emit(this.tex.dot, p.x * T, p.y * T, { vx: (Math.random() - 0.5) * 60, vy: (Math.random() - 0.5) * 60, life: 0.45, tint: 0xfff0c0, scale: 1, grow: 3 });
        break;
      }
      case 'locked':
        this.shake = Math.max(this.shake, 2.5);
        break;
    }
  }

  // ---------------------------------------------------------------- frame

  render(state: GameState, dt: number, menuMode = false) {
    this.time += dt;
    const p = state.player;
    this.ensureEntities(state);
    this.showFloor(state, p.floor);
    const map = state.maps[p.floor];
    const v = this.view(map);

    // Doors
    for (const d of v.doors) {
      const open = state.unlocked.has(d.color);
      if (open !== d.open) {
        d.open = open;
        d.sprite.texture = this.doorTexture(d.color, open, d.orient).tex;
      }
    }

    // Lights flicker gently
    v.lights.forEach((l, i) => { l.alpha = 0.85 + Math.sin(this.time * 2.3 + i * 1.7) * 0.06 + Math.sin(this.time * 7.1 + i) * 0.03; });

    // Keys
    for (const k of state.keys) {
      const ks = this.keySprites.get(k.color)!;
      ks.root.visible = !k.taken && k.floor === p.floor;
      if (!ks.root.visible) continue;
      const bob = Math.sin(this.time * 3 + k.x) * 4;
      ks.root.position.set(k.x * T, k.y * T);
      ks.root.zIndex = k.y * T;
      ks.icon.y = -6 + bob;
      ks.icon.rotation = Math.sin(this.time * 2 + k.y) * 0.15;
      ks.glow.alpha = 0.55 + Math.sin(this.time * 4 + k.x) * 0.2;
      if (Math.random() < dt * 3) this.emit(this.tex.sparkle, k.x * T + (Math.random() - 0.5) * 26, k.y * T - 6 + (Math.random() - 0.5) * 20, { vy: -18, life: 0.8, tint: hex(KEY_INFO[k.color].hex), scale: 0.5 + Math.random() * 0.5, add: true });
    }

    // Nugget
    const n = this.nugget;
    let nx = p.pos.x, ny = p.pos.y, hop = 0;
    if (state.status === 'intro' || menuMode) {
      const t = menuMode ? 0 : 1 - Math.max(0, state.statusTimer) / INTRO_TIME;
      const e = t < 0.35 ? 0 : (t - 0.35) / 0.65;
      nx = START.plate.x + (START.x - START.plate.x) * e;
      ny = START.plate.y + (START.y - START.plate.y) * e;
      hop = Math.sin(Math.min(1, e) * Math.PI) * 26 + (t < 0.35 ? Math.abs(Math.sin(t * 30)) * 3 : 0);
    }
    const floating = state.status === 'intro' || menuMode;
    const wantParent = floating ? this.bubbleLayer : this.entityLayer;
    if (n.parent !== wantParent) wantParent.addChild(n);
    if (state.status === 'won') {
      // Victory lap: keep running down the garden path.
      this.wonTime += dt;
      ny += Math.min(this.wonTime, 2.2) * 3;
    } else this.wonTime = 0;
    n.position.set(nx * T, ny * T);
    n.zIndex = ny * T + (state.status === 'intro' || menuMode ? 200 : 0);
    const anyChase = state.chasers.some((c) => c.floor === p.floor && (c.mode === 'chase' || c.mode === 'alert'));
    n.mood = anyChase || state.status === 'caught' ? 'scared' : 'happy';
    const won = state.status === 'won' && this.wonTime < 2.2;
    if (won) p.walkPhase += dt * 14;
    n.animate(won ? Math.PI / 2 : p.facing, (p.moving && state.status === 'playing') || won, p.walkPhase, dt, p.dashTime > 0);
    n.inner.y -= hop;
    n.alpha = p.hidden ? 0.55 : p.invuln > 0 ? (Math.floor(this.time * 12) % 2 ? 0.35 : 1) : 1;
    n.visible = state.status !== 'won' || this.time % 1 < 10;
    if (state.status === 'caught') {
      const k = Math.max(0, state.statusTimer) / 1.7;
      n.scale.set(0.4 + k * 0.6);
      n.inner.x = Math.sin(this.time * 60) * 2;
    } else {
      n.scale.set(1);
      n.inner.x = 0;
    }
    if (p.moving && state.status === 'playing' && Math.random() < dt * (p.dashTime > 0 ? 40 : 6)) {
      this.emit(this.tex.dot, p.pos.x * T + (Math.random() - 0.5) * 8, p.pos.y * T, { vx: (Math.random() - 0.5) * 20, vy: -10, life: 0.5, tint: 0xd9a54a, scale: 0.35 + Math.random() * 0.3 });
    }

    // Hide overlays fade when the nugget is underneath
    for (const o of v.overlays) {
      const under = p.pos.x > o.x - 0.3 && p.pos.x < o.x + o.w + 0.3 && p.pos.y > o.y - 0.2 && p.pos.y < o.y + o.h + 0.5;
      const target = under ? 0.45 : 1;
      o.sprite.alpha += (target - o.sprite.alpha) * Math.min(1, dt * 10);
    }

    // Family + vision cones
    this.coneLayer.clear();
    let danger = 0;
    for (const c of state.chasers) {
      const cs = this.chaserSprites.get(c.def.id)!;
      const here = c.floor === p.floor;
      cs.sprite.visible = here;
      cs.bubble.visible = false;
      if (!here) continue;
      cs.sprite.position.set(c.pos.x * T, c.pos.y * T);
      cs.sprite.zIndex = c.pos.y * T;
      cs.sprite.animate(c.facing, c.moving, c.walkPhase, dt);
      this.drawCone(state, c);
      const kind = c.mode === 'alert' || (c.mode === 'chase' && c.seesPlayer) ? '!' : c.mode === 'search' || c.mode === 'chase' ? '?' : '';
      const showKind = state.status === 'caught' && state.caughtBy === c.def.name ? 'yum' : kind;
      if (showKind) {
        if (showKind !== cs.bubbleKind) { cs.pop = 0; cs.bubble.texture = this.tex['bubble' + showKind]; }
        cs.pop = Math.min(1, cs.pop + dt * 6);
        const s = (1 / 3) * (cs.pop < 1 ? 0.5 + Math.sin(cs.pop * Math.PI * 0.75) * 0.7 : 1);
        cs.bubble.scale.set(s);
        cs.bubble.visible = true;
        cs.bubble.position.set(c.pos.x * T, c.pos.y * T - (c.def.kind === 'dog' ? 30 : c.def.kind === 'brother' ? 66 : 80) + Math.sin(this.time * 6) * 2);
      }
      cs.bubbleKind = showKind;
      if (c.mode === 'chase' || c.mode === 'alert') danger = 1;
    }

    // Camera
    const screenW = this.app.screen.width, screenH = this.app.screen.height;
    const fit = screenW < 640 ? Math.min(screenW / (10 * T), screenH / (12 * T)) : Math.min(screenW / (15 * T), screenH / (9.5 * T));
    const zoom = Math.max(0.6, Math.min(1.6, fit)) * this.zoomMul;
    const target = menuMode ? { x: (START.plate.x + 0.5) * T, y: (START.plate.y + 1.6) * T } : { x: nx * T, y: ny * T };
    if (this.cam.x === 0 && this.cam.y === 0) this.cam = { ...target };
    const follow = menuMode ? 1 : Math.min(1, dt * 6);
    this.cam.x += (target.x - this.cam.x) * follow;
    this.cam.y += (target.y - this.cam.y) * follow;
    const halfW = screenW / 2 / zoom, halfH = screenH / 2 / zoom;
    const minX = -MARGIN * T + halfW, maxX = (map.w + MARGIN) * T - halfW;
    const minY = -MARGIN * T + halfH, maxY = (map.h + MARGIN) * T - halfH;
    let cx = minX > maxX ? (map.w * T) / 2 : Math.max(minX, Math.min(maxX, this.cam.x));
    let cy = minY > maxY ? (map.h * T) / 2 : Math.max(minY, Math.min(maxY, this.cam.y));
    this.shake = Math.max(0, this.shake - dt * 25);
    cx += (Math.random() - 0.5) * this.shake;
    cy += (Math.random() - 0.5) * this.shake;
    this.world.scale.set(zoom);
    this.world.position.set(screenW / 2 - cx * zoom, screenH / 2 - cy * zoom);

    this.updateParticles(dt);

    // Screen overlays
    this.vignette.width = screenW * 1.3;
    this.vignette.height = screenH * 1.3;
    this.vignette.position.set(-screenW * 0.15, -screenH * 0.15);
    this.danger.width = screenW * 1.2;
    this.danger.height = screenH * 1.2;
    this.danger.position.set(-screenW * 0.1, -screenH * 0.1);
    this.dangerLevel += (danger - this.dangerLevel) * Math.min(1, dt * 4);
    this.danger.alpha = this.dangerLevel * (0.5 + Math.sin(this.time * 8) * 0.2);
  }

  /** Snap the camera to the player (after a floor change). */
  snapCamera() {
    this.cam = { x: 0, y: 0 };
  }

  private drawCone(state: GameState, c: Chaser) {
    const map = state.maps[c.floor];
    const s = state.settings;
    const range = c.def.visionRange * s.visionMult;
    const fov = Math.min(Math.PI * 2, ((c.def.fovDeg >= 360 ? 360 : c.def.fovDeg * s.visionMult) * Math.PI) / 180);
    const rays = c.def.fovDeg >= 360 ? 48 : 28;
    const pts: number[] = [];
    const full = fov >= Math.PI * 2 - 0.01;
    if (!full) pts.push(c.pos.x * T, c.pos.y * T);
    for (let i = 0; i <= rays; i++) {
      const a = c.facing - fov / 2 + (fov * i) / rays;
      const d = castRay(map, state.unlocked, c.pos, a, range);
      pts.push((c.pos.x + Math.cos(a) * d) * T, (c.pos.y + Math.sin(a) * d) * T);
    }
    const hot = c.mode === 'chase' || c.mode === 'alert';
    const col = hot ? 0xff3b3b : c.mode === 'search' ? 0xffa53b : 0xfff3a0;
    this.coneLayer.poly(pts).fill({ color: col, alpha: hot ? 0.2 : 0.13 });
    this.coneLayer.poly(pts).stroke({ width: 1.5, color: col, alpha: hot ? 0.45 : 0.25 });
  }
}
