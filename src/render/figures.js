// Sylwetki grywalnych postaci. Obie korzystają z tego samego szkieletu i póz
// (PlayerRenderer), ale mają własne proporcje, paletę i wyposażenie.
// Układ współrzędnych: (0, 0) to środek stóp, +x to kierunek patrzenia, y rośnie w dół.

export const LIMBS = {
  thigh: 10,
  shin: 10,
  upperArm: 8,
  forearm: 8,
  torso: 15,
};

// Kończyna z dwóch odcinków; zwraca pozycję jej końca (dłoni/stopy).
function limb(ctx, x, y, a1, a2, l1, l2, width, color) {
  const kx = x + Math.sin(a1) * l1;
  const ky = y + Math.cos(a1) * l1;
  const ex = kx + Math.sin(a2) * l2;
  const ey = ky + Math.cos(a2) * l2;
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(kx, ky);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  return { x: ex, y: ey };
}

const leg = (ctx, x, y, angles, width, color) => limb(ctx, x, y, angles[0], angles[1], LIMBS.thigh, LIMBS.shin, width, color);
const arm = (ctx, x, y, angles, width, color) =>
  limb(ctx, x, y, angles[0], angles[1], LIMBS.upperArm, LIMBS.forearm, width, color);

// Kąt kończyny (0 = w dół, + = do przodu) na kąt kanwy.
const toCanvasAngle = (a) => Math.PI / 2 - a;

function glow(ctx, x, y, radius, rgb, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
  g.addColorStop(0, `rgba(${rgb}, ${alpha})`);
  g.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = g;
  ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
  ctx.globalCompositeOperation = 'source-over';
}

function cape(ctx, pose, t, shoulderY, { length, spread, color }) {
  const wave = Math.sin(t * 7) * (0.6 + pose.speed) * 1.5;
  const tipX = -9 - pose.capeBack * spread + wave;
  const tipY = shoulderY + length - pose.capeLift * 12;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(-1, shoulderY - 1);
  ctx.quadraticCurveTo(-8 - pose.capeBack * 5, shoulderY + length * 0.4, tipX, tipY);
  ctx.lineTo(tipX + 6, tipY + 2 - pose.capeLift * 2);
  ctx.quadraticCurveTo(-3, shoulderY + length * 0.75, 2, shoulderY + 1);
  ctx.closePath();
  ctx.fill();
}

// ——— Rycerz Cieniołamacz ———

const KNIGHT = {
  armorDark: '#262a35',
  armor: '#454c5e',
  armorLight: '#8a93a8',
  cape: '#5e1622',
  capeDark: '#3a0c15',
  shield: '#3b3346',
  visor: '#a8dcff',
  blade: '#bfe6ff',
};
const SWORD_LENGTH = 20;
const SMEAR_ARC = 2.0; // maksymalna długość smugi (radiany)

