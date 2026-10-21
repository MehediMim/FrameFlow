import assert from 'node:assert/strict';
import { SUBCONTINENT_OBJECTS } from '../map-subcontinent-objects.mjs';
import { OBJECT_ICONS, makeAction, newMapProject, validateMapProject } from '../map-engine.mjs';
import { ARMY_PRESETS, armyCopies, validateArmyUnits } from '../map-armies.mjs';
import { putObjectKey, objectPoseAt } from '../map-object-keys.mjs';

const p=newMapProject();p.frames=300;
for(const [glyph,icon]of Object.entries(SUBCONTINENT_OBJECTS)){
  assert.equal(OBJECT_ICONS[glyph],icon,'regional miniature is available to the engine');
  const a=makeAction('object',0,{glyph,color:icon.color,dur:180,place:{kind:'point',name:'Delhi',lat:28.61,lon:77.21}});
  putObjectKey(a,0,{size:1,objectAngle:0});putObjectKey(a,60,{size:2,objectAngle:90});
  assert.equal(objectPoseAt(a,30).size,1.5);
  assert.equal(objectPoseAt(a,30).objectAngle,45);
  p.actions.push(a);
}
for(const key of ['mughalColumn','companyColumn']){
  const preset=ARMY_PRESETS[key];validateArmyUnits(preset.units,OBJECT_ICONS);
  const army=makeAction('object',0,{glyph:'army',armyUnits:preset.units});
  assert.equal(armyCopies(army).length,preset.units.reduce((n,row)=>n+row.count,0));
  p.actions.push(army);
}
const restored=validateMapProject(JSON.parse(JSON.stringify(p)));
assert.deepEqual(restored.actions,p.actions,'regional miniatures, animation keys and army compositions survive backup and restore');
console.log('Subcontinent miniatures and army presets: registration, animation keys, composition and persistence passed');
