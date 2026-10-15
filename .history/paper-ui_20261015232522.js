import { confirmStudio, exportMarkup } from './studio-ui.mjs';
// FrameFlow Paper Studio: editor UI (parts, camera, timeline, playback, templates, export).
import { getAudioSnapshot, registerAudioStudio } from './audio-reference.mjs';
import { loadFont, loadFonts, fontPickerHtml, bindFontPicker } from './engine.mjs';
import { exportMapVideo } from './map-video-export.mjs';
import * as PE from './paper-engine.mjs';
import { TEMPLATE_LIST, buildTemplate } from './paper-templates.mjs';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const canvas = $('#pCanvas'), ctx = canvas.getContext('2d');
const STORE = 'frameflow-paper-v1';
const SAMPLE = 'Write your story here. Each paragraph starts on a new line and flows from column to column.\nSelect this part and paste your own text in the panel on the right. The columns, font and size can all be changed.\nPress Space to play and watch the lines appear.';

let proj, sel = null, frame = 0, playing = false, loop = true, raf, startTime, startFrame, audioUI = null;
let undoStack = [], redoStack = [], exporting = false, drag = null, lastView = null;
const registry = {}; // picture id -> data URL, shared by every project state in this session
const seenFonts = new Set();

// ------------------------------------------------------------------ helpers
const isSheet = it => it?.kind === 'sheet', isShot = it => it?.kind === 'shot';
const sheetItem = () => ({ id: 'sheet', kind: 'sheet', name: 'Newspaper sheet', start: proj.paper.start, dur: proj.paper.dur });
const items = () => [...[...proj.shots].sort((a, b) => a.start - b.start), sheetItem(), ...[...proj.parts].reverse()];
const current = () => items().find(i => i.id === sel);
const iconOf = it => (isShot(it) ? PE.SHOT_TYPES[it.type].icon : isSheet(it) ? '▤' : PE.KINDS[it.kind].icon);
const clsOf = it => (isShot(it) ? 'shot' : it.kind);
const part = id => proj.parts.find(p => p.id === id);
const snap = () => JSON.stringify(proj, (k, v) => (k === 'assets' ? undefined : v));
const adopt = p => { Object.assign(registry, p.assets || {}); p.assets = registry; proj = p; };
const restore = json => { const p = JSON.parse(json); p.assets = registry; return p; };
const fileBase = () => (proj.name || 'newspaper').replace(/[^a-z0-9 _-]/gi, '').trim() || 'newspaper';
const fmtTime = f => [Math.floor(f / proj.fps / 60), Math.floor(f / proj.fps) % 60, f % proj.fps].map(x => String(x).padStart(2, '0')).join(':');

function notify(s) {
  const t = $('#toast'); t.textContent = s; t.classList.add('show');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => t.classList.remove('show'), 2600); $('#pStatus').textContent = s;
}
function checkpoint() { undoStack.push(snap()); if (undoStack.length > 80) undoStack.shift(); redoStack = []; updateHistory(); }
function updateHistory() { const a = audioUI?.historyState(); $('#pUndo').disabled = a ? !a.undo : !undoStack.length; $('#pRedo').disabled = a ? !a.redo : !redoStack.length; }
function projectJson() {
  const used = new Set(proj.parts.map(p => p.img).filter(Boolean)), assets = {};
  for (const id of used) if (registry[id]) assets[id] = registry[id];
  return JSON.stringify({ ...proj, assets });
}
function saveLocal() { try { localStorage.setItem(STORE, projectJson()); $('#pSaveState').textContent = 'Saved locally'; } catch { $('#pSaveState').textContent = 'Save project to keep changes'; } }
function changed() { saveLocal(); renderItems(); renderTimeline(); draw(); }
function history(dir) {
  if (audioUI?.handlesHistory()) { audioUI.history(dir); return; }
  pause();
  const from = dir === 'undo' ? undoStack : redoStack, to = dir === 'undo' ? redoStack : undoStack;
  if (!from.length) return;
  to.push(snap()); proj = restore(from.pop());
  if (sel && !current()) sel = null;
  frame = Math.min(frame, proj.frames - 1); saveLocal(); renderAll(); updateHistory();
}
function ensureLength(end) { if (end > proj.frames) { proj.frames = Math.min(1800, Math.ceil(end + 15)); syncDuration(); } }
function syncFonts() {
  for (const n of PE.paperFontsUsed(proj)) { if (seenFonts.has(n)) continue; seenFonts.add(n); loadFont(n).then(() => { PE.bumpFonts(); draw(); }); }
}

