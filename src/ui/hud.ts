import { currentObjective, DASH_COOLDOWN, type GameState } from '../game/state';
import { BOTTLE_SIZE } from '../game/boss';
import { SECRETS, FEAST_RECHARGE } from '../game/secrets';
import { KEY_INFO, KEY_ORDER, type KeyColor } from '../game/types';
import { drawKey, drawNuggetPortrait, makeCanvas } from '../render/paint';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

function keyIconURL(color: KeyColor) {
  const { c, ctx } = makeCanvas(48, 48, 2);
  drawKey(ctx, color, 26, 24, 0.95);
  return c.toDataURL();
}

export function nuggetIconURL(size = 64, mood: 'happy' | 'scared' = 'happy') {
  const { c, ctx } = makeCanvas(size, size, 2);
  ctx.translate(size / 2, size / 2 - size * 0.06);
  drawNuggetPortrait(ctx, size * 0.32, mood);
  return c.toDataURL();
}

export class Hud {
  private slots = new Map<KeyColor, HTMLElement>();
  private lastFloor = -1;
  private lastRoom = '';
  private lastObjective = '';
  private livesShown = -1;
  private secretsShown = -1;
  private nuggetURL = nuggetIconURL();
  private mini = $<HTMLCanvasElement>('minimap');
  private miniCtx = this.mini.getContext('2d')!;

  constructor() {
    const ring = $('hud-keys');
    for (const color of KEY_ORDER) {
      const el = document.createElement('div');
      el.className = 'key-slot';
      el.style.setProperty('--slot', KEY_INFO[color].hex);
      el.title = `${KEY_INFO[color].label} key`;
      el.innerHTML = `<svg viewBox="0 0 48 48"><image href="${keyIconURL(color)}" width="48" height="48"/></svg>`;
      ring.appendChild(el);
      this.slots.set(color, el);
    }
    (document.querySelector('.feast-icon') as HTMLElement).style.backgroundImage = `url(${nuggetIconURL(48)})`;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.mini.width = 200 * dpr;
    this.mini.height = 140 * dpr;
  }

  reset() {
    this.lastFloor = -1;
    this.lastRoom = '';
    this.lastObjective = '';
    this.livesShown = -1;
    this.secretsShown = -1;
    for (const el of this.slots.values()) el.className = 'key-slot';
    $('toasts').innerHTML = '';
  }

  popKey(color: KeyColor) {
    const el = this.slots.get(color)!;
    el.classList.add('pop');
    setTimeout(() => el.classList.remove('pop'), 350);
  }

