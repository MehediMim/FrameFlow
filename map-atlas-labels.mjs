// Geographic anchors are repeated with the map at the antimeridian.
export const OCEAN_LABELS = Object.freeze([
  { name: 'North Atlantic Ocean', angle: -25, lon: -40, lat: 32 },
  { name: 'South Atlantic Ocean', angle: -20, lon: -15, lat: -30 },
  { name: 'North Pacific Ocean', angle: 12, lon: -155, lat: 27 },
  { name: 'South Pacific Ocean', angle: -12, lon: -135, lat: -30 },
  { name: 'Indian Ocean', angle: -20, lon: 78, lat: -24 },
  { name: 'Arctic Ocean', angle: 0, lon: 0, lat: 79 },
  { name: 'Southern Ocean', angle: 0, lon: 30, lat: -61 },
  { name: 'Mediterranean Sea', angle: -12, lon: 18, lat: 35 },
  { name: 'Arabian Sea', angle: -25, lon: 64, lat: 16 },
  { name: 'Bay of Bengal', angle: 65, lon: 88, lat: 14 },
  { name: 'Caribbean Sea', angle: -10, lon: -75, lat: 15 },
]);
export const ATLAS_LABEL_DEFAULTS = Object.freeze({
  countries: false, oceans: false, declutter: true, fitCountries: true, countryAngles: true, size: 30, oceanSize: 23,
  font: 'Libre Baskerville', text: '#d5e3df', outline: '#172c30',
  opacity: .9, spacing: 8, haloWidth: .08, placement: 'map', scaleMode: 'world', referenceZoom: 3,
});
export const atlasLabelSettings = value => ({ ...ATLAS_LABEL_DEFAULTS, ...value });
export function validateAtlasLabels(s) {
  if (s === undefined) return;
  const bad = () => { throw Error('Invalid atlas label settings.'); };
  if (!s || typeof s !== 'object' || Array.isArray(s)) bad();
  for (const k of ['countries', 'oceans', 'declutter', 'fitCountries', 'countryAngles']) if (s[k] !== undefined && typeof s[k] !== 'boolean') bad();
  for (const [k, lo, hi] of [['size', 6, 240], ['oceanSize', 6, 240], ['opacity', 0, 1], ['spacing', 0, 40], ['haloWidth', 0, 1], ['referenceZoom', 0, 14]])
    if (s[k] !== undefined && (!Number.isFinite(s[k]) || s[k] < lo || s[k] > hi)) bad();
  for (const k of ['text', 'outline']) if (s[k] !== undefined && !/^#[a-f0-9]{6}$/i.test(s[k])) bad();
  if (s.font !== undefined && (typeof s.font !== 'string' || !s.font || s.font.length > 60)) bad();
  if (s.placement !== undefined && !['screen', 'map'].includes(s.placement)) bad();
  if (s.scaleMode !== undefined && !['fixed', 'world'].includes(s.scaleMode)) bad();
}

const layoutCache = new WeakMap();
/** Fit a text rectangle inside the polygon at a stable geographic anchor.
 * Scan polygon cross-sections so narrow countries get a steeper baseline and
 * offshore islands do not inflate the space available for their country name.
 */
export function countryLabelLayout(feature, anchor, aspect, angled = true) {
  let cache = layoutCache.get(feature);
  if (!cache) { cache = new Map(); layoutCache.set(feature, cache); }
  const key = `${anchor.x}/${anchor.y}/${aspect}/${angled}`;
  if (cache.has(key)) return cache.get(key);
  const box = feature.mainBox, maxWidth = Math.hypot(box[2] - box[0], box[3] - box[1]);
  let best = { width: 0, angle: 0 }, score = 0;
  const ratio = (box[2] - box[0]) / Math.max(1e-9, box[3] - box[1]);
  const compact = ratio >= .65 && ratio <= 1.5;
  for (const angle of !angled ? [0] : compact ? [0, -15, 15, -30, 30] : [0, -15, 15, -30, 30, -45, 45, -60, 60, -75, 75, 90]) {
    const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const rings = feature.rings.map(r => {
      const xy = new Float64Array(r.n * 2);
      for (let i = 0; i < r.n; i++) {
        const x = r.xy[i * 2] - anchor.x, y = r.xy[i * 2 + 1] - anchor.y;
        xy[i * 2] = x * c + y * s; xy[i * 2 + 1] = -x * s + y * c;
      }
      return xy;
    });
    const fits = width => {
      const half = width / 2, height = width / aspect;
      for (const fraction of [-.5, -.25, 0, .25, .5]) {
        const y = height * fraction, crossings = [];
        for (const xy of rings) for (let i = 0, j = xy.length - 2; i < xy.length; j = i, i += 2) {
          if ((xy[i + 1] > y) === (xy[j + 1] > y)) continue;
          crossings.push(xy[i] + (y - xy[i + 1]) * (xy[j] - xy[i]) / (xy[j + 1] - xy[i + 1]));
        }
        crossings.sort((a, b) => a - b);
        let inside = false;
        for (let i = 0; i + 1 < crossings.length; i += 2) if (crossings[i] <= -half && crossings[i + 1] >= half) { inside = true; break; }
        if (!inside) return false;
      }
      return true;
    };
    let lo = 0, hi = maxWidth;
    for (let i = 0; i < 10; i++) { const m = (lo + hi) / 2; if (fits(m)) lo = m; else hi = m; }
    const candidate = lo * (1 - Math.abs(angle) / 600);
    if (candidate > score) { score = candidate; best = { width: lo * .8, angle }; }
  }
  if (cache.size > 12) cache.clear();
  cache.set(key, best);
  return best;
}
