import { rand } from "../utils/math.js";

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


export { CameraShake };
