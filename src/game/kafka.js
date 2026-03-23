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
  { name: 'slow_blink',   frames: ['🐱', '😺', '🐱'], duration: 1.5, weight: 10, minIdle: 2  },
  { name: 'paw_lick',     frames: ['🐱', '🐾', '🐱'], duration: 2,   weight: 8,  minIdle: 3  },
  { name: 'look_around',  frames: ['🐱', '🐱'],        duration: 2,   weight: 8,  minIdle: 2  },
  { name: 'sit_down',     frames: ['🐱', '🐈'],        duration: 3,   weight: 5,  minIdle: 4  },
  { name: 'ear_twitch',   frames: ['🐱'],               duration: 0.5, weight: 5,  minIdle: 2  },
  { name: 'tail_flick',   frames: ['🐱'],               duration: 1,   weight: 5,  minIdle: 3  },
  { name: 'yawn',         frames: ['🥱', '🐱'],         duration: 2,   weight: 3,  minIdle: 8  },
  { name: 'full_stretch', frames: ['🐱', '🐈', '🐱'], duration: 3,   weight: 2,  minIdle: 10 },
  { name: 'sneeze',       frames: ['🐱', '🤧', '😺'],  duration: 1.5, weight: 2,  minIdle: 15 },
  { name: 'sudden_alert', frames: ['😼', '🐱'],         duration: 1,   weight: 2,  minIdle: 5  },
  { name: 'stare',        frames: ['🐱'],               duration: 4,   weight: 2,  minIdle: 10 },
  { name: 'butt_wiggle',  frames: ['🐱', '🐱'],         duration: 2,   weight: 1,  minIdle: 20 },
  { name: 'roll_over',    frames: ['🐱', '🙃', '🐱'],  duration: 3,   weight: 1,  minIdle: 20 },
  { name: 'zoomies',      frames: ['😼', '🐱'],         duration: 2,   weight: 1,  minIdle: 30 },
];

// Physics constants
const GRAVITY      = 1800;  // px/s²
const JUMP_VEL     = -620;  // px/s (negative = up)
const JUMP_HOLD_BONUS = -280; // extra if held
const RUN_SPEED    = 320;   // px/s — right input, drives world scroll
const WALK_BACK    = 160;   // px/s — left input, moves Kafka's screen x leftward
const POUNCE_SPEED = 480;   // px/s
const FONT_SIZE    = 32;    // emoji render size
const LEFT_EDGE    = 40;    // minimum screen x Kafka can occupy

export class Kafka {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth  = canvasWidth;
    this.canvasHeight = canvasHeight;

    // Screen position — x is now mutable (left/right movement within viewport)
    this.x       = canvasWidth * 0.30;
    this.groundY = canvasHeight - 80;

    // Physics
    this.y        = this.groundY;
    this.vy       = 0;   // vertical velocity
    this.vx       = 0;   // world scroll speed (0 = standing still, positive = scrolling right)
    this.screenVx = 0;   // screen-space horizontal velocity (left movement only)
    this.onGround = true;
    this.facingRight = true;

    // Game state
    this.state     = KAFKA_STATES.IDLE;
    this.energy    = 1.0;
    this.isLowEnergy = false;

    // Animation timers
    this.animTime      = 0;
    this.animFrame     = 0;
    this.idleTime      = 0;
    this.currentIdleAnim = null;
    this.idleAnimTime  = 0;
    this.landingTimer  = 0;
    this.hitTimer      = 0;
    this.scratchTimer  = 0;
    this.hissTimer     = 0;
    this.jumpChargeTime = 0;
    this.isChargingJump = false;

    // Visual
    this.bobOffset  = 0;
    this.bobTime    = 0;
    this.flashColor = null;
    this.flashTimer = 0;
    this.shakeX     = 0;
    this.shakeY     = 0;
    this.shakeTimer = 0;
    this.scaleX     = 1;
    this.scaleY     = 1;

    // Hitbox (logical, relative to x/y)
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

  update(dt, input) {
    this._updateTimers(dt);
    this._handleInput(input, dt);
    this._applyPhysics(dt);
    this._updateAnimation(dt);
    this._updateEnergy(dt);
  }

