# Galactic Defender

Small HTML5 canvas shooter organized into focused folders so the game is easier to extend and maintain.

## Project Map

### Root files

- `index.html`
  Main page shell. It renders the canvas, overlay, HUD frame, and loads the JavaScript entry point.
- `style.css`
  Top-level stylesheet that imports the split CSS files from `styles/`.
- `README.md`
  This guide.
- `script.js`
  Browser-safe runtime bundle generated from the modular `src/` files.

### `src/`

- `src/main.js`
  Browser entry point. Boots the game, installs canvas polyfills, and starts the animation loop.

### `src/config/`

- `src/config/constants.js`
  Shared constants such as colors and key bindings.

### `src/utils/`

- `src/utils/math.js`
  Reusable math helpers like `clamp`, `lerp`, random ranges, and chance rolls.

### `src/core/`

- `src/core/input.js`
  Keyboard input tracking for held keys and one-frame presses.
- `src/core/camera-shake.js`
  Camera shake state and offset generation for impacts and abilities.
- `src/core/mana-system.js`
  Mana storage, gain caps, spending, and reset logic.

### `src/entities/`

- `src/entities/player.js`
  Player state, movement, firing, drawing, and damage handling.
- `src/entities/enemy.js`
  Standard enemy movement, firing, slow effects, and drawing.
- `src/entities/boss.js`
  Boss behavior, patterns, health, and rendering.
- `src/entities/projectile.js`
  Shared projectile model for player and enemy bullets.
- `src/entities/particle.js`
  Small visual effect particles used for sparks and explosions.
- `src/entities/power-up.js`
  Falling pickups and their visuals.

### `src/systems/`

- `src/systems/skill-manager.js`
  Ability cooldowns, mana-based casting, ability effects, and skill-specific visuals.
- `src/systems/starfield.js`
  Animated background stars, planet, and nebula effects.
- `src/systems/audio-manager.js`
  Optional audio loading and playback for music and sound effects.

### `src/game/`

- `src/game/game-controller.js`
  Main game orchestration. Handles waves, collisions, win/loss state, entity updates, HUD rendering, and overlays.

### `src/polyfills/`

- `src/polyfills/canvas.js`
  Compatibility helper for `roundRect` on browsers that do not support it natively.

### `styles/`

- `styles/base.css`
  Global variables, reset-like rules, and page-wide base styling.
- `styles/layout.css`
  Structural layout for the page frame, top bar, bottom bar, and stage.
- `styles/components.css`
  Component-level styles for the canvas, overlay panels, and keyboard hints.

### `assets/audio/`

- `assets/audio/README.md`
  Lists the audio filenames the game looks for.
- `assets/audio/*.mp3`
  Place your background music and sound effects here.

## Control Summary

- Move horizontally with `A`/`D` or `Left`/`Right`, and vertically with `W`/`S` or `Up`/`Down`
- Shoot: `Space`
- Skills: `Shift`, `Q`, `E`, `R`
- Start/Restart: `Enter`
- Pause: `P` or `Escape`

## Main Idea

The project is split by responsibility:

- `config` stores shared values
- `utils` stores generic helpers
- `core` stores low-level reusable systems
- `entities` stores things that exist in the world
- `systems` stores gameplay features that coordinate multiple entities
- `game` stores high-level game flow
- `styles` stores visual layers for the page
