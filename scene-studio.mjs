import { installTimelineControls } from './timeline-controls.mjs';
import { bindTimelineRename } from './timeline-rename.mjs?v=timeline-rename-2';
import { confirmStudio, alertStudio, sceneExportDialog, CANVAS_SIZES, settingsSection } from './studio-ui.mjs?v=preview-controls-1';
// FrameFlow Scene Studio UI. Layout follows Map Studio: add-grids + item list on the left, inspector on the right,
// clip timeline below. Gestures and camera shots are clips you place on the timeline.
import { defaultScene, sceneFrameCount, makeObject, makeClip, makeCameraClip, renderScene, cityScene, ITEM_TYPES, isMobile, itemSize, routePoints, actorYaw, trafficState, actorPosition, cameraAt, validateScene, resolveClips, clamp, GESTURES, GESTURE_DURATION, CAMERA_MODES, CAMERA_MOVES, CAMERA_PRESETS, BODIES, OUTFITS, HAIR_STYLES, FACIAL, FINISHES, SKIN_TONES, HAIR_COLORS, EXPRESSIONS, MAX_SCENE_OBJECTS, defaultLook, humanLook } from './scene-engine.mjs?v=builder-3';
import { SCENERY, SURFACES, BUILDINGS, ASSET_GROUPS, ROOFS, TREE_STYLES, ENVIRONMENTS } from './scene-catalog.mjs';
import { SCENE_PRESETS, buildScenePreset, buildStoryScene } from './scene-presets.mjs';
import { SURFACE_TEXTURES, TEXTURE_PACKS, applyTexturePack, TERRAIN_TYPES, DEFAULT_TERRAIN } from './scene-environment.mjs';
import { terrainHeight } from './scene-environment.mjs';
import { DEFAULT_ATMOSPHERE, WEATHER_PRESETS, CARRY_PROPS, SCATTER_TYPES, cameraSpecFromPose, scatterPlants, sampleCurve } from './scene-storytelling.mjs';
import { exportMapVideo } from './map-video-export.mjs';
const $ = s => document.querySelector(s), esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const STORE = 'frameflow-scene-v2', OLD_STORE = 'frameflow-scene-v1';
const OBJECT_ICON = {human:'♙',car:'▰',bus:'▤',tree:'♧',building:'▥',road:'║',junction:'╬',crossing:'▥',park:'▧',traffic:'⋮',lamp:'⌑',bench:'⊓'};
const GESTURE_ICON = { idle: '◌', walk: '⇢', run: '⇒', wave: '≈', point: '☞', jump: '⤒', sit: '⌴', clap: '✦', bow: '⌄', talk:'☏', cheer:'☆', dance:'♫' };
let viewMode = '2d', placement = null, planTool = 'select';
let assetCategory = 'all', assetSearch = '';
let previewCamera=null;
const builderTools={radius:8,amount:1.5,scatterCount:12,scatterType:'mixed',seed:7,cameraName:'View 1',shotDuration:3,fromCamera:'',toCamera:''};
const iconFor = type => OBJECT_ICON[type] || ({Buildings:'⌂',Nature:'♧',Landscape:'▧',Rooms:'▣','Street & props':'◇'}[ASSET_GROUPS[type]] ?? '◇');
const planView = {x:0,z:20,zoom:12};
let planDrag = null;
let p = buildScenePreset('city'), time = 0, selected = null, selClip = null, playing = false, raf = 0, busy = false, undo = [], redo = [], loop = true, timelineZoom = 1, drag = null;
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
const previewProject=()=>previewCamera?{...p,camera:previewCamera,cameraClips:[]}:p;
function cameraEndpointFields(c){return ['from','to'].map(side=>`<p class="mini-label">${side==='from'?'START VIEW':'END VIEW'}</p><div class="two">`+['pos','look'].map(kind=>c[side+'Pose'][kind].map((value,i)=>field(`${side}${kind==='pos'?'Pos':'Look'}.${i}`,`${kind==='pos'?'Camera':'Aim'} ${['X','Y','Z'][i]}`,value)).join('')).join('')+field(`${side}Pose.fov`,'Field of view',c[side+'Pose'].fov)+'</div>').join('');}

function assetResults() {
  const entries=Object.entries(ITEM_TYPES).filter(([id,name])=>(assetCategory==='all'||ASSET_GROUPS[id]===assetCategory)&&`${name} ${ASSET_GROUPS[id]} ${id}`.toLowerCase().includes(assetSearch.toLowerCase()));
  return entries.length?grid('data-add-sc',entries.map(([id,name])=>[id,iconFor(id),name])):'<p class="mini-label">No matching elements. Try another search or collection.</p>';
}
function characterInspector(o) {
  const look=humanLook(o);
  return section('CHARACTER',select('look.body','Body',look.body,Object.entries(BODIES).map(([id,b])=>[id,b.label]))+select('look.outfit','Outfit',look.outfit,Object.entries(OUTFITS).map(([id,v])=>[id,v.label]))+field('look.bottomColor','Trousers / skirt',look.bottomColor,'color')+select('look.expression','Expression',look.expression,Object.entries(EXPRESSIONS))+select('look.glasses','Glasses',look.glasses,[['false','Without glasses'],['true','Round glasses']])+'<button data-action="random-look">Try a different look</button>')
    +section('SKIN & HAIR',field('look.skin','Skin tone',look.skin,'color')+swatches('data-look-skin',SKIN_TONES,look.skin)+select('look.hair','Hairstyle',look.hair,Object.entries(HAIR_STYLES))+field('look.hairColor','Hair color',look.hairColor,'color')+swatches('data-look-hair',HAIR_COLORS,look.hairColor)+select('look.facial','Facial hair',look.facial,Object.entries(FACIAL)))
    +section('INTERACTIONS',select('object.seatId','Seat',o.seatId??'',[['','Choose a chair / bench / sofa'],...p.objects.filter(v=>['chair','bench','sofa'].includes(v.type)).map(v=>[v.id,v.name])])+'<div class="sc-actions"><button data-action="sit-on-seat">Sit at playhead</button><button data-action="walk-to-seat">Walk to seat</button></div>'+select('object.talkTarget','Conversation partner',o.talkTarget??'',[['','Choose another character'],...p.objects.filter(v=>v.type==='human'&&v.id!==o.id).map(v=>[v.id,v.name])])+'<button data-action="talk-pair">Start conversation</button>'+select('object.carry','Carry in right hand',o.carry??'none',Object.entries(CARRY_PROPS))+'<p class="mini-label">Sit and Talk use gesture clips. Characters turn toward their partner; carried props travel with their hand.</p>');
}
root.addEventListener('input',e=>{if(e.target.id==='scAssetSearch'){assetSearch=e.target.value;$('#scAssetResults').innerHTML=assetResults();}});

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
  const dims=CANVAS_SIZES.some(([v])=>v===`${p.width},${p.height}`)?[p.width,p.height]:[1280,720];const [w,h]=dims;if(canvas.width!==w||canvas.height!==h){canvas.width=w;canvas.height=h;canvas.style.aspectRatio=`${w}/${h}`;} if(viewMode === '2d') drawPlan(); else { renderScene(canvas, previewProject(), time); root.querySelector('.sc-hint').textContent = '3D preview · Right-drag or middle-drag to orbit · Scroll to zoom · Switch to 2D layout to place items and fixed cameras'; } $('#scTime').textContent = `${String(Math.floor(time/60)).padStart(2,'0')}:${(time%60).toFixed(2).padStart(5,'0')}`; $('#scSeek').value = time.toFixed(3); $('#scScrub').value = time; root.style.setProperty('--sc-progress', time / p.duration * 100 + '%'); }
