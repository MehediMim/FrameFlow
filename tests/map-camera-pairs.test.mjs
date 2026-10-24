import assert from 'node:assert/strict';
import { newMapProject, makeShot, makeAction, PRESETS, sampleCameraPreset, cameraAt, validateMapProject, xToLon, yToLat, objectLocationAt } from '../map-engine.mjs';
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
  const frames = [.125, .375, .625, .875].map(t => 10 + shot.dur * t);
  const before = frames.map(frame => cameraPoseAt(single, frame));
  putCameraKey(single, 10 + shot.dur / 2, cameraPoseAt(single, 10 + shot.dur / 2));
  frames.forEach((frame, i) => {
    const actual = cameraPoseAt(single, frame);
    for (const field of Object.keys(start)) assert.ok(Math.abs(actual[field] - before[i][field]) < 1e-9, `${preset}: capturing inside a movement preserves its ${field} curve`);
  });
}
const curved=makeShot('keyframed',0,{easing:'linear',cameraFrom:start,cameraTo:start,cameraKeys:[]});
const curve=[{t:0,values:start},{t:.5,values:{...start,pitch:40}},{t:1,values:start}];
const endpoints=addCameraPair(curved,'orbit',0,100,curve);
putCameraKey(curved,100,{pitch:20},endpoints[1].id);
assert.equal(cameraPoseAt(curved,50).pitch,50,'editing an endpoint offsets rather than discards the nonlinear curve');
assert.deepEqual(endpoints[0].samples,curve,'endpoint edits retain original motion samples');
putCameraKey(curved,50,{zoom:7});
assert.equal(cameraPoseAt(curved,50).zoom,7,'an interior manual key controls its property');
assert.equal(cameraPoseAt(curved,25).pitch,25,'other property tracks keep their curve');
putCameraKey(curved,0,{zoom:8});
assert.equal(cameraPoseAt(curved,0).zoom,8,'manual keys take priority at shared endpoints');
const adjacent=makeShot('keyframed',0,{cameraFrom:start,cameraTo:start,cameraKeys:[]});
addCameraPair(adjacent,'pushIn',0,50,[{t:0,values:start},{t:1,values:{...start,zoom:5}}]);
addCameraPair(adjacent,'pullBack',50,100,[{t:0,values:{...start,zoom:6}},{t:1,values:start}]);
assert.equal(cameraPoseAt(adjacent,50).zoom,6,'the next movement owns its start at a shared frame');
for(const type of ['object','pin'])for(const mode of ['move','path','stay']){
  const project=newMapProject();project.camera.init={...start};
  const place={kind:'point',name:'Start',lon:0,lat:20},to={kind:'point',name:'End',lon:20,lat:30};
  const object=makeAction(type,0,{mode,place,to,dur:200,animDur:200,easing:'linear',path:[place,to]});project.actions=[object];
  const track=syncCameraTimeline(project,pose=>makeShot('keyframed',0,{cameraFrom:pose,cameraTo:pose,cameraKeys:[]}));
  const shot=makeShot('followPlane',0,{planeId:object.id,dur:200});
  const [first,last]=addCameraPair(track,'followPlane',0,200,sampleCameraPreset(project,{},1280,720,shot,start));
  first.follow={planeId:object.id,zoom:shot.zoom,pitch:shot.pitch,lockHeading:false,easing:shot.easing,from:start};
  const assertFollow=(label)=>{
    const actual=cameraAt(project,{},1280,720,150),expected=objectLocationAt({cx:actual.cx},{},object,150);
    assert.ok(Math.abs(actual.cx-expected.X)<1e-5&&Math.abs(actual.cy-expected.Y)<1e-5,`${type} ${mode}: ${label}`);
  };
  assertFollow('camera centers on the current object');
  object.to={...to,lon:40,lat:40};object.path=[place,object.to];object.place={...place,lon:10};
  object.animDur=180;
  assertFollow('editing destination, path, position or timing updates the linked camera');
  moveCameraKey(track,last.frame,180,undefined,last.id);
  assertFollow('retiming follow keeps the object clock');
  validateMapProject(JSON.parse(JSON.stringify(project)));
  const reloaded=JSON.parse(JSON.stringify(project));
  assert.deepEqual(cameraAt(reloaded,{},1280,720,150),cameraAt(project,{},1280,720,150),'live follow persists after reload');
  project.actions=[];
  assert.ok(Number.isFinite(cameraAt(project,{},1280,720,150).cx),'deleted targets keep the saved fallback curve');
  reloaded.shots[0].cameraKeys[0].follow.zoom=Infinity;
  assert.throws(()=>validateMapProject(reloaded),/follow object/i,'invalid follow controls are rejected');
}
console.log('Camera pairs: manual keys, motion curves, retiming, live object/pin following, validation and reload passed');
