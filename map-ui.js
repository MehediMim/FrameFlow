import { duplicateLayers, removeLayers, arrangeLayers, copyLayers, pasteLayers } from './map-layer-actions.mjs?v=map-order-1';
import { installDirectMapEditing } from './map-direct-edit.mjs?v=add-submenu-1';
import { paintObjectPreviews } from './map-object-preview.mjs';
import { interfaceIcon, setIconButton } from './interface-icons.mjs';
import { bindObjectCascade } from './map-object-picker.mjs';
import { shapePicker } from './map-shape-picker.mjs';
import { mapBackgroundOf, validateMapBackground } from './map-background.mjs';
import { snapTimelineDelta } from './timeline-magnet.mjs';
import { SCENE_PANEL_DEFAULTS } from './map-scene-panel.mjs';
import { importObjectImage } from './map-object-images.mjs';
import { installTimelineControls } from './timeline-controls.mjs?v=typed-lanes-1';
import { HIGHLIGHT_ANIMATIONS, BORDER_ANIMATIONS, BORDER_STYLES, installCountryDetail, detailRegions, regionAt, citiesOf, drawRegionSelection, drawBorderEndpoints, drawHighlightExtentHandles, BADGE_SHAPES, BADGE_STEMS, BADGE_EXITS, badgeOf, onBadgeImage, preloadBadges } from './map-engine.mjs?v=live-follow-3';
import { detailFileOf, detailInfo, detailLevelOf, LEGACY_REGION_COUNTRY } from './map-country-details.mjs';
import { detailCountriesOf, targetMembers, targetFeatures, featureForTarget, combinedFeature, nearestBorderPosition, borderRingOf } from './map-regions.mjs';
import { OBJECT_ICONS, EFFECTS, SHAPES, OBJECT_ENTER, OBJECT_IDLE, OBJECT_EXIT } from './map-objects.mjs';
import { bindTimelineRename } from './timeline-rename.mjs?v=timeline-rename-2';
import { confirmStudio, exportMarkup } from './studio-ui.mjs?v=expanded-settings-1';
import { getAudioSnapshot, registerAudioStudio } from './audio-reference.mjs?v=add-submenu-1';
let audioUI = null;
// FrameFlow Map Studio: editor UI (animations, camera presets, timeline, playback, export).
import { THEMES, TEXTURES, DEFAULT_TEXTURE, LABEL_SHAPES, LABEL_WEIGHTS, DEFAULT_LABEL_STYLE, LABEL_PRESETS, TRAVEL_ICONS, labelStyleOf, mapFontsUsed, ACTION_TYPES, PRESETS, makeAction, makeShot, newMapProject, demoMapProject, validateMapProject, buildGeo, drawMap, screenToLonLat, countryAt, project as projectPoint, lonToX, latToY, DEFAULT_AREA, AREA_MODES, NEIGHBOR_MODES, PATH_CURVES, areaOf, drawPathEditor, pathHandles, imageryNeeds, PIN_MODES } from './map-engine.mjs?v=live-follow-3';
import { CITIES } from './map-places.mjs';
import { loadFont, loadFonts, fontPickerHtml, bindFontPicker } from './fonts.mjs';
import { exportMapVideo } from './map-video-export.mjs?v=invert-1';
import { createImagery, IMAGERY_SOURCES, DEFAULT_IMAGERY } from './map-imagery.mjs';
import { createRelief, RELIEF_DEFAULTS } from './map-relief.mjs';
import { atlasLabelSettings } from './map-atlas-labels.mjs';
import { applyDocumentaryLook, DOCUMENTARY_LABEL } from './map-documentary.mjs';
import { terrainSettingsOf } from './map-engine.mjs?v=live-follow-3';
import { plaqueStyle } from './map-plaque-text.mjs';
import { FORMATIONS, defaultObjectGap } from './map-formations.mjs';
import { objectPoseAt, putObjectKey, removeObjectKey, moveObjectKey, DAMAGE_STATES } from './map-object-keys.mjs';
import { ARMY_PRESETS } from './map-armies.mjs';
import { resolveLoc } from './map-engine.mjs?v=live-follow-3';
import { panMapCamera, zoomMapCamera } from './map-navigation.mjs?v=invert-1';
import { sampleCameraPreset, cameraTrackPoseAt, cameraAt, xToLon, yToLat, makeView } from './map-engine.mjs?v=live-follow-3';
import { retimeMapItem, animationKeysOf, setAnimationKey, splitMapItem } from './map-timing.mjs?v=paired-camera-1';
import { syncCameraTimeline, cameraKeyAt, addCameraPair, cameraKeysOf, putCameraKey, removeCameraKey, moveCameraKey, CAMERA_PROPERTIES, CAMERA_FIELDS } from './map-camera.mjs?v=live-follow-3';
import { trimMapHistory } from './map-history.mjs';
import { installCampaignUI } from './map-campaign-ui.mjs?v=path-flow-1';
import { groupPoseAt, putGroupKey } from './map-object-groups.mjs';
import { pathAt, putPathKey, movePathKey, NETWORK_SHAPES } from './map-path-animation.mjs';
import { moveGroupKey, retimeGroup } from './map-object-groups.mjs';
import { measureShape, measurementText } from './map-shape-measurements.mjs';
import { ZONE_TERRAINS, TERRAIN_CONTENTS } from './map-strategy-terrain.mjs';
import { OBJECT_CATEGORIES, objectEntries } from './map-object-catalog.mjs';
import { objectViewOf, OBJECT_VIEWS, isFrontArtwork } from './map-object-view.mjs';
import { objectAnimationOptions } from './map-isometric-objects.mjs';
import { naturalTrailKind } from './map-object-trails.mjs';
import { ROAD_STYLES, RAIL_STYLES, ROAD_MARKINGS } from './map-network-style.mjs';
import { lightingAt, LIGHTING_FIELDS as SUN_FIELDS, putLightingKey, removeLightingKey, moveLightingKey } from './map-lighting-keys.mjs';
import { lightingOf, lightingPreset } from './map-lighting.mjs';
import { planeRoute } from './map-engine.mjs?v=live-follow-3';
let cameraProperty = 'all', objectProperty = 'all', selectedCameraKeyId=null;
const objectTypeFilters = new Map();
const objectPreviewStates=new WeakMap();
const WALL_GLYPHS = ['stoneWall','palisade','earthwork','gatehouse','stoneFort','watchtower','bastion'];

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
let directMapEditing=null;
let timelineAutoFit=true;
let campaign=null;

// ------------------------------------------------------------------ helpers
const items = () => {
  const groups=proj.actions.filter(a=>a.type==='group'),members=new Set(groups.flatMap(g=>g.memberIds));
  return [...proj.shots].sort((a,b)=>a.start-b.start).concat(proj.actions.flatMap(a=>a.type==='group'?[a,...proj.actions.filter(o=>a.memberIds.includes(o.id))]:members.has(a.id)?[]:[a]));
};
function displayItems(){
  const all=[...proj.shots,...proj.actions],rank=new Map(all.map((a,i)=>[a.id,a.createdOrder??i+1]));
  const groups=proj.actions.filter(a=>a.type==='group'),members=new Set(groups.flatMap(g=>g.memberIds));
  return all.filter(a=>!members.has(a.id)).sort((a,b)=>rank.get(b.id)-rank.get(a.id)).flatMap(a=>a.type==='group'?[a,...proj.actions.filter(child=>a.memberIds.includes(child.id)).sort((a,b)=>rank.get(b.id)-rank.get(a.id))]:[a]);
}
const nextCreationOrder=()=>Math.max(0,...[...proj.shots,...proj.actions].map((a,i)=>a.createdOrder??i+1))+1;
function retimeEditorItem(it,start,dur,moveKeys=true){if(it.type==='group')retimeGroup(proj,it,start,dur,moveKeys);else retimeMapItem(it,start,dur,moveKeys);}
const current = () => items().find(i => i.id === sel);
const isShot = it => it.kind === 'shot';
const iconOf = it => (isShot(it) ? PRESETS[it.preset].icon : ACTION_TYPES[it.type].icon);
const clsOf = it => (isShot(it) ? 'shot' : it.type);
const planes = () => proj.actions.filter(a => a.type === 'plane' || (a.type === 'object' && ['path', 'move'].includes(a.mode)));
const followObjects = () => proj.actions.filter(a => ['plane','object','pin'].includes(a.type));
const cameraPoseAt = (s, at) => cameraTrackPoseAt(proj,geo,proj.width,proj.height,s,at);
const clone = o => JSON.parse(JSON.stringify(o));

