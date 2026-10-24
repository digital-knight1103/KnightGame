import { VIEW } from '../config.js';
import { Camera } from '../core/Camera.js';
import { clamp, createCanvas, lerp } from '../core/util.js';
import { Player } from '../entities/Player.js';
import { LevelRenderer } from '../render/LevelRenderer.js';
import { PlayerRenderer } from '../render/PlayerRenderer.js';
import { Level } from '../world/Level.js';
import { TitleScene } from './TitleScene.js';

const HINT_TIME = 7; // s – jak długo widać podpowiedź ze sterowaniem
const FALL_OUT_MARGIN = 96; // tyle pikseli pod mapą = gracz wypadł z poziomu

export class LevelScene {
  constructor(levelData) {
    this.name = 'LevelScene';
    this.level = new Level(levelData);
    this.levelRenderer = new LevelRenderer(this.level);
    this.player = new Player(this.level);
    this.playerRenderer = new PlayerRenderer();
    this.camera = new Camera();
    this.camera.setBounds(this.level.width, this.level.height);
    this.camera.snapTo(this.player);
    this.background = buildBackground();
    this.time = 0;
    this.prevTime = 0;
  }

  enter(game) {
    this.game = game;
  }

  update(dt) {
    const input = this.game.input;
    this.prevTime = this.time;
    this.time += dt;

    // Tymczasowo: Esc wraca do menu. Pauza z opcjami powstanie w Etapie 7.
    if (input.wasPressed('pause')) {
      this.game.setScene(new TitleScene());
      return;
    }

    this.player.update(dt, input);
    if (this.player.y > this.level.height + FALL_OUT_MARGIN) {
      this.player.respawn(this.level.spawn);
      this.camera.snapTo(this.player);
    }
    this.camera.update(dt, this.player);
  }

  render(ctx, alpha) {
    ctx.drawImage(this.background, 0, 0);

    const cam = this.camera.renderPos(alpha);
    this.levelRenderer.render(ctx, cam.x, cam.y);

    const p = this.player;
    const px = Math.round(lerp(p.prevCenterX, p.centerX, alpha) - cam.x);
    const py = Math.round(lerp(p.prevFeetY, p.feetY, alpha) - cam.y);
    this.playerRenderer.draw(ctx, p, px, py);

    if (this.game.debug) this.renderDebug(ctx, cam);
    this.renderHint(ctx, lerp(this.prevTime, this.time, alpha));
  }

  renderHint(ctx, t) {
    const a = clamp((HINT_TIME - t) / 1.5, 0, 1) * clamp(t / 0.8, 0, 1);
    if (a <= 0) return;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = '14px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(VIEW.width / 2 - 330, VIEW.height - 44, 660, 26);
    ctx.fillStyle = '#ddd3e8';
    ctx.fillText('← → ruch   ·   Spacja skok   ·   ↓ kucanie   ·   ↓ + Spacja zeskok   ·   Esc menu', VIEW.width / 2, VIEW.height - 26);
    ctx.restore();
  }

  renderDebug(ctx, cam) {
    const p = this.player;
    ctx.strokeStyle = '#4f4';
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(p.x - cam.x) + 0.5, Math.round(p.y - cam.y) + 0.5, p.w - 1, p.h - 1);
    const lines = [
      `stan: ${p.state}  (${p.stateTime.toFixed(2)} s)`,
      `vx ${p.vx.toFixed(0)}  vy ${p.vy.toFixed(0)}  ziemia: ${p.onGround ? 'tak' : 'nie'}`,
      `coyote ${p.coyoteTimer.toFixed(2)}  bufor skoku ${p.jumpBufferTimer.toFixed(2)}`,
    ];
    ctx.font = '12px monospace';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(6, 30, 300, lines.length * 16 + 8);
    ctx.fillStyle = '#9f9';
    lines.forEach((line, i) => ctx.fillText(line, 12, 46 + i * 16));
  }
}

// Tymczasowe tło (gradient + mgiełka przy dole). Paralaksa i światło dojdą w Etapie 5.
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