// ------------------------------------------------------------------ drawing + playback
let drawQueued = false;
const requestDraw = () => { if (drawQueued) return; drawQueued = true; requestAnimationFrame(() => { drawQueued = false; draw(); }); };
function draw() {
  syncFonts();
  if (canvas.width !== proj.width || canvas.height !== proj.height) { canvas.width = proj.width; canvas.height = proj.height; }
  const ratio = `${proj.width} / ${proj.height}`; if (canvas.style.aspectRatio !== ratio) canvas.style.aspectRatio = ratio;
  lastView = PE.drawPaper(ctx, proj.width, proj.height, proj, frame, { onImage: requestDraw });
  if (!playing && !exporting) overlay();
}
function overlay() {
  const it = current(); if (!it || isShot(it) || !lastView) return;
  const M = lastView.M, ap = (x, y) => PE.mapply(M, x, y);
  const r = isSheet(it) ? { x: 0, y: 0, w: proj.paper.w, h: proj.paper.h } : lastView.rects.get(it.id) || { x: it.x, y: it.y, w: it.w, h: it.h };
  const pts = [ap(r.x, r.y), ap(r.x + r.w, r.y), ap(r.x + r.w, r.y + r.h), ap(r.x, r.y + r.h)];
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.strokeStyle = '#b6f36e'; ctx.lineWidth = Math.max(2, proj.width / 640); ctx.setLineDash([8, 6]);
  ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y))); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
  if (!isSheet(it) && it.kind !== 'marker') { const h = pts[2], s = Math.max(9, proj.width / 110); ctx.fillStyle = '#b6f36e'; ctx.fillRect(h.x - s / 2, h.y - s / 2, s, s); }
  ctx.restore();
}
function setFrame(n) {
  frame = clamp(Math.round(n) || 0, 0, proj.frames - 1);
  $('#pFrame').value = +(frame / proj.fps).toFixed(3); $('#pFrame').max = +((proj.frames - 1) / proj.fps).toFixed(3); $('#pFrame').step = '0.001'; $('#pTimecode').textContent = fmtTime(frame);
  $('#pPlayhead').style.left = `${frame / Math.max(1, proj.frames - 1) * 100}%`;
  draw(); window.dispatchEvent(new CustomEvent('ff-frame', { detail: { studio: 'paper', frame, fps: proj.fps, playing } }));
}
function pause() { playing = false; cancelAnimationFrame(raf); $('#pPlay').textContent = '▶'; window.dispatchEvent(new CustomEvent('ff-play', { detail: { studio: 'paper', playing: false, frame, fps: proj.fps } })); }
function play() {
  if (playing) { pause(); return; }
  if (frame >= proj.frames - 1) frame = 0;
  playing = true; startTime = performance.now(); startFrame = frame; $('#pPlay').textContent = 'Ⅱ';
  window.dispatchEvent(new CustomEvent('ff-play', { detail: { studio: 'paper', playing: true, frame, fps: proj.fps } }));
  const tick = t => {
    let f = startFrame + Math.floor((t - startTime) / 1000 * proj.fps);
    if (f >= proj.frames) { if (loop) f %= proj.frames; else { setFrame(proj.frames - 1); pause(); return; } }
    if (f !== frame) if(f!==frame)setFrame(f); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ left panel: add parts, camera moves, list
function buildStaticUI() {
  $('#pAddGrid').innerHTML = Object.entries(PE.KINDS).map(([k, a]) => `<button data-padd="${k}" title="${esc(a.hint)}"><b>${a.icon}</b>${a.label}</button>`).join('');
  $('#pShots').innerHTML = Object.entries(PE.SHOT_TYPES).map(([k, p]) => `<button data-pshot="${k}" title="${esc(p.hint)}"><b>${p.icon}</b><span>${p.label}</span></button>`).join('');
  $$('[data-padd]').forEach(el => el.onclick = () => addPart(el.dataset.padd));
  $$('[data-pshot]').forEach(el => el.onclick = () => addShot(el.dataset.pshot));
}
function viewCenter() {
  if (lastView) { const c = PE.toPaper(lastView, proj.width / 2, proj.height / 2); return { x: c.x, y: c.y }; }
  return { x: proj.paper.w / 2, y: proj.paper.h / 2 };
}
function addPart(kind) {
  pause(); checkpoint();
  const p = PE.makePart(kind, frame), c = viewCenter(), pa = proj.paper;
  if (kind === 'columns') p.text = SAMPLE;
  if (['headline', 'text', 'masthead', 'columns', 'rule'].includes(kind)) p.w = Math.min(p.w, pa.w - 80);
  p.h = Math.min(p.h, pa.h - 40);
  if (kind === 'banner' || kind === 'ticker') { p.x = 0; p.w = pa.w; } else p.x = Math.round(clamp(c.x - p.w / 2, 0, Math.max(0, pa.w - p.w)));
  p.y = Math.round(clamp(c.y - p.h / 2, 0, Math.max(0, pa.h - p.h)));
  if (kind === 'photo') { p.w = Math.min(p.w, pa.w - 80); }
  const ink = PE.inkOf(proj); for (const k of ['color', 'borderColor']) if (p[k] === '#1d1b18') p[k] = ink;
  ensureLength(p.start + p.dur); proj.parts.push(p); sel = p.id; saveLocal(); renderAll(); notify(`${PE.KINDS[kind].label} added at frame ${frame}`);
}
function addShot(type) {
  pause(); checkpoint();
  const cur = current(), s = PE.makeShot(type, frame);
  if (SHOT_NEEDS_TARGET.has(type)) s.target = cur && !isShot(cur) && !isSheet(cur) ? cur.id : proj.parts.find(p => p.kind === 'headline')?.id || '';
  ensureLength(s.start + s.dur); proj.shots.push(s); sel = s.id; saveLocal(); renderAll(); notify(`${PE.SHOT_TYPES[type].label} added at frame ${frame}`);
}
const SHOT_NEEDS_TARGET = new Set(['focus', 'push']);
function renderItems() {
  const its = items();
  $('#pItemCount').textContent = its.length;
  $('#pItems').innerHTML = its.map(it => `<div class="m-item ${it.id === sel ? 'selected' : ''}" data-pid="${esc(it.id)}"><span class="type c-${clsOf(it)}">${iconOf(it)}</span><span class="name">${esc(it.name)}</span><span class="when">${it.start}</span></div>`).join('');
  $$('[data-pid]').forEach(el => el.onclick = () => select(el.dataset.pid));
  const cur = current(), real = cur && !isSheet(cur);
  $('#pDuplicate').disabled = $('#pDelete').disabled = !real;
  $('#pUp').disabled = $('#pDown').disabled = !(cur && !isShot(cur) && !isSheet(cur));
  audioUI?.renderList();
}
function select(id) { sel = id; renderItems(); renderInspector(); renderTimeline(); draw(); }

// ------------------------------------------------------------------ inspector
const WEIGHTS = [[400, 'Regular'], [600, 'Semi-bold'], [700, 'Bold'], [800, 'Extra bold']];
const o = obj => Object.entries(obj);
const get = (root, path) => path.split('.').reduce((a, k) => a?.[k], root);
const set = (root, path, v) => { const ks = path.split('.'), last = ks.pop(); ks.reduce((a, k) => a[k], root)[last] = v; };
const F = {
  text: (k, label, v, max = 120) => `<label>${label}<input data-pf="${k}" data-t="text" maxlength="${max}" value="${esc(v)}"></label>`,
  area: (k, label, v, rows = 4) => `<label>${label}<textarea data-pf="${k}" data-t="area" rows="${rows}" maxlength="20000" spellcheck="false">${esc(v)}</textarea></label>`,
  num: (k, label, v, min, max, step = 1) => `<label>${label}<input data-pf="${k}" data-t="num" type="number" min="${min}" max="${max}" step="${step}" value="${Number((+v).toFixed(3))}"></label>`,
  range: (k, label, v, min, max, step, unit = '', scale = 1, d = 0) => `<label>${label} <span class="m-val">${(v * scale).toFixed(d)}${unit}</span><input data-pf="${k}" data-t="range" data-u="${unit}" data-s="${scale}" data-d="${d}" type="range" min="${min}" max="${max}" step="${step}" value="${v}"></label>`,
  chk: (k, label, v) => `<label class="m-chk"><input type="checkbox" data-pf="${k}" data-t="chk" ${v ? 'checked' : ''}> ${label}</label>`,
  color: (k, label, v) => `<label class="color-row">${label}<input type="color" data-pf="${k}" data-t="color" value="${esc(/^#[0-9a-f]{6}$/i.test(v) ? v : '#000000')}"></label>`,
  sel: (k, label, v, opts, t = 'sel') => `<label>${label}<select data-pf="${k}" data-t="${t}">${opts.map(([val, l]) => `<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`,
  sep: label => `<div class="section-title m-sep">${label}</div>`,
};
function fontField(id, label, key, it) { return fontPickerHtml(id, label, it[key]); }
function layoutFields(it) { return F.sep('POSITION & SIZE') + `<div class="two">${F.num('x', 'X', it.x, -3000, 8000)}${F.num('y', 'Y', it.y, -3000, 8000)}</div><div class="two">${F.num('w', 'Width', it.w, 4, 8000)}${F.num('h', 'Height', it.h, 2, 8000)}</div>`; }
function timingFields(it) {
  const anims = PE.KINDS[it.kind].anims;
  return `<div class="two">${F.num('start', 'Appears at frame', it.start, 0, 1799)}${F.num('dur', 'Animation length', it.dur, 1, 1800)}</div>` + F.sel('anim', 'Entrance', it.anim, anims.map(a => [a, PE.ANIMS[a]])) + F.sel('easing', 'Motion', it.easing, PE.EASE_OPTS) +
    F.range('opacity', 'Opacity', it.opacity ?? 1, 0, 1, .02, '%', 100) + F.chk('keep', 'Stay on the page after it appears', it.keep !== false);
}
function boxFields(it) {
  return F.chk('__bg', 'Background fill', !!it.bg) + (it.bg ? F.color('bg', 'Fill color', it.bg) : '') + `<div class="two">${F.num('border', 'Border width', it.border, 0, 30, .5)}${F.num('pad', 'Padding', it.pad, 0, 200)}</div>` + (it.border > 0 ? F.color('borderColor', 'Border color', it.borderColor) : '');
}
function kindFields(it) {
  switch (it.kind) {
    case 'headline': case 'text':
      return F.sep('TEXT') + F.area('text', 'Text', it.text, it.kind === 'headline' ? 3 : 5) + fontField('pFont', 'Font', 'font', it) + `<div class="two">${F.sel('weight', 'Weight', it.weight, WEIGHTS, 'int')}${F.num('size', it.autoFit ? 'Largest size' : 'Size', it.size, 6, 600)}</div>` + F.color('color', 'Text color', it.color) +
        `<div class="two">${F.sel('align', 'Align', it.align, [['left', 'Left'], ['center', 'Center'], ['right', 'Right']])}${F.sel('valign', 'Vertical', it.valign, [['top', 'Top'], ['middle', 'Middle'], ['bottom', 'Bottom']])}</div>` +
        F.chk('autoFit', 'Shrink text to fit the box', it.autoFit) + F.chk('caps', 'ALL CAPS', it.caps) + F.chk('italic', 'Italic', it.italic) + F.range('lineH', 'Line height', it.lineH, .8, 2.4, .02, '', 1, 2) + F.range('spacing', 'Letter spacing', it.spacing, -5, 30, 1, '%') + F.sep('BOX') + boxFields(it);
    case 'masthead':
      return F.sep('NEWSPAPER NAME') + F.text('text', 'Name', it.text, 80) + fontField('pFont', 'Font', 'font', it) + `<div class="two">${F.sel('weight', 'Weight', it.weight, WEIGHTS, 'int')}${F.num('size', 'Largest size', it.size, 10, 400)}</div>` + F.color('color', 'Ink color', it.color) + F.sel('rules', 'Rules', it.rules, [['double', 'Double'], ['single', 'Single'], ['none', 'None']]) +
        F.sep('DATE LINE') + F.text('metaL', 'Left', it.metaL, 60) + F.text('metaC', 'Center', it.metaC, 60) + F.text('metaR', 'Right', it.metaR, 60);
    case 'columns': {
      const over = PE.columnsOverflow(it);
      return F.sep('ARTICLE TEXT') + F.area('text', 'Text (one paragraph per line)', it.text, 8) + (over > 0 ? `<p class="mini-label p-warn">The text is ${over} line${over > 1 ? 's' : ''} too long for this box. Make the box taller or the text smaller.</p>` : '') + fontField('pFont', 'Font', 'font', it) +
        `<div class="two">${F.num('size', 'Text size', it.size, 6, 80, .5)}${F.num('cols', 'Columns', it.cols, 1, 8)}</div>` + F.color('color', 'Text color', it.color) + F.range('lineH', 'Line height', it.lineH, 1, 2.2, .02, '', 1, 2) + F.num('gap', 'Space between columns', it.gap, 0, 200) +
        F.chk('justify', 'Justify (straight edges)', it.justify) + F.chk('dropCap', 'Large first letter', it.dropCap) + F.chk('rules', 'Lines between columns', it.rules) + F.sel('mode', 'Show as', it.mode, [['text', 'Readable text'], ['lines', 'Grey bars (placeholder look)']]);
    }
    case 'photo':
      return F.sep('PICTURE') + `<button type="button" data-pupload>${it.img ? 'Replace picture…' : 'Upload picture…'}</button>${it.img ? '<button type="button" data-pclearimg style="margin-top:6px">Use sample picture instead</button>' : F.sel('placeholder', 'Sample picture', it.placeholder, o(PE.PLACEHOLDERS))}` +
        F.sel('treat', 'Print style', it.treat, o(PE.TREATMENTS)) + (it.img ? F.sel('fit', 'Fit', it.fit, [['cover', 'Fill the frame'], ['contain', 'Show whole picture']]) : '') + F.range('kenburns', 'Slow zoom while visible', it.kenburns, 0, 30, 1, '%') +
        F.sep('CAPTION') + F.area('caption', 'Caption (leave empty for none)', it.caption, 2) + `<div class="two">${F.num('capSize', 'Caption size', it.capSize, 6, 60)}${F.color('color', 'Color', it.color)}</div>` + fontField('pCapFont', 'Caption font', 'capFont', it) + F.sep('FRAME') + `<div class="two">${F.num('border', 'Border width', it.border, 0, 30, .5)}${F.color('borderColor', 'Border color', it.borderColor)}</div>`;
    case 'banner':
      return F.sep('BANNER') + F.text('text', 'Text', it.text, 60) + fontField('pFont', 'Font', 'font', it) + F.num('size', 'Largest size', it.size, 8, 500) + `<div class="two">${F.color('bg', 'Bar color', it.bg)}${F.color('color', 'Text color', it.color)}</div>` + F.sel('shape', 'Shape', it.shape, [['angled', 'Angled ends'], ['rect', 'Straight']]) + F.chk('stripes', 'Stripes on the edges', it.stripes) + F.chk('flash', 'Flashing', it.flash) + (it.flash ? F.range('flashRate', 'Flash speed', it.flashRate, .5, 5, .1, '/s', 1, 1) : '');
    case 'stamp':
      return F.sep('STAMP') + F.text('text', 'Text', it.text, 40) + fontField('pFont', 'Font', 'font', it) + F.num('size', 'Largest size', it.size, 8, 400) + F.color('color', 'Ink color', it.color) + F.range('rot', 'Rotation', it.rot, -45, 45, 1, '°') + F.num('border', 'Border width', it.border, 0, 30, .5) + F.range('distress', 'Worn ink', it.distress, 0, 1, .05, '%', 100);
    case 'ticker':
      return F.sep('TICKER') + F.area('text', 'Scrolling text', it.text, 3) + F.text('label', 'Label (left block)', it.label, 20) + fontField('pFont', 'Font', 'font', it) + `<div class="two">${F.num('size', 'Text size', it.size, 8, 200)}${F.num('speed', 'Speed (units/s)', it.speed, 10, 1000, 10)}</div>` + `<div class="two">${F.color('bg', 'Strip color', it.bg)}${F.color('color', 'Text color', it.color)}</div><div class="two">${F.color('labelBg', 'Label color', it.labelBg)}${F.color('labelColor', 'Label text', it.labelColor)}</div>`;
    case 'marker': {
      const targets = [['', 'Free box (use position below)'], ...proj.parts.filter(p => p.id !== it.id && !['marker', 'deco'].includes(p.kind)).map(p => [p.id, p.name])];
      return F.sep('MARKER') + F.sel('style', 'Style', it.style, o(PE.MARKER_STYLES)) + F.sel('target', 'Draw over', it.target, targets) + F.color('color', 'Color', it.color) + (it.style === 'highlight' ? '' : F.range('width', 'Pen thickness', it.width, 2, 16, .5)) + (it.target ? '<p class="mini-label">It follows the lines of the part you picked.</p>' : '');
    }
    case 'rule': return F.sep('DIVIDER') + F.sel('style', 'Style', it.style, o(PE.RULE_STYLES)) + F.color('color', 'Color', it.color) + F.range('thickness', 'Thickness', it.thickness, 1, 20, .5);
    case 'deco': return F.sep('LOOK') + F.sel('shape', 'Shape', it.shape, o(PE.DECO_SHAPES)) + F.color('color', 'Color', it.color) + (it.shape === 'tape' ? F.range('rot', 'Rotation', it.rot, -90, 90, 1, '°') : '');
  }
  return '';
}
function shotFields(s) {
  const has = k => PE.SHOT_TYPES[s.type].fields.includes(k), targets = [['', 'None'], ...proj.parts.filter(p => p.kind !== 'deco').map(p => [p.id, p.name])];
  let h = `<p class="mini-label">${esc(PE.SHOT_TYPES[s.type].hint)}.</p>`;
  if (has('target')) h += F.sel('target', s.type === 'focus' ? 'Focus on' : 'Move toward', s.target, targets);
  if (has('fill')) h += F.range('fill', 'How much of the screen it fills', s.fill, .2, 1, .02, '%', 100);
  if (has('level')) h += F.chk('level', 'Straighten a tilted sheet', s.level !== false);
  if (has('amount')) h += F.num('amount', s.type === 'pull' ? 'Zoom out by (0.25 = 25%)' : 'Zoom in by (0.25 = 25%)', s.amount, 0, 8, .05);
  if (has('dx')) h += `<div class="two">${F.num('dx', 'Move right', s.dx, -5000, 5000, 10)}${F.num('dy', 'Move down', s.dy, -5000, 5000, 10)}</div>`;
  if (has('degrees')) h += F.num('degrees', 'Rotate by (degrees)', s.degrees, -720, 720, 1);
  if (has('amp')) h += F.num('amp', 'Strength (pixels)', s.amp, 1, 80);
  return h;
}
function sheetFields() {
  const pa = proj.paper, sc = proj.scene;
  return F.sep('PAPER') + F.sel('paper.stock', 'Paper type', pa.stock, o(PE.STOCKS).map(([k, v]) => [k, v.label])) + F.chk('__pcolor', 'Custom paper color', !!pa.color) + (pa.color ? F.color('paper.color', 'Paper color', pa.color) : '') +
    `<div class="two">${F.sel('paper.edge', 'Edges', pa.edge, o(PE.EDGES))}${F.sel('paper.fold', 'Folds', pa.fold, o(PE.FOLDS))}</div>` + F.range('paper.wear', 'Aging & stains', pa.wear, 0, 1, .05, '%', 100) + F.range('paper.grain', 'Paper grain', pa.grain, 0, 1, .05, '%', 100) + F.range('paper.tilt', 'Tilt', pa.tilt, -20, 20, .5, '°', 1, 1) + F.chk('paper.shadow', 'Shadow under the paper', pa.shadow) +
    `<div class="two">${F.num('paper.w', 'Sheet width', pa.w, 200, 4000)}${F.num('paper.h', 'Sheet height', pa.h, 200, 5000)}</div>` +
    F.sep('ENTRANCE') + F.sel('paper.enter', 'How the sheet arrives', pa.enter, o(PE.SHEET_ENTRANCES)) + (pa.enter === 'none' ? '' : `<div class="two">${F.num('paper.start', 'Starts at frame', pa.start, 0, 1799)}${F.num('paper.dur', 'Length (frames)', pa.dur, 1, 1800)}</div>` + F.sel('paper.easing', 'Motion', pa.easing, PE.EASE_OPTS)) +
    F.sep('BACKGROUND') + F.sel('scene.type', 'Scene', sc.type, o(PE.SCENES)) + (sc.type === 'color' ? F.color('scene.color', 'Color', sc.color) : '') +
    F.sep('START VIEW') + `<div class="two">${F.num('camera.x', 'Look at X', proj.camera.x, -5000, 9000)}${F.num('camera.y', 'Look at Y', proj.camera.y, -5000, 9000)}</div><div class="two">${F.num('camera.zoom', 'Zoom', proj.camera.zoom, .05, 12, .05)}${F.num('camera.rot', 'Rotation', proj.camera.rot, -720, 720, 1)}</div><button type="button" data-pcam>Use what I see now as the start view</button>`;
}
function renderInspector() {
  if (audioUI?.renderInspector()) return;
  const it = current(), box = $('#pInspector'), title = $('#pInspTitle');
  if (!it) { box.innerHTML = '<p class="muted">Click a part on the page, or pick one in the list, to edit it.<br><br>Drag a part to move it. Drag its green corner to resize. Add parts and camera moves on the left.</p>'; title.textContent = 'Properties'; return; }
  const name = F.text('name', 'Name', it.name, 100);
  let h;
  if (isSheet(it)) { title.textContent = 'Newspaper sheet'; h = `<div class="inspector-title"><span>▤</span> <em>Newspaper sheet</em></div>` + sheetFields(); }
  else if (isShot(it)) {
    title.textContent = 'Camera move';
    h = `<div class="inspector-title"><span>${iconOf(it)}</span> <em id="pInspName">${esc(it.name)}</em></div>` + name + F.sel('type', 'Camera move', it.type, o(PE.SHOT_TYPES).map(([k, v]) => [k, v.label])) + `<div class="two">${F.num('start', 'Start frame', it.start, 0, 1799)}${F.num('dur', 'Length (frames)', it.dur, 1, 1800)}</div>` + F.sel('easing', 'Motion', it.easing, PE.EASE_OPTS) + F.sep('CAMERA') + shotFields(it);
  } else {
    title.textContent = PE.KINDS[it.kind].label;
    h = `<div class="inspector-title"><span>${iconOf(it)}</span> <em id="pInspName">${esc(it.name)}</em></div>` + name + timingFields(it) + kindFields(it) + (it.kind === 'marker' && it.target ? '' : layoutFields(it));
  }
  box.innerHTML = h; bindInspector(it);
}
const RERENDER = new Set(['__bg', '__pcolor', 'target', 'type', 'scene.type', 'paper.enter', 'style', 'shape', 'mode', 'flash', 'border', 'autoFit', 'img']);
function bindInspector(it) {
  const root = isSheet(it) ? proj : it; let gesture = false;
  $$('#pInspector [data-pf]').forEach(el => {
    const key = el.dataset.pf, t = el.dataset.t;
    const read = () => (t === 'chk' ? el.checked : t === 'num' || t === 'range' || t === 'int' ? Number(el.value) : el.value);
    if (t === 'range' || t === 'color' || t === 'area') {
      el.oninput = () => {
        if (!gesture) { checkpoint(); gesture = true; }
        const v = read(); set(root, key, v);
        if (t === 'range') { const out = el.parentElement.querySelector('.m-val'); if (out) out.textContent = (v * +el.dataset.s).toFixed(+el.dataset.d) + el.dataset.u; }
        draw();
      };
      el.onchange = () => { gesture = false; changed(); if (key === 'text' || key === 'caption') renderInspector(); };
      return;
    }
    el.onchange = () => {
      let v = read();
      if (key === 'name') { checkpoint(); it.name = String(v).slice(0, 100) || 'Untitled'; changed(); const n = $('#pInspName'); if (n) n.textContent = it.name; return; }
      checkpoint();
      if (key === '__bg') { it.bg = v ? PE.paperColorOf(proj) : ''; if (v && !it.border) it.border = 0; changed(); renderInspector(); return; }
      if (key === '__pcolor') { proj.paper.color = v ? PE.paperColorOf(proj) : ''; changed(); renderInspector(); return; }
      if (key === 'type') { const nu = PE.makeShot(v, it.start), old = PE.SHOT_TYPES[it.type].label; for (const k of ['fill', 'amount', 'dx', 'dy', 'degrees', 'amp', 'level']) delete it[k]; Object.assign(it, nu, { id: it.id, start: it.start, target: it.target, name: it.name === old ? nu.name : it.name }); changed(); renderInspector(); return; }
      if (t === 'num') {
        const lo = Number(el.min), hi = Number(el.max); v = clamp(Number.isFinite(v) ? v : lo, lo, hi); el.value = v;
        if (/(^|\.)(start|dur)$/.test(key)) { v = Math.round(v); el.value = v; set(root, key, v); ensureLength((isSheet(it) ? proj.paper.start + proj.paper.dur : it.start + it.dur)); changed(); return; }
      }
      set(root, key, v); if (key === 'paper.w' || key === 'paper.h') lastView = null;
      changed(); if (RERENDER.has(key)) renderInspector();
    };
  });
  for (const [id, key, name] of [['pFont', 'font'], ['pCapFont', 'capFont']]) if ($('#' + id)) bindFontPicker(id, n => { checkpoint(); it[key] = n; loadFont(n).then(() => { PE.bumpFonts(); draw(); }); changed(); });
  $('#pInspector [data-pupload]')?.addEventListener('click', () => $('#pImageFile').click());
  $('#pInspector [data-pclearimg]')?.addEventListener('click', () => { checkpoint(); it.img = ''; changed(); renderInspector(); });
  $('#pInspector [data-pcam]')?.addEventListener('click', () => { checkpoint(); const c = PE.cameraAt(proj, frame); proj.camera = { x: Math.round(c.x), y: Math.round(c.y), zoom: +c.zoom.toFixed(3), rot: +c.rot.toFixed(1) }; changed(); renderInspector(); notify('Start view updated'); });
}
async function loadPicture(file) {
  const it = current(); if (!it || it.kind !== 'photo') return;
  try {
    if (!file.type.startsWith('image/')) throw Error('That file is not a picture.');
    if (file.size > 25e6) throw Error('Pictures can be up to 25 MB.');
    const url = URL.createObjectURL(file), img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('This picture could not be opened.')); i.src = url; });
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas'); c.width = Math.max(1, Math.round(img.naturalWidth * s)); c.height = Math.max(1, Math.round(img.naturalHeight * s));
    const x = c.getContext('2d'); x.fillStyle = '#ffffff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
    const id = crypto.randomUUID(); registry[id] = c.toDataURL('image/jpeg', .86);
    pause(); checkpoint(); it.img = id; changed(); renderInspector(); notify('Picture added');
  } catch (e) { notify(e.message); }
}

// ------------------------------------------------------------------ video settings
function syncDuration() { const i = $('#pDuration'); i.min = +(2 / proj.fps).toFixed(3); i.max = +(1800 / proj.fps).toFixed(3); i.step = '0.001'; i.value = +(proj.frames / proj.fps).toFixed(3); }
function renderSettings() {
  $('#pProjectName').value = proj.name; $('#pFps').value = proj.fps; $('#pFpsLabel').textContent = proj.fps + ' FPS';
  syncDuration(); $('#pSize').value = proj.width + ',' + proj.height; $('#pCompLabel').textContent = `${proj.width} × ${proj.height}`;
}
function bindSettings() {
  const edit = fn => e => { pause(); checkpoint(); fn(e.target); saveLocal(); renderAll(); };
  $('#pProjectName').onchange = edit(el => proj.name = el.value.trim().slice(0, 100) || 'Untitled newspaper');
  $('#pFps').onchange = edit(el => { const old = proj.fps; proj.fps = +el.value; const k = proj.fps / old; proj.frames = clamp(Math.round(proj.frames * k), 2, 1800); const sc = o => { o.start = Math.round(o.start * k); o.dur = Math.max(1, Math.round(o.dur * k)); }; proj.parts.forEach(sc); proj.shots.forEach(sc); sc(proj.paper); frame = Math.min(Math.round(frame * k), proj.frames - 1); });
  $('#pDuration').onchange = edit(el => { const s = Number(el.value); if (el.value.trim() && Number.isFinite(s)) proj.frames = clamp(Math.round(s * proj.fps), 2, 1800); frame = Math.min(frame, proj.frames - 1); });
  $('#pSize').onchange = edit(el => { const [w, h] = el.value.split(',').map(Number); proj.width = w; proj.height = h; });
  const panel = $('#pSettingsPanel'), open = $('#pSettingsButton'), close = $('#pSettingsClose');
  const setOpen = on => { if (on && !panel.open) panel.showModal(); else if (!on && panel.open) panel.close(); open.setAttribute('aria-expanded', String(panel.open)); };
  open.onclick = () => setOpen(!panel.open); close.onclick = () => setOpen(false);
  panel.addEventListener('close', () => open.setAttribute('aria-expanded', 'false'));
  panel.addEventListener('click', e => { const r = panel.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setOpen(false); });
}

// ------------------------------------------------------------------ timeline
const frameFromEvent = e => { const b = $('#pTracks').getBoundingClientRect(); return clamp(Math.round((e.clientX - b.left) / b.width * (proj.frames - 1)), 0, proj.frames - 1); };
function setTiming(it, start, dur) { if (isSheet(it)) { proj.paper.start = start; proj.paper.dur = dur; } else { it.start = start; it.dur = dur; } }
function renderTimeline() {
  const zoom = +$('#pZoomT').value, its = items(), last = Math.max(1, proj.frames - 1);
  $('#pTracks').style.width = `${zoom * 100}%`;
  const step = Math.max(1, Math.round(proj.frames / (10 * zoom))); let ticks = '';
  for (let f = 0; f < proj.frames; f += step) ticks += `<span class="tick" style="left:${f / last * 100}%">${f}</span>`;
  $('#pRuler').innerHTML = ticks;
  $('#pTrackLabels').innerHTML = its.map(it => `<div class="track-label ${it.id === sel ? 'selected' : ''}" data-ptl="${esc(it.id)}"><span>${iconOf(it)}</span>${esc(it.name)}</div>`).join('');
  $('#pTrackRows').innerHTML = its.map(it => `<div class="track-row m-row ${it.id === sel ? 'selected' : ''}" data-prow="${esc(it.id)}"><div class="m-clip t-${clsOf(it)} ${it.id === sel ? 'selected' : ''}" data-pclip="${esc(it.id)}" style="left:${it.start / last * 100}%;width:${Math.max(.6, it.dur / last * 100)}%" title="${esc(it.name)} · frame ${it.start}–${it.start + it.dur}"><i class="m-h l" data-h="l"></i><span>${esc(it.name)}</span><i class="m-h r" data-h="r"></i></div></div>`).join('');
  $('#pTrackLabels').style.transform = `translateY(-${$('#pScroll').scrollTop}px)`;
  $$('[data-ptl]').forEach(el => el.onclick = () => select(el.dataset.ptl));
  $$('[data-pclip]').forEach(el => el.onpointerdown = e => {
    e.preventDefault(); e.stopPropagation(); pause();
    const id = el.dataset.pclip, it = items().find(i => i.id === id); if (!it) return;
    if (sel !== id) { sel = id; renderItems(); renderInspector(); }
    // Selecting a timeline clip should not create an undo entry. Only a real drag does.
    drag = { kind: 'clip', id, mode: e.target.dataset.h || 'move', x0: frameFromEvent(e), start: it.start, dur: it.dur, moved: false, checkpointed: false }; renderTimeline();
  });
  $$('[data-prow]').forEach(el => el.onpointerdown = e => { if (e.target.closest('[data-pclip]')) return; select(el.dataset.prow); scrub(e); });
  audioUI?.renderTimeline();
}
function scrub(e) { pause(); setFrame(frameFromEvent(e)); drag = { kind: 'scrub' }; }
$('#pRuler').onpointerdown = scrub;
$('#pScroll').onscroll = () => $('#pTrackLabels').style.transform = `translateY(-${$('#pScroll').scrollTop}px)`;

// ------------------------------------------------------------------ canvas: select, move, resize
const screenPt = e => { const b = canvas.getBoundingClientRect(); return { x: (e.clientX - b.left) / b.width * proj.width, y: (e.clientY - b.top) / b.height * proj.height }; };
function onHandle(it, p) {
  if (!it || isShot(it) || isSheet(it) || it.kind === 'marker' || !lastView) return false;
  const r = lastView.rects.get(it.id); if (!r) return false;
  const h = PE.mapply(lastView.M, r.x + r.w, r.y + r.h), s = Math.max(14, proj.width / 70);
  return Math.abs(p.x - h.x) <= s && Math.abs(p.y - h.y) <= s;
}
canvas.addEventListener('pointerdown', e => {
  if (e.button !== 0 || !lastView) return;
  pause(); const p = screenPt(e), cur = current();
  if (onHandle(cur, p)) { checkpoint(); drag = { kind: 'resize', id: cur.id, w: cur.w, h: cur.h, q: PE.toPaper(lastView, p.x, p.y), moved: false }; canvas.setPointerCapture?.(e.pointerId); return; }
  const id = PE.hitTest(proj, lastView, p.x, p.y, 3);
  if (id) {
    if (sel !== id) select(id);
    const it = part(id);
    if (it.kind !== 'marker' || !it.target) { checkpoint(); drag = { kind: 'move', id, x: it.x, y: it.y, q: PE.toPaper(lastView, p.x, p.y), moved: false }; canvas.setPointerCapture?.(e.pointerId); }
  } else { const q = PE.toPaper(lastView, p.x, p.y); select(q.x >= 0 && q.y >= 0 && q.x <= proj.paper.w && q.y <= proj.paper.h ? 'sheet' : null); }
});
canvas.addEventListener('pointermove', e => {
  if (drag || !lastView || playing) return;
  const p = screenPt(e); canvas.style.cursor = onHandle(current(), p) ? 'nwse-resize' : PE.hitTest(proj, lastView, p.x, p.y, 3) ? 'move' : 'default';
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.kind === 'scrub') { setFrame(frameFromEvent(e)); return; }
  if (drag.kind === 'move' || drag.kind === 'resize') {
    const it = part(drag.id); if (!it || !lastView) return;
    const q = PE.toPaper(lastView, screenPt(e).x, screenPt(e).y), dx = q.x - drag.q.x, dy = q.y - drag.q.y; drag.moved = true;
    if (drag.kind === 'move') { it.x = Math.round(drag.x + dx); it.y = Math.round(drag.y + dy); } else { it.w = Math.max(4, Math.round(drag.w + dx)); it.h = Math.max(2, Math.round(drag.h + dy)); }
    draw(); for (const k of ['x', 'y', 'w', 'h']) { const f = $(`#pInspector [data-pf="${k}"]`); if (f) f.value = it[k]; } return;
  }
  const it = items().find(i => i.id === drag.id); if (!it) return;
  const d = frameFromEvent(e) - drag.x0; if (d !== 0) { if (!drag.checkpointed) { checkpoint(); drag.checkpointed = true; } drag.moved = true; } else return;
  let s = drag.start, l = drag.dur;
  if (drag.mode === 'move') s = clamp(drag.start + d, 0, proj.frames - 1); else if (drag.mode === 'r') l = clamp(drag.dur + d, 1, 1800); else { const ns = clamp(drag.start + d, 0, drag.start + drag.dur - 1); l = drag.start + drag.dur - ns; s = ns; }
  setTiming(it, s, l); ensureLength(s + l); renderTimeline(); draw();
  const a = $('#pInspector [data-pf="start"], #pInspector [data-pf="paper.start"]'), b = $('#pInspector [data-pf="dur"], #pInspector [data-pf="paper.dur"]'); if (a) a.value = s; if (b) b.value = l;
});
window.addEventListener('pointerup', () => {
  if (!drag) return;
  if (drag.kind === 'clip' || drag.kind === 'move' || drag.kind === 'resize') { if (!drag.moved && drag.kind !== 'clip') undoStack.pop(); if (drag.moved) changed(); else renderTimeline(); updateHistory(); if (drag.moved && drag.kind !== 'clip') renderInspector(); }
  drag = null;
});

