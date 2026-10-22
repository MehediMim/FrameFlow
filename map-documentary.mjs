// A coordinated, editable visual preset for archival campaign maps.
export const DOCUMENTARY_TERRAIN = Object.freeze({
  azimuth: 315, altitude: 35, strength: .96, ambient: .48,
  exaggeration: 3.8, multidirectional: true, bathymetry: false,
  low: '#829888', middle: '#a4aa90', high: '#cec4aa',
  shallow: '#50758d', deep: '#345772', highlightColor: '#bf643c', highlightOpacity: .78,
});
export const DOCUMENTARY_LABEL = Object.freeze({
  font: 'Oswald', weight: 600, caps: true, spacing: 9, size: 20,
  placement: 'map', scaleMode: 'fixed', shape: 'none', useTheme: false,
  text: '#eee6cf', bg: '#303d36', halo: true, haloWidth: .1, shadow: false,
});
export const DOCUMENTARY_ATLAS = Object.freeze({
  countries: true, oceans: true, declutter: true, fitCountries: true, countryAngles: true,
  font: 'Oswald', size: 27, oceanSize: 19, text: '#eee6cf', outline: '#303d36',
  opacity: .87, spacing: 15, haloWidth: .09, placement: 'map', scaleMode: 'world',
  referenceZoom: 3, textPath: 'straight', curveAngle: 60, caps: true,
});
export function applyDocumentaryLook(project) {
  project.theme = 'documentary';
  project.terrain = { ...DOCUMENTARY_TERRAIN };
  project.texture = { type: 'paper', strength: .24, scale: 1 };
  project.labelStyle = { ...project.labelStyle, ...DOCUMENTARY_LABEL };
  project.atlasLabels = { ...DOCUMENTARY_ATLAS };
  project.graticule = false;
  return project;
}
