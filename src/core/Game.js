import { SCENES, VIEW } from '../config.js';
import { clamp } from './util.js';

/**
 * Menedżer scen i globalnego stanu gry.
 *
 * Interfejs sceny (wszystkie metody opcjonalne poza update/render):
 *   enter(game)        – scena staje się aktywna
 *   exit()             – scena jest zamykana
 *   update(dt)         – logika w stałym kroku fizyki
 *   render(ctx, alpha) – rysowanie; alpha ∈ [0, 1) to postęp między ostatnim a następnym krokiem
 *
 * Nad sceną główną może leżeć stos nakładek (np. pauza). Aktualizowana jest tylko najwyższa
 * warstwa, a rysowane są wszystkie – dzięki temu scena pod pauzą jest widoczna, ale zamrożona.
 */
export class Game {
  constructor(input) {
    this.input = input;
    this.scene = null;
    this.overlays = [];
    this.time = 0;

    // Przejście między scenami: wygaszenie do czerni, podmiana, rozjaśnienie.
    this.transition = null; // { phase: 'out' | 'in', t, next }

    this.debug = false;
    this.stats = { fps: 0, ups: 0 };
  }

  setScene(scene, { fade = true } = {}) {
    if (!fade) {
      this.transition = null;
      this.swapScene(scene);
      return;
    }
    if (!this.scene) {
      // Pierwsza scena: od razu podmieniamy i tylko rozjaśniamy z czerni.
      this.swapScene(scene);
      this.transition = { phase: 'in', t: 0, next: null };
      return;
    }
    if (this.transition && this.transition.phase === 'out') {
      this.transition.next = scene;
      return;
    }
    this.transition = { phase: 'out', t: 0, next: scene };
  }

  swapScene(scene) {
    while (this.overlays.length) this.popOverlay();
    if (this.scene && this.scene.exit) this.scene.exit();
    this.scene = scene;
    if (scene.enter) scene.enter(this);
  }

  pushOverlay(overlay) {
    this.overlays.push(overlay);
    if (overlay.enter) overlay.enter(this);
  }

  popOverlay() {
    const overlay = this.overlays.pop();
    if (overlay && overlay.exit) overlay.exit();
  }

  update(dt) {
    this.time += dt;
    if (this.input.wasPressed('debug')) this.debug = !this.debug;

    const tr = this.transition;
    if (tr) {
      tr.t += dt;
      if (tr.phase === 'out') {
        if (tr.t >= SCENES.fadeTime) {
          this.swapScene(tr.next);
          this.transition = { phase: 'in', t: 0, next: null };
        }
        // Podczas wygaszania stara scena jest zamrożona i nie reaguje na wejście.
        return;
      }
      if (tr.t >= SCENES.fadeTime) this.transition = null;
    }

    const top = this.overlays.length ? this.overlays[this.overlays.length - 1] : this.scene;
    if (top) top.update(dt);
  }

  render(ctx, alpha) {
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);

    if (this.scene) this.scene.render(ctx, alpha);
    for (const overlay of this.overlays) overlay.render(ctx, alpha);

    const tr = this.transition;
    if (tr) {
      const p = clamp(tr.t / SCENES.fadeTime, 0, 1);
      const darkness = tr.phase === 'out' ? p : 1 - p;
      ctx.fillStyle = `rgba(0, 0, 0, ${darkness})`;
      ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    }

    if (this.debug) this.renderDebug(ctx);
  }

  renderDebug(ctx) {
    const sceneName = this.scene ? this.scene.name : '—';
    const text = `FPS ${this.stats.fps}  |  UPS ${this.stats.ups}  |  scena: ${sceneName}`;
    ctx.save();
    ctx.font = '12px monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(6, 6, ctx.measureText(text).width + 12, 20);
    ctx.fillStyle = '#9f9';
    ctx.fillText(text, 12, 10);
    ctx.restore();
  }
}
