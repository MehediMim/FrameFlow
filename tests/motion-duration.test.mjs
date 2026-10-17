// Run with: node tests/motion-duration.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { validateProject, valueAt, poseAt } from '../engine.mjs';

const project = (fps = 30, seconds = 86400) => ({
  version: 1, name: 'Long motion', width: 1280, height: 720, fps, frames: fps * seconds, bg: '#ffffff',
  layers: [{ id: 'rect', type: 'rect', name: 'Rectangle', x: 0, y: 0, w: 120, h: 80, scale: 1,
    rotation: 0, opacity: 1, blur: 0, in: 0, out: fps * seconds - 1, keys: {}, fxClips: [] }],
});

for (const fps of [24, 30, 60]) {
  const p = project(fps), l = p.layers[0], start = fps * 3600, dur = fps * 1800;
  l.in = start;
  l.keys.x = [{ f: start, v: 0, e: 'linear' }, { f: start + dur, v: 100, e: 'linear' }];
  l.fxClips = [{ id: 'late-fade', kind: 'in', name: 'fade', start, dur, endBehavior: 'hold' }];
  const reopened = validateProject(JSON.parse(JSON.stringify(p)));
  assert.equal(reopened.frames, fps * 86400, 'a day-long composition survives saving and reopening');
  assert.equal(valueAt(reopened.layers[0], 'x', start + dur / 2), 50, 'late keyframes preserve their timing');
  assert.equal(poseAt(reopened.layers[0], start).opacity, 0, 'late entrance starts at its own frame');
  assert.equal(poseAt(reopened.layers[0], start + dur).opacity, 1, 'long entrance completes at its own endpoint');
}

for (const frames of [1, -1, 1.5, Infinity, NaN, '5000', Number.MAX_SAFE_INTEGER + 1]) {
  const p = project(); p.frames = frames;
  assert.throws(() => validateProject(p), /frame settings/i);
}

// Run the actual Motion settings handler with lightweight editor callbacks.
const source = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const functions = ['changeMotionDuration', 'motionTimelineStep'].map(name => {
  const match = source.match(new RegExp(`function ${name}\\([^]*?\\n\\}`));
  assert.ok(match, `${name} is present`);
  return match[0];
}).join('\n');

for (const fps of [24, 30, 60]) {
  const p = project(fps, 6), originalEnd = p.frames - 1;
  p.layers.push({ ...p.layers[0], id: 'trimmed', out: fps * 2 });
  const ctx = { project: p, frame: 0, calls: 0, pause() {}, checkpoint() {}, changed() { this.calls++; },
    notify() {}, renderUI() {} };
  // Callbacks do not depend on their receiver in the editor.
  ctx.changed = () => { ctx.calls++; };
  vm.createContext(ctx); vm.runInContext(functions, ctx);
  ctx.changeMotionDuration(86400);
  assert.equal(p.frames, fps * 86400, 'duration input accepts a full day at every frame rate');
  assert.equal(p.layers[0].out, p.frames - 1, 'layers ending at the composition end extend with it');
  assert.equal(p.layers[1].out, fps * 2, 'explicitly trimmed layers retain their out time');
  assert.notEqual(p.layers[0].out, originalEnd);
  const calls = ctx.calls, snapshot = JSON.stringify(p);
  for (const invalid of [NaN, Infinity, -1, 0, Number.MAX_SAFE_INTEGER]) ctx.changeMotionDuration(invalid);
  assert.equal(JSON.stringify(p), snapshot, 'invalid settings do not corrupt the project');
  assert.equal(ctx.calls, calls, 'invalid settings do not create an edit');
  ctx.frame = p.frames - 1;
  ctx.changeMotionDuration(120);
  assert.equal(p.frames, fps * 120, 'duration can be shortened to a value beyond the old cap');
  assert.equal(ctx.frame, p.frames - 1, 'playhead stays inside the chosen duration');
  assert.doesNotThrow(() => validateProject(JSON.parse(JSON.stringify(p))));
  for (const seconds of [120, 3600, 86400, 1e9]) for (const zoom of [1, 2, 4]) {
    const step = ctx.motionTimelineStep(seconds, zoom);
    assert.ok(step > 0 && Number.isFinite(step));
    assert.ok(Math.ceil(seconds / step) <= 12 * zoom, 'long timelines render a bounded number of ruler labels');
  }
}

console.log('motion duration tests passed');