function drawKnight(ctx, pose, t) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const hipY = pose.hipY;
  const shoulderY = -LIMBS.torso + 2 - pose.breath;
  const swordDrawn = pose.swordAngle !== undefined;

  leg(ctx, -1, hipY, pose.legB, 5, KNIGHT.armorDark);

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(pose.lean);

  cape(ctx, pose, t, shoulderY, { length: 20, spread: 12, color: KNIGHT.cape });
  ctx.fillStyle = KNIGHT.capeDark;
  ctx.fillRect(-4, shoulderY - 1, 5, 3);

  // Tarcza na plecach (gdy nie blokuje).
  if (!pose.shieldUp) {
    ctx.fillStyle = KNIGHT.shield;
    ctx.fillRect(-10, shoulderY + 3, 6, 11);
    ctx.fillStyle = KNIGHT.armorLight;
    ctx.fillRect(-10, shoulderY + 3, 6, 1);
  }

  arm(ctx, 0, shoulderY + 1, pose.armB, 4, KNIGHT.armorDark);

  // Miecz w pochwie przy biodrze – ostrze lekko świeci.
  if (!swordDrawn) {
    ctx.strokeStyle = KNIGHT.blade;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-4, -3);
    ctx.lineTo(-11, 9);
    ctx.stroke();
  }
  ctx.fillStyle = KNIGHT.armorDark;
  ctx.fillRect(-5, -6, 4, 3);

  // Tułów z napierśnikiem i pasem.
  ctx.fillStyle = KNIGHT.armor;
  ctx.beginPath();
  ctx.moveTo(-6, 1);
  ctx.lineTo(6, 1);
  ctx.lineTo(7, shoulderY);
  ctx.lineTo(-6, shoulderY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = KNIGHT.armorLight;
  ctx.fillRect(4, shoulderY + 1, 2, -shoulderY - 3);
  ctx.fillStyle = KNIGHT.armorDark;
  ctx.fillRect(-6, -3, 13, 2);

  // Hełm z przyłbicą i grzebieniem.
  const headY = shoulderY - 10;
  ctx.fillStyle = KNIGHT.armor;
  ctx.fillRect(-5, headY, 10, 10);
  ctx.fillStyle = KNIGHT.armorLight;
  ctx.fillRect(-5, headY, 10, 2);
  ctx.fillRect(-1, headY - 3, 2, 3);
  ctx.fillStyle = KNIGHT.visor;
  ctx.fillRect(1, headY + 4, 4, 1.5);

  // Smuga za ostrzem – wąski sierp wzdłuż ostatniego odcinka przebytego łuku.
  if (pose.smear) {
    const { to, alpha } = pose.smear;
    const from = to + Math.max(-SMEAR_ARC, Math.min(SMEAR_ARC, pose.smear.from - to));
    const a1 = toCanvasAngle(from);
    const a2 = toCanvasAngle(to);
    const ccw = to > from;
    const cy = shoulderY + 1;
    const outer = LIMBS.upperArm + LIMBS.forearm + SWORD_LENGTH;
    const inner = outer - (pose.heavy ? 12 : 8);
    ctx.fillStyle = `rgba(190, 228, 255, ${(pose.heavy ? 0.4 : 0.28) * alpha})`;
    ctx.beginPath();
    ctx.arc(0, cy, outer, a1, a2, ccw);
    ctx.arc(0, cy, inner, a2, a1, !ccw);
    ctx.closePath();
    ctx.fill();
  }

  // Naramiennik i przednia ręka (z mieczem, jeśli dobyty).
  ctx.fillStyle = KNIGHT.armorLight;
  ctx.beginPath();
  ctx.ellipse(0, shoulderY + 2, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  const hand = arm(ctx, 0, shoulderY + 1, pose.armF, 4, KNIGHT.armor);
  if (swordDrawn) {
    const dx = Math.sin(pose.swordAngle);
    const dy = Math.cos(pose.swordAngle);
    glow(ctx, hand.x + dx * 12, hand.y + dy * 12, 16, '140, 200, 255', 0.25);
    ctx.strokeStyle = KNIGHT.blade;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hand.x + dx * 3, hand.y + dy * 3);
    ctx.lineTo(hand.x + dx * SWORD_LENGTH, hand.y + dy * SWORD_LENGTH);
    ctx.stroke();
    // Jelec prostopadle do ostrza.
    ctx.strokeStyle = KNIGHT.armorDark;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(hand.x + dx * 2 - dy * 3, hand.y + dy * 2 + dx * 3);
    ctx.lineTo(hand.x + dx * 2 + dy * 3, hand.y + dy * 2 - dx * 3);
    ctx.stroke();
  }
  if (pose.shieldUp) {
    // Tarcza wystawiona przed siebie, z delikatnie świecącym znakiem.
    ctx.fillStyle = KNIGHT.shield;
    ctx.beginPath();
    ctx.moveTo(hand.x + 1, hand.y - 9);
    ctx.lineTo(hand.x + 6, hand.y - 9);
    ctx.lineTo(hand.x + 6, hand.y + 4);
    ctx.lineTo(hand.x + 3.5, hand.y + 9);
    ctx.lineTo(hand.x + 1, hand.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = KNIGHT.armorLight;
    ctx.fillRect(hand.x + 5, hand.y - 9, 1.5, 13);
    ctx.fillStyle = 'rgba(168, 220, 255, 0.8)';
    ctx.fillRect(hand.x + 3, hand.y - 4, 1.5, 5);
    ctx.fillRect(hand.x + 2, hand.y - 2, 3.5, 1.5);
  }
  ctx.restore();

  leg(ctx, 1, hipY, pose.legF, 5, KNIGHT.armor);
}

// ——— Łowczyni Świetlików ———

const HUNTRESS = {
  leather: '#5a4632',
  leatherDark: '#33281d',
  cloth: '#35524b',
  clothDark: '#1f332f',
  hood: '#2b4640',
  eye: '#ffd27a',
  wood: '#6b4a32',
  metal: '#8a93a8',
  bolt: '255, 233, 168',
  lantern: '#ffcf7a',
};

function drawCrossbow(ctx, hand, pose, t) {
  // Kusza trzymana poziomo przed sobą; naładowany bełt świeci coraz mocniej.
  const x = hand.x;
  const y = hand.y;
  ctx.strokeStyle = HUNTRESS.wood;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(x - 7, y + 1);
  ctx.lineTo(x + 9, y);
  ctx.stroke();
  ctx.strokeStyle = HUNTRESS.metal;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x + 5, y - 7);
  ctx.quadraticCurveTo(x + 10, y, x + 5, y + 7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(220, 210, 190, 0.7)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(x + 5, y - 7);
  ctx.lineTo(x + 1, y);
  ctx.lineTo(x + 5, y + 7);
  ctx.stroke();

  const c = pose.charge;
  const full = c >= 1;
  const pulse = full ? 0.75 + 0.25 * Math.sin(t * 20) : 1;
  ctx.strokeStyle = `rgba(${HUNTRESS.bolt}, ${0.5 + 0.5 * c})`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 1, y);
  ctx.lineTo(x + 12, y);
  ctx.stroke();
  if (c > 0) glow(ctx, x + 12, y, 6 + c * 12, HUNTRESS.bolt, (0.25 + c * 0.5) * pulse);
}

