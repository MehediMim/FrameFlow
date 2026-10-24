import { easings } from './easings.mjs';
import { animationKeysOf } from './map-timing.mjs';

export const CAMERA_PROPERTIES = {
  position: { label: 'Position', fields: ['lon', 'lat'] },
  zoom: { label: 'Zoom', fields: ['zoom'] },
  pitch: { label: 'Tilt', fields: ['pitch'] },
  bearing: { label: 'Rotation', fields: ['bearing'] },
};
export const CAMERA_FIELDS = { lon: [-540, 540], lat: [-85, 85], zoom: [0, 14], pitch: [0, 75], bearing: [-3600, 3600] };
// The editor's camera track shares the composition clock, including after a resize.
export function syncCameraTimeline(project, createShot) {
  let shot = project.shots.find(s => s.fullTimelineCamera) || project.shots.find(s => s.preset === 'keyframed');
  if (!shot) {
    shot = createShot({ ...project.camera.init });
    project.shots.unshift(shot);
  }
  shot.cameraKeys = cameraKeysOf(shot).map(k => ({ ...k, values: { ...k.values } }));
  if (shot.followInitialView && !shot.cameraKeys.length) {
    shot.cameraFrom = { ...project.camera.init }; shot.cameraTo = { ...project.camera.init };
  }
  shot.fullTimelineCamera = true;
  shot.preset = 'keyframed'; shot.start = 0; shot.dur = project.frames; shot.visible = true;
  delete shot.sourceStart; delete shot.sourceDur;
  const merged = new Map();
  for (const key of shot.cameraKeys) {
    const frame = Math.max(0, Math.min(project.frames - 1, key.frame));
    const identity = key.pairId ? key.id : `manual:${frame}`;
    merged.set(identity, { ...key, frame, values: { ...merged.get(identity)?.values, ...key.values } });
  }
  shot.cameraKeys = [...merged.values()].sort((a,b)=>a.frame-b.frame);
  const invalid = new Set(shot.cameraKeys.filter(k=>k.pairId).filter(k=>{
    const pair=shot.cameraKeys.filter(p=>p.pairId===k.pairId);
    return pair.length!==2||pair[0].frame===pair[1].frame;
  }).map(k=>k.pairId));
  shot.cameraKeys=shot.cameraKeys.filter(k=>!invalid.has(k.pairId));
  return shot;
}
export function cameraKeysOf(s) {
  if (!s.cameraKeys && Object.keys(CAMERA_FIELDS).every(f => s.cameraFrom[f] === s.cameraTo[f])) return [];
  const timing = animationKeysOf(s);
  return s.cameraKeys ?? [{ frame: timing.start, values: { ...s.cameraFrom } }, { frame: timing.end, values: { ...s.cameraTo } }];
}
export function cameraPoseAt(s, frame) {
  const keys = cameraKeysOf(s), pose = {};
  const pairs = keys.filter(k => k.pairRole === 'start' && k.samples?.length).map(start => ({
    start, end: keys.find(k => k.pairId === start.pairId && k.pairRole === 'end'),
  })).filter(pair => pair.end).sort((a, b) => b.start.frame - a.start.frame);
  const sampleAt = (pair, at, field) => {
    const t = Math.max(0, Math.min(1, (at - pair.start.frame) / (pair.end.frame - pair.start.frame)));
    const samples = pair.start.samples, after = samples.findIndex(sample => sample.t > t);
    const left = after < 0 ? samples.at(-1) : samples[Math.max(0, after - 1)], right = after < 0 ? left : samples[after];
    const mix = right.t === left.t ? 0 : (t - left.t) / (right.t - left.t);
    return left.values[field] + (right.values[field] - left.values[field]) * mix;
  };
  for (const field of Object.keys(CAMERA_FIELDS)) {
    // Manual keys win shared frames; a newer movement wins over an older endpoint.
    const ordered = keys.filter(k => k.values[field] !== undefined).sort((a, b) => a.frame - b.frame ||
      Number(!a.pairId) - Number(!b.pairId) || Number(a.pairRole === 'start') - Number(b.pairRole === 'start'));
    const track = [...new Map(ordered.map(k => [k.frame, k])).values()];
    if (!track.length) { pose[field] = s.cameraFrom[field]; continue; }
    const next = track.findIndex(k => k.frame > frame);
    if (next === 0) pose[field] = track[0].values[field];
    else if (next < 0) pose[field] = track.at(-1).values[field];
    else {
      const a = track[next - 1], b = track[next], t = (frame - a.frame) / (b.frame - a.frame);
      const pair = pairs.find(p => p.start.frame <= a.frame && p.end.frame >= b.frame);
      if (pair) {
        // Keep the preset's curve and smoothly offset it through edited/manual keys.
        const correction = (easings[b.easing || s.easing] || easings.easeInOut)(t);
        const left = a.values[field] - sampleAt(pair, a.frame, field);
        const right = b.values[field] - sampleAt(pair, b.frame, field);
        pose[field] = sampleAt(pair, frame, field) + left + (right - left) * correction;
        pose[field] = Math.max(CAMERA_FIELDS[field][0], Math.min(CAMERA_FIELDS[field][1], pose[field]));
        continue;
      }
      const eased = (easings[b.easing||s.easing] || easings.easeInOut)(t);
      if (field === 'lat') {
        const y = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        pose[field] = (2 * Math.atan(Math.exp(y(a.values[field]) + (y(b.values[field]) - y(a.values[field])) * eased)) - Math.PI / 2) * 180 / Math.PI;
      } else pose[field] = a.values[field] + (b.values[field] - a.values[field]) * eased;
    }
  }
  return pose;
}
export function cameraKeyAt(s, frame, id) {
  const keys=cameraKeysOf(s);
  const selected=id&&keys.find(k=>k.id===id&&k.frame===frame);
  return selected||keys.find(k=>k.frame===frame&&!k.pairId)||keys.find(k=>k.frame===frame);
}
export function putCameraKey(s, frame, values, id) {
  s.cameraKeys ??= cameraKeysOf(s).map(k => ({ ...k, values: { ...k.values } }));
  let key = id?s.cameraKeys.find(k=>k.id===id):s.cameraKeys.find(k => k.frame === frame&&!k.pairId);
  if (!key) { key = { id:crypto.randomUUID(), frame, values: {} }; s.cameraKeys.push(key); }
  Object.assign(key.values, values);
  s.cameraKeys.sort((a, b) => a.frame - b.frame);
  return key;
}
export function addCameraPair(s, preset, start, end, samples, pairId = crypto.randomUUID()) {
  if(end<=start)throw Error('Camera movement needs two distinct frames.');
  s.cameraKeys ??= [];
  const first={id:crypto.randomUUID(),frame:start,values:{...samples[0].values},pairId,pairRole:'start',preset,samples:structuredClone(samples)};
  const last={id:crypto.randomUUID(),frame:end,values:{...samples.at(-1).values},pairId,pairRole:'end',preset};
  s.cameraKeys.push(first,last);s.cameraKeys.sort((a,b)=>a.frame-b.frame);
  return [first,last];
}
export function removeCameraKey(s, frame, fields = Object.keys(CAMERA_FIELDS), id) {
  s.cameraKeys ??= cameraKeysOf(s).map(k => ({ ...k, values: { ...k.values } }));
  const key = cameraKeyAt(s,frame,id); if (!key) return;
  if(key.pairId){s.cameraKeys=s.cameraKeys.filter(k=>k.pairId!==key.pairId);return;}
  for (const field of fields) delete key.values[field];
  s.cameraKeys = s.cameraKeys.filter(k => Object.keys(k.values).length);
}
export function moveCameraKey(s, from, to, fields = Object.keys(CAMERA_FIELDS), id) {
  const key = cameraKeyAt(s,from,id); if (!key || from === to) return;
  if(key.pairId){
    const other=cameraKeysOf(s).find(k=>k.pairId===key.pairId&&k.id!==key.id);
    key.frame=key.pairRole==='start'?Math.min(to,other.frame-1):Math.max(to,other.frame+1);
  }else{
    const values=Object.fromEntries(Object.entries(key.values).filter(([field])=>fields.includes(field)));
    const all=Object.keys(key.values).every(field=>fields.includes(field));
    for(const field of Object.keys(values))delete key.values[field];
    s.cameraKeys=s.cameraKeys.filter(k=>Object.keys(k.values).length);
    const moved=putCameraKey(s,to,values);if(all&&key.id)moved.id=key.id;
  }
  s.cameraKeys.sort((a,b)=>a.frame-b.frame);
}