  _updateTimers(dt) {
    if (this.landingTimer > 0) this.landingTimer -= dt;
    if (this.hitTimer     > 0) this.hitTimer     -= dt;
    if (this.scratchTimer > 0) this.scratchTimer -= dt;
    if (this.hissTimer    > 0) this.hissTimer    -= dt;
    if (this.flashTimer   > 0) this.flashTimer   -= dt;
    if (this.shakeTimer   > 0) {
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
    if (this.state === KAFKA_STATES.HIT || this.state === KAFKA_STATES.SLINK) return;

    const { left, right, down, jumpHeld, jumpPressed, attackPressed, attackHeld, hissPressed } = input;

    // ── Crouch ────────────────────────────────────────────────────────────────
    if (down && this.onGround) {
      this.state    = KAFKA_STATES.CROUCH;
      this.vx       = 0;
      this.screenVx = 0;
      return;
    }

    // ── Hiss ──────────────────────────────────────────────────────────────────
    if (hissPressed && this.energy > 0.1) {
      this.state     = KAFKA_STATES.HISS;
      this.hissTimer = 0.4;
      this.energy    = Math.max(0, this.energy - 0.08);
      this.vx        = 0;
      this.screenVx  = 0;
      return;
    }

    // ── Pounce ────────────────────────────────────────────────────────────────
    if (attackHeld && (left || right) && this.onGround) {
      this.state       = KAFKA_STATES.POUNCE;
      this.facingRight = right;
      if (right) {
        // Pounce right → drives world scroll, Kafka stays on screen
        this.vx       = POUNCE_SPEED;
        this.screenVx = 0;
      } else {
        // Pounce left → moves Kafka leftward on screen
        this.vx       = 0;
        this.screenVx = -POUNCE_SPEED * 0.6;
      }
      return;
    }

    // ── Scratch ───────────────────────────────────────────────────────────────
    if (attackPressed && this.scratchTimer <= 0) {
      this.state        = KAFKA_STATES.SCRATCH;
      this.scratchTimer = 0.25;
    }

    // ── Jump charge ───────────────────────────────────────────────────────────
    if (jumpHeld && this.onGround && !this.isChargingJump) {
      this.isChargingJump = true;
      this.jumpChargeTime = 0;
      this.state          = KAFKA_STATES.JUMP_CHARGE;
    }
    if (this.isChargingJump) {
      this.jumpChargeTime = Math.min(this.jumpChargeTime + dt, 0.5);
      if (!jumpHeld) {
        const chargeRatio = this.jumpChargeTime / 0.5;
        this.vy             = JUMP_VEL + JUMP_HOLD_BONUS * chargeRatio;
        this.onGround       = false;
        this.isChargingJump = false;
        this.state          = KAFKA_STATES.AIRBORNE;
        this.scaleX         = 0.8;
        this.scaleY         = 1.3;
      }
      // Preserve horizontal intent during charge wind-up
      this._applyHorizontal(left, right);
      return;
    }

    // ── Quick tap jump ────────────────────────────────────────────────────────
    if (jumpPressed && this.onGround) {
      this.vy       = JUMP_VEL * 0.65;
      this.onGround = false;
      this.state    = KAFKA_STATES.AIRBORNE;
      this.scaleX   = 0.8;
      this.scaleY   = 1.3;
    }

    // ── Horizontal movement ───────────────────────────────────────────────────
    if (this.state !== KAFKA_STATES.POUNCE) {
      this._applyHorizontal(left, right);
    }
  }

  // Centralised horizontal intent → vx / screenVx / state
  _applyHorizontal(left, right) {
    if (right) {
      // Right: world scrolls, Kafka stays roughly in place
      this.vx          = RUN_SPEED;
      this.screenVx    = 0;
      this.facingRight = true;
      if (this.onGround && this.state !== KAFKA_STATES.AIRBORNE &&
          this.state !== KAFKA_STATES.JUMP_CHARGE) {
        this.state = KAFKA_STATES.RUN;
      }
    } else if (left) {
      // Left: world stops, Kafka walks leftward on screen
      this.vx          = 0;
      this.screenVx    = -WALK_BACK;
      this.facingRight = false;
      if (this.onGround && this.state !== KAFKA_STATES.AIRBORNE &&
          this.state !== KAFKA_STATES.JUMP_CHARGE) {
        this.state = KAFKA_STATES.WALK;
      }
    } else {
      // Neither key: Kafka stands still — no scroll, no screen movement
      this.vx       = 0;
      this.screenVx = 0;
      if (this.onGround && this.scratchTimer <= 0 && this.hissTimer <= 0 &&
          this.state !== KAFKA_STATES.JUMP_CHARGE) {
        this.state = KAFKA_STATES.IDLE;
      }
    }
  }

  _applyPhysics(dt) {
    // ── Vertical ─────────────────────────────────────────────────────────────
    if (!this.onGround) {
      this.vy += GRAVITY * dt;
      this.y  += this.vy * dt;

      if (this.y >= this.groundY) {
        this.y        = this.groundY;
        this.vy       = 0;
        this.onGround = true;
        this.state    = KAFKA_STATES.LANDING;
        this.landingTimer = 0.1;
        this.scaleX   = 1.3;
        this.scaleY   = 0.7;
        this.isChargingJump = false;
      }
    } else {
      this.y = this.groundY;
    }

    // ── Horizontal screen position (left movement + left-edge clamp) ──────────
    if (this.screenVx !== 0) {
      this.x += this.screenVx * dt;
      // Hard clamp — cannot retreat past left edge
      if (this.x < LEFT_EDGE) this.x = LEFT_EDGE;
    }

    // Ease squash/stretch
    this.scaleX += (1 - this.scaleX) * 12 * dt;
    this.scaleY += (1 - this.scaleY) * 12 * dt;

    // Landing timer → idle
    if (this.landingTimer <= 0 && this.state === KAFKA_STATES.LANDING) {
      this.state = KAFKA_STATES.IDLE;
    }
  }

  _updateAnimation(dt) {
    this.animTime += dt;
    this.bobTime  += dt;

    if (this.state === KAFKA_STATES.WALK || this.state === KAFKA_STATES.RUN) {
      const freq    = this.state === KAFKA_STATES.RUN ? 12 : 8;
      this.bobOffset = Math.sin(this.bobTime * freq) * 3;
    } else {
      this.bobOffset *= 0.85;
    }

    if (this.state === KAFKA_STATES.IDLE) {
      this.idleTime += dt;
      this._tickIdleAnimation(dt);
    } else {
      this.idleTime        = 0;
      this.currentIdleAnim = null;
    }

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
        this.idleAnimTime    = 0;
      }
      return;
    }

