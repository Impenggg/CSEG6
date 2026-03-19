import { clamp } from "../utils/math.js";

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


export { Particle };
