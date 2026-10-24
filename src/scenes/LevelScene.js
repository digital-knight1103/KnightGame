import { VIEW } from '../config.js';
import { Camera } from '../core/Camera.js';
import { clamp, createCanvas, lerp } from '../core/util.js';
import { Player } from '../entities/Player.js';
import { TrainingDummy } from '../entities/TrainingDummy.js';
import { drawDummy, drawProjectile } from '../render/EntityRenderers.js';
import { LevelRenderer } from '../render/LevelRenderer.js';
import { PlayerRenderer } from '../render/PlayerRenderer.js';
import { HUD } from '../ui/HUD.js';
import { Level } from '../world/Level.js';
import { CharacterSelectScene } from './CharacterSelectScene.js';

const HINT_TIME = 8; // s – jak długo widać podpowiedź ze sterowaniem
const FALL_OUT_MARGIN = 96; // tyle pikseli pod mapą = gracz wypadł z poziomu

const overlaps = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

/**
 * Scena poziomu. Jest też „światem” dla obiektów gry: udostępnia `level`,
 * `hitTargets()` (trafienia atakami gracza) i `spawnProjectile()`.
 */
export class LevelScene {
  constructor(levelData, character, characterIndex = 0) {
    this.name = 'LevelScene';
    this.characterIndex = characterIndex;
    this.level = new Level(levelData);
    this.levelRenderer = new LevelRenderer(this.level);
    this.player = new Player(this.level, character);
    this.playerRenderer = new PlayerRenderer();
    this.hud = new HUD(this.player);
    this.camera = new Camera();
    this.camera.setBounds(this.level.width, this.level.height);
    this.camera.snapTo(this.player);
    this.background = buildBackground();
    this.projectiles = [];
    this.targets = this.level.objects.filter((o) => o.type === 'dummy').map((o) => new TrainingDummy(o.x, o.y));
    this.time = 0;
    this.prevTime = 0;
    this.hint = `← → ruch  ·  Spacja skok  ·  J atak  ·  K ${character.specialName.toLowerCase()}  ·  ↓ kucanie  ·  Esc wybór postaci`;
  }

  enter(game) {
    this.game = game;
  }

  // Zadaje trafienie wszystkim celom w prostokącie, których nie ma jeszcze w `hitSet`.
  hitTargets(rect, hit, hitSet) {
    let count = 0;
    for (const target of this.targets) {
      if (hitSet.has(target) || !overlaps(rect, target.hurtbox)) continue;
      hitSet.add(target);
      target.takeHit(hit);
      count++;
    }
    return count;
  }

  spawnProjectile(projectile) {
    this.projectiles.push(projectile);
  }

  update(dt) {
    const input = this.game.input;
    this.prevTime = this.time;
    this.time += dt;

    // Tymczasowo: Esc wraca do wyboru postaci. Pauza z opcjami powstanie w Etapie 7.
    if (input.wasPressed('pause')) {
      this.game.setScene(new CharacterSelectScene(this.characterIndex));
      return;
    }

    this.player.update(dt, input, this);
    if (this.player.y > this.level.height + FALL_OUT_MARGIN) {
      this.player.respawn(this.level.spawn);
      this.camera.snapTo(this.player);
    }
    for (const p of this.projectiles) p.update(dt, this);
    this.projectiles = this.projectiles.filter((p) => !p.dead);
    for (const t of this.targets) t.update(dt);
    this.camera.update(dt, this.player);
  }

  render(ctx, alpha) {
    ctx.drawImage(this.background, 0, 0);

    const cam = this.camera.renderPos(alpha);
    this.levelRenderer.render(ctx, cam.x, cam.y);

    for (const d of this.targets) drawDummy(ctx, d, Math.round(d.x - cam.x), Math.round(d.feetY - cam.y));

    const p = this.player;
    const px = Math.round(lerp(p.prevCenterX, p.centerX, alpha) - cam.x);
    const py = Math.round(lerp(p.prevFeetY, p.feetY, alpha) - cam.y);
    this.playerRenderer.draw(ctx, p, px, py);

    for (const proj of this.projectiles) {
      drawProjectile(ctx, proj, Math.round(lerp(proj.prevX, proj.x, alpha) - cam.x), Math.round(proj.y - cam.y));
    }

    if (this.game.debug) this.renderDebug(ctx, cam);
    this.hud.render(ctx);
    this.renderHint(ctx, lerp(this.prevTime, this.time, alpha));
  }

  renderHint(ctx, t) {
    const a = clamp((HINT_TIME - t) / 1.5, 0, 1) * clamp(t / 0.8, 0, 1);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '14px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(this.hint).width + 32;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(VIEW.width / 2 - w / 2, VIEW.height - 44, w, 26);
    ctx.fillStyle = '#ddd3e8';
    ctx.fillText(this.hint, VIEW.width / 2, VIEW.height - 26);
    ctx.restore();
  }

  renderDebug(ctx, cam) {
    const p = this.player;
    ctx.lineWidth = 1;
    ctx.strokeStyle = p.invulnerable ? '#ff4' : '#4f4';
    ctx.strokeRect(Math.round(p.x - cam.x) + 0.5, Math.round(p.y - cam.y) + 0.5, p.w - 1, p.h - 1);
    // Aktywny obszar ciosu mieczem.
    const act = p.action;
    if (act && act.kind === 'sword' && act.t >= act.swing.windup && act.t < act.swing.windup + act.swing.active) {
      const r = act.hitbox();
      ctx.strokeStyle = '#f55';
      ctx.strokeRect(Math.round(r.x - cam.x) + 0.5, Math.round(r.y - cam.y) + 0.5, r.w - 1, r.h - 1);
    }
    ctx.strokeStyle = 'rgba(255, 160, 80, 0.7)';
    for (const t of this.targets) {
      const b = t.hurtbox;
      ctx.strokeRect(Math.round(b.x - cam.x) + 0.5, Math.round(b.y - cam.y) + 0.5, b.w - 1, b.h - 1);
    }
    const lines = [
      `stan: ${p.state}  (ruch: ${p.moveState}, ${p.stateTime.toFixed(2)} s)`,
      `vx ${p.vx.toFixed(0)}  vy ${p.vy.toFixed(0)}  ziemia: ${p.onGround ? 'tak' : 'nie'}  skoki w pow.: ${p.airJumpsLeft}`,
      `coyote ${p.coyoteTimer.toFixed(2)}  bufor skoku ${p.jumpBufferTimer.toFixed(2)}  pociski: ${this.projectiles.length}`,
    ];
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(6, 64, 430, lines.length * 16 + 8);
    ctx.fillStyle = '#9f9';
    lines.forEach((line, i) => ctx.fillText(line, 12, 80 + i * 16));
  }
}

// Tymczasowe tło (gradient). Paralaksa i światło dojdą w Etapie 5.
function buildBackground() {
  const { canvas, ctx } = createCanvas(VIEW.width, VIEW.height);
  const g = ctx.createLinearGradient(0, 0, 0, VIEW.height);
  g.addColorStop(0, '#07060c');
  g.addColorStop(0.6, '#161125');
  g.addColorStop(1, '#251a30');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  return canvas;
}
