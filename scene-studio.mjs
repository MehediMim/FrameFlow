// FrameFlow Scene Studio UI. Layout follows Map Studio: add-grids + item list on the left, inspector on the right,
// clip timeline below. Gestures and camera shots are clips you place on the timeline.
import { defaultScene, makeObject, makeClip, makeCameraClip, renderScene, validateScene, resolveClips, clamp, GESTURES, GESTURE_DURATION, CAMERA_MODES, CAMERA_MOVES, CAMERA_PRESETS, BODIES, OUTFITS, HAIR_STYLES, FACIAL, SKIN_TONES, HAIR_COLORS, defaultLook, humanLook } from './scene-engine.mjs';
import { exportMapVideo } from './map-video-export.mjs';
const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORE = 'frameflow-scene-v2', OLD_STORE = 'frameflow-scene-v1';
const OBJECT_ICON = { human: '♙', car: '▰', bus: '▤', tree: '♧', building: '▥' };
const GESTURE_ICON = { idle: '◌', walk: '⇢', run: '⇒', wave: '≈', point: '☞', jump: '⤒', sit: '⌴', clap: '✦', bow: '⌄' };
let p = defaultScene(), time = 0, selected = null, selClip = null, playing = false, raf = 0, busy = false, undo = [], redo = [], loop = true, timelineZoom = 1, drag = null;
try { const saved = localStorage.getItem(STORE) || localStorage.getItem(OLD_STORE); if (saved) p = validateScene(JSON.parse(saved)); } catch { /* keep demo */ }
selected = p.objects[0]?.id ?? null;

const root = document.createElement('section'); root.id = 'sceneStudio';
root.innerHTML = `<div class="sc-toolbar" id="scToolbar"><input id="scName" aria-label="Scene name"><span id="scStatus" class="muted">Saved locally</span><button data-action="undo" title="Undo">↶</button><button data-action="redo" title="Redo">↷</button><button data-action="new">New</button><button data-action="open">Open</button><button id="scSettingsButton" aria-expanded="false">⚙ Scene settings</button><button data-action="save">Save project</button><button data-action="export" class="primary">Export video ↗</button></div>
<div class="sc-workspace"><aside class="left ff-left-accordion" id="scLeft"></aside>
<main><div class="stagebar"><span><i class="dot"></i> Scene composition <b>1280 × 720</b></span><div><button data-action="png">PNG ↓</button><button data-action="fullscreen">⛶ Fullscreen</button></div></div>
<div class="sc-stage"><canvas id="scCanvas" width="1280" height="720"></canvas><span class="sc-hint">Drag to orbit the active camera shot · Scroll to zoom · Add gestures and camera shots from the left, then edit them on the timeline</span></div>
<div class="transport"><span class="time" id="scTime"></span><div class="play-controls"><button data-action="start">|◀</button><button data-action="prev">‹</button><button data-action="play" class="play">▶</button><button data-action="next">›</button><button data-action="end">▶|</button><button data-action="loop" class="active">↻</button></div><label>SECONDS <input id="scSeek" type="number" step="0.033" min="0"></label></div></main>
<aside class="right"><div class="tabs"><b>Properties</b><span>SCENE STUDIO</span></div><div id="scInspector"></div></aside></div>
<div class="sc-timeline"><div class="timeline-head"><b>Scene timeline <span class="pill">SECONDS</span></b><div class="timeline-tools"><label>Zoom <input id="scTimelineZoom" type="range" min="1" max="5" step=".25" value="1"></label></div></div><input id="scScrub" aria-label="Timeline playhead" type="range" min="0" step="0.033"><div id="scTimelineScroll"><div id="scTracks"></div></div></div>
<footer><span><i class="dot"></i> Ready to animate</span><span>Space Play / pause <em>·</em> ← → Step frames <em>·</em> Drag clips to move, drag their edges to resize <em>·</em> Click ruler to seek</span></footer>
<dialog id="scSettingsPanel"><div class="section-title"><span>SCENE SETTINGS</span><button id="scSettingsClose" aria-label="Close">✕</button></div><div id="scSettings"></div></dialog>
<input hidden id="scFile" type="file" accept=".json,application/json">`;
document.body.append(root);
const toolbar = $('#scToolbar'); document.querySelector('body > header').append(toolbar);
const canvas = $('#scCanvas'), snap = v => Math.round(v * p.fps) / p.fps, uid = () => crypto.randomUUID();

