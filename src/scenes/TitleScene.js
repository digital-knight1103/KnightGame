import { GAME_TITLE, VIEW } from '../config.js';
import { clamp, createCanvas, createRng } from '../core/util.js';

const W = VIEW.width;
const H = VIEW.height;

// Kamera powoli kołysze się na boki; warstwy przesuwają się proporcjonalnie do „głębokości”.
const CAMERA_SWAY = 36;
const LAYER_MARGIN = 80; // zapas po bokach warstw, żeby kołysanie nie odsłoniło krawędzi

// Miejsce, w którym stoi rycerz (stopy) na skale na pierwszym planie.
const KNIGHT_X = 770;
const KNIGHT_Y = 438;

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Ekran tytułowy. Cała grafika jest generowana kodem: statyczne warstwy rysujemy raz
 * do canvasów poza ekranem, a animowane elementy (gwiazdy, mgła, drobinki, peleryna,
 * blask miecza) są funkcjami czasu – dzięki temu interpolacja między krokami jest trywialna.
 */
export class TitleScene {
  constructor() {
    this.name = 'TitleScene';
    this.t = 0;
    this.prevT = 0;
    this.flash = 0;
    this.prevFlash = 0;
    this.messageTimer = 0;

    const rng = createRng(20261024);
    this.sky = buildSky();
    this.stars = Array.from({ length: 90 }, () => ({
      x: rng() * (W + LAYER_MARGIN * 2),
      y: rng() * H * 0.55,
      size: rng() < 0.85 ? 1 : 2,
      phase: rng() * Math.PI * 2,
      speed: 0.6 + rng() * 1.6,
    }));

    this.layers = [
      { depth: 0.15, canvas: buildRuinsLayer(rng) },
      {
        depth: 0.4,
        canvas: buildForestLayer(rng, { color: '#120e1f', baseY: 392, amplitude: 14, trees: 10, scale: 0.55 }),
      },
      {
        depth: 0.7,
        canvas: buildForestLayer(rng, { color: '#09070f', baseY: 478, amplitude: 18, trees: 6, scale: 0.95 }),
      },
    ];
    this.cliff = buildCliff();

    this.fogBlob = buildFogBlob();
    // Każda smuga mgły należy do warstwy, za którą jest rysowana (afterLayer).
    this.fog = Array.from({ length: 14 }, (_, i) => ({
      afterLayer: i % 3,
      y: 330 + rng() * 170,
      offset: rng() * (W + 600),
      speed: 6 + rng() * 10,
      scale: 0.8 + rng() * 1.2,
      alpha: 0.05 + rng() * 0.07,
    }));

    this.motes = Array.from({ length: 55 }, () => ({
      x: rng() * W,
      offset: rng() * (H + 40),
      speed: 8 + rng() * 22,
      sway: 6 + rng() * 18,
      phase: rng() * Math.PI * 2,
      size: rng() < 0.7 ? 1 : 2,
    }));

    this.titleImage = buildTitle();
    this.vignette = buildVignette();

    let coarsePointer = false;
    try {
      coarsePointer = window.matchMedia('(pointer: coarse)').matches;
    } catch {
      // Brak matchMedia – zostaje komunikat dla klawiatury.
    }
    this.promptText = coarsePointer ? 'Dotknij ekranu' : 'Naciśnij dowolny klawisz';
  }

  enter(game) {
    this.game = game;
  }

  update(dt) {
    this.prevT = this.t;
    this.prevFlash = this.flash;
    this.t += dt;
    this.flash = Math.max(0, this.flash - dt * 2.5);

    if (this.messageTimer > 0) {
      this.messageTimer -= dt;
    } else if (this.t > 1.2 && this.game.input.anyPressed()) {
      // Wybór postaci powstanie w Etapie 3 – na razie tylko potwierdzamy, że wejście działa.
      this.flash = 1;
      this.messageTimer = 3;
    }
  }

