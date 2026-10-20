import { installTimelineControls } from './timeline-controls.mjs';
import { installCountryDetail, detailRegions, regionAt, citiesOf, drawRegionSelection, drawBorderEndpoints, BADGE_SHAPES, BADGE_STEMS, BADGE_EXITS, badgeOf, onBadgeImage, preloadBadges } from './map-engine.mjs?v=invert-1';
import { detailFileOf, detailInfo, detailLevelOf, LEGACY_REGION_COUNTRY } from './map-country-details.mjs';
import { detailCountriesOf, targetMembers, targetFeatures, combinedFeature, nearestBorderPosition, borderRingOf } from './map-regions.mjs';
import { OBJECT_ICONS, EFFECTS, SHAPES, OBJECT_ENTER, OBJECT_IDLE, OBJECT_EXIT } from './map-objects.mjs';
import { bindTimelineRename } from './timeline-rename.mjs?v=timeline-rename-2';
import { confirmStudio, exportMarkup } from './studio-ui.mjs?v=preview-controls-1';
import { getAudioSnapshot, registerAudioStudio } from './audio-reference.mjs?v=motion-media-1';
let audioUI = null;
// FrameFlow Map Studio: editor UI (animations, camera presets, timeline, playback, export).
import { THEMES, TEXTURES, DEFAULT_TEXTURE, LABEL_SHAPES, LABEL_WEIGHTS, DEFAULT_LABEL_STYLE, LABEL_PRESETS, TRAVEL_ICONS, labelStyleOf, mapFontsUsed, ACTION_TYPES, PRESETS, makeAction, makeShot, newMapProject, demoMapProject, validateMapProject, buildGeo, drawMap, screenToLonLat, countryAt, project as projectPoint, lonToX, latToY, DEFAULT_AREA, AREA_MODES, NEIGHBOR_MODES, PATH_CURVES, areaOf, drawPathEditor, pathHandles, imageryNeeds, PIN_MODES } from './map-engine.mjs?v=invert-1';
import { CITIES, REGIONS } from './map-places.mjs';
import { loadFont, loadFonts, fontPickerHtml, bindFontPicker } from './engine.mjs?v=sparse-blur-1';
import { exportMapVideo } from './map-video-export.mjs?v=invert-1';
import { createImagery, IMAGERY_SOURCES, DEFAULT_IMAGERY } from './map-imagery.mjs';
import { createRelief, reliefSettings, RELIEF_DEFAULTS } from './map-relief.mjs';
import { atlasLabelSettings } from './map-atlas-labels.mjs';
import { panMapCamera, zoomMapCamera } from './map-navigation.mjs?v=invert-1';
import { cameraAt, xToLon, yToLat, makeView } from './map-engine.mjs?v=invert-1';
import { retimeMapItem, animationKeysOf, setAnimationKey } from './map-timing.mjs';
import { cameraKeysOf, cameraPoseAt, putCameraKey, removeCameraKey, moveCameraKey, CAMERA_PROPERTIES, CAMERA_FIELDS } from './map-camera.mjs';
import { trimMapHistory } from './map-history.mjs';
let cameraProperty = 'all';

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const canvas = $('#mCanvas'), ctx = canvas.getContext('2d');
onBadgeImage(() => { if (!exporting && typeof draw === 'function' && proj) draw(); });
const STORE = 'frameflow-map-v1';
const EASE_OPTS = [['easeInOut', 'Ease in & out'], ['linear', 'Linear'], ['easeIn', 'Ease in'], ['easeOut', 'Ease out'], ['backOut', 'Overshoot']];

let proj, sel = null, frame = 0, playing = false, loop = true, raf, startTime, startFrame;
let undoStack = [], redoStack = [], geo = null, geoState = 'idle', geoError = '', pick = null, exporting = false, lastView = null, drag = null;
let pathDraw = null, pathDrag = null; // pathDraw = { id } while points of a travel path are being clicked on the map
let previewCamera = null, mapPan = null;

// ------------------------------------------------------------------ helpers
const items = () => [...proj.shots].sort((a, b) => a.start - b.start).concat(proj.actions);
const current = () => items().find(i => i.id === sel);
const isShot = it => it.kind === 'shot';
const iconOf = it => (isShot(it) ? PRESETS[it.preset].icon : ACTION_TYPES[it.type].icon);
const clsOf = it => (isShot(it) ? 'shot' : it.type);
const planes = () => proj.actions.filter(a => a.type === 'plane' || (a.type === 'object' && a.mode === 'path'));
const clone = o => JSON.parse(JSON.stringify(o));

function notify(s) {
  const t = $('#toast'); t.textContent = s; t.classList.add('show');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => t.classList.remove('show'), 2600); $('#mStatus').textContent = s;
}
function checkpoint() { undoStack.push(JSON.stringify(proj)); redoStack = []; trimMapHistory(undoStack, redoStack); updateHistory(); }
function updateHistory() { const a=audioUI?.historyState(); $('#mUndo').disabled = a?!a.undo:!undoStack.length; $('#mRedo').disabled = a?!a.redo:!redoStack.length; }
function saveLocal() { try { localStorage.setItem(STORE, JSON.stringify(proj)); $('#mSaveState').textContent = 'Saved locally'; } catch { $('#mSaveState').textContent = 'Save project to keep changes'; } }
function changed() { saveLocal(); renderItems(); renderTimeline(); draw(); }
function history(dir) {
  if (audioUI?.handlesHistory()) { audioUI.history(dir); return; }
  pause();
  const from = dir === 'undo' ? undoStack : redoStack, to = dir === 'undo' ? redoStack : undoStack;
  if (!from.length) return;
  to.push(JSON.stringify(proj)); proj = JSON.parse(from.pop());
  trimMapHistory(undoStack, redoStack);
  if (!items().some(i => i.id === sel)) sel = null;
  frame = Math.min(frame, proj.frames - 1); saveLocal(); renderAll(); updateHistory();
}
function ensureLength(end) {
  if (!Number.isSafeInteger(end) || end < 1) return false;
  if (end > proj.frames) { const padded = end + 15; proj.frames = Number.isSafeInteger(padded) ? padded : end; syncMapDuration(); }
  return true;
}

// ------------------------------------------------------------------ map data
async function ensureGeo() {
  if (geo || geoState === 'loading') return;
  geoState = 'loading'; draw();
  try {
    const [hi, lo] = await Promise.all(['countries-50m.json', 'countries-110m.json'].map(f => fetch('map-data/' + f).then(r => { if (!r.ok) throw Error(`${f}: HTTP ${r.status}`); return r.json(); })));
    geo = buildGeo(hi, lo); geo.cities = CITIES; geo.imagery = createImagery(); geo.relief = createRelief(); let tileDraw = 0; geo.relief.onTile = geo.imagery.onTile = () => { if (!tileDraw) tileDraw = requestAnimationFrame(() => { tileDraw = 0; if (!exporting) { draw(); updateTerrainStatus(); } }); }; geoState = 'ready'; buildLists();
  } catch (e) { geoState = 'error'; geoError = e.message || String(e); }
  renderAll();
}

