import { COLORS } from "../config/constants.js";
import { Projectile } from "./projectile.js";
import { clamp, lerp, rand } from "../utils/math.js";

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


export { Boss };
