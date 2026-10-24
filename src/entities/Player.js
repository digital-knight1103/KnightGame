import { clamp } from '../core/util.js';
import { TILE } from '../world/Level.js';

const EPS = 0.001;

const approach = (value, target, delta) =>
  value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const easeOut = (t) => 1 - (1 - t) ** 2;

// Udział fazy „podciągnięcia w górę” w całej animacji wspinaczki na krawędź.
const CLIMB_UP_PART = 0.6;
// Czas salta przy podwójnym skoku (tylko wizualnie).
export const AIR_FLIP_TIME = 0.32;

/**
 * Gracz: wspólna logika ruchu i walki dla obu postaci. Postać (`character`) dostarcza
 * statystyki oraz dwie umiejętności: atak i specjalną.
 *
 * Stan ruchu (`moveState`), wynikający z fizyki:
 *   idle, run, crouch, jump, fall – zwykły ruch,
 *   land       – krótkie unieruchomienie po upadku z dużej wysokości,
 *   ledgeGrab  – wiszenie na krawędzi (bez grawitacji),
 *   climb      – skryptowane podciągnięcie na krawędź (bez kolizji).
 * Aktywna umiejętność (`action`) nakłada się na ruch: zmienia prędkość, blokuje skok itp.
 * Publiczny `state` to nazwa stanu akcji (attack/special) albo stan ruchu.
 * Stany hurt/dead dojdą w Etapie 4.
 *
 * Pozycja (x, y) to lewy górny róg hitboxa. Kolizje z kafelkami rozwiązujemy osobno
 * dla osi X i Y, co daje stabilne ślizganie po ścianach i podłodze.
 */
export class Player {
  constructor(level, character) {
    this.level = level;
    this.character = character;
    this.stats = character.stats;
    this.w = this.stats.width;
    this.maxHealth = character.maxHealth;
    this.health = this.maxHealth;
    this.attack = character.createAttack(this);
    this.special = character.createSpecial(this);
    this.respawn(level.spawn);
  }

  respawn(spawn) {
    this.h = this.stats.height;
    this.x = spawn.x - this.w / 2;
    this.y = spawn.y - this.h;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.moveState = 'idle';
    this.stateTime = 0;
    this.action = null;
    this.attack.reset();
    this.special.reset();
    this.onGround = true;
    this.crouching = false;
    this.isJumping = false; // wznoszenie z wciśniętym skokiem (dla zmiennej wysokości)
    this.airJumpsLeft = this.stats.airJumps;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.dropThroughTimer = 0;
    this.regrabTimer = 0;
    this.airPeakY = this.y;
    this.ledge = null;

    // Parametry czysto wizualne, czytane przez renderer.
    this.animTime = 0;
    this.runPhase = 0;
    this.squashX = 1;
    this.squashY = 1;
    this.flipTime = 0;

    this.prevCenterX = this.centerX;
    this.prevFeetY = this.feetY;
  }

  get centerX() {
    return this.x + this.w / 2;
  }

  get feetY() {
    return this.y + this.h;
  }

  get state() {
    return this.action ? this.action.stateName : this.moveState;
  }

  // Nietykalność (np. początek przewrotu) – wykorzystana przy obrażeniach w Etapie 4.
  get invulnerable() {
    return !!(this.action && this.action.invulnerable);
  }

  // Dla kamery: czy gracz ma „pewny grunt” (także wisząc na krawędzi).
  get isGrounded() {
    return this.onGround || this.moveState === 'ledgeGrab' || this.moveState === 'climb';
  }

  setMoveState(state) {
    if (this.moveState !== state) {
      this.moveState = state;
      this.stateTime = 0;
    }
  }

  update(dt, input, world) {
    this.prevCenterX = this.centerX;
    this.prevFeetY = this.feetY;
    this.animTime += dt;
    this.stateTime += dt;
    this.flipTime = Math.max(0, this.flipTime - dt);

    this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    this.dropThroughTimer = Math.max(0, this.dropThroughTimer - dt);
    this.regrabTimer = Math.max(0, this.regrabTimer - dt);
    // Bufor skoku: naciśnięcie tuż przed lądowaniem i tak zostanie wykonane.
    if (input.wasPressed('jump')) this.jumpBufferTimer = this.stats.jumpBufferTime;

    this.attack.tick(dt);
    this.special.tick(dt);

    const moveDir = (input.isDown('right') ? 1 : 0) - (input.isDown('left') ? 1 : 0);

    if (this.moveState === 'ledgeGrab') this.updateLedgeGrab(input, moveDir);
    else if (this.moveState === 'climb') this.updateClimb();
    else {
      this.startActions(input);
      if (this.action) {
        this.action.update(dt, input, world);
        if (!this.action.active) this.action = null;
      }
      this.updateMovement(dt, input, moveDir);
    }

    // Rozciąganie/ściskanie wraca płynnie do normy.
    const k = 1 - Math.exp(-14 * dt);
    this.squashX += (1 - this.squashX) * k;
    this.squashY += (1 - this.squashY) * k;
  }

