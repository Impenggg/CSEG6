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


export { Projectile };
