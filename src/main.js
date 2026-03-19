import { GameController } from "./game/game-controller.js";
import { installCanvasPolyfills } from "./polyfills/canvas.js";
import { clamp } from "./utils/math.js";

function main() {
  const canvas = document.getElementById("game");
  const overlay = document.getElementById("overlay");
  if (!canvas) return;

  installCanvasPolyfills();

  const gc = new GameController(canvas, overlay);
  let last = performance.now();

  const loop = (now) => {
    const dt = clamp((now - last) / 1000, 0, 1 / 20);
    last = now;
    gc.update(dt);
    gc.draw(gc.ctx);
    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

window.addEventListener("load", main);
