import assert from 'node:assert/strict';
import { ITEM_TYPES, BODIES, makeObject, defaultScene, validateScene, renderScene, humanLook, defaultLook, cameraAt } from '../scene-engine.mjs';
import { SCENE_PRESETS, buildScenePreset } from '../scene-presets.mjs';
import { SCENERY, ENVIRONMENTS } from '../scene-catalog.mjs';

const context=Object.fromEntries(['fillRect','beginPath','moveTo','lineTo','closePath','fill','stroke'].map(key=>[key,()=>{}]));
const canvas={width:960,height:540,getContext:()=>context};
assert.ok(Object.keys(ITEM_TYPES).length>=40);
for(const id of Object.keys(SCENE_PRESETS)) {
  const p=buildScenePreset(id);
  assert.deepEqual(validateScene(JSON.parse(JSON.stringify(p))),p,`${id} saves and reopens`);
  const camera=cameraAt(p,0);
  assert.ok(camera.pos.every(Number.isFinite));
  // Node verifies geometry; real Canvas material mapping is exercised in the browser.
  p.texturePack='none';
  for(const t of [0,4,15])assert.ok(renderScene(canvas,p,t).faces>50,`${id} renders at ${t}s`);
}
const p=buildScenePreset('cast');
assert.deepEqual(p.objects.filter(o=>o.type==='human').map(o=>humanLook(o).body),Object.keys(BODIES));
assert.ok(BODIES.man.head<1.3,'adult head has balanced proportions');
for(const [id,spec] of Object.entries(SCENERY)) {
  const p=defaultScene();Object.assign(p,{baseRoad:false,left:'none',right:'none',objects:[],cameraClips:[]});
  Object.assign(p.camera,{mode:'third',move:'static',fixedX:12,fixedZ:-18,aimX:0,aimZ:0,height:9});
  const empty=renderScene(canvas,p,0).faces;
  const o=makeObject(id);o.z=o.endZ=0;p.objects=[o];validateScene(p);
  assert.ok(renderScene(canvas,p,0).faces>empty,`${id} has visible geometry`);
  o.width=spec[2]*1.4;o.length=spec[3]*1.3;o.rotation=45;validateScene(p);
  assert.ok(renderScene(canvas,p,2).faces>empty,`${id} supports resize and rotation`);
  o.visible=false;assert.equal(renderScene(canvas,p,0).faces,empty,`${id} hides`);
}
for(const env of Object.values(ENVIRONMENTS))validateScene(Object.assign(defaultScene(),env));
for(const look of [{body:'invalid'},{glasses:'true'},{expression:'broken'}]) {
  const p=defaultScene();p.objects[0].look={...defaultLook(),...look};assert.throws(()=>validateScene(p),/character/);
}
for(const change of [p=>p.ambient=2,p=>p.ground='red',p=>p.sunAngle=Infinity,p=>p.objects[0].accentColor='red',p=>p.objects[0].roof='bad']) {
  const p=defaultScene();change(p);assert.throws(()=>validateScene(p),/Invalid/);
}
console.log('Scene builder: all presets, scenery models, character types, persistence and validation passed');
