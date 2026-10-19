import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { newMapProject, buildGeo, drawMap } from '../map-engine.mjs';
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
  const calls = { fillRect: 0, drawImage: 0 }, state = {};
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
