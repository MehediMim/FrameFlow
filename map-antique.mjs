// Coordinated ink, paper and lettering for engraved historical maps.
export const ANTIQUE_LABEL = Object.freeze({
  font: 'Georgia', weight: 400, italic: false, caps: true, spacing: 5, size: 22,
  placement: 'map', scaleMode: 'fixed', shape: 'none', useTheme: false,
  text: '#30291e', bg: '#e5d3a7', halo: true, haloWidth: .025, shadow: false,
});
export const ANTIQUE_ATLAS = Object.freeze({
  countries: true, oceans: true, declutter: true, fitCountries: true, countryAngles: true,
  font: 'Georgia', size: 26, oceanSize: 18, text: '#30291e', outline: '#dfcea3',
  opacity: .94, spacing: 7, haloWidth: .025, placement: 'map', scaleMode: 'world',
  referenceZoom: 3, textPath: 'straight', curveAngle: 60, caps: true,
});
export function applyAntiqueLook(project) {
  project.theme = 'antique';
  project.texture = { type: 'paper', strength: .22, scale: 1 };
  project.labelStyle = { ...project.labelStyle, ...ANTIQUE_LABEL };
  project.atlasLabels = { ...ANTIQUE_ATLAS };
  project.graticule = false;
  return project;
}
