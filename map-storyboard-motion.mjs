import { makeShot, sampleCameraPreset, cameraTrackPoseAt, PRESETS, validateMapProject } from './map-engine.mjs?v=shape-sizing-1';
import { putCameraKey, addCameraPair, CAMERA_FIELDS } from './map-camera.mjs?v=composed-follow-4';

const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
export function storyboardMotion(value,fallback='cinematic',where='Motion') {
  const mode=value??fallback;
  if(!['cinematic','subtle','none'].includes(mode))throw Error(`${where}: use cinematic, subtle or none.`);
  return mode;
}
const check=(v,keys,where)=>{
  if(!object(v))throw Error(`${where}: expected an object.`);
  for(const k of Object.keys(v))if(!keys.includes(k))throw Error(`${where}: unknown field "${k}".`);
};
const VIEW=['target','lon','lat','zoom','pitch','bearing'];

/** Generate regular editor keys and live follow pairs, shared by playback and export. */
export function addStoryboardCamera({project,track,geo,scene,timing,motion,ranges,actions,location,targetLocation=location,seconds,where}) {
  const raw=scene.camera;
  if(raw!==undefined&&raw!==false)check(raw,['mode','preset','options','target','from','to','zoom','pitch','bearing','duration','easing','amount','degrees','object','keys','lockHeading'],where+' camera');
  const camera=raw===false?{mode:'hold'}:raw||{};
  if(raw===undefined&&motion==='none')return 'Script only';
  const end=timing.end-1,start=timing.start;
  if(end<=start){if(raw!==undefined&&raw!==false)throw Error(`${where}: camera motion needs at least two frames.`);return 'One-frame scene';}
  // Overlapping overlays share the earlier scene's camera unless explicitly directed.
  if(ranges.some(r=>start<r.end&&end>r.start)){
    if(raw!==undefined)throw Error(`${where}: camera motion overlaps another camera move.`);
    return 'Shares earlier camera';
  }
  const strength=motion==='subtle'?.4:1;
  const easing=camera.easing||'easeInOut';
  if(!['linear','easeIn','easeOut','easeInOut','backOut','hold'].includes(easing))throw Error(`${where}: invalid camera easing.`);
  const pose=(v,seed)=>{
    check(v,VIEW,where+' camera pose');
    const out={...seed,...v};
    if(v.target!==undefined){const target=location(v.target);out.lon=target.lon;out.lat=target.lat;}
    delete out.target;
    for(const [field,[lo,hi]]of Object.entries(CAMERA_FIELDS))if(!Number.isFinite(out[field])||out[field]<lo||out[field]>hi)throw Error(`${where}: invalid camera ${field}.`);
    // Keep longitude continuous for routes crossing the date line.
    out.lon+=Math.round((seed.lon-out.lon)/360)*360;
    return out;
  };
  const current=cameraTrackPoseAt(project,geo,project.width,project.height,track,start);
  const from=pose(camera.from||{},current);
  const key=(at,values,curve=easing)=>{const k=putCameraKey(track,at,values);k.easing=curve;return k;};
  if(camera.preset!==undefined){
    if(!Object.hasOwn(PRESETS,camera.preset)||camera.preset==='keyframed')throw Error(`${where}: use an editor camera preset, or camera.keys for manual keys.`);
    if(camera.mode!==undefined||camera.keys!==undefined||camera.to!==undefined)throw Error(`${where}: preset cannot be combined with mode, keys, or to.`);
    const options=camera.options??{};check(options,['zoom','pitch','bearing','amount','degrees','planeId','autoFit','lockHeading'],where+' camera options');
    const dur=camera.duration===undefined?end-start:Math.round(seconds(camera.duration,where+' camera duration')*project.fps);
    if(dur<1||dur>timing.dur)throw Error(`${where}: camera duration must fit inside the scene.`);
    const finish=Math.min(end,start+dur),settings={...options,dur:finish-start,easing};
    for(const field of ['zoom','pitch','bearing','amount','degrees','lockHeading'])if(camera[field]!==undefined)settings[field]=camera[field];
    if(camera.target!==undefined)settings.target=targetLocation(camera.target);
    if(camera.object!==undefined){const a=project.actions.find(a=>a.id===camera.object||a.name===camera.object);if(!a)throw Error(`${where}: no object named "${camera.object}".`);settings.planeId=a.id;}
    if(['followPlane','framePlane'].includes(camera.preset)&&!project.actions.some(a=>a.id===settings.planeId))throw Error(`${where}: camera preset needs an object id or action name.`);
    const shot=makeShot(camera.preset,start,settings);
    validateMapProject({...project,actions:project.actions.filter(a=>a.type!=='group'),shots:[shot]});
    key(start,from);
    const samples=sampleCameraPreset(project,geo,project.width,project.height,shot,from),pair=addCameraPair(track,camera.preset,start,finish,samples);
    if(camera.preset==='followPlane')pair[0].follow={planeId:shot.planeId,zoom:shot.zoom,pitch:shot.pitch,lockHeading:shot.lockHeading,easing,from};
    ranges.push({start,end});return PRESETS[camera.preset].label;
  }
  if(camera.options!==undefined)throw Error(`${where}: camera options are used with preset.`);
  if(camera.keys!==undefined){
    if(!Array.isArray(camera.keys)||!camera.keys.length||camera.keys.length>100)throw Error(`${where}: camera keys need 1–100 timed poses.`);
    if(['mode','from','to','target','zoom','pitch','bearing','duration','amount','degrees','object','lockHeading'].some(k=>camera[k]!==undefined))throw Error(`${where}: camera keys cannot be combined with a camera mode or endpoints.`);
    let previous=start-1,seed=from;const prepared=[];
    for(const k of camera.keys){
      check(k,['at','easing',...VIEW],where+' camera key');
      const at=Math.round(seconds(k.at,where+' camera key time')*project.fps);
      if(at<start||at>end||at<=previous)throw Error(`${where}: camera keys must be ordered, distinct, and inside the scene.`);
      const values=Object.fromEntries(VIEW.filter(f=>k[f]!==undefined).map(f=>[f,k[f]]));
      if(!Object.keys(values).length)throw Error(`${where}: camera key needs a view property.`);
      const curve=k.easing||easing;if(!['linear','easeIn','easeOut','easeInOut','backOut','hold'].includes(curve))throw Error(`${where}: invalid camera easing.`);
      seed=pose(values,seed);prepared.push({at,seed,curve});previous=at;
    }
    key(start,from);for(const k of prepared)key(k.at,k.seed,k.curve);
    if(previous<end)key(end,seed,'linear');ranges.push({start,end});return `Camera choreography · ${prepared.length} keys`;
  }
  let mode=camera.mode;
  if(mode!==undefined&&!['move','pushIn','pullBack','orbit','follow','hold'].includes(mode))throw Error(`${where}: unknown camera mode "${mode}".`);
  if(camera.amount!==undefined&&(!Number.isFinite(camera.amount)||camera.amount<0||camera.amount>6))throw Error(`${where}: camera amount must be 0–6 zoom levels.`);
  if(camera.degrees!==undefined&&(!Number.isFinite(camera.degrees)||Math.abs(camera.degrees)>360))throw Error(`${where}: camera degrees must be -360…360.`);
  if(camera.lockHeading!==undefined&&typeof camera.lockHeading!=='boolean')throw Error(`${where}: lockHeading must be true or false.`);
  const moving=actions.filter(a=>a.type==='object'&&['move','path'].includes(a.mode));
  let followed;
  if(camera.object!==undefined){
    followed=project.actions.find(a=>a.type==='object'&&(a.name===camera.object||a.id===camera.object));
    if(!followed)throw Error(`${where}: no object named "${camera.object}" in this scene.`);
  }
  const hasDestination=camera.target!==undefined||camera.to!==undefined;
  mode||=raw===undefined&&moving.length&&!hasDestination?'follow':raw!==undefined?'move':'pushIn';
  if(mode==='follow'){
    followed||=moving[0];if(!followed)throw Error(`${where}: follow camera needs a moving object or an object name.`);
    if(['duration','target','to','amount','degrees'].some(k=>camera[k]!==undefined))throw Error(`${where}: follow spans the scene; use object, zoom, pitch and lockHeading to direct it.`);
  }
  const dur=camera.duration===undefined?(raw===undefined?Math.min(end-start,6*project.fps,Math.max(1,Math.round((end-start)*.2))):end-start):Math.round(seconds(camera.duration,where+' camera duration')*project.fps);
  if(dur<1||dur>timing.dur)throw Error(`${where}: camera duration must fit inside the scene.`);
  const finish=Math.min(end,start+dur);
  const toInput=camera.to||Object.fromEntries(['target','zoom','pitch','bearing'].filter(k=>camera[k]!==undefined).map(k=>[k,camera[k]]));
  let to=pose(toInput,from);
  let target=camera.target??scene.target??scene.place??scene.to??actions.find(a=>a.target?.kind!=='all'&&a.target)?.target??actions.find(a=>a.place)?.place??actions.find(a=>a.path?.length)?.path[0];
  if(target?.kind==='all')target=undefined;
  if(raw===undefined&&target!==undefined&&mode!=='follow'){
    const p=location(target);to.lon=p.lon+Math.round((from.lon-p.lon)/360)*360;to.lat=p.lat;
    // Fit named territories instead of zooming a world view only a fraction closer.
    const named=actions.find(a=>a.target)?.target;
    if(named){const shot=makeShot('flyTo',start,{dur:finish-start,target:named,autoFit:true});to.zoom=sampleCameraPreset(project,geo,project.width,project.height,shot,from).at(-1).values.zoom;}
    else to.zoom=Math.max(from.zoom,4.5);
  }
  if(mode==='hold'){
    to=pose(toInput,from);key(start,to);key(end,to,'linear');
  }else if(mode==='follow'){
    key(start,from);
    const zoom=camera.zoom??Math.max(from.zoom,4.5),pitch=camera.pitch??(motion==='none'?from.pitch:20*strength);
    pose({zoom,pitch},from);
    const shot=makeShot('followPlane',start,{dur:end-start,planeId:followed.id,zoom,pitch,lockHeading:camera.lockHeading??false,easing});
    const pair=addCameraPair(track,'followPlane',start,end,sampleCameraPreset(project,geo,project.width,project.height,shot,from));
    pair[0].follow={planeId:followed.id,zoom,pitch,lockHeading:shot.lockHeading,easing,from};
    // Property keys keep the zoom evolving while the follow pair owns position.
    if(motion!=='none'){
      const settle=Math.min(end-1,start+Math.max(1,Math.round((end-start)*.2)));
      if(settle>start){key(settle,{zoom,pitch});key(end,{zoom:clamp(zoom+.45*strength,0,14),pitch},'linear');}
    }
  }else{
    if(mode==='pushIn')to.zoom=clamp(to.zoom+(camera.amount??.6*strength),0,14);
    if(mode==='pullBack')to.zoom=clamp(to.zoom-(camera.amount??.8*strength),0,14);
    if(mode==='orbit'){to.bearing=clamp(from.bearing+(camera.degrees??30*strength),-3600,3600);to.pitch=camera.pitch??Math.max(from.pitch,25*strength);if(camera.zoom===undefined&&camera.to?.zoom===undefined)to.zoom=clamp(to.zoom+.25*strength,0,14);}
    key(start,from);key(finish,to);
    if(motion!=='none'&&finish<end){
      const drift={...to,zoom:clamp(to.zoom+.35*strength,0,14),bearing:clamp(to.bearing+8*strength,-3600,3600)};
      key(end,drift,'linear');
    }else if(finish<end)key(end,to,'linear');
  }
  ranges.push({start,end});
  return ({pushIn:'Zoom in',pullBack:'Zoom out',orbit:'Orbit',follow:'Follow units',hold:'Camera hold',move:'Pan / zoom'})[mode];
}
