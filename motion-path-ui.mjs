import { applyMotionPath, motionPathSamples } from './motion-path.mjs';

export function installMotionPathEditor(host) {
  const { canvas, ctx } = host;
  let editing = null, dragging = null;
  const active = () => host.project().layers.find(l => l.id === editing);
  function fields(layer) {
    const path = layer.motionPath;
    return '<div class="section-title" style="margin-top:18px">MOVEMENT PATH</div>' +
      `<div class="sc-actions"><button type="button" data-motion-path="draw">${editing === layer.id ? 'Finish path' : path ? 'Edit path' : 'Draw path'}</button>${path ? '<button type="button" data-motion-path="last">Undo last point</button><button type="button" data-motion-path="clear">Remove path</button>' : ''}</div>` +
      (path ? `<label>Path shape<select data-path-field="curve"><option value="smooth" ${path.curve === 'smooth' ? 'selected' : ''}>Smooth curve</option><option value="straight" ${path.curve === 'straight' ? 'selected' : ''}>Straight lines</option></select></label><div class="two"><label>Start (s)<input data-path-field="start" type="number" min="0" step="0.01" value="${+(path.start / host.project().fps).toFixed(3)}"></label><label>Duration (s)<input data-path-field="dur" type="number" min="${1 / host.project().fps}" step="0.01" value="${+(path.dur / host.project().fps).toFixed(3)}"></label></div><p class="mini-label">${path.points.length} points. The path sets the layer’s X and Y keyframes.</p>` : '<p class="mini-label">Draw a route for this layer to follow. This replaces its X and Y keyframes.</p>') +
      (editing === layer.id ? '<p class="mini-label">Click to add points · drag a point to move it · Alt+click removes it · Enter or Escape finishes.</p>' : '');
  }
  function changed(layer) {
    applyMotionPath(layer);
    const end = layer.motionPath.start + layer.motionPath.dur;
    host.project().frames = Math.max(host.project().frames, end + 1); layer.in = Math.min(layer.in, layer.motionPath.start); layer.out = Math.max(layer.out, end);
    host.changed();
  }
  function finish() { editing = null; dragging = null; canvas.style.cursor = ''; host.renderInspector(); host.draw(); }
  function bind(layer) {
    const box = document.querySelector('#inspector');
    box.querySelectorAll('[data-motion-path]').forEach(button => button.onclick = () => {
      host.pause();
      const action = button.dataset.motionPath;
      if (action === 'draw') {
        if (editing === layer.id) return finish();
        if (!layer.motionPath) { host.checkpoint(); layer.motionPath = { points: [], curve: 'smooth', start: host.frame(), dur: Math.max(1, Math.min(90, host.project().frames - 1 - host.frame())) }; host.changed(); }
        editing = layer.id; canvas.style.cursor = 'crosshair'; host.renderInspector(); host.draw();
      } else if (layer.motionPath) {
        host.checkpoint();
        if (action === 'clear') {
          const p = host.pose(layer); delete layer.motionPath; layer.keys.x = []; layer.keys.y = []; layer.x = p.x; layer.y = p.y;
          editing = null; canvas.style.cursor = ''; host.changed();
        } else { layer.motionPath.points.pop(); if (!layer.motionPath.points.length) { layer.keys.x = []; layer.keys.y = []; } changed(layer); }
      }
    });
    box.querySelectorAll('[data-path-field]').forEach(input => input.onchange = () => {
      const field = input.dataset.pathField;
      const value = field === 'curve' ? input.value : Math.round(Number(input.value) * host.project().fps);
      if (field !== 'curve' && (!Number.isSafeInteger(value) || value < (field === 'dur' ? 1 : 0) || !Number.isSafeInteger(value + (field === 'dur' ? layer.motionPath.start : layer.motionPath.dur)))) { host.renderInspector(); return; }
      host.pause(); host.checkpoint(); layer.motionPath[field] = value; changed(layer);
    });
  }
  function screen(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX - r.left) * canvas.width / r.width, y: (e.clientY - r.top) * canvas.height / r.height }; }
  function local(e, layer) {
    const p = host.matrix(layer).inverse().transformPoint(screen(e));
    return { x: Math.max(-20000, Math.min(20000, +p.x.toFixed(2))), y: Math.max(-20000, Math.min(20000, +p.y.toFixed(2))) };
  }
  canvas.addEventListener('pointerdown', e => {
    if (!editing || e.button !== 0) return;
    const layer = active(); if (!layer?.motionPath) return finish();
    e.preventDefault(); e.stopImmediatePropagation();
    const matrix = host.matrix(layer), p = screen(e), radius = 14 * canvas.width / canvas.getBoundingClientRect().width;
    const i = layer.motionPath.points.findIndex(v => { const s = matrix.transformPoint(v); return Math.hypot(s.x - p.x, s.y - p.y) < radius; });
    if (i >= 0 && !e.altKey) { dragging = { id: layer.id, index: i, pointerId: e.pointerId, saved: false }; canvas.setPointerCapture(e.pointerId); return; }
    if (i < 0 && layer.motionPath.points.length >= 120) { host.notify('A path can have up to 120 points'); return; }
    host.checkpoint();
    if (i >= 0) layer.motionPath.points.splice(i, 1); else layer.motionPath.points.push(local(e, layer));
    if (!layer.motionPath.points.length) { layer.keys.x = []; layer.keys.y = []; }
    changed(layer);
  }, true);
  canvas.addEventListener('pointermove', e => {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    const layer = active(); if (!layer?.motionPath) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (!dragging.saved) { host.checkpoint(); dragging.saved = true; }
    layer.motionPath.points[dragging.index] = local(e, layer); applyMotionPath(layer); host.draw();
  }, true);
  const up = e => {
    if (!dragging || e.pointerId !== dragging.pointerId) return;
    e.stopImmediatePropagation(); const saved = dragging.saved; dragging = null;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    if (saved) host.changed();
  };
  canvas.addEventListener('pointerup', up, true); canvas.addEventListener('pointercancel', up, true);
  window.addEventListener('keydown', e => {
    if (!editing || document.body.classList.contains('landing') || ['mode-map', 'mode-paper', 'mode-scene'].some(c => document.body.classList.contains(c)) || e.target.closest('input,textarea,select,[contenteditable="true"]')) return;
    if (['Enter', 'Escape', 'Delete', 'Backspace'].includes(e.key)) {
      e.preventDefault(); e.stopImmediatePropagation();
      if (e.key === 'Enter' || e.key === 'Escape') finish();
      else { const layer = active(); if (layer?.motionPath?.points.length) { host.checkpoint(); layer.motionPath.points.pop(); if (!layer.motionPath.points.length) { layer.keys.x = []; layer.keys.y = []; } changed(layer); } }
    }
  }, true);
  function drawOverlay() {
    if (!editing) return;
    const layer = active();
    if (!layer?.motionPath || host.current()?.id !== editing) { editing = null; dragging = null; canvas.style.cursor = ''; return; }
    const matrix = host.matrix(layer), pts = motionPathSamples(layer.motionPath), scale = canvas.width / canvas.getBoundingClientRect().width;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#b6f36e'; ctx.lineWidth = 2 * scale; ctx.setLineDash([6 * scale, 4 * scale]); ctx.beginPath();
    pts.forEach((p, i) => { const s = matrix.transformPoint(p); i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y); }); ctx.stroke(); ctx.setLineDash([]);
    layer.motionPath.points.forEach((p, i) => { const s = matrix.transformPoint(p); ctx.fillStyle = '#17251d'; ctx.beginPath(); ctx.arc(s.x, s.y, 10 * scale, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffffff'; ctx.font = `bold ${11 * scale}px Arial`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), s.x, s.y); });
    ctx.restore();
  }
  return { fields, bind, drawOverlay, finish };
}
