import { bindTimelineRename } from './timeline-rename.mjs?v=timeline-rename-2';
import { confirmStudio, alertStudio, sceneExportDialog, CANVAS_SIZES, settingsSection } from './studio-ui.mjs?v=preview-controls-1';
// FrameFlow Scene Studio UI. Layout follows Map Studio: add-grids + item list on the left, inspector on the right,
// clip timeline below. Gestures and camera shots are clips you place on the timeline.
import { defaultScene, sceneFrameCount, makeObject, makeClip, makeCameraClip, renderScene, cityScene, ITEM_TYPES, isMobile, itemSize, routePoints, actorYaw, trafficState, actorPosition, cameraAt, validateScene, resolveClips, clamp, GESTURES, GESTURE_DURATION, CAMERA_MODES, CAMERA_MOVES, CAMERA_PRESETS, BODIES, OUTFITS, HAIR_STYLES, FACIAL, FINISHES, SKIN_TONES, HAIR_COLORS, defaultLook, humanLook } from './scene-engine.mjs?v=6';
import { exportMapVideo } from './map-video-export.mjs';
const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORE = 'frameflow-scene-v2', OLD_STORE = 'frameflow-scene-v1';
const OBJECT_ICON = {human:'♙',car:'▰',bus:'▤',tree:'♧',building:'▥',road:'║',junction:'╬',crossing:'▥',park:'▧',traffic:'⋮',lamp:'⌑',bench:'⊓'};
const GESTURE_ICON = { idle: '◌', walk: '⇢', run: '⇒', wave: '≈', point: '☞', jump: '⤒', sit: '⌴', clap: '✦', bow: '⌄' };
let viewMode = '2d', placement = null, planTool = 'select';
const planView = {x:0,z:20,zoom:12};
let planDrag = null;
let p = cityScene(), time = 0, selected = null, selClip = null, playing = false, raf = 0, busy = false, undo = [], redo = [], loop = true, timelineZoom = 1, drag = null;
try { const saved = localStorage.getItem(STORE) || localStorage.getItem(OLD_STORE); if (saved) p = validateScene(JSON.parse(saved)); } catch { /* keep demo */ }
selected = p.objects[0]?.id ?? null;

const root = document.createElement('section'); root.id = 'sceneStudio';
root.innerHTML = `<div class="sc-toolbar" id="scToolbar"><input id="scName" aria-label="Scene name"><span id="scStatus" class="muted">Saved locally</span><button data-action="undo" title="Undo">↶</button><button data-action="redo" title="Redo">↷</button><button data-action="new">New</button><button data-action="open">Open</button><button id="scSettingsButton" aria-expanded="false">⚙ Scene settings</button><button data-action="save">Save project</button><button data-action="export" class="primary">Export video ↗</button></div>
<div class="sc-workspace"><aside class="left ff-left-accordion" id="scLeft"></aside>
<main><div class="stagebar"><span><i class="dot"></i> Scene layout</span><div class="sc-view-tabs"><button data-action="view2d" class="active">2D layout</button><button data-action="view3d">3D preview</button><button data-action="fit">Fit layout</button></div><div><button data-action="png">PNG ↓</button><button data-action="fullscreen">⛶ Fullscreen</button></div></div>
<div class="sc-stage"><canvas id="scCanvas" width="1280" height="720"></canvas><span class="sc-hint">Drag to orbit the active camera shot · Scroll to zoom · Add gestures and camera shots from the left, then edit them on the timeline</span></div>
<div class="transport"><span class="time" id="scTime"></span><div class="play-controls"><button data-action="start">|◀</button><button data-action="prev">‹</button><button data-action="play" class="play">▶</button><button data-action="next">›</button><button data-action="end">▶|</button><button data-action="loop" class="active">↻</button></div><label>SECONDS <input id="scSeek" type="number" step="0.033" min="0"></label></div></main>
<aside class="right"><div class="tabs"><b>Properties</b><span>SCENE STUDIO</span></div><div id="scInspector"></div></aside></div>
<div class="sc-timeline"><div class="timeline-head"><div><b>Timeline</b><span class="pill" id="scFpsLabel">30 FPS</span></div><div class="timeline-tools"><label>Zoom <input id="scTimelineZoom" type="range" min="1" max="5" step=".25" value="1"></label></div></div><input id="scScrub" aria-label="Timeline playhead" type="range" min="0" step="0.033"><div id="scTimelineScroll"><div id="scTracks"></div></div></div>
<footer><span><i class="dot"></i> Ready to animate · 2D layout → 3D preview</span><span>Space Play / pause <em>·</em> ← → Step frames <em>·</em> Drag clips to move, drag their edges to resize <em>·</em> Click ruler to seek</span></footer>
<dialog id="scSettingsPanel"><div class="section-title"><span>SCENE SETTINGS</span><button id="scSettingsClose" aria-label="Close">✕</button></div><div id="scSettings"></div></dialog>
<input hidden id="scFile" type="file" accept=".json,application/json">`;
document.body.append(root);
const toolbar = $('#scToolbar'); document.querySelector('body > header').append(toolbar);
const canvas = $('#scCanvas'), snap = v => Math.round(v * p.fps) / p.fps, lastTime = () => (sceneFrameCount(p) - 1) / p.fps, uid = () => crypto.randomUUID();