// ------------------------------------------------------------------ small builders
const field = (key, label, value, type = 'number', extra = '') => `<label>${label}<input data-field="${key}" type="${type}" value="${esc(value)}" ${extra} ${type === 'number' ? 'step="any"' : ''}></label>`;
const select = (key, label, value, options) => `<label>${label}<select data-field="${key}">${options.map(v => { const [id, name] = Array.isArray(v) ? v : [v, v[0].toUpperCase() + v.slice(1)]; return `<option value="${esc(id)}" ${String(value) === String(id) ? 'selected' : ''}>${esc(name)}</option>`; }).join('')}</select></label>`;
const group = (title, content) => `<details open class="ff-left-section"><summary class="ff-left-summary"><span>${title}</span><span class="ff-left-chevron">⌄</span></summary><div class="ff-left-content">${content}</div></details>`;
const section = (name, content) => `<details class="ff-inspector-section" data-name="${name}" %OPEN%><summary class="ff-inspector-summary"><span>${name}</span><span class="ff-inspector-chevron">⌄</span></summary><div class="ff-inspector-content">${content}</div></details>`;
const grid = (attr, items, disabled = false) => `<div class="add-grid">${items.map(([id, icon, label, tip]) => `<button ${attr}="${id}" title="${esc(tip || label)}" ${disabled ? 'disabled' : ''}><b>${icon}</b><span>${label}</span></button>`).join('')}</div>`;
const subjectOptions = () => [['', 'Auto (first human / car / bus)'], ...p.objects.filter(o => ['human', 'car', 'bus'].includes(o.type)).map(o => [o.id, o.name])];

const swatches = (attr, colors, current) => `<div class="sc-swatches">${colors.map(c => `<button type="button" class="sc-swatch ${String(current).toLowerCase() === c ? 'selected' : ''}" ${attr}="${c}" style="--sw:${c}" title="${c}" aria-label="${c}"></button>`).join('')}</div>`;

// ------------------------------------------------------------------ selection helpers
function findClip(id) {
  if (!id) return null;
  for (const o of p.objects) { const clip = (o.clips || []).find(c => c.id === id); if (clip) return { clip, owner: o, kind: 'gesture' }; }
  const clip = p.cameraClips.find(c => c.id === id); return clip ? { clip, owner: null, kind: 'camera' } : null;
}
const currentObject = () => p.objects.find(o => o.id === selected) || null;
function ensureSelection() { if (selected && !currentObject()) selected = null; if (!selected && !selClip && p.objects.length) selected = p.objects[0].id; if (selClip && !findClip(selClip)) selClip = null; }
const targetHuman = () => { const o = currentObject(); return o?.type === 'human' ? o : null; };

