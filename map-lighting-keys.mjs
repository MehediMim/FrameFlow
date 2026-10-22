import { easings } from './easings.mjs';
import { lightingOf, lightingPreset, validateLighting } from './map-lighting.mjs';

export const LIGHTING_FIELDS=['azimuth','altitude','intensity','ambient','warmth','shadowStrength'];
export function lightingAt(a,frame){
  const result={...lightingPreset('day'),...a.lighting,enabled:true,preset:'custom'};
  for(const field of LIGHTING_FIELDS){
    const keys=(a.lightingKeys||[]).filter(k=>k.values[field]!==undefined).sort((a,b)=>a.frame-b.frame);
    if(!keys.length)continue;
    const i=keys.findIndex(k=>k.frame>frame);
    if(i===0){result[field]=keys[0].values[field];continue;}
    if(i<0){result[field]=keys.at(-1).values[field];continue;}
    const left=keys[i-1],right=keys[i],t=Math.max(0,Math.min(1,(easings[a.easing]||easings.easeInOut)((frame-left.frame)/(right.frame-left.frame))));
    let delta=right.values[field]-left.values[field];
    if(field==='azimuth')delta=((delta+540)%360)-180;
    result[field]=left.values[field]+delta*t;
    if(field==='azimuth')result[field]=(result[field]%360+360)%360;
  }
  return result;
}
// Latest starting visible effect wins; array order breaks ties. Outside clips,
// retain the project's baseline lighting. Keys keep their clock after a split.
export function sceneLightingAt(project,frame){
  let selected;
  for(const a of project.actions||[])if(a.type==='effect'&&a.fx==='sunlight'&&a.visible!==false&&frame>=a.start&&frame<a.start+a.dur&&(!selected||a.start>=selected.start))selected=a;
  return selected?lightingAt(selected,frame):lightingOf(project);
}
export function putLightingKey(a,frame,values,seed=true){
  a.lightingKeys||=[];
  const start=a.sourceStart??a.start,base=lightingAt({...a,lightingKeys:[]},start);
  if(seed&&frame>start)for(const field of Object.keys(values))if(!a.lightingKeys.some(k=>k.values[field]!==undefined))putLightingKey(a,start,{[field]:base[field]},false);
  let key=a.lightingKeys.find(k=>k.frame===frame);
  if(!key){key={frame,values:{}};a.lightingKeys.push(key);}
  Object.assign(key.values,values);a.lightingKeys.sort((a,b)=>a.frame-b.frame);
}
export function removeLightingKey(a,frame){a.lightingKeys=(a.lightingKeys||[]).filter(k=>k.frame!==frame);}
export function moveLightingKey(a,from,to){
  if(from===to)return;const key=a.lightingKeys?.find(k=>k.frame===from);if(!key)return;
  removeLightingKey(a,from);putLightingKey(a,to,key.values,false);
}
export function validateLightingEffect(a){
  validateLighting(a.lighting);
  if(a.lightingKeys===undefined)return;
  const bad=()=>{throw Error('Invalid sunlight keyframes.');};
  if(!Array.isArray(a.lightingKeys)||a.lightingKeys.length>500)bad();
  const seen=new Set(),start=a.sourceStart??a.start,end=start+(a.sourceDur??a.dur);
  for(const key of a.lightingKeys){
    if(!key||!Number.isSafeInteger(key.frame)||key.frame<start||key.frame>end||seen.has(key.frame)||!key.values||typeof key.values!=='object'||Array.isArray(key.values)||!Object.keys(key.values).length)bad();
    seen.add(key.frame);
    if(Object.keys(key.values).some(k=>!LIGHTING_FIELDS.includes(k)))bad();
    validateLighting(key.values);
  }
}
