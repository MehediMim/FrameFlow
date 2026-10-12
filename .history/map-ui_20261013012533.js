// FrameFlow Map Studio: editor UI (animations, camera presets, timeline, playback, export).
import { THEMES, TEXTURES, DEFAULT_TEXTURE, LABEL_SHAPES, LABEL_WEIGHTS, DEFAULT_LABEL_STYLE, LABEL_PRESETS, TRAVEL_ICONS, labelStyleOf, mapFontsUsed, ACTION_TYPES, PRESETS, makeAction, makeShot, newMapProject, demoMapProject, validateMapProject, buildGeo, drawMap, screenToLonLat, countryAt, project as projectPoint, lonToX, latToY } from './map-engine.mjs';
import { CITIES, REGIONS } from './map-places.mjs';
import { loadFont, loadFonts, fontPickerHtml, bindFontPicker } from './engine.mjs';
import { exportMapVideo } from './map-video-export.mjs';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const canvas = $('#mCanvas'), ctx = canvas.getContext('2d');
const STORE = 'frameflow-map-v1';
const EASE_OPTS = [['easeInOut', 'Ease in & out'], ['linear', 'Linear'], ['easeIn', 'Ease in'], ['easeOut', 'Ease out'], ['backOut', 'Overshoot']];

let proj, sel = null, frame = 0, playing = false, loop = true, raf, startTime, startFrame;
let undoStack = [], redoStack = [], geo = null, geoState = 'idle', geoError = '', pick = null, exporting = false, lastView = null, drag = null;

// ------------------------------------------------------------------ helpers
const items = () => [...proj.shots].sort((a, b) => a.start - b.start).concat(proj.actions);
const current = () => items().find(i => i.id === sel);
const isShot = it => it.kind === 'shot';
const iconOf = it => (isShot(it) ? PRESETS[it.preset].icon : ACTION_TYPES[it.type].icon);
const clsOf = it => (isShot(it) ? 'shot' : it.type);
const planes = () => proj.actions.filter(a => a.type === 'plane');
const clone = o => JSON.parse(JSON.stringify(o));

function notify(s) {
  const t = $('#toast'); t.textContent = s; t.classList.add('show');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => t.classList.remove('show'), 2600); $('#mStatus').textContent = s;
}
function checkpoint() { undoStack.push(JSON.stringify(proj)); if (undoStack.length > 80) undoStack.shift(); redoStack = []; updateHistory(); }
function updateHistory() { $('#mUndo').disabled = !undoStack.length; $('#mRedo').disabled = !redoStack.length; }
function saveLocal() { try { localStorage.setItem(STORE, JSON.stringify(proj)); $('#mSaveState').textContent = 'Saved locally'; } catch { $('#mSaveState').textContent = 'Save project to keep changes'; } }
function changed() { saveLocal(); renderItems(); renderTimeline(); draw(); }
function history(dir) {
  pause();
  const from = dir === 'undo' ? undoStack : redoStack, to = dir === 'undo' ? redoStack : undoStack;
  if (!from.length) return;
  to.push(JSON.stringify(proj)); proj = JSON.parse(from.pop());
  if (!items().some(i => i.id === sel)) sel = null;
  frame = Math.min(frame, proj.frames - 1); saveLocal(); renderAll(); updateHistory();
}
function ensureLength(end) { if (end > proj.frames) { proj.frames = Math.min(1800, Math.ceil(end + 15)); $('#mDuration').value = proj.frames; } }

// ------------------------------------------------------------------ map data
async function ensureGeo() {
  if (geo || geoState === 'loading') return;
  geoState = 'loading'; draw();
  try {
    const [hi, lo] = await Promise.all(['countries-50m.json', 'countries-110m.json'].map(f => fetch('map-data/' + f).then(r => { if (!r.ok) throw Error(`${f}: HTTP ${r.status}`); return r.json(); })));
    geo = buildGeo(hi, lo); geoState = 'ready'; buildLists();
  } catch (e) { geoState = 'error'; geoError = e.message || String(e); }
  renderAll();
}
const cityKey = c => (geo && geo.byName.has(c[0]) ? `${c[0]} (city)` : c[0]);
function buildLists() {
  const opt = (v, l) => `<option value="${esc(v)}">${esc(l)}</option>`, countries = geo ? geo.names.map(n => opt(n, 'Country')).join('') : '', cities = CITIES.map(c => opt(cityKey(c), `City · ${c[3]}`)).join('');
  $('#mDlBorder').innerHTML = opt('All countries', 'Every border') + countries; $('#mDlCountry').innerHTML = countries;
  $('#mDlPlace').innerHTML = cities; $('#mDlAny').innerHTML = cities + countries;
}
const locText = l => (!l ? '' : l.kind === 'all' ? 'All countries' : l.kind === 'city' && geo && geo.byName.has(l.name) ? `${l.name} (city)` : l.name);
function parseLoc(text, kinds) {
  const t = text.trim(), low = t.toLowerCase();
  if (!t) return null;
  const wantCountry = ['border', 'country', 'any'].includes(kinds), wantPlace = ['place', 'any'].includes(kinds);
  if (kinds === 'border' && (low === 'all countries' || low === 'all')) return { kind: 'all', name: 'All countries' };
  if (wantCountry && geo) { const n = geo.names.find(x => x.toLowerCase() === low); if (n) return { kind: 'country', name: n }; }
  if (wantPlace) {
    const c = CITIES.find(c => cityKey(c).toLowerCase() === low) || CITIES.find(c => c[0].toLowerCase() === low);
    if (c) return { kind: 'city', name: c[0], lat: c[1], lon: c[2] };
    const m = t.match(/^(-?\d+(?:\.\d+)?)\s*[,;\s]\s*(-?\d+(?:\.\d+)?)$/);
    if (m && Math.abs(+m[1]) <= 90 && Math.abs(+m[2]) <= 180) return { kind: 'point', name: `${(+m[1]).toFixed(2)}, ${(+m[2]).toFixed(2)}`, lat: +m[1], lon: +m[2] };
  }
  return null;
}

