/**
 * 2D procedural art (Canvas 2D): key icons, the nugget portrait, speech bubbles and glow
 * textures. Used by the HUD, the title screen and as textures in the 3D scene.
 */
import { KEY_INFO, type KeyColor } from '../game/types';

export type Ctx = CanvasRenderingContext2D;

export function makeCanvas(w: number, h: number, scale = 2) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(w * scale));
  c.height = Math.max(1, Math.ceil(h * scale));
  const ctx = c.getContext('2d')!;
  ctx.scale(scale, scale);
  return { c, ctx };
}

export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(amt >= 0 ? v + (255 - v) * amt : v * (1 + amt))));
  r = f(r); g = f(g); b = f(b);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function withShadow(ctx: Ctx, blur: number, oy: number, alpha: number, fn: () => void) {
  ctx.save();
  ctx.shadowColor = `rgba(20,10,5,${alpha})`;
  ctx.shadowBlur = blur;
  ctx.shadowOffsetY = oy;
  fn();
  ctx.restore();
}

// ------------------------------------------------------------------ symbols

export function drawSymbol(ctx: Ctx, symbol: string, cx: number, cy: number, s: number, fill: string) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = fill;
  ctx.beginPath();
  switch (symbol) {
    case 'heart':
      ctx.moveTo(0, s * 0.35);
      ctx.bezierCurveTo(-s * 0.9, -s * 0.25, -s * 0.45, -s * 0.85, 0, -s * 0.38);
      ctx.bezierCurveTo(s * 0.45, -s * 0.85, s * 0.9, -s * 0.25, 0, s * 0.35);
      break;
    case 'drop':
      ctx.moveTo(0, -s * 0.6);
      ctx.bezierCurveTo(s * 0.5, -s * 0.05, s * 0.45, s * 0.45, 0, s * 0.45);
      ctx.bezierCurveTo(-s * 0.45, s * 0.45, -s * 0.5, -s * 0.05, 0, -s * 0.6);
      break;
    case 'sun':
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        ctx.moveTo(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3);
        ctx.lineTo(Math.cos(a + 0.2) * s * 0.55, Math.sin(a + 0.2) * s * 0.55);
        ctx.lineTo(Math.cos(a - 0.2) * s * 0.55, Math.sin(a - 0.2) * s * 0.55);
      }
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.3, 0, Math.PI * 2);
      break;
    case 'leaf':
      ctx.moveTo(-s * 0.5, s * 0.4);
      ctx.quadraticCurveTo(-s * 0.5, -s * 0.5, s * 0.5, -s * 0.5);
      ctx.quadraticCurveTo(s * 0.5, s * 0.4, -s * 0.5, s * 0.4);
      break;
    case 'moon':
      ctx.arc(0, 0, s * 0.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(s * 0.25, -s * 0.15, s * 0.42, 0, Math.PI * 2);
      break;
    case 'diamond':
      ctx.moveTo(0, -s * 0.55);
      ctx.lineTo(s * 0.45, 0);
      ctx.lineTo(0, s * 0.55);
      ctx.lineTo(-s * 0.45, 0);
      ctx.closePath();
      break;
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        ctx.moveTo(Math.cos(a) * s * 0.3 + s * 0.2, Math.sin(a) * s * 0.3);
        ctx.arc(Math.cos(a) * s * 0.3, Math.sin(a) * s * 0.3, s * 0.2, 0, Math.PI * 2);
      }
      break;
    case 'star':
    default:
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const r = i % 2 ? s * 0.25 : s * 0.58;
        if (i) ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath();
  }
  ctx.fill();
  ctx.restore();
}

// ------------------------------------------------------------------ keys

/** A shiny key, about 44x22 units, centered. */
export function drawKey(ctx: Ctx, color: KeyColor, cx: number, cy: number, scale = 1) {
  const info = KEY_INFO[color];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(scale, scale);
  ctx.rotate(-0.35);
  const g = ctx.createLinearGradient(-20, -10, 20, 10);
  g.addColorStop(0, shade(info.hex, 0.45));
  g.addColorStop(0.5, info.hex);
  g.addColorStop(1, info.dark);
  ctx.lineJoin = 'round';
  // shaft + teeth
  ctx.beginPath();
  ctx.moveTo(-4, -3.5);
  ctx.lineTo(19, -3.5);
  ctx.lineTo(19, 8);
  ctx.lineTo(14, 8);
  ctx.lineTo(14, 3.5);
  ctx.lineTo(10.5, 3.5);
  ctx.lineTo(10.5, 7);
  ctx.lineTo(6, 7);
  ctx.lineTo(6, 3.5);
  ctx.lineTo(-4, 3.5);
  ctx.closePath();
  ctx.fillStyle = g;
  ctx.strokeStyle = shade(info.dark, -0.35);
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  // bow
  ctx.beginPath();
  ctx.arc(-11, 0, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(-11, 0, 6.2, 0, Math.PI * 2);
  ctx.fillStyle = '#fffaf0';
  ctx.fill();
  drawSymbol(ctx, info.symbol, -11, 0.3, 10, info.dark);
  // shine
  ctx.globalAlpha = 0.6;
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(-11, 0, 8, Math.PI * 1.1, Math.PI * 1.55);
  ctx.moveTo(0, -1.8);
  ctx.lineTo(16, -1.8);
  ctx.stroke();
  ctx.restore();
}

// ------------------------------------------------------------------ nugget

export function nuggetOutline(ctx: Ctx, r: number, wobble = 0) {
  ctx.beginPath();
  const n = 26;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2;
    const bump = Math.sin(a * 5 + 1.3) * 0.06 + Math.sin(a * 9 + wobble) * 0.035 + Math.cos(a * 3) * 0.04;
    const rx = r * 1.08 * (1 + bump), ry = r * 0.92 * (1 + bump);
    const x = Math.cos(a) * rx, y = Math.sin(a) * ry;
    if (i) ctx.lineTo(x, y);
    else ctx.moveTo(x, y);
  }
  ctx.closePath();
}

