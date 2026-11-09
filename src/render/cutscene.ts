/**
 * The opening cutscene: the family is at dinner, Dad is about to eat the nugget,
 * it blinks awake, jumps off his fork and runs. Also poses the title-screen backdrop.
 *
 * Everything here is a pure function of the cutscene clock, so skipping or replaying
 * is just a matter of setting `t`.
 */
import { THREE, canvasTexture, builder, box } from './kit';
import { NuggetModel, PersonModel, DogModel, BossModel, faceAngle } from './characters';
import { bakeBubble } from './paint';
import { START } from '../game/levels';
import { ENTRY } from '../game/boss';

export interface Caption {
  who: string;
  text: string;
}

export type CutEvent = 'gasp' | 'jump' | 'land' | 'bark' | 'pop' | 'thud' | 'squirt' | 'chomp';

export const CUTSCENE_LENGTH = 14.2;
const TABLE_TOP = 0.87;
const PLATE = new THREE.Vector3(START.plate.x, TABLE_TOP + 0.03, START.plate.y);
const MOUTH = new THREE.Vector3(17, 1.47, 2.98);

/** Gameplay camera offset from the nugget (shared with the scene). */
export const CAM_OFFSET = new THREE.Vector3(0, 13.2, 8.6);

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);
/** 0..1 progress of t through [a, b], eased. */
const seg = (t: number, a: number, b: number) => smooth(clamp01((t - a) / (b - a)));
const lerp = (a: number, b: number, k: number) => a + (b - a) * k;

interface Seat {
  model: PersonModel | DogModel;
  x: number;
  z: number;
  facing: number;
  bubble: THREE.Sprite;
}

const CAPTIONS: { a: number; b: number; who: string; text: string }[] = [
  { a: 0.3, b: 3.6, who: '', text: 'Dinner time! Tonight the family is having chicken nuggets.' },
  { a: 3.8, b: 6.3, who: 'Dad', text: 'Mmm… this one looks perfect. Down the hatch!' },
  { a: 6.5, b: 8.3, who: '', text: '…wait. Did that nugget just blink?' },
  { a: 8.4, b: 10.7, who: 'Nugget', text: 'Nope! I am NOT dinner!' },
  { a: 10.8, b: 12.7, who: 'Dad', text: 'Hey! Come back here! Somebody catch that nugget!' },
  { a: 12.8, b: CUTSCENE_LENGTH, who: '', text: 'Find the colored keys and escape the house!' },
];

const EVENTS: { t: number; e: CutEvent }[] = [
  { t: 4.35, e: 'pop' },
  { t: 8.3, e: 'jump' },
  { t: 8.55, e: 'gasp' },
  { t: 9.15, e: 'land' },
  { t: 11.45, e: 'land' },
  { t: 11.7, e: 'bark' },
];

/** Camera keyframes: [time, position, look-at]. */
const SHOTS: [number, [number, number, number], [number, number, number]][] = [
  [0, [23.5, 6.8, 12.5], [17, 0.8, 4.2]],
  [3.5, [19.8, 3.3, 8.4], [17, 1.0, 3.6]],
  [4.4, [17.7, 1.95, 5.6], [17, 1.25, 3.0]],
  [6.2, [17.3, 1.68, 4.3], [17, 1.45, 3.0]],
  [8.1, [17.12, 1.6, 3.95], [17, 1.47, 2.98]],
  [8.6, [19.6, 3.4, 8.6], [17, 0.9, 4.3]],
  [11.0, [18.6, 3.0, 9.6], [16.6, 0.6, 5.8]],
  [12.6, [17.4, 4.2, 10.8], [16.5, 0.3, 6.6]],
  [CUTSCENE_LENGTH, [START.x + CAM_OFFSET.x, CAM_OFFSET.y, START.y + CAM_OFFSET.z], [START.x, 0, START.y]],
];

function forkModel() {
  const b = builder(false, false);
  const steel = '#dfe5ea';
  box(b, -0.015, -0.01, 0, 0.03, 0.02, 0.42, steel, { metal: 0.35, rough: 0.3 });
  box(b, -0.04, -0.01, -0.06, 0.08, 0.02, 0.07, steel, { metal: 0.35, rough: 0.3 });
  for (let i = 0; i < 3; i++) box(b, -0.035 + i * 0.03, -0.008, -0.16, 0.012, 0.016, 0.11, steel, { metal: 0.35, rough: 0.3 });
  return b.group;
}

