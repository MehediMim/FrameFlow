import { easings } from './engine.mjs?v=sparse-blur-1';
import { animationKeysOf } from './map-timing.mjs';

export const CAMERA_PROPERTIES = {
  position: { label: 'Position', fields: ['lon', 'lat'] },
  zoom: { label: 'Zoom', fields: ['zoom'] },
  pitch: { label: 'Tilt', fields: ['pitch'] },
  bearing: { label: 'Rotation', fields: ['bearing'] },
};
export const CAMERA_FIELDS = { lon: [-540, 540], lat: [-85, 85], zoom: [0, 14], pitch: [0, 75], bearing: [-3600, 3600] };
export function cameraKeysOf(s) {
  if (!s.cameraKeys && Object.keys(CAMERA_FIELDS).every(f => s.cameraFrom[f] === s.cameraTo[f])) return [];
  const timing = animationKeysOf(s);
  return s.cameraKeys ?? [{ frame: timing.start, values: { ...s.cameraFrom } }, { frame: timing.end, values: { ...s.cameraTo } }];
}
export function cameraPoseAt(s, frame) {
  const keys = cameraKeysOf(s), pose = {};
  for (const field of Object.keys(CAMERA_FIELDS)) {
    const track = keys.filter(k => k.values[field] !== undefined).sort((a, b) => a.frame - b.frame);
    if (!track.length) { pose[field] = s.cameraFrom[field]; continue; }
    const next = track.findIndex(k => k.frame > frame);
    if (next === 0) pose[field] = track[0].values[field];
    else if (next < 0) pose[field] = track.at(-1).values[field];
    else {
      const a = track[next - 1], b = track[next], t = (frame - a.frame) / (b.frame - a.frame);
      const eased = (easings[s.easing] || easings.easeInOut)(t);
      if (field === 'lat') {
        const y = lat => Math.log(Math.tan(Math.PI / 4 + lat * Math.PI / 360));
        pose[field] = (2 * Math.atan(Math.exp(y(a.values[field]) + (y(b.values[field]) - y(a.values[field])) * eased)) - Math.PI / 2) * 180 / Math.PI;
      } else pose[field] = a.values[field] + (b.values[field] - a.values[field]) * eased;
    }
  }
  return pose;
}
export function putCameraKey(s, frame, values) {
  s.cameraKeys ??= cameraKeysOf(s).map(k => ({ frame: k.frame, values: { ...k.values } }));
  let key = s.cameraKeys.find(k => k.frame === frame);
  if (!key) { key = { frame, values: {} }; s.cameraKeys.push(key); }
  Object.assign(key.values, values);
  s.cameraKeys.sort((a, b) => a.frame - b.frame);
}
export function removeCameraKey(s, frame, fields) {
  s.cameraKeys ??= cameraKeysOf(s).map(k => ({ frame: k.frame, values: { ...k.values } }));
  const key = s.cameraKeys.find(k => k.frame === frame);
  if (!key) return;
  for (const field of fields) delete key.values[field];
  s.cameraKeys = s.cameraKeys.filter(k => Object.keys(k.values).length);
}
export function moveCameraKey(s, from, to, fields = Object.keys(CAMERA_FIELDS)) {
  const key = cameraKeysOf(s).find(k => k.frame === from); if (!key || from === to) return;
  const values = Object.fromEntries(Object.entries(key.values).filter(([field]) => fields.includes(field)));
  removeCameraKey(s, from, fields); putCameraKey(s, to, values);
}
