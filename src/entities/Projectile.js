const TIP = 7; // odległość grotu od środka pocisku
const STUCK_TIME = 0.5; // jak długo bełt tkwi w ścianie, zanim zniknie

/**
 * Pocisk lecący poziomo (bełt kuszy). Wbija się w ścianę, trafia cele na swojej drodze;
 * `pierce` to liczba dodatkowych celów, przez które może przelecieć.
 */
export class Projectile {
  constructor({ x, y, dir, speed, damage, knockback, range, pierce, charged = false }) {
    this.x = x;
    this.y = y;
    this.prevX = x;
    this.dir = dir;
    this.vx = dir * speed;
    this.damage = damage;
    this.knockback = knockback;
    this.range = range;
    this.pierce = pierce;
    this.charged = charged;
    this.traveled = 0;
    this.hitSet = new Set();
    this.stuckTimer = 0;
    this.dead = false;
  }

  get stuck() {
    return this.stuckTimer > 0;
  }

  update(dt, world) {
    this.prevX = this.x;
    if (this.stuck) {
      this.stuckTimer -= dt;
      if (this.stuckTimer <= 0) this.dead = true;
      return;
    }

    const step = this.vx * dt;
    this.x += step;
    this.traveled += Math.abs(step);

    const level = world.level;
    const T = level.tileSize;
    const tx = Math.floor((this.x + this.dir * TIP) / T);
    if (level.isSolid(tx, Math.floor(this.y / T))) {
      // Grot zatrzymuje się na powierzchni ściany.
      this.x = this.dir > 0 ? tx * T - TIP : (tx + 1) * T + TIP;
      this.vx = 0;
      this.stuckTimer = STUCK_TIME;
      return;
    }

    // Sprawdzamy cały odcinek przebyty w tym kroku, żeby szybki bełt nie „przeskoczył” celu.
    const x0 = Math.min(this.prevX, this.x) - TIP;
    const rect = { x: x0, y: this.y - 3, w: Math.abs(this.x - this.prevX) + TIP * 2, h: 6 };
    const hits = world.hitTargets(rect, { damage: this.damage, knockback: this.knockback, dir: this.dir, heavy: this.charged }, this.hitSet);
    if (hits > 0) {
      this.pierce -= hits;
      if (this.pierce < 0) this.dead = true;
    }
    if (this.traveled >= this.range) this.dead = true;
  }
}
