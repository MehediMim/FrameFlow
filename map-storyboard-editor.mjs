import { makeAction, makeShot, ACTION_TYPES, PRESETS, validateMapProject } from './map-engine.mjs?v=shape-sizing-1';

export const STORYBOARD_MAX_BYTES=5e6;
export const PROJECT_SETTING_FIELDS=['width','height','theme','texture','imagery','terrain','lighting','atlasLabels','labelStyle','area','graticule','mapBackground','armyPresets','camera'];
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function checkStoryboardData(value){
  if(!value||typeof value!=='object')return;
  for(const [key,child]of Object.entries(value)){
    if(['__proto__','prototype','constructor'].includes(key))throw Error(`Unsupported script field "${key}".`);
    checkStoryboardData(child);
  }
}
function merge(base,value){
  if(!object(value))return structuredClone(value);
  const out=object(base)?structuredClone(base):{};
  for(const [key,v]of Object.entries(value))out[key]=object(v)?merge(out[key],v):structuredClone(v);
  return out;
}
export function storyboardProjectBase(raw,base){
  checkStoryboardData(raw);
  if(raw?.kind==='map')return structuredClone(raw);
  const settings=raw?.project??{};
  if(raw?.projectMode!==undefined&&!['merge','replace'].includes(raw.projectMode))throw Error('projectMode must be merge or replace.');
  if(!object(settings))throw Error('Storyboard project settings must be an object.');
  for(const key of Object.keys(settings))if(!PROJECT_SETTING_FIELDS.includes(key))throw Error(`Project settings: unknown field "${key}". Use layers, cameraTracks, fps or duration for timeline data.`);
  return merge(raw?.projectMode==='replace'?{version:1,kind:'map'}:base,settings);
}

/** A lossless route for the native editor model, including properties introduced later. */
export function storyboardFromProject(project,audio){
  const p=structuredClone(project);delete p.storyboard;
  validateMapProject(p);
  const {actions,shots,name,fps,frames,version,kind,...settings}=p;
  const result={version:1,name,duration:frames/fps,fps,motion:'none',projectMode:'replace',project:settings,layers:actions,cameraTracks:shots,scenes:[]};
  if(audio!==undefined)result.audio=structuredClone(audio);
  return result;
}
export function storyboardNativeLayers(raw){
  if(!Array.isArray(raw)||raw.length>200)throw Error('Native layers must be an array of up to 200 editor layers.');
  return raw.map((a,i)=>{
    if(!object(a)||!Object.hasOwn(ACTION_TYPES,a.type))throw Error(`Native layer ${i+1}: unknown layer type.`);
    return makeAction(a.type,a.start??0,structuredClone(a));
  });
}
export function storyboardCameraTracks(raw){
  if(!Array.isArray(raw)||raw.length>200)throw Error('cameraTracks must be an array of up to 200 editor camera tracks.');
  return raw.map((s,i)=>{
    if(!object(s)||!Object.hasOwn(PRESETS,s.preset))throw Error(`Camera track ${i+1}: unknown camera preset.`);
    return makeShot(s.preset,s.start??0,structuredClone(s));
  });
}
export function storyboardAudio(raw,seconds,videoDuration){
  if(raw===undefined)return undefined;
  if(!Array.isArray(raw)||raw.length>200)throw Error('audio must be an array of up to 200 audio clips.');
  const ids=new Set();
  return raw.map((a,i)=>{
    if(!object(a))throw Error(`Audio ${i+1}: expected a clip object.`);
    for(const k of Object.keys(a))if(!['id','name','file','start','source','duration','volume','muted'].includes(k))throw Error(`Audio ${i+1}: unknown field "${k}".`);
    if(typeof a.file!=='string'||!a.file||a.file.length>200||/[\\/]/.test(a.file))throw Error(`Audio ${i+1}: file must be the name of a supporting audio file.`);
    const start=seconds(a.start??0,`Audio ${i+1} start`),source=seconds(a.source??0,`Audio ${i+1} source`),duration=seconds(a.duration,`Audio ${i+1} duration`),volume=a.volume??.7;
    if(start+duration>videoDuration+1e-6||duration<=0)throw Error(`Audio ${i+1}: clip timing must fit inside the video.`);
    if(!Number.isFinite(volume)||volume<0||volume>1||a.muted!==undefined&&typeof a.muted!=='boolean')throw Error(`Audio ${i+1}: volume must be 0–1 and muted must be a boolean.`);
    const id=a.id??crypto.randomUUID();if(typeof id!=='string'||!id||ids.has(id))throw Error(`Audio ${i+1}: ids must be unique strings.`);ids.add(id);
    const name=a.name??a.file;if(typeof name!=='string'||name.length>200)throw Error(`Audio ${i+1}: invalid clip name.`);
    return {id,name,file:a.file,start,source,duration,volume,muted:a.muted??false};
  });
}