  toast(html: string, kind: '' | 'danger' | 'secret' = '', ms = 2200) {
    const box = $('toasts');
    const el = document.createElement('div');
    el.className = `toast ${kind}`;
    el.innerHTML = html;
    box.appendChild(el);
    while (box.children.length > 3) box.firstElementChild!.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, ms);
  }

  banner(text: string) {
    const b = $('floor-banner');
    b.hidden = false;
    b.textContent = text;
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
  }

  update(state: GameState) {
    const p = state.player;
    const map = state.maps[p.floor];
    if (p.floor !== this.lastFloor) {
      this.lastFloor = p.floor;
      $('hud-floor').textContent = map.def.name;
    }
    const room = state.boss ? 'Front Garden' : map.roomAt(p.pos.x, p.pos.y)?.name ?? this.lastRoom;
    if (room !== this.lastRoom) {
      this.lastRoom = room;
      $('hud-room').textContent = room;
    }
    for (const color of KEY_ORDER) {
      const el = this.slots.get(color)!;
      el.classList.toggle('held', state.held.has(color));
      el.classList.toggle('used', state.unlocked.has(color));
    }
    if (state.lives !== this.livesShown) {
      const box = $('hud-lives');
      const max = state.settings.lives;
      box.innerHTML = '';
      for (let i = 0; i < max; i++) {
        const img = document.createElement('img');
        img.src = this.nuggetURL;
        img.alt = '';
        if (i >= state.lives) img.className = 'lost';
        box.appendChild(img);
      }
      box.setAttribute('aria-label', `${state.lives} lives left`);
      this.livesShown = state.lives;
    }
    const feastBtn = $('feast-btn');
    const allFound = state.secrets.size === SECRETS.length;
    if (feastBtn.hidden === allFound) feastBtn.hidden = !allFound;
    if (allFound) {
      const cooling = state.feastCd > 0;
      feastBtn.classList.toggle('cooling', cooling);
      ($('feast-charge') as HTMLElement).style.transform = `scaleX(${cooling ? state.feastCd / FEAST_RECHARGE : 0})`;
    }
    if (state.secrets.size !== this.secretsShown) {
      this.secretsShown = state.secrets.size;
      const el = $('hud-secrets');
      el.hidden = this.secretsShown === 0;
      el.innerHTML = SECRETS.filter((s) => state.secrets.has(s.id)).map((s) => `<span class="em">${s.emoji}</span>`).join('') + ` ${this.secretsShown}/${SECRETS.length}`;
    }
    const obj = currentObjective(state);
    const key = obj ? obj.text + obj.color : '';
    if (key !== this.lastObjective) {
      this.lastObjective = key;
      const el = $('hud-objective');
      if (obj) {
        const hex = obj.action === 'boss' ? '#e0201c' : KEY_INFO[obj.color].hex;
        (el.querySelector('.obj-dot') as HTMLElement).style.cssText = `background:${hex};box-shadow:0 0 12px ${hex}`;
        (el.querySelector('.obj-text') as HTMLElement).textContent = obj.text;
      }
    }
    $('hud-hidden').hidden = !(p.hidden && state.status === 'playing');
    const dash = document.getElementById('dash-btn');
    if (dash) dash.classList.toggle('cooling', p.dashCd > 0.05);
    void DASH_COOLDOWN;
    if (state.boss) {
      const b = state.boss;
      $('boss-hp').style.transform = `scaleX(${Math.max(0, b.hp) / b.maxHp})`;
      const empty = state.ketchup <= 0;
      // An empty bottle stays empty until the nugget grabs a new one: the meter never creeps back up.
      $('ketchup-fill').style.transform = `scaleX(${state.ketchup / BOTTLE_SIZE})`;
      $('ketchup-fill').parentElement!.classList.toggle('empty', empty);
      const label = empty ? (state.bottles.length ? 'Grab a bottle!' : 'Empty!') : 'Ketchup';
      const lab = document.querySelector<HTMLElement>('.ketchup-label')!;
      if (lab.textContent !== label) lab.textContent = label;
      lab.classList.toggle('empty', empty);
      document.getElementById('fire-btn')?.classList.toggle('cooling', empty);
    }
    this.drawMinimap(state);
  }

  private drawMinimap(state: GameState) {
    const p = state.player;
    const map = state.maps[p.floor];
    const ctx = this.miniCtx;
    const W = this.mini.width, H = this.mini.height;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, W, H);
    const s = Math.min((W - 16) / map.w, (H - 16) / map.h);
    const ox = (W - map.w * s) / 2, oy = (H - map.h * s) / 2;
    ctx.translate(ox, oy);
    const tints = ['#e9b87233', '#9fd3c733', '#7fa4c933', '#d6c6a833', '#e6c3d033'];
    for (let y = 0; y < map.h; y++)
      for (let x = 0; x < map.w; x++) {
        if (map.isWall(x, y)) { ctx.fillStyle = '#cbbda4'; ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5); continue; }
        const d = map.door(x, y);
        if (d) {
          ctx.fillStyle = KEY_INFO[d.color].hex;
          ctx.globalAlpha = state.unlocked.has(d.color) ? 0.45 : 1;
          ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
          ctx.globalAlpha = 1;
          continue;
        }
        const r = map.room[y * map.w + x];
        ctx.fillStyle = map.isStairs(x, y) ? '#f5b94299' : tints[r % tints.length];
        ctx.fillRect(x * s, y * s, s + 0.5, s + 0.5);
      }
    for (const c of state.chasers) {
      if (c.floor !== p.floor) continue;
      ctx.fillStyle = c.mode === 'chase' || c.mode === 'alert' ? '#ff4d5a' : '#ffffffcc';
      ctx.beginPath(); ctx.arc(c.pos.x * s, c.pos.y * s, s * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#f5b942';
    ctx.strokeStyle = '#4a2306';
    ctx.lineWidth = Math.max(1, s * 0.25);
    ctx.beginPath(); ctx.arc(p.pos.x * s, p.pos.y * s, s * 0.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
}
