import { COLORS, KEYS } from "../config/constants.js";
import { Projectile } from "../entities/projectile.js";
import { clamp, lerp, rand } from "../utils/math.js";

class SkillManager {
  constructor(gc) {
    this.gc = gc;
    this.cooldowns = {
      q: 0,
      w: 0,
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
      q: { cost: 20, cd: this.cooldowns.q, ready: this.cooldowns.q <= 0 && m >= 20 },
      w: { cost: 15, cd: this.cooldowns.w, ready: this.cooldowns.w <= 0 && m >= 15 },
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
  }

  tryCastW() {
    if (this.cooldowns.w > 0) return;
    if (!this.gc.mana.spend(15)) return;
    this.cooldowns.w = 4.8;

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
  }

  tryCastE() {
    if (this.cooldowns.e > 0) return;
    if (!this.gc.mana.spend(30)) return;
    this.cooldowns.e = 10.5;

    // Plasma Burst: expanding shockwave, destroys nearby enemies & enemy bullets.
    this.burstWave = { x: this.gc.player.x, y: this.gc.player.y, r: 6, maxR: 210, t: 0, life: 0.65 };
    this.gc.camera.add(18, 0.35);
    this.gc.spawnText(this.gc.player.x, this.gc.player.y - 44, "PLASMA BURST", "rgba(255,209,102,0.95)");

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
  }

  castUltimatePulse() {
    if (!this.ultimate) return;
    const u = this.ultimate;
    u.pulseIndex += 1;
    this.hardLock = Math.max(this.hardLock, 0.15);

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


export { SkillManager };
