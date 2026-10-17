// Run with: node tests/scene-duration.test.mjs
import assert from 'node:assert/strict';
import { activeClip, actorPosition, cameraAt, defaultScene, makeCameraClip, makeClip, makeObject, renderScene, sceneFrameCount, trafficState, validateScene } from '../scene-engine.mjs';

function longScene(fps) {
  const p = defaultScene();
  Object.assign(p, { fps, duration: 90_000 });
  const human = p.objects[0], car = p.objects[1];
  Object.assign(human, { start: 7_200, duration: 28_800, clips: [makeClip('walk', 7_200, 14_400)] });
  Object.assign(car, { start: 3_600, duration: 7_200 });
  const light = Object.assign(makeObject('traffic'), { duration: p.duration, redTime: 900, greenTime: 600, amberTime: 300, phase: 3_600 });
  p.objects.push(light);
  p.cameraClips = [{ ...makeCameraClip('bird', 10_800, 14_400, car.id), blend: 600 }];
  return p;
}

for (const fps of [24, 30, 60]) {
  const p = longScene(fps);
  assert.equal(validateScene(p), p, `accepts a 25-hour scene at ${fps} fps`);
  assert.equal(sceneFrameCount(p), 90_000 * fps);
  const saved = JSON.stringify(p);
  assert.deepEqual(validateScene(JSON.parse(saved)), p, 'long timings survive saving and opening');

  const [human, car, light] = p.objects;
  assert.equal(activeClip(human.clips, 7_199), null, 'late gesture is absent before its start');
  assert.equal(activeClip(human.clips, 7_201)?.gesture, 'walk');
  assert.equal(activeClip(human.clips, 21_600), null, 'long gesture ends at its selected time');
  assert.deepEqual(actorPosition(car, 3_599), [car.x, 0, car.z]);
  assert.deepEqual(actorPosition(car, 7_200), [car.x, 0, (car.z + car.endZ) / 2], 'travel progresses beyond an hour');
  assert.deepEqual(actorPosition(car, 10_800), [car.endX, 0, car.endZ]);
  assert.equal(cameraAt(p, 11_401).pos[1], 30, 'late camera shot is active after its long blend');
  assert.equal(trafficState(light, 901), 'green', 'long traffic cycles retain their timing');

  p.duration = 12;
  validateScene(p);
  const shortened = JSON.parse(JSON.stringify(p));
  assert.equal(shortened.objects[0].start, 7_200, 'shortening a project preserves later objects');
  assert.equal(shortened.objects[0].clips[0].dur, 14_400, 'shortening preserves long gesture clips');
  assert.equal(shortened.cameraClips[0].start, 10_800, 'shortening preserves later camera shots');
  shortened.duration = 90_000;
  assert.deepEqual(validateScene(shortened), JSON.parse(saved), 'extending a project restores its original timeline');

  const partial = { duration: 3_600.01, fps }, frames = sceneFrameCount(partial);
  assert.equal(frames, 3_600 * fps + 1, 'exports include the final partial frame');
  assert.ok((frames - 1) / fps < partial.duration, 'last preview frame falls within duration');
  assert.ok(frames / fps >= partial.duration, 'next frame is outside duration');
}

// The object renderer also respects late start and end times after the old caps.
{
  const p = defaultScene();
  Object.assign(p, { duration: 7_200, baseRoad: false, left: 'none', right: 'none', cameraClips: [] });
  Object.assign(p.camera, { mode: 'third', move: 'static', fixedX: 0, fixedZ: -15, aimX: 0, aimZ: 8, height: 10 });
  p.objects = [Object.assign(makeObject('building'), { start: 3_600, duration: 900, x: 0, z: 8 })];
  validateScene(p);
  const context = Object.fromEntries(['fillRect', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke'].map(name => [name, () => {}]));
  const canvas = { width: 640, height: 360, getContext: () => context };
  const before = renderScene(canvas, p, 3_599).faces;
  assert.ok(renderScene(canvas, p, 3_601).faces > before, 'late object appears when its timeline begins');
  assert.equal(renderScene(canvas, p, 4_501).faces, before, 'late object disappears when its timeline ends');
}

// Reject malformed timing and machine-unsafe frame indexes, with no arbitrary time limit.
for (const value of [NaN, Infinity, -Infinity, -1, '3600', null, Number.MAX_VALUE, Number.MAX_SAFE_INTEGER]) {
  const timingFields = [
    p => { p.duration = value; },
    p => { p.objects[0].start = value; },
    p => { p.objects[0].duration = value; },
    p => { p.objects[0].clips[0].start = value; },
    p => { p.objects[0].clips[0].dur = value; },
    p => { p.cameraClips[0].start = value; },
    p => { p.cameraClips[0].dur = value; },
  ];
  for (const change of timingFields) {
    const p = defaultScene(); change(p);
    assert.throws(() => validateScene(p), /invalid/i, `rejects invalid timing ${String(value)}`);
  }
}
for (const change of [
  p => { p.duration = .99; },
  p => { p.objects[0].duration = .09; },
  p => { p.objects[0].clips[0].dur = 0; },
  p => { p.cameraClips[0].dur = 0; },
  p => { p.cameraClips[0].blend = Infinity; },
  p => { p.cameraClips[0].blend = -1; },
  p => { const t = Number.MAX_SAFE_INTEGER / p.fps * .75; Object.assign(p.objects[0], { start: t, duration: t }); },
  p => { const t = Number.MAX_SAFE_INTEGER / p.fps * .75; Object.assign(p.cameraClips[0], { start: t, dur: t }); },
]) {
  const p = defaultScene(); change(p);
  assert.throws(() => validateScene(p), /invalid/i, 'rejects zero durations and unsafe clip endpoints');
}
assert.throws(() => sceneFrameCount({ duration: Infinity, fps: 30 }), /invalid/i);

// Version 1 migration accepts long scenes and converts late clips without changing timing.
{
  const p = defaultScene();
  Object.assign(p, { version: 1, duration: 7_200 });
  Object.assign(p.objects[0], { start: 3_600, duration: 1_800, gesture: 'walk' });
  const q = validateScene(p);
  assert.equal(q.objects[0].clips[0].start, 3_600);
  assert.equal(q.objects[0].clips[0].dur, 1_800);
}

console.log('scene duration tests passed');
