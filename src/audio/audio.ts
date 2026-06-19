/**
 * Original snake.io-style audio via the Web Audio API. Every sound is synthesized — no
 * third-party or copyrighted assets. The audio context is created lazily.
 * NOTE: callers must invoke resume() from within a user gesture before sound will play
 * (browser autoplay policy).
 */
export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted: boolean;

  private musicTimer: number | null = null;
  private nextNoteTime = 0;
  private noteIndex = 0;

  private boosting = false;
  private boostSrc: AudioBufferSourceNode | null = null;
  private boostGain: GainNode | null = null;

  // An original, cheerful groove (~120 BPM): a 16-step eighth-note melody over a bassline,
  // in the spirit of snake.io's upbeat, bass-driven loop. Frequencies in Hz.
  private readonly melody = [523, 659, 784, 659, 440, 523, 659, 523, 587, 698, 880, 698, 392, 494, 587, 494];
  private readonly bass = [131, 110, 147, 98]; // C3, A2, D3, G2 — one per beat (every 4 steps)
  private readonly stepDur = 0.24;

  constructor(muted = false) {
    this.muted = muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  /** Create/resume the audio context. Safe to call repeatedly; call it from a tap/click. */
  resume(): void {
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master) this.master.gain.value = this.muted ? 0 : 0.5;
    return this.muted;
  }

  private blip(freq: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  /** A mono white-noise buffer of the given length. */
  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const buf = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * seconds)), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  playEat(): void {
    this.blip(480, 0.08, 'square', 0.2);
  }

  playPowerup(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = 600 + i * 200;
      g.gain.setValueAtTime(0.15, t + i * 0.06);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.06 + 0.15);
      osc.connect(g);
      g.connect(this.master!);
      osc.start(t + i * 0.06);
      osc.stop(t + i * 0.06 + 0.15);
    }
  }

  playPowerupExpire(): void {
    this.blip(300, 0.15, 'sine', 0.12);
  }

  playEatBig(): void {
    // dead-snake body pellet: a fuller, lower downward "chomp" — distinct from the pop
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.12);
    g.gain.setValueAtTime(0.28, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.13);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.13);
  }

  playDie(): void {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    // low descending boom
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.6);
    g.gain.setValueAtTime(0.4, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.6);
    // explosion noise burst, sweeping down through a lowpass
    const src = this.ctx.createBufferSource();
    src.buffer = this.makeNoise(0.4);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(1400, t);
    lp.frequency.exponentialRampToValueAtTime(140, t + 0.4);
    const ng = this.ctx.createGain();
    ng.gain.setValueAtTime(0.3, t);
    ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.4);
    src.connect(lp);
    lp.connect(ng);
    ng.connect(this.master);
    src.start(t);
    src.stop(t + 0.4);
  }

  playKing(): void {
    [523, 659, 784, 1047].forEach((f, i) => {
      window.setTimeout(() => this.blip(f, 0.16, 'triangle', 0.3), i * 90);
    });
  }

  /** Start/stop a low boost rumble while the player is boosting. */
  setBoosting(on: boolean): void {
    if (on === this.boosting) return;
    this.boosting = on;
    if (!this.ctx || !this.master) return;
    if (on) {
      // broadband "whoosh": looping white noise through a bandpass, faded in
      const src = this.ctx.createBufferSource();
      src.buffer = this.makeNoise(1);
      src.loop = true;
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.7;
      const g = this.ctx.createGain();
      const t = this.ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.09, t + 0.05);
      src.connect(bp);
      bp.connect(g);
      g.connect(this.master);
      src.start();
      this.boostSrc = src;
      this.boostGain = g;
    } else if (this.boostSrc) {
      const t = this.ctx.currentTime;
      this.boostGain?.gain.cancelScheduledValues(t);
      this.boostGain?.gain.setValueAtTime(this.boostGain?.gain.value ?? 0.09, t);
      this.boostGain?.gain.linearRampToValueAtTime(0.0001, t + 0.08);
      this.boostSrc.stop(t + 0.1);
      this.boostSrc = null;
      this.boostGain = null;
    }
  }

  private scheduleTone(freq: number, t: number, dur: number, type: OscillatorType, vol: number): void {
    if (!this.ctx || !this.master) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + dur);
  }

  startMusic(): void {
    if (!this.ctx || !this.master || this.musicTimer !== null) return;
    this.nextNoteTime = this.ctx.currentTime;
    this.noteIndex = 0;
    const schedule = () => {
      if (!this.ctx || !this.master) return;
      while (this.nextNoteTime < this.ctx.currentTime + 0.25) {
        const step = this.noteIndex % this.melody.length;
        const t = this.nextNoteTime;
        this.scheduleTone(this.melody[step], t, this.stepDur * 0.85, 'triangle', 0.055);
        if (step % 4 === 0) {
          this.scheduleTone(this.bass[(step / 4) % this.bass.length], t, this.stepDur * 3.6, 'square', 0.05);
        }
        this.nextNoteTime += this.stepDur;
        this.noteIndex++;
      }
      this.musicTimer = window.setTimeout(schedule, 60);
    };
    schedule();
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearTimeout(this.musicTimer);
      this.musicTimer = null;
    }
  }
}
