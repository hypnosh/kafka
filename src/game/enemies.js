// enemies.js — enemy system, Dog first

import { sound } from './sound';

const DOG_SPEED = 140;
const DOG_SPAWN_INTERVAL = 8;
const DOG_SPAWN_X_AHEAD = 900;
const STOMP_BOUNCE = -400;
const HIT_WALK_AWAY_DURATION = 2.0;

export class EnemyManager {
  constructor(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.groundY = canvasHeight - 80;
    this.enemies = [];
    this._spawnTimer = DOG_SPAWN_INTERVAL * 0.5;
  }

  update(dt, scrollX, kafka) {
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) {
      this._spawnDog(scrollX);
      this._spawnTimer = DOG_SPAWN_INTERVAL;
    }

    for (const e of this.enemies) {
      if (e.dead) {
        e.deadTimer -= dt;
        continue;
      }

      if (e.hitCooldown > 0) {
        e.hitCooldown -= dt;
        const awayDir = e.screenX < kafka.x ? -1 : 1;
        e.screenX += awayDir * DOG_SPEED * dt;
        e.facingRight = awayDir > 0;
      } else {
        const dx = kafka.x - e.screenX;
        e.screenX += (dx > 0 ? 1 : -1) * DOG_SPEED * dt;
        e.facingRight = dx > 0;
      }

      e.screenX -= kafka.vx * dt;
    }

    const kb = kafka.getHitbox();
    for (const e of this.enemies) {
      if (e.dead || e.hitCooldown > 0) continue;

      const ew = 32, eh = 32;
      const horizOverlap = (
        e.screenX - ew / 2 < kb.x + kb.w &&
        e.screenX + ew / 2 > kb.x
      );
      if (!horizOverlap) continue;

      const dogTop = this.groundY - eh;
      const kafkaFeet = kb.y + kb.h;
      const stomping = !kafka.onGround && kafka.vy > 0 && kafkaFeet >= dogTop && kafkaFeet <= this.groundY;

      if (stomping) {
        kafka.vy = STOMP_BOUNCE;
        kafka.onGround = false;
        e.dead = true;
        e.deadTimer = 0.4;
        sound.stomp();
      } else {
        const bodyHit = kafkaFeet > dogTop + 8;
        if (bodyHit) {
          const hit = kafka.takeDamage(e.screenX);
          if (hit) {
            e.hitCooldown = HIT_WALK_AWAY_DURATION;
          }
        }
      }
    }

    this.enemies = this.enemies.filter(e =>
      !(e.dead && e.deadTimer <= 0) &&
      e.screenX > -100 &&
      e.screenX < this.canvasWidth + 200
    );
  }

  _spawnDog(scrollX) {
    this.enemies.push({
      type: 'dog',
      screenX: this.canvasWidth + 60,
      worldX: scrollX + DOG_SPAWN_X_AHEAD,
      facingRight: false,
      dead: false,
      deadTimer: 0,
      hitCooldown: 0,
    });
  }

  render(ctx) {
    ctx.save();
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.screenX, this.groundY);

      if (e.dead) {
        const progress = 1 - (e.deadTimer / 0.4);
        ctx.translate(0, -progress * 30);
        ctx.globalAlpha = Math.max(0, e.deadTimer / 0.4);
        ctx.font = '22px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('💫', 0, -10);
      } else {
        if (e.facingRight) ctx.scale(-1, 1);
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText('🐕', 0, 0);
      }

      ctx.restore();
    }
    ctx.restore();
  }

  resize(canvasWidth, canvasHeight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.groundY = canvasHeight - 80;
  }
}