import { COLORS } from "../config/constants.js";
import { Projectile } from "./projectile.js";
import { chance, clamp, rand } from "../utils/math.js";

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


export { Enemy };