// ------------------------------------------------------------------ drawing + playback
const seenFonts = new Set();
function syncFonts() { for (const n of mapFontsUsed(proj)) { if (seenFonts.has(n)) continue; seenFonts.add(n); loadFont(n).then(() => draw()); } }
function draw() {
  syncFonts();
  if (canvas.width !== proj.width || canvas.height !== proj.height) { canvas.width = proj.width; canvas.height = proj.height; }
  canvas.style.aspectRatio = `${proj.width}/${proj.height}`;
  if (!geo) {
    ctx.fillStyle = '#0d1b2a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9fb3c4'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(canvas.height / 30)}px Arial, sans-serif`;
    const msg = geoState === 'error' ? 'Map data could not be loaded' : 'Loading map…';
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
    if (geoState === 'error') { ctx.font = `${Math.round(canvas.height / 44)}px Arial, sans-serif`; ctx.fillText('Serve this folder over http (for example: python -m http.server 8000) and reload.', canvas.width / 2, canvas.height / 2 + canvas.height / 20); }
    return;
  }
  lastView = drawMap(ctx, proj.width, proj.height, proj, frame, geo);
}
function setFrame(n) {
  frame = clamp(Math.round(n) || 0, 0, proj.frames - 1);
  $('#mFrame').value = frame; $('#mFrame').max = proj.frames - 1;
  $('#mTimecode').textContent = [Math.floor(frame / proj.fps / 60), Math.floor(frame / proj.fps) % 60, frame % proj.fps].map(x => String(x).padStart(2, '0')).join(':');
  $('#mPlayhead').style.left = `${frame / (proj.frames - 1) * 100}%`;
  draw();
  window.dispatchEvent(new CustomEvent("ff-frame",{detail:{studio:"map",frame,fps:proj.fps,playing}}));
}
function pause() { playing = false; cancelAnimationFrame(raf); $('#mPlay').textContent = '▶'; window.dispatchEvent(new CustomEvent('ff-play',{detail:{studio:'map',playing:false,frame,fps:proj.fps}})); }
function play() {
  if (playing) { pause(); return; }
  if (frame >= proj.frames - 1) frame = 0;
  playing = true; startTime = performance.now(); startFrame = frame; $('#mPlay').textContent = 'Ⅱ'; window.dispatchEvent(new CustomEvent('ff-play',{detail:{studio:'map',playing:true,frame,fps:proj.fps}}));
  const tick = t => {
    let f = startFrame + Math.floor((t - startTime) / 1000 * proj.fps);
    if (f >= proj.frames) { if (loop) f %= proj.frames; else { setFrame(proj.frames - 1); pause(); return; } }
    setFrame(f); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ left panel
function buildStaticUI() {
  $('#mAddGrid').innerHTML = Object.entries(ACTION_TYPES).map(([k, a]) => `<button data-madd="${k}" title="${esc(a.hint)}"><b>${a.icon}</b>${a.label}</button>`).join('');
  $('#mPresets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button data-mpre="${k}" title="${esc(p.hint)}"><b>${p.icon}</b><span>${p.label}</span></button>`).join('');
  $$('[data-madd]').forEach(el => el.onclick = () => addAction(el.dataset.madd));
  $$('[data-mpre]').forEach(el => el.onclick = () => addShot(el.dataset.mpre));
  $('#mTheme').innerHTML = Object.entries(THEMES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');
  if (!$('#mTexture')) $('#mTheme').closest('label').insertAdjacentHTML('afterend', `
    <details open id="mTextureSection">
      <summary class="section-title">TEXTURE</summary>
      <label>Surface <select id="mTexture">${Object.entries(TEXTURES).map(([k, label]) => `<option value="${k}">${label}</option>`).join('')}</select></label>
      <label>Strength <span class="m-val" id="mTextureStrengthValue"></span><input aria-label="Texture strength" id="mTextureStrength" type="range" min="0" max="100" step="1"></label>
      <label>Scale <span class="m-val" id="mTextureScaleValue"></span><input aria-label="Texture scale" id="mTextureScale" type="range" min="50" max="300" step="10"></label>
    </details>`);
  $('#mRegion').innerHTML = Object.entries(REGIONS).map(([k, r]) => `<option value="${k}">${r.label}</option>`).join('') + '<option value="custom">Custom</option>';
}
function suggestTarget() {
  const c = current(), src = c && c.type ? c : [...proj.actions].reverse()[0];
  if (!src) return null;
  const t = src.type === 'border' || src.type === 'highlight' ? src.target : src.type === 'pin' ? src.place : src.type === 'plane' ? src.to : null;
  return t && t.kind !== 'all' ? clone(t) : null;
}
function addAction(type) {
  pause(); checkpoint();
  const a = makeAction(type, frame); ensureLength(a.start + a.dur);
  proj.actions.push(a); sel = a.id; saveLocal(); renderAll(); notify(`${ACTION_TYPES[type].label} added at frame ${frame}`);
}
function addShot(preset) {
  const needsPlane = PRESETS[preset].fields.includes('planeId');
  if (needsPlane && !planes().length) { notify('Add a Travel animation first'); return; }
  pause(); checkpoint();
  const c = current(), extra = {};
  const t = suggestTarget(); if (t) extra.target = t;
  if (needsPlane) extra.planeId = (c && c.type === 'plane' ? c : planes()[0]).id;
  const s = makeShot(preset, frame, extra); ensureLength(s.start + s.dur);
  proj.shots.push(s); sel = s.id; saveLocal(); renderAll(); notify(`${PRESETS[preset].label} camera added at frame ${frame}`);
}
function renderItems() {
  const its = items();
  $('#mItemCount').textContent = its.length;
  $('#mItems').innerHTML = its.length ? its.map(it => `<div class="m-item ${it.id === sel ? 'selected' : ''}" data-mid="${esc(it.id)}"><span class="type c-${clsOf(it)}">${iconOf(it)}</span><span class="name">${esc(it.name)}</span><span class="when">${it.start}</span></div>`).join('') : '<p class="muted m-empty">Nothing yet. Add an animation or a camera preset above.</p>';
  $$('[data-mid]').forEach(el => el.onclick = () => select(el.dataset.mid));
  $('#mDuplicate').disabled = $('#mDelete').disabled = !current();
}
function select(id) { sel = id; renderItems(); renderInspector(); renderTimeline(); }

