// boosts.js — boost item spawning, rendering, collection detection

const SWEET_TREATS = ['🍩', '🎂', '🍰', '🧁', '🍪', '🍫'];

const FONT_SIZE = 26;

const SPAWN_LOOKAHEAD = 2400;  // items exist well ahead of Kafka at all times
const MIN_SPAWN_GAP   = 350;
const MAX_SPAWN_GAP   = 700;

// Energy values
const TREAT_ENERGY = 0.08;  // reduced — treats are a nibble, not a meal
const MOUSE_ENERGY = 0.35;
const MILK_ENERGY  = 1.00;
const BIRD_ENERGY  = 0.12;  // requires a jump — worth a little more than a treat
const BOX_ENERGY   = 0.10;  // tiny — it's just a box, but cats love boxes

// Points per PRD scoring model
const TREAT_POINTS = 150;
const MOUSE_POINTS = 500;
const BIRD_POINTS  = 300;  // mid-tier — requires a bit of chase
const BOX_POINTS   = 100;  // low — just for fun, no chase needed

// Flash colours (per PRD)
const FLASH_TREAT = '#ffb3c6';  // soft pink
const FLASH_MOUSE = '#ffd700';  // warm gold
const FLASH_MILK  = '#e8f4ff';  // cool white
const FLASH_MAGIC = '#7b2fff';  // deep violet — nowhere else in the game

export class BoostManager {
  constructor(canvasWidth, canvasHeight, isNight) {
    this.canvasWidth  = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.isNight      = isNight;

    this.groundY = canvasHeight - 80;

    this.items = [];
    this._nextSpawnX = 300;  // first item appears shortly after run start
    this._time = 0;

    // Pre-populate so items are already in the world on frame one
    this._preseed();
  }

  _preseed() {
    while (this._nextSpawnX < SPAWN_LOOKAHEAD) {
      this._spawnItem(this._nextSpawnX);
      const gap = MIN_SPAWN_GAP + Math.random() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP);
      this._nextSpawnX += gap;
    }
  }

  // Returns array of { type, points } events for this frame
  update(dt, scrollX, kafka) {
    this._time += dt;

    // Spawn ahead
    const spawnFrontier = scrollX + SPAWN_LOOKAHEAD;
    while (this._nextSpawnX < spawnFrontier) {
      this._spawnItem(this._nextSpawnX);
      const gap = MIN_SPAWN_GAP + Math.random() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP);
      this._nextSpawnX += gap;
    }

    // Birds drift left slowly — creates a gentle chase
    for (const item of this.items) {
      if (item.type === 'bird' && !item.collected) {
        item.worldX -= item.speed * dt;
        // Bird bobs gently in the air around its spawn height
        item.worldY = item.baseY + Math.sin(this._time * 3 + item.phase) * 8;
      }
    }

    // Cull off-screen
    this.items = this.items.filter(item => item.worldX - scrollX > -80);

    // Collision + collection
    const hb = kafka.getHitbox();
    const events = [];

    for (const item of this.items) {
      if (item.collected) continue;

      const screenX = item.worldX - scrollX;
      const screenY = item.worldY;
      const halfW = 16;
      const halfH = 16;

      if (
        screenX + halfW > hb.x &&
        screenX - halfW < hb.x + hb.w &&
        screenY - halfH < hb.y + hb.h &&
        screenY + halfH > hb.y
      ) {
        item.collected = true;
        kafka.collectBoost(item.energy, item.flashColor);
        events.push({ type: item.type, points: item.points });
      }
    }

    this.items = this.items.filter(i => !i.collected);
    return events;
  }

  render(ctx, scrollX) {
    ctx.save();
    ctx.globalAlpha = 1;

    for (const item of this.items) {
      if (item.collected) continue;

      const screenX = item.worldX - scrollX;
      const screenY = item.worldY;

      if (screenX < -50 || screenX > this.canvasWidth + 50) continue;

      const bob = Math.sin(this._time * 2.5 + item.phase) * 4;

      ctx.font = `${FONT_SIZE}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.globalAlpha = 1;
      ctx.fillText(item.emoji, screenX, screenY + bob);

      // Subtle glow ellipse on ground
      const glowAlpha = 0.12 + Math.sin(this._time * 2.5 + item.phase) * 0.06;
      ctx.globalAlpha = glowAlpha;
      ctx.fillStyle = item.glowColor;
      ctx.beginPath();
      ctx.ellipse(screenX, screenY + 2, 14, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    ctx.restore();
  }

  // Router — picks what to spawn based on weighted random + time of day
  _spawnItem(worldX) {
    const roll = Math.random();

    if (roll < 0.10) {
      this._spawnBox(worldX);       // 10% — boxes everywhere, any time
    } else if (roll < 0.25) {
      if (!this.isNight) this._spawnBird(worldX); // 15% chance, day only
      else this._spawnTreat(worldX);
    } else {
      this._spawnTreat(worldX);     // default
    }
  }

  _spawnTreat(worldX) {
    // Day: common. Night: rare (70% skip chance)
    if (this.isNight && Math.random() < 0.70) return;

    const emoji = SWEET_TREATS[Math.floor(Math.random() * SWEET_TREATS.length)];

    this.items.push({
      type:       'treat',
      emoji,
      worldX,
      worldY:     this.groundY - 4,
      energy:     TREAT_ENERGY,
      points:     TREAT_POINTS,
      flashColor: FLASH_TREAT,
      glowColor:  '#ff69b4',
      phase:      Math.random() * Math.PI * 2,
      collected:  false,
    });
  }

  _spawnBird(worldX) {
    // Birds appear ahead and drift left — Kafka has to move to catch them
    const BIRD_EMOJIS = ['🐦', '🐦', '🐦', '🐤'];  // mostly blue, occasional chick
    const emoji = BIRD_EMOJIS[Math.floor(Math.random() * BIRD_EMOJIS.length)];

    this.items.push({
      type:       'bird',
      emoji,
      worldX:     worldX + 200,   // spawn further ahead so chase has room
      worldY:     this.groundY - 90,  // in the air — must jump to reach
      baseY:      this.groundY - 130,  // bob anchor
      energy:     BIRD_ENERGY,
      points:     BIRD_POINTS,
      flashColor: FLASH_TREAT,
      glowColor:  '#a0d8ef',
      phase:      Math.random() * Math.PI * 2,
      speed:      60 + Math.random() * 40,  // px/s leftward drift
      collected:  false,
    });
  }

  _spawnBox(worldX) {
    this.items.push({
      type:       'box',
      emoji:      '📦',
      worldX,
      worldY:     this.groundY - 2,
      energy:     BOX_ENERGY,
      points:     BOX_POINTS,
      flashColor: FLASH_TREAT,
      glowColor:  '#d4a96a',
      phase:      Math.random() * Math.PI * 2,
      collected:  false,
    });
  }
}