import { KEYS } from "../config/constants.js";

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


export { Input };
