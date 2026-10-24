import { VIEW } from '../config.js';
import { createCanvas, createRng } from '../core/util.js';
import { TILE } from '../world/Level.js';

const CHUNK_COLS = 16; // szerokość jednego pre-renderowanego fragmentu w kafelkach

const COLORS = {
  rockDeep: '#100e15',
  rock: '#1c1924',
  rockSide: '#2a2634',
  rockTop: '#4b4459',
  seam: '#0c0a10',
  moss: '#2e3a2b',
  plank: '#4a3626',
  plankLight: '#6a4f37',
  plankDark: '#24180f',
};

/**
 * Rysowanie kafelków poziomu. Kafelki są statyczne, więc renderujemy je raz do pionowych
 * „pasów” (chunków) poza ekranem i w każdej klatce rysujemy tylko pasy widoczne w kadrze.
 * Później można tu podmienić rysowanie proceduralne na tileset bez ruszania logiki poziomu.
 */
export class LevelRenderer {
  constructor(level) {
    this.level = level;
    this.chunks = [];
    const T = level.tileSize;
    for (let c0 = 0; c0 < level.cols; c0 += CHUNK_COLS) {
      const cols = Math.min(CHUNK_COLS, level.cols - c0);
      const { canvas, ctx } = createCanvas(cols * T, level.height);
      for (let ty = 0; ty < level.rows; ty++) {
        for (let tx = c0; tx < c0 + cols; tx++) {
          drawTile(ctx, level, tx, ty, (tx - c0) * T, ty * T);
        }
      }
      this.chunks.push({ x: c0 * T, canvas });
    }
  }

  // camX/camY to lewy górny róg kamery w pikselach świata (zaokrąglone).
  render(ctx, camX, camY) {
    for (const chunk of this.chunks) {
      const sx = chunk.x - camX;
      if (sx + chunk.canvas.width < 0 || sx > VIEW.width) continue;
      ctx.drawImage(chunk.canvas, sx, -camY);
    }
  }
}

function drawTile(ctx, level, tx, ty, x, y) {
  const tile = level.tileAt(tx, ty);
  if (tile === TILE.SOLID) drawRock(ctx, level, tx, ty, x, y);
  else if (tile === TILE.ONE_WAY) drawPlank(ctx, tx, ty, x, y, level.tileSize);
}

function drawRock(ctx, level, tx, ty, x, y) {
  const T = level.tileSize;
  const rng = createRng(tx * 7919 + ty * 104729);
  const open = (dx, dy) => !level.isSolid(tx + dx, ty + dy);
  const top = open(0, -1);
  const bottom = open(0, 1);
  const left = open(-1, 0);
  const right = open(1, 0);
  const exposed = top || bottom || left || right;

  // Wnętrze masywu jest ciemniejsze – czytelna granica między tłem a podłożem.
  ctx.fillStyle = exposed ? COLORS.rock : COLORS.rockDeep;
  ctx.fillRect(x, y, T, T);

  // Delikatna zmienność jasności kamieni.
  ctx.fillStyle = `rgba(255, 255, 255, ${0.012 + rng() * 0.025})`;
  ctx.fillRect(x + 1, y + 1, T - 2, T - 2);

  // Spoiny jak w murze: przesunięte co drugi rząd.
  ctx.fillStyle = COLORS.seam;
  ctx.fillRect(x, y + T / 2, T, 1);
  const off = ty % 2 === 0 ? 0 : T / 2;
  ctx.fillRect(x + off, y, 1, T / 2);
  ctx.fillRect(x + ((off + T / 2) % T), y + T / 2, 1, T / 2);

  if (left) {
    ctx.fillStyle = COLORS.rockSide;
    ctx.fillRect(x, y, 2, T);
  }
  if (right) {
    ctx.fillStyle = COLORS.rockSide;
    ctx.fillRect(x + T - 2, y, 2, T);
  }
  if (bottom) {
    ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
    ctx.fillRect(x, y + T - 3, T, 3);
  }
  if (top) {
    ctx.fillStyle = COLORS.rockTop;
    ctx.fillRect(x, y, T, 3);
    ctx.fillStyle = 'rgba(75, 68, 89, 0.35)';
    ctx.fillRect(x, y + 3, T, 2);
    // Kępki zeschłego mchu na wierzchu.
    ctx.fillStyle = COLORS.moss;
    const tufts = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < tufts; i++) {
      const mx = x + Math.floor(rng() * (T - 3));
      const mh = 1 + Math.floor(rng() * 3);
      ctx.fillRect(mx, y - mh, 1, mh);
      ctx.fillRect(mx + 2, y - mh + 1, 1, mh - 1);
    }
  }
}

function drawPlank(ctx, tx, ty, x, y, T) {
  const rng = createRng(tx * 31337 + ty * 7);
  ctx.fillStyle = COLORS.plank;
  ctx.fillRect(x, y, T, 6);
  ctx.fillStyle = COLORS.plankLight;
  ctx.fillRect(x, y, T, 1);
  ctx.fillStyle = COLORS.plankDark;
  ctx.fillRect(x, y + 6, T, 1);
  ctx.fillRect(x + Math.floor(4 + rng() * (T - 8)), y + 1, 1, 5);
  // Wsporniki pod deską.
  ctx.fillStyle = COLORS.plankDark;
  ctx.fillRect(x + 4, y + 7, 2, 5);
  ctx.fillRect(x + T - 6, y + 7, 2, 5);
}