export class Cutscene {
  readonly group = new THREE.Group();
  readonly nugget = new NuggetModel();
  readonly fork = new THREE.Group();
  private seats: Seat[] = [];
  private dad: PersonModel;
  private bubbleTex = canvasTexture(bakeBubble('!'));
  t = 0;
  /** 0..1 black fade at the very end. */
  fade = 0;
  caption: Caption | null = null;
  events: CutEvent[] = [];

  constructor() {
    this.group.add(this.nugget.root);
    const fork = forkModel();
    fork.rotation.y = Math.PI; // handle toward Dad, tines toward the nugget
    this.fork.add(fork);
    this.group.add(this.fork);
    const people: [PersonModel | DogModel, number, number, number][] = [
      [new PersonModel('dad'), 17, 2.55, Math.PI / 2],
      [new PersonModel('mom'), 15.2, 2.55, Math.PI / 2],
      [new PersonModel('grandma'), 18.8, 2.55, Math.PI / 2],
      [new PersonModel('brother'), 13.55, 4.5, 0],
      [new PersonModel('sister'), 20.45, 4.5, Math.PI],
      [new DogModel(), 19.7, 6.55, -Math.PI / 2 - 0.5],
    ];
    for (const [model, x, z, facing] of people) {
      const bubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.bubbleTex, depthTest: false }));
      bubble.renderOrder = 10;
      bubble.visible = false;
      this.group.add(model.root, bubble);
      this.seats.push({ model, x, z, facing, bubble });
    }
    this.dad = this.seats[0].model as PersonModel;
  }

  reset() {
    this.t = 0;
    this.fade = 0;
    this.caption = null;
    this.events = [];
  }

  get done() {
    return this.t >= CUTSCENE_LENGTH;
  }

  /** Advance the clock and pose everything for the current moment. */
  update(dt: number, camera: THREE.PerspectiveCamera, time: number) {
    const prev = this.t;
    this.t = Math.min(CUTSCENE_LENGTH, this.t + dt);
    const t = this.t;
    this.events = EVENTS.filter((e) => e.t > prev && e.t <= t).map((e) => e.e);
    const cap = CAPTIONS.find((c) => t >= c.a && t < c.b);
    this.caption = cap ? { who: cap.who, text: cap.text } : null;
    this.fade = seg(t, CUTSCENE_LENGTH - 0.6, CUTSCENE_LENGTH);
    this.pose(t, time, dt);
    this.shoot(t, camera);
  }

  /** Title-screen backdrop: everyone at the table, slow sweeping camera. */
  idle(camera: THREE.PerspectiveCamera, time: number, dt: number) {
    this.caption = null;
    this.fade = 0;
    this.pose(Math.min(3, time % 30), time, dt);
    const a = Math.PI / 2 + Math.sin(time * 0.12) * 0.75;
    camera.position.set(17 + Math.cos(a) * 7.5, 4.6, 4.3 + Math.sin(a) * 7.5);
    camera.lookAt(17, 0.9, 4.3);
  }

  private shoot(t: number, camera: THREE.PerspectiveCamera) {
    let i = 0;
    while (i < SHOTS.length - 2 && t >= SHOTS[i + 1][0]) i++;
    const [t0, p0, l0] = SHOTS[i];
    const [t1, p1, l1] = SHOTS[i + 1];
    const k = seg(t, t0, t1);
    camera.position.set(lerp(p0[0], p1[0], k), lerp(p0[1], p1[1], k), lerp(p0[2], p1[2], k));
    camera.lookAt(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k));
  }

  private pose(t: number, time: number, dt: number) {
    const n = this.nugget;
    const startled = seg(t, 8.45, 8.75);
    const stand = seg(t, 10.2, 11.4);
    const nuggetPos = new THREE.Vector3();

    // ------------------------------------------------ the fork and the nugget
    const forkRest = new THREE.Vector3(17.38, TABLE_TOP + 0.03, 3.2);
    const atPlate = PLATE.clone().add(new THREE.Vector3(0, 0.12, -0.05));
    const forkPos = new THREE.Vector3();
    const lift = seg(t, 4.4, 6.0);
    if (t < 3.6) forkPos.copy(forkRest);
    else if (t < 4.35) forkPos.lerpVectors(forkRest, atPlate, seg(t, 3.6, 4.35));
    else forkPos.lerpVectors(atPlate, MOUTH.clone().add(new THREE.Vector3(0, 0.12, 0)), lift);
    // after the jump the fork drops back toward the table
    if (t > 8.3) forkPos.y -= seg(t, 8.3, 9.0) * 0.35;
    this.fork.position.copy(forkPos);
    this.fork.rotation.set(0, 0, 0);
    this.fork.rotation.x = t < 3.6 ? 0 : lerp(0, -0.45, seg(t, 3.6, 4.4));

    let facing = Math.PI / 2;
    let moving = false;
    let phase = time * 8;
    let flip = 0;
    n.mood = 'happy';
    n.awake = 0;
    if (t < 4.35) {
      nuggetPos.copy(PLATE);
    } else if (t < 8.3) {
      // skewered: dangling under the fork tip
      nuggetPos.copy(forkPos).add(new THREE.Vector3(0, -0.36, 0.06));
      const wake = seg(t, 6.6, 6.75);
      const blink = t > 7.0 && t < 7.12 ? 0 : t > 7.35 && t < 7.45 ? 0 : 1;
      n.awake = wake * blink;
      if (t > 7.5) {
        n.mood = 'scared';
        facing = Math.PI / 2 + Math.sin((t - 7.5) * 9) * 0.7 * (1 - seg(t, 8.0, 8.3));
      }
      if (t > 7.9) nuggetPos.x += Math.sin(t * 70) * 0.012;
    } else if (t < 9.15) {
      // jump off the fork with a flip, onto the table
      const k = clamp01((t - 8.3) / 0.85);
      const from = MOUTH.clone().add(new THREE.Vector3(0, -0.24, 0.06));
      const to = new THREE.Vector3(17, TABLE_TOP, 4.3);
      nuggetPos.lerpVectors(from, to, k);
      nuggetPos.y += Math.sin(k * Math.PI) * 0.7;
      n.awake = 1;
      n.mood = 'scared';
      flip = k * Math.PI * 2;
    } else if (t < 11.0) {
      const k = seg(t, 9.3, 11.0);
      nuggetPos.set(lerp(17, 16.55, k), TABLE_TOP, lerp(4.3, 5.85, k));
      n.awake = 1;
      n.mood = 'happy';
      moving = t > 9.3;
      phase = time * 18;
    } else if (t < 11.45) {
      const k = clamp01((t - 11.0) / 0.45);
      nuggetPos.set(16.55 - k * 0.05, lerp(TABLE_TOP, 0, k) + Math.sin(k * Math.PI) * 0.4, lerp(5.85, START.y, k));
      n.awake = 1;
      moving = true;
      phase = time * 18;
    } else {
      // landed: look back at the family, then turn to run
      nuggetPos.set(START.x, 0, START.y);
      n.awake = 1;
      n.mood = 'scared';
      facing = t < 12.4 ? -Math.PI / 2 : Math.PI / 2;
      moving = t > 12.9;
      phase = time * 18;
    }
    n.root.position.copy(nuggetPos);
    n.opacity = 1;
    n.animate(facing, moving, phase, dt);
    if (flip) n.inner.rotation.x = flip;

    // ------------------------------------------------ family
    const look = (s: Seat, x: number, z: number) => Math.atan2(z - s.z, x - s.x);
    for (const s of this.seats) {
      const m = s.model;
      m.root.position.set(s.x, 0, s.z);
      let facingNow = s.facing;
      if (t > 8.5) {
        const target = look(s, nuggetPos.x, nuggetPos.z);
        let d = target - s.facing;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        facingNow = s.facing + d * seg(t, 8.5, 9.3);
      }
      m.root.rotation.y = faceAngle(facingNow);
      if (m instanceof PersonModel) {
        m.sit = 1 - stand;
        m.talk = t < 3.6 && (m.kind === 'mom' || m.kind === 'grandma' || m.kind === 'sister') ? 1 : 0;
        if (m === this.dad) {
          const raise = t < 3.6 ? 0 : t < 8.3 ? seg(t, 3.6, 4.4) * 0.6 + lift * 0.7 : 1.3 * (1 - seg(t, 8.3, 9));
          m.armPose = { l: -0.3, r: -raise - 0.3 };
          m.mouthOpen = seg(t, 5.4, 6.2) * (1 - seg(t, 8.6, 9.0));
          if (t > 10.8 && t < 12.7) m.talk = 1;
          if (stand > 0) m.armPose = { l: -0.3 - stand * 1.2, r: -0.3 - stand * 1.2 };
        } else {
          const up = startled * (1 - stand * 0.5);
          m.armPose = { l: -0.35 - up * 2.2, r: -0.35 - up * 2.2 };
        }
        m.body.rotation.x = -startled * 0.25 * (1 - stand);
        m.animate(null, false, time * 4 + s.x, dt);
        m.body.rotation.x = -startled * 0.25 * (1 - stand);
      } else {
        const dog = m as DogModel;
        dog.sit = 1 - seg(t, 9.3, 9.8);
        dog.excited = t > 8.5 ? 1 : 0.3;
        dog.animate(null, false, 0, dt, time);
      }
      // "!" bubbles above everyone once the nugget comes alive
      const pop = clamp01((t - 8.55) * 5);
      s.bubble.visible = t > 8.55 && t < 11.8;
      const sc = 0.42 * (pop < 1 ? 0.5 + Math.sin(pop * Math.PI * 0.75) * 0.7 : 1);
      s.bubble.scale.set(sc * 0.9, sc, 1);
      const headY = m instanceof PersonModel ? m.height - (1 - stand) * 0.35 + 0.35 : 1.1;
      s.bubble.position.set(s.x, headY + Math.sin(time * 6 + s.x) * 0.03, s.z);
    }
  }
}