// ------------------------------------------------------------------ inspector
const F = {
  text: (k, label, v, max = 80, ph = '') => `<label>${label}<input data-mf="${k}" data-t="text" maxlength="${max}" value="${esc(v ?? '')}" placeholder="${esc(ph)}"></label>`,
  num: (k, label, v, min, max, step = 1) => `<label>${label}<input data-mf="${k}" data-t="num" type="number" min="${min}" max="${max}" step="${step}" value="${Number((+v).toFixed(2))}"></label>`,
  range: (k, label, v, min, max, step, fmt = x => x) => `<label>${label} <span class="m-val">${fmt(v)}</span><input data-mf="${k}" data-t="range" type="range" min="${min}" max="${max}" step="${step}" value="${v}"></label>`,
  chk: (k, label, v) => `<label class="m-chk"><input type="checkbox" data-mf="${k}" data-t="chk" ${v ? 'checked' : ''}> ${label}</label>`,
  color: (k, label, v) => `<label class="color-row">${label}<input type="color" data-mf="${k}" data-t="color" value="${esc(v)}"></label>`,
  sel: (k, label, v, opts) => `<label>${label}<select data-mf="${k}" data-t="sel">${opts.map(([o, l]) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`,
  loc: (k, label, v, kinds) => {
    const dl = { border: 'mDlBorder', country: 'mDlCountry', place: 'mDlPlace', any: 'mDlAny' }[kinds];
    const hint = kinds === 'border' ? 'Country or All countries' : kinds === 'country' ? 'Country' : 'City or lat, lon';
    return `<div class="m-loc"><label>${label}<input data-mf="${k}" data-t="loc" data-kinds="${kinds}" list="${dl}" value="${esc(locText(v))}" placeholder="${hint}" autocomplete="off"></label><button type="button" data-mpick="${k}" data-kinds="${kinds}" title="Click the map to choose${kinds === 'any' ? ' (hold Shift for a whole country)' : ''}">⌖</button></div>`;
  },
};

function renderInspector() {
  const it = current(), box = $('#mInspector');
  if (!it) { box.innerHTML = '<p class="muted">Select an item in the timeline to edit it.<br><br>Add a <b>Border</b>, <b>Travel</b>, <b>Highlight</b> or <b>Pin</b>, then pick a camera preset. Presets move the camera for you.</p>'; $('#mInspTitle').textContent = 'Properties'; return; }
  const shot = isShot(it);
  $('#mInspTitle').textContent = shot ? 'Camera shot' : ACTION_TYPES[it.type].label;
  let h = `<div class="inspector-title"><span>${iconOf(it)}</span> <em id="mInspName">${esc(it.name)}</em></div>` + F.text('name', 'Name', it.name, 100);
  if (shot) h += F.sel('preset', 'Camera move', it.preset, Object.entries(PRESETS).map(([k, p]) => [k, p.label]));
  h += `<div class="two">${F.num('start', 'Start frame', it.start, 0, 1799)}${F.num('dur', 'Length (frames)', it.dur, 1, 1800)}</div>` + F.sel('easing', 'Motion', it.easing, EASE_OPTS);
  if (!shot) h += F.chk('keep', 'Stay on screen after it finishes', it.keep !== false);
  h += '<div class="section-title m-sep">' + (shot ? 'CAMERA' : 'LOOK') + '</div>';
  if (shot) h += shotFields(it); else h += actionFields(it) + labelFields(it);
  box.innerHTML = h; bindInspector(it);
}
function actionFields(a) {
  switch (a.type) {
    case 'border': return F.loc('target', 'Country', a.target, 'border') + F.color('color', 'Line color', a.color) + F.range('width', 'Line width', a.width, 1, 12, .5) + F.chk('glow', 'Glow', a.glow) + F.range('fillAlpha', 'Fill after drawing', a.fillAlpha, 0, .6, .02, x => Math.round(x * 100) + '%');
    case 'plane': return F.sel('icon', 'Icon', a.icon || 'plane', Object.entries(TRAVEL_ICONS).map(([k, i]) => [k, i.label])) + (a.icon === 'money' ? F.text('symbol', 'Coin symbol', a.symbol ?? '$', 4, '$  €  £  ৳  ₹  ¥') : '') + F.loc('from', 'From', a.from, 'place') + F.loc('to', 'To', a.to, 'place') + F.color('color', 'Trail color', a.color) + F.color('planeColor', 'Icon color', a.planeColor) + `<div class="two">${F.num('size', 'Icon size', a.size, 8, 80)}${F.num('lift', 'Arc height', a.lift, 0, 300)}</div>` + F.range('width', 'Trail width', a.width, 1, 12, .5) + F.chk('glow', 'Glow', a.glow) + F.chk('dashed', 'Dashed trail', a.dashed) + F.chk('showPath', 'Show planned route', a.showPath) + F.chk('showLabels', 'Show place names', a.showLabels) + (a.showLabels ? F.text('fromLabel', 'Start label text', a.fromLabel, 80, 'Uses the place name') + F.text('toLabel', 'End label text', a.toLabel, 80, 'Uses the place name') : '');
    case 'highlight': {
      const country = a.target.kind === 'country';
      return F.sel('__hmode', 'Highlight a', country ? 'country' : 'place', [['country', 'Country'], ['place', 'Place (radius)']]) + F.loc('target', country ? 'Country' : 'Place', a.target, country ? 'country' : 'place') + F.color('color', 'Color', a.color) + (country ? '' : F.num('radius', 'Radius (km)', a.radius, 5, 10000)) + F.range('dim', 'Dim the rest of the map', a.dim, 0, .85, .05, x => Math.round(x * 100) + '%') + F.chk('pulse', 'Pulse', a.pulse) + F.chk('showLabel', 'Show label', a.showLabel) + F.text('label', 'Label text', a.label, 60, 'Uses the place name');
    }
    case 'pin': return F.loc('place', 'Location', a.place, 'place') + F.color('color', 'Pin color', a.color) + F.range('size', 'Pin size', a.size, .5, 3, .1, x => x + '×') + F.chk('showLabel', 'Show label', a.showLabel) + F.text('label', 'Label text', a.label, 60, 'Uses the place name');
  }
  return '';
}
function shotFields(s) {
  const P = PRESETS[s.preset], has = k => P.fields.includes(k);
  let h = `<p class="mini-label">${esc(P.hint)}.</p>`;
  if (has('target')) h += F.loc('target', 'Target', s.target, 'any');
  if (has('autoFit') && s.target.kind === 'country') h += F.chk('autoFit', 'Fit the whole country in view', s.autoFit);
  if (has('planeId')) h += F.sel('planeId', 'Travel route', s.planeId, [['', 'Choose a route…'], ...planes().map(a => [a.id, `${a.name} (${a.from.name} → ${a.to.name})`])]);
  if (has('zoom') && !(has('autoFit') && s.autoFit && s.target.kind === 'country')) h += F.num('zoom', 'Zoom level', s.zoom, 1, 12, .1);
  if (has('amount')) h += F.num('amount', s.preset === 'pullBack' ? 'Zoom out by' : 'Zoom in by', s.amount, 0, 8, .1);
  if (has('degrees')) h += F.num('degrees', 'Rotate by (degrees)', s.degrees, -720, 720, 5);
  if (has('pitch')) h += F.range('pitch', 'Tilt', s.pitch, 0, 70, 1, x => x + '°');
  if (has('bearing')) h += F.num('bearing', 'Rotation (degrees)', s.bearing, -180, 180, 5);
  if (has('lockHeading')) h += F.chk('lockHeading', 'Turn with the icon', s.lockHeading);
  return h;
}

