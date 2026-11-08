import './style.css';
import { Application } from 'pixi.js';
import { createGame, currentObjective, update, type GameEvent, type GameOptions, type GameState } from './game/state';
import { botInput } from './game/bot';
import { KEY_INFO, type Difficulty } from './game/types';
import { Scene } from './render/scene';
import { drawNuggetPortrait } from './render/paint';
import { Sound } from './audio/sound';
import { Controls } from './input';
import { Hud } from './ui/hud';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type Mode = 'menu' | 'game' | 'paused' | 'ended';

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

function loadBest(d: Difficulty): number | null {
  try {
    const v = localStorage.getItem(`nugget-best-${d}`);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
function saveBest(d: Difficulty, t: number) {
  try {
    localStorage.setItem(`nugget-best-${d}`, String(t));
  } catch {
    /* storage unavailable: best time just isn't remembered */
  }
}

async function boot() {
  const app = new Application();
  await app.init({
    resizeTo: window,
    antialias: true,
    background: '#0e1324',
    resolution: Math.min(2, window.devicePixelRatio || 1),
    autoDensity: true,
    preference: 'webgl',
  });
  $('stage').appendChild(app.canvas);

  const scene = new Scene(app);
  const sound = new Sound();
  const controls = new Controls();
  const hud = new Hud();

  let difficulty: Difficulty = (['easy', 'normal', 'hard'] as const).find((d) => d === params.get('difficulty')) ?? 'normal';
  const opts: GameOptions = { noFamily: params.has('nofamily') };
  const useBot = params.has('bot');
  const speed = Math.max(1, Math.min(20, Number(params.get('speed')) || 1));

  let state: GameState = createGame(difficulty, opts);
  let mode: Mode = 'menu';
  let acc = 0;
  let stepTimer = 0;
  const alertCooldown = new Map<string, number>();

  // Bake all floors once while the loading screen is up.
  await document.fonts?.ready?.catch(() => undefined);
  scene.prepare(state);
  $('loading').hidden = true;

  // Title art
  const hero = $<HTMLCanvasElement>('hero-nugget');
  const hctx = hero.getContext('2d')!;
  const hdpr = Math.min(2, window.devicePixelRatio || 1);
  hero.width = 280 * hdpr;
  hero.height = 280 * hdpr;
  hctx.scale(hdpr, hdpr);
  hctx.translate(140, 130);
  drawNuggetPortrait(hctx, 80);

  const showBest = () => {
    const b = loadBest(difficulty);
    $('best-time').textContent = b ? `Best escape on ${difficulty}: ${fmtTime(b)}` : '';
  };
  showBest();

  // Difficulty buttons
  document.querySelectorAll<HTMLButtonElement>('.difficulty button').forEach((btn) => {
    const sync = () => document.querySelectorAll<HTMLButtonElement>('.difficulty button').forEach((b) => {
      const on = b.dataset.diff === difficulty;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    btn.addEventListener('click', () => {
      difficulty = btn.dataset.diff as Difficulty;
      sync();
      showBest();
      sound.unlock();
      sound.click();
    });
    sync();
  });

  const screens = ['screen-title', 'screen-pause', 'screen-win', 'screen-over'];
  const show = (id: string | null) => screens.forEach((s) => ($(s).hidden = s !== id));
  const isTouch = () => document.body.classList.contains('touch');

  function start() {
    sound.unlock();
    sound.click();
    state = createGame(difficulty, opts);
    scene.reset();
    scene.snapCamera();
    hud.reset();
    controls.clear();
    acc = 0;
    alertCooldown.clear();
    mode = 'game';
    show(null);
    $('hud').hidden = false;
    $('touch').hidden = !isTouch();
    sound.startMusic();
    hud.toast('Hop off the plate and find the <b style="color:#e8424a">Red key</b>!', '', 3200);
  }

  function toMenu() {
    mode = 'menu';
    sound.stopMusic();
    state = createGame(difficulty, opts);
    scene.reset();
    scene.snapCamera();
    $('hud').hidden = true;
    $('touch').hidden = true;
    showBest();
    show('screen-title');
  }

  function togglePause() {
    if (mode === 'game') {
      mode = 'paused';
      $('pause-hint').textContent = currentObjective(state)?.hint ?? '';
      show('screen-pause');
      sound.stopMusic();
    } else if (mode === 'paused') {
      mode = 'game';
      show(null);
      controls.clear();
      sound.startMusic();
    }
  }

  const soundBtn = $('btn-sound');
  const renderSoundBtn = () => {
    soundBtn.innerHTML = sound.muted
      ? '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 9l5 6M21 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
      : '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor"/><path d="M16 8.5a5 5 0 010 7M18.5 6a8.5 8.5 0 010 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>';
  };
  try { sound.setMuted(localStorage.getItem('nugget-muted') === '1'); } catch { /* ignore */ }
  renderSoundBtn();
  const toggleMute = () => {
    sound.unlock();
    sound.setMuted(!sound.muted);
    try { localStorage.setItem('nugget-muted', sound.muted ? '1' : '0'); } catch { /* ignore */ }
    renderSoundBtn();
  };
  const hint = () => {
    if (mode !== 'game') return;
    const o = currentObjective(state);
    if (o) hud.toast(`<span class="sw" style="background:${KEY_INFO[o.color].hex};color:${KEY_INFO[o.color].hex}"></span>${o.hint}`, '', 5000);
  };

  $('btn-play').addEventListener('click', start);
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-restart').addEventListener('click', start);
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-again').addEventListener('click', start);
  $('btn-retry').addEventListener('click', start);
  $('btn-win-menu').addEventListener('click', toMenu);
  $('btn-over-menu').addEventListener('click', toMenu);
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-sound').addEventListener('click', toggleMute);
  $('btn-hint').addEventListener('click', hint);
  controls.onPause = togglePause;
  controls.onMute = toggleMute;
  controls.onHint = hint;
  controls.onAnyKey = () => sound.unlock();
  controls.bindTouch($('stick'), $('stick-knob'), $('dash-btn'));
  window.addEventListener('keydown', (e) => {
    if (mode === 'menu' && e.code === 'Enter') start();
  });
  window.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' && !isTouch()) {
      document.body.classList.add('touch');
      if (mode === 'game') $('touch').hidden = false;
    }
  }, { capture: true });

  function onEvent(e: GameEvent) {
    scene.handle(state, e);
    switch (e.type) {
      case 'key': {
        const info = KEY_INFO[e.color];
        sound.key();
        hud.popKey(e.color);
        hud.toast(`<span class="sw" style="background:${info.hex};color:${info.hex}"></span>You found the ${info.label} key!`);
        break;
      }
      case 'unlock': {
        const info = KEY_INFO[e.color];
        sound.unlock_();
        hud.toast(e.color === 'gold'
          ? '<span class="sw" style="background:#f5c518;color:#f5c518"></span>The front door is open! Run outside!'
          : `<span class="sw" style="background:${info.hex};color:${info.hex}"></span>${info.label} door unlocked`);
        break;
      }
      case 'locked': {
        const info = KEY_INFO[e.color];
        sound.locked();
        hud.toast(`<span class="sw" style="background:${info.hex};color:${info.hex}"></span>Locked! You need the ${info.label} key.`);
        break;
      }
      case 'alert': {
        sound.alert();
        const last = alertCooldown.get(e.id) ?? -99;
        if (state.time - last > 5) {
          const c = state.chasers.find((c) => c.def.id === e.id)!;
          hud.toast(`${c.def.name} spotted you! Run or hide!`, 'danger', 1800);
          alertCooldown.set(e.id, state.time);
        }
        break;
      }
      case 'lost':
        sound.lost();
        break;
      case 'caught': {
        sound.caught();
        const c = state.chasers.find((c) => c.def.id === e.by)!;
        hud.toast(state.lives > 0 ? `${c.def.name} caught you! ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.` : `${c.def.name} caught you!`, 'danger', 2400);
        break;
      }
      case 'floor':
        sound.stairs();
        scene.snapCamera();
        hud.banner(state.maps[e.floor].def.name);
        break;
      case 'dash':
        sound.dash();
        break;
      case 'win': {
        sound.win();
        sound.stopMusic();
        mode = 'ended';
        const best = loadBest(state.difficulty);
        const isBest = best === null || state.time < best;
        if (isBest) saveBest(state.difficulty, state.time);
        const stars = Math.max(1, 3 - state.timesCaught);
        setTimeout(() => {
          $('win-stars').innerHTML = [0, 1, 2].map((i) => `<span class="s ${i < stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.18}s">★</span>`).join('');
          $('win-time').textContent = fmtTime(state.time);
          $('win-spotted').textContent = String(state.timesSpotted);
          $('win-caught').textContent = String(state.timesCaught);
          $('win-best').textContent = isBest ? 'New!' : fmtTime(best!);
          $('touch').hidden = true;
          show('screen-win');
        }, 1600);
        break;
      }
      case 'gameover': {
        sound.gameOver();
        sound.stopMusic();
        mode = 'ended';
        $('over-text').textContent = `${state.caughtBy ?? 'The family'} caught you one time too many. Try sneaking and hiding under furniture!`;
        $('touch').hidden = true;
        show('screen-over');
        break;
      }
    }
  }

  app.ticker.add((ticker) => {
    const dt = Math.min(0.05, ticker.deltaMS / 1000);
    if (mode === 'game' || mode === 'ended') {
      acc += dt * speed;
      let guard = 0;
      while (acc >= STEP && guard++ < 40) {
        const input = useBot ? botInput(state) : mode === 'game' ? controls.read() : { mx: 0, my: 0, dash: false };
        update(state, input, STEP);
        for (const e of state.events) onEvent(e);
        acc -= STEP;
      }
      if (state.player.moving && state.status === 'playing') {
        stepTimer -= dt;
        if (stepTimer <= 0) { sound.step_(); stepTimer = state.player.dashTime > 0 ? 0.08 : 0.17; }
      }
      sound.intensity = state.chasers.some((c) => c.floor === state.player.floor && (c.mode === 'chase' || c.mode === 'alert')) ? 1 : 0;
      scene.render(state, dt);
      hud.update(state);
    } else {
      scene.render(state, dt, mode === 'menu');
    }
  });

  // Hooks for automated tests and debugging.
  (window as unknown as { __nugget: unknown }).__nugget = {
    get state() { return state; },
    get mode() { return mode; },
    start,
    toMenu,
  };

  if (params.has('autostart')) start();
}

boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('loading');
  if (l) l.textContent = 'Sorry, this browser could not start the game (WebGL is needed).';
});
