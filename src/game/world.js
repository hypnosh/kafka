// world.js — procedural world generation, chunk management, rendering

const CHUNK_WIDTH  = 400;
const GROUND_HEIGHT = 80;

// How many chunks must pass before gaps / elevated platforms can spawn.
// This keeps the opening stretch safe and readable.
const SAFE_CHUNKS = 3;

// Elevation levels above groundY (positive = upward offset)
export const PLATFORM_LEVELS = {
  LOW:  70,   // fence / crate top
  MID:  130,  // window ledge / fire-escape landing
};

// Zone definitions
export const ZONES = {
  residential: {
    id: 'residential',
    label: '🏡 Residential',
    skyDay:       '#87CEEB',
    skyNight:     '#0d1b3e',
    groundColor:  '#c8b89a',
    sidewalkColor:'#d4c9b8',
    buildingColors: ['#e8d5b7', '#c9b99a', '#d4a574', '#b8a888'],
    accentColors:   ['#8B7355', '#6B8E23'],
    // decorative only — no collision
    decorEmoji: ['🌷', '🌸', '🌻'],
    // platform surface labels
    platformEmoji: ['🪵', '📦'],
    gapEmoji: null, // gaps look like missing sidewalk
  },
  alley: {
    id: 'alley',
    label: '🧺 Back Alley',
    skyDay:       '#9aacb8',
    skyNight:     '#0a1220',
    groundColor:  '#7a7a7a',
    sidewalkColor:'#888888',
    buildingColors: ['#5c5c5c', '#4a4a4a', '#6b4c4c', '#3d3d3d'],
    accentColors:   ['#8B0000', '#2F4F4F'],
    decorEmoji: ['🗑️', '🧺', '📦'],
    platformEmoji: ['🗑️', '📦'],
    gapEmoji: null,
  },
  market: {
    id: 'market',
    label: '🏪 Market Lane',
    skyDay:       '#f5e6c8',
    skyNight:     '#1a1230',
    groundColor:  '#c4a882',
    sidewalkColor:'#d4b892',
    buildingColors: ['#f0d090', '#e8c878', '#f5deb3', '#daa520'],
    accentColors:   ['#FF6347', '#228B22'],
    decorEmoji: ['🛒', '🍎', '🌂', '🍊'],
    platformEmoji: ['🛒', '📦'],
    gapEmoji: null,
  },
  park: {
    id: 'park',
    label: '🌳 Park',
    skyDay:       '#a8d8a8',
    skyNight:     '#0d2010',
    groundColor:  '#5a8a3a',
    sidewalkColor:'#6a9a4a',
    buildingColors: ['#4a7a2a', '#3d6b2a', '#5c8c3c'],
    accentColors:   ['#228B22', '#8B4513'],
    decorEmoji: ['🌸', '🦆', '🐦', '🌾'],
    platformEmoji: ['🪵', '🌳'],
    gapEmoji: null,
  },
};

const ZONE_ORDER = ['residential', 'alley', 'market', 'park'];

export class World {
  constructor(canvasWidth, canvasHeight, isNight) {
    this.canvasWidth  = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.isNight      = isNight;

    this.scrollX      = 0;
    this.groundY      = canvasHeight - GROUND_HEIGHT;
    this.groundH      = GROUND_HEIGHT;

    this.chunkCursor  = 0;
    this.chunkIndex   = 0; // counts generated chunks for safe-zone logic

    this.currentZone  = ZONES[ZONE_ORDER[0]];
    this.nextZone     = null;
    this.zoneTransition = 0;

    // Layered world objects
    this.bgBuildings  = [];   // parallax 0.3 — decorative only
    this.decorations  = [];   // parallax 0.85 — decorative only, no collision
    this.platforms    = [];   // solid elevated surfaces — full parallax 1.0
    this.gaps         = [];   // holes in the ground — full parallax 1.0
    this.skyObjects   = [];

    this._initSkyObjects();
    this._generateChunks(canvasWidth * 3);
  }

  // ── Sky ────────────────────────────────────────────────────────────────────