/** Golden, crumbly nugget body (no face), centered at 0,0 with radius r. */
export function drawNuggetBody(ctx: Ctx, r: number) {
  const R = rng(7);
  nuggetOutline(ctx, r);
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.45, r * 0.1, 0, 0, r * 1.25);
  g.addColorStop(0, '#ffe08a');
  g.addColorStop(0.45, '#f2b544');
  g.addColorStop(0.85, '#c97a1e');
  g.addColorStop(1, '#9a5512');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.lineWidth = r * 0.08;
  ctx.strokeStyle = '#7a3f0c';
  ctx.stroke();
  ctx.save();
  nuggetOutline(ctx, r);
  ctx.clip();
  // crumbs
  for (let i = 0; i < 70; i++) {
    const a = R() * Math.PI * 2, d = Math.sqrt(R()) * r * 1.05;
    const x = Math.cos(a) * d, y = Math.sin(a) * d * 0.9;
    const s = r * (0.04 + R() * 0.07);
    ctx.fillStyle = R() < 0.5 ? 'rgba(150,80,15,0.55)' : 'rgba(255,236,170,0.55)';
    ctx.beginPath();
    ctx.ellipse(x, y, s, s * 0.7, R() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // soft highlight
  const hl = ctx.createRadialGradient(-r * 0.4, -r * 0.5, 0, -r * 0.4, -r * 0.5, r * 0.7);
  hl.addColorStop(0, 'rgba(255,255,230,0.55)');
  hl.addColorStop(1, 'rgba(255,255,230,0)');
  ctx.fillStyle = hl;
  ctx.fillRect(-r * 1.2, -r * 1.2, r * 2.4, r * 2.4);
  ctx.restore();
}

/** Full nugget with a face, for menus and the HUD. */
export function drawNuggetPortrait(ctx: Ctx, r: number, mood: 'happy' | 'scared' = 'happy') {
  // legs
  ctx.strokeStyle = '#7a3f0c';
  ctx.lineWidth = r * 0.14;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.35, r * 0.7); ctx.lineTo(-r * 0.45, r * 1.15);
  ctx.moveTo(r * 0.35, r * 0.7); ctx.lineTo(r * 0.45, r * 1.15);
  ctx.stroke();
  drawNuggetBody(ctx, r);
  drawNuggetFace(ctx, r, 0, 0.15, mood);
}

export function drawNuggetFace(ctx: Ctx, r: number, lookX: number, lookY: number, mood: 'happy' | 'scared') {
  for (const s of [-1, 1]) {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.ellipse(s * r * 0.34, -r * 0.18, r * 0.24, r * 0.28, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#5a2c06';
    ctx.lineWidth = r * 0.05;
    ctx.stroke();
    ctx.fillStyle = '#2a1606';
    ctx.beginPath();
    ctx.arc(s * r * 0.34 + lookX * r * 0.09, -r * 0.14 + lookY * r * 0.09, r * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(s * r * 0.34 + lookX * r * 0.09 - r * 0.04, -r * 0.19 + lookY * r * 0.09, r * 0.04, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(240,110,80,0.45)';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(s * r * 0.62, r * 0.18, r * 0.13, r * 0.08, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = '#5a2c06';
  ctx.fillStyle = '#7a2a10';
  ctx.lineWidth = r * 0.07;
  ctx.lineCap = 'round';
  ctx.beginPath();
  if (mood === 'happy') {
    ctx.arc(0, r * 0.12, r * 0.22, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
  } else {
    ctx.ellipse(0, r * 0.3, r * 0.12, r * 0.15, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ------------------------------------------------------------------ glow & misc textures

export function bakeRadial(size: number, inner: string, outer: string, scale = 1, innerStop = 0) {
  const { c, ctx } = makeCanvas(size, size, scale);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, inner);
  if (innerStop) g.addColorStop(innerStop, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return c;
}

export function bakeBubble(kind: '!' | '?' | 'zzz' | 'yum', scale = 3) {
  const { c, ctx } = makeCanvas(34, 38, scale);
  const col = kind === '!' ? '#e8424a' : kind === '?' ? '#3d7df0' : kind === 'yum' ? '#f68b2a' : '#7a7a9a';
  withShadow(ctx, 4, 2, 0.35, () => {
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(17, 16, 14, 0, Math.PI * 2);
    ctx.moveTo(12, 27); ctx.lineTo(17, 36); ctx.lineTo(21, 27);
    ctx.fill();
  });
  ctx.strokeStyle = col;
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(17, 16, 14, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = col;
  ctx.font = `900 ${kind === 'yum' ? 10 : 20}px "Lilita One", "Arial Rounded MT Bold", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(kind === 'yum' ? 'YUM!' : kind === 'zzz' ? 'z' : kind, 17, 17);
  return c;
}

export function bakeSparkle(scale = 2) {
  const { c, ctx } = makeCanvas(16, 16, scale);
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 16, 16);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(8, 0); ctx.lineTo(9, 7); ctx.lineTo(16, 8); ctx.lineTo(9, 9); ctx.lineTo(8, 16); ctx.lineTo(7, 9); ctx.lineTo(0, 8); ctx.lineTo(7, 7);
  ctx.closePath(); ctx.fill();
  return c;
}

export function bakeDot(scale = 2) {
  const { c, ctx } = makeCanvas(8, 8, scale);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(4, 4, 4, 0, Math.PI * 2); ctx.fill();
  return c;
}
