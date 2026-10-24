import { VIEW } from '../config.js';
import { clamp, createCanvas, lerp } from '../core/util.js';
import { CHARACTER_LIST } from '../entities/characters/index.js';
import { PlayerRenderer } from '../render/PlayerRenderer.js';
import testLevel from '../world/levels/testLevel.js';
import { LevelScene } from './LevelScene.js';
import { TitleScene } from './TitleScene.js';

const W = VIEW.width;
const H = VIEW.height;
const PANEL_W = 380;
const PANEL_H = 420;
const PANEL_Y = 84;
const FIGURE_SCALE = 3;
const FIGURE_FEET_Y = PANEL_Y + 190;
const MAX_HEALTH = Math.max(...CHARACTER_LIST.map((c) => c.maxHealth));
const MAX_SPEED = Math.max(...CHARACTER_LIST.map((c) => c.stats.runSpeed));

const panelX = (i) => W / 2 + (i - (CHARACTER_LIST.length - 1) / 2) * (PANEL_W + 40) - PANEL_W / 2;

// Model postaci do podglądu: ma te same pola, które czyta PlayerRenderer.
function previewModel(character, facing) {
  return {
    character,
    stats: character.stats,
    facing,
    moveState: 'idle',
    action: null,
    animTime: 0,
    stateTime: 0,
    squashX: 1,
    squashY: 1,
    vx: 0,
    vy: 0,
    runPhase: 0,
    flipTime: 0,
    climbProgress: 0,
  };
}

/**
 * Wybór postaci: dwie postacie obok siebie z animacją spoczynku, opisem i paskami statystyk.
 * Sterowanie: ← → wybór, potwierdzenie (Enter/Spacja/J/A), Esc powrót. Dotyk/mysz:
 * dotknięcie panelu wybiera postać, ponowne dotknięcie wybranej – potwierdza.
 */
export class CharacterSelectScene {
  constructor(selected = 0) {
    this.name = 'CharacterSelectScene';
    this.selected = selected;
    this.t = 0;
    this.prevT = 0;
    // Płynne podświetlenie wybranego panelu (0..1 dla każdego).
    this.highlight = CHARACTER_LIST.map((_, i) => (i === selected ? 1 : 0));
    this.prevHighlight = [...this.highlight];
    this.renderer = new PlayerRenderer();
    // Postacie zwrócone do środka ekranu.
    this.models = CHARACTER_LIST.map((c, i) => previewModel(c, i === 0 ? 1 : -1));
    this.background = buildBackground();
    this.confirmed = false;
  }

  enter(game) {
    this.game = game;
  }

  update(dt) {
    const input = this.game.input;
    this.prevT = this.t;
    this.t += dt;
    this.prevHighlight = [...this.highlight];
    this.highlight = this.highlight.map((h, i) => {
      const target = i === this.selected ? 1 : 0;
      return h + (target - h) * (1 - Math.exp(-10 * dt));
    });
    for (const m of this.models) m.animTime += dt;
    if (this.confirmed) return;

    const count = CHARACTER_LIST.length;
    if (input.wasPressed('left')) this.selected = (this.selected + count - 1) % count;
    if (input.wasPressed('right')) this.selected = (this.selected + 1) % count;

    if (input.tap) {
      const i = CHARACTER_LIST.findIndex((_, idx) => {
        const x = panelX(idx);
        return input.tap.x >= x && input.tap.x <= x + PANEL_W && input.tap.y >= PANEL_Y && input.tap.y <= PANEL_Y + PANEL_H;
      });
      if (i >= 0 && i === this.selected) this.confirm();
      else if (i >= 0) this.selected = i;
    }

    if (input.wasPressed('confirm')) this.confirm();
    else if (input.wasPressed('pause')) this.game.setScene(new TitleScene());
  }

  confirm() {
    this.confirmed = true;
    this.game.setScene(new LevelScene(testLevel, CHARACTER_LIST[this.selected], this.selected));
  }

