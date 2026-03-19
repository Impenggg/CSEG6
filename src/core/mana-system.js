class ManaSystem {
  constructor(maxMana) {
    this.max = maxMana;
    this.value = 0;
    this.gainCapPerSecond = 18; // prevents abuse; still feels responsive
    this.gainedThisSecond = 0;
    this.secondTimer = 0;
  }
  reset() {
    this.value = 0;
    this.gainedThisSecond = 0;
    this.secondTimer = 0;
  }
  update(dt) {
    this.secondTimer += dt;
    if (this.secondTimer >= 1) {
      this.secondTimer -= 1;
      this.gainedThisSecond = 0;
    }
  }
  canSpend(cost) {
    return this.value >= cost;
  }
  spend(cost) {
    if (this.value < cost) return false;
    this.value -= cost;
    return true;
  }
  gain(amount) {
    const remainingCap = Math.max(0, this.gainCapPerSecond - this.gainedThisSecond);
    const add = Math.min(amount, remainingCap);
    if (add <= 0) return 0;
    const before = this.value;
    this.value = clamp(this.value + add, 0, this.max);
    const actual = this.value - before;
    this.gainedThisSecond += actual;
    return actual;
  }
  isFull() {
    return this.value >= this.max - 1e-6;
  }
}


export { ManaSystem };