// ------------------------------------------------------------------ state, history, drawing
function checkpoint() { undo.push(JSON.stringify(p)); if (undo.length > 60) undo.shift(); redo = []; }
function saveLocal() { try { localStorage.setItem(STORE, JSON.stringify(p)); $('#scStatus').textContent = 'Saved locally'; } catch { $('#scStatus').textContent = 'Storage full — download project'; } }
function draw() { renderScene(canvas, p, time); $('#scTime').textContent = time.toFixed(2) + ' s / ' + p.duration + ' s'; $('#scSeek').value = time.toFixed(3); $('#scScrub').value = time; root.style.setProperty('--sc-progress', time / p.duration * 100 + '%'); }
function pause() { playing = false; cancelAnimationFrame(raf); root.querySelector('[data-action="play"]').textContent = '▶'; }
function seek(t) { pause(); time = clamp(Math.round(t * p.fps) / p.fps, 0, p.duration - 1 / p.fps); draw(); }
function play() {
  if (busy) return; if (playing) return pause();
  if (time >= p.duration - 1 / p.fps) time = 0; playing = true; const origin = performance.now(), from = time; root.querySelector('[data-action="play"]').textContent = 'Ⅱ';
  const step = now => { if (!playing) return; let t = from + (now - origin) / 1000;
    if (t >= p.duration) { if (!loop) { seek(p.duration); return; } t %= p.duration; } time = Math.floor(t * p.fps) / p.fps; draw(); raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}

// ------------------------------------------------------------------ left bar
function renderLeft() {
  const closed = new Set([...root.querySelectorAll('#scLeft details:not([open])')].map(d => d.querySelector('summary').textContent)), human = targetHuman();
  const items = p.objects.map(o => `<div class="sc-item ${selected === o.id && !selClip ? 'selected' : ''}" data-item="${esc(o.id)}"><span class="type c-${o.type}">${OBJECT_ICON[o.type]}</span><span class="name">${esc(o.name)}</span><span class="when">${o.start.toFixed(1)}s</span></div>`).join('')
    + [...p.cameraClips].sort((a, b) => a.start - b.start).map(c => `<div class="sc-item ${selClip === c.id ? 'selected' : ''}" data-cam-item="${esc(c.id)}"><span class="type c-shot">◉</span><span class="name">${esc(CAMERA_MODES[c.mode])} shot</span><span class="when">${c.start.toFixed(1)}s</span></div>`).join('');
  const hasSel = !!(selClip || selected);
  $('#scLeft').innerHTML =
    group('ADD OBJECT', grid('data-add-sc', [['human', '♙', 'Character'], ['car', '▰', 'Car'], ['bus', '▤', 'Bus'], ['tree', '♧', 'Tree'], ['building', '▥', 'Building']]))
    + group('GESTURES', `<p class="mini-label sc-note">${human ? `Adds a clip at the playhead (${time.toFixed(1)}s) for <b>${esc(human.name)}</b>.` : 'Select a human to add gestures.'}</p>` + grid('data-add-g', Object.entries(GESTURES).map(([id, name]) => [id, GESTURE_ICON[id], name, `${name} · ${GESTURE_DURATION[id]}s`]), !human))
    + group('CAMERA SHOTS', `<p class="mini-label sc-note">Adds a shot at the playhead. Outside shots the default camera is used (Scene settings).</p>` + grid('data-add-cam', Object.entries(CAMERA_PRESETS).map(([id, c]) => [id, c.icon, c.label])))
    + group('ITEMS', `<p class="mini-label sc-note">${p.objects.length + p.cameraClips.length} items</p>${items || '<p class="muted sc-empty">Nothing yet. Add an object above.</p>'}<div class="sc-actions"><button data-action="duplicate" ${hasSel ? '' : 'disabled'}>Duplicate</button><button data-action="delete" ${hasSel ? '' : 'disabled'}>Delete</button></div>`);
  for (const d of root.querySelectorAll('#scLeft details')) if (closed.has(d.querySelector('summary').textContent)) d.open = false;
}

// ------------------------------------------------------------------ right bar (inspector)
function renderInspector() {
  const box = $('#scInspector'), closed = new Set([...box.querySelectorAll('details:not([open])')].map(d => d.dataset.name)), found = findClip(selClip), o = currentObject();
  const actions = (extra = '') => section('ACTIONS', `${extra}<button data-action="duplicate">Duplicate</button><button data-action="delete">Delete</button>`);
  let title = '', body = '';
  if (found?.kind === 'gesture') {
    const c = found.clip, moves = ['walk', 'run'].includes(c.gesture);
    title = `Gesture <em>${esc(GESTURES[c.gesture])} · ${esc(found.owner.name)}</em>`;
    body = section('GESTURE', select('clip.gesture', 'Gesture', c.gesture, Object.entries(GESTURES)) + field('clip.speed', 'Speed (×)', c.speed ?? 1)
      + `<p class="mini-label">${moves ? `Moves about ${((c.gesture === 'run' ? 3.8 : 1.4) * (c.speed ?? 1)).toFixed(1)} m/s toward the human’s end point and stops when it arrives.` : 'The human stays in place during this clip.'}</p>`)
      + section('TIMING', `<div class="two">${field('clip.start', 'Start (s)', c.start)}${field('clip.dur', 'Duration (s)', c.dur)}</div><p class="mini-label">Outside gesture clips the human stands idle. Overlapping clips: the later one wins.</p>`)
      + actions(`<button data-action="select-owner">Select ${esc(found.owner.name)}</button>`);
  } else if (found?.kind === 'camera') {
    const c = found.clip;
    title = `Camera shot <em>${esc(CAMERA_MODES[c.mode])}</em>`;
    body = section('SHOT', select('cam.mode', 'Point of view', c.mode, Object.entries(CAMERA_MODES)) + select('cam.move', 'Movement', c.move, Object.entries(CAMERA_MOVES)) + select('cam.target', 'Subject', c.target || '', subjectOptions()))
      + section('LENS & POSITION', field('cam.yaw', 'Orbit angle (degrees)', c.yaw) + field('cam.height', 'Height (m)', c.height) + field('cam.distance', 'Distance (m)', c.distance) + field('cam.fov', 'Field of view', c.fov)
        + `<p class="mini-label">First person ignores angle, height and distance. Second person looks back at the subject from in front.</p>`)
      + section('TIMING', `<div class="two">${field('cam.start', 'Start (s)', c.start)}${field('cam.dur', 'Duration (s)', c.dur)}</div>${field('cam.blend', 'Blend in (s)', c.blend ?? .5)}`) + actions();
  } else if (o) {
    title = `${esc(o.type[0].toUpperCase() + o.type.slice(1))} <em>${esc(o.name)}</em>`;
    const mobile = ['human', 'car', 'bus'].includes(o.type), human = o.type === 'human';
    const lk = human ? humanLook(o) : null, shows = ['color', 'texture'].includes(o.material) || (o.material === 'inherit' && p.material === 'texture');
    const character = !human ? '' : section('CHARACTER', select('look.body', 'Character', lk.body, Object.entries(BODIES).map(([id, b]) => [id, b.label]))
      + select('look.outfit', 'Clothes', lk.outfit, Object.entries(OUTFITS).map(([id, f]) => [id, f.label]))
      + select('look.hair', 'Hair style', lk.hair, Object.entries(HAIR_STYLES))
      + `<span class="mini-label">Hair color</span>` + swatches('data-look-hair', HAIR_COLORS, lk.hairColor)
      + `<span class="mini-label">Skin tone</span>` + swatches('data-look-skin', SKIN_TONES, lk.skin)
      + (lk.body === 'man' ? select('look.facial', 'Facial hair', lk.facial, Object.entries(FACIAL)) : '')
      + (lk.outfit === 'dress' ? '' : field('look.bottomColor', 'Trousers / shorts color', lk.bottomColor, 'color'))
      + (shows ? '' : '<p class="mini-label">Colors, skin and hair show once Surface (below) is Solid color or Textured.</p>'));
    body = section('GENERAL', field('object.name', 'Name', o.name, 'text')) + character
      + section('APPEARANCE', select('object.material', 'Surface', o.material, [['inherit', 'Use scene surface'], ['white', 'White model'], ['color', 'Solid color'], ['texture', 'Textured / colored']]) + field('object.color', human ? (humanLook(o).outfit === 'dress' ? 'Dress color' : 'Top / jacket color') : 'Object color', o.color, 'color') + field('object.scale', 'Scale', o.scale))
      + section(mobile ? 'POSITION & PATH' : 'POSITION', `<div class="two">${field('object.x', 'Start X (m)', o.x)}${field('object.z', 'Start Z (m)', o.z)}${mobile ? field('object.endX', human ? 'Toward X (m)' : 'End X (m)', o.endX) + field('object.endZ', human ? 'Toward Z (m)' : 'End Z (m)', o.endZ) : ''}</div>`
        + `<p class="mini-label">X moves across the road, Z along it.${human ? ' A human only moves during Walk and Run clips, heading toward this point.' : ''}</p>`)
      + section('TIMING', `<div class="two">${field('object.start', 'Appears at (s)', o.start)}${field('object.duration', mobile && !human ? 'Travel time (s)' : 'Visible for (s)', o.duration)}</div>${mobile && !human ? select('object.easing', 'Path movement', o.easing, [['linear', 'Constant speed'], ['smooth', 'Ease in and out']]) : ''}`)
      + section('ACTIONS', `<button data-action="visibility">${o.visible ? 'Hide' : 'Show'}</button>`);
  }
  box.classList.add('ff-inspector-accordion');
  box.innerHTML = body ? `<h3 class="inspector-title">${title}</h3>` + body.replace(/%OPEN%/g, '').replace(/<details class="ff-inspector-section" data-name="([^"]*)"/g, (m, n) => `<details class="ff-inspector-section" data-name="${n}" ${closed.has(n) ? '' : 'open'}`)
    : '<p class="muted m-empty">Select an object, gesture or camera shot to edit it.</p>';
}

