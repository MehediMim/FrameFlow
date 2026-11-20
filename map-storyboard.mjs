import { makeAction, makeShot, newMapProject, validateMapProject, resolveLoc, xToLon, yToLat, THEMES } from './map-engine.mjs?v=shape-sizing-1';
import { CITIES } from './map-places.mjs';
import { OBJECT_ICONS, EFFECTS, SHAPES } from './map-objects.mjs?v=shape-sizing-1';
import { putCameraKey } from './map-camera.mjs?v=composed-follow-4';
import { putObjectKey } from './map-object-keys.mjs';
import { applyDocumentaryLook } from './map-documentary.mjs';
import { applyAntiqueLook } from './map-antique.mjs';
import { storyboardMotion, addStoryboardCamera } from './map-storyboard-motion.mjs';
import { LAYER_OPTION_FIELDS } from './map-storyboard-fields.mjs';
import { STORYBOARD_MAX_BYTES, PROJECT_SETTING_FIELDS, storyboardProjectBase, storyboardFromProject, storyboardNativeLayers, storyboardCameraTracks, storyboardAudio, checkStoryboardData } from './map-storyboard-editor.mjs';
import { putPathKey } from './map-path-animation.mjs?v=shape-sizing-1';
import { putGroupKey } from './map-object-groups.mjs';
import { putLightingKey } from './map-lighting-keys.mjs';

const object = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const fail = message => { throw Error(message); };
const fields = (v, allowed, where) => {
  if (!object(v)) fail(`${where}: expected an object.`);
  for (const k of Object.keys(v)) if (!allowed.includes(k)) fail(`${where}: unknown field "${k}".`);
};
const TOP = ['version','name','duration','fps','theme','initialView','motion','scenes','project','projectMode','layers','cameraTracks','audio'];
const SCENE = ['start','end','duration','title','type','description','narration','year','endYear','yearEra','panel','from','to','place','target','route','unit','units','count','troopCount','color','effect','effects','camera','actions','motion','size','sizeFrom','sizeTo'];
const ACTION = ['id','type','name','start','end','duration','animateFor','from','to','place','target','path','color','unit','units','count','troopCount','effect','shape','text','options','keys','motion','size','sizeFrom','sizeTo','animation','movement'];
const OPTIONS = LAYER_OPTION_FIELDS;
export const STORYBOARD_FIELDS={root:TOP,scene:SCENE,action:ACTION,projectSettings:PROJECT_SETTING_FIELDS};

/** Seconds or a video timestamp; independent of historical years in scene panels. */
export function storyboardSeconds(value, where = 'Time') {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value !== 'string') fail(`${where}: use seconds or MM:SS / HH:MM:SS.`);
  const s = value.trim();
  if (/^\d+(?:\.\d+)?(?:s)?$/.test(s)) return Number(s.replace(/s$/, ''));
  const m = s.match(/^(\d+):([0-5]\d)(?:\.([0-9]+))?$/);
  if (m) return Number(m[1]) * 60 + Number(m[2]) + Number('0.' + (m[3] || '0'));
  const h = s.match(/^(\d+):([0-5]\d):([0-5]\d)(?:\.([0-9]+))?$/);
  if (h) return Number(h[1]) * 3600 + Number(h[2]) * 60 + Number(h[3]) + Number('0.' + (h[4] || '0'));
  fail(`${where}: "${s}" is not a valid video timestamp.`);
}

