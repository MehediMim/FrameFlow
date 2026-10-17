import assert from 'node:assert/strict';
import { applyMotionPath, motionPathSamples, validateMotionPath } from '../motion-path.mjs';
import { videoTimeAt, validateMotionVideo } from '../motion-video.mjs';
import { valueAt, validateProject } from '../engine.mjs';

const path = { points: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 300 }], curve: 'straight', start: 30, dur: 120 };
const layer = { id: 'video', name: 'Video', type: 'video', x: 0, y: 0, w: 320, h: 180, scale: 1, rotation: 0, opacity: 1, blur: 0, in: 30, out: 150, keys: {},
  src: 'data:video/webm;base64,AAAA', videoDuration: 10, videoOffset: 2, videoMuted: false, motionPath: structuredClone(path) };
applyMotionPath(layer);
assert.equal(valueAt(layer, 'x', 0), 0);
assert.equal(valueAt(layer, 'x', 60), 100, 'waypoint timing follows travelled distance');
assert.equal(valueAt(layer, 'y', 90), 100);
assert.equal(valueAt(layer, 'y', 300), 300, 'path holds its final position');
layer.motionPath.curve = 'smooth'; applyMotionPath(layer);
const smooth = motionPathSamples(layer.motionPath);
assert.deepEqual(smooth[0], path.points[0]); assert.deepEqual(smooth.at(-1), path.points.at(-1));
assert.ok(smooth.some(p => p.y < 0), 'a smooth curve bends around the corner');
assert.ok(layer.keys.x.every((k, i, a) => Number.isSafeInteger(k.f) && (!i || k.f > a[i - 1].f)), 'sampled keyframes have unique integer frames');
const project = { version: 1, name: 'Media', width: 1280, height: 720, fps: 30, frames: 300, bg: '#000000', layers: [layer] };
assert.deepEqual(validateProject(JSON.parse(JSON.stringify(project))).layers[0], layer, 'video, sound setting and path survive project round trips');
assert.equal(videoTimeAt(layer, 30, 30), 2);
assert.equal(videoTimeAt(layer, 60, 30), 3);
assert.equal(videoTimeAt(layer, 1000, 30), 9.999, 'the last video frame holds beyond its source duration');
assert.equal(videoTimeAt(layer, 0, 30), 2);
for (const invalid of [{ ...layer, src: 'https://example.com/video.mp4' }, { ...layer, videoOffset: -1 }, { ...layer, videoMuted: 'false' }, { ...layer, videoDuration: Infinity }]) assert.throws(() => validateMotionVideo(invalid));
for (const invalid of [{ ...path, dur: 0 }, { ...path, start: .5 }, { ...path, points: [{ x: NaN, y: 0 }] }, { ...path, points: new Array(121).fill({ x: 0, y: 0 }) }]) assert.throws(() => validateMotionPath(invalid));
const tiny = { keys: {}, motionPath: { ...path, dur: 1 } }; applyMotionPath(tiny);
assert.deepEqual(tiny.keys.x.map(k => k.f), [30, 31]);
console.log('Motion video timing, movement path and project validation tests passed');
