import assert from 'node:assert/strict';
import { newMapProject,makeAction,validateMapProject,planeRoute,THEMES,OBJECT_ICONS } from '../map-engine.mjs';
import { STRATEGY_OBJECTS } from '../map-strategy-objects.mjs';
import { ZONE_TERRAINS,landscapePlacements } from '../map-strategy-terrain.mjs';

assert.equal(THEMES.kingdom.strategy,true);
assert.equal(Object.keys(STRATEGY_OBJECTS).length,24);
const p=newMapProject();p.theme='kingdom';
const path=[{lon:0,lat:0},{lon:3,lat:0},{lon:3,lat:3},{lon:0,lat:3}];
// Every zone edge uses the selected connection style, including the closing edge.
for(const shape of ['zone','noFly','area']){
  const action=makeAction('shape',0,{id:'boundary',shape,path,curve:'smooth'}),r=planeRoute(null,action);
  assert.equal(r.X[0],r.X.at(-1));assert.equal(r.Y[0],r.Y.at(-1));
  const start=[r.X[1]-r.X[0],r.Y[1]-r.Y[0]],end=[r.X.at(-1)-r.X.at(-2),r.Y.at(-1)-r.Y.at(-2)];
  assert.ok((start[0]*end[0]+start[1]*end[1])/(Math.hypot(...start)*Math.hypot(...end))>.98,'smooth tangent across boundary seam');
  const repeated=planeRoute(null,{...action,path:[...path,path[0]]});
  assert.deepEqual(repeated.X,r.X);assert.deepEqual(repeated.Y,r.Y);
  const open=planeRoute(null,{...action,shape:'arrow'});
  assert.notEqual(open.Y[0],open.Y.at(-1),'changing type invalidates the closed route cache');
}
for(const [glyph,icon]of Object.entries(STRATEGY_OBJECTS)){
  assert.equal(OBJECT_ICONS[glyph],icon);assert.equal(icon.group,'kingdom');assert.equal(typeof icon.draw,'function');
  p.actions.push(makeAction('object',0,{glyph,color:icon.color}));
}
for(const zoneTerrain of Object.keys(ZONE_TERRAINS))p.actions.push(makeAction('shape',0,{shape:'zone',path,zoneTerrain,terrainDensity:1.2,terrainScale:1.5,terrainOpacity:.9,terrainSeed:42}));
validateMapProject(JSON.parse(JSON.stringify(p)));
for(const objectView of ['side','normal','isometric','isometricBack']){const copy=structuredClone(p);for(const a of copy.actions)if(a.type==='object')a.objectView=objectView;validateMapProject(JSON.parse(JSON.stringify(copy)));}
assert.throws(()=>validateMapProject({...p,actions:[{...p.actions[0],objectView:'invalid'}]}),/object view/);
assert.deepEqual(JSON.parse(JSON.stringify(p)).actions,p.actions,'landscapes and strategy objects survive project serialization');
for(const invalid of [{zoneTerrain:'lava'},{terrainDensity:0},{terrainDensity:3},{terrainScale:NaN},{terrainOpacity:1.1},{terrainSeed:1.5},{terrainSeed:-1}]){
  const copy=structuredClone(p);Object.assign(copy.actions.at(-1),invalid);assert.throws(()=>validateMapProject(copy),/landscape/);
}
const square=[{x:0,y:0},{x:1,y:0},{x:1,y:1},{x:0,y:1}];
const a=landscapePlacements(square,1,42),b=landscapePlacements(square,1,43);
assert.deepEqual(a,landscapePlacements(square,1,42),'seed is deterministic');assert.notDeepEqual(a,b,'seed rearranges details');
assert.ok(a.length>200&&a.length<600);assert.ok(landscapePlacements(square,2).length>a.length,'density increases detail count');
assert.ok(landscapePlacements(square,100).length<600,'out-of-range density remains bounded');
assert.ok(a.every(p=>p.x>0&&p.x<1&&p.y>0&&p.y<1));
assert.deepEqual(landscapePlacements([]),[]);assert.deepEqual(landscapePlacements([{x:0,y:0},{x:0,y:0},{x:0,y:0}]),[]);
assert.deepEqual(landscapePlacements([{x:0,y:0},{x:1,y:1},{x:2,y:2}]),[],'zero-area lines have no scenery');
console.log('Kingdom theme, 24 original objects, 13 zone fills, validation, seeded placement and project roundtrip passed');