// ------------------------------------------------------------------ small builders
const field = (key, label, value, type = 'number', extra = '') => `<label>${label}<input data-field="${key}" type="${type}" value="${esc(value)}" ${extra} ${type === 'number' ? 'step="any"' : ''}></label>`;
const select = (key, label, value, options) => `<label>${label}<select data-field="${key}">${options.map(v => { const [id, name] = Array.isArray(v) ? v : [v, v[0].toUpperCase() + v.slice(1)]; return `<option value="${esc(id)}" ${String(value) === String(id) ? 'selected' : ''}>${esc(name)}</option>`; }).join('')}</select></label>`;
const group = (title, content) => `<details open class="ff-left-section"><summary class="ff-left-summary"><span>${title}</span><span class="ff-left-chevron">⌄</span></summary><div class="ff-left-content">${content}</div></details>`;
const section = (name, content) => `<details class="ff-inspector-section" data-name="${name}" %OPEN%><summary class="ff-inspector-summary"><span>${name}</span><span class="ff-inspector-chevron">⌄</span></summary><div class="ff-inspector-content">${content}</div></details>`;
const grid = (attr, items, disabled = false) => `<div class="add-grid">${items.map(([id, icon, label, tip]) => `<button ${attr}="${id}" title="${esc(tip || label)}" ${disabled ? 'disabled' : ''}><b>${icon}</b><span>${label}</span></button>`).join('')}</div>`;
const subjectOptions = () => [['', 'Auto (first human / car / bus)'], ...p.objects.map(o => [o.id, o.name])];

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
function draw() {
  const dims=CANVAS_SIZES.some(([v])=>v===`${p.width},${p.height}`)?[p.width,p.height]:[1280,720];const [w,h]=dims;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;canvas.style.aspectRatio=`${w}/${h}`;} if(viewMode === '2d') drawPlan(); else { renderScene(canvas, p, time); root.querySelector('.sc-hint').textContent = '3D preview · Right-drag or middle-drag to orbit · Scroll to zoom · Switch to 2D layout to place items and fixed cameras'; } $('#scTime').textContent = `${String(Math.floor(time/60)).padStart(2,'0')}:${(time%60).toFixed(2).padStart(5,'0')}`; $('#scSeek').value = time.toFixed(3); $('#scScrub').value = time; root.style.setProperty('--sc-progress', time / p.duration * 100 + '%'); }
function pause() { playing = false; cancelAnimationFrame(raf); root.querySelector('[data-action="play"]').textContent = '▶'; }
function seek(t) { if (!Number.isFinite(t)) return; pause(); time = clamp(snap(t), 0, lastTime()); draw(); }
function play() {
  if (busy) return; if (playing) return pause();
  if (time >= lastTime()) time = 0; playing = true; const origin = performance.now(), from = time; root.querySelector('[data-action="play"]').textContent = 'Ⅱ';
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
    group('PLACE ITEMS', '<p class="mini-label sc-note">Choose an item, then click the 2D plane to place it. Drag items to move them. Use the orange handle to rotate. Add route points for turns.</p>' + grid('data-add-sc', Object.entries(ITEM_TYPES).map(([id,name])=>[id,OBJECT_ICON[id],name])))
    + group('LAYOUT', '<div class="sc-actions"><button data-action="manual-layout">Use placed items only</button><button data-action="city-demo">Intersection demo</button></div><p class="mini-label">Placed items only hides the generated road and roadside scenery.</p>')
    + group('CAMERA', '<p class="mini-label sc-note">Edits the camera shot at the playhead, or the default camera.</p>' + select('planCam.target', 'Main object to follow', activeCamSpec().target || '', subjectOptions()) + select('planCam.move', 'Camera movement', activeCamSpec().move, Object.entries(CAMERA_MOVES)) + '<div class="sc-actions"><button data-action="camera-place">Place fixed camera</button><button data-action="camera-aim">Set look-at point</button></div>')
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
    body = section('APPEARANCE', select('object.material', 'Surface', o.material, [['inherit', 'Use scene surface'], ['white', 'White model'], ['color', 'Solid color'], ['texture', 'Textured / colored']]) + select('object.finish', 'Finish', o.finish ?? 'inherit', [['inherit', 'Use scene finish'], ...Object.entries(FINISHES)]) + field('object.finishScale', 'Texture scale (×)', o.finishScale ?? 1, 'number', 'min="0.1" max="8"') + field('object.color', human ? (humanLook(o).outfit === 'dress' ? 'Dress color' : 'Top / jacket color') : 'Object color', o.color, 'color') + field('object.scale', 'Scale', o.scale))
      + section('ROTATION', field('object.rotation',mobile?'Facing offset (degrees)':'Rotation (degrees)',o.rotation??0) + (mobile?select('object.orientation','Orientation',o.orientation??'path',[['path','Turn with route'],['fixed','Keep fixed facing']]):'') + '<div class="sc-actions"><button data-action="rotate-left">↶ 90°</button><button data-action="rotate-right">↷ 90°</button></div>')
      + (['road','junction','crossing','building','park'].includes(o.type)?section('DIMENSIONS',field('object.width','Width (m)',itemSize(o)[0])+field('object.length','Length / depth (m)',itemSize(o)[1])+(o.type==='building'?field('object.height','Height (m)',o.height??8):'')):'')
      + (o.type==='traffic'?section('TRAFFIC LIGHT',select('object.signal','Signal',o.signal??'cycle',[['cycle','Automatic cycle'],['red','Red'],['amber','Amber'],['green','Green']])+field('object.redTime','Red seconds',o.redTime??6)+field('object.greenTime','Green seconds',o.greenTime??5)+field('object.amberTime','Amber seconds',o.amberTime??2)+field('object.phase','Cycle offset (s)',o.phase??0)+'<p class="mini-label">Visual signals. Vehicles follow their routes independently.</p>'):'')
      + (mobile?section('ROUTE', '<div class="sc-actions"><button data-action="route-add">Add turn points</button><button data-action="route-clear">Straight route</button></div><button data-action="route-pop">Remove last point</button>'+field('object.turnRadius','Corner rounding (m)',o.turnRadius??3)+'<p class="mini-label">'+(o.waypoints||[]).length+' turn points. Click the plane to add points before B. Drag numbered points to edit; right-click one to remove. Escape finishes. Shift-drag A to move the whole route.</p>'):'')
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
  const folded = new Set([...$('#scSettings').querySelectorAll('details:not([open])')].map(el => el.querySelector('summary').textContent));
  const extra = (title, content) => settingsSection(title, content, {collapsible:true, open:!folded.has(title)});
  $('#scSettings').innerHTML = settingsSection('Composition', select('canvasSize', 'Canvas', `${p.width||1280},${p.height||720}`, CANVAS_SIZES) + '<div class="two">' + select('fps', 'Frame rate', p.fps, [['24','24'],['30','30'],['60','60']]) + field('duration', 'Duration (seconds)', p.duration, 'number', 'min="1"') + '</div>')
    + extra('Environment', select('baseRoad','Generated main road',p.baseRoad!==false,[['true','Show'],['false','Hide — use placed roads']]) + '<div class="two">' + select('left', 'Left roadside', p.left, ['city', 'park', 'trees', 'playground', 'none']) + select('right', 'Right roadside', p.right, ['city', 'park', 'trees', 'playground', 'none']) + '</div>' + field('roadWidth', 'Road width (m)', p.roadWidth))
    + extra('Appearance', select('material', 'Scene surface', p.material, [['white', 'White model'], ['texture', 'Textured / colored']]) + field('sky', 'Sky', p.sky, 'color')
      + select('finish', 'Scene finish', p.finish || 'none', Object.entries(FINISHES)) + '<div class="two">' + field('finishStrength', 'Finish strength (0 – 1)', p.finishStrength ?? .6, 'number', 'min="0" max="1"') + field('finishScale', 'Texture scale (×)', p.finishScale ?? 1, 'number', 'min="0.1" max="8"') + '</div>'
      + '<p class="mini-label">Textures follow each surface’s perspective. Increase the scale for larger patterns. Individual objects can override these settings.</p>')
    + extra('Default camera', `<p class="mini-label">Used wherever no camera shot is on the timeline.</p>` + select('camera.mode', 'Point of view', c.mode, Object.entries(CAMERA_MODES)) + select('camera.move', 'Movement', c.move, Object.entries(CAMERA_MOVES)) + select('camera.target', 'Subject', c.target || '', subjectOptions())
      + '<div class="two">' + field('camera.yaw', 'Orbit angle (degrees)', c.yaw) + field('camera.height', 'Height (m)', c.height) + field('camera.distance', 'Distance (m)', c.distance) + field('camera.fov', 'Field of view', c.fov) + '</div>');
}

