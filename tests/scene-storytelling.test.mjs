import assert from 'node:assert/strict';
import { defaultScene, makeObject, makeClip, makeCameraClip, validateScene, cameraAt, actorPosition, characterState, renderScene } from '../scene-engine.mjs';
import { buildStoryScene } from '../scene-presets.mjs';
import { sampleCurve, scatterPlants, drawClouds, drawRain, WEATHER_PRESETS, cameraSpecFromPose } from '../scene-storytelling.mjs';
import { terrainHeight, terrainMesh } from '../scene-environment.mjs';

const a={pos:[-10,4,-10],look:[0,1,4],fov:45},b={pos:[10,8,-5],look:[2,2,5],fov:65},c={pos:[6,3,10],look:[0,1,5],fov:50};
const p=defaultScene();p.camera=cameraSpecFromPose(a);p.savedCameras=[{id:'a',name:'Wide',pose:a},{id:'b',name:'Close',pose:b}];
p.cameraClips=[{...makeCameraClip('locked',0,4),fromPose:a,toPose:b,blend:0},{...makeCameraClip('locked',4,4),fromPose:b,toPose:c,blend:0}];
validateScene(p);
assert.deepEqual(cameraAt(p,0).pos,a.pos);assert.deepEqual(cameraAt(p,2).pos,[0,6,-7.5]);assert.deepEqual(cameraAt(p,4).pos,b.pos);
assert.ok(Math.hypot(...cameraAt(p,4-1e-5).pos.map((v,i)=>v-b.pos[i]))<1e-6,'adjacent shots meet continuously');
assert.deepEqual(cameraAt(p,11).pos,c.pos,'the final saved camera view holds');
assert.deepEqual(validateScene(JSON.parse(JSON.stringify(p))),p);

const scene=defaultScene(),human=scene.objects[0],seat=Object.assign(makeObject('chair'),{x:8,z:10,rotation:90});scene.objects.push(seat);
human.seatId=seat.id;human.clips=[makeClip('sit',2,3)];
assert.equal(characterState(scene,human,1).seat,null);assert.equal(characterState(scene,human,3).seat.id,seat.id);
assert.ok(Math.abs(characterState(scene,human,3).position[0]-8.08)<1e-8);assert.equal(characterState(scene,human,3).yaw,Math.PI/2);
const partner=Object.assign(makeObject('human'),{x:5,z:10,endX:5,endZ:10});scene.objects.push(partner);human.talkTarget=partner.id;human.clips=[makeClip('talk',0,8)];
assert.equal(characterState(scene,human,1).yaw,Math.atan2(5-human.x,10-human.z));
human.routeStart=5;human.clips=[makeClip('walk',5,4)];human.x=0;human.z=0;human.endX=0;human.endZ=20;
assert.deepEqual(actorPosition(human,4),[0,0,0]);assert.deepEqual(actorPosition(human,7),[0,0,2.8]);
const context=Object.fromEntries(['fillRect','beginPath','moveTo','lineTo','closePath','fill','stroke'].map(k=>[k,()=>{}]));
const canvas={width:640,height:360,getContext:()=>context};scene.objects=[human];scene.cameraClips=[];scene.baseRoad=false;scene.left=scene.right='none';
const baseline=renderScene(canvas,scene,0).faces;human.carry='box';assert.ok(renderScene(canvas,scene,0).faces>baseline,'carried parcel adds geometry');

const curve=sampleCurve([{x:0,z:0},{x:5,z:8},{x:-3,z:16}]);assert.deepEqual(curve[0],{x:0,z:0});assert.deepEqual(curve.at(-1),{x:-3,z:16});assert.ok(curve.length>20);
const scatter={x:0,z:0,radius:12,count:20,seed:8,type:'mixed'},road={type:'road',x:0,z:0,width:4,length:30,scale:1};
const plants=scatterPlants(scatter,[road]);assert.deepEqual(plants,scatterPlants(scatter,[road]));assert.ok(plants.length>5);assert.ok(plants.every(v=>Math.abs(v.x)>=3),'scatter avoids the road footprint');
const sculpt={type:'flat',sculpt:[{x:3,z:4,radius:3,mode:'raise',amount:2,level:0}]};
assert.equal(terrainHeight(3,4,sculpt),1.85);assert.equal(terrainHeight(20,4,sculpt),-.15);assert.ok(terrainMesh(sculpt).flat().some(v=>v[1]>1),'small brushes affect actual terrain geometry');
sculpt.sculpt.push({x:3,z:4,radius:3,mode:'flatten',amount:1,level:.5});assert.equal(terrainHeight(3,4,sculpt),.5);
const marks=[];const g=Object.fromEntries(['save','restore','beginPath','fill','stroke'].map(k=>[k,()=>{}]));for(const k of ['ellipse','moveTo','lineTo'])g[k]=(...args)=>marks.push([k,...args]);
const weather={...WEATHER_PRESETS.rain,windDirection:35};drawClouds(g,640,360,weather,0);drawRain(g,640,360,weather,0);const first=JSON.stringify(marks);marks.length=0;drawClouds(g,640,360,weather,0);drawRain(g,640,360,weather,0);assert.equal(JSON.stringify(marks),first,'weather is deterministic');marks.length=0;drawClouds(g,640,360,weather,1);drawRain(g,640,360,weather,1);assert.notEqual(JSON.stringify(marks),first,'clouds and rain move');
validateScene(buildStoryScene());
for(const change of [q=>q.atmosphere={rain:2},q=>q.savedCameras=[{id:'a',name:'Bad',pose:{...a,pos:[NaN,4,0]}}],q=>q.cameraClips[0].fromPose=a,q=>q.objects[0].carry='invalid',q=>q.terrain={sculpt:[{x:0,z:0,radius:0,mode:'raise',amount:1,level:0}]}]){const q=defaultScene();change(q);assert.throws(()=>validateScene(q),/Invalid/);}
console.log('Scene storytelling: continuous camera moves, chair targets, conversations, props, routes, curves, scatter, sculpt and weather passed');
