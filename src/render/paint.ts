/**
 * Procedural art. Everything is painted with Canvas 2D at high resolution and then
 * handed to PixiJS as GPU textures, so the game ships with zero image files.
 */
import type { FloorMap } from '../game/map';
import { KEY_INFO, type FloorStyle, type Furniture, type KeyColor } from '../game/types';

export const T = 48; // world pixels per tile
export const MARGIN = 3; // tiles of outside scenery around each floor

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

function fillRR(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | CanvasGradient, stroke?: string, lw = 1.5) {
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lw;
    ctx.stroke();
  }
}

function vgrad(ctx: Ctx, y0: number, y1: number, a: string, b: string) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, a);
  g.addColorStop(1, b);
  return g;
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

// ------------------------------------------------------------------ floors

const FLOOR_BASE: Record<FloorStyle, string> = {
  wood: '#b98252',
  living: '#93603d',
  parquet: '#c49261',
  checker: '#efe4cf',
  bathTile: '#d9f0ee',
  carpetBlue: '#7d9ad6',
  carpetRose: '#cf9aae',
  attic: '#8f6c4b',
};

function paintPattern(ctx: Ctx, style: FloorStyle, x0: number, y0: number, w: number, h: number, seed: number) {
  const R = rng(seed);
  const base = FLOOR_BASE[style];
  ctx.fillStyle = base;
  ctx.fillRect(x0, y0, w, h);
  if (style === 'wood' || style === 'living' || style === 'attic') {
    const ph = style === 'attic' ? 16 : style === 'living' ? 14 : 12;
    for (let y = y0; y < y0 + h; y += ph) {
      let x = x0 - R() * T * 2;
      while (x < x0 + w) {
        const len = T * (1.5 + R() * 2.5);
        ctx.fillStyle = shade(base, (R() - 0.5) * 0.22);
        ctx.fillRect(x, y, len, ph);
        // grain
        ctx.strokeStyle = 'rgba(70,35,10,0.10)';
        ctx.lineWidth = 0.8;
        for (let g = 0; g < 2; g++) {
          const gy = y + 3 + R() * (ph - 6);
          ctx.beginPath();
          ctx.moveTo(x + 4, gy);
          ctx.bezierCurveTo(x + len * 0.3, gy + (R() - 0.5) * 3, x + len * 0.7, gy + (R() - 0.5) * 3, x + len - 4, gy);
          ctx.stroke();
        }
        ctx.fillStyle = 'rgba(60,30,10,0.35)';
        ctx.fillRect(x + len - 1, y, 1.2, ph);
        if (style === 'attic') {
          ctx.fillStyle = 'rgba(40,25,15,0.6)';
          ctx.beginPath();
          ctx.arc(x + 5, y + ph / 2, 1.1, 0, Math.PI * 2);
          ctx.arc(x + len - 6, y + ph / 2, 1.1, 0, Math.PI * 2);
          ctx.fill();
        }
        x += len;
      }
      ctx.fillStyle = 'rgba(60,30,10,0.28)';
      ctx.fillRect(x0, y + ph - 1, w, 1);
    }
  } else if (style === 'parquet') {
    const s = T / 2;
    for (let y = y0; y < y0 + h; y += s)
      for (let x = x0; x < x0 + w; x += s) {
        const horiz = (Math.round((x - x0) / s) + Math.round((y - y0) / s)) % 2 === 0;
        for (let i = 0; i < 3; i++) {
          ctx.fillStyle = shade(base, (R() - 0.5) * 0.2);
          if (horiz) ctx.fillRect(x, y + (i * s) / 3, s, s / 3);
          else ctx.fillRect(x + (i * s) / 3, y, s / 3, s);
          ctx.strokeStyle = 'rgba(70,40,15,0.3)';
          ctx.lineWidth = 0.7;
          if (horiz) ctx.strokeRect(x, y + (i * s) / 3, s, s / 3);
          else ctx.strokeRect(x + (i * s) / 3, y, s / 3, s);
        }
      }
  } else if (style === 'checker') {
    const s = T / 2;
    for (let y = y0; y < y0 + h; y += s)
      for (let x = x0; x < x0 + w; x += s) {
        const dark = (Math.round((x - x0) / s) + Math.round((y - y0) / s)) % 2 === 0;
        ctx.fillStyle = dark ? shade('#5f9e96', (R() - 0.5) * 0.06) : shade(base, (R() - 0.5) * 0.04);
        ctx.fillRect(x, y, s, s);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x + 2, y + 2, s - 4, 2);
      }
  } else if (style === 'bathTile') {
    const s = T / 3;
    for (let y = y0; y < y0 + h; y += s)
      for (let x = x0; x < x0 + w; x += s) {
        ctx.fillStyle = shade(base, (R() - 0.5) * 0.08);
        ctx.fillRect(x + 1, y + 1, s - 2, s - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(x + 2, y + 2, s - 6, 1.5);
      }
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#a9c9c6';
    ctx.fillRect(x0, y0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  } else {
    // carpet: soft speckle + subtle diamond weave
    for (let i = 0; i < (w * h) / 18; i++) {
      ctx.fillStyle = R() < 0.5 ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(x0 + R() * w, y0 + R() * h, 1.6, 1.6);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 1;
    for (let d = -h; d < w; d += 16) {
      ctx.beginPath();
      ctx.moveTo(x0 + d, y0); ctx.lineTo(x0 + d + h, y0 + h);
      ctx.moveTo(x0 + d + h, y0); ctx.lineTo(x0 + d, y0 + h);
      ctx.stroke();
    }
  }
}

function paintOutside(ctx: Ctx, map: FloorMap, W: number, H: number) {
  const R = rng(99 + map.def.id);
  if (map.def.id === 0) {
    ctx.fillStyle = '#24432f';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < (W * H) / 60; i++) {
      ctx.strokeStyle = R() < 0.5 ? 'rgba(90,150,90,0.35)' : 'rgba(10,30,15,0.35)';
      ctx.lineWidth = 1;
      const x = R() * W, y = R() * H;
      ctx.beginPath();
      ctx.moveTo(x, y); ctx.lineTo(x + (R() - 0.5) * 3, y - 3 - R() * 3);
      ctx.stroke();
    }
    // stone path from the front door
    const door = map.doors.find((d) => d.color === 'gold');
    if (door) {
      const cx = (door.x + MARGIN + 1) * T;
      for (let y = (map.h + MARGIN) * T + 6; y < H; y += 22) {
        for (const off of [-24, 6]) {
          ctx.fillStyle = shade('#9a958a', (R() - 0.5) * 0.2);
          rr(ctx, cx + off + (R() - 0.5) * 6, y, 22, 16, 6);
          ctx.fill();
        }
      }
      // porch light glow baked onto the ground
      const g = ctx.createRadialGradient(cx, (map.h + MARGIN) * T, 0, cx, (map.h + MARGIN) * T, T * 3);
      g.addColorStop(0, 'rgba(255,214,140,0.35)');
      g.addColorStop(1, 'rgba(255,214,140,0)');
      ctx.fillStyle = g;
      ctx.fillRect(cx - T * 3, (map.h + MARGIN) * T - T * 3, T * 6, T * 6);
    }
    // bushes and flowers
    for (let i = 0; i < 40; i++) {
      const side = R();
      let x: number, y: number;
      if (side < 0.25) { x = R() * W; y = R() * MARGIN * T * 0.8; }
      else if (side < 0.5) { x = R() * W; y = H - R() * MARGIN * T * 0.8; }
      else if (side < 0.75) { x = R() * MARGIN * T * 0.8; y = R() * H; }
      else { x = W - R() * MARGIN * T * 0.8; y = R() * H; }
      const r = 10 + R() * 14;
      withShadow(ctx, 8, 4, 0.4, () => {
        ctx.fillStyle = shade('#2f6b3a', (R() - 0.5) * 0.3);
        ctx.beginPath();
        for (let k = 0; k < 6; k++) ctx.arc(x + Math.cos(k) * r * 0.5, y + Math.sin(k) * r * 0.5, r * 0.6, 0, Math.PI * 2);
        ctx.fill();
      });
      if (R() < 0.5) {
        ctx.fillStyle = ['#f7a8c4', '#ffe28a', '#ffffff', '#c3a6ff'][Math.floor(R() * 4)];
        for (let k = 0; k < 5; k++) {
          ctx.beginPath();
          ctx.arc(x + (R() - 0.5) * r, y + (R() - 0.5) * r, 2, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  } else {
    // Roof shingles seen from above
    ctx.fillStyle = '#343a52';
    ctx.fillRect(0, 0, W, H);
    for (let y = 0; y < H; y += 14) {
      const off = (y / 14) % 2 ? 12 : 0;
      for (let x = -off; x < W; x += 24) {
        ctx.fillStyle = shade('#3e4561', (R() - 0.5) * 0.18);
        rr(ctx, x + 1, y + 1, 22, 13, 3);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 1, y + 12, 22, 2);
      }
    }
  }
}

function paintWindow(ctx: Ctx, x: number, y: number, w: number, h: number) {
  fillRR(ctx, x - 2, y - 2, w + 4, h + 4, 3, '#f4ead8');
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, '#1d2b52');
  g.addColorStop(1, '#3c5a8e');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.beginPath();
  ctx.arc(x + w * 0.72, y + h * 0.35, Math.min(w, h) * 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (let i = 0; i < 4; i++) ctx.fillRect(x + ((i * 37) % w), y + ((i * 13) % h), 1.2, 1.2);
  ctx.strokeStyle = '#f4ead8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + w / 2, y); ctx.lineTo(x + w / 2, y + h);
  ctx.moveTo(x, y + h / 2); ctx.lineTo(x + w, y + h / 2);
  ctx.stroke();
}

export const WALL_FACE = 20; // height of the visible wall face below a wall

/** Bakes everything static on a floor: outside, floors, walls, stairs and solid furniture. */
export function bakeFloor(map: FloorMap, scale = 2) {
  const W = (map.w + MARGIN * 2) * T;
  const H = (map.h + MARGIN * 2) * T;
  const { c, ctx } = makeCanvas(W, H, scale);
  paintOutside(ctx, map, W, H);
  ctx.save();
  ctx.translate(MARGIN * T, MARGIN * T);

  // Floors per room (doors use the floor of the hallway next to them)
  map.def.rooms.forEach((room, idx) => {
    ctx.save();
    ctx.beginPath();
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        let inRoom = map.room[y * map.w + x] === idx;
        const d = map.door(x, y);
        if (d && !room.door) {
          const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => map.inBounds(x + dx, y + dy) && map.room[(y + dy) * map.w + x + dx] === idx);
          if (n) inRoom = true;
        }
        if (!inRoom) continue;
        ctx.rect(x * T, y * T, T, T);
        minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
      }
    ctx.clip();
    paintPattern(ctx, room.style, minX * T, minY * T, (maxX - minX + 1) * T, (maxY - minY + 1) * T, idx * 31 + map.def.id * 7 + 1);
    ctx.restore();
  });

  // Front door threshold step
  for (const d of map.doors.filter((d) => d.color === 'gold')) {
    ctx.fillStyle = '#8a8378';
    ctx.fillRect(d.x * T - 4, (d.y + 1) * T - 2, T + 8, 14);
  }

  // Rugs & runners (decoration, under everything else)
  for (const it of map.def.furniture) if (it.block === 'none') drawFurniture(ctx, it);

  // Ambient occlusion along walls
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (map.isWall(x, y)) continue;
      const px = x * T, py = y * T;
      const ao = (x0: number, y0: number, x1: number, y1: number, rx: number, ry: number, rw: number, rh: number) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, 'rgba(30,15,5,0.32)');
        g.addColorStop(1, 'rgba(30,15,5,0)');
        ctx.fillStyle = g;
        ctx.fillRect(rx, ry, rw, rh);
      };
      if (map.isWall(x - 1, y)) ao(px, 0, px + 12, 0, px, py, 12, T);
      if (map.isWall(x + 1, y)) ao(px + T, 0, px + T - 12, 0, px + T - 12, py, 12, T);
      if (map.isWall(x, y + 1)) ao(0, py + T, 0, py + T - 10, px, py + T - 10, T, 10);
      if (map.isWall(x, y - 1)) ao(0, py + WALL_FACE, 0, py + WALL_FACE + 16, px, py + WALL_FACE, T, 16);
    }

  // Hide-furniture footprints: dark "underneath" so the nugget reads as hidden
  for (const it of map.def.furniture) {
    if (it.block !== 'hide') continue;
    ctx.fillStyle = 'rgba(25,12,5,0.35)';
    rr(ctx, it.x * T + 3, it.y * T + 5, it.w * T - 6, it.h * T - 4, 10);
    ctx.fill();
  }

  // Stairs
  paintStairs(ctx, map);

  // Wall faces (the 3/4 view depth), including window glass on outside walls
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (!map.isWall(x, y) || y + 1 >= map.h || map.isWall(x, y + 1)) continue;
      const below = map.roomAt(x + 0.5, y + 1.5);
      const wallColor = below?.wall ?? '#d8c8a8';
      const px = x * T, py = (y + 1) * T;
      ctx.fillStyle = vgrad(ctx, py, py + WALL_FACE, shade(wallColor, -0.12), wallColor);
      ctx.fillRect(px, py, T, WALL_FACE);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      for (let sx = 4; sx < T; sx += 12) ctx.fillRect(px + sx, py, 4, WALL_FACE - 4);
      ctx.fillStyle = '#f6efe3';
      ctx.fillRect(px, py + WALL_FACE - 4, T, 4);
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(px, py + WALL_FACE, T, 2);
      if (y === 0 && x % 4 === 2 && !map.isWall(x + 1, y + 1)) paintWindow(ctx, px + 10, py + 2, T * 2 - 20, WALL_FACE - 7);
    }
  // Wall tops
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      if (!map.isWall(x, y)) continue;
      const px = x * T, py = y * T;
      ctx.fillStyle = '#4b3a33';
      ctx.fillRect(px, py, T, T);
      ctx.fillStyle = '#5c4940';
      ctx.fillRect(px + 2, py + 2, T - 4, T - 4);
      ctx.fillStyle = 'rgba(255,240,220,0.05)';
      ctx.fillRect(px + 2, py + 2, T - 4, (T - 4) / 2);
      const edge = (cond: boolean, rx: number, ry: number, rw: number, rh: number) => {
        if (!cond) return;
        ctx.fillStyle = '#2c201c';
        ctx.fillRect(rx, ry, rw, rh);
      };
      edge(!map.isWall(x - 1, y), px, py, 3, T);
      edge(!map.isWall(x + 1, y), px + T - 3, py, 3, T);
      edge(!map.isWall(x, y - 1) && y > 0, px, py, T, 3);
      edge(!map.isWall(x, y + 1), px, py + T - 3, T, 3);
      // side windows on the outside walls
      if ((x === 0 || x === map.w - 1) && y % 5 === 3 && !map.isWall(x === 0 ? 1 : x - 1, y)) {
        const g = ctx.createLinearGradient(px, py, px + T, py);
        g.addColorStop(0, '#2a3c6a');
        g.addColorStop(1, '#4c6aa2');
        ctx.fillStyle = '#f4ead8';
        ctx.fillRect(px + T / 2 - 6, py + 4, 12, T * 1.6);
        ctx.fillStyle = g;
        ctx.fillRect(px + T / 2 - 4, py + 6, 8, T * 1.6 - 4);
      }
    }

  // Solid furniture, sorted top to bottom so lower pieces overlap upper ones
  const solids = map.def.furniture.filter((it) => it.block === 'solid').sort((a, b) => a.y + a.h - (b.y + b.h));
  for (const it of solids) drawFurniture(ctx, it);

  ctx.restore();
  return c;
}