  startActions(input) {
    if (this.moveState === 'land') return;
    const current = this.action;
    if (input.wasPressed('special') && (!current || current.cancelable) && this.special.tryStart(input)) {
      if (current) current.cancel();
      this.action = this.special;
      return;
    }
    if (!current && input.wasPressed('attack') && this.attack.tryStart(input)) {
      this.action = this.attack;
    }
  }

  // Akcje wykonuje się na stojąco: kucająca postać wstaje, o ile ma miejsce nad głową.
  standUpForAction() {
    if (!this.crouching) return true;
    if (!this.canStand()) return false;
    this.setCrouch(false);
    return true;
  }

  updateMovement(dt, input, moveDir) {
    const s = this.stats;
    const act = this.action;
    const landing = this.moveState === 'land';
    const moveScale = act ? act.moveScale : 1;
    const dir = landing || moveScale === 0 ? 0 : moveDir;

    // Kucanie: niższy hitbox; wstajemy tylko, gdy nad głową jest miejsce.
    if (!(act && act.forceCrouch)) {
      const wantsCrouch = this.onGround && !landing && !act && input.isDown('down');
      if (wantsCrouch && !this.crouching) this.setCrouch(true);
      else if (!wantsCrouch && this.crouching && this.canStand()) this.setCrouch(false);
    }

    // Ruch poziomy z bezwładnością: osobne przyspieszenie, hamowanie i zawracanie.
    if (dir !== 0 && !(act && act.lockFacing)) this.facing = dir;
    if (act && act.controlsVelocity) {
      this.vx = act.vx;
    } else {
      const maxSpeed = (this.crouching ? s.crouchSpeed : s.runSpeed) * moveScale;
      let accel;
      if (dir === 0) accel = act && act.decel && this.onGround ? act.decel : this.onGround ? s.groundDecel : s.airDecel;
      else if (this.vx !== 0 && Math.sign(this.vx) !== dir) accel = this.onGround ? s.turnAccel : s.airAccel;
      else accel = this.onGround ? s.groundAccel : s.airAccel;
      this.vx = approach(this.vx, dir * maxSpeed, accel * dt);
    }

    // Skok (z coyote time), zeskok z platformy przechodniej (↓ + skok) albo skok w powietrzu.
    const canJump = !landing && (!act || act.allowJump);
    if (canJump && this.jumpBufferTimer > 0 && (this.onGround || this.coyoteTimer > 0)) {
      if (this.onGround && input.isDown('down') && this.isOnOneWayOnly()) {
        this.jumpBufferTimer = 0;
        this.dropThroughTimer = s.dropThroughTime;
        this.onGround = false;
        if (this.crouching && this.canStand()) this.setCrouch(false);
      } else if (this.canStand()) {
        if (this.crouching) this.setCrouch(false);
        this.launch(s.jumpHeight);
      }
    } else if (canJump && input.wasPressed('jump') && !this.onGround && this.airJumpsLeft > 0) {
      this.airJumpsLeft--;
      this.launch(s.airJumpHeight);
      this.flipTime = AIR_FLIP_TIME;
    }

    // Zmienna wysokość skoku: puszczenie przycisku przy wznoszeniu ucina prędkość.
    if (this.isJumping && this.vy < 0 && !input.isDown('jump')) {
      this.vy *= s.jumpCutMultiplier;
      this.isJumping = false;
    }
    if (this.vy >= 0) this.isJumping = false;

    let gravity = s.gravity;
    if (Math.abs(this.vy) < s.apexThreshold && input.isDown('jump') && !this.onGround) {
      gravity *= s.apexGravityMultiplier;
    } else if (this.vy > 0) {
      gravity *= s.fallGravityMultiplier;
    }
    this.vy = Math.min(this.vy + gravity * dt, s.maxFallSpeed);

    const wasOnGround = this.onGround;
    const prevTop = this.y;
    this.moveX(dt);
    const impactSpeed = this.vy;
    this.moveY(dt);

    if (this.onGround) {
      this.coyoteTimer = s.coyoteTime;
      this.airJumpsLeft = s.airJumps;
      if (!wasOnGround) this.onLand(impactSpeed);
      this.airPeakY = this.y;
      this.runPhase += (Math.abs(this.vx) * dt) / 16;
    } else {
      this.airPeakY = Math.min(this.airPeakY, this.y);
      if (this.crouching && !(act && act.forceCrouch) && this.canStand()) this.setCrouch(false);
      const canGrab = this.vy >= 0 && this.regrabTimer <= 0 && !this.crouching && !act;
      if (canGrab && this.tryLedgeGrab(prevTop, moveDir)) return;
    }

    if (this.moveState === 'land') {
      if (this.stateTime >= s.heavyLandingTime) this.setMoveState('idle');
      return;
    }
    if (this.onGround) {
      if (this.crouching) this.setMoveState('crouch');
      else if (dir !== 0 || Math.abs(this.vx) > 5) this.setMoveState('run');
      else this.setMoveState('idle');
    } else {
      this.setMoveState(this.vy < 0 ? 'jump' : 'fall');
    }
  }

