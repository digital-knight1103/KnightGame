import { CAMERA, VIEW } from '../config.js';
import { clamp } from './util.js';

/**
 * Kamera śledząca gracza.
 * - W poziomie: wyprzedza gracza w kierunku, w którym patrzy (widać, dokąd się biegnie).
 * - W pionie: trzyma „poziom odniesienia”, który zmienia się, gdy gracz stoi na ziemi
 *   albo spada poniżej niego. Zwykły skok nie szarpie kamerą w górę i w dół.
 * Ruch jest wygładzany wykładniczo, a pozycja do rysowania interpolowana między krokami.
 */
export class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.prevX = 0;
    this.prevY = 0;
    this.lookAhead = 0;
    this.focusY = 0;
    this.bounds = { width: VIEW.width, height: VIEW.height };
  }

  setBounds(width, height) {
    this.bounds = { width, height };
  }

  // Natychmiastowe ustawienie na celu (start poziomu, respawn).
  snapTo(target) {
    this.lookAhead = target.facing * CAMERA.lookAhead;
    this.focusY = target.feetY;
    this.x = this.clampX(target.centerX + this.lookAhead - VIEW.width / 2);
    this.y = this.clampY(this.focusY - VIEW.height * CAMERA.anchorY);
    this.prevX = this.x;
    this.prevY = this.y;
  }

  update(dt, target) {
    this.prevX = this.x;
    this.prevY = this.y;

    const lookGoal = target.facing * CAMERA.lookAhead;
    this.lookAhead += (lookGoal - this.lookAhead) * (1 - Math.exp(-CAMERA.lookAheadSpeed * dt));

    if (target.isGrounded || target.feetY > this.focusY) {
      this.focusY = target.feetY;
    } else if (target.feetY < this.focusY - CAMERA.upMargin) {
      this.focusY = target.feetY + CAMERA.upMargin;
    }

    const goalX = this.clampX(target.centerX + this.lookAhead - VIEW.width / 2);
    const goalY = this.clampY(this.focusY - VIEW.height * CAMERA.anchorY);
    this.x += (goalX - this.x) * (1 - Math.exp(-CAMERA.followX * dt));
    this.y += (goalY - this.y) * (1 - Math.exp(-CAMERA.followY * dt));
  }

  clampX(x) {
    return clamp(x, 0, Math.max(0, this.bounds.width - VIEW.width));
  }

  clampY(y) {
    return clamp(y, 0, Math.max(0, this.bounds.height - VIEW.height));
  }

  // Pozycja do rysowania: interpolowana i zaokrąglona do pełnych pikseli (bez „pływania” kafelków).
  renderPos(alpha) {
    return {
      x: Math.round(this.prevX + (this.x - this.prevX) * alpha),
      y: Math.round(this.prevY + (this.y - this.prevY) * alpha),
    };
  }
}
