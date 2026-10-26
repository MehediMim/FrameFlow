import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { newMapProject, buildGeo, drawMap, installCountryDetail, makeView, lonToX, latToY, visibleDetailRegions, detailVisibility, detailRegions, regionAt } from '../map-engine.mjs';
import { trimMapHistory } from '../map-history.mjs';

const undo = ['a'.repeat(40), 'b'.repeat(40), 'c'.repeat(40)], redo = [];
trimMapHistory(undo, redo, 90);
assert.deepEqual(undo, ['b'.repeat(40), 'c'.repeat(40)], 'old image-heavy snapshots are released by size');
const large = ['x'.repeat(100)]; trimMapHistory(large, [], 10);
assert.equal(large.length, 1, 'retain one undo even for a large project');
const many = Array(100).fill('state'); trimMapHistory(many, []);
assert.equal(many.length, 80);

const source = readFileSync(new URL('../map-ui.js', import.meta.url), 'utf8');
const controls = new Map(); let draws = 0, updates = 0;
const context = vm.createContext({
  proj: { frames: 180, fps: 30 }, frame: 0, pick: null, pathDraw: null, previewCamera: null, playing: false,
  $: id => { if (!controls.has(id)) controls.set(id, { style: {} }); return controls.get(id); },
  clamp: (v,a,b) => Math.max(a,Math.min(b,v)), draw: () => draws++,
  current: () => ({ preset: 'keyframed' }), updateCameraInspector: () => updates++, updateCameraKeySelection() {},
  renderTimeline() { throw Error('Scrubbing must not rebuild the timeline'); },
  renderInspector() { throw Error('Scrubbing must preserve inspector controls'); },
  window: { dispatchEvent() {} }, CustomEvent: class {},
});
vm.runInContext(source.slice(source.indexOf('function setFrame('), source.indexOf('function pause(')), context);
vm.runInContext('for(let i=0;i<60;i++)setFrame(i)', context);
assert.equal(draws, 60); assert.equal(updates, 60);

const makeContext = () => {
  const calls = { fillRect: 0, drawImage: 0, stroke: 0, arc: 0 }, state = {};
  const methods = { createRadialGradient: () => ({ addColorStop() {} }), measureText: () => ({ width: 10 }) };
  const ctx = new Proxy(state, { get: (t,k) => k in t ? t[k] : methods[k] || ((...args) => { if (k in calls) calls[k]++; }), set: (t,k,v) => (t[k]=v,true) });
  return { ctx, calls };
};
const topo = { transform: { scale:[1,1],translate:[0,0] }, arcs: [[[0,0],[10,0],[0,10],[-10,0],[0,-10]]], objects:{countries:{geometries:[{type:'Polygon',properties:{name:'Test'},arcs:[[0]]}]}} };
const geo = buildGeo(topo), project = newMapProject(); project.graticule = false;
const original = globalThis.OffscreenCanvas, surfaces = [];
globalThis.OffscreenCanvas = class { constructor(width,height) { this.width=width;this.height=height;this.drawing=makeContext();surfaces.push(this); } getContext() { return this.drawing.ctx; } };
try {
  const {ctx,calls}=makeContext(), render = (f=0) => drawMap(ctx,640,360,project,f,geo,null,{cacheBase:true});
  render(); assert.equal(surfaces.length,0,'moving camera draws directly without an extra buffer');
  render(1); assert.equal(surfaces.length,1,'stable view creates one bounded cache');
  const fills=surfaces[0].drawing.calls.fillRect;
  render(2); assert.equal(surfaces[0].drawing.calls.fillRect,fills,'static map geometry is reused across frames');
  assert.equal(calls.drawImage,2);
  project.camera.init.zoom += 1; render(3);
  assert.equal(calls.drawImage,2,'new camera view cannot reuse stale pixels');
  render(4); assert.equal(surfaces.length,1,'reuse the same buffer when the camera stops');
  assert.ok(surfaces[0].drawing.calls.fillRect>fills);
  geo.detailRevision=1;render(5);assert.equal(calls.drawImage,3,'new country detail invalidates the cache');
  const normal=makeContext();drawMap(normal.ctx,640,360,project,6,geo);
  assert.equal(normal.calls.drawImage,0,'export and default rendering bypass preview cache');
} finally { if(original===undefined)delete globalThis.OffscreenCanvas;else globalThis.OffscreenCanvas=original; }
console.log('Map redraw, preview cache and bounded history passed');