function pause() { playing = false; cancelAnimationFrame(raf); root.querySelector('[data-action="play"]').textContent = '▶'; }
function seek(t) { if (!Number.isFinite(t)) return; previewCamera=null;pause(); time = clamp(snap(t), 0, lastTime()); draw(); }
function play() {
  previewCamera=null;
  if (busy) return; if (playing) return pause();
  if (time >= lastTime()) time = 0; playing = true; const origin = performance.now(), from = time; root.querySelector('[data-action="play"]').textContent = 'Ⅱ';
  const step = now => { if (!playing) return; let t = from + (now - origin) / 1000;
    if (t >= p.duration) { if (!loop) { seek(p.duration); return; } t %= p.duration; } time = Math.floor(t * p.fps) / p.fps; draw(); raf = requestAnimationFrame(step); };
  raf = requestAnimationFrame(step);
}

// ------------------------------------------------------------------ left bar
function renderLeft() {
  const closed = new Set([...root.querySelectorAll('#scLeft details:not([open])')].map(d => d.querySelector('summary').textContent)), human = targetHuman();
  const items = p.objects.map(o => `<div class="sc-item ${selected === o.id && !selClip ? 'selected' : ''}" data-item="${esc(o.id)}"><span class="type c-${o.type}">${iconFor(o.type)}</span><span class="name">${esc(o.name)}</span><span class="when">${o.start.toFixed(1)}s</span></div>`).join('')
    + [...p.cameraClips].sort((a, b) => a.start - b.start).map(c => `<div class="sc-item ${selClip === c.id ? 'selected' : ''}" data-cam-item="${esc(c.id)}"><span class="type c-shot">◉</span><span class="name">${esc(c.name??CAMERA_MODES[c.mode]+' shot')}</span><span class="when">${c.start.toFixed(1)}s</span></div>`).join('');
  const hasSel = !!(selClip || selected);
  $('#scLeft').innerHTML =
    group('SCENE STARTERS', '<p class="mini-label sc-note">Start with a complete editable layout. Replaces this scene; Undo brings it back.</p><button class="sc-story-demo" data-action="story-demo">Animated park story · Try all new tools</button><div class="sc-preset-grid">' + Object.entries(SCENE_PRESETS).map(([id,[name,tip]])=>`<button data-preset="${id}" class="sc-preset sc-preset-${id}" title="${esc(tip)}"><b>${esc(name)}</b><span>${esc(tip)}</span></button>`).join('') + '</div>')
    + group('TEXTURE PACKS', '<p class="mini-label sc-note">Coordinated cartoon colors and surface textures. Apply to this scene; Undo restores your previous look.</p><div class="sc-material-packs">'+Object.entries(TEXTURE_PACKS).map(([id,v])=>`<button data-texture-pack="${id}" class="${(p.texturePack??'none')===id?'active':''}" title="${esc(v.description)}" aria-pressed="${(p.texturePack??'none')===id}"><span class="sc-pack-colors">${[v.ground??p.ground??'#8fa77b',v.wall??'#e7cfaa',v.accent??'#b57656',v.water??'#76b8c7'].map(c=>`<i style="background:${c}"></i>`).join('')}</span><b>${esc(v.label)}</b></button>`).join('')+'</div><button data-action="terrain-settings">Terrain & material settings</button>')
    + group('NATURE TOOLS',field('tool.radius','Brush radius (m)',builderTools.radius,'number','min="2" max="30"')+field('tool.amount','Sculpt strength (m)',builderTools.amount,'number','min="0.25" max="4"')+'<div class="sc-actions"><button data-action="sculpt-raise">Raise</button><button data-action="sculpt-lower">Lower</button><button data-action="sculpt-flatten">Flatten</button></div><button data-action="sculpt-clear">Clear sculpting</button>'+select('tool.scatterType','Plants to scatter',builderTools.scatterType,Object.entries(SCATTER_TYPES))+field('tool.scatterCount','Plants per click',builderTools.scatterCount,'number','min="1" max="40"')+field('tool.seed','Scatter seed',builderTools.seed,'number','min="0" max="99999"')+'<button data-action="scatter-plants">Scatter plants in layout</button><p class="mini-label">Sculpt by dragging on the layout. Scatter with a click; each batch can be undone. Escape finishes.</p>')
    + group('ATMOSPHERE',select('weatherPreset','Weather preset','',[['','Choose weather'],...Object.entries(WEATHER_PRESETS).map(([id,v])=>[id,v.label])])+'<button data-action="atmosphere-settings">Clouds, rain, wind & shadows</button>')
    + group('PLACE ITEMS', '<p class="mini-label sc-note">Choose an item, then click the layout. Hold Shift to place several. Drag to move; the orange handle rotates.</p><input id="scAssetSearch" type="search" placeholder="Search '+Object.keys(ITEM_TYPES).length+' elements…" aria-label="Search scene elements" value="'+esc(assetSearch)+'">' + select('assetCategory','Collection',assetCategory,[['all','All elements'],...Array.from(new Set(Object.values(ASSET_GROUPS))).map(v=>[v,v])]) + '<div id="scAssetResults">'+assetResults()+'</div>')
    + group('LAYOUT', '<div class="sc-actions"><button data-action="manual-layout">Use placed items only</button><button data-action="city-demo">Intersection demo</button></div><p class="mini-label">Placed items only hides the generated road and roadside scenery.</p>')
    + group('CAMERA', '<p class="mini-label sc-note">Edits the camera shot at the playhead, or the default camera.</p>' + select('planCam.target', 'Main object to follow', activeCamSpec().target || '', subjectOptions()) + select('planCam.move', 'Camera movement', activeCamSpec().move, Object.entries(CAMERA_MOVES)) + '<div class="sc-actions"><button data-action="camera-place">Place fixed camera</button><button data-action="camera-aim">Set look-at point</button></div>')
    + group('CAMERA STORYBOARD',field('tool.cameraName','View name',builderTools.cameraName,'text')+'<button data-action="save-camera-view">Save current camera view</button><div class="sc-saved-cameras">'+(p.savedCameras??[]).map(v=>`<div><span>${esc(v.name)}</span><button data-preview-view="${esc(v.id)}" title="Preview saved view">View</button><button data-delete-view="${esc(v.id)}" aria-label="Delete ${esc(v.name)}">×</button></div>`).join('')+'</div>'+field('tool.shotDuration','Seconds per move',builderTools.shotDuration,'number','min="0.5" max="30"')+select('tool.fromCamera','From view',builderTools.fromCamera,[['','Choose a saved view'],...(p.savedCameras??[]).map(v=>[v.id,v.name])])+select('tool.toCamera','To view',builderTools.toCamera,[['','Choose a saved view'],...(p.savedCameras??[]).map(v=>[v.id,v.name])])+'<div class="sc-actions"><button data-action="connect-camera-views">Connect views</button><button data-action="camera-sequence">Sequence all views</button></div><p class="mini-label">Save two or more camera positions, then add smooth moves at the playhead. Clips remain editable on the camera track.</p>')
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
    body = (c.fromPose?section('SAVED CAMERA MOVE',field('cam.name','Shot name',c.name??'Camera move','text')+select('cam.easing','Movement easing',c.easing??'smooth',[['smooth','Smooth ease in / out'],['linear','Constant speed']])+'<button data-action="swap-camera-ends">Reverse camera move</button>'+cameraEndpointFields(c)):section('SHOT', select('cam.mode', 'Point of view', c.mode, Object.entries(CAMERA_MODES)) + select('cam.move', 'Movement', c.move, Object.entries(CAMERA_MOVES)) + select('cam.target', 'Subject', c.target || '', subjectOptions()))
      + section('LENS & POSITION', field('cam.yaw', 'Orbit angle (degrees)', c.yaw) + field('cam.height', 'Height (m)', c.height) + field('cam.distance', 'Distance (m)', c.distance) + field('cam.fov', 'Field of view', c.fov)
        + `<p class="mini-label">First person ignores angle, height and distance. Second person looks back at the subject from in front.</p>`))
      + section('TIMING', `<div class="two">${field('cam.start', 'Start (s)', c.start)}${field('cam.dur', 'Duration (s)', c.dur)}</div>${field('cam.blend', 'Blend in (s)', c.blend ?? .5)}`) + actions();
  } else if (o) {
    title = `${esc(o.type[0].toUpperCase() + o.type.slice(1))} <em>${esc(o.name)}</em>`;
    const mobile = ['human', 'car', 'bus'].includes(o.type), human = o.type === 'human';
    body = section('APPEARANCE', field('object.name','Name',o.name,'text') + select('object.material', 'Surface', o.material, [['inherit', 'Use scene surface'], ['white', 'White model'], ['color', 'Solid color'], ['texture', 'Textured / colored']]) + select('object.finish', 'Finish', o.finish ?? 'inherit', [['inherit', 'Use scene finish'], ...Object.entries(FINISHES)]) + field('object.finishScale', 'Texture scale (×)', o.finishScale ?? 1, 'number', 'min="0.1" max="8"') + field('object.color', human ? (humanLook(o).outfit === 'dress' ? 'Dress color' : 'Top / jacket color') : 'Object color', o.color, 'color') + field('object.scale', 'Scale', o.scale))
      + (human?characterInspector(o):'')
      + (!mobile?section('SURFACE TEXTURE',select('object.surfaceTexture','Material',o.surfaceTexture??'auto',[['auto','Automatic from pack'],['none','Smooth'],...Object.entries(SURFACE_TEXTURES)])+field('object.textureScale','Texture size',o.textureScale??1,'number','min="0.25" max="6"')+'<p class="mini-label">Keeps your object color. Detail follows the surface in 3D and in exports.</p>'):'')
      + section('ROTATION', field('object.rotation',mobile?'Facing offset (degrees)':'Rotation (degrees)',o.rotation??0) + (mobile?select('object.orientation','Orientation',o.orientation??'path',[['path','Turn with route'],['fixed','Keep fixed facing']]):'') + '<div class="sc-actions"><button data-action="rotate-left">↶ 90°</button><button data-action="rotate-right">↷ 90°</button></div>')
      + (SCENERY[o.type]||['road','junction','crossing','building','park','tree'].includes(o.type)?section('DIMENSIONS',field('object.width','Width (m)',itemSize(o)[0])+field('object.length','Length / depth (m)',itemSize(o)[1])+((SCENERY[o.type]&&!SURFACES.includes(o.type))||['building','tree'].includes(o.type)?field('object.height','Height (m)',o.height??8):'')):'')
      + (BUILDINGS.includes(o.type)?section('BUILDING', (o.type!=='building'?select('object.roof','Roof style',o.roof??'pitched',Object.entries(ROOFS))+field('object.accentColor','Roof / trim color',o.accentColor??'#a56850','color'):'')+select('object.windows','Windows',o.windows!==false,[['true','Show'],['false','Hide']])):'')
      + (o.type==='tree'?section('CANOPY',select('object.treeStyle','Tree style',o.treeStyle??'round',Object.entries(TREE_STYLES))):'')
      + (o.type==='terrain'?section('TERRAIN SHAPE',select('object.terrainProfile','Profile',o.terrainProfile??'rolling',Object.entries(TERRAIN_TYPES).filter(([id])=>id!=='flat'))+field('object.terrainSeed','Variation seed',o.terrainSeed??7,'number','min="0" max="99999"')+'<p class="mini-label">Resize, rotate and raise patches to shape your landscape. Place props using their elevation control.</p>'):'')
      + (['path','river'].includes(o.type)?section('CURVED SCENERY','<div class="sc-actions"><button data-action="draw-scenery-curve">Draw curve</button><button data-action="curve-clear">Make straight</button><button data-action="curve-pop">Remove last point</button></div><p class="mini-label">Click to add curve points; Escape finishes. Drag the numbered points to refine the curve. Width controls the whole ribbon.</p>'):'')
      + (['flowers','gazebo','sign','stall','windmill','door','window','bed','shelf'].includes(o.type)?section('DETAIL COLOR',field('object.accentColor','Accent color',o.accentColor??'#b16e53','color')):'')
      + (o.type==='traffic'?section('TRAFFIC LIGHT',select('object.signal','Signal',o.signal??'cycle',[['cycle','Automatic cycle'],['red','Red'],['amber','Amber'],['green','Green']])+field('object.redTime','Red seconds',o.redTime??6)+field('object.greenTime','Green seconds',o.greenTime??5)+field('object.amberTime','Amber seconds',o.amberTime??2)+field('object.phase','Cycle offset (s)',o.phase??0)+'<p class="mini-label">Visual signals. Vehicles follow their routes independently.</p>'):'')
      + (mobile?section('ROUTE', '<div class="sc-actions"><button data-action="route-add">Add turn points</button><button data-action="route-clear">Straight route</button></div><button data-action="route-pop">Remove last point</button>'+field('object.turnRadius','Corner rounding (m)',o.turnRadius??3)+'<p class="mini-label">'+(o.waypoints||[]).length+' turn points. Click the plane to add points before B. Drag numbered points to edit; right-click one to remove. Escape finishes. Shift-drag A to move the whole route.</p>'):'')
      + section(mobile ? 'POSITION & PATH' : 'POSITION', `<div class="two">${field('object.x', 'Start X (m)', o.x)}${field('object.z', 'Start Z (m)', o.z)}${mobile ? field('object.endX', human ? 'Toward X (m)' : 'End X (m)', o.endX) + field('object.endZ', human ? 'Toward Z (m)' : 'End Z (m)', o.endZ) : field('object.elevation','Elevation (m)',o.elevation??0,'number','min="-2" max="30"')}</div>`
        + `<p class="mini-label">X moves across the road, Z along it.${human ? ' A human only moves during Walk and Run clips, heading toward this point.' : ''}</p>`)
      + (!mobile?section('GROUND PLACEMENT',select('object.grounding','Base height',o.grounding??'fixed',[['fixed','Fixed elevation'],['terrain','Follow landscape height']])+'<p class="mini-label">Follow landscape height places the base on the generated terrain. Elevation adds an offset.</p>'):'')
      + section('TIMING', `<div class="two">${field('object.start', 'Appears at (s)', o.start)}${field('object.duration', mobile && !human ? 'Travel time (s)' : 'Visible for (s)', o.duration)}</div>${mobile && !human ? select('object.easing', 'Path movement', o.easing, [['linear', 'Constant speed'], ['smooth', 'Ease in and out']]) : ''}`)
      + actions(`<button data-action="visibility">${o.visible ? 'Hide' : 'Show'}</button>`);
  }
  box.classList.add('ff-inspector-accordion');
  box.innerHTML = body ? `<h3 class="inspector-title">${title}</h3>` + body.replace(/%OPEN%/g, '').replace(/<details class="ff-inspector-section" data-name="([^"]*)"/g, (m, n) => `<details class="ff-inspector-section" data-name="${n}" ${closed.has(n) ? '' : 'open'}`)
    : '<p class="muted m-empty">Select an object, gesture or camera shot to edit it.</p>';
}

