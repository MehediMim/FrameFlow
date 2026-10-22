import assert from 'node:assert/strict';
import {OBJECT_ICONS} from '../map-objects.mjs';
import {IsoScene,projectIso,projectSide} from '../map-isometric-geometry.mjs';
import {OBJECT_CATEGORIES,objectEntries,objectCategory} from '../map-object-catalog.mjs';
import {OBJECT_VIEWS,validateObjectView,objectViewOf} from '../map-object-view.mjs';
import {ISOMETRIC_MODELS,createIsometricModel} from '../map-isometric-objects.mjs';
import {projectShadowPoint,shadowGeometry,ISOMETRIC_LIGHT} from '../map-isometric-shadow.mjs';

assert.deepEqual(Object.keys(ISOMETRIC_MODELS).sort(),Object.keys(OBJECT_ICONS).sort(),'every catalog entry has an explicit model');
assert.deepEqual(projectIso([0,0,1]),[0,-1],'height stays vertical');
assert.deepEqual(projectIso([1,1,0]),[0,1],'ground axes have equal foreshortening');
assert.deepEqual(projectSide([2,8,3]),[2,-3],'side elevation keeps width and height without ground foreshortening');
assert.deepEqual(Object.keys(OBJECT_VIEWS),['side','isometric','isometricBack']);
const legacy={objectView:'normal'};validateObjectView(legacy);assert.equal(legacy.objectView,'side');
assert.equal(objectViewOf({}),'side');
const rearView={objectView:'isometricBack'};validateObjectView(rearView);assert.equal(objectViewOf(rearView),'isometricBack');
const rearBox=new IsoScene('isometricBack');rearBox.box(0,0,0,1,1,1,'#112233');assert.equal(rearBox.faces.length,5,'rear geometry includes both back walls');
assert.throws(()=>validateObjectView({objectView:'unknown'}),/Invalid object view/);
const catalog=OBJECT_CATEGORIES.flatMap(([group])=>objectEntries(group).map(([glyph])=>glyph));
assert.deepEqual(catalog.toSorted(),Object.keys(OBJECT_ICONS).sort(),'every object appears in exactly one category');
assert.equal(objectCategory('doctor'),'people');assert.equal(objectCategory('house'),'buildings');
const artwork=createIsometricModel('artwork','#ffffff',0,{}, {width:1024,height:512});
assert.equal(artwork.faces.length,1,'free artwork has no opaque backing or frame');
assert.ok(artwork.faces[0].image,'uploaded pixels remain the texture');
assert.equal((artwork.faces[0].points[1][0]-artwork.faces[0].points[0][0])/artwork.faces[0].points[0][2],2,'artwork keeps its aspect ratio in isometric view');
for(const [glyph,icon]of Object.entries(OBJECT_ICONS)){
  const scene=createIsometricModel(glyph,icon.color,2,{}),points=scene.faces.flatMap(f=>f.points);
  const side=createIsometricModel(glyph,icon.color,2,{},undefined,'side');
  const rear=createIsometricModel(glyph,icon.color,2,{},undefined,'isometricBack');
  const rearPoints=new Set(rear.faces.flatMap(f=>f.points).map(p=>JSON.stringify(p)));
  for(const [x,y,z]of points)assert.ok(rearPoints.has(JSON.stringify([-x,-y,z])),glyph+' rear view turns the same model by 180 degrees');
  const rearBounds=rear.bounds(false);
  assert.ok(Object.values(rearBounds).every(Number.isFinite)&&rearBounds.right>rearBounds.left&&rearBounds.bottom>rearBounds.top,glyph+' has a complete rear silhouette');
  assert.ok(Object.values(shadowGeometry(rear).bounds).every(Number.isFinite),glyph+' has finite rear shadow bounds');
  assert.deepEqual(createIsometricModel(glyph,icon.color,2,{},undefined,'isometricBack').faces,rear.faces,glyph+' rear view scrubs deterministically');

  assert.deepEqual(side.faces,scene.faces,glyph+' shares exactly the same geometry, colors and materials in both views');
  const bounds=side.bounds(false);
  assert.ok(Object.values(bounds).every(Number.isFinite)&&bounds.right>bounds.left&&bounds.bottom>bounds.top,glyph+' has a visible side elevation');
  assert.ok(points.length>=12,glyph+' has modeled surfaces');
  for(const point of points)assert.ok(point.length===3&&point.every(Number.isFinite),glyph+' has finite world-space vertices');
  for(let axis=0;axis<3;axis++)assert.ok(Math.max(...points.map(p=>p[axis]))-Math.min(...points.map(p=>p[axis]))>.01,glyph+' has geometry along every world axis');
  assert.deepEqual(createIsometricModel(glyph,icon.color,2,{}),scene,glyph+' is deterministic when scrubbing');
}
const points=(glyph,t,a={})=>createIsometricModel(glyph,'#75906a',t,a).faces.map(f=>f.points);
for(const glyph of['kingdomWindmill','windTurbine','helicopter','drone','flag','banner','volcano'])assert.notDeepEqual(points(glyph,1),points(glyph,2),glyph+' animates in world space');
assert.deepEqual(points('banner',1,{bannerWind:false}),points('banner',2,{bannerWind:false}),'wind-off cloth stays still');
assert.notDeepEqual(points('tank',0),points('car',0),'vehicles have distinct construction');
assert.notDeepEqual(points('caravel',0),points('warship',0),'sailing and modern ships have distinct construction');
assert.throws(()=>createIsometricModel('unknown-object'),/Missing isometric model/,'missing models never fall back to skewing an icon');
const house=createIsometricModel('kingdomHouse','#aa7755');
for(const material of ['thatch','wood','glass','plaster','ground'])assert.ok(house.faces.some(f=>f.material===material),'cottages have '+material+' surfaces');
const figure=createIsometricModel('doctor','#ffffff');
assert.ok(figure.faces.some(f=>f.smooth?.values.every(Number.isFinite)),'rounded figures carry continuous vertex lighting');
assert.ok(figure.faces.some(f=>f.material==='skin'),'skin uses its own surface material');
assert.ok(shadowGeometry(createIsometricModel('tree')).contact.length>0,'trees have geometry-derived contact shadows');
assert.ok(!house.faces.some(f=>f.material==='shadow'),'isometric models have no generic blob shadow');
assert.deepEqual(projectShadowPoint([0,0,1]),projectIso([-ISOMETRIC_LIGHT[0],-ISOMETRIC_LIGHT[1],0]),'cast direction opposes the surface light');
assert.deepEqual(projectShadowPoint([0,0,1],{angle:2,mirror:true}),projectShadowPoint([0,0,1]),'turning an object does not turn the sun');
for(const glyph of Object.keys(OBJECT_ICONS)){
  const geometry=shadowGeometry(createIsometricModel(glyph));
  assert.ok(geometry.layers.some(layer=>layer.length),glyph+' casts a model-specific shadow');
  assert.ok(Object.values(geometry.bounds).every(Number.isFinite),glyph+' has finite shadow bounds');
}
const towerShadow=shadowGeometry(createIsometricModel('eiffelTower')),tankShadow=shadowGeometry(createIsometricModel('tank'));
assert.notDeepEqual(towerShadow.layers,tankShadow.layers,'towers and vehicles have different shadow silhouettes');
const plane=createIsometricModel('jet'),elevated=shadowGeometry(plane,{height:2});
assert.equal(elevated.contact.length,0,'airborne objects have no ground contact patch');
assert.ok(elevated.blur[2]>shadowGeometry(plane).blur[2],'higher objects have softer shadows');
assert.ok(elevated.bounds.right>shadowGeometry(plane).bounds.right,'airborne shadows move away from the light');
assert.ok(shadowGeometry(createIsometricModel('eiffelTower'),{flatten:.06}).bounds.right<towerShadow.bounds.right,'collapsed towers cast shorter shadows');

// An inset decoration on the far side of a large tabletop must be drawn after
// that top face even though its average X+Y+Z depth is smaller.
const scene=new IsoScene();scene.box(-1,-1,0,2,2,.1,'#112233');scene.face([[-.9,-.9,.102],[-.5,-.9,.102],[-.5,-.5,.102],[-.9,-.5,.102]],'#ff0000');
const fills=[],context=new Proxy({fill(){fills.push(this.fillStyle);}},{get:(o,k)=>k in o?o[k]:()=>{}});
const bounds=scene.draw(context,30);
assert.ok(fills.indexOf(scene.faces.at(-1).color)>fills.indexOf(scene.faces[0].color),'surface decal is visible above its parent face');
assert.ok(bounds.top<bounds.bottom&&bounds.left<bounds.right,'rendered bounds support label positioning');
console.log(`Isometric geometry: ${Object.keys(OBJECT_ICONS).length} models, full coverage, finite vertices, depth, animation, and deterministic scrubbing passed`);
