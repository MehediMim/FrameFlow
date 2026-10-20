import assert from 'node:assert/strict';
import { bannerPoint } from '../map-banner.mjs';
import { makeAction, newMapProject, validateMapProject } from '../map-engine.mjs';

for(const u of [0,.5,1]) assert.deepEqual(bannerPoint(u,0,120,180,0),bannerPoint(u,0,120,180,5),'cloth stays attached to crossbar');
assert.notDeepEqual(bannerPoint(1,1,120,180,0),bannerPoint(1,1,120,180,.5),'free edge moves in wind');
assert.deepEqual(bannerPoint(1,1,120,180,.5),bannerPoint(1,1,120,180,.5),'wind is deterministic');
assert.deepEqual(bannerPoint(.5,1,120,180,0,0),bannerPoint(.5,1,120,180,5,0),'zero strength stops cloth movement');
assert.deepEqual(bannerPoint(.5,1,120,180,1,.6,2),bannerPoint(.5,1,120,180,2,.6,1),'speed changes the simulation clock');
const p=newMapProject();p.actions=[makeAction('object',0,{glyph:'banner',bannerTitle:'Richard Hakluyt',bannerWind:true,bannerAspect:.75,image:'data:image/png;base64,AAAA'})];
validateMapProject(JSON.parse(JSON.stringify(p)));
for(const invalid of [{bannerAspect:0},{bannerWindSpeed:9},{bannerWindStrength:NaN},{bannerWind:'yes'},{bannerTitle:'x'.repeat(101)},{bannerPoleColor:'bad'},{image:'https://example.com/image.png'}]){
  const copy=structuredClone(p);Object.assign(copy.actions[0],invalid);assert.throws(()=>validateMapProject(copy));
}
console.log('Banner mesh attachment, wind timing, image and settings validation passed');