  _initSkyObjects() {
    if (this.isNight) {
      for (let i = 0; i < 40; i++) {
        this.skyObjects.push({
          type: 'star',
          x: Math.random() * this.canvasWidth * 4,
          y: Math.random() * (this.canvasHeight * 0.55),
          emoji: Math.random() > 0.7 ? '🌟' : '⭐',
          parallax: 0.05 + Math.random() * 0.1,
          size: 10 + Math.random() * 6,
        });
      }
      this.skyObjects.push({ type: 'moon', x: this.canvasWidth * 0.75, y: 60,
        emoji: '🌙', parallax: 0.08, size: 28 });
    } else {
      for (let i = 0; i < 8; i++) {
        this.skyObjects.push({
          type: 'cloud',
          x: Math.random() * this.canvasWidth * 4,
          y: 30 + Math.random() * 80,
          emoji: '☁️',
          parallax: 0.1 + Math.random() * 0.1,
          size: 20 + Math.random() * 12,
        });
      }
      this.skyObjects.push({ type: 'sun', x: this.canvasWidth * 0.8, y: 50,
        emoji: '☀️', parallax: 0.05, size: 30 });
    }
  }

  // ── Chunk generation ───────────────────────────────────────────────────────

  _generateChunks(upTo) {
    while (this.chunkCursor < upTo) {
      this._generateChunk(this.chunkCursor);
      this.chunkCursor += CHUNK_WIDTH;
      this.chunkIndex++;
    }
  }

  _generateChunk(startX) {
    const zoneIdx = Math.floor(startX / (CHUNK_WIDTH * 6)) % ZONE_ORDER.length;
    const zone    = ZONES[ZONE_ORDER[zoneIdx]];
    this.currentZone = zone;

    // ── Background buildings ─────────────────────────────────────────────────
    const buildingCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < buildingCount; i++) {
      const bx    = startX + (i / buildingCount) * CHUNK_WIDTH + Math.random() * 40;
      const bw    = 40 + Math.random() * 60;
      const bh    = 60 + Math.random() * 100;
      const color = zone.buildingColors[Math.floor(Math.random() * zone.buildingColors.length)];
      this.bgBuildings.push({
        x: bx, w: bw, h: bh, color,
        zone: zone.id,
        windows: this._makeWindows(bx, bw, bh),
      });
    }

    // ── Decorations (cosmetic, no collision) ─────────────────────────────────
    const decoCount = 1 + Math.floor(Math.random() * 3);
    for (let i = 0; i < decoCount; i++) {
      const emoji = zone.decorEmoji[Math.floor(Math.random() * zone.decorEmoji.length)];
      this.decorations.push({
        x:        startX + Math.random() * CHUNK_WIDTH,
        y:        this.groundY,
        emoji,
        size:     22 + Math.random() * 10,
        parallax: 0.85,
      });
    }

