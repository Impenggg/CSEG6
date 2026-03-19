import { COLORS, KEYS } from "../config/constants.js";
import { CameraShake } from "../core/camera-shake.js";
import { Input } from "../core/input.js";
import { ManaSystem } from "../core/mana-system.js";
import { Boss } from "../entities/boss.js";
import { Enemy } from "../entities/enemy.js";
import { Particle } from "../entities/particle.js";
import { Player } from "../entities/player.js";
import { PowerUp } from "../entities/power-up.js";
import { Projectile } from "../entities/projectile.js";
import { SkillManager } from "../systems/skill-manager.js";
import { Starfield } from "../systems/starfield.js";
import { chance, clamp, rand } from "../utils/math.js";

class GameController {
  constructor(canvas, overlayEl) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.overlayEl = overlayEl;
    this.w = canvas.width;
    this.h = canvas.height;
    this.input = new Input();
    this.camera = new CameraShake();
    this.starfield = new Starfield(this.w, this.h);

    this.player = new Player({ x: this.w / 2, y: this.h - 70 });
    this.mana = new ManaSystem(60);
    this.skillManager = new SkillManager(this);

    this.enemies = [];
    this.boss = null;
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.powerUps = [];
    this.particles = [];
    this.strikes = [];
    this.floatText = [];

    this.score = 0;
    this.waveIndex = 0;
    this.sectorWaves = 12;
    this.state = "title"; // title | playing | paused | gameover | victory
    this.time = 0;

    this.earthLine = this.h - 22;
    this.formation = { dx: 54, dy: 42, cols: 10, rows: 3 };

    this.spawnGrace = 0;
    this.loseBecauseEarth = false;