// ------------------------------------------------------------------ scene settings dialog
function renderSettings() {
  const c = p.camera;
  const weather={...DEFAULT_ATMOSPHERE,...p.atmosphere};
  const terrain={...DEFAULT_TERRAIN,...p.terrain};
  const folded = new Set([...$('#scSettings').querySelectorAll('details:not([open])')].map(el => el.querySelector('summary').textContent));
  const extra = (title, content) => settingsSection(title, content, {collapsible:true, open:!folded.has(title)});
  $('#scSettings').innerHTML = settingsSection('Composition', select('canvasSize', 'Canvas', `${p.width||1280},${p.height||720}`, CANVAS_SIZES) + '<div class="two">' + select('fps', 'Frame rate', p.fps, [['24','24'],['30','30'],['60','60']]) + field('duration', 'Duration (seconds)', p.duration, 'number', 'min="1"') + '</div>')
    + extra('Environment', select('baseRoad','Generated main road',p.baseRoad!==false,[['true','Show'],['false','Hide — use placed roads']]) + '<div class="two">' + select('left', 'Left roadside', p.left, ['city', 'park', 'trees', 'playground', 'none']) + select('right', 'Right roadside', p.right, ['city', 'park', 'trees', 'playground', 'none']) + '</div>' + field('roadWidth', 'Road width (m)', p.roadWidth))
    + extra('Texture pack',select('texturePack','Cartoon pack',p.texturePack??'none',Object.entries(TEXTURE_PACKS).map(([id,v])=>[id,v.label]))+select('groundTexture','Ground material',p.groundTexture??'auto',[['auto','From texture pack'],['none','Smooth'],...Object.entries(SURFACE_TEXTURES)])+field('textureStrength','Texture detail (0 – 1)',p.textureStrength??.65,'number','min="0" max="1"')+field('textureScale','Texture size',p.textureScale??1,'number','min="0.25" max="6"'))
    + extra('Terrain',select('terrain.type','Landscape',terrain.type,Object.entries(TERRAIN_TYPES))+field('terrain.height','Relief height (m)',terrain.height,'number','min="0" max="25"')+field('terrain.scale','Hill / dune spread (m)',terrain.scale,'number','min="12" max="100"')+field('terrain.flatRadius','Flat building area radius (m)',terrain.flatRadius,'number','min="0" max="100"')+field('terrain.seed','Landscape seed',terrain.seed,'number','min="0" max="99999"')+'<p class="mini-label">The building area stays level around X 0, Z 12. Outside it, terrain rises gradually. Use Follow landscape height on props placed on hills.</p>')
    + extra('Atmosphere & motion',select('weatherPreset','Weather preset','',[['','Custom'],...Object.entries(WEATHER_PRESETS).map(([id,v])=>[id,v.label])])+field('atmosphere.clouds','Cloud cover (0 – 1)',weather.clouds,'number','min="0" max="1"')+field('atmosphere.rain','Rain intensity (0 – 1)',weather.rain,'number','min="0" max="1"')+field('atmosphere.wind','Wind strength (0 – 1)',weather.wind,'number','min="0" max="1"')+field('atmosphere.windDirection','Wind direction (degrees)',weather.windDirection,'number','min="-180" max="180"')+field('atmosphere.waterSpeed','Water movement (0 – 2)',weather.waterSpeed,'number','min="0" max="2"')+field('atmosphere.shadowSoftness','Shadow softness (0 – 1)',weather.shadowSoftness,'number','min="0" max="1"')+'<p class="mini-label">Weather, wind and water animate with the timeline and are included in exports.</p>')
    + extra('Light & atmosphere',select('environmentPreset','Lighting preset','',[['','Custom'],...Object.entries(ENVIRONMENTS).map(([id,v])=>[id,v.label])])+field('ground','Ground color',p.ground??'#8fa77b','color')+field('ambient','Ambient light (0.15 – 0.9)',p.ambient??.5,'number','min="0.15" max="0.9"')+field('sunAngle','Sun direction (degrees)',p.sunAngle??-40,'number','min="-180" max="180"')+field('haze','Distance haze (0 – 0.8)',p.haze??0,'number','min="0" max="0.8"'))
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
  const camRow = `<div class="sc-track ${camSel ? 'selected' : ''}"><span class="sc-track-name" data-camera-track="true"><i>◉</i>Camera</span><div class="sc-lane" data-lane="camera">${p.cameraClips.map(c => clipEl(c, 'cam', c.name??`${CAMERA_MODES[c.mode]} · ${CAMERA_MOVES[c.move].split(' ')[0]}`, 'data-clip', `${c.name??CAMERA_MODES[c.mode]} · ${c.start.toFixed(2)}–${(c.start + c.dur).toFixed(2)}s`)).join('')}<b></b></div></div>`;
  const rows = p.objects.map(o => {
    const human = o.type === 'human', mobile = ['car', 'bus'].includes(o.type);
    const content = human ? `<u class="sc-life" style="left:${pct(o.start)}%;width:${pct(Math.max(0, Math.min(o.duration, p.duration - o.start)))}%"></u>` + (o.clips || []).map(c => clipEl(c, 'g-' + c.gesture, GESTURES[c.gesture], 'data-clip', `${GESTURES[c.gesture]} · ${c.start.toFixed(2)}–${(c.start + c.dur).toFixed(2)}s`)).join('')
      : clipEl({ ...o, id: o.id }, 'travel', mobile ? 'Travel' : 'Visible', 'data-travel', `${mobile ? 'Travel' : 'Visible'} · ${o.start.toFixed(2)}–${(o.start + o.duration).toFixed(2)}s`, selected === o.id && !selClip);
    return `<div class="sc-track ${selected === o.id && !selClip ? 'selected' : ''}" data-row="${esc(o.id)}"><span class="sc-track-name" data-object="${esc(o.id)}"><i>${iconFor(o.type)}</i><span class="ff-layer-name" title="Double-click or double-tap to rename">${esc(o.name)}</span></span><div class="sc-lane">${content}<b></b></div></div>`;
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
  if(['fromPos','fromLook','toPos','toLook'].includes(rootKey)){const pose=findClip(selClip)?.clip?.[rootKey.startsWith('from')?'fromPose':'toPose'];return [pose?.[rootKey.endsWith('Pos')?'pos':'look'],prop];}
  if(['fromPose','toPose'].includes(rootKey))return [findClip(selClip)?.clip?.[rootKey],prop];
  if (rootKey === 'object') return [currentObject(), prop];
  if (rootKey === 'clip' || rootKey === 'cam') return [findClip(selClip)?.clip, prop];
  if (rootKey === 'planCam') return [activeCamSpec(), prop];
  if (rootKey === 'camera') return [p.camera, prop];
  if (rootKey === 'terrain') {p.terrain={...DEFAULT_TERRAIN,...p.terrain};return [p.terrain,prop];}
  if (rootKey === 'atmosphere') {p.atmosphere={...DEFAULT_ATMOSPHERE,...p.atmosphere};return [p.atmosphere,prop];}
  if (rootKey === 'look') { const o = currentObject(); if (o?.type === 'human') o.look = humanLook(o); return [o?.look, prop]; }
  return [p, key];
}
root.addEventListener('change', e => {
  if (busy) return; const key = e.target.dataset.field; if (!key) return; pause();
  if(key.startsWith('tool.')){const prop=key.slice(5),value=e.target.type==='number'?Number(e.target.value):e.target.value;const bounds={radius:[2,30],amount:[.25,4],scatterCount:[1,40],seed:[0,99999],shotDuration:[.5,30]};builderTools[prop]=bounds[prop]?clamp(Number.isFinite(value)?value:bounds[prop][0],...bounds[prop]):String(value).slice(0,120);if(['scatterCount','seed'].includes(prop))builderTools[prop]=Math.round(builderTools[prop]);return;}
  if(key==='weatherPreset'){const preset=WEATHER_PRESETS[e.target.value];if(preset){checkpoint();const {label,...a}=preset;p.atmosphere={...DEFAULT_ATMOSPHERE,...p.atmosphere,...a};sync();}return;}
  if(key==='assetCategory'){assetCategory=e.target.value;$('#scAssetResults').innerHTML=assetResults();return;}
  if(key==='texturePack'){checkpoint();applyTexturePack(p,e.target.value);sync();return;}
  if(key==='environmentPreset'){if(ENVIRONMENTS[e.target.value]){checkpoint();const {label,...env}=ENVIRONMENTS[e.target.value];Object.assign(p,env);sync();}return;}
  const previous = JSON.stringify(p), [obj, prop] = targetFor(key); if (!obj) return;
  obj[prop] = (e.target.type === 'number' || key === 'fps') ? Number(e.target.value) : (prop === 'target' && e.target.value === '' ? null : e.target.value);
  if(key==='canvasSize'){const [w,h]=e.target.value.split(',').map(Number);p.width=w;p.height=h;delete p.canvasSize;}
  if(key==='baseRoad')obj[prop]=e.target.value==='true';
  if(['look.glasses','object.windows'].includes(key))obj[prop]=e.target.value==='true';
  if (key === 'planCam.target') { obj.move = 'follow'; if (obj.mode === 'first' && !obj.target) obj.mode = 'third'; }
  if (key === 'look.outfit') obj.bottomColor = OUTFITS[obj.outfit].bottom;
  if (key === 'look.body') { obj.hair = defaultLook(obj.body).hair; if (obj.body !== 'man') obj.facial = 'none'; }
  if (key === 'object.x' || key === 'object.z') { if (!isMobile(obj)) { obj.endX = obj.x; obj.endZ = obj.z; } }
  if(key==='object.length'&&obj.curvePoints?.length){const old=JSON.parse(previous).objects.find(v=>v.id===obj.id),ratio=obj.length/itemSize(old)[1];obj.curvePoints=obj.curvePoints.map(v=>({x:v.x,z:clamp(v.z*ratio,-150,150)}));}
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
  if (p.objects.length >= MAX_SCENE_OBJECTS) { alertStudio(`This scene supports up to ${MAX_SCENE_OBJECTS} objects.`); return; }
  const [type, body] = spec.split(':'); checkpoint(); const o = makeObject(type, p.objects.length); o.duration = p.duration;
  if(p.texturePack&&p.texturePack!=='none')applyTexturePack({...p,objects:[o]},p.texturePack);
  if(!isMobile(o)&&!SURFACES.includes(type)&&type!=='terrain'&&p.terrain?.type&&p.terrain.type!=='flat')o.grounding='terrain';
  if (type === 'human') { o.look = defaultLook(); o.name = 'Character'; }
  if (!isMobile(o)) { o.x = 10; o.endX = 10; o.endZ = o.z; }
  p.objects.push(o); selected = o.id; selClip = null; sync();
}
const download = (blob, name) => { const a = document.createElement('a'), url = URL.createObjectURL(blob); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 5000); };
function saveCameraView(){
  if((p.savedCameras??[]).length>=24)return alertStudio('You can save up to 24 views.');
  const c=cameraAt(previewProject(),time),bounded=(v,position)=>v.map((n,i)=>clamp(n,i===1?(position?1:0):-100,i===1?60:150));
  checkpoint();const view={id:uid(),name:builderTools.cameraName.trim()||`View ${(p.savedCameras??[]).length+1}`,pose:{pos:bounded(c.pos,true),look:bounded(c.look,false),fov:c.fov}};
  (p.savedCameras??=[]).push(view);builderTools.fromCamera||=view.id;builderTools.toCamera=view.id;builderTools.cameraName=`View ${p.savedCameras.length+1}`;sync();
}
function connectViews(all=false){
  const views=p.savedCameras??[],pairs=all?views.slice(1).map((b,i)=>[views[i],b]):[[views.find(v=>v.id===builderTools.fromCamera),views.find(v=>v.id===builderTools.toCamera)]];
  if(!pairs.length||pairs.some(([a,b])=>!a||!b||a.id===b.id))return alertStudio('Save and choose two different camera views first.');
  if(p.cameraClips.length+pairs.length>100)return alertStudio('Maximum 100 camera clips.');
  checkpoint();pause();previewCamera=null;let start=time;if(p.duration-start<pairs.length*.1)start=0;
  const dur=Math.min(builderTools.shotDuration,(p.duration-start)/pairs.length);
  for(const [a,b] of pairs){const c={...makeCameraClip('locked',start,dur),name:`${a.name} → ${b.name}`,fromPose:structuredClone(a.pose),toPose:structuredClone(b.pose),easing:'smooth',blend:0};p.cameraClips.push(c);selClip=c.id;start+=dur;}
  selected=null;sync();
}
function startNatureTool(tool){setView('2d');planTool=tool;draw();}
function sculptAt(x,z){
  p.terrain={...DEFAULT_TERRAIN,...p.terrain};const list=p.terrain.sculpt??=[];if(list.length>=160)return;
  const mode=planTool.slice(7);list.push({x,z,radius:builderTools.radius,mode,amount:mode==='lower'?-builderTools.amount:builderTools.amount,level:terrainHeight(x,z,p.terrain)});
}
function scatterAt(x,z){
  const count=Math.min(builderTools.scatterCount,MAX_SCENE_OBJECTS-p.objects.length);
  if(count<1)return alertStudio('The scene has reached its object limit.');
  const plants=scatterPlants({x,z,radius:builderTools.radius,count,seed:builderTools.seed,type:builderTools.scatterType},p.objects);
  if(!plants.length)return alertStudio('No free space here. Try a wider area.');checkpoint();
  for(const plant of plants){const o={...makeObject(plant.type),...plant,endX:plant.x,endZ:plant.z,duration:p.duration,grounding:'terrain'};applyTexturePack({...p,objects:[o]},p.texturePack??'none');p.objects.push(o);selected=o.id;}
  builderTools.seed=(builderTools.seed+1)%100000;selClip=null;sync();
}
function sitOnSeat(walk=false){
  const o=targetHuman(),seat=p.objects.find(v=>v.id===o?.seatId&&['chair','bench','sofa'].includes(v.type));if(!seat)return alertStudio('Choose a seat in the character’s Interactions section.');
  if(o.clips.length+(walk?2:1)>60)return alertStudio('This character has reached its gesture clip limit.');
  checkpoint();pause();let start=Math.min(time,p.duration-.1);
  if(walk){const position=actorPosition(o,start);o.x=position[0];o.z=position[2];o.routeStart=start;const distance=Math.hypot(o.x-seat.x,o.z-seat.z),dur=Math.min(distance/1.4,Math.max(0,p.duration-start-.5));o.endX=seat.x;o.endZ=seat.z;o.waypoints=[];if(dur>=.1){o.clips.push(makeClip('walk',start,dur,dur>0?Math.min(3,Math.max(.25,distance/(1.4*dur))):1));start+=dur;}}
  const c=makeClip('sit',start,Math.max(.1,p.duration-start));o.clips.push(c);selClip=c.id;sync();
}
function talkPair(){const o=targetHuman(),target=p.objects.find(v=>v.id===o?.talkTarget&&v.type==='human'&&v.id!==o.id);if(!target)return alertStudio('Choose a conversation partner first.');if([o,target].some(v=>v.clips.length>=60))return alertStudio('A character has reached its gesture clip limit.');checkpoint();pause();const start=Math.min(time,p.duration-.1),dur=Math.min(4,p.duration-start);target.talkTarget=o.id;for(const v of [o,target])v.clips.push(makeClip('talk',start,dur));selClip=null;sync();}
const actions = {
  'atmosphere-settings':()=>{const panel=$('#scSettingsPanel');if(!panel.open)panel.showModal();$('#scSettingsButton').setAttribute('aria-expanded','true');const control=panel.querySelector('[data-field="atmosphere.clouds"]');const details=control?.closest('details');if(details)details.open=true;control?.scrollIntoView({block:'center'});control?.focus();},
  'story-demo':()=>{checkpoint();pause();previewCamera=null;p=buildStoryScene();time=0;selected=p.objects.find(v=>v.type==='human')?.id;selClip=null;setView('3d');fitPlan();sync();},
  'save-camera-view':saveCameraView,'connect-camera-views':()=>connectViews(false),'camera-sequence':()=>connectViews(true),
  'swap-camera-ends':()=>{const c=findClip(selClip)?.clip;if(!c?.fromPose)return;checkpoint();[c.fromPose,c.toPose]=[c.toPose,c.fromPose];sync();},
  'sit-on-seat':()=>sitOnSeat(false),'walk-to-seat':()=>sitOnSeat(true),'talk-pair':talkPair,
  'sculpt-raise':()=>startNatureTool('sculpt-raise'),'sculpt-lower':()=>startNatureTool('sculpt-lower'),'sculpt-flatten':()=>startNatureTool('sculpt-flatten'),
  'sculpt-clear':()=>{if(!p.terrain?.sculpt?.length)return;checkpoint();p.terrain.sculpt=[];sync();},
  'scatter-plants':()=>startNatureTool('scatter'),
  'draw-scenery-curve':()=>{const o=currentObject();if(!o||!['river','path'].includes(o.type))return;checkpoint();o.curvePoints=[];setView('2d');planTool='curve';sync();},
  'curve-clear':()=>{const o=currentObject();if(o){checkpoint();delete o.curvePoints;sync();}},
  'curve-pop':()=>{const o=currentObject();if(o?.curvePoints?.length){checkpoint();o.curvePoints.pop();sync();}},
  'terrain-settings':()=>{const panel=$('#scSettingsPanel');if(!panel.open)panel.showModal();$('#scSettingsButton').setAttribute('aria-expanded','true');const control=panel.querySelector('[data-field="terrain.type"]');const details=control?.closest('details');if(details)details.open=true;control?.scrollIntoView({block:'center'});control?.focus();},
  'random-look':()=>{const o=targetHuman();if(!o)return;checkpoint();const pick=v=>v[Math.floor(Math.random()*v.length)];o.look={...humanLook(o),hair:pick(Object.keys(HAIR_STYLES)),skin:pick(SKIN_TONES),hairColor:pick(HAIR_COLORS),outfit:pick(Object.keys(OUTFITS))};o.look.bottomColor=OUTFITS[o.look.outfit].bottom;o.color=pick(['#7c9aab','#bd8374','#8d9b73','#b795ae','#d0a86d']);sync();},
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
  undo: () => { if (!undo.length) return; pause(); previewCamera=null; redo.push(JSON.stringify(p)); p = JSON.parse(undo.pop()); time = Math.min(time, lastTime()); sync(); },
  redo: () => { if (!redo.length) return; pause(); previewCamera=null; undo.push(JSON.stringify(p)); p = JSON.parse(redo.pop()); time = Math.min(time, lastTime()); sync(); },
  new: async () => { if (!await confirmStudio('Start an empty scene? Your current scene can be restored with Undo.')) return; checkpoint(); pause(); p = defaultScene(); previewCamera=null; p.objects = []; p.cameraClips = []; p.left=p.right='none'; p.baseRoad=false; viewMode='2d'; placement=null; time = 0; selected = null; selClip = null; sync(); },
  demo: () => { checkpoint(); pause(); p = cityScene(); time = 0; selected = p.objects.find(isMobile)?.id; selClip = null; fitPlan(); sync(); },
  save: () => download(new Blob([JSON.stringify(p, null, 2)], { type: 'application/json' }), 'scene.frameflow.json'),
  open: () => $('#scFile').click(), png: () => { const c=document.createElement('canvas');c.width=p.width||1280;c.height=p.height||720;renderScene(c,previewProject(),time);const name=(p.name||'scene').replace(/[^a-z0-9 _-]/gi,'').trim()||'scene';c.toBlob(b=>{if(b)download(b,`${name}-frame-${Math.round(time*p.fps)}.png`);},'image/png'); },
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
    if (f) { checkpoint(); const list = f.kind === 'gesture' ? f.owner.clips : p.cameraClips, c = { ...structuredClone(f.clip), id: uid(), start: clamp(snap(f.clip.start + f.clip.dur), 0, p.duration - .1) }; list.push(c); selClip = c.id; sync(); return; }
    const o = currentObject(); if (!o || p.objects.length >= MAX_SCENE_OBJECTS) return; checkpoint();
    const n = { ...structuredClone(o), waypoints:(o.waypoints||[]).map(v=>({x:clamp(v.x+2,-100,150),z:v.z})), id: uid(), name: o.name + ' copy', x: clamp(o.x + 2, -100, 150), endX: clamp(o.endX + 2, -100, 150), clips: (o.clips || []).map(c => ({ ...c, id: uid() })), ...(o.look ? { look: { ...o.look } } : {}) }; p.objects.push(n); selected = n.id; sync();
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
  if(b.dataset.previewView){const view=p.savedCameras?.find(v=>v.id===b.dataset.previewView);if(view){pause();previewCamera=cameraSpecFromPose(view.pose);setView('3d');draw();}return;}
  if(b.dataset.deleteView){checkpoint();p.savedCameras=(p.savedCameras??[]).filter(v=>v.id!==b.dataset.deleteView);sync();return;}
  if(b.dataset.texturePack){checkpoint();pause();applyTexturePack(p,b.dataset.texturePack);sync();return;}
  if(b.dataset.preset){checkpoint();pause();previewCamera=null;p=buildScenePreset(b.dataset.preset);time=0;selected=p.objects.find(isMobile)?.id??p.objects[0]?.id??null;selClip=null;setView('3d');fitPlan();sync();return;}
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
  try { const f = e.target.files[0]; if (!f) return; if (f.size > 2e6) throw Error('Project is too large'); const q = validateScene(JSON.parse(await f.text())); checkpoint(); pause(); p = q; previewCamera=null; time = 0; selected = p.objects[0]?.id ?? null; selClip = null; sync(); }
  catch (err) { alertStudio(err.message); } e.target.value = '';
};
// Canvas drag/scroll edits whichever camera is active at the playhead (a shot, or the default camera).
const activeCamSpec = () => { if(previewCamera)return previewCamera;const c = resolveClips(p.cameraClips).find(c => time >= c.start && time < c.end); return c ? p.cameraClips.find(x => x.id === c.id) : p.camera; };
let orbit = null;
canvas.onpointerdown = e => { if (busy) return; if(viewMode === '2d') return planDown(e); if(e.button!==2&&e.button!==1)return; e.preventDefault(); pause(); checkpoint(); if(activeCamSpec().fromPose)previewCamera=cameraSpecFromPose(cameraAt(p,time)); const spec = activeCamSpec(); orbit = { spec, x: e.clientX, y: e.clientY, yaw: spec.yaw, height: spec.height }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor='grabbing'; };
canvas.onpointermove = e => { if(viewMode === '2d') return planMove(e); if (!orbit) return; const s = orbit.spec; if(s.move==='static' && Number.isFinite(s.fixedX)){ s.aimX=clamp((s.aimX??0)+(e.clientX-orbit.x)*.015,-100,150); s.aimZ=clamp((s.aimZ??0)-(e.clientY-orbit.y)*.015,-100,150);orbit.x=e.clientX;orbit.y=e.clientY;draw();return; } if (['first', 'second'].includes(s.mode)) s.mode = 'third'; s.yaw = clamp(orbit.yaw + (e.clientX - orbit.x) * .3, -360, 360); s.height = clamp(orbit.height + (e.clientY - orbit.y) * .04, 1, 60); draw(); };
canvas.onpointerup = canvas.onpointercancel = e => { canvas.style.cursor=''; if(planDrag){ const d=planDrag; planDrag=null; if(d.kind==='pan'&&!d.moved&&e.button===2&&e.type!=='pointercancel') removePlanWaypoint(e); if(d.changed) sync(); else draw(); } if (orbit) { orbit = null; sync(); } };
canvas.onwheel = e => { e.preventDefault(); if (busy) return; if(viewMode==='2d'){ planView.zoom=clamp(planView.zoom*Math.exp(-e.deltaY*.001),2,70); draw(); return; } checkpoint(); if(activeCamSpec().fromPose)previewCamera=cameraSpecFromPose(cameraAt(p,time)); const s = activeCamSpec(); if(s.move==='static' && Number.isFinite(s.fixedX)){s.fov=clamp(s.fov+e.deltaY*.02,25,100);sync();return;} s.distance = clamp(s.distance + e.deltaY * .015, 2, 80); sync(); };
// Capture only Scene shortcuts: legacy Motion handlers otherwise run in unknown modes.
window.addEventListener('keydown', e => {
  if (!document.body.classList.contains('mode-scene')) return;
  if (e.target.closest?.('input,select,textarea,[contenteditable="true"]')) return;
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
function curveWorld(o,v){const y=actorYaw(o,0);return{x:o.x+(v.x*Math.cos(y)+v.z*Math.sin(y))*o.scale,z:o.z+(-v.x*Math.sin(y)+v.z*Math.cos(y))*o.scale};}
function curveLocal(o,q){const y=actorYaw(o,0),x=(q.x-o.x)/o.scale,z=(q.z-o.z)/o.scale;return{x:clamp(x*Math.cos(y)-z*Math.sin(y),-150,150),z:clamp(x*Math.sin(y)+z*Math.cos(y),-150,150)};}
function hitSceneryCurve(o,q){
  if(!o.curvePoints?.length)return false;const pts=sampleCurve(o.curvePoints),p=curveLocal(o,q),radius=(itemSize(o)[0]/2)+.5;
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],dx=b.x-a.x,dz=b.z-a.z,u=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);if(Math.hypot(p.x-a.x-u*dx,p.z-a.z-u*dz)<=radius)return true;}
  return false;
}
function fitPlan(){
 const pts=p.objects.flatMap(o=>{const [w,d]=itemSize(o),r=Math.hypot(w,d)*o.scale/2;return [[o.x-r,o.z-r],[o.x+r,o.z+r],...(isMobile(o)?routePoints(o):[]),...(o.curvePoints??[]).map(v=>{const q=curveWorld(o,v);return[q.x,q.z];})];});
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
 const rank=o=>SURFACES.includes(o.type)?(o.type==='crossing'?1:0):2;
 for(const o of p.objects.filter(o=>o.visible!==false).sort((a,b)=>rank(a)-rank(b))){
  const sel=o.id===selected&&!selClip,col=o.visible?o.color:'#69727a',q=screenPoint(o.x,o.z),sz=itemSize(o),w=sz[0]*Z*o.scale,d=sz[1]*Z*o.scale;
  g.save();g.translate(...q);g.rotate(actorYaw(o,0));g.globalAlpha=o.visible?1:.35;g.fillStyle=col;g.strokeStyle=sel?'#b6f36e':'#a0acb4';g.lineWidth=sel?3:1;
  if(o.curvePoints?.length>=2){const pts=sampleCurve(o.curvePoints);g.beginPath();for(const [i,v]of pts.entries()){const x=v.x*Z*o.scale,y=-v.z*Z*o.scale;i?g.lineTo(x,y):g.moveTo(x,y);}g.strokeStyle=col;g.lineWidth=w;g.lineJoin='round';g.lineCap='round';g.stroke();}
  else if(o.type==='crossing'){for(let xx=-w/2;xx<w/2;xx+=Z*o.scale)g.fillRect(xx,-d/2,.5*Z*o.scale,d);}
  else{g.fillRect(-w/2,-d/2,w,d);g.strokeRect(-w/2,-d/2,w,d);}
  if(o.type==='road'){line([0,-d/2],[0,d/2],'#e0dfbc',1,[2*Z,2*Z]);}
  if(o.type==='traffic'){g.fillStyle={red:'#ff4b4b',amber:'#ffca45',green:'#64ef97'}[trafficState(o,time)];g.beginPath();g.arc(0,0,7,0,Math.PI*2);g.fill();}
  // Forward arrow makes rotation visible even on square footprints.
  if(sel||isMobile(o)){g.fillStyle='#ffffff';g.beginPath();g.moveTo(0,-Math.max(7,d/2-3));g.lineTo(-4,-Math.max(7,d/2-3)+8);g.lineTo(4,-Math.max(7,d/2-3)+8);g.closePath();g.fill();}
  g.restore();g.fillStyle='#e4ecf1';g.font='14px sans-serif';g.textAlign='left';if(sel||rank(o)===2)g.fillText(o.name,q[0]+17,q[1]-15);
 }
 // Routes and handles are overlays so they remain selectable above large road pieces.
 for(const o of p.objects.filter(o=>o.visible!==false&&isMobile(o))){
  const sel=o.id===selected&&!selClip,pts=routePoints(o);for(let i=1;i<pts.length;i++)line(screenPoint(...pts[i-1]),screenPoint(...pts[i]),sel?'#b6f36e':'#68808d',sel?3:1,sel?[]:[6,4]);
  circle(o.endX,o.endZ,sel?12:4,sel?'#b6f36e':'#75828a',sel?'B':'');
  if(sel){circle(o.x,o.z,12,'#6ecbea','A');for(const [i,v] of (o.waypoints||[]).entries())circle(v.x,v.z,11,'#f3cc74',String(i+1));}
  const pos=actorPosition(o,time);circle(pos[0],pos[2],5,'#ffffff');const y=actorYaw(o,time);line(screenPoint(pos[0],pos[2]),screenPoint(pos[0]+Math.sin(y)*1.5,pos[2]+Math.cos(y)*1.5),'#ffffff',2);
 }
 const sel=currentObject();if(sel&&sel.visible!==false&&!selClip){const rp=rotationPoint(sel);line(screenPoint(sel.x,sel.z),screenPoint(...rp),'#f5ad66',2);circle(...rp,11,'#f5ad66','↻');}
 if(sel?.curvePoints)for(const [i,v]of sel.curvePoints.entries()){const q=curveWorld(sel,v);circle(q.x,q.z,11,'#6ecbea',String(i+1));}
 for(const b of p.terrain?.sculpt??[]){const q=screenPoint(b.x,b.z);g.beginPath();g.arc(q[0],q[1],b.radius*Z,0,Math.PI*2);g.strokeStyle=b.mode==='lower'?'#d99a8580':'#a5cc8180';g.lineWidth=1;g.stroke();}
 const cam=cameraAt(p,time),cp=screenPoint(cam.pos[0],cam.pos[2]),aim=screenPoint(cam.look[0],cam.look[2]);line(cp,aim,'#71cfff',2,[6,4]);circle(cam.pos[0],cam.pos[2],13,'#71cfff','C');circle(cam.look[0],cam.look[2],7,'#71cfff','');
 g.fillStyle='#c7d5df';g.font='15px sans-serif';g.textAlign='left';g.fillText('TOP VIEW  ·  X ↔  Z ↑  ·  grid '+step+' m',22,30);
 root.querySelector('.sc-hint').textContent=planTool.startsWith('sculpt-')?'Drag to '+planTool.slice(7)+' terrain · Escape finishes':planTool==='scatter'?'Click to scatter plants · Escape finishes':planTool==='curve'?'Click to add curve points · Escape finishes':placement?'Click to place '+ITEM_TYPES[placement]+' · Escape cancels':planTool==='route'?'Click to add turn points before B · Drag points after pressing Escape · Right-click a point to remove':planTool==='camera'?'Click to place the fixed camera':planTool==='aim'?'Click where the fixed camera should look':'Drag to move · Orange handle rotates (Shift: 15° steps) · Shift-drag A moves its route · Right-drag or middle-drag pans · Scroll zooms';
}
function planDown(e){
 if(e.button!==0&&e.button!==1&&e.button!==2)return;
 pause();const q=eventPoint(e);canvas.setPointerCapture(e.pointerId);
 if(e.button===2||e.button===1){e.preventDefault();planDrag={kind:'pan',sx:q.sx,sy:q.sy,x:planView.x,z:planView.z,moved:false};canvas.style.cursor='grabbing';return;}
 if(planTool.startsWith('sculpt-')){if((p.terrain?.sculpt?.length??0)>=160){alertStudio('Maximum 160 sculpt stamps. Clear sculpting to start again.');return;}checkpoint();sculptAt(q.x,q.z);planDrag={kind:'sculpt',x:q.x,z:q.z,changed:true};draw();return;}
 if(planTool==='scatter'){scatterAt(q.x,q.z);return;}
 if(planTool==='curve'){const o=currentObject();if(!o||!['path','river'].includes(o.type))return;if((o.curvePoints?.length??0)>=24)return;checkpoint();(o.curvePoints??=[]).push(curveLocal(o,q));sync();return;}
 if(placement){const type=placement;placement=e.shiftKey?type:null;const n=p.objects.length;addObject(type);if(p.objects.length===n)return;const o=currentObject();o.x=clamp(Math.round(q.x*2)/2,-100,150);o.z=clamp(Math.round(q.z*2)/2,-100,150);o.endX=o.x;o.endZ=isMobile(o)?Math.min(150,o.z+15):o.z;if(type==='human')o.clips=[makeClip('idle',0,p.duration,1)];sync();return;}
 if(planTool==='route'){const o=currentObject();if(!o||!isMobile(o)){planTool='select';draw();return;}if((o.waypoints||[]).length>=60){alertStudio('Maximum 60 route points.');return;}checkpoint();(o.waypoints||=[]).push({x:Math.round(q.x*2)/2,z:Math.round(q.z*2)/2});sync();return;}
 if(planTool==='camera'||planTool==='aim'){checkpoint();const c=activeCamSpec(),cam=cameraAt(p,time);c.move='static';c.mode='third';c.fixedX??=clamp(cam.pos[0],-100,150);c.fixedZ??=clamp(cam.pos[2],-100,150);c.aimX??=clamp(cam.look[0],-100,150);c.aimZ??=clamp(cam.look[2],-100,150);if(planTool==='camera'){c.fixedX=q.x;c.fixedZ=q.z;}else{c.aimX=q.x;c.aimZ=q.z;}planTool='select';sync();return;}
 const hit=(x,z,r=17)=>{const a=screenPoint(x,z);return Math.hypot(a[0]-q.sx,a[1]-q.sy)<r;},sel=currentObject();
 if(sel&&sel.visible!==false&&!selClip){const ci=(sel.curvePoints??[]).findIndex(v=>{const q=curveWorld(sel,v);return hit(q.x,q.z,13);});if(ci>=0){planDrag={kind:'curvepoint',o:sel,index:ci};return;}const rp=rotationPoint(sel);if(hit(...rp,14)){planDrag={kind:'rotate',o:sel,base:actorYaw(sel,0)-(sel.rotation??0)*Math.PI/180};return;}
 if(isMobile(sel)){const i=(sel.waypoints||[]).findIndex(v=>hit(v.x,v.z,13));if(i>=0){planDrag={kind:'waypoint',o:sel,index:i};return;}if(hit(sel.endX,sel.endZ,14)){planDrag={kind:'end',o:sel};return;}if(hit(sel.x,sel.z,14)){planDrag={kind:'object',o:sel,dx:q.x-sel.x,dz:q.z-sel.z};return;}}}
 const c=activeCamSpec();if(c.move==='static'&&Number.isFinite(c.fixedX)&&hit(c.fixedX,c.fixedZ)){planDrag={kind:'camera',o:c};return;}
 const rank=o=>SURFACES.includes(o.type)?0:1;
 const candidates=p.objects.filter(o=>o.visible!==false).reverse().sort((a,b)=>rank(b)-rank(a));
 const o=candidates.find(o=>{if(o.curvePoints?.length>=2)return hitSceneryCurve(o,q);const y=actorYaw(o,0),dx=q.x-o.x,dz=q.z-o.z,x=dx*Math.cos(y)-dz*Math.sin(y),z=dx*Math.sin(y)+dz*Math.cos(y),[w,d]=itemSize(o);return Math.abs(x)<=Math.max(w*o.scale/2,10/planView.zoom)&&Math.abs(z)<=Math.max(d*o.scale/2,10/planView.zoom);});
 if(o){selected=o.id;selClip=null;planDrag={kind:'object',o,dx:q.x-o.x,dz:q.z-o.z};refreshSide();}
}
function planMove(e){
 if(!planDrag)return;const q=eventPoint(e),d=planDrag;if(d.kind==='pan'){if(Math.hypot(q.sx-d.sx,q.sy-d.sy)>3)d.moved=true;if(d.moved){planView.x=d.x-(q.sx-d.sx)/planView.zoom;planView.z=d.z+(q.sy-d.sy)/planView.zoom;draw();}return;}
 if(d.kind==='sculpt'){if(Math.hypot(q.x-d.x,q.z-d.z)>builderTools.radius*.35){sculptAt(q.x,q.z);d.x=q.x;d.z=q.z;draw();}return;}
 if(!d.changed){checkpoint();d.changed=true;}const snapXY=v=>clamp(Math.round(v*2)/2,-100,150);
 if(d.kind==='rotate'){let angle=(Math.atan2(q.x-d.o.x,q.z-d.o.z)-d.base)*180/Math.PI;if(e.shiftKey)angle=Math.round(angle/15)*15;d.o.rotation=((angle+540)%360)-180;}
 else if(d.kind==='waypoint'){d.o.waypoints[d.index]={x:snapXY(q.x),z:snapXY(q.z)};}
 else if(d.kind==='curvepoint'){d.o.curvePoints[d.index]=curveLocal(d.o,q);}
 else if(d.kind==='end'){d.o.endX=snapXY(q.x);d.o.endZ=snapXY(q.z);}
 else if(d.kind==='camera'){d.o.fixedX=snapXY(q.x);d.o.fixedZ=snapXY(q.z);}
 else{const x=snapXY(q.x-d.dx),z=snapXY(q.z-d.dz),dx=x-d.o.x,dz=z-d.o.z;d.o.x=x;d.o.z=z;if(!isMobile(d.o)){d.o.endX=x;d.o.endZ=z;}else if(e.shiftKey){d.o.endX=clamp(d.o.endX+dx,-100,150);d.o.endZ=clamp(d.o.endZ+dz,-100,150);d.o.waypoints=(d.o.waypoints||[]).map(v=>({x:clamp(v.x+dx,-100,150),z:clamp(v.z+dz,-100,150)}));}}draw();
}
function removePlanWaypoint(e){const o=currentObject();if(!o)return;const q=eventPoint(e),i=(o.waypoints||[]).findIndex(v=>{const a=screenPoint(v.x,v.z);return Math.hypot(a[0]-q.sx,a[1]-q.sy)<15;});if(i>=0){checkpoint();o.waypoints.splice(i,1);sync();}}
canvas.oncontextmenu=e=>e.preventDefault();

fitPlan();
sync();

installTimelineControls({
 name:'scene',timeline:'#sceneStudio .sc-timeline',scroll:'#scTimelineScroll',zoom:'#scTimelineZoom',fixedWidth:215,containers:['#scTracks','#scLeft'],
 rows:'.sc-track-name[data-object],[data-item],[data-cam-item],[data-camera-track]',id:r=>r.dataset.object||r.dataset.item||r.dataset.camItem||(r.dataset.cameraTrack?'@scene-camera':null),
 item:id=>id==='@scene-camera'?{visible:p.cameraTrackVisible!==false}:p.objects.find(o=>o.id===id)||p.cameraClips.find(c=>c.id===id),
 enabled(id,action){if(id==='@scene-camera')return action==='visibility';const i=p.objects.findIndex(o=>o.id===id);return action==='up'?i>0:action==='down'?i>=0&&i<p.objects.length-1:true;},
 action(id,action){if(busy)return;pause();if(id==='@scene-camera'){checkpoint();p.cameraTrackVisible=p.cameraTrackVisible===false;sync();return;}const o=p.objects.find(o=>o.id===id);selected=o?id:null;selClip=o?null:id;
 if(action==='visibility'){checkpoint();const it=o||p.cameraClips.find(c=>c.id===id);it.visible=it.visible===false;sync();}
 else if(action==='up'||action==='down'){const i=p.objects.indexOf(o),j=i+(action==='up'?-1:1);if(i>=0&&j>=0&&j<p.objects.length){checkpoint();[p.objects[i],p.objects[j]]=[p.objects[j],p.objects[i]];sync();}}
 else actions[action]?.();
 }
});