// ------------------------------------------------------------------ scene settings dialog
function renderSettings() {
  const c = p.camera;
  $('#scSettings').innerHTML = group('COMPOSITION', field('duration', 'Duration (seconds)', p.duration) + select('fps', 'Frames per second', p.fps, [['24', '24'], ['30', '30'], ['60', '60']]) + '<button data-action="demo">Load city demo</button>')
    + group('ENVIRONMENT', select('left', 'Left roadside', p.left, ['city', 'park', 'trees', 'playground', 'none']) + select('right', 'Right roadside', p.right, ['city', 'park', 'trees', 'playground', 'none']) + field('roadWidth', 'Road width (m)', p.roadWidth)
      + select('material', 'Scene surface', p.material, [['white', 'White model'], ['texture', 'Textured / colored']]) + field('sky', 'Sky', p.sky, 'color'))
    + group('DEFAULT CAMERA', `<p class="mini-label">Used wherever no camera shot is on the timeline.</p>` + select('camera.mode', 'Point of view', c.mode, Object.entries(CAMERA_MODES)) + select('camera.move', 'Movement', c.move, Object.entries(CAMERA_MOVES)) + select('camera.target', 'Subject', c.target || '', subjectOptions())
      + field('camera.yaw', 'Orbit angle (degrees)', c.yaw) + field('camera.height', 'Height (m)', c.height) + field('camera.distance', 'Distance (m)', c.distance) + field('camera.fov', 'Field of view', c.fov));
}

