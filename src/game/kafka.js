// kafka.js — player character, state machine, abilities, animation

export const KAFKA_STATES = {
  IDLE: 'idle',
  WALK: 'walk',
  RUN: 'run',
  JUMP_CHARGE: 'jump_charge',
  AIRBORNE: 'airborne',
  LANDING: 'landing',
  CROUCH: 'crouch',
  CLING: 'cling',
  SCRATCH: 'scratch',
  POUNCE: 'pounce',
  HISS: 'hiss',
  HIT: 'hit',
  LOW_ENERGY: 'low_energy',
  SLINK: 'slink',
};

// Emoji for each state
const STATE_EMOJI = {
  [KAFKA_STATES.IDLE]: ['🐱', '🐱', '🐱', '😺'],
  [KAFKA_STATES.WALK]: ['🐱', '🐈'],
  [KAFKA_STATES.RUN]: ['🐈'],
  [KAFKA_STATES.JUMP_CHARGE]: ['🐱'],
  [KAFKA_STATES.AIRBORNE]: ['🙀'],
  [KAFKA_STATES.LANDING]: ['🐱'],
  [KAFKA_STATES.CROUCH]: ['🐈‍⬛'],
  [KAFKA_STATES.CLING]: ['🐈'],
  [KAFKA_STATES.SCRATCH]: ['🐱'],
  [KAFKA_STATES.POUNCE]: ['🐈'],
  [KAFKA_STATES.HISS]: ['😾'],
  [KAFKA_STATES.HIT]: ['🙀'],
  [KAFKA_STATES.LOW_ENERGY]: ['😿'],
  [KAFKA_STATES.SLINK]: ['🐈'],
};

const IDLE_ANIMATIONS = [
  { name: 'slow_blink', frames: ['🐱', '😺', '🐱'], duration: 1.5, weight: 10, minIdle: 2 },
  { name: 'paw_lick',   frames: ['🐱', '🐾', '🐱'], duration: 2,   weight: 8,  minIdle: 3 },
  { name: 'look_around',frames: ['🐱', '🐱'],        duration: 2,   weight: 8,  minIdle: 2 },
  { name: 'sit_down',   frames: ['🐱', '🐈'],        duration: 3,   weight: 5,  minIdle: 4 },
  { name: 'ear_twitch', frames: ['🐱'],               duration: 0.5, weight: 5,  minIdle: 2 },
  { name: 'tail_flick', frames: ['🐱'],               duration: 1,   weight: 5,  minIdle: 3 },
  { name: 'yawn',       frames: ['🥱', '🐱'],         duration: 2,   weight: 3,  minIdle: 8 },
  { name: 'full_stretch',frames: ['🐱', '🐈', '🐱'], duration: 3,   weight: 2,  minIdle: 10 },
  { name: 'sneeze',     frames: ['🐱', '🤧', '😺'],  duration: 1.5, weight: 2,  minIdle: 15 },
  { name: 'sudden_alert',frames: ['😼', '🐱'],        duration: 1,   weight: 2,  minIdle: 5 },
  { name: 'stare',      frames: ['🐱'],               duration: 4,   weight: 2,  minIdle: 10 },
  { name: 'butt_wiggle',frames: ['🐱', '🐱'],         duration: 2,   weight: 1,  minIdle: 20 },
  { name: 'roll_over',  frames: ['🐱', '🙃', '🐱'],  duration: 3,   weight: 1,  minIdle: 20 },
  { name: 'zoomies',    frames: ['😼', '🐱'],         duration: 2,   weight: 1,  minIdle: 30 },
];

// Physics constants
const GRAVITY = 1800;         // px/s²
const JUMP_VELOCITY = -920;   // px/s (negative = up)
const JUMP_HOLD_BONUS = -280; // extra velocity if hold sustained
const WALK_SPEED = 180;       // px/s
const RUN_SPEED = 320;        // px/s
const POUNCE_SPEED = 480;     // px/s
const FONT_SIZE = 32;         // emoji render size

