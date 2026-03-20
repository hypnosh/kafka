// engine.js — game loop, delta time, state machine

const FIXED_TIMESTEP = 1000 / 60; // 60fps target

export class Engine {
  constructor(canvas, store) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.store = store;
    this.running = false;
    this.lastTime = 0;
    this.accumulator = 0;
    this.rafId = null;

    // Subsystems registered by Game.jsx
    this.systems = [];
  }

  register(system) {
    this.systems.push(system);
  }

  start() {
    this.running = true;
    this.lastTime = performance.now();
    this.rafId = requestAnimationFrame(this._loop.bind(this));
  }

  stop() {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
  }

  _loop(timestamp) {
    if (!this.running) return;

    const delta = Math.min(timestamp - this.lastTime, 50); // cap at 50ms to avoid spiral
    this.lastTime = timestamp;
    this.accumulator += delta;

    const state = this.store.getState();

    // Fixed timestep updates
    while (this.accumulator >= FIXED_TIMESTEP) {
      if (!state.paused) {
        for (const system of this.systems) {
          if (system.update) system.update(FIXED_TIMESTEP / 1000, state);
        }
      }
      this.accumulator -= FIXED_TIMESTEP;
    }

    // Render every frame (interpolation alpha available if needed)
    const alpha = this.accumulator / FIXED_TIMESTEP;
    this._render(alpha, state);

    this.rafId = requestAnimationFrame(this._loop.bind(this));
  }

  _render(alpha, state) {
    const { width, height } = this.canvas;
    this.ctx.clearRect(0, 0, width, height);

    for (const system of this.systems) {
      if (system.render) system.render(this.ctx, alpha, state);
    }
  }

  resize(width, height) {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.scale(dpr, dpr);
    // Store logical dimensions
    this.logicalWidth = width;
    this.logicalHeight = height;
  }
}
