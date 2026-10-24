import { CHARACTERS, PLAYER } from '../../config.js';

const cfg = CHARACTERS.knight;

/**
 * Kombo mieczem z trzech ciosów. Każdy cios ma fazy: zamach (windup), trafienie (active)
 * i powrót (recovery). Naciśnięcie ataku w trakcie ciosu ustawia kolejny w kolejce –
 * startuje on, gdy obecny wejdzie w fazę powrotu. Trzeci cios jest silniejszy i odrzuca.
 */
export class SwordCombo {
  constructor(player, config) {
    this.player = player;
    this.config = config;
    this.kind = 'sword';
    this.stateName = 'attack';
    this.lockFacing = true;
    this.allowJump = false;
    this.decel = 700; // łagodne hamowanie, żeby wypad do przodu był odczuwalny
    this.reset();
  }

  reset() {
    this.active = false;
    this.cooldownTimer = 0;
    this.index = 0;
    this.t = 0;
    this.queued = false;
    this.hitSet = new Set();
  }

  // Na ziemi cios zatrzymuje postać, w powietrzu zostaje większość kontroli.
  get moveScale() {
    return this.player.onGround ? 0 : 0.85;
  }

  get swing() {
    return this.config.swings[this.index];
  }

  tick(dt) {
    if (!this.active) this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
  }

  tryStart(input) {
    if (this.cooldownTimer > 0 || !this.player.standUpForAction()) return false;
    this.active = true;
    this.beginSwing(0, input);
    this.ignorePress = true; // naciśnięcie, które rozpoczęło kombo, nie liczy się jako następny cios
    return true;
  }

  beginSwing(index, input) {
    const p = this.player;
    this.index = index;
    this.t = 0;
    this.queued = false;
    this.hitSet = new Set();
    const dir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);
    if (dir !== 0) p.facing = dir;
    if (p.onGround) p.vx = p.facing * this.swing.lunge;
  }

  update(dt, input, world) {
    const s = this.swing;
    const last = this.index === this.config.swings.length - 1;
    this.t += dt;

    if (this.ignorePress) this.ignorePress = false;
    else if (!last && input.wasPressed('attack')) this.queued = true;

    if (this.t >= s.windup && this.t < s.windup + s.active) {
      world.hitTargets(this.hitbox(), { damage: s.damage, knockback: s.knockback, dir: this.player.facing, heavy: last }, this.hitSet);
    }

    if (this.queued && this.t >= s.windup + s.active) {
      this.beginSwing(this.index + 1, input);
      return;
    }
    if (this.t >= s.windup + s.active + s.recovery) {
      this.active = false;
      this.cooldownTimer = last ? this.config.comboCooldown : this.config.cooldown;
    }
  }

  // Obszar trafienia przed postacią, od wysokości barków do stóp.
  hitbox() {
    const p = this.player;
    const s = this.swing;
    return {
      x: p.facing > 0 ? p.centerX : p.centerX - s.reach,
      y: p.feetY - s.height,
      w: s.reach,
      h: s.height + 2,
    };
  }
}

/**
 * Blok tarczą: działa, dopóki trzymany jest przycisk i starcza wytrzymałości.
 * Wytrzymałość spada w trakcie bloku i przy każdym zablokowanym ciosie, a odnawia się
 * po krótkiej przerwie. Całkowite wyczerpanie „łamie” blok do czasu częściowej regeneracji.
 */
export class ShieldBlock {
  constructor(player, config) {
    this.player = player;
    this.config = config;
    this.kind = 'block';
    this.stateName = 'special';
    this.lockFacing = true;
    this.allowJump = false;
    this.moveScale = config.moveFactor;
    this.reset();
  }

  reset() {
    this.active = false;
    this.stamina = this.config.maxStamina;
    this.regenTimer = 0;
    this.broken = false;
    this.t = 0;
  }

  tick(dt) {
    const c = this.config;
    if (!this.active) {
      this.regenTimer -= dt;
      if (this.regenTimer <= 0) this.stamina = Math.min(c.maxStamina, this.stamina + c.regenPerSecond * dt);
    }
    if (this.broken && this.stamina >= c.minStaminaToStart) this.broken = false;
  }

  tryStart() {
    if (this.broken || this.stamina <= 0 || !this.player.standUpForAction()) return false;
    this.active = true;
    this.t = 0;
    return true;
  }

  update(dt, input) {
    this.t += dt;
    this.stamina -= this.config.drainPerSecond * dt;
    if (this.stamina <= 0) {
      this.stamina = 0;
      this.broken = true;
      this.end();
    } else if (!input.isDown('special')) {
      this.end();
    }
  }

  end() {
    this.active = false;
    this.regenTimer = this.config.regenDelay;
  }

  // Czy cios nadchodzący z punktu sourceX zostanie przyjęty na tarczę (tylko z przodu).
  blocks(sourceX) {
    return this.active && Math.sign(sourceX - this.player.centerX) === this.player.facing;
  }

  // Obrażenia po zablokowaniu; każdy przyjęty cios kosztuje wytrzymałość.
  absorb(damage) {
    this.stamina = Math.max(0, this.stamina - this.config.hitStaminaCost);
    if (this.stamina === 0) {
      this.broken = true;
      this.end();
    }
    return damage * (1 - this.config.damageReduction);
  }

  // Dla HUD: poziom paska 0..1.
  get meter() {
    return this.stamina / this.config.maxStamina;
  }

  get meterState() {
    if (this.broken) return 'broken';
    return this.active ? 'active' : 'ready';
  }
}

export const knight = {
  id: 'knight',
  name: 'Rycerz Cieniołamacz',
  role: 'Walka wręcz',
  description: ['Ciężka zbroja i miecz, którego ostrze', 'świeci w ciemności. Kombo z trzech ciosów.'],
  specialName: 'Blok tarczą',
  maxHealth: cfg.maxHealth,
  stats: { ...PLAYER, ...cfg.movement },
  range: 0.3, // tylko do paska „Zasięg” na ekranie wyboru
  createAttack: (player) => new SwordCombo(player, cfg.combo),
  createSpecial: (player) => new ShieldBlock(player, cfg.block),
};