  render(ctx, alpha) {
    const t = lerp(this.prevT, this.t, alpha);
    ctx.drawImage(this.background, 0, 0);

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = 'bold 34px "Palatino Linotype", Palatino, Georgia, serif';
    ctx.fillStyle = '#e6d3ad';
    ctx.shadowColor = 'rgba(255, 150, 70, 0.45)';
    ctx.shadowBlur = 16;
    ctx.fillText('Wybierz postać', W / 2, 54);
    ctx.restore();

    CHARACTER_LIST.forEach((character, i) => {
      const h = lerp(this.prevHighlight[i], this.highlight[i], alpha);
      this.renderPanel(ctx, character, this.models[i], panelX(i), h, t);
    });

    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '14px Georgia, serif';
    ctx.fillStyle = 'rgba(210, 200, 225, 0.7)';
    ctx.fillText('← → wybór   ·   Enter / Spacja – potwierdź   ·   Esc – powrót', W / 2, H - 16);
    ctx.restore();
  }

  renderPanel(ctx, character, model, x, h, t) {
    const cx = x + PANEL_W / 2;

    // Krąg światła pod postacią – mocniejszy przy wybranej.
    const spot = ctx.createRadialGradient(cx, FIGURE_FEET_Y - 40, 10, cx, FIGURE_FEET_Y - 40, 170);
    spot.addColorStop(0, `rgba(255, 196, 130, ${0.08 + 0.17 * h})`);
    spot.addColorStop(1, 'rgba(255, 196, 130, 0)');
    ctx.fillStyle = spot;
    ctx.fillRect(x, PANEL_Y, PANEL_W, PANEL_H);

    ctx.fillStyle = `rgba(10, 8, 16, ${0.45 - 0.15 * h})`;
    ctx.fillRect(x, PANEL_Y, PANEL_W, PANEL_H);
    ctx.strokeStyle = `rgba(201, 164, 110, ${0.2 + 0.7 * h})`;
    ctx.lineWidth = 1 + h;
    ctx.strokeRect(x + 0.5, PANEL_Y + 0.5, PANEL_W - 1, PANEL_H - 1);

    // Postój: kamienny cokół i postać w powiększeniu.
    ctx.fillStyle = '#1c1924';
    ctx.fillRect(cx - 60, FIGURE_FEET_Y, 120, 10);
    ctx.fillStyle = '#4b4459';
    ctx.fillRect(cx - 60, FIGURE_FEET_Y, 120, 2);
    ctx.save();
    ctx.translate(cx, FIGURE_FEET_Y);
    ctx.scale(FIGURE_SCALE, FIGURE_SCALE);
    model.animTime = t;
    this.renderer.draw(ctx, model, 0, 0);
    ctx.restore();

    const dim = 0.55 + 0.45 * h;
    ctx.save();
    ctx.globalAlpha = dim;
    ctx.textAlign = 'center';
    ctx.font = 'bold 22px "Palatino Linotype", Palatino, Georgia, serif';
    ctx.fillStyle = '#e6d3ad';
    ctx.fillText(character.name, cx, FIGURE_FEET_Y + 42);
    ctx.font = 'italic 14px Georgia, serif';
    ctx.fillStyle = '#b9a98e';
    ctx.fillText(character.role, cx, FIGURE_FEET_Y + 62);
    ctx.font = '14px Georgia, serif';
    ctx.fillStyle = '#d6cde2';
    character.description.forEach((line, i) => ctx.fillText(line, cx, FIGURE_FEET_Y + 88 + i * 18));

    const bars = [
      ['Zdrowie', character.maxHealth / MAX_HEALTH],
      ['Szybkość', character.stats.runSpeed / MAX_SPEED],
      ['Zasięg', character.range],
    ];
    ctx.textAlign = 'left';
    ctx.font = '13px Georgia, serif';
    bars.forEach(([label, value], i) => {
      const by = FIGURE_FEET_Y + 136 + i * 20;
      ctx.fillStyle = '#b9a98e';
      ctx.fillText(label, x + 60, by + 9);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(x + 150, by, 170, 10);
      ctx.fillStyle = '#c9a46e';
      ctx.fillRect(x + 150, by, 170 * clamp(value, 0, 1), 10);
    });
    ctx.textAlign = 'center';
    ctx.font = '13px Georgia, serif';
    ctx.fillStyle = '#9fd4ff';
    ctx.fillText(`Umiejętność: ${character.specialName}`, cx, FIGURE_FEET_Y + 210);
    ctx.restore();
  }
}

function buildBackground() {
  const { canvas, ctx } = createCanvas(W, H);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07060c');
  g.addColorStop(0.7, '#171126');
  g.addColorStop(1, '#22182c');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const v = ctx.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, W * 0.65);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}
