import { Container, Graphics, Sprite, Texture } from 'pixi.js';
import type { FamilyKind } from '../game/types';
import { drawNuggetBody, makeCanvas } from './paint';

type View = 'front' | 'back' | 'side';

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
  sister: { shirt: '#8e5cc9', pants: '#26262e', skin: '#c68642', hair: '#1d1d1d', scale: 0.95, extra: '#f2679f' },
  grandma: { shirt: '#d9779b', pants: '#6b5b95', skin: '#f3d2b3', hair: '#dcdcdc', scale: 0.95 },
  brother: { shirt: '#f68b2a', pants: '#3a6ea5', skin: '#ffdbac', hair: '#e6be5a', scale: 0.8, extra: '#d63c3c' },
};

const viewOf = (facing: number): { view: View; flip: boolean } => {
  const a = Math.atan2(Math.sin(facing), Math.cos(facing));
  if (a > Math.PI / 4 && a < (3 * Math.PI) / 4) return { view: 'front', flip: false };
  if (a < -Math.PI / 4 && a > (-3 * Math.PI) / 4) return { view: 'back', flip: false };
  return { view: 'side', flip: Math.abs(a) > Math.PI / 2 };
};

export class PersonSprite extends Container {
  private kind: Exclude<FamilyKind, 'dog'>;
  private look: Look;
  private body = new Container();
  private shadow = new Graphics();
  private legL = new Graphics();
  private legR = new Graphics();
  private armL = new Graphics();
  private armR = new Graphics();
  private torso = new Graphics();
  private head = new Graphics();
  private view: View | null = null;
  lunge = 0;

  constructor(kind: Exclude<FamilyKind, 'dog'>) {
    super();
    this.kind = kind;
    this.look = LOOKS[kind];
    this.shadow.ellipse(0, 0, 17, 6).fill({ color: 0x000000, alpha: 0.3 });
    this.addChild(this.shadow, this.body);
    for (const leg of [this.legL, this.legR]) {
      leg.roundRect(-3.5, 0, 7, 15, 3).fill(this.look.pants);
      leg.ellipse(0, 15, 4.5, 3).fill('#2a211c');
    }
    this.legL.position.set(-6, -15);
    this.legR.position.set(6, -15);
    for (const arm of [this.armL, this.armR]) {
      arm.roundRect(-3.5, 0, 7, 20, 3.5).fill(this.look.shirt);
      arm.circle(0, 20, 4).fill(this.look.skin);
    }
    this.armL.position.set(-15, -40);
    this.armR.position.set(15, -40);
    this.body.addChild(this.legL, this.legR, this.armL, this.torso, this.armR, this.head);
    this.body.scale.set(this.look.scale);
    this.setView('front');
  }

  private setView(view: View) {
    if (view === this.view) return;
    this.view = view;
    const L = this.look;
    const t = this.torso;
    t.clear();
    const skirt = this.kind === 'grandma';
    if (skirt) t.poly([-15, -12, 15, -12, 12, -30, -12, -30]).fill(L.pants);
    t.roundRect(-13, -42, 26, 30, 9).fill(L.shirt);
    t.roundRect(-13, -42, 26, 30, 9).stroke({ width: 1.5, color: 0x000000, alpha: 0.18 });
    if (view === 'front') {
      t.poly([-5, -42, 0, -35, 5, -42]).fill({ color: 0xffffff, alpha: 0.85 });
      if (this.kind === 'sister') t.roundRect(-8, -26, 16, 9, 3).fill({ color: 0x000000, alpha: 0.15 }); // hoodie pocket
      if (this.kind === 'dad') t.rect(-13, -17, 26, 3).fill('#2b2b33');
    }
    this.drawHead(view);
    // arm layering for side view
    this.body.setChildIndex(this.armL, view === 'side' ? 0 : 2);
  }

