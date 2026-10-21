import assert from 'node:assert/strict';
import { makeAction, newMapProject, validateMapProject } from '../map-engine.mjs';
const excluded={kind:'polygon',name:'Leave unfilled',path:[{lon:1,lat:45},{lon:3,lat:45},{lon:3,lat:47},{lon:1,lat:47}]};
const p=newMapProject();
p.actions=[makeAction('highlight',0,{target:{kind:'country',name:'France'},highlightExclude:[excluded]})];
assert.deepEqual(validateMapProject(JSON.parse(JSON.stringify(p))).actions[0].highlightExclude,[excluded]);
for(const highlightExclude of [null,'bad',[null],[{...excluded,path:excluded.path.slice(0,2)}],[{kind:'point',name:'Point',lon:1,lat:45}],Array(101).fill(excluded)]){
  assert.throws(()=>validateMapProject({...p,actions:[{...p.actions[0],highlightExclude}]}),/exclusions/);
}
assert.doesNotThrow(()=>validateMapProject({...p,actions:[{...p.actions[0],highlightExclude:[]}]}));
console.log('Highlight exclusions: saved polygon masks, empty exclusions and invalid input validation passed');