function bindInspector(it) {
  let gesture = false;
  $$('#mInspector [data-mf]').forEach(el => {
    const key = el.dataset.mf, t = el.dataset.t;
    const read = () => (t === 'chk' ? el.checked : t === 'num' ? Number(el.value) : el.value);
    if (t === 'range' || t === 'color') {
      el.oninput = () => {
        if (!gesture) { checkpoint(); gesture = true; }
        const v = t === 'range' ? Number(el.value) : el.value; it[key] = v;
        const out = el.parentElement.querySelector('.m-val'); if (out) out.textContent = key === 'pitch' ? v + '°' : key === 'size' ? v + '×' : ['fillAlpha', 'dim'].includes(key) ? Math.round(v * 100) + '%' : v;
        draw();
      };
      el.onchange = () => { gesture = false; changed(); };
      return;
    }
    el.onchange = () => {
      if (t === 'loc') {
        const loc = parseLoc(el.value, el.dataset.kinds);
        if (!loc) { notify('Not found. Type a city, a country, or "lat, lon"'); el.value = locText(it[key]); return; }
        checkpoint(); it[key] = loc; changed(); renderInspector(); return;
      }
      let v = read();
      checkpoint();
      if (key === 'name') { it.name = String(v).slice(0, 100) || 'Untitled'; changed(); const n = $('#mInspName'); if (n) n.textContent = it.name; return; }
      if (key === 'preset') { const old = PRESETS[it.preset].label, { dur, ...rest } = PRESETS[v].def; it.preset = v; Object.assign(it, rest); if (it.name === old) it.name = PRESETS[v].label; if (PRESETS[v].fields.includes('planeId') && !it.planeId) it.planeId = planes()[0]?.id || ''; changed(); renderInspector(); return; }
      if (key === 'icon') { const old = TRAVEL_ICONS[it.icon] || TRAVEL_ICONS.plane, nu = TRAVEL_ICONS[v]; if (!nu) return; if (it.planeColor === old.color) it.planeColor = nu.color; if (it.lift === old.lift) it.lift = nu.lift; if (['Travel', 'Plane', old.label].includes(it.name)) it.name = nu.label; it.icon = v; changed(); renderInspector(); return; }
      if (key === '__lscustom') { if (v) it.labelStyle = { ...labelStyleOf(proj) }; else delete it.labelStyle; changed(); renderInspector(); return; }
      if (key === '__hmode') { it.target = v === 'country' ? { kind: 'country', name: (lastView && geo && countryAt(geo, ...centerLonLat())) || 'Australia' } : { kind: 'city', name: 'Paris', lat: 48.8566, lon: 2.3522 }; changed(); renderInspector(); return; }
      if (t === 'num') {
        const lo = Number(el.min), hi = Number(el.max); v = clamp(Number.isFinite(v) ? v : lo, lo, hi);
        if (key === 'start' || key === 'dur') { v = Math.round(v); it[key] = v; ensureLength(it.start + it.dur); el.value = v; changed(); return; }
        el.value = v;
      }
      it[key] = v; changed(); if (key === 'autoFit' || key === 'showLabels') renderInspector();
    };
  });
  $$('#mInspector [data-mpick]').forEach(el => el.onclick = () => startPick(el.dataset.mpick, el.dataset.kinds));
  if (!isShot(it) && it.labelStyle) bindLabelStyle($('#mInspector'), 'mItemLbl', () => it.labelStyle, v => { it.labelStyle = v; }, () => renderInspector());
}
function centerLonLat() { const l = screenToLonLat(lastView, proj.width / 2, proj.height / 2); return l ? [l.lon, l.lat] : [0, 0]; }

