// Drawn lines use the existing editable SVG layer and export pipeline.
export function lineArtwork(points, color = '#b6f36e', width = 5) {
  if (points.length < 2 || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) return null;
  const pad = 40, minX = Math.min(...points.map(p => p.x)), minY = Math.min(...points.map(p => p.y));
  const w = Math.max(1, Math.max(...points.map(p => p.x)) - minX) + pad * 2;
  const h = Math.max(1, Math.max(...points.map(p => p.y)) - minY) + pad * 2;
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${+(p.x - minX + pad).toFixed(2)} ${+(p.y - minY + pad).toFixed(2)}`).join(' ');
  return { x: minX + w / 2 - pad, y: minY + h / 2 - pad, w, h, name: 'Drawn line', isDrawnLine: true,
    svgMarkup: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}"><path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    vectorStroke: color, vectorStrokeWidth: width, vectorOverride: false, vectorDraw: false };
}

export function installLineDrawing(host) {
  const { canvas, ctx } = host;
  let mode = null, points = [], pointer = null;
  const panel = document.createElement('div');
  panel.innerHTML = '<div class="section-title">DRAW LINES</div><div class="add-grid"><button type="button" id="drawStraightLine">Straight line</button><button type="button" id="drawFreehandLine">Freehand</button></div><p class="mini-label" id="lineDrawingHint" hidden>Drag on the canvas to draw. Escape cancels.</p>';
  document.querySelector('.workspace.motion-only .add-grid').after(panel);
  function stop() { mode = null; points = []; pointer = null; canvas.style.cursor = ''; panel.querySelector('#lineDrawingHint').hidden = true; host.draw(); }
  for (const [id, value] of [['drawStraightLine', 'straight'], ['drawFreehandLine', 'freehand']]) panel.querySelector('#' + id).onclick = () => {
    host.pause(); host.finishPath(); mode = value; points = []; canvas.style.cursor = 'crosshair'; panel.querySelector('#lineDrawingHint').hidden = false;
    host.notify('Drag on the canvas to draw a ' + (value === 'straight' ? 'line' : 'freehand line') + '. Escape cancels.');
  };
  const screen = e => { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; };
  canvas.addEventListener('pointerdown', e => {
    if (!mode || e.button !== 0) return;
    e.preventDefault(); e.stopImmediatePropagation(); pointer = e.pointerId; points = [screen(e)]; canvas.setPointerCapture(pointer);
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (pointer !== e.pointerId) return;
    e.preventDefault(); e.stopImmediatePropagation(); const p = screen(e);
    if (mode === 'straight') points[1] = p;
    else if (points.length < 600 && Math.hypot(p.x - points.at(-1).x, p.y - points.at(-1).y) >= 3) points.push(p);
    host.draw();
  }, true);
  canvas.addEventListener('pointerup', e => {
    if (pointer !== e.pointerId) return;
    e.preventDefault(); e.stopImmediatePropagation();
    const end = screen(e); if (points.length === 1 || mode === 'straight') points[1] = end; else points.push(end);
    const moved = points.some(p => Math.hypot(p.x - points[0].x, p.y - points[0].y) >= 2);
    // Invert the current camera so the new artwork stays where it was drawn.
    const artwork = moved ? lineArtwork(points.map(host.toWorld)) : null;
    canvas.releasePointerCapture(pointer); stop(); if (artwork) host.add(artwork);
  }, true);
  canvas.addEventListener('pointercancel', () => { if (pointer !== null) stop(); });
  window.addEventListener('keydown', e => { if (mode && e.key === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); stop(); } }, true);
  return { drawOverlay() { if (!points.length) return; ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#b6f36e'; ctx.lineWidth = 5; ctx.lineCap = ctx.lineJoin = 'round'; ctx.beginPath(); points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.stroke(); ctx.restore(); } };
}
