class AudioManager {
  constructor() {
    this.enabled = true;
    this.unlocked = false;
    this.bgm = null;
    this.sfx = new Map();
    this.config = {
      bgm: { src: "./assets/audio/background-music.mp3", volume: 0.35, loop: true },
      sounds: {
        playerShoot: { src: "./assets/audio/player-shoot.mp3", volume: 0.35 },
        dash: { src: "./assets/audio/dash.mp3", volume: 0.4 },
        snare: { src: "./assets/audio/snare.mp3", volume: 0.4 },
        burst: { src: "./assets/audio/burst.mp3", volume: 0.45 },
        ultimate: { src: "./assets/audio/ultimate.mp3", volume: 0.5 },
        ultimateExplosion: { src: "./assets/audio/ultimate-explosion.mp3", volume: 0.45 },
        playerHit: { src: "./assets/audio/player-hit.mp3", volume: 0.4 },
        enemyDie: { src: "./assets/audio/enemy-die.mp3", volume: 0.35 },
        explosion: { src: "./assets/audio/explosion.mp3", volume: 0.35 },
      },
    };
  }

  setupUnlock() {
    const unlock = () => {
      this.unlocked = true;
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
  }

  createAudio(src, volume, loop = false) {
    const audio = new Audio(src);
    audio.preload = "auto";
    audio.volume = volume;
    audio.loop = loop;
    audio.addEventListener("error", () => {
      audio.dataset.failed = "true";
    });
    return audio;
  }

  ensureBgm() {
    if (this.bgm) return this.bgm;
    const { src, volume, loop } = this.config.bgm;
    this.bgm = this.createAudio(src, volume, loop);
    return this.bgm;
  }

  ensureSound(name) {
    if (this.sfx.has(name)) return this.sfx.get(name);
    const soundConfig = this.config.sounds[name];
    if (!soundConfig) return null;
    const audio = this.createAudio(soundConfig.src, soundConfig.volume, false);
    this.sfx.set(name, audio);
    return audio;
  }

  playBgm() {
    if (!this.enabled || !this.unlocked) return;
    const bgm = this.ensureBgm();
    if (bgm.dataset.failed === "true") return;
    if (!bgm.paused) return;
    bgm.currentTime = 0;
    bgm.play().catch(() => {});
  }

  pauseBgm() {
    if (!this.bgm) return;
    this.bgm.pause();
  }

  resumeBgm() {
    if (!this.enabled || !this.unlocked || !this.bgm) return;
    if (this.bgm.dataset.failed === "true") return;
    if (!this.bgm.paused) return;
    this.bgm.play().catch(() => {});
  }

  stopBgm() {
    if (!this.bgm) return;
    this.bgm.pause();
    this.bgm.currentTime = 0;
  }

  playSound(name) {
    if (!this.enabled || !this.unlocked) return;
    const baseAudio = this.ensureSound(name);
    if (!baseAudio || baseAudio.dataset.failed === "true") return;

    const audio = baseAudio.cloneNode();
    audio.volume = baseAudio.volume;
    audio.play().catch(() => {});
  }
}

export { AudioManager };
