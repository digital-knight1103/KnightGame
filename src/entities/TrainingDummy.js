/**
 * Manekin treningowy na poziomie testowym: przyjmuje trafienia, chwieje się (tłumiona
 * sprężyna) i pokazuje zadane obrażenia. Służy do sprawdzania ataków, zanim pojawią się potwory.
 */
export class TrainingDummy {
  constructor(x, feetY) {
    this.x = x;
    this.feetY = feetY;
    this.w = 22;
    this.h = 46;
    this.angle = 0;
    this.angularVelocity = 0;
    this.flash = 0;
    this.popups = [];
    this.hits = 0;
  }

  get hurtbox() {
    return { x: this.x - this.w / 2, y: this.feetY - this.h, w: this.w, h: this.h };
  }

  takeHit(hit) {
    this.flash = 0.12;
    this.angularVelocity += hit.dir * (2 + hit.knockback / 60);
    this.popups.push({ value: hit.damage, heavy: hit.heavy, t: 0, dx: (this.hits % 3) * 6 - 6 });
    this.hits++;
  }

  update(dt) {
    this.angularVelocity += (-60 * this.angle - 6 * this.angularVelocity) * dt;
    this.angle = Math.max(-0.6, Math.min(0.6, this.angle + this.angularVelocity * dt));
    this.flash = Math.max(0, this.flash - dt);
    for (const p of this.popups) p.t += dt;
    this.popups = this.popups.filter((p) => p.t < 0.8);
  }
}
