// sound.js — Web Audio API, procedural only, no external files

class SoundManager {
  constructor() {
    this._ctx = null;
    this._muted = localStorage.getItem('muteSounds') === 'true';
    this._walkTime = 0;
    this._walkInterval = 0.22; // seconds between step pads
  }

  _getCtx() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume if suspended (browser autoplay policy)
    if (this._ctx.state === 'suspended') this._ctx.resume();
    return this._ctx;
  }

  _play(fn) {
    if (this._muted) return;
    try { fn(this._getCtx()); } catch (e) { /* ignore */ }
  }

  // ── Public API ──────────────────────────────────────────────

  walk(dt) {
    this._walkTime -= dt;
    if (this._walkTime > 0) return;
    this._walkTime = this._walkInterval;
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(180, ctx.currentTime);
      g.gain.setValueAtTime(0.08, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.08);
      o.start(); o.stop(ctx.currentTime + 0.08);
    });
  }

  run(dt) {
    this._walkTime -= dt;
    if (this._walkTime > 0) return;
    this._walkTime = this._walkInterval * 0.6;
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(220, ctx.currentTime);
      g.gain.setValueAtTime(0.1, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
      o.start(); o.stop(ctx.currentTime + 0.06);
    });
  }

  jump() {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(300, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(520, ctx.currentTime + 0.12);
      g.gain.setValueAtTime(0.18, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);
      o.start(); o.stop(ctx.currentTime + 0.18);
    });
  }

  land() {
    this._play(ctx => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(120, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(60, ctx.currentTime + 0.1);
      g.gain.setValueAtTime(0.2, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.1);
      o.start(); o.stop(ctx.currentTime + 0.1);
    });
  }

  boost() {
    this._play(ctx => {
      const t = ctx.currentTime;
      [0, 0.07, 0.14].forEach((delay, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime([440, 550, 660][i], t + delay);
        g.gain.setValueAtTime(0.15, t + delay);
        g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.12);
        o.start(t + delay); o.stop(t + delay + 0.12);
      });
    });
  }

  hit() {
    this._play(ctx => {
      const t = ctx.currentTime;
      // Low thud
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(80, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
      o.start(t); o.stop(t + 0.15);
      // Dissonant buzz
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.type = 'square';
      o2.frequency.setValueAtTime(160, t);
      g2.gain.setValueAtTime(0.1, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
      o2.start(t); o2.stop(t + 0.08);
    });
  }

  stomp() {
    this._play(ctx => {
      const t = ctx.currentTime;
      // Satisfying pop
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.type = 'sine';
      o.frequency.setValueAtTime(600, t);
      o.frequency.exponentialRampToValueAtTime(200, t + 0.12);
      g.gain.setValueAtTime(0.25, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
      o.start(t); o.stop(t + 0.12);
      // High tick
      const o2 = ctx.createOscillator();
      const g2 = ctx.createGain();
      o2.connect(g2); g2.connect(ctx.destination);
      o2.type = 'square';
      o2.frequency.setValueAtTime(900, t);
      g2.gain.setValueAtTime(0.12, t);
      g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
      o2.start(t); o2.stop(t + 0.05);
    });
  }

  lifeFlash() {
    this._play(ctx => {
      const t = ctx.currentTime;
      // Descending two-note
      [400, 260].forEach((freq, i) => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.type = 'sine';
        o.frequency.setValueAtTime(freq, t + i * 0.1);
        g.gain.setValueAtTime(0.15, t + i * 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.1);
        o.start(t + i * 0.1); o.stop(t + i * 0.1 + 0.1);
      });
    });
  }

  setMuted(muted) {
    this._muted = muted;
    localStorage.setItem('muteSounds', muted);
  }

  isMuted() { return this._muted; }
}

export const sound = new SoundManager();