// ------------------------------------------------------------------ templates
async function openTemplates() {
  pause();
  $('#pModalBody').innerHTML = `<h2>Pick a template.</h2><p>Each one is fully editable. Your current edit can be restored with Undo.</p><div class="p-tpl-grid">${TEMPLATE_LIST.map(t => `<button type="button" class="p-tpl" data-tpl="${t.key}"><canvas width="320" height="180"></canvas><b>${esc(t.label)}</b><span>${esc(t.hint)}</span></button>`).join('')}</div>`;
  $('#pCloseModal').textContent = 'Close'; $('#pModal').showModal();
  $$('#pModalBody [data-tpl]').forEach(b => b.onclick = () => { applyTemplate(b.dataset.tpl); $('#pModal').close(); });
  const big = document.createElement('canvas'); big.width = 1280; big.height = 720; const bx = big.getContext('2d');
  for (const b of $$('#pModalBody [data-tpl]')) {
    if (!$('#pModal').open) return;
    try { const p = PE.validatePaperProject(buildTemplate(b.dataset.tpl)); await loadFonts(PE.paperFontsUsed(p)); PE.bumpFonts(); PE.drawPaper(bx, 1280, 720, p, TEMPLATE_LIST.find(t => t.key === b.dataset.tpl).peek); b.querySelector('canvas').getContext('2d').drawImage(big, 0, 0, 320, 180); } catch { /* thumbnail is optional */ }
  }
}
function applyTemplate(key) {
  pause(); checkpoint(); adopt(PE.validatePaperProject(buildTemplate(key))); audioUI?.reset(); sel = null; frame = 0; lastView = null; saveLocal(); renderAll(); notify('Template loaded');
}

