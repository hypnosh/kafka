// Game.jsx — canvas mount, engine initialisation, system orchestration

import { useEffect, useRef, useCallback } from 'react';
import { Engine } from '../game/engine';
import { Kafka } from '../game/kafka';
import { World } from '../game/world';
import { InputManager } from '../game/input';
import { DayNight } from '../game/daynight';
import { BoostManager } from '../game/boosts';
import { useGameStore } from '../game/store';

// Fade-in overlay system (stepped, 8-bit style per PRD)
const FADE_STEPS = [1, 0.87, 0.75, 0.62, 0.50, 0.37, 0.25, 0.12, 0];
const FADE_STEP_MS = 100;

export default function Game() {
  const canvasRef = useRef(null);
  const engineRef = useRef(null);
  const kafkaRef = useRef(null);
  const worldRef = useRef(null);
  const inputRef = useRef(null);
  const dayNightRef = useRef(null);
  const boostsRef = useRef(null);
  const fadeRef = useRef({ step: 0, timer: 0, active: true });
  const scoreRef = useRef({ score: 0, distance: 0, miceCaught: 0, streak: 0, multiplier: 1 });

  const store = useGameStore();
  const { phase, paused } = store;

  const initGame = useCallback((canvas) => {
    const w = canvas.parentElement.clientWidth;
    const h = canvas.parentElement.clientHeight;

    const engine = new Engine(canvas, { getState: () => useGameStore.getState() });
    engine.resize(w, h);

    const dayNight = new DayNight();
    dayNightRef.current = dayNight;
    useGameStore.getState().setNight(dayNight.isNight, dayNight.isGoldenHour);

    const kafka = new Kafka(w, h);
    kafkaRef.current = kafka;

    const world = new World(w, h, dayNight.isNight);
    worldRef.current = world;

    const boosts = new BoostManager(w, h, dayNight.isNight);
    boostsRef.current = boosts;

    const input = new InputManager();
    inputRef.current = input;

    // Register world system
    engine.register({
      update(dt, state) {
        if (state.phase !== 'running') return;
        input.update();
        const currentInput = input.state;

        // Handle pause
        if (currentInput.pause) {
          useGameStore.getState().setPhase('paused');
          return;
        }

        kafka.update(dt, currentInput);
        // kafka.vx is only non-zero when Kafka is at the lock point scrolling the world
        world.update(dt, kafka.vx);
        boosts.update(dt, world.scrollX, kafka);

        // Update score
        const s = scoreRef.current;
        s.distance += kafka.vx * dt;
        s.score = Math.floor(s.distance) * s.multiplier;

        useGameStore.getState().updateRun(
          kafka.energy,
          Math.floor(s.score),
          Math.floor(s.distance),
          s.miceCaught,
          s.streak,
          s.multiplier,
        );

        // Run end
        if (kafka.state === 'slink' && kafka.energy <= 0) {
          useGameStore.getState().endRun('energy');
        }
      },

      render(ctx, alpha, state) {
        const { phase } = state;

        // Always render the world (alive on intro too, per PRD)
        world.render(ctx, dayNight.isNight, dayNight.twilightAlpha);

        // Boosts — rendered above world, below Kafka
        if (phase === 'running' || phase === 'paused') {
          boosts.render(ctx, world.scrollX);
        }

        // Kafka
        if (phase === 'running' || phase === 'paused' || phase === 'intro') {
          kafka.render(ctx);
        }

        // Pause dim
        if (phase === 'paused') {
          ctx.fillStyle = 'rgba(0,0,0,0.5)';
          ctx.fillRect(0, 0, engine.logicalWidth, engine.logicalHeight);
          ctx.font = '24px serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('🐾', engine.logicalWidth / 2, engine.logicalHeight / 2 - 16);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.font = '14px monospace';
          ctx.fillText('paused', engine.logicalWidth / 2, engine.logicalHeight / 2 + 16);
        }

        // Stepped fade-in overlay
        const fade = fadeRef.current;
        if (fade.active) {
          const opacity = FADE_STEPS[Math.min(fade.step, FADE_STEPS.length - 1)];
          if (opacity > 0) {
            ctx.fillStyle = dayNight.isNight
              ? `rgba(10,10,30,${opacity})`
              : `rgba(0,0,0,${opacity})`;
            ctx.fillRect(0, 0, engine.logicalWidth, engine.logicalHeight);
          }
          if (fade.step >= FADE_STEPS.length - 1) {
            fade.active = false;
          }
        }
      },
    });

    engineRef.current = engine;
    engine.start();

    // Drive the stepped fade independently of game loop
    let fadeInterval = setInterval(() => {
      const fade = fadeRef.current;
      if (fade.step < FADE_STEPS.length - 1) {
        fade.step++;
      } else {
        clearInterval(fadeInterval);
        fade.active = false;
        // Transition from intro to running after fade
        if (useGameStore.getState().phase === 'intro') {
          useGameStore.getState().startRun();
        }
      }
    }, FADE_STEP_MS);

    // Handle any-key to start on desktop
    const handleAnyKey = () => {
      if (useGameStore.getState().phase === 'intro') {
        useGameStore.getState().startRun();
      }
    };
    window.addEventListener('keydown', handleAnyKey, { once: true });

    // Resume from pause
    const handleResume = (e) => {
      if (useGameStore.getState().phase === 'paused') {
        useGameStore.getState().setPhase('running');
      }
    };
    window.addEventListener('keydown', handleResume);
    canvas.addEventListener('click', handleResume);

    return () => {
      engine.stop();
      input.destroy();
      window.removeEventListener('keydown', handleResume);
      canvas.removeEventListener('click', handleResume);
      clearInterval(fadeInterval);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const cleanup = initGame(canvas);

    // Handle resize
    const onResize = () => {
      const engine = engineRef.current;
      if (!engine) return;
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      engine.resize(w, h);
      // Use Kafka's resize() method so lock point recalculates correctly
      kafkaRef.current?.resize(w, h);
      if (worldRef.current) {
        worldRef.current.canvasWidth = w;
        worldRef.current.canvasHeight = h;
        worldRef.current.groundY = h - 80;
      }
    };
    window.addEventListener('resize', onResize);

    return () => {
      cleanup?.();
      window.removeEventListener('resize', onResize);
    };
  }, [initGame]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        touchAction: 'none',
      }}
    />
  );
}