// Country detail packs load on demand from map-data/<country>-detail.json (see map-country-details.mjs).
// To support a new country, add that file: nothing here needs to change.
const detailLoads = new Map();  // country -> Promise<boolean>. Kept after a failure so rendering cannot refetch in a loop; Retry clears it.
const detailErrors = new Map(); // country -> message, for a pack file that exists but could not be used
const noDetail = new Set();     // countries with no pack file: they simply stay plain country maps
const areaCountry = () => (areaOf(proj).mode === 'country' ? areaOf(proj).country : null);
const detailCountry = () => { const countries=detailCountriesOf(areaOf(proj)).filter(c=>!noDetail.has(c)); return countries.includes(areaOf(proj).country)?areaOf(proj).country:countries[0] || null; };
const isDetail = () => !!geo && detailRegions(proj,geo).length>0;
const localCities = () => geo ? [...new Map([...CITIES,...detailCountriesOf(areaOf(proj)).flatMap(c=>citiesOf(geo,c))].map(c=>[`${c[0]}:${c[3]}`,c])).values()] : CITIES;
// Which country's pack does a location need? Region targets saved before they carried a country were Bangladesh-only.
const regionCountryOf = t => (t?.kind === 'region' ? t.country || areaCountry() || LEGACY_REGION_COUNTRY : t?.kind === 'all' ? t.country || null : null);
function packCountries() { // packs the project needs to draw its regions
  const set = new Set(detailCountriesOf(areaOf(proj)));
  for (const it of [...proj.actions, ...proj.shots]) for (const target of [it.target, it.from, it.to, it.place]) for(const t of targetMembers(target)) { const c = regionCountryOf(t); if (c) set.add(c); }
  return [...set].filter(c => !noDetail.has(c));
}
const requiresDetail = () => packCountries().length > 0;
const wantedCountries = () => geo ? packCountries() : [];
function loadDetail(country) {
  if (geo.details?.has(country)) return Promise.resolve(true);
  if (detailLoads.has(country)) return detailLoads.get(country);
  detailErrors.delete(country);
  const task = (async () => {
    try {
      const r = await fetch(detailFileOf(country));
      const text = r.status === 404 ? '' : await r.text();
      if (r.status === 404 || /^\s*</.test(text)) { noDetail.add(country); buildLists(); renderAll(); return false; } // no pack for this country (or the server answered with a web page)
      if (!r.ok) throw Error('HTTP ' + r.status);
      const pack = JSON.parse(text);
      if (pack.country !== country) throw Error(`the file says "country": "${pack.country}" but it must say "${country}"`);
      installCountryDetail(geo, pack); buildLists(); renderAll(); return true;
    } catch (e) {
      detailErrors.set(country, e.message || String(e)); renderAreaSettings();
      notify(packCountries().includes(country) ? `${country} detail failed to load. Use Retry in map settings.` : 'Regional detail could not load. Route names will use country names.');
      return false;
    }
  })();
  detailLoads.set(country, task); return task;
}
async function ensureDetail() {
  if (!geo) return true;
  const results = await Promise.all(wantedCountries().map(loadDetail));
  return results.every(Boolean);
}
function defaultRegion() {
  const c = detailCountry(), list = geo ? detailRegions(proj,geo) : [], want = c && geo ? detailInfo(geo, c).defaultRegion : '';
  const f = list.find(f => f.key === want || f.name === want) || list[0];
  return f ? {kind:'region',name:f.key,country:f.country} : {kind:'country',name:areaOf(proj).country};
}
const cityKey = c => (geo && geo.byName.has(c[0]) ? `${c[0]} (city)` : c[0]);
function buildLists() {
  const opt = (v, l) => `<option value="${esc(v)}">${esc(l)}</option>`, countries = geo ? geo.names.map(n => opt(n, 'Country')).join('') : '', cities = localCities().map(c => opt(cityKey(c), `City · ${c[3]}`)).join('');
  const dc = detailCountry(), levelName = dc && geo ? Object.fromEntries(detailInfo(geo, dc).levels) : {};
  const regions = geo ? detailRegions(proj,geo).map(f => opt(f.key, levelName[f.level] || f.level)).join('') : '';
  $('#mDlBorder').innerHTML = opt('All countries','Every country border') + countries + (regions ? opt('All regions','Every regional border') + regions : ''); $('#mDlCountry').innerHTML = countries + regions;
  $('#mDlPlace').innerHTML = cities; $('#mDlAny').innerHTML = cities + countries + regions;
  const area = $('#mAreaCountry'); if (area) area.innerHTML = geo ? geo.names.map(n => opt(n, n)).join('') : '';
}
const locText = l => (!l ? '' : l.kind === 'regions' ? l.name : l.kind === 'all' ? (l.country ? 'All regions' : 'All countries') : l.kind === 'city' && geo && geo.byName.has(l.name) ? `${l.name} (city)` : l.name);
function parseLoc(text, kinds) {
  const t = text.trim(), low = t.toLowerCase();
  if (!t) return null;
  const wantCountry = ['border', 'country', 'any'].includes(kinds), wantPlace = ['place', 'any'].includes(kinds);
  if (kinds === 'border' && (low === 'all countries' || low === 'all')) return { kind: 'all', name: 'All countries' };
  if (wantCountry && geo && isDetail()) {
    const dc = detailCountry();
    if (kinds === 'border' && ['all regions','all'].includes(low)) return {kind:'all',name:'All regions',country:dc,level:detailLevelOf(geo, dc, areaOf(proj).detailLevel)};
    const f = detailRegions(proj,geo).find(f => f.key.toLowerCase() === low || f.name.toLowerCase() === low);
    if (f) return {kind:'region',name:f.key,country:f.country};
  }
  if (wantCountry && geo) { const n = geo.names.find(x => x.toLowerCase() === low); if (n) return { kind: 'country', name: n }; }
  if (wantPlace) {
    const c = localCities().find(c => cityKey(c).toLowerCase() === low) || localCities().find(c => c[0].toLowerCase() === low);
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
  if (!document.body.classList.contains('mode-map')) return;
  syncFonts();
  if (canvas.width !== proj.width || canvas.height !== proj.height) { canvas.width = proj.width; canvas.height = proj.height; }
  const ratio = `${proj.width} / ${proj.height}`; if (canvas.style.aspectRatio !== ratio) canvas.style.aspectRatio = ratio;
  if (!geo) {
    ctx.fillStyle = '#0d1b2a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#9fb3c4'; ctx.textAlign = 'center'; ctx.font = `600 ${Math.round(canvas.height / 30)}px Arial, sans-serif`;
    const msg = geoState === 'error' ? 'Map data could not be loaded' : 'Loading map…';
    ctx.fillText(msg, canvas.width / 2, canvas.height / 2);
    if (geoState === 'error') { ctx.font = `${Math.round(canvas.height / 44)}px Arial, sans-serif`; ctx.fillText('Serve this folder over http (for example: python -m http.server 8000) and reload.', canvas.width / 2, canvas.height / 2 + canvas.height / 20); }
    return;
  }
  lastView = drawMap(ctx, proj.width, proj.height, proj, frame, geo, previewCamera, { cacheBase: true });
  if (pick?.key === '__members') { const a = current(); if (a && regionTarget(a)) drawRegionSelection(ctx, lastView, geo, targetMembers(a.target)); }
  if(!playing&&current()?.visible!==false)drawBorderEndpoints(ctx,lastView,geo,current());
  $('#mResetView').hidden = !previewCamera;
  if (pathDraw) { const a = proj.actions.find(x => x.id === pathDraw.id); if (a) drawPathEditor(ctx, lastView, a); }
}
function setFrame(n) {
  if (pick?.kinds === 'cameraCenter' && Math.round(n) !== frame) cancelPick();
  if (!pathDraw && !pick) previewCamera = null;
  frame = clamp(Math.round(n) || 0, 0, proj.frames - 1);
  $('#mFrame').value = +(frame / proj.fps).toFixed(3); $('#mFrame').max = +((proj.frames - 1) / proj.fps).toFixed(3); $('#mFrame').step = '0.001';
  $('#mTimecode').textContent = [Math.floor(frame / proj.fps / 60), Math.floor(frame / proj.fps) % 60, frame % proj.fps].map(x => String(x).padStart(2, '0')).join(':');
  $('#mPlayhead').style.left = `${frame / (proj.frames - 1) * 100}%`;
  draw();
  if (current()?.preset === 'keyframed') { if (!playing) updateCameraInspector(current()); updateCameraKeySelection(); }
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
    if (f !== frame) if(f!==frame)setFrame(f); raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
}

// ------------------------------------------------------------------ left panel
// ---- several countries / regions on one Border or Highlight item (edited in its Properties)
const regionKey = t => `${t.kind}:${t.country || ''}:${t.name}`;
const regionTarget = a => ['country', 'region', 'regions'].includes(a?.target?.kind);
const memberLabel = t => (t.kind === 'region' && geo?.byName.get(t.name)?.name) || t.name;
const membersOf = a => (regionTarget(a) ? [...targetMembers(a.target)] : []);
function setMembers(a, members) {
  const list = members.map(({ label, ...t }) => t);
  a.target = list.length === 1 ? list[0] : { kind: 'regions', name: `${list.length} regions`, members: list };
  delete a.borderRing;
}
/** Adds a country / region to the item. With `toggle`, one already present is removed instead. Returns false when nothing changed. */
function addMember(a, loc, toggle) {
  const list = membersOf(a), i = list.findIndex(t => regionKey(t) === regionKey(loc));
  if (i >= 0) {
    if (!toggle) { notify(`${memberLabel(loc)} is already selected`); return false; }
    if (list.length === 1) { notify('Keep at least one region'); return false; }
    list.splice(i, 1);
  } else if (list.length >= 200) { notify('An item can hold up to 200 regions'); return false; }
  else list.push(loc);
  setMembers(a, list); return true;
}
/** "Separately": every selected region becomes its own item (same look and timing) that can then be retimed or partly animated on its own. */
function splitRegions(a) {
  const list = membersOf(a); if (list.length < 2) return;
  if (proj.actions.length + list.length - 1 > 200) { notify('A map can contain up to 200 items'); return; }
  pause(); checkpoint();
  const base = a.name, copies = list.slice(1).map(t => { const c = clone(a); c.id = crypto.randomUUID(); c.target = t; delete c.borderRing; c.name = `${base} · ${memberLabel(t)}`; return c; });
  a.target = list[0]; delete a.borderRing; a.name = `${base} · ${memberLabel(list[0])}`;
  proj.actions.splice(proj.actions.indexOf(a) + 1, 0, ...copies);
  changed(); renderInspector(); notify(`Split into ${list.length} separate items. Undo to combine them again.`);
}
function regionFields(a) {
  const list = membersOf(a), picking = pick?.key === '__members' && pick.id === a.id, border = a.type === 'border';
  return `<div class="m-regions"><span class="mini-label">${border ? 'Countries / regions' : isDetail() ? 'Regions / countries' : 'Countries'} <b class="m-val">${list.length}</b></span>`
    + `<div class="m-region-chips">${list.map((t, i) => `<button type="button" data-mrm="${i}" title="Remove from this item">${esc(memberLabel(t))} ×</button>`).join('')}</div>`
    + `<div class="m-loc"><label>Add another<input data-madd data-kinds="${border ? 'border' : 'country'}" list="${border ? 'mDlBorder' : 'mDlCountry'}" placeholder="Type a ${isDetail() ? 'region or country' : 'country'}" autocomplete="off"></label><button type="button" data-mregpick class="${picking ? 'active' : ''}" title="Click regions on the map to add or remove them (Shift-click = whole country)">⌖</button></div>`
    + (picking ? '<p class="mini-label">Click the map to add or remove regions. Shift-click picks a whole country. Press ⌖ or Esc when done.</p>' : '')
    + (isDetail() ? '' : '<p class="mini-label">For states, districts and other local regions, add that country under <button type="button" class="link" data-mopenset>Map settings → Country details</button>.</p>')
    + (list.length > 1 ? `<label>Several regions<select data-mcombine><option value="together" selected>Together as one region</option><option value="separate">Separately, as different regions</option></select></label><p class="mini-label">Together draws one outline around all of them. Separately makes one item per region, so each can be timed or partly animated on its own.</p>` : '')
    + '</div>';
}
function buildStaticUI() {
  $('#mAddGrid').innerHTML = Object.entries(ACTION_TYPES).filter(([, a]) => !a.hidden).map(([k, a]) => `<button data-madd="${k}" title="${esc(a.hint)}"><b>${a.icon}</b>${a.label}</button>`).join('');
  $('#mPresets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button data-mpre="${k}" title="${esc(p.hint)}"><b>${p.icon}</b><span>${p.label}</span></button>`).join('');
  $$('[data-madd]').forEach(el => el.onclick = () => addAction(el.dataset.madd));
  $$('[data-mpre]').forEach(el => el.onclick = () => addShot(el.dataset.mpre));
  $('#mTheme').innerHTML = Object.entries(THEMES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');
  $('#mImagery').innerHTML = Object.entries(IMAGERY_SOURCES).map(([k, x]) => `<option value="${k}">${x.label}</option>`).join('');
  if (!$('#mTexture')) $('#mImageryBox').insertAdjacentHTML('afterend', `
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
  const t = src.type === 'border' || src.type === 'highlight' ? src.target : ['pin', 'object', 'effect'].includes(src.type) ? src.place : src.type === 'plane' ? src.to : null;
  return t && t.kind !== 'all' ? clone(t) : null;
}
function addAction(type) {
  const dc = detailCountry();
  if (dc && !geo?.details?.has(dc)) { notify(detailErrors.has(dc) ? `${dc} detail could not load. Check map settings for Retry.` : `Loading ${dc} detail. Try again in a moment.`); return; }
  pause(); checkpoint();
  const a = makeAction(type, frame); if (!ensureLength(a.start + a.dur)) { notify('Choose an earlier start frame for this animation.'); return; }
  if (isDetail()) { if (type === 'border' || type === 'highlight') a.target = defaultRegion(); const cities = localCities(); const loc = c => ({kind:'city',name:c[0],lat:c[1],lon:c[2]}); if (['pin', 'object', 'effect'].includes(type) && cities.length) a.place = loc(cities[0]); if (type === 'plane' && cities.length > 1) { a.from=loc(cities[0]); a.to=loc(cities[1]); } }
  if (type === 'label') { const [lon, lat] = centerLonLat(); Object.assign(a, { labelPlacement: 'map', place: { kind: 'point', name: 'Map position', lon: ((lon + 180) % 360 + 360) % 360 - 180, lat }, offsetX: 0, offsetY: 0, labelStyle: { ...DEFAULT_LABEL_STYLE, ...LABEL_PRESETS.atlasGround.style } }); }
  proj.actions.push(a); sel = a.id; saveLocal(); renderAll(); notify(`${ACTION_TYPES[type].label} added at frame ${frame}`);
  if (type === 'shape') startPathDraw(a.id);
}
function addShot(preset) {
  const needsPlane = PRESETS[preset].fields.includes('planeId');
  if (needsPlane && !planes().length) { notify('Add a Travel animation first'); return; }
  pause(); checkpoint();
  const c = current(), extra = {};
  const t = suggestTarget(); if (t) extra.target = t;
  if (preset === 'keyframed') { extra.cameraFrom = captureCamera(); extra.cameraTo = { ...extra.cameraFrom }; }
  if (needsPlane) extra.planeId = (c && c.type === 'plane' ? c : planes()[0]).id;
  const s = makeShot(preset, frame, extra); if (!ensureLength(s.start + s.dur)) { notify('Choose an earlier start frame for this camera shot.'); return; }
  proj.shots.push(s); sel = s.id; saveLocal(); renderAll(); notify(`${PRESETS[preset].label} camera added at frame ${frame}`);
}
function captureCamera() {
  const c = previewCamera || cameraAt(proj, geo, proj.width, proj.height, frame);
  return { lon: clamp(xToLon(c.cx), -540, 540), lat: clamp(yToLat(c.cy), -85, 85), zoom: c.zoom, pitch: c.pitch, bearing: clamp(c.bearing, -3600, 3600) };
}
function renderItems() {
  const its = items();
  $('#mItemCount').textContent = its.length;
  $('#mItems').innerHTML = its.length ? its.map(it => `<div class="m-item ${it.id === sel ? 'selected' : ''}" data-mid="${esc(it.id)}"><span class="type c-${clsOf(it)}">${iconOf(it)}</span><span class="name">${esc(it.name)}</span><span class="when">${it.start}</span></div>`).join('') : '<p class="muted m-empty">Nothing yet. Add an animation or a camera preset above.</p>';
  $$('[data-mid]').forEach(el => el.onclick = () => select(el.dataset.mid));
  $('#mDuplicate').disabled = $('#mDelete').disabled = !current();
  audioUI?.renderList();
  updateMoveButtons();
}
/** Step the selected layer up or down the list. Camera shots follow their start time, so only animations and audio layers move. */
function moveItem(dir) {
  if (audioUI?.isSelected()) { if (typeof audioUI.move === 'function') audioUI.move(dir); return; }
  const it = current(); if (!it) return;
  if (isShot(it)) { notify('Camera shots are ordered by their start time'); return; }
  const list = proj.actions, i = list.indexOf(it), j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  pause(); checkpoint(); [list[i], list[j]] = [list[j], list[i]];
  saveLocal(); renderItems(); renderTimeline(); draw();
}
function updateMoveButtons() {
  let up = false, down = false;
  if (audioUI?.isSelected()) { if (typeof audioUI.canMove === 'function') { up = audioUI.canMove(-1); down = audioUI.canMove(1); } }
  else { const it = current(), i = it && !isShot(it) ? proj.actions.indexOf(it) : -1; up = i > 0; down = i >= 0 && i < proj.actions.length - 1; }
  $('#mMoveUp').disabled = !up; $('#mMoveDown').disabled = !down;
}
function select(id) { if (pathDraw && pathDraw.id !== id) endPathDraw(true); if (pick && pick.id !== id) cancelPick(); sel = id; renderItems(); renderInspector(); renderTimeline(); }

// ------------------------------------------------------------------ inspector
const F = {
  text: (k, label, v, max = 80, ph = '') => `<label>${label}<input data-mf="${k}" data-t="text" maxlength="${max}" value="${esc(v ?? '')}" placeholder="${esc(ph)}"></label>`,
  num: (k, label, v, min, max, step = 1) => `<label>${label}<input data-mf="${k}" data-t="num" type="number" min="${min}"${max === undefined ? '' : ` max="${max}"`} step="${step}" value="${Number((+v).toFixed(2))}"></label>`,
  range: (k, label, v, min, max, step, fmt = x => x) => `<label>${label} <span class="m-val">${fmt(v)}</span><input data-mf="${k}" data-t="range" type="range" min="${min}" max="${max}" step="${step}" value="${v}"></label>`,
  chk: (k, label, v) => `<label class="m-chk"><input type="checkbox" data-mf="${k}" data-t="chk" ${v ? 'checked' : ''}> ${label}</label>`,
  color: (k, label, v) => `<label class="color-row">${label}<input type="color" data-mf="${k}" data-t="color" value="${esc(v)}"></label>`,
  sel: (k, label, v, opts) => `<label>${label}<select data-mf="${k}" data-t="sel">${opts.map(([o, l]) => `<option value="${esc(o)}" ${o === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></label>`,
  loc: (k, label, v, kinds) => {
    const dl = { border: 'mDlBorder', country: 'mDlCountry', place: 'mDlPlace', any: 'mDlAny' }[kinds];
    const hint = kinds === 'border' ? (isDetail() ? 'Region or All regions' : 'Country or All countries') : kinds === 'country' ? (isDetail() ? 'Region' : 'Country') : 'City or lat, lon';
    return `<div class="m-loc"><label>${label}<input data-mf="${k}" data-t="loc" data-kinds="${kinds}" list="${dl}" value="${esc(locText(v))}" placeholder="${hint}" autocomplete="off"></label><button type="button" data-mpick="${k}" data-kinds="${kinds}" title="Click the map to choose${kinds === 'any' ? ' (hold Shift for a whole country)' : ''}">⌖</button></div>`;
  },
};

function renderInspector() {
  if (audioUI?.renderInspector()) return;
  const it = current(), box = $('#mInspector');
  if (!it) { box.innerHTML = '<p class="muted">Select an item in the timeline to edit it.<br><br>Add a <b>Border</b>, <b>Travel</b>, <b>Highlight</b> or <b>Pin</b>, then pick a camera preset. Presets move the camera for you.</p>'; $('#mInspTitle').textContent = 'Properties'; return; }
  const shot = isShot(it);
  $('#mInspTitle').textContent = shot ? 'Camera shot' : ACTION_TYPES[it.type].label;
  let h = `<div class="inspector-title"><span>${iconOf(it)}</span> <em id="mInspName">${esc(it.name)}</em></div>`;
  if (shot) h += F.sel('preset', 'Camera move', it.preset, Object.entries(PRESETS).map(([k, p]) => [k, p.label]));
  h += isShot(it) && it.preset === 'keyframed' ? F.sel('__cameraTrack', 'Keyframe property', cameraProperty, [['all', 'Camera - All properties'], ...Object.entries(CAMERA_PROPERTIES).map(([k,p]) => [k,p.label])]) : F.sel('__keyProperty', 'Keyframe property', 'animation', [['animation', 'Animation']]);
  h += '<p class="mini-label">' + (shot && it.preset === 'keyframed' ? 'Edit the camera at the playhead. Changes create keyframes automatically. Choose a property to see and retime its diamonds.' : 'The bar controls when this item appears and disappears. Drag the two centered diamonds to set when its animation starts and finishes.') + '</p>' + F.sel('easing', 'Motion', it.easing, EASE_OPTS);
  h += '<div class="section-title m-sep">' + (shot ? 'CAMERA' : 'LOOK') + '</div>';
  if (shot) h += shotFields(it); else h += actionFields(it) + labelFields(it);
  box.innerHTML = h; bindInspector(it);
}
function bannerFields(a) {
  return `<div class="m-badge"><span class="mini-label">Flag artwork</span><div class="two"><button type="button" data-badgeimg>${a.image ? 'Change image?' : 'Choose image?'}</button><button type="button" data-badgeclear ${a.image ? '' : 'disabled'}>Remove</button></div><input type="file" accept="image/*" data-badgefile hidden><p class="mini-label">Upload your artwork. The cloth hangs from a rigid crossbar and waves in the wind. Its proportions follow your uploaded image.</p>`
    + F.chk('bannerWind', 'Wind animation', a.bannerWind !== false)
    + F.range('bannerWindStrength', 'Wind strength', a.bannerWindStrength ?? .45, 0, 1, .05, x => Math.round(x * 100) + '%')
    + F.range('bannerWindSpeed', 'Wind speed', a.bannerWindSpeed ?? 1, .1, 3, .1, x => x.toFixed(1) + 'x')
    + F.range('bannerAspect', 'Cloth width / height', a.bannerAspect ?? .75, .35, 2.5, .05, x => x.toFixed(2))
    + F.color('color', 'Cloth background', a.color)
    + F.chk('bannerPole', 'Show wooden pole', a.bannerPole !== false)
    + F.color('bannerPoleColor', 'Wood color', a.bannerPoleColor || '#65503a')
    + F.chk('bannerPlaque', 'Show title plaque', a.bannerPlaque !== false)
    + F.text('bannerTitle', 'Plaque title', a.bannerTitle || '', 100, 'e.g. Richard Hakluyt') + '</div>';
}
function badgeFields(a) {
  const b = badgeOf(a);
  return `<div class="m-badge"><span class="mini-label">Picture</span><div class="two"><button type="button" data-badgeimg>${a.image ? 'Change image…' : 'Choose image…'}</button><button type="button" data-badgeclear ${a.image ? '' : 'disabled'}>Remove</button></div><input type="file" accept="image/*" data-badgefile hidden>${a.image ? '' : '<p class="mini-label">No picture yet. Choose a photo, logo or flag.</p>'}`
    + F.sel('badgeShape', 'Shape', b.badgeShape, Object.entries(BADGE_SHAPES))
    + (['polygon', 'star'].includes(b.badgeShape) ? F.range('badgeSides', b.badgeShape === 'star' ? 'Points' : 'Sides', b.badgeSides, 3, 12, 1) : '')
    + F.sel('badgeStem', 'Pointer to the location', b.badgeStem, Object.entries(BADGE_STEMS))
    + (b.badgeStem !== 'none' ? F.range('badgeStemLen', 'Pointer length', b.badgeStemLen, 0, 200, 1, x => x + ' px') : '')
    + F.sel('badgeExit', 'When the bar ends', b.badgeExit, Object.entries(BADGE_EXITS))
    + (b.badgeExit !== 'none' ? '<p class="mini-label">The exit plays during the last frames of this item\'s timeline bar (up to 18 frames).</p>' : '')
    + F.color('badgeBorder', 'Border color', b.badgeBorder) + F.range('badgeBorderW', 'Border width', b.badgeBorderW, 0, 20, .5)
    + F.color('badgeBg', 'Background (behind the picture)', b.badgeBg) + F.chk('badgeShadow', 'Shadow', b.badgeShadow)
    + (a.image ? F.range('badgeZoom', 'Zoom picture', b.badgeZoom, 1, 4, .05, x => x + '×') + F.range('badgeX', 'Move picture left / right', b.badgeX, -100, 100, 1) + F.range('badgeY', 'Move picture up / down', b.badgeY, -100, 100, 1) : '')
    + '</div>';
}
/** Shrinks a chosen picture so projects stay small enough to save. Returns a data URL. */
async function shrinkImage(file, max = 512) {
  if (!/^image\//.test(file.type)) throw Error('Choose an image file.');
  if (file.size > 15e6) throw Error('That image is larger than 15 MB.');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(Error('That image could not be read.')); i.src = url; });
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * k)); c.height = Math.max(1, Math.round(img.naturalHeight * k));
    const photo = file.type === 'image/jpeg'; if (photo) { const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); }
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    const out = c.toDataURL(photo ? 'image/jpeg' : 'image/png', .88);
    if (out.length > 1.9e6) throw Error('That image is too detailed. Try a smaller one.');
    return out;
  } finally { URL.revokeObjectURL(url); }
}
function objectPicker(glyph) {
  const options = group => Object.entries(OBJECT_ICONS).filter(([,icon]) => (icon.group || 'general') === group).map(([key,icon]) => `<option value="${key}" ${key === glyph ? 'selected' : ''}>${esc(icon.label)}</option>`).join('');
  return `<label>Object<select data-mf="glyph" data-t="sel"><optgroup label="Objects &amp; modern units">${options('general')}</optgroup><optgroup label="Exploration &middot; Age of Sail">${options('exploration')}</optgroup><optgroup label="Warfare &middot; 1500s&ndash;1600s">${options('warfare')}</optgroup></select></label>`;
}
function actionFields(a) {
  switch (a.type) {
    case 'label': return F.text('text', 'Text', a.text, 160, 'Your label') + F.sel('labelPlacement', 'Anchor', a.labelPlacement || 'screen', [['map', 'Geographic position'], ['screen', 'Canvas position']]) + (a.labelPlacement === 'map' ? F.loc('place', 'Position on map', a.place, 'place') + F.num('offsetX', 'Horizontal offset', a.offsetX ?? 0, -1000, 1000) + F.num('offsetY', 'Vertical offset', a.offsetY ?? 0, -1000, 1000) : F.num('x', 'Horizontal position (%)', a.x ?? 50, 0, 100) + F.num('y', 'Vertical position (%)', a.y ?? 15, 0, 100));
    case 'border': return (regionTarget(a) ? regionFields(a) : F.loc('target', 'Country / region', a.target, 'border') + '<p class="mini-label">Type a country or region to choose specific ones. You can then add more.</p>') + (regionTarget(a) && !a.borderPartial ? F.num('borderFrom','Border animation start (%)',a.borderFrom ?? 0,0,100,.1) + '<button type="button" data-borderpoint="borderFrom">Pick start on border</button>' + F.chk('borderReverse','Reverse direction',a.borderReverse) : '') + F.chk('borderPartial','Animate part of the border',a.borderPartial) + (a.borderPartial ? `<div class="two">${F.num('borderFrom','From (%)',a.borderFrom ?? 0,0,100,.1)}${F.num('borderTo','To (%)',a.borderTo ?? 100,0,100,.1)}</div><div class="two"><button type="button" data-borderpoint="borderFrom">Pick start on border</button><button type="button" data-borderpoint="borderTo">Pick end on border</button></div>` + F.chk('borderReverse','Reverse direction',a.borderReverse) + '<p class="mini-label">Click near the outline to set each endpoint. Start and end follow the same outline; each island has its own outline.</p>' : '') + F.color('color', 'Line color', a.color) + F.range('width', 'Line width', a.width, 1, 12, .5) + F.chk('glow', 'Glow', a.glow) + (a.borderPartial ? '' : F.range('fillAlpha', 'Fill after drawing', a.fillAlpha, 0, .6, .02, x => Math.round(x * 100) + '%')) + F.chk('invert', 'Invert (start fully drawn, then shrink away)', a.invert);
    case 'plane': return F.sel('icon', 'Icon', a.icon || 'plane', Object.entries(TRAVEL_ICONS).map(([k, i]) => [k, i.label])) + (a.icon === 'money' ? F.text('symbol', 'Coin symbol', a.symbol ?? '$', 4, '$  €  £  ৳  ₹  ¥') : '') + F.sel('mode', 'Travel along', a.mode === 'path' ? 'path' : 'direct', [['direct', 'Start → end (flight arc)'], ['path', 'My own path (draw points)']]) + (a.mode === 'path' ? pathFields(a) : F.loc('from', 'From', a.from, 'place') + F.loc('to', 'To', a.to, 'place')) + F.color('color', 'Trail color', a.color) + F.color('planeColor', 'Icon color', a.planeColor) + `<div class="two">${F.num('size', 'Icon size', a.size, 8, 80)}${F.num('lift', 'Arc height', a.lift, 0, 300)}</div>` + F.range('width', 'Trail width', a.width, 1, 12, .5) + F.chk('glow', 'Glow', a.glow) + F.chk('dashed', 'Dashed trail', a.dashed) + F.chk('showPath', 'Show planned route', a.showPath) + (a.mode === 'path' ? F.chk('showWaypoints', 'Show path points', a.showWaypoints !== false) : '') + F.chk('showLabels', 'Show place names', a.showLabels) + (a.showLabels ? F.text('fromLabel', 'Start label text', a.fromLabel, 80, 'Uses the place name') + F.text('toLabel', 'End label text', a.toLabel, 80, 'Uses the place name') : '') + routeLabelFields(a);
    case 'highlight': {
      const country = ['country','region','regions'].includes(a.target.kind);
      return F.sel('__hmode', 'Highlight a', country ? 'country' : 'place', [['country', isDetail() ? 'Region' : 'Country'], ['place', 'Place (radius)']]) + (country ? regionFields(a) + '<div class="section-title">FILL START POINT</div>' + F.loc('highlightOrigin', 'Highlight fill starts from', a.highlightOrigin, 'place') + '<button type="button" data-highlight-reset>Reset to region center</button><p class="mini-label">Pick a point on the map or enter latitude, longitude. The fill spreads outward from this point.</p>' : F.loc('target', 'Place', a.target, 'place')) + (country && THEMES[proj.theme]?.relief ? F.color('reliefColor', 'Highlight color', a.reliefColor || reliefSettings(proj.terrain).highlightColor) + F.range('reliefOpacity', 'Highlight opacity', a.reliefOpacity ?? reliefSettings(proj.terrain).highlightOpacity, 0, 1, .05, x => Math.round(x * 100) + '%') : F.color('color', 'Color', a.color)) + (country ? '' : F.num('radius', 'Radius (km)', a.radius, 5, 10000)) + F.range('dim', 'Dim the rest of the map', a.dim, 0, .85, .05, x => Math.round(x * 100) + '%') + F.chk('pulse', 'Pulse', a.pulse) + F.chk('invert', 'Invert (start fully shown, then shrink away)', a.invert) + F.chk('showLabel', 'Show label', a.showLabel) + F.text('label', 'Label text', a.label, 60, 'Uses the place name');
    }
    case 'object': return objectPicker(a.glyph) + F.num('count', 'Count', a.count ?? 1, 1, 100, 1) + '<div class="two">' + F.num('gapX', 'Horizontal gap', a.gapX ?? (a.glyph === 'banner' ? 160 : a.glyph === 'image' ? 104 : 64), 0, 1000, 1) + F.num('gapY', 'Vertical gap', a.gapY ?? (a.glyph === 'banner' ? 160 : a.glyph === 'image' ? 104 : 64), 0, 1000, 1) + '</div><p class="mini-label">Distance between object centers in pixels at 1? size. Applies when Count is greater than 1.</p>' + F.sel('__pinMove', 'Position', a.mode || 'stay', Object.entries(PIN_MODES)) + (a.mode === 'path' ? pathFields(a) : F.loc('place', a.mode === 'move' ? 'From' : 'Location', a.place, 'place') + (a.mode === 'move' ? F.loc('to', 'To', a.to, 'place') : '')) + (['move', 'path'].includes(a.mode) ? F.chk('trail', 'Draw a trail behind it', a.trail !== false) : '') + (a.glyph === 'image' ? badgeFields(a) : a.glyph === 'banner' ? bannerFields(a) : F.color('color', 'Color', a.color)) + F.range('size', 'Size', a.size, .4, 4, .1, x => x + '×') + (a.glyph === 'image' ? '' : F.sel('enter', 'Appears', a.enter, OBJECT_ENTER) + F.sel('idle', 'While visible', a.idle, OBJECT_IDLE) + F.sel('exit', 'Disappears', a.exit, OBJECT_EXIT)) + F.chk('showLabel', 'Show label', a.showLabel) + (a.showLabel ? F.text('label', 'Label text', a.label, 60, 'Uses the default name') : '');
    case 'effect': return F.sel('fx', 'Effect', a.fx, Object.entries(EFFECTS).map(([k, e]) => [k, e.label])) + (a.fx === 'strike' ? F.loc('from', 'Launch from', a.from, 'place') + F.loc('place', 'Target', a.place, 'place') : F.loc('place', 'Location', a.place, 'place')) + F.color('color', 'Color', a.color) + F.range('size', 'Size', a.size, .4, 6, .1, x => x + '×') + (['explosion', 'shockwave', 'quake', 'strike'].includes(a.fx) ? F.num('repeat', 'Repeat', a.repeat || 1, 1, 10, 1) : '') + F.chk('showLabel', 'Show label', a.showLabel) + (a.showLabel ? F.text('label', 'Label text', a.label, 60, 'Uses the default name') : '');
    case 'shape': return F.sel('shape', 'Shape', a.shape, Object.entries(SHAPES).map(([k, s]) => [k, s.label])) + pathFields(a) + F.color('color', 'Color', a.color) + F.range('width', 'Line width', a.width, 1, 16, .5) + (['zone', 'noFly'].includes(a.shape) ? F.range('fillAlpha', 'Fill', a.fillAlpha, 0, .8, .02, x => Math.round(x * 100) + '%') : '') + F.chk('showLabel', 'Show label', a.showLabel) + (a.showLabel ? F.text('label', 'Label text', a.label, 60, 'e.g. 3rd Army advance') : '');
    case 'pin': {
      const display = a.badge ? 'badge' : a.showIcon === false ? 'text' : a.showLabel ? 'both' : 'icon';
      const mv = a.mode === 'move' || a.mode === 'path' ? a.mode : 'stay', ownColor = a.badge || a.showIcon === false;
      return F.sel('__pinMove', 'Position', mv, Object.entries(PIN_MODES)) + (mv === 'stay' ? F.loc('place', 'Location', a.place, 'place') : mv === 'move' ? F.loc('place', 'From', a.place, 'place') + F.loc('to', 'To', a.to, 'place') + '<p class="mini-label">It travels for the animation duration above, then stays at the end until the bar ends.</p>' : pathFields(a))
        + (mv !== 'stay' ? F.chk('trail', 'Draw a trail behind it', a.trail !== false) + (ownColor ? F.color('color', 'Trail color', a.color) : '') : '')
        + F.sel('__pinDisplay', 'Display', display, [['both', 'Icon + text'], ['icon', 'Icon only'], ['text', 'Text only'], ...(a.badge ? [['badge', 'Image badge (legacy)']] : [])])
        + (display === 'badge' ? '<button type="button" data-imageobject>Move image to Objects</button>' + badgeFields(a) + F.chk('showLabel', 'Show label', a.showLabel) : (a.showIcon !== false ? F.color('color', 'Pin color', a.color) : ''))
        + (a.showIcon !== false || a.badge ? F.range('size', a.badge ? 'Badge size' : 'Pin size', a.size, .5, 3, .1, x => x + '×') : '')
        + (a.showLabel ? F.text('label', 'Label text', a.label, 60, 'Uses the place name') : '')
        + (a.badge && a.showLabel ? F.range('badgeLabelY', 'Label position', badgeOf(a).badgeLabelY, -100, 300, 5, x => x + '%') + '<p class="mini-label">Label font, shape and colors: use Custom style for this label below. Try the Black ribbon preset.</p>' : '');
    }
  }
  return '';
}
function routeLabelFields(a) {
  return F.chk('showRouteLabels', 'Show route region / country names', a.showRouteLabels) + (a.showRouteLabels ?
    F.sel('routeLabelMode', 'Route names', a.routeLabelMode || 'auto', [['auto', 'Auto regions / countries'], ['country', 'Countries'], ['region', 'Regions']]) +
    '<p class="mini-label">Names appear when the traveler enters each region or country. Region names use the chosen map boundary level; countries are used where regional data is unavailable.</p>' : '');
}
// ------------------------------------------------------------------ travel along a drawn path
const km = (a, b) => { const R = 6371, r = Math.PI / 180, dl = (b.lat - a.lat) * r, dn = (b.lon - a.lon) * r, h = Math.sin(dl / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dn / 2) ** 2; return 2 * R * Math.asin(Math.min(1, Math.sqrt(h))); };
/** A named place for a clicked point: the closest built-in city within 60 km, otherwise plain coordinates. */
function placeAt(p) {
  let best = null, bd = 60;
  for (const c of localCities()) { const d = km(p, { lat: c[1], lon: c[2] }); if (d < bd) { bd = d; best = c; } }
  return best ? { kind: 'city', name: best[0], lat: p.lat, lon: p.lon } : { kind: 'point', name: `${p.lat.toFixed(2)}, ${p.lon.toFixed(2)}`, lat: p.lat, lon: p.lon };
}
/** Keeps From / To equal to the first and last point, so labels and camera shots that name the route keep working. */
function syncPathEnds(a) { const p = a.path || []; if (p.length) { a.from = placeAt(p[0]); a.to = placeAt(p[p.length - 1]); if (a.type === 'pin') a.place = a.from; } }
function pathFields(a) {
  const pts = a.path || [], drawing = pathDraw?.id === a.id;
  return F.sel('curve', 'Path shape', a.curve === 'straight' ? 'straight' : 'smooth', Object.entries(PATH_CURVES)) +
    `<div class="m-path-actions"><button type="button" data-mpath="draw" class="${drawing ? 'active' : ''}" title="Click the map to add points. Drag a point to move it. Alt+click removes it.">${drawing ? '✓ Finish drawing' : '✎ Draw path on map'}</button>` +
    `<button type="button" data-mpath="undo" ${pts.length ? '' : 'disabled'} title="Remove the last point">↶ Last point</button>` +
    `<button type="button" data-mpath="reverse" ${pts.length > 1 ? '' : 'disabled'} title="Travel the path the other way">⇄ Reverse</button>` +
    `<button type="button" data-mpath="clear" ${pts.length ? '' : 'disabled'} title="Remove every point">Clear</button></div>` +
    (pts.length ? `<ol class="m-wps">${pts.map((p, i) => `<li><b>${i + 1}</b><span title="${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}">${esc(placeAt(p).name)}</span><button type="button" data-mwdel="${i}" title="Remove this point" aria-label="Remove point ${i + 1}">✕</button></li>`).join('')}</ol>` : '') +
    `<p class="mini-label">${drawing ? 'Click to add points · drag a point to move it · right-drag or middle-drag to pan · scroll to zoom · Alt+click removes a point · Enter when done.' : pts.length < 2 ? 'Press “Draw path on map”, then click at least two points. They are used in order.' : `${pts.length} points. They are used in order.`}</p>`;
}
function startPathDraw(id) {
  cancelPick(); pause(); pathDraw = { id }; canvas.style.cursor = 'crosshair';
  $('#mHint').textContent = 'Click to add points · right-drag or middle-drag to pan · scroll to zoom · Enter to finish';
  notify('Click the map to add points to the path'); renderInspector(); draw();
}
function endPathDraw(silent) {
  if (!pathDraw) return;
  const a = proj.actions.find(x => x.id === pathDraw.id); pathDraw = null; pathDrag = null; canvas.style.cursor = ''; $('#mHint').textContent = HINT;
  if (a) syncPathEnds(a);
  saveLocal(); if (!silent) { renderInspector(); renderItems(); }
  draw();
}
function pathAction(a, what) {
  if (what === 'draw') { if (pathDraw?.id === a.id) { endPathDraw(); notify('Path ready'); } else startPathDraw(a.id); return; }
  if (!(a.path || []).length) return;
  checkpoint();
  if (what === 'undo') a.path.pop(); else if (what === 'clear') a.path = []; else if (what === 'reverse') a.path.reverse();
  syncPathEnds(a); changed(); renderInspector();
}
const cameraEditFrame = s => clamp(frame, s.start, s.start + s.dur);
const cameraTrackFields = () => CAMERA_PROPERTIES[cameraProperty]?.fields || Object.keys(CAMERA_FIELDS);
function updateCameraInspector(s) {
  const at = cameraEditFrame(s), pose = cameraPoseAt(s, at), key = cameraKeysOf(s).find(k => k.frame === at), disabled = frame < s.start || frame > s.start + s.dur;
  $$('#mInspector [data-camera-field]').forEach(el => { el.disabled = disabled; if (el !== document.activeElement) el.value = +pose[el.dataset.cameraField].toFixed(3); });
  $$('#mInspector [data-camera-toggle]').forEach(el => {
    const fields = CAMERA_PROPERTIES[el.dataset.cameraToggle]?.fields || Object.keys(CAMERA_FIELDS), keyed = fields.every(f => key?.values[f] !== undefined);
    el.disabled = disabled; el.classList.toggle('current', keyed);
    const text = (keyed ? '\u25c6' : '\u25c7') + (el.dataset.cameraToggle === 'all' ? ' Camera keyframe' : '');
    if (el.textContent !== text) el.textContent = text;
  });
  $$('#mInspector [data-camera-view], #mInspector [data-camera-center-pick], #mInspector [data-camera-center-view]').forEach(el => el.disabled = disabled);
  const label = $('#mInspector [data-camera-playhead]'), text = disabled ? 'Move the playhead inside this camera bar to edit.' : 'At playhead - frame ' + at;
  if (label && label.textContent !== text) label.textContent = text;
}
function bindCameraInspector(s) {
  if (s.preset !== 'keyframed') return;
  $$('#mInspector [data-camera-field]').forEach(el => el.onchange = () => {
    const field = el.dataset.cameraField, value = Number(el.value);
    if (!Number.isFinite(value)) { renderInspector(); return; }
    pause(); checkpoint();
    const at = cameraEditFrame(s), pose = cameraPoseAt(s, at);
    const fields = field === 'lon' || field === 'lat' ? ['lon', 'lat'] : [field];
    const values = Object.fromEntries(fields.map(f => [f, pose[f]]));
    values[field] = clamp(value, ...CAMERA_FIELDS[field]);
    putCameraKey(s, at, values); previewCamera = null; changed(); renderInspector();
  });
  $$('#mInspector [data-camera-toggle]').forEach(el => el.onclick = () => {
    pause(); checkpoint();
    const fields = CAMERA_PROPERTIES[el.dataset.cameraToggle]?.fields || Object.keys(CAMERA_FIELDS), at = cameraEditFrame(s);
    const pose = cameraPoseAt(s, at), key = cameraKeysOf(s).find(k => k.frame === at);
    if (fields.every(f => key?.values[f] !== undefined)) removeCameraKey(s, at, fields);
    else putCameraKey(s, at, Object.fromEntries(fields.map(f => [f, pose[f]])));
    previewCamera = null; changed(); renderInspector();
  });
  $$('#mInspector [data-camera-nav]').forEach(el => el.onclick = () => {
    const keys = cameraKeysOf(s).filter(k => Object.keys(k.values).some(f => cameraTrackFields().includes(f))).sort((a,b) => a.frame - b.frame);
    const key = +el.dataset.cameraNav < 0 ? keys.filter(k => k.frame < frame).at(-1) : keys.find(k => k.frame > frame);
    if (key) { pause(); setFrame(key.frame); }
  });
  const centerPick = $('#mInspector [data-camera-center-pick]');
  if (centerPick) centerPick.onclick = () => {
    if (pick?.kinds === 'cameraCenter' && pick.id === s.id) { cancelPick(); return; }
    pause(); endPathDraw(true); startPick('__cameraCenter', 'cameraCenter'); pick.frame = cameraEditFrame(s); renderInspector();
  };
  const centerView = $('#mInspector [data-camera-center-view]');
  if (centerView) centerView.onclick = () => {
    pause(); checkpoint(); const [lon, lat] = centerLonLat();
    putCameraKey(s, cameraEditFrame(s), { lon: clamp(lon, ...CAMERA_FIELDS.lon), lat: clamp(lat, ...CAMERA_FIELDS.lat) });
    cancelPick(); previewCamera = null; changed(); renderInspector();
  };
  const capture = $('#mInspector [data-camera-view]');
  if (capture) capture.onclick = () => { pause(); checkpoint(); putCameraKey(s, cameraEditFrame(s), captureCamera()); previewCamera = null; changed(); renderInspector(); };
}
function cameraPositionFields(s, pose, disabled) {
  const picking = pick?.kinds === 'cameraCenter' && pick.id === s.id;
  return `<div class="m-camera-position-actions"><button type="button" data-camera-center-pick ${disabled ? 'disabled' : ''}>${picking ? 'Cancel picking' : '&#8982; Pick camera center'}</button><button type="button" data-camera-center-view ${disabled ? 'disabled' : ''}>Use map center</button></div><p class="mini-label">Click a point to center the camera there. Or pan the map, then use its center.</p><details class="m-camera-coordinates"><summary>Coordinates (optional)</summary><div class="two">${['lon','lat'].map(field => `<label>${field === 'lon' ? 'Longitude' : 'Latitude'}<input type="number" data-camera-field="${field}" min="${CAMERA_FIELDS[field][0]}" max="${CAMERA_FIELDS[field][1]}" step=".01" value="${+pose[field].toFixed(3)}" ${disabled ? 'disabled' : ''}></label>`).join('')}</div></details>`;
}
function shotFields(s) {
  if (s.preset === 'keyframed') {
    const at = cameraEditFrame(s), pose = cameraPoseAt(s, at), key = cameraKeysOf(s).find(k => k.frame === at), disabled = frame < s.start || frame > s.start + s.dur;
    return `<div class="m-camera-keybar"><button type="button" data-camera-nav="-1" title="Previous keyframe">&lsaquo;</button><button type="button" data-camera-toggle="all" ${disabled ? 'disabled' : ''} title="Add or remove all camera properties at playhead">${key && Object.keys(CAMERA_FIELDS).every(f => key.values[f] !== undefined) ? '&#9670;' : '&#9671;'} Camera keyframe</button><button type="button" data-camera-nav="1" title="Next keyframe">&rsaquo;</button></div><p class="mini-label" data-camera-playhead>${disabled ? 'Move the playhead inside this camera bar to edit.' : 'At playhead - frame ' + at}</p>` +
      Object.entries(CAMERA_PROPERTIES).map(([property, spec]) => `<div class="m-camera-property"><div class="m-camera-property-title"><span>${spec.label}</span><button type="button" class="key ${spec.fields.every(f => key?.values[f] !== undefined) ? 'current' : ''}" data-camera-toggle="${property}" ${disabled ? 'disabled' : ''} title="Toggle ${spec.label} keyframe at playhead">${spec.fields.every(f => key?.values[f] !== undefined) ? '&#9670;' : '&#9671;'}</button></div><div>${property === 'position' ? cameraPositionFields(s, pose, disabled) : spec.fields.map(field => `<label>${field === 'lon' ? 'Longitude' : field === 'lat' ? 'Latitude' : ''}<input type="number" data-camera-field="${field}" min="${CAMERA_FIELDS[field][0]}" max="${CAMERA_FIELDS[field][1]}" step="${['lon','lat'].includes(field) ? '.01' : '.1'}" value="${+pose[field].toFixed(3)}" ${disabled ? 'disabled' : ''}></label>`).join('')}</div></div>`).join('') + `<button type="button" data-camera-view ${disabled ? 'disabled' : ''}>Use current map view at playhead</button>`;
  }
  const P = PRESETS[s.preset], has = k => P.fields.includes(k);
  let h = `<p class="mini-label">${esc(P.hint)}.</p>`;
  if (has('target')) h += F.loc('target', 'Target', s.target, 'any');
  if (has('autoFit') && ['country','region','regions'].includes(s.target.kind)) h += F.chk('autoFit', 'Fit the whole region in view', s.autoFit);
  if (has('planeId')) h += F.sel('planeId', 'Travel route', s.planeId, [['', 'Choose a route…'], ...planes().map(a => [a.id, `${a.name} (${a.from?.name ?? '?'} → ${a.to?.name ?? '?'})`])]);
  if (has('zoom') && !(has('autoFit') && s.autoFit && ['country','region','regions'].includes(s.target.kind))) h += F.num('zoom', 'Zoom level', s.zoom, 1, 12, .1);
  if (has('amount')) h += F.num('amount', s.preset === 'pullBack' ? 'Zoom out by' : 'Zoom in by', s.amount, 0, 8, .1);
  if (has('degrees')) h += F.num('degrees', 'Rotate by (degrees)', s.degrees, -720, 720, 5);
  if (has('pitch')) h += F.range('pitch', 'Tilt', s.pitch, 0, 70, 1, x => x + '°');
  if (has('bearing')) h += F.num('bearing', 'Rotation (degrees)', s.bearing, -180, 180, 5);
  if (has('lockHeading')) h += F.chk('lockHeading', 'Turn with the icon', s.lockHeading);
  return h;
}

function bindInspector(it) {
  bindCameraInspector(it);
  let gesture = false;
  $$('#mInspector [data-mf]').forEach(el => {
    const key = el.dataset.mf, t = el.dataset.t;
    const read = () => (t === 'chk' ? el.checked : t === 'num' ? Number(el.value) : el.value);
    if (t === 'range' || t === 'color') {
      el.oninput = () => {
        if (!gesture) { checkpoint(); gesture = true; }
        const v = t === 'range' ? Number(el.value) : el.value; it[key] = v;
        const out = el.parentElement.querySelector('.m-val'); if (out) out.textContent = key === 'pitch' ? v + '°' : key === 'size' || key === 'badgeZoom' ? v + '×' : key === 'badgeLabelY' ? v + '%' : key === 'badgeStemLen' ? v + ' px' : ['fillAlpha', 'dim'].includes(key) ? Math.round(v * 100) + '%' : v;
        draw();
      };
      el.onchange = () => { gesture = false; changed(); };
      return;
    }
    el.onchange = () => {
      if (t === 'loc') {
        const loc = parseLoc(el.value, el.dataset.kinds);
        if (!loc) { notify('Not found. Type a city, a country, or "lat, lon"'); el.value = locText(it[key]); return; }
        checkpoint(); it[key] = key === 'highlightOrigin' ? { ...loc, kind: 'point' } : loc; changed(); renderInspector(); return;
      }
      let v = read();
      checkpoint();
      if (key === '__cameraTrack') { cameraProperty = v; renderTimeline(); renderInspector(); return; }
      if (key === '__keyProperty') return;
      if (key.includes('.')) { const [endpoint, property] = key.split('.'); if (!Number.isFinite(v)) { renderInspector(); return; } it[endpoint][property] = clamp(v, +el.min, +el.max); previewCamera = null; changed(); renderInspector(); return; }
      if (key === 'name') { it.name = String(v).slice(0, 100) || 'Untitled'; changed(); const n = $('#mInspName'); if (n) n.textContent = it.name; return; }
      if (key === 'preset') { const old = PRESETS[it.preset].label, { dur, ...rest } = PRESETS[v].def; if (v === 'keyframed' && !it.cameraFrom) { it.cameraFrom = captureCamera(); it.cameraTo = { ...it.cameraFrom }; } if (v === 'keyframed') it.cameraKeys ??= []; it.preset = v; Object.assign(it, rest); if (it.name === old) it.name = PRESETS[v].label; if (PRESETS[v].fields.includes('planeId') && !it.planeId) it.planeId = planes()[0]?.id || ''; changed(); renderInspector(); return; }
      if (key === 'mode') {
        const def = (TRAVEL_ICONS[it.icon] || TRAVEL_ICONS.plane).lift;
        it.mode = v === 'path' ? 'path' : 'direct';
        if (it.mode === 'path') { it.path ||= []; if (it.lift === def) it.lift = 0; } else { if (pathDraw?.id === it.id) { pathDraw = null; canvas.style.cursor = ''; } if (it.lift === 0) it.lift = def; }
        changed(); renderInspector(); if (it.mode === 'path' && !it.path.length) startPathDraw(it.id); return;
      }
      if (key === 'icon') { const old = TRAVEL_ICONS[it.icon] || TRAVEL_ICONS.plane, nu = TRAVEL_ICONS[v]; if (!nu) return; if (it.planeColor === old.color) it.planeColor = nu.color; if (it.lift === old.lift) it.lift = nu.lift; if (['Travel', 'Plane', old.label].includes(it.name)) it.name = nu.label; it.icon = v; changed(); renderInspector(); return; }
      if (key === '__moveKeys') { if (v) { it.moveStart = it.start; it.moveEnd = it.start + Math.min(it.animDur ?? it.dur, it.dur); } else { delete it.moveStart; delete it.moveEnd; } changed(); renderInspector(); return; }
      if (key === '__move') { it.mode = v === 'path' ? 'path' : 'stay'; if (it.mode === 'path') it.path ||= []; else if (pathDraw?.id === it.id) { pathDraw = null; canvas.style.cursor = ''; } changed(); renderInspector(); if (it.mode === 'path' && !it.path.length) startPathDraw(it.id); return; }
      for (const [k, cat, base] of [['glyph', OBJECT_ICONS, 'Object'], ['fx', EFFECTS, 'Effect'], ['shape', SHAPES, 'Arrow / zone']]) if (key === k) { // new look: follow its default color and name unless the user changed them
        const old = cat[it[k]], nu = cat[v]; if (!nu) return;
        if (it.color === old?.color) it.color = nu.color; if (!it.name || it.name === base || it.name === old?.label) it.name = nu.label;
        it[k] = v; changed(); renderInspector(); return;
      }
      if (key === '__lscustom') { if (v) it.labelStyle = { ...labelStyleOf(proj) }; else delete it.labelStyle; changed(); renderInspector(); return; }
      if (key === '__pinMove') {
        it.mode = v === 'path' ? 'path' : v === 'move' ? 'move' : 'stay';
        if (it.mode === 'move' && !(it.to && Number.isFinite(it.to.lat))) { const c = (isDetail() ? localCities() : []).find(x => x[0] !== it.place.name); it.to = c ? { kind: 'city', name: c[0], lat: c[1], lon: c[2] } : it.place.name === 'New York' ? { kind: 'city', name: 'London', lat: 51.5072, lon: -0.1276 } : { kind: 'city', name: 'New York', lat: 40.7128, lon: -74.006 }; }
        if (it.mode === 'path') it.path ||= []; else if (pathDraw?.id === it.id) { pathDraw = null; canvas.style.cursor = ''; }
        if (it.mode !== 'stay' && it.dur <= (it.animDur ?? it.dur)) { it.dur = (it.animDur ?? it.dur) + 45; ensureLength(it.start + it.dur); } // leave time to sit at the destination before the bar ends
        changed(); renderInspector(); if (it.mode === 'path' && !it.path.length) startPathDraw(it.id); return;
      }
      if (key === '__pinDisplay') { it.badge = v === 'badge'; it.showIcon = v === 'badge' ? false : v !== 'text'; it.showLabel = v !== 'icon'; if (it.badge && !it.size) it.size = 1; changed(); renderInspector(); return; }
      if (key === '__hmode') { it.target = v === 'country' ? (isDetail() ? defaultRegion() : { kind: 'country', name: (lastView && geo && countryAt(geo, ...centerLonLat())) || 'Australia' }) : { kind: 'city', name: 'Paris', lat: 48.8566, lon: 2.3522 }; changed(); renderInspector(); return; }
      if (t === 'num') {
        if (key === '__startSeconds' || key === '__finishSeconds') {
          const target = Math.round(v * proj.fps), finish = it.start + it.dur;
          if (!Number.isFinite(v) || v < 0 || !Number.isSafeInteger(target) || (key === '__startSeconds' ? target >= finish : target <= it.start)) {
            notify('Enter a valid time, with Finish after Start.'); renderInspector(); return;
          }
          if (key === '__startSeconds') retimeMapItem(it, target, finish - target, false);
          else retimeMapItem(it, it.start, target - it.start, false);
          ensureLength(it.start + it.dur); changed(); renderInspector(); return;
        }
        const lo = Number(el.min), hi = el.max === '' ? Infinity : Number(el.max);
        if (key === 'start' || key === 'dur' || key === 'animDur') {
          if (!Number.isFinite(v)) { el.value = it[key]; notify('Enter a valid frame number.'); return; }
          v = Math.max(lo, Math.round(v));
          const end = key === 'start' ? v + it.dur : key === 'dur' ? it.start + v : it.start + it.dur;
          if (!Number.isSafeInteger(v) || !Number.isSafeInteger(end)) { el.value = it[key]; notify('Enter a valid frame number.'); return; }
          if (key === 'start' || key === 'dur') retimeMapItem(it, key === 'start' ? v : it.start, key === 'dur' ? v : it.dur);
          it[key] = v; if (key !== 'animDur') ensureLength(end); el.value = v; changed(); renderInspector(); return;
        }
        v = clamp(Number.isFinite(v) ? v : lo, lo, hi);
        el.value = v;
      }
      if (key === 'count') v = Math.round(v);
      if (key === 'moveStart') v = Math.min(Math.round(v), it.moveEnd - 1);
      if (key === 'moveEnd') v = Math.max(Math.round(v), it.moveStart + 1);
      it[key] = v; changed(); if (key === 'labelPlacement' || key === 'autoFit' || key === 'showLabels' || key === 'showLabel' || key === 'showRouteLabels' || key === 'borderPartial' || key === 'badgeShape' || key === 'badgeStem' || key === 'badgeExit') renderInspector();
      if (key === 'showRouteLabels' || key === 'routeLabelMode') void ensureDetail();
    };
  });
  const highlightReset = $('#mInspector [data-highlight-reset]');
  if (highlightReset) highlightReset.onclick = () => { checkpoint(); delete it.highlightOrigin; changed(); renderInspector(); };
  $$('#mInspector [data-mpick]').forEach(el => el.onclick = () => startPick(el.dataset.mpick, el.dataset.kinds));
  $$('#mInspector [data-mrm]').forEach(el => el.onclick = () => { const list = membersOf(it); if (list.length < 2) { notify('Keep at least one region'); return; } checkpoint(); list.splice(+el.dataset.mrm, 1); setMembers(it, list); changed(); renderInspector(); });
  const addBox = $('#mInspector [data-madd]');
  if (addBox) addBox.onchange = () => {
    const loc = parseLoc(addBox.value, addBox.dataset.kinds);
    if (!loc || !['country', 'region', 'all'].includes(loc.kind)) { notify('Not found. Type a country or region name'); addBox.value = ''; return; }
    checkpoint();
    if (loc.kind === 'all') { it.target = loc; delete it.borderRing; }
    else if (!addMember(it, loc, false)) { undoStack.pop(); updateHistory(); addBox.value = ''; return; }
    changed(); renderInspector();
  };
  $$('#mInspector [data-mregpick]').forEach(el => el.onclick = () => {
    if (pick?.key === '__members') { cancelPick(); return; }
    pause(); endPathDraw(true); startPick('__members', 'country');
    $('#mHint').textContent = 'Click regions to add or remove them · Shift-click for a whole country · Esc to finish';
    notify('Click regions on the map to add or remove them'); renderInspector();
  });
  { const file = $('#mInspector [data-badgefile]'), choose = $('#mInspector [data-badgeimg]'), clear = $('#mInspector [data-badgeclear]');
    if (choose) choose.onclick = () => file.click();
    if (file) file.onchange = async () => { const f = file.files[0]; file.value = ''; if (!f) return; try { const url = await shrinkImage(f); pause(); checkpoint(); it.image = url; if (it.glyph === 'banner') { const img = new Image(); img.src = url; await img.decode(); it.bannerAspect = clamp(img.naturalWidth / img.naturalHeight, .35, 2.5); } changed(); renderInspector(); notify('Image added'); } catch (err) { notify(err.message || 'That image could not be used.'); } };
    if (clear) clear.onclick = () => { pause(); checkpoint(); delete it.image; changed(); renderInspector(); }; }
  $$('#mInspector [data-mopenset]').forEach(el => el.onclick = () => $('#mSettingsButton').click());
  const combine = $('#mInspector [data-mcombine]'); if (combine) combine.onchange = () => { if (combine.value === 'separate') splitRegions(it); };
  const imageObject = $('#mInspector [data-imageobject]'); if (imageObject) imageObject.onclick = () => { checkpoint(); it.type = 'object'; it.glyph = 'image'; it.count = 1; it.enter = 'drop'; it.idle = 'none'; it.exit = 'none'; changed(); renderInspector(); };
  $$('#mInspector [data-movekey]').forEach(el => el.onclick = () => { const key = el.dataset.movekey; if (frame < it.start || frame > it.start + it.dur || (key === 'moveStart' ? frame >= it.moveEnd : frame <= it.moveStart)) { notify('Choose a frame inside the bar, with end after start.'); return; } checkpoint(); it[key] = frame; changed(); renderInspector(); });
  $$('#mInspector [data-borderpoint]').forEach(el=>el.onclick=()=>startPick(el.dataset.borderpoint,'borderpoint'));
  $$('#mInspector [data-mpath]').forEach(el => el.onclick = () => pathAction(it, el.dataset.mpath));
  $$('#mInspector [data-mwdel]').forEach(el => el.onclick = () => { checkpoint(); it.path.splice(+el.dataset.mwdel, 1); syncPathEnds(it); changed(); renderInspector(); });
  if (!isShot(it) && it.labelStyle) bindLabelStyle($('#mInspector'), 'mItemLbl', () => it.labelStyle, v => { it.labelStyle = v; }, () => renderInspector());
}
function centerLonLat() { const l = screenToLonLat(lastView, proj.width / 2, proj.height / 2); return l ? [l.lon, l.lat] : [0, 0]; }

// ------------------------------------------------------------------ label style (project-wide in Map settings, optional override per item)
function labelStyleHtml(st, pre) {
  const o = (v, l, cur) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`;
  const num = (k, label, min, max, step) => `<label>${label}<input data-ls="${k}" data-t="num" type="number" min="${min}" max="${max}" step="${step}" value="${Number(st[k] ?? (k === 'referenceZoom' ? 3 : k === 'haloWidth' ? .26 : 0))}"></label>`;
  const chk = (k, label) => `<label class="m-chk"><input type="checkbox" data-ls="${k}" data-t="chk" ${st[k] ? 'checked' : ''}> ${label}</label>`;
  const color = (k, label) => `<label class="color-row">${label}<input type="color" data-ls="${k}" data-t="color" value="${esc(st[k])}"></label>`;
  const range = (k, label, min, max, step, fmt) => `<label>${label} <span class="m-val">${fmt(st[k])}</span><input data-ls="${k}" data-t="range" type="range" min="${min}" max="${max}" step="${step}" value="${st[k]}"></label>`;
  return `<label>Start from a style<select data-lspreset><option value="">Choose a preset…</option>${Object.entries(LABEL_PRESETS).map(([k, p]) => o(k, p.label, '')).join('')}</select></label>` +
    fontPickerHtml(pre + 'Font', 'Font', st.font) +
    `<div class="two"><label>Weight<select data-ls="weight" data-t="int">${LABEL_WEIGHTS.map(([w, l]) => o(w, l, st.weight)).join('')}</select></label>${num('size', 'Size', 6, 240, 1)}</div>` +
    `<label>Orientation<select data-ls="placement" data-t="sel">${o('screen', 'Upright', st.placement)}${o('map', 'Flat on map', st.placement)}</select></label>` +
    `<label>Zoom sizing<select data-ls="scaleMode" data-t="sel">${o('fixed', 'Keep text size fixed', st.scaleMode || 'fixed')}${o('world', 'Scale with the map', st.scaleMode)}</select></label>` +
    (st.scaleMode === 'world' ? num('referenceZoom', 'Size measured at zoom', 0, 14, .1) : '') +
    `<label>Shape<select data-ls="shape" data-t="sel">${Object.entries(LABEL_SHAPES).map(([k, l]) => o(k, l, st.shape)).join('')}</select></label>` +
    chk('useTheme', 'Use the map style’s label colors') + (st.useTheme ? '' : color('text', 'Text color') + (st.shape === 'none' ? '' : color('bg', 'Background color') + range('bgAlpha', 'Background opacity', 0, 1, .05, x => Math.round(x * 100) + '%'))) +
    (st.shape === 'none' ? '' : `<div class="two">${num('borderW', 'Border width', 0, 8, .5)}${color('border', 'Border color')}</div>`) +
    range('spacing', 'Letter spacing', 0, 40, 1, x => x + '%') + chk('italic', 'Italic') + chk('caps', 'ALL CAPS') + chk('halo', 'Outline around text') + (st.halo ? num('haloWidth', 'Outline thickness (relative to text)', 0, 1, .01) : '') + chk('shadow', 'Soft shadow');
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
      get()[key] = v; changed(); if (key === 'useTheme' || key === 'shape' || key === 'halo' || key === 'scaleMode') rerender();
    };
  });
}
function renderLabelPanel() {
  renderAtlasLabelPanel();
  let box = $('#mLabelStyle');
  if (!box) { box = document.createElement('div'); box.id = 'mLabelStyle'; $('#mImageryBox').after(box); }
  const wasOpen = box.querySelector('details')?.open;
  const st = labelStyleOf(proj);
  box.innerHTML = `<details ${wasOpen ? 'open' : ''}><summary class="section-title" style="cursor:pointer;margin:14px 0 10px">LABEL STYLE <span>Aa</span></summary><p class="mini-label">Applies to place names, route names, pins and highlights. Choose “2D · Attached to map” to lay labels flat on the map. Pick a different style on any item to override it.</p>${labelStyleHtml(st, 'mProjLbl')}</details>`;
  bindLabelStyle(box, 'mProjLbl', () => (proj.labelStyle ||= { ...DEFAULT_LABEL_STYLE }), v => { proj.labelStyle = v; }, renderLabelPanel);
}
function renderAtlasLabelPanel() {
  let box = $('#mAtlasLabels');
  if (!box) { box = document.createElement('div'); box.id = 'mAtlasLabels'; $('#mImageryBox').after(box); }
  const open = box.querySelector('details')?.open, s = atlasLabelSettings(proj.atlasLabels);
  const chk = (key, title) => `<label class="m-chk"><input type="checkbox" data-atlas="${key}" ${s[key] ? 'checked' : ''}> ${title}</label>`;
  const num = (key, title, min, max, step = 1) => `<label>${title}<input type="number" data-atlas="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
  const color = (key, title) => `<label>${title}<input type="color" data-atlas="${key}" value="${s[key]}"></label>`;
  box.innerHTML = `<details ${open ? 'open' : ''}><summary class="section-title" style="cursor:pointer;margin:14px 0 10px">COUNTRY &amp; OCEAN LABELS</summary>
    <p class="mini-label">Names fit each country’s mainland shape and follow its natural direction. Use the country size multiplier to adjust all names together. Fixed zoom sizing preserves these proportions as you zoom.</p>
    ${chk('countries', 'Label all countries')}${chk('oceans', 'Label oceans and major seas')}${chk('declutter', 'Reduce overlapping names')}${chk('fitCountries', 'Fit label size to each country')}${chk('countryAngles', 'Follow country and ocean angles')}
    ${fontPickerHtml('mAtlasFont', 'Font', s.font)}
    <div class="two">${num('size', 'Country size multiplier (30 = normal)', 6, 240)}${num('oceanSize', 'Ocean text size', 6, 240)}</div>
    <label>Orientation<select data-atlas="placement"><option value="map" ${s.placement === 'map' ? 'selected' : ''}>Flat on map</option><option value="screen" ${s.placement === 'screen' ? 'selected' : ''}>Upright</option></select></label>
    <label>Zoom sizing<select data-atlas="scaleMode"><option value="fixed" ${s.scaleMode === 'fixed' ? 'selected' : ''}>Keep text size fixed</option><option value="world" ${s.scaleMode === 'world' ? 'selected' : ''}>Scale with the map</option></select></label>
    ${s.scaleMode === 'world' ? num('referenceZoom', 'Size measured at zoom', 0, 14, .1) : ''}
    <div class="two">${color('text', 'Text color')}${color('outline', 'Outline color')}</div>
    ${num('haloWidth', 'Outline thickness (relative to text)', 0, 1, .01)}${num('opacity', 'Opacity', 0, 1, .05)}${num('spacing', 'Letter spacing (%)', 0, 40)}
    <p class="mini-label">Disable overlap reduction to show every visible country name. Add a Map label for custom historical names.</p></details>`;
  const set = (key, value) => { checkpoint(); proj.atlasLabels = { ...proj.atlasLabels, [key]: value }; changed(); renderAtlasLabelPanel(); };
  bindFontPicker('mAtlasFont', font => set('font', font));
  box.querySelectorAll('[data-atlas]').forEach(el => el.onchange = () => {
    const value = el.type === 'checkbox' ? el.checked : el.type === 'number' ? clamp(Number.isFinite(el.valueAsNumber) ? el.valueAsNumber : Number(el.min), Number(el.min), Number(el.max)) : el.value;
    set(el.dataset.atlas, value);
  });
}
function labelFields(a) {
  if (!['plane', 'highlight', 'pin', 'label', 'object'].includes(a.type)) return '';
  return '<div class="section-title m-sep">LABEL STYLE</div>' + F.chk('__lscustom', 'Custom style for this label', !!a.labelStyle) + (a.labelStyle ? labelStyleHtml(labelStyleOf(proj, a), 'mItemLbl') : '<p class="mini-label">Using the project label style (Map settings → Label style).</p>');
}

// ------------------------------------------------------------------ pick a location on the map
function startPick(key, kinds) {
  pick = { key, kinds, id: sel }; canvas.style.cursor = 'crosshair'; $('#mHint').textContent = 'Click to choose a location · right-drag or middle-drag to pan · scroll to zoom · Esc to cancel';
  notify(kinds === 'cameraCenter' ? 'Click the map to choose the camera center' : kinds === 'borderpoint' ? 'Click near the border to set its endpoint' : kinds === 'any' ? 'Click the map (Shift+click picks a whole country)' : kinds === 'place' ? 'Click the map to choose a place' : isDetail() ? 'Click a region; Shift-click for a whole country' : 'Click a country');
}
function cancelPick() { const camera = pick?.kinds === 'cameraCenter'; const was = pick?.key === '__members'; pick = null; canvas.style.cursor = ''; $('#mHint').textContent = HINT; if (was || camera) { renderInspector(); draw(); } }
const HINT = 'Right-drag or middle-drag to pan · scroll to zoom · scrub the timeline to preview';
function canvasXY(e) { const b = canvas.getBoundingClientRect(); return { sx: (e.clientX - b.left) / b.width * proj.width, sy: (e.clientY - b.top) / b.height * proj.height }; }
function finishMapPan(e) {
  if (!mapPan || (e && e.pointerId !== mapPan.pointerId)) return;
  const id = mapPan.pointerId; mapPan = null;
  if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
  canvas.style.cursor = pathDraw || pick ? 'crosshair' : '';
}
$('#mResetView').onclick = () => { finishMapPan(); previewCamera = null; draw(); };
canvas.oncontextmenu = e => e.preventDefault();
canvas.addEventListener('wheel', e => {
  if (!lastView || !geo || exporting) return;
  e.preventDefault();
  if (mapPan || pathDrag) return;
  pause();
  const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1);
  previewCamera = zoomMapCamera(lastView, canvasXY(e), -clamp(delta, -240, 240) * .003);
  draw();
}, { passive: false });
canvas.addEventListener('lostpointercapture', finishMapPan);
function pathPointerDown(e) {
  const a = proj.actions.find(x => x.id === pathDraw.id); if (!a || !lastView || !geo) return;
  e.preventDefault();
  const { sx, sy } = canvasXY(e), hs = pathHandles(lastView, a);
  let hit = -1, bd = 14 * lastView.unit;
  hs.forEach((h, i) => { const d = Math.hypot(h.x - sx, h.y - sy); if (d < bd) { bd = d; hit = i; } });
  if (hit >= 0) {
    checkpoint();
    if (e.altKey) { a.path.splice(hit, 1); syncPathEnds(a); changed(); renderInspector(); return; }
    pathDrag = { id: a.id, i: hit, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    return;
  }
  const ll = screenToLonLat(lastView, sx, sy);
  if (!ll) { notify('Click on the map surface'); return; }
  if ((a.path || []).length >= 120) { notify('A path can have up to 120 points'); return; }
  checkpoint(); (a.path ||= []).push({ lat: +ll.lat.toFixed(4), lon: +ll.lon.toFixed(4) });
  syncPathEnds(a); changed(); renderInspector();
}
canvas.onpointermove = e => {
  if (mapPan) {
    if (e.pointerId !== mapPan.pointerId) return;
    previewCamera = panMapCamera(mapPan.view, mapPan.point, canvasXY(e)) || previewCamera;
    draw(); return;
  }
  if (!pathDrag || !lastView) return;
  const a = proj.actions.find(x => x.id === pathDrag.id), { sx, sy } = canvasXY(e), ll = a && screenToLonLat(lastView, sx, sy); if (!ll) return;
  a.path[pathDrag.i] = { lat: +ll.lat.toFixed(4), lon: +ll.lon.toFixed(4) }; pathDrag.moved = true; draw();
};
canvas.onpointerup = canvas.onpointercancel = e => {
  if (mapPan) { finishMapPan(e); return; }
  if (!pathDrag) return;
  const a = proj.actions.find(x => x.id === pathDrag.id), moved = pathDrag.moved; pathDrag = null;
  if (!moved) undoStack.pop(); else if (a) { syncPathEnds(a); changed(); renderInspector(); }
  updateHistory();
};
canvas.onpointerdown = e => {
  if (exporting || mapPan || pathDrag) return;
  if (e.button === 1 || e.button === 2) {
    if (!lastView || !geo) return;
    e.preventDefault(); pause();
    mapPan = { pointerId: e.pointerId, point: canvasXY(e), view: lastView };
    canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; return;
  }
  if (e.button !== 0) return;
  if (pathDraw) { pathPointerDown(e); return; }
  if (!pick || !lastView || !geo) return;
  const b = canvas.getBoundingClientRect(), sx = (e.clientX - b.left) / b.width * proj.width, sy = (e.clientY - b.top) / b.height * proj.height, ll = screenToLonLat(lastView, sx, sy);
  if (!ll) { notify('Click on the map surface'); return; }
  if (pick.kinds === 'cameraCenter') {
    e.preventDefault();
    const shot = proj.shots.find(s => s.id === pick.id && s.preset === 'keyframed');
    if (!shot) { cancelPick(); return; }
    checkpoint();
    putCameraKey(shot, pick.frame, { lon: clamp(ll.lon, ...CAMERA_FIELDS.lon), lat: clamp(ll.lat, ...CAMERA_FIELDS.lat) });
    previewCamera = null; cancelPick(); changed(); renderInspector(); notify('Camera center keyframe set'); return;
  }
  if(pick.kinds==='borderpoint'){
    const a=proj.actions.find(a=>a.id===pick.id),features=a?targetFeatures(geo,a.target):[];
    const f=a?.target.kind==='regions'?combinedFeature(features,a.target.name):features[0];
    if(!f){notify('Choose a border region first');return}
    const X=lonToX(ll.lon),Y=latToY(ll.lat),ring=borderRingOf(f,a.borderRing);
    const snapped=nearestBorderPosition(pick.key==='borderTo'?{...f,rings:[f.rings[ring]||f.rings[0]]}:f,X+Math.round(f.cx-X),Y);
    if(!snapped)return;
    checkpoint();a[pick.key]=snapped.position*100;if(pick.key==='borderFrom')a.borderRing=snapped.ring;
    cancelPick();changed();renderInspector();notify('Border endpoint set');return;
  }
  const wantCountry = pick.kinds === 'border' || pick.kinds === 'country' || (pick.kinds === 'any' && e.shiftKey);
  let loc;
  if (wantCountry) {
    const region = !e.shiftKey && isDetail() ? regionAt(proj,geo,ll.lon,ll.lat) : null;
    const n = region || countryAt(geo, ll.lon, ll.lat);
    if (!n) { notify('No region there. Try again'); return; }
    loc = region ? { kind: 'region', name: n, country:geo.byName.get(n)?.country } : { kind: 'country', name: n };
  } else {
    let best = null, bd = 18 * lastView.unit;
    for (const c of localCities()) {
      const X = lonToX(c[2]), p = projectPoint(lastView, X + Math.round(lastView.cx - X), latToY(c[1])), d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bd) { bd = d; best = c; }
    }
    loc = best ? { kind: 'city', name: best[0], lat: best[1], lon: best[2] } : { kind: 'point', name: `${ll.lat.toFixed(2)}, ${ll.lon.toFixed(2)}`, lat: +ll.lat.toFixed(4), lon: +ll.lon.toFixed(4) };
  }
  if (pick.key === '__members') { // stays active so several regions can be clicked in a row
    const a = items().find(i => i.id === pick.id); if (!a || !regionTarget(a)) { cancelPick(); return; }
    checkpoint();
    if (addMember(a, loc, true)) { changed(); renderInspector(); const n = membersOf(a).length; notify(`${n} region${n === 1 ? '' : 's'} selected`); } else { undoStack.pop(); updateHistory(); }
    return;
  }
  const it = items().find(i => i.id === pick.id);
  if (it) { checkpoint(); it[pick.key] = pick.key === 'highlightOrigin' ? { ...loc, kind: 'point' } : loc; changed(); renderInspector(); notify('Location set: ' + locText(loc)); }
  cancelPick();
};

