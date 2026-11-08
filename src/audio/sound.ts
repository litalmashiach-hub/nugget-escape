/**
 * All sound is synthesized live with the Web Audio API: no audio files to load.
 * A gentle "sneaky" music loop plays during the game and speeds up during chases.
 */
type Wave = OscillatorType;

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  private nextTime = 0;
  muted = false;
  intensity = 0; // 0 calm, 1 chase

  /** Must be called from a user gesture (click / key press). */
  unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.8;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.22;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.6;
      this.sfxGain.connect(this.master);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  setMuted(m: boolean) {
    this.muted = m;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, dur: number, opts: { type?: Wave; vol?: number; at?: number; slide?: number; out?: GainNode | null; attack?: number } = {}) {
    if (!this.ctx) return;
    const t = opts.at ?? this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = opts.type ?? 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (opts.slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq * opts.slide), t + dur);
    const vol = opts.vol ?? 0.3;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + (opts.attack ?? 0.01));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g);
    g.connect(opts.out ?? this.sfxGain!);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  private noise(dur: number, vol = 0.2, freq = 1200, at?: number) {
    if (!this.ctx) return;
    const t = at ?? this.ctx.currentTime;
    const len = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(this.sfxGain!);
    src.start(t);
  }

  key() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [784, 988, 1175, 1568].forEach((f, i) => this.tone(f, 0.25, { type: 'triangle', vol: 0.25, at: t + i * 0.07 }));
    [1568, 2093].forEach((f, i) => this.tone(f, 0.4, { type: 'sine', vol: 0.12, at: t + 0.3 + i * 0.08 }));
  }
  unlock_() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(0.06, 0.4, 3000, t);
    this.tone(220, 0.08, { type: 'square', vol: 0.12, at: t + 0.03 });
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.35, { type: 'triangle', vol: 0.22, at: t + 0.12 + i * 0.06 }));
    this.noise(0.5, 0.08, 500, t + 0.15); // creak
  }
  locked() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(0.05, 0.4, 900, t);
    this.noise(0.05, 0.4, 900, t + 0.09);
    this.tone(140, 0.15, { type: 'square', vol: 0.08, at: t });
  }
  alert() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.tone(660, 0.12, { type: 'square', vol: 0.12, at: t });
    this.tone(990, 0.2, { type: 'square', vol: 0.12, at: t + 0.1 });
  }
  lost() {
    this.tone(500, 0.3, { type: 'triangle', vol: 0.12, slide: 0.6 });
  }
  dash() {
    this.noise(0.18, 0.25, 2200);
    this.tone(300, 0.15, { type: 'sine', vol: 0.1, slide: 2.2 });
  }
  step_() {
    this.noise(0.03, 0.05, 1800 + Math.random() * 600);
  }
  stairs() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 5; i++) this.noise(0.05, 0.18, 700 + i * 120, t + i * 0.08);
    this.tone(392, 0.4, { type: 'triangle', vol: 0.12, at: t + 0.35, slide: 1.5 });
  }
  caught() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.noise(0.12, 0.5, 600, t); // chomp
    this.noise(0.12, 0.5, 500, t + 0.18);
    [523, 440, 349, 262].forEach((f, i) => this.tone(f, 0.3, { type: 'triangle', vol: 0.2, at: t + 0.35 + i * 0.15 }));
  }
  win() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const notes = [523, 659, 784, 1047, 784, 1047, 1319];
    notes.forEach((f, i) => this.tone(f, 0.4, { type: 'triangle', vol: 0.22, at: t + i * 0.12 }));
    [262, 330, 392].forEach((f) => this.tone(f, 1.6, { type: 'sine', vol: 0.12, at: t + 0.84, attack: 0.05 }));
  }
  gameOver() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    [392, 370, 349, 330].forEach((f, i) => this.tone(f, 0.45, { type: 'triangle', vol: 0.2, at: t + i * 0.3, slide: 0.98 }));
  }
  click() {
    this.tone(880, 0.06, { type: 'triangle', vol: 0.15 });
  }

  // ---- music: a tiptoe bass line + pizzicato melody, scheduled ahead of time
  startMusic() {
    if (!this.ctx || this.musicTimer !== null) return;
    this.nextTime = this.ctx.currentTime + 0.1;
    this.step = 0;
    this.musicTimer = window.setInterval(() => this.schedule(), 50);
  }
  stopMusic() {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
  }
  private schedule() {
    if (!this.ctx) return;
    const bass = [110, 0, 165, 0, 131, 0, 165, 0, 98, 0, 147, 0, 123, 0, 147, 0];
    const mel = [440, 0, 523, 494, 0, 440, 392, 0, 349, 0, 392, 440, 0, 0, 330, 0, 440, 0, 523, 587, 0, 659, 587, 0, 523, 0, 494, 440, 0, 392, 0, 0];
    while (this.nextTime < this.ctx.currentTime + 0.2) {
      const tempo = 0.2 - this.intensity * 0.065;
      const i = this.step;
      const b = bass[i % bass.length];
      if (b) this.tone(b, 0.18, { type: 'triangle', vol: 0.35, at: this.nextTime, out: this.musicGain });
      const m = mel[i % mel.length];
      if (m) this.tone(m * (this.intensity > 0.5 ? 1.0 : 1), 0.12, { type: 'sine', vol: 0.16, at: this.nextTime, out: this.musicGain });
      if (this.intensity > 0.5 && i % 2 === 0) this.tone(55 * 4, 0.05, { type: 'square', vol: 0.05, at: this.nextTime, out: this.musicGain });
      this.nextTime += tempo;
      this.step++;
    }
  }
}