// ------------------------------------------------------------------ timeline
bindTimelineRename($('#scTracks'), { attribute: 'data-object', getItem: id => p.objects.find(o => o.id === id), checkpoint, changed: sync, pause });
function renderTimeline() {
  $('#scFpsLabel').textContent=p.fps+' FPS';
  const scroll = $('#scTimelineScroll'), laneWidth = Math.max(300, (scroll.clientWidth - 215) * timelineZoom), pct = v => v / p.duration * 100;
  $('#scTracks').style.width = (215 + laneWidth) + 'px';
  const clipEl = (c, cls, label, attr, tip, isSel = selClip === c.id) => c.start >= p.duration ? '' : `<div class="sc-clip ${cls} ${isSel ? 'selected' : ''}" ${attr}="${esc(c.id)}" style="left:${pct(c.start)}%;width:${Math.max(.4, pct(Math.min(c.dur ?? c.duration, p.duration - c.start)))}%" title="${esc(tip)}"><i class="sc-h l" data-h="l"></i><span>${esc(label)}</span><i class="sc-h r" data-h="r"></i></div>`;
  const ticks = Array.from({ length: Math.ceil(10 * timelineZoom) + 1 }, (_, i) => `<span style="left:${i / (10 * timelineZoom) * 100}%">${(i * p.duration / (10 * timelineZoom)).toFixed(1)}</span>`).join('');
  const camSel = findClip(selClip)?.kind === 'camera';
  const camRow = `<div class="sc-track ${camSel ? 'selected' : ''}"><span class="sc-track-name"><i>◉</i>Camera</span><div class="sc-lane" data-lane="camera">${p.cameraClips.map(c => clipEl(c, 'cam', `${CAMERA_MODES[c.mode]} · ${CAMERA_MOVES[c.move].split(' ')[0]}`, 'data-clip', `${CAMERA_MODES[c.mode]} · ${c.start.toFixed(2)}–${(c.start + c.dur).toFixed(2)}s`)).join('')}<b></b></div></div>`;
  const rows = p.objects.map(o => {
    const human = o.type === 'human', mobile = ['car', 'bus'].includes(o.type);
    const content = human ? `<u class="sc-life" style="left:${pct(o.start)}%;width:${pct(Math.max(0, Math.min(o.duration, p.duration - o.start)))}%"></u>` + (o.clips || []).map(c => clipEl(c, 'g-' + c.gesture, GESTURES[c.gesture], 'data-clip', `${GESTURES[c.gesture]} · ${c.start.toFixed(2)}–${(c.start + c.dur).toFixed(2)}s`)).join('')
      : clipEl({ ...o, id: o.id }, 'travel', mobile ? 'Travel' : 'Visible', 'data-travel', `${mobile ? 'Travel' : 'Visible'} · ${o.start.toFixed(2)}–${(o.start + o.duration).toFixed(2)}s`, selected === o.id && !selClip);
    return `<div class="sc-track ${selected === o.id && !selClip ? 'selected' : ''}" data-row="${esc(o.id)}"><span class="sc-track-name" data-object="${esc(o.id)}"><i>${OBJECT_ICON[o.type]}</i><span class="ff-layer-name" title="Double-click or double-tap to rename">${esc(o.name)}</span></span><div class="sc-lane">${content}<b></b></div></div>`;
  }).join('');
  $('#scTracks').innerHTML = `<div class="sc-ruler-row"><div class="sc-ruler-label">ITEM <span>SECONDS →</span></div><div class="sc-ruler">${ticks}<b class="sc-ruler-head"></b></div></div>` + camRow + rows;
}
function sync() {
  ensureSelection(); $('#scName').value = p.name; $('#scSeek').max = $('#scScrub').max = lastTime(); $('#scSeek').step = $('#scScrub').step = 1 / p.fps;
  renderLeft(); renderInspector(); renderSettings(); renderTimeline(); saveLocal(); draw();
}
const refreshSide = () => { renderLeft(); renderInspector(); renderTimeline(); draw(); };

