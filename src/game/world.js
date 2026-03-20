// world.js — procedural world generation, chunk management, rendering

const CHUNK_WIDTH = 400;
const GROUND_HEIGHT = 80;

// Zone definitions
export const ZONES = {
  residential: {
    id: 'residential',
    label: '🏡 Residential',
    skyDay: '#87CEEB',
    skyNight: '#0d1b3e',
    groundColor: '#c8b89a',
    sidewalkColor: '#d4c9b8',
    buildingColors: ['#e8d5b7', '#c9b99a', '#d4a574', '#b8a888'],
    accentColors: ['#8B7355', '#6B8E23'],
    emoji: ['🌳', '🌷', '🏠', '🌸', '🌻', '🚗'],
  },
  alley: {
    id: 'alley',
    label: '🧺 Back Alley',
    skyDay: '#9aacb8',
    skyNight: '#0a1220',
    groundColor: '#7a7a7a',
    sidewalkColor: '#888888',
    buildingColors: ['#5c5c5c', '#4a4a4a', '#6b4c4c', '#3d3d3d'],
    accentColors: ['#8B0000', '#2F4F4F'],
    emoji: ['🗑️', '🧺', '📦', '🚪', '💡'],
  },
  market: {
    id: 'market',
    label: '🏪 Market Lane',
    skyDay: '#f5e6c8',
    skyNight: '#1a1230',
    groundColor: '#c4a882',
    sidewalkColor: '#d4b892',
    buildingColors: ['#f0d090', '#e8c878', '#f5deb3', '#daa520'],
    accentColors: ['#FF6347', '#228B22'],
    emoji: ['🛒', '🍎', '🌂', '🍊', '🍋'],
  },
  park: {
    id: 'park',
    label: '🌳 Park',
    skyDay: '#a8d8a8',
    skyNight: '#0d2010',
    groundColor: '#5a8a3a',
    sidewalkColor: '#6a9a4a',
    buildingColors: ['#4a7a2a', '#3d6b2a', '#5c8c3c'],
    accentColors: ['#228B22', '#8B4513'],
    emoji: ['🌳', '🌲', '🌸', '🦆', '⛲', '🐦'],
  },
};

const ZONE_ORDER = ['residential', 'alley', 'market', 'park'];

export class World {
  constructor(canvasWidth, canvasHeight, isNight) {
    this.canvasWidth = canvasWidth;
    this.canvasHeight = canvasHeight;
    this.isNight = isNight;

    this.scrollX = 0;     // total world scroll distance
    this.scrollSpeed = 180; // px/s base — modified by Kafka's vx

    this.groundY = canvasHeight - GROUND_HEIGHT;
    this.groundH = GROUND_HEIGHT;

    this.chunks = [];
    this.chunkCursor = 0; // x position of next chunk to generate

    this.zoneIndex = 0;
    this.currentZone = ZONES[ZONE_ORDER[0]];
    this.nextZone = null;
    this.zoneTransition = 0; // 0–1 blend

    // Parallax layers
    this.bgBuildings = [];  // 0.3x
    this.mgElements = [];   // 0.6x

    // Decorative emoji on ground/mid layer
    this.decorations = [];

    // Clouds / stars
    this.skyObjects = [];

    this._initSkyObjects();
    this._generateChunks(canvasWidth * 3);
  }

  _initSkyObjects() {
    if (this.isNight) {
      // Stars
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
      this.skyObjects.push({
        type: 'moon',
        x: this.canvasWidth * 0.75,
        y: 60,
        emoji: '🌙',
        parallax: 0.08,
        size: 28,
      });
    } else {
      // Clouds
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
      this.skyObjects.push({
        type: 'sun',
        x: this.canvasWidth * 0.8,
        y: 50,
        emoji: '☀️',
        parallax: 0.05,
        size: 30,
      });
    }
  }

  _generateChunks(upTo) {
    while (this.chunkCursor < upTo) {
      this._generateChunk(this.chunkCursor);
      this.chunkCursor += CHUNK_WIDTH;
    }
  }