    const eligible   = IDLE_ANIMATIONS.filter(a => this.idleTime >= a.minIdle);
    if (!eligible.length) return;

    const totalWeight = eligible.reduce((s, a) => s + a.weight, 0);
    let r = Math.random() * totalWeight;
    for (const anim of eligible) {
      r -= anim.weight;
      if (r <= 0) {
        this.currentIdleAnim = anim;
        this.idleAnimTime    = 0;
        this.animFrame       = 0;
        return;
      }
    }
  }

  _getAnimFPS() {
    switch (this.state) {
      case KAFKA_STATES.RUN:  return 12;
      case KAFKA_STATES.WALK: return 8;
      case KAFKA_STATES.IDLE: return 3;
      default:                return 8;
    }
  }

  _updateEnergy(dt) {
    const drainRate = 0.008;
    this.energy      = Math.max(0, this.energy - drainRate * dt);
    this.isLowEnergy = this.energy < 0.3;

    if (this.energy <= 0 && this.state !== KAFKA_STATES.SLINK) {
      this.state = KAFKA_STATES.SLINK;
    }
  }

  takeHit(damage = 0.15) {
    this.energy     = Math.max(0, this.energy - damage);
    this.state      = KAFKA_STATES.HIT;
    this.hitTimer   = 0.4;
    this.shakeTimer = 0.3;
    this.vy         = -200;
  }

  collectBoost(amount, flashColor) {
    this.energy     = Math.min(1, this.energy + amount);
    this.flashColor = flashColor;
    this.flashTimer = 0.35;
  }

  getCurrentEmoji() {
    if (this.hitTimer > 0) return '🙀';
    const lowBase = this.isLowEnergy ? '😿' : '🐱';

    if (this.state === KAFKA_STATES.IDLE) {
      if (this.currentIdleAnim) {
        const frames = this.currentIdleAnim.frames;
        const frame  = frames[this.animFrame % frames.length];
        return this.isLowEnergy && (frame === '🐱' || frame === '😺') ? lowBase : frame;
      }
      return lowBase;
    }

    const frames = STATE_EMOJI[this.state] || ['🐱'];
    const emoji  = frames[this.animFrame % frames.length];
    return this.isLowEnergy && emoji === '🐱' ? lowBase : emoji;
  }

  render(ctx) {
    const renderX = this.x       + this.shakeX;
    const renderY = this.y + this.bobOffset + this.shakeY;

    ctx.save();
    ctx.translate(renderX, renderY);
    if (this.facingRight) ctx.scale(-1, 1);
    ctx.scale(this.scaleX, this.scaleY);

    ctx.font         = `${FONT_SIZE}px serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'bottom';
    ctx.globalAlpha  = 1;
    ctx.fillText(this.getCurrentEmoji(), 0, 0);

    // Flash ring
    if (this.flashTimer > 0 && this.flashColor) {
      const alpha = Math.min(1, this.flashTimer * 3);
      ctx.globalAlpha  = alpha * 0.7;
      ctx.strokeStyle  = this.flashColor;
      ctx.lineWidth    = 3;
      ctx.beginPath();
      ctx.arc(0, -FONT_SIZE / 2, FONT_SIZE * 0.7 + (1 - this.flashTimer) * 20, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();

    // Wind trail
    if (this.state === KAFKA_STATES.RUN || this.state === KAFKA_STATES.POUNCE) {
      ctx.save();
      ctx.font        = `${FONT_SIZE * 0.7}px serif`;
      ctx.globalAlpha = 0.5;
      ctx.fillText('💨', renderX - 30, renderY);
      ctx.restore();
    }

    // Scratch paw flash
    if (this.state === KAFKA_STATES.SCRATCH && this.scratchTimer > 0.15) {
      ctx.save();
      ctx.font = `${FONT_SIZE * 0.8}px serif`;
      ctx.fillText('🐾', renderX + (this.facingRight ? 28 : -28), renderY - FONT_SIZE * 0.5);
      ctx.restore();
    }

    // Hiss sparks
    if (this.state === KAFKA_STATES.HISS && this.hissTimer > 0.2) {
      ctx.save();
      ctx.font        = `${FONT_SIZE * 0.6}px serif`;
      ctx.globalAlpha = 0.8;
      const spread    = 28;
      ctx.fillText('⚡', renderX + (this.facingRight ? spread      : -spread),      renderY - FONT_SIZE);
      ctx.fillText('⚡', renderX + (this.facingRight ? spread + 12 : -spread - 12), renderY - FONT_SIZE * 0.5);
      ctx.restore();
    }
  }
}