function notify(s) {
  const t = $('#toast'); t.textContent = s; t.classList.add('show');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => t.classList.remove('show'), 2600); $('#mStatus').textContent = s;
}
function checkpoint() { undoStack.push(JSON.stringify(proj)); redoStack = []; trimMapHistory(undoStack, redoStack); updateHistory(); }
function updateHistory() { const a=audioUI?.historyState(); $('#mUndo').disabled = a?!a.undo:!undoStack.length; $('#mRedo').disabled = a?!a.redo:!redoStack.length; }
function ensureCameraTrack() {
  return syncCameraTimeline(proj, pose => makeShot('keyframed', 0, {dur:proj.frames, createdOrder:0, followInitialView:true, cameraFrom:pose, cameraTo:{...pose}, cameraKeys:[]}));
}
function captureViewAtPlayhead() {
  pause(); finishMapPan(); const pose = captureCamera(); checkpoint();selectedCameraKeyId=null;
  const shot = ensureCameraTrack();proj.camera.activeTrack=shot.id;
  if (frame > 0 && !cameraKeysOf(shot).length) setCameraKey(shot, 0, shot.cameraFrom);
  setCameraKey(shot, frame, pose); previewCamera = null; sel = shot.id;
  changed(); renderInspector(); notify('Map view saved at playhead');
}
function saveLocal() { ensureCameraTrack(); try { localStorage.setItem(STORE, JSON.stringify(proj)); $('#mSaveState').textContent = 'Saved locally'; } catch { $('#mSaveState').textContent = 'Save project to keep changes'; } }
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
  for (const it of [...proj.actions, ...proj.shots]) for (const target of [it.target, it.from, it.to, it.place,...(it.highlightExclude||[])]) for(const t of targetMembers(target)) { const c = regionCountryOf(t); if (c) set.add(c); }
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
  if (['__members','__excluded'].includes(pick?.key)) { const a = current(); if (a && regionTarget(a)) drawRegionSelection(ctx, lastView, geo, pick.key==='__excluded'?(a.highlightExclude||[]):targetMembers(a.target)); }
  if(!playing&&current()?.visible!==false){drawBorderEndpoints(ctx,lastView,geo,current());drawHighlightExtentHandles(ctx,lastView,geo,current());}
  $('#mResetView').hidden = !previewCamera;
  if (pathDraw) { const a = proj.actions.find(x => x.id === pathDraw.id); if (a) drawPathEditor(ctx, lastView, a); }
  campaign?.overlay(ctx,lastView);
  directMapEditing?.overlay(ctx,lastView);
}
function setFrame(n) {
  if (pick?.kinds === 'cameraCenter' && Math.round(n) !== frame) cancelPick();
  if (!pathDraw && !pick) previewCamera = null;
  const nextFrame=clamp(Math.round(n)||0,0,proj.frames-1);
  if(pathDraw){const a=proj.actions.find(a=>a.id===pathDraw.id);if(a?.type==='shape'&&a.pathKeys?.length&&(nextFrame<a.start||nextFrame>a.start+a.dur))endPathDraw(true);}
  if(nextFrame!==frame&&pathDraw){const a=proj.actions.find(a=>a.id===pathDraw.id);if(a?.type==='shape'&&a.pathKeys?.length)a.path=pathAt(a,nextFrame);}
  frame = nextFrame;
  $('#mFrame').value = +(frame / proj.fps).toFixed(3); $('#mFrame').max = +((proj.frames - 1) / proj.fps).toFixed(3); $('#mFrame').step = '0.001';
  $('#mTimecode').textContent = [Math.floor(frame / proj.fps / 60), Math.floor(frame / proj.fps) % 60, frame % proj.fps].map(x => String(x).padStart(2, '0')).join(':');
  $('#mPlayhead').style.left = `${frame / (proj.frames - 1) * 100}%`;
  draw();
  if (current()?.type === 'object') updateObjectInspector(current());
  if(current()?.fx==='sunlight'){updateSunlightInspector(current());for(const el of $$('#mTrackRows [data-map-key^="lighting:"]'))el.classList.toggle('current',el.dataset.keyItem===sel&&el.dataset.mapKey===`lighting:${frame}`);}
  if (current()?.preset === 'keyframed') { if (!playing) updateCameraInspector(current()); updateCameraKeySelection(); }
  if(!playing&&['shape','group'].includes(current()?.type))renderInspector();
  window.dispatchEvent(new CustomEvent("ff-frame",{detail:{studio:"map",frame,fps:proj.fps,playing}}));
}
function updatePlayControl() {
  $('#mPlay').innerHTML = interfaceIcon(playing ? 'pause' : 'play');
  $('#mPlay').setAttribute('aria-label', playing ? 'Pause playback' : 'Play animation');
  $('#mPlay').setAttribute('aria-pressed', String(playing));
}
function pause() { playing = false; cancelAnimationFrame(raf); updatePlayControl(); window.dispatchEvent(new CustomEvent('ff-play',{detail:{studio:'map',playing:false,frame,fps:proj.fps}})); }
function play() {
  if (playing) { pause(); return; }
  if (frame >= proj.frames - 1) frame = 0;
  playing = true; startTime = performance.now(); startFrame = frame; updatePlayControl(); window.dispatchEvent(new CustomEvent('ff-play',{detail:{studio:'map',playing:true,frame,fps:proj.fps}}));
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
const regionTarget = a => ['country', 'region', 'regions', 'polygon'].includes(a?.target?.kind);
const memberLabel = t => (t.kind === 'region' && geo?.byName.get(t.name)?.name) || t.name;
const membersOf = a => (regionTarget(a)&&a.target.kind!=='polygon' ? [...targetMembers(a.target)] : []);
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
function excludeMember(a,loc,toggle=false){
  const list=[...(a.highlightExclude||[])],index=list.findIndex(t=>regionKey(t)===regionKey(loc));
  if(index>=0){if(!toggle){notify(`${memberLabel(loc)} is already excluded`);return false;}list.splice(index,1);}
  else if(list.length>=100){notify('A highlight can exclude up to 100 regions');return false;}
  else list.push(loc);
  a.highlightExclude=list;return true;
}
function excludedRegionFields(a){
  if(a.type!=='highlight')return '';
  const picking=pick?.key==='__excluded'&&pick.id===a.id;
  return `<div class="m-region-chips">${(a.highlightExclude||[]).map((t,i)=>`<button type="button" data-mexclude-remove="${i}" title="Include this region again">${esc(memberLabel(t))} &times;</button>`).join('')}</div>`
    +`<div class="m-loc"><label>Exclude region<input data-mexclude list="mDlCountry" placeholder="Type a region or country" autocomplete="off"></label><button type="button" data-mexclude-pick class="${picking?'active':''}" title="Click regions on the map to exclude or include them">&#8982;</button></div>`
    +(picking?'<p class="mini-label">Click a region to exclude it. Click it again to include it. Shift-click picks a whole country. Press the picker or Esc when done.</p>':'');
}
/** "Separately": every selected region becomes its own item (same look and timing) that can then be retimed or partly animated on its own. */
function splitRegions(a) {
  const list = membersOf(a); if (list.length < 2) return;
  if (proj.actions.length + list.length - 1 > 200) { notify('A map can contain up to 200 items'); return; }
  pause(); checkpoint();
  const base = a.name, copies = list.slice(1).map((t,i) => { const c = clone(a); c.id = crypto.randomUUID();c.createdOrder=nextCreationOrder()+i; c.target = t; delete c.borderRing; c.name = `${base} · ${memberLabel(t)}`; return c; });
  a.target = list[0]; delete a.borderRing; a.name = `${base} · ${memberLabel(list[0])}`;
  proj.actions.splice(proj.actions.indexOf(a) + 1, 0, ...copies);
  changed(); renderInspector(); notify(`Split into ${list.length} separate items. Undo to combine them again.`);
}
function regionFields(a) {
  const list = membersOf(a), picking = pick?.key === '__members' && pick.id === a.id, border = a.type === 'border';
  if(a.target.kind==='polygon')return `<p class="mini-label">Custom region: ${esc(a.target.name)} · ${a.target.path.length} boundary points</p>`+campaign.regionFields(a)+`<button type="button" data-mregpick>⌖ Pick existing regions instead</button>`+excludedRegionFields(a);
  return `<div class="m-regions"><span class="mini-label">${border ? 'Countries / regions' : isDetail() ? 'Regions / countries' : 'Countries'} <b class="m-val">${list.length}</b></span>`
    + `<div class="m-region-chips">${list.map((t, i) => `<button type="button" data-mrm="${i}" title="Remove from this item">${esc(memberLabel(t))} ×</button>`).join('')}</div>`
    + `<div class="m-loc"><label>Add another<input data-madd data-kinds="${border ? 'border' : 'country'}" list="${border ? 'mDlBorder' : 'mDlCountry'}" placeholder="Type a ${isDetail() ? 'region or country' : 'country'}" autocomplete="off"></label><button type="button" data-mregpick class="${picking ? 'active' : ''}" title="Click regions on the map to add or remove them (Shift-click = whole country)">⌖</button></div>`
    + (picking ? '<p class="mini-label">Click the map to add or remove regions. Shift-click picks a whole country. Press ⌖ or Esc when done.</p>' : '')
    + excludedRegionFields(a)
    + (isDetail() ? '' : '<p class="mini-label">For states, districts and other local regions, add that country under <button type="button" class="link" data-mopenset>Map settings → Country details</button>.</p>')
    + (list.length > 1 ? `<label>Several regions<select data-mcombine><option value="together" selected>Together as one region</option><option value="separate">Separately, as different regions</option></select></label><p class="mini-label">Together draws one outline around all of them. Separately makes one item per region, so each can be timed or partly animated on its own.</p>` : '')
    + campaign.regionFields(a) + '</div>';
}
function buildStaticUI() {
  $('#mAddGrid').innerHTML = Object.entries(ACTION_TYPES).filter(([, a]) => !a.hidden).map(([k, a]) => `<button data-madd="${k}" title="${esc(a.hint)}"><b>${interfaceIcon(k)}</b>${a.label}</button>`).join('')+`<button type="button" data-measure-add title="Measure distance or area on the map"><b>${interfaceIcon('measure')}</b>Measure</button>`;
  $('#mPresets').innerHTML = Object.entries(PRESETS).map(([k, p]) => `<button data-mpre="${k}" title="${esc(p.hint)}"><b>${interfaceIcon(k)}</b><span>${p.label}</span></button>`).join('');
  $$('[data-madd]').forEach(el => el.onclick = () => addAction(el.dataset.madd));
  $('[data-measure-add]').onclick=()=>{endPathDraw(true);addAction('shape',{shape:'distance',name:SHAPES.distance.label,color:SHAPES.distance.color,curve:'straight',path:[]});};
  $$('[data-mpre]').forEach(el => el.onclick = () => addShot(el.dataset.mpre));
  $('#mTheme').innerHTML = Object.entries(THEMES).map(([k, t]) => `<option value="${k}">${t.label}</option>`).join('');
  $('#mImagery').innerHTML = Object.entries(IMAGERY_SOURCES).map(([k, x]) => `<option value="${k}">${x.label}</option>`).join('');
  if (!$('#mTexture')) $('#mTextureSlot').innerHTML = `
    <section id="mTextureSection" class="m-settings-group">
      <h4>Texture</h4>
      <label>Surface <select id="mTexture">${Object.entries(TEXTURES).map(([k, label]) => `<option value="${k}">${label}</option>`).join('')}</select></label>
      <label>Strength <span class="m-val" id="mTextureStrengthValue"></span><input aria-label="Texture strength" id="mTextureStrength" type="range" min="0" max="100" step="1"></label>
      <label>Scale <span class="m-val" id="mTextureScaleValue"></span><input aria-label="Texture scale" id="mTextureScale" type="range" min="50" max="300" step="10"></label>
    </section>`;
}
function suggestTarget() {
  const c = current(), src = c && c.type ? c : [...proj.actions].reverse()[0];
  if (!src) return null;
  const t = src.type === 'border' || src.type === 'highlight' ? src.target : ['pin', 'object', 'effect'].includes(src.type) ? src.place : src.type === 'plane' ? src.to : null;
  return t && t.kind !== 'all' ? clone(t) : null;
}
function addAction(type,extra={}) {
  if(type==='label'){type='pin';extra={showIcon:false,showLabel:true,label:'Your label',labelPlacement:'map',offsetX:0,offsetY:0,labelStyle:{...DEFAULT_LABEL_STYLE,...LABEL_PRESETS.atlasGround.style},...extra};}
  if(type==='plane'){type='object';extra={mode:'move',glyph:'jet',place:{kind:'city',name:'London',lat:51.5072,lon:-.1276},to:{kind:'city',name:'New York',lat:40.7128,lon:-74.006},...extra};}
  const explicitPlace=!!extra.place;
  const dc = detailCountry();
  if (dc && !geo?.details?.has(dc)) { notify(detailErrors.has(dc) ? `${dc} detail could not load. Check map settings for Retry.` : `Loading ${dc} detail. Try again in a moment.`); return; }
  pause(); checkpoint();
  if(type==='pin'&&!extra.place){const[lon,lat]=centerLonLat();extra={...extra,place:{kind:'point',name:'Map position',lon:((lon+180)%360+360)%360-180,lat}};}
  const a = makeAction(type, frame,extra); if (!ensureLength(a.start + a.dur)) { notify('Choose an earlier start frame for this animation.'); return; }
  if(['object','pin','effect'].includes(type)){endPathDraw(true);cancelPick();campaign?.cancel();}
  if (isDetail()) { if ((type === 'border' || type === 'highlight')&&!extra.target) a.target = defaultRegion(); const cities = localCities(); const loc = c => ({kind:'city',name:c[0],lat:c[1],lon:c[2]}); if (['pin', 'object', 'effect'].includes(type) && cities.length&&!extra.place) a.place = loc(cities[0]); if (type === 'plane' && cities.length > 1) { a.from=loc(cities[0]); a.to=loc(cities[1]); } }

  a.createdOrder=nextCreationOrder();proj.actions.push(a); sel = a.id; saveLocal(); renderAll(); notify(`${ACTION_TYPES[type].label} added at frame ${frame}`);
  if (type === 'shape') startPathDraw(a.id);
  else if(['object','pin','effect'].includes(type)&&a.fx!=='sunlight'&&!explicitPlace)startPick('place','place');
}
function addShot(preset) {
  if (preset === 'keyframed') { pause();sel=ensureCameraTrack().id;renderAll();return; }
  const needsPlane=PRESETS[preset].fields.includes('planeId');
  const candidates=preset==='followPlane'?followObjects():planes();
  if(needsPlane&&!candidates.length){notify('Add an object or traveler to follow first');return;}
  pause();const pose=captureCamera(),c=current(),extra={};
  const target=suggestTarget();if(target)extra.target=target;
  if(needsPlane)extra.planeId=(candidates.find(a=>a.id===c?.id)||candidates.find(a=>frame>=a.start&&frame<a.start+a.dur)||candidates[0]).id;
  const movement=makeShot(preset,frame,extra);
  if(preset==='followPlane'){
    const object=candidates.find(a=>a.id===extra.planeId);
    if(frame>=object.start+object.dur){notify('Move the playhead inside the object timeline before adding Follow object');return;}
    movement.dur=object.start+object.dur-frame;
  }
  checkpoint();
  if(!ensureLength(movement.start+movement.dur+1))return;
  const track=ensureCameraTrack(),samples=sampleCameraPreset(proj,geo,proj.width,proj.height,movement,pose);
  const keys=addCameraPair(track,preset,frame,frame+movement.dur,samples);
  if(preset==='followPlane')keys[0].follow={planeId:movement.planeId,zoom:movement.zoom,pitch:movement.pitch,lockHeading:movement.lockHeading,easing:movement.easing,from:pose};
  proj.camera.activeTrack=track.id;selectedCameraKeyId=keys[0].id;sel=track.id;previewCamera=null;
  saveLocal();renderAll();notify(`${PRESETS[preset].label} added as paired camera keyframes`);
}
function migrateCameraMovements(){
  const track=ensureCameraTrack(),legacy=proj.shots.filter(s=>s.id!==track.id);if(!geo||!legacy.length)return;
  const original=clone(proj);delete original.camera.activeTrack;
  for(const movement of legacy.sort((a,b)=>a.start-b.start)){
    if(movement.preset==='keyframed'){for(const key of cameraKeysOf(movement))if(key.frame>=movement.start&&key.frame<=movement.start+movement.dur){ensureLength(key.frame+1);putCameraKey(track,key.frame,key.values);}continue;}
    const c=cameraAt(original,geo,proj.width,proj.height,movement.start),pose={lon:xToLon(c.cx),lat:yToLat(c.cy),zoom:c.zoom,pitch:c.pitch,bearing:c.bearing};
    const end=movement.start+movement.dur;ensureLength(end+1);
    const pair=addCameraPair(track,movement.preset,movement.start,end,sampleCameraPreset(original,geo,proj.width,proj.height,movement,pose));
    if(movement.preset==='followPlane')pair[0].follow={planeId:movement.planeId,zoom:movement.zoom,pitch:movement.pitch,lockHeading:movement.lockHeading,easing:movement.easing,from:pose};
  }
  if(legacy.some(s=>s.id===sel))sel=track.id;
  proj.shots=[track];proj.camera.activeTrack=track.id;saveLocal();
}
function setCameraKey(shot,at,values){
  proj.camera.activeTrack=shot.id;
  const selected=selectedCameraKeyId&&cameraKeyAt(shot,at,selectedCameraKeyId);
  if(selected?.pairId){
    const start=cameraKeysOf(shot).find(k=>k.pairId===selected.pairId&&k.follow);
    if(start){const live=cameraPoseAt(shot,at);values=Object.fromEntries(Object.entries(values).map(([field,value])=>[field,clamp(value-live[field]+selected.values[field],...CAMERA_FIELDS[field])]));}
  }
  return putCameraKey(shot,at,values,selected?.frame===at?selected.id:undefined);
}
function deleteCameraKeyAt(shot,at,id){
  const key=cameraKeyAt(shot,at,id);if(!key)return;
  pause();checkpoint();removeCameraKey(shot,key.frame,Object.keys(CAMERA_FIELDS),key.id);selectedCameraKeyId=null;previewCamera=null;
  changed();renderInspector();notify(key.pairId?'Camera movement pair deleted':'Camera keyframe deleted');
}
function captureCamera() {
  const c = previewCamera || cameraAt(proj, geo, proj.width, proj.height, frame);
  return { lon: clamp(xToLon(c.cx), -540, 540), lat: clamp(yToLat(c.cy), -85, 85), zoom: c.zoom, pitch: c.pitch, bearing: clamp(c.bearing, -3600, 3600) };
}
function renderItems() {
  const its = displayItems();
  $('#mItemCount').textContent = its.length;
  $('#mItems').innerHTML = its.length ? its.map(it => `<div class="m-item ${it.id === sel ? 'selected' : ''}" data-mid="${esc(it.id)}"><span class="type c-${clsOf(it)}">${it.type === 'object' ? `<img class="m-object-thumb" data-object-preview="${esc(it.glyph)}" data-object-view="${esc(objectPoseAt(it,frame).objectView)}" style="${it.objectDirection==='left'?'transform:scaleX(-1)':''}" alt="">` : iconOf(it)}</span><span class="name">${esc(it.name)}</span><span class="when">${it.start}</span></div>`).join('') : '<p class="muted m-empty">Add a layer above, or right-click the map to place one.</p>';
  paintObjectPreviews($('#mItems'));
  $$('[data-mid]').forEach(el => el.onclick = e => selectFromList(el.dataset.mid,e));
  $('#mDuplicate').disabled = $('#mDelete').disabled = !current() || !!current().fullTimelineCamera;
  $('#mSplit').disabled = !!current()?.fullTimelineCamera;
  audioUI?.renderList();
  campaign?.decorateItems();
  updateMoveButtons();
}
/** Step the selected layer up or down the list. Camera shots follow their start time, so only animations and audio layers move. */
function moveItem(dir) {
  if (audioUI?.isSelected()) { if (typeof audioUI.move === 'function') audioUI.move(dir); return; }
  const it = current(); if (!it) return;
  if (isShot(it)) { notify('Camera shots are ordered by their start time'); return; }
  const list = proj.actions, i = list.indexOf(it), j = i - dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  pause(); checkpoint();const all=[...proj.shots,...list],first=it.createdOrder??all.indexOf(it)+1,second=list[j].createdOrder??all.indexOf(list[j])+1;it.createdOrder=second;list[j].createdOrder=first; [list[i], list[j]] = [list[j], list[i]];
  saveLocal(); renderItems(); renderTimeline(); draw();
}
function updateMoveButtons() {
  let up = false, down = false;
  if (audioUI?.isSelected()) { if (typeof audioUI.canMove === 'function') { up = audioUI.canMove(-1); down = audioUI.canMove(1); } }
  else { const it = current(), i = it && !isShot(it) ? proj.actions.indexOf(it) : -1; up = i >= 0 && i < proj.actions.length - 1; down = i > 0; }
  $('#mMoveUp').disabled = !up; $('#mMoveDown').disabled = !down;
}
function runLayerAction(ids,action){
  const layers=items().filter(a=>ids.includes(a.id)&&!a.fullTimelineCamera);if(!layers.length)return [];
  pause();const snapshot=clone(proj);let result=[];
  try{
    if(action==='duplicate')result=duplicateLayers(snapshot,layers.map(a=>a.id));
    else if(action==='delete')removeLayers(snapshot,layers.map(a=>a.id));
    else if(action==='visibility'){for(const a of [...snapshot.shots,...snapshot.actions])if(ids.includes(a.id))a.visible=layers.some(a=>a.visible===false);}
    else if(['forward','backward','front','back'].includes(action))arrangeLayers(snapshot,ids,action);
    checkpoint();proj=snapshot;sel=result.at(-1)||(action==='delete'?null:sel);
    directMapEditing?.setSelection(result.length?result:action==='delete'?[]:ids);saveLocal();renderAll();return result;
  }catch(error){notify(error.message);return [];}
}
let layerClipboard=null;
function copySelectedLayers(){
  if(audioUI?.isSelected()){
    layerClipboard={audio:audioUI.copySelection()};notify('Audio layer copied');return true;
  }
  const copied=copyLayers(proj,directMapEditing?.selectionIds()||[sel]);
  if(!copied){notify('Select a layer to copy');return false;}
  layerClipboard=copied;notify(copied.roots.length>1?'Layers copied':'Layer copied');return true;
}
function pasteCopiedLayers(){
  if(!layerClipboard){notify('Copy a layer first');return false;}
  pause();
  if(layerClipboard.audio){
    ensureLength(frame+Math.ceil(layerClipboard.audio.duration*proj.fps));
    audioUI.pasteLayer(layerClipboard.audio);notify('Audio pasted at playhead');return true;
  }
  try{
    const snapshot=clone(proj),ids=pasteLayers(snapshot,layerClipboard,frame);
    validateMapProject(snapshot);checkpoint();proj=snapshot;sel=ids.at(-1);directMapEditing?.setSelection(ids);
    saveLocal();renderAll();notify(ids.length>1?'Layers pasted at playhead':'Layer pasted at playhead');return true;
  }catch(error){notify(error.message);return false;}
}
function selectFromList(id,event){
  if(event?.shiftKey&&directMapEditing?.toggleSelection(id))return;
  directMapEditing?.setSelection([id]);select(id);
}
function select(id) { if (pathDraw && pathDraw.id !== id) endPathDraw(true); if (pick && pick.id !== id) cancelPick(); sel = id; renderItems(); renderInspector(); renderTimeline();draw(); }

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
  if (!it) { box.innerHTML = '<p class="muted">Select a layer on the canvas or timeline to edit it.<br><br>Add a <b>Border</b>, <b>Object</b>, <b>Highlight</b> or <b>Pin / label</b>, then pick a camera preset. Presets move the camera for you.</p>'; $('#mInspTitle').textContent = 'Properties'; return; }
  const shot = isShot(it);
  $('#mInspTitle').textContent = shot ? 'Camera shot' : it.type==='shape'&&['distance','area'].includes(it.shape)?'Measure':ACTION_TYPES[it.type].label;
  let h = `<div class="inspector-title"><span>${iconOf(it)}</span> <em id="mInspName">${esc(it.name)}</em></div>`;
  if(it.type==='group'){
    const member=proj.actions.find(a=>it.memberIds.includes(a.id)),pose=groupPoseAt(it,frame);
    h+='<div class="section-title">MOVEMENT</div>'+F.sel('__groupMove','Movement',it.groupMove||'stay',[['stay','Stay'],['move','Move to destination']])
      +(it.groupMove==='move'?F.loc('__groupDestination','Destination',it.groupDestination,'place'):'')
      +'<div class="section-title">GROUP TRANSFORM</div>'+campaign.groupFields(it)+F.sel('easing','Motion',it.easing,EASE_OPTS)
      +(member?.sizeMode==='map'?F.num('__groupSizeZoom','Anchor zoom',member.sizeZoom??3,0,14,.1):'')
      +F.range('__groupScale','Size',pose.scale,.1,8,.05,x=>x.toFixed(2)+'x')
      +'<div class="section-title">COLOR &amp; SIZING</div>'+F.color('__groupColor','Color',it.color||member?.color||'#a7b887')
      +F.sel('__groupSizeMode','Sizing',member?.sizeMode||'screen',[['screen','Fixed on screen'],['map','Scale with map']]);


    box.innerHTML=h;bindInspector(it);campaign.bind(it);return;
  }
  if(it.type==='effect'&&it.fx==='sunlight'){
    h+=effectPicker(it.fx)+sunlightFields(it)+F.sel('easing','Transition',it.easing,EASE_OPTS);
    box.innerHTML=h;bindInspector(it);bindSunlightInspector(it);updateSunlightInspector(it);return;
  }
  if(it.type==='object'){
    h+=objectFields(it)+(it.glyph==='portrait'?'':labelFields(it));
    box.innerHTML=h;bindInspector(it);campaign?.bind(it);bindObjectKeys(it);bindArmyFields(it);updateObjectInspector(it);return;
  }
  if(['highlight','border'].includes(it.type)){
    h+=actionFields(it)+'<div class="section-title">ANIMATION</div>'+F.sel('easing','Motion',it.easing,EASE_OPTS)+labelFields(it);
    box.innerHTML=h;bindInspector(it);campaign?.bind(it);return;
  }
  if(!shot){
    const title={pin:'POSITION & DISPLAY',label:'POSITION & TEXT',effect:'EFFECT & POSITION',shape:'SHAPE & PATH',plane:'MOVEMENT & ROUTE',scene:'CONTENT & LAYOUT'}[it.type]||'PROPERTIES';
    h+='<div class="section-title">'+title+'</div>'+actionFields(it)+'<div class="section-title">ANIMATION</div>'+F.sel('easing','Motion',it.easing,EASE_OPTS)+labelFields(it);
    box.innerHTML=h;bindInspector(it);campaign?.bind(it);return;
  }
  if (shot) h += F.sel('preset', 'Camera move', it.preset, Object.entries(PRESETS).map(([k, p]) => [k, p.label]));
  h += isShot(it) && it.preset === 'keyframed' ? F.sel('__cameraTrack', 'Keyframe property', cameraProperty, [['all', 'Camera - All properties'], ...Object.entries(CAMERA_PROPERTIES).map(([k,p]) => [k,p.label])]) : it.type === 'object' ? F.sel('__objectTrack','Keyframe property',objectProperty,[['all','All object tracks'],['animation','Appearance / movement'],['size','Size'],['objectAngle','Rotation'],['objectView','Object view'],['damageState','Damage state']].filter(([key])=>key!=='objectView'||!isFrontArtwork(it.glyph))) : '';
  h += '<p class="mini-label">' + (shot && it.preset === 'keyframed' ? 'Edit the camera at the playhead. Changes create keyframes automatically. Choose a property to see and retime its diamonds.' : 'The timeline bar controls when this layer appears and disappears. Drag the two centered diamonds to set when its animation starts and finishes.') + '</p>' + F.sel('easing', 'Motion', it.easing, EASE_OPTS);
  h += '<div class="section-title m-sep">' + (shot ? 'CAMERA' : 'LOOK') + '</div>';
  if (shot) h += (it.preset === 'keyframed' ? cameraMovementFields(it) : '') + shotFields(it); else h += actionFields(it) + labelFields(it);
  box.innerHTML = h; bindInspector(it); campaign?.bind(it); if (it.type === 'object') {  bindObjectKeys(it); bindArmyFields(it); updateObjectInspector(it); }
}
function sunlightFields(a){
  const pose=lightingAt(a,frame);
  const fields=[['azimuth','Sun direction',0,360,1],['altitude','Sun elevation',-20,85,1],['intensity','Sunlight strength',0,2,.05],['ambient','Ambient light',0,1,.02],['warmth','Warmth',-1,1,.05],['shadowStrength','Shadow strength',0,1,.05]];
  return '<div class="section-title">WHOLE FRAME LIGHTING</div><p class="mini-label">Move the playhead, then edit a value or choose a look to create keyframes. Lighting and shadows animate across the whole canvas.</p>'
    +'<label>Lighting look<select data-sun-preset><option value="custom">Custom / animated</option><option value="day">Daylight</option><option value="golden">Golden hour</option><option value="dusk">Dusk</option><option value="night">Night</option></select></label>'
    +fields.map(([key,label,min,max,step])=>`<label>${label}<input type="range" data-sun-field="${key}" min="${min}" max="${max}" step="${step}" value="${pose[key]}"><output data-sun-value="${key}"></output></label>`).join('')
    +'<div class="two"><button type="button" data-sun-capture>Add keyframe</button><button type="button" data-sun-delete>Delete keyframe</button></div><p class="mini-label" data-sun-status></p>';
}
function bindSunlightInspector(a){
  const values=pose=>Object.fromEntries(SUN_FIELDS.map(k=>[k,pose[k]]));
  $('#mInspector [data-sun-preset]').onchange=e=>{if(e.target.value==='custom')return;pause();checkpoint();putLightingKey(a,frame,values(lightingPreset(e.target.value)));changed();updateSunlightInspector(a);};
  for(const el of $$('#mInspector [data-sun-field]')){
    let editing=false;
    el.oninput=()=>{pause();if(!editing){checkpoint();editing=true;}putLightingKey(a,frame,{[el.dataset.sunField]:+el.value});draw();updateSunlightInspector(a);};
    el.onchange=()=>{editing=false;changed();updateSunlightInspector(a);};
  }
  $('#mInspector [data-sun-capture]').onclick=()=>{pause();checkpoint();putLightingKey(a,frame,values(lightingAt(a,frame)));changed();updateSunlightInspector(a);};
  $('#mInspector [data-sun-delete]').onclick=()=>{pause();checkpoint();removeLightingKey(a,frame);changed();updateSunlightInspector(a);};
}
function updateSunlightInspector(a){
  const pose=lightingAt(a,frame),outside=frame<a.start||frame>a.start+a.dur;
  for(const el of $$('#mInspector [data-sun-field]')){const key=el.dataset.sunField;el.value=pose[key];el.disabled=outside;const out=$(`#mInspector [data-sun-value="${key}"]`);if(out)out.textContent=lightValue(key,Math.round(pose[key]*100)/100);}
  const preset=$('#mInspector [data-sun-preset]');if(!preset)return;preset.value='custom';preset.disabled=outside;
  const hasKey=a.lightingKeys?.some(k=>k.frame===frame);
  $('#mInspector [data-sun-capture]').disabled=outside;$('#mInspector [data-sun-delete]').disabled=outside||!hasKey;
  $('#mInspector [data-sun-status]').textContent=outside?'Move the playhead inside this effect clip to edit.':`Frame ${frame} · ${hasKey?'Keyframe':'Interpolated light'} · ${a.lightingKeys?.length||0} keys. Drag timeline diamonds to retime; Delete removes a focused key.`;
}
function bannerFields(a) {
  return `<div class="m-badge"><span class="mini-label">Flag artwork</span><div class="two"><button type="button" data-badgeimg>${a.image ? 'Change image?' : 'Choose image?'}</button><button type="button" data-badgeclear ${a.image ? '' : 'disabled'}>Remove</button></div><input type="file" accept="image/*" data-badgefile hidden><p class="mini-label">Upload your artwork. The cloth hangs from a rigid crossbar and waves in the wind. Its proportions follow your uploaded image.</p>`
    + F.chk('bannerWind', 'Wind animation', a.bannerWind !== false)
    + F.range('bannerWindStrength', 'Wind strength', a.bannerWindStrength ?? .45, 0, 1, .05, x => Math.round(x * 100) + '%')
    + F.range('bannerWindSpeed', 'Wind speed', a.bannerWindSpeed ?? 1, .1, 3, .1, x => x.toFixed(1) + 'x')
    + F.range('bannerAspect', 'Cloth width / height', a.bannerAspect ?? (a.glyph==='flag'?1.5:.75), .35, 2.5, .05, x => x.toFixed(2))
    + F.color('color', 'Cloth background', a.color)
    + F.chk('bannerPole', 'Show wooden pole', a.bannerPole !== false)
    + F.color('bannerPoleColor', 'Wood color', a.bannerPoleColor || '#65503a')
    + (a.glyph==='flag'?'':F.chk('bannerPlaque', 'Show title plaque', a.bannerPlaque !== false)
    + F.text('bannerTitle', 'Plaque title', a.bannerTitle || '', 100, 'e.g. Richard Hakluyt') + (a.bannerPlaque!==false?plaqueTextFields(a):'')) + '</div>';
}
function plaqueTextFields(a) {
  const st=plaqueStyle(a);
  return '<div class="section-title">'+(a.glyph==='portrait'?'NAME PLAQUE STYLE':'PLAQUE TEXT STYLE')+'</div>'
    +fontPickerHtml('mPlaqueFont','Font family',st.font)
    +F.range('plaqueSize','Text size',st.size,4,48,.5,x=>x+' px')
    +F.num('plaqueWeight','Font weight',st.weight,400,900,100)
    +F.chk('plaqueItalic','Italic',st.italic)
    +F.color('plaqueColor','Text color',st.color)
    +F.chk('plaqueFit','Auto-fit text inside plaque / ribbon',st.fit)
    +'<p class="mini-label">Text size follows the object scale. Turn off auto-fit to keep the chosen size; extra text is clipped.</p>';
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
const shrinkImage = importObjectImage;
function portraitFields(a) {
  return `<div class="m-badge"><span class="mini-label">Your portrait image</span>${a.image?`<img class="m-portrait-image-preview" src="${esc(a.image)}" alt="Selected ruler portrait">`:'<p class="mini-label">Choose your own ruler photo or illustration for a weathered wooden frame.</p>'}<div class="two"><button type="button" data-badgeimg>${a.image?'Change portrait image…':'Upload portrait image…'}</button><button type="button" data-badgeclear ${a.image?'':'disabled'}>Remove</button></div><input type="file" accept="image/*,.svg,.png" aria-label="Upload ruler portrait image" data-badgefile hidden></div>`
    + '<p class="mini-label">Upload a ruler or commander portrait. The portrait, aged name plaque and wooden stand move together.</p>'
    + F.color('color','Portrait backdrop',a.color)
    + F.color('badgeBorder','Wooden frame color',a.badgeBorder||'#4c4032')
    + F.range('badgeZoom','Zoom portrait',a.badgeZoom??1,1,4,.05)
    + F.range('badgeX','Move portrait left / right',a.badgeX??0,-100,100,1)
    + F.range('badgeY','Move portrait up / down',a.badgeY??0,-100,100,1)
    + plaqueTextFields(a);
}
function artworkFields(a) {
  return `<div class="m-badge"><span class="mini-label">SVG / PNG artwork</span><div class="two"><button type="button" data-badgeimg>${a.image ? 'Change image?' : 'Choose image?'}</button><button type="button" data-badgeclear ${a.image ? '' : 'disabled'}>Remove</button></div><input type="file" accept="image/*,.svg,.png" data-badgefile hidden><p class="mini-label">Transparent artwork keeps its proportions, without a badge or frame. SVG is embedded as a high-resolution image for saving and export.</p></div>`;
}
function objectFields(a) {
  if(isFrontArtwork(a.glyph)&&objectProperty==='objectView')objectProperty='all';
  const pose={mirror:a.objectDirection==='left',...objectPoseAt(a,frame),...lastView?.objectFacings?.get(a.id)},wall=a.mode==='wallPath',units=a.armyUnits||ARMY_PRESETS.pikeShot.units,total=units.reduce((n,u)=>n+u.count,0);
  const imageObject=['portrait','image','artwork','banner','flag'].includes(a.glyph);
  const naturalTrail=naturalTrailKind(a.glyph),trailLabel=naturalTrail==='tracks'?'Leave tire tracks':naturalTrail==='wake'?'Leave water wake':'Draw a trail';
  const animations=objectAnimationOptions(a.glyph),animation=animations.some(([key])=>key===a.objectAnimation)?a.objectAnimation:'auto';
  const artwork=()=>a.glyph==='portrait'?portraitFields(a):a.glyph==='image'?badgeFields(a):a.glyph==='artwork'?artworkFields(a):bannerFields(a);
  const positionOptions=[...Object.entries(PIN_MODES),...(WALL_GLYPHS.includes(a.glyph)?[['wallPath','Walls along a drawn path']]:[])];
  return '<div class="section-title">OBJECT TYPE</div>'+objectPicker(a.glyph,pose.objectView)
    +(isFrontArtwork(a.glyph)?'':F.sel('objectView','Object view',pose.objectView,Object.entries(OBJECT_VIEWS)))
    +(!isFrontArtwork(a.glyph)&&(!['path','move'].includes(a.mode)||a.objectFacing==='manual')?F.sel('objectDirection','Facing direction',a.objectDirection||'right',[['right','Right'],['left','Left']]):'')
    +(isFrontArtwork(a.glyph)?'':'<details class="m-advanced-controls" data-advanced-facing><summary>Advanced view &amp; facing</summary>'
    +(['path','move'].includes(a.mode)?F.sel('objectFacing','Facing',a.objectFacing||'path',[['path','Automatic - follow path'],['manual','Manual view keyframes']])+'<p class="mini-label">Automatic facing follows the direction of movement.</p>':'')
    +'<button type="button" data-object-key="objectView">Key view</button></details>')
    +(imageObject?'<div class="section-title">YOUR IMAGE &amp; STYLE</div>'+artwork():'')
    +'<div class="section-title">MOVEMENT</div>'
    +F.sel('__pinMove','Movement',a.mode||'stay',positionOptions)
    +(a.mode==='move'?F.loc('to','Destination',a.to,'place'):'')
    +(['path','wallPath'].includes(a.mode)?pathFields(a):F.loc('place',a.mode==='move'?'Start position':'Location',a.place,'place'))
    +(['move','path'].includes(a.mode)?F.chk('trail',a.trailStyle==='route'?'Draw route line':trailLabel,a.trail!==false)+(naturalTrail!=='route'?F.sel('trailStyle','Trail appearance',a.trailStyle||'auto',[['auto',naturalTrail==='tracks'?'Tire tracks':'Water wake'],['route','Route line']]):''):'')
    +'<div class="section-title">APPEARANCE</div>'
    +F.range('opacity','Opacity',a.opacity??1,0,1,.05,x=>Math.round(x*100)+'%')
    +(a.glyph==='image'?'':F.sel('damageState','Damage state',pose.damageState,Object.entries(DAMAGE_STATES)))
    +'<div class="section-title">ANIMATION</div>'
    +(animations.length>2?F.sel('objectAnimation','Object animation',animation,animations)+(animation==='none'?'':F.range('objectAnimationSpeed','Animation speed',a.objectAnimationSpeed??1,.25,4,.25,x=>x+'x')):'')
    +(a.glyph==='image'?'':'<div class="two">'+F.sel('enter','Appears',a.enter,OBJECT_ENTER)+F.sel('exit','Disappears',a.exit,OBJECT_EXIT.map(([key,label])=>[key,key==='none'?'Stay to end':label]))+'</div>'+F.sel('idle','While visible',a.idle,OBJECT_IDLE))
    +F.sel('easing','Motion',a.easing,EASE_OPTS)
    +F.sel('__objectTrack','Keyframe property',objectProperty,[['all','All object tracks'],['animation','Appearance / movement'],['size','Size'],['objectAngle','Rotation'],['objectView','Object view'],['damageState','Damage state']].filter(([key])=>key!=='objectView'||!isFrontArtwork(a.glyph)))
    +objectKeyFields(a)
    +'<div class="section-title">LAYOUT &amp; SIZE</div>'
    +(a.sizeMode==='map'?F.num('sizeZoom','Anchor zoom',a.sizeZoom??3,0,14,.1):'')
    +F.range('size','Size',pose.size,.2,8,.05,x=>x.toFixed(2)+'x')
    +F.num('objectAngle','Rotation (degrees)',pose.objectAngle,-3600,3600,1)
    +(wall?'':F.num('count',a.glyph==='army'?'Army copies':'Count',a.count??1,1,a.glyph==='army'?Math.max(1,Math.floor(100/total)):100,1)+formationFields(a)+`<div class="two">${F.num('gapX','Horizontal gap',a.gapX??defaultObjectGap(a),0,1000)}${F.num('gapY','Vertical gap',a.gapY??defaultObjectGap(a),0,1000)}</div>`)
    +(wall?F.range('wallSpacing','Segment spacing',a.wallSpacing??52,12,120,1,x=>x+' px')+F.num('wallTowerEvery','Tower every N segments',a.wallTowerEvery??8,0,50)+F.chk('wallGate','Gate in the middle',!!a.wallGate):'')
    +(a.glyph==='army'?armyFields(a):'')
    +(imageObject?'':'<div class="section-title">COLOR</div>'+F.color('color',a.glyph==='army'?'Trail color':'Color',a.color))
    +F.sel('sizeMode','Sizing',a.sizeMode||'screen',[['screen','Fixed on screen'],['map','Scale with map']])
    +'<div class="section-title">LABEL</div>'+F.chk('showLabel',a.glyph==='portrait'?'Show name plaque':'Show label',a.showLabel)+(a.showLabel?F.text('label',a.glyph==='portrait'?'Plaque name':'Label text',a.label,60,'Uses the default name'):'');
}

function objectKeyFields(a) {
  const labels={size:'Size',objectAngle:'Rotation',damageState:'Damage'};
  return F.chk('autoObjectKey','Auto-key edits at the playhead',!!a.autoObjectKey)
    + `<div class="m-object-key-buttons">${Object.entries(labels).filter(([field])=>a.glyph!=='image'||field!=='damageState').map(([field,title])=>`<button type="button" data-object-key="${field}">Key ${title}</button>`).join('')}</div><p class="mini-label">Size and rotation interpolate. View and damage switch at their keyframes. Move the playhead inside this bar, then enable Auto-key or press a Key button.</p>`;
}
function bindObjectKeys(a) {
  $$('#mInspector [data-object-key]').forEach(el=>el.onclick=()=>{
    if(frame<a.start||frame>a.start+a.dur)return;
    const field=el.dataset.objectKey,key=a.objectKeys?.find(k=>k.frame===frame&&k.values[field]!==undefined),value=field==='objectView'?(lastView?.objectFacings?.get(a.id)?.objectView??objectPoseAt(a,frame).objectView):objectPoseAt(a,frame)[field];
    pause();checkpoint();if(field==='objectView')a.objectFacing='manual';if(key)removeObjectKey(a,frame,[field]);else putObjectKey(a,frame,{[field]:value});changed();updateObjectInspector(a);
  });
}
function updateObjectInspector(a) {
  const pose={mirror:a.objectDirection==='left',...objectPoseAt(a,frame),...lastView?.objectFacings?.get(a.id)},outside=frame<a.start||frame>a.start+a.dur;
  for(const field of ['size','objectAngle','objectView','damageState']){
    const el=$(`#mInspector [data-mf="${field}"]`);if(!el)continue;
    if(document.activeElement!==el){el.value=pose[field];const out=el.parentElement.querySelector('.m-val');if(out)out.textContent=field==='size'?pose.size.toFixed(2)+'x':pose[field];}
    el.disabled=outside&&(field==='objectView'&&['move','path'].includes(a.mode)||a.autoObjectKey||a.objectKeys?.some(k=>k.values[field]!==undefined));
  }
  const previewRoots=[$('#mInspector'),document.querySelector('#mMapContext'),document.querySelector('body > .m-object-cascade'),...$$('#mItems [data-mid]').filter(el=>el.dataset.mid===a.id)];
  for(const root of previewRoots.filter(Boolean)){
    const stamp=pose.objectView+':'+!!pose.mirror,previous=objectPreviewStates.get(root);
    if(previous?.stamp===stamp&&previous.first===root.firstElementChild)continue;
    let changedView=false;
    for(const img of root.querySelectorAll('img[data-object-view]')){const transform=pose.mirror?'scaleX(-1)':'';if(img.style.transform!==transform)img.style.transform=transform;if(img.dataset.objectView!==pose.objectView){img.dataset.objectView=pose.objectView;changedView=true;}}
    if(changedView)paintObjectPreviews(root);
    objectPreviewStates.set(root,{stamp,first:root.firstElementChild});
  }
  $$('#mInspector [data-object-key]').forEach(el=>{const field=el.dataset.objectKey,has=a.objectKeys?.some(k=>k.frame===frame&&k.values[field]!==undefined);el.disabled=outside;el.classList.toggle('current',!!has);el.textContent=(has?'Remove ':'Key ')+({size:'size',objectAngle:'rotation',objectView:'view',damageState:'damage'}[field]);});
}
function writeObjectValue(a,field,value) {
  if(a.type==='object'&&['size','objectAngle','objectView','damageState'].includes(field)&&(a.autoObjectKey||a.objectKeys?.some(k=>k.values[field]!==undefined))){
    const at=clamp(frame,a.start,a.start+a.dur);putObjectKey(a,at,{[field]:value});
  }else a[field]=value;
}
function armyFields(a){
  const units=a.armyUnits||ARMY_PRESETS.pikeShot.units,options=Object.entries(OBJECT_ICONS).filter(([key])=>!['army','image','banner','artwork'].includes(key));
  const presets=[...Object.entries(ARMY_PRESETS).map(([key,p])=>[key,p.name]),...(proj.armyPresets||[]).map(p=>['saved:'+p.id,p.name])];
  return `<div class="section-title m-sep">MIXED ARMY</div><label>Start from a formation<select data-army-preset><option value="">Choose a preset</option>${presets.map(([key,name])=>`<option value="${esc(key)}">${esc(name)}</option>`).join('')}</select></label>`
    + F.text('armyName','Formation name',a.armyName||'My army',60)
    + units.map((unit,i)=>`<div class="m-army-row"><select aria-label="Unit type" data-army-unit="${i}">${options.map(([key,icon])=>`<option value="${key}" ${key===unit.glyph?'selected':''}>${esc(icon.label)}</option>`).join('')}</select><input aria-label="Unit count" type="number" min="1" max="100" value="${unit.count}" data-army-count="${i}"><input aria-label="Unit color" type="color" value="${unit.color||a.color}" data-army-color="${i}"><button type="button" data-army-remove="${i}" aria-label="Remove unit row">Remove</button></div>`).join('')
    + '<div class="two"><button type="button" data-army-add>Add unit type</button><button type="button" data-army-save>Save formation</button></div><p class="mini-label">Up to 100 units per object. Saved formations stay in this project and can be reused by another Army object.</p>';
}
function bindArmyFields(a){
  if(a.glyph!=='army')return;
  const copyUnits=()=>clone(a.armyUnits||ARMY_PRESETS.pikeShot.units);
  const edit=fn=>{pause();checkpoint();a.armyUnits=copyUnits();fn(a.armyUnits);a.count=1;changed();renderInspector();};
  const preset=$('#mInspector [data-army-preset]');preset.onchange=()=>{const p=preset.value.startsWith('saved:')?proj.armyPresets?.find(p=>p.id===preset.value.slice(6)):ARMY_PRESETS[preset.value];if(!p)return;edit(()=>{a.armyUnits=clone(p.units);a.armyName=p.name;a.name=p.name;});};
  $$('#mInspector [data-army-unit]').forEach(el=>el.onchange=()=>edit(units=>{units[+el.dataset.armyUnit].glyph=el.value;units[+el.dataset.armyUnit].color=OBJECT_ICONS[el.value].color;}));
  $$('#mInspector [data-army-count]').forEach(el=>el.onchange=()=>edit(units=>{const i=+el.dataset.armyCount,available=100-units.reduce((n,u,j)=>n+(j===i?0:u.count),0);units[i].count=clamp(Math.round(Number(el.value)||1),1,available);}));
  $$('#mInspector [data-army-color]').forEach(el=>el.onchange=()=>edit(units=>units[+el.dataset.armyColor].color=el.value));
  $$('#mInspector [data-army-remove]').forEach(el=>el.onclick=()=>{if(copyUnits().length>1)edit(units=>units.splice(+el.dataset.armyRemove,1));});
  $('#mInspector [data-army-add]').onclick=()=>{const units=copyUnits();if(units.length>=20||units.reduce((n,u)=>n+u.count,0)>=100){notify('This formation has reached its unit limit.');return;}edit(units=>units.push({glyph:'musketeer',count:1,color:'#9d4d40'}));};
  $('#mInspector [data-army-save]').onclick=()=>{if((proj.armyPresets?.length||0)>=30){notify('This project can store 30 army presets.');return;}checkpoint();a.name=a.armyName||'My army';(proj.armyPresets||=[]).push({id:crypto.randomUUID(),name:(a.armyName||'My army').slice(0,60),units:copyUnits()});changed();renderInspector();notify('Army formation saved in this project');};
}
function formationFields(a) {
  return '<div class="section-title m-sep">FORMATION</div>' + F.sel('formation', 'Arrange copies', a.formation || 'grid', Object.entries(FORMATIONS))
    + (['grid','staggered'].includes(a.formation || 'grid') ? F.num('formationCols', 'Columns (0 = automatic)', a.formationCols ?? 0, 0, 100) + F.sel('formationAlign', 'Last row alignment', a.formationAlign || 'center', [['left','Left'],['center','Center'],['right','Right']]) : '')
    + F.range('formationAngle', 'Formation angle', a.formationAngle ?? 0, -180, 180, 5, x => x + ' degrees')
    + '<p class="mini-label">Count creates copies within this item. Formation rotates their positions; facing rotates each illustration. Joined wall segments also follow the formation angle.</p>';
}
function effectPicker(fx) {
  const options = battle => Object.entries(EFFECTS).filter(([,e])=>!!e.battle===battle).map(([key,e])=>`<option value="${key}" ${key===fx?'selected':''}>${esc(e.label)}</option>`).join('');
  return `<label>Effect<select data-mf="fx" data-t="sel"><optgroup label="Battle &amp; siege">${options(true)}</optgroup><optgroup label="General effects">${options(false)}</optgroup></select></label>`;
}
function effectLocationFields(a){
  if(a.fx==='strike')return F.loc('from','Launch from',a.from,'place')+F.loc('place','Target',a.place,'place');
  if(['cannonShot','musketVolley','arrowVolley'].includes(a.fx)&&a.attackTargeted){
    const objects=proj.actions.filter(item=>item.type==='object'),options=[['','Manual location'],...objects.map(item=>[item.id,item.name])];
    return F.sel('attackSourceId','Source object (optional)',a.attackSourceId||'',options)+F.loc('from','From location',a.from,'place')
      +F.sel('attackTargetId','Target object (optional)',a.attackTargetId||'',options)+F.loc('place','Target location',a.place,'place')
      +'<p class="mini-label">Linked objects are tracked as they move. Manual locations are used if a linked object is removed. Projectiles land at the target; direction and reach are automatic.</p>';
  }
  return F.loc('place','Location',a.place,'place');
}
function battleFields(a) {
  const targeted=['cannonShot','musketVolley','arrowVolley'].includes(a.fx);
  return (targeted?F.chk('attackTargeted','Attack from source to target',!!a.attackTargeted):'')
    + F.num('battleIntensity','Intensity / number of shots',a.battleIntensity??5,1,12)
    + (targeted&&a.attackTargeted?'':F.range('battleAngle','Direction',a.battleAngle??0,-180,180,5,x=>x+' degrees')
    + F.range('battleRange','Reach / spread area',a.battleRange??180,40,800,10,x=>x+' px')
    + F.range('battleSpread','Volley angle spread',a.battleSpread??35,0,120,5,x=>x+' degrees'));
}
function objectPicker(glyph,view='side') {
  view=objectViewOf({objectView:view});
  const entries=objectEntries;
  return `<div class="m-object-picker"><span class="mini-label">Object</span>
    <select data-object-type hidden aria-label="Object type">${[['all','All types'],...OBJECT_CATEGORIES].map(([key,label])=>`<option value="${key}" ${key===(objectTypeFilters.get(sel)||'all')?'selected':''}>${esc(label)}</option>`).join('')}</select>
    <select data-mf="glyph" data-t="sel" aria-label="Object" hidden>${OBJECT_CATEGORIES.map(([group,label])=>`<optgroup label="${esc(label)}">${entries(group).map(([key,icon])=>`<option value="${key}" ${key===glyph?'selected':''}>${esc(icon.label)}</option>`).join('')}</optgroup>`).join('')}</select>
    <details data-object-menu><summary aria-label="Choose object"><img data-object-preview="${glyph}" data-object-view="${esc(view)}" alt=""><span>${esc(OBJECT_ICONS[glyph]?.label||'Choose an object')}</span><span class="m-object-caret" aria-hidden="true">&#9662;</span></summary>
    <div class="m-object-cascade" hidden><div class="m-object-types" role="menu" aria-label="Object types">${OBJECT_CATEGORIES.map(([group,label])=>`<button type="button" role="menuitem" data-object-category="${group}" aria-haspopup="true" aria-expanded="false"><span>${esc(label)}</span><span aria-hidden="true">&#8250;</span></button>`).join('')}</div>
    <div class="m-object-submenus">${OBJECT_CATEGORIES.map(([group,label])=>`<div data-object-category-panel="${group}" role="listbox" aria-label="${esc(label)}" hidden><h4>${esc(label)}</h4>${entries(group).map(([key,icon])=>`<button type="button" class="m-object-choice" role="option" data-object-choice="${key}" aria-selected="${key===glyph}"><img data-object-preview-lazy="${key}" data-object-view="${esc(view)}" alt=""><span>${esc(icon.label)}</span></button>`).join('')}</div>`).join('')}</div></div></details></div>`;
}

function highlightExtentFields(a) {
  const mode = a.highlightExtent || 'full';
  return '<div class="section-title">HIGHLIGHT EXTENT</div>'
    + F.sel('highlightExtent', 'Fill extent', mode, [['full', 'Full country / region'], ['percentage', 'Percentage spread'], ['radius', 'Radius / two points']])
    + (mode === 'percentage' ? F.num('highlightPercent', 'Spread (%)', a.highlightPercent ?? 100, 0, 100, .1) + '<p class="mini-label">How far the fill spreads from its start point. 100% reaches the whole region; lower values stop the spread earlier. This controls distance, not land area.</p>' : '')
    + (mode === 'radius' ? F.num('radius', 'Radius (km)', a.radius ?? 400, 1, 20000, 1) + '<button type="button" data-highlight-radius>Pick radius end on map</button><p class="mini-label">Pick the fill start point, then pick an end point to set its radius. The highlight stays inside the selected country or region.</p>' : '');
}
function highlightAppearanceFields(a) {
  return F.sel('highlightFill','Highlight fill',a.highlightFill||'color',[['color','Solid color'],['gradient','Two-color gradient'],['stripes','Diagonal stripes'],['dots','Dots'],['flag','Uploaded flag / image']])
    + (a.highlightFill==='gradient'?F.color('highlightColor2','Second gradient color',a.highlightColor2||'#ffffff'):'')
    + F.sel('highlightAnimation','Fill animation',a.highlightAnimation||'radial',HIGHLIGHT_ANIMATIONS)
    + (a.highlightFill==='flag'?`<div class="m-badge"><span class="mini-label">Flag image</span><div class="two"><button type="button" data-badgeimg>${a.image?'Change flag':'Upload flag'}</button><button type="button" data-badgeclear ${a.image?'':'disabled'}>Remove</button></div><input type="file" accept="image/*,.svg,.png" data-badgefile hidden><p class="mini-label">Upload PNG, SVG or another image. It fills the selected country or region. Until uploaded, the highlight uses its color.</p></div>`
      + F.sel('flagFit','Image fitting',a.flagFit||'cover',[['cover','Fill boundary (crop)'],['stretch','Stretch whole flag']])
      + F.range('flagOpacity','Flag opacity',a.flagOpacity??.9,0,1,.05,x=>Math.round(x*100)+'%')
      + F.range('flagZoom','Flag zoom',a.flagZoom??1,1,4,.05,x=>x+'x')
      + F.range('flagX','Horizontal image position',a.flagX??0,-100,100,1,x=>x+'%')
      + F.range('flagY','Vertical image position',a.flagY??0,-100,100,1,x=>x+'%')
      + F.chk('flagRelief','Preserve relief shading in terrain style',a.flagRelief!==false):'');
}
function scenePanelFields(a) {
  const d={...SCENE_PANEL_DEFAULTS,...a};
  return F.sel('panelSide','Gradient side',d.panelSide,[['left','Left'],['right','Right']])
    + F.range('panelWidth','Panel width',d.panelWidth,25,70,1,x=>x+'%')
    + F.sel('panelAlign','Text position',d.panelAlign,[['top','Top'],['center','Center'],['bottom','Bottom']])
    + '<div class="section-title m-sep">YEAR &amp; EVENT</div>'
    + F.chk('autoYear','Advance year automatically',d.autoYear)
    + F.num('startYear',d.autoYear?'Starting year':'Year',d.startYear,1,9999)
    + (d.autoYear?F.num('endYear','Ending year',d.endYear,1,9999):'')
    + F.sel('yearEra','Year suffix',d.yearEra,[['','None'],['CE','CE'],['BCE','BCE']])
    + F.text('eventTitle','Event name',d.eventTitle,160)
    + `<label>Description<textarea data-mf="description" data-t="text" rows="5" maxlength="2000">${esc(d.description)}</textarea></label>`
    + '<p class="mini-label">The year advances between the animation diamonds on this bar. Use {year} in your title or description to include the current year. Add another Scene panel for the next event.</p>'
    + '<div class="section-title m-sep">APPEARANCE</div>'
    + F.color('panelColor','Gradient color',d.panelColor)+F.range('panelOpacity','Gradient opacity',d.panelOpacity,0,1,.05,x=>Math.round(x*100)+'%')
    + F.color('accentColor','Year color',d.accentColor)+F.color('textColor','Text color',d.textColor)
    + F.range('textScale','Text size',d.textScale,.6,2,.05,x=>x.toFixed(2)+'x')
    + F.range('fadeSeconds','Fade in / out (seconds)',d.fadeSeconds,0,2,.05,x=>x.toFixed(2)+'s');
}
function shapeMeasurementFields(a) {
  const area=a.shape==='area',current={...a,curve:'straight'};
  const measurement=measureShape(current,planeRoute(geo,current));
  return F.sel('measurementUnit','Units',a.measurementUnit||'metric',[['metric','Kilometres / km\u00b2'],['imperial','Miles / mi\u00b2']])
    +(area?F.chk('showAreaBoundary','Show zone boundary',!!a.showAreaBoundary):F.chk('showDistanceArrow','Show arrow between points',!!a.showDistanceArrow))
    +`<p class="mini-label" data-shape-measurement>${area?'Area':'Distance'}: ${measurementText(measurement)}</p>`
    +`<p class="mini-label">${area?'Draw at least three corners to measure a zone.':'Pick two points to measure their distance.'} The measurement is static text on the map.</p>`;
}

function actionFields(a) {
  switch (a.type) {
    case 'group': return campaign.groupFields(a);
    case 'scene': return scenePanelFields(a);
    case 'label': return F.sel('__pinDisplay','Display','text',[['both','Pin + text'],['icon','Pin only'],['text','Text only']]) + F.text('text', 'Text', a.text, 160, 'Your label') + F.sel('labelPlacement', 'Anchor', a.labelPlacement || 'screen', [['map', 'Geographic position'], ['screen', 'Canvas position']]) + (a.labelPlacement === 'map' ? F.loc('place', 'Position on map', a.place, 'place') + F.num('offsetX', 'Horizontal offset', a.offsetX ?? 0, -1000, 1000) + F.num('offsetY', 'Vertical offset', a.offsetY ?? 0, -1000, 1000) : F.num('x', 'Horizontal position (%)', a.x ?? 50, 0, 100) + F.num('y', 'Vertical position (%)', a.y ?? 15, 0, 100));
    case 'border': return (regionTarget(a) ? regionFields(a) : F.loc('target', 'Country / region', a.target, 'border') + '<p class="mini-label">Type a country or region to choose specific ones. You can then add more.</p>') + (regionTarget(a) && !a.borderPartial ? F.num('borderFrom','Border animation start (%)',a.borderFrom ?? 0,0,100,.1) + '<button type="button" data-borderpoint="borderFrom">Pick start on border</button>' + F.chk('borderReverse','Reverse direction',a.borderReverse) : '') + F.chk('borderPartial','Animate part of the border',a.borderPartial) + (a.borderPartial ? `<div class="two">${F.num('borderFrom','From (%)',a.borderFrom ?? 0,0,100,.1)}${F.num('borderTo','To (%)',a.borderTo ?? 100,0,100,.1)}</div><div class="two"><button type="button" data-borderpoint="borderFrom">Pick start on border</button><button type="button" data-borderpoint="borderTo">Pick end on border</button></div>` + F.chk('borderReverse','Reverse direction',a.borderReverse) + '<p class="mini-label">Click near the outline to set each endpoint. Start and end follow the same outline; each island has its own outline.</p>' : '') + F.sel('borderStyle','Border style',a.borderStyle||'solid',BORDER_STYLES) + F.sel('borderAnimation','Border animation',a.borderAnimation||'draw',BORDER_ANIMATIONS) + F.color('color', 'Line color', a.color) + F.range('width', 'Line width', a.width, 1, 12, .5) + F.chk('glow', 'Glow', a.glow) + (a.borderPartial ? '' : F.range('fillAlpha', 'Fill after drawing', a.fillAlpha, 0, .6, .02, x => Math.round(x * 100) + '%')) + F.chk('invert', 'Invert (start fully drawn, then shrink away)', a.invert);
    case 'plane': return F.sel('icon', 'Icon', a.icon || 'plane', Object.entries(TRAVEL_ICONS).map(([k, i]) => [k, i.label])) + (a.icon === 'money' ? F.text('symbol', 'Coin symbol', a.symbol ?? '$', 4, '$  €  £  ৳  ₹  ¥') : '') + F.sel('mode', 'Travel along', a.mode === 'path' ? 'path' : 'direct', [['direct', 'Start → end (flight arc)'], ['path', 'My own path (draw points)']]) + (a.mode === 'path' ? pathFields(a) : F.loc('from', 'From', a.from, 'place') + F.loc('to', 'To', a.to, 'place')) + F.color('color', 'Trail color', a.color) + F.color('planeColor', 'Icon color', a.planeColor) + `<div class="two">${F.num('size', 'Icon size', a.size, 8, 80)}${F.num('lift', 'Arc height', a.lift, 0, 300)}</div>` + F.range('width', 'Trail width', a.width, 1, 12, .5) + F.chk('glow', 'Glow', a.glow) + F.chk('dashed', 'Dashed trail', a.dashed) + F.chk('showPath', 'Show planned route', a.showPath) + (a.mode === 'path' ? F.chk('showWaypoints', 'Show path points', a.showWaypoints !== false) : '') + F.chk('showLabels', 'Show place names', a.showLabels) + (a.showLabels ? F.text('fromLabel', 'Start label text', a.fromLabel, 80, 'Uses the place name') + F.text('toLabel', 'End label text', a.toLabel, 80, 'Uses the place name') : '') + routeLabelFields(a);
    case 'highlight': {
      const country = ['country','region','regions','polygon'].includes(a.target.kind);
      return F.sel('__hmode', 'Highlight a', country ? 'country' : 'place', [['country', isDetail() ? 'Region' : 'Country'], ['place', 'Place (radius)']]) + (country ? regionFields(a) + '<div class="section-title">FILL START POINT</div>' + F.loc('highlightOrigin', 'Highlight fill starts from', a.highlightOrigin, 'place') + '<button type="button" data-highlight-reset>Reset to region center</button><p class="mini-label">Pick a point on the map or enter latitude, longitude. Circular spread grows outward from this point. Other animations use the region boundary.</p>' : F.loc('target', 'Place', a.target, 'place')) + (country?highlightExtentFields(a)+highlightAppearanceFields(a):'') + (country && THEMES[proj.theme]?.relief ? F.color('reliefColor', 'Highlight color', a.reliefColor || terrainSettingsOf(proj).highlightColor) + F.range('reliefOpacity', 'Highlight opacity', a.reliefOpacity ?? terrainSettingsOf(proj).highlightOpacity, 0, 1, .05, x => Math.round(x * 100) + '%') : F.color('color', 'Color', a.color)) + (country ? '' : F.num('radius', 'Radius (km)', a.radius, 5, 10000)) + F.range('dim', 'Dim the rest of the map', a.dim, 0, .85, .05, x => Math.round(x * 100) + '%') + F.chk('pulse', 'Pulse', a.pulse) + F.chk('invert', 'Invert (start fully shown, then shrink away)', a.invert) + (country?F.chk('showFill','Fill region',a.showFill!==false):'') + F.chk('showLabel', 'Show label', a.showLabel) + F.text('label', 'Label text', a.label, 60, 'Uses the place name');
    }
    case 'object': return objectFields(a);
    case 'effect': return effectPicker(a.fx) + (EFFECTS[a.fx]?.battle ? battleFields(a) : '') + effectLocationFields(a) + F.color('color', 'Color', a.color) + F.range('size', 'Size', a.size, .4, 6, .1, x => x + '×') + (EFFECTS[a.fx]?.battle || ['explosion', 'shockwave', 'quake', 'strike'].includes(a.fx) ? F.num('repeat', 'Repeat', a.repeat || 1, 1, 10, 1) : '') + F.chk('showLabel', 'Show label', a.showLabel) + (a.showLabel ? F.text('label', 'Label text', a.label, 60, 'Uses the default name') : '');
    case 'shape': {
      const measurement=['distance','area'].includes(a.shape);
      return shapePicker(SHAPES,a.shape)
        +(['arrow','retreat'].includes(a.shape)?F.sel('__arrowStyle','Arrow style',a.shape,[['arrow','Advance'],['retreat','Retreat']]):['zone','noFly'].includes(a.shape)?F.sel('__zoneStyle','Zone style',a.shape,[['zone','Solid'],['noFly','Restricted']]):'')
        +'<div class="section-title">GEOMETRY</div>'+pathFields(a)
        + (a.shape==='zone'?landscapeFields(a):'')
        + (measurement?'<div class="section-title">MEASUREMENT</div>'+shapeMeasurementFields(a):'')
        + '<div class="section-title">APPEARANCE</div>'
        + (['road','railway'].includes(a.shape)?networkDesignFields(a):F.color('color', 'Color', a.color))
        + (!['road','railway'].includes(a.shape)&&(!measurement||a.showDistanceArrow||a.showAreaBoundary)?F.range('width', 'Line width', a.width, 1, 16, .5):'')
        + (['zone','noFly'].includes(a.shape)||a.shape==='area'&&a.showAreaBoundary?F.range('fillAlpha', 'Fill', a.fillAlpha, 0, .8, .02, x => Math.round(x * 100) + '%'):'')
        + '<div class="section-title">LABEL</div>'+F.chk('showLabel', 'Show label', a.showLabel) + (a.showLabel ? F.text('label', 'Label text', a.label, 60,'Enter a map label') : '')
        + (measurement?'':campaign.pathFields(a));
    }

    case 'pin': {
      const display = a.badge ? 'badge' : a.showIcon === false ? 'text' : a.showLabel ? 'both' : 'icon';
      const mv = a.mode === 'move' || a.mode === 'path' ? a.mode : 'stay', ownColor = a.badge || a.showIcon === false;
      return F.sel('__pinMove', 'Position', mv, Object.entries(PIN_MODES)) + (mv === 'stay' ? F.loc('place', 'Location', a.place, 'place') : mv === 'move' ? F.loc('place', 'From', a.place, 'place') + F.loc('to', 'To', a.to, 'place') + '<p class="mini-label">It travels for the animation duration above, then stays at the end until the bar ends.</p>' : pathFields(a))
        + (mv !== 'stay' ? F.chk('trail', 'Draw a trail behind it', a.trail !== false) + (ownColor ? F.color('color', 'Trail color', a.color) : '') : '')
        + F.sel('__pinDisplay', 'Display', display, [['both', 'Pin + text'], ['icon', 'Pin only'], ['text', 'Text only'], ...(a.badge ? [['badge', 'Image badge (legacy)']] : [])])
        + (display === 'text' && mv === 'stay' ? F.sel('labelPlacement','Anchor',a.labelPlacement||'map',[['map','Geographic position'],['screen','Canvas position']]) + (a.labelPlacement==='screen' ? F.num('x','Horizontal position (%)',a.x??50,0,100)+F.num('y','Vertical position (%)',a.y??15,0,100) : F.num('offsetX','Horizontal offset',a.offsetX??0,-1000,1000)+F.num('offsetY','Vertical offset',a.offsetY??0,-1000,1000)) : '')
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
function syncPathEnds(a) { const p = a.path || []; if (p.length) { a.from = placeAt(p[0]); a.to = placeAt(p[p.length - 1]); if (a.type === 'pin') a.place = a.from; } if(a.type==='shape'&&a.pathKeys?.length&&p.length>=2&&frame>=a.start&&frame<=a.start+a.dur)putPathKey(a,frame,p); }
function landscapeFields(a){
  let html='<div class="section-title">LANDSCAPE</div>'+F.sel('zoneTerrain','Terrain type',a.zoneTerrain||'plain',Object.entries(ZONE_TERRAINS));
  if(!a.zoneTerrain||a.zoneTerrain==='plain')return html;
  const content=a.terrainContent??'both',objects=content!=='background',fields=a.zoneTerrain==='farmland';
  html+=F.sel('terrainContent','Show',content,Object.entries(TERRAIN_CONTENTS))
    +'<p class="mini-label">Use background for the ground texture. Choose objects only for a separate area of trees or terrain details. Add Object layers to place individual trees or mountains.</p>'
    +'<details class="m-advanced-controls" data-terrain-advanced><summary>Advanced landscape</summary>';
  if(objects||fields)html+=F.range('terrainDensity',objects?'Object density':'Field density',a.terrainDensity??1,.3,2,.1,x=>x.toFixed(1)+'×')
    +F.range('terrainScale',objects?'Object size':'Field size',a.terrainScale??1,.5,2.5,.1,x=>x.toFixed(1)+'×');
  return html+F.range('terrainOpacity','Terrain opacity',a.terrainOpacity??.92,0,1,.05,x=>Math.round(x*100)+'%')
    +F.num('terrainSeed','Landscape seed',a.terrainSeed??0,0,9999,1)+'</details>';
}
function pathFields(a) {
  const drawing = pathDraw?.id === a.id,pts = a.type==='shape'&&a.pathKeys?.length&&!drawing?pathAt(a,frame):a.path||[];
  if(a.type==='shape'){
    const closed=['zone','noFly','area'].includes(a.shape),minimum=closed?3:2,ready=pts.length>=minimum;
    return `<div class="m-shape-geometry"><div class="m-shape-path-status"><span>${closed?'Closed boundary':'Open path'}</span><span class="${ready?'ready':''}">${pts.length} ${pts.length===1?'point':'points'}</span></div>`
      +(['distance','area'].includes(a.shape)?'':F.sel('curve','Connections',a.curve==='straight'?'straight':'smooth',Object.entries(PATH_CURVES)))
      +`<div class="m-path-actions"><button type="button" data-mpath="draw" aria-pressed="${drawing}" class="m-shape-draw ${drawing?'active':''}">${drawing?'Finish drawing':pts.length?'Edit on map':closed?'Draw boundary':'Draw path'}</button><button type="button" data-mpath="reverse" ${pts.length>1?'':'disabled'} title="Reverse point order and direction">Reverse</button><button type="button" data-mpath="undo" ${pts.length?'':'disabled'} title="Remove the last point">Undo point</button><button type="button" data-mpath="clear" ${pts.length?'':'disabled'}>${a.pathKeys?.length?'Clear animation':'Clear points'}</button></div>`
      +`<p class="mini-label">${drawing?(ready?'Click to add more points or drag to adjust them. Press Enter or Finish drawing when ready.':`Click to add at least ${minimum} points. Drag to adjust them. Press Enter to finish.`):!ready?`Add at least ${minimum} points${closed?' around the area; the boundary closes automatically':''}.`:closed?'The final point connects back to the first.':'Points connect in order. Reverse changes the direction.'}</p>`
      +(pts.length?`<details class="m-advanced-controls" data-path-points><summary>Path points (${pts.length})</summary><ol class="m-wps">${pts.map((p,i)=>`<li><b>${i+1}</b><span title="${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}">${esc(placeAt(p).name)}</span><button type="button" data-mwdel="${i}" title="Remove this point" aria-label="Remove point ${i+1}">&#215;</button></li>`).join('')}</ol></details>`:'')+'</div>';
  }
  return (['distance','area'].includes(a.shape)?'':F.sel('curve', 'Path shape', a.curve === 'straight' ? 'straight' : 'smooth', Object.entries(PATH_CURVES))) +
    `<div class="m-path-actions"><button type="button" data-mpath="draw" class="${drawing ? 'active' : ''}" title="Click the map to add points. Drag a point to move it. Alt+click removes it.">${drawing ? '✓ Finish drawing' : '✎ Draw path on map'}</button>` +
    `<button type="button" data-mpath="undo" ${pts.length ? '' : 'disabled'} title="Remove the last point">↶ Last point</button>` +
    `<button type="button" data-mpath="reverse" ${pts.length > 1 ? '' : 'disabled'} title="Travel the path the other way">⇄ Reverse</button>` +
    `<button type="button" data-mpath="clear" ${pts.length ? '' : 'disabled'} title="Remove every point and shape keyframe">${a.pathKeys?.length?'Clear animation':'Clear'}</button></div>` +
    (pts.length ? `<details class="m-advanced-controls" data-path-points><summary>Path points (${pts.length})</summary><ol class="m-wps">${pts.map((p, i) => `<li><b>${i + 1}</b><span title="${p.lat.toFixed(4)}, ${p.lon.toFixed(4)}">${esc(placeAt(p).name)}</span><button type="button" data-mwdel="${i}" title="Remove this point" aria-label="Remove point ${i + 1}">✕</button></li>`).join('')}</ol></details>` : '') +
    `<p class="mini-label">${drawing ? 'Click to add points · drag a point to move it · right-drag or middle-drag to pan · scroll to zoom · Alt+click removes a point · Enter when done.' : pts.length < 2 ? 'Press “Draw path on map”, then click at least two points. They are used in order.' : `${pts.length} points. They are used in order.`}</p>`;
}
function startPathDraw(id) {
  const action=proj.actions.find(a=>a.id===id);
  if(action?.type==='shape'&&action.pathKeys?.length){if(frame<action.start||frame>action.start+action.dur)setFrame(clamp(frame,action.start,action.start+action.dur));action.path=pathAt(action,frame);}
  campaign?.cancel();cancelPick(); pause(); pathDraw = { id }; canvas.style.cursor = 'crosshair';
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
  if(a.type==='shape'&&a.pathKeys?.length&&!pathDraw)a.path=pathAt(a,frame);
  if (!(a.path || []).length) return;
  if(what==='undo'&&a.pathKeys?.length&&a.path.length<=2){notify('Keep two points in a keyed shape, or clear the animation.');return;}
  checkpoint();
  if (what === 'undo') a.path.pop(); else if (what === 'clear') {a.path = [];if(a.type==='shape')a.pathKeys=[];} else if (what === 'reverse') a.path.reverse();
  syncPathEnds(a); changed(); renderInspector();
}
const cameraEditFrame = s => clamp(frame, s.start, s.start + s.dur);
const cameraTrackFields = () => CAMERA_PROPERTIES[cameraProperty]?.fields || Object.keys(CAMERA_FIELDS);
function updateCameraInspector(s) {
  const at = cameraEditFrame(s), pose = cameraPoseAt(s, at), key = cameraKeyAt(s,at,selectedCameraKeyId), disabled = frame < s.start || frame > s.start + s.dur;
  $$('#mInspector [data-camera-field]').forEach(el => { el.disabled = disabled; if (el !== document.activeElement) el.value = +pose[el.dataset.cameraField].toFixed(3); });
  $$('#mInspector [data-camera-toggle]').forEach(el => {
    const fields = CAMERA_PROPERTIES[el.dataset.cameraToggle]?.fields || Object.keys(CAMERA_FIELDS), keyed = fields.every(f => key?.values[f] !== undefined);
    el.disabled = disabled; el.classList.toggle('current', keyed);
    const text = (keyed ? '\u25c6' : '\u25c7') + (el.dataset.cameraToggle === 'all' ? ' Camera keyframe' : '');
    if (el.textContent !== text) el.textContent = text;
  });
  $$('#mInspector [data-camera-view], #mInspector [data-camera-center-pick], #mInspector [data-camera-center-view]').forEach(el => el.disabled = disabled);
  const remove=$('#mInspector [data-camera-delete]');if(remove){remove.disabled=!key;remove.textContent=key?.pairId?'Delete movement pair':'Delete camera keyframe';}
  const label = $('#mInspector [data-camera-playhead]'), text = disabled ? 'Move the playhead inside this camera bar to edit.' : 'At playhead - frame ' + at+(key?.pairId?' - '+PRESETS[key.preset].label+' (paired)':key?' - manual keyframe':'');
  if (label && label.textContent !== text) label.textContent = text;
}
function bindCameraInspector(s) {
  if (s.preset !== 'keyframed') return;
  $$('#mInspector [data-camera-follow]').forEach(el => el.onchange = () => {
    const start=cameraKeysOf(s).find(k=>k.id===el.dataset.cameraFollow),field=el.dataset.followField;
    if(!start)return;
    const value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
    if(typeof value==='number'&&!Number.isFinite(value)){renderInspector();return;}
    pause();checkpoint();
    start.follow??={planeId:'',zoom:4,pitch:45,lockHeading:false,easing:s.easing,from:{...start.samples[0].values}};
    start.follow[field]=field==='zoom'?clamp(value,0,14):field==='pitch'?clamp(value,0,75):value;
    previewCamera=null;changed();renderInspector();
  });
  $$('#mInspector [data-camera-endpoint]').forEach(el => el.onclick = () => {
    const key = cameraKeysOf(s).find(k => k.id === el.dataset.cameraEndpoint);
    if (!key) return;
    pause(); selectedCameraKeyId = key.id; previewCamera = null; setFrame(key.frame); renderInspector();
  });
  $$('#mInspector [data-camera-time]').forEach(el => el.onchange = () => {
    const key = cameraKeysOf(s).find(k => k.id === el.dataset.cameraTime), value = Number(el.value);
    if (!key || !Number.isFinite(value)) { renderInspector(); return; }
    pause(); checkpoint();
    moveCameraKey(s, key.frame, clamp(Math.round(value), 0, proj.frames - 1), Object.keys(CAMERA_FIELDS), key.id);
    selectedCameraKeyId = key.id; previewCamera = null; setFrame(key.frame); changed(); renderInspector();
  });
  $$('#mInspector [data-camera-remove-pair]').forEach(el => el.onclick = () => {
    const key = cameraKeysOf(s).find(k => k.id === el.dataset.cameraRemovePair);
    if (key) deleteCameraKeyAt(s, key.frame, key.id);
  });
  $$('#mInspector [data-camera-field]').forEach(el => el.onchange = () => {
    const field = el.dataset.cameraField, value = Number(el.value);
    if (!Number.isFinite(value)) { renderInspector(); return; }
    pause(); checkpoint();
    const at = cameraEditFrame(s), pose = cameraPoseAt(s, at);
    const fields = field === 'lon' || field === 'lat' ? ['lon', 'lat'] : [field];
    const values = Object.fromEntries(fields.map(f => [f, pose[f]]));
    values[field] = clamp(value, ...CAMERA_FIELDS[field]);
    setCameraKey(s, at, values); previewCamera = null; changed(); renderInspector();
  });
  $$('#mInspector [data-camera-toggle]').forEach(el => el.onclick = () => {
    pause(); checkpoint();
    const fields = CAMERA_PROPERTIES[el.dataset.cameraToggle]?.fields || Object.keys(CAMERA_FIELDS), at = cameraEditFrame(s);
    const pose = cameraPoseAt(s, at), key = cameraKeyAt(s,at,selectedCameraKeyId);
    if (fields.every(f => key?.values[f] !== undefined)) removeCameraKey(s, at, fields,key?.id);
    else setCameraKey(s, at, Object.fromEntries(fields.map(f => [f, pose[f]])));
    previewCamera = null; changed(); renderInspector();
  });
  $$('#mInspector [data-camera-nav]').forEach(el => el.onclick = () => {
    const keys = cameraKeysOf(s).filter(k => Object.keys(k.values).some(f => cameraTrackFields().includes(f))).sort((a,b) => a.frame - b.frame);
    const key = +el.dataset.cameraNav < 0 ? keys.filter(k => k.frame < frame).at(-1) : keys.find(k => k.frame > frame);
    if (key) { pause(); selectedCameraKeyId = key.id; setFrame(key.frame); renderInspector(); }
  });
  const centerPick = $('#mInspector [data-camera-center-pick]');
  if (centerPick) centerPick.onclick = () => {
    if (pick?.kinds === 'cameraCenter' && pick.id === s.id) { cancelPick(); return; }
    pause(); endPathDraw(true); startPick('__cameraCenter', 'cameraCenter'); pick.frame = cameraEditFrame(s); renderInspector();
  };
  const centerView = $('#mInspector [data-camera-center-view]');
  if (centerView) centerView.onclick = () => {
    pause(); checkpoint(); const [lon, lat] = centerLonLat();
    setCameraKey(s, cameraEditFrame(s), { lon: clamp(lon, ...CAMERA_FIELDS.lon), lat: clamp(lat, ...CAMERA_FIELDS.lat) });
    cancelPick(); previewCamera = null; changed(); renderInspector();
  };
  const remove=$('#mInspector [data-camera-delete]');if(remove)remove.onclick=()=>deleteCameraKeyAt(s,cameraEditFrame(s),selectedCameraKeyId);
  const capture = $('#mInspector [data-camera-view]');
  if (capture) capture.onclick = s.fullTimelineCamera ? captureViewAtPlayhead : () => { pause(); checkpoint(); setCameraKey(s, cameraEditFrame(s), captureCamera()); previewCamera = null; changed(); renderInspector(); };
}
function cameraPositionFields(s, pose, disabled) {
  const picking = pick?.kinds === 'cameraCenter' && pick.id === s.id;
  return `<div class="m-camera-position-actions"><button type="button" data-camera-center-pick ${disabled ? 'disabled' : ''}>${picking ? 'Cancel picking' : '&#8982; Pick camera center'}</button><button type="button" data-camera-center-view ${disabled ? 'disabled' : ''}>Use map center</button></div><p class="mini-label">Click a point to center the camera there. Or pan the map, then use its center.</p><details class="m-camera-coordinates"><summary>Coordinates (optional)</summary><div class="two">${['lon','lat'].map(field => `<label>${field === 'lon' ? 'Longitude' : 'Latitude'}<input type="number" data-camera-field="${field}" min="${CAMERA_FIELDS[field][0]}" max="${CAMERA_FIELDS[field][1]}" step=".01" value="${+pose[field].toFixed(3)}" ${disabled ? 'disabled' : ''}></label>`).join('')}</div></details>`;
}
function cameraMovementFields(s) {
  const keys = cameraKeysOf(s), starts = keys.filter(k => k.pairRole === 'start');
  return '<div class="section-title">MOVEMENTS</div><p class="mini-label">Add a camera move at the playhead from the Camera menu. Set its start and end frames below, or drag its blue diamonds. Select an endpoint to adjust position, zoom, tilt and rotation below. Manual keys blend into the saved movement curve.</p>' +
    (starts.length ? starts.map(start => {
      const end = keys.find(k => k.pairId === start.pairId && k.pairRole === 'end');
      if (!end) return '';
      const follow=start.preset==='followPlane'?cameraFollowFields(start):'';
      return `<div class="m-camera-movement"><strong>${esc(PRESETS[start.preset].label)}</strong>${follow}<div class="two">${[start, end].map(key => `<label>${key.pairRole === 'start' ? 'Start' : 'End'} frame<input type="number" data-camera-time="${esc(key.id)}" min="${key.pairRole === 'start' ? 0 : start.frame + 1}" max="${key.pairRole === 'start' ? end.frame - 1 : proj.frames - 1}" step="1" value="${key.frame}"></label>`).join('')}</div><div class="two">${[start, end].map(key => `<button type="button" data-camera-endpoint="${esc(key.id)}">Edit ${key.pairRole}</button>`).join('')}</div><button type="button" data-camera-remove-pair="${esc(start.id)}">Delete movement pair</button></div>`;
    }).join('') : '<p class="mini-label">No preset movements yet. You can also animate with camera keyframes below.</p>') + '<div class="section-title m-sep">CAMERA AT PLAYHEAD</div>';
}
function cameraFollowFields(start){
  const f=start.follow||{zoom:4,pitch:45},attr=`data-camera-follow="${esc(start.id)}"`;
  const missing=f.planeId&&!followObjects().some(a=>a.id===f.planeId);
  return `<label>Object to follow<select ${attr} data-follow-field="planeId"><option value="">Choose an object</option>${missing?`<option value="${esc(f.planeId)}" selected>Object removed — choose another</option>`:''}${followObjects().map(a=>`<option value="${esc(a.id)}" ${a.id===f.planeId?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label><div class="two">${[['zoom','Follow zoom',14],['pitch','Follow tilt',75]].map(([field,label,max])=>`<label>${label}<input type="number" ${attr} data-follow-field="${field}" min="0" max="${max}" step=".1" value="${f[field]}"></label>`).join('')}</div><label><input type="checkbox" ${attr} data-follow-field="lockHeading" ${f.lockHeading?'checked':''}> Turn with object</label><p class="mini-label">Follows the linked object's current movement, including route edits. End frame controls when following stops.</p>`;
}
function shotFields(s) {
  if (s.preset === 'keyframed') {
    const at = cameraEditFrame(s), pose = cameraPoseAt(s, at), key = cameraKeyAt(s,at,selectedCameraKeyId), disabled = frame < s.start || frame > s.start + s.dur;
    return `<div class="m-camera-keybar"><button type="button" data-camera-nav="-1" title="Previous keyframe">&lsaquo;</button><button type="button" data-camera-toggle="all" ${disabled ? 'disabled' : ''} title="Add or remove all camera properties at playhead">${key && Object.keys(CAMERA_FIELDS).every(f => key.values[f] !== undefined) ? '&#9670;' : '&#9671;'} Camera keyframe</button><button type="button" data-camera-nav="1" title="Next keyframe">&rsaquo;</button></div><p class="mini-label" data-camera-playhead>${disabled ? 'Move the playhead inside this camera bar to edit.' : 'At playhead - frame ' + at}</p>` +
      Object.entries(CAMERA_PROPERTIES).map(([property, spec]) => `<div class="m-camera-property"><div class="m-camera-property-title"><span>${spec.label}</span><button type="button" class="key ${spec.fields.every(f => key?.values[f] !== undefined) ? 'current' : ''}" data-camera-toggle="${property}" ${disabled ? 'disabled' : ''} title="Toggle ${spec.label} keyframe at playhead">${spec.fields.every(f => key?.values[f] !== undefined) ? '&#9670;' : '&#9671;'}</button></div><div>${property === 'position' ? cameraPositionFields(s, pose, disabled) : spec.fields.map(field => `<label>${field === 'lon' ? 'Longitude' : field === 'lat' ? 'Latitude' : ''}<input type="number" data-camera-field="${field}" min="${CAMERA_FIELDS[field][0]}" max="${CAMERA_FIELDS[field][1]}" step="${['lon','lat'].includes(field) ? '.01' : '.1'}" value="${+pose[field].toFixed(3)}" ${disabled ? 'disabled' : ''}></label>`).join('')}</div></div>`).join('') + `<button type="button" data-camera-view ${disabled ? 'disabled' : ''}>Use current map view at playhead</button><button type="button" data-camera-delete ${!key?'disabled':''}>Delete ${key?.pairId?'movement pair':'camera keyframe'}</button>`;
  }
  const P = PRESETS[s.preset], has = k => P.fields.includes(k);
  let h = `<p class="mini-label">${esc(P.hint)}.</p>`;
  if (has('target')) h += F.loc('target', 'Target', s.target, 'any');
  if (has('autoFit') && ['country','region','regions','polygon'].includes(s.target.kind)) h += F.chk('autoFit', 'Fit the whole region in view', s.autoFit);
  if (has('planeId')) h += F.sel('planeId', 'Travel route', s.planeId, [['', 'Choose a route…'], ...planes().map(a => [a.id, a.mode === 'path' ? `${a.name} (drawn path)` : `${a.name} (${(a.from || a.place)?.name ?? '?'} → ${a.to?.name ?? '?'})`])]);
  if (has('zoom') && !(has('autoFit') && s.autoFit && ['country','region','regions','polygon'].includes(s.target.kind))) h += F.num('zoom', 'Zoom level', s.zoom, 1, 12, .1);
  if (has('amount')) h += F.num('amount', s.preset === 'pullBack' ? 'Zoom out by' : 'Zoom in by', s.amount, 0, 8, .1);
  if (has('degrees')) h += F.num('degrees', 'Rotate by (degrees)', s.degrees, -720, 720, 5);
  if (has('pitch')) h += F.range('pitch', 'Tilt', s.pitch, 0, 70, 1, x => x + '°');
  if (has('bearing')) h += F.num('bearing', 'Rotation (degrees)', s.bearing, -180, 180, 5);
  if (has('lockHeading')) h += F.chk('lockHeading', 'Turn with the icon', s.lockHeading);
  return h;
}

function bindInspector(it) {
  bindCameraInspector(it);
  $$('#mInspector [data-shape-choice]').forEach(button=>button.onclick=()=>{
    const input=$('#mInspector [data-mf="shape"]');input.value=button.dataset.shapeChoice;
    input.dispatchEvent(new Event('change',{bubbles:true}));
    $('#mInspector [data-shape-menu] summary')?.focus();
  });
  if($('#mPlaqueFont'))bindFontPicker('mPlaqueFont',font=>{pause();checkpoint();it.plaqueFont=font;changed();loadFont(font).then(()=>draw());});
  paintObjectPreviews($('#mInspector'));
  const objectMenu=$('#mInspector [data-object-menu]');
  if(objectMenu){
    bindObjectCascade(objectMenu);
    for(const button of objectMenu.querySelectorAll('[data-object-choice]'))button.onclick=()=>{
      const input=$('#mInspector [data-mf="glyph"]');input.value=button.dataset.objectChoice;
      input.dispatchEvent(new Event('change',{bubbles:true}));
      $('#mInspector [data-object-menu] summary')?.focus();
    };

  }
  const objectType = $('#mInspector [data-object-type]');
  if (objectType) objectType.onchange = () => {
    objectTypeFilters.set(it.id, objectType.value);
    renderInspector();
    $('#mInspector [data-object-type]')?.focus();
  };
  const updateGroupValue=(key,v,commit)=>{
        const members=proj.actions.filter(a=>it.memberIds.includes(a.id));
        if(key==='__groupMove'){
          const pose=groupPoseAt(it,frame);it.groupMove=v;
          if(v==='stay'){it.transform={...it.transform,lon:pose.lon,lat:pose.lat};for(const key of it.groupKeys||[]){delete key.values.lon;delete key.values.lat;}it.groupKeys=(it.groupKeys||[]).filter(k=>Object.keys(k.values).length);}
        }else if(key==='__groupDestination'){
          const point=resolveLoc(geo,v);if(!point){undoStack.pop();updateHistory();notify('Choose a destination');return;}
          it.groupDestination=v;const pose=groupPoseAt(it,frame),end=it.start+Math.min(it.animDur??it.dur,it.dur);
          putGroupKey(it,it.start,{lon:pose.lon,lat:pose.lat});putGroupKey(it,end,{lon:xToLon(point.X),lat:yToLat(point.Y)});
        }else if(key==='__groupColor'){it.color=v;for(const member of members)member.color=v;}
        else if(key==='__groupSizeMode')for(const member of members){member.sizeMode=v;if(v==='map')member.sizeZoom=lastView?.cam.zoom??proj.camera.init.zoom;}
        else if(key==='__groupSizeZoom')for(const member of members)member.sizeZoom=clamp(+v,0,14);
        else if(key==='__groupScale'){if(it.groupKeys?.some(k=>k.values.scale!==undefined))putGroupKey(it,frame,{scale:clamp(+v,.1,8)});else it.transform={...it.transform,scale:clamp(+v,.1,8)};}
    changed();if(commit)renderInspector();
  };
  let gesture = false;
  $$('#mInspector [data-mf]').forEach(el => {
    const key = el.dataset.mf, t = el.dataset.t;
    const read = () => (t === 'chk' ? el.checked : t === 'num' ? Number(el.value) : el.value);
    if(key==='__flowSpeed'||key==='__reverseFlow'){
      const apply=commit=>{
        if(!gesture){checkpoint();gesture=true;}
        const speed=Number($('#mInspector [data-mf="__flowSpeed"]').value),reverse=$('#mInspector [data-mf="__reverseFlow"]').checked;
        it.flowSpeed=speed*(reverse?-1:1);
        const out=el.parentElement.querySelector('.m-val');if(out)out.textContent=speed;
        if(commit){gesture=false;changed();}else draw();
      };
      if(key==='__flowSpeed')el.oninput=()=>apply(false);
      el.onchange=()=>apply(true);return;
    }
    if(it.type==='group'&&key.startsWith('__group')){
      const apply=commit=>{
        const v=t==='loc'?parseLoc(el.value,el.dataset.kinds):['range','num'].includes(t)?Number(el.value):read();
        if(v===null||v===undefined){notify('Choose a destination');return;}
        if(!gesture){checkpoint();gesture=true;}updateGroupValue(key,v,commit);if(commit)gesture=false;
      };
      if(t==='range'||t==='color')el.oninput=()=>apply(false);
      el.onchange=()=>apply(true);return;
    }

    if (t === 'range' || t === 'color') {
      el.oninput = () => {
        if (!gesture) { checkpoint(); gesture = true; }
        const v = t === 'range' ? Number(el.value) : el.value; writeObjectValue(it,key,v);
        const out = el.parentElement.querySelector('.m-val'); if (out) out.textContent = key === 'pitch' ? v + '°' : key === 'size' || key === 'badgeZoom' ? v + '×' : key === 'badgeLabelY' ? v + '%' : key === 'badgeStemLen'||key==='width'&&['road','railway'].includes(it.shape) ? v + ' px' : ['fillAlpha', 'dim'].includes(key) ? Math.round(v * 100) + '%' : v;
        draw();
      };
      el.onchange = () => { gesture = false; changed(); };
      return;
    }
    if (it.fullTimelineCamera && ['start','dur','animDur','__startSeconds','__finishSeconds','preset'].includes(key)) { el.disabled = true; return; }
    el.onchange = () => {
      if (t === 'loc') {
        const loc = parseLoc(el.value, el.dataset.kinds);
        if (!loc) { notify('Not found. Type a city, a country, or "lat, lon"'); el.value = locText(it[key]); return; }
        checkpoint(); it[key] = key === 'highlightOrigin' ? { ...loc, kind: 'point' } : loc; changed(); renderInspector(); return;
      }
      let v = read();
      if(key==='__arrowStyle'||key==='__zoneStyle'){
        const input=$('#mInspector [data-mf="shape"]');input.value=v;input.dispatchEvent(new Event('change',{bubbles:true}));return;
      }
      checkpoint();
      if (key === '__cameraTrack') { cameraProperty = v; renderTimeline(); renderInspector(); return; }
      if (key === '__keyProperty') return;
      if (key === '__objectTrack') { objectProperty=v;renderTimeline();return; }
      if (key === 'zoneTerrain') { if(!it.zoneTerrain||it.zoneTerrain==='plain')it.terrainContent??='background';it.zoneTerrain=v;changed();renderInspector();return; }
      if (key === 'terrainContent') { it.terrainContent=v;changed();renderInspector();return; }
      if(key==='roadStyle'){
        const previous=ROAD_STYLES[it.roadStyle||'asphalt'];if(it.color===previous.surface||it.color===NETWORK_SHAPES.road.color||it.color==='#8c7353')it.color=ROAD_STYLES[v].surface;
        it.roadStyle=v;changed();renderInspector();return;
      }
      if(key==='railStyle'){it.railStyle=v;changed();renderInspector();return;}
      if(key==='roadLanes'){it.roadLanes=Number(v);changed();return;}
      if (key === 'objectView') {
        if(['move','path'].includes(it.mode)&&it.objectFacing==='manual')putObjectKey(it,clamp(frame,it.start,it.start+it.dur),{objectView:v});
        else if(['move','path'].includes(it.mode))it.objectView=v;
        else writeObjectValue(it,'objectView',v);
        changed();renderInspector();return;
      }
      if (key === 'objectDirection') { it.objectDirection=v;changed();renderInspector();return; }
      if (key === 'trailStyle') { it.trailStyle=v;changed();renderInspector();return; }
      if (key === 'objectFacing') { it.objectFacing=v;changed();renderInspector();return; }
      if (key === 'objectAnimation') { it.objectAnimation=v;changed();renderInspector();return; }
      if (key.includes('.')) { const [endpoint, property] = key.split('.'); if (!Number.isFinite(v)) { renderInspector(); return; } it[endpoint][property] = clamp(v, +el.min, +el.max); previewCamera = null; changed(); renderInspector(); return; }
      if (key === 'name') { it.name = String(v).slice(0, 100) || 'Untitled'; changed(); const n = $('#mInspName'); if (n) n.textContent = it.name; return; }
      if (key === 'preset') { const old = PRESETS[it.preset].label, { dur, ...rest } = PRESETS[v].def; if (v === 'keyframed' && !it.cameraFrom) { it.cameraFrom = captureCamera(); it.cameraTo = { ...it.cameraFrom }; } if (v === 'keyframed') it.cameraKeys ??= []; it.preset = v; Object.assign(it, rest); if (it.name === old) it.name = PRESETS[v].label; if (PRESETS[v].fields.includes('planeId') && !it.planeId) it.planeId = planes()[0]?.id || ''; changed(); renderInspector(); return; }
      if (key === 'mode') {
        const def = (TRAVEL_ICONS[it.icon] || TRAVEL_ICONS.plane).lift;
        it.mode = v === 'path' ? 'path' : 'direct';
        if (it.mode === 'path') { it.path ||= []; if (it.lift === def) it.lift = 0; } else { if (pathDraw?.id === it.id) { pathDraw = null; canvas.style.cursor = ''; } if (it.lift === 0) it.lift = def; }
        changed(); renderInspector(); if (['path','wallPath'].includes(it.mode) && !it.path.length) startPathDraw(it.id); return;
      }
      if (key === 'sizeMode') { it.sizeMode=v; if(v==='map')it.sizeZoom=lastView?.cam.zoom??proj.camera.init.zoom; changed(); renderInspector(); return; }
      if (key === 'icon') { const old = TRAVEL_ICONS[it.icon] || TRAVEL_ICONS.plane, nu = TRAVEL_ICONS[v]; if (!nu) return; if (it.planeColor === old.color) it.planeColor = nu.color; if (it.lift === old.lift) it.lift = nu.lift; if (['Travel', 'Plane', old.label].includes(it.name)) it.name = nu.label; it.icon = v; changed(); renderInspector(); return; }
      if (key === '__moveKeys') { if (v) { it.moveStart = it.start; it.moveEnd = it.start + Math.min(it.animDur ?? it.dur, it.dur); } else { delete it.moveStart; delete it.moveEnd; } changed(); renderInspector(); return; }
      if (key === '__move') { it.mode = v === 'path' ? 'path' : 'stay'; if (['path','wallPath'].includes(it.mode)) it.path ||= []; else if (pathDraw?.id === it.id) { pathDraw = null; canvas.style.cursor = ''; } changed(); renderInspector(); if (['path','wallPath'].includes(it.mode) && !it.path.length) startPathDraw(it.id); return; }
      for (const [k, cat, base] of [['glyph', OBJECT_ICONS, 'Object'], ['fx', EFFECTS, 'Effect'], ['shape', SHAPES, 'Arrow / zone']]) if (key === k) { // new look: follow its default color and name unless the user changed them
        const old = cat[it[k]], nu = cat[v]; if (!nu) return;
        if (it.color === old?.color) it.color = nu.color; if (!it.name || it.name === base || it.name === old?.label) it.name = nu.label;
        if(k==='glyph'&&v==='portrait'){it.showLabel=true;if(!it.label)it.label='Commander';}
        if(k==='shape'&&['distance','area'].includes(v)&&it.pathKeys?.length){it.path=pathAt(it,frame);delete it.pathKeys;}
        if(k==='fx'&&v==='sunlight'){cancelPick();it.lighting||=lightingPreset('day');}
        it[k] = v; if(k==='glyph'&&it.objectAnimation&&!objectAnimationOptions(v).some(([key])=>key===it.objectAnimation))it.objectAnimation='auto'; if(k==='shape'&&['distance','area'].includes(v)){it.curve='straight';if(v==='distance'&&it.path?.length>2)it.path=[it.path[0],it.path.at(-1)];} if(k==='glyph'&&it.mode==='wallPath'&&!WALL_GLYPHS.includes(v))it.mode='stay'; if(k==='fx'&&!['cannonShot','musketVolley','arrowVolley'].includes(v))it.attackTargeted=false; changed(); renderInspector(); return;
      }
      if (key === '__lscustom') { if (v) it.labelStyle = { ...labelStyleOf(proj) }; else delete it.labelStyle; changed(); renderInspector(); return; }
      if (key === '__pinMove') {
        it.mode = v === 'wallPath' ? 'wallPath' : v === 'path' ? 'path' : v === 'move' ? 'move' : 'stay';
        if(it.mode==='wallPath')it.enter='none';
        if (it.mode === 'move' && !(it.to && Number.isFinite(it.to.lat))) it.to=clone(it.place);
        if (['path','wallPath'].includes(it.mode)) it.path ||= []; else if (pathDraw?.id === it.id) { pathDraw = null; canvas.style.cursor = ''; }
        if (it.mode !== 'stay' && it.dur <= (it.animDur ?? it.dur)) { it.dur = (it.animDur ?? it.dur) + 45; ensureLength(it.start + it.dur); } // leave time to sit at the destination before the bar ends
        changed(); renderInspector(); if (['path','wallPath'].includes(it.mode) && !it.path.length) startPathDraw(it.id); return;
      }
      if (key === '__pinDisplay') {
        if(it.type==='label'&&v!=='text'){
          const pin=makeAction('pin',it.start,{...it,type:'pin',label:it.text||it.label||'',labelPlacement:'map',size:1,color:it.color||'#e63946'});Object.assign(it,pin);
        }
        if(v==='text'&&!it.labelPlacement){it.labelPlacement='map';it.offsetX=0;it.offsetY=0;it.labelStyle={...DEFAULT_LABEL_STYLE,...LABEL_PRESETS.atlasGround.style,...it.labelStyle};}
        it.badge = v === 'badge'; it.showIcon = v === 'badge' ? false : v !== 'text'; it.showLabel = v !== 'icon'; if (it.badge && !it.size) it.size = 1; changed(); renderInspector(); return; }
      if (key === '__hmode') { it.target = v === 'country' ? (isDetail() ? defaultRegion() : { kind: 'country', name: (lastView && geo && countryAt(geo, ...centerLonLat())) || 'Australia' }) : { kind: 'city', name: 'Paris', lat: 48.8566, lon: 2.3522 }; changed(); renderInspector(); return; }
      if (t === 'num') {
        if (key === '__startSeconds' || key === '__finishSeconds') {
          const target = Math.round(v * proj.fps), finish = it.start + it.dur;
          if (!Number.isFinite(v) || v < 0 || !Number.isSafeInteger(target) || (key === '__startSeconds' ? target >= finish : target <= it.start)) {
            notify('Enter a valid time, with Finish after Start.'); renderInspector(); return;
          }
          if (key === '__startSeconds') retimeEditorItem(it, target, finish - target, false);
          else retimeEditorItem(it, it.start, target - it.start, false);
          ensureLength(it.start + it.dur); changed(); renderInspector(); return;
        }
        const lo = Number(el.min), hi = el.max === '' ? Infinity : Number(el.max);
        if (key === 'start' || key === 'dur' || key === 'animDur') {
          if (!Number.isFinite(v)) { el.value = it[key]; notify('Enter a valid frame number.'); return; }
          v = Math.max(lo, Math.round(v));
          const end = key === 'start' ? v + it.dur : key === 'dur' ? it.start + v : it.start + it.dur;
          if (!Number.isSafeInteger(v) || !Number.isSafeInteger(end)) { el.value = it[key]; notify('Enter a valid frame number.'); return; }
          if (key === 'start' || key === 'dur') retimeEditorItem(it, key === 'start' ? v : it.start, key === 'dur' ? v : it.dur);
          it[key] = v; if (key !== 'animDur') ensureLength(end); el.value = v; changed(); renderInspector(); return;
        }
        v = clamp(Number.isFinite(v) ? v : lo, lo, hi);
        el.value = v;
      }
      if (['count','startYear','endYear','terrainSeed'].includes(key)) v = Math.round(v);
      if (key === 'moveStart') v = Math.min(Math.round(v), it.moveEnd - 1);
      if (key === 'moveEnd') v = Math.max(Math.round(v), it.moveStart + 1);
      if (key === 'formationCols' && v === 0) { delete it.formationCols; changed(); return; }
      writeObjectValue(it,key,v); changed(); if (key === 'measurementUnit' || key === 'showDistanceArrow' || key === 'showAreaBoundary' || (key === 'curve' && it.type === 'shape') || key === 'highlightExtent' || key === 'highlightFill' || key === 'autoYear' || key === 'attackTargeted' || key === 'formation' || key === 'count' || key === 'labelPlacement' || key === 'autoFit' || key === 'showLabels' || key === 'showLabel' || key === 'showRouteLabels' || key === 'borderPartial' || key === 'badgeShape' || key === 'badgeStem' || key === 'badgeExit') renderInspector();
      if (key === 'showRouteLabels' || key === 'routeLabelMode') void ensureDetail();
    };
  });
  const highlightReset = $('#mInspector [data-highlight-reset]');
  if (highlightReset) highlightReset.onclick = () => { checkpoint(); delete it.highlightOrigin; changed(); renderInspector(); };
  const highlightRadiusPick = $('#mInspector [data-highlight-radius]');
  if (highlightRadiusPick) highlightRadiusPick.onclick = () => startPick('radius', 'highlightRadius');
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
  const excludeBox=$('#mInspector [data-mexclude]');
  if(excludeBox)excludeBox.onchange=()=>{
    const loc=parseLoc(excludeBox.value,'country');
    if(!loc||!['country','region'].includes(loc.kind)){notify('Not found. Type a region or country name');excludeBox.value='';return;}
    pause();checkpoint();if(!excludeMember(it,loc)){undoStack.pop();updateHistory();return;}changed();renderInspector();
  };
  $$('#mInspector [data-mexclude-remove]').forEach(button=>button.onclick=()=>{pause();checkpoint();it.highlightExclude.splice(+button.dataset.mexcludeRemove,1);changed();renderInspector();});
  const excludePick=$('#mInspector [data-mexclude-pick]');if(excludePick)excludePick.onclick=()=>{
    if(pick?.key==='__excluded'){cancelPick();return;}
    pause();endPathDraw(true);campaign?.cancel();startPick('__excluded','country');
    $('#mHint').textContent='Click regions to exclude or include them; Shift-click for a whole country; Esc to finish';
    notify('Click regions on the map to exclude or include them');renderInspector();
  };
  $$('#mInspector [data-mregpick]').forEach(el => el.onclick = () => {
    if (pick?.key === '__members') { cancelPick(); return; }
    pause(); endPathDraw(true); startPick('__members', 'country');
    $('#mHint').textContent = 'Click regions to add or remove them · Shift-click for a whole country · Esc to finish';
    notify('Click regions on the map to add or remove them'); renderInspector();
  });
  { const file = $('#mInspector [data-badgefile]'), choose = $('#mInspector [data-badgeimg]'), clear = $('#mInspector [data-badgeclear]');
    if (choose) choose.onclick = () => file.click();
    if (file) file.onchange = async () => { const f = file.files[0]; file.value = ''; if (!f) return; try { const url = await shrinkImage(f); pause(); checkpoint(); it.image = url; if (['banner','flag'].includes(it.glyph)) { const img = new Image(); img.src = url; await img.decode(); it.bannerAspect = clamp(img.naturalWidth / img.naturalHeight, .35, 2.5); } changed(); renderInspector(); notify('Image added'); } catch (err) { notify(err.message || 'That image could not be used.'); } };
    if (clear) clear.onclick = () => { pause(); checkpoint(); delete it.image; changed(); renderInspector(); }; }
  $$('#mInspector [data-mopenset]').forEach(el => el.onclick = () => $('#mSettingsButton').click());
  const combine = $('#mInspector [data-mcombine]'); if (combine) combine.onchange = () => { if (combine.value === 'separate') splitRegions(it); };
  const imageObject = $('#mInspector [data-imageobject]'); if (imageObject) imageObject.onclick = () => { checkpoint(); it.type = 'object'; it.glyph = 'image'; it.count = 1; it.enter = 'drop'; it.idle = 'none'; it.exit = 'none'; changed(); renderInspector(); };
  $$('#mInspector [data-movekey]').forEach(el => el.onclick = () => { const key = el.dataset.movekey; if (frame < it.start || frame > it.start + it.dur || (key === 'moveStart' ? frame >= it.moveEnd : frame <= it.moveStart)) { notify('Choose a frame inside the bar, with end after start.'); return; } checkpoint(); it[key] = frame; changed(); renderInspector(); });
  $$('#mInspector [data-borderpoint]').forEach(el=>el.onclick=()=>startPick(el.dataset.borderpoint,'borderpoint'));
  $$('#mInspector [data-mpath]').forEach(el => el.onclick = () => pathAction(it, el.dataset.mpath));
  $$('#mInspector [data-mwdel]').forEach(el => el.onclick = () => {if(it.pathKeys?.length&&it.path.length<=2){notify('Keep two points in a keyed shape, or clear the animation.');return;} checkpoint();if(it.type==='shape'&&it.pathKeys?.length&&!pathDraw)it.path=pathAt(it,frame);it.path.splice(+el.dataset.mwdel, 1); syncPathEnds(it); changed(); renderInspector(); });
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
    `<label>Text path<select data-ls="textPath" data-t="sel">${o('straight','Straight',st.textPath||'straight')}${o('arc','Circular arc',st.textPath)}</select></label>` +
    (st.textPath==='arc'?num('curveAngle','Arc bend (negative reverses it)',-360,360,1)+'<p class="mini-label">Curved text follows a circular baseline, without a background badge.</p>':'') +
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
      get()[key] = v; changed(); if (key === 'textPath' || key === 'useTheme' || key === 'shape' || key === 'halo' || key === 'scaleMode') rerender();
    };
  });
}
function renderLabelPanel() {
  renderAtlasLabelPanel();
  let box = $('#mLabelStyle');
  if (!box) { box = document.createElement('div'); box.id = 'mLabelStyle'; $('#mImageryBox').after(box); }
  const st = labelStyleOf(proj);
  box.innerHTML = `<section class="m-settings-group"><h4>Label style</h4><p class="mini-label">Applies to place names, route names, pins and highlights. Choose “2D · Attached to map” to lay labels flat on the map. Pick a different style on any item to override it.</p>${labelStyleHtml(st, 'mProjLbl')}</section>`;
  bindLabelStyle(box, 'mProjLbl', () => (proj.labelStyle ||= { ...DEFAULT_LABEL_STYLE }), v => { proj.labelStyle = v; }, renderLabelPanel);
}
function renderAtlasLabelPanel() {
  let box = $('#mAtlasLabels');
  if (!box) { box = document.createElement('div'); box.id = 'mAtlasLabels'; $('#mImageryBox').after(box); }
  const s = atlasLabelSettings(proj.atlasLabels);
  const chk = (key, title) => `<label class="m-chk"><input type="checkbox" data-atlas="${key}" ${s[key] ? 'checked' : ''}> ${title}</label>`;
  const num = (key, title, min, max, step = 1) => `<label>${title}<input type="number" data-atlas="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
  const color = (key, title) => `<label>${title}<input type="color" data-atlas="${key}" value="${s[key]}"></label>`;
  box.innerHTML = `<section class="m-settings-group"><h4>Country &amp; ocean labels</h4>
    <p class="mini-label">Names fit each country’s mainland shape and follow its natural direction. Use the country size multiplier to adjust all names together. Fixed zoom sizing preserves these proportions as you zoom.</p>
    ${chk('countries', 'Label all countries')}${chk('oceans', 'Label oceans and major seas')}${chk('caps', 'Uppercase military lettering')}${chk('declutter', 'Reduce overlapping names')}${chk('fitCountries', 'Fit label size to each country')}${chk('countryAngles', 'Follow country and ocean angles')}
    ${fontPickerHtml('mAtlasFont', 'Font', s.font)}
    <div class="two">${num('size', 'Country size multiplier (30 = normal)', 6, 240)}${num('oceanSize', 'Ocean text size', 6, 240)}</div>
    <label>Text path<select data-atlas="textPath"><option value="straight" ${s.textPath==='straight'?'selected':''}>Straight</option><option value="arc" ${s.textPath==='arc'?'selected':''}>Circular arc</option></select></label>
    ${s.textPath==='arc'?num('curveAngle','Arc bend (negative reverses it)',-360,360):''}
    <label>Orientation<select data-atlas="placement"><option value="map" ${s.placement === 'map' ? 'selected' : ''}>Flat on map</option><option value="screen" ${s.placement === 'screen' ? 'selected' : ''}>Upright</option></select></label>
    <label>Zoom sizing<select data-atlas="scaleMode"><option value="fixed" ${s.scaleMode === 'fixed' ? 'selected' : ''}>Keep text size fixed</option><option value="world" ${s.scaleMode === 'world' ? 'selected' : ''}>Scale with the map</option></select></label>
    ${s.scaleMode === 'world' ? num('referenceZoom', 'Size measured at zoom', 0, 14, .1) : ''}
    <div class="two">${color('text', 'Text color')}${color('outline', 'Outline color')}</div>
    ${num('haloWidth', 'Outline thickness (relative to text)', 0, 1, .01)}${num('opacity', 'Opacity', 0, 1, .05)}${num('spacing', 'Letter spacing (%)', 0, 40)}
    <p class="mini-label">Disable overlap reduction to show every visible country name. Add a Map label for custom historical names.</p></section>`;
  const set = (key, value) => { checkpoint(); proj.atlasLabels = { ...proj.atlasLabels, [key]: value }; changed(); renderAtlasLabelPanel(); };
  bindFontPicker('mAtlasFont', font => set('font', font));
  box.querySelectorAll('[data-atlas]').forEach(el => el.onchange = () => {
    const value = el.type === 'checkbox' ? el.checked : el.type === 'number' ? clamp(Number.isFinite(el.valueAsNumber) ? el.valueAsNumber : Number(el.min), Number(el.min), Number(el.max)) : el.value;
    set(el.dataset.atlas, value);
  });
}
function labelFields(a) {
    if (!['plane', 'highlight', 'pin', 'label', 'object', 'shape'].includes(a.type)) return '';
  return '<div class="section-title m-sep">LABEL STYLE</div>' + F.chk('__lscustom', 'Custom style for this label', !!a.labelStyle) + (a.labelStyle ? labelStyleHtml(labelStyleOf(proj, a), 'mItemLbl') : '<p class="mini-label">Using the project label style (Map settings → Label style).</p>');
}

// ------------------------------------------------------------------ pick a location on the map
function startPick(key, kinds) {
  pick = { key, kinds, id: sel }; canvas.style.cursor = 'crosshair'; $('#mHint').textContent = 'Click to choose a location · right-drag or middle-drag to pan · scroll to zoom · Esc to cancel';
  notify(kinds === 'highlightRadius' ? 'Click the map to set the highlight radius end point' : kinds === 'cameraCenter' ? 'Click the map to choose the camera center' : kinds === 'borderpoint' ? 'Click near the border to set its endpoint' : kinds === 'any' ? 'Click the map (Shift+click picks a whole country)' : kinds === 'place' ? 'Click the map to choose a place' : isDetail() ? 'Click a region; Shift-click for a whole country' : 'Click a country');
}
function cancelPick() { const camera = pick?.kinds === 'cameraCenter'; const was = ['__members','__excluded'].includes(pick?.key); pick = null; canvas.style.cursor = ''; $('#mHint').textContent = HINT; if (was || camera) { renderInspector(); draw(); } }
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
    if (e.altKey) {if(a.pathKeys?.length&&a.path.length<=2){undoStack.pop();updateHistory();notify('Keep two points in a keyed shape, or clear the animation.');return;} a.path.splice(hit, 1); syncPathEnds(a); changed(); renderInspector(); return; }
    pathDrag = { id: a.id, i: hit, moved: false }; try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    return;
  }
  const ll = screenToLonLat(lastView, sx, sy);
  if (!ll) { notify('Click on the map surface'); return; }
  if ((a.path || []).length >= 120) { notify('A path can have up to 120 points'); return; }
  if(a.shape==='distance'&&a.path?.length>=2){notify('Distance uses two points. Drag a point or clear to pick again.');return;}
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
  if (pick.kinds === 'highlightRadius') {
    const a = proj.actions.find(a => a.id === pick.id && a.type === 'highlight');
    const f = a && featureForTarget(geo, a.target);
    if (!f) { notify('Choose a highlight country or region first'); return; }
    const origin = a.highlightOrigin || { kind: 'point', name: 'Region center', lon: xToLon(f.cx), lat: yToLat(f.cy) };
    const dx = lonToX(ll.lon) - lonToX(origin.lon), dy = latToY(ll.lat) - latToY(origin.lat);
    const radius = Math.hypot(dx - Math.round(dx), dy) * 40075 * Math.cos(origin.lat * Math.PI / 180);
    checkpoint(); a.highlightOrigin = origin; a.highlightExtent = 'radius'; a.radius = clamp(Math.round(radius), 1, 20000);
    cancelPick(); changed(); renderInspector(); notify('Highlight radius set'); return;
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
  if(pick.key==='__excluded'){
    const a=items().find(i=>i.id===pick.id);if(a?.type!=='highlight'||!regionTarget(a)){cancelPick();return;}
    checkpoint();if(excludeMember(a,loc,true)){changed();renderInspector();notify(`${a.highlightExclude.length} regions excluded`);}else{undoStack.pop();updateHistory();}return;
  }
  if (pick.key === '__members') { // stays active so several regions can be clicked in a row
    const a = items().find(i => i.id === pick.id); if (!a || !regionTarget(a)) { cancelPick(); return; }
    checkpoint();
    if (addMember(a, loc, true)) { changed(); renderInspector(); const n = membersOf(a).length; notify(`${n} region${n === 1 ? '' : 's'} selected`); } else { undoStack.pop(); updateHistory(); }
    return;
  }
  const it = items().find(i => i.id === pick.id);
  if(it?.type==='group'&&pick.key==='__groupDestination'){
    const input=$('#mInspector [data-mf="__groupDestination"]');cancelPick();if(input){input.value=locText(loc);input.dispatchEvent(new Event('change',{bubbles:true}));}return;
  }
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
function networkDesignFields(a){
  const width=F.range('width',a.shape==='road'?'Road width':'Track width',a.width??6,1,100,.5,v=>v+' px');
  if(a.shape==='road')return '<div class="section-title">ROAD DESIGN</div>'
    +F.sel('roadStyle','Surface / design',a.roadStyle||'asphalt',Object.entries(ROAD_STYLES).map(([k,s])=>[k,s.label]))+width
    +F.sel('roadLanes','Lanes',a.roadLanes??(a.roadStyle==='highway'?4:a.roadStyle==='dirt'?1:2),[1,2,3,4,6].map(n=>[n,String(n)]))
    +F.sel('roadMarkings','Lane markings',a.roadMarkings||'auto',Object.entries(ROAD_MARKINGS))
    +F.range('roadShoulder','Shoulder / pavement width',a.roadShoulder??(a.roadStyle==='residential'?3:1.5),0,12,.5,v=>v+' px')
    +F.chk('roadEdgeLines','Paint road edge lines',a.roadEdgeLines!==false)+F.color('color','Road surface color',a.color)
    +'<p class="mini-label">Width scales with the exported canvas. Lane count, shoulders and surface design change the road itself.</p>';
  return '<div class="section-title">RAILWAY DESIGN</div>'
    +F.sel('railStyle','Track design',a.railStyle||'wood',Object.entries(RAIL_STYLES).map(([k,s])=>[k,s.label]))+width
    +F.range('sleeperSpacing','Sleeper spacing',a.sleeperSpacing??1,.5,2.5,.1,v=>v.toFixed(1)+'×')
    +F.chk('railBallast','Gravel ballast bed',a.railBallast!==false)+F.chk('railElectrified','Overhead electric equipment',!!a.railElectrified)
    +F.color('color','Steel rail color',a.color)+'<p class="mini-label">Two separate rails, visible sleepers and ballast scale with track width. Double track adds a second parallel line.</p>';
}
const LIGHT_FIELDS=['azimuth','altitude','intensity','ambient','warmth','shadowStrength'];
const lightId=key=>'mLight'+key[0].toUpperCase()+key.slice(1);
const lightValue=(key,value)=>['azimuth','altitude'].includes(key)?value+'°':Math.round(value*100)+'%';
function renderLightingSettings(){
  const light=lightingOf(proj);$('#mLightingEnabled').checked=light.enabled;$('#mLightPreset').value=light.preset;$('#mLightPreset').disabled=!light.enabled;
  for(const key of LIGHT_FIELDS){const id=lightId(key);$('#'+id).value=light[key];$('#'+id).disabled=!light.enabled;$('#'+id+'Value').textContent=lightValue(key,light[key]);}
}
function renderSettings() {
  $('#mProjectName').value = proj.name; $('#mFps').value = proj.fps; $('#mFpsLabel').textContent = proj.fps + ' FPS';
  syncMapDuration(); $('#mSize').value = proj.width + ',' + proj.height; $('#mCompLabel').textContent = `${proj.width} × ${proj.height}`;
  renderLightingSettings();renderTerrainSettings();
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
  $('#mGraticule').classList.toggle('active', !!proj.graticule);
  $('#mGraticule').setAttribute('aria-pressed', String(!!proj.graticule));
  renderLabelPanel();
  renderMapBackgroundSettings();
}
function renderMapBackgroundSettings(){
  const b=mapBackgroundOf(proj),modern=b.mode==='modern',custom=['blank','image'].includes(b.mode);
  $('#mMapBackground').value=b.mode;$('#mMapBackgroundColor').value=b.color;
  $('#mMapBackgroundColorBox').hidden=!custom;$('#mMapBackgroundImageBox').hidden=b.mode!=='image';
  $('#mMapBackgroundRemove').disabled=!b.image;$('#mMapBackgroundImageName').textContent=b.image?(b.name||'Uploaded map'):'No map image chosen';
  $('#mMapBackgroundNote').textContent={modern:'The world map with modern country boundaries.',coastline:'Land and water without modern borders or country names. Draw your own regions.',image:'Use your own historical or custom map image. Modern borders and names are hidden.',blank:'An empty canvas for building your own map or scene.'}[b.mode];
  for(const el of $$('[data-map-bound]'))el.value=b[el.dataset.mapBound];
  $('#mMapStyleBox').hidden=custom;$('#mAreaBox').hidden=!modern;$('#mAtlasLabels').hidden=!modern;
  $('#mGraticule').disabled=custom;$('#mGrat').disabled=custom;
  $('#mGraticule').classList.toggle('active',!custom&&!!proj.graticule);$('#mGraticule').setAttribute('aria-pressed',String(!custom&&!!proj.graticule));
  if(!modern)$('#mImageryBox').hidden=true;
  if(custom&&$('#mTerrainBox'))$('#mTerrainBox').hidden=true;
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
  $('#mAreaNote').textContent = countries.length ? 'The world map stays as it is. Only the countries listed above get detailed boundaries, and each loads only when added.' : 'Pick a country and press Add country details. Nothing extra loads until you do.';
}
function renderTerrainSettings() {
  $('#mTerrainBox').hidden = !THEMES[proj.theme]?.relief;
  const settings = terrainSettingsOf(proj);
  for (const [key, value] of Object.entries(settings)) {
    if (!(key in RELIEF_DEFAULTS)) continue;
    const id = '#mTerrain' + key[0].toUpperCase() + key.slice(1), el = $(id);
    if(['azimuth','altitude'].includes(key)){el.disabled=lightingOf(proj).enabled;el.title=el.disabled?'Controlled by Sunlight & day / night':'';}
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
  $('#mLightingEnabled').onchange=edit(el=>{proj.lighting={...lightingOf(proj),enabled:el.checked};});
  $('#mLightPreset').onchange=edit(el=>{proj.lighting=el.value==='custom'?{...lightingOf(proj),enabled:true,preset:'custom'}:lightingPreset(el.value);});
  $('#mAddSunlightEffect').onclick=()=>{$('#mSettingsPanel').close();addAction('effect',{fx:'sunlight',lighting:lightingOf(proj).enabled?lightingOf(proj):lightingPreset('day')});};
  $('#mLightingReset').onclick=edit(()=>{delete proj.lighting;});
  for(const key of LIGHT_FIELDS){
    const id=lightId(key);let editing=false;
    $('#'+id).oninput=e=>{pause();if(!editing){checkpoint();editing=true;}proj.lighting={...lightingOf(proj),preset:'custom',[key]:+e.target.value};$('#'+id+'Value').textContent=lightValue(key,proj.lighting[key]);$('#mLightPreset').value='custom';draw();};
    $('#'+id).onchange=()=>{editing=false;saveLocal();renderSettings();};
  }
  $('#mProjectName').onchange = edit(el => proj.name = el.value.trim().slice(0, 100) || 'Untitled map');
  $('#mFps').onchange = edit(el => proj.fps = +el.value);
  $('#mDuration').onchange = edit(el => { const seconds = Number(el.value), frames = Math.max(2, Math.round(seconds * proj.fps)); if (el.value.trim() && Number.isFinite(seconds) && Number.isSafeInteger(frames)) proj.frames = frames; frame = Math.min(frame, proj.frames - 1); });
  $('#mSize').onchange = edit(el => { const [w, h] = el.value.split(',').map(Number); proj.width = w; proj.height = h; });
  $('#mMapBackground').onchange=edit(el=>{proj.mapBackground={...mapBackgroundOf(proj),mode:el.value};});
  $('#mMapBackgroundColor').onchange=edit(el=>{proj.mapBackground={...mapBackgroundOf(proj),color:el.value};});
  $('#mMapBackgroundUpload').onclick=()=>$('#mMapBackgroundFile').click();
  $('#mMapBackgroundFile').onchange=async e=>{
    const file=e.target.files?.[0];e.target.value='';if(!file)return;
    try{
      const image=await importObjectImage(file,2048),background={...mapBackgroundOf(proj),mode:'image',image,name:file.name.slice(0,160)};
      await preloadBadges({...proj,mapBackground:background});pause();checkpoint();proj.mapBackground=background;saveLocal();renderAll();
    }catch(error){notify(error.message);}
  };
  $('#mMapBackgroundRemove').onclick=edit(()=>{const b=mapBackgroundOf(proj);delete b.image;delete b.name;proj.mapBackground=b;});
  for(const el of $$('[data-map-bound]'))el.onchange=()=>{
    const b={...mapBackgroundOf(proj),[el.dataset.mapBound]:Number(el.value)};
    try{validateMapBackground({mapBackground:b});pause();checkpoint();proj.mapBackground=b;saveLocal();renderAll();}catch(error){notify(error.message);renderMapBackgroundSettings();}
  };
  $('#mTheme').onchange = edit(el => {
    if(el.value==='documentary')applyDocumentaryLook(proj);
    else proj.theme=el.value;
  });
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
}

// ------------------------------------------------------------------ timeline
function frameFromEvent(e) { const b = $('#mTracks').getBoundingClientRect(); return clamp(Math.round((e.clientX - b.left) / b.width * (proj.frames - 1)), 0, proj.frames - 1); }
function updateCameraKeySelection() {
  $$('#mTrackRows [data-map-key]').forEach(el => el.classList.toggle('current', el.dataset.keyItem === sel && el.dataset.mapKey === `camera:${frame}`&&(!selectedCameraKeyId||el.dataset.cameraKeyId===selectedCameraKeyId)));
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
  const extraKeys=(field,kind)=>(it[field]||[]).filter(k=>k.frame>=it.start&&k.frame<=it.start+it.dur).map(k=>`<button type="button" class="m-key m-campaign-key ${kind==='lighting'&&it.id===sel&&k.frame===frame?'current':''}" data-map-key="${kind}:${k.frame}" data-key-item="${esc(it.id)}" style="left:clamp(11px,${Math.min(last,k.frame)/last*100}%,calc(100% - 11px))" aria-label="${kind} keyframe, frame ${k.frame}" title="${kind} keyframe · frame ${k.frame}. Drag to retime."></button>`).join('');
  if(it.fx==='sunlight')return extraKeys('lightingKeys','lighting');
  if(it.type==='group')return extraKeys('groupKeys','group');
  if (it.preset === 'keyframed') return cameraKeysOf(it).filter(k=>k.frame>=it.start&&k.frame<=it.start+it.dur).filter(k=>Object.keys(k.values).some(f=>cameraTrackFields().includes(f))).map(k=>{
    const label=k.pairId?`${PRESETS[k.preset].label} ${k.pairRole} - paired`:'Camera keyframe';
    const shared=cameraKeysOf(it).filter(p=>p.frame===k.frame),index=shared.indexOf(k),columns=Math.ceil(shared.length/2),offset=shared.length>1?(Math.floor(index/2)-(columns-1)/2)*20:0,vertical=shared.length>1?(index%2?8:-8):0,padding=11+(columns-1)*10;
    return `<button type="button" class="m-key m-camera-key ${k.pairId?'m-camera-paired ':''}${k.frame===frame&&it.id===sel&&(!selectedCameraKeyId||k.id===selectedCameraKeyId)?'current':''}" data-map-key="camera:${k.frame}" data-camera-key-id="${esc(k.id||'')}" data-key-item="${esc(it.id)}" style="left:clamp(${padding}px,${Math.min(last,k.frame)/last*100}%,calc(100% - ${padding}px));margin-left:${offset}px;top:calc(50% + ${vertical}px)" title="${esc(label)} - frame ${k.frame}. Drag to retime; right-click or Delete to remove." aria-label="${esc(label)}, frame ${k.frame}"></button>`;
  }).join('');
  const fields=objectProperty==='all'?['size','objectAngle','objectView','damageState']:[objectProperty];
  const objectMarkers=it.type==='object'&&objectProperty!=='animation'?(it.objectKeys||[]).filter(k=>k.frame>=it.start&&k.frame<=it.start+it.dur).filter(k=>fields.some(field=>k.values[field]!==undefined)).map(k=>`<button type="button" class="m-key m-object-key" data-map-key="object:${objectProperty}:${k.frame}" data-key-item="${esc(it.id)}" style="left:clamp(11px, ${Math.min(last,k.frame)/last*100}%, calc(100% - 11px))" title="Object ${esc(objectProperty)} keyframe at frame ${k.frame}" aria-label="Object keyframe at frame ${k.frame}"></button>`).join(''):'';
  if(it.type==='object'&&!['all','animation'].includes(objectProperty))return objectMarkers;
  const keys = animationKeysOf(it);
  return [['animationStart', keys.start, 'Animation start'], ['animationEnd', keys.end, 'Animation finish']].filter(([, time]) => time >= it.start && time <= it.start + it.dur).map(([key, time, label]) => `<button type="button" class="m-key" data-map-key="${key}" data-key-item="${esc(it.id)}" style="left:clamp(11px, ${Math.min(last, time) / last * 100}%, calc(100% - 11px))" title="${label}: frame ${time}. Drag to retime animation." aria-label="${esc(it.name)} ${label} keyframe, frame ${time}"></button>`).join('')+objectMarkers+extraKeys('pathKeys','path');
}
function focusCameraMarker(id,at){const marker=$$('[data-map-key]').find(b=>b.dataset.keyItem===sel&&(id?b.dataset.cameraKeyId===id:b.dataset.mapKey===`camera:${at}`));marker?.focus({preventScroll:true});}
function bindTimelineKeys(root = document) {
  [...root.querySelectorAll('[data-map-key]')].forEach(el => {
    if(el.dataset.mapKey.startsWith('camera:')){
      el.onfocus=()=>{selectedCameraKeyId=el.dataset.cameraKeyId||null;};
      el.oncontextmenu=e=>{
        e.preventDefault();e.stopPropagation();pause();selectedCameraKeyId=el.dataset.cameraKeyId||null;sel=el.dataset.keyItem;
        document.querySelector('#mCameraKeyMenu')?.remove();const menu=document.createElement('div');menu.id='mCameraKeyMenu';menu.className='m-map-add-context';
        const button=document.createElement('button');button.type='button';button.textContent=cameraKeyAt(current(),+el.dataset.mapKey.split(':')[1],selectedCameraKeyId)?.pairId?'Delete movement pair':'Delete keyframe';
        button.onclick=()=>{deleteCameraKeyAt(current(),+el.dataset.mapKey.split(':')[1],selectedCameraKeyId);menu.remove();};menu.append(button);document.body.append(menu);
        menu.style.left=Math.max(8,Math.min(innerWidth-190,e.clientX))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-50,e.clientY))+'px';button.focus();
        const outside=event=>{if(!menu.contains(event.target)){menu.remove();document.removeEventListener('pointerdown',outside,true);}};document.addEventListener('pointerdown',outside,true);
        menu.onkeydown=event=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();menu.remove();}};
      };
    }
    el.onpointerdown = e => {
      if (e.button !== 0) return;
      if(el.dataset.mapKey.startsWith('camera:'))selectedCameraKeyId=el.dataset.cameraKeyId||null;
      e.preventDefault(); e.stopPropagation(); pause();
      const it = items().find(i => i.id === el.dataset.keyItem); if (!it) return;
      sel = it.id; renderItems(); renderInspector();
      if (el.dataset.mapKey.startsWith('camera:')) setFrame(+el.dataset.mapKey.split(':')[1]);
      if(el.dataset.mapKey.startsWith('lighting:'))setFrame(+el.dataset.mapKey.split(':')[1]);
      if (el.dataset.mapKey.startsWith('object:')) setFrame(+el.dataset.mapKey.split(':')[2]);
      checkpoint(); drag = { kind: 'clip', id: it.id, cameraKeyId:el.dataset.cameraKeyId||null,mode: el.dataset.mapKey, x0: frameFromEvent(e), start: it.start, dur: it.dur, sourceStart: it.sourceStart, moveStart: it.moveStart, moveEnd: it.moveEnd, animDur: it.animDur, animStart: it.animStart, animEnd: it.animEnd, cameraKeys: it.preset === 'keyframed' ? clone(cameraKeysOf(it)) : null, objectKeys: it.objectKeys ? clone(it.objectKeys) : null, pathKeys: it.pathKeys ? clone(it.pathKeys) : null, groupKeys: it.groupKeys ? clone(it.groupKeys) : null, lightingKeys: it.lightingKeys ? clone(it.lightingKeys) : null, groupChildren: it.type === 'group' ? clone(proj.actions.filter(a=>it.memberIds.includes(a.id))) : null, moved: false };
      renderTimeline();if(el.dataset.mapKey.startsWith('camera:'))focusCameraMarker(el.dataset.cameraKeyId,+el.dataset.mapKey.split(':')[1]);
    };
    el.onkeydown = e => {
      if(['Delete','Backspace'].includes(e.key)&&el.dataset.mapKey.startsWith('lighting:')){e.preventDefault();e.stopImmediatePropagation();pause();checkpoint();removeLightingKey(items().find(i=>i.id===el.dataset.keyItem),+el.dataset.mapKey.split(':')[1]);changed();renderInspector();return;}
      if(['Delete','Backspace'].includes(e.key)&&el.dataset.mapKey.startsWith('camera:')){e.preventDefault();e.stopImmediatePropagation();deleteCameraKeyAt(items().find(i=>i.id===el.dataset.keyItem),+el.dataset.mapKey.split(':')[1],el.dataset.cameraKeyId||null);return;}
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
      e.preventDefault(); e.stopPropagation(); pause();
      const it = items().find(i => i.id === el.dataset.keyItem), key = el.dataset.mapKey;
      const d = (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1);
      checkpoint();
      let focusKey = key;
      if (key.startsWith('camera:')) { const from = +key.split(':')[1], to = clamp(from + d, it.start, it.start + it.dur); moveCameraKey(it, from, to, cameraTrackFields(),el.dataset.cameraKeyId||null); setFrame(to); focusKey = `camera:${to}`; }
      else if(key.startsWith('object:')){const [,field,time]=key.split(':'),from=+time,to=clamp(from+d,it.start,it.start+it.dur);moveObjectKey(it,from,to,field==='all'?['size','objectAngle','objectView','damageState']:[field]);setFrame(to);focusKey=`object:${field}:${to}`;}
      else if(key.startsWith('path:')||key.startsWith('group:')||key.startsWith('lighting:')){const[kind,time]=key.split(':'),from=+time,to=clamp(from+d,it.start,it.start+it.dur);(kind==='lighting'?moveLightingKey:kind==='path'?movePathKey:moveGroupKey)(it,from,to);setFrame(to);focusKey=`${kind}:${to}`;}
      else setAnimationKey(it, key, animationKeysOf(it)[key === 'animationStart' ? 'start' : 'end'] + d);
      ensureLength(it.start + it.dur); changed(); renderInspector();
      $$('[data-map-key]').find(b => b.dataset.keyItem === it.id && b.dataset.mapKey === focusKey)?.focus();
    };
  });
}
bindTimelineRename($('#mTrackLabels'), { attribute: 'data-mtl', getItem: id => items().find(it => it.id === id), checkpoint, changed: () => { changed(); renderInspector(); }, pause });
function renderTimeline() {
  if(timelineAutoFit&&!drag){
    let end=Math.max(0,...proj.actions.map(a=>a.start+a.dur),...proj.shots.flatMap(s=>s.preset==='keyframed'?cameraKeysOf(s).map(k=>k.frame):[s.start+s.dur]));
    try{for(const layer of getAudioSnapshot('map')?.layers||[])end=Math.max(end,(layer.start+layer.duration)*proj.fps);}catch{}
    const visible=end?Math.min(proj.frames-1,Math.max(proj.fps*2,end+Math.max(proj.fps*.5,end*.05))):proj.frames-1;
    $('#mZoomT').value=clamp((proj.frames-1)/visible,1,32);
  }
  const zoom = +$('#mZoomT').value, its = displayItems(), last = proj.frames - 1;
  $('#mTracks').style.width = `${zoom * 100}%`;
  const step = Math.max(1, Math.round(proj.frames / proj.fps / (10 * zoom))) * proj.fps;
  let ticks = ''; for (let f = 0; f < proj.frames; f += step) ticks += `<span class="tick" style="left:${f / last * 100}%">${+(f/proj.fps).toFixed(2)}s</span>`;
  $('#mRuler').innerHTML = ticks;
  $('#mTrackLabels').innerHTML = its.map(it => `<div class="track-label ${it.id === sel ? 'selected' : ''}" data-mtl="${esc(it.id)}"><span>${iconOf(it)}</span><span class="ff-layer-name" title="Double-click or double-tap to rename">${esc(it.name)}</span></div>`).join('');
  $('#mTrackRows').innerHTML = its.map(it => `<div class="track-row m-row ${it.id === sel ? 'selected' : ''}" data-mrow="${esc(it.id)}"><div class="m-clip t-${clsOf(it)} ${it.id === sel ? 'selected' : ''}" data-mclip="${esc(it.id)}" style="left:${it.start / last * 100}%;width:${Math.max(.6, it.dur / last * 100)}%" title="${esc(it.name)} · frame ${it.start}–${it.start + it.dur}">${it.fullTimelineCamera?'':'<i class="m-h l" data-h="l"></i>'}<span>${esc(it.name)}</span>${it.fullTimelineCamera?'':'<i class="m-h r" data-h="r"></i>'}</div>${timelineKeys(it, last)}</div>`).join('');
  $('#mTrackLabels').style.transform = `translateY(-${$('#mScroll').scrollTop}px)`;
  $$('[data-mtl]').forEach(el => el.onclick = e => selectFromList(el.dataset.mtl,e));
  $$('[data-mclip]').forEach(el => el.onpointerdown = e => {
    e.preventDefault(); e.stopPropagation(); pause();
    const id = el.dataset.mclip, it = items().find(i => i.id === id); if (!it) return;
    if(e.shiftKey&&directMapEditing?.toggleSelection(id)){renderTimeline();return;}
    if (sel !== id) { directMapEditing?.setSelection([id]);sel = id; renderItems(); renderInspector();draw(); }
    if (it.fullTimelineCamera) { renderTimeline(); return; }
    checkpoint(); drag = { kind: 'clip', id, mode: e.target.dataset.h || 'move', x0: frameFromEvent(e), start: it.start, dur: it.dur, sourceStart: it.sourceStart, moveStart: it.moveStart, moveEnd: it.moveEnd, animDur: it.animDur, animStart: it.animStart, animEnd: it.animEnd, cameraKeys: it.preset === 'keyframed' ? clone(cameraKeysOf(it)) : null, objectKeys: it.objectKeys ? clone(it.objectKeys) : null, pathKeys: it.pathKeys ? clone(it.pathKeys) : null, groupKeys: it.groupKeys ? clone(it.groupKeys) : null, lightingKeys: it.lightingKeys ? clone(it.lightingKeys) : null, groupChildren: it.type === 'group' ? clone(proj.actions.filter(a=>it.memberIds.includes(a.id))) : null, moved: false };
    renderTimeline();
  });
  bindTimelineKeys();
  $$('[data-mrow]').forEach(el => el.onpointerdown = e => { if (e.target.closest('[data-mclip], [data-map-key]')) return; select(el.dataset.mrow); scrub(e); });
  audioUI?.renderTimeline();
  campaign?.decorateTimeline();
}
function scrub(e) { pause(); setFrame(frameFromEvent(e)); drag = { kind: 'scrub' }; }
window.addEventListener('pointermove', e => {
  if (!drag) return;
  if (drag.kind === 'scrub') { const next = frameFromEvent(e); if (next !== frame) setFrame(next); return; }
  const it = items().find(i => i.id === drag.id); if (!it) return;
  if(drag.mode?.startsWith('path:')||drag.mode?.startsWith('group:')||drag.mode?.startsWith('lighting:')){
    const[kind,time]=drag.mode.split(':'),from=+time,to=clamp(from+frameFromEvent(e)-drag.x0,it.start,it.start+it.dur);if(drag.lastTo===to)return;drag.lastTo=to;
    const field=kind==='lighting'?'lightingKeys':kind==='path'?'pathKeys':'groupKeys';it[field]=clone(drag[field]||[]);(kind==='lighting'?moveLightingKey:kind==='path'?movePathKey:moveGroupKey)(it,from,to);drag.moved=true;setFrame(to);updateTimelineItem(it);return;
  }
  const rawDelta = frameFromEvent(e) - drag.x0; const d = ['move','l','r'].includes(drag.mode) ? snapTimelineDelta($('#mTracks'),rawDelta,drag.start,drag.start+drag.dur,drag.mode,drag.id,proj.frames-1,proj.fps,e) : rawDelta; if (d !== 0) drag.moved = true;
  if(drag.mode.startsWith('object:')){const [,field,time]=drag.mode.split(':'),from=+time,to=clamp(from+d,it.start,it.start+it.dur);if(drag.lastTo===to)return;drag.lastTo=to;it.objectKeys=clone(drag.objectKeys||[]);moveObjectKey(it,from,to,field==='all'?['size','objectAngle','objectView','damageState']:[field]);setFrame(to);updateTimelineItem(it);return;}
  if (drag.mode.startsWith('camera:')) {
    const from = +drag.mode.split(':')[1], to = clamp(from + d, it.start, it.start + it.dur);
    if (drag.lastTo === to) return; drag.lastTo = to;
    it.cameraKeys = clone(drag.cameraKeys); moveCameraKey(it, from, to, cameraTrackFields(),drag.cameraKeyId); setFrame(to); updateTimelineItem(it); return;
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
  it.start = drag.start; it.dur = drag.dur; if (drag.sourceStart !== undefined) it.sourceStart = drag.sourceStart;
  if (drag.animStart !== undefined) { it.animStart = drag.animStart; it.animEnd = drag.animEnd; }
  if (drag.moveStart !== undefined) { it.moveStart = drag.moveStart; it.moveEnd = drag.moveEnd; }
  if (drag.cameraKeys) it.cameraKeys = clone(drag.cameraKeys);
  if (drag.objectKeys) it.objectKeys = clone(drag.objectKeys);
  if(drag.pathKeys)it.pathKeys=clone(drag.pathKeys);
  if(drag.groupKeys)it.groupKeys=clone(drag.groupKeys);
  if(drag.lightingKeys)it.lightingKeys=clone(drag.lightingKeys);
  if(drag.groupChildren)for(const original of drag.groupChildren){const child=proj.actions.find(a=>a.id===original.id);if(child)Object.assign(child,clone(original));}
  retimeEditorItem(it, start, dur, drag.mode === 'move');
  const oldFrames = proj.frames; ensureLength(it.start + it.dur);
  if (proj.frames !== oldFrames) renderTimeline(); else updateTimelineItem(it);
  if(it.type==='group')for(const child of proj.actions.filter(a=>it.memberIds.includes(a.id)))updateTimelineItem(child);
  draw(); const s = $('#mInspector [data-mf="start"]'), l = $('#mInspector [data-mf="dur"]'); if (s) s.value = it.start; if (l) l.value = it.dur;
});
window.addEventListener('pointerup', () => { const cameraDrag=drag?.mode?.startsWith('camera:')?drag:null;if (drag?.kind === 'clip') { if (!drag.moved) undoStack.pop(); changed(); renderInspector(); updateHistory(); } drag = null;if(cameraDrag)focusCameraMarker(cameraDrag.cameraKeyId,frame); });
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
  $('#mCaptureView').onclick = captureViewAtPlayhead;
  $('#mSplit').onclick = () => {
    const it = current();
    if (!it || it.fullTimelineCamera || frame <= it.start || frame >= it.start + it.dur) { notify('Move the playhead inside the item you want to split.'); return; }
    pause(); checkpoint();
    if (isShot(it) && !it.sourceFrom) it.sourceFrom = cameraAt(proj, geo, proj.width, proj.height, it.start);
    const right = splitMapItem(it, frame, crypto.randomUUID());right.createdOrder=nextCreationOrder();
    if(it.type==='group'){
      const children=proj.actions.filter(a=>it.memberIds.includes(a.id));
      if(proj.actions.length+children.length+1>200){history('undo');notify('This split would exceed 200 items.');return;}
      right.memberIds=children.map(child=>{const copy=clone(child);copy.id=crypto.randomUUID();proj.actions.push(copy);return copy.id;});
    }
    const list = isShot(it) ? proj.shots : proj.actions;
    list.splice(list.indexOf(it) + 1, 0, right);
    sel = right.id; saveLocal(); renderAll(); notify('Layer split at playhead');
  };
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
  for (const [id, icon, label] of [['mStart','firstFrame','First frame'],['mPrev','previousFrame','Previous frame'],['mNext','nextFrame','Next frame'],['mEnd','lastFrame','Last frame'],['mLoop','loop','Loop playback']]) {
    $('#'+id).innerHTML = interfaceIcon(icon);$('#'+id).setAttribute('aria-label',label);
  }
  updatePlayControl();
  const updateLoopControl = () => { $('#mLoop').classList.toggle('active',loop);$('#mLoop').setAttribute('aria-pressed',String(loop));$('#mLoop').title = `Loop playback: ${loop ? 'On' : 'Off'}`; };
  updateLoopControl();
  $('#mLoop').onclick = () => { loop = !loop; updateLoopControl(); };
  $('#mFrame').onchange = e => { pause(); setFrame(Math.round(+e.target.value * proj.fps)); };
  $('#mZoomT').oninput = () => { timelineAutoFit=false;renderTimeline();setFrame(frame); };
  $('#mFitTimeline').onclick=()=>{timelineAutoFit=true;renderTimeline();setFrame(frame);$('#mScroll').scrollLeft=0;};
  $('#mMoveUp').onclick = () => moveItem(-1); $('#mMoveDown').onclick = () => moveItem(1);
  $('#mDuplicate').onclick = () => { if(!audioUI?.duplicate())runLayerAction(directMapEditing?.selectionIds()||[sel],'duplicate'); };
  $('#mDelete').onclick = () => { if(!audioUI?.remove())runLayerAction(directMapEditing?.selectionIds()||[sel],'delete'); };
  $('#mNew').onclick = async () => { if (!await confirmStudio('Start an empty map? Your current edit can be restored with Undo.')) return; pause(); checkpoint(); proj = newMapProject(); audioUI?.reset(); sel = null; frame = 0; saveLocal(); renderAll(); };
  $('#mDemo').onclick = async () => { if (!await confirmStudio('Load the demo map? Your current edit can be restored with Undo.', 'Load demo', 'Load demo')) return; pause(); checkpoint(); proj = demoMapProject(); audioUI?.reset(); sel = null; frame = 0; saveLocal(); renderAll(); };
  $('#mHelp').onclick = () => modal(`<h2>Map Studio</h2><ol><li><b>Add and place.</b> Choose a tool, then click the map to place it. Right-click empty map space to add a layer at that point.</li><li><b>Select and edit.</b> Click a layer on the canvas or in Layers. Shift-click selects more layers. The top bar edits common settings for the selection; Properties contains the full controls.</li><li><b>Move and resize.</b> Drag a layer to move its anchor. Use the cyan Size handle to resize objects, pins, effects or text. The gold direction handle rotates objects and groups. Moving objects keep their destination when you drag their starting anchor.</li><li><b>Work with regions.</b> Click land, or Shift-click several regions. Right-click the selection for Highlight, Border or Label. Fill and text are independent settings on the same region layer.</li><li><b>Group and manage layers.</b> Right-click selected objects to Group. Groups remain together until Ungroup. Duplicate, Hide/Show and Delete work with selected layers, with one Undo for each batch action.</li><li><b>Animate.</b> Choose Stay, Move to another place, or Move along my path in Object properties. Timeline bars set visibility; animation diamonds set movement timing. Split (S) cuts a regular layer at the playhead.</li><li><b>Set the camera.</b> Pan or zoom the map, move the playhead, and press the bottom-left camera button to save that view. The camera layer always spans the timeline. Camera presets add paired start/end keys on this same track. Delete either endpoint to remove the movement; manual keys stay independent.</li><li><b>Preview and export.</b> Space plays the timeline. Preview zoom changes only the workspace view. Export video renders your saved animation.</li></ol><p><b>Shortcuts:</b> Ctrl/Cmd+D duplicate ? Ctrl/Cmd+G group ? Ctrl/Cmd+Shift+G ungroup ? Delete remove selected layers ? Ctrl/Cmd+Z undo ? Esc clear selection or cancel picking.</p>`);
  $('#mCloseModal').onclick = () => { if (exporting) { exporting = false; $('#mCloseModal').disabled = true; } else $('#mModal').close(); };
  $('#mModal').addEventListener('cancel', e => { if (exporting) { e.preventDefault(); exporting = false; } });
}

// ------------------------------------------------------------------ mode switch + shortcuts
function setMode(m) {
  document.body.classList.toggle('mode-map', m === 'map');
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
    if (a?.path?.length) {if(a.pathKeys?.length&&a.path.length<=2){notify('Keep two points in a keyed shape, or clear the animation.');return;} checkpoint(); a.path.pop(); syncPathEnds(a); changed(); renderInspector(); }
  }
}, true);
window.addEventListener('keydown', e => {
  if (!document.body.classList.contains('mode-map')) return;
  if (document.activeElement?.classList.contains('ff-timeline-name-input')) return;
  if (e.key === 'Escape' && pick) { cancelPick(); return; }
  if(['Delete','Backspace'].includes(e.key)&&current()?.preset==='keyframed'&&selectedCameraKeyId&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){e.preventDefault();deleteCameraKeyAt(current(),frame,selectedCameraKeyId);return;}
  if ($('#mModal').open || ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); history(e.shiftKey ? 'redo' : 'undo'); return; }
  if (e.code === 'Space') { e.preventDefault(); play(); }
  else if (e.key.toLowerCase() === 's' && !e.ctrlKey && !e.metaKey && !e.altKey) { e.preventDefault(); $('#mSplit').click(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); pause(); setFrame(frame + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 10 : 1)); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); $('#mDelete').click(); }
});

function renderAll() { ensureCameraTrack();migrateCameraMovements(); if(proj.area?.mode==='country'){proj.area={...proj.area,mode:'world',detailCountries:detailCountriesOf(proj.area)};saveLocal()} if (geo) { buildLists(); for (const c of wantedCountries()) if (!geo.details?.has(c) && !detailLoads.has(c)) void loadDetail(c); } if (pathDraw && !proj.actions.some(a => a.id === pathDraw.id)) { pathDraw = null; pathDrag = null; canvas.style.cursor = ''; $('#mHint').textContent = HINT; } renderSettings(); renderItems(); renderInspector(); renderTimeline(); setFrame(frame); updateHistory(); }

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
    setIconButton(mapFullscreenButton, active ? 'exitFullscreen' : 'fullscreen', active ? 'Exit fullscreen' : 'Show map fullscreen', active ? 'Exit fullscreen (Esc or F)' : 'Show map fullscreen (F)');
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
try { const saved = localStorage.getItem(STORE); proj = saved ? validateMapProject(JSON.parse(saved)) : newMapProject(); } catch { proj = newMapProject(); }
campaign=installCampaignUI({canvas,F,project:()=>proj,current,frame:()=>frame,geo:()=>geo,area:()=>areaOf(proj),creationOrder:nextCreationOrder,detailLevelOf,pause,checkpoint,changed,renderInspector,notify,select,seek:setFrame,draw,startPathDraw,endPathDraw,cancelPick,editingPath:id=>pathDraw?.id===id,resolve:loc=>geo&&resolveLoc(geo,loc),exporting:()=>exporting,
  projectPoint:(view,p)=>{const X=lonToX(p.lon);return projectPoint(view,X+Math.round(view.cx-X),latToY(p.lat));},
  pointAt:e=>{if(!lastView||!geo)return null;const{sx,sy}=canvasXY(e);return screenToLonLat(lastView,sx,sy);}
});
directMapEditing=installDirectMapEditing({canvas,project:()=>proj,view:()=>lastView,geo:()=>geo,frame:()=>frame,current,select,pause,checkpoint,changed,renderInspector,draw,notify,layerAction:runLayerAction,copy:copySelectedLayers,paste:pasteCopiedLayers,canPaste:()=>!!layerClipboard,add:addAction,addAudio:()=>audioUI?.add(),duplicate:()=>$('#mDuplicate').click(),exporting:()=>exporting,creationOrder:nextCreationOrder,busy:()=>!!(pick||pathDraw||exporting||mapPan)});
buildStaticUI(); buildLists(); bindSettings(); bindToolbar(); $('#mHint').textContent = HINT;
audioUI = registerAudioStudio('map', {
 getSelected:()=>sel, getFrame:()=>frame, getFps:()=>proj.fps, getFrames:()=>proj.frames,
 select, pause, seek:setFrame, notify, updateHistory, visualCount:()=>items().length,
 addGrid:'#mAddGrid', list:'#mItems', counter:'#mItemCount', inspector:'#mInspector', inspectorTitle:'#mInspTitle',
 trackLabels:'#mTrackLabels', trackRows:'#mTrackRows', tracks:'#mTracks', actionButtons:['#mDuplicate','#mDelete']
});
saveLocal(); renderAll();
setMode('map')
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
      if(e.target!==panel)return;
      const rect = panel.getBoundingClientRect();
      if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) setOpen(false);
    });
  }
}

installTimelineControls({
 name:'map',timeline:'#mapStudio .timeline',scroll:'#mScroll',zoom:'#mZoomT',containers:['#mTrackLabels','#mItems'],
 rows:'[data-mtl],[data-mid],[data-audio-label],[data-audio-layer]',id:r=>r.dataset.mtl||r.dataset.mid||r.dataset.audioLabel||r.dataset.audioLayer,
 item:id=>audioUI?.item(id)||proj.actions.find(it=>it.id===id)||proj.shots.find(it=>it.id===id),oldButtons:['#mMoveUp','#mMoveDown','#mDuplicate','#mDelete'],
 enabled(id,action){if(audioUI?.item(id))return audioUI.rowEnabled(id,action);if(proj.shots.some(s=>s.id===id&&s.fullTimelineCamera))return false;const i=proj.actions.findIndex(a=>a.id===id);return action==='up'?i>=0&&i<proj.actions.length-1:action==='down'?i>0:true;},
 action(id,action){if(audioUI?.item(id)){audioUI.rowAction(id,action);return;}pause();select(id);if(action==='visibility'){checkpoint();current().visible=current().visible===false;changed();renderInspector();}else if(action==='up'||action==='down')moveItem(action==='up'?-1:1);else document.querySelector(action==='duplicate'?'#mDuplicate':'#mDelete').click();}
});