// ---------------------------------------------------------------- front door: Uncle Gus

export const BOSS_INTRO_LENGTH = 9.6;
const GUS_SPOT = { x: 15, y: 26.4 };
/** Where the boss-fight camera looks at the start of the fight. */
export const BOSS_CAM_TARGET = { x: (ENTRY.x + GUS_SPOT.x) / 2, y: (ENTRY.y + GUS_SPOT.y) / 2 };

const BOSS_CAPTIONS: { a: number; b: number; who: string; text: string }[] = [
  { a: 0.2, b: 1.7, who: '', text: 'Out the front door… freedom at last!' },
  { a: 2.8, b: 5.2, who: 'Uncle Gus', text: 'Mmm-mm! Nothing beats a big bucket of fried chicken…' },
  { a: 5.3, b: 6.9, who: 'Uncle Gus', text: '…but a crispy little nugget for dessert? Don’t mind if I do!' },
  { a: 7.0, b: 8.5, who: 'Nugget', text: 'Not today, mister! Say hello to my KETCHUP!' },
  { a: 8.6, b: BOSS_INTRO_LENGTH, who: 'Boss fight', text: 'Squirt ketchup at Uncle Gus and dodge his drumsticks!' },
];

const BOSS_EVENTS: { t: number; e: CutEvent }[] = [
  { t: 1.6, e: 'jump' },
  { t: 2.6, e: 'thud' },
  { t: 3.5, e: 'chomp' },
  { t: 4.5, e: 'chomp' },
  { t: 5.35, e: 'gasp' },
  { t: 7.3, e: 'pop' },
  { t: 8.0, e: 'squirt' },
  { t: 8.15, e: 'squirt' },
];

