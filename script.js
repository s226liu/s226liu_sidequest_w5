const canvas = document.getElementById("scene");
const ctx = canvas.getContext("2d");
const statusEl = document.getElementById("status");
const winScreenEl = document.getElementById("win-screen");
const restartBtnEl = document.getElementById("restart-btn");

const SCENE_DATA = {
  world: { width: 4300, height: 2600 },
  waypoints: [
    { x: 340, y: 1180, hold: 2.5 },
    { x: 870, y: 820, hold: 2.0 },
    { x: 1450, y: 980, hold: 2.0 },
    { x: 1980, y: 700, hold: 3.0 },
    { x: 2560, y: 1120, hold: 2.5 },
    { x: 3120, y: 860, hold: 2.0 },
    { x: 3800, y: 1270, hold: 4.0 }
  ],
  symbols: [
    { r: 12, glyph: "◍" },
    { r: 12, glyph: "✶" },
    { r: 11, glyph: "⟁" },
    { r: 14, glyph: "◈" },
    { r: 12, glyph: "☽" },
    { r: 12, glyph: "❖" },
    { r: 11, glyph: "◌" }
  ]
};

function constrain(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

class InputController {
  constructor() {
    this.keys = new Set();
    window.addEventListener("keydown", (e) => this.keys.add(e.key.toLowerCase()));
    window.addEventListener("keyup", (e) => this.keys.delete(e.key.toLowerCase()));
  }

  vector() {
    let x = 0;
    let y = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) x -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) x += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) y -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) y += 1;
    return { x, y };
  }
}

class Camera {
  constructor(world, waypoints) {
    this.world = world;
    this.x = 0;
    this.y = 0;
    this.vx = 0;
    this.vy = 0;
    this.waypoints = waypoints;
    this.waypointIndex = 0;
    this.holdTimer = waypoints[0].hold;
    this.reset();
  }

  reset() {
    this.x = this.world.width * 0.1;
    this.y = this.world.height * 0.45;
    this.vx = 0;
    this.vy = 0;
  }

  update(dt, input, viewportW, viewportH) {
    // Player-driven camera so position stays where you leave it.
    this.vx += input.x * 0.2;
    this.vy += input.y * 0.2;

    this.vx = lerp(this.vx, 0, 0.035);
    this.vy = lerp(this.vy, 0, 0.035);

    this.x += this.vx * (dt * 60);
    this.y += this.vy * (dt * 60);

    const marginX = viewportW * 0.5;
    const marginY = viewportH * 0.5;
    this.x = constrain(this.x, marginX, this.world.width - marginX);
    this.y = constrain(this.y, marginY, this.world.height - marginY);
  }

  beginWorldSpace(context, viewportW, viewportH) {
    context.save();
    context.translate(viewportW / 2, viewportH / 2);
    // World Space -> Screen Space bridge:
    context.translate(-this.x, -this.y);
  }

  endWorldSpace(context) {
    context.restore();
  }
}

class Scene {
  constructor(canvas, context, data, status) {
    this.canvas = canvas;
    this.ctx = context;
    this.world = data.world;
    this.statusEl = status;
    this.input = new InputController();
    this.camera = new Camera(this.world, data.waypoints);
    this.lastTime = performance.now();
    this.echoes = [];
    this.won = false;
    this.discoveryRadius = 120;

    this.symbolsTemplate = data.symbols.map((s) => ({ ...s }));
    this.symbols = [];
    this.stars = this.buildStars(440);
    this.petals = this.buildPetals(130);
    this.resetSession();
    restartBtnEl.addEventListener("click", () => this.resetSession());
  }

  buildStars(count) {
    const stars = [];
    for (let i = 0; i < count; i += 1) {
      stars.push({
        x: Math.random() * this.world.width,
        y: Math.random() * this.world.height,
        size: Math.random() * 1.8 + 0.3,
        twinkle: Math.random() * Math.PI * 2
      });
    }
    return stars;
  }

  buildPetals(count) {
    const petals = [];
    for (let i = 0; i < count; i += 1) {
      petals.push({
        x: Math.random() * this.world.width,
        y: Math.random() * this.world.height,
        speed: Math.random() * 0.1 + 0.04,
        sway: Math.random() * 0.7 + 0.2,
        seed: Math.random() * Math.PI * 2
      });
    }
    return petals;
  }

  getDiscoverableBounds() {
    const edgePadding = 120;
    const halfW = this.canvas.width / 2;
    const halfH = this.canvas.height / 2;

    const minX = Math.max(edgePadding, halfW - this.discoveryRadius);
    const maxX = Math.min(this.world.width - edgePadding, this.world.width - halfW + this.discoveryRadius);
    const minY = Math.max(edgePadding, halfH - this.discoveryRadius);
    const maxY = Math.min(this.world.height - edgePadding, this.world.height - halfH + this.discoveryRadius);

    return {
      minX: Math.min(minX, maxX),
      maxX: Math.max(minX, maxX),
      minY: Math.min(minY, maxY),
      maxY: Math.max(minY, maxY)
    };
  }

