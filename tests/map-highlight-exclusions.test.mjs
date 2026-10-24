import assert from 'node:assert/strict';
import { makeAction, newMapProject, validateMapProject, HIGHLIGHT_ANIMATIONS, BORDER_ANIMATIONS, BORDER_STYLES } from '../map-engine.mjs';
const excluded={kind:'polygon',name:'Leave unfilled',path:[{lon:1,lat:45},{lon:3,lat:45},{lon:3,lat:47},{lon:1,lat:47}]};
const p=newMapProject();
p.actions=[makeAction('highlight',0,{target:{kind:'country',name:'France'},highlightExclude:[excluded]})];
assert.deepEqual(validateMapProject(JSON.parse(JSON.stringify(p))).actions[0].highlightExclude,[excluded]);
for(const highlightExclude of [null,'bad',[null],[{...excluded,path:excluded.path.slice(0,2)}],[{kind:'point',name:'Point',lon:1,lat:45}],Array(101).fill(excluded)]){
  assert.throws(()=>validateMapProject({...p,actions:[{...p.actions[0],highlightExclude}]}),/exclusions/);
}
assert.doesNotThrow(()=>validateMapProject({...p,actions:[{...p.actions[0],highlightExclude:[]}]}));
console.log('Highlight exclusions: saved polygon masks, empty exclusions and invalid input validation passed');

for(const [highlightAnimation] of HIGHLIGHT_ANIMATIONS)for(const highlightFill of ['color','gradient','stripes','dots','flag']){
  const action=makeAction('highlight',0,{highlightAnimation,highlightFill,highlightColor2:'#ff00ff'});
  const saved=validateMapProject({...p,actions:[action]}).actions[0];
  assert.equal(saved.highlightAnimation,highlightAnimation);assert.equal(saved.highlightFill,highlightFill);
}
for(const [borderAnimation] of BORDER_ANIMATIONS)for(const [borderStyle] of BORDER_STYLES){
  assert.doesNotThrow(()=>validateMapProject({...p,actions:[makeAction('border',0,{borderAnimation,borderStyle})]}));
}
for(const [type,key,value] of [['highlight','highlightAnimation','bad'],['highlight','highlightFill','bad'],['highlight','highlightColor2','bad'],['border','borderAnimation','bad'],['border','borderStyle','bad']]){
  assert.throws(()=>validateMapProject({...p,actions:[makeAction(type,0,{[key]:value})]}),/Invalid/);
}
console.log('Highlight styles and animations, border styles and animations: persistence and validation passed');