const load = file => JSON.parse(readFileSync(new URL('../map-data/' + file, import.meta.url), 'utf8'));
const world = buildGeo(load('countries-50m.json'), load('countries-110m.json'));
for (const country of ['india', 'pakistan']) installCountryDetail(world, load(country + '-detail.json'));
const multi = newMapProject();
multi.area = {...multi.area, mode: 'world', detailCountries: ['India', 'Pakistan'], detailLevels: {India: 'division', Pakistan: 'division'}};
const view = (zoom, W = 1280, H = 720, lon = 77, lat = 25) => makeView({cx: lonToX(lon), cy: latToY(lat), zoom, pitch: 0, bearing: 0}, W, H);
assert.equal(visibleDetailRegions(multi, world, view(0)).length, 0, 'wide views skip regional geometry');
const close = visibleDetailRegions(multi, world, view(4));
assert.ok(close.length > 0, 'zooming in reveals regional geometry');
assert.ok(close.length < detailRegions(multi, world).length, 'off-screen regions are culled');
assert.equal(visibleDetailRegions(multi, world, view(4,1280,720,-100)).length, 0, 'distant countries skip all regional drawing');
assert.deepEqual(visibleDetailRegions(multi, world, view(4,2560,1440)).map(x=>[x.region.key,x.off,x.alpha]), close.map(x=>[x.region.key,x.off,x.alpha]), 'export resolution preserves detail visibility');
const india = world.details.get('India').country;
const ib = india.mainBox, fadeZoom = Math.log2(160 / (Math.max(ib[2]-ib[0],ib[3]-ib[1]) * view(0).S));
const fade = detailVisibility(view(fadeZoom), india);
assert.ok(fade > 0 && fade < 1, 'detail fades between zoom thresholds');
assert.equal(detailRegions(multi, world).length, 43, 'all selected regions remain available');
assert.ok(regionAt(multi, world, 73, 31), 'picking still resolves regional geometry');
for (const zoom of [0,4]) {
  const draw = enabled => { const c=makeContext(); const p={...multi,area:{...multi.area,detailCountries:enabled?['India','Pakistan']:[]}}; drawMap(c.ctx,1280,720,p,0,world,view(zoom).cam);return c.calls; };
  const detailed=draw(true),plain=draw(false);
  if (!zoom) { assert.equal(detailed.stroke,plain.stroke,'wide rendering does no extra regional strokes'); assert.equal(detailed.arc,plain.arc,'wide rendering does no extra city dots'); }
  else assert.ok(detailed.stroke > plain.stroke,'close rendering draws regional boundaries');
}
console.log('Multi-country zoom detail, culling, picking and export parity passed');

const button = {setAttribute(){},removeAttribute(){}};
let finishLoading, started = 0;
const playback = vm.createContext({
  geo:{details:new Map()}, exporting:false, playing:false, proj:{frames:90,fps:30}, frame:0,
  wantedCountries:()=>['India'], ensureDetail:()=>new Promise(resolve=>{finishLoading=resolve;}),
  $:()=>button, updatePlayControl(){}, cancelAnimationFrame(){},
  requestAnimationFrame(){started++;return 1;}, performance:{now:()=>0},
  window:{dispatchEvent(){}}, CustomEvent:class{}, raf:0, startTime:0, startFrame:0,
});
vm.runInContext(source.slice(source.indexOf('let playbackRequest ='),source.indexOf('// ------------------------------------------------------------------ left panel')),playback);
const loading=vm.runInContext('play()',playback);
assert.equal(started,0,'playback waits for required detail');
finishLoading(true); await loading;
assert.equal(started,1,'playback starts after detail loads');
vm.runInContext('pause()',playback);
const cancelled=vm.runInContext('play()',playback);
vm.runInContext('pause()',playback); finishLoading(true); await cancelled;
assert.equal(started,1,'cancelled loading cannot restart playback');
const failed=vm.runInContext('play()',playback); finishLoading(false); await failed;
assert.equal(started,1,'failed detail load prevents incomplete playback');
console.log('Playback detail preload, cancellation and failure handling passed');
