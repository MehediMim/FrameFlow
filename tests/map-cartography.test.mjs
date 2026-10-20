import assert from 'node:assert/strict';
import { curvedGlyphs, flagImageCrop, flagFeatureParts } from '../map-label-curve.mjs';
import { newMapProject, makeAction, validateMapProject } from '../map-engine.mjs';
const measure=s=>s.length*10,arc=curvedGlyphs('ABCDE',measure,2,120),reverse=curvedGlyphs('ABCDE',measure,2,-120);
assert.equal(arc.length,5);assert.ok(Math.abs(arc[0].x+arc[4].x)<1e-8);assert.ok(arc[0].y>arc[2].y);assert.ok(arc[0].angle<0&&arc[4].angle>0);
for(let i=0;i<arc.length;i++){assert.equal(arc[i].x,reverse[i].x);assert.equal(arc[i].y,-reverse[i].y);}
assert.ok(curvedGlyphs('ABCDE',measure,2,0).every(g=>g.y===0&&g.angle===0));
assert.equal(curvedGlyphs('e\u0301',measure,0,90).length,1,'combining marks remain with their letter');
assert.deepEqual(curvedGlyphs('',measure,0,90),[]);
assert.deepEqual(flagImageCrop(2,1,'cover'),{x:.25,y:0,w:.5,h:1});assert.deepEqual(flagImageCrop(2,1,'stretch'),{x:0,y:0,w:1,h:1});assert.equal(flagImageCrop(2,1,'cover',2,100).x,.75);
const p=newMapProject();p.actions=[makeAction('highlight',0,{highlightFill:'flag',flagOpacity:.8,flagFit:'cover'}),makeAction('label',0,{labelStyle:{textPath:'arc',curveAngle:-120}})];p.atlasLabels={countries:true,textPath:'arc',curveAngle:60};validateMapProject(p);
for(const patch of [{flagOpacity:2},{flagZoom:0},{flagX:101},{highlightFill:'bad'},{flagFit:'bad'},{image:'https://example.com/flag.png'}])assert.throws(()=>validateMapProject({...p,actions:[{...p.actions[0],...patch}]}));
for(const style of [{textPath:'bad'},{curveAngle:361}])assert.throws(()=>validateMapProject({...p,labelStyle:style}));
const ring=(x0,y0,x1,y1)=>({n:5,xy:[x0,y0,x1,y0,x1,y1,x0,y1,x0,y0]});
const f={mainBox:[0,0,2,2],bbox:[-10,0,2,2],rings:[ring(0,0,2,2),ring(-10,0,-9,1)]};
const parts=flagFeatureParts(f);assert.equal(parts.length,2);assert.deepEqual(parts[0].box,[0,0,2,2]);assert.deepEqual(parts[1].box,[-10,0,-9,1]);
console.log('Circular label geometry, graphemes, image fitting and cartographic project validation passed');