  render(ctx, alpha) {
    const t = this.prevT + (this.t - this.prevT) * alpha;
    const flash = this.prevFlash + (this.flash - this.prevFlash) * alpha;
    const camX = Math.sin(t * 0.15) * CAMERA_SWAY;
    const layerX = (depth) => Math.round(-LAYER_MARGIN - camX * depth);

    ctx.drawImage(this.sky, layerX(0.04), 0);
    this.renderStars(ctx, t, layerX(0.06));

    this.layers.forEach((layer, i) => {
      ctx.drawImage(layer.canvas, layerX(layer.depth), 0);
      this.renderFog(ctx, t, i, camX * layer.depth);
    });

    const cliffX = layerX(1);
    ctx.drawImage(this.cliff, cliffX, 0);
    renderKnight(ctx, KNIGHT_X + cliffX + LAYER_MARGIN, KNIGHT_Y, t);

    this.renderMotes(ctx, t);
    ctx.drawImage(this.vignette, 0, 0);
    this.renderTexts(ctx, t);

    if (flash > 0) {
      ctx.fillStyle = `rgba(255, 236, 210, ${flash * 0.25})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  renderStars(ctx, t, offsetX) {
    for (const s of this.stars) {
      const twinkle = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.fillStyle = `rgba(210, 205, 235, ${twinkle * 0.7})`;
      ctx.fillRect(Math.round(s.x + offsetX), Math.round(s.y), s.size, s.size);
    }
  }

  renderFog(ctx, t, layerIndex, parallax) {
    const span = W + 600;
    // Rozmyta mgła wygląda źle bez wygładzania przy skalowaniu – włączamy je tylko tutaj.
    ctx.imageSmoothingEnabled = true;
    for (const f of this.fog) {
      if (f.afterLayer !== layerIndex) continue;
      const w = 420 * f.scale;
      const h = 130 * f.scale;
      const x = ((f.offset + t * f.speed) % span) - 300 - parallax;
      ctx.globalAlpha = f.alpha;
      ctx.drawImage(this.fogBlob, x - w / 2, f.y - h / 2, w, h);
    }
    ctx.globalAlpha = 1;
    ctx.imageSmoothingEnabled = false;
  }

  renderMotes(ctx, t) {
    const span = H + 40;
    ctx.globalCompositeOperation = 'lighter';
    for (const m of this.motes) {
      const y = H + 20 - ((m.offset + t * m.speed) % span);
      const x = m.x + Math.sin(t * 0.7 + m.phase) * m.sway;
      const flicker = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 4 + m.phase * 3));
      ctx.fillStyle = `rgba(255, 170, 90, ${0.12 * flicker})`;
      ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, m.size + 4, m.size + 4);
      ctx.fillStyle = `rgba(255, 196, 120, ${0.8 * flicker})`;
      ctx.fillRect(Math.round(x), Math.round(y), m.size, m.size);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  renderTexts(ctx, t) {
    // Tytuł pojawia się płynnie i lekko unosi.
    const titleIn = easeOutCubic(clamp((t - 0.4) / 1.8, 0, 1));
    if (titleIn > 0) {
      ctx.globalAlpha = titleIn;
      ctx.drawImage(this.titleImage, 0, Math.round(92 + (1 - titleIn) * 14));
      ctx.globalAlpha = 1;
    }

    const promptIn = clamp((t - 2.2) / 0.8, 0, 1);
    if (promptIn <= 0) return;

    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (this.messageTimer > 0) {
      const a = clamp(this.messageTimer / 0.5, 0, 1);
      ctx.font = 'italic 20px Georgia, "Times New Roman", serif';
      ctx.fillStyle = `rgba(230, 214, 186, ${a})`;
      ctx.fillText('Wybór postaci pojawi się w kolejnym etapie…', W / 2, 452);
    } else {
      const pulse = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * 2.6));
      ctx.font = '20px Georgia, "Times New Roman", serif';
      ctx.shadowColor = 'rgba(255, 170, 90, 0.6)';
      ctx.shadowBlur = 12;
      ctx.fillStyle = `rgba(232, 222, 240, ${pulse * promptIn})`;
      ctx.fillText(this.promptText, W / 2, 452);
    }
    ctx.restore();
  }
}

// ——— Statyczne warstwy (rysowane raz) ———

function buildSky() {
  const { canvas, ctx } = createCanvas(W + LAYER_MARGIN * 2, H);
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#05040a');
  sky.addColorStop(0.45, '#151026');
  sky.addColorStop(0.72, '#2a1d38');
  sky.addColorStop(1, '#3a2433');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, canvas.width, H);

  // Księżyc z poświatą – nad ruinami zamku, poza obszarem tytułu.
  const mx = LAYER_MARGIN + 820;
  const my = 92;
  const glow = ctx.createRadialGradient(mx, my, 20, mx, my, 220);
  glow.addColorStop(0, 'rgba(200, 190, 230, 0.28)');
  glow.addColorStop(1, 'rgba(200, 190, 230, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, canvas.width, H);

  const disc = ctx.createRadialGradient(mx - 12, my - 12, 4, mx, my, 44);
  disc.addColorStop(0, '#ece6f4');
  disc.addColorStop(1, '#b6aac8');
  ctx.fillStyle = disc;
  ctx.beginPath();
  ctx.arc(mx, my, 38, 0, Math.PI * 2);
  ctx.fill();
  return canvas;
}

// Linia horyzontu jako suma sinusoid – łagodne, naturalne wzgórza.
function makeRidge(rng, baseY, amplitude) {
  const waves = Array.from({ length: 4 }, (_, i) => ({
    freq: (0.004 + rng() * 0.006) * (i + 1),
    amp: amplitude / (i + 1),
    phase: rng() * Math.PI * 2,
  }));
  return (x) => baseY + waves.reduce((sum, w) => sum + Math.sin(x * w.freq + w.phase) * w.amp, 0);
}

function fillRidge(ctx, ridge, width) {
  ctx.beginPath();
  ctx.moveTo(0, H);
  for (let x = 0; x <= width; x += 4) ctx.lineTo(x, ridge(x));
  ctx.lineTo(width, H);
  ctx.closePath();
  ctx.fill();
}

function buildRuinsLayer(rng) {
  const width = W + LAYER_MARGIN * 2;
  const { canvas, ctx } = createCanvas(width, H);
  const ridge = makeRidge(rng, 330, 26);
  ctx.fillStyle = '#1a1430';
  fillRidge(ctx, ridge, width);

  // Ruiny zamku na wzgórzu: wieże z blankami, część z nich złamana.
  const castleX = 690;
  const groundY = ridge(castleX) + 6;
  const towers = [
    { dx: -70, w: 26, h: 92, broken: false },
    { dx: -30, w: 46, h: 66, broken: true },
    { dx: 20, w: 30, h: 128, broken: false },
    { dx: 58, w: 52, h: 54, broken: true },
    { dx: 112, w: 22, h: 84, broken: true },
  ];
  for (const tower of towers) {
    const x = castleX + tower.dx;
    const top = groundY - tower.h;
    ctx.fillRect(x, top, tower.w, tower.h);
    if (tower.broken) {
      ctx.beginPath();
      ctx.moveTo(x, top);
      for (let i = 0; i <= 5; i++) ctx.lineTo(x + (tower.w * i) / 5, top - 4 - rng() * 14);
      ctx.lineTo(x + tower.w, top);
      ctx.fill();
    } else {
      for (let bx = x; bx < x + tower.w; bx += 8) ctx.fillRect(bx, top - 7, 5, 7);
      ctx.beginPath();
      ctx.moveTo(x - 3, top - 7);
      ctx.lineTo(x + tower.w / 2, top - 7 - tower.w * 0.9);
      ctx.lineTo(x + tower.w + 3, top - 7);
      ctx.fill();
    }
  }
  // Mur między wieżami.
  ctx.fillRect(castleX - 70, groundY - 40, 204, 40);

  // Kilka ciepłych okienek – ktoś (albo coś) wciąż tam mieszka.
  ctx.fillStyle = 'rgba(255, 168, 80, 0.75)';
  ctx.fillRect(castleX + 31, groundY - 100, 3, 6);
  ctx.fillRect(castleX - 60, groundY - 70, 3, 5);
  ctx.fillStyle = 'rgba(255, 168, 80, 0.4)';
  ctx.fillRect(castleX + 80, groundY - 32, 3, 5);
  return canvas;
}

function drawBranch(ctx, rng, x, y, length, angle, width, depth) {
  const x2 = x + Math.cos(angle) * length;
  const y2 = y + Math.sin(angle) * length;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  if (depth <= 0 || length < 3) return;

  const count = rng() < 0.35 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const spread = (rng() - 0.5) * 1.4;
    // Martwe gałęzie lekko opadają na boki.
    const droop = (angle + Math.PI / 2) * 0.15;
    drawBranch(ctx, rng, x2, y2, length * (0.6 + rng() * 0.2), angle + spread + droop, width * 0.62, depth - 1);
  }
}

function drawDeadTree(ctx, rng, x, groundY, scale) {
  // Pień składamy z kilku krzywych odcinków, potem dopiero się rozgałęzia.
  let px = x;
  let py = groundY + 4;
  let angle = -Math.PI / 2 + (rng() - 0.5) * 0.2;
  const segments = 3 + Math.floor(rng() * 2);
  let width = 9 * scale;
  ctx.lineCap = 'round';
  for (let i = 0; i < segments; i++) {
    const len = (22 + rng() * 14) * scale;
    const nx = px + Math.cos(angle) * len;
    const ny = py + Math.sin(angle) * len;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(nx, ny);
    ctx.stroke();
    px = nx;
    py = ny;
    width *= 0.85;
    angle += (rng() - 0.5) * 0.35;
    if (i > 0 && rng() < 0.6) {
      const side = rng() < 0.5 ? -1 : 1;
      drawBranch(ctx, rng, px, py, len * 0.9, angle + side * (0.7 + rng() * 0.5), width * 0.6, 3);
    }
  }
  drawBranch(ctx, rng, px, py, 26 * scale, angle - 0.4, width * 0.7, 4);
  drawBranch(ctx, rng, px, py, 24 * scale, angle + 0.45, width * 0.7, 4);
}

function buildForestLayer(rng, { color, baseY, amplitude, trees, scale }) {
  const width = W + LAYER_MARGIN * 2;
  const { canvas, ctx } = createCanvas(width, H);
  const ridge = makeRidge(rng, baseY, amplitude);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  fillRidge(ctx, ridge, width);

  const step = width / trees;
  for (let i = 0; i < trees; i++) {
    const x = step * (i + 0.2 + rng() * 0.6);
    drawDeadTree(ctx, rng, x, ridge(x), scale * (0.75 + rng() * 0.5));
  }

  // Krzywe nagrobki / pale między drzewami.
  for (let i = 0; i < trees; i++) {
    const x = rng() * width;
    const y = ridge(x);
    const w = (5 + rng() * 5) * scale;
    const h = (10 + rng() * 12) * scale;
    ctx.save();
    ctx.translate(x, y + 3);
    ctx.rotate((rng() - 0.5) * 0.4);
    ctx.fillRect(-w / 2, -h, w, h);
    ctx.restore();
  }
  return canvas;
}

function buildCliff() {
  const width = W + LAYER_MARGIN * 2;
  const { canvas, ctx } = createCanvas(width, H);
  const ox = LAYER_MARGIN;
  ctx.fillStyle = '#030205';
  ctx.beginPath();
  ctx.moveTo(ox + 600, H);
  ctx.lineTo(ox + 640, 500);
  ctx.lineTo(ox + 668, 488);
  ctx.lineTo(ox + 690, 462);
  ctx.lineTo(ox + 712, 446);
  ctx.lineTo(ox + 736, KNIGHT_Y);
  ctx.lineTo(ox + 812, KNIGHT_Y + 1);
  ctx.lineTo(ox + 838, 446);
  ctx.lineTo(ox + 870, 452);
  ctx.lineTo(ox + 905, 470);
  ctx.lineTo(width, 478);
  ctx.lineTo(width, H);
  ctx.closePath();
  ctx.fill();
  return canvas;
}

function buildFogBlob() {
  const size = 256;
  const { canvas, ctx } = createCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(170, 160, 200, 1)');
  g.addColorStop(0.5, 'rgba(150, 140, 185, 0.5)');
  g.addColorStop(1, 'rgba(150, 140, 185, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

function buildVignette() {
  const { canvas, ctx } = createCanvas(W, H);
  const g = ctx.createRadialGradient(W / 2, H * 0.45, H * 0.35, W / 2, H * 0.5, W * 0.65);
  g.addColorStop(0, 'rgba(0, 0, 0, 0)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0.8)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  return canvas;
}

function buildTitle() {
  const { canvas, ctx } = createCanvas(W, 180);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const font = 'bold 82px "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';
  const gold = ctx.createLinearGradient(0, 30, 0, 110);
  gold.addColorStop(0, '#f6e7c8');
  gold.addColorStop(0.55, '#c9a46e');
  gold.addColorStop(1, '#7d5b36');

  // Najpierw ciepła poświata, potem ostry napis na wierzchu.
  ctx.font = font;
  ctx.shadowColor = 'rgba(255, 150, 70, 0.55)';
  ctx.shadowBlur = 28;
  ctx.fillStyle = gold;
  ctx.fillText(GAME_TITLE, W / 2, 70);
  ctx.shadowBlur = 0;
  ctx.fillText(GAME_TITLE, W / 2, 70);

  // Ozdobna linia z rombem pośrodku.
  const line = ctx.createLinearGradient(W / 2 - 220, 0, W / 2 + 220, 0);
  line.addColorStop(0, 'rgba(201, 164, 110, 0)');
  line.addColorStop(0.5, 'rgba(201, 164, 110, 0.9)');
  line.addColorStop(1, 'rgba(201, 164, 110, 0)');
  ctx.fillStyle = line;
  ctx.fillRect(W / 2 - 220, 124, 440, 1);
  ctx.fillStyle = '#c9a46e';
  ctx.beginPath();
  ctx.moveTo(W / 2, 119);
  ctx.lineTo(W / 2 + 5, 124.5);
  ctx.lineTo(W / 2, 130);
  ctx.lineTo(W / 2 - 5, 124.5);
  ctx.fill();

  ctx.font = 'italic 19px Georgia, "Times New Roman", serif';
  ctx.fillStyle = 'rgba(205, 195, 222, 0.85)';
  ctx.fillText('Gdy gaśnie światło, budzi się cień', W / 2, 152);
  return canvas;
}

// ——— Sylwetka rycerza (rysowana co klatkę, bo peleryna i blask są animowane) ———

function renderKnight(ctx, x, y, t) {
  const breath = Math.sin(t * 1.7) * 0.8;
  const wind = Math.sin(t * 2.1) * 4 + Math.sin(t * 3.7 + 1) * 2;
  const pulse = 0.75 + 0.25 * Math.sin(t * 2.4) + 0.05 * Math.sin(t * 13);

  const swordX = x - 21;

  // Blask ostrza oświetla skałę i rycerza.
  ctx.globalCompositeOperation = 'lighter';
  const glow = ctx.createRadialGradient(swordX, y - 16, 2, swordX, y - 16, 110);
  glow.addColorStop(0, `rgba(130, 195, 255, ${0.32 * pulse})`);
  glow.addColorStop(0.4, `rgba(90, 140, 230, ${0.1 * pulse})`);
  glow.addColorStop(1, 'rgba(60, 90, 200, 0)');
  ctx.fillStyle = glow;
  ctx.fillRect(swordX - 110, y - 126, 220, 220);
  ctx.globalCompositeOperation = 'source-over';

  ctx.fillStyle = '#040307';
  ctx.strokeStyle = '#040307';

  // Peleryna powiewa na wietrze za plecami (rycerz patrzy w lewo, na krainę).
  ctx.beginPath();
  ctx.moveTo(x - 4, y - 52 + breath);
  ctx.quadraticCurveTo(x + 16 + wind, y - 34, x + 24 + wind * 1.6, y - 3);
  ctx.lineTo(x + 14 + wind, y - 1);
  ctx.lineTo(x + 6 + wind * 0.5, y - 5);
  ctx.quadraticCurveTo(x + 6, y - 30, x + 4, y - 50 + breath);
  ctx.closePath();
  ctx.fill();

  // Nogi.
  ctx.fillRect(x - 8, y - 24, 6, 24);
  ctx.fillRect(x + 1, y - 24, 6, 24);
  ctx.fillRect(x - 11, y - 3, 9, 3);

  // Tułów (oddycha), naramiennik, hełm.
  ctx.beginPath();
  ctx.moveTo(x - 11, y - 51 + breath);
  ctx.lineTo(x + 10, y - 51 + breath);
  ctx.lineTo(x + 8, y - 22);
  ctx.lineTo(x - 9, y - 22);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x - 7, y - 49 + breath, 8, 5, -0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillRect(x - 7, y - 66 + breath, 13, 15);
  ctx.beginPath();
  ctx.moveTo(x - 1, y - 66 + breath);
  ctx.quadraticCurveTo(x + 8, y - 74 + breath, x + 14 + wind * 0.3, y - 68 + breath);
  ctx.lineTo(x + 4, y - 64 + breath);
  ctx.fill();

  // Ręce opierają się na rękojeści wbitego w skałę miecza.
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 6, y - 46 + breath);
  ctx.lineTo(swordX + 2, y - 36);
  ctx.stroke();

  // Miecz: rękojeść i jelec ciemne, ostrze świeci.
  ctx.fillRect(swordX - 1.5, y - 42, 3, 8);
  ctx.fillRect(swordX - 7, y - 34, 14, 3);
  ctx.fillStyle = `rgba(190, 228, 255, ${0.65 + 0.35 * pulse})`;
  ctx.fillRect(swordX - 1.5, y - 31, 3, 31);

  // Wąska szczelina przyłbicy odbija blask miecza.
  ctx.fillStyle = `rgba(150, 200, 255, ${0.35 + 0.25 * pulse})`;
  ctx.fillRect(x - 7, y - 60 + breath, 5, 1.5);
}
