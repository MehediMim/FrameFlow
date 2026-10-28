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

/** Screen-space engraving, shared by the editor, stills and video exports. */
export function drawAntiqueFrame(ctx, W, H) {
  const u = Math.min(W, H) / 720, inset = 12 * u;
  ctx.save();
  ctx.strokeStyle = '#705735'; ctx.lineWidth = 8 * u;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.strokeStyle = '#deca97'; ctx.lineWidth = 3 * u;
  ctx.strokeRect(inset, inset, W - inset * 2, H - inset * 2);
  ctx.strokeStyle = '#705735'; ctx.lineWidth = .8 * u;
  ctx.strokeRect(inset + 7 * u, inset + 7 * u, W - inset * 2 - 14 * u, H - inset * 2 - 14 * u);
  // Fine corner flourishes stay within the frame margin.
  for (const x of [26 * u, W - 26 * u]) for (const y of [26 * u, H - 26 * u]) {
    ctx.beginPath(); ctx.arc(x, y, 3 * u, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.restore();
}
