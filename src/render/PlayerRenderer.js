import { clamp, lerp } from '../core/util.js';
import { AIR_FLIP_TIME } from '../entities/Player.js';
import { FIGURES, LIMBS } from './figures.js';

const AIR_HIP_Y = -20;
const HANG_HIP_Y = -10; // przy wiszeniu dłonie wypadają na wysokości krawędzi
const TUCK_HIP_Y = -14;

// Kąty kończyn mierzymy od pionu w dół; dodatnie = do przodu (w stronę patrzenia), π = w górę.
const POSES = {
  idle: { lean: 0.02, legF: [0.06, 0], legB: [-0.06, 0], armF: [0.15, 0.05], armB: [-0.12, -0.05], capeBack: 0.1, capeLift: 0 },
  jump: { lean: 0.05, legF: [0.75, 0.15], legB: [-0.25, -0.75], armF: [-0.7, -0.3], armB: [-1.1, -0.6], capeBack: 0.4, capeLift: -0.4 },
  fall: { lean: 0, legF: [0.35, 0.1], legB: [-0.3, -0.55], armF: [1.8, 2.2], armB: [-1.5, -1.8], capeBack: 0.3, capeLift: 1 },
  crouch: { lean: 0.35, legF: [1.3, -0.3], legB: [0.95, -0.6], armF: [0.7, 1.3], armB: [0.35, 0.9], capeBack: 0.15, capeLift: -0.2 },
  hang: { lean: -0.05, legF: [0.15, 0.05], legB: [-0.1, -0.15], armF: [Math.PI - 0.1, Math.PI - 0.05], armB: [Math.PI - 0.3, Math.PI - 0.2], capeBack: 0, capeLift: -0.3 },
  pull: { lean: 0.5, legF: [1.6, 0.4], legB: [0.3, -0.4], armF: [0.6, 0.1], armB: [0.4, 0], capeBack: 0.2, capeLift: 0.2 },
  tuck: { lean: 0.9, legF: [2.0, 0.5], legB: [1.7, 0.2], armF: [1.5, 2.3], armB: [1.2, 1.9], capeBack: 0.1, capeLift: 0.6 },
};

const POSE_KEYS = Object.keys(POSES.idle);

function blendPose(a, b, t) {
  const out = {};
  for (const key of POSE_KEYS) {
    out[key] = Array.isArray(a[key]) ? a[key].map((v, i) => lerp(v, b[key][i], t)) : lerp(a[key], b[key], t);
  }
  return out;
}

const legHeight = ([thigh, shin]) => Math.cos(thigh) * LIMBS.thigh + Math.cos(shin) * LIMBS.shin;
const easeOut = (t) => 1 - (1 - t) ** 2;
const easeInOut = (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);

// Łuki ciosów mieczem (kąt ramienia od → do). Pierwszy z góry, drugi od dołu, trzeci – potężny z zamachu.
const SWING_ARCS = [
  { from: 3.7, to: 0.5, lean: 0.15 },
  { from: 0.3, to: 3.3, lean: 0.1 },
  { from: 4.2, to: 0.2, lean: 0.35 },
];
const SWORD_REST = 0.9; // miecz trzymany przed sobą między ciosami
const SMEAR_FADE = 0.1;

/**
 * Proceduralna animacja gracza: z aktualnego stanu ruchu liczymy pozę (kąty kończyn,
 * pochylenie, peleryna), na nią nakładamy pozę aktywnej umiejętności (zamach, blok,
 * celowanie, przewrót), a figura konkretnej postaci rysuje ją prostymi kształtami.
 * Na ziemi biodra ustawiamy tak, żeby niższa stopa dotykała podłoża.
 *
 * Renderer czyta tylko pola gracza – ten sam kod rysuje postać w grze i na ekranie wyboru.
 */
