// boosts.js — boost item spawning, rendering, collection detection

const SWEET_TREATS = ['🍩', '🎂', '🍰', '🧁', '🍪', '🍫'];

const FONT_SIZE = 26;

// How far ahead of the current scroll position to spawn
const SPAWN_LOOKAHEAD = 800;

// Minimum gap between spawns (world units)
const MIN_SPAWN_GAP = 350;
const MAX_SPAWN_GAP = 700;

// Energy values
const TREAT_ENERGY   = 0.20;
const MOUSE_ENERGY   = 0.35;
const MILK_ENERGY    = 1.00; // full restore

// Flash colours (per PRD)
const FLASH_TREAT  = '#ffb3c6';  // soft pink
const FLASH_MOUSE  = '#ffd700';  // warm gold
const FLASH_MILK   = '#e8f4ff';  // cool white
const FLASH_MAGIC  = '#7b2fff';  // deep violet — nowhere else in the game

export class BoostManager {
  constructor(canvasWidth, canvasHeight, isNight) {
    this.canvasWidth  = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.isNight      = isNight;

    this.groundY = canvasHeight - 80;

    // Active boost items in world space
    this.items = [];

    // World-x cursor — next spawn will be placed beyond this
    this._nextSpawnX = SPAWN_LOOKAHEAD;

    // Bob animation time
    this._time = 0;
  }

  // Called each fixed timestep by the engine
  update(dt, scrollX, kafka) {
    this._time += dt;

    // Spawn new treats ahead of current scroll position
    const spawnFrontier = scrollX + SPAWN_LOOKAHEAD;
    while (this._nextSpawnX < spawnFrontier) {
      this._spawnTreat(this._nextSpawnX);
      const gap = MIN_SPAWN_GAP + Math.random() * (MAX_SPAWN_GAP - MIN_SPAWN_GAP);
      this._nextSpawnX += gap;
    }

    // Cull items that have scrolled off the left edge
    this.items = this.items.filter(item => {
      const screenX = item.worldX - scrollX;
      return screenX > -60;
    });

    // Collision detection against Kafka's hitbox
    const hb = kafka.getHitbox();
    for (const item of this.items) {
      if (item.collected) continue;

      const screenX = item.worldX - scrollX;
      const screenY = item.worldY;

      // Simple AABB — treat is roughly 26×26px centred on screenX, screenY
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
      }
    }

    // Remove collected items
    this.items = this.items.filter(i => !i.collected);
  }

  render(ctx, scrollX) {
    ctx.save();
    ctx.globalAlpha = 1;

    for (const item of this.items) {
      if (item.collected) continue;

      const screenX = item.worldX - scrollX;
      const screenY = item.worldY;

      if (screenX < -50 || screenX > this.canvasWidth + 50) continue;

      // Gentle vertical bob
      const bob = Math.sin(this._time * 2.5 + item.phase) * 4;

      ctx.font = `${FONT_SIZE}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(item.emoji, screenX, screenY + bob);

      // Subtle glow ring underneath
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

  _spawnTreat(worldX) {
    // Day: common. Night: rare (30% chance to skip)
    if (this.isNight && Math.random() < 0.70) return;

    const emoji = SWEET_TREATS[Math.floor(Math.random() * SWEET_TREATS.length)];

    this.items.push({
      type: 'treat',
      emoji,
      worldX,
      worldY: this.groundY - 4,   // sits just above ground
      energy: TREAT_ENERGY,
      flashColor: FLASH_TREAT,
      glowColor: '#ff69b4',
      phase: Math.random() * Math.PI * 2,  // randomise bob phase
      collected: false,
    });
  }
}