// ------------------------------------------------------------------ project settings
function syncMapDuration() {
  const input = $('#mDuration');
  const label = input.closest('label');
  if (label?.firstChild?.nodeType === 3) label.firstChild.textContent = 'Duration (seconds)';
  input.min = +(2 / proj.fps).toFixed(3);
  input.removeAttribute('max');
  input.step = '0.001';
  input.value = +(proj.frames / proj.fps).toFixed(3);
}
function renderSettings() {
  $('#mProjectName').value = proj.name; $('#mFps').value = proj.fps; $('#mFpsLabel').textContent = proj.fps + ' FPS';
  syncMapDuration(); $('#mSize').value = proj.width + ',' + proj.height; $('#mCompLabel').textContent = `${proj.width} × ${proj.height}`;
  renderTerrainSettings();
  $('#mTheme').value = proj.theme; $('#mGrat').checked = !!proj.graticule;
  { const on = !!THEMES[proj.theme]?.imagery; $('#mImageryBox').hidden = !on; $('#mImagery').value = proj.imagery || DEFAULT_IMAGERY; $('#mImageryNote').textContent = on ? (proj.imagery === 'esri' ? 'Sharp to street level. Esri licence terms apply to published videos.' : 'Public-domain NASA imagery. Gets soft past about zoom 6.') : ''; }
  renderAreaSettings();
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
function renderAreaSettings() {
  const ar = areaOf(proj), countries = detailCountriesOf(ar), sel = $('#mAreaCountry');
  $('#mAreaMode').value = 'world'; $('#mAreaBox').hidden = false;
  if (![...sel.options].some(o => o.value === ar.country)) sel.insertAdjacentHTML('afterbegin', `<option value="${esc(ar.country)}">${esc(ar.country)}</option>`);
  sel.value = ar.country; $('#mAreaNeighbors').value = ar.neighbors;
  $('#mAreaFit').checked = ar.fit; $('#mAreaName').checked = ar.name; $('#mAreaCities').checked = ar.cities;
  $('#mAddDetailCountry').disabled = countries.includes(ar.country);
  $('#mDetailCountries').innerHTML = countries.map(c => {
    const loaded = !!geo?.details?.has(c), info = loaded ? detailInfo(geo, c) : null, levels = info ? info.levels : [];
    const status = noDetail.has(c) ? 'Detailed boundaries are not available for this country yet.' : loaded ? '' : detailErrors.has(c) ? `Could not load: ${detailErrors.get(c)}` : 'Loading boundaries…';
    const level = levels.length > 1 ? `<select data-dc-level="${esc(c)}" aria-label="Boundary level for ${esc(c)}">${levels.map(([id, label]) => `<option value="${esc(id)}">${esc(label)}</option>`).join('')}</select>` : '';
    return `<div class="m-dc"><div class="m-dc-head"><b>${esc(c)}</b>${level}<button type="button" data-dc-remove="${esc(c)}" title="Remove ${esc(c)} details" aria-label="Remove ${esc(c)} details">×</button></div>${status ? `<small>${esc(status)}</small>` : ''}${detailErrors.has(c) ? `<button type="button" data-dc-retry="${esc(c)}">Retry loading</button>` : ''}${loaded && info.attribution ? `<small>${esc(info.attribution)}</small>` : ''}</div>`;
  }).join('');
  for (const c of countries) { const lv = $(`#mDetailCountries [data-dc-level="${CSS.escape(c)}"]`); if (lv && geo?.details?.has(c)) lv.value = detailLevelOf(geo, c, ar.detailLevels?.[c] || ar.detailLevel); }
  $$('#mDetailCountries [data-dc-level]').forEach(el => el.onchange = () => { pause(); checkpoint(); const cur = areaOf(proj); proj.area = { ...cur, detailLevels: { ...cur.detailLevels, [el.dataset.dcLevel]: el.value } }; buildLists(); saveLocal(); renderAll(); });
  $$('#mDetailCountries [data-dc-remove]').forEach(el => el.onclick = () => { pause(); checkpoint(); const cur = areaOf(proj); proj.area = { ...cur, mode: 'world', detailCountries: detailCountriesOf(cur).filter(c => c !== el.dataset.dcRemove) }; saveLocal(); renderAll(); });
  $$('#mDetailCountries [data-dc-retry]').forEach(el => el.onclick = () => { const c = el.dataset.dcRetry; detailLoads.delete(c); detailErrors.delete(c); void loadDetail(c); renderAreaSettings(); });
  $('#mAreaPad').value = Math.round(ar.pad * 100); $('#mAreaPadValue').textContent = Math.round(ar.pad * 100) + '%'; $('#mAreaPad').disabled = !ar.fit;
  $('#mRegion').disabled = $('#mStartZoom').disabled = false;
  $('#mAreaNote').textContent = countries.length ? 'The world map stays as it is. Only the countries listed above get detailed boundaries, and each loads only when added.' : 'Pick a country and press Add country details. Nothing extra loads until you do.';
}
function renderTerrainSettings() {
  $('#mTerrainBox').hidden = !THEMES[proj.theme]?.relief;
  const settings = reliefSettings(proj.terrain);
  for (const [key, value] of Object.entries(settings)) {
    if (!(key in RELIEF_DEFAULTS)) continue;
    const id = '#mTerrain' + key[0].toUpperCase() + key.slice(1), el = $(id);
    if (el.type === 'checkbox') el.checked = value; else el.value = value;
    const output = $(id + 'Value');
    if (output) output.textContent = ['azimuth', 'altitude'].includes(key) ? value + '\u00b0' : key === 'exaggeration' ? value.toFixed(1) + '\u00d7' : Math.round(value * 100) + '%';
  }
  updateTerrainStatus();
}
function updateTerrainStatus() {
  const el = $('#mTerrainStatus');
  if (el) el.textContent = geo?.relief?.failedCount() ? 'Some elevation tiles could not load. Available coarser terrain stays visible; check your connection and reload to retry.' : 'DEM relief \u00b7 visible tiles only \u00b7 up to zoom 14';
}
function bindSettings() {
  const edit = fn => e => { pause(); checkpoint(); fn(e.target); saveLocal(); renderAll(); };
  $('#mProjectName').onchange = edit(el => proj.name = el.value.trim().slice(0, 100) || 'Untitled map');
  $('#mFps').onchange = edit(el => proj.fps = +el.value);
  $('#mDuration').onchange = edit(el => { const seconds = Number(el.value), frames = Math.max(2, Math.round(seconds * proj.fps)); if (el.value.trim() && Number.isFinite(seconds) && Number.isSafeInteger(frames)) proj.frames = frames; frame = Math.min(frame, proj.frames - 1); });
  $('#mSize').onchange = edit(el => { const [w, h] = el.value.split(',').map(Number); proj.width = w; proj.height = h; });
  $('#mTheme').onchange = edit(el => proj.theme = el.value);
  $('#mImagery').onchange = edit(el => proj.imagery = el.value);
  for (const key of Object.keys(RELIEF_DEFAULTS)) {
    const el = $('#mTerrain' + key[0].toUpperCase() + key.slice(1));
    el.onchange = edit(input => { proj.terrain = { ...proj.terrain, [key]: input.type === 'checkbox' ? input.checked : input.type === 'range' ? +input.value : input.value }; });
  }
  $('#mTerrainReset').onclick = edit(() => { delete proj.terrain; });
  const area = patch => { proj.area = { ...DEFAULT_AREA, ...(proj.area || {}), ...patch }; };
  $('#mAreaMode').onchange = edit(el => { area({ mode: el.value }); if (el.value === 'country' && geo && !geo.byName.has(areaOf(proj).country)) area({ country: DEFAULT_AREA.country }); });
  $('#mAreaCountry').onchange = edit(el => area({ country: el.value }));
  $('#mAddDetailCountry').onclick=()=>{pause();checkpoint();const ar=areaOf(proj),country=$('#mAreaCountry').value;area({mode:'world',detailCountries:[...new Set([...detailCountriesOf(ar),country])]});saveLocal();renderAll()};
  $('#mAreaNeighbors').onchange = edit(el => area({ neighbors: el.value }));
  $('#mAreaFit').onchange = edit(el => area({ fit: el.checked }));
  $('#mAreaName').onchange = edit(el => area({ name: el.checked }));
  $('#mAreaCities').onchange = edit(el => area({ cities: el.checked }));
  { let editing = false;
    $('#mAreaPad').oninput = e => { pause(); if (!editing) { checkpoint(); editing = true; } area({ pad: clamp(+e.target.value / 100, .02, .45) }); $('#mAreaPadValue').textContent = Math.round(areaOf(proj).pad * 100) + '%'; draw(); };
    $('#mAreaPad').onchange = () => { editing = false; saveLocal(); renderSettings(); }; }
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
function updateCameraKeySelection() {
  $$('#mTrackRows [data-map-key]').forEach(el => el.classList.toggle('current', el.dataset.keyItem === sel && el.dataset.mapKey === `camera:${frame}`));
}
function updateTimelineItem(it) {
  const row = $$('#mTrackRows [data-mrow]').find(el => el.dataset.mrow === it.id); if (!row) return;
  const clip = row.querySelector('[data-mclip]'), last = proj.frames - 1;
  clip.style.left = `${it.start / last * 100}%`; clip.style.width = `${Math.max(.6, it.dur / last * 100)}%`;
  clip.title = `${it.name} · frame ${it.start}–${it.start + it.dur}`;
  row.querySelectorAll(':scope > [data-map-key]').forEach(el => el.remove());
  row.insertAdjacentHTML('beforeend', timelineKeys(it, last)); bindTimelineKeys(row);
}
function timelineKeys(it, last) {
  if (it.preset === 'keyframed') return cameraKeysOf(it).filter(k => Object.keys(k.values).some(f => cameraTrackFields().includes(f))).map(k => `<button type="button" class="m-key ${k.frame === frame && it.id === sel ? 'current' : ''}" data-map-key="camera:${k.frame}" data-key-item="${esc(it.id)}" style="left:clamp(11px, ${Math.min(last,k.frame)/last*100}%, calc(100% - 11px))" title="Camera keyframe - frame ${k.frame}. Drag to retime." aria-label="Camera keyframe, frame ${k.frame}"></button>`).join('');
  const keys = animationKeysOf(it);
  return [['animationStart', keys.start, 'Animation start'], ['animationEnd', keys.end, 'Animation finish']].map(([key, time, label]) => `<button type="button" class="m-key" data-map-key="${key}" data-key-item="${esc(it.id)}" style="left:clamp(11px, ${Math.min(last, time) / last * 100}%, calc(100% - 11px))" title="${label}: frame ${time}. Drag to retime animation." aria-label="${esc(it.name)} ${label} keyframe, frame ${time}"></button>`).join('');
}
function bindTimelineKeys(root = document) {
  [...root.querySelectorAll('[data-map-key]')].forEach(el => {
    el.onpointerdown = e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation(); pause();
      const it = items().find(i => i.id === el.dataset.keyItem); if (!it) return;
      sel = it.id; renderItems(); renderInspector();
      if (el.dataset.mapKey.startsWith('camera:')) setFrame(+el.dataset.mapKey.split(':')[1]);
      checkpoint(); drag = { kind: 'clip', id: it.id, mode: el.dataset.mapKey, x0: frameFromEvent(e), start: it.start, dur: it.dur, moveStart: it.moveStart, moveEnd: it.moveEnd, animDur: it.animDur, animStart: it.animStart, animEnd: it.animEnd, cameraKeys: it.preset === 'keyframed' ? clone(cameraKeysOf(it)) : null, moved: false };
      renderTimeline();
    };
    el.onkeydown = e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); pause();
      const it = items().find(i => i.id === el.dataset.keyItem), key = el.dataset.mapKey;
      const d = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1);
      checkpoint();
      let focusKey = key;
      if (key.startsWith('camera:')) { const from = +key.split(':')[1], to = clamp(from + d, it.start, it.start + it.dur); moveCameraKey(it, from, to, cameraTrackFields()); setFrame(to); focusKey = `camera:${to}`; }
      else setAnimationKey(it, key, animationKeysOf(it)[key === 'animationStart' ? 'start' : 'end'] + d);
      ensureLength(it.start + it.dur); changed(); renderInspector();
      $$('[data-map-key]').find(b => b.dataset.keyItem === it.id && b.dataset.mapKey === focusKey)?.focus();
    };
  });
}
bindTimelineRename($('#mTrackLabels'), { attribute: 'data-mtl', getItem: id => items().find(it => it.id === id), checkpoint, changed: () => { changed(); renderInspector(); }, pause });
function renderTimeline() {
  const zoom = +$('#mZoomT').value, its = items(), last = proj.frames - 1;
  $('#mTracks').style.width = `${zoom * 100}%`;
  const step = Math.max(1, Math.round(proj.frames / (10 * zoom)));
  let ticks = ''; for (let f = 0; f < proj.frames; f += step) ticks += `<span class="tick" style="left:${f / last * 100}%">${f}</span>`;
  $('#mRuler').innerHTML = ticks;
  $('#mTrackLabels').innerHTML = its.map(it => `<div class="track-label ${it.id === sel ? 'selected' : ''}" data-mtl="${esc(it.id)}"><span>${iconOf(it)}</span><span class="ff-layer-name" title="Double-click or double-tap to rename">${esc(it.name)}</span></div>`).join('');
  $('#mTrackRows').innerHTML = its.map(it => `<div class="track-row m-row ${it.id === sel ? 'selected' : ''}" data-mrow="${esc(it.id)}"><div class="m-clip t-${clsOf(it)} ${it.id === sel ? 'selected' : ''}" data-mclip="${esc(it.id)}" style="left:${it.start / last * 100}%;width:${Math.max(.6, it.dur / last * 100)}%" title="${esc(it.name)} · frame ${it.start}–${it.start + it.dur}"><i class="m-h l" data-h="l"></i><span>${esc(it.name)}</span><i class="m-h r" data-h="r"></i></div>${timelineKeys(it, last)}</div>`).join('');
  $('#mTrackLabels').style.transform = `translateY(-${$('#mScroll').scrollTop}px)`;
  $$('[data-mtl]').forEach(el => el.onclick = () => select(el.dataset.mtl));
  $$('[data-mclip]').forEach(el => el.onpointerdown = e => {
    e.preventDefault(); e.stopPropagation(); pause();
    const id = el.dataset.mclip, it = items().find(i => i.id === id); if (!it) return;
    if (sel !== id) { sel = id; renderItems(); renderInspector(); }
    checkpoint(); drag = { kind: 'clip', id, mode: e.target.dataset.h || 'move', x0: frameFromEvent(e), start: it.start, dur: it.dur, moveStart: it.moveStart, moveEnd: it.moveEnd, animDur: it.animDur, animStart: it.animStart, animEnd: it.animEnd, cameraKeys: it.preset === 'keyframed' ? clone(cameraKeysOf(it)) : null, moved: false };
    renderTimeline();
  });
  bindTimelineKeys();
  $$('[data-mrow]').forEach(el => el.onpointerdown = e => { if (e.target.closest('[data-mclip], [data-map-key]')) return; select(el.dataset.mrow); scrub(e); });
  audioUI?.renderTimeline();
}
function scrub(e) { pause(); setFrame(frameFromEvent(e)); drag = { kind: 'scrub' }; }
window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.kind === 'scrub') { const next = frameFromEvent(e); if (next !== frame) setFrame(next); return; }
  const it = items().find(i => i.id === drag.id); if (!it) return;
  const d = frameFromEvent(e) - drag.x0; if (d !== 0) drag.moved = true;
  if (drag.mode.startsWith('camera:')) {
    const from = +drag.mode.split(':')[1], to = clamp(from + d, it.start, it.start + it.dur);
    if (drag.lastTo === to) return; drag.lastTo = to;
    it.cameraKeys = clone(drag.cameraKeys); moveCameraKey(it, from, to, cameraTrackFields()); setFrame(to); updateTimelineItem(it); return;
  }
  if (drag.mode === 'animationStart' || drag.mode === 'animationEnd') {
    const keys = animationKeysOf({ start: drag.start, dur: drag.dur, animStart: drag.animStart, animEnd: drag.animEnd, animDur: drag.animDur, moveStart: drag.moveStart, moveEnd: drag.moveEnd });
    setAnimationKey(it, drag.mode, keys[drag.mode === 'animationStart' ? 'start' : 'end'] + d);
    updateTimelineItem(it); draw(); return;
  }
  let start = drag.start, dur = drag.dur;
  if (drag.mode === 'move') start = clamp(drag.start + d, 0, proj.frames - 1);
  else if (drag.mode === 'r') dur = Math.max(1, drag.dur + d);
  else { start = clamp(drag.start + d, 0, drag.start + drag.dur - 1); dur = drag.start + drag.dur - start; }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(dur) || !Number.isSafeInteger(start + dur)) return;
  it.start = drag.start; it.dur = drag.dur;
  if (drag.animStart !== undefined) { it.animStart = drag.animStart; it.animEnd = drag.animEnd; }
  if (drag.moveStart !== undefined) { it.moveStart = drag.moveStart; it.moveEnd = drag.moveEnd; }
  if (drag.cameraKeys) it.cameraKeys = clone(drag.cameraKeys);
  retimeMapItem(it, start, dur, drag.mode === 'move');
  const oldFrames = proj.frames; ensureLength(it.start + it.dur);
  if (proj.frames !== oldFrames) renderTimeline(); else updateTimelineItem(it);
  draw(); const s = $('#mInspector [data-mf="start"]'), l = $('#mInspector [data-mf="dur"]'); if (s) s.value = it.start; if (l) l.value = it.dur;
});
window.addEventListener('pointerup', () => { if (drag?.kind === 'clip') { if (!drag.moved) undoStack.pop(); changed(); renderInspector(); updateHistory(); } drag = null; });
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
  if (!await ensureDetail() && requiresDetail()) return;
  await preloadBadges(proj);
  const snapshot = clone(proj), exportName = fileBase();
  modal(exportMarkup({...snapshot, progressId:'mProgress', statusId:'mExportStatus'}));
  $('#mCloseModal').textContent = 'Cancel export'; exporting = true;
  const c = document.createElement('canvas'); c.width = snapshot.width; c.height = snapshot.height;
  const ec = c.getContext('2d');
  try {
    await loadFonts(mapFontsUsed(snapshot)); await document.fonts.ready;
    const video = await exportMapVideo({ audio: getAudioSnapshot('map'), canvas: c, fps: snapshot.fps, frames: snapshot.frames,
      draw: async f => {
        if (THEMES[snapshot.theme]?.imagery || THEMES[snapshot.theme]?.relief) {
          const provider = THEMES[snapshot.theme]?.relief ? geo.relief : geo.imagery;
          await provider.ready(imageryNeeds(snapshot, geo, c.width, c.height, f), () => !exporting);
          provider.prefetch(imageryNeeds(snapshot, geo, c.width, c.height, Math.min(f + 8, snapshot.frames - 1)));
        }
        drawMap(ec, c.width, c.height, snapshot, f, geo);
      },
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
    try { if (f.size > 5e6) throw Error('Project is larger than 5 MB.'); const p = validateMapProject(JSON.parse(await f.text())); pause(); checkpoint(); proj = p; audioUI?.reset(); sel = null; frame = 0; saveLocal(); renderAll(); notify('Map project opened'); } catch (err) { notify(err.message); }
    e.target.value = '';
  };
  $('#mExport').onclick = exportVideo;
  $('#mSnapshot').onclick = async () => { if (!geo || (!await ensureDetail() && requiresDetail())) return; await preloadBadges(proj); await loadFonts(mapFontsUsed(proj)); await document.fonts.ready; const c = document.createElement('canvas'); c.width = proj.width; c.height = proj.height; if (THEMES[proj.theme]?.relief) await geo.relief.ready(imageryNeeds(proj, geo, c.width, c.height, frame)); drawMap(c.getContext('2d'), c.width, c.height, proj, frame, geo); c.toBlob(b => download(b, fileBase() + `-frame-${frame}.png`), 'image/png'); };
  $('#mPlay').onclick = play; $('#mStart').onclick = () => { pause(); setFrame(0); }; $('#mEnd').onclick = () => { pause(); setFrame(proj.frames - 1); };
  $('#mPrev').onclick = () => { pause(); setFrame(frame - 1); }; $('#mNext').onclick = () => { pause(); setFrame(frame + 1); };
  $('#mLoop').onclick = () => { loop = !loop; $('#mLoop').classList.toggle('active', loop); };
  $('#mFrame').onchange = e => { pause(); setFrame(Math.round(+e.target.value * proj.fps)); };
  $('#mZoomT').oninput = () => { renderTimeline(); setFrame(frame); };
  $('#mMoveUp').onclick = () => moveItem(-1); $('#mMoveDown').onclick = () => moveItem(1);
  $('#mDuplicate').onclick = () => {
    if (audioUI?.duplicate()) return;
    const it = current(); if (!it) return; checkpoint();
    const c = clone(it); c.id = crypto.randomUUID(); c.name += ' copy'; retimeMapItem(c, Math.min(proj.frames - 1, it.start + 10), c.dur);
    if (!ensureLength(c.start + c.dur)) { notify('Choose an earlier start frame before duplicating this item.'); return; }
    (isShot(it) ? proj.shots : proj.actions).push(c); sel = c.id; saveLocal(); renderAll();
  };
  $('#mDelete').onclick = () => {
    if (audioUI?.remove()) return;
    const it = current(); if (!it) return; checkpoint();
    proj.shots = proj.shots.filter(s => s.id !== it.id); proj.actions = proj.actions.filter(a => a.id !== it.id);
    for (const s of proj.shots) if (s.planeId === it.id) s.planeId = '';
    sel = null; saveLocal(); renderAll();
  };
  $('#mNew').onclick = async () => { if (!await confirmStudio('Start an empty map? Your current edit can be restored with Undo.')) return; pause(); checkpoint(); proj = newMapProject(); audioUI?.reset(); sel = null; frame = 0; saveLocal(); renderAll(); };
  $('#mDemo').onclick = async () => { if (!await confirmStudio('Load the demo map? Your current edit can be restored with Undo.', 'Load demo', 'Load demo')) return; pause(); checkpoint(); proj = demoMapProject(); audioUI?.reset(); sel = null; frame = 0; saveLocal(); renderAll(); };
  $('#mHelp').onclick = () => modal(`<h2>Make a map animation.</h2><ol><li>Press <b>Border</b>, <b>Travel</b>, <b>Highlight</b> or <b>Pin</b>. It is added at the playhead.</li><li>Choose the place in the right panel. Type a city or country, enter <i>lat, lon</i>, or press <b>⌖</b> and click the map.</li><li>Pick a <b>camera preset</b> (Fly to, Cinematic swoop, Orbit, Follow plane…). It moves the camera for you.</li><li>Drag bars on the timeline to retime them. The bar controls visibility. Choose Animation in the keyframe property list and drag its two centered diamonds to set animation start and finish. Use arrow keys on a focused diamond for one frame, or Shift + arrows for ten frames. Moving objects can also enable movement start / end keyframes in Properties. Set <b>Animation duration (frames)</b> in Properties to control how long an item takes to animate. It disappears when its bar ends. Travel properties can also show the regions or countries crossed by a route.</li><li>In <b>Label style → Start from a style</b>, choose <b>2D · Attached to map</b> to lay existing labels flat on the map so they follow its tilt and rotation.</li><li>Press Space to preview, then <b>Export video</b>.</li></ol><p><b>Shortcuts:</b> Space play/pause · ← → one frame · Shift + arrows ten frames · Delete remove item · Ctrl/Cmd Z undo · Esc cancel map picking.</p>`);
  $('#mCloseModal').onclick = () => { if (exporting) { exporting = false; $('#mCloseModal').disabled = true; } else $('#mModal').close(); };
  $('#mModal').addEventListener('cancel', e => { if (exporting) { e.preventDefault(); exporting = false; } });
}

// ------------------------------------------------------------------ mode switch + shortcuts
function setMode(m) {
  document.body.classList.toggle('mode-map', m === 'map');
  document.body.classList.toggle('mode-paper', m === 'paper');
  $$('.modes [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  try { localStorage.setItem('frameflow-mode', m); } catch { /* ignore */ }
  window.dispatchEvent(new Event('frameflow:mode'));
  if (m === 'map') { ensureGeo(); renderAll(); } else { endPathDraw(true); pause(); }
}
$$('.modes [data-mode]').forEach(b => b.onclick = () => setMode(b.dataset.mode));
window.addEventListener('keydown', e => {
  if (!pathDraw || !document.body.classList.contains('mode-map') || document.activeElement?.classList.contains('ff-timeline-name-input')) return;
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  if (e.key === 'Escape' || (e.key === 'Enter' && !typing)) { e.preventDefault(); e.stopImmediatePropagation(); endPathDraw(); notify('Path ready'); }
  else if ((e.key === 'Backspace' || e.key === 'Delete') && !typing) {
    e.preventDefault(); e.stopImmediatePropagation();
    const a = proj.actions.find(x => x.id === pathDraw.id);
    if (a?.path?.length) { checkpoint(); a.path.pop(); syncPathEnds(a); changed(); renderInspector(); }
  }
}, true);
window.addEventListener('keydown', e => {
  if (!document.body.classList.contains('mode-map')) return;
  if (document.activeElement?.classList.contains('ff-timeline-name-input')) return;
  if (e.key === 'Escape' && pick) { cancelPick(); return; }
  if ($('#mModal').open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); history(e.shiftKey ? 'redo' : 'undo'); return; }
  if (e.code === 'Space') { e.preventDefault(); play(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); pause(); setFrame(frame + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('#mDelete').click(); }
});

function renderAll() { if(proj.area?.mode==='country'){proj.area={...proj.area,mode:'world',detailCountries:detailCountriesOf(proj.area)};saveLocal()} if (geo) { buildLists(); for (const c of wantedCountries()) if (!geo.details?.has(c) && !detailLoads.has(c)) void loadDetail(c); } if (pathDraw && !proj.actions.some(a => a.id === pathDraw.id)) { pathDraw = null; pathDrag = null; canvas.style.cursor = ''; $('#mHint').textContent = HINT; } renderSettings(); renderItems(); renderInspector(); renderTimeline(); setFrame(frame); updateHistory(); }

// Match Motion Studio: fullscreen the preview toolbar, canvas and transport.
const mapFullscreenRoot = document.querySelector('#mapStudio main');
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
audioUI = registerAudioStudio('map', {
 getSelected:()=>sel, getFrame:()=>frame, getFps:()=>proj.fps, getFrames:()=>proj.frames,
 select, pause, seek:setFrame, notify, updateHistory, visualCount:()=>items().length,
 addGrid:'#mAddGrid', list:'#mItems', counter:'#mItemCount', inspector:'#mInspector', inspectorTitle:'#mInspTitle',
 trackLabels:'#mTrackLabels', trackRows:'#mTrackRows', tracks:'#mTracks', actionButtons:['#mDuplicate','#mDelete']
});
renderAll();
let startMode = 'motion'; try { const saved = localStorage.getItem('frameflow-mode'); startMode = saved === 'map' || saved === 'paper' ? saved : 'motion'; } catch { /* ignore */ }
setMode(startMode)
// Independent map-settings drawer: keep item properties visible in the inspector.
{
  const open = document.querySelector('#mSettingsButton');
  const panel = document.querySelector('#mSettingsPanel');
  const close = document.querySelector('#mSettingsClose');
  if (open && panel && close) {
    const setOpen = enabled => {
      if (enabled && !panel.open) panel.showModal();
      else if (!enabled && panel.open) panel.close();
      open.setAttribute('aria-expanded', String(panel.open));
    };
    open.addEventListener('click', () => setOpen(!panel.open));
    close.addEventListener('click', () => setOpen(false));
    panel.addEventListener('close', () => open.setAttribute('aria-expanded', 'false'));
    panel.addEventListener('click', e => {
      const rect = panel.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) setOpen(false);
    });
  }
}

installTimelineControls({
 name:'map',timeline:'#mapStudio .timeline',scroll:'#mScroll',zoom:'#mZoomT',containers:['#mTrackLabels','#mItems'],
 rows:'[data-mtl],[data-mid],[data-audio-label],[data-audio-layer]',id:r=>r.dataset.mtl||r.dataset.mid||r.dataset.audioLabel||r.dataset.audioLayer,
 item:id=>audioUI?.item(id)||proj.actions.find(it=>it.id===id)||proj.shots.find(it=>it.id===id),oldButtons:['#mMoveUp','#mMoveDown','#mDuplicate','#mDelete'],
 enabled(id,action){if(audioUI?.item(id))return audioUI.rowEnabled(id,action);const i=proj.actions.findIndex(a=>a.id===id);return action==='up'?i>0:action==='down'?i>=0&&i<proj.actions.length-1:true;},
 action(id,action){if(audioUI?.item(id)){audioUI.rowAction(id,action);return;}pause();select(id);if(action==='visibility'){checkpoint();current().visible=current().visible===false;changed();renderInspector();}else if(action==='up'||action==='down')moveItem(action==='up'?-1:1);else document.querySelector(action==='duplicate'?'#mDuplicate':'#mDelete').click();}
});
