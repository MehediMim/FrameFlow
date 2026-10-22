import assert from 'node:assert/strict';
import {createIsometricModel,objectAnimationOptions,objectAnimationOf,drawSideObject} from '../map-isometric-objects.mjs';
import {makeAction,newMapProject,validateMapProject} from '../map-engine.mjs';
const faces=(glyph,time,action={},view='isometric')=>createIsometricModel(glyph,'#778866',time,action,undefined,view).faces;
const cases=[['doctor','walk'],['soldier','run'],['army','walk'],['car','drive'],['tank','drive'],['cannonBattery','drive'],['bicycle','drive'],['tree','sway'],['kingdomJungle','sway'],['galleon','sail'],['factory','operate'],['windTurbine','operate'],['helicopter','operate']];
for(const [glyph,animation]of cases)for(const view of ['side','isometric','isometricBack']){
  const action={objectAnimation:animation};
  assert.ok(objectAnimationOptions(glyph).some(([key])=>key===animation),glyph+' offers its motion');
  assert.notDeepEqual(faces(glyph,.17,action,view),faces(glyph,.48,action,view),glyph+' animates in '+view);
  assert.deepEqual(faces(glyph,.17,action,view),faces(glyph,.17,action,view),glyph+' scrubs deterministically');
  assert.deepEqual(faces(glyph,.34,action,view),faces(glyph,.17,{...action,objectAnimationSpeed:2},view),glyph+' obeys animation speed');
  assert.deepEqual(faces(glyph,0,{objectAnimation:'none'},view),faces(glyph,2,{objectAnimation:'none'},view),glyph+' stays still');
}
assert.equal(objectAnimationOf('doctor',{mode:'move'}),'walk');
assert.equal(objectAnimationOf('car',{mode:'path'}),'drive');
assert.equal(objectAnimationOf('doctor',{mode:'move',objectAnimation:'none'}),'none');
assert.equal(objectAnimationOf('car',{objectAnimation:'walk'}),'auto','switching object types safely falls back');
assert.deepEqual(faces('doctor',.17),faces('doctor',.48),'parked figures stay still by default');
// Exercise the model cache: a figure previously rendered still must animate
// immediately when it starts moving, and Stop must freeze a spinning rotor.
const context=()=>new Proxy({fill(){},getTransform:null},{get:(o,k)=>k in o?o[k]:()=>{}});
const render=(glyph,t,action)=>drawSideObject(context(),glyph,26,'#778866',t,action);
const parked=render('doctor',.17,{}),walking=render('doctor',.17,{mode:'move'});
assert.notDeepEqual(parked,walking,'moving figures do not reuse cached still geometry');
assert.notDeepEqual(render('doctor',.17,{mode:'move'}),render('doctor',.48,{mode:'move'}),'walking cache advances');
assert.deepEqual(render('helicopter',.17,{objectAnimation:'none'}),render('helicopter',.48,{objectAnimation:'none'}),'stopped rotor cache stays fixed');
const project=newMapProject();project.actions=[makeAction('object',0,{glyph:'doctor',objectAnimation:'run',objectAnimationSpeed:2})];
validateMapProject(JSON.parse(JSON.stringify(project)));
for(const bad of [{objectAnimation:'unknown'},{objectAnimationSpeed:0},{objectAnimationSpeed:4.1},{objectAnimationSpeed:'2'}]){
  const copy=structuredClone(project);Object.assign(copy.actions[0],bad);assert.throws(()=>validateMapProject(copy),/animation/);
}
console.log('Object motion: walking, running, wheels, wind, water, machinery, all views, speed, still, caching and validation passed');
