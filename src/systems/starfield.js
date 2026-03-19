import { rand } from "../utils/math.js";

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


export { Starfield };
