export const PIN_STYLES = {
  classic: 'Classic pin', dot: 'Dot', ring: 'Ring', diamond: 'Diamond', star: 'Star', flag: 'Flag',
};

export const pinScaleAt = (a, zoom) => a.sizeMode === 'map' ? 2 ** (zoom - (a.sizeZoom ?? 3)) : 1;
export const pinSizeAt = (a, zoom) => (a.size ?? 1) * pinScaleAt(a, zoom);

/** Draw relative to the geographic anchor; the classic pin's tip stays at (x, y). */
export function drawPinSymbol(ctx, style, x, y, s, color, unit) {
  ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2 * unit;
  ctx.beginPath();
  if (style === 'dot' || style === 'ring') {
    ctx.arc(x, y, s * .62, 0, Math.PI * 2);
    if (style === 'ring') {
      ctx.moveTo(x + s * .32, y);
      ctx.arc(x, y, s * .32, 0, Math.PI * 2, true);
    }
  } else if (style === 'diamond' || style === 'star') {
    const n = style === 'star' ? 10 : 4;
    for (let i = 0; i < n; i++) {
      const angle = -Math.PI / 2 + i * Math.PI * 2 / n;
      const r = s * (style === 'star' && i % 2 ? .34 : .8);
      const px = x + Math.cos(angle) * r, py = y + Math.sin(angle) * r;
      if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py);
    }
    ctx.closePath();
  } else if (style === 'flag') {
    ctx.moveTo(x, y); ctx.lineTo(x, y - s * 2);
    ctx.lineTo(x + s * 1.3, y - s * 2); ctx.lineTo(x + s * .95, y - s * 1.45);
    ctx.lineTo(x + s * 1.3, y - s * .9); ctx.lineTo(x, y - s * .9);
    ctx.closePath();
  } else {
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - s * .1, y - s * .55, x - s * .62, y - s * .95, x - s * .62, y - s * 1.5);
    ctx.arc(x, y - s * 1.5, s * .62, Math.PI, 0, false);
    ctx.bezierCurveTo(x + s * .62, y - s * .95, x + s * .1, y - s * .55, x, y);
  }
  ctx.fill(); ctx.stroke();
  if (!style || style === 'classic') {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - s * 1.5, s * .24, 0, Math.PI * 2); ctx.fill();
  }
}