  launch(height) {
    this.vy = -Math.sqrt(2 * this.stats.gravity * height);
    this.onGround = false;
    this.isJumping = true;
    this.jumpBufferTimer = 0;
    this.coyoteTimer = 0;
    this.airPeakY = this.y;
    this.squashX = 0.8;
    this.squashY = 1.22;
  }

  onLand(impactSpeed) {
    const fallDistance = this.y - this.airPeakY;
    const squash = clamp(impactSpeed / 2400, 0.05, 0.3);
    this.squashY = 1 - squash;
    this.squashX = 1 + squash * 0.8;
    this.flipTime = 0;
    if (fallDistance >= this.stats.heavyLandingDistance && !this.action) {
      this.setMoveState('land');
      this.vx *= 0.2;
      this.squashY = 0.65;
      this.squashX = 1.3;
    }
  }

  setCrouch(on) {
    const newHeight = on ? this.stats.crouchHeight : this.stats.height;
    this.y += this.h - newHeight; // stopy zostają w miejscu
    this.h = newHeight;
    this.crouching = on;
  }

  canStand() {
    return this.level.isRectFree(this.x, this.feetY - this.stats.height, this.w, this.stats.height);
  }

  // Czy pod stopami są wyłącznie platformy przechodnie (wtedy ↓ + skok pozwala zeskoczyć).
  isOnOneWayOnly() {
    const T = this.level.tileSize;
    const ty = Math.floor((this.feetY + 1) / T);
    let oneWay = false;
    for (let tx = Math.floor(this.x / T); tx <= Math.floor((this.x + this.w - EPS) / T); tx++) {
      const tile = this.level.tileAt(tx, ty);
      if (tile === TILE.SOLID) return false;
      if (tile === TILE.ONE_WAY) oneWay = true;
    }
    return oneWay;
  }