// ------------------------------------------------------------------ save, open, export
function download(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 30000); }
function modal(html) { $('#pModalBody').innerHTML = html; $('#pCloseModal').textContent = 'Close'; $('#pModal').showModal(); }
async function exportVideo() {
  if (exporting) return; pause();
  const snapshot = JSON.parse(snap()); snapshot.assets = registry; const exportName = fileBase();
  modal(exportMarkup({...snapshot, progressId:'pProgress', statusId:'pExportStatus'}));
  $('#pCloseModal').textContent = 'Cancel export'; exporting = true;
  const c = document.createElement('canvas'); c.width = snapshot.width; c.height = snapshot.height; const ec = c.getContext('2d');
  try {
    await loadFonts(PE.paperFontsUsed(snapshot)); PE.bumpFonts(); await document.fonts.ready; await PE.preloadImages(snapshot);
    const video = await exportMapVideo({ audio: getAudioSnapshot('paper'), canvas: c, fps: snapshot.fps, frames: snapshot.frames,
      draw: f => { PE.drawPaper(ec, c.width, c.height, snapshot, f); },
      cancelled: () => !exporting, progress: n => { $('#pProgress').value = n; $('#pExportStatus').textContent = `Rendering frame ${n} of ${snapshot.frames}`; } });
    if (!exporting) { $('#pExportStatus').textContent = 'Export cancelled.'; return; }
    download(video, exportName + '.webm'); $('#pExportStatus').textContent = 'All frames encoded. Download started.'; notify('Video exported');
  } catch (e) { $('#pExportStatus').textContent = e.name === 'AbortError' ? 'Export cancelled.' : 'Export failed: ' + e.message; }
  finally { exporting = false; $('#pCloseModal').disabled = false; $('#pCloseModal').textContent = 'Close'; draw(); }
}
function bindToolbar() {
  $('#pUndo').onclick = () => history('undo'); $('#pRedo').onclick = () => history('redo');
  $('#pSave').onclick = () => { download(new Blob([projectJson()], { type: 'application/json' }), fileBase() + '.framepaper.json'); notify('Project downloaded'); };
  $('#pOpen').onclick = () => $('#pProjectFile').click();
  $('#pProjectFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { if (f.size > 40e6) throw Error('Project is larger than 40 MB.'); const p = PE.validatePaperProject(JSON.parse(await f.text())); pause(); checkpoint(); adopt(p); audioUI?.reset(); sel = null; frame = 0; lastView = null; saveLocal(); renderAll(); notify('Paper project opened'); } catch (err) { notify(err.message); }
    e.target.value = '';
  };
  $('#pImageFile').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) loadPicture(f); };
  $('#pExport').onclick = exportVideo;
  $('#pSnapshot').onclick = () => { const c = document.createElement('canvas'); c.width = proj.width; c.height = proj.height; PE.drawPaper(c.getContext('2d'), c.width, c.height, proj, frame); c.toBlob(b => download(b, fileBase() + `-frame-${frame}.png`), 'image/png'); };
  $('#pPlay').onclick = play; $('#pStart').onclick = () => { pause(); setFrame(0); }; $('#pEnd').onclick = () => { pause(); setFrame(proj.frames - 1); };
  $('#pPrev').onclick = () => { pause(); setFrame(frame - 1); }; $('#pNext').onclick = () => { pause(); setFrame(frame + 1); };
  $('#pLoop').onclick = () => { loop = !loop; $('#pLoop').classList.toggle('active', loop); };
  $('#pFrame').onchange = e => { pause(); setFrame(Math.round(+e.target.value * proj.fps)); };
  $('#pZoomT').oninput = () => { renderTimeline(); setFrame(frame); };
  $('#pDuplicate').onclick = () => {
    if (audioUI?.duplicate()) return;
    const it = current(); if (!it || isSheet(it)) return; checkpoint();
    const c = JSON.parse(JSON.stringify(it)); c.id = crypto.randomUUID(); c.name += ' copy'; c.start = Math.min(proj.frames - 1, it.start + 10);
    if (!isShot(c)) { c.x += 24; c.y += 24; } ensureLength(c.start + c.dur); (isShot(it) ? proj.shots : proj.parts).push(c); sel = c.id; saveLocal(); renderAll();
  };
  $('#pDelete').onclick = () => {
    if (audioUI?.remove()) return;
    const it = current(); if (!it || isSheet(it)) return; checkpoint();
    proj.parts = proj.parts.filter(p => p.id !== it.id); proj.shots = proj.shots.filter(s => s.id !== it.id);
    for (const p of proj.parts) if (p.target === it.id) p.target = ''; for (const s of proj.shots) if (s.target === it.id) s.target = '';
    sel = null; saveLocal(); renderAll();
  };
  const z = d => () => { const it = current(); if (!it || isShot(it) || isSheet(it)) return; const i = proj.parts.indexOf(it), j = clamp(i + d, 0, proj.parts.length - 1); if (i === j) return; checkpoint(); proj.parts.splice(i, 1); proj.parts.splice(j, 0, it); saveLocal(); renderAll(); };
  $('#pUp').onclick = z(1); $('#pDown').onclick = z(-1);
  $('#pTemplates').onclick = openTemplates;
  $('#pNew').onclick = async () => { if (!await confirmStudio('Start an empty sheet? Your current edit can be restored with Undo.')) return; applyTemplate('blank'); };
  $('#pHelp').onclick = () => modal(`<h2>Make a newspaper animation.</h2><ol><li>Press <b>Templates</b> and pick a look: front page, breaking news, headline close-up, vintage extra, clipping or Bangla daily.</li><li>Click any part on the page (headline, photo, columns…) to edit its text, font, colors and how it appears.</li><li>Drag a part to move it, or drag its green corner to resize it. Use the <b>Add parts</b> buttons for banners, stamps, tickers, highlighter pens and more.</li><li>Click <b>Newspaper sheet</b> in the list to change the paper, folds, torn edges, tilt, background and how the sheet arrives (spin, slap, drop…).</li><li>Add <b>camera moves</b> to glide to a headline, push in on a photo or pull back. Drag bars on the timeline to retime them.</li><li>Press Space to preview, then <b>Export video</b>.</li></ol><p><b>Shortcuts:</b> Space play/pause · ← → one frame · Shift + arrows ten frames · Alt + arrows nudge a part · Delete remove · Ctrl/Cmd Z undo · F fullscreen</p>`);
  $('#pCloseModal').onclick = () => { if (exporting) { exporting = false; $('#pCloseModal').disabled = true; } else $('#pModal').close(); };
  $('#pModal').addEventListener('cancel', e => { if (exporting) { e.preventDefault(); exporting = false; } });
}