function paintStairs(ctx: Ctx, map: FloorMap) {
  const seen = new Set<string>();
  for (let y = 0; y < map.h; y++)
    for (let x = 0; x < map.w; x++) {
      const kind = map.isStairs(x, y);
      if (!kind || seen.has(`${x},${y}`)) continue;
      // Find the full block of stairs
      let w = 0, h = 0;
      while (map.isStairs(x + w, y) === kind) w++;
      while (map.isStairs(x, y + h) === kind) h++;
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) seen.add(`${xx},${yy}`);
      const px = x * T, py = y * T, pw = w * T, ph = h * T;
      withShadow(ctx, 10, 3, 0.4, () => fillRR(ctx, px + 2, py + 2, pw - 4, ph - 4, 6, '#6b4a33'));
      const steps = 6;
      // Steps run horizontally; going up they get lighter, going down darker.
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const sw = pw - 12;
        const sx = px + 6 + (kind === 'down' ? t * 6 : 0) ;
        const sy = py + 6 + (i * (ph - 12)) / steps;
        const col = kind === 'up' ? shade('#c99a6a', 0.25 - t * 0.35) : shade('#a57852', -t * 0.5);
        ctx.fillStyle = col;
        ctx.fillRect(sx, sy, sw - (kind === 'down' ? t * 12 : 0), (ph - 12) / steps - 2);
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        ctx.fillRect(sx, sy, sw - (kind === 'down' ? t * 12 : 0), 2);
      }
      // banisters
      ctx.fillStyle = '#4a2f1f';
      ctx.fillRect(px + 2, py + 2, 4, ph - 4);
      ctx.fillRect(px + pw - 6, py + 2, 4, ph - 4);
      // arrow
      ctx.save();
      ctx.translate(px + pw / 2, py + ph / 2);
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff6e0';
      ctx.strokeStyle = 'rgba(60,30,10,0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      const dir = kind === 'up' ? -1 : 1;
      ctx.moveTo(0, dir * 16);
      ctx.lineTo(12, dir * 2);
      ctx.lineTo(5, dir * 2);
      ctx.lineTo(5, -dir * 14);
      ctx.lineTo(-5, -dir * 14);
      ctx.lineTo(-5, dir * 2);
      ctx.lineTo(-12, dir * 2);
      ctx.closePath();
      ctx.scale(1, 1);
      ctx.stroke();
      ctx.fill();
      ctx.restore();
    }
}

