import { easings } from './easings.mjs';
import { retimeMapItem } from './map-timing.mjs?v=full-timeline-1';
import { OBJECT_ICONS } from './map-objects.mjs';
import { objectPoseAt } from './map-object-keys.mjs';
import { isIsometricView } from './map-object-view.mjs';
export const GROUP_FIELDS={lon:[-540,540],lat:[-85,85],scale:[.1,8],rotation:[-3600,3600],opacity:[0,1]};
const toX=lon=>(lon+180)/360,toY=lat=>(1-Math.log(Math.tan(Math.PI/4+Math.max(-85,Math.min(85,lat))*Math.PI/360))/Math.PI)/2;
const toLat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI;
export function groupPoseAt(group,frame){
  const pose={lon:group.origin.lon,lat:group.origin.lat,scale:1,rotation:0,opacity:1,...group.transform};
  for(const field of Object.keys(GROUP_FIELDS)){
    const keys=(group.groupKeys||[]).filter(k=>k.values[field]!==undefined).sort((a,b)=>a.frame-b.frame);if(!keys.length)continue;
    const next=keys.findIndex(k=>k.frame>frame);if(next===0){pose[field]=keys[0].values[field];continue;}if(next<0){pose[field]=keys.at(-1).values[field];continue;}
    const l=keys[next-1],r=keys[next],t=Math.max(0,Math.min(1,(easings[group.easing]||easings.easeInOut)((frame-l.frame)/(r.frame-l.frame))));
    pose[field]=l.values[field]+(r.values[field]-l.values[field])*t;
  }return pose;
}
export function putGroupKey(group,frame,values,seed=true){
  group.groupKeys||=[];
  if(seed&&frame>group.start)for(const field of Object.keys(values))if(!group.groupKeys.some(k=>k.values[field]!==undefined)){
    let key=group.groupKeys.find(k=>k.frame===group.start);if(!key){key={frame:group.start,values:{}};group.groupKeys.push(key);}key.values[field]=groupPoseAt({...group,groupKeys:[]},group.start)[field];
  }
  let key=group.groupKeys.find(k=>k.frame===frame);if(!key){key={frame,values:{}};group.groupKeys.push(key);}Object.assign(key.values,values);group.groupKeys.sort((a,b)=>a.frame-b.frame);
}
export function moveGroupKey(group,from,to){const key=group.groupKeys?.find(k=>k.frame===from);if(!key||from===to)return;group.groupKeys=group.groupKeys.filter(k=>k.frame!==from&&k.frame!==to);putGroupKey(group,to,key.values,false);}
export function transformGroupPoint(point,group,pose){
  const ox=toX(group.origin.lon),oy=toY(group.origin.lat),x=toX(point.lon),dx=x+Math.round(ox-x)-ox,dy=toY(point.lat)-oy,angle=pose.rotation*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  const lon=(toX(pose.lon)+(dx*c-dy*s)*pose.scale)*360-180;
  return{...point,lon:((lon+180)%360+360)%360-180,lat:toLat(toY(pose.lat)+(dx*s+dy*c)*pose.scale)};
}
export function transformGroupObject(object,group,frame){
  const pose=groupPoseAt(group,frame),out={...object,_groupScale:pose.scale,_groupRotation:pose.rotation,groupOpacity:pose.opacity};
  for(const key of ['place','from','to'])if(out[key]&&Number.isFinite(out[key].lon))out[key]=transformGroupPoint(out[key],group,pose);
  if(out.path)out.path=out.path.map(p=>transformGroupPoint(p,group,pose));
  return out;
}
export function makeObjectGroup(project,ids,resolve,id){
  const members=project.actions.filter(a=>a.type==='object'&&ids.includes(a.id));
  if(members.length<2)throw Error('Select at least two objects.');
  if(project.actions.some(g=>g.type==='group'&&g.memberIds.some(id=>ids.includes(id))))throw Error('Ungroup these objects before making another group.');
  if(project.actions.length>=200)throw Error('A map can contain up to 200 items.');
  const points=members.map(resolve);if(points.some(p=>!p))throw Error('Choose a starting location for every object.');
  const x=toX(points[0].lon),xs=points.map(p=>{const n=toX(p.lon);return n+Math.round(x-n);}),start=Math.min(...members.map(a=>a.start)),end=Math.max(...members.map(a=>a.start+a.dur));
  const origin={lon:xs.reduce((a,b)=>a+b,0)/xs.length*360-180,lat:Math.max(-85,Math.min(85,points.reduce((n,p)=>n+p.lat,0)/points.length))};
  const group={id,type:'group',name:'Object group',start,dur:end-start,easing:'easeInOut',color:'#a7b887',origin,memberIds:members.map(a=>a.id),transform:{lon:origin.lon,lat:origin.lat,scale:1,rotation:0,opacity:1},groupKeys:[]};
  project.actions.splice(project.actions.indexOf(members[0]),0,group);return group;
}
export function retimeGroup(project,group,start,dur,moveKeys=true){
  const delta=start-group.start;
  if(moveKeys&&delta)for(const child of project.actions.filter(a=>group.memberIds.includes(a.id)))retimeMapItem(child,Math.max(0,child.start+delta),child.dur,true);
  retimeMapItem(group,start,dur,moveKeys);
}
export function ungroupObjects(project,group,frame,resolve){
  const pose=groupPoseAt(group,frame),copies=new Map();
  for(const original of project.actions.filter(a=>group.memberIds.includes(a.id))){
    let child=structuredClone(original);
    for(const key of ['place','from','to'])if(child[key]&&!Number.isFinite(child[key].lon)&&resolve){const p=resolve(child[key]);if(p)child[key]={kind:'point',name:child[key].name,lon:p.X*360-180,lat:toLat(p.Y)};}
    child=transformGroupObject(child,group,frame);child.size=(child.size||1)*pose.scale;
    const followsHeading=child.mode==='wallPath'||(!isIsometricView(objectPoseAt(child,frame))&&['path','move'].includes(child.mode)&&OBJECT_ICONS[child.glyph]?.rot),rotation=followsHeading?0:pose.rotation;
    child.objectAngle=(child.objectAngle||0)+rotation;child.opacity=(child.opacity??1)*pose.opacity;
    child.formationAngle=(((child.formationAngle||0)+pose.rotation+180)%360+360)%360-180;
    for(const key of child.objectKeys||[]){if(key.values.size!==undefined)key.values.size*=pose.scale;if(key.values.objectAngle!==undefined)key.values.objectAngle+=rotation;}
    if(child.size<.2||child.size>80||Math.abs(child.objectAngle)>3600||child.objectKeys?.some(k=>(k.values.size!==undefined&&(k.values.size<.2||k.values.size>8))||(k.values.objectAngle!==undefined&&Math.abs(k.values.objectAngle)>3600)))throw Error('Ungroup would exceed an object’s size or rotation limits. Reduce the group transform first.');
    const start=Math.max(child.start,group.start),end=Math.min(child.start+child.dur,group.start+group.dur);
    if(start!==child.start||end!==child.start+child.dur){child.sourceStart??=child.start;child.sourceDur??=child.dur;child.start=start;child.dur=end-start;}
    delete child._groupScale;delete child._groupRotation;delete child.groupOpacity;
    copies.set(child.id,child.dur>0?child:null);
  }
  project.actions=project.actions.filter(a=>a!==group).flatMap(a=>copies.has(a.id)?(copies.get(a.id)?[copies.get(a.id)]:[]):[a]);
}
export function validateObjectGroups(project){
  const objects=new Map(project.actions.filter(a=>a.type==='object').map(a=>[a.id,a])),assigned=new Set();
  for(const g of project.actions.filter(a=>a.type==='group')){
    if(!g.origin||!Number.isFinite(g.origin.lon)||Math.abs(g.origin.lon)>540||!Number.isFinite(g.origin.lat)||Math.abs(g.origin.lat)>85||!Array.isArray(g.memberIds)||g.memberIds.length<1||g.memberIds.length>100||new Set(g.memberIds).size!==g.memberIds.length)throw Error('Invalid object group.');
    for(const id of g.memberIds){if(!objects.has(id)||assigned.has(id))throw Error('An object can belong to only one group.');assigned.add(id);}
    const valid=values=>values&&typeof values==='object'&&!Array.isArray(values)&&Object.entries(values).every(([k,v])=>GROUP_FIELDS[k]&&Number.isFinite(v)&&v>=GROUP_FIELDS[k][0]&&v<=GROUP_FIELDS[k][1]);
    if(!valid(g.transform))throw Error('Invalid group transform.');
    if(g.groupKeys!==undefined){if(!Array.isArray(g.groupKeys)||g.groupKeys.length>500)throw Error('Too many group keyframes.');const start=g.sourceStart??g.start,end=start+(g.sourceDur??g.dur),seen=new Set();for(const k of g.groupKeys){if(!k||!Number.isSafeInteger(k.frame)||k.frame<start||k.frame>end||seen.has(k.frame)||!valid(k.values)||!Object.keys(k.values).length)throw Error('Invalid group keyframe.');seen.add(k.frame);}}
  }
}