// The screen-x position at which Kafka locks and world starts scrolling
const LOCK_X_RATIO = 0.33;

// How far left Kafka retreats to when pressing left (as ratio of canvas width)
const LEFT_EDGE_X_RATIO = 0.10;

export class Kafka {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;

    // The x threshold — once Kafka reaches this, world scrolls instead
    this.lockX = canvasWidth * LOCK_X_RATIO;

    // Kafka starts at the left edge and runs to lockX before scrolling begins
    this.x = canvasWidth * LEFT_EDGE_X_RATIO;
    this.groundY = canvasHeight - 80; // ground plane

    // Physics state
    this.y = this.groundY;
    this.vy = 0;          // vertical velocity
    this.vx = 0;          // world scroll speed — only non-zero when at lockX moving right
    this.screenVx = 0;    // screen-space horizontal velocity (used before lockX)
    this.onGround = true;
    this.facingRight = true;

    // Game state
    this.state = KAFKA_STATES.IDLE;
    this.energy = 1.0;    // 0–1
    this.isLowEnergy = false;

    // Animation
    this.animTime = 0;
    this.animFrame = 0;
    this.idleTime = 0;
    this.currentIdleAnim = null;
    this.idleAnimTime = 0;
    this.landingTimer = 0;
    this.hitTimer = 0;
    this.invincibleTimer = 0;   // seconds of post-hit invincibility
    this.scratchTimer = 0;
    this.hissTimer = 0;
    this.jumpChargeTime = 0;
    this.isChargingJump = false;

    // Y bob for walk animation
    this.bobOffset = 0;
    this.bobTime = 0;

    // Visual flash for boosts
    this.flashColor = null;
    this.flashTimer = 0;

    // Screen shake
    this.shakeX = 0;
    this.shakeY = 0;
    this.shakeTimer = 0;

    // Squash/stretch
    this.scaleX = 1;
    this.scaleY = 1;

