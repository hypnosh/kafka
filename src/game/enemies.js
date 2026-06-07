// enemies.js — enemy system, Dog first

const DOG_SPEED = 140;
const DOG_SPAWN_INTERVAL = 8;
const DOG_SPAWN_X_AHEAD = 900;
const STOMP_BOUNCE = -400; // px/s upward on stomp

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
        // Death pop animation — float up and fade
        e.deadTimer -= dt;
        e.screenX += e.facingRight ? -20 * dt : 20 * dt;
        continue;
      }
      const dx = kafka.x - e.screenX;
      e.screenX += (dx > 0 ? 1 : -1) * DOG_SPEED * dt;
      e.facingRight = dx > 0;
      e.worldX -= kafka.vx * dt;
    }

    const kb = kafka.getHitbox();
    for (const e of this.enemies) {
      if (e.dead) continue;

      const ew = 32, eh = 32;
      const horizOverlap = (
        e.screenX - ew / 2 < kb.x + kb.w &&
        e.screenX + ew / 2 > kb.x
      );
      if (!horizOverlap) continue;

      // Top of dog in screen space
      const dogTop = this.groundY - eh;

      // Stomp: Kafka falling, feet above dog top last frame, now at/below dog top
      const kafkaFeet = kb.y + kb.h;
      const stomping = !kafka.onGround && kafka.vy > 0 && kafkaFeet >= dogTop && kafkaFeet <= this.groundY;

      if (stomping) {
        kafka.vy = STOMP_BOUNCE;
        kafka.onGround = false;
        e.dead = true;
        e.deadTimer = 0.4;
      } else {
        const bodyHit = kafkaFeet > dogTop + 8;
        if (bodyHit) {
          const hit = kafka.takeDamage(e.screenX);
          if (hit) {
            // Shove dog past Kafka so it can't re-hit during invincibility
            const pushDir = e.screenX < kafka.x ? -1 : 1;
            e.screenX = kafka.x + pushDir * 80;
          }
        }
      }
    }

    // Cull dead (after animation) and off-screen
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
      animTime: 0,
      dead: false,
      deadTimer: 0,
    });
  }

  render(ctx) {
    ctx.save();
    for (const e of this.enemies) {
      ctx.save();
      ctx.translate(e.screenX, this.groundY);

      if (e.dead) {
        // Float up + fade out
        const progress = 1 - (e.deadTimer / 0.4);
        ctx.translate(0, -progress * 30);
        ctx.globalAlpha = e.deadTimer / 0.4;
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