  private drawHead(view: View) {
    const h = this.head;
    const L = this.look;
    h.clear();
    const cy = -55;
    h.circle(0, cy, 15).fill(L.skin);
    h.circle(0, cy, 15).stroke({ width: 1.5, color: 0x000000, alpha: 0.15 });
    // hair
    switch (this.kind) {
      case 'dad':
        if (view === 'back') h.circle(0, cy - 1, 15).fill(L.hair);
        else h.ellipse(view === 'side' ? -3 : 0, cy - 9, 15, 8).fill(L.hair);
        break;
      case 'mom':
        if (view === 'back') { h.circle(0, cy - 1, 15.5).fill(L.hair); h.roundRect(-10, cy + 4, 20, 16, 8).fill(L.hair); }
        else {
          h.ellipse(0, cy - 8, 16, 9).fill(L.hair);
          if (view === 'front') { h.roundRect(-17, cy - 6, 7, 20, 4).fill(L.hair); h.roundRect(10, cy - 6, 7, 20, 4).fill(L.hair); }
          else h.roundRect(-17, cy - 6, 10, 22, 5).fill(L.hair);
        }
        break;
      case 'sister':
        if (view === 'back') h.circle(0, cy - 1, 15.5).fill(L.hair);
        else h.ellipse(0, cy - 8, 15.5, 8).fill(L.hair);
        h.circle(0, cy - 17, 7).fill(L.hair);
        // headphones
        h.arc(0, cy - 2, 17, Math.PI * 1.05, Math.PI * 1.95).stroke({ width: 3, color: L.extra });
        if (view !== 'side') { h.roundRect(-19, cy - 4, 6, 10, 3).fill(L.extra!); h.roundRect(13, cy - 4, 6, 10, 3).fill(L.extra!); }
        else h.roundRect(-4, cy - 4, 7, 11, 3).fill(L.extra!);
        break;
      case 'grandma':
        if (view === 'back') h.circle(0, cy - 1, 15).fill(L.hair);
        else h.ellipse(0, cy - 9, 15.5, 8).fill(L.hair);
        h.circle(view === 'side' ? -9 : 0, cy - 16, 7).fill(L.hair);
        break;
      case 'brother':
        if (view === 'back') h.circle(0, cy - 1, 15).fill(L.hair);
        else h.ellipse(0, cy - 8, 15, 8).fill(L.hair);
        // cap
        h.ellipse(0, cy - 11, 14, 7).fill(L.extra!);
        if (view === 'front') h.ellipse(0, cy - 6, 10, 3.5).fill('#a82a2a');
        else if (view === 'side') h.ellipse(10, cy - 8, 9, 3).fill('#a82a2a');
        break;
    }
    // face
    if (view === 'front') {
      for (const s of [-1, 1]) {
        h.ellipse(s * 5.5, cy + 1, 2.2, 3).fill('#2a1a12');
        h.circle(s * 5.5 - 0.7, cy - 0.2, 0.8).fill('#ffffff');
        h.ellipse(s * 9, cy + 6, 3, 1.8).fill({ color: 0xff7a7a, alpha: 0.35 });
      }
      h.arc(0, cy + 6, 4, 0.2 * Math.PI, 0.8 * Math.PI).stroke({ width: 1.6, color: '#6b2a1a' });
      if (this.kind === 'dad' || this.kind === 'grandma') {
        h.circle(-5.5, cy + 1, 4.5).stroke({ width: 1.3, color: '#333' });
        h.circle(5.5, cy + 1, 4.5).stroke({ width: 1.3, color: '#333' });
        h.moveTo(-1, cy + 1).lineTo(1, cy + 1).stroke({ width: 1.3, color: '#333' });
      }
    } else if (view === 'side') {
      h.ellipse(8, cy + 1, 2, 3).fill('#2a1a12');
      h.circle(14.5, cy + 4, 2.5).fill(L.skin);
      h.ellipse(6, cy + 6, 2.6, 1.6).fill({ color: 0xff7a7a, alpha: 0.35 });
      if (this.kind === 'dad' || this.kind === 'grandma') h.circle(8, cy + 1, 4.5).stroke({ width: 1.3, color: '#333' });
    }
  }