// ------------------------------------------------------------------ edits from inspector / settings
function targetFor(key) {
  const [rootKey, prop] = key.split('.');
  if (rootKey === 'object') return [currentObject(), prop];
  if (rootKey === 'clip' || rootKey === 'cam') return [findClip(selClip)?.clip, prop];
  if (rootKey === 'planCam') return [activeCamSpec(), prop];
  if (rootKey === 'camera') return [p.camera, prop];
  if (rootKey === 'look') { const o = currentObject(); if (o?.type === 'human') o.look = humanLook(o); return [o?.look, prop]; }
  return [p, key];
}
root.addEventListener('change', e => {
  if (busy) return; const key = e.target.dataset.field; if (!key) return; pause();
  const previous = JSON.stringify(p), [obj, prop] = targetFor(key); if (!obj) return;
  obj[prop] = (e.target.type === 'number' || key === 'fps') ? Number(e.target.value) : (prop === 'target' && e.target.value === '' ? null : e.target.value);
  if(key==='canvasSize'){const [w,h]=e.target.value.split(',').map(Number);p.width=w;p.height=h;delete p.canvasSize;}
  if(key==='baseRoad')obj[prop]=e.target.value==='true';
  if (key === 'planCam.target') { obj.move = 'follow'; if (obj.mode === 'first' && !obj.target) obj.mode = 'third'; }
  if (key === 'look.outfit') obj.bottomColor = OUTFITS[obj.outfit].bottom;
  if (key === 'look.body') { obj.hair = defaultLook(obj.body).hair; if (obj.body !== 'man') obj.facial = 'none'; }
  if (key === 'object.x' || key === 'object.z') { if (!isMobile(obj)) { obj.endX = obj.x; obj.endZ = obj.z; } }
  try { validateScene(p); undo.push(previous); redo = []; time = clamp(snap(time), 0, lastTime()); } catch (err) { p = JSON.parse(previous); alertStudio(err.message); }
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
  if (p.objects.length >= 80) { alertStudio('This scene supports up to 80 objects.'); return; }
  const [type, body] = spec.split(':'); checkpoint(); const o = makeObject(type, p.objects.length); o.duration = p.duration;
  if (type === 'human') { o.look = defaultLook(); o.name = 'Character'; }
  if (!isMobile(o)) { o.x = 10; o.endX = 10; o.endZ = o.z; }
  p.objects.push(o); selected = o.id; selClip = null; sync();
}
const download = (blob, name) => { const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); };
const actions = {
  'manual-layout': () => {checkpoint();p.baseRoad=false;p.left=p.right='none';sync();},
  'city-demo': () => {checkpoint();pause();p=cityScene();time=0;selected=p.objects.find(isMobile)?.id;selClip=null;setView('2d');fitPlan();sync();},
  'rotate-left': () => rotateItem(-90), 'rotate-right': () => rotateItem(90),
  'route-add': () => {if(!isMobile(currentObject()||{}))return;setView('2d');planTool='route';draw();},
  'route-pop': () => {const o=currentObject();if(o?.waypoints?.length){checkpoint();o.waypoints.pop();sync();}},
  'route-clear': () => {const o=currentObject();if(!o)return;checkpoint();o.waypoints=[];sync();},
  view2d: () => setView('2d'), view3d: () => setView('3d'), fit: () => {fitPlan();draw();},
  'camera-place': () => {setView('2d');placement=null;planTool='camera';draw();},
  'camera-aim': () => {setView('2d');placement=null;planTool='aim';draw();},
  play, start: () => seek(0), end: () => seek(p.duration), prev: () => seek(time - 1 / p.fps), next: () => seek(time + 1 / p.fps),
  loop: () => { loop = !loop; root.querySelector('[data-action="loop"]').classList.toggle('active', loop); },
  undo: () => { if (!undo.length) return; pause(); redo.push(JSON.stringify(p)); p = JSON.parse(undo.pop()); time = Math.min(time, lastTime()); sync(); },
  redo: () => { if (!redo.length) return; pause(); undo.push(JSON.stringify(p)); p = JSON.parse(redo.pop()); time = Math.min(time, lastTime()); sync(); },
  new: async () => { if (!await confirmStudio('Start an empty scene? Your current scene can be restored with Undo.')) return; checkpoint(); pause(); p = defaultScene(); p.objects = []; p.cameraClips = []; p.left=p.right='none'; p.baseRoad=false; viewMode='2d'; placement=null; time = 0; selected = null; selClip = null; sync(); },
  demo: () => { checkpoint(); pause(); p = cityScene(); time = 0; selected = p.objects.find(isMobile)?.id; selClip = null; fitPlan(); sync(); },
  save: () => download(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), 'scene.frameflow.json'),
  open: () => $('#scFile').click(), png: () => { const c=document.createElement('canvas');c.width=p.width||1280;c.height=p.height||720;renderScene(c,p,time);const name=(p.name||'scene').replace(/[^a-z0-9 _-]/gi,'').trim()||'scene';c.toBlob(b=>{if(b)download(b,`${name}-frame-${Math.round(time*p.fps)}.png`);},'image/png'); },
  fullscreen: async () => { try { const preview=canvas.closest('main');if(document.fullscreenElement===preview)await document.exitFullscreen();else if(!document.fullscreenElement)await preview.requestFullscreen();else alertStudio('Exit the current fullscreen view first'); } catch(err){alertStudio('Fullscreen unavailable: '+(err?.message||err));} },
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
    const n = { ...o, waypoints:(o.waypoints||[]).map(v=>({x:clamp(v.x+2,-100,150),z:v.z})), id: uid(), name: o.name + ' copy', x: clamp(o.x + 2, -100, 150), endX: clamp(o.endX + 2, -100, 150), clips: (o.clips || []).map(c => ({ ...c, id: uid() })), ...(o.look ? { look: { ...o.look } } : {}) }; p.objects.push(n); selected = n.id; sync();
  },
  visibility: () => { const o = currentObject(); if (o) { checkpoint(); o.visible = !o.visible; sync(); } },
  export: async () => {
    if (busy) return; pause(); busy = true; const prior = time;
    const snapshot=JSON.parse(JSON.stringify(p));
    const c=document.createElement('canvas');c.width=canvas.width;c.height=canvas.height;
    const frames=sceneFrameCount(snapshot);
    const ui=sceneExportDialog({width:c.width,height:c.height,fps:snapshot.fps,frames});
    root.classList.add('sc-busy'); toolbar.classList.add('sc-busy');
    try {
      const video=await exportMapVideo({canvas:c,fps:snapshot.fps,frames,draw:f=>renderScene(c,snapshot,f/snapshot.fps),cancelled:ui.cancelled,progress:ui.progress});
      if(ui.cancelled())ui.finish('Export cancelled.');
      else {download(video,'scene.webm');ui.finish('All frames encoded. Download started.');}
    } catch(err){ui.finish(err.name==='AbortError'?'Export cancelled.':'Export failed: '+err.message);}
    finally {busy=false;time=prior;root.classList.remove('sc-busy');toolbar.classList.remove('sc-busy');draw();}
  }
};
function handleSceneClick(e) {
  if (busy) return; const b = e.target.closest('button,[data-object],[data-item],[data-cam-item]'); if (!b || b.disabled) return;
  if (b.dataset.action) { actions[b.dataset.action]?.(); return; }
  if (b.dataset.addSc) { setView('2d'); placement = b.dataset.addSc; planTool = 'select'; draw(); return; }
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
  if (drag.mode === 'move') ref.start = clamp(snap(drag.s0 + dt), 0, Math.max(0, p.duration - Math.min(ref[dk], .1)));
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
  catch (err) { alertStudio(err.message); } e.target.value = '';
};
// Canvas drag/scroll edits whichever camera is active at the playhead (a shot, or the default camera).
const activeCamSpec = () => { const c = resolveClips(p.cameraClips).find(c => time >= c.start && time < c.end); return c ? p.cameraClips.find(x => x.id === c.id) : p.camera; };
let orbit = null;
canvas.onpointerdown = e => { if (busy) return; if(viewMode === '2d') return planDown(e); if(e.button!==2&&e.button!==1)return; e.preventDefault(); pause(); checkpoint(); const spec = activeCamSpec(); orbit = { spec, x: e.clientX, y: e.clientY, yaw: spec.yaw, height: spec.height }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing'; };
canvas.onpointermove = e => { if(viewMode === '2d') return planMove(e); if (!orbit) return; const s = orbit.spec; if(s.move==='static' && Number.isFinite(s.fixedX)){ s.aimX=clamp((s.aimX??0)+(e.clientX-orbit.x)*.015,-100,150); s.aimZ=clamp((s.aimZ??0)-(e.clientY-orbit.y)*.015,-100,150);orbit.x=e.clientX;orbit.y=e.clientY;draw();return; } if (['first', 'second'].includes(s.mode)) s.mode = 'third'; s.yaw = clamp(orbit.yaw + (e.clientX - orbit.x) * .3, -360, 360); s.height = clamp(orbit.height + (e.clientY - orbit.y) * .04, 1, 60); draw(); };
canvas.onpointerup = canvas.onpointercancel = e => { canvas.style.cursor=''; if(planDrag){ const d=planDrag; planDrag=null; if(d.kind==='pan'&&!d.moved&&e.button===2&&e.type!=='pointercancel') removePlanWaypoint(e); if(d.changed) sync(); else draw(); } if (orbit) { orbit = null; sync(); } };
canvas.onwheel = e => { e.preventDefault(); if (busy) return; if(viewMode==='2d'){ planView.zoom=clamp(planView.zoom*Math.exp(-e.deltaY*.001),2,70); draw(); return; } checkpoint(); const s = activeCamSpec(); if(s.move==='static' && Number.isFinite(s.fixedX)){s.fov=clamp(s.fov+e.deltaY*.02,25,100);sync();return;} s.distance = clamp(s.distance + e.deltaY * .015, 2, 80); sync(); };
// Capture only Scene shortcuts: legacy Motion handlers otherwise run in unknown modes.
window.addEventListener('keydown', e => {
  if (!document.body.classList.contains('mode-scene')) return;
  if (e.target.closest('input,select,textarea,[contenteditable="true"]')) return;
  e.stopImmediatePropagation();
  if (document.querySelector('dialog[open]') || busy) return;
  if (e.key === 'Escape') { placement=null;planTool='select';draw(); }
  else if (e.code === 'Space') { e.preventDefault(); play(); }
  else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); seek(time + (e.key === 'ArrowLeft' ? -1 : 1) / p.fps); }
  else if (e.key === 'Delete') actions.delete();
  else if (e.key.toLowerCase() === 'f' && !e.repeat && !e.ctrlKey && !e.altKey && !e.metaKey) { e.preventDefault(); actions.fullscreen(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); actions[e.shiftKey ? 'redo' : 'undo'](); }
}, true);
document.addEventListener('click', e => {
  const b = e.target.closest('.modes [data-mode]'); if (!b) return; document.body.classList.toggle('mode-scene', b.dataset.mode === 'scene');
  if (b.dataset.mode !== 'scene') pause(); else { for (const id of ['play', 'mPlay', 'pPlay']) { const btn = document.getElementById(id); if (btn?.textContent.trim() === 'Ⅱ') btn.click(); } sync(); }
}, true);
window.addEventListener('hashchange', () => { if (location.hash !== '#scene') { document.body.classList.remove('mode-scene'); pause(); } });
window.addEventListener('resize', () => { if (document.body.classList.contains('mode-scene')) renderTimeline(); });
// ---- Top-down editor: X/Z coordinates shared exactly with the 3D renderer.
function rotateItem(delta){const o=currentObject();if(!o)return;checkpoint();o.rotation=(((o.rotation??0)+delta+540)%360)-180;sync();}
function setView(mode){ pause();viewMode=mode;placement=null;planTool='select';root.querySelector('[data-action="view2d"]').classList.toggle('active',mode==='2d');root.querySelector('[data-action="view3d"]').classList.toggle('active',mode==='3d');draw(); }
function screenPoint(x,z){return [canvas.width/2+(x-planView.x)*planView.zoom,canvas.height/2-(z-planView.z)*planView.zoom];}
function eventPoint(e){const r=canvas.getBoundingClientRect(),sx=(e.clientX-r.left)*canvas.width/r.width,sy=(e.clientY-r.top)*canvas.height/r.height;return {sx,sy,x:clamp(planView.x+(sx-canvas.width/2)/planView.zoom,-100,150),z:clamp(planView.z-(sy-canvas.height/2)/planView.zoom,-100,150)};}
function fitPlan(){
 const pts=p.objects.flatMap(o=>{const [w,d]=itemSize(o),r=Math.hypot(w,d)*o.scale/2;return [[o.x-r,o.z-r],[o.x+r,o.z+r],...(isMobile(o)?routePoints(o):[])];});
 if(!pts.length){planView.x=0;planView.z=20;planView.zoom=12;return;}
 const xs=pts.map(q=>q[0]),zs=pts.map(q=>q[1]),x0=Math.min(...xs)-5,x1=Math.max(...xs)+5,z0=Math.min(...zs)-5,z1=Math.max(...zs)+5;planView.x=(x0+x1)/2;planView.z=(z0+z1)/2;planView.zoom=clamp(Math.min(canvas.width/(x1-x0),canvas.height/(z1-z0)),2,40);
}
function rotationPoint(o){const [w,d]=itemSize(o),r=Math.max(35/planView.zoom,d*o.scale/2+2),yaw=actorYaw(o,0);return [o.x+Math.sin(yaw)*r,o.z+Math.cos(yaw)*r];}
function drawPlan(){
 const g=canvas.getContext('2d'),W=canvas.width,H=canvas.height,Z=planView.zoom;g.fillStyle='#192127';g.fillRect(0,0,W,H);
 const line=(a,b,col,width=1,dash=[])=>{g.strokeStyle=col;g.lineWidth=width;g.setLineDash(dash);g.beginPath();g.moveTo(...a);g.lineTo(...b);g.stroke();g.setLineDash([]);};
 const circle=(x,z,r,col,label)=>{const q=screenPoint(x,z);g.fillStyle=col;g.beginPath();g.arc(...q,r,0,Math.PI*2);g.fill();if(label){g.fillStyle='#102029';g.font='bold 14px sans-serif';g.textAlign='center';g.fillText(label,q[0],q[1]+5);}return q;};
 if(p.baseRoad!==false){const a=screenPoint(-p.roadWidth/2,0),b=screenPoint(p.roadWidth/2,0);g.fillStyle='#343e46';g.fillRect(a[0],0,b[0]-a[0],H);line([W/2-planView.x*Z,0],[W/2-planView.x*Z,H],'#78838b',2,[12,12]);}
 const step=Z<5?10:5;for(let x=-100;x<=150;x+=step)line(screenPoint(x,-100),screenPoint(x,150),'#ffffff0c');for(let z=-100;z<=150;z+=step)line(screenPoint(-100,z),screenPoint(150,z),'#ffffff0c');
 for(const side of [-1,1])for(let i=0;i<16;i++){const style=side<0?p.left:p.right;if(style==='none')continue;const q=screenPoint(side*(p.roadWidth/2+5),i*9-30);g.fillStyle=style==='city'?'#586572':'#395b48';g.fillRect(q[0]-2*Z,q[1]-3*Z,4*Z,6*Z);}
 // Surfaces first, then props. Sorting does not modify the saved item order.
 const rank=o=>['road','junction','park'].includes(o.type)?0:o.type==='crossing'?1:2;
 for(const o of [...p.objects].sort((a,b)=>rank(a)-rank(b))){
  const sel=o.id===selected&&!selClip,col=o.visible?o.color:'#69727a',q=screenPoint(o.x,o.z),sz=itemSize(o),w=sz[0]*Z*o.scale,d=sz[1]*Z*o.scale;
  g.save();g.translate(...q);g.rotate(actorYaw(o,0));g.globalAlpha=o.visible?1:.35;g.fillStyle=col;g.strokeStyle=sel?'#b6f36e':'#a0acb4';g.lineWidth=sel?3:1;
  if(o.type==='crossing'){for(let xx=-w/2;xx<w/2;xx+=Z*o.scale)g.fillRect(xx,-d/2,.5*Z*o.scale,d);}
  else{g.fillRect(-w/2,-d/2,w,d);g.strokeRect(-w/2,-d/2,w,d);}
  if(o.type==='road'){line([0,-d/2],[0,d/2],'#e0dfbc',1,[2*Z,2*Z]);}
  if(o.type==='traffic'){g.fillStyle={red:'#ff4b4b',amber:'#ffca45',green:'#64ef97'}[trafficState(o,time)];g.beginPath();g.arc(0,0,7,0,Math.PI*2);g.fill();}
  // Forward arrow makes rotation visible even on square footprints.
  if(sel||isMobile(o)){g.fillStyle='#ffffff';g.beginPath();g.moveTo(0,-Math.max(7,d/2-3));g.lineTo(-4,-Math.max(7,d/2-3)+8);g.lineTo(4,-Math.max(7,d/2-3)+8);g.closePath();g.fill();}
  g.restore();g.fillStyle='#e4ecf1';g.font='14px sans-serif';g.textAlign='left';if(sel||rank(o)===2)g.fillText(o.name,q[0]+17,q[1]-15);
 }
 // Routes and handles are overlays so they remain selectable above large road pieces.
 for(const o of p.objects.filter(isMobile)){
  const sel=o.id===selected&&!selClip,pts=routePoints(o);for(let i=1;i<pts.length;i++)line(screenPoint(...pts[i-1]),screenPoint(...pts[i]),sel?'#b6f36e':'#68808d',sel?3:1,sel?[]:[6,4]);
  circle(o.endX,o.endZ,sel?12:4,sel?'#b6f36e':'#75828a',sel?'B':'');
  if(sel){circle(o.x,o.z,12,'#6ecbea','A');for(const [i,v] of (o.waypoints||[]).entries())circle(v.x,v.z,11,'#f3cc74',String(i+1));}
  const pos=actorPosition(o,time);circle(pos[0],pos[2],5,'#ffffff');const y=actorYaw(o,time);line(screenPoint(pos[0],pos[2]),screenPoint(pos[0]+Math.sin(y)*1.5,pos[2]+Math.cos(y)*1.5),'#ffffff',2);
 }
 const sel=currentObject();if(sel&&!selClip){const rp=rotationPoint(sel);line(screenPoint(sel.x,sel.z),screenPoint(...rp),'#f5ad66',2);circle(...rp,11,'#f5ad66','↻');}
 const cam=cameraAt(p,time),cp=screenPoint(cam.pos[0],cam.pos[2]),aim=screenPoint(cam.look[0],cam.look[2]);line(cp,aim,'#71cfff',2,[6,4]);circle(cam.pos[0],cam.pos[2],13,'#71cfff','C');circle(cam.look[0],cam.look[2],7,'#71cfff','');
 g.fillStyle='#c7d5df';g.font='15px sans-serif';g.textAlign='left';g.fillText('TOP VIEW  ·  X ↔  Z ↑  ·  grid '+step+' m',22,30);
 root.querySelector('.sc-hint').textContent=placement?'Click to place '+ITEM_TYPES[placement]+' · Escape cancels':planTool==='route'?'Click to add turn points before B · Drag points after pressing Escape · Right-click a point to remove':planTool==='camera'?'Click to place the fixed camera':planTool==='aim'?'Click where the fixed camera should look':'Drag to move · Orange handle rotates (Shift: 15° steps) · Shift-drag A moves its route · Right-drag or middle-drag pans · Scroll zooms';
}
function planDown(e){
 if(e.button!==0&&e.button!==1&&e.button!==2)return;
 pause();const q=eventPoint(e);canvas.setPointerCapture(e.pointerId);
 if(e.button===2||e.button===1){e.preventDefault();planDrag={kind:'pan',sx:q.sx,sy:q.sy,x:planView.x,z:planView.z,moved:false};canvas.style.cursor='grabbing';return;}
 if(placement){const type=placement;placement=null;const n=p.objects.length;addObject(type);if(p.objects.length===n)return;const o=currentObject();o.x=Math.round(q.x*2)/2;o.z=Math.round(q.z*2)/2;o.endX=o.x;o.endZ=isMobile(o)?Math.min(150,o.z+15):o.z;if(type==='human')o.clips=[makeClip('walk',0,p.duration,1)];sync();return;}
 if(planTool==='route'){const o=currentObject();if(!o||!isMobile(o)){planTool='select';draw();return;}if((o.waypoints||[]).length>=60){alertStudio('Maximum 60 route points.');return;}checkpoint();(o.waypoints||=[]).push({x:Math.round(q.x*2)/2,z:Math.round(q.z*2)/2});sync();return;}
 if(planTool==='camera'||planTool==='aim'){checkpoint();const c=activeCamSpec(),cam=cameraAt(p,time);c.move='static';c.mode='third';c.fixedX??=clamp(cam.pos[0],-100,150);c.fixedZ??=clamp(cam.pos[2],-100,150);c.aimX??=clamp(cam.look[0],-100,150);c.aimZ??=clamp(cam.look[2],-100,150);if(planTool==='camera'){c.fixedX=q.x;c.fixedZ=q.z;}else{c.aimX=q.x;c.aimZ=q.z;}planTool='select';sync();return;}
 const hit=(x,z,r=17)=>{const a=screenPoint(x,z);return Math.hypot(a[0]-q.sx,a[1]-q.sy)<r;},sel=currentObject();
 if(sel&&!selClip){const rp=rotationPoint(sel);if(hit(...rp,14)){planDrag={kind:'rotate',o:sel,base:actorYaw(sel,0)-(sel.rotation??0)*Math.PI/180};return;}
 if(isMobile(sel)){const i=(sel.waypoints||[]).findIndex(v=>hit(v.x,v.z,13));if(i>=0){planDrag={kind:'waypoint',o:sel,index:i};return;}if(hit(sel.endX,sel.endZ,14)){planDrag={kind:'end',o:sel};return;}if(hit(sel.x,sel.z,14)){planDrag={kind:'object',o:sel,dx:q.x-sel.x,dz:q.z-sel.z};return;}}}
 const c=activeCamSpec();if(c.move==='static'&&Number.isFinite(c.fixedX)&&hit(c.fixedX,c.fixedZ)){planDrag={kind:'camera',o:c};return;}
 const rank=o=>['road','junction','crossing','park'].includes(o.type)?0:1;
 const candidates=[...p.objects].reverse().sort((a,b)=>rank(b)-rank(a));
 const o=candidates.find(o=>{const y=actorYaw(o,0),dx=q.x-o.x,dz=q.z-o.z,x=dx*Math.cos(y)-dz*Math.sin(y),z=dx*Math.sin(y)+dz*Math.cos(y),[w,d]=itemSize(o);return Math.abs(x)<=Math.max(w*o.scale/2,10/planView.zoom)&&Math.abs(z)<=Math.max(d*o.scale/2,10/planView.zoom);});
 if(o){selected=o.id;selClip=null;planDrag={kind:'object',o,dx:q.x-o.x,dz:q.z-o.z};refreshSide();}
}
function planMove(e){
 if(!planDrag)return;const q=eventPoint(e),d=planDrag;if(d.kind==='pan'){if(Math.hypot(q.sx-d.sx,q.sy-d.sy)>3)d.moved=true;if(d.moved){planView.x=d.x-(q.sx-d.sx)/planView.zoom;planView.z=d.z+(q.sy-d.sy)/planView.zoom;draw();}return;}
 if(!d.changed){checkpoint();d.changed=true;}const snapXY=v=>clamp(Math.round(v*2)/2,-100,150);
 if(d.kind==='rotate'){let angle=(Math.atan2(q.x-d.o.x,q.z-d.o.z)-d.base)*180/Math.PI;if(e.shiftKey)angle=Math.round(angle/15)*15;d.o.rotation=((angle+540)%360)-180;}
 else if(d.kind==='waypoint'){d.o.waypoints[d.index]={x:snapXY(q.x),z:snapXY(q.z)};}
 else if(d.kind==='end'){d.o.endX=snapXY(q.x);d.o.endZ=snapXY(q.z);}
 else if(d.kind==='camera'){d.o.fixedX=snapXY(q.x);d.o.fixedZ=snapXY(q.z);}
 else{const x=snapXY(q.x-d.dx),z=snapXY(q.z-d.dz),dx=x-d.o.x,dz=z-d.o.z;d.o.x=x;d.o.z=z;if(!isMobile(d.o)){d.o.endX=x;d.o.endZ=z;}else if(e.shiftKey){d.o.endX=clamp(d.o.endX+dx,-100,150);d.o.endZ=clamp(d.o.endZ+dz,-100,150);d.o.waypoints=(d.o.waypoints||[]).map(v=>({x:clamp(v.x+dx,-100,150),z:clamp(v.z+dz,-100,150)}));}}draw();
}
function removePlanWaypoint(e){const o=currentObject();if(!o)return;const q=eventPoint(e),i=(o.waypoints||[]).findIndex(v=>{const a=screenPoint(v.x,v.z);return Math.hypot(a[0]-q.sx,a[1]-q.sy)<15;});if(i>=0){checkpoint();o.waypoints.splice(i,1);sync();}}
canvas.oncontextmenu=e=>e.preventDefault();

fitPlan();
sync();
