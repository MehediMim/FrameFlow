import assert from 'node:assert/strict';
import { MEDIEVAL_OBJECTS } from '../map-medieval-objects.mjs';
import { makeAction, newMapProject, validateMapProject } from '../map-engine.mjs';
import { retimeMapItem } from '../map-timing.mjs';

const project=newMapProject();
project.actions=Object.keys(MEDIEVAL_OBJECTS).map(glyph=>makeAction('object',0,{glyph,color:MEDIEVAL_OBJECTS[glyph].color}));
Object.assign(project.actions[0],{label:'Manuel',showLabel:true,image:'data:image/png;base64,AAAA',badgeZoom:1.5,badgeX:20,badgeY:-30,badgeBorder:'#c7a469'});
const restored=JSON.parse(JSON.stringify(project));
validateMapProject(restored);
assert.deepEqual(restored,project,'portrait artwork, crop, ribbon name and castles survive project JSON');
const reused=structuredClone(restored.actions[0]);
reused.objectKeys=[{frame:0,values:{size:1}},{frame:120,values:{size:2}}];
retimeMapItem(reused,30,90);
validateMapProject({...newMapProject(),actions:[reused]});
assert.deepEqual(reused.objectKeys.map(k=>k.frame),[30,120],'object import moves keys into the selected timeline interval');
for(const value of [{image:'https://example.com/portrait.png'},{badgeZoom:8},{badgeX:101},{badgeBorder:'gold'}]){
  const invalid=structuredClone(project);Object.assign(invalid.actions[0],value);
  assert.throws(()=>validateMapProject(invalid),'portrait imports validate images and crop settings');
}
console.log('Medieval object registration, project roundtrip, embedded portrait and invalid import checks passed');