// ------------------------------------------------------------------ mode, shortcuts, fullscreen
const active = () => document.body.classList.contains('mode-paper');
const typing = () => ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
window.addEventListener('keydown', e => {
  if (!active() || $('#pModal').open || $('#pSettingsPanel').open || typing()) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); history(e.shiftKey ? 'redo' : 'undo'); return; }
  if (e.altKey && e.key.startsWith('Arrow')) {
    const it = current(); if (!it || isShot(it) || isSheet(it)) return; e.preventDefault(); checkpoint(); const n = e.shiftKey ? 10 : 1;
    if (e.key === 'ArrowLeft') it.x -= n; else if (e.key === 'ArrowRight') it.x += n; else if (e.key === 'ArrowUp') it.y -= n; else it.y += n; changed(); renderInspector(); return;
  }
  if (e.code === 'Space') { e.preventDefault(); play(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); pause(); setFrame(frame + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('#pDelete').click(); }
  else if (e.key.toLowerCase() === 'f' && !e.repeat && !e.ctrlKey && !e.metaKey) { e.preventDefault(); toggleFullscreen(); }
});
const fsRoot = $('#paperStudio'), fsButton = $('#pFullscreen');
async function toggleFullscreen() {
  try {
    if (document.fullscreenElement === fsRoot) await document.exitFullscreen();
    else if (!document.fullscreenElement) { if (!fsRoot.requestFullscreen) throw Error('Browser fullscreen API is unavailable'); await fsRoot.requestFullscreen(); }
    else notify('Exit the current fullscreen view first');
  } catch (err) { notify('Fullscreen unavailable: ' + (err?.message || String(err))); }
}
fsButton?.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const on = document.fullscreenElement === fsRoot;
  if (fsButton) { fsButton.textContent = on ? '⛶ Exit fullscreen' : '⛶ Fullscreen'; fsButton.title = on ? 'Exit fullscreen (Esc or F)' : 'Show paper fullscreen (F)'; }
  requestAnimationFrame(draw);
});
function onMode() { if (active()) { renderAll(); } else if (playing) pause(); }
window.addEventListener('frameflow:mode', onMode);

function renderAll() { renderSettings(); renderItems(); renderInspector(); renderTimeline(); setFrame(frame); updateHistory(); }

// ------------------------------------------------------------------ boot
try { const saved = localStorage.getItem(STORE); adopt(saved ? PE.validatePaperProject(JSON.parse(saved)) : PE.validatePaperProject(buildTemplate('front'))); } catch { adopt(PE.validatePaperProject(buildTemplate('front'))); }
buildStaticUI(); bindSettings(); bindToolbar(); $('#pHint').textContent = 'Click a part to edit it · drag to move · drag the green corner to resize · scrub the timeline to preview';
audioUI = registerAudioStudio('paper', {
  getSelected: () => sel, getFrame: () => frame, getFps: () => proj.fps, getFrames: () => proj.frames,
  select, pause, seek: setFrame, notify, updateHistory, visualCount: () => items().length,
  addGrid: '#pAddGrid', list: '#pItems', counter: '#pItemCount', inspector: '#pInspector', inspectorTitle: '#pInspTitle',
  trackLabels: '#pTrackLabels', trackRows: '#pTrackRows', tracks: '#pTracks', actionButtons: ['#pDuplicate', '#pDelete'],
});
PE.preloadImages(proj).then(() => draw());
renderAll(); onMode();