/** The text format deliberately uses explicit fields, never guesses instructions from prose. */
export function parseStoryboard(source) {
  if (typeof source !== 'string' || !source.trim()) fail('Upload a storyboard or paste its contents first.');
  if (source.length > STORYBOARD_MAX_BYTES) fail('Storyboard must be smaller than 5 MB.');
  const text = source.replace(/^\uFEFF/, '').trim();
  if (text.startsWith('{') || text.startsWith('[') && !/^\[\d[^\]\n]*\s[-–]\s/.test(text)) {
    try { return JSON.parse(text); } catch (e) { fail('Invalid JSON: ' + e.message); }
  }
  const result = {version:1, scenes:[]}; let current = result;
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim(); if (!line || line.startsWith('#') || line.startsWith('//')) continue;
    const header = line.match(/^\[([^\]]+?)\s+[-–]\s+([^\]]+)\]\s*(.*)$/);
    if (header) { current = {start:header[1].trim(),end:header[2].trim(),title:header[3].trim()}; result.scenes.push(current); continue; }
    const pair = line.match(/^([a-zA-Z][a-zA-Z0-9]*)\s*:\s*(.*)$/);
    if (!pair) fail(`Line ${index+1}: use "field: value" or "[00:00 - 00:30] Scene title".`);
    let [,key,value] = pair;
    if (/^(?:[\[{\"]|true$|false$|null$|-?\d+(?:\.\d+)?$)/.test(value)) {
      try { value = JSON.parse(value); } catch { fail(`Line ${index+1}: invalid JSON value for ${key}.`); }
    }
    if (key === 'action' && current !== result) (current.actions ||= []).push(value);
    else { if (Object.hasOwn(current,key)) fail(`Line ${index+1}: duplicate field "${key}".`); current[key] = value; }
  }
  return result;
}

function timed(raw, parent, fps, where) {
  const start = raw.start === undefined ? parent.start : Math.round(storyboardSeconds(raw.start, where+' start') * fps);
  const end = raw.end === undefined ? raw.duration === undefined ? parent.end : start + Math.round(storyboardSeconds(raw.duration,where+' duration')*fps) : Math.round(storyboardSeconds(raw.end,where+' end')*fps);
  if (raw.end !== undefined && raw.duration !== undefined) fail(`${where}: choose end or duration, not both.`);
  if (![start,end].every(Number.isSafeInteger) || start < parent.start || end > parent.end || end <= start) fail(`${where}: timing must fit inside ${parent.label} and last at least one frame.`);
  return {start,end,dur:end-start};
}

export function storyboardLocation(value, geo, where = 'Location') {
  if (typeof value === 'string') {
    const name = value.trim(), lower = name.toLowerCase();
    const coord = name.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if (coord) return storyboardLocation({lat:Number(coord[1]),lon:Number(coord[2]),name},geo,where);
    const features = [...(geo?.byName?.entries() || [])].filter(([key,f])=>[key,f.name,...(f.aliases||[])].some(n=>n?.toLowerCase()===lower));
    if (features.length === 1) { const [key,f] = features[0]; return {kind:f.level?'region':'country',name:key,...(f.level?{country:f.country}:{})}; }
    if (features.length > 1) fail(`${where}: "${name}" is ambiguous. Use its full region key or coordinates.`);
    const cities = [...CITIES,...(geo?.cities||[])].filter(c=>c[0].toLowerCase()===lower);
    const unique = [...new Map(cities.map(c=>[`${c[1]},${c[2]}`,c])).values()];
    if (unique.length === 1) return {kind:'city',name:unique[0][0],lat:unique[0][1],lon:unique[0][2]};
    fail(`${where}: unknown or ambiguous place "${name}". Use a map name or {"name":"${name}","lat":0,"lon":0}.`);
  }
  if (!object(value)) fail(`${where}: specify a place name or a location object.`);
  if(value.kind==='all')return structuredClone(value);
  if (Number.isFinite(value.lat) && Number.isFinite(value.lon)) {
    if (Math.abs(value.lat)>85 || Math.abs(value.lon)>180) fail(`${where}: latitude must be -85…85 and longitude -180…180.`);
    return {kind:'point',name:value.name || `${value.lat}, ${value.lon}`,lat:value.lat,lon:value.lon};
  }
  if (['country','region','regions','polygon'].includes(value.kind) && resolveLoc(geo,value)) return structuredClone(value);
  fail(`${where}: location is missing coordinates or does not exist in the selected map.`);
}

function point(value,geo,where) {
  const loc = storyboardLocation(value,geo,where), p = resolveLoc(geo,loc);
  if (!p) fail(`${where}: location cannot be resolved.`);
  return {kind:'point',name:loc.name,lon:xToLon(p.X),lat:yToLat(p.Y)};
}

function shortText(v, max, where) {
  if (typeof v !== 'string' || v.length > max) fail(`${where}: use text up to ${max} characters.`);
  return v;
}

/** Pure compilation. Nothing in the editor is mutated until the user builds the preview. */
export function compileStoryboard(input, base = newMapProject(), geo) {
  let raw = typeof input === 'string' ? parseStoryboard(input) : structuredClone(input);
  checkStoryboardData(raw);
  if(raw?.kind==='map')raw=storyboardFromProject(raw);
  fields(raw,TOP,'Storyboard');
  const defaultMotion=storyboardMotion(raw.motion);
  if (raw.version !== undefined && raw.version !== 1) fail('Storyboard version must be 1.');
  const fps = raw.fps ?? base.fps;
  if (![24,30,60].includes(fps)) fail('Storyboard fps must be 24, 30 or 60.');
  const frames = Math.round(storyboardSeconds(raw.duration,'Video duration')*fps);
  if (!Number.isSafeInteger(frames) || frames<2) fail('Video duration must be at least two frames.');
  const scriptScenes=raw.scenes??[];
  if (!Array.isArray(scriptScenes) || scriptScenes.length>100 || !scriptScenes.length&&raw.layers===undefined&&raw.cameraTracks===undefined) fail('Storyboard needs 1–100 scenes, or native layers / cameraTracks.');
  const project = storyboardProjectBase(raw,base);
  project.name = shortText(raw.name ?? 'Storyboard map',160,'Storyboard name');
  project.fps = fps; project.frames = frames; project.actions = raw.layers===undefined?[]:storyboardNativeLayers(raw.layers); project.shots = raw.cameraTracks===undefined?[]:storyboardCameraTracks(raw.cameraTracks);
  const audio=storyboardAudio(raw.audio,storyboardSeconds,frames/fps);
  if (raw.theme !== undefined) {
    if (!Object.hasOwn(THEMES,raw.theme)) fail('Unknown storyboard theme.');
    if(raw.theme==='documentary')applyDocumentaryLook(project);else if(raw.theme==='antique')applyAntiqueLook(project);else project.theme=raw.theme;
  }
  if (raw.initialView !== undefined) {
    fields(raw.initialView,['lon','lat','zoom','pitch','bearing'],'Initial view');
    project.camera.init = {...project.camera.init,...raw.initialView};
  }
  if(raw.cameraTracks===undefined)delete project.camera.activeTrack;
  const track = raw.cameraTracks===undefined?makeShot('keyframed',0,{name:'Storyboard camera',dur:frames,fullTimelineCamera:true,followInitialView:false,cameraFrom:{...project.camera.init},cameraTo:{...project.camera.init},cameraKeys:[]}):null;
  if(track){project.shots.push(track);putCameraKey(track,0,{...project.camera.init});}
  const warnings = [], scenes = [];
  let lastEnd = 0, order = Math.max(0,...project.actions.map(a=>a.createdOrder??0))+1;const cameraRanges=[];
  const add = (a,where) => {
    if(project.actions.length>=200)fail(`${where}: storyboard exceeds the editor limit of 200 layers. Reduce actions or scenes.`);
    a.createdOrder??=order++;project.actions.push(a);
    // Groups may refer forward to objects later in the script.
    try { validateMapProject({...project,actions:project.actions.filter(item=>item.type!=='group')}); } catch(e) { fail(`${where}: ${e.message}`); }
    return a;
  };
  const compileAction = (a,parent,where) => {
    fields(a,ACTION,where);
    const timing=timed(a,parent,fps,where), type=({route:'shape',travel:'object',army:'object'})[a.type]||a.type;
    if (!['scene','border','highlight','pin','label','object','effect','shape','plane','group'].includes(type)) fail(`${where}: unsupported action type "${a.type}".`);
    const options=a.options||{};fields(options,OPTIONS,where+' options');
    const extra={...structuredClone(options),dur:timing.dur,animDur:options.animDur??timing.dur};
    if(a.id!==undefined){if(typeof a.id!=='string'||!a.id||a.id.length>100)fail(`${where}: id must be a nonempty string of up to 100 characters.`);extra.id=a.id;}
    const motion=storyboardMotion(a.motion,parent.motion??defaultMotion,where+' motion');
    if(a.size!==undefined)extra.size=a.size;
    if(a.name!==undefined)extra.name=shortText(a.name,160,where+' name');
    if(a.color!==undefined)extra.color=a.color;
    if(a.animateFor!==undefined){extra.animDur=Math.round(storyboardSeconds(a.animateFor,where+' animateFor')*fps);if(extra.animDur<1||extra.animDur>timing.dur)fail(`${where}: animateFor must fit inside the action.`);}
    for(const key of ['from','to','place','target'])if(a[key]!==undefined)extra[key]=storyboardLocation(a[key],geo,where+' '+key);
    else if(extra[key]!==undefined)extra[key]=storyboardLocation(extra[key],geo,where+' options '+key);
    for(const key of ['highlightOrigin'])if(extra[key]!==undefined)extra[key]=point(extra[key],geo,where+' '+key);
    for(const key of ['highlightExclude'])if(extra[key]!==undefined){if(!Array.isArray(extra[key]))fail(`${where}: ${key} must be an array.`);extra[key]=extra[key].map(v=>storyboardLocation(v,geo,where+' '+key));}
    if(a.path!==undefined){
      const path=typeof a.path==='string'?a.path.split('>').map(s=>s.trim()):a.path;
      if(!Array.isArray(path)||path.length<2||path.length>120)fail(`${where}: path needs 2–120 locations.`);
      extra.path=path.map((p,i)=>point(p,geo,`${where} path ${i+1}`));
    }
    if(type==='object'){
      extra.glyph=a.type==='army'||a.units?'army':a.unit||extra.glyph||'soldier';
      if(!Object.hasOwn(OBJECT_ICONS,extra.glyph))fail(`${where}: unknown unit "${extra.glyph}".`);
      if(a.units!==undefined)extra.armyUnits=a.units;
      if(a.count!==undefined)extra.count=a.count;
      if(extra.path?.length){extra.mode=extra.mode==='wallPath'?'wallPath':'path';extra.place=extra.path[0];}
      else if(extra.to){extra.mode='move';extra.place=extra.place||extra.from;}
      if(!extra.place)fail(`${where}: object needs place, from/to, or path.`);
      if(a.troopCount!==undefined){
        if(!Number.isSafeInteger(a.troopCount)||a.troopCount<1)fail(`${where}: troopCount must be a positive whole number.`);
        extra.label=extra.label||`${a.troopCount.toLocaleString('en-US')} troops`;extra.showLabel=true;
      }
    }
    if(type==='shape'){
      extra.shape=a.shape||extra.shape||'arrow';
      if(!Object.hasOwn(SHAPES,extra.shape))fail(`${where}: unknown shape "${extra.shape}".`);
      if(!extra.path&&extra.from&&extra.to)extra.path=[point(extra.from,geo,where+' from'),point(extra.to,geo,where+' to')];
      if(!extra.path||extra.path.length<(['zone','area'].includes(extra.shape)?3:2))fail(`${where}: shape needs a path with enough locations.`);
    }
    if(type==='effect'){
      extra.fx=a.effect||extra.fx||'explosion';
      if(!Object.hasOwn(EFFECTS,extra.fx))fail(`${where}: unknown effect "${extra.fx}".`);
      if(!extra.place&&extra.fx!=='sunlight')fail(`${where}: effect needs place.`);
      if(extra.from)extra.attackTargeted=true;
    }
    if(['border','highlight'].includes(type)&&!extra.target)fail(`${where}: ${type} needs target.`);
    if(type==='pin'){
      extra.place??=extra.from??extra.path?.[0];
      if(extra.path?.length)extra.mode='path';else if(extra.to)extra.mode='move';
      if(!extra.place&&extra.labelPlacement!=='screen')fail(`${where}: pin needs place.`);
    }
    if(type==='plane'){
      if(extra.path?.length)extra.mode='path';
      else if(!extra.from||!extra.to)fail(`${where}: plane travel needs from/to or path.`);
    }
    if(type==='label'){
      extra.text=shortText(a.text??extra.text??'',160,where+' text');
      if(extra.place)extra.labelPlacement='map';
    }
    const item=makeAction(type,timing.start,extra);
    for(const [field,prefix]of [['animation','anim'],['movement','move']])if(a[field]!==undefined){
      fields(a[field],['start','end','duration'],where+' '+field);const range=timed(a[field],{...timing,label:'the action'},fps,where+' '+field);
      item[prefix+'Start']=range.start;item[prefix+'End']=range.end;if(prefix==='anim')item.animDur=range.dur;
    }
    if(type==='object'){
      if(!Number.isFinite(item.size)||item.size<.2||item.size>80)fail(`${where}: Invalid size.`);
      const sizeKeyed=[...(Array.isArray(a.keys)?a.keys:[]),...(Array.isArray(item.objectKeys)?item.objectKeys:[])].some(k=>k?.values?.size!==undefined);
      const resizing=a.sizeFrom!==undefined||a.sizeTo!==undefined;
      if(resizing||motion!=='none'&&!sizeKeyed&&item.size<=8){
        const strength=motion==='subtle'?.4:1;
        const size=item.size??1.2,from=a.sizeFrom??(resizing?size:Math.max(.2,size*(1-.16*strength))),to=a.sizeTo??(resizing?size:Math.min(8,size*(1+.12*strength)));
        for(const value of [from,to])if(!Number.isFinite(value)||value<.2||value>8)fail(`${where}: animated size must be between 0.2 and 8.`);
        item.size=from;
        putObjectKey(item,timing.start,{size:from},false);
        if(timing.dur>1)putObjectKey(item,timing.end-1,{size:to},false);
      }
      if(motion!=='none'&&options.autoObjectKey===undefined)item.autoObjectKey=true;
    }else if(a.sizeFrom!==undefined||a.sizeTo!==undefined)fail(`${where}: sizeFrom and sizeTo apply to objects.`);
    if(a.keys!==undefined){
      if(!Array.isArray(a.keys)||a.keys.length>500||!['object','shape','group'].includes(type)&&!(type==='effect'&&item.fx==='sunlight'))fail(`${where}: keys support objects, shapes, groups, and sunlight.`);
      for(const [i,key] of a.keys.entries()){
        fields(key,['at','frame','values','path'],`${where} key ${i+1}`);
        if(key.at!==undefined&&key.frame!==undefined)fail(`${where}: key uses at or frame, not both.`);
        const at=key.frame??Math.round(storyboardSeconds(key.at,where+' key time')*fps);
        if(!Number.isSafeInteger(at)||at<timing.start||at>timing.end)fail(`${where}: key must be inside the action and contain values.`);
        if(type==='shape'){
          if(!Array.isArray(key.path)||key.values!==undefined)fail(`${where}: shape keys need path.`);
          putPathKey(item,at,key.path.map(v=>point(v,geo,where+' key path')));
        }else{
          if(!object(key.values)||!Object.keys(key.values).length||key.path!==undefined)fail(`${where}: key must be inside the action and contain values.`);
          ({object:putObjectKey,group:putGroupKey,effect:putLightingKey})[type](item,at,key.values);
        }
      }
    }
    return add(item,where);
  };
  for(const [index,s] of scriptScenes.entries()){
    const where=`Scene ${index+1}`;fields(s,SCENE,where);
    if(s.start===undefined)fail(`${where}: start is required.`);
    const t=timed(s,{start:0,end:frames,label:'the video'},fps,where);
    if(index&&t.start<scenes.at(-1).start)fail(`${where}: scenes must be ordered by start time.`);
    if(t.start>lastEnd)warnings.push(`No scene covers ${formatStoryboardTime(lastEnd/fps)}–${formatStoryboardTime(t.start/fps)}; the map and camera hold.`);
    if(t.start<lastEnd)warnings.push(`${where} overlaps an earlier scene. Its layers play together.`);
    lastEnd=Math.max(lastEnd,t.end);
    const title=shortText(s.title??`Scene ${index+1}`,160,where+' title'), description=shortText(s.description??s.narration??'',2000,where+' description');
    const narration=shortText(s.narration??'',10000,where+' narration');
    const motion=storyboardMotion(s.motion,defaultMotion,where+' motion');
    const parent={...t,label:where,motion}, ids=[], before=project.actions.length;
    const kind=s.type||'custom';
    if(!['custom','war','battle','conquest','travel','route','incident','highlight'].includes(kind))fail(`${where}: unsupported scene type "${kind}".`);
    if(s.panel!==false){
      if(s.panel!==undefined&&s.panel!==true&&!object(s.panel))fail(`${where}: panel must be true, false or panel settings.`);
      const options=object(s.panel)?s.panel:{};
      compileAction({type:'scene',name:title,color:s.color??'#d9b767',options:{eventTitle:title,description,startYear:s.year??1,endYear:s.endYear??s.year??1,autoYear:s.endYear!==undefined,showYear:s.year!==undefined,yearEra:s.yearEra??'',...options}},parent,where+' panel');
    }
    const route=s.route??(s.from!==undefined&&s.to!==undefined?[s.from,s.to]:undefined);
    const common=Object.fromEntries(['color','count','troopCount','unit','units','size','sizeFrom','sizeTo'].filter(k=>s[k]!==undefined).map(k=>[k,s[k]]));
    if(route!==undefined)compileAction({type:'route',name:title+' · route',path:route,...(s.color!==undefined?{color:s.color}:{})},parent,where+' route');
    if(s.unit!==undefined||s.units!==undefined||s.count!==undefined||s.troopCount!==undefined||['travel','war','battle','conquest'].includes(kind)){
      const place=s.place??s.from??s.to;
      compileAction({type:'object',name:title+' · units',...common,...(route!==undefined?{path:route}:place!==undefined?{place}:{})},parent,where+' units');
    }
    if(['conquest','highlight'].includes(kind)||s.target!==undefined)compileAction({type:'highlight',name:title+' · territory',target:s.target??s.to,...(s.color!==undefined?{color:s.color}:{})},parent,where+' territory');
    if(['war','battle','incident'].includes(kind)||s.effect!==undefined){
      const place=s.place??s.to;
      compileAction({type:'effect',name:title+' · effect',place,effect:s.effect??(['war','battle'].includes(kind)?'artilleryBarrage':'explosion'),...(s.color!==undefined?{color:s.color}:{})},parent,where+' effect');
    }
    if(s.effects!==undefined){if(!Array.isArray(s.effects))fail(`${where}: effects must be an array.`);s.effects.forEach((e,i)=>compileAction({...e,type:'effect'},parent,`${where} effect ${i+1}`));}
    if(s.actions!==undefined){if(!Array.isArray(s.actions)||s.actions.length>200)fail(`${where}: actions must be an array of up to 200 actions.`);s.actions.forEach((a,i)=>compileAction(a,parent,`${where} action ${i+1}`));}
    const sceneActions=project.actions.slice(before);
    if(!track&&s.camera!==undefined)fail(`${where}: use scene cameras or native cameraTracks, not both.`);
    const cameraMotion=track?addStoryboardCamera({project,track,geo,scene:s,timing:t,motion,ranges:cameraRanges,actions:sceneActions,location:v=>point(v,geo,where+' camera target'),targetLocation:v=>storyboardLocation(v,geo,where+' camera target'),seconds:storyboardSeconds,where}):'Editor camera tracks';
    ids.push(...project.actions.slice(before).map(a=>a.id));
    scenes.push({title,type:kind,start:t.start,end:t.end,narration,description,layerIds:ids,motion,cameraMotion,resizingObjects:sceneActions.filter(a=>a.type==='object'&&a.objectKeys?.some(k=>k.values.size!==undefined)).length});
  }
  if(!scriptScenes.length)scenes.push({title:project.name,type:'editor timeline',start:0,end:frames,narration:'',description:'All native editor layers, settings, and camera tracks.',layerIds:project.actions.map(a=>a.id),motion:'none',cameraMotion:'Editor camera tracks',resizingObjects:project.actions.filter(a=>a.objectKeys?.some(k=>k.values.size!==undefined)).length});
  else if(lastEnd<frames)warnings.push(`No scene covers ${formatStoryboardTime(lastEnd/fps)}–${formatStoryboardTime(frames/fps)}; the map and camera hold.`);
  project.storyboard={version:1,name:project.name,scenes,source:raw};
  validateMapProject(project);
  if(audio){const ids=new Set([...project.actions,...project.shots].map(a=>a.id));for(const clip of audio)if(ids.has(clip.id))fail(`Audio id "${clip.id}" is already used by a map layer.`);}
  return {project,scenes,warnings,audio};
}

export function formatStoryboardTime(seconds) {
  const ms=Math.round(seconds*1000),whole=Math.floor(ms/1000),fraction=ms%1000;
  return `${String(Math.floor(whole/60)).padStart(2,'0')}:${String(whole%60).padStart(2,'0')}${fraction?'.'+String(fraction).padStart(3,'0').replace(/0+$/,''):''}`;
}