  keepSymbolsDiscoverable() {
    const bounds = this.getDiscoverableBounds();
    for (const symbol of this.symbols) {
      symbol.x = constrain(symbol.x, bounds.minX, bounds.maxX);
      symbol.y = constrain(symbol.y, bounds.minY, bounds.maxY);
    }
  }

  scatterSymbols() {
    const scattered = [];
    const minDistance = 360;
    const bounds = this.getDiscoverableBounds();

    for (const symbol of this.symbolsTemplate) {
      let placed = false;

      for (let attempt = 0; attempt < 280 && !placed; attempt += 1) {
        const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        const farEnough = scattered.every((existing) => Math.hypot(x - existing.x, y - existing.y) > minDistance);

        if (farEnough) {
          scattered.push({ ...symbol, x, y, found: false });
          placed = true;
        }
      }

      if (!placed) {
        const x = bounds.minX + Math.random() * (bounds.maxX - bounds.minX);
        const y = bounds.minY + Math.random() * (bounds.maxY - bounds.minY);
        scattered.push({ ...symbol, x, y, found: false });
      }
    }

    return scattered;
  }

  resetSession() {
    this.won = false;
    this.echoes = [];
    this.camera.reset();
    this.symbols = this.scatterSymbols();
    this.statusEl.textContent = `Discovered symbols: 0 / ${this.symbols.length}`;
    winScreenEl.classList.add("hidden");
  }

  resize() {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  }