// ------------------------------------------------------------------ label style (project-wide in Map settings, optional override per item)
function labelStyleHtml(st, pre) {
  const o = (v, l, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`;
  const num = (k, label, min, max, step) => `<label>${label}<input data-ls="${k}" data-t="num" type="number" min="${min}" max="${max}" step="${step}" value="${Number(st[k])}"></label>`;
  const chk = (k, label) => `<label class="m-chk"><input type="checkbox" data-ls="${k}" data-t="chk" ${st[k] ? 'checked' : ''}> ${label}</label>`;
  const color = (k, label) => `<label class="color-row">${label}<input type="color" data-ls="${k}" data-t="color" value="${esc(st[k])}"></label>`;
  const range = (k, label, min, max, step, fmt) => `<label>${label} <span class="m-val">${fmt(st[k])}</span><input data-ls="${k}" data-t="range" type="range" min="${min}" max="${max}" step="${step}" value="${st[k]}"></label>`;
  return `<label>Start from a style<select data-lspreset><option value="">Choose a preset…</option>${Object.entries(LABEL_PRESETS).map(([k, p]) => o(k, p.label, '')).join('')}</select></label>` +
    fontPickerHtml(pre + 'Font', 'Font', st.font) +
    `<div class="two"><label>Weight<select data-ls="weight" data-t="int">${LABEL_WEIGHTS.map(([w, l]) => o(w, l, st.weight)).join('')}</select></label>${num('size', 'Size', 6, 80, 1)}</div>` +
    `<label>Shape<select data-ls="shape" data-t="sel">${Object.entries(LABEL_SHAPES).map(([k, l]) => o(k, l, st.shape)).join('')}</select></label>` +
    chk('useTheme', 'Use the map style’s label colors') + (st.useTheme ? '' : color('text', 'Text color') + (st.shape === 'none' ? '' : color('bg', 'Background color') + range('bgAlpha', 'Background opacity', 0, 1, .05, x => Math.round(x * 100) + '%'))) +
    (st.shape === 'none' ? '' : `<div class="two">${num('borderW', 'Border width', 0, 8, .5)}${color('border', 'Border color')}</div>`) +
    range('spacing', 'Letter spacing', 0, 40, 1, x => x + '%') + chk('italic', 'Italic') + chk('caps', 'ALL CAPS') + chk('halo', 'Outline around text') + chk('shadow', 'Soft shadow');
}
/** Wires up the controls made by labelStyleHtml(); `get` returns the style object being edited, `replace` swaps it, `rerender` rebuilds the panel. */
function bindLabelStyle(root, pre, get, replace, rerender) {
  let gesture = false;
  bindFontPicker(pre + 'Font', n => { checkpoint(); get().font = n; changed(); });
  const preset = root.querySelector('[data-lspreset]');
  if (preset) preset.onchange = () => { const p = LABEL_PRESETS[preset.value]; if (!p) return; checkpoint(); replace({ ...DEFAULT_LABEL_STYLE, ...p.style }); changed(); rerender(); };
  root.querySelectorAll('[data-ls]').forEach(el => {
    const key = el.dataset.ls, t = el.dataset.t, val = () => (t === 'chk' ? el.checked : t === 'num' || t === 'range' ? Number(el.value) : t === 'int' ? Number(el.value) : el.value);
    if (t === 'range' || t === 'color') {
      el.oninput = () => { if (!gesture) { checkpoint(); gesture = true; } const v = val(); get()[key] = v; const out = el.parentElement.querySelector('.m-val'); if (out) out.textContent = key === 'spacing' ? v + '%' : Math.round(v * 100) + '%'; draw(); };
      el.onchange = () => { gesture = false; changed(); };
      return;
    }
    el.onchange = () => {
      let v = val(); checkpoint();
      if (t === 'num') { const lo = Number(el.min), hi = Number(el.max); v = clamp(Number.isFinite(v) ? v : lo, lo, hi); el.value = v; }
      get()[key] = v; changed(); if (key === 'useTheme' || key === 'shape') rerender();
    };
  });
}
function renderLabelPanel() {
  let box = $('#mLabelStyle');
  if (!box) { box = document.createElement('div'); box.id = 'mLabelStyle'; $('#mTheme').closest('label').after(box); }
  const wasOpen = box.querySelector('details')?.open;
  const st = labelStyleOf(proj);
  box.innerHTML = `<details ${wasOpen ? 'open' : ''}><summary class="section-title" style="cursor:pointer;margin:14px 0 10px">LABEL STYLE <span>Aa</span></summary><p class="mini-label">Applies to every place name, pin and highlight label. Pick a different style on any item to override it.</p>${labelStyleHtml(st, 'mProjLbl')}</details>`;
  bindLabelStyle(box, 'mProjLbl', () => (proj.labelStyle ||= { ...DEFAULT_LABEL_STYLE }), v => { proj.labelStyle = v; }, renderLabelPanel);
}
function labelFields(a) {
  if (!['plane', 'highlight', 'pin'].includes(a.type)) return '';
  return '<div class="section-title m-sep">LABEL STYLE</div>' + F.chk('__lscustom', 'Custom style for this label', !!a.labelStyle) + (a.labelStyle ? labelStyleHtml(labelStyleOf(proj, a), 'mItemLbl') : '<p class="mini-label">Using the project label style (Map settings → Label style).</p>');
}

// ------------------------------------------------------------------ pick a location on the map
function startPick(key, kinds) {
  pick = { key, kinds, id: sel }; canvas.style.cursor = 'crosshair'; $('#mHint').textContent = 'Click the map to choose a location · Esc to cancel';
  notify(kinds === 'any' ? 'Click the map (Shift+click picks a whole country)' : kinds === 'place' ? 'Click the map to choose a place' : 'Click a country');
}
function cancelPick() { pick = null; canvas.style.cursor = ''; $('#mHint').textContent = HINT; }
const HINT = 'Add animations on the left · camera presets move the view for you · scrub the timeline to preview';
canvas.onpointerdown = e => {
  if (!pick || !lastView || !geo) return;
  const b = canvas.getBoundingClientRect(), sx = (e.clientX - b.left) / b.width * proj.width, sy = (e.clientY - b.top) / b.height * proj.height, ll = screenToLonLat(lastView, sx, sy);
  if (!ll) { notify('Click on the map surface'); return; }
  const wantCountry = pick.kinds === 'border' || pick.kinds === 'country' || (pick.kinds === 'any' && e.shiftKey);
  let loc;
  if (wantCountry) {
    const n = countryAt(geo, ll.lon, ll.lat);
    if (!n) { notify('No country there. Try again'); return; }
    loc = { kind: 'country', name: n };
  } else {
    let best = null, bd = 18 * lastView.unit;
    for (const c of CITIES) {
      const X = lonToX(c[2]), p = projectPoint(lastView, X + Math.round(lastView.cx - X), latToY(c[1])), d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bd) { bd = d; best = c; }
    }
    loc = best ? { kind: 'city', name: best[0], lat: best[1], lon: best[2] } : { kind: 'point', name: `${ll.lat.toFixed(2)}, ${ll.lon.toFixed(2)}`, lat: +ll.lat.toFixed(4), lon: +ll.lon.toFixed(4) };
  }
  const it = items().find(i => i.id === pick.id);
  if (it) { checkpoint(); it[pick.key] = loc; changed(); renderInspector(); notify('Location set: ' + locText(loc)); }
  cancelPick();
};

// ------------------------------------------------------------------ project settings
function renderSettings() {
  $('#mProjectName').value = proj.name; $('#mFps').value = proj.fps; $('#mFpsLabel').textContent = proj.fps + ' FPS';
  $('#mDuration').value = proj.frames; $('#mSize').value = proj.width + ',' + proj.height; $('#mCompLabel').textContent = `${proj.width} × ${proj.height}`;
  $('#mTheme').value = proj.theme; $('#mGrat').checked = !!proj.graticule;
  const texture = { ...DEFAULT_TEXTURE, ...proj.texture };
  $('#mTexture').value = texture.type;
  $('#mTextureStrength').value = Math.round(texture.strength * 100);
  $('#mTextureScale').value = Math.round(texture.scale * 100);
  $('#mTextureStrengthValue').textContent = Math.round(texture.strength * 100) + '%';
  $('#mTextureScaleValue').textContent = texture.scale.toFixed(1) + '×';
  $('#mTextureStrength').disabled = $('#mTextureScale').disabled = texture.type === 'none';
  const i = proj.camera.init, match = Object.entries(REGIONS).find(([, r]) => r.lon === i.lon && r.lat === i.lat && r.zoom === i.zoom);
  $('#mRegion').value = match ? match[0] : 'custom'; $('#mStartZoom').value = i.zoom; $('#mStartPitch').value = i.pitch; $('#mStartBearing').value = i.bearing;
  $('#mGraticule').classList.toggle('active', !!proj.graticule);
  renderLabelPanel();
}
function bindSettings() {
  const edit = fn => e => { pause(); checkpoint(); fn(e.target); saveLocal(); renderAll(); };
  $('#mProjectName').onchange = edit(el => proj.name = el.value.trim().slice(0, 100) || 'Untitled map');
  $('#mFps').onchange = edit(el => proj.fps = +el.value);
  $('#mDuration').onchange = edit(el => { proj.frames = clamp(Math.round(+el.value) || 240, 2, 1800); frame = Math.min(frame, proj.frames - 1); });
  $('#mSize').onchange = edit(el => { const [w, h] = el.value.split(',').map(Number); proj.width = w; proj.height = h; });
  $('#mTheme').onchange = edit(el => proj.theme = el.value);
  $('#mTexture').onchange = edit(el => { proj.texture = { ...DEFAULT_TEXTURE, ...proj.texture, type: el.value }; });
  for (const [id, key, lo, hi] of [['mTextureStrength', 'strength', 0, 1], ['mTextureScale', 'scale', .5, 3]]) {
    let editing = false;
    $('#' + id).oninput = e => {
      pause(); if (!editing) { checkpoint(); editing = true; }
      proj.texture = { ...DEFAULT_TEXTURE, ...proj.texture, [key]: clamp(+e.target.value / 100, lo, hi) };
      $('#' + id + 'Value').textContent = key === 'strength' ? Math.round(proj.texture[key] * 100) + '%' : proj.texture[key].toFixed(1) + '×';
      draw();
    };
    $('#' + id).onchange = () => { editing = false; saveLocal(); renderSettings(); };
  }
  $('#mGrat').onchange = edit(el => proj.graticule = el.checked);
  $('#mGraticule').onclick = () => { checkpoint(); proj.graticule = !proj.graticule; saveLocal(); renderSettings(); draw(); };
  $('#mRegion').onchange = edit(el => { const r = REGIONS[el.value]; if (r) Object.assign(proj.camera.init, { lon: r.lon, lat: r.lat, zoom: r.zoom }); });
  $('#mStartZoom').onchange = edit(el => proj.camera.init.zoom = clamp(+el.value || 1, 0, 12));
  $('#mStartPitch').onchange = edit(el => proj.camera.init.pitch = clamp(+el.value || 0, 0, 70));
  $('#mStartBearing').onchange = edit(el => proj.camera.init.bearing = clamp(+el.value || 0, -180, 180));
}

// ------------------------------------------------------------------ timeline
function frameFromEvent(e) { const b = $('#mTracks').getBoundingClientRect(); return clamp(Math.round((e.clientX - b.left) / b.width * (proj.frames - 1)), 0, proj.frames - 1); }
function renderTimeline() {
  const zoom = +$('#mZoomT').value, its = items(), last = proj.frames - 1;
  $('#mTracks').style.width = `${zoom * 100}%`;
  const step = Math.max(1, Math.round(proj.frames / (10 * zoom)));
  let ticks = ''; for (let f = 0; f < proj.frames; f += step) ticks += `<span class="tick" style="left:${f / last * 100}%">${f}</span>`;
  $('#mRuler').innerHTML = ticks;
  $('#mTrackLabels').innerHTML = its.map(it => `<div class="track-label ${it.id === sel ? 'selected' : ''}" data-mtl="${esc(it.id)}"><span>${iconOf(it)}</span>${esc(it.name)}</div>`).join('');
  $('#mTrackRows').innerHTML = its.map(it => `<div class="track-row m-row ${it.id === sel ? 'selected' : ''}" data-mrow="${esc(it.id)}"><div class="m-clip t-${clsOf(it)} ${it.id === sel ? 'selected' : ''}" data-mclip="${esc(it.id)}" style="left:${it.start / last * 100}%;width:${Math.max(.6, it.dur / last * 100)}%" title="${esc(it.name)} · frame ${it.start}–${it.start + it.dur}"><i class="m-h l" data-h="l"></i><span>${esc(it.name)}</span><i class="m-h r" data-h="r"></i></div></div>`).join('');
  $('#mTrackLabels').style.transform = `translateY(-${$('#mScroll').scrollTop}px)`;
  $$('[data-mtl]').forEach(el => el.onclick = () => select(el.dataset.mtl));
  $$('[data-mclip]').forEach(el => el.onpointerdown = e => {
    e.preventDefault(); e.stopPropagation(); pause();
    const id = el.dataset.mclip, it = items().find(i => i.id === id); if (!it) return;
    if (sel !== id) { sel = id; renderItems(); renderInspector(); }
    checkpoint(); drag = { kind: 'clip', id, mode: e.target.dataset.h || 'move', x0: frameFromEvent(e), start: it.start, dur: it.dur, moved: false };
    renderTimeline();
  });
  $$('[data-mrow]').forEach(el => el.onpointerdown = e => { if (e.target.closest('[data-mclip]')) return; select(el.dataset.mrow); scrub(e); });
}
function scrub(e) { pause(); setFrame(frameFromEvent(e)); drag = { kind: 'scrub' }; }
window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.kind === 'scrub') { setFrame(frameFromEvent(e)); return; }
  const it = items().find(i => i.id === drag.id); if (!it) return;
  const d = frameFromEvent(e) - drag.x0; if (d !== 0) drag.moved = true;
  if (drag.mode === 'move') it.start = clamp(drag.start + d, 0, proj.frames - 1);
  else if (drag.mode === 'r') it.dur = clamp(drag.dur + d, 1, 1800);
  else { const ns = clamp(drag.start + d, 0, drag.start + drag.dur - 1); it.dur = drag.start + drag.dur - ns; it.start = ns; }
  ensureLength(it.start + it.dur);
  renderTimeline(); draw(); const s = $('#mInspector [data-mf="start"]'), l = $('#mInspector [data-mf="dur"]'); if (s) s.value = it.start; if (l) l.value = it.dur;
});
window.addEventListener('pointerup', () => { if (drag?.kind === 'clip') { if (!drag.moved) undoStack.pop(); changed(); updateHistory(); } drag = null; });
$('#mRuler').onpointerdown = scrub;
$('#mScroll').onscroll = () => $('#mTrackLabels').style.transform = `translateY(-${$('#mScroll').scrollTop}px)`;

// ------------------------------------------------------------------ save, open, export
function download(blob, name) { const u = URL.createObjectURL(blob), a = document.createElement('a'); a.href = u; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(u), 30000); }
const fileBase = () => (proj.name || 'map').replace(/[^a-z0-9 _-]/gi, '').trim() || 'map';
function modal(html) { $('#mModalBody').innerHTML = html; $('#mCloseModal').textContent = 'Close'; $('#mModal').showModal(); }

async function exportVideo() {
  if (exporting) return;
  pause();
  if (!geo) { notify('Map data is still loading'); return; }
  const snapshot = clone(proj), exportName = fileBase();
  modal(`<h2>Export your map.</h2><p>${snapshot.width} × ${snapshot.height} · ${snapshot.fps} FPS · ${(snapshot.frames / snapshot.fps).toFixed(2)} seconds</p><p>Every frame is encoded in order. Detailed maps may take longer than the video duration. Format: WebM.</p><p class="ff-export-note">Audio reference tracks are preview-only and will not appear in this video.</p><a class="support-link" href="https://www.supportkori.com/mehedimim" target="_blank" rel="noopener noreferrer">☕ Buy me a coffee ↗</a><progress id="mProgress" max="${snapshot.frames}" value="0"></progress><p id="mExportStatus">Preparing…</p>`);
  $('#mCloseModal').textContent = 'Cancel export'; exporting = true;
  const c = document.createElement('canvas'); c.width = snapshot.width; c.height = snapshot.height;
  const ec = c.getContext('2d');
  try {
    await loadFonts(mapFontsUsed(snapshot)); await document.fonts.ready;
    const video = await exportMapVideo({ canvas: c, fps: snapshot.fps, frames: snapshot.frames,
      draw: f => drawMap(ec, c.width, c.height, snapshot, f, geo),
      cancelled: () => !exporting,
      progress: n => { $('#mProgress').value = n; $('#mExportStatus').textContent = `Rendering frame ${n} of ${snapshot.frames}`; }
    });
    if (!exporting) { $('#mExportStatus').textContent = 'Export cancelled.'; return; }
    download(video, exportName + '.webm');
    $('#mExportStatus').textContent = 'All frames encoded. Download started.'; notify('Video exported');
  } catch (e) {
    $('#mExportStatus').textContent = e.name === 'AbortError' ? 'Export cancelled.' : 'Export failed: ' + e.message;
  } finally {
    exporting = false; $('#mCloseModal').disabled = false; $('#mCloseModal').textContent = 'Close';
  }
}

function bindToolbar() {
  $('#mUndo').onclick = () => history('undo'); $('#mRedo').onclick = () => history('redo');
  $('#mSave').onclick = () => { download(new Blob([JSON.stringify(proj, null, 2)], { type: 'application/json' }), fileBase() + '.framemap.json'); notify('Project downloaded'); };
  $('#mOpen').onclick = () => $('#mProjectFile').click();
  $('#mProjectFile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { if (f.size > 5e6) throw Error('Project is larger than 5 MB.'); const p = validateMapProject(JSON.parse(await f.text())); pause(); checkpoint(); proj = p; sel = null; frame = 0; saveLocal(); renderAll(); notify('Map project opened'); } catch (err) { notify(err.message); }
    e.target.value = '';
  };
  $('#mExport').onclick = exportVideo;
  $('#mSnapshot').onclick = () => { if (!geo) return; const c = document.createElement('canvas'); c.width = proj.width; c.height = proj.height; drawMap(c.getContext('2d'), c.width, c.height, proj, frame, geo); c.toBlob(b => download(b, fileBase() + `-frame-${frame}.png`), 'image/png'); };
  $('#mPlay').onclick = play; $('#mStart').onclick = () => { pause(); setFrame(0); }; $('#mEnd').onclick = () => { pause(); setFrame(proj.frames - 1); };
  $('#mPrev').onclick = () => { pause(); setFrame(frame - 1); }; $('#mNext').onclick = () => { pause(); setFrame(frame + 1); };
  $('#mLoop').onclick = () => { loop = !loop; $('#mLoop').classList.toggle('active', loop); };
  $('#mFrame').onchange = e => { pause(); setFrame(+e.target.value); };
  $('#mZoomT').oninput = () => { renderTimeline(); setFrame(frame); };
  $('#mDuplicate').onclick = () => {
    const it = current(); if (!it) return; checkpoint();
    const c = clone(it); c.id = crypto.randomUUID(); c.name += ' copy'; c.start = Math.min(proj.frames - 1, it.start + 10); ensureLength(c.start + c.dur);
    (isShot(it) ? proj.shots : proj.actions).push(c); sel = c.id; saveLocal(); renderAll();
  };
  $('#mDelete').onclick = () => {
    const it = current(); if (!it) return; checkpoint();
    proj.shots = proj.shots.filter(s => s.id !== it.id); proj.actions = proj.actions.filter(a => a.id !== it.id);
    for (const s of proj.shots) if (s.planeId === it.id) s.planeId = '';
    sel = null; saveLocal(); renderAll();
  };
  $('#mNew').onclick = () => { if (!confirm('Start an empty map? Your current edit can be restored with Undo.')) return; pause(); checkpoint(); proj = newMapProject(); sel = null; frame = 0; saveLocal(); renderAll(); };
  $('#mDemo').onclick = () => { if (!confirm('Load the demo map? Your current edit can be restored with Undo.')) return; pause(); checkpoint(); proj = demoMapProject(); sel = null; frame = 0; saveLocal(); renderAll(); };
  $('#mHelp').onclick = () => modal(`<h2>Make a map animation.</h2><ol><li>Press <b>Border</b>, <b>Travel</b>, <b>Highlight</b> or <b>Pin</b>. It is added at the playhead.</li><li>Choose the place in the right panel. Type a city or country, enter <i>lat, lon</i>, or press <b>⌖</b> and click the map.</li><li>Pick a <b>camera preset</b> (Fly to, Cinematic swoop, Orbit, Follow plane…). It moves the camera for you.</li><li>Drag bars on the timeline to retime them. Drag a bar's edges to change its length.</li><li>Press Space to preview, then <b>Export video</b>.</li></ol><p><b>Shortcuts:</b> Space play/pause · ← → one frame · Shift + arrows ten frames · Delete remove item · Ctrl/Cmd Z undo · Esc cancel map picking.</p>`);
  $('#mCloseModal').onclick = () => { if (exporting) { exporting = false; $('#mCloseModal').disabled = true; } else $('#mModal').close(); };
  $('#mModal').addEventListener('cancel', e => { if (exporting) { e.preventDefault(); exporting = false; } });
}

// ------------------------------------------------------------------ mode switch + shortcuts
function setMode(m) {
  document.body.classList.toggle('mode-map', m === 'map');
  $$('.modes [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  try { localStorage.setItem('frameflow-mode', m); } catch { /* ignore */ }
  window.dispatchEvent(new Event('frameflow:mode'));
  if (m === 'map') { ensureGeo(); renderAll(); } else pause();
}
$$('.modes [data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
window.addEventListener('keydown', e => {
  if (!document.body.classList.contains('mode-map')) return;
  if (e.key === 'Escape' && pick) { cancelPick(); return; }
  if ($('#mModal').open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); history(e.shiftKey ? 'redo' : 'undo'); return; }
  if (e.code === 'Space') { e.preventDefault(); play(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); pause(); setFrame(frame + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('#mDelete').click(); }
});

function renderAll() { renderSettings(); renderItems(); renderInspector(); renderTimeline(); setFrame(frame); updateHistory(); }

// Fullscreen the entire Map Studio root. This avoids fullscreen/layout conflicts
// with the nested grid and keeps playback controls available.
const mapFullscreenRoot = document.getElementById('mapStudio');
const mapFullscreenButton = document.getElementById('mapFullscreen');
async function toggleMapFullscreen() {
  try {
    if (document.fullscreenElement === mapFullscreenRoot) {
      await document.exitFullscreen();
    } else if (!document.fullscreenElement) {
      if (!mapFullscreenRoot.requestFullscreen) throw new Error('Browser fullscreen API is unavailable');
      await mapFullscreenRoot.requestFullscreen();
    } else {
      notify('Exit the current fullscreen view first');
    }
  } catch (error) {
    notify('Fullscreen unavailable: ' + (error?.message || String(error)));
  }
}
mapFullscreenButton?.addEventListener('click', toggleMapFullscreen);
document.addEventListener('fullscreenchange', () => {
  const active = document.fullscreenElement === mapFullscreenRoot;
  if (mapFullscreenButton) {
    mapFullscreenButton.textContent = active ? '⛶ Exit fullscreen' : '⛶ Fullscreen';
    mapFullscreenButton.title = active ? 'Exit fullscreen (Esc or F)' : 'Show map fullscreen (F)';
  }
  requestAnimationFrame(() => { draw(); });
});
window.addEventListener('keydown', event => {
  if (!document.body.classList.contains('mode-map') || event.key.toLowerCase() !== 'f' ||
      event.repeat || event.ctrlKey || event.altKey || event.metaKey || $('#mModal').open ||
      ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  event.preventDefault();
  toggleMapFullscreen();
});

// ------------------------------------------------------------------ boot
try { const saved = localStorage.getItem(STORE); proj = saved ? validateMapProject(JSON.parse(saved)) : demoMapProject(); } catch { proj = demoMapProject(); }
buildStaticUI(); buildLists(); bindSettings(); bindToolbar(); $('#mHint').textContent = HINT;
renderAll();
let startMode = 'motion'; try { startMode = localStorage.getItem('frameflow-mode') === 'map' ? 'map' : 'motion'; } catch { /* ignore */ }
setMode(startMode)
// Independent map-settings drawer: keep item properties visible in the inspector.
{
  const open = document.querySelector('#mSettingsButton');
  const panel = document.querySelector('#mSettingsPanel');
  const close = document.querySelector('#mSettingsClose');
  if (open && panel && close) {
    const setOpen = enabled => { panel.hidden = !enabled; open.setAttribute('aria-expanded', String(enabled)); };
    open.addEventListener('click', () => setOpen(panel.hidden));
    close.addEventListener('click', () => setOpen(false));
    window.addEventListener('keydown', e => { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });
    document.addEventListener('pointerdown', e => { if (!panel.hidden && !panel.contains(e.target) && !open.contains(e.target)) setOpen(false); });
  }
}