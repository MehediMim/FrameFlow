import assert from 'node:assert/strict';
import * as Map from '../map-engine.mjs';
import * as Paper from '../paper-engine.mjs';
import * as Scene from '../scene-engine.mjs';
import * as Motion from '../motion-camera.mjs';

const map = Map.newMapProject();
const mapStart = Map.cameraAt(map, {}, 640, 360, 30);
map.shots = [Map.makeShot('pushIn', 0, { visible: false })];
assert.deepEqual(Map.cameraAt(map, {}, 640, 360, 30), mapStart);
map.shots[0].visible = true;
assert.notDeepEqual(Map.cameraAt(map, {}, 640, 360, 30), mapStart);

const paper = Paper.newPaperProject();
paper.parts = [Paper.makePart('headline', 0, { visible: false })];
paper.shots = [Paper.makeShot('pan', 0, { visible: false, dx: 100 })];
paper.paper.visible = false;
const reopened = Paper.validatePaperProject(JSON.parse(JSON.stringify(paper)));
assert.equal(reopened.parts[0].visible, false);
assert.equal(reopened.shots[0].visible, false);
assert.equal(reopened.paper.visible, false);
assert.deepEqual(Paper.cameraAt(reopened, 20), Paper.cameraAt({ ...reopened, shots: [] }, 20));

const scene = Scene.defaultScene();
scene.cameraClips = [Scene.makeCameraClip('first', 0, 4)];
const sceneStart = Scene.cameraAt({ ...scene, cameraClips: [] }, 2);
assert.notDeepEqual(Scene.cameraAt(scene, 2), sceneStart);
scene.cameraClips[0].visible = false;
assert.deepEqual(Scene.cameraAt(scene, 2), sceneStart);
scene.cameraClips[0].visible = true; scene.cameraTrackVisible = false;
assert.deepEqual(Scene.cameraAt(scene, 2), sceneStart);
assert.deepEqual(Scene.resolveClips([{ start: 0, dur: 1, visible: false }]), []);

const motion = { fps: 30, frames: 180, width: 1280, height: 720, layers: [], cameraShots: [] };
const motionStart = Motion.cameraAt(motion, 30);
motion.cameraShots = [Motion.makeCameraShot(motion, 'push', 0)];
assert.notDeepEqual(Motion.cameraAt(motion, 30), motionStart);
motion.cameraShots[0].visible = false;
assert.deepEqual(Motion.cameraAt(motion, 30), motionStart);
console.log('Layer and camera visibility passed');
