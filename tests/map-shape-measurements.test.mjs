import assert from 'node:assert/strict';
import { measureShape, measurementText, shapeLabel, resizeShape } from '../map-shape-measurements.mjs';
import { makeAction, newMapProject, validateMapProject, planeRoute } from '../map-engine.mjs';
import { drawShape } from '../map-objects.mjs';
import { pathAt, putPathKey } from '../map-path-animation.mjs';
const near=(actual,expected,epsilon=1e-5)=>assert.ok(Math.abs(actual-expected)<epsilon,`${actual} ≈ ${expected}`);
const route=a=>planeRoute(null,a),measure=a=>measureShape(a,route(a));
const point=(lon,lat)=>({lon,lat});
const arrow=makeAction('shape',0,{curve:'straight',path:[point(0,0),point(1,0)],showMeasurement:true});
near(measure(arrow).value,111.1950802335);
near(measure({...arrow,measurementUnit:'imperial'}).value,111.1950802335/1.609344);
assert.equal(shapeLabel(arrow,route(arrow)),'111.2 km');
assert.equal(shapeLabel({...arrow,showLabel:true,label:'Advance'},route(arrow)),'Advance · 111.2 km');
assert.equal(shapeLabel({...arrow,showMeasurement:false},route(arrow)),'');
assert.equal(measurementText({value:.001,unit:'km²'}),'<0.01 km²');
const square={...arrow,shape:'zone',path:[point(0,0),point(1,0),point(1,1),point(0,1)]};
const area=6371.0088**2*Math.PI/180*Math.sin(Math.PI/180);
near(measure(square).value,area,.001);
near(measure({...square,path:[...square.path].reverse()}).value,area,.001);
near(measure({...square,path:[...square.path,square.path[0]]}).value,area,.001);
near(measure({...square,shape:'noFly',measurementUnit:'imperial'}).value,area/1.609344**2,.001);
const dateline={...arrow,path:[point(179,0),point(-179,0)]};
near(measure(dateline).value,222.390160467,.00001);
const dateZone={...square,path:[point(179,0),point(-179,0),point(-179,1),point(179,1)]};
near(measure(dateZone).value,area*2,.001);
const bent={...arrow,path:[point(0,0),point(1,1),point(2,0)]};
assert.ok(measure({...bent,curve:'smooth'}).value>measure(bent).value,'curved-path length follows rendered geometry');
for(const source of [arrow,square,dateline,dateZone,{...bent,curve:'smooth'},{...square,curve:'smooth'},
  {...square,path:square.path.map(p=>({lon:p.lon,lat:p.lat+70}))}]){
  for(const factor of [.25,2,4]){
    const target=measure(source).value*factor,before=structuredClone(source);
    const resized={...source,path:resizeShape(source,target,route)};
    near(measure(resized).value,target,Math.max(.0001,target*.00001));
    assert.deepEqual(source,before,'resizing does not mutate before committing');
    if(!['zone','noFly'].includes(source.shape)){
      near(resized.path[0].lon,source.path[0].lon);near(resized.path[0].lat,source.path[0].lat);
    }
  }
}
for(const unit of ['metric','imperial']){
  for(const source of [arrow,square]){
    const a={...source,measurementUnit:unit},resized={...a,path:resizeShape(a,500,route)};
    near(measure(resized).value,500,.005);
  }
}
for(const target of [0,-1,NaN,Infinity,.001,1e12])assert.throws(()=>resizeShape(arrow,target,route));
assert.throws(()=>resizeShape({...arrow,path:[point(0,0),point(0,0)]},500,route));
assert.throws(()=>resizeShape({...square,path:square.path.slice(0,2)},500,route));
const keyed=structuredClone(arrow);keyed.dur=180;
putPathKey(keyed,60,[point(0,0),point(2,0)]);
const at30={...keyed,path:pathAt(keyed,30)},target=500;
near(measure(at30).value,166.79262035,.001);
putPathKey(keyed,30,resizeShape(at30,target,route));
near(measure({...keyed,path:pathAt(keyed,30)}).value,target,.001);
near(measure({...keyed,path:pathAt(keyed,60)}).value,222.39016047,.001);
const p=newMapProject();p.actions=[arrow,square,keyed].map((a,i)=>({...a,id:'measurement-'+i}));p.frames=300;
assert.doesNotThrow(()=>validateMapProject(JSON.parse(JSON.stringify(p))));
for(const patch of [{showMeasurement:'yes'},{measurementUnit:'bad'}])assert.throws(()=>validateMapProject({...p,actions:[{...arrow,...patch}]}));
console.log('Shape lengths, spherical areas, curves, dateline, units, resizing, anchors, keyed paths, validation and labels passed');

// Measurement labels remain static while the arrow or zone reveals underneath.
const H={actAlpha:()=>1,planeRoute:(_,a)=>route(a),ease:(_,p)=>p,actionProgress:()=>0,project:(_,x,y)=>({x,y,z:1})};
const view={unit:1,cx:.5,near:0};
let strokes=0;
const c=new Proxy({}, {get:(_,key)=>key==='stroke'?()=>strokes++:()=>{},set:()=>true});
for(const source of [arrow,square]){
  const annotation={...source,revealPath:true,measurementOnly:true},first=[],later=[];
  const before=strokes;
  drawShape(H,c,view,null,annotation,0,first);
  drawShape({...H,actionProgress:()=>1},c,view,null,annotation,80,later);
  assert.equal(first.length,1,'measurement text is present at the first frame');
  assert.equal(first[0].alpha,1);
  assert.equal(first[0].text,shapeLabel(annotation,route(annotation)));
  assert.deepEqual(first,later,'measurement position and text do not animate');
  assert.ok(strokes>before,'arrow and zone geometry remains visible, including previously saved text-only items');
}

// Dedicated dropdown shapes measure without a measurement property on other shapes.
const distance=makeAction('shape',0,{shape:'distance',path:arrow.path});
const areaShape=makeAction('shape',0,{shape:'area',path:square.path});
near(measure(distance).value,measure(arrow).value);
near(measure(areaShape).value,measure(square).value);
assert.equal(shapeLabel(distance,route(distance)),'111.2 km');
const project=newMapProject();project.actions=[distance,areaShape];
assert.doesNotThrow(()=>validateMapProject(project));
for(const source of [distance,areaShape]){
  const labels=[],before=strokes;
  drawShape(H,c,view,null,source,0,labels);
  assert.equal(labels.length,1);
  assert.equal(strokes,before,'measurement shapes default to static text');
  const withGeometry={...source,showDistanceArrow:true,showAreaBoundary:true};
  drawShape(H,c,view,null,withGeometry,0,[]);
  assert.ok(strokes>before,'distance arrow and area boundary are optional');
}
