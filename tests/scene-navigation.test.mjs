import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../scene-studio.mjs', import.meta.url), 'utf8');
const handlers = source.slice(source.indexOf('canvas.onpointerdown ='), source.indexOf('canvas.onwheel ='));
const plan = source.slice(source.indexOf('function planDown(e)'), source.indexOf('\nfitPlan();'));
function editor() {
  let checkpoints = 0, placements = 0;
  const camera = { yaw: 0, height: 5 }, object = { x: 0, z: 0, endX: 0, endZ: 0, scale: 1, waypoints: [{ x: 10, z: 10 }] };
  const s = vm.createContext({
    canvas: { style: {}, setPointerCapture() {} }, busy: false, viewMode: '2d', orbit: null,
    planDrag: null, planView: { x: 0, z: 0, zoom: 10 }, placement: null, planTool: 'select', selClip: null,
    p: { objects: [], duration: 10 }, selected: null, currentObject: () => object,
    eventPoint: e => ({ sx: e.clientX, sy: e.clientY, x: s.planView.x + e.clientX / 10, z: s.planView.z - e.clientY / 10 }),
    screenPoint: (x, z) => [(x - s.planView.x) * 10, (s.planView.z - z) * 10],
    activeCamSpec: () => camera, rotationPoint: () => [1000, 1000], actorYaw: () => 0, itemSize: () => [1, 1],
    isMobile: o => !!o, checkpoint: () => { checkpoints++; }, addObject: () => { placements++; },
    pause() {}, draw() {}, sync() {}, refreshSide() {}, clamp: (v, lo, hi) => Math.max(lo, Math.min(hi, v)),
  });
  vm.runInContext(handlers + plan, s);
  return { s, object, camera, get checkpoints() { return checkpoints; }, get placements() { return placements; } };
}
const event = (button, x = 100, y = -100, type = 'pointerup') => ({ button, clientX: x, clientY: y, pointerId: 1, type, preventDefault() {} });
for (const button of [1, 2]) {
  const e = editor(), { s, object } = e;
  s.placement = 'tree'; s.planTool = 'route';
  s.canvas.onpointerdown(event(button));
  s.canvas.onpointermove(event(button, 150, -70));
  assert.equal(s.planView.x, -5); assert.equal(s.planView.z, 3);
  s.canvas.onpointerup(event(button, 150, -70));
  assert.equal(e.placements, 0); assert.equal(e.checkpoints, 0);
  assert.equal(s.placement, 'tree'); assert.equal(s.planTool, 'route');
  assert.equal(object.waypoints.length, 1, 'dragging must not remove a waypoint');
  assert.equal(s.canvas.style.cursor, ''); assert.equal(s.planDrag, null);
}
{
  const e = editor(), { s } = e;
  s.canvas.onpointerdown(event(0, 500, 500)); s.canvas.onpointermove(event(0, 600, 600));
  assert.equal(s.planView.x, 0); assert.equal(s.planView.z, 0, 'empty left-drag must not pan');
  s.canvas.onpointerdown(event(2)); s.canvas.onpointerup(event(2));
  assert.equal(e.object.waypoints.length, 0, 'a right-click still removes a waypoint');
}
{
  const e = editor(), { s } = e;
  s.canvas.onpointerdown(event(2)); s.canvas.onpointercancel(event(2, 100, -100, 'pointercancel'));
  assert.equal(e.object.waypoints.length, 1, 'canceling must not remove a waypoint');
  s.viewMode = '3d';
  s.canvas.onpointerdown(event(0)); assert.equal(s.orbit, null, 'left button must not orbit');
  s.canvas.onpointerdown(event(2)); s.canvas.onpointermove(event(2, 120, -80));
  assert.equal(e.camera.yaw, 6); assert.equal(e.camera.height, 5.8);
  s.canvas.onpointerup(event(2)); assert.equal(s.orbit, null);
}
console.log('Scene mouse navigation tests passed');
