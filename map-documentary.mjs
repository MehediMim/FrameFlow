// A coordinated, editable visual preset for archival campaign maps.
export const DOCUMENTARY_TERRAIN = Object.freeze({
  azimuth: 315, altitude: 42, strength: .78, ambient: .34,
  exaggeration: 2.6, multidirectional: true, bathymetry: false,
  low: '#aaa783', middle: '#c1b494', high: '#e7dac0',
  shallow: '#9aa9a5', deep: '#859795', highlightColor: '#964e3d', highlightOpacity: .72,
});
export const DOCUMENTARY_LABEL = Object.freeze({
  font: 'Oswald', weight: 600, caps: true, spacing: 9, size: 20,
  placement: 'map', scaleMode: 'fixed', shape: 'none', useTheme: false,
  text: '#34392e', bg: '#e9dfc5', halo: true, haloWidth: .1, shadow: false,
});
export const DOCUMENTARY_ATLAS = Object.freeze({
  countries: true, oceans: true, declutter: true, fitCountries: true, countryAngles: true,
  font: 'Oswald', size: 27, oceanSize: 19, text: '#394236', outline: '#e2d8bb',
  opacity: .87, spacing: 15, haloWidth: .09, placement: 'map', scaleMode: 'world',
  referenceZoom: 3, textPath: 'straight', curveAngle: 60, caps: true,
});
export function applyDocumentaryLook(project) {
  project.theme = 'documentary';
  project.terrain = { ...DOCUMENTARY_TERRAIN };
  project.texture = { type: 'paper', strength: .24, scale: 1 };
  project.labelStyle = { ...project.labelStyle, ...DOCUMENTARY_LABEL };
  project.atlasLabels = { ...DOCUMENTARY_ATLAS };
  project.graticule = true;
  return project;
}
