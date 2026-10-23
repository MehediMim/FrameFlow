import assert from 'node:assert/strict';
import {naturalTrailKind,movementTrailKind,movementTrailGeometry,drawMovementTrail} from '../map-object-trails.mjs';
import {makeAction,newMapProject,validateMapProject} from '../map-engine.mjs';
const H={ease:(_e,p)=>p,actionProgress:(a,f)=>Math.max(0,Math.min(1,(f-a.start)/(a.animDur||a.dur))),routeAt:(_r,p)=>({X:p,Y:p*p}),project:(_v,X,Y)=>({x:X*800,y:Y*400,z:1})};
const v={unit:1,fps:30,near:0},route={},vehicle={glyph:'car',mode:'path',start:0,dur:240,animDur:120};
assert.equal(naturalTrailKind('car'),'tracks');assert.equal(naturalTrailKind('tank'),'tracks');assert.equal(naturalTrailKind('bicycle'),'tracks');
assert.equal(naturalTrailKind('ferry'),'wake');assert.equal(naturalTrailKind('galleon'),'wake');assert.equal(naturalTrailKind('soldier'),'route');
assert.equal(movementTrailKind({...vehicle,trailStyle:'route'}),'route');
const tracks=movementTrailGeometry(H,v,route,vehicle,60,.5,0,26);
assert.ok(tracks.length<=33&&tracks.length>2,'track work is bounded');
assert.equal(tracks[0].x,400,'tracks follow the current vehicle position');
assert.ok(tracks.at(-1).behind<=26*2+1e-7&&tracks.at(-1).x>0,'tracks stay close to the vehicle instead of covering the route');
const laterTracks=movementTrailGeometry(H,v,route,vehicle,90,.75,0,26);
assert.ok(laterTracks.every(p=>p.x>tracks[0].x),'old tracks disappear as the vehicle moves');
assert.deepEqual(tracks,movementTrailGeometry(H,{...v,fps:60},route,{...vehicle,dur:480,animDur:240},120,.5,0,26),'tracks are independent of export frame rate');
assert.deepEqual(movementTrailGeometry(H,v,route,vehicle,150,1,0,26),[],'tracks vanish after the vehicle stops');
assert.deepEqual(tracks,movementTrailGeometry(H,v,route,vehicle,60,.5,0,26),'seeking reproduces the same ground marks');
assert.deepEqual(movementTrailGeometry(H,v,route,{...vehicle,trail:false},60,.5,0,26),[]);
assert.deepEqual(movementTrailGeometry(H,v,route,{...vehicle,mode:'stay'},60,.5,0,26),[]);
assert.deepEqual(movementTrailGeometry(H,v,route,vehicle,0,0,0,26),[]);
const boat={...vehicle,glyph:'ferry'},wake=movementTrailGeometry(H,v,route,boat,60,.5,0,26);
assert.ok(wake.length<=65&&wake.length>2);assert.equal(wake[0].x,400,'wake starts at the boat');
assert.ok(wake.at(-1).behind<=26*8+1e-7,'wake has a bounded screen length');
assert.deepEqual(wake,movementTrailGeometry(H,{...v,fps:60},route,{...boat,dur:480,animDur:240},120,.5,0,26),'wake is independent of export frame rate');
assert.deepEqual(movementTrailGeometry(H,v,route,boat,240,1,0,26),[],'wake vanishes after the boat has stopped');
const hidden={...H,project:()=>({x:0,y:0,z:-1})};assert.ok(movementTrailGeometry(hidden,v,route,vehicle,60,.5,0,26).every(p=>p===null),'trails do not bridge the horizon');
function record(a,frame=60){
  const commands=[],stack=[],c=new Proxy({globalAlpha:1,save(){stack.push(this.globalAlpha)},restore(){this.globalAlpha=stack.pop()}},{get:(o,k)=>k in o?o[k]:k==='stroke'?()=>commands.push(['stroke',o.globalAlpha]):(...args)=>commands.push([k,...args]),set:(o,k,val)=>{commands.push([k,val]);o[k]=val;return true;}});
  drawMovementTrail(H,c,v,route,a,frame,Math.min(1,frame/120),0,26);return commands;
}
assert.notDeepEqual(record(vehicle),record(boat),'tires and water use different strokes');
assert.deepEqual(record(vehicle),record(vehicle),'strokes are deterministic');
assert.equal(record(vehicle).filter(c=>c[0]==='stroke').length,4,'tire tracks use four strokes');
assert.equal(record(boat).filter(c=>c[0]==='stroke').length,12,'wakes use twelve strokes without particles');
assert.ok(record({...boat,opacity:.25}).filter(c=>c[0]==='stroke').every(c=>c[1]<=.25),'wake honors object opacity');
const project=newMapProject();project.actions=[makeAction('object',0,{glyph:'ferry',trailStyle:'auto'})];validateMapProject(JSON.parse(JSON.stringify(project)));
for(const bad of [{trailStyle:'unknown'},{trail:'yes'}]){const copy=structuredClone(project);Object.assign(copy.actions[0],bad);assert.throws(()=>validateMapProject(copy),/trail/);}
console.log('Movement trails: short tire/water tails, stop fading, opacity, seeking, FPS, constant stroke counts and validation passed');