  _generateChunk(startX) {
    const zoneIdx = Math.floor(startX / (CHUNK_WIDTH * 6)) % ZONE_ORDER.length;
    const zone = ZONES[ZONE_ORDER[zoneIdx]];

    // Background building
    const buildingCount = 2 + Math.floor(Math.random() * 2);
    for (let i = 0; i < buildingCount; i++) {
      const bx = startX + (i / buildingCount) * CHUNK_WIDTH + Math.random() * 40;
      const bw = 40 + Math.random() * 60;
      const bh = 60 + Math.random() * 100;
      const color = zone.buildingColors[Math.floor(Math.random() * zone.buildingColors.length)];
      this.bgBuildings.push({ x: bx, w: bw, h: bh, color, zone: zone.id, windows: this._makeWindows(bx, bw, bh) });
    }

    // Mid-ground decorations
    const decoCount = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < decoCount; i++) {
      const dx = startX + Math.random() * CHUNK_WIDTH;
      const emoji = zone.emoji[Math.floor(Math.random() * zone.emoji.length)];
      this.decorations.push({
        x: dx,
        y: this.groundY,
        emoji,
        size: 22 + Math.random() * 10,
        parallax: 0.85,
      });
    }

    this.chunks.push({ startX, endX: startX + CHUNK_WIDTH, zone: zone.id });
  }

  _makeWindows(bx, bw, bh) {
    const windows = [];
    const rows = Math.floor(bh / 22);
    const cols = Math.floor(bw / 18);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (Math.random() > 0.4) {
          windows.push({
            rx: (c / cols) * bw + 4,
            ry: (r / rows) * bh + 4,
            lit: Math.random() > (this.isNight ? 0.3 : 0.8),
          });
        }
      }
    }
    return windows;
  }

  update(dt, kafkaVx) {
    // World scrolls based on Kafka's horizontal speed
    const speed = kafkaVx !== undefined ? kafkaVx : this.scrollSpeed;
    this.scrollX += speed * dt;

    // Cull off-screen elements
    const cullX = this.scrollX - this.canvasWidth * 0.5;
    this.bgBuildings = this.bgBuildings.filter(b => b.x - this.scrollX * 0.3 > -200);
    this.decorations = this.decorations.filter(d => d.x - this.scrollX * d.parallax > -100);

    // Generate more chunks ahead
    const ahead = this.scrollX + this.canvasWidth * 2;
    if (ahead > this.chunkCursor - CHUNK_WIDTH) {
      this._generateChunks(this.chunkCursor + CHUNK_WIDTH * 4);
    }

    // Zone transition
    if (this.zoneTransition > 0) {
      this.zoneTransition = Math.min(1, this.zoneTransition + dt / 3);
      if (this.zoneTransition >= 1) {
        this.currentZone = this.nextZone;
        this.nextZone = null;
        this.zoneTransition = 0;
      }
    }
  }

  _getSkyColor() {
    const z = this.currentZone;
    return this.isNight ? z.skyNight : z.skyDay;
  }

  render(ctx, isNight, twilightAlpha) {
    const w = this.canvasWidth;
    const h = this.canvasHeight;

    // 1. Sky
    ctx.fillStyle = this._getSkyColor();
    ctx.fillRect(0, 0, w, h);

    // Twilight gradient
    if (twilightAlpha > 0) {
      const grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
      grad.addColorStop(0, `rgba(255, 120, 50, ${twilightAlpha * 0.4})`);
      grad.addColorStop(1, `rgba(255, 60, 20, 0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h * 0.6);
    }

    // Night vignette
    if (isNight) {
      const vignette = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.9);
      vignette.addColorStop(0, 'rgba(0,0,0,0)');
      vignette.addColorStop(1, 'rgba(0,0,20,0.55)');
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);
    }

    // 2. Sky objects (stars/moon or sun/clouds)
    ctx.save();
    for (const obj of this.skyObjects) {
      const sx = obj.x - this.scrollX * obj.parallax;
      // Wrap horizontally
      const wx = ((sx % (w * 3)) + w * 3) % (w * 3) - w;
      if (wx > -50 && wx < w + 50) {
        ctx.font = `${obj.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(obj.emoji, wx, obj.y);
      }
    }
    ctx.restore();

    // 3. Background buildings (parallax 0.3)
    this._renderBuildings(ctx, isNight);

    // 4. Ground plane
    const groundGrad = ctx.createLinearGradient(0, this.groundY, 0, h);
    groundGrad.addColorStop(0, this.currentZone.sidewalkColor);
    groundGrad.addColorStop(0.3, this.currentZone.groundColor);
    groundGrad.addColorStop(1, isNight ? '#1a1a2e' : '#8B7355');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, this.groundY, w, this.groundH);

    // Ground line detail
    ctx.strokeStyle = isNight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.groundY);
    ctx.lineTo(w, this.groundY);
    ctx.stroke();

    // Sidewalk tiles
    ctx.strokeStyle = isNight ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
    ctx.lineWidth = 1;
    const tileW = 60;
    const offsetX = (-(this.scrollX * 0.9) % tileW + tileW) % tileW;
    for (let tx = offsetX - tileW; tx < w + tileW; tx += tileW) {
      ctx.beginPath();
      ctx.moveTo(tx, this.groundY);
      ctx.lineTo(tx, this.groundY + 20);
      ctx.stroke();
    }

    // 5. Mid-ground decorations
    ctx.save();
    for (const deco of this.decorations) {
      const dx = deco.x - this.scrollX * deco.parallax;
      if (dx > -50 && dx < w + 50) {
        ctx.font = `${deco.size}px serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';
        ctx.fillText(deco.emoji, dx, deco.y);
      }
    }
    ctx.restore();

    // Night lamppost pools
    if (isNight) {
      this._renderLampposts(ctx);
    }
  }

  _renderBuildings(ctx, isNight) {
    for (const b of this.bgBuildings) {
      const bx = b.x - this.scrollX * 0.3;
      if (bx > -b.w - 10 && bx < this.canvasWidth + 10) {
        const by = this.groundY - b.h;

        // Building body
        ctx.fillStyle = isNight ? this._darken(b.color, 0.45) : b.color;
        ctx.fillRect(bx, by, b.w, b.h);

        // Roof detail
        ctx.fillStyle = isNight ? this._darken(b.color, 0.6) : this._darken(b.color, 0.15);
        ctx.fillRect(bx, by, b.w, 4);

        // Windows
        for (const win of b.windows) {
          const wx = bx + win.rx;
          const wy = by + win.ry;
          const ww = Math.max(6, b.w * 0.15);
          const wh = Math.max(6, b.h * 0.08);

          if (isNight && win.lit) {
            // Warm glow
            const glow = ctx.createRadialGradient(wx + ww / 2, wy + wh / 2, 0, wx + ww / 2, wy + wh / 2, ww * 1.5);
            glow.addColorStop(0, 'rgba(255, 220, 100, 0.3)');
            glow.addColorStop(1, 'rgba(255, 200, 50, 0)');
            ctx.fillStyle = glow;
            ctx.fillRect(wx - ww, wy - wh, ww * 3, wh * 3);
            ctx.fillStyle = '#ffd86e';
          } else if (!isNight) {
            ctx.fillStyle = 'rgba(180, 210, 240, 0.6)'; // daytime glass
          } else {
            ctx.fillStyle = 'rgba(30, 30, 50, 0.8)'; // unlit night window
          }
          ctx.fillRect(wx, wy, ww, wh);
        }
      }
    }
  }

  _renderLampposts(ctx) {
    const w = this.canvasWidth;
    const lampSpacing = 220;
    const offsetX = (-(this.scrollX * 0.9) % lampSpacing + lampSpacing) % lampSpacing;

    for (let lx = offsetX - lampSpacing; lx < w + lampSpacing; lx += lampSpacing) {
      // Pole
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(lx, this.groundY);
      ctx.lineTo(lx, this.groundY - 70);
      ctx.lineTo(lx + 15, this.groundY - 80);
      ctx.stroke();

      // Light cone
      const cone = ctx.createRadialGradient(lx + 15, this.groundY - 80, 2, lx + 15, this.groundY - 60, 80);
      cone.addColorStop(0, 'rgba(255, 240, 150, 0.35)');
      cone.addColorStop(0.5, 'rgba(255, 220, 80, 0.12)');
      cone.addColorStop(1, 'rgba(255, 200, 50, 0)');
      ctx.fillStyle = cone;
      ctx.beginPath();
      ctx.arc(lx + 15, this.groundY - 60, 80, 0, Math.PI * 2);
      ctx.fill();

      // Lamp emoji
      ctx.font = '18px serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('💡', lx + 15, this.groundY - 82);
    }
  }

  _darken(hex, amount) {
    // Simple hex darkening
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
    const g = Math.max(0, ((num >> 8) & 0xff) - Math.round(255 * amount));
    const b = Math.max(0, (num & 0xff) - Math.round(255 * amount));
    return `rgb(${r},${g},${b})`;
  }

  getGroundY() {
    return this.groundY;
  }
}