const BOSS_SHOTS: [number, [number, number, number], [number, number, number]][] = [
  [0, [15.2, 3.4, 28.5], [15, 1.0, 21.6]],
  [1.5, [9.6, 3.6, 23.4], [17.5, 3.2, 26.6]],
  [2.9, [16.9, 2.0, 22.5], [15, 1.7, 26.2]],
  [5.2, [16.3, 1.75, 22.6], [15, 1.7, 26.4]],
  [6.9, [15.5, 0.75, 24.7], [15, 0.4, 23.3]],
  [8.4, [15.9, 0.9, 25.0], [15, 0.45, 23.3]],
  [BOSS_INTRO_LENGTH, [BOSS_CAM_TARGET.x + CAM_OFFSET.x, CAM_OFFSET.y, BOSS_CAM_TARGET.y + CAM_OFFSET.z], [BOSS_CAM_TARGET.x, 0, BOSS_CAM_TARGET.y]],
];

/**
 * The nugget runs out of the front door and Uncle Gus drops in, munching fried chicken.
 * Poses the scene's own nugget and boss models.
 */
export class BossCutscene {
  t = 0;
  fade = 0;
  caption: Caption | null = null;
  events: CutEvent[] = [];

  reset() {
    this.t = 0;
    this.caption = null;
    this.events = [];
  }

