import { clamp, lerp } from '../core/util.js';

const COLORS = {
  armorDark: '#262a35',
  armor: '#454c5e',
  armorLight: '#8a93a8',
  cape: '#5e1622',
  capeDark: '#3a0c15',
  visor: '#a8dcff',
  blade: '#bfe6ff',
};

const THIGH = 10;
const SHIN = 10;
const UPPER_ARM = 8;
const FOREARM = 8;
const TORSO = 15;
const AIR_HIP_Y = -20;
const HANG_HIP_Y = -10; // przy wiszeniu dłonie wypadają na wysokości krawędzi

// Kąty kończyn mierzymy od pionu w dół; dodatnie = do przodu (w stronę patrzenia).
const POSES = {
  idle: { lean: 0.02, legF: [0.06, 0], legB: [-0.06, 0], armF: [0.15, 0.05], armB: [-0.12, -0.05], capeBack: 0.1, capeLift: 0 },
  jump: { lean: 0.05, legF: [0.75, 0.15], legB: [-0.25, -0.75], armF: [-0.7, -0.3], armB: [-1.1, -0.6], capeBack: 0.4, capeLift: -0.4 },
  fall: { lean: 0, legF: [0.35, 0.1], legB: [-0.3, -0.55], armF: [1.8, 2.2], armB: [-1.5, -1.8], capeBack: 0.3, capeLift: 1 },
  crouch: { lean: 0.35, legF: [1.3, -0.3], legB: [0.95, -0.6], armF: [0.7, 1.3], armB: [0.35, 0.9], capeBack: 0.15, capeLift: -0.2 },
  hang: { lean: -0.05, legF: [0.15, 0.05], legB: [-0.1, -0.15], armF: [Math.PI - 0.1, Math.PI - 0.05], armB: [Math.PI - 0.3, Math.PI - 0.2], capeBack: 0, capeLift: -0.3 },
  pull: { lean: 0.5, legF: [1.6, 0.4], legB: [0.3, -0.4], armF: [0.6, 0.1], armB: [0.4, 0], capeBack: 0.2, capeLift: 0.2 },
};

const POSE_KEYS = Object.keys(POSES.idle);

function blendPose(a, b, t) {
  const out = {};
  for (const key of POSE_KEYS) {
    out[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], t)) : lerp(a[key], b[key], t);
  }
  return out;
}

const legHeight = ([thigh, shin]) => Math.cos(thigh) * THIGH + Math.cos(shin) * SHIN;

/**
 * Proceduralna animacja gracza: z aktualnego stanu i parametrów ruchu liczymy pozę
 * (kąty kończyn, pochylenie, peleryna), a potem rysujemy ją prostymi kształtami.
 * Na ziemi biodra ustawiamy tak, żeby niższa stopa dotykała podłoża – zgięte nogi
 * same obniżają postać (kucanie, uginanie przy biegu).
 */
export class PlayerRenderer {
  // (x, y) – środek stóp na ekranie.
  draw(ctx, player, x, y) {
    const pose = this.computePose(player);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(player.facing * player.squashX, player.squashY);
    drawFigure(ctx, pose, player.animTime);
    ctx.restore();
  }

  computePose(p) {
    const t = p.animTime;
    let pose;
    let hipY = null; // null = biodra wyliczane z nóg (postać stoi na ziemi)
    let breath = 0;

    switch (p.state) {
      case 'run': {
        const k = clamp(Math.abs(p.vx) / p.stats.runSpeed, 0, 1);
        const s = Math.sin(p.runPhase);
        const c = Math.cos(p.runPhase);
        const thighF = 0.75 * s * k;
        const thighB = -0.75 * s * k;
        // Kolano zgina się, gdy noga przenoszona jest do przodu (faza w powietrzu).
        pose = {
          lean: 0.16 * k,
          legF: [thighF, thighF - (0.15 + Math.max(0, c) * 1.1) * k],
          legB: [thighB, thighB - (0.15 + Math.max(0, -c) * 1.1) * k],
          armF: [-0.6 * s * k, -0.6 * s * k + 0.6 * k],
          armB: [0.6 * s * k, 0.6 * s * k + 0.6 * k],
          capeBack: 0.2 + 0.8 * k,
          capeLift: 0.15 * k,
        };
        break;
      }
      case 'crouch': {
        pose = { ...POSES.crouch };
        // Skradanie: lekkie przebieranie nogami.
        const k = clamp(Math.abs(p.vx) / p.stats.crouchSpeed, 0, 1);
        const s = Math.sin(p.runPhase * 1.4) * 0.25 * k;
        pose.legF = [POSES.crouch.legF[0] + s, POSES.crouch.legF[1]];
        pose.legB = [POSES.crouch.legB[0] - s, POSES.crouch.legB[1]];
        break;
      }
      case 'land': {
        const k = clamp(p.stateTime / p.stats.heavyLandingTime, 0, 1);
        pose = blendPose(POSES.crouch, POSES.idle, k * k);
        break;
      }
      case 'jump':
        pose = POSES.jump;
        hipY = AIR_HIP_Y;
        break;
      case 'fall': {
        // Przejście ze szczytu skoku w opadanie zamiast skokowej zmiany pozy.
        const k = clamp(p.vy / 500, 0, 1);
        pose = blendPose(POSES.jump, POSES.fall, k);
        hipY = AIR_HIP_Y;
        break;
      }
      case 'ledgeGrab': {
        pose = { ...POSES.hang };
        const sway = Math.sin(t * 2.2) * 0.08;
        pose.legF = [POSES.hang.legF[0] + sway, POSES.hang.legF[1] + sway];
        pose.legB = [POSES.hang.legB[0] + sway, POSES.hang.legB[1] + sway];
        hipY = HANG_HIP_Y;
        break;
      }
      case 'climb': {
        const c = p.climbProgress;
        if (c < 0.6) {
          const k = c / 0.6;
          pose = blendPose(POSES.hang, POSES.pull, k);
          hipY = lerp(HANG_HIP_Y, -16, k);
        } else {
          pose = blendPose(POSES.pull, POSES.crouch, (c - 0.6) / 0.4);
        }
        break;
      }
      default: {
        pose = { ...POSES.idle };
        // Oddech w spoczynku.
        const b = Math.sin(t * 2.1);
        pose.armF = [POSES.idle.armF[0] + b * 0.04, POSES.idle.armF[1] + b * 0.06];
        breath = b * 0.7;
      }
    }

    // Zawsze nowy obiekt – stałe POSES nie mogą być modyfikowane.
    return {
      ...pose,
      hipY: hipY ?? -Math.max(legHeight(pose.legF), legHeight(pose.legB)),
      breath,
      speed: clamp(Math.abs(p.vx) / p.stats.runSpeed, 0, 1),
    };
  }
}

