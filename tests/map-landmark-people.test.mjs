import assert from 'node:assert/strict';
import { LANDMARK_OBJECTS } from '../map-landmark-objects.mjs';
import { PEOPLE_OBJECTS } from '../map-people-objects.mjs';
import { OBJECT_ICONS } from '../map-objects.mjs';
import { makeAction, newMapProject, validateMapProject } from '../map-engine.mjs';
import { putObjectKey, objectPoseAt } from '../map-object-keys.mjs';
import { retimeMapItem } from '../map-timing.mjs';
const all={...LANDMARK_OBJECTS,...PEOPLE_OBJECTS};
assert.equal(Object.keys(LANDMARK_OBJECTS).length,16);
assert.equal(Object.keys(PEOPLE_OBJECTS).length,16);
const p=newMapProject();
p.frames=300;
for(const [glyph,icon]of Object.entries(all)){
  assert.equal(OBJECT_ICONS[glyph],icon,`${glyph} is registered`);
  assert.equal(icon.group,Object.hasOwn(LANDMARK_OBJECTS,glyph)?'landmarks':'people');
  assert.equal(icon.timeUnit,'seconds');
  assert.equal(typeof icon.draw,'function');
  const a=makeAction('object',0,{glyph,place:{kind:'point',name:'Test place',lat:48,lon:2},dur:120,size:1,easing:'linear',showLabel:true});
  putObjectKey(a,60,{size:2,objectAngle:90});
  assert.equal(objectPoseAt(a,30).size,1.5,'new objects inherit size animation');
  assert.equal(objectPoseAt(a,30).objectAngle,45,'new objects inherit rotation animation');
  retimeMapItem(a,30,120,true);
  assert.ok(a.objectKeys.some(k=>k.frame===90),'new objects retain keys when retimed');
  p.actions.push(a);
}
const restored=validateMapProject(JSON.parse(JSON.stringify(p)));
assert.deepEqual(restored.actions.map(a=>a.glyph),Object.keys(all),'all new object types survive project backup and restore');
console.log('32 landmark and occupation objects: registration, categories, keyframes, retiming, and project persistence passed');
