import assert from 'node:assert/strict';
import { newMapProject, makeShot, makeAction, PRESETS, sampleCameraPreset, cameraAt, validateMapProject, xToLon, yToLat } from '../map-engine.mjs';
import { syncCameraTimeline, addCameraPair, putCameraKey, removeCameraKey, moveCameraKey, cameraPoseAt } from '../map-camera.mjs';
const p=newMapProject(),track=syncCameraTimeline(p,pose=>makeShot('keyframed',0,{cameraFrom:pose,cameraTo:pose,cameraKeys:[]}));
const start={lon:0,lat:20,zoom:3,pitch:0,bearing:0},end={...start,zoom:6};
const manual=putCameraKey(track,0,start);
const pair=addCameraPair(track,'pushIn',0,60,[{t:0,values:start},{t:1,values:end}]);
putCameraKey(track,30,{zoom:5});
assert.equal(track.cameraKeys.length,4,'manual and paired keys can coexist, including the same frame');
const sameFrame=structuredClone(p);removeCameraKey(sameFrame.shots[0],0,undefined,manual.id);assert.equal(sameFrame.shots[0].cameraKeys.filter(k=>k.pairId).length,2,'a normal key at a shared frame deletes independently');
removeCameraKey(track,60,undefined,pair[1].id);
assert.equal(track.cameraKeys.length,2);assert.ok(track.cameraKeys.every(k=>!k.pairId),'removing either endpoint removes the complete pair');
assert.ok(track.cameraKeys.some(k=>k.id===manual.id),'deleting a pair preserves independent manual keys');
removeCameraKey(track,30);assert.equal(track.cameraKeys.length,1,'manual deletion removes only that key');
const next=addCameraPair(track,'pushIn',20,80,[{t:0,values:start},{t:1,values:end}]);
moveCameraKey(track,80,100,undefined,next[1].id);
assert.equal(track.cameraKeys.find(k=>k.id===next[1].id).frame,100);assert.equal(track.cameraKeys.find(k=>k.id===next[0].id).frame,20);
syncCameraTimeline(p);assert.equal(track.cameraKeys.filter(k=>k.pairId).length,2,'normalizing the track preserves pairs and sample curves');
validateMapProject(JSON.parse(JSON.stringify(p)));
const bad=structuredClone(p);bad.shots[0].cameraKeys=bad.shots[0].cameraKeys.filter(k=>k.id!==next[0].id);assert.throws(()=>validateMapProject(bad),/pair/i,'orphan endpoints are rejected');
removeCameraKey(track,20,undefined,next[0].id);assert.equal(track.cameraKeys.length,1,'start deletion also removes both endpoints');
// Presets retain their original nonlinear curves without separate shot layers.
for(const preset of Object.keys(PRESETS).filter(name=>name!=='keyframed')){
  const project=newMapProject();project.frames=300;project.camera.init={...start};
  project.actions=[makeAction('object',0,{id:'route',mode:'path',dur:200,path:[{lon:0,lat:20},{lon:10,lat:30},{lon:20,lat:25}]})];
  const shot=makeShot(preset,10,{target:{kind:'point',name:'Target',lon:30,lat:40},planeId:'route'});project.shots=[shot];
  const samples=sampleCameraPreset(project,{},1280,720,shot,start),single=syncCameraTimeline({...project,shots:[]},pose=>makeShot('keyframed',0,{cameraFrom:pose,cameraTo:pose,cameraKeys:[]}));
  addCameraPair(single,preset,10,10+shot.dur,samples);
  for(const t of [0,.25,.5,.75,1]){
    const frame=10+shot.dur*t,expected=cameraAt(project,{},1280,720,frame),actual=cameraPoseAt(single,frame);
    for(const [field,value] of Object.entries({lon:xToLon(expected.cx),lat:yToLat(expected.cy),zoom:expected.zoom,pitch:expected.pitch,bearing:expected.bearing}))assert.ok(Math.abs(actual[field]-value)<.05,`${preset} preserves ${field} at ${t}`);
  }
}
console.log('Camera pairs: independent manual keys, same-frame keys, paired deletion, retiming, validation and every preset curve passed');
