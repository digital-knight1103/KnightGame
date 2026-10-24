// Rysowanie prostszych obiektów świata: pocisków i manekinów treningowych.
// (x, y) zawsze w pikselach ekranu (po odjęciu kamery).

export function drawProjectile(ctx, proj, x, y) {
  const dir = proj.dir;
  const fade = proj.stuck ? Math.min(1, proj.stuckTimer / 0.3) : 1;
  const len = proj.charged ? 18 : 12;

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  // Smuga za lecącym bełtem.
  if (!proj.stuck) {
    const trail = ctx.createLinearGradient(x - dir * (len + 26), y, x, y);
    trail.addColorStop(0, 'rgba(255, 220, 140, 0)');
    trail.addColorStop(1, `rgba(255, 220, 140, ${proj.charged ? 0.55 : 0.35})`);
    ctx.fillStyle = trail;
    ctx.fillRect(Math.min(x, x - dir * (len + 26)), y - (proj.charged ? 2 : 1), len + 26, proj.charged ? 4 : 2);
  }
  const r = proj.charged ? 22 : 14;
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, `rgba(255, 233, 168, ${0.55 * fade})`);
  g.addColorStop(1, 'rgba(255, 233, 168, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();

  ctx.strokeStyle = `rgba(255, 244, 214, ${fade})`;
  ctx.lineWidth = proj.charged ? 2.5 : 1.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - dir * (len - 7), y);
  ctx.lineTo(x + dir * 7, y);
  ctx.stroke();
}

const DUMMY = {
  post: '#4a3626',
  straw: '#8a7444',
  strawDark: '#5f4f2d',
  rope: '#3a2c1c',
  flash: '#fff4e0',
};

export function drawDummy(ctx, dummy, x, y) {
  const flash = dummy.flash > 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(dummy.angle);
  ctx.fillStyle = flash ? DUMMY.flash : DUMMY.post;
  ctx.fillRect(-2, -44, 4, 44);
  // Worek ze słomą (tułów), poprzeczka (ręce) i głowa.
  ctx.fillStyle = flash ? DUMMY.flash : DUMMY.straw;
  ctx.fillRect(-9, -36, 18, 22);
  ctx.fillRect(-13, -33, 26, 4);
  ctx.beginPath();
  ctx.arc(0, -42, 6, 0, Math.PI * 2);
  ctx.fill();
  if (!flash) {
    ctx.fillStyle = DUMMY.strawDark;
    ctx.fillRect(-9, -24, 18, 2);
    ctx.fillRect(-4, -36, 1, 22);
    ctx.fillStyle = DUMMY.rope;
    ctx.fillRect(-9, -18, 18, 2);
    ctx.fillRect(-3, -43, 2, 2);
    ctx.fillRect(2, -43, 2, 2);
  }
  ctx.restore();

  // Liczby obrażeń unoszące się nad manekinem.
  ctx.save();
  ctx.textAlign = 'center';
  for (const p of dummy.popups) {
    const a = 1 - p.t / 0.8;
    ctx.font = p.heavy ? 'bold 16px Georgia, serif' : 'bold 13px Georgia, serif';
    ctx.fillStyle = p.heavy ? `rgba(255, 200, 110, ${a})` : `rgba(240, 232, 220, ${a})`;
    ctx.fillText(String(p.value), x + p.dx, y - 56 - p.t * 30);
  }
  ctx.restore();
}