export class PlayerRenderer {
  // (x, y) – środek stóp na ekranie.
  draw(ctx, player, x, y) {
    const pose = this.computePose(player);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(player.facing * player.squashX, player.squashY);
    if (pose.spin) {
      // Obrót wokół środka ciała (przewrót, salto).
      ctx.translate(0, TUCK_HIP_Y);
      ctx.rotate(pose.spin);
      ctx.translate(0, -TUCK_HIP_Y);
    }
    FIGURES[player.character.id](ctx, pose, player.animTime);
    ctx.restore();
  }

  computePose(p) {
    const base = this.movementPose(p);
    const act = p.action;
    if (!act) return base;
    switch (act.kind) {
      case 'sword':
        return swordPose(base, act);
      case 'block':
        return { ...base, armF: [1.35, 1.6], armB: [0.9, 1.4], lean: base.lean - 0.05, shieldUp: true };
      case 'crossbow': {
        const recoil = act.phase === 'recoil' ? 1 - act.t / act.config.recoilTime : 0;
        return {
          ...base,
          armF: [Math.PI / 2 - 0.05 + recoil * 0.35, Math.PI / 2 + recoil * 0.3],
          armB: [1.05 + recoil * 0.2, 1.55],
          lean: base.lean - recoil * 0.12,
          aiming: true,
          charge: act.phase === 'charge' ? act.chargeRatio : 0,
        };
      }
      case 'roll':
        return { ...POSES.tuck, hipY: TUCK_HIP_Y, breath: 0, speed: 1, spin: act.progress * Math.PI * 2 };
      default:
        return base;
    }
  }

  movementPose(p) {
    const t = p.animTime;
    let pose;
    let hipY = null; // null = biodra wyliczane z nóg (postać stoi na ziemi)
    let breath = 0;
    let spin = 0;

    switch (p.moveState) {
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
      case 'fall': {
        // Przejście ze szczytu skoku w opadanie zamiast skokowej zmiany pozy.
        pose = p.moveState === 'jump' ? POSES.jump : blendPose(POSES.jump, POSES.fall, clamp(p.vy / 500, 0, 1));
        hipY = AIR_HIP_Y;
        if (p.flipTime > 0) {
          // Salto przy podwójnym skoku.
          const k = 1 - p.flipTime / AIR_FLIP_TIME;
          pose = blendPose(POSES.tuck, pose, Math.max(0, k * 2 - 1));
          hipY = TUCK_HIP_Y;
          spin = easeInOut(k) * Math.PI * 2;
        }
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
      spin,
      speed: clamp(Math.abs(p.vx) / p.stats.runSpeed, 0, 1),
    };
  }
}

// Zamach mieczem: ramię i ostrze idą po łuku, a w fazie trafienia za ostrzem zostaje smuga.
function swordPose(base, act) {
  const s = act.swing;
  const arc = SWING_ARCS[act.index];
  const t = act.t;
  const hitEnd = s.windup + s.active;
  let angle;
  let smear = null;
  let intensity;
  if (t < s.windup) {
    const k = easeOut(t / s.windup);
    angle = lerp(SWORD_REST, arc.from, k);
    intensity = k * 0.5;
  } else if (t < hitEnd) {
    const k = easeOut((t - s.windup) / s.active);
    angle = lerp(arc.from, arc.to, k);
    smear = { from: arc.from, to: angle, alpha: 1 };
    intensity = 1;
  } else {
    const k = clamp((t - hitEnd) / s.recovery, 0, 1);
    angle = lerp(arc.to, SWORD_REST, easeInOut(k));
    const fade = 1 - (t - hitEnd) / SMEAR_FADE;
    if (fade > 0) smear = { from: arc.from, to: arc.to, alpha: fade };
    intensity = 1 - k;
  }
  return {
    ...base,
    armF: [angle, angle],
    armB: [angle * 0.4 + 0.3, angle * 0.4 + 0.6],
    lean: base.lean + arc.lean * intensity,
    swordAngle: angle,
    smear,
    heavy: act.index === 2,
  };
}
