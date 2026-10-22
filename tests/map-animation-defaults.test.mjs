import assert from 'node:assert/strict';
import { ACTION_TYPES, makeAction, newMapProject, validateMapProject, actionProgress } from '../map-engine.mjs';
import { animationKeysOf, retimeMapItem } from '../map-timing.mjs';

for(const type of Object.keys(ACTION_TYPES)){
  for(const dur of [2,3,30,120]){
    const layer=makeAction(type,20,{dur}),keys=animationKeysOf(layer);
    assert.equal(keys.start,20);
    assert.ok(keys.end>keys.start&&keys.end<layer.start+layer.dur,`${type}: animation ends inside the bar`);
    assert.equal(actionProgress(layer,keys.end),1);
    retimeMapItem(layer,layer.start,dur+30,false);
    assert.equal(animationKeysOf(layer).end,keys.end,'extending the bar preserves the animation timing');
  }
  const explicit=makeAction(type,0,{dur:120,animDur:120});
  assert.equal(animationKeysOf(explicit).end,120,'explicit animation durations remain intact');
}
const project=newMapProject();
project.actions=[makeAction('highlight',0,{dur:120})];
delete project.actions[0].animDur;
assert.equal(validateMapProject(project).actions[0].animDur,120,'older saved layers retain their existing timing');
console.log('New layer animation end padding, short clips, explicit timing and saved-project compatibility passed');