    // ── Platforms and gaps (only after safe zone) ─────────────────────────────
    if (this.chunkIndex >= SAFE_CHUNKS) {
      // Difficulty ramps with distance — more likely to have content the further we go
      const difficultyT = Math.min(1, (this.chunkIndex - SAFE_CHUNKS) / 20);
      this._maybeAddPlatform(startX, zone, difficultyT);
      this._maybeAddGap(startX, difficultyT);
    }
  }

  _maybeAddPlatform(startX, zone, t) {
    // Base 40% chance, rises to 75% at full difficulty
    const chance = 0.4 + t * 0.35;
    if (Math.random() > chance) return;

    // Pick an elevation level — MID platforms are rarer
    const level  = Math.random() < 0.7 ? PLATFORM_LEVELS.LOW : PLATFORM_LEVELS.MID;
    const pY     = this.groundY - level;

    // Width: 80–200px. Narrower platforms are harder.
    const minW   = 80;
    const maxW   = 200 - t * 80; // narrows slightly with difficulty
    const pW     = minW + Math.random() * Math.max(0, maxW - minW);

    // Position within chunk — keep away from edges so it never appears right at a gap edge
    const margin = 60;
    const pX     = startX + margin + Math.random() * (CHUNK_WIDTH - margin * 2 - pW);

    const emoji  = zone.platformEmoji[Math.floor(Math.random() * zone.platformEmoji.length)];
    const color  = zone.buildingColors[Math.floor(Math.random() * zone.buildingColors.length)];

    this.platforms.push({
      x: pX,
      y: pY,         // top surface y — Kafka lands here
      w: pW,
      h: 16,         // visual thickness of the platform slab
      level,
      emoji,
      color,
    });
  }

  _maybeAddGap(startX, t) {
    // Base 25% chance, rises to 55%
    const chance = 0.25 + t * 0.30;
    if (Math.random() > chance) return;

    // Gap width: 60–140px. Wide gaps need a jump or a platform above.
    const minW = 60;
    const maxW = 60 + t * 80;
    const gW   = minW + Math.random() * (maxW - minW);

    // Never start a gap within 80px of the chunk boundary — prevents
    // two adjacent chunks stacking gaps into an unjumpable void
    const margin = 80;
    const gX     = startX + margin + Math.random() * (CHUNK_WIDTH - margin * 2 - gW);

    this.gaps.push({
      x: gX,
      w: gW,
      // Bottom of gap = bottom of canvas — death zone
      bottomY: this.canvasHeight + 40,
    });
  }

  _makeWindows(bx, bw, bh) {
    const windows = [];
    const rows = Math.floor(bh / 22);
    const cols = Math.floor(bw / 18);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.4) {
          windows.push({
            rx:  (c / cols) * bw + 4,
            ry:  (r / rows) * bh + 4,
            lit: Math.random() > (this.isNight ? 0.3 : 0.8),
          });
        }
      }
    }
    return windows;
  }

  // ── Update ─────────────────────────────────────────────────────────────────

  update(dt, kafkaVx) {
    const speed   = (kafkaVx !== undefined) ? kafkaVx : 0;
    this.scrollX += speed * dt;

    // Cull elements that have scrolled well off the left edge
    const cullLeft = this.scrollX - this.canvasWidth * 0.5;
    this.bgBuildings = this.bgBuildings.filter(b => (b.x - this.scrollX * 0.3) > -300);
    this.decorations = this.decorations.filter(d => (d.x - this.scrollX * d.parallax) > -120);
    // Platforms and gaps scroll 1:1 with the world
    this.platforms   = this.platforms.filter(p => (p.x + p.w - this.scrollX) > -100);
    this.gaps        = this.gaps.filter(g => (g.x + g.w - this.scrollX) > -100);

    // Generate more chunks ahead
    const ahead = this.scrollX + this.canvasWidth * 2;
    if (ahead > this.chunkCursor - CHUNK_WIDTH) {
      this._generateChunks(this.chunkCursor + CHUNK_WIDTH * 4);
    }

    // Zone transition blend
    if (this.zoneTransition > 0) {
      this.zoneTransition = Math.min(1, this.zoneTransition + dt / 3);
      if (this.zoneTransition >= 1) {
        this.currentZone    = this.nextZone;
        this.nextZone       = null;
        this.zoneTransition = 0;
      }
    }
  }

  // ── Physics helpers (called by physics.js) ─────────────────────────────────

  /**
   * Returns the Y of the surface Kafka is standing on at screen-space x,
   * or null if she is over a gap.
   *
   * screenX — Kafka's current screen x position
   * worldX  — Kafka's world x = scrollX + (screenX - referenceX), but since
   *            we track world coords in chunk data we need to compare against
   *            (chunkX - scrollX) for the screen position.
   *
   * Simpler: we store everything in world coords and convert to screen here.
   */
  getGroundAtScreen(screenX) {
    // Convert screen x → world x
    const worldX = this.scrollX + screenX;
    return this.getGroundAt(worldX);
  }

  /**
   * Returns { surfaceY, isGap } for a given world-space x.
   * surfaceY — the Y coordinate Kafka should stand on (groundY or platform top)
   * isGap    — true if this x is over a hole (Kafka falls to death)
   */
  getGroundAt(worldX) {
    // Check gaps first — gap = no ground
    for (const g of this.gaps) {
      if (worldX >= g.x && worldX <= g.x + g.w) {
        return { surfaceY: null, isGap: true };
      }
    }

    // Check platforms — return the highest one Kafka could be standing on
    let bestPlatform = null;
    for (const p of this.platforms) {
      if (worldX >= p.x && worldX <= p.x + p.w) {
        if (!bestPlatform || p.y < bestPlatform.y) {
          bestPlatform = p;
        }
      }
    }
    if (bestPlatform) {
      return { surfaceY: bestPlatform.y, isGap: false, platform: bestPlatform };
    }

    // Default: flat ground
    return { surfaceY: this.groundY, isGap: false };
  }

  /**
   * Returns all platforms whose screen rect overlaps the given screen AABB.
   * Used by physics for ceiling / side collision.
   */
  getPlatformsInScreenRect(sx, sy, sw, sh) {
    const result = [];
    for (const p of this.platforms) {
      const px = p.x - this.scrollX;
      if (px + p.w < sx || px > sx + sw) continue;
      if (p.y + p.h < sy || p.y > sy + sh) continue;
      result.push({ ...p, screenX: px });
    }
    return result;
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  _getSkyColor() {
    return this.isNight ? this.currentZone.skyNight : this.currentZone.skyDay;
  }

  render(ctx, isNight, twilightAlpha) {
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    // 1 — Sky
    ctx.fillStyle = this._getSkyColor();
    ctx.fillRect(0, 0, w, h);

    // Twilight wash
    if (twilightAlpha > 0) {
      const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      grad.addColorStop(0, `rgba(255,120,50,${twilightAlpha * 0.4})`);
      grad.addColorStop(1, `rgba(255,60,20,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h * 0.6);
    }

    // Night vignette
    if (isNight) {
      const vig = ctx.createRadialGradient(w/2, h/2, h*0.2, w/2, h/2, h*0.9);
      vig.addColorStop(0, 'rgba(0,0,0,0)');
      vig.addColorStop(1, 'rgba(0,0,20,0.55)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);
    }

    // 2 — Sky objects
    ctx.save();
    for (const obj of this.skyObjects) {
      const sx = obj.x - this.scrollX * obj.parallax;
      const wx = ((sx % (w * 3)) + w * 3) % (w * 3) - w;
      if (wx > -50 && wx < w + 50) {
        ctx.font         = `${obj.size}px serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.emoji, wx, obj.y);
      }
    }
    ctx.restore();

    // 3 — Background buildings
    this._renderBuildings(ctx, isNight);

    // 4 — Ground plane (with gaps cut out)
    this._renderGround(ctx, isNight);

    // 5 — Platforms (elevated surfaces)
    this._renderPlatforms(ctx, isNight);

    // 6 — Decorations (cosmetic, in front of ground)
    ctx.save();
    for (const deco of this.decorations) {
      const dx = deco.x - this.scrollX * deco.parallax;
      if (dx > -50 && dx < w + 50) {
        ctx.font         = `${deco.size}px serif`;
        ctx.textAlign    = 'center';
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha  = 1;
        ctx.fillText(deco.emoji, dx, deco.y);
      }
    }
    ctx.restore();

    // 7 — Night lampposts
    if (isNight) this._renderLampposts(ctx);
  }

  _renderGround(ctx, isNight) {
    const w = this.canvasWidth;

    // Full ground rect first
    const groundGrad = ctx.createLinearGradient(0, this.groundY, 0, this.canvasHeight);
    groundGrad.addColorStop(0,   this.currentZone.sidewalkColor);
    groundGrad.addColorStop(0.3, this.currentZone.groundColor);
    groundGrad.addColorStop(1,   isNight ? '#1a1a2e' : '#8B7355');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, this.groundY, w, this.groundH);

    // Cut gaps out — paint sky/void colour over each gap
    for (const g of this.gaps) {
      const gx = g.x - this.scrollX;
      if (gx + g.w < 0 || gx > w) continue;

      // Dark pit below each gap
      const pitGrad = ctx.createLinearGradient(0, this.groundY, 0, this.canvasHeight);
      pitGrad.addColorStop(0, isNight ? '#050510' : '#1a0e08');
      pitGrad.addColorStop(1, '#000000');
      ctx.fillStyle = pitGrad;
      ctx.fillRect(gx, this.groundY, g.w, this.groundH);

      // Crumbled edge hints (left and right lip)
      ctx.fillStyle = isNight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.15)';
      ctx.fillRect(gx - 3,       this.groundY, 3,  6);
      ctx.fillRect(gx + g.w,     this.groundY, 3,  6);
    }

    // Ground line
    ctx.strokeStyle = isNight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth   = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(w, this.groundY);
    ctx.stroke();

    // Sidewalk tile lines — skip over gaps
    ctx.strokeStyle = isNight ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth   = 1;
    const tileW     = 60;
    const offsetX   = (-(this.scrollX * 0.9) % tileW + tileW) % tileW;
    for (let tx = offsetX - tileW; tx < w + tileW; tx += tileW) {
      // Only draw if this tile doesn't fall inside a gap
      const worldTX = tx + this.scrollX;
      const inGap   = this.gaps.some(g => worldTX >= g.x && worldTX <= g.x + g.w);
      if (inGap) continue;
      ctx.beginPath();
      ctx.moveTo(tx, this.groundY);
      ctx.lineTo(tx, this.groundY + 20);
      ctx.stroke();
    }
  }

  _renderPlatforms(ctx, isNight) {
    for (const p of this.platforms) {
      const px = p.x - this.scrollX;
      if (px + p.w < 0 || px > this.canvasWidth) continue;

      const surfaceY = p.y;
      const slabH    = p.h; // 16px

      // Slab body
      ctx.fillStyle = isNight ? this._darken(p.color, 0.4) : p.color;
      ctx.fillRect(px, surfaceY, p.w, slabH);

      // Top highlight line
      ctx.fillStyle = isNight ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.35)';
      ctx.fillRect(px, surfaceY, p.w, 2);

      // Bottom shadow line
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(px, surfaceY + slabH - 2, p.w, 2);

      // Support columns down to ground (visual only)
      const colW  = 6;
      const colY  = surfaceY + slabH;
      const colH  = this.groundY - colY;
      ctx.fillStyle = isNight ? 'rgba(80,60,40,0.5)' : 'rgba(100,75,50,0.45)';
      // Left column
      ctx.fillRect(px + 8, colY, colW, colH);
      // Right column
      ctx.fillRect(px + p.w - 8 - colW, colY, colW, colH);

      // Emoji label on left side of platform
      if (p.emoji) {
        ctx.save();
        ctx.font         = '16px serif';
        ctx.textAlign    = 'left';
        ctx.textBaseline = 'bottom';
        ctx.globalAlpha  = 0.7;
        ctx.fillText(p.emoji, px + 4, surfaceY);
        ctx.restore();
      }
    }
  }

  _renderBuildings(ctx, isNight) {
    for (const b of this.bgBuildings) {
      const bx = b.x - this.scrollX * 0.3;
      if (bx > -b.w - 10 && bx < this.canvasWidth + 10) {
        const by = this.groundY - b.h;

        ctx.fillStyle = isNight ? this._darken(b.color, 0.45) : b.color;
        ctx.fillRect(bx, by, b.w, b.h);

        ctx.fillStyle = isNight ? this._darken(b.color, 0.6) : this._darken(b.color, 0.15);
        ctx.fillRect(bx, by, b.w, 4);

        for (const win of b.windows) {
          const wx = bx + win.rx;
          const wy = by + win.ry;
          const ww = Math.max(6, b.w * 0.15);
          const wh = Math.max(6, b.h * 0.08);

          if (isNight && win.lit) {
            const glow = ctx.createRadialGradient(wx+ww/2, wy+wh/2, 0, wx+ww/2, wy+wh/2, ww*1.5);
            glow.addColorStop(0, 'rgba(255,220,100,0.3)');
            glow.addColorStop(1, 'rgba(255,200,50,0)');
            ctx.fillStyle = glow;
            ctx.fillRect(wx - ww, wy - wh, ww * 3, wh * 3);
            ctx.fillStyle = '#ffd86e';
          } else if (!isNight) {
            ctx.fillStyle = 'rgba(180,210,240,0.6)';
          } else {
            ctx.fillStyle = 'rgba(30,30,50,0.8)';
          }
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
    }
  }

  _renderLampposts(ctx) {
    const w           = this.canvasWidth;
    const lampSpacing = 220;
    const offsetX     = (-(this.scrollX * 0.9) % lampSpacing + lampSpacing) % lampSpacing;

    for (let lx = offsetX - lampSpacing; lx < w + lampSpacing; lx += lampSpacing) {
      ctx.strokeStyle = '#555';
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.moveTo(lx, this.groundY);
      ctx.lineTo(lx, this.groundY - 70);
      ctx.lineTo(lx + 15, this.groundY - 80);
      ctx.stroke();

      const cone = ctx.createRadialGradient(lx+15, this.groundY-80, 2, lx+15, this.groundY-60, 80);
      cone.addColorStop(0,   'rgba(255,240,150,0.35)');
      cone.addColorStop(0.5, 'rgba(255,220,80,0.12)');
      cone.addColorStop(1,   'rgba(255,200,50,0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.arc(lx + 15, this.groundY - 60, 80, 0, Math.PI * 2);
      ctx.fill();

      ctx.font         = '18px serif';
      ctx.textAlign    = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💡', lx + 15, this.groundY - 82);
    }
  }

  _darken(hex, amount) {
    const num = parseInt(hex.replace('#', ''), 16);
    const r   = Math.max(0, (num >> 16)        - Math.round(255 * amount));
    const g   = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
    const b   = Math.max(0, (num & 0xff)        - Math.round(255 * amount));
    return `rgb(${r},${g},${b})`;
  }

  getGroundY() { return this.groundY; }
}