  drawBackground(time) {
    const horizon = lerp(0.26, 0.4, (Math.sin(time * 0.00008) + 1) * 0.5);
    const grad = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
    grad.addColorStop(0, "#32596a");
    grad.addColorStop(horizon, "#244656");
    grad.addColorStop(1, "#0d202a");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawStars(time) {
    for (const star of this.stars) {
      const alpha = 0.2 + (Math.sin(time * 0.002 + star.twinkle) + 1) * 0.25;
      this.ctx.fillStyle = `rgba(223, 238, 224, ${alpha.toFixed(3)})`;
      this.ctx.beginPath();
      this.ctx.arc(star.x * 0.85, star.y * 0.85, star.size, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawIslands(time) {
    for (let i = 0; i < 16; i += 1) {
      const ix = i * 320 + 150;
      const iy = 700 + Math.sin(i * 0.92) * 180;
      const w = 220 + Math.sin(i * 1.37 + time * 0.0002) * 40;
      const h = 80 + Math.cos(i * 0.7 + time * 0.00025) * 20;
      this.ctx.fillStyle = "rgba(123, 170, 153, 0.13)";
      this.ctx.beginPath();
      this.ctx.ellipse(ix * 0.94, iy * 0.94, w, h, 0, 0, Math.PI * 2);
      this.ctx.fill();
    }
  }

  drawPetals(time) {
    this.ctx.strokeStyle = "rgba(203, 219, 204, 0.18)";
    for (const petal of this.petals) {
      const driftX = Math.sin(time * 0.0005 + petal.seed) * petal.sway * 26;
      petal.y += petal.speed;
      if (petal.y > this.world.height + 40) {
        petal.y = -40;
        petal.x = Math.random() * this.world.width;
      }

      this.ctx.beginPath();
      this.ctx.moveTo(petal.x + driftX, petal.y);
      this.ctx.lineTo(petal.x + driftX + 4, petal.y + 9);
      this.ctx.stroke();
    }
  }

  updateAndDrawSymbols(time) {
    let foundCount = 0;

    for (const symbol of this.symbols) {
      const dist = Math.hypot(symbol.x - this.camera.x, symbol.y - this.camera.y);
      const proximity = constrain(1 - dist / 300, 0, 1);
      const pulse = 1 + Math.sin(time * 0.004 + symbol.x) * 0.08;

      if (!symbol.found && dist < this.discoveryRadius) {
        symbol.found = true;
        this.echoes.push({ x: symbol.x, y: symbol.y, t: 0 });
      }

      if (symbol.found) foundCount += 1;

      this.ctx.save();
      this.ctx.translate(symbol.x, symbol.y);
      this.ctx.scale(pulse, pulse);

      const glow = symbol.found ? 0.85 : 0.18 + proximity * 0.42;
      this.ctx.fillStyle = `rgba(240, 245, 231, ${glow.toFixed(3)})`;
      this.ctx.font = "24px Georgia";
      this.ctx.textAlign = "center";
      this.ctx.textBaseline = "middle";
      this.ctx.fillText(symbol.glyph, 0, 0);

      if (!symbol.found && proximity > 0.2) {
        this.ctx.strokeStyle = `rgba(211, 224, 208, ${(proximity * 0.5).toFixed(3)})`;
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, symbol.r + 10 + Math.sin(time * 0.003) * 2, 0, Math.PI * 2);
        this.ctx.stroke();
      }

      this.ctx.restore();
    }

    this.statusEl.textContent = `Discovered symbols: ${foundCount} / ${this.symbols.length}`;
    if (!this.won && foundCount === this.symbols.length) {
      this.won = true;
      winScreenEl.classList.remove("hidden");
    }
  }

  drawEchoes(dt) {
    for (let i = this.echoes.length - 1; i >= 0; i -= 1) {
      const echo = this.echoes[i];
      echo.t += dt;
      const alpha = constrain(1 - echo.t / 2.6, 0, 1);
      const radius = 20 + echo.t * 80;

      this.ctx.strokeStyle = `rgba(233, 244, 230, ${(alpha * 0.45).toFixed(3)})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(echo.x, echo.y, radius, 0, Math.PI * 2);
      this.ctx.stroke();

      if (echo.t >= 2.6) this.echoes.splice(i, 1);
    }
  }

  drawVignette() {
    const grad = this.ctx.createRadialGradient(
      this.canvas.width / 2,
      this.canvas.height / 2,
      Math.min(this.canvas.width, this.canvas.height) * 0.3,
      this.canvas.width / 2,
      this.canvas.height / 2,
      Math.max(this.canvas.width, this.canvas.height) * 0.7
    );
    grad.addColorStop(0, "rgba(0, 0, 0, 0)");
    grad.addColorStop(1, "rgba(3, 8, 10, 0.44)");
    this.ctx.fillStyle = grad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
  }

  drawMiniMap() {
    const mapWidth = 190;
    const mapHeight = 120;
    const pad = 14;
    const x = this.canvas.width - mapWidth - pad;
    const y = this.canvas.height - mapHeight - pad;

    this.ctx.save();
    this.ctx.fillStyle = "rgba(6, 18, 24, 0.7)";
    this.ctx.strokeStyle = "rgba(203, 221, 212, 0.35)";
    this.ctx.lineWidth = 1;
    this.ctx.fillRect(x, y, mapWidth, mapHeight);
    this.ctx.strokeRect(x, y, mapWidth, mapHeight);

    const sx = mapWidth / this.world.width;
    const sy = mapHeight / this.world.height;

    for (const symbol of this.symbols) {
      const mx = x + symbol.x * sx;
      const my = y + symbol.y * sy;
      this.ctx.fillStyle = symbol.found
        ? "rgba(173, 232, 181, 0.9)"
        : "rgba(213, 222, 208, 0.55)";
      this.ctx.beginPath();
      this.ctx.arc(mx, my, 2, 0, Math.PI * 2);
      this.ctx.fill();
    }

    const viewW = this.canvas.width * sx;
    const viewH = this.canvas.height * sy;
    const viewX = x + (this.camera.x - this.canvas.width / 2) * sx;
    const viewY = y + (this.camera.y - this.canvas.height / 2) * sy;

    this.ctx.strokeStyle = "rgba(239, 249, 236, 0.95)";
    this.ctx.lineWidth = 1.2;
    this.ctx.strokeRect(viewX, viewY, viewW, viewH);

    const camX = x + this.camera.x * sx;
    const camY = y + this.camera.y * sy;
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
    this.ctx.beginPath();
    this.ctx.arc(camX, camY, 2.6, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.restore();
  }

  frame = (now) => {
    const dt = Math.min((now - this.lastTime) / 1000, 0.05);
    this.lastTime = now;

    const input = this.input.vector();
    if (!this.won) {
      this.camera.update(dt, input, this.canvas.width, this.canvas.height);
    }

    this.drawBackground(now);
    this.camera.beginWorldSpace(this.ctx, this.canvas.width, this.canvas.height);
    this.drawStars(now);
    this.drawIslands(now);
    this.drawPetals(now);
    this.updateAndDrawSymbols(now);
    this.drawEchoes(dt);
    this.camera.endWorldSpace(this.ctx);
    this.drawVignette();
    this.drawMiniMap();

    requestAnimationFrame(this.frame);
  };

  start() {
    this.resize();
    this.resetSession();
    window.addEventListener("resize", () => {
      this.resize();
      this.keepSymbolsDiscoverable();
    });
    requestAnimationFrame(this.frame);
  }
}

const scene = new Scene(canvas, ctx, SCENE_DATA, statusEl);
scene.start();