    this.updateOverlay();
  }

  startNewRun() {
    this.score = 0;
    this.waveIndex = 0;
    this.time = 0;
    this.state = "playing";
    this.loseBecauseEarth = false;
    this.enemies = [];
    this.boss = null;
    this.playerProjectiles = [];
    this.enemyProjectiles = [];
    this.powerUps = [];
    this.particles = [];
    this.strikes = [];
    this.floatText = [];
    this.player.reset({ x: this.w / 2, y: this.h - 70 });
    this.mana.reset();
    this.skillManager = new SkillManager(this);
    this.spawnGrace = 1.2;
    this.spawnWave();
    this.updateOverlay();
  }

  togglePause() {
    if (this.state === "playing") this.state = "paused";
    else if (this.state === "paused") this.state = "playing";
    this.updateOverlay();
  }

  updateOverlay() {
    const el = this.overlayEl;
    if (!el) return;

    if (this.state === "title") {
      el.innerHTML = `
        <div class="panel">
          <div class="big">PRESS ENTER</div>
          <div class="sub">
            Defend Earth sector-by-sector. Earn mana by <strong>hitting</strong> enemies.<br/>
            Use <strong>Q/W/E</strong> tactically and unleash <strong>R</strong> only at <strong>full mana</strong>.
          </div>
          <div class="row">
            <span><kbd>Space</kbd> Plasma</span>
            <span><kbd>Q</kbd> Slow + cancel dives</span>
            <span><kbd>W</kbd> Dash invuln</span>
            <span><kbd>E</kbd> Shockwave</span>
            <span><kbd>R</kbd> Orbital strikes</span>
          </div>
        </div>
      `;
    } else if (this.state === "paused") {
      el.innerHTML = `
        <div class="panel">
          <div class="big">PAUSED</div>
          <div class="sub">Press <kbd>P</kbd> to resume.</div>
        </div>
      `;
    } else if (this.state === "gameover") {
      const reason = this.loseBecauseEarth ? "Enemies breached the atmosphere." : "Your ship was destroyed.";
      el.innerHTML = `
        <div class="panel">
          <div class="big">GAME OVER</div>
          <div class="sub">${reason}<br/>Final Score: <strong>${Math.floor(this.score)}</strong></div>
          <div class="row"><span>Press <kbd>Enter</kbd> to restart.</span></div>
        </div>
      `;
    } else if (this.state === "victory") {
      el.innerHTML = `
        <div class="panel">
          <div class="big">SECTOR CLEARED</div>
          <div class="sub">Earth survives another day.<br/>Final Score: <strong>${Math.floor(this.score)}</strong></div>
          <div class="row"><span>Press <kbd>Enter</kbd> to play again.</span></div>
        </div>
      `;
    } else {
      el.innerHTML = "";
    }
  }

  spawnWave() {
    this.waveIndex += 1;
    this.spawnGrace = Math.max(this.spawnGrace, 0.75);

    // Boss every 5 waves
    if (this.waveIndex % 5 === 0) {
      this.enemies = [];
      this.enemyProjectiles = [];
      this.powerUps = [];
      this.boss = new Boss({ x: this.w / 2, y: -80, wave: this.waveIndex });
      this.spawnText(this.w / 2, 120, `BOSS APPROACHING`, "rgba(199,125,255,0.92)");
      return;
    }

    this.boss = null;
    this.enemyProjectiles = [];

    const baseRows = 3;
    const extra = this.waveIndex >= 6 ? 1 : 0;
    const rows = baseRows + extra;
    const cols = this.waveIndex >= 9 ? 11 : 10;
    const dx = this.waveIndex >= 9 ? 50 : 54;
    const dy = 42;

    const startX = (this.w - (cols - 1) * dx) / 2;
    const startY = -rows * dy - 10;

    this.enemies = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = startX + c * dx;
        const y = startY + r * dy;
        const eliteChance = clamp(0.08 + this.waveIndex * 0.03, 0.08, 0.33);
        const type = chance(eliteChance) ? "elite" : "small";
        this.enemies.push(new Enemy({ x, y, type, wave: this.waveIndex }));
      }
    }

    this.spawnText(this.w / 2, 90, `WAVE ${this.waveIndex}`, "rgba(233,236,255,0.9)");
  }

  spawnPlayerShot() {
    const p = this.player;
    const double = p.doubleShotTimer > 0;
    const shotSpeed = 680;
    const dmg = 6;
    const r = 4;
    const y = p.y - p.h / 2 - 8;
    const x = p.x;

    const make = (sx) =>
      this.playerProjectiles.push(
        new Projectile({
          x: sx,
          y,
          vx: 0,
          vy: -shotSpeed,
          r,
          damage: dmg,
          friendly: true,
          color: COLORS.shot,
          kind: "plasma",
        }),
      );
    if (!double) {
      make(x);
    } else {
      make(x - 10);
      make(x + 10);
    }

    this.spawnSpark(x, y, "rgba(101,240,255,0.9)");
  }

  spawnExplosion(x, y, color, intensity) {
    const n = intensity;
    for (let i = 0; i < n; i++) {
      this.particles.push(
        new Particle({
          x,
          y,
          vx: rand(-220, 220),
          vy: rand(-220, 220),
          life: rand(0.25, 0.75),
          r: rand(1.2, 3.6),
          color,
          glow: 12,
          fade: true,
        }),
      );
    }
  }

  spawnSpark(x, y, color) {
    for (let i = 0; i < 5; i++) {
      this.particles.push(
        new Particle({
          x,
          y,
          vx: rand(-180, 180),
          vy: rand(-180, 180),
          life: rand(0.12, 0.35),
          r: rand(0.9, 2.2),
          color,
          glow: 10,
          fade: true,
        }),
      );
    }
  }

  spawnBurst(x, y, color) {
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      this.particles.push(
        new Particle({
          x,
          y,
          vx: Math.cos(a) * rand(80, 300),
          vy: Math.sin(a) * rand(80, 300),
          life: rand(0.18, 0.55),
          r: rand(1.2, 2.6),
          color,
          glow: 14,
          fade: true,
        }),
      );
    }
  }

  spawnShieldSpark(x, y) {
    for (let i = 0; i < 12; i++) {
      const a = rand(0, Math.PI * 2);
      this.particles.push(
        new Particle({
          x: x + Math.cos(a) * 10,
          y: y + Math.sin(a) * 8,
          vx: Math.cos(a) * rand(120, 260),
          vy: Math.sin(a) * rand(120, 260),
          life: rand(0.18, 0.45),
          r: rand(1.0, 2.4),
          color: "rgba(101,240,255,0.95)",
          glow: 16,
          fade: true,
        }),
      );
    }
  }

  spawnStrike(x, y0, y1) {
    this.strikes.push({ x, y0, y1, t: 0.18, max: 0.18 });
    // little impact spark clusters
    this.spawnBurst(x, rand(this.h * 0.15, this.h * 0.85), "rgba(199,125,255,0.95)");
  }

  spawnText(x, y, text, color) {
    this.floatText.push({ x, y, text, color, t: 1.05, max: 1.05 });
  }

  maybeDropPowerUp(x, y) {
    // drop chance and type distribution
    const dropChance = 0.14;
    if (!chance(dropChance)) return;
    const roll = Math.random();
    let type = "shield";
    if (roll < 0.22) type = "shield";
    else if (roll < 0.44) type = "rapid";
    else if (roll < 0.64) type = "double";
    else if (roll < 0.80) type = "speed";
    else type = "life";
    this.powerUps.push(new PowerUp({ x, y, type }));
  }

  applyPowerUp(type) {
    if (type === "shield") {
      this.player.shield = Math.max(this.player.shield, 8.5);
      this.spawnText(this.player.x, this.player.y - 40, "SHIELD", "rgba(101,240,255,0.95)");
    } else if (type === "rapid") {
      this.player.rapidFireTimer = Math.max(this.player.rapidFireTimer, 8.5);
      this.spawnText(this.player.x, this.player.y - 40, "RAPID FIRE", "rgba(125,255,107,0.95)");
    } else if (type === "double") {
      this.player.doubleShotTimer = Math.max(this.player.doubleShotTimer, 10.0);
      this.spawnText(this.player.x, this.player.y - 40, "DOUBLE SHOT", "rgba(255,209,102,0.95)");
    } else if (type === "life") {
      this.player.lives += 1;
      this.spawnText(this.player.x, this.player.y - 40, "+1 LIFE", "rgba(233,236,255,0.95)");
    } else if (type === "speed") {
      this.player.speedBoostTimer = Math.max(this.player.speedBoostTimer, 8.5);
      this.spawnText(this.player.x, this.player.y - 40, "SPEED BOOST", "rgba(255,79,216,0.95)");
    }
    this.spawnBurst(this.player.x, this.player.y, "rgba(233,236,255,0.85)");
  }

  static rectCircleOverlap(rect, cx, cy, cr) {
    const closestX = clamp(cx, rect.x, rect.x + rect.w);
    const closestY = clamp(cy, rect.y, rect.y + rect.h);
    const dx = cx - closestX;
    const dy = cy - closestY;
    return dx * dx + dy * dy <= cr * cr;
  }

  static rectRectOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  handleHits() {
    // player shots -> enemies/boss
    for (const s of this.playerProjectiles) {
      if (!s.alive) continue;

      // snare hits are special
      if (this.boss && this.boss.alive) {
        const br = this.boss.bounds();
        if (GameController.rectCircleOverlap(br, s.x, s.y, s.r)) {
          s.alive = false;
          this.boss.hp -= s.damage;
          this.spawnSpark(s.x, s.y, s.kind === "snare" ? "rgba(101,240,255,0.95)" : COLORS.shotHot);

          // Mana per hit: Boss +1, capped per second
          this.mana.gain(1);

          if (s.kind === "snare") {
            this.boss.applySlow(1, 2.4); // 60% slow via system
            this.skillManager.onSnareHit(s.x, s.y);
          }

          if (this.boss.hp <= 0) {
            this.boss.alive = false;
            this.score += 1500 + this.waveIndex * 80;
            this.spawnExplosion(this.boss.x, this.boss.y, COLORS.enemyBoss, 60);
            this.camera.add(24, 0.6);
            this.maybeDropPowerUp(this.boss.x, this.boss.y);
          }
          continue;
        }
      }

      for (const e of this.enemies) {
        if (!e.alive) continue;
        const r = e.bounds();
        if (GameController.rectCircleOverlap(r, s.x, s.y, s.r)) {
          s.alive = false;
          e.hp -= s.damage;
          this.spawnSpark(s.x, s.y, s.kind === "snare" ? "rgba(101,240,255,0.95)" : COLORS.shotHot);

          // Mana per hit:
          // Small +3, Elite +2
          this.mana.gain(e.type === "elite" ? 2 : 3);

          if (s.kind === "snare") {
            e.applySlow(1, 2.6); // 60% slow with timer
            e.cancelDive(); // cancels dive attacks
            this.skillManager.onSnareHit(s.x, s.y);
          }

          if (e.hp <= 0) {
            e.alive = false;
            this.score += e.type === "elite" ? 120 : 60;
            this.spawnExplosion(e.x, e.y, e.getColor(), e.type === "elite" ? 18 : 12);
            this.maybeDropPowerUp(e.x, e.y);
          }
          break;
        }
      }
    }

    // enemy bullets -> player
    const pr = this.player.bounds();
    for (const b of this.enemyProjectiles) {
      if (!b.alive) continue;
      if (GameController.rectCircleOverlap(pr, b.x, b.y, b.r)) {
        b.alive = false;
        this.spawnSpark(b.x, b.y, "rgba(255,107,107,0.95)");
        this.player.takeHit(b.damage, this);
      }
    }

    // enemies -> player collision (rare but possible)
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (GameController.rectRectOverlap(pr, e.bounds())) {
        e.alive = false;
        this.spawnExplosion(e.x, e.y, e.getColor(), 18);
        this.player.takeHit(12, this);
      }
    }
    if (this.boss && this.boss.alive) {
      if (GameController.rectRectOverlap(pr, this.boss.bounds())) {
        this.player.takeHit(22, this);
      }
    }

    // powerups -> player
    for (const pu of this.powerUps) {
      if (!pu.alive) continue;
      const dx = pu.x - this.player.x;
      const dy = pu.y - this.player.y;
      if (Math.hypot(dx, dy) < pu.r + 18) {
        pu.alive = false;
        this.applyPowerUp(pu.type);
      }
    }
  }

  checkLoseWin() {
    if (this.state !== "playing") return;

    if (this.player.lives < 0) {
      this.state = "gameover";
      this.updateOverlay();
      return;
    }

    // lose if enemies reach bottom (Earth)
    if (this.spawnGrace <= 0) {
      for (const e of this.enemies) {
        if (e.alive && e.y + e.h / 2 >= this.earthLine) {
          this.loseBecauseEarth = true;
          this.state = "gameover";
          this.updateOverlay();
          return;
        }
      }
      if (this.boss && this.boss.alive) {
        if (this.boss.y + this.boss.h / 2 >= this.earthLine) {
          this.loseBecauseEarth = true;
          this.state = "gameover";
          this.updateOverlay();
          return;
        }
      }
    }

    // wave clear
    const enemiesAlive = this.enemies.some((e) => e.alive);
    const bossAlive = this.boss && this.boss.alive;
    if (!enemiesAlive && !bossAlive) {
      if (this.waveIndex >= this.sectorWaves) {
        this.state = "victory";
        this.updateOverlay();
        return;
      }
      this.spawnWave();
    }
  }

  update(dt) {
    this.time += dt;

    // global input
    if (this.input.wasPressed(KEYS.pause) && (this.state === "playing" || this.state === "paused")) {
      this.togglePause();
    }
    if (this.input.wasPressed(KEYS.enter) && (this.state === "title" || this.state === "gameover" || this.state === "victory")) {
      this.startNewRun();
    }

    if (this.state !== "playing") {
      this.input.clearPressed();
      return;
    }

    this.spawnGrace = Math.max(0, this.spawnGrace - dt);

    // skills
    if (this.input.wasPressed(KEYS.q)) this.skillManager.tryCastQ();
    if (this.input.wasPressed(KEYS.w)) this.skillManager.tryCastW();
    if (this.input.wasPressed(KEYS.e)) this.skillManager.tryCastE();
    if (this.input.wasPressed(KEYS.r)) this.skillManager.tryCastR();

    this.skillManager.update(dt);
    this.mana.update(dt);
    this.camera.update(dt);
    this.starfield.update(dt, 1 + this.waveIndex * 0.015);

    this.player.update(dt, this.input, this);

    for (const e of this.enemies) e.update(dt, this);
    if (this.boss && this.boss.alive) this.boss.update(dt, this);

    for (const s of this.playerProjectiles) s.update(dt);
    for (const b of this.enemyProjectiles) b.update(dt);
    for (const pu of this.powerUps) pu.update(dt);
    for (const p of this.particles) p.update(dt);
    for (const f of this.floatText) f.t -= dt;
    for (const st of this.strikes) st.t -= dt;

    // cleanup
    this.playerProjectiles = this.playerProjectiles.filter((p) => p.alive && !p.isOffscreen(this.w, this.h));
    this.enemyProjectiles = this.enemyProjectiles.filter((p) => p.alive && !p.isOffscreen(this.w, this.h));
    this.enemies = this.enemies.filter((e) => e.alive || e.y < this.h + 120);
    this.powerUps = this.powerUps.filter((p) => p.alive && !p.isOffscreen(this.h));
    this.particles = this.particles.filter((p) => p.alive);
    this.floatText = this.floatText.filter((f) => f.t > 0);
    this.strikes = this.strikes.filter((s) => s.t > 0);

    // collisions & state
    this.handleHits();
    this.checkLoseWin();

    this.input.clearPressed();
  }

  drawHud(ctx) {
    // top HUD: score + wave
    ctx.save();
    ctx.fillStyle = COLORS.ui;
    ctx.font = "700 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.textBaseline = "top";
    ctx.fillText(`SCORE ${Math.floor(this.score)}`, 14, 12);
    ctx.fillStyle = COLORS.uiDim;
    ctx.fillText(`WAVE ${this.waveIndex}/${this.sectorWaves}`, 14, 30);

    // lives
    ctx.fillStyle = COLORS.ui;
    ctx.fillText(`LIVES ${Math.max(0, this.player.lives)}`, this.w - 160, 12);

    // HP bar
    const hpT = clamp(this.player.hp / this.player.hpMax, 0, 1);
    const hpX = 14;
    const hpY = this.h - 18;
    const hpW = 260;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(hpX, hpY, hpW, 8);
    ctx.fillStyle = COLORS.hp;
    ctx.fillRect(hpX, hpY, hpW * hpT, 8);
    ctx.fillStyle = "rgba(233,236,255,0.88)";
    ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    ctx.fillText(`HP`, hpX + hpW + 10, hpY - 2);

    // Mana bar
    const mT = clamp(this.mana.value / this.mana.max, 0, 1);
    const mX = this.w - 14 - 260;
    const mY = this.h - 18;
    const mW = 260;
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(mX, mY, mW, 8);
    ctx.fillStyle = COLORS.mana;
    ctx.fillRect(mX, mY, mW * mT, 8);
    ctx.fillStyle = "rgba(233,236,255,0.88)";
    ctx.fillText(`MANA`, mX - 56, mY - 2);

    // Skill HUD (bottom center)
    const info = this.skillManager.hudInfo();
    const keys = ["q", "w", "e", "r"];
    const labels = {
      q: "ION",
      w: "DASH",
      e: "BURST",
      r: "NOVA",
    };
    const start = this.w / 2 - 150;
    const y = this.h - 44;
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      const x = start + i * 78;
      const box = { x: x, y: y, w: 70, h: 28 };
      const ready = info[k].ready;
      const cd = info[k].cd;
      const isUlt = k === "r";
      ctx.save();
      ctx.fillStyle = ready ? "rgba(233,236,255,0.12)" : "rgba(233,236,255,0.06)";
      ctx.strokeStyle = ready ? "rgba(101,240,255,0.65)" : "rgba(233,236,255,0.18)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(box.x, box.y, box.w, box.h, 10);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = ready ? "rgba(233,236,255,0.95)" : "rgba(233,236,255,0.65)";
      ctx.font = "800 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.textAlign = "left";
      ctx.textBaseline = "top";
      ctx.fillText(k.toUpperCase(), box.x + 8, box.y + 6);
      ctx.textAlign = "right";
      ctx.fillText(labels[k], box.x + box.w - 8, box.y + 6);

      // cost / cooldown
      ctx.textAlign = "left";
      ctx.textBaseline = "bottom";
      ctx.fillStyle = ready ? (isUlt ? "rgba(199,125,255,0.95)" : "rgba(101,240,255,0.92)") : "rgba(233,236,255,0.55)";
      const footer = cd > 0 ? `CD ${cd.toFixed(1)}` : isUlt ? "FULL" : `${info[k].cost}`;
      ctx.fillText(footer, box.x + 8, box.y + box.h - 5);
      ctx.restore();
    }

    // Status effects timers
    let sx = 14;
    let sy = this.h - 64;
    ctx.textAlign = "left";
    ctx.textBaseline = "bottom";
    ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
    if (this.player.shield > 0) {
      ctx.fillStyle = "rgba(101,240,255,0.92)";
      ctx.fillText(`SHIELD ${this.player.shield.toFixed(1)}s`, sx, sy);
      sy -= 16;
    }
    if (this.player.rapidFireTimer > 0) {
      ctx.fillStyle = "rgba(125,255,107,0.92)";
      ctx.fillText(`RAPID ${this.player.rapidFireTimer.toFixed(1)}s`, sx, sy);
      sy -= 16;
    }
    if (this.player.doubleShotTimer > 0) {
      ctx.fillStyle = "rgba(255,209,102,0.92)";
      ctx.fillText(`DOUBLE ${this.player.doubleShotTimer.toFixed(1)}s`, sx, sy);
      sy -= 16;
    }
    if (this.player.speedBoostTimer > 0) {
      ctx.fillStyle = "rgba(255,79,216,0.92)";
      ctx.fillText(`SPEED ${this.player.speedBoostTimer.toFixed(1)}s`, sx, sy);
      sy -= 16;
    }

    ctx.restore();
  }

  draw(ctx) {
    ctx.clearRect(0, 0, this.w, this.h);

    // camera shake
    const off = this.camera.getOffset();
    ctx.save();
    ctx.translate(off.x, off.y);

    // background
    this.starfield.draw(ctx);

    // Earth line
    ctx.save();
    ctx.globalAlpha = 0.65;
    const g = ctx.createLinearGradient(0, this.earthLine - 24, 0, this.earthLine + 20);
    g.addColorStop(0, "rgba(101,240,255,0)");
    g.addColorStop(0.5, "rgba(101,240,255,0.12)");
    g.addColorStop(1, "rgba(255,79,216,0.09)");
    ctx.fillStyle = g;
    ctx.fillRect(0, this.earthLine - 24, this.w, 44);
    ctx.restore();

    // strikes (ultimate)
    for (const s of this.strikes) {
      const t = clamp(s.t / s.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.85 * t;
      ctx.strokeStyle = "rgba(199,125,255,0.95)";
      ctx.lineWidth = 4;
      ctx.shadowColor = "rgba(199,125,255,0.95)";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y0);
      ctx.lineTo(s.x, s.y1);
      ctx.stroke();
      ctx.restore();
    }

    // entities
    for (const pu of this.powerUps) pu.draw(ctx);
    for (const e of this.enemies) if (e.alive) e.draw(ctx);
    if (this.boss && this.boss.alive) this.boss.draw(ctx);

    for (const p of this.playerProjectiles) if (p.alive) p.draw(ctx);
    for (const p of this.enemyProjectiles) if (p.alive) p.draw(ctx);

    // player & skills overlay
    this.player.draw(ctx);
    this.skillManager.draw(ctx);

    // particles
    for (const p of this.particles) p.draw(ctx);

    // float text
    for (const f of this.floatText) {
      const t = clamp(f.t / f.max, 0, 1);
      ctx.save();
      ctx.globalAlpha = 0.9 * t;
      ctx.fillStyle = f.color;
      ctx.font = "900 14px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowColor = "rgba(0,0,0,0.6)";
      ctx.shadowBlur = 12;
      ctx.fillText(f.text, f.x, f.y - (1 - t) * 18);
      ctx.restore();
    }

    ctx.restore(); // shake transform

    // HUD always on top
    this.drawHud(ctx);
  }
}

// Polyfill-ish: roundRect is supported in modern browsers; guard for older ones.
if (CanvasRenderingContext2D && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
    const rr = Array.isArray(r) ? r : [r, r, r, r];
    const [r1, r2, r3, r4] = rr.map((v) => Math.max(0, Math.min(v, Math.min(w, h) / 2)));
    this.beginPath();
    this.moveTo(x + r1, y);
    this.lineTo(x + w - r2, y);
    this.quadraticCurveTo(x + w, y, x + w, y + r2);
    this.lineTo(x + w, y + h - r3);
    this.quadraticCurveTo(x + w, y + h, x + w - r3, y + h);
    this.lineTo(x + r4, y + h);
    this.quadraticCurveTo(x, y + h, x, y + h - r4);
    this.lineTo(x, y + r1);
    this.quadraticCurveTo(x, y, x + r1, y);
    return this;
  };
}


export { GameController };
