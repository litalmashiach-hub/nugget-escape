import type { Input } from './game/state';

/** Keyboard + on-screen joystick, merged into one movement vector. */
export class Controls {
  private keys = new Set<string>();
  private dashQueued = false;
  private stick = { x: 0, y: 0, id: -1 };
  private fireTouch = false;
  private fireMouse = false;
  onPause: () => void = () => {};
  onMute: () => void = () => {};
  onHint: () => void = () => {};
  onAnyKey: () => void = () => {};

  constructor() {
    window.addEventListener('keydown', (e) => {
      if (e.repeat && (e.code === 'Space' || e.code === 'ShiftLeft')) return;
      this.onAnyKey();
      const k = e.code;
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'Enter'].includes(k)) e.preventDefault();
      if (k === 'Space' || k === 'ShiftLeft' || k === 'ShiftRight') this.dashQueued = true;
      else if (k === 'KeyP' || k === 'Escape') this.onPause();
      else if (k === 'KeyM') this.onMute();
      else if (k === 'KeyH') this.onHint();
      this.keys.add(k);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.fireMouse = false; this.fireTouch = false; });
  }

  /** Holding the mouse button on the game squirts ketchup too. */
  bindMouse(stage: HTMLElement) {
    stage.addEventListener('pointerdown', (e) => { if (e.pointerType === 'mouse' && e.button === 0) this.fireMouse = true; });
    window.addEventListener('pointerup', (e) => { if (e.pointerType === 'mouse') this.fireMouse = false; });
  }

  bindFire(btn: HTMLElement) {
    const on = (e: PointerEvent) => { e.preventDefault(); this.fireTouch = true; try { btn.setPointerCapture?.(e.pointerId); } catch { /* synthetic or finished pointer */ } };
    const off = () => { this.fireTouch = false; };
    btn.addEventListener('pointerdown', on);
    btn.addEventListener('pointerup', off);
    btn.addEventListener('pointercancel', off);
    btn.addEventListener('lostpointercapture', off);
  }

  bindTouch(stick: HTMLElement, knob: HTMLElement, dash: HTMLElement) {
    const move = (e: PointerEvent) => {
      const r = stick.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const max = r.width / 2 - 10;
      const len = Math.hypot(dx, dy);
      if (len > max) { dx = (dx / len) * max; dy = (dy / len) * max; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      const n = Math.hypot(dx, dy) / max;
      this.stick.x = n < 0.15 ? 0 : dx / max;
      this.stick.y = n < 0.15 ? 0 : dy / max;
    };
    const end = (e: PointerEvent) => {
      if (e.pointerId !== this.stick.id) return;
      this.stick = { x: 0, y: 0, id: -1 };
      knob.style.transform = '';
    };
    stick.addEventListener('pointerdown', (e) => {
      this.stick.id = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      move(e);
    });
    stick.addEventListener('pointermove', (e) => { if (e.pointerId === this.stick.id) move(e); });
    stick.addEventListener('pointerup', end);
    stick.addEventListener('pointercancel', end);
    dash.addEventListener('pointerdown', (e) => { e.preventDefault(); this.dashQueued = true; });
  }

  read(): Input {
    let mx = 0, my = 0;
    if (this.keys.has('ArrowLeft') || this.keys.has('KeyA')) mx -= 1;
    if (this.keys.has('ArrowRight') || this.keys.has('KeyD')) mx += 1;
    if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) my -= 1;
    if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) my += 1;
    if (!mx && !my) { mx = this.stick.x; my = this.stick.y; }
    const dash = this.dashQueued;
    this.dashQueued = false;
    const fire = this.fireTouch || this.fireMouse || ['KeyF', 'KeyJ', 'KeyK', 'Enter', 'NumpadEnter'].some((k) => this.keys.has(k));
    return { mx, my, dash, fire };
  }

  clear() {
    this.keys.clear();
    this.dashQueued = false;
    this.fireMouse = false;
    this.fireTouch = false;
  }
}