// ------------------------------------------------------------------ furniture

const WOOD = '#8a5a36';
const WOOD_L = '#b07a4c';

function plate(ctx: Ctx, x: number, y: number, r: number) {
  ctx.fillStyle = '#fbfbf6';
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(80,80,100,0.25)'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(x, y, r * 0.65, 0, Math.PI * 2); ctx.stroke();
}

function plantPot(ctx: Ctx, cx: number, cy: number, s: number, seed: number) {
  const R = rng(seed);
  withShadow(ctx, 8, 4, 0.45, () => {
    ctx.fillStyle = '#c4643c';
    ctx.beginPath(); ctx.arc(cx, cy + s * 0.18, s * 0.3, 0, Math.PI * 2); ctx.fill();
  });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + R();
    const d = s * (0.12 + R() * 0.22);
    ctx.fillStyle = shade('#3f8f4a', (R() - 0.4) * 0.4);
    ctx.beginPath();
    ctx.ellipse(cx + Math.cos(a) * d, cy - s * 0.05 + Math.sin(a) * d, s * 0.2, s * 0.11, a, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.arc(cx - s * 0.1, cy - s * 0.15, s * 0.1, 0, Math.PI * 2); ctx.fill();
}

function books(ctx: Ctx, x: number, y: number, w: number, h: number, seed: number) {
  const R = rng(seed);
  let bx = x;
  const cols = ['#c0392b', '#2e86de', '#f6b93b', '#27ae60', '#8e44ad', '#e15f41', '#f8efba', '#3c6382'];
  while (bx < x + w - 3) {
    const bw = 3 + R() * 4;
    ctx.fillStyle = cols[Math.floor(R() * cols.length)];
    const bh = h * (0.7 + R() * 0.3);
    ctx.fillRect(bx, y + h - bh, bw - 0.6, bh);
    bx += bw;
  }
}

function chair(ctx: Ctx, cx: number, cy: number, rot: number) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rot);
  withShadow(ctx, 5, 2, 0.4, () => fillRR(ctx, -11, -10, 22, 20, 5, WOOD_L, '#5a361d'));
  fillRR(ctx, -11, -14, 22, 6, 3, WOOD, '#5a361d');
  fillRR(ctx, -7, -6, 14, 12, 4, '#e3c9a0');
  ctx.restore();
}