    // Hitbox
    this.hitboxW = 36;
    this.hitboxH = 36;
  }

  getHitbox() {
    const isCrouch = this.state === KAFKA_STATES.CROUCH;
    return {
      x: this.x - this.hitboxW / 2,
      y: this.y - (isCrouch ? this.hitboxH * 0.6 : this.hitboxH),
      w: this.hitboxW,
      h: isCrouch ? this.hitboxH * 0.6 : this.hitboxH,
    };
  }

  // Called by engine each fixed timestep
  update(dt, input) {
    this._updateTimers(dt);
    this._handleInput(input, dt);
    this._applyPhysics(dt);
    this._updateAnimation(dt);
    this._updateEnergy(dt);
  }

  _updateTimers(dt) {
    if (this.landingTimer > 0) this.landingTimer -= dt;
    if (this.hitTimer > 0) this.hitTimer -= dt;
    if (this.invincibleTimer > 0) this.invincibleTimer -= dt;
    if (this.scratchTimer > 0) this.scratchTimer -= dt;
    if (this.hissTimer > 0) this.hissTimer -= dt;
    if (this.flashTimer > 0) this.flashTimer -= dt;
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt;
      this.shakeX = (Math.random() - 0.5) * 8;
      this.shakeY = (Math.random() - 0.5) * 8;
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
  }

  _handleInput(input, dt) {
    if (!input) return;

    // Don't process input during hit stun or slink
    if (this.state === KAFKA_STATES.HIT || this.state === KAFKA_STATES.SLINK) return;

    const { left, right, down, jumpHeld, jumpPressed, attackPressed, attackHeld, hissPressed } = input;

    // Crouch
    if (down && this.onGround) {
      this.state = KAFKA_STATES.CROUCH;
      this.vx = 0;
      this.screenVx = 0;
      return;
    }

    // Hiss
    if (hissPressed && this.energy > 0.1) {
      this.state = KAFKA_STATES.HISS;
      this.hissTimer = 0.4;
      this.energy = Math.max(0, this.energy - 0.08);
      this.vx = 0;
      this.screenVx = 0;
      return;
    }

    // Attack: pounce if held with direction, scratch if tap
    if (attackHeld && (left || right) && this.onGround) {
      this.state = KAFKA_STATES.POUNCE;
      if (right) {
        this._setRightMovement(POUNCE_SPEED, dt);
      } else {
        this.screenVx = -POUNCE_SPEED * 0.3;
        this.vx = 0;
      }
      this.facingRight = right;
      return;
    }

    if (attackPressed && this.scratchTimer <= 0) {
      this.state = KAFKA_STATES.SCRATCH;
      this.scratchTimer = 0.25;
    }

    // Jump: tap launches immediately. Charge only engages if key is still held next frame.
    if (jumpPressed && this.onGround && !this.isChargingJump) {
      // Launch immediately on press — no waiting for release
      this.vy = JUMP_VELOCITY * 0.65;
      this.onGround = false;
      this.state = KAFKA_STATES.AIRBORNE;
      this.scaleX = 0.8;
      this.scaleY = 1.3;
      // Mark that we can boost this jump if held continues
      this.isChargingJump = true;
      this.jumpChargeTime = 0;
      this._jumpBoosted = false;
      return;
    }

    // Jump hold boost — add extra velocity while key held, up to 0.5s, once per jump
    if (this.isChargingJump && jumpHeld && !this.onGround && !this._jumpBoosted) {
      this.jumpChargeTime = Math.min(this.jumpChargeTime + dt, 0.5);
      const boostForce = JUMP_HOLD_BONUS * dt / 0.5;
      this.vy += boostForce;
    }
    if (this.isChargingJump && !jumpHeld) {
      this._jumpBoosted = true; // key released — no more boost this jump
    }

    // Horizontal movement
    if (this.state !== KAFKA_STATES.POUNCE) {
      if (right) {
        this._setRightMovement(RUN_SPEED, dt);
        this.facingRight = true;
        if (this.onGround && this.state !== KAFKA_STATES.AIRBORNE) {
          this.state = KAFKA_STATES.RUN;
        }
      } else if (left) {
        // Left always moves Kafka on screen toward left edge — never scrolls world back
        this.vx = 0;
        this.screenVx = -WALK_SPEED * 0.6;
        this.facingRight = false;
        if (this.onGround) this.state = KAFKA_STATES.WALK;
      } else {
        // No input: full stop
        this.vx = 0;
        this.screenVx = 0;
        if (this.onGround && this.scratchTimer <= 0 && this.hissTimer <= 0) {
          this.state = KAFKA_STATES.IDLE;
        }
      }
    }
  }

  // Helper: moving right — screen movement until lockX, then world scroll
  _setRightMovement(speed, dt) {
    if (this.x < this.lockX) {
      // Still approaching lock point — move on screen
      this.screenVx = speed;
      this.vx = 0;
    } else {
      // At or past lock point — scroll world
      this.x = this.lockX; // snap to prevent drift
      this.screenVx = 0;
      this.vx = speed;
    }
  }

  _applyPhysics(dt) {
    // Apply screen-space horizontal movement (before lock point)
    if (this.screenVx !== 0) {
      this.x += this.screenVx * dt;
      // Clamp: can't go past lockX moving right, can't go off left edge
      const leftEdge = this.canvasWidth * LEFT_EDGE_X_RATIO;
      this.x = Math.max(leftEdge, Math.min(this.lockX, this.x));
    }

    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.y += this.vy * dt;

      // Landing
      if (this.y >= this.groundY) {
        this.y = this.groundY;
        this.vy = 0;
        this.onGround = true;
        this.state = KAFKA_STATES.LANDING;
        this.landingTimer = 0.1;
        this.scaleX = 1.3;
        this.scaleY = 0.7;
        this.isChargingJump = false;
        this._jumpBoosted = false;
      }
    } else {
      this.y = this.groundY;
    }

    // Ease squash/stretch back to 1
    this.scaleX += (1 - this.scaleX) * 12 * dt;
    this.scaleY += (1 - this.scaleY) * 12 * dt;

    // After landing timer, move to appropriate state
    if (this.landingTimer <= 0 && this.state === KAFKA_STATES.LANDING) {
      this.state = KAFKA_STATES.IDLE;
    }
  }

  _updateAnimation(dt) {
    this.animTime += dt;
    this.bobTime += dt;

    // Walk bob
    if (this.state === KAFKA_STATES.WALK || this.state === KAFKA_STATES.RUN) {
      const freq = this.state === KAFKA_STATES.RUN ? 12 : 8;
      this.bobOffset = Math.sin(this.bobTime * freq) * 3;
    } else {
      this.bobOffset *= 0.85;
    }

    // Idle animation timer
    if (this.state === KAFKA_STATES.IDLE) {
      this.idleTime += dt;
      this._tickIdleAnimation(dt);
    } else {
      this.idleTime = 0;
      this.currentIdleAnim = null;
    }

    // Frame cycling
    const fps = this._getAnimFPS();
    if (this.animTime > 1 / fps) {
      this.animTime = 0;
      this.animFrame++;
    }
  }

  _tickIdleAnimation(dt) {
    if (this.currentIdleAnim) {
      this.idleAnimTime += dt;
      if (this.idleAnimTime >= this.currentIdleAnim.duration) {
        this.currentIdleAnim = null;
        this.idleAnimTime = 0;
      }
      return;
    }

    // Pick a new idle animation based on weights and minIdle
    const eligible = IDLE_ANIMATIONS.filter(a => this.idleTime >= a.minIdle);
    if (eligible.length === 0) return;

    // Weighted random
    const totalWeight = eligible.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * totalWeight;
    for (const anim of eligible) {
      r -= anim.weight;
      if (r <= 0) {
        this.currentIdleAnim = anim;
        this.idleAnimTime = 0;
        this.animFrame = 0;
        return;
      }
    }
  }

  _getAnimFPS() {
    switch (this.state) {
      case KAFKA_STATES.RUN: return 12;
      case KAFKA_STATES.WALK: return 8;
      case KAFKA_STATES.IDLE: return 3;
      default: return 8;
    }
  }

  _updateEnergy(dt) {
    const isIdle = this.state === KAFKA_STATES.IDLE
      && this.vx === 0
      && this.screenVx === 0
      && this.onGround;

    if (isIdle) {
      // Relaxed restore — slow, barely perceptible
      const restoreRate = 0.008 + (1 - this.energy) * 0.004;
      this.energy = Math.min(1, this.energy + restoreRate * dt);
    } else {
      // Passive drain — heavier during high-effort states
      const drainRate = this.state === KAFKA_STATES.RUN    ? 0.014
                      : this.state === KAFKA_STATES.POUNCE ? 0.022
                      : this.state === KAFKA_STATES.HISS   ? 0.0   // hiss costs applied one-shot on trigger
                      : 0.008;
      this.energy = Math.max(0, this.energy - drainRate * dt);
    }

    this.isLowEnergy = this.energy < 0.3;

    if (this.energy <= 0 && this.state !== KAFKA_STATES.SLINK) {
      this.state = KAFKA_STATES.SLINK;
    }
  }

  // Returns true if the hit landed, false if absorbed by invincibility
  takeHit() {
    if (this.invincibleTimer > 0) return false;
    this.state = KAFKA_STATES.HIT;
    this.hitTimer = 0.5;
    this.invincibleTimer = 2.0;  // 2 seconds of flicker invincibility
    this.shakeTimer = 0.3;
    this.vy = -200;
    return true;
  }

  isInvincible() {
    return this.invincibleTimer > 0;
  }

  collectBoost(amount, flashColor) {
    this.energy = Math.min(1, this.energy + amount);
    this.flashColor = flashColor;
    this.flashTimer = 0.35;
  }

  getCurrentEmoji() {
    // Hit overrides everything
    if (this.hitTimer > 0) return '🙀';

    // Low energy base
    const lowBase = this.isLowEnergy ? '😿' : '🐱';

    if (this.state === KAFKA_STATES.IDLE) {
      if (this.currentIdleAnim) {
        const frames = this.currentIdleAnim.frames;
        const idx = this.animFrame % frames.length;
        const frame = frames[idx];
        return this.isLowEnergy && (frame === '🐱' || frame === '😺') ? lowBase : frame;
      }
      return lowBase;
    }

    const frames = STATE_EMOJI[this.state] || ['🐱'];
    const emoji = frames[this.animFrame % frames.length];
    return this.isLowEnergy && emoji === '🐱' ? lowBase : emoji;
  }

  render(ctx) {
    const renderX = this.x + this.shakeX;
    const renderY = this.y + this.bobOffset + this.shakeY;

    ctx.save();
    ctx.translate(renderX, renderY);

    // Cat emoji faces left natively — flip to face right
    if (this.facingRight) ctx.scale(-1, 1);

    // Squash/stretch
    ctx.scale(this.scaleX, this.scaleY);

    // Flash overlay (colour tint via composite)
    if (this.flashTimer > 0 && this.flashColor) {
      ctx.globalAlpha = Math.min(1, this.flashTimer * 3) * 0.6;
      // We render the emoji normally then add tint
    }

    // Render emoji
    ctx.font = `${FONT_SIZE}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    const emoji = this.getCurrentEmoji();
    // Flicker during invincibility — alternate opacity every 80ms using time
    const flickering = this.invincibleTimer > 0;
    const flickerOn = flickering ? (Math.floor(this.invincibleTimer * 12) % 2 === 0) : true;
    ctx.globalAlpha = flickerOn ? 1 : 0.15;
    ctx.fillText(emoji, 0, 0);
    ctx.globalAlpha = 1;

    // Flash ring
    if (this.flashTimer > 0 && this.flashColor) {
      const alpha = Math.min(1, this.flashTimer * 3);
      ctx.globalAlpha = alpha * 0.7;
      ctx.strokeStyle = this.flashColor;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, -FONT_SIZE / 2, FONT_SIZE * 0.7 + (1 - this.flashTimer) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Wind trail when running
    if (this.state === KAFKA_STATES.RUN || this.state === KAFKA_STATES.POUNCE) {
      ctx.save();
      ctx.font = `${FONT_SIZE * 0.7}px serif`;
      ctx.globalAlpha = 0.5;
      ctx.fillText('💨', renderX - 30, renderY);
      ctx.restore();
    }

    // Scratch flash
    if (this.state === KAFKA_STATES.SCRATCH && this.scratchTimer > 0.15) {
      ctx.save();
      ctx.font = `${FONT_SIZE * 0.8}px serif`;
      ctx.fillText('🐾', renderX + (this.facingRight ? 28 : -28), renderY - FONT_SIZE * 0.5);
      ctx.restore();
    }

    // Hiss effect
    if (this.state === KAFKA_STATES.HISS && this.hissTimer > 0.2) {
      ctx.save();
      ctx.font = `${FONT_SIZE * 0.6}px serif`;
      ctx.globalAlpha = 0.8;
      const spread = 28;
      ctx.fillText('⚡', renderX + (this.facingRight ? spread : -spread), renderY - FONT_SIZE);
      ctx.fillText('⚡', renderX + (this.facingRight ? spread + 12 : -spread - 12), renderY - FONT_SIZE * 0.5);
      ctx.restore();
    }
  }

  // Called on resize
  resize(canvasWidth, canvasHeight) {
    const wasAtLock = this.x >= this.lockX - 1;
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.lockX = canvasWidth * LOCK_X_RATIO;
    this.groundY = canvasHeight - 80;
    // Keep Kafka at lock point if she was already there
    if (wasAtLock) this.x = this.lockX;
  }
}