  moveX(dt) {
    const level = this.level;
    const T = level.tileSize;
    this.x += this.vx * dt;
    const ty0 = Math.floor(this.y / T);
    const ty1 = Math.floor((this.y + this.h - EPS) / T);
    if (this.vx > 0) {
      const tx = Math.floor((this.x + this.w - EPS) / T);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (level.isSolid(tx, ty)) {
          this.x = tx * T - this.w;
          this.vx = 0;
          break;
        }
      }
    } else if (this.vx < 0) {
      const tx = Math.floor(this.x / T);
      for (let ty = ty0; ty <= ty1; ty++) {
        if (level.isSolid(tx, ty)) {
          this.x = (tx + 1) * T;
          this.vx = 0;
          break;
        }
      }
    }
  }

  moveY(dt) {
    const level = this.level;
    const T = level.tileSize;
    const prevBottom = this.y + this.h;
    this.y += this.vy * dt;
    this.onGround = false;
    const tx0 = Math.floor(this.x / T);
    const tx1 = Math.floor((this.x + this.w - EPS) / T);

    if (this.vy > 0) {
      const ty = Math.floor((this.y + this.h - EPS) / T);
      const tileTop = ty * T;
      for (let tx = tx0; tx <= tx1; tx++) {
        const tile = level.tileAt(tx, ty);
        // Platforma przechodnia blokuje tylko, jeśli w poprzednim kroku stopy były nad nią.
        const landsOnOneWay = tile === TILE.ONE_WAY && this.dropThroughTimer <= 0 && prevBottom <= tileTop + EPS;
        if (tile === TILE.SOLID || landsOnOneWay) {
          this.y = tileTop - this.h;
          this.vy = 0;
          this.onGround = true;
          break;
        }
      }
    } else if (this.vy < 0) {
      const ty = Math.floor(this.y / T);
      for (let tx = tx0; tx <= tx1; tx++) {
        if (level.isSolid(tx, ty)) {
          this.y = (ty + 1) * T;
          this.vy = 0;
          this.isJumping = false;
          break;
        }
      }
    }
  }

  /**
   * Chwytanie krawędzi: gracz spada, przylega do ściany, trzyma kierunek w jej stronę,
   * a jego dłonie (górna krawędź hitboxa) właśnie minęły górny róg ściany. Dodatkowo nad
   * krawędzią musi być miejsce na podciągnięcie się i stanięcie.
   */
  tryLedgeGrab(prevTop, moveDir) {
    const s = this.stats;
    const level = this.level;
    const T = level.tileSize;
    const dir = this.facing;
    if (moveDir !== dir) return false;

    const probeX = dir > 0 ? this.x + this.w + 1 : this.x - 1;
    const tx = Math.floor(probeX / T);
    const wallX = dir > 0 ? tx * T : (tx + 1) * T;
    const gap = dir > 0 ? wallX - (this.x + this.w) : this.x - wallX;
    if (gap > 2) return false;

    // Punkt chwytu leży nieco nad dłońmi (zasięg rąk) – chwyt jest bardziej wyrozumiały.
    const prevHand = prevTop + s.ledgeHandOffset - s.ledgeReach;
    const hand = this.y + s.ledgeHandOffset - s.ledgeReach;
    for (let ty = Math.floor(prevHand / T); ty <= Math.floor(hand / T); ty++) {
      const ledgeTop = ty * T;
      if (ledgeTop < prevHand || ledgeTop > hand) continue;
      if (!level.isSolid(tx, ty) || level.isSolid(tx, ty - 1)) continue;

      const hangX = dir > 0 ? wallX - this.w : wallX;
      const hangY = ledgeTop - s.ledgeHandOffset;
      const standX = dir > 0 ? wallX + 2 : wallX - this.w - 2;
      const standY = ledgeTop - s.height;
      const pathFree =
        level.isRectFree(hangX, standY, this.w, hangY + this.h - standY) &&
        level.isRectFree(standX, standY, this.w, s.height);
      if (!pathFree) continue;

      this.x = hangX;
      this.y = hangY;
      this.vx = 0;
      this.vy = 0;
      this.isJumping = false;
      this.flipTime = 0;
      this.airJumpsLeft = s.airJumps;
      this.ledge = { dir, hangX, hangY, standX, standY };
      this.setMoveState('ledgeGrab');
      return true;
    }
    return false;
  }

  updateLedgeGrab(input, moveDir) {
    // Puszczenie: w dół albo kierunek od ściany.
    if (input.wasPressed('down') || moveDir === -this.ledge.dir) {
      this.ledge = null;
      this.regrabTimer = this.stats.ledgeRegrabDelay;
      this.onGround = false;
      this.airPeakY = this.y;
      this.setMoveState('fall');
      return;
    }
    // Podciągnięcie: skok lub w górę.
    if (this.jumpBufferTimer > 0 || input.wasPressed('up')) {
      this.jumpBufferTimer = 0;
      this.setMoveState('climb');
    }
  }

  // Wspinaczka jest skryptowana: najpierw ciało idzie w górę wzdłuż ściany, potem na krawędź.
  updateClimb() {
    const { hangX, hangY, standX, standY } = this.ledge;
    const p = clamp(this.stateTime / this.stats.ledgeClimbTime, 0, 1);
    if (p < CLIMB_UP_PART) {
      this.x = hangX;
      this.y = hangY + (standY - hangY) * easeInOut(p / CLIMB_UP_PART);
    } else {
      this.y = standY;
      this.x = hangX + (standX - hangX) * easeOut((p - CLIMB_UP_PART) / (1 - CLIMB_UP_PART));
    }
    if (p >= 1) {
      this.ledge = null;
      this.onGround = true;
      this.airPeakY = this.y;
      this.squashY = 0.9;
      this.squashX = 1.08;
      this.setMoveState('idle');
    }
  }

  // Postęp wspinaczki 0..1 (dla renderera).
  get climbProgress() {
    return this.moveState === 'climb' ? clamp(this.stateTime / this.stats.ledgeClimbTime, 0, 1) : 0;
  }
}