  animate(facing: number, moving: boolean, phase: number, dt: number) {
    const { view, flip } = viewOf(facing);
    this.setView(view);
    this.body.scale.x = (flip ? -1 : 1) * this.look.scale;
    const swing = moving ? Math.sin(phase) : 0;
    if (view === 'side') {
      this.legL.position.set(-3 + swing * 5, -15);
      this.legR.position.set(3 - swing * 5, -15);
      this.legL.y = this.legR.y = -15;
    } else {
      this.legL.position.set(-6, -15 - Math.max(0, swing) * 3);
      this.legR.position.set(6, -15 - Math.max(0, -swing) * 3);
    }
    const lunge = this.lunge;
    this.armL.rotation = swing * 0.6 + (view === 'side' ? 0 : 0.1) - lunge * 2.2;
    this.armR.rotation = -swing * 0.6 - (view === 'side' ? 0 : 0.1) + lunge * 2.2 * (view === 'side' ? -1 : 1);
    this.body.y = moving ? -Math.abs(Math.sin(phase)) * 2.5 : Math.sin(performance.now() / 600) * 0.6;
    this.lunge = Math.max(0, this.lunge - dt * 2);
  }
}

export class DogSprite extends Container {
  private body = new Container();
  private tail = new Graphics();
  private legs: Graphics[] = [];
  private wag = 0;

  constructor() {
    super();
    const shadow = new Graphics().ellipse(0, 2, 20, 10).fill({ color: 0x000000, alpha: 0.28 });
    this.addChild(shadow, this.body);
    const fur = '#d9a35b', dark = '#a86f2c';
    for (const [x, y] of [[9, -9], [9, 9], [-9, -9], [-9, 9]]) {
      const leg = new Graphics().ellipse(0, 0, 4.5, 3.5).fill(dark);
      leg.position.set(x, y);
      this.legs.push(leg);
      this.body.addChild(leg);
    }
    this.tail.roundRect(-14, -2.5, 14, 5, 2.5).fill(fur);
    this.tail.position.set(-14, 0);
    this.body.addChild(this.tail);
    const torso = new Graphics()
      .ellipse(0, 0, 17, 11).fill(fur)
      .ellipse(-2, 0, 10, 6).fill({ color: 0xffffff, alpha: 0.12 })
      .roundRect(8, -10, 4, 20, 2).fill('#e8424a'); // collar
    const head = new Graphics()
      .circle(18, 0, 9.5).fill(fur)
      .ellipse(26, 0, 6, 5).fill('#f0d0a0')
      .circle(31, 0, 2.6).fill('#2a1a12')
      .ellipse(15, -9, 6, 3.5).fill(dark)
      .ellipse(15, 9, 6, 3.5).fill(dark)
      .circle(21, -4, 1.7).fill('#1a1a1a')
      .circle(21, 4, 1.7).fill('#1a1a1a');
    const tag = new Graphics().circle(12, 0, 2.5).fill('#f5c518');
    this.body.addChild(torso, head, tag);
    this.body.scale.set(0.9);
  }

  animate(facing: number, moving: boolean, phase: number, dt: number) {
    this.body.rotation = facing;
    this.wag += dt * (moving ? 18 : 8);
    this.tail.rotation = Math.sin(this.wag) * 0.5;
    this.legs.forEach((l, i) => {
      const s = moving ? Math.sin(phase + (i % 2 ? Math.PI : 0)) * 3 : 0;
      l.x = (i < 2 ? 9 : -9) + s;
    });
    this.body.y = -4;
  }
}

let nuggetTex: Texture | null = null;
export function nuggetTexture() {
  if (!nuggetTex) {
    const { c, ctx } = makeCanvas(40, 40, 3);
    ctx.translate(20, 20);
    drawNuggetBody(ctx, 15);
    nuggetTex = Texture.from(c);
  }
  return nuggetTex;
}

export class NuggetSprite extends Container {
  readonly inner = new Container();
  private shadow = new Graphics();
  private legs = new Graphics();
  private arms = new Graphics();
  private body: Sprite;
  private face = new Graphics();
  mood: 'happy' | 'scared' = 'happy';
  private blinkT = 2;

