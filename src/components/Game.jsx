// Game.jsx — canvas mount, engine initialisation, system orchestration

import { useEffect, useRef, useCallback } from 'react';
import { Engine } from '../game/engine';
import { Kafka } from '../game/kafka';
import { World } from '../game/world';
import { InputManager } from '../game/input';
import { DayNight } from '../game/daynight';
import { BoostManager } from '../game/boosts';
import { EnemyManager } from '../game/enemies';
import { sound } from '../game/sound';
import { useGameStore } from '../game/store';

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
  const enemiesRef = useRef(null);
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

    const enemies = new EnemyManager(w, h);
    enemiesRef.current = enemies;

    const input = new InputManager();
    inputRef.current = input;

    // Track previous kafka state for sound triggers
    let prevKafkaState = kafka.state;
    let wasOnGround = kafka.onGround;

    engine.register({
      update(dt, state) {
        if (state.phase !== 'running') return;
        input.update();
        const currentInput = input.state;

        if (currentInput.pause) {
          useGameStore.getState().setPhase('paused');
          return;
        }

        const prevState = kafka.state;
        const wasGrounded = kafka.onGround;

        kafka.update(dt, currentInput);
        world.update(dt, kafka.vx);
        const boostEvents = boosts.update(dt, world.scrollX, kafka);
        enemies.update(dt, world.scrollX, kafka);

        // ── Sound triggers ──
        if (kafka.state === 'run') sound.run(dt);
        else if (kafka.state === 'walk') sound.walk(dt);

        // Jump — fired on transition to airborne
        if (prevState !== 'airborne' && kafka.state === 'airborne') sound.jump();

        // Land — fired on transition from airborne to ground
        if (!wasGrounded && kafka.onGround) sound.land();

        // Hit — fired when takeDamage lands (invincibleTimer just set to 3.0)
        if (prevState !== 'hit' && kafka.state === 'hit') sound.hit();

        // Boost collect
        for (const ev of boostEvents) {
          sound.boost();
        }

        // ── Score ──
        const s = scoreRef.current;
        s.distance += kafka.vx * dt;
        s.score = Math.floor(s.distance) * s.multiplier;
        for (const ev of boostEvents) {
          s.score += ev.points * s.multiplier;
        }

        useGameStore.getState().updateRun(
          kafka.energy,
          Math.floor(s.score),
          Math.floor(s.distance),
          s.miceCaught,
          s.streak,
          s.multiplier,
        );

        // ── Life deduction ──
        if (kafka.hitTimer > 0 && kafka._lifeDeducted !== true) {
          kafka._lifeDeducted = true;
          const gameOver = useGameStore.getState().loseLife();
          if (gameOver) {
            useGameStore.getState().endRun('lives');
          }
        }
        if (kafka.hitTimer <= 0) {
          kafka._lifeDeducted = false;
        }

        // ── Run end: energy zero ──
        if (kafka.state === 'slink' && kafka.energy <= 0) {
          useGameStore.getState().endRun('energy');
        }
      },

      render(ctx, alpha, state) {
        const { phase } = state;

        world.render(ctx, dayNight.isNight, dayNight.twilightAlpha);

        if (phase === 'running' || phase === 'paused') {
          boosts.render(ctx, world.scrollX);
          enemies.render(ctx);
        }

        if (phase === 'running' || phase === 'paused' || phase === 'intro') {
          kafka.render(ctx);
        }

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

        const fade = fadeRef.current;
        if (fade.active) {
          const opacity = FADE_STEPS[Math.min(fade.step, FADE_STEPS.length - 1)];
          if (opacity > 0) {
            ctx.fillStyle = dayNight.isNight
              ? `rgba(10,10,30,${opacity})`
              : `rgba(0,0,0,${opacity})`;
            ctx.fillRect(0, 0, engine.logicalWidth, engine.logicalHeight);
          }
          if (fade.step >= FADE_STEPS.length - 1) fade.active = false;
        }
      },
    });

    engineRef.current = engine;
    engine.start();

    let fadeInterval = setInterval(() => {
      const fade = fadeRef.current;
      if (fade.step < FADE_STEPS.length - 1) {
        fade.step++;
      } else {
        clearInterval(fadeInterval);
        fade.active = false;
        if (useGameStore.getState().phase === 'intro') {
          useGameStore.getState().startRun();
        }
      }
    }, FADE_STEP_MS);

    const handleAnyKey = () => {
      if (useGameStore.getState().phase === 'intro') {
        useGameStore.getState().startRun();
      }
    };
    window.addEventListener('keydown', handleAnyKey, { once: true });

    const handleResume = () => {
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

    const onResize = () => {
      const engine = engineRef.current;
      if (!engine) return;
      const w = canvas.parentElement.clientWidth;
      const h = canvas.parentElement.clientHeight;
      engine.resize(w, h);
      enemiesRef.current?.resize(w, h);
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