  get done() {
    return this.t >= BOSS_INTRO_LENGTH;
  }

  update(dt: number, camera: THREE.PerspectiveCamera, time: number, n: NuggetModel, gus: BossModel) {
    const prev = this.t;
    this.t = Math.min(BOSS_INTRO_LENGTH, this.t + dt);
    const t = this.t;
    this.events = BOSS_EVENTS.filter((e) => e.t > prev && e.t <= t).map((e) => e.e);
    const cap = BOSS_CAPTIONS.find((c) => t >= c.a && t < c.b);
    this.caption = cap ? { who: cap.who, text: cap.text } : null;

    // the nugget: runs out, freezes, then pulls out the ketchup
    const run = seg(t, 0, 1.4);
    n.root.position.set(ENTRY.x, 0, lerp(21.2, ENTRY.y, run));
    n.root.scale.setScalar(1);
    n.awake = 1;
    n.opacity = 1;
    n.mood = t > 2.6 && t < 7.0 ? 'scared' : 'happy';
    n.bottleOut = seg(t, 7.0, 7.4);
    if (this.events.includes('squirt')) n.recoil = 1;
    const shiver = t > 5.3 && t < 7.0 ? Math.sin(t * 60) * 0.015 : 0;
    n.animate(Math.PI / 2, t < 1.4, time * 18, dt);
    n.inner.position.x = shiver;
    if (t > 2.6 && t < 2.9) n.inner.position.y = Math.sin(((t - 2.6) / 0.3) * Math.PI) * 0.25; // jolted by the thud

    // Uncle Gus: drops in from the side with a big jump
    const jump = clamp01((t - 1.6) / 1.0);
    const from = { x: 22.5, y: 27.5 };
    if (t < 1.6) gus.root.position.set(from.x, 0, from.y);
    else {
      gus.root.position.set(lerp(from.x, GUS_SPOT.x, jump), Math.sin(jump * Math.PI) * 2.4, lerp(from.y, GUS_SPOT.y, jump));
    }
    gus.root.visible = t > 1.4;
    gus.crouch = t > 2.6 && t < 3.0 ? 1 - (t - 2.6) / 0.4 : t > 1.45 && t < 1.6 ? 1 : 0;
    gus.windup = 0;
    gus.fallen = 0;
    gus.flash = 0;
    // two big bites of fried chicken
    gus.eat = t > 3.0 && t < 3.6 ? (t - 3.0) / 0.6 : t > 4.0 && t < 4.6 ? (t - 4.0) / 0.6 : 0;
    gus.chew = t > 3.4 && t < 5.2 ? 1 : 0;
    const look = t < 5.3 ? -1.0 : -Math.PI / 2; // eating with a 3/4 turn to the camera, then glares at the nugget
    gus.animate(t < 2.6 ? Math.atan2(GUS_SPOT.y - from.y, GUS_SPOT.x - from.x) : look, false, 0, dt, time);

    // camera
    let i = 0;
    while (i < BOSS_SHOTS.length - 2 && t >= BOSS_SHOTS[i + 1][0]) i++;
    const [t0, p0, l0] = BOSS_SHOTS[i];
    const [t1, p1, l1] = BOSS_SHOTS[i + 1];
    const k = seg(t, t0, t1);
    const shake = t > 2.6 && t < 3.0 ? (3.0 - t) * 0.3 : 0;
    camera.position.set(lerp(p0[0], p1[0], k) + (Math.random() - 0.5) * shake, lerp(p0[1], p1[1], k) + (Math.random() - 0.5) * shake, lerp(p0[2], p1[2], k));
    camera.lookAt(lerp(l0[0], l1[0], k), lerp(l0[1], l1[1], k), lerp(l0[2], l1[2], k));
  }
}