// ------------------------------------------------------------------ timeline
function renderTimeline() {
  const scroll = $('#scTimelineScroll'), laneWidth = Math.max(300, (scroll.clientWidth - 215) * timelineZoom), pct = v => v / p.duration * 100;
  $('#scTracks').style.width = (215 + laneWidth) + 'px';
  const clipEl = (c, cls, label, attr, tip, isSel = selClip === c.id) => `<div class="sc-clip ${cls} ${isSel ? 'selected' : ''}" ${attr}="${esc(c.id)}" style="left:${pct(c.start)}%;width:${Math.max(.4, pct(Math.min(c.dur ?? c.duration, p.duration - c.start)))}%" title="${esc(tip)}"><i class="sc-h l" data-h="l"></i><span>${esc(label)}</span><i class="sc-h r" data-h="r"></i></div>`;
  const ticks = Array.from({ length: Math.ceil(10 * timelineZoom) + 1 }, (_, i) => `<span style="left:${i / (10 * timelineZoom) * 100}%">${(i * p.duration / (10 * timelineZoom)).toFixed(1)}</span>`).join('');
  const camSel = findClip(selClip)?.kind === 'camera';
  const camRow = `<div class="sc-track ${camSel ? 'selected' : ''}"><span class="sc-track-name"><i>◉</i>Camera</span><div class="sc-lane" data-lane="camera">${p.cameraClips.map(c => clipEl(c, 'cam', `${CAMERA_MODES[c.mode]} · ${CAMERA_MOVES[c.move].split(' ')[0]}`, 'data-clip', `${CAMERA_MODES[c.mode]} · ${c.start.toFixed(2)}–${(c.start + c.dur).toFixed(2)}s`)).join('')}<b></b></div></div>`;
  const rows = p.objects.map(o => {
    const human = o.type === 'human', mobile = ['car', 'bus'].includes(o.type);
    const content = human ? `<u class="sc-life" style="left:${pct(o.start)}%;width:${pct(Math.max(0, Math.min(o.duration, p.duration - o.start)))}%"></u>` + (o.clips || []).map(c => clipEl(c, 'g-' + c.gesture, GESTURES[c.gesture], 'data-clip', `${GESTURES[c.gesture]} · ${c.start.toFixed(2)}–${(c.start + c.dur).toFixed(2)}s`)).join('')
      : clipEl({ ...o, id: o.id }, 'travel', mobile ? 'Travel' : 'Visible', 'data-travel', `${mobile ? 'Travel' : 'Visible'} · ${o.start.toFixed(2)}–${(o.start + o.duration).toFixed(2)}s`, selected === o.id && !selClip);
    return `<div class="sc-track ${selected === o.id && !selClip ? 'selected' : ''}" data-row="${esc(o.id)}"><span class="sc-track-name" data-object="${esc(o.id)}"><i>${OBJECT_ICON[o.type]}</i>${esc(o.name)}</span><div class="sc-lane">${content}<b></b></div></div>`;
  }).join('');
  $('#scTracks').innerHTML = `<div class="sc-ruler-row"><div class="sc-ruler-label">ITEM <span>SECONDS →</span></div><div class="sc-ruler">${ticks}<b class="sc-ruler-head"></b></div></div>` + camRow + rows;
}
function sync() {
  ensureSelection(); $('#scName').value = p.name; $('#scSeek').max = p.duration - 1 / p.fps; $('#scScrub').max = p.duration - 1 / p.fps;
  renderLeft(); renderInspector(); renderSettings(); renderTimeline(); saveLocal(); draw();
}
const refreshSide = () => { renderLeft(); renderInspector(); renderTimeline(); };

// ------------------------------------------------------------------ edits from inspector / settings
function targetFor(key) {
  const [rootKey, prop] = key.split('.');
  if (rootKey === 'object') return [currentObject(), prop];
  if (rootKey === 'clip' || rootKey === 'cam') return [findClip(selClip)?.clip, prop];
  if (rootKey === 'camera') return [p.camera, prop];
  if (rootKey === 'look') { const o = currentObject(); if (o?.type === 'human') o.look = humanLook(o); return [o?.look, prop]; }
  return [p, key];
}
root.addEventListener('change', e => {
  if (busy) return; const key = e.target.dataset.field; if (!key) return; pause();
  const previous = JSON.stringify(p), [obj, prop] = targetFor(key); if (!obj) return;
  obj[prop] = (e.target.type === 'number' || key === 'fps') ? Number(e.target.value) : (prop === 'target' && e.target.value === '' ? null : e.target.value);
  if (key === 'look.outfit') obj.bottomColor = OUTFITS[obj.outfit].bottom;
  if (key === 'look.body') { obj.hair = defaultLook(obj.body).hair; if (obj.body !== 'man') obj.facial = 'none'; }
  if (key === 'object.x' || key === 'object.z') { if (['tree', 'building'].includes(obj.type)) { obj.endX = obj.x; obj.endZ = obj.z; } }
  if (key === 'duration') { const cap = Math.max(0, p.duration - .1); p.objects.forEach(o => { o.start = Math.min(o.start, cap); (o.clips || []).forEach(c => { c.start = Math.min(c.start, cap); }); }); p.cameraClips.forEach(c => { c.start = Math.min(c.start, cap); }); }
  try { validateScene(p); undo.push(previous); redo = []; time = clamp(time, 0, p.duration - 1 / p.fps); } catch (err) { p = JSON.parse(previous); alert(err.message); }
  sync();
});

