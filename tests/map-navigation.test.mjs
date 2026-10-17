import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { makeView, screenToLonLat, lonToX, latToY } from '../map-engine.mjs';
import { panMapCamera, zoomMapCamera } from '../map-navigation.mjs';

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} should equal ${b}`);
for (const [pitch, bearing, lon] of [[0, 0, 90], [55, 35, 90], [20, -40, 179.5]]) {
  const cam = { cx: lonToX(lon), cy: latToY(24), zoom: 4, pitch, bearing };
  const original = { ...cam }, view = makeView(cam, 1280, 720);
  const from = { sx: 700, sy: 380 }, to = { sx: 520, sy: 450 };
  const anchor = screenToLonLat(view, from.sx, from.sy);
  const panned = panMapCamera(view, from, to);
  const moved = screenToLonLat(makeView(panned, 1280, 720), to.sx, to.sy);
  close(anchor.lat, moved.lat); close(anchor.lon, moved.lon);
  const zoomed = zoomMapCamera(view, from, 1.2);
  const fixed = screenToLonLat(makeView(zoomed, 1280, 720), from.sx, from.sy);
  close(anchor.lat, fixed.lat); close(anchor.lon, fixed.lon);
  assert.deepEqual(cam, original, 'navigation must preserve the animation camera');
  assert.equal(zoomMapCamera(view, from, 100).zoom, 12);
  assert.equal(zoomMapCamera(view, from, -100).zoom, 0);
}
const tilted = makeView({ cx: .5, cy: .5, zoom: 4, pitch: 75, bearing: 0 }, 1280, 720);
assert.equal(panMapCamera(tilted, { sx: 640, sy: 360 }, { sx: 640, sy: -10000 }), null);
assert.ok(Number.isFinite(zoomMapCamera(tilted, { sx: 640, sy: -10000 }, 1).cx));

// Exercise the actual editor handlers: navigating must never add path points.
const source = await readFile(new URL('../map-ui.js', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('function canvasXY('), source.indexOf('// ------------------------------------------------------------------ project settings'));
const listeners = {}, capture = new Set(), reset = { hidden: true };
const action = { id: 'route', path: [] };
const canvas = {
  style: {}, clientHeight: 360,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 640, height: 360 }),
  addEventListener: (type, fn) => { listeners[type] = fn; },
  setPointerCapture: id => capture.add(id), hasPointerCapture: id => capture.has(id),
  releasePointerCapture: id => capture.delete(id),
};
let draws = 0, checkpoints = 0;
const state = vm.createContext({
  canvas, $: () => reset, panMapCamera, zoomMapCamera, screenToLonLat,
  proj: { width: 1280, height: 720, actions: [action] },
  lastView: makeView({ cx: lonToX(90), cy: latToY(24), zoom: 4, pitch: 35, bearing: 20 }, 1280, 720),
  geo: {}, exporting: false, pathDraw: { id: 'route' }, pathDrag: null, mapPan: null, previewCamera: null, pick: null,
  clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  pathHandles: () => [], pause() {}, notify() {}, syncPathEnds() {}, renderInspector() {}, updateHistory() {},
  checkpoint: () => { checkpoints++; },
  draw: () => { draws++; if (state.previewCamera) state.lastView = makeView(state.previewCamera, 1280, 720); },
  changed: () => state.draw(),
});
vm.runInContext(handlers, state);
let prevented = 0;
const event = (button, clientX, clientY) => ({ button, clientX, clientY, pointerId: 1, preventDefault: () => { prevented++; } });
for (const button of [1, 2]) {
  canvas.onpointerdown(event(button, 320, 180));
  assert.equal(canvas.style.cursor, 'grabbing');
  canvas.onpointermove(event(button, 380, 205));
  canvas.onpointerup(event(button, 380, 205));
  assert.equal(canvas.style.cursor, 'crosshair');
  assert.equal(capture.size, 0);
  assert.equal(action.path.length, 0);
}
listeners.wheel({ ...event(0, 300, 190), deltaY: -100, deltaMode: 0 });
assert.equal(action.path.length, 0);
assert.equal(checkpoints, 0, 'navigation does not enter project undo history');
const expected = screenToLonLat(state.lastView, 600, 380);
canvas.onpointerdown(event(0, 300, 190));
assert.equal(action.path.length, 1);
close(action.path[0].lat, +expected.lat.toFixed(4));
close(action.path[0].lon, +expected.lon.toFixed(4));
assert.equal(checkpoints, 1);
reset.onclick();
assert.equal(state.previewCamera, null);
assert.ok(draws >= 4 && prevented >= 3);
console.log('Map mouse navigation tests passed');