function blanket(ctx: Ctx, x: number, y: number, w: number, h: number, color: string) {
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, shade(color, 0.2));
  g.addColorStop(1, shade(color, -0.15));
  fillRR(ctx, x, y, w, h, 8, g, shade(color, -0.35));
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(x + 4, y + (h * i) / 4);
    ctx.lineTo(x + w - 4, y + (h * i) / 4);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillRect(x, y, w, 8);
}

export function drawFurniture(ctx: Ctx, it: Furniture) {
  const x = it.x * T, y = it.y * T, w = it.w * T, h = it.h * T;
  const cx = x + w / 2, cy = y + h / 2;
  const seed = it.x * 13 + it.y * 7;
  switch (it.kind) {
    case 'rug':
    case 'runner': {
      const col = it.color ?? '#8c2f39';
      withShadow(ctx, 3, 1, 0.25, () => fillRR(ctx, x + 4, y + 4, w - 8, h - 8, 6, col));
      ctx.strokeStyle = shade(col, 0.35);
      ctx.lineWidth = 3;
      rr(ctx, x + 10, y + 10, w - 20, h - 20, 4);
      ctx.stroke();
      ctx.strokeStyle = shade(col, -0.3);
      ctx.lineWidth = 1.5;
      rr(ctx, x + 16, y + 16, Math.max(2, w - 32), Math.max(2, h - 32), 3);
      ctx.stroke();
      if (h > T && w > T) {
        ctx.fillStyle = shade(col, 0.25);
        ctx.beginPath();
        ctx.moveTo(cx, cy - h * 0.22); ctx.lineTo(cx + w * 0.18, cy); ctx.lineTo(cx, cy + h * 0.22); ctx.lineTo(cx - w * 0.18, cy);
        ctx.closePath(); ctx.fill();
      }
      // tassels
      ctx.strokeStyle = shade(col, 0.5);
      ctx.lineWidth = 1;
      for (let tx = x + 8; tx < x + w - 6; tx += 5) {
        ctx.beginPath(); ctx.moveTo(tx, y + 4); ctx.lineTo(tx, y); ctx.moveTo(tx, y + h - 4); ctx.lineTo(tx, y + h); ctx.stroke();
      }
      break;
    }
    case 'bathMat':
      fillRR(ctx, x + 6, y + 8, w - 12, h - 16, 10, '#f7b2c4');
      ctx.strokeStyle = '#fff'; ctx.setLineDash([3, 3]); rr(ctx, x + 10, y + 12, w - 20, h - 24, 7); ctx.stroke(); ctx.setLineDash([]);
      break;
    case 'dogBed':
      withShadow(ctx, 6, 3, 0.35, () => {
        ctx.fillStyle = '#7b4f8a';
        ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.45, h * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = '#d9c3e3';
      ctx.beginPath(); ctx.ellipse(cx, cy + 2, w * 0.33, h * 0.27, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0e0c0';
      ctx.beginPath(); ctx.ellipse(cx + 10, cy + 6, 9, 4, 0.4, 0, Math.PI * 2); ctx.fill(); // bone
      break;
    case 'counter': {
      withShadow(ctx, 10, 5, 0.4, () => fillRR(ctx, x, y + 2, w, h - 4, 4, '#f3efe6', '#9b9284'));
      ctx.fillStyle = '#d8d1c3';
      ctx.fillRect(x, y + h - 10, w, 8);
      // sink
      fillRR(ctx, x + T * 3 + 6, y + 8, T * 1.2, h - 22, 6, '#c9d6dd', '#7f8f99');
      ctx.fillStyle = '#9fb0ba'; ctx.beginPath(); ctx.arc(x + T * 3.6 + 6, y + 18, 3, 0, Math.PI * 2); ctx.fill();
      // stove
      fillRR(ctx, x + T * 6, y + 5, T * 1.5, h - 16, 4, '#2d2f36');
      for (const [ox, oy] of [[0.4, 0.33], [1.1, 0.33]]) {
        ctx.strokeStyle = '#e25d3c'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x + T * 6 + ox * T, y + 5 + oy * T, 8, 0, Math.PI * 2); ctx.stroke();
      }
      // fruit bowl + cutting board
      fillRR(ctx, x + 10, y + 10, 30, 22, 4, '#d9a066', '#8a5a36');
      ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(x + T * 8.5, y + 22, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(x + T * 8.5 + 9, y + 20, 5, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'fridge':
      withShadow(ctx, 10, 5, 0.45, () => fillRR(ctx, x + 3, y + 2, w - 6, h - 6, 6, vgrad(ctx, y, y + h, '#f4f7fa', '#c7d0d8'), '#8b97a3'));
      ctx.fillStyle = '#8b97a3';
      ctx.fillRect(x + 6, y + h * 0.36, w - 12, 2);
      ctx.fillRect(x + w - 12, y + 12, 3, 18);
      ctx.fillRect(x + w - 12, y + h * 0.45, 3, 22);
      // magnets & a drawing
      ctx.fillStyle = '#fff'; ctx.fillRect(x + 10, y + h * 0.5, 16, 20);
      ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x + 18, y + h * 0.5 + 9, 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(x + 18, y + h * 0.5, 2.5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'island':
      withShadow(ctx, 12, 6, 0.45, () => fillRR(ctx, x + 4, y + 4, w - 8, h - 8, 8, vgrad(ctx, y, y + h, '#fdfaf3', '#e2dccd'), '#9b9284', 2));
      ctx.fillStyle = '#7fb7ad';
      ctx.fillRect(x + 4, y + h - 16, w - 8, 10);
      fillRR(ctx, x + w * 0.2, y + 14, 34, 24, 4, '#d9a066', '#8a5a36');
      ctx.fillStyle = '#4caf50'; ctx.beginPath(); ctx.arc(x + w * 0.2 + 17, y + 26, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(x + w * 0.65, y + 26, 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f0c27b'; ctx.beginPath(); ctx.arc(x + w * 0.65, y + 26, 6, 0, Math.PI * 2); ctx.fill();
      break;
    case 'kitchenTable':
    case 'roundTable':
    case 'gameTable': {
      const top = it.kind === 'gameTable' ? '#2f7d4f' : it.kind === 'kitchenTable' ? '#e9d8b4' : WOOD_L;
      withShadow(ctx, 12, 8, 0.45, () => {
        ctx.fillStyle = it.kind === 'gameTable' ? '#6b4423' : shade(top, -0.25);
        ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.46, h * 0.44, 0, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = top;
      ctx.beginPath(); ctx.ellipse(cx, cy - 2, w * 0.41, h * 0.39, 0, 0, Math.PI * 2); ctx.fill();
      if (it.kind === 'gameTable') {
        // board game
        fillRR(ctx, cx - 18, cy - 18, 36, 36, 3, '#f5e6c8', '#8a5a36');
        for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if ((i + j) % 2) { ctx.fillStyle = '#c0392b'; ctx.fillRect(cx - 16 + i * 8, cy - 16 + j * 8, 8, 8); }
        ctx.fillStyle = '#fff'; ctx.fillRect(cx + 22, cy + 8, 7, 7);
      } else if (it.kind === 'kitchenTable') {
        plate(ctx, cx - 12, cy - 4, 9);
        ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(cx + 12, cy + 2, 6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#e8f1f8'; ctx.beginPath(); ctx.arc(cx, cy - 2, 9, 0, Math.PI * 2); ctx.fill();
        plantPot(ctx, cx, cy - 4, 22, seed);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.ellipse(cx - w * 0.15, cy - h * 0.2, w * 0.15, h * 0.06, -0.3, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'diningTable': {
      // chairs around
      for (let i = 0; i < it.w - 1; i++) {
        chair(ctx, x + T * (i + 1), y - 6, 0);
        chair(ctx, x + T * (i + 1), y + h + 6, Math.PI);
      }
      chair(ctx, x - 6, cy, -Math.PI / 2);
      chair(ctx, x + w + 6, cy, Math.PI / 2);
      withShadow(ctx, 14, 8, 0.5, () => fillRR(ctx, x + 2, y + 2, w - 4, h - 4, 10, '#7a4a2a'));
      fillRR(ctx, x + 6, y + 4, w - 12, h - 12, 8, vgrad(ctx, y, y + h, '#fffdf7', '#efe6d5'));
      ctx.strokeStyle = '#d65a5a'; ctx.lineWidth = 3;
      rr(ctx, x + 12, y + 10, w - 24, h - 24, 5); ctx.stroke();
      for (let i = 0; i < it.w - 1; i++) {
        plate(ctx, x + T * (i + 1), y + 22, 11);
        plate(ctx, x + T * (i + 1), y + h - 30, 11);
      }
      // candles and salad bowl
      ctx.fillStyle = '#8fc96b'; ctx.beginPath(); ctx.arc(cx - T, cy - 4, 12, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e74c3c';
      for (let k = 0; k < 5; k++) { ctx.beginPath(); ctx.arc(cx - T + Math.cos(k) * 6, cy - 4 + Math.sin(k) * 6, 2.5, 0, Math.PI * 2); ctx.fill(); }
      for (const ox of [-6, 6]) {
        ctx.fillStyle = '#fff6d8'; ctx.fillRect(cx + T * 0.7 + ox - 2, cy - 12, 4, 14);
        ctx.fillStyle = '#ffb347'; ctx.beginPath(); ctx.ellipse(cx + T * 0.7 + ox, cy - 15, 2.5, 4, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'sideboard':
    case 'console':
    case 'cabinet':
    case 'dresser':
    case 'nightstand':
    case 'desk':
    case 'toyChest':
    case 'trunk':
    case 'toyBox':
    case 'tv': {
      const colors: Record<string, string> = {
        sideboard: WOOD, console: '#6d4c41', cabinet: '#5d4037', dresser: '#a1887f', nightstand: '#bcaaa4',
        desk: '#d7b98e', toyChest: '#e57373', trunk: '#795548', toyBox: '#64b5f6', tv: '#4e342e',
      };
      const col = colors[it.kind];
      withShadow(ctx, 10, 5, 0.45, () => fillRR(ctx, x + 3, y + 3, w - 6, h - 8, 5, vgrad(ctx, y, y + h, shade(col, 0.15), shade(col, -0.1)), shade(col, -0.45), 2));
      ctx.fillStyle = shade(col, -0.25);
      ctx.fillRect(x + 3, y + h - 14, w - 6, 6);
      if (it.kind === 'tv') {
        fillRR(ctx, x + w * 0.15, y + 2, w * 0.7, 14, 3, '#111');
        ctx.fillStyle = 'rgba(120,180,255,0.6)'; ctx.fillRect(x + w * 0.17, y + 4, w * 0.66, 9);
        ctx.fillStyle = '#ddd'; ctx.fillRect(x + 12, y + 20, 12, 8);
      } else if (it.kind === 'desk') {
        fillRR(ctx, x + 10, y + 8, 30, 20, 2, '#fff'); // paper
        ctx.strokeStyle = '#2e86de'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x + 14, y + 14); ctx.lineTo(x + 34, y + 16); ctx.stroke();
        ctx.fillStyle = '#f1c40f'; ctx.beginPath(); ctx.arc(x + w - 20, y + 18, 7, 0, Math.PI * 2); ctx.fill(); // lamp
      } else if (it.kind === 'toyChest' || it.kind === 'toyBox') {
        ctx.fillStyle = '#ffeb3b'; ctx.beginPath(); ctx.arc(x + 16, y + 10, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#4caf50'; ctx.fillRect(x + 30, y + 6, 10, 10);
        ctx.fillStyle = '#9c27b0'; ctx.beginPath(); ctx.moveTo(x + 50, y + 16); ctx.lineTo(x + 56, y + 4); ctx.lineTo(x + 62, y + 16); ctx.fill();
      } else if (it.kind === 'trunk') {
        ctx.fillStyle = '#c9a15b'; ctx.fillRect(x + 20, y + 3, 5, h - 12); ctx.fillRect(x + w - 25, y + 3, 5, h - 12);
      } else {
        // drawers + knobs + small decor
        const n = Math.max(1, Math.round(w / T));
        for (let i = 0; i < n; i++) {
          ctx.fillStyle = '#e8d5a8';
          ctx.beginPath(); ctx.arc(x + (w * (i + 0.5)) / n, y + h * 0.45, 2.2, 0, Math.PI * 2); ctx.fill();
        }
        if (it.kind === 'console' || it.kind === 'sideboard') {
          ctx.fillStyle = '#f6e7c1'; ctx.beginPath(); ctx.arc(x + 14, y + 14, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#e57373'; ctx.fillRect(x + w - 30, y + 8, 14, 12);
        }
        if (it.kind === 'nightstand') {
          ctx.fillStyle = '#ffe9a8'; ctx.beginPath(); ctx.arc(cx, cy - 4, 9, 0, Math.PI * 2); ctx.fill();
        }
      }
      break;
    }
    case 'plant':
      plantPot(ctx, cx, cy, T, seed);
      break;
    case 'bookshelf':
    case 'towelCabinet':
    case 'wardrobe': {
      const col = it.kind === 'wardrobe' ? '#8d6e63' : it.kind === 'towelCabinet' ? '#eceff1' : '#6d4c41';
      withShadow(ctx, 10, 5, 0.45, () => fillRR(ctx, x + 2, y + 2, w - 4, h - 6, 4, vgrad(ctx, y, y + h, shade(col, 0.1), shade(col, -0.15)), shade(col, -0.45), 2));
      if (it.kind === 'bookshelf') {
        if (w >= h) {
          books(ctx, x + 6, y + 6, w - 12, h - 18, seed);
        } else {
          for (let yy = y + 6; yy < y + h - 12; yy += 16) {
            ctx.save(); ctx.translate(x + w / 2, yy + 8); ctx.rotate(Math.PI / 2); books(ctx, -6, -w / 2 + 6, 12, w - 12, seed + yy); ctx.restore();
          }
        }
      } else if (it.kind === 'towelCabinet') {
        ctx.fillStyle = '#80cbc4'; ctx.fillRect(x + 6, y + 8, w - 12, 10);
        ctx.fillStyle = '#f48fb1'; ctx.fillRect(x + 6, y + 22, w - 12, 10);
      } else {
        ctx.strokeStyle = shade(col, -0.4); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cx, y + 6); ctx.lineTo(cx, y + h - 12); ctx.stroke();
        ctx.fillStyle = '#ffd54f'; ctx.fillRect(cx - 6, cy - 6, 3, 8); ctx.fillRect(cx + 3, cy - 6, 3, 8);
      }
      break;
    }
    case 'piano':
      withShadow(ctx, 12, 6, 0.5, () => fillRR(ctx, x + 3, y + 3, w - 6, h - 8, 10, vgrad(ctx, y, y + h, '#3a3a40', '#16161a')));
      ctx.fillStyle = '#fafafa';
      ctx.fillRect(x + 10, y + h - 30, w - 20, 14);
      ctx.fillStyle = '#111';
      for (let k = x + 14; k < x + w - 14; k += 8) ctx.fillRect(k, y + h - 30, 4, 8);
      ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(x + 12, y + 8, w - 24, 4);
      ctx.fillStyle = '#ffeb99'; ctx.beginPath(); ctx.arc(x + 22, y + 22, 5, 0, Math.PI * 2); ctx.fill();
      break;
    case 'clock':
      withShadow(ctx, 8, 4, 0.45, () => fillRR(ctx, x + 8, y + 2, w - 16, h - 6, 5, '#5d4037', '#3e2723', 2));
      ctx.fillStyle = '#fff8e1'; ctx.beginPath(); ctx.arc(cx, y + 16, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#3e2723'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx, y + 16); ctx.lineTo(cx, y + 10); ctx.moveTo(cx, y + 16); ctx.lineTo(cx + 5, y + 16); ctx.stroke();
      ctx.fillStyle = '#ffca28'; ctx.beginPath(); ctx.arc(cx, y + 34, 4, 0, Math.PI * 2); ctx.fill();
      break;
    case 'bench':
      withShadow(ctx, 8, 4, 0.4, () => fillRR(ctx, x + 4, y + 10, w - 8, h - 18, 5, WOOD_L, '#5a361d', 2));
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#8e24aa'][i];
        ctx.beginPath(); ctx.ellipse(x + 18 + i * 22, y + 26, 8, 5, 0, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'sofa':
    case 'armchair':
    case 'coveredSofa':
    case 'beanbag': {
      const col = it.kind === 'coveredSofa' ? '#ece6da' : it.kind === 'beanbag' ? '#ff8a65' : it.kind === 'armchair' ? '#5c8d89' : '#4f7cac';
      if (it.kind === 'beanbag') {
        withShadow(ctx, 10, 5, 0.45, () => { ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(cx, cy, w * 0.42, h * 0.42, 0, 0, Math.PI * 2); ctx.fill(); });
        ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.beginPath(); ctx.ellipse(cx - 8, cy - 5, w * 0.18, h * 0.15, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      withShadow(ctx, 12, 6, 0.5, () => fillRR(ctx, x + 2, y + 2, w - 4, h - 4, 12, shade(col, -0.2)));
      fillRR(ctx, x + 2, y + 2, w - 4, 14, 8, shade(col, -0.05)); // back
      fillRR(ctx, x + 2, y + 6, 12, h - 10, 6, shade(col, 0.05)); // arms
      fillRR(ctx, x + w - 14, y + 6, 12, h - 10, 6, shade(col, 0.05));
      const seats = Math.max(1, Math.round(w / T));
      const sw = (w - 28) / seats;
      for (let i = 0; i < seats; i++) fillRR(ctx, x + 14 + i * sw + 1, y + 14, sw - 2, h - 20, 6, vgrad(ctx, y, y + h, shade(col, 0.15), col));
      if (it.kind === 'coveredSofa') {
        ctx.strokeStyle = 'rgba(120,100,80,0.35)'; ctx.lineWidth = 1.5;
        for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.moveTo(x + 10 + i * 20, y + 6); ctx.quadraticCurveTo(x + 20 + i * 20, cy, x + 6 + i * 22, y + h - 6); ctx.stroke(); }
      } else {
        ctx.fillStyle = '#f6d55c'; ctx.save(); ctx.translate(x + 26, y + 22); ctx.rotate(-0.3); ctx.fillRect(-8, -8, 16, 16); ctx.restore();
      }
      break;
    }
    case 'coffeeTable':
      withShadow(ctx, 10, 6, 0.45, () => fillRR(ctx, x + 6, y + 8, w - 12, h - 16, 6, '#6d4c41'));
      fillRR(ctx, x + 9, y + 10, w - 18, h - 22, 4, 'rgba(190,225,240,0.85)', '#4e342e');
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(cx - 10, cy - 4, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#8d6e63'; ctx.beginPath(); ctx.arc(cx - 10, cy - 4, 4, 0, Math.PI * 2); ctx.fill();
      fillRR(ctx, cx + 2, cy - 2, 18, 12, 2, '#e57373');
      break;
    case 'fireplace': {
      withShadow(ctx, 10, 4, 0.5, () => fillRR(ctx, x + 2, y + 2, w - 4, h - 4, 4, '#9e9e9e', '#616161', 2));
      fillRR(ctx, x + 10, y + 12, w - 20, h - 24, 4, '#2b1b14');
      const fg = ctx.createRadialGradient(cx, cy + 6, 2, cx, cy + 6, 18);
      fg.addColorStop(0, '#fff3b0'); fg.addColorStop(0.4, '#ff9f1c'); fg.addColorStop(1, 'rgba(230,57,70,0)');
      ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(cx, cy + 6, 12, 20, 0, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case 'bathtub':
      withShadow(ctx, 10, 5, 0.45, () => fillRR(ctx, x + 3, y + 3, w - 6, h - 8, 18, '#fbfdff', '#9fb4c2', 2));
      fillRR(ctx, x + 12, y + 11, w - 24, h - 24, 14, vgrad(ctx, y, y + h, '#bfe8f5', '#7fcbe6'));
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.beginPath(); ctx.arc(x + 30 + i * 14, y + 24 + (i % 2) * 14, 5 + (i % 3), 0, Math.PI * 2); ctx.fill();
      }
      ctx.fillStyle = '#ffd600'; ctx.beginPath(); ctx.ellipse(x + w - 40, y + 40, 7, 6, 0, 0, Math.PI * 2); ctx.fill(); // duck
      ctx.fillStyle = '#ff9800'; ctx.beginPath(); ctx.moveTo(x + w - 34, y + 39); ctx.lineTo(x + w - 29, y + 41); ctx.lineTo(x + w - 34, y + 43); ctx.fill();
      break;
    case 'toilet':
      withShadow(ctx, 8, 4, 0.4, () => fillRR(ctx, x + 10, y + 2, w - 20, 14, 4, '#fbfdff', '#9fb4c2', 1.5));
      ctx.fillStyle = '#fbfdff'; ctx.strokeStyle = '#9fb4c2';
      ctx.beginPath(); ctx.ellipse(cx, y + 30, 13, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d6eef7'; ctx.beginPath(); ctx.ellipse(cx, y + 31, 8, 10, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'sink':
      withShadow(ctx, 8, 4, 0.4, () => fillRR(ctx, x + 4, y + 4, w - 8, h - 14, 6, '#e0d6cc', '#9e9e9e', 1.5));
      ctx.fillStyle = '#fbfdff'; ctx.beginPath(); ctx.ellipse(cx, y + 22, 18, 11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#b0bec5'; ctx.fillRect(cx - 2, y + 6, 4, 8);
      ctx.fillStyle = '#4fc3f7'; ctx.fillRect(x + 8, y + 8, 6, 10); // toothbrush cup
      break;
    case 'laundry':
      withShadow(ctx, 8, 4, 0.4, () => { ctx.fillStyle = '#d7ccc8'; ctx.beginPath(); ctx.arc(cx, cy, 17, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#90caf9'; ctx.beginPath(); ctx.arc(cx - 4, cy - 3, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f48fb1'; ctx.beginPath(); ctx.arc(cx + 5, cy + 3, 7, 0, Math.PI * 2); ctx.fill();
      break;
    case 'rocker':
      chair(ctx, cx, cy, 0.3);
      ctx.fillStyle = '#ce93d8'; ctx.beginPath(); ctx.arc(cx + 2, cy + 2, 6, 0, Math.PI * 2); ctx.fill(); // yarn
      break;
    case 'boxes': {
      const R = rng(seed);
      const n = it.w * it.h * 2;
      for (let i = 0; i < n; i++) {
        const bw = 24 + R() * 16, bh = 20 + R() * 14;
        const bx = x + R() * (w - bw), by = y + R() * (h - bh);
        withShadow(ctx, 6, 3, 0.4, () => fillRR(ctx, bx, by, bw, bh, 2, shade('#c8a165', (R() - 0.5) * 0.25), '#8d6e3f', 1.2));
        ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx + bw / 2 - 2, by, 4, bh);
      }
      break;
    }
    case 'mannequin':
      withShadow(ctx, 6, 3, 0.4, () => { ctx.fillStyle = '#d7ccc8'; ctx.beginPath(); ctx.ellipse(cx, cy, 14, 18, 0, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#ef9a9a'; ctx.beginPath(); ctx.ellipse(cx, cy + 4, 12, 10, 0, 0, Math.PI * 2); ctx.fill();
      break;
    case 'rockingHorse':
      withShadow(ctx, 6, 3, 0.4, () => fillRR(ctx, x + 6, y + 14, w - 12, 18, 9, '#ffb74d', '#8d5524', 1.5));
      ctx.fillStyle = '#ffb74d'; ctx.beginPath(); ctx.arc(x + 12, y + 14, 8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#6d4c41'; ctx.fillRect(x + 14, y + 10, 18, 4);
      break;
    // Hide furniture drawn as overlays:
    case 'bed':
    case 'bigBed': {
      const col = it.color ?? '#3d7df0';
      withShadow(ctx, 14, 8, 0.5, () => fillRR(ctx, x + 2, y + 2, w - 4, h - 4, 8, '#6d4c41'));
      fillRR(ctx, x + 2, y + 2, w - 4, 16, 6, '#5d4037');
      fillRR(ctx, x + 7, y + 10, w - 14, h - 16, 6, '#fdfdfb');
      const pillows = it.kind === 'bigBed' ? 2 : 1;
      for (let i = 0; i < pillows; i++) {
        const pw = (w - 20) / pillows;
        fillRR(ctx, x + 10 + i * pw + 2, y + 14, pw - 4, 22, 8, '#ffffff', '#d7d7d0');
      }
      blanket(ctx, x + 7, y + 42, w - 14, h - 50, col);
      if (it.kind === 'bed') {
        ctx.fillStyle = '#ffd54f'; ctx.beginPath(); ctx.arc(x + w / 2, y + 26, 7, 0, Math.PI * 2); ctx.fill(); // teddy
        ctx.beginPath(); ctx.arc(x + w / 2 - 6, y + 20, 3, 0, Math.PI * 2); ctx.arc(x + w / 2 + 6, y + 20, 3, 0, Math.PI * 2); ctx.fill();
      }
      break;
    }
    case 'teepee': {
      withShadow(ctx, 12, 6, 0.45, () => {
        ctx.fillStyle = '#f5e1b8';
        ctx.beginPath(); ctx.moveTo(cx, y + 4); ctx.lineTo(x + w - 6, y + h - 6); ctx.lineTo(x + 6, y + h - 6); ctx.closePath(); ctx.fill();
      });
      ctx.fillStyle = '#e57373';
      ctx.beginPath(); ctx.moveTo(cx, y + 4); ctx.lineTo(cx + 16, y + 40); ctx.lineTo(cx - 16, y + 40); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#4db6ac';
      for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.moveTo(x + 18 + i * 14, y + h - 22); ctx.lineTo(x + 25 + i * 14, y + h - 32); ctx.lineTo(x + 32 + i * 14, y + h - 22); ctx.fill(); }
      ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(cx, y + 4); ctx.lineTo(cx - 10, y - 4); ctx.moveTo(cx, y + 4); ctx.lineTo(cx + 10, y - 4); ctx.stroke();
      break;
    }
  }
}

/** Overlay sprite for a hide-able piece of furniture (drawn above the nugget). */
export function bakeFurniture(it: Furniture, scale = 2) {
  const pad = 16;
  const { c, ctx } = makeCanvas(it.w * T + pad * 2, it.h * T + pad * 2, scale);
  ctx.translate(pad - it.x * T, pad - it.y * T);
  drawFurniture(ctx, it);
  return { canvas: c, pad };
}

// ------------------------------------------------------------------ doors

export function bakeDoor(color: KeyColor, open: boolean, orient: 'h' | 'v', scale = 2) {
  const info = KEY_INFO[color];
  const pad = 10;
  const { c, ctx } = makeCanvas(T + pad * 2, T + pad * 2, scale);
  ctx.translate(pad, pad);
  if (orient === 'v') {
    ctx.translate(T / 2, T / 2);
    ctx.rotate(Math.PI / 2);
    ctx.translate(-T / 2, -T / 2);
  }
  // frame posts
  ctx.fillStyle = '#3b2a24';
  ctx.fillRect(-3, 6, 7, T - 12);
  ctx.fillRect(T - 4, 6, 7, T - 12);
  if (!open) {
    const g = ctx.createLinearGradient(0, 0, 0, T);
    g.addColorStop(0, shade(info.hex, 0.25));
    g.addColorStop(1, info.dark);
    withShadow(ctx, 8, 4, 0.5, () => fillRR(ctx, 2, 4, T - 4, T - 8, 4, g, shade(info.dark, -0.4), 2));
    // panels
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    rr(ctx, 7, 9, T / 2 - 9, T - 18, 3); ctx.stroke();
    rr(ctx, T / 2 + 2, 9, T / 2 - 9, T - 18, 3); ctx.stroke();
    // emblem
    ctx.fillStyle = '#fffaf0';
    ctx.beginPath(); ctx.arc(T / 2, T / 2, 10, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = shade(info.dark, -0.3); ctx.lineWidth = 1.5; ctx.stroke();
    drawSymbol(ctx, info.symbol, T / 2, T / 2 + 0.5, 13, info.dark);
    // keyhole
    ctx.fillStyle = '#f6d36b';
    ctx.beginPath(); ctx.arc(T - 10, T / 2, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2b1a10';
    ctx.beginPath(); ctx.arc(T - 10, T / 2, 1.4, 0, Math.PI * 2); ctx.fill();
  } else {
    // swung-open door panel along the left post
    const g = ctx.createLinearGradient(0, 0, 10, 0);
    g.addColorStop(0, info.dark);
    g.addColorStop(1, info.hex);
    withShadow(ctx, 6, 2, 0.4, () => fillRR(ctx, 2, 6, 9, T + 2, 3, g, shade(info.dark, -0.4), 1.5));
  }
  return { canvas: c, pad };
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
