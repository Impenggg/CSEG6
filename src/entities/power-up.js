import { COLORS } from "../config/constants.js";
import { rand } from "../utils/math.js";

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


export { PowerUp };
