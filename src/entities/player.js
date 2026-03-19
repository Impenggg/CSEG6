import { COLORS, KEYS } from "../config/constants.js";
import { clamp } from "../utils/math.js";

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


export { Player };
