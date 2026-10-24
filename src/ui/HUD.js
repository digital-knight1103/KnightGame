// Interfejs w trakcie gry: serca i pasek umiejętności specjalnej.
// (W Etapie 4 dojdzie licznik odłamków światła i przycisk wyciszenia.)

const METER_COLORS = {
  ready: '#9fd4ff',
  active: '#d8f0ff',
  cooldown: '#6c7a8c',
  broken: '#b8434a',
};

function heartPath(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x + s / 2, y + s * 0.9);
  ctx.bezierCurveTo(x - s * 0.15, y + s * 0.45, x + s * 0.05, y - s * 0.1, x + s / 2, y + s * 0.25);
  ctx.bezierCurveTo(x + s * 0.95, y - s * 0.1, x + s * 1.15, y + s * 0.45, x + s / 2, y + s * 0.9);
  ctx.closePath();
}

export class HUD {
  constructor(player) {
    this.player = player;
  }

  render(ctx) {
    const p = this.player;
    const size = 16;
    ctx.save();
    for (let i = 0; i < p.maxHealth; i++) {
      const x = 18 + i * (size + 5);
      const y = 16;
      heartPath(ctx, x, y, size);
      const fill = Math.max(0, Math.min(1, p.health - i)); // ułamkowe serca (np. po bloku)
      ctx.fillStyle = 'rgba(20, 10, 14, 0.75)';
      ctx.fill();
      if (fill > 0) {
        ctx.save();
        ctx.clip();
        ctx.fillStyle = '#c8323c';
        ctx.fillRect(x - 2, y - 2, (size + 4) * fill, size + 4);
        ctx.fillStyle = 'rgba(255, 190, 190, 0.6)';
        ctx.fillRect(x + 3, y + 3, 3, 3);
        ctx.restore();
      }
      heartPath(ctx, x, y, size);
      ctx.strokeStyle = 'rgba(230, 210, 200, 0.55)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }

    // Pasek umiejętności specjalnej z nazwą.
    const special = p.special;
    const bx = 18;
    const by = 42;
    const bw = 100;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(bx - 1, by - 1, bw + 2, 8);
    ctx.fillStyle = METER_COLORS[special.meterState];
    ctx.fillRect(bx, by, bw * special.meter, 6);
    ctx.font = '11px Georgia, serif';
    ctx.fillStyle = 'rgba(220, 212, 232, 0.75)';
    ctx.fillText(p.character.specialName, bx + bw + 8, by + 6);
    ctx.restore();
  }
}
