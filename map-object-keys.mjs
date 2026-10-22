import { easings } from './easings.mjs';
import { validateObjectView, objectViewOf, OBJECT_VIEWS } from './map-object-view.mjs';
import { validateObjectAnimation } from './map-object-animation.mjs';
export const OBJECT_KEY_FIELDS={size:[.2,8],objectAngle:[-3600,3600]};
export const DAMAGE_STATES={intact:'Intact',damaged:'Damaged',burning:'Burning',destroyed:'Destroyed'};
export function objectPoseAt(a,frame){
  const pose={size:a.size??1,objectAngle:a.objectAngle??0,damageState:a.damageState||'intact',objectView:objectViewOf(a)};
  for(const field of Object.keys(pose)){
    if(field==='objectView'&&['move','path'].includes(a.mode)&&a.objectFacing!=='manual')continue;
    const track=(a.objectKeys||[]).filter(k=>k.values[field]!==undefined).sort((a,b)=>a.frame-b.frame);
    if(!track.length)continue;
    const next=track.findIndex(k=>k.frame>frame);
    if(next===0){pose[field]=track[0].values[field];continue;}
    if(next<0){pose[field]=track.at(-1).values[field];continue;}
    const left=track[next-1],right=track[next];
    if(field==='damageState'||field==='objectView'){pose[field]=left.values[field];continue;}
    const t=(easings[a.easing]||easings.easeInOut)((frame-left.frame)/(right.frame-left.frame));
    const [lo,hi]=OBJECT_KEY_FIELDS[field];pose[field]=Math.max(lo,Math.min(hi,left.values[field]+(right.values[field]-left.values[field])*t));
  }
  return pose;
}
export function putObjectKey(a,frame,values,seed=true){
  a.objectKeys||=[];
  // Seed a starting value when the first edit is later in the clip.
  if(seed&&frame>a.start)for(const field of Object.keys(values))if(!a.objectKeys.some(k=>k.values[field]!==undefined)){
    let start=a.objectKeys.find(k=>k.frame===a.start);if(!start){start={frame:a.start,values:{}};a.objectKeys.push(start);}
    start.values[field]=objectPoseAt({...a,objectKeys:[]},a.start)[field];
  }
  let key=a.objectKeys.find(k=>k.frame===frame);if(!key){key={frame,values:{}};a.objectKeys.push(key);}Object.assign(key.values,values);a.objectKeys.sort((a,b)=>a.frame-b.frame);
}
export function removeObjectKey(a,frame,fields){
  for(const key of a.objectKeys||[])if(key.frame===frame)for(const field of fields)delete key.values[field];
  a.objectKeys=(a.objectKeys||[]).filter(k=>Object.keys(k.values).length);
}
export function moveObjectKey(a,from,to,fields){
  if(from===to)return;const key=a.objectKeys?.find(k=>k.frame===from);if(!key)return;
  const values=Object.fromEntries(Object.entries(key.values).filter(([field])=>fields.includes(field)));
  if(!Object.keys(values).length)return;
  removeObjectKey(a,from,fields);putObjectKey(a,to,values,false);
}
export function validateObjectKeys(a){
  validateObjectView(a);
  validateObjectAnimation(a);
  const bad=()=>{throw Error('Invalid object animation keyframes.');};
  if(a.damageState!==undefined&&!Object.hasOwn(DAMAGE_STATES,a.damageState))bad();
  if(a.autoObjectKey!==undefined&&typeof a.autoObjectKey!=='boolean')bad();
  if(a.objectKeys===undefined)return;
  if(!Array.isArray(a.objectKeys)||a.objectKeys.length>500)bad();
  const seen=new Set();for(const key of a.objectKeys){
    if(!key||!Number.isSafeInteger(key.frame)||key.frame<a.start||key.frame>a.start+a.dur||seen.has(key.frame)||!key.values||typeof key.values!=='object'||Array.isArray(key.values)||!Object.keys(key.values).length)bad();
    seen.add(key.frame);for(const [field,value]of Object.entries(key.values)){
      if(field==='damageState'){if(!Object.hasOwn(DAMAGE_STATES,value))bad();}
      else if(field==='objectView'){if(!Object.hasOwn(OBJECT_VIEWS,value))bad();}
      else{const range=OBJECT_KEY_FIELDS[field];if(!range||!Number.isFinite(value)||value<range[0]||value>range[1])bad();}
    }
  }
}

/** Apply camera zoom after evaluating size keys, without changing saved key values. */
export function objectSizeAt(a, frame, zoom) {
  return objectPoseAt(a, frame).size * (a.sizeMode === 'map' ? 2 ** (zoom - (a.sizeZoom ?? 3)) : 1);
}
