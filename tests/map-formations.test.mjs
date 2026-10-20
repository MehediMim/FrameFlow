import assert from 'node:assert/strict';
import { objectOffsets, arrangementTargets } from '../map-formations.mjs';
import { newMapProject, makeAction, validateMapProject } from '../map-engine.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} approximately ${b}`);
for(const mode of ['grid','row','wall','column','staggered','wedge','circle'])for(const count of [1,2,7,100]){
  const points=objectOffsets({count,formation:mode,gapX:64,gapY:80,formationAngle:35});
  assert.equal(points.length,count);assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
  if(count===1){near(points[0].x,0);near(points[0].y,0);}
}
const row=objectOffsets({count:4,formation:'row',gapX:52});
assert.deepEqual(row.map(p=>p.x),[-78,-26,26,78]);assert.ok(row.every(p=>p.y===0));
const rotated=objectOffsets({count:4,formation:'row',gapX:52,formationAngle:90});
rotated.forEach((p,i)=>{near(p.x,0);near(p.y,row[i].x);});
const points=[{id:'a',x:0,y:3},{id:'b',x:30,y:25},{id:'c',x:100,y:40}];
assert.deepEqual(arrangementTargets(points,'left').map(p=>p.x),[0,0,0]);
assert.deepEqual(arrangementTargets(points,'centerY').map(p=>p.y),[21.5,21.5,21.5]);
assert.deepEqual(arrangementTargets(points,'distributeX').map(p=>p.x),[0,50,100]);
assert.deepEqual(points.map(p=>p.x),[0,30,100],'arranging never mutates source positions');
const p=newMapProject();p.actions=[makeAction('object',0,{glyph:'stoneWall',count:8,formation:'row',formationAngle:25,objectAngle:25})];validateMapProject(structuredClone(p));
for(const settings of [{formation:'bad'},{formationCols:0},{formationAlign:'bad'},{formationAngle:NaN},{objectAngle:999}]){
  const copy=structuredClone(p);Object.assign(copy.actions[0],settings);assert.throws(()=>validateMapProject(copy));
}
for(const fx of ['cannonShot','musketVolley','arrowVolley','artilleryBarrage','meleeClash','battleSmoke','siegeFire']){
  p.actions=[makeAction('effect',0,{fx,battleAngle:20,battleIntensity:6,battleRange:200,battleSpread:40})];validateMapProject(p);
  for(const bad of [{battleIntensity:0},{battleIntensity:1.5},{battleSpread:180},{battleRange:NaN}]){const copy=structuredClone(p);Object.assign(copy.actions[0],bad);assert.throws(()=>validateMapProject(copy));}
}
console.log('Formation geometry, alignment/distribution and defense/battle project validation passed');
