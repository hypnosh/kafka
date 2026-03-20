// store.js — Zustand shared state between canvas loop and React HUD

import { create } from 'zustand';

export const useGameStore = create((set, get) => ({
  // Game phase
  phase: 'intro',  // 'intro' | 'running' | 'paused' | 'summary' | 'locked'
  paused: false,

  // Run state
  energy: 1.0,
  lives: 3,
  score: 0,
  distance: 0,
  miceCaught: 0,
  streak: 0,
  multiplier: 1,

  // Lifetime
  lifetimeScore: parseInt(localStorage.getItem('lifetimeScore') || '0'),
  highScore: parseInt(localStorage.getItem('highScore') || '0'),

  // Day/night
  isNight: false,
  isGoldenHour: false,

  // HUD flash (lucky bell etc)
  belActive: false,

  // Run summary data
  lastRun: null,

  // Actions
  setPhase: (phase) => set({ phase, paused: phase === 'paused' }),

  updateRun: (energy, score, distance, miceCaught, streak, multiplier) =>
    set({ energy, score, distance, miceCaught, streak, multiplier }),

  setNight: (isNight, isGoldenHour) => set({ isNight, isGoldenHour }),

  endRun: (cause) => {
    const s = get();
    const lifetime = s.lifetimeScore + s.score;
    const high = Math.max(s.highScore, s.score);
    localStorage.setItem('lifetimeScore', lifetime);
    localStorage.setItem('highScore', high);
    set({
      lifetimeScore: lifetime,
      highScore: high,
      phase: 'summary',
      lastRun: {
        score: s.score,
        distance: s.distance,
        miceCaught: s.miceCaught,
        cause,
        isNight: s.isNight,
      },
    });
  },

  startRun: () => set({
    phase: 'running',
    paused: false,
    energy: 1.0,
    score: 0,
    distance: 0,
    miceCaught: 0,
    streak: 0,
    multiplier: 1,
  }),
}));