function drawHuntress(ctx, pose, t) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const hipY = pose.hipY;
  const shoulderY = -LIMBS.torso + 2 - pose.breath;

  leg(ctx, -1, hipY, pose.legB, 4, HUNTRESS.leatherDark);

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(pose.lean);

  // Kołczan z bełtami na plecach.
  ctx.save();
  ctx.translate(-6, shoulderY + 2);
  ctx.rotate(-0.35);
  ctx.fillStyle = HUNTRESS.leatherDark;
  ctx.fillRect(-2, 0, 4, 12);
  ctx.fillStyle = `rgba(${HUNTRESS.bolt}, 0.85)`;
  ctx.fillRect(-1.5, -3, 1, 3);
  ctx.fillRect(0.5, -2, 1, 2);
  ctx.restore();

  // Kusza na plecach, gdy nie celuje.
  if (!pose.aiming) {
    ctx.strokeStyle = HUNTRESS.wood;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-8, shoulderY + 3);
    ctx.lineTo(-2, -4);
    ctx.stroke();
  }

  cape(ctx, pose, t, shoulderY, { length: 12, spread: 8, color: HUNTRESS.clothDark });

  arm(ctx, 0, shoulderY + 1, pose.armB, 3.5, HUNTRESS.leatherDark);

  // Smukły tułów w kurtce, pas.
  ctx.fillStyle = HUNTRESS.cloth;
  ctx.beginPath();
  ctx.moveTo(-5, 1);
  ctx.lineTo(5, 1);
  ctx.lineTo(5, shoulderY);
  ctx.lineTo(-5, shoulderY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = HUNTRESS.leatherDark;
  ctx.fillRect(-5, -3, 10, 2);

  // Latarnia u pasa – ciepłe, migoczące światło.
  const flicker = 0.8 + 0.2 * Math.sin(t * 11) * Math.sin(t * 7.3);
  ctx.fillStyle = HUNTRESS.leatherDark;
  ctx.fillRect(4, -2, 1, 2);
  ctx.fillStyle = HUNTRESS.lantern;
  ctx.fillRect(3, 0, 4, 5);
  ctx.fillStyle = HUNTRESS.leatherDark;
  ctx.fillRect(3, 0, 4, 1);
  glow(ctx, 5, 2.5, 14, '255, 190, 100', 0.35 * flicker);

  // Kaptur z ostrym czubkiem z tyłu i ciemną twarzą z błyskiem oka.
  const headY = shoulderY - 10;
  ctx.fillStyle = HUNTRESS.hood;
  ctx.beginPath();
  ctx.moveTo(-5, shoulderY + 1);
  ctx.lineTo(-9, headY + 7);
  ctx.quadraticCurveTo(-6, headY - 1, 0, headY - 1);
  ctx.quadraticCurveTo(6, headY, 6, headY + 7);
  ctx.lineTo(5, shoulderY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#141c1a';
  ctx.fillRect(1, headY + 3, 4, 5);
  ctx.fillStyle = HUNTRESS.eye;
  ctx.fillRect(3, headY + 5, 1.5, 1);

  const hand = arm(ctx, 0, shoulderY + 1, pose.armF, 3.5, HUNTRESS.leather);
  if (pose.aiming) drawCrossbow(ctx, hand, pose, t);
  ctx.restore();

  leg(ctx, 1, hipY, pose.legF, 4, HUNTRESS.leather);
}

export const FIGURES = {
  knight: drawKnight,
  huntress: drawHuntress,
};