// ------------------------------------------------------------------ actions
const insertClip = (list, clip) => { list.push(clip); selClip = clip.id; };
function addGesture(g) {
  const o = targetHuman(); if (!o) return; checkpoint();
  for (const c of o.clips) if (c.start < time && c.start + c.dur > time) c.dur = Math.max(.1, snap(time - c.start));   // cut the clip under the playhead
  let start = time, dur = Math.min(GESTURE_DURATION[g], p.duration - start); if (dur < .1) { dur = Math.min(GESTURE_DURATION[g], p.duration); start = p.duration - dur; }
  insertClip(o.clips, makeClip(g, snap(start), snap(dur) || dur)); sync();
}
function addCameraShot(id) {
  checkpoint(); const o = currentObject(), target = o && ['human', 'car', 'bus'].includes(o.type) ? o.id : null;
  let start = time, dur = Math.min(3, p.duration - start); if (dur < .1) { dur = Math.min(3, p.duration); start = p.duration - dur; }
  insertClip(p.cameraClips, makeCameraClip(id, snap(start), snap(dur) || dur, target)); selected = null; sync();
}
function addObject(spec) {
  if (p.objects.length >= 80) { alert('This scene supports up to 80 objects.'); return; }
  const [type, body] = spec.split(':'); checkpoint(); const o = makeObject(type, p.objects.length); o.duration = p.duration;
  if (type === 'human') { o.look = defaultLook(body || 'man'); o.name = BODIES[o.look.body].label; if (o.look.body === 'woman' || o.look.body === 'girl') o.color = '#f08fa8'; if (o.look.body === 'boy') o.color = '#4cc9f0'; }
  if (['tree', 'building'].includes(type)) { o.x = 10; o.endX = 10; o.endZ = o.z; }
  p.objects.push(o); selected = o.id; selClip = null; sync();
}
const download = (blob, name) => { const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); };
const actions = {
  play, start: () => seek(0), end: () => seek(p.duration), prev: () => seek(time - 1 / p.fps), next: () => seek(time + 1 / p.fps),
  loop: () => { loop = !loop; root.querySelector('[data-action="loop"]').classList.toggle('active', loop); },
  undo: () => { if (!undo.length) return; pause(); redo.push(JSON.stringify(p)); p = JSON.parse(undo.pop()); time = Math.min(time, p.duration - 1 / p.fps); sync(); },
  redo: () => { if (!redo.length) return; pause(); undo.push(JSON.stringify(p)); p = JSON.parse(redo.pop()); sync(); },
  new: () => { if (!confirm('Start an empty scene? Your current scene can be restored with Undo.')) return; checkpoint(); pause(); p = defaultScene(); p.objects = []; p.cameraClips = []; time = 0; selected = null; selClip = null; sync(); },
  demo: () => { checkpoint(); pause(); p = defaultScene(); time = 0; selected = p.objects[0].id; selClip = null; sync(); },
  save: () => download(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), 'scene.frameflow.json'),
  open: () => $('#scFile').click(), png: () => canvas.toBlob(b => b && download(b, 'scene.png')),
  fullscreen: () => document.fullscreenElement ? document.exitFullscreen() : root.requestFullscreen(),
  'select-owner': () => { const f = findClip(selClip); if (f?.owner) { selected = f.owner.id; selClip = null; sync(); } },
  delete: () => {
    const f = findClip(selClip); if (!f && !currentObject()) return; checkpoint();
    if (f?.kind === 'gesture') f.owner.clips = f.owner.clips.filter(c => c.id !== selClip);
    else if (f?.kind === 'camera') p.cameraClips = p.cameraClips.filter(c => c.id !== selClip);
    else { const id = selected; p.objects = p.objects.filter(o => o.id !== id); p.cameraClips.forEach(c => { if (c.target === id) c.target = null; }); if (p.camera.target === id) p.camera.target = null; selected = null; }
    selClip = null; sync();
  },
  duplicate: () => {
    const f = findClip(selClip);
    if (f) { checkpoint(); const list = f.kind === 'gesture' ? f.owner.clips : p.cameraClips, c = { ...f.clip, id: uid(), start: clamp(snap(f.clip.start + f.clip.dur), 0, p.duration - .1) }; list.push(c); selClip = c.id; sync(); return; }
    const o = currentObject(); if (!o || p.objects.length >= 80) return; checkpoint();
    const n = { ...o, id: uid(), name: o.name + ' copy', x: clamp(o.x + 2, -100, 150), endX: clamp(o.endX + 2, -100, 150), clips: (o.clips || []).map(c => ({ ...c, id: uid() })), ...(o.look ? { look: { ...o.look } } : {}) }; p.objects.push(n); selected = n.id; sync();
  },
  visibility: () => { const o = currentObject(); if (o) { checkpoint(); o.visible = !o.visible; sync(); } },
  export: async () => {
    pause(); busy = true; const prior = time, btn = toolbar.querySelector('[data-action="export"]'); root.classList.add('sc-busy'); toolbar.classList.add('sc-busy');
    try { download(await exportMapVideo({ canvas, fps: p.fps, frames: Math.round(p.duration * p.fps), draw: f => renderScene(canvas, p, f / p.fps), progress: n => { btn.textContent = `Export ${Math.round(n / (p.duration * p.fps) * 100)}%`; } }), 'scene.webm'); }
    catch (err) { alert(err.message); } finally { busy = false; time = prior; root.classList.remove('sc-busy'); toolbar.classList.remove('sc-busy'); btn.textContent = 'Export video ↗'; draw(); }
  }
};
function handleSceneClick(e) {
  if (busy) return; const b = e.target.closest('button,[data-object],[data-item],[data-cam-item]'); if (!b || b.disabled) return;
  if (b.dataset.action) { actions[b.dataset.action]?.(); return; }
  if (b.dataset.addSc) return addObject(b.dataset.addSc);
  if (b.dataset.lookHair || b.dataset.lookSkin) { const o = currentObject(); if (o?.type !== 'human') return; checkpoint(); o.look = humanLook(o); if (b.dataset.lookHair) o.look.hairColor = b.dataset.lookHair; else o.look.skin = b.dataset.lookSkin; sync(); return; }
  if (b.dataset.addG) return addGesture(b.dataset.addG);
  if (b.dataset.addCam) return addCameraShot(b.dataset.addCam);
  const objectId = b.dataset.item || b.dataset.object;
  if (objectId) { selected = objectId; selClip = null; refreshSide(); }
  if (b.dataset.camItem) { selClip = b.dataset.camItem; selected = null; refreshSide(); seek(findClip(selClip).clip.start); }
}
root.addEventListener('click', handleSceneClick); toolbar.addEventListener('click', handleSceneClick);

