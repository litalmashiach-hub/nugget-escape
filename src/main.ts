import './style.css';
import { createGame, currentObjective, update, startFeast, type GameEvent, type GameOptions, type GameState } from './game/state';
import { botInput } from './game/bot';
import { beginBossFight, makeBoss, bossDef, ENTRY, MANAGER } from './game/boss';
import { SECRETS } from './game/secrets';
import { KEY_INFO, type Difficulty } from './game/types';
import type { LevelId } from './game/levels';
import { STREET_LENGTH } from './render/street';
import { Scene } from './render/scene';
import { CUTSCENE_LENGTH, BOSS_INTRO_LENGTH } from './render/cutscene';
import { OFFICE_INTRO_LENGTH } from './render/office';
import { drawNuggetPortrait } from './render/paint';
import { Sound } from './audio/sound';
import { Controls } from './input';
import { Hud } from './ui/hud';

const STEP = 1 / 60;
const params = new URLSearchParams(location.search);
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

type Mode = 'menu' | 'cutscene' | 'bossCutscene' | 'street' | 'game' | 'paused' | 'ended';

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  return `${m}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
}

const bestKey = (d: Difficulty, level: LevelId) => (level === 1 ? `nugget-best-${d}` : `nugget-best-l${level}-${d}`);

function loadBest(d: Difficulty, level: LevelId = 1): number | null {
  try {
    const v = localStorage.getItem(bestKey(d, level));
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}
function saveBest(d: Difficulty, t: number, level: LevelId = 1) {
  try {
    localStorage.setItem(bestKey(d, level), String(t));
  } catch {
    /* storage unavailable: best time just isn't remembered */
  }
}

/** Level 2 opens once Level 1 has been beaten (remembered on this device). */
function level2Unlocked() {
  try {
    return localStorage.getItem('nugget-level2') === '1';
  } catch {
    return false;
  }
}
function unlockLevel2() {
  try {
    localStorage.setItem('nugget-level2', '1');
  } catch {
    /* storage unavailable: it stays unlocked until the page reloads */
  }
}

/** Software renderers (headless browsers, old machines) get the cheap lighting path. */
function wantLowFx() {
  if (params.has('lowfx')) return true;
  if (params.has('hifx')) return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2') ?? document.createElement('canvas').getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const name = ext ? String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL)) : '';
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /swiftshader|llvmpipe|software|basic render/i.test(name);
  } catch {
    return true;
  }
}

/** Phones and tablets: lighter lighting so the game stays smooth. */
function isPhone() {
  return matchMedia('(pointer: coarse)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

async function boot() {
  const scene = new Scene($('stage'), { lowFx: wantLowFx(), phone: isPhone() });
  const sound = new Sound();
  const controls = new Controls();
  const hud = new Hud();

  let difficulty: Difficulty = (['easy', 'normal', 'hard'] as const).find((d) => d === params.get('difficulty')) ?? 'normal';
  const opts: GameOptions = { noFamily: params.has('nofamily'), noBoss: params.has('noboss'), seed: params.has('seed') ? Number(params.get('seed')) : undefined };
  const useBot = params.has('bot');
  const speed = Math.max(1, Math.min(20, Number(params.get('speed')) || 1));

  let level2Open = level2Unlocked() || params.get('level') === '2';
  let level: LevelId = params.get('level') === '2' ? 2 : 1;
  let state: GameState = createGame(difficulty, opts);
  let nextTimer = 0;
  let nextTick = 0;
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
    const b = loadBest(difficulty, level);
    $('best-time').textContent = b ? `Best ${level === 2 ? 'Level 2 time' : 'escape'} on ${difficulty}: ${fmtTime(b)}` : '';
  };
  showBest();

  // Level buttons (Level 2 stays locked until Level 1 is beaten)
  const story1 = { eyebrow: $('title-eyebrow').textContent!, story: $('title-story').textContent! };
  const story2 = {
    eyebrow: 'Level 2: The Grocery Store',
    story: 'Free at last, the nugget wonders: why am I alive? Maybe the answer is in the grocery store! Sneak past the staff, who want to put you back on the shelf and win Employee of the Month. Find the keys and get into the Manager\'s Office.',
  };
  const syncLevels = () => {
    document.querySelectorAll<HTMLButtonElement>('.levels button').forEach((b) => {
      const id = Number(b.dataset.level) as LevelId;
      b.disabled = id === 2 && !level2Open;
      const on = id === level;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    const st = level === 2 ? story2 : story1;
    $('title-eyebrow').textContent = st.eyebrow;
    $('title-story').textContent = st.story;
  };
  document.querySelectorAll<HTMLButtonElement>('.levels button').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (btn.disabled) return;
      level = Number(btn.dataset.level) as LevelId;
      syncLevels();
      showBest();
      sound.unlock();
      sound.click();
    });
  });
  syncLevels();

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
  const fadeIn = () => {
    const f = $('fade');
    f.hidden = false;
    f.classList.remove('out');
    void f.offsetWidth;
    f.classList.add('out');
    setTimeout(() => (f.hidden = true), 700);
  };

  const cancelNext = () => {
    clearTimeout(nextTimer);
    clearInterval(nextTick);
    $('win-next-note').hidden = true;
  };

  /** Play the level's opening cutscene (dinner, or the walk to the store), then start. */
  function playCutscene() {
    cancelNext();
    sound.unlock();
    sound.click();
    state = createGame(difficulty, { ...opts, level });
    scene.prepare(state);
    scene.reset();
    scene.cutscene.reset();
    scene.street.reset();
    hud.reset();
    lastCaption = '';
    mode = level === 2 ? 'street' : 'cutscene';
    show(null);
    $('hud').hidden = true;
    $('touch').hidden = true;
    $('cutscene').hidden = false;
    $('btn-skip').focus({ preventScroll: true });
  }

  function endCutscene() {
    if (mode === 'bossCutscene') return endBossCutscene();
    if (mode !== 'cutscene' && mode !== 'street') return;
    $('cutscene').hidden = true;
    start(true);
    fadeIn();
  }

  /** Level 1: out the front door, Uncle Gus drops in. Level 2: the Manager's Office security cameras,
   * then the Manager walks in. Then the boss fight starts. */
  function playBossCutscene() {
    scene.bossCut.reset();
    scene.officeCut.reset();
    lastCaption = '';
    mode = 'bossCutscene';
    controls.clear();
    $('hud').hidden = true;
    $('touch').hidden = true;
    $('cutscene').hidden = false;
    $('btn-skip').focus({ preventScroll: true });
  }

  function endBossCutscene() {
    if (mode !== 'bossCutscene') return;
    $('cutscene').hidden = true;
    startBoss();
    fadeIn();
  }

  function startBoss() {
    const before = state.events.length;
    beginBossFight(state);
    for (const e of state.events.splice(before)) onEvent(e);
    controls.clear();
    acc = 0;
    mode = 'game';
    $('hud').hidden = false;
    $('touch').hidden = !isTouch();
  }

  function start(afterCutscene = false) {
    cancelNext();
    sound.unlock();
    setBossUi(false);
    if (!afterCutscene) sound.click();
    // Level 2 always walks in through the doors; Level 1 skips the plate hop after the cutscene.
    state = createGame(difficulty, { ...opts, level, skipIntro: afterCutscene && level === 1 });
    scene.prepare(state);
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
    const first = KEY_INFO[state.level.keyOrder[0]];
    const keyHtml = `<b style="color:${first.hex}">${first.label} key</b>`;
    if (level === 2) hud.toast(`Sneak past the staff and find the ${keyHtml}!`, '', 3200);
    else hud.toast(afterCutscene ? `Run! Find the ${keyHtml} first.` : `Hop off the plate and find the ${keyHtml}!`, '', 3200);
  }

  function toMenu() {
    cancelNext();
    mode = 'menu';
    setBossUi(false);
    $('cutscene').hidden = true;
    sound.stopMusic();
    state = createGame(difficulty, opts);
    scene.reset();
    scene.snapCamera();
    $('hud').hidden = true;
    $('touch').hidden = true;
    showBest();
    syncLevels();
    show('screen-title');
  }

  /** Straight from the Level 1 win screen into Level 2. */
  function playLevel2() {
    level = 2;
    level2Open = true;
    syncLevels();
    playCutscene();
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

  function setBossUi(on: boolean) {
    document.body.classList.toggle('boss', on);
    document.querySelector('#boss-hud .boss-name')!.textContent = bossDef(state).name;
    $('boss-hud').hidden = !on;
    $('fire-btn').hidden = !on;
  }

  // Pause when the tab or app goes to the background (phones lock, calls come in…).
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && mode === 'game') togglePause();
  });
  // iOS Safari: no pinch zoom or double-tap zoom in the middle of a chase.
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = performance.now();
    if (now - lastTouchEnd < 320 && (e.target as HTMLElement).closest('#stage, #touch')) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });

  // Full screen (Android and desktop; iPhone Safari has no full screen API, use Add to Home Screen).
  const fullBtn = $('btn-full');
  const docEl = document.documentElement as HTMLElement & { webkitRequestFullscreen?: () => void };
  if (docEl.requestFullscreen || docEl.webkitRequestFullscreen) {
    fullBtn.hidden = false;
    fullBtn.addEventListener('click', () => {
      if (document.fullscreenElement) void document.exitFullscreen?.();
      else if (docEl.requestFullscreen) void docEl.requestFullscreen({ navigationUI: 'hide' }).catch(() => undefined);
      else docEl.webkitRequestFullscreen?.();
    });
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

  const restart = () => start();
  $('btn-play').addEventListener('click', playCutscene);
  $('btn-skip').addEventListener('click', endCutscene);
  $('btn-resume').addEventListener('click', togglePause);
  $('btn-restart').addEventListener('click', restart);
  $('btn-menu').addEventListener('click', toMenu);
  $('btn-again').addEventListener('click', restart);
  $('btn-retry').addEventListener('click', restart);
  $('btn-win-menu').addEventListener('click', toMenu);
  $('btn-next').addEventListener('click', playLevel2);
  $('btn-over-menu').addEventListener('click', toMenu);
  $('btn-pause').addEventListener('click', togglePause);
  $('btn-sound').addEventListener('click', toggleMute);
  $('btn-hint').addEventListener('click', hint);
  controls.onPause = togglePause;
  controls.onMute = toggleMute;
  controls.onHint = hint;
  const feast = () => {
    if (mode !== 'game') return;
    if (startFeast(state)) for (const e of state.events.splice(0)) onEvent(e);
  };
  controls.onFeast = feast;
  $('feast-btn').addEventListener('click', () => { sound.unlock(); feast(); });
  controls.onAnyKey = () => sound.unlock();
  controls.bindTouch($('stick'), $('stick-knob'), $('dash-btn'));
  controls.bindFire($('fire-btn'));
  controls.bindMouse($('stage'));
  // Secret code for testing: typing "shalevisbest" unlocks Level 2 without beating Level 1.
  // (On phones: tap the game title 5 times to type it in.)
  const CHEAT = 'shalevisbest';
  let typed = '';
  const tryCode = (code: string) => {
    if (code.toLowerCase().replace(/\s+/g, '') !== CHEAT) return false;
    unlockLevel2();
    level2Open = true;
    syncLevels();
    sound.unlock();
    sound.secret();
    const note = $('cheat-note');
    note.textContent = 'Secret code accepted: Level 2 unlocked!';
    note.hidden = false;
    return true;
  };
  window.addEventListener('keydown', (e) => {
    if (e.key.length !== 1) return;
    typed = (typed + e.key.toLowerCase()).slice(-CHEAT.length);
    if (typed === CHEAT) { typed = ''; tryCode(CHEAT); }
  });
  let logoTaps = 0, logoTimer = 0;
  document.querySelector('h1.logo')?.addEventListener('click', () => {
    logoTaps++;
    clearTimeout(logoTimer);
    logoTimer = window.setTimeout(() => (logoTaps = 0), 1500);
    if (logoTaps >= 5) {
      logoTaps = 0;
      const code = window.prompt('Secret code?');
      if (code) tryCode(code);
    }
  });

  window.addEventListener('keydown', (e) => {
    if (mode === 'menu' && e.code === 'Enter') playCutscene();
    else if ((mode === 'cutscene' || mode === 'bossCutscene' || mode === 'street') && (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      endCutscene();
    }
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
      case 'secret': {
        const sd = SECRETS.find((s) => s.id === e.id)!;
        sound.secret();
        const n = state.secrets.size;
        hud.toast(n === SECRETS.length
          ? `<span class="em">${sd.emoji}</span> You found ${sd.name} ${sd.where}! That's every easter egg! Press <b>NUGGET RAIN</b>!`
          : `<span class="em">${sd.emoji}</span> Easter egg! You found ${sd.name} ${sd.where}. (${n}/${SECRETS.length})`, 'secret', 3200);
        break;
      }
      case 'feast':
        sound.feast();
        hud.banner('Nugget rain!');
        hud.toast('Chicken nuggets are falling from the ceiling! The family stopped chasing you to eat them.', 'secret', 3600);
        break;
      case 'feastEnd':
        hud.toast('Snack time is over. Careful, they are hungry for more!', 'danger', 2600);
        break;
      case 'chomp':
        if (e.floor === state.player.floor) sound.chomp();
        break;
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
          ? `<span class="sw" style="background:#f5c518;color:#f5c518"></span>${state.level.id === 2 ? "The Manager's Office is open! Get inside!" : 'The front door is open! Run outside!'}`
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
        const lives = `${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.`;
        if (state.level.shelf) hud.toast(state.lives > 0 ? `${c.def.name} put you back on the shelf! ${lives}` : `${c.def.name} caught you!`, 'danger', 2600);
        else hud.toast(state.lives > 0 ? `${c.def.name} caught you! ${lives}` : `${c.def.name} caught you!`, 'danger', 2400);
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
      case 'bossIntro':
        if (useBot) startBoss();
        else playBossCutscene();
        break;
      case 'bossStart':
        setBossUi(true);
        hud.banner(`${bossDef(state).name}!`);
        if (state.difficulty === 'easy') hud.toast(isTouch() ? `Hold <b>SQUIRT</b>: on Easy the ketchup flies at ${bossDef(state).the} by itself!` : `Hold <b>F</b> or the mouse button: on Easy the ketchup flies at ${bossDef(state).the} by itself!`, '', 4000);
        else hud.toast(isTouch() ? `Turn to face ${bossDef(state).the} and hold <b>SQUIRT</b>!` : `Turn to face ${bossDef(state).the} and hold <b>F</b> or the mouse button to squirt!`, '', 4000);
        break;
      case 'squirt':
        sound.squirt();
        break;
      case 'bossHit':
        sound.splat();
        break;
      case 'throw':
        sound.whoosh();
        break;
      case 'slam':
        sound.thud();
        break;
      case 'stamp':
        sound.thud();
        hud.toast(isTouch() ? '<b>FIRED!</b> Tap <b>DASH</b> to dash through the shock wave!' : '<b>FIRED!</b> Press <b>Space</b> to dash through the shock wave!', 'danger', 1800);
        break;
      case 'dodgeWave':
        sound.refill();
        hud.toast('Nice dash!', '', 900);
        break;
      case 'refill':
        sound.refill();
        hud.toast('Ketchup bottle full!', '', 1400);
        break;
      case 'bottle':
        sound.pop();
        hud.toast('A ketchup bottle appeared! Grab it!', '', 2000);
        break;
      case 'slip':
        sound.whoosh();
        hud.toast('Whoa! Slippery! The splash made some noise...', 'danger', 1800);
        break;
      case 'rush':
        sound.alert();
        hud.toast('A shopper with a cart is charging at you! Dodge!', 'danger', 2000);
        break;
      case 'cartCrash':
        sound.thud();
        break;
      case 'bumped':
        sound.caught();
        hud.toast(state.lives > 0 ? `Ouch! Run over by a shopping cart! ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.` : 'Ouch! Run over by a shopping cart!', 'danger', 2200);
        break;
      case 'hurt':
        sound.caught();
        hud.toast(state.lives > 0 ? `Ouch! ${state.lives} ${state.lives === 1 ? 'life' : 'lives'} left.` : 'Ouch!', 'danger', 1800);
        break;
      case 'bossDown':
        sound.bossDown();
        hud.toast(state.level.id === 2 ? 'The Manager is out cold! The office is yours!' : 'Uncle Gus is out of the game! You\'re free!', '', 3000);
        $('fire-btn').hidden = true;
        break;
      case 'win': {
        sound.win();
        sound.stopMusic();
        mode = 'ended';
        const lv = state.level.id;
        const best = loadBest(state.difficulty, lv);
        const isBest = best === null || state.time < best;
        if (isBest) saveBest(state.difficulty, state.time, lv);
        const stars = Math.max(1, 3 - state.timesCaught);
        const firstWin = lv === 1 && !level2Unlocked();
        if (lv === 1) { unlockLevel2(); level2Open = true; }
        setTimeout(() => {
          if (mode !== 'ended') return;
          $('win-eyebrow').textContent = lv === 2 ? 'Employee of the month? Not today!' : 'Freedom!';
          $('win-title').textContent = lv === 2 ? (state.boss ? 'You beat the Manager!' : "You made it to the Manager's Office!") : 'You escaped!';
          const sub = $('win-sub');
          sub.hidden = lv === 1 && !firstWin;
          sub.textContent = lv === 2
            ? 'A sticky note on the manager\'s desk says: "Why are you alive? To go on adventures, little nugget!"'
            : 'Level 2 unlocked: The Grocery Store!';
          $('win-secrets-box').hidden = !state.level.secrets;
          $('btn-next').hidden = lv !== 1;
          $('win-stars').innerHTML = [0, 1, 2].map((i) => `<span class="s ${i < stars ? 'on' : ''}" style="animation-delay:${0.2 + i * 0.18}s">★</span>`).join('');
          $('win-time').textContent = fmtTime(state.time);
          $('win-spotted').textContent = String(state.timesSpotted);
          $('win-caught').textContent = String(state.timesCaught);
          $('win-secrets').textContent = `${state.secrets.size}/${SECRETS.length}`;
          $('win-best').textContent = isBest ? 'New!' : fmtTime(best!);
          $('touch').hidden = true;
          show('screen-win');
          if (lv === 1) {
            // Level 2 starts by itself after a short countdown (or straight away with the button).
            let left = useBot ? 1 : 8;
            const note = $('win-next-note');
            const tick = () => { note.textContent = `Level 2 starts in ${left}…`; };
            note.hidden = false;
            tick();
            nextTick = window.setInterval(() => { left = Math.max(0, left - 1); tick(); }, 1000);
            nextTimer = window.setTimeout(() => { cancelNext(); if (mode === 'ended') playLevel2(); }, left * 1000);
            $('btn-next').focus({ preventScroll: true });
          }
        }, 1600);
        break;
      }
      case 'gameover': {
        sound.gameOver();
        sound.stopMusic();
        mode = 'ended';
        $('over-text').textContent = state.boss && state.level.id === 2
          ? 'The Manager got you! Keep moving, dodge the pink slips and jump away from the big stomp.'
          : state.boss
          ? 'Uncle Gus got you! Keep moving, dodge the drumsticks and jump away from his belly slam.'
          : state.caughtBy === 'A shopper with a cart'
          ? 'A shopping cart ran you over one time too many. When a shopper shouts "!", step out of the way!'
          : state.level.shelf
          ? `${state.caughtBy ?? 'The staff'} put you back on the shelf for good. Hide under the fruit stands and shopping carts!`
          : `${state.caughtBy ?? 'The family'} caught you one time too many. Try sneaking and hiding under furniture!`;
        $('touch').hidden = true;
        show('screen-over');
        break;
      }
    }
  }

  const caption = $('cutscene-caption');
  const captionWho = $('cutscene-who');
  const captionText = $('cutscene-text');
  const bar = $('cutscene-progress');
  let lastCaption = '';
  function cutsceneFrame(dt: number) {
    const boss = mode === 'bossCutscene';
    const street = mode === 'street';
    const office = boss && state.level.id === 2;
    const cs = office ? scene.officeCut : boss ? scene.bossCut : street ? scene.street : scene.cutscene;
    for (const e of cs.events) {
      if (e === 'gasp') sound.alert();
      else if (e === 'jump') sound.dash();
      else if (e === 'land') sound.step_();
      else if (e === 'bark') sound.lost();
      else if (e === 'pop') sound.click();
      else if (e === 'thud') sound.thud();
      else if (e === 'chomp') sound.step_();
      else if (e === 'squirt') sound.squirt();
    }
    const c = cs.caption;
    const key = c ? c.who + c.text : '';
    if (key !== lastCaption) {
      lastCaption = key;
      caption.hidden = !c;
      if (c) {
        captionWho.textContent = c.who;
        captionWho.hidden = !c.who;
        captionText.textContent = c.text;
        caption.classList.remove('in');
        void caption.offsetWidth;
        caption.classList.add('in');
      }
    }
    bar.style.transform = `scaleX(${cs.t / (office ? OFFICE_INTRO_LENGTH : boss ? BOSS_INTRO_LENGTH : street ? STREET_LENGTH : CUTSCENE_LENGTH)})`;
    $('cutscene').style.setProperty('--fade', String(cs.fade));
    if (cs.done) endCutscene();
    void dt;
  }

  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
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
      sound.intensity = state.boss && state.status === 'boss' ? 1 : state.chasers.some((c) => c.floor === state.player.floor && (c.mode === 'chase' || c.mode === 'alert')) ? 1 : 0;
      scene.render(state, dt, 'game');
      hud.update(state);
    } else if (mode === 'cutscene' || mode === 'bossCutscene' || mode === 'street') {
      scene.render(state, dt * speed, mode === 'cutscene' ? 'cutscene' : mode === 'street' ? 'street' : 'bossIntro');
      cutsceneFrame(dt);
    } else {
      scene.render(state, dt, mode === 'menu' ? 'menu' : 'game');
    }
  };
  requestAnimationFrame(frame);

  // Hooks for automated tests and debugging.
  (window as unknown as { __nugget: unknown }).__nugget = {
    get state() { return state; },
    get mode() { return mode; },
    get cutsceneTime() { return mode === 'bossCutscene' ? (state.level.id === 2 ? scene.officeCut : scene.bossCut).t : mode === 'street' ? scene.street.t : scene.cutscene.t; },
    get level() { return level; },
    /** Pick a level as if from the menu (Level 2 must be unlocked, or ?level=2 used). */
    setLevel: (id: LevelId) => { if (id === 1 || level2Open) { level = id; syncLevels(); } return level; },
    start: () => start(),
    playCutscene,
    skipCutscene: endCutscene,
    seekCutscene: (t: number) => { if (mode === 'bossCutscene') (state.level.id === 2 ? scene.officeCut : scene.bossCut).t = t; else if (mode === 'street') scene.street.t = t; else scene.cutscene.t = t; },
    /** Jump straight to the front door, as if every key had been found. */
    toFrontDoor: () => {
      level = 1;
      if (mode !== 'game' || state.level.id !== 1) start();
      for (const k of state.keys) { state.held.add(k.color); state.unlocked.add(k.color); }
      state.player.floor = 0;
      state.player.pos = { ...ENTRY };
      state.status = 'bossIntro';
      state.boss = makeBoss(state);
      state.shots = [];
      onEvent({ type: 'bossIntro' });
    },
    /** Level 2: jump into the Manager's Office, as if every key had been found. */
    toOffice: () => {
      if (mode !== 'game' || state.level.id !== 2) { level2Open = true; level = 2; syncLevels(); start(); }
      for (const k of state.keys) { k.taken = true; state.held.add(k.color); state.unlocked.add(k.color); }
      state.carts = [];
      state.player.pos = { ...MANAGER.entry };
      state.status = 'bossIntro';
      state.boss = makeBoss(state);
      state.shots = [];
      onEvent({ type: 'bossIntro' });
    },
    toMenu,
  };

  if (params.has('autostart')) start();
  else if (params.has('cutscene')) playCutscene();
}

boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('loading');
  if (l) l.textContent = 'Sorry, this browser could not start the game (WebGL is needed).';
});
