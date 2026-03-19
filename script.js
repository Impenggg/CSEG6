(() => {
  "use strict";

  // src/config/constants.js
  const KEYS = {
    left: ["ArrowLeft", "a", "A"],
    right: ["ArrowRight", "d", "D"],
    up: ["ArrowUp", "w", "W"],
    down: ["ArrowDown", "s", "S"],
    shoot: [" "],
    dash: ["Shift"],
    q: ["q", "Q"],
    e: ["e", "E"],
    r: ["r", "R"],
    enter: ["Enter"],
    pause: ["p", "P", "Escape"],
  };

  const COLORS = {
    player: "#65f0ff",
    playerCore: "#d9ffff",
    playerThruster: "#ff4fd8",
    shot: "#65f0ff",
    shotHot: "#ffd166",
    enemySmall: "#ff4d4d",
    enemyElite: "#ff9f1c",
    enemyBoss: "#c77dff",
    enemyBullet: "#ff6b6b",
    powerUp: "#7dff6b",
    uiDim: "rgba(233,236,255,0.7)",
    ui: "rgba(233,236,255,0.92)",
    mana: "#4dd7ff",
    hp: "#7dff6b",
    shield: "#65f0ff",
  };

  // src/utils/math.js
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const chance = (p) => Math.random() < p;

  // src/core/camera-shake.js

  class CameraShake {
    constructor() {
      this.t = 0;
      this.mag = 0;
    }
    add(magnitude, duration) {
      this.mag = Math.max(this.mag, magnitude);
      this.t = Math.max(this.t, duration);
    }
    update(dt) {
      this.t = Math.max(0, this.t - dt);
      if (this.t <= 0) this.mag = 0;
    }
    getOffset() {
      if (this.t <= 0 || this.mag <= 0) return { x: 0, y: 0 };
      const s = this.mag * (0.6 + 0.4 * Math.sin(performance.now() * 0.02));
      return { x: rand(-s, s), y: rand(-s, s) };
    }
  }

  // src/core/input.js

  class Input {
    constructor() {
      this.down = new Set();
      this.pressed = new Set();
      window.addEventListener("keydown", (e) => {
        if (!this.down.has(e.key)) this.pressed.add(e.key);
        this.down.add(e.key);
        if (["ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
      });
      window.addEventListener("keyup", (e) => {
        this.down.delete(e.key);
      });
    }
    isDown(list) {
      for (const k of list) if (this.down.has(k)) return true;
      return false;
    }
    wasPressed(list) {
      for (const k of list) if (this.pressed.has(k)) return true;
      return false;
    }
    clearPressed() {
      this.pressed.clear();
    }
  }

  // src/core/mana-system.js
  class ManaSystem {
    constructor(maxMana) {
      this.max = maxMana;
      this.value = 0;
      this.gainCapPerSecond = 18; // prevents abuse; still feels responsive
      this.gainedThisSecond = 0;
      this.secondTimer = 0;
    }
    reset() {
      this.value = 0;
      this.gainedThisSecond = 0;
      this.secondTimer = 0;
    }
    update(dt) {
      this.secondTimer += dt;
      if (this.secondTimer >= 1) {
        this.secondTimer -= 1;
        this.gainedThisSecond = 0;
      }
    }
    canSpend(cost) {
      return this.value >= cost;
    }
    spend(cost) {
      if (this.value < cost) return false;
      this.value -= cost;
      return true;
    }
    gain(amount) {
      const remainingCap = Math.max(0, this.gainCapPerSecond - this.gainedThisSecond);
      const add = Math.min(amount, remainingCap);
      if (add <= 0) return 0;
      const before = this.value;
      this.value = clamp(this.value + add, 0, this.max);
      const actual = this.value - before;
      this.gainedThisSecond += actual;
      return actual;
    }
    isFull() {
      return this.value >= this.max - 1e-6;
    }
  }

  // src/entities/projectile.js
  class Projectile {
    constructor({ x, y, vx, vy, r, damage, friendly, color, kind }) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.r = r;
      this.damage = damage;
      this.friendly = friendly;
      this.color = color;
      this.kind = kind || "bullet";
      this.alive = true;
    }
    update(dt) {
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }
    draw(ctx) {
      ctx.save();
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    isOffscreen(w, h) {
      return this.x < -50 || this.x > w + 50 || this.y < -80 || this.y > h + 80;
    }
  }

  // src/entities/boss.js

  class Boss {
    constructor({ x, y, wave }) {
      this.x = x;
      this.y = y;
      this.wave = wave;
      this.w = 140;
      this.h = 46;
      this.maxHp = 520 + wave * 90;
      this.hp = this.maxHp;
      this.alive = true;
      this.phase = rand(0, Math.PI * 2);

      this.enterY = 120;
      this.vx = 0;
      this.fireTimer = 0.5;
      this.patternTimer = 0;
      this.pattern = "fan";
      this.slow = 0;
      this.slowTimer = 0;
    }

    applySlow(amount, duration) {
      this.slow = Math.max(this.slow, amount * 0.6); // bosses resist slows
      this.slowTimer = Math.max(this.slowTimer, duration * 0.7);
    }

    update(dt, gc) {
      if (!this.alive) return;

      if (this.slowTimer > 0) {
        this.slowTimer -= dt;
        if (this.slowTimer <= 0) this.slow = 0;
      }
      const slowMul = 1 - 0.6 * this.slow;

      // Enter
      if (this.y < this.enterY) {
        this.y += 120 * dt;
        return;
      }

      this.patternTimer += dt;
      if (this.patternTimer > 7.5) {
        this.patternTimer = 0;
        this.pattern = ["fan", "sweep", "bursts"][Math.floor(rand(0, 3))];
      }

      const targetX = gc.w / 2 + Math.sin(gc.time * 0.45 + this.phase) * (gc.w * 0.28);
      this.vx = lerp(this.vx, (targetX - this.x) * 1.4, 1 - Math.pow(0.001, dt));
      this.x += this.vx * dt * slowMul;
      this.x = clamp(this.x, this.w / 2 + 10, gc.w - this.w / 2 - 10);

      // Fire patterns
      const hpT = clamp(1 - this.hp / this.maxHp, 0, 1);
      const fireScale = 1.0 + hpT * 1.1 + gc.waveIndex * 0.04;
      this.fireTimer -= dt * fireScale;
      if (this.fireTimer <= 0) {
        if (this.pattern === "fan") this.fireTimer = 0.55;
        else if (this.pattern === "sweep") this.fireTimer = 0.14;
        else this.fireTimer = 0.34;

        if (this.pattern === "fan") {
          const n = 9;
          for (let i = 0; i < n; i++) {
            const a = lerp(-0.95, 0.95, i / (n - 1));
            const vx = a * 120;
            const vy = 260 + hpT * 100;
            gc.enemyProjectiles.push(
              new Projectile({
                x: this.x,
                y: this.y + this.h * 0.6,
                vx,
                vy,
                r: 5,
                damage: 1,
                friendly: false,
                color: COLORS.enemyBullet,
                kind: "enemyBullet",
              }),
            );
          }
        } else if (this.pattern === "sweep") {
          const sweep = Math.sin(gc.time * 2.0 + this.phase);
          gc.enemyProjectiles.push(
            new Projectile({
              x: this.x,
              y: this.y + this.h * 0.6,
              vx: sweep * (170 + hpT * 90),
              vy: 310 + hpT * 110,
              r: 5,
              damage: 1,
              friendly: false,
              color: COLORS.enemyBullet,
              kind: "enemyBullet",
            }),
          );
        } else {
          // bursts: targeted shots
          const dx = gc.player.x - this.x;
          const dy = gc.player.y - (this.y + this.h * 0.6);
          const len = Math.max(1, Math.hypot(dx, dy));
          const ux = dx / len;
          const uy = dy / len;
          const speed = 360 + hpT * 120;
          for (let k = 0; k < 3; k++) {
            const spread = (k - 1) * 0.12;
            const vx = (ux + spread) * speed;
            const vy = (uy + Math.abs(spread) * 0.05) * speed;
            gc.enemyProjectiles.push(
              new Projectile({
                x: this.x,
                y: this.y + this.h * 0.6,
                vx,
                vy,
                r: 5,
                damage: 1,
                friendly: false,
                color: COLORS.enemyBullet,
                kind: "enemyBullet",
              }),
            );
          }
        }
      }
    }

    draw(ctx) {
      ctx.save();
      ctx.translate(this.x, this.y);

      const c = COLORS.enemyBoss;
      ctx.shadowColor = c;
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.beginPath();
      ctx.roundRect(-this.w / 2 - 6, -this.h / 2 - 8, this.w + 12, this.h + 16, 18);
      ctx.fill();

      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 16);
      ctx.fill();

      // "wings"
      ctx.fillStyle = "rgba(10,12,22,0.35)";
      ctx.beginPath();
      ctx.roundRect(-this.w / 2 + 10, -this.h / 2 + 8, 22, this.h - 16, 10);
      ctx.roundRect(this.w / 2 - 32, -this.h / 2 + 8, 22, this.h - 16, 10);
      ctx.fill();

      // core
      ctx.shadowBlur = 22;
      ctx.fillStyle = "rgba(233,236,255,0.85)";
      ctx.beginPath();
      ctx.arc(0, 0, 9 + Math.sin(performance.now() * 0.006 + this.phase) * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // slow ring
      if (this.slow > 0) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = "rgba(101,240,255,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(this.w, this.h) * 0.44, 0, Math.PI * 2);
        ctx.stroke();
      }

      // boss HP bar (bigger)
      const t = clamp(this.hp / this.maxHp, 0, 1);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.45)";
      ctx.fillRect(-this.w / 2, -this.h / 2 - 16, this.w, 6);
      ctx.fillStyle = "rgba(233,236,255,0.92)";
      ctx.fillRect(-this.w / 2, -this.h / 2 - 16, this.w * t, 6);
      ctx.restore();
    }

    bounds() {
      return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    }
  }

  // src/entities/enemy.js

  class Enemy {
    constructor({ x, y, type, wave }) {
      this.x = x;
      this.y = y;
      this.type = type; // "small" | "elite"
      this.wave = wave;

      const isElite = type === "elite";
      this.w = isElite ? 34 : 28;
      this.h = isElite ? 22 : 18;
      this.maxHp = isElite ? 18 + wave * 2 : 10 + wave * 1.2;
      this.hp = this.maxHp;
      this.baseSpeed = isElite ? 32 + wave * 3.2 : 28 + wave * 2.6;
      this.fireRate = isElite ? 0.65 : 0.35; // shots/sec baseline, scaled later
      this.fireTimer = rand(0.2, 1.2);
      this.phase = rand(0, Math.PI * 2);
      this.alive = true;

      this.slow = 0; // 0..1
      this.slowTimer = 0;
      this.diveCooldown = isElite ? rand(3, 6) : rand(4, 8);
      this.diving = false;
      this.diveVx = 0;
      this.diveVy = 0;
      this.wasDiveCancelled = false;
    }

    getColor() {
      return this.type === "elite" ? COLORS.enemyElite : COLORS.enemySmall;
    }

    applySlow(amount, duration) {
      this.slow = Math.max(this.slow, amount);
      this.slowTimer = Math.max(this.slowTimer, duration);
    }

    cancelDive() {
      if (!this.diving) return false;
      this.diving = false;
      this.wasDiveCancelled = true;
      this.diveCooldown = rand(2.6, 4.2);
      return true;
    }

    update(dt, gc) {
      if (!this.alive) return;

      if (this.slowTimer > 0) {
        this.slowTimer -= dt;
        if (this.slowTimer <= 0) this.slow = 0;
      }

      const slowMul = 1 - 0.6 * this.slow;
      const waveMul = 1 + gc.waveIndex * 0.02;

      // Later waves: add zig-zag/dive behaviors more often.
      const later = gc.waveIndex >= 4;
      const veryLater = gc.waveIndex >= 8;

      if (!this.diving) {
        const zig = later ? Math.sin(gc.time * (1.2 + this.phase) + this.x * 0.01) : Math.sin(gc.time * 0.6 + this.phase);
        const side = zig * (veryLater ? 62 : later ? 42 : 26);
        this.x += (side * dt) * slowMul;
        this.y += (this.baseSpeed * waveMul * dt) * slowMul;

        this.diveCooldown -= dt;
        if ((later || this.type === "elite") && this.diveCooldown <= 0 && chance(veryLater ? 0.65 : 0.35)) {
          this.diving = true;
          const px = gc.player.x;
          const dx = px - this.x;
          const len = Math.max(1, Math.abs(dx));
          this.diveVx = (dx / len) * (180 + gc.waveIndex * 6);
          this.diveVy = 220 + gc.waveIndex * 8;
        } else if (this.diveCooldown <= 0) {
          this.diveCooldown = rand(3.2, 7.5);
        }
      } else {
        this.x += this.diveVx * dt * slowMul;
        this.y += this.diveVy * dt * slowMul;
        if (this.y > gc.h * 0.82 || this.wasDiveCancelled) {
          this.diving = false;
          this.wasDiveCancelled = false;
          this.diveCooldown = rand(3.2, 7.5);
        }
      }

      this.x = clamp(this.x, 18, gc.w - 18);

      // Fire
      const fireScale = 1 + gc.waveIndex * 0.06;
      this.fireTimer -= dt * fireScale;
      if (this.fireTimer <= 0) {
        this.fireTimer = 1 / (this.fireRate * fireScale) + rand(0.1, 0.5);
        if (this.y < gc.h * 0.88) {
          const speed = 240 + gc.waveIndex * 10;
          gc.enemyProjectiles.push(
            new Projectile({
              x: this.x,
              y: this.y + this.h * 0.65,
              vx: rand(-25, 25),
              vy: speed,
              r: 4,
              damage: this.type === "elite" ? 2 : 1,
              friendly: false,
              color: COLORS.enemyBullet,
              kind: "enemyBullet",
            }),
          );
        }
      }
    }

    draw(ctx) {
      const c = this.getColor();
      ctx.save();
      ctx.translate(this.x, this.y);
      const wob = Math.sin(performance.now() * 0.005 + this.phase) * 0.05;
      ctx.rotate(wob);

      // body
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.roundRect(-this.w / 2 - 3, -this.h / 2 - 3, this.w + 6, this.h + 6, 8);
      ctx.fill();

      ctx.fillStyle = c;
      ctx.shadowColor = c;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 7);
      ctx.fill();

      // core stripe
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(10,12,22,0.35)";
      ctx.fillRect(-this.w * 0.1, -this.h * 0.45, this.w * 0.2, this.h * 0.9);

      // slow indicator
      if (this.slow > 0) {
        ctx.strokeStyle = "rgba(101,240,255,0.85)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(this.w, this.h) * 0.75, 0, Math.PI * 2);
        ctx.stroke();
      }

      // HP bar
      const t = clamp(this.hp / this.maxHp, 0, 1);
      ctx.shadowBlur = 0;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(-this.w / 2, -this.h / 2 - 10, this.w, 4);
      ctx.fillStyle = "rgba(255,255,255,0.8)";
      ctx.fillRect(-this.w / 2, -this.h / 2 - 10, this.w * t, 4);
      ctx.restore();
    }

    bounds() {
      return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    }
  }

  // src/entities/particle.js

  class Particle {
    constructor({ x, y, vx, vy, life, r, color, glow, fade }) {
      this.x = x;
      this.y = y;
      this.vx = vx;
      this.vy = vy;
      this.life = life;
      this.maxLife = life;
      this.r = r;
      this.color = color;
      this.glow = glow ?? 0;
      this.fade = fade ?? true;
      this.alive = true;
    }
    update(dt) {
      this.life -= dt;
      if (this.life <= 0) this.alive = false;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.vx *= Math.pow(0.1, dt); // mild damping
      this.vy *= Math.pow(0.1, dt);
    }
    draw(ctx) {
      const t = clamp(this.life / this.maxLife, 0, 1);
      const a = this.fade ? t : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = this.color;
      if (this.glow > 0) {
        ctx.shadowColor = this.color;
        ctx.shadowBlur = this.glow;
      }
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // src/entities/player.js

  class Player {
    constructor({ x, y }) {
      this.x = x;
      this.y = y;
      this.w = 42;
      this.h = 28;
      this.speed = 360;
      this.baseSpeed = 360;
      this.hpMax = 100;
      this.hp = this.hpMax;
      this.lives = 3;
      this.invuln = 0;
      this.shield = 0;

      this.fireCooldown = 0;
      this.fireRate = 7.5; // shots/sec base
      this.rapidFireTimer = 0;
      this.doubleShotTimer = 0;
      this.speedBoostTimer = 0;

      this.afterimages = [];
    }

    reset({ x, y }) {
      this.x = x;
      this.y = y;
      this.hp = this.hpMax;
      this.lives = 3;
      this.invuln = 0;
      this.shield = 0;
      this.fireCooldown = 0;
      this.rapidFireTimer = 0;
      this.doubleShotTimer = 0;
      this.speedBoostTimer = 0;
      this.afterimages = [];
      this.speed = this.baseSpeed;
    }

    bounds() {
      return { x: this.x - this.w / 2, y: this.y - this.h / 2, w: this.w, h: this.h };
    }

    update(dt, input, gc) {
      this.invuln = Math.max(0, this.invuln - dt);
      if (this.shield > 0) this.shield = Math.max(0, this.shield - dt);

      if (this.rapidFireTimer > 0) this.rapidFireTimer = Math.max(0, this.rapidFireTimer - dt);
      if (this.doubleShotTimer > 0) this.doubleShotTimer = Math.max(0, this.doubleShotTimer - dt);
      if (this.speedBoostTimer > 0) this.speedBoostTimer = Math.max(0, this.speedBoostTimer - dt);

      this.speed = this.baseSpeed * (this.speedBoostTimer > 0 ? 1.18 : 1);

      const left = input.isDown(KEYS.left);
      const right = input.isDown(KEYS.right);
      const up = input.isDown(KEYS.up);
      const down = input.isDown(KEYS.down);

      let vx = 0;
      let vy = 0;
      if (left) vx -= 1;
      if (right) vx += 1;
      if (up) vy -= 1;
      if (down) vy += 1;

      if (vx !== 0 && vy !== 0) {
        const diagonalScale = Math.SQRT1_2;
        vx *= diagonalScale;
        vy *= diagonalScale;
      }

      this.x += vx * this.speed * dt;
      this.y += vy * this.speed * dt;
      this.x = clamp(this.x, this.w / 2 + 12, gc.w - this.w / 2 - 12);
      this.y = clamp(this.y, this.h / 2 + 12, gc.h - this.h / 2 - 12);

      // shooting
      this.fireCooldown = Math.max(0, this.fireCooldown - dt);
      const rate = this.fireRate * (this.rapidFireTimer > 0 ? 1.55 : 1);
      const cd = 1 / rate;
      if (input.isDown(KEYS.shoot) && this.fireCooldown <= 0 && !gc.skillManager.isHardLocked()) {
        this.fireCooldown = cd;
        gc.spawnPlayerShot();
      }

      // afterimages decay
      for (const a of this.afterimages) a.t -= dt;
      this.afterimages = this.afterimages.filter((a) => a.t > 0);
    }

    draw(ctx) {
      // afterimages
      for (const a of this.afterimages) {
        const t = clamp(a.t / a.max, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.22 * t;
        ctx.translate(a.x, a.y);
        ctx.fillStyle = "rgba(101,240,255,0.9)";
        ctx.shadowColor = "rgba(101,240,255,0.9)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 12);
        ctx.fill();
        ctx.restore();
      }

      ctx.save();
      ctx.translate(this.x, this.y);

      const c = COLORS.player;
      ctx.shadowColor = c;
      ctx.shadowBlur = 18;
      ctx.fillStyle = "rgba(255,255,255,0.06)";
      ctx.beginPath();
      ctx.roundRect(-this.w / 2 - 5, -this.h / 2 - 5, this.w + 10, this.h + 10, 14);
      ctx.fill();

      ctx.fillStyle = c;
      ctx.beginPath();
      ctx.roundRect(-this.w / 2, -this.h / 2, this.w, this.h, 12);
      ctx.fill();

      // cockpit/core
      ctx.shadowBlur = 22;
      ctx.fillStyle = COLORS.playerCore;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();

      // thruster
      ctx.shadowBlur = 16;
      ctx.fillStyle = COLORS.playerThruster;
      ctx.beginPath();
      ctx.ellipse(0, this.h / 2 + 6, 7, 11, 0, 0, Math.PI * 2);
      ctx.fill();

      // shield ring
      if (this.shield > 0) {
        const ring = 0.55 + 0.45 * Math.sin(performance.now() * 0.01);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(101,240,255,${0.55 + 0.3 * ring})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 0, Math.max(this.w, this.h) * 0.75, 0, Math.PI * 2);
        ctx.stroke();
      }

      // invuln flicker
      if (this.invuln > 0) {
        ctx.shadowBlur = 0;
        ctx.strokeStyle = `rgba(255,79,216,${0.25 + 0.45 * Math.sin(performance.now() * 0.02)})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(-this.w / 2 - 2, -this.h / 2 - 2, this.w + 4, this.h + 4, 13);
        ctx.stroke();
      }

      ctx.restore();
    }

    takeHit(dmg, gc) {
      if (this.invuln > 0) return;
      if (this.shield > 0) {
        // shield absorbs one hit strongly
        this.shield = Math.max(0, this.shield - 2.2);
        gc.spawnShieldSpark(this.x, this.y);
        this.invuln = 0.15;
        return;
      }

      this.hp -= dmg;
      this.invuln = 0.75;
      gc.camera.add(7, 0.25);
      gc.spawnExplosion(this.x, this.y, COLORS.playerThruster, 18);
      gc.audio.playSound("playerHit");
      if (this.hp <= 0) {
        this.lives -= 1;
        if (this.lives >= 0) {
          this.hp = this.hpMax;
          this.invuln = 1.2;
          gc.camera.add(12, 0.4);
          gc.spawnExplosion(this.x, this.y, COLORS.player, 30);
          gc.audio.playSound("explosion");
        }
      }
    }
  }

  // src/entities/power-up.js

  class PowerUp {
    constructor({ x, y, type }) {
      this.x = x;
      this.y = y;
      this.type = type;
      this.vy = 105;
      this.r = 10;
      this.alive = true;
      this.spin = rand(0, Math.PI * 2);
    }
    update(dt) {
      this.y += this.vy * dt;
      this.spin += dt * 4;
    }
    draw(ctx) {
      const label = this.type[0].toUpperCase();
      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.rotate(this.spin);
      ctx.fillStyle = "rgba(125,255,107,0.14)";
      ctx.beginPath();
      ctx.roundRect(-14, -14, 28, 28, 8);
      ctx.fill();
      ctx.strokeStyle = COLORS.powerUp;
      ctx.lineWidth = 2;
      ctx.shadowColor = COLORS.powerUp;
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.rotate(-this.spin);
      ctx.fillStyle = "rgba(233,236,255,0.95)";
      ctx.font = "bold 13px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(label, 0, 1);
      ctx.restore();
    }
    isOffscreen(h) {
      return this.y > h + 40;
    }
  }

  // src/systems/audio-manager.js
  class AudioManager {
    constructor() {
      this.enabled = true;
      this.unlocked = false;
      this.bgm = null;
      this.sfx = new Map();
      this.config = {
        bgm: { src: "./assets/audio/background-music.mp3", volume: 0.35, loop: true },
        sounds: {
          playerShoot: { src: "./assets/audio/player-shoot.mp3", volume: 0.35 },
          dash: { src: "./assets/audio/dash.mp3", volume: 0.4 },
          snare: { src: "./assets/audio/snare.mp3", volume: 0.4 },
          burst: { src: "./assets/audio/burst.mp3", volume: 0.45 },
          ultimate: { src: "./assets/audio/ultimate.mp3", volume: 0.5 },
          ultimateExplosion: { src: "./assets/audio/ultimate-explosion.mp3", volume: 0.45 },
          playerHit: { src: "./assets/audio/player-hit.mp3", volume: 0.4 },
          playerGetBuff: { src: "./assets/audio/player-get-buff.mp3", volume: 0.4 },
          enemyDie: { src: "./assets/audio/enemy-die.mp3", volume: 0.35 },
          lose: { src: "./assets/audio/lose.mp3", volume: 0.45 },
          explosion: { src: "./assets/audio/explosion.mp3", volume: 0.35 },
        },
      };
    }

    setupUnlock() {
      const unlock = () => {
        this.unlocked = true;
        window.removeEventListener("pointerdown", unlock);
        window.removeEventListener("keydown", unlock);
      };

      window.addEventListener("pointerdown", unlock, { once: true });
      window.addEventListener("keydown", unlock, { once: true });
    }

    createAudio(src, volume, loop = false) {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = volume;
      audio.loop = loop;
      audio.addEventListener("error", () => {
        audio.dataset.failed = "true";
      });
      return audio;
    }

    ensureBgm() {
      if (this.bgm) return this.bgm;
      const { src, volume, loop } = this.config.bgm;
      this.bgm = this.createAudio(src, volume, loop);
      return this.bgm;
    }

    ensureSound(name) {
      if (this.sfx.has(name)) return this.sfx.get(name);
      const soundConfig = this.config.sounds[name];
      if (!soundConfig) return null;
      const audio = this.createAudio(soundConfig.src, soundConfig.volume, false);
      this.sfx.set(name, audio);
      return audio;
    }

    playBgm() {
      if (!this.enabled || !this.unlocked) return;
      const bgm = this.ensureBgm();
      if (bgm.dataset.failed === "true") return;
      if (!bgm.paused) return;
      bgm.currentTime = 0;
      bgm.play().catch(() => {});
    }

    pauseBgm() {
      if (!this.bgm) return;
      this.bgm.pause();
    }

    resumeBgm() {
      if (!this.enabled || !this.unlocked || !this.bgm) return;
      if (this.bgm.dataset.failed === "true") return;
      if (!this.bgm.paused) return;
      this.bgm.play().catch(() => {});
    }

    stopBgm() {
      if (!this.bgm) return;
      this.bgm.pause();
      this.bgm.currentTime = 0;
    }

    playSound(name) {
      if (!this.enabled || !this.unlocked) return;
      const baseAudio = this.ensureSound(name);
      if (!baseAudio || baseAudio.dataset.failed === "true") return;

      const audio = baseAudio.cloneNode();
      audio.volume = baseAudio.volume;
      audio.play().catch(() => {});
    }
  }

  // src/systems/skill-manager.js

  class SkillManager {
    constructor(gc) {
      this.gc = gc;
      this.cooldowns = {
        dash: 0,
        q: 0,
        e: 0,
        r: 0,
      };
      this.hardLock = 0; // used during ultimate pulses for readability
      this.dashInvuln = 0;
      this.snareNetBursts = [];
      this.burstWave = null;
      this.ultimate = null;
    }

    update(dt) {
      for (const k of Object.keys(this.cooldowns)) this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
      this.hardLock = Math.max(0, this.hardLock - dt);
      this.dashInvuln = Math.max(0, this.dashInvuln - dt);

      // Q visuals
      for (const n of this.snareNetBursts) n.t -= dt;
      this.snareNetBursts = this.snareNetBursts.filter((n) => n.t > 0);

      // E wave
      if (this.burstWave) {
        this.burstWave.t += dt;
        const w = this.burstWave;
        w.r = lerp(w.r, w.maxR, 1 - Math.pow(0.000001, dt));
        if (w.t > w.life) this.burstWave = null;
      }

      // R
      if (this.ultimate) {
        const u = this.ultimate;
        u.timer -= dt;
        u.pulseTimer -= dt;
        if (u.pulseTimer <= 0) {
          u.pulseTimer = u.pulseInterval;
          this.castUltimatePulse();
        }
        if (u.timer <= 0) {
          this.ultimate = null;
          this.hardLock = Math.max(this.hardLock, 0.2);
        }
      }
    }

    isHardLocked() {
      return this.hardLock > 0;
    }

    hudInfo() {
      const m = this.gc.mana.value;
      return {
        dash: { cost: 15, cd: this.cooldowns.dash, ready: this.cooldowns.dash <= 0 && m >= 15 },
        q: { cost: 20, cd: this.cooldowns.q, ready: this.cooldowns.q <= 0 && m >= 20 },
        e: { cost: 30, cd: this.cooldowns.e, ready: this.cooldowns.e <= 0 && m >= 30 },
        r: { cost: 60, cd: this.cooldowns.r, ready: this.cooldowns.r <= 0 && this.gc.mana.isFull() },
      };
    }

    tryCastQ() {
      if (this.cooldowns.q > 0) return;
      if (!this.gc.mana.spend(20)) return;
      this.cooldowns.q = 6.5;

      // Ion Snare: projectile forward (up), slows by 60% for 2.6s, cancels dives.
      this.gc.playerProjectiles.push(
        new Projectile({
          x: this.gc.player.x,
          y: this.gc.player.y - this.gc.player.h / 2 - 6,
          vx: 0,
          vy: -520,
          r: 7,
          damage: 3,
          friendly: true,
          color: "rgba(101,240,255,0.95)",
          kind: "snare",
        }),
      );

      this.gc.spawnText(this.gc.player.x, this.gc.player.y - 40, "ION SNARE", "rgba(101,240,255,0.95)");
      this.gc.audio.playSound("snare");
    }

    tryCastDash() {
      if (this.cooldowns.dash > 0) return;
      if (!this.gc.mana.spend(15)) return;
      this.cooldowns.dash = 4.8;

      // Phase Dash: instant horizontal dash with brief invuln and afterimages.
      const input = this.gc.input;
      const dir = input.isDown(KEYS.left) ? -1 : input.isDown(KEYS.right) ? 1 : 0;
      const d = dir !== 0 ? dir : (Math.random() < 0.5 ? -1 : 1);
      const dist = 190;
      const beforeX = this.gc.player.x;
      this.gc.player.x = clamp(beforeX + d * dist, this.gc.player.w / 2 + 12, this.gc.w - this.gc.player.w / 2 - 12);
      this.gc.player.invuln = Math.max(this.gc.player.invuln, 0.38);
      this.dashInvuln = Math.max(this.dashInvuln, 0.38);

      // afterimage trail
      for (let i = 0; i < 7; i++) {
        const t = 0.22 + i * 0.03;
        this.gc.player.afterimages.push({
          x: lerp(beforeX, this.gc.player.x, i / 6),
          y: this.gc.player.y,
          t,
          max: t,
        });
      }

      this.gc.spawnText(this.gc.player.x, this.gc.player.y - 40, "PHASE DASH", "rgba(255,79,216,0.95)");
      this.gc.camera.add(8, 0.16);
      this.gc.spawnBurst(this.gc.player.x, this.gc.player.y, "rgba(255,79,216,0.95)");
      this.gc.audio.playSound("dash");
    }

    tryCastE() {
      if (this.cooldowns.e > 0) return;
      if (!this.gc.mana.spend(30)) return;
      this.cooldowns.e = 10.5;

      // Plasma Burst: expanding shockwave, destroys nearby enemies & enemy bullets.
      this.burstWave = { x: this.gc.player.x, y: this.gc.player.y, r: 6, maxR: 210, t: 0, life: 0.65 };
      this.gc.camera.add(18, 0.35);
      this.gc.spawnText(this.gc.player.x, this.gc.player.y - 44, "PLASMA BURST", "rgba(255,209,102,0.95)");
      this.gc.audio.playSound("burst");

      // Immediate effect: clear enemy bullets close to player.
      const px = this.gc.player.x;
      const py = this.gc.player.y;
      const radius = 210;
      for (const b of this.gc.enemyProjectiles) {
        if (!b.alive) continue;
        const d = Math.hypot(b.x - px, b.y - py);
        if (d <= radius) {
          b.alive = false;
          this.gc.spawnSpark(b.x, b.y, "rgba(255,209,102,0.9)");
        }
      }

      // Damage enemies in radius; bosses take heavy damage.
      for (const e of this.gc.enemies) {
        if (!e.alive) continue;
        const d = Math.hypot(e.x - px, e.y - py);
        if (d <= radius) {
          e.hp -= 22;
          this.gc.spawnExplosion(e.x, e.y, e.getColor(), 10);
          if (e.hp <= 0) e.alive = false;
        }
      }
      if (this.gc.boss && this.gc.boss.alive) {
        const b = this.gc.boss;
        const d = Math.hypot(b.x - px, b.y - py);
        if (d <= radius + 70) {
          b.hp -= 95;
          this.gc.spawnExplosion(b.x, b.y, COLORS.enemyBoss, 22);
          this.gc.camera.add(22, 0.28);
          if (b.hp <= 0) b.alive = false;
        }
      }
    }

    tryCastR() {
      if (this.cooldowns.r > 0) return;
      if (!this.gc.mana.isFull()) return;
      // consumes all mana
      this.gc.mana.value = 0;
      this.cooldowns.r = 28;
      this.hardLock = Math.max(this.hardLock, 0.45);

      // Orbital plasma strikes: multiple pulses, screen-wide damage.
      this.ultimate = {
        timer: 2.8,
        pulseInterval: 0.35,
        pulseTimer: 0.01,
        pulseIndex: 0,
        maxPulses: 8,
      };

      this.gc.spawnText(this.gc.w / 2, 90, "NOVA PROTOCOL", "rgba(199,125,255,0.98)");
      this.gc.camera.add(24, 0.6);
      this.gc.audio.playSound("ultimate");
    }

    castUltimatePulse() {
      if (!this.ultimate) return;
      const u = this.ultimate;
      u.pulseIndex += 1;
      this.hardLock = Math.max(this.hardLock, 0.15);
      this.gc.audio.playSound("ultimateExplosion");

      // Rain strikes across screen: pick columns and strike down.
      const strikes = 6;
      for (let i = 0; i < strikes; i++) {
        const x = rand(60, this.gc.w - 60);
        const y0 = -30;
        const y1 = this.gc.h + 40;
        this.gc.spawnStrike(x, y0, y1);

        // Damage enemies near the strike line
        for (const e of this.gc.enemies) {
          if (!e.alive) continue;
          const dx = Math.abs(e.x - x);
          if (dx < 40) {
            e.hp -= 16;
            this.gc.spawnExplosion(e.x, e.y, e.getColor(), 8);
            if (e.hp <= 0) e.alive = false;
          }
        }
        if (this.gc.boss && this.gc.boss.alive) {
          const b = this.gc.boss;
          const dx = Math.abs(b.x - x);
          if (dx < 65) {
            b.hp -= 22;
            this.gc.spawnExplosion(b.x + rand(-40, 40), b.y + rand(-10, 20), COLORS.enemyBoss, 14);
            if (b.hp <= 0) b.alive = false;
          }
        }

        // also clears bullets near strike
        for (const p of this.gc.enemyProjectiles) {
          if (!p.alive) continue;
          const dx = Math.abs(p.x - x);
          if (dx < 35) {
            p.alive = false;
            this.gc.spawnSpark(p.x, p.y, "rgba(199,125,255,0.95)");
          }
        }
      }

      this.gc.camera.add(10, 0.12);

      if (u.pulseIndex >= u.maxPulses) {
        this.ultimate = null;
      }
    }

    onSnareHit(x, y) {
      this.snareNetBursts.push({ x, y, t: 0.65, max: 0.65 });
    }

    draw(ctx) {
      // Q net bursts
      for (const n of this.snareNetBursts) {
        const t = clamp(n.t / n.max, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.6 * t;
        ctx.strokeStyle = "rgba(101,240,255,0.95)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "rgba(101,240,255,0.95)";
        ctx.shadowBlur = 12;
        const r = lerp(10, 52, 1 - t);
        ctx.beginPath();
        ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
        ctx.stroke();

        // net lines
        ctx.shadowBlur = 0;
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2 + performance.now() * 0.001;
          ctx.beginPath();
          ctx.moveTo(n.x + Math.cos(a) * r, n.y + Math.sin(a) * r);
          ctx.lineTo(n.x + Math.cos(a + Math.PI * 0.55) * (r * 0.55), n.y + Math.sin(a + Math.PI * 0.55) * (r * 0.55));
          ctx.stroke();
        }
        ctx.restore();
      }

      // E shockwave
      if (this.burstWave) {
        const w = this.burstWave;
        const t = clamp(1 - w.t / w.life, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.8 * t;
        ctx.strokeStyle = "rgba(255,209,102,0.98)";
        ctx.lineWidth = 5;
        ctx.shadowColor = "rgba(255,209,102,0.98)";
        ctx.shadowBlur = 18;
        ctx.beginPath();
        ctx.arc(w.x, w.y, w.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }

      // R screen tint
      if (this.ultimate) {
        const t = clamp(this.ultimate.timer / 2.8, 0, 1);
        ctx.save();
        ctx.globalAlpha = 0.08 + 0.1 * (1 - t);
        ctx.fillStyle = "rgba(199,125,255,1)";
        ctx.fillRect(0, 0, this.gc.w, this.gc.h);
        ctx.restore();
      }
    }
  }

  // src/systems/starfield.js

  class Starfield {
    constructor(w, h) {
      this.w = w;
      this.h = h;
      this.stars = [];
      const n = 140;
      for (let i = 0; i < n; i++) this.stars.push(this.makeStar(true));
      this.decor = this.makeDecor();
    }
    resize(w, h) {
      this.w = w;
      this.h = h;
    }
    makeStar(randomY) {
      return {
        x: rand(0, this.w),
        y: randomY ? rand(0, this.h) : -20,
        z: rand(0.2, 1.0),
        r: rand(0.6, 1.6),
        tw: rand(0, Math.PI * 2),
      };
    }
    makeDecor() {
      // occasional planets/nebula blobs
      return {
        planet: {
          x: rand(this.w * 0.1, this.w * 0.9),
          y: rand(this.h * 0.12, this.h * 0.45),
          r: rand(40, 78),
          hue: rand(190, 290),
        },
        nebulae: Array.from({ length: 3 }, () => ({
          x: rand(this.w * 0.15, this.w * 0.85),
          y: rand(this.h * 0.05, this.h * 0.6),
          r: rand(90, 160),
          hue: rand(180, 320),
          a: rand(0.05, 0.12),
        })),
        timer: rand(8, 14),
      };
    }
    update(dt, speed) {
      for (const s of this.stars) {
        s.y += (60 + 190 * s.z) * dt * speed;
        s.tw += dt * (0.7 + s.z);
        if (s.y > this.h + 20) {
          s.x = rand(0, this.w);
          s.y = -20;
          s.z = rand(0.2, 1.0);
          s.r = rand(0.6, 1.6);
          s.tw = rand(0, Math.PI * 2);
        }
      }
      this.decor.timer -= dt;
      if (this.decor.timer <= 0) this.decor = this.makeDecor();
    }
    draw(ctx) {
      // nebulae
      for (const n of this.decor.nebulae) {
        ctx.save();
        ctx.globalAlpha = n.a;
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
        g.addColorStop(0, `hsla(${n.hue}, 90%, 65%, 0.8)`);
        g.addColorStop(1, `hsla(${n.hue}, 90%, 25%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // planet
      const p = this.decor.planet;
      ctx.save();
      ctx.globalAlpha = 0.18;
      const g2 = ctx.createRadialGradient(p.x - p.r * 0.25, p.y - p.r * 0.25, p.r * 0.2, p.x, p.y, p.r);
      g2.addColorStop(0, `hsla(${p.hue}, 90%, 70%, 0.85)`);
      g2.addColorStop(1, `hsla(${p.hue}, 90%, 18%, 0)`);
      ctx.fillStyle = g2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // stars
      for (const s of this.stars) {
        const a = 0.35 + 0.55 * Math.sin(s.tw) * 0.5 + 0.5;
        ctx.save();
        ctx.globalAlpha = 0.22 + 0.45 * s.z * a;
        ctx.fillStyle = "rgba(233,236,255,0.95)";
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  }

  // src/game/game-controller.js

  class GameController {
    constructor(canvas, overlayEl, audio = new AudioManager()) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.overlayEl = overlayEl;
      this.audio = audio;
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
      this.loseSoundPlayed = false;

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
      this.loseSoundPlayed = false;
      this.spawnWave();
      this.updateOverlay();
      this.audio.playBgm();
    }

    togglePause() {
      if (this.state === "playing") this.state = "paused";
      else if (this.state === "paused") this.state = "playing";
      if (this.state === "paused") this.audio.pauseBgm();
      if (this.state === "playing") this.audio.resumeBgm();
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
              Use <strong>Shift/Q/E</strong> tactically and unleash <strong>R</strong> only at <strong>full mana</strong>.
            </div>
            <div class="row">
              <span><kbd>Space</kbd> Plasma</span>
              <span><kbd>Shift</kbd> Dash invuln</span>
              <span><kbd>Q</kbd> Slow + cancel dives</span>
              <span><kbd>E</kbd> Shockwave</span>
              <span><kbd>R</kbd> Orbital strikes</span>
            </div>
          </div>
        `;
      } else if (this.state === "paused") {
        el.innerHTML = `
          <div class="panel">
            <div class="big">PAUSED</div>
            <div class="sub">Press <kbd>P</kbd> or <kbd>Esc</kbd> to resume.</div>
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
      this.audio.playSound("playerShoot");
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
      this.audio.playSound("playerGetBuff");
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
                this.audio.playSound("enemyDie");
                this.audio.playSound("explosion");
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
                this.audio.playSound("enemyDie");
                this.audio.playSound("explosion");
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
            this.audio.playSound("enemyDie");
            this.audio.playSound("explosion");
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
        if (!this.loseSoundPlayed) {
          this.loseSoundPlayed = true;
          this.audio.pauseBgm();
          this.audio.playSound("lose");
        }
        this.updateOverlay();
        return;
      }

      // lose if enemies reach bottom (Earth)
      if (this.spawnGrace <= 0) {
        for (const e of this.enemies) {
          if (e.alive && e.y + e.h / 2 >= this.earthLine) {
            this.loseBecauseEarth = true;
            this.state = "gameover";
            if (!this.loseSoundPlayed) {
              this.loseSoundPlayed = true;
              this.audio.pauseBgm();
              this.audio.playSound("lose");
            }
            this.updateOverlay();
            return;
          }
        }
        if (this.boss && this.boss.alive) {
          if (this.boss.y + this.boss.h / 2 >= this.earthLine) {
            this.loseBecauseEarth = true;
            this.state = "gameover";
            if (!this.loseSoundPlayed) {
              this.loseSoundPlayed = true;
              this.audio.pauseBgm();
              this.audio.playSound("lose");
            }
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
      if (this.input.wasPressed(KEYS.dash)) this.skillManager.tryCastDash();
      if (this.input.wasPressed(KEYS.q)) this.skillManager.tryCastQ();
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
      const hpH = 8;
      const hpLayers = Math.max(1, this.player.lives + 1);
      for (let i = hpLayers - 1; i >= 0; i--) {
        const layerY = hpY - i * 4;
        const isActiveLayer = i === 0;
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.fillRect(hpX, layerY, hpW, hpH);
        ctx.fillStyle = isActiveLayer ? COLORS.hp : "rgba(125,255,107,0.28)";
        ctx.fillRect(hpX, layerY, hpW * (isActiveLayer ? hpT : 1), hpH);
      }
      ctx.fillStyle = "rgba(233,236,255,0.88)";
      ctx.font = "700 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";
      ctx.fillText(`HP x${hpLayers}`, hpX + hpW + 10, hpY - (hpLayers - 1) * 2 - 2);

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
        const keys = ["dash", "q", "e", "r"];
        const labels = {
          dash: "DASH",
          q: "ION",
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
          const hotkey = k === "dash" ? "SHIFT" : k.toUpperCase();
          ctx.fillText(hotkey, box.x + 8, box.y + 6);
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

  // src/polyfills/canvas.js
  function installCanvasPolyfills() {
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
  }

  // src/main.js

  function main() {
    const canvas = document.getElementById("game");
    const overlay = document.getElementById("overlay");
    if (!canvas) return;

    installCanvasPolyfills();

    const audio = new AudioManager();
    audio.setupUnlock();

    const gc = new GameController(canvas, overlay, audio);
    let last = performance.now();

    const loop = (now) => {
      const dt = clamp((now - last) / 1000, 0, 1 / 20);
      last = now;
      gc.update(dt);
      gc.draw(gc.ctx);
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  window.addEventListener("load", main);

})();