function limb(ctx, x, y, a1, l1, a2, l2, width, color) {
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
}

function drawFigure(ctx, pose, t) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const hipY = pose.hipY;
  const shoulderY = -TORSO + 2 - pose.breath;

  // Tylna noga (ciemniejsza – dalej od widza).
  limb(ctx, -1, hipY, pose.legB[0], THIGH, pose.legB[1], SHIN, 5, COLORS.armorDark);

  ctx.save();
  ctx.translate(0, hipY);
  ctx.rotate(pose.lean);

  // Peleryna za plecami – im szybszy ruch, tym bardziej powiewa.
  const wave = Math.sin(t * 7) * (0.6 + pose.speed) * 1.5;
  const tipX = -9 - pose.capeBack * 12 + wave;
  const tipY = 5 - pose.capeLift * 12;
  ctx.fillStyle = COLORS.cape;
  ctx.beginPath();
  ctx.moveTo(-1, shoulderY - 1);
  ctx.quadraticCurveTo(-8 - pose.capeBack * 5, shoulderY + 7, tipX, tipY);
  ctx.lineTo(tipX + 6, tipY + 2 - pose.capeLift * 2);
  ctx.quadraticCurveTo(-3, 0, 2, shoulderY + 1);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.capeDark;
  ctx.fillRect(-4, shoulderY - 1, 5, 3);

  // Tylna ręka.
  limb(ctx, 0, shoulderY + 1, pose.armB[0], UPPER_ARM, pose.armB[1], FOREARM, 4, COLORS.armorDark);

  // Miecz w pochwie przy biodrze – ostrze lekko świeci.
  ctx.strokeStyle = COLORS.blade;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(-11, 9);
  ctx.stroke();
  ctx.fillStyle = COLORS.armorDark;
  ctx.fillRect(-5, -6, 4, 3);

  // Tułów z napierśnikiem i pasem.
  ctx.fillStyle = COLORS.armor;
  ctx.beginPath();
  ctx.moveTo(-6, 1);
  ctx.lineTo(6, 1);
  ctx.lineTo(7, shoulderY);
  ctx.lineTo(-6, shoulderY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = COLORS.armorLight;
  ctx.fillRect(4, shoulderY + 1, 2, -shoulderY - 3);
  ctx.fillStyle = COLORS.armorDark;
  ctx.fillRect(-6, -3, 13, 2);

  // Hełm z przyłbicą.
  const headY = shoulderY - 10;
  ctx.fillStyle = COLORS.armor;
  ctx.fillRect(-5, headY, 10, 10);
  ctx.fillStyle = COLORS.armorLight;
  ctx.fillRect(-5, headY, 10, 2);
  ctx.fillRect(-1, headY - 3, 2, 3);
  ctx.fillStyle = COLORS.visor;
  ctx.fillRect(1, headY + 4, 4, 1.5);

  // Naramiennik i przednia ręka.
  ctx.fillStyle = COLORS.armorLight;
  ctx.beginPath();
  ctx.ellipse(0, shoulderY + 2, 5, 3.5, 0, 0, Math.PI * 2);
  ctx.fill();
  limb(ctx, 0, shoulderY + 1, pose.armF[0], UPPER_ARM, pose.armF[1], FOREARM, 4, COLORS.armor);
  ctx.restore();

  // Przednia noga.
  limb(ctx, 1, hipY, pose.legF[0], THIGH, pose.legF[1], SHIN, 5, COLORS.armor);
}