  constructor() {
    super();
    this.shadow.ellipse(0, 0, 13, 5).fill({ color: 0x000000, alpha: 0.32 });
    this.body = new Sprite(nuggetTexture());
    this.body.anchor.set(0.5);
    this.body.scale.set(1 / 3);
    this.inner.addChild(this.legs, this.arms, this.body, this.face);
    this.addChild(this.shadow, this.inner);
  }

  animate(facing: number, moving: boolean, phase: number, dt: number, dashing: boolean) {
    const bob = moving ? Math.abs(Math.sin(phase)) : 0;
    this.inner.y = -14 - bob * 4;
    const squash = moving ? 1 + Math.sin(phase * 2) * 0.05 : 1 + Math.sin(performance.now() / 400) * 0.02;
    this.body.scale.set((1 / 3) * (2 - squash) * (dashing ? 1.12 : 1), (1 / 3) * squash * (dashing ? 0.9 : 1));
    const lx = Math.cos(facing), ly = Math.sin(facing);
    // legs
    const g = this.legs;
    g.clear();
    const s = moving ? Math.sin(phase) * 4 : 0;
    g.moveTo(-5, 8).lineTo(-6 + s, 16 + bob * 2).stroke({ width: 3, color: '#7a3f0c', cap: 'round' });
    g.moveTo(5, 8).lineTo(6 - s, 16 + bob * 2).stroke({ width: 3, color: '#7a3f0c', cap: 'round' });
    g.ellipse(-6 + s, 16.5 + bob * 2, 3, 1.8).fill('#5a2c06');
    g.ellipse(6 - s, 16.5 + bob * 2, 3, 1.8).fill('#5a2c06');
    // arms (wave when scared)
    const a = this.arms;
    a.clear();
    const wave = this.mood === 'scared' ? Math.sin(performance.now() / 60) * 5 : moving ? Math.sin(phase) * 3 : 0;
    a.moveTo(-14, 0).lineTo(-20, -4 - wave).stroke({ width: 3, color: '#7a3f0c', cap: 'round' });
    a.moveTo(14, 0).lineTo(20, -4 + wave).stroke({ width: 3, color: '#7a3f0c', cap: 'round' });
    // face
    this.blinkT -= dt;
    const blinking = this.blinkT < 0.12;
    if (this.blinkT < 0) this.blinkT = 2 + Math.random() * 3;
    const f = this.face;
    f.clear();
    const r = 15;
    const ex = lx * 2.2, ey = ly * 1.6;
    for (const sx of [-1, 1]) {
      if (blinking) {
        f.moveTo(sx * r * 0.34 - 3.5 + ex, -r * 0.16 + ey).lineTo(sx * r * 0.34 + 3.5 + ex, -r * 0.16 + ey).stroke({ width: 1.6, color: '#2a1606' });
        continue;
      }
      const big = this.mood === 'scared' ? 1.18 : 1;
      f.ellipse(sx * r * 0.34 + ex * 0.5, -r * 0.18 + ey * 0.5, r * 0.24 * big, r * 0.28 * big).fill('#ffffff');
      f.ellipse(sx * r * 0.34 + ex * 0.5, -r * 0.18 + ey * 0.5, r * 0.24 * big, r * 0.28 * big).stroke({ width: 1, color: '#5a2c06' });
      f.circle(sx * r * 0.34 + ex, -r * 0.14 + ey, r * (this.mood === 'scared' ? 0.09 : 0.12)).fill('#2a1606');
      f.circle(sx * r * 0.34 + ex - 0.8, -r * 0.19 + ey, r * 0.04).fill('#ffffff');
    }
    f.ellipse(-r * 0.6 + ex * 0.4, r * 0.18, r * 0.12, r * 0.07).fill({ color: 0xf06e50, alpha: 0.45 });
    f.ellipse(r * 0.6 + ex * 0.4, r * 0.18, r * 0.12, r * 0.07).fill({ color: 0xf06e50, alpha: 0.45 });
    if (this.mood === 'happy') f.arc(ex * 0.6, r * 0.1 + ey * 0.4, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI).stroke({ width: 1.8, color: '#5a2c06', cap: 'round' });
    else f.ellipse(ex * 0.6, r * 0.3 + ey * 0.4, r * 0.11, r * 0.15).fill('#7a2a10');
  }
}