// ------------------------------------------------------------------ settings dialog (like Map Studio's drawer)
{
  const open = $('#scSettingsButton'), panel = $('#scSettingsPanel'), close = $('#scSettingsClose');
  const setOpen = on => { if (on && !panel.open) panel.showModal(); else if (!on && panel.open) panel.close(); open.setAttribute('aria-expanded', String(panel.open)); };
  open.addEventListener('click', () => setOpen(!panel.open)); close.addEventListener('click', () => setOpen(false)); panel.addEventListener('close', () => open.setAttribute('aria-expanded', 'false'));
  panel.addEventListener('click', e => { const r = panel.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) setOpen(false); });
}

// ------------------------------------------------------------------ timeline pointer handling: seek, drag/resize clips
const tracks = $('#scTracks');
tracks.addEventListener('pointerdown', e => {
  if (busy) return;
  const el = e.target.closest('[data-clip],[data-travel]');
  if (el) {
    e.preventDefault(); pause(); let ref;
    if (el.dataset.clip) { const f = findClip(el.dataset.clip); if (!f) return; ref = f.clip; selClip = ref.id; selected = f.owner ? f.owner.id : null; }
    else { ref = p.objects.find(o => o.id === el.dataset.travel); if (!ref) return; selected = ref.id; selClip = null; }
    checkpoint(); const dk = 'dur' in ref ? 'dur' : 'duration';
    drag = { kind: 'clip', ref, dk, mode: e.target.dataset.h || 'move', x0: e.clientX, s0: ref.start, d0: ref[dk], w: el.closest('.sc-lane').getBoundingClientRect().width, moved: false };
    refreshSide(); return;
  }
  const ruler = e.target.closest('.sc-ruler'), lane = e.target.closest('.sc-lane');
  if (ruler || lane) {
    const row = e.target.closest('[data-row]'); if (row) { selected = row.dataset.row; selClip = null; refreshSide(); }
    const el2 = ruler || lane; drag = { kind: 'scrub', el: el2 }; scrubTo(e);
  }
});
function scrubTo(e) { const r = drag.el.getBoundingClientRect(); seek((e.clientX - r.left) / r.width * p.duration); }
window.addEventListener('pointermove', e => {
  if (!drag) return; if (drag.kind === 'scrub') { scrubTo(e); return; }
  if (drag.kind !== 'clip') return; const { ref, dk } = drag, dt = (e.clientX - drag.x0) / drag.w * p.duration; drag.moved = true;
  if (drag.mode === 'move') ref.start = clamp(snap(drag.s0 + dt), 0, p.duration - ref[dk]);
  else if (drag.mode === 'l') { const s = clamp(snap(drag.s0 + dt), 0, drag.s0 + drag.d0 - .1); ref.start = s; ref[dk] = drag.d0 + drag.s0 - s; }
  else ref[dk] = clamp(snap(drag.d0 + dt), .1, p.duration - drag.s0);
  renderTimeline(); draw();
  for (const [k, v] of [['clip.start', ref.start], ['clip.dur', ref[dk]], ['cam.start', ref.start], ['cam.dur', ref[dk]], ['object.start', ref.start], ['object.duration', ref[dk]]]) { const input = $(`#scInspector [data-field="${k}"]`); if (input) input.value = +v.toFixed(3); }
});
window.addEventListener('pointerup', () => { if (!drag) return; const d = drag; drag = null; if (d.kind === 'clip') { if (!d.moved) undo.pop(); sync(); } });

