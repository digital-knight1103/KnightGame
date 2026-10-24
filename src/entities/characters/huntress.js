import { CHARACTERS, PLAYER } from '../../config.js';
import { Projectile } from '../Projectile.js';

const cfg = CHARACTERS.huntress;

/**
 * Kusza: naciśnięcie zaczyna celowanie (postać zwalnia), puszczenie strzela.
 * Jeśli przycisk był trzymany co najmniej `fullChargeTime`, leci naładowany bełt –
 * szybszy, silniejszy i przebijający kilku wrogów. Celowanie przerywa przewrót.
 */
export class Crossbow {
  constructor(player, config) {
    this.player = player;
    this.config = config;
    this.kind = 'crossbow';
    this.stateName = 'attack';
    this.lockFacing = false;
    this.allowJump = true;
    this.reset();
  }

  reset() {
    this.active = false;
    this.phase = 'charge';
    this.charge = 0;
    this.t = 0;
    this.reloadTimer = 0;
  }

  get moveScale() {
    return this.phase === 'charge' ? this.config.aimMoveFactor : 0.7;
  }

  get cancelable() {
    return this.phase === 'charge';
  }

  // 0..1 – stopień naładowania (dla renderera).
  get chargeRatio() {
    return Math.min(1, this.charge / this.config.fullChargeTime);
  }

  tick(dt) {
    this.reloadTimer = Math.max(0, this.reloadTimer - dt);
  }

  tryStart() {
    if (this.reloadTimer > 0 || !this.player.standUpForAction()) return false;
    this.active = true;
    this.phase = 'charge';
    this.charge = 0;
    this.t = 0;
    return true;
  }

  update(dt, input, world) {
    if (this.phase === 'charge') {
      this.charge += dt;
      if (!input.isDown('attack')) this.fire(world);
      return;
    }
    this.t += dt;
    if (this.t >= this.config.recoilTime) this.active = false;
  }

  fire(world) {
    const p = this.player;
    const charged = this.charge >= this.config.fullChargeTime;
    const bolt = charged ? this.config.chargedBolt : this.config.bolt;
    world.spawnProjectile(
      new Projectile({ ...bolt, x: p.centerX + p.facing * 14, y: p.feetY - 29, dir: p.facing, charged }),
    );
    this.phase = 'recoil';
    this.t = 0;
    this.reloadTimer = this.config.reloadTime;
    p.vx -= p.facing * (charged ? 90 : 40); // odrzut
  }

  cancel() {
    this.active = false;
  }
}

/**
 * Przewrót: szybki zryw po ziemi w kierunku ruchu (lub patrzenia), z obniżonym hitboxem –
 * można nim przemknąć pod niskim przejściem. Przez początek przewrotu postać jest nietykalna.
 */
export class DodgeRoll {
  constructor(player, config) {
    this.player = player;
    this.config = config;
    this.kind = 'roll';
    this.stateName = 'special';
    this.lockFacing = true;
    this.allowJump = false;
    this.controlsVelocity = true;
    this.forceCrouch = true;
    this.moveScale = 1;
    this.reset();
  }

  reset() {
    this.active = false;
    this.t = 0;
    this.vx = 0;
    this.cooldownTimer = 0;
  }

  get progress() {
    return Math.min(1, this.t / this.config.duration);
  }

  get invulnerable() {
    return this.active && this.t < this.config.invulnerableTime;
  }

  tick(dt) {
    if (!this.active) this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
  }

  tryStart(input) {
    const p = this.player;
    if (this.cooldownTimer > 0 || !p.onGround) return false;
    const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    if (dir !== 0) p.facing = dir;
    if (!p.crouching) p.setCrouch(true);
    this.active = true;
    this.t = 0;
    this.vx = p.facing * this.config.speed;
    return true;
  }

  update(dt) {
    const c = this.config;
    this.t += dt;
    // Pełna prędkość przez większość przewrotu, wyhamowanie na końcu.
    const k = this.progress;
    this.vx = this.player.facing * c.speed * (k < 0.7 ? 1 : 1 - ((k - 0.7) / 0.3) * 0.6);
    if (this.t >= c.duration) {
      this.active = false;
      this.cooldownTimer = c.cooldown;
    }
  }

  get meter() {
    return this.active ? 0 : 1 - this.cooldownTimer / this.config.cooldown;
  }

  get meterState() {
    return this.meter >= 1 ? 'ready' : 'cooldown';
  }
}

export const huntress = {
  id: 'huntress',
  name: 'Łowczyni Świetlików',
  role: 'Walka dystansowa',
  description: ['Zwinna tropicielka z latarnią u pasa.', 'Kusza z bełtami ze światła, podwójny skok.'],
  specialName: 'Przewrót',
  maxHealth: cfg.maxHealth,
  stats: { ...PLAYER, ...cfg.movement },
  range: 0.9,
  createAttack: (player) => new Crossbow(player, cfg.crossbow),
  createSpecial: (player) => new DodgeRoll(player, cfg.roll),
};