// ------------------------------------------------------------------ transport, canvas, shortcuts
$('#scSeek').onchange = e => { if (!busy) seek(Number(e.target.value) || 0); };
$('#scScrub').oninput = e => { if (!busy) seek(+e.target.value); };
$('#scName').onchange = e => { checkpoint(); p.name = e.target.value; saveLocal(); };
$('#scTimelineZoom').oninput = e => { timelineZoom = Number(e.target.value); renderTimeline(); };
$('#scFile').onchange = async e => {
  try { const f = e.target.files[0]; if (!f) return; if (f.size > 2e6) throw Error('Project is too large'); const q = validateScene(JSON.parse(await f.text())); checkpoint(); pause(); p = q; time = 0; selected = p.objects[0]?.id ?? null; selClip = null; sync(); }
  catch (err) { alert(err.message); } e.target.value = '';
};
// Canvas drag/scroll edits whichever camera is active at the playhead (a shot, or the default camera).
const activeCamSpec = () => { const c = resolveClips(p.cameraClips).find(c => time >= c.start && time < c.end); return c ? p.cameraClips.find(x => x.id === c.id) : p.camera; };
let orbit = null;
canvas.onpointerdown = e => { if (busy) return; pause(); checkpoint(); const spec = activeCamSpec(); orbit = { spec, x: e.clientX, y: e.clientY, yaw: spec.yaw, height: spec.height }; canvas.setPointerCapture(e.pointerId); };
canvas.onpointermove = e => { if (!orbit) return; const s = orbit.spec; if (['first', 'second'].includes(s.mode)) s.mode = 'third'; s.yaw = clamp(orbit.yaw + (e.clientX - orbit.x) * .3, -360, 360); s.height = clamp(orbit.height + (e.clientY - orbit.y) * .04, 1, 60); draw(); };
canvas.onpointerup = canvas.onpointercancel = () => { if (orbit) { orbit = null; sync(); } };
canvas.onwheel = e => { e.preventDefault(); if (busy) return; checkpoint(); const s = activeCamSpec(); s.distance = clamp(s.distance + e.deltaY * .015, 2, 80); sync(); };
// Capture only Scene shortcuts: legacy Motion handlers otherwise run in unknown modes.
window.addEventListener('keydown', e => {
  if (!document.body.classList.contains('mode-scene')) return; e.stopImmediatePropagation();
  if (busy || ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); play(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seek(time + (e.key === 'ArrowLeft' ? -1 : 1) / p.fps); }
  else if (e.key === 'Delete') actions.delete();
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); actions[e.shiftKey ? 'redo' : 'undo'](); }
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest('.modes [data-mode]'); if (!b) return; document.body.classList.toggle('mode-scene', b.dataset.mode === 'scene');
  if (b.dataset.mode !== 'scene') pause(); else { for (const id of ['play', 'mPlay', 'pPlay']) { const btn = document.getElementById(id); if (btn?.textContent.trim() === 'Ⅱ') btn.click(); } sync(); }
}, true);
window.addEventListener('hashchange', () => { if (location.hash !== '#scene') { document.body.classList.remove('mode-scene'); pause(); } });
window.addEventListener('resize', () => { if (document.body.classList.contains('mode-scene')) renderTimeline(); });
sync();
