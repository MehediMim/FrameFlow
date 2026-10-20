// FrameFlow Map Studio engine: vector world map, camera presets and map animations.
// Pure JavaScript with no DOM access, so it can be unit tested and rendered headlessly.
import { easings, fontStack, cleanFont } from './engine.mjs?v=sparse-blur-1';
import { routePlaceLabels } from './map-route-labels.mjs';
import { animationKeysOf } from './map-timing.mjs';
import { reliefSettings, validateRelief } from './map-relief.mjs';
import { OCEAN_LABELS, atlasLabelSettings, validateAtlasLabels, countryLabelLayout } from './map-atlas-labels.mjs';
import { cameraPoseAt, CAMERA_FIELDS } from './map-camera.mjs';
import { detailLevelOf, isLevelId } from './map-country-details.mjs';
import { detailCountriesOf, targetFeatures, featureForTarget, borderSection, borderRingOf } from './map-regions.mjs';
import { OBJECT_ICONS, EFFECTS, SHAPES, OBJECT_ENTER, OBJECT_IDLE, OBJECT_EXIT, drawObject, drawEffect, drawShape } from './map-objects.mjs';
export { detailLevelOf } from './map-country-details.mjs';
export { OBJECT_ICONS, EFFECTS, SHAPES, OBJECT_ENTER, OBJECT_IDLE, OBJECT_EXIT } from './map-objects.mjs';

const RAD = Math.PI / 180, MAX_LAT = 85.0511287798, BASE_PX = 512, FOV = 45 * RAD;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
const ease = (name, t) => (easings[name] || easings.easeInOut)(clamp01(t));

// ---------------------------------------------------------------- Web-Mercator helpers
// "World units" run 0..1 across the whole world; the map repeats every 1.0 horizontally.
export const lonToX = lon => (lon + 180) / 360;
export const latToY = lat => {
  const l = clamp(lat, -MAX_LAT, MAX_LAT) * RAD;
  return (1 - Math.log(Math.tan(Math.PI / 4 + l / 2)) / Math.PI) / 2;
};
export const xToLon = x => x * 360 - 180;
export const yToLat = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) / RAD;

// ---------------------------------------------------------------- Themes
export const THEMES = {
  relief: { label: 'Cartographic Relief', relief: true, void: '#263f4b', ocean: '#246c93', land: ['#596653', '#596653', '#596653', '#596653', '#596653'], border: '#45534a', borderA: .42, bw: .65, grat: '#dce5da', gratA: .12, dim: '#14242a', vignette: .12, pill: 'rgba(31,43,42,.9)', pillText: '#f5f0dc' },
  earth: { label: 'Earth vector', void: '#0b1620', ocean: '#a8d5ee', land: ['#e3ebc6', '#dbe7bc', '#e8e8c8', '#d8e5c3', '#e5e1c1'], border: '#ffffff', borderA: .9, bw: 1.1, grat: '#ffffff', gratA: .28, dim: '#06121c', vignette: .16, pill: 'rgba(12,28,40,.9)', pillText: '#ffffff' },
  dark: { label: 'Night', void: '#03060a', ocean: '#0c1a28', land: ['#1a2a3a', '#1d2e3f', '#182736', '#1b2c3b', '#203243'], border: '#3d5b75', borderA: .95, bw: 1, grat: '#6f9bbd', gratA: .12, dim: '#000000', vignette: .35, pill: 'rgba(235,242,248,.92)', pillText: '#0b1620' },
  paper: { label: 'Paper atlas', void: '#d9cfb8', ocean: '#f3eddf', land: ['#e2d6bb', '#dccfb1', '#e5dac1', '#d9ccae', '#e0d3b8'], border: '#faf5e8', borderA: .95, bw: 1.2, grat: '#b9a98a', gratA: .35, dim: '#2a2113', vignette: .1, pill: 'rgba(52,40,22,.9)', pillText: '#fbf4e2' },
  realistic: { label: 'Natural terrain · realistic', void: '#071b27', ocean: '#246b87', land: ['#6c8c58', '#7f8e63', '#9a9577', '#7a9167', '#ad9f7e'], border: '#385d51', borderA: .35, bw: .65, grat: '#c8e5de', gratA: .10, dim: '#0a1d26', vignette: .18, pill: 'rgba(9,32,30,.9)', pillText: '#f4f5e8' },
  satellite: { label: 'Satellite · photo-realistic', imagery: true, void: '#02070b', ocean: '#0b2a3d', land: ['#4f6b45', '#5d6e49', '#7c7a5c', '#5a7050', '#8a7d5e'], border: '#ffffff', borderA: .55, bw: .8, grat: '#ffffff', gratA: .16, dim: '#000000', vignette: .24, pill: 'rgba(8,16,22,.9)', pillText: '#ffffff' },
  blueprint: { label: 'Blueprint', void: '#071a3d', ocean: '#0f2f66', land: ['#1b4b9b', '#1d4fa3', '#1a4794', '#1e53aa', '#1c4d9e'], border: '#8fb8ff', borderA: .85, bw: 1, grat: '#8fb8ff', gratA: .2, dim: '#020b1d', vignette: .25, pill: 'rgba(255,255,255,.92)', pillText: '#0a2250' },
};

// Texture tiles are seeded and cached: no per-frame noise or flickering in exports.
export const TEXTURES = { none: 'None', paper: 'Paper grain', grain: 'Film grain', linen: 'Linen', dots: 'Halftone dots', abstract: 'Abstract blotches', brush: 'Brush strokes' };
export const DEFAULT_TEXTURE = { type: 'none', strength: .3, scale: 1 };
const textureTiles = new Map();
function textureTile(type) {
  if (textureTiles.has(type)) return textureTiles.get(type);
  const tile = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(256, 256) : document.createElement('canvas');
  tile.width = tile.height = 256;
  const c = tile.getContext('2d');
  let seed = 72139;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  if (type === 'paper' || type === 'grain') {
    const image = c.createImageData(256, 256);
    for (let i = 0; i < image.data.length; i += 4) {
      const light = random() > .5;
      const rgb = type === 'paper' ? (light ? [255, 244, 214] : [65, 44, 20]) : (light ? [255, 255, 255] : [0, 0, 0]);
      image.data.set([...rgb, Math.round(random() * (type === 'paper' ? 100 : 150))], i);
    }
    c.putImageData(image, 0, 0);
    if (type === 'paper') {
      c.strokeStyle = 'rgba(77,53,24,.13)'; c.lineWidth = .7;
      for (let i = 0; i < 450; i++) {
        const x = random() * 256, y = random() * 256;
        c.beginPath(); c.moveTo(x, y); c.lineTo(x + random() * 6 - 3, y + random() * 2); c.stroke();
      }
    }
  } else if (type === 'linen') {
    for (let i = 0; i < 256; i += 4) {
      c.fillStyle = 'rgba(35,25,15,.3)'; c.fillRect(i, 0, 1, 256); c.fillRect(0, i, 256, 1);
      c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(i + 1, 0, 1, 256); c.fillRect(0, i + 1, 256, 1);
    }
  } else if (type === 'dots') {
    c.fillStyle = 'rgba(0,0,0,.5)';
    for (let y = 4; y < 256; y += 8) for (let x = 4; x < 256; x += 8) {
      c.beginPath(); c.arc(x, y, 1.2, 0, Math.PI * 2); c.fill();
    }
  }
  else if (type === 'abstract' || type === 'brush') {
    // Seamless: every shape is drawn at 9 wrapped offsets so the 256px tile repeats without seams.
    const wrap = draw => { for (const ox of [-256, 0, 256]) for (const oy of [-256, 0, 256]) draw(ox, oy); };
    if (type === 'abstract') {
      for (let i = 0; i < 70; i++) {
        const x = random() * 256, y = random() * 256, r = 7 + random() * 34, rgb = random() > .5 ? '40,28,16' : '255,246,226', a = .08 + random() * .18;
        wrap((ox, oy) => {
          const g = c.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, r);
          g.addColorStop(0, `rgba(${rgb},${a})`); g.addColorStop(1, `rgba(${rgb},0)`);
          c.fillStyle = g; c.fillRect(x + ox - r, y + oy - r, r * 2, r * 2);
        });
      }
      c.lineWidth = 1.1;
      for (let i = 0; i < 12; i++) {
        const x = random() * 256, y = random() * 256, r = 10 + random() * 40, a0 = random() * 6.28, a1 = a0 + 1 + random() * 3.2, rgb = random() > .5 ? '40,28,16' : '255,246,226', al = .18 + random() * .2;
        wrap((ox, oy) => { c.strokeStyle = `rgba(${rgb},${al})`; c.beginPath(); c.arc(x + ox, y + oy, r, a0, a1); c.stroke(); });
      }
    } else {
      c.lineCap = 'round';
      for (let i = 0; i < 36; i++) {
        const x = random() * 256, y = random() * 256, len = 70 + random() * 120, ang = (random() - .5) * .5 - .3, rgb = random() > .45 ? '40,28,16' : '255,248,232';
        const nb = 5 + Math.floor(random() * 9), bristles = Array.from({ length: nb }, (_, b) => ({ off: (b - nb / 2) * 1.5, start: random() * len * .15, l: len * (.55 + random() * .45), drift: (random() - .5) * 1.4, a: .06 + random() * .22, w: .8 + random() * .9 }));
        wrap((ox, oy) => {
          c.save(); c.translate(x + ox, y + oy); c.rotate(ang);
          for (const b of bristles) { c.strokeStyle = `rgba(${rgb},${b.a})`; c.lineWidth = b.w; c.beginPath(); c.moveTo(b.start, b.off); c.lineTo(b.start + b.l, b.off + b.drift); c.stroke(); }
          c.restore();
        });
      }
    }
  }
  textureTiles.set(type, tile); return tile;
}
export function drawTexture(ctx, W, H, texture) {
  const t = { ...DEFAULT_TEXTURE, ...texture };
  if (t.type === 'none' || !Object.hasOwn(TEXTURES, t.type) || t.strength <= 0) return;
  const pattern = ctx.createPattern(textureTile(t.type), 'repeat');
  if (!pattern) return;
  // Scale with output size so preview, PNG and video share the same appearance.
  const scale = Math.max(.1, Math.min(W, H) / 720 * t.scale);
  ctx.save(); ctx.globalAlpha = t.strength; ctx.scale(scale, scale);
  ctx.fillStyle = pattern; ctx.fillRect(0, 0, W / scale, H / scale); ctx.restore();
}

// ---------------------------------------------------------------- Geometry data
function buildSet(topo) {
  const [sx, sy] = topo.transform.scale, [tx, ty] = topo.transform.translate;
  const arcs = topo.arcs.map(a => {
    let x = 0, y = 0;
    return a.map(p => { x += p[0]; y += p[1]; return [x * sx + tx, y * sy + ty]; });
  });
  const ringPts = idxs => {
    const pts = [];
    idxs.forEach((ai, k) => {
      const a = ai >= 0 ? arcs[ai] : [...arcs[~ai]].reverse();
      for (let j = k ? 1 : 0; j < a.length; j++) pts.push(a[j]);
    });
    return pts;
  };
  const features = [], byName = new Map();
  let idx = 0;
  for (const g of topo.objects.countries.geometries) {
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    const rings = [];
    for (const poly of polys) poly.forEach((r, ri) => {
      const pts = ringPts(r);
      if (pts.length < 4) return;
      // Unwrap longitudes so rings crossing the antimeridian stay continuous (copies of the world cover the overflow).
      const raw = new Float64Array(pts.length * 2);
      let shift = 0, prevX = lonToX(pts[0][0]), yMean = 0;
      for (let i = 0; i < pts.length; i++) {
        const x0 = lonToX(pts[i][0]);
        if (x0 - prevX > .5) shift -= 1; else if (x0 - prevX < -.5) shift += 1;
        prevX = x0; raw[2 * i] = x0 + shift; raw[2 * i + 1] = latToY(pts[i][1]); yMean += raw[2 * i + 1];
      }
      yMean /= pts.length;
      let xy = raw;
      if (Math.abs(raw[2 * pts.length - 2] - raw[0]) > .5) { // ring that encircles a pole (Antarctica): close it below/above the map
        const yEdge = yMean > .5 ? 1.6 : -.6, last = raw[2 * pts.length - 2];
        xy = new Float64Array((pts.length + 3) * 2); xy.set(raw);
        xy.set([last, yEdge, raw[0], yEdge, raw[0], raw[1]], pts.length * 2);
        pts.push(null, null, null);
      }
      const n = pts.length;
      // signed area + centroid (shoelace)
      let a2 = 0, cx = 0, cy = 0;
      for (let i = 0; i < n - 1; i++) {
        const x0 = xy[2 * i], y0 = xy[2 * i + 1], x1 = xy[2 * i + 2], y1 = xy[2 * i + 3], cr = x0 * y1 - x1 * y0;
        a2 += cr; cx += (x0 + x1) * cr; cy += (y0 + y1) * cr;
      }
      const area = Math.abs(a2) / 2, rcy = a2 ? cy / (3 * a2) : xy[1];
      // `real` undoes Mercator's growth towards the poles, so Alaska or Svalbard do not look as big as they are drawn.
      rings.push({ xy, n, hole: ri > 0, area, real: area * Math.cos(yToLat(rcy) * RAD) ** 2, cx: a2 ? cx / (3 * a2) : xy[0], cy: rcy });
    });
    if (!rings.length) continue;
    const outer = rings.filter(r => !r.hole), biggest = outer.reduce((m, r) => (r.area > m.area ? r : m), outer[0] || rings[0]);
    const bigReal = outer.reduce((m, r) => Math.max(m, r.real), 0), mainRings = outer.filter(r => r.real >= bigReal * .3);
    const box = list => {
      const b = [Infinity, Infinity, -Infinity, -Infinity];
      for (const r of list) for (let i = 0; i < r.n; i++) {
        const x = r.xy[2 * i], y = r.xy[2 * i + 1];
        if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y;
      }
      return b;
    };
    const f = {
      name: g.properties?.name || String(g.id), tint: idx++ % 5, rings,
      bbox: box(rings),
      mainBox: box(mainRings.length ? mainRings : rings),
      cx: biggest.cx, cy: biggest.cy,
    };
    f.center = { lon: xToLon(f.cx), lat: yToLat(f.cy) };
    features.push(f); byName.set(f.name, f);
  }
  return { features, byName };
}

export function buildGeo(hiTopo, loTopo) {
  const hi = buildSet(hiTopo), lo = loTopo ? buildSet(loTopo) : hi;
  return {
    hi, lo, byName: hi.byName, names: hi.features.map(f => f.name).sort((a, b) => a.localeCompare(b)),
    pick: zoom => (zoom < 3.2 ? lo : hi),
  };
}

// Country packs are registered once, without adding regions to the world layer.
// Hand-made packs are checked here so a mistake fails with a readable message.
//   feature.properties: key (unique, what projects store), name (shown), level (any id; "country" = outline)
export function installCountryDetail(geo, pack) {
  if (!pack || typeof pack.country !== 'string' || !Array.isArray(pack.features) || !pack.features.length) throw Error('A country pack needs "country" and a non-empty "features" list.');
  const arcs = [], geometries = [], meta = [];
  pack.features.forEach((f, i) => {
    const p = f?.properties, g = f?.geometry;
    if (!p || !(p.key || p.name) || !isLevelId(p.level) || !g || !['Polygon', 'MultiPolygon'].includes(g.type)) throw Error(`Feature ${i} of the ${pack.country} pack needs properties.key (or name), properties.level and a Polygon or MultiPolygon geometry.`);
    const key = String(p.key ?? p.name);
    const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
    const polyArcs = polys.map(poly => poly.map(ring => {
      let x = 0, y = 0;
      const arc = ring.map(q => { const d = [q[0] - x, q[1] - y]; x = q[0]; y = q[1]; return d; });
      arcs.push(arc); return [arcs.length - 1];
    }));
    geometries.push({type:'MultiPolygon', properties:{name:key}, arcs:polyArcs});
    meta.push({ key, name: String(p.name ?? p.key), level: p.level });
  });
  const set = buildSet({transform:{scale:[1,1],translate:[0,0]}, arcs, objects:{countries:{geometries}}});
  const levels = {division:[],district:[],local:[]};
  // buildSet drops a feature that has no drawable ring, so pair results with the input by key, in order.
  let j = 0;
  for (const f of set.features) {
    while (j < meta.length && meta[j].key !== f.name) j++;
    const m = meta[j++]; if (!m) break;
    f.key = m.key; f.name = m.name; f.level = m.level; f.country = pack.country;
    if (f.level === 'country') set.country = f;
    else { (levels[f.level] ||= []).push(f); if (geo.byName.has(f.key)) console.warn(`${pack.country} pack: key "${f.key}" is already used by a country or another region, so name targets may resolve to the wrong one. Keep keys unique, e.g. "${f.key} Region".`); geo.byName.set(f.key, f); }
  }
  const cities = Array.isArray(pack.cities) ? pack.cities.filter(c => Array.isArray(c) && typeof c[0] === 'string' && Number.isFinite(c[1]) && Number.isFinite(c[2])).map(c => [c[0], c[1], c[2], c[3] || pack.country]) : undefined;
  geo.details ||= new Map();
  geo.details.set(pack.country, {...set, levels, cities, defaultLevel:pack.defaultLevel, sources:pack.sources, defaultRegion:pack.defaultRegion, levelLabels:pack.levelLabels, ready:pack.ready, attribution:pack.attribution});
  geo.detailRevision = (geo.detailRevision || 0) + 1;
  return geo.details.get(pack.country);
}
export function detailRegions(proj, geo) {
  const a = areaOf(proj);
  const countries=detailCountriesOf(a),regions=country=>geo.details?.get(country)?.levels[detailLevelOf(geo, country, a.detailLevels?.[country] || a.detailLevel)] || [];
  return countries.length===1?regions(countries[0]):countries.flatMap(regions);
}
export function regionAt(proj, geo, lon, lat) {
  return countryAt({hi:{features:detailRegions(proj,geo).map(f => ({...f,name:f.key}))}},lon,lat);
}

function ensureCum(r) {
  if (r.cum) return r;
  const cum = new Float64Array(r.n);
  for (let i = 1; i < r.n; i++) cum[i] = cum[i - 1] + Math.hypot(r.xy[2 * i] - r.xy[2 * i - 2], r.xy[2 * i + 1] - r.xy[2 * i - 1]);
  r.cum = cum; r.total = cum[r.n - 1];
  return r;
}

function inRing(r, x, y) {
  let inside = false;
  for (let i = 0, j = r.n - 1; i < r.n; j = i++) {
    const xi = r.xy[2 * i], yi = r.xy[2 * i + 1], xj = r.xy[2 * j], yj = r.xy[2 * j + 1];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Name of the country under a longitude/latitude, or null for open water. */
export function countryAt(geo, lon, lat) {
  const x0 = ((lonToX(lon) % 1) + 1) % 1, y = latToY(lat);
  for (const f of geo.hi.features) {
    const b = f.bbox;
    if (y < b[1] || y > b[3]) continue;
    for (const x of [x0, x0 + 1, x0 - 1]) { // rings may be unwrapped past the date line
      if (x < b[0] || x > b[2]) continue;
      let inside = false;
      for (const r of f.rings) if (inRing(r, x, y)) inside = !inside;
      if (inside) return f.name;
    }
  }
  return null;
}

// ---------------------------------------------------------------- Map area: whole world or one country in detail
export const AREA_MODES = { world: 'World map', country: 'One country (detailed)' };
export const NEIGHBOR_MODES = { dim: 'Dimmed', show: 'Shown normally', hide: 'Hidden' };
export const DEFAULT_AREA = { mode: 'world', country: 'Bangladesh', neighbors: 'dim', fit: true, pad: .12, name: true, cities: true };
export const areaOf = proj => ({ ...DEFAULT_AREA, ...(proj.area || {}) });
// Names used by the built-in city list that differ from the map data.
const CITY_COUNTRY = { UAE: 'United Arab Emirates', 'Türkiye': 'Turkey', 'DR Congo': 'Dem. Rep. Congo', 'Côte d’Ivoire': "Côte d'Ivoire", USA: 'United States of America' };
/** Built-in cities ([name, lat, lon, country], set as geo.cities by the app) that belong to a country. */
export function citiesOf(geo, country) {
  return (geo.details?.get(country)?.cities || geo.cities || []).filter(c => (CITY_COUNTRY[c[3]] || c[3]) === country);
}
function focusFeature(proj, geo) {
  const a = areaOf(proj);
  return a.mode === 'country' ? geo.details?.get(a.country)?.country || geo.byName.get(a.country) || null : null;
}

// ---------------------------------------------------------------- Camera + projection
export const DEFAULT_CAM = { lon: 12, lat: 26, zoom: 1.3, bearing: 0, pitch: 0 };
const camFrom = i => ({ cx: lonToX(i.lon), cy: latToY(i.lat), zoom: i.zoom, bearing: i.bearing || 0, pitch: i.pitch || 0 });

/** Pre-computes everything needed to project world units to the screen. */
export function makeView(cam, W, H) {
  const unit = Math.min(W, H) / 720, b = cam.bearing * RAD, p = clamp(cam.pitch, 0, 75) * RAD, d = (H / 2) / Math.tan(FOV / 2);
  return { cam, W, H, unit, S: BASE_PX * unit * 2 ** cam.zoom, cx: cam.cx, cy: cam.cy, cb: Math.cos(b), sb: Math.sin(b), cp: Math.cos(p), sp: Math.sin(p), d, near: d * .06 };
}

/** Project one world point (with optional elevation in px) to the screen. */
export function project(v, X, Y, e = 0) {
  const u = (X - v.cx) * v.S, w = (Y - v.cy) * v.S, x1 = u * v.cb + w * v.sb, y1 = -u * v.sb + w * v.cb;
  const z = v.d - y1 * v.sp - e * v.cp, k = v.d / Math.max(z, v.near);
  return { x: v.W / 2 + x1 * k, y: v.H / 2 + (y1 * v.cp - e * v.sp) * k, k, z };
}

/** Inverse of project() for the ground plane: screen pixel -> {lon, lat}, or null above the horizon. */
export function screenToLonLat(v, sx, sy) {
  const px = sx - v.W / 2, py = sy - v.H / 2, den = v.cp + py * v.sp / v.d;
  if (den <= 1e-4) return null;
  const y1 = py / den, x1 = px * (v.d - y1 * v.sp) / v.d;
  const u = x1 * v.cb - y1 * v.sb, w = x1 * v.sb + y1 * v.cb;
  const X = v.cx + u / v.S, Y = v.cy + w / v.S;
  if (Y < 0 || Y > 1) return null;
  return { lon: ((xToLon(X) + 180) % 360 + 360) % 360 - 180, lat: yToLat(Y) };
}

// Scratch buffers holding view-space coordinates of the polyline being drawn.
let SX = new Float64Array(8192), SY = new Float64Array(8192), SZ = new Float64Array(8192);
function ensure(n) {
  if (SX.length >= n) return;
  const m = Math.max(n, SX.length * 2);
  SX = new Float64Array(m); SY = new Float64Array(m); SZ = new Float64Array(m);
}
function loadXY(v, xy, n, off) {
  ensure(n);
  const { S, cx, cy, cb, sb, cp, sp, d } = v;
  for (let i = 0; i < n; i++) {
    const u = (xy[2 * i] + off - cx) * S, w = (xy[2 * i + 1] - cy) * S, x1 = u * cb + w * sb, y1 = -u * sb + w * cb;
    SX[i] = x1; SY[i] = y1 * cp; SZ[i] = d - y1 * sp;
  }
}
function loadPt(v, i, X, Y, e) {
  const u = (X - v.cx) * v.S, w = (Y - v.cy) * v.S, x1 = u * v.cb + w * v.sb, y1 = -u * v.sb + w * v.cb;
  SX[i] = x1; SY[i] = y1 * v.cp - e * v.sp; SZ[i] = v.d - y1 * v.sp - e * v.cp;
}

/** Adds the loaded view-space polyline to the current canvas path, clipping against the camera near plane. */
function emit(ctx, v, n, closed) {
  const { W, H, d, near } = v, hw = W / 2, hh = H / 2;
  let all = true;
  for (let i = 0; i < n; i++) if (SZ[i] < near) { all = false; break; }
  if (all) {
    let k = d / SZ[0];
    ctx.moveTo(hw + SX[0] * k, hh + SY[0] * k);
    for (let i = 1; i < n; i++) { k = d / SZ[i]; ctx.lineTo(hw + SX[i] * k, hh + SY[i] * k); }
    if (closed) ctx.closePath();
    return;
  }
  if (closed) { // Sutherland-Hodgman against z = near
    const px = [], py = [];
    let pr = n - 1;
    for (let i = 0; i < n; i++) {
      const inC = SZ[i] >= near, inP = SZ[pr] >= near;
      if (inC !== inP) {
        const t = (near - SZ[pr]) / (SZ[i] - SZ[pr]);
        px.push(hw + (SX[pr] + (SX[i] - SX[pr]) * t) * d / near); py.push(hh + (SY[pr] + (SY[i] - SY[pr]) * t) * d / near);
      }
      if (inC) { const k = d / SZ[i]; px.push(hw + SX[i] * k); py.push(hh + SY[i] * k); }
      pr = i;
    }
    if (px.length >= 3) { ctx.moveTo(px[0], py[0]); for (let i = 1; i < px.length; i++) ctx.lineTo(px[i], py[i]); ctx.closePath(); }
    return;
  }
  let pen = false;
  for (let i = 0; i < n - 1; i++) {
    const a = i, b = i + 1, ia = SZ[a] >= near, ib = SZ[b] >= near;
    if (!ia && !ib) { pen = false; continue; }
    let ax = SX[a], ay = SY[a], az = SZ[a], bx = SX[b], by = SY[b], bz = SZ[b];
    const t = (near - SZ[a]) / (SZ[b] - SZ[a]);
    if (!ia) { ax = SX[a] + (SX[b] - SX[a]) * t; ay = SY[a] + (SY[b] - SY[a]) * t; az = near; }
    if (!ib) { bx = SX[a] + (SX[b] - SX[a]) * t; by = SY[a] + (SY[b] - SY[a]) * t; bz = near; }
    if (!pen || !ia) ctx.moveTo(hw + ax * d / az, hh + ay * d / az);
    ctx.lineTo(hw + bx * d / bz, hh + by * d / bz);
    pen = ib;
  }
}

function bboxVisible(v, b, off, margin = 40) {
  let minx = 1e12, miny = 1e12, maxx = -1e12, maxy = -1e12;
  for (let i = 0; i < 4; i++) {
    const p = project(v, (i & 1 ? b[2] : b[0]) + off, i & 2 ? b[3] : b[1], 0);
    if (p.z < v.near) return true;
    if (p.x < minx) minx = p.x; if (p.x > maxx) maxx = p.x; if (p.y < miny) miny = p.y; if (p.y > maxy) maxy = p.y;
  }
  return !(maxx < -margin || minx > v.W + margin || maxy < -margin || miny > v.H + margin);
}

// ---------------------------------------------------------------- Locations
/** {kind:'city'|'point'|'country', name, lat, lon}. Countries resolve through the map data. */
export function lonLatOf(geo, loc) {
  if (!loc) return null;
  if (loc.kind === 'regions') { const f=featureForTarget(geo,loc); return f ? {lon:xToLon(f.cx),lat:yToLat(f.cy)} : null; }
  if (['country', 'region'].includes(loc.kind)) { const f = geo.byName.get(loc.name); return f ? { lon: f.center.lon, lat: f.center.lat } : null; }
  return Number.isFinite(loc.lat) && Number.isFinite(loc.lon) ? { lon: loc.lon, lat: loc.lat } : null;
}
function resolveLoc(geo, loc, nearX) {
  let X, Y, bbox = null;
  if (['country', 'region', 'regions'].includes(loc?.kind)) {
    const f = loc.kind === 'regions' ? featureForTarget(geo,loc) : geo.byName.get(loc.name); if (!f) return null;
    X = f.cx; Y = f.cy; bbox = f.mainBox.slice();
  } else if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) { X = lonToX(loc.lon); Y = latToY(loc.lat); } else return null;
  if (nearX != null) { const k = Math.round(nearX - X); X += k; if (bbox) { bbox[0] += k; bbox[2] += k; } }
  return { X, Y, bbox };
}

// ---------------------------------------------------------------- Plane routes (great circles)
const routeCache = new Map();

// ---- Drawn paths: the traveler follows waypoints the user clicked, in order.
export const PATH_CURVES = { smooth: 'Smooth curve', straight: 'Straight lines' };
const PATH_STEPS = 28;
/** Waypoints as world units, unwrapped so a path may cross the date line. */
function pathWorld(a) {
  const W = []; let prev = null;
  for (const p of Array.isArray(a.path) ? a.path : []) {
    if (!p || !Number.isFinite(p.lat) || !Number.isFinite(p.lon)) continue;
    let X = lonToX(p.lon); if (prev !== null) X += Math.round(prev - X);
    prev = X; W.push([X, latToY(p.lat)]);
  }
  return W;
}
function densifyPath(W, curve) {
  const pts = [], idx = [], n = W.length;
  if (curve === 'straight' || n < 3) {
    for (let i = 0; i < n - 1; i++) {
      idx.push(pts.length);
      for (let k = 0; k < PATH_STEPS; k++) { const f = k / PATH_STEPS; pts.push([lerp(W[i][0], W[i + 1][0], f), lerp(W[i][1], W[i + 1][1], f)]); }
    }
    idx.push(pts.length); pts.push(W[n - 1].slice());
    return { pts, idx };
  }
  // Centripetal Catmull-Rom through every waypoint: smooth, never overshoots or loops.
  const ext = [[2 * W[0][0] - W[1][0], 2 * W[0][1] - W[1][1]], ...W, [2 * W[n - 1][0] - W[n - 2][0], 2 * W[n - 1][1] - W[n - 2][1]]];
  const dist = (p, q) => Math.max(1e-6, Math.hypot(q[0] - p[0], q[1] - p[1])) ** .5;
  for (let i = 0; i < n - 1; i++) {
    const P0 = ext[i], P1 = ext[i + 1], P2 = ext[i + 2], P3 = ext[i + 3];
    const t0 = 0, t1 = t0 + dist(P0, P1), t2 = t1 + dist(P1, P2), t3 = t2 + dist(P2, P3);
    idx.push(pts.length);
    for (let k = 0; k < PATH_STEPS; k++) {
      const t = t1 + (t2 - t1) * k / PATH_STEPS;
      const mix = (A, B, ta, tb) => [((tb - t) * A[0] + (t - ta) * B[0]) / (tb - ta), ((tb - t) * A[1] + (t - ta) * B[1]) / (tb - ta)];
      const A1 = mix(P0, P1, t0, t1), A2 = mix(P1, P2, t1, t2), A3 = mix(P2, P3, t2, t3);
      pts.push(mix(mix(A1, A2, t0, t2), mix(A2, A3, t1, t3), t1, t2));
    }
  }
  idx.push(pts.length); pts.push(W[n - 1].slice());
  return { pts, idx };
}
function pathRoute(a) {
  const W = [];
  for (const p of pathWorld(a)) if (!W.length || Math.hypot(p[0] - W[W.length - 1][0], p[1] - W[W.length - 1][1]) > 1e-7) W.push(p);
  if (W.length < 2) return null;
  const curve = a.curve === 'straight' ? 'straight' : 'smooth', key = `path|${curve}|${W.map(p => p[0].toFixed(7) + ',' + p[1].toFixed(7)).join(';')}`, hit = routeCache.get(a.id);
  if (hit && hit.key === key) return hit;
  const { pts, idx } = densifyPath(W, curve), N = pts.length, X = new Float64Array(N), Y = new Float64Array(N), cum = new Float64Array(N);
  let minX = Infinity, maxX = -Infinity;
  for (let i = 0; i < N; i++) {
    X[i] = pts[i][0]; Y[i] = pts[i][1]; minX = Math.min(minX, X[i]); maxX = Math.max(maxX, X[i]);
    if (i) cum[i] = cum[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  }
  const route = { key, n: N, X, Y, cum, total: cum[N - 1], mid: (minX + maxX) / 2, wpIdx: idx, A: { lon: xToLon(X[0]), lat: yToLat(Y[0]) }, B: { lon: xToLon(X[N - 1]), lat: yToLat(Y[N - 1]) } };
  routeCache.set(a.id, route);
  return route;
}

export function planeRoute(geo, a) {
  if (a.mode === 'path') return pathRoute(a);
  const A = lonLatOf(geo, a.from), B = lonLatOf(geo, a.to);
  if (!A || !B) return null;
  const key = `${A.lat},${A.lon},${B.lat},${B.lon}`, hit = routeCache.get(a.id);
  if (hit && hit.key === key) return hit;
  const N = 160, X = new Float64Array(N + 1), Y = new Float64Array(N + 1);
  const p1 = A.lat * RAD, l1 = A.lon * RAD, p2 = B.lat * RAD, l2 = B.lon * RAD;
  const dl = Math.sin((p2 - p1) / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin((l2 - l1) / 2) ** 2, delta = 2 * Math.asin(Math.min(1, Math.sqrt(dl)));
  let prevLon = A.lon;
  for (let i = 0; i <= N; i++) {
    const f = i / N;
    let lat, lon;
    if (delta < 1e-6) { lat = lerp(A.lat, B.lat, f); lon = lerp(A.lon, B.lon, f); } else {
      const s = Math.sin(delta), a1 = Math.sin((1 - f) * delta) / s, b1 = Math.sin(f * delta) / s;
      const x = a1 * Math.cos(p1) * Math.cos(l1) + b1 * Math.cos(p2) * Math.cos(l2), y = a1 * Math.cos(p1) * Math.sin(l1) + b1 * Math.cos(p2) * Math.sin(l2), z = a1 * Math.sin(p1) + b1 * Math.sin(p2);
      lat = Math.atan2(z, Math.hypot(x, y)) / RAD; lon = Math.atan2(y, x) / RAD;
    }
    while (lon - prevLon > 180) lon -= 360;
    while (lon - prevLon < -180) lon += 360;
    prevLon = lon;
    X[i] = lonToX(lon); Y[i] = latToY(lat);
  }
  const cum = new Float64Array(N + 1);
  for (let i = 1; i <= N; i++) cum[i] = cum[i - 1] + Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]);
  const route = { key, n: N + 1, X, Y, cum, total: cum[N], mid: (X[0] + X[N]) / 2, A, B };
  routeCache.set(a.id, route);
  return route;
}
function routeAt(r, s) { // s in 0..1 of the arc length
  const target = clamp01(s) * r.total;
  let lo = 0, hi = r.n - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (r.cum[mid] <= target) lo = mid; else hi = mid; }
  const seg = r.cum[hi] - r.cum[lo], f = seg > 0 ? (target - r.cum[lo]) / seg : 0;
  return { X: lerp(r.X[lo], r.X[hi], f), Y: lerp(r.Y[lo], r.Y[hi], f), i: lo, f };
}
function routeBox(r) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  for (let i = 0; i < r.n; i++) { b[0] = Math.min(b[0], r.X[i]); b[1] = Math.min(b[1], r.Y[i]); b[2] = Math.max(b[2], r.X[i]); b[3] = Math.max(b[3], r.Y[i]); }
  return b;
}
function routeHeading(r, s) { // compass heading (0 = north, clockwise) of the route at arc position s
  const a = routeAt(r, Math.max(0, s - .02)), b = routeAt(r, Math.min(1, s + .02));
  return Math.atan2(b.X - a.X, -(b.Y - a.Y)) / RAD;
}

// ---------------------------------------------------------------- Camera presets
function fitZoom(b, W, H, pad, min = .6, max = 10) {
  const unit = Math.min(W, H) / 720, bw = Math.max(1e-6, b[2] - b[0]), bh = Math.max(1e-6, b[3] - b[1]);
  return clamp(Math.log2(Math.min(W * (1 - pad) / bw, H * (1 - pad) / bh) / (BASE_PX * unit)), min, max);
}
const turn = (a, b) => ((b - a + 540) % 360) - 180; // shortest signed angle

/** The start view: the saved start camera, or (country map with "fit") the view that frames the chosen country. */
export function startCam(proj, geo, W, H) {
  const i = proj.camera.init, ar = areaOf(proj), f = ar.mode === 'country' && ar.fit ? focusFeature(proj, geo) : null;
  if (!f) return camFrom(i);
  const b = f.mainBox, bw = b[2] - b[0], bh = b[3] - b[1], rot = (i.bearing || 0) * RAD, ac = Math.abs(Math.cos(rot)), as = Math.abs(Math.sin(rot));
  const turned = [0, 0, bw * ac + bh * as, bw * as + bh * ac]; // box of the country once the map is rotated
  const zoom = fitZoom(turned, W, H, ar.pad * 2, .5, 12) - (clamp(i.pitch || 0, 0, 75) / 75) * .45;
  return { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, zoom, bearing: i.bearing || 0, pitch: i.pitch || 0 };
}

// "Fly-to" path with smooth zoom-out-and-in (van Wijk & Nuij), progress k in 0..1.
function fly(from, to, k, W, H) {
  const unit = Math.min(W, H) / 720, rho = 1.42, rho2 = rho * rho;
  const dx = to.cx - from.cx, dy = to.cy - from.cy, u1 = Math.hypot(dx, dy) * BASE_PX * unit * 2 ** from.zoom;
  const out = { bearing: from.bearing + turn(from.bearing, to.bearing) * k, pitch: lerp(from.pitch, to.pitch, k) };
  if (u1 < 1e-3) return { ...out, cx: from.cx, cy: from.cy, zoom: lerp(from.zoom, to.zoom, k) };
  const w0 = Math.max(W, H), w1 = w0 / 2 ** (to.zoom - from.zoom);
  const r = i => { const b = (w1 * w1 - w0 * w0 + (i ? -1 : 1) * rho2 * rho2 * u1 * u1) / (2 * (i ? w1 : w0) * rho2 * u1); return Math.log(Math.sqrt(b * b + 1) - b); };
  const r0 = r(0), S = (r(1) - r0) / rho, s = k * S;
  const w = Math.cosh(r0) / Math.cosh(r0 + rho * s), u = (w0 / rho2) * (Math.cosh(r0) * Math.tanh(r0 + rho * s) - Math.sinh(r0)) / u1;
  return { ...out, cx: lerp(from.cx, to.cx, k >= 1 ? 1 : u), cy: lerp(from.cy, to.cy, k >= 1 ? 1 : u), zoom: k >= 1 ? to.zoom : from.zoom - Math.log2(w) };
}

function shotState(s, from, tr, frame, c) {
  const t = ease(s.easing, tr), { geo, W, H, project: pr } = c;
  switch (s.preset) {
    case 'keyframed': {
      return camFrom(cameraPoseAt(s, frame));
    }
    case 'flyTo': case 'swoop': {
      const r = resolveLoc(geo, s.target, from.cx); if (!r) return from;
      const fit = s.autoFit && ['country', 'region', 'regions'].includes(s.target.kind) && r.bbox;
      return fly(from, {
        cx: fit ? (r.bbox[0] + r.bbox[2]) / 2 : r.X, cy: fit ? (r.bbox[1] + r.bbox[3]) / 2 : r.Y,
        zoom: fit ? fitZoom(r.bbox, W, H, .24) : s.zoom, pitch: s.pitch, bearing: s.bearing,
      }, t, W, H);
    }
    case 'worldView': {
      const w = startCam(pr, geo, W, H); w.cx += Math.round(from.cx - w.cx);
      return fly(from, { ...w, pitch: 0, bearing: 0 }, t, W, H);
    }
    case 'pushIn': return { ...from, zoom: lerp(from.zoom, from.zoom + s.amount, t) };
    case 'pullBack': return { ...from, zoom: lerp(from.zoom, Math.max(.4, from.zoom - s.amount), t) };
    case 'orbit': return { ...from, bearing: from.bearing + s.degrees * t, pitch: lerp(from.pitch, s.pitch, t), zoom: lerp(from.zoom, from.zoom + s.amount, t) };
    case 'tilt': return { ...from, pitch: lerp(from.pitch, s.pitch, t), zoom: lerp(from.zoom, from.zoom + s.amount, t) };
    case 'panTo': {
      const r = resolveLoc(geo, s.target, from.cx); if (!r) return from;
      return { ...from, cx: lerp(from.cx, r.X, t), cy: lerp(from.cy, r.Y, t) };
    }
    case 'framePlane': {
      const a = pr.actions.find(x => x.id === s.planeId && (x.type === 'plane' || x.type === 'object')), r = a && planeRoute(geo, a); if (!r) return from;
      const b = routeBox(r), off = Math.round(from.cx - (b[0] + b[2]) / 2); b[0] += off; b[2] += off;
      return fly(from, { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, zoom: fitZoom(b, W, H, .38), pitch: s.pitch, bearing: s.bearing }, t, W, H);
    }
    case 'followPlane': {
      const a = pr.actions.find(x => x.id === s.planeId && (x.type === 'plane' || x.type === 'object')), r = a && planeRoute(geo, a); if (!r) return from;
      const q = ease(a.easing, actionProgress(a, frame)), p = routeAt(r, q);
      const X = p.X + Math.round(from.cx - p.X), blend = ease('easeOut', tr * 3.2), settle = ease('easeInOut', tr * 2);
      return {
        cx: lerp(from.cx, X, blend), cy: lerp(from.cy, p.Y, blend), zoom: lerp(from.zoom, s.zoom, settle), pitch: lerp(from.pitch, s.pitch, settle),
        bearing: s.lockHeading ? from.bearing + turn(from.bearing, routeHeading(r, q)) * settle : from.bearing,
      };
    }
    default: return from;
  }
}

function evalShot(s, from, frame, c) {
  const end = s.start + s.dur;
  const keys = animationKeysOf(s);
  return shotState(s, from, clamp01((frame - keys.start) / Math.max(1, keys.end - keys.start)), Math.min(frame, end), c);
}

/** Camera state at a frame: start view followed by each preset shot in order. */
export function cameraAt(proj, geo, W, H, frame) {
  const init = startCam(proj, geo, W, H), shots = proj.shots.filter(s => s.visible !== false).sort((a, b) => a.start - b.start), c = { geo, W, H, project: proj };
  let prev = null;
  for (const s of shots) {
    if (frame < s.start) break;
    prev = { s, from: prev ? evalShot(prev.s, prev.from, s.start, c) : init };
  }
  return prev ? evalShot(prev.s, prev.from, frame, c) : init;
}

// ---------------------------------------------------------------- Drawing helpers
function rrect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// ---------------------------------------------------------------- Label style (project-wide, with optional per-item override)
export const LABEL_SHAPES = { pill: 'Pill', rounded: 'Rounded box', square: 'Square box', tag: 'Tag with pointer', none: 'Text only' };
export const LABEL_WEIGHTS = [[400, 'Regular'], [600, 'Semibold'], [700, 'Bold'], [800, 'Extra bold']];
export const DEFAULT_LABEL_STYLE = { font: 'Arial', weight: 600, italic: false, size: 14, caps: false, spacing: 0, shape: 'pill', placement: 'screen', useTheme: true, text: '#ffffff', bg: '#0c1c28', bgAlpha: .9, border: '#ffffff', borderW: 0, halo: false, shadow: false };
export const LABEL_PRESETS = {
  atlasGround: { label: 'Atlas serif · fixed to map', style: { placement: 'map', scaleMode: 'fixed', font: 'Libre Baskerville', weight: 700, size: 48, shape: 'none', halo: true, haloWidth: .08, useTheme: false, text: '#d5e3df', bg: '#172c30', spacing: 8 } },
  default: { label: 'Default pill', style: { placement: 'screen' } },
  clean: { label: 'Clean text', style: { placement: 'screen', shape: 'none', halo: true, weight: 700, size: 17 } },
  map2d: { label: '2D · Attached to map', style: { placement: 'map', shape: 'none', halo: true, weight: 700, size: 17 } },
  atlas: { label: 'Atlas capitals', style: { placement: 'screen', font: 'Cinzel', weight: 700, caps: true, spacing: 14, size: 15, shape: 'none', halo: true } },
  news: { label: 'News banner', style: { placement: 'screen', font: 'Oswald', weight: 700, caps: true, spacing: 6, size: 16, shape: 'square', useTheme: false, bg: '#e63946', text: '#ffffff', bgAlpha: 1, shadow: true } },
  tag: { label: 'Yellow tag', style: { placement: 'screen', font: 'Poppins', weight: 700, size: 15, shape: 'tag', useTheme: false, bg: '#ffd166', text: '#1b1b1b', bgAlpha: 1, shadow: true } },
  ribbon: { label: 'Black ribbon (for image badges)', style: { placement: 'screen', font: 'Cinzel', weight: 700, size: 16, spacing: 4, shape: 'rounded', useTheme: false, bg: '#111111', text: '#ffffff', bgAlpha: 1, border: '#ffffff', borderW: 1.5, shadow: true } },
  hand: { label: 'Handwritten', style: { placement: 'screen', font: 'Caveat', weight: 700, size: 24, shape: 'none', halo: true } },
  bangla: { label: 'Bangla (বাংলা)', style: { placement: 'screen', font: 'Hind Siliguri', weight: 600, size: 17 } },
};
/** Project style, then the item's own override (if any), on top of the defaults. */
export function labelStyleOf(proj, item) { return { ...DEFAULT_LABEL_STYLE, ...(proj.labelStyle || {}), ...(item?.labelStyle || {}) }; }
// Local-area labels omit their parent suffix on the basemap.
const routeLabelKey = text => String(text).split(' · ')[0].trim().toLowerCase();
// Polygon intersections and eased progress can differ by rounding at a border.
const passedRouteEntry = (progress, entry) => progress + 1e-10 >= entry;
/** Every font family the project needs, so the editor and exporter can load them first. */
export function mapFontsUsed(proj) {
  const out = new Set([cleanFont(labelStyleOf(proj).font)]);
  const atlas = atlasLabelSettings(proj.atlasLabels);
  if (atlas.countries || atlas.oceans) out.add(cleanFont(atlas.font));
  for (const a of proj.actions) if (a.labelStyle?.font) out.add(cleanFont(a.labelStyle.font));
  return [...out];
}
function drawLabel(ctx, v, th, l, st) {
  const zoomScale = st.scaleMode === 'world' ? 2 ** (v.cam.zoom - (st.referenceZoom ?? 3)) : 1;
  const fs = Math.max(4, Math.round(st.size * v.unit * (l.scale || 1) * zoomScale)), text = st.caps ? String(l.text).toUpperCase() : String(l.text);
  ctx.save();
  ctx.font = `${st.italic ? 'italic ' : ''}${st.weight} ${fs}px ${fontStack(st.font)}`;
  const ls = fs * st.spacing / 100; if ('letterSpacing' in ctx) ctx.letterSpacing = ls.toFixed(2) + 'px';
  const boxed = st.shape !== 'none', w = ctx.measureText(text).width + (boxed ? fs * 1.5 : 0), h = fs * 1.9;
  const bg = st.useTheme ? th.pill : st.bg, fg = st.useTheme ? th.pillText : st.text, bgA = st.useTheme ? 1 : st.bgAlpha, a0 = clamp01(l.alpha);
  let x = l.x, y = l.y;
  if (st.placement === 'map' && l.ground) {
    const q = project(v, l.ground.X, l.ground.Y);
    if (q.z <= v.near) { ctx.restore(); return; }
    x = l.groundOffset?.x ?? 0; y = l.groundOffset?.y ?? 0;
    // Keep the entire label in front of the near plane, including its tag/halo.
    const pad = fs * .35, bottom = h / 2 + (st.shape === 'tag' ? fs * .55 : 0) + pad;
    const angle = (l.angle || 0) * RAD, ac = Math.cos(angle), as = Math.sin(angle);
    for (const dx of [-w / 2 - pad, w / 2 + pad]) for (const dy of [-h / 2 - pad, bottom]) {
      const rx = x + dx * ac - dy * as, ry = y + dx * as + dy * ac;
      if (q.z - (-v.sb * rx + v.cb * ry) * v.sp <= v.near) { ctx.restore(); return; }
    }
    const u = (l.ground.X - v.cx) * v.S, z = (l.ground.Y - v.cy) * v.S;
    const x1 = u * v.cb + z * v.sb, t = x1 * q.k * v.sp / q.z;
    // Local map axes projected at the anchor: text rotates and foreshortens
    // with the ground, including its local perspective scale.
    ctx.transform(q.k * v.cb - t * v.sb, -v.cp * q.k * q.k * v.sb,
      q.k * v.sb + t * v.cb, v.cp * q.k * q.k * v.cb, q.x, q.y);
  }
  if (l.angle) { ctx.translate(x, y); ctx.rotate(l.angle * RAD); x = y = 0; }
  const x0 = x - w / 2, y0 = y - h / 2;
  if (boxed) {
    const path = () => {
      rrect(ctx, x0, y0, w, h, st.shape === 'pill' ? h / 2 : st.shape === 'rounded' ? h * .28 : fs * .08);
      if (st.shape === 'tag') { ctx.moveTo(x - fs * .45, y0 + h - .5); ctx.lineTo(x, y0 + h + fs * .55); ctx.lineTo(x + fs * .45, y0 + h - .5); ctx.closePath(); }
    };
    if (bgA > 0) {
      ctx.globalAlpha = a0 * bgA; ctx.fillStyle = bg;
      if (st.shadow) { ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = fs * .5; ctx.shadowOffsetY = fs * .15; }
      path(); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    if (st.borderW > 0) { ctx.globalAlpha = a0; ctx.strokeStyle = st.border; ctx.lineWidth = st.borderW * v.unit; ctx.lineJoin = 'round'; path(); ctx.stroke(); }
  }
  ctx.globalAlpha = a0; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const tx = x + ls / 2, ty = y + fs * .05;
  if (st.halo) { ctx.lineJoin = 'round'; ctx.lineWidth = fs * (st.haloWidth ?? .26); ctx.strokeStyle = bg; ctx.strokeText(text, tx, ty); }
  if (!boxed && st.shadow) { ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = fs * .35; ctx.shadowOffsetY = fs * .08; }
  ctx.fillStyle = fg; ctx.fillText(text, tx, ty);
  ctx.restore();
}
const bounce = t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; };
// Timeline length controls visibility; animation duration controls the reveal/movement.
const animationDuration = a => a.animDur ?? a.dur;
export const actionProgress = (a, frame) => { const keys = animationKeysOf(a); return clamp01((frame - keys.start) / Math.max(1, keys.end - keys.start)); };
export const objectMoveProgress = (a, frame) => a.moveStart === undefined ? actionProgress(a, frame) : clamp01((frame - a.moveStart) / Math.max(1, a.moveEnd - a.moveStart));
const actAlpha = (a, frame) => frame >= a.start && frame < a.start + a.dur ? 1 : 0;

function groundCircle(ctx, v, X, Y, rPx, off = 0) { // circle of radius rPx screen-pixels (at the map's scale) lying on the map
  const r = rPx / v.S, xy = new Float64Array(2 * 49);
  for (let i = 0; i < 49; i++) { xy[2 * i] = X + off + Math.cos(i / 48 * Math.PI * 2) * r; xy[2 * i + 1] = Y + Math.sin(i / 48 * Math.PI * 2) * r; }
  loadXY(v, xy, 49, 0); emit(ctx, v, 49, true);
}
function glowStroke(ctx, color, w, alpha, glow = true) {
  ctx.strokeStyle = color;
  if (glow) { ctx.globalAlpha = alpha * .14; ctx.lineWidth = w * 4.2; ctx.stroke(); ctx.globalAlpha = alpha * .3; ctx.lineWidth = w * 2; ctx.stroke(); }
  ctx.globalAlpha = alpha; ctx.lineWidth = w; ctx.stroke();
}
function headDot(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, color); g.addColorStop(.35, color); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); ctx.globalAlpha = alpha * .55; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r * 3, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = alpha; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y, r * .8, 0, Math.PI * 2); ctx.fill(); ctx.restore();
}

// Realistic terrain without animated/noisy texture.
// Instead of overlaying grain, we create terrain-like variation from per-country
// gradients and deterministic color shifts. This keeps the map clean while still
// looking more physical and topographic.
const rgbHex = hex => ({ r: parseInt(hex.slice(1, 3), 16), g: parseInt(hex.slice(3, 5), 16), b: parseInt(hex.slice(5, 7), 16) });
const mixColor = (a, b, t) => {
  const A = rgbHex(a), B = rgbHex(b), m = (x, y) => Math.round(x + (y - x) * clamp(t, 0, 1));
  return `rgb(${m(A.r, B.r)}, ${m(A.g, B.g)}, ${m(A.b, B.b)})`;
};
const hash01 = (x, y, z = 0) => {
  const s = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453123;
  return s - Math.floor(s);
};
function terrainLandStyle(ctx, v, f, k, th) {
  const base = th.land[f.tint] || th.land[0] || '#7b8f66';
  const lat = Math.abs(f.center?.lat || 0) / 90;
  const seed = hash01(f.cx || 0, f.cy || 0, f.tint || 0);
  const verdant = mixColor(base, '#6f9457', .16 * (1 - lat) + .08 * seed);
  const dry = mixColor(base, '#aa9b72', .14 * lat + .08 * (1 - seed));
  const peak = mixColor(base, '#d1c4a1', .22 + .08 * seed);
  const shade = mixColor(base, '#4d6841', .26 + .10 * (1 - seed));
  const b = f.mainBox || f.bbox;
  const p0 = project(v, b[0] + k, b[1]);
  const p1 = project(v, b[2] + k, b[3]);
  if (![p0.x, p0.y, p1.x, p1.y].every(Number.isFinite)) return base;
  const g = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y);
  g.addColorStop(0, peak);
  g.addColorStop(.28, verdant);
  g.addColorStop(.62, dry);
  g.addColorStop(1, shade);
  return g;
}
function naturalWater(ctx,v) {
  const g=ctx.createLinearGradient(0,0,0,v.H);
  g.addColorStop(0,'#174b68');g.addColorStop(.5,'#2b7991');g.addColorStop(1,'#0a354b');
  ctx.save(); ctx.globalAlpha=.52; ctx.fillStyle=g; ctx.fillRect(0,0,v.W,v.H);ctx.restore();
}
// ---------------------------------------------------------------- Satellite imagery (raster XYZ tiles, same Web-Mercator space)
// The provider (map-imagery.mjs) is passed in as geo.imagery, so this file stays DOM-free.
function groundWorld(v, sx, sy) { // like screenToLonLat, but unwrapped world units and with a safety margin below the horizon
  const px = sx - v.W / 2, py = sy - v.H / 2, den = v.cp + py * v.sp / v.d;
  if (den <= .12) return null;
  const y1 = py / den, x1 = px * (v.d - y1 * v.sp) / v.d;
  return { X: v.cx + (x1 * v.cb - y1 * v.sb) / v.S, Y: v.cy + (x1 * v.sb + y1 * v.cb) / v.S };
}
/** Which tiles cover the screen: one zoom level (chosen from the on-screen size) and a rectangle of x/y indices. */
function planTiles(v, maxZoom, detail = 0) {
  let z = Math.ceil(Math.log2(v.S / 256) - .3) + detail; if (v.cam.pitch >= 45) z -= 1;
  z = clamp(z, 0, maxZoom);
  const syMin = v.sp > 1e-6 ? clamp(v.H / 2 + (.13 - v.cp) * v.d / v.sp, 0, v.H) : 0;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) {
    const g = groundWorld(v, v.W * i / 6, syMin + (v.H - syMin) * j / 6); if (!g) continue;
    x0 = Math.min(x0, g.X); x1 = Math.max(x1, g.X); y0 = Math.min(y0, g.Y); y1 = Math.max(y1, g.Y);
  }
  if (!Number.isFinite(x0) || y1 < 0 || y0 > 1) return null;
  for (;;) { // never plan an enormous grid (steep tilt): drop a zoom level instead
    const n = 2 ** z, tx0 = Math.floor(x0 * n), tx1 = Math.floor(x1 * n), ty0 = Math.floor(clamp(y0, 0, .999999) * n), ty1 = Math.floor(clamp(y1, 0, .999999) * n);
    if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) <= 140 || z === 0) {
      const list = []; for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) list.push({ tx, ty });
      return { z, n, list };
    }
    z--;
  }
}
/** Tiles a frame needs, so an export can wait for them (and prefetch the next frames) before drawing. */
export function imageryNeeds(proj, geo, W, H, frame) {
  const th = THEMES[proj.theme], provider = th?.relief ? geo.relief : geo.imagery;
  if (!(th?.imagery || th?.relief) || !provider) return [];
  if (th.relief) provider.configure(proj.terrain);
  const id = th.relief ? 'relief' : proj.imagery || 'gibs', v = makeView(cameraAt(proj, geo, W, H, frame), W, H), plan = planTiles(v, provider.maxZoom(id), th.relief ? 1 : 0);
  if (!plan) return [];
  const seen = new Set(), out = [];
  for (const t of plan.list) { const x = ((t.tx % plan.n) + plan.n) % plan.n, k = x + ',' + t.ty; if (!seen.has(k)) { seen.add(k); out.push({ src: id, z: plan.z, x, y: t.ty }); } }
  return out;
}
function tileMesh(ctx, v, img, X0, Y0, w, sx, sy, ss, n) { // draw one tile as an n x n mesh of affine-mapped cells (n = 1 when the map is not tilted)
  const iw = img.width, ih = img.height, P = [], e = .9;
  for (let j = 0; j <= n; j++) for (let i = 0; i <= n; i++) P.push(project(v, X0 + w * i / n, Y0 + w * j / n, 0));
  if (P.some(q => !Number.isFinite(q.x) || !Number.isFinite(q.y) || q.z < v.near * 2)) return;
  if (P.every(q => q.x < -40) || P.every(q => q.x > v.W + 40) || P.every(q => q.y < -40) || P.every(q => q.y > v.H + 40)) return;
  const U = i => (sx + ss * i / n) * iw, V = j => (sy + ss * j / n) * ih;
  const put = (a, b, c, ua, va, ub, vb, uc, vc, clip) => { // affine map: image pixels (u,v) -> screen, from three vertex pairs
    const det = (ub - ua) * (vc - va) - (uc - ua) * (vb - va); if (Math.abs(det) < 1e-9) return;
    const A = ((b.x - a.x) * (vc - va) - (c.x - a.x) * (vb - va)) / det, C = ((c.x - a.x) * (ub - ua) - (b.x - a.x) * (uc - ua)) / det;
    const B = ((b.y - a.y) * (vc - va) - (c.y - a.y) * (vb - va)) / det, D = ((c.y - a.y) * (ub - ua) - (b.y - a.y) * (uc - ua)) / det;
    ctx.save(); ctx.transform(A, B, C, D, a.x - A * ua - C * va, a.y - B * ua - D * va);
    if (clip) { // triangle pushed outwards by e image pixels, so neighbouring triangles overlap instead of leaving hairlines
      const cu = (ua + ub + uc) / 3, cv = (va + vb + vc) / 3, o = (u, vv) => { const dx = u - cu, dy = vv - cv, l = Math.hypot(dx, dy) || 1; return [u + dx / l * e, vv + dy / l * e]; };
      const q0 = o(ua, va), q1 = o(ub, vb), q2 = o(uc, vc); ctx.beginPath(); ctx.moveTo(q0[0], q0[1]); ctx.lineTo(q1[0], q1[1]); ctx.lineTo(q2[0], q2[1]); ctx.closePath(); ctx.clip();
    }
    return true;
  };
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const u0 = U(i), u1 = U(i + 1), v0 = V(j), v1 = V(j + 1), p00 = P[j * (n + 1) + i], p10 = P[j * (n + 1) + i + 1], p01 = P[(j + 1) * (n + 1) + i], p11 = P[(j + 1) * (n + 1) + i + 1];
    const cell = () => ctx.drawImage(img, u0, v0, u1 - u0, v1 - v0, u0 - e, v0 - e, u1 - u0 + 2 * e, v1 - v0 + 2 * e);
    if (n === 1) { if (put(p00, p10, p01, u0, v0, u1, v0, u0, v1, false)) { cell(); ctx.restore(); } continue; }
    if (put(p00, p10, p01, u0, v0, u1, v0, u0, v1, true)) { cell(); ctx.restore(); }
    if (put(p10, p11, p01, u1, v0, u1, v1, u0, v1, true)) { cell(); ctx.restore(); }
  }
}
function drawImagery(ctx, v, im, id) {
  const plan = planTiles(v, im.maxZoom(id), id === 'relief' ? 1 : 0); if (!plan) return;
  if (im.retain) im.retain(plan.list.flatMap(t => {
    const x = ((t.tx % plan.n) + plan.n) % plan.n;
    return [{ z: plan.z, x, y: t.ty }, ...(plan.z ? [{ z: plan.z - 1, x: Math.floor(x / 2), y: Math.floor(t.ty / 2) }] : [])];
  }));
  const n = v.sp < 1e-4 ? 1 : (v.cam.pitch < 35 ? 4 : 8);
  ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  for (const t of plan.list) {
    const x = ((t.tx % plan.n) + plan.n) % plan.n; let img = im.get(id, plan.z, x, t.ty), sx = 0, sy = 0, ss = 1;
    // Relief requests a visible parent too, for progressive loading and crossfades.
    if (id === 'relief' && plan.z > 0) im.get(id, plan.z - 1, Math.floor(x / 2), Math.floor(t.ty / 2));
    const opacity = img && v.tileFade && im.opacity ? im.opacity(id, plan.z, x, t.ty) : 1;
    if (!img || opacity < 1) for (let dz = 1; dz <= (id === 'relief' ? 14 : 4) && plan.z - dz >= 0; dz++) { // still loading: stretch a coarser tile that is already in memory
      const m = 2 ** dz, a = im.peek(id, plan.z - dz, Math.floor(x / m), Math.floor(t.ty / m));
      if (a) {
        if (img) tileMesh(ctx, v, a, t.tx / plan.n, t.ty / plan.n, 1 / plan.n, (x % m) / m, (t.ty % m) / m, 1 / m, n);
        else { img = a; ss = 1 / m; sx = (x % m) / m; sy = (t.ty % m) / m; }
        break;
      }
    }
    ctx.globalAlpha = opacity;
    if (img) tileMesh(ctx, v, img, t.tx / plan.n, t.ty / plan.n, 1 / plan.n, sx, sy, ss, n);
    ctx.globalAlpha = 1;
  }
  ctx.restore();
}
function drawAttribution(ctx, v, text) {
  const fs = 10 * v.unit; ctx.save(); ctx.font = `500 ${fs}px Arial, sans-serif`; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.lineJoin = 'round'; ctx.lineWidth = fs * .35; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.fillStyle = 'rgba(255,255,255,.85)';
  ctx.strokeText(text, v.W - 8 * v.unit, v.H - 6 * v.unit); ctx.fillText(text, v.W - 8 * v.unit, v.H - 6 * v.unit); ctx.restore();
}
// ---------------------------------------------------------------- Base map
const baseMapCache = new WeakMap();
function drawPreviewBase(ctx, v, geo, th, proj) {
  // One bounded raster per preview context. Animated overlays and exports keep
  // their normal rendering path; satellite tiles must refresh as they arrive.
  if (v.img || v.W * v.H > 4_000_000 || (typeof OffscreenCanvas === 'undefined' && typeof document === 'undefined')) { drawBase(ctx, v, geo, th, proj); return; }
  const key = JSON.stringify([v.W, v.H, v.cx, v.cy, v.cam.zoom, v.cam.pitch, v.cam.bearing, proj.theme, proj.graticule, proj.area, geo.detailRevision || 0]);
  let cached = baseMapCache.get(ctx);
  if (!cached || cached.geo !== geo || cached.key !== key) {
    baseMapCache.set(ctx, { geo, key, surface: cached?.surface, ready: false });
    drawBase(ctx, v, geo, th, proj); return;
  }
  if (!cached.ready) {
    const surface = cached?.surface || (typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(v.W, v.H) : document.createElement('canvas'));
    if (surface.width !== v.W) surface.width = v.W;
    if (surface.height !== v.H) surface.height = v.H;
    const base = surface.getContext('2d'); base.lineJoin = 'round'; base.lineCap = 'round';
    drawBase(base, v, geo, th, proj);
    cached = { geo, key, surface, ready: true, fillStyle: base.fillStyle, strokeStyle: base.strokeStyle, lineWidth: base.lineWidth };
    baseMapCache.set(ctx, cached);
  }
  ctx.drawImage(cached.surface, 0, 0);
  ctx.fillStyle = cached.fillStyle; ctx.strokeStyle = cached.strokeStyle; ctx.lineWidth = cached.lineWidth;
}
function drawBase(ctx, v, geo, th, proj) {
  ctx.fillStyle = th.void; ctx.fillRect(0, 0, v.W, v.H);
  const k0 = Math.round(v.cx);
  ctx.beginPath(); loadXY(v, new Float64Array([k0 - 4, 0, k0 + 5, 0, k0 + 5, 1, k0 - 4, 1]), 4, 0); emit(ctx, v, 4, true);
  ctx.fillStyle = th.ocean; ctx.fill();
  if (v.img) drawImagery(ctx, v, v.img.im, v.img.id);
  else if (proj.theme === 'realistic') naturalWater(ctx, v);
  if (proj.graticule) {
    ctx.beginPath();
    for (let i = -48; i <= 60; i++) { const X = k0 + i / 12; if (Math.abs(X - v.cx) > 3) continue; loadXY(v, new Float64Array([X, 0, X, 1]), 2, 0); emit(ctx, v, 2, false); }
    for (const lat of [-60, -30, 0, 30, 60]) { const Y = latToY(lat); loadXY(v, new Float64Array([k0 - 4, Y, k0 + 5, Y]), 2, 0); emit(ctx, v, 2, false); }
    ctx.strokeStyle = th.grat; ctx.globalAlpha = th.gratA; ctx.lineWidth = Math.max(.6, v.unit * .8); ctx.stroke(); ctx.globalAlpha = 1;
  }
  const focus = focusFeature(proj, geo), neighbors = focus ? areaOf(proj).neighbors : 'show';
  const set = focus ? geo.hi : geo.pick(v.cam.zoom); // a country map always uses the detailed outlines
  ctx.strokeStyle = th.border; ctx.lineWidth = th.bw * v.unit;
  const paint = (f, k, fill, borderA, lw, raised) => {
    ctx.beginPath();
    for (const r of f.rings) { loadXY(v, r.xy, r.n, k); emit(ctx, v, r.n, true); }
    ctx.fillStyle = fill || '#000';
    if (!fill) { /* imagery: outline only */ } else if (raised) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.42)'; ctx.shadowBlur = 18 * v.unit; ctx.shadowOffsetY = 4 * v.unit; ctx.fill('evenodd'); ctx.restore(); } else ctx.fill('evenodd');
    ctx.lineWidth = lw; ctx.globalAlpha = borderA; ctx.stroke(); ctx.globalAlpha = 1;
  };
  const fillOf = (f, k) => (v.img ? null : proj.theme === 'realistic' ? terrainLandStyle(ctx, v, f, k, th) : th.land[f.tint]);
  for (let k = k0 - 1; k <= k0 + 1; k++) for (const f of set.features) {
    if (focus && (f.name === focus.name || (neighbors === 'hide' && !v.img))) continue; // the chosen country is drawn last, on top
    if (!bboxVisible(v, f.bbox, k)) continue;
    if (focus && neighbors === 'dim') paint(f, k, v.img ? 'rgba(2,8,12,.6)' : mixColor(th.land[f.tint], th.ocean, .58), th.borderA * .45, th.bw * v.unit, false);
    else if (focus && neighbors === 'hide') paint(f, k, th.void, 0, th.bw * v.unit, false); // imagery: cover the neighbours
    else paint(f, k, fillOf(f, k), th.borderA, th.bw * v.unit, false);
  }
  if (focus) {
    const f = focus;
    if (f) for (let k = k0 - 1; k <= k0 + 1; k++) if (bboxVisible(v, f.bbox, k)) paint(f, k, fillOf(f, k), 1, th.bw * v.unit * 1.7, true);
  }
  for (const region of detailRegions(proj, geo)) for (let k = k0 - 1; k <= k0 + 1; k++) if (bboxVisible(v, region.bbox, k)) paint(region, k, fillOf(region, k), th.borderA, th.bw * v.unit, false);
}
/** A spot inside the country, as far from its cities as possible, where the country name can sit without covering a city. */
function nameAnchor(f, cities, midX) {
  const key = cities.map(c => c[0]).join('|');
  if (f._anchor && f._anchor.key === key) return f._anchor;
  const b = f.mainBox, cs = cities.map(c => { const X0 = lonToX(c[2]); return [X0 + Math.round(midX - X0), latToY(c[1])]; });
  const cx = (b[0] + b[2]) / 2, cy = (b[1] + b[3]) / 2, N = 17;
  let best = null;
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const x = b[0] + (b[2] - b[0]) * (i + .5) / N, y = b[1] + (b[3] - b[1]) * (j + .5) / N;
    let inside = false; for (const r of f.rings) if (inRing(r, x, y)) inside = !inside;
    if (!inside) continue;
    let far = cs.length ? Infinity : 0; for (const c of cs) far = Math.min(far, Math.hypot(x - c[0], y - c[1]));
    const size = Math.max(b[2] - b[0], b[3] - b[1]), score = far / size - .6 * Math.hypot(x - cx, y - cy) / size;
    if (!best || score > best.score) best = { x, y, score };
  }
  f._anchor = { key, x: best ? best.x : cx, y: best ? best.y : cy };
  return f._anchor;
}
/** Country and ocean names share geographic anchors across preview and export. */
export function atlasMapLabels(proj, geo, v) {
  const s = atlasLabelSettings(proj.atlasLabels), out = [], occupied = [];
  if (!s.countries && !s.oceans) return out;
  const style = { font: s.font, weight: 700, shape: 'none', halo: true, haloWidth: s.haloWidth, useTheme: false, text: s.text, bg: s.outline, spacing: s.spacing, placement: s.placement, scaleMode: s.scaleMode, referenceZoom: s.referenceZoom, caps: false, italic: false };
  const add = (text, X, Y, size, ocean = false, angle = 0) => {
    const ground = { X, Y }, q = project(v, X, Y);
    if (q.z <= v.near) return;
    const scale = s.scaleMode === 'world' ? 2 ** (v.cam.zoom - s.referenceZoom) : 1;
    const fs = size * v.unit * scale, w = text.length * fs * .67 * (1 + s.spacing / 100), h = fs * 1.4;
    if (s.declutter && fs < 6) return;
    const a = angle * RAD, c = Math.cos(a), sn = Math.sin(a), corners = [];
    for (const x of [-w / 2, w / 2]) for (const y of [-h / 2, h / 2]) {
      const dx = x * c - y * sn, dy = x * sn + y * c;
      const p = s.placement === 'map' ? project(v, X + dx / v.S, Y + dy / v.S) : { x: q.x + dx, y: q.y + dy, z: q.z };
      if (p.z <= v.near) return;
      corners.push(p);
    }
    const b = { x0: Math.min(...corners.map(p => p.x)), x1: Math.max(...corners.map(p => p.x)), y0: Math.min(...corners.map(p => p.y)), y1: Math.max(...corners.map(p => p.y)) };
    if (b.x1 < 0 || b.x0 > v.W || b.y1 < 0 || b.y0 > v.H) return;
    if (s.declutter && occupied.some(a => b.x0 < a.x1 && b.x1 > a.x0 && b.y0 < a.y1 && b.y1 > a.y0)) return;
    occupied.push(b);
    out.push({ x: q.x, y: q.y, ground, text, angle, alpha: s.opacity, scale: 1, over: { ...style, size, italic: ocean } });
  };
  const k0 = Math.round(v.cx);
  if (s.countries) {
    // Larger countries get first choice when overlap reduction is enabled.
    if (!geo._atlasCountries) {
      const area = f => f.rings.reduce((sum, r) => sum + (r.hole ? 0 : r.real || 0), 0);
      geo._atlasCountries = [...geo.hi.features].sort((a, b) => area(b) - area(a));
    }
    for (const f of geo._atlasCountries) for (let k = k0 - 1; k <= k0 + 1; k++) {
      if (!bboxVisible(v, f.bbox, k)) continue;
      const mid = (f.mainBox[0] + f.mainBox[2]) / 2, a = nameAnchor(f, [], mid);
      const advance = f.name.length * .67 * (1 + s.spacing / 100);
      const layout = s.fitCountries || s.countryAngles ? countryLabelLayout(f, a, advance / 1.4, s.countryAngles) : { width: 0, angle: 0 };
      const size = s.fitCountries ? clamp(layout.width * BASE_PX * 2 ** s.referenceZoom / advance * s.size / 30, 2, 240) : s.size;
      add(f.name, a.x + k, a.y, size, false, layout.angle);
    }
  }
  if (s.oceans) for (const ocean of OCEAN_LABELS) for (let k = k0 - 1; k <= k0 + 1; k++) add(ocean.name, lonToX(ocean.lon) + k, latToY(ocean.lat), s.oceanSize, true, s.countryAngles ? (ocean.angle || 0) : 0);
  return out;
}
/** Country map extras: the country's name and its main cities (labels are nudged apart so they stay readable). */
function drawAreaDetail(ctx, v, geo, th, proj, labels, routeNames, worldOverlay=false) {
  if(areaOf(proj).mode!=='country'){
    for(const country of detailCountriesOf(areaOf(proj)))drawAreaDetail(ctx,v,geo,th,{...proj,area:{...areaOf(proj),mode:'country',country,fit:false,detailCountries:[]}},labels,routeNames,true);
    return;
  }
  const f = focusFeature(proj, geo); if (!f) return;
  const ar = areaOf(proj), b = f.mainBox, mid = (b[0] + b[2]) / 2, off = Math.round(v.cx - mid), st = labelStyleOf(proj);
  // Keep town and administrative labels readable when detailed countries share a world view.
  if(worldOverlay && Math.max(b[2]-b[0],b[3]-b[1])*v.S<160*v.unit)return;
  const cities = ar.cities ? citiesOf(geo, f.name) : [];
  const NAME_STYLE = { shape: 'none', halo: true, weight: 800, caps: true, spacing: 14 };
  const box = (x, y, text, scale, over) => { // approximate label rectangle on screen
    const o = { ...st, ...over }, fs = Math.max(4, o.size * v.unit * scale), w = text.length * fs * (o.caps ? .8 : .6) * (1 + o.spacing / 100) + (o.shape === 'none' ? fs * .6 : fs * 1.5);
    return { x0: x - w / 2, x1: x + w / 2, y0: y - fs, y1: y + fs, w };
  };
  const placed = [], hits = r => placed.some(p => r.x0 < p.x1 && r.x1 > p.x0 && r.y0 < p.y1 && r.y1 > p.y0);
  const dots = cities.map(c => { const X0 = lonToX(c[2]), ground = { X: X0 + Math.round(mid - X0) + off, Y: latToY(c[1]) }, q = project(v, ground.X, ground.Y); return { c, q, ground }; });
  for (const { q } of dots) placed.push({ x0: q.x - 8 * v.unit, x1: q.x + 8 * v.unit, y0: q.y - 8 * v.unit, y1: q.y + 8 * v.unit });
  if (ar.name && !proj.atlasLabels?.countries && !routeNames.has(routeLabelKey(f.name))) {
    const a = nameAnchor(f, cities, mid), q = !worldOverlay && geo.details?.has(f.name) ? {x:v.W / 2,y:28 * v.unit} : project(v, a.x + off, a.y), r = box(q.x, q.y, f.name, 1.6, NAME_STYLE);
    placed.push(r);
    labels.push({ x: q.x, y: q.y, ground: { X: a.x + off, Y: a.y }, text: f.name, alpha: .96, scale: 1.6, over: NAME_STYLE });
  }
  ctx.save();
  for (const { c, q, ground } of dots) {
    ctx.globalAlpha = 1; ctx.fillStyle = th.pillText; ctx.strokeStyle = th.pill; ctx.lineWidth = 2.4 * v.unit;
    ctx.beginPath(); ctx.arc(q.x, q.y, 4.2 * v.unit, 0, Math.PI * 2); ctx.stroke(); ctx.fill();
    if (routeNames.has(routeLabelKey(c[0]))) continue;
    const w = box(0, 0, c[0], .82).w, u = v.unit;
    const spots = [[0, -17 * u], [0, 17 * u], [w / 2 + 9 * u, 0], [-w / 2 - 9 * u, 0], [0, -34 * u], [0, 34 * u]];
    let pick = null;
    for (const sp of spots) { if (!hits(box(q.x + sp[0], q.y + sp[1], c[0], .82))) { pick = sp; break; } }
    if (!pick || q.x < 0 || q.x > v.W || q.y < 0 || q.y > v.H) continue;
    placed.push(box(q.x + pick[0], q.y + pick[1], c[0], .82));
    labels.push({ x: q.x + pick[0], y: q.y + pick[1], ground, groundOffset: { x: pick[0], y: pick[1] }, text: c[0], alpha: 1, scale: .82 });
  }
  if (ar.cities) for (const region of detailRegions(proj,geo)) {
    const q = project(v,region.cx + off,region.cy), text = region.name.split(' · ')[0];
    if (routeNames.has(routeLabelKey(text))) continue;
    if (labels.some(l => l.text === text)) continue;
    const r = box(q.x,q.y,text,.65,{shape:'none'});
    if (q.x < 0 || q.x > v.W || q.y < 0 || q.y > v.H || hits(r)) continue;
    placed.push(r); labels.push({x:q.x,y:q.y,ground:{X:region.cx + off,Y:region.cy},text,alpha:.9,scale:.65,over:{shape:'none',halo:true}});
  }
  ctx.restore();
}
function vignette(ctx, v, th) {
  if (!th.vignette) return;
  const g = ctx.createRadialGradient(v.W / 2, v.H / 2, Math.min(v.W, v.H) * .35, v.W / 2, v.H / 2, Math.hypot(v.W, v.H) * .62);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, `rgba(0,0,0,${th.vignette})`);
  ctx.fillStyle = g; ctx.fillRect(0, 0, v.W, v.H);
}

// ---------------------------------------------------------------- Animation: borders
let tmp = new Float64Array(4096);
function partialRing(r, p) {
  ensureCum(r);
  if (p >= 1) return { xy: r.xy, n: r.n, closed: true };
  const target = p * r.total;
  let lo = 0, hi = r.n - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (r.cum[mid] <= target) lo = mid; else hi = mid; }
  const seg = r.cum[hi] - r.cum[lo], f = seg > 0 ? (target - r.cum[lo]) / seg : 0, n = lo + 2;
  if (tmp.length < n * 2) tmp = new Float64Array(n * 2 * 2);
  for (let i = 0; i <= lo; i++) { tmp[2 * i] = r.xy[2 * i]; tmp[2 * i + 1] = r.xy[2 * i + 1]; }
  tmp[2 * lo + 2] = lerp(r.xy[2 * lo], r.xy[2 * hi], f); tmp[2 * lo + 3] = lerp(r.xy[2 * lo + 1], r.xy[2 * hi + 1], f);
  return { xy: tmp, n, closed: false };
}

function drawBorder(ctx, v, geo, th, a, frame) {
  const alpha = actAlpha(a, frame); if (alpha <= 0) return;
  const t0 = actionProgress(a, frame), p = a.invert ? Math.max(0, 1 - ease(a.easing, t0)) : ease(a.easing, t0), w = a.width * v.unit; // invert: the same grow played backwards
  const all = a.target?.kind === 'all', features = all ? (a.target.country ? geo.details?.get(a.target.country)?.levels[detailLevelOf(geo, a.target.country, a.target.level)] || [] : geo.pick(v.cam.zoom).features) : targetFeatures(geo,a.target);
  const list = a.target?.kind === 'regions' ? [featureForTarget(geo,a.target)].filter(Boolean) : features;
  if (!list.length) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  let head = null;
  for (const f of list) {
    const off = Math.round(v.cx - f.cx), local = all ? clamp01((p * 1.7 - (a.target.country ? 0 : f.cx * .7)) ) : p;
    if (local <= 0 || !bboxVisible(v, f.bbox, off, 80)) continue;
    let main = null;
    for (const [index,r] of f.rings.entries()) {
      if(a.borderPartial && index !== borderRingOf(f,a.borderRing))continue;
      const from = (a.borderFrom ?? 0) / 100;
      const pr = a.borderPartial ? borderSection(r,from,(a.borderTo ?? 100)/100,local,!!a.borderReverse) : (from || a.borderReverse) ? borderSection(r,from,from + (a.borderReverse ? -1 : 1),Math.min(1,local),!!a.borderReverse) : partialRing(r, local);
      loadXY(v, pr.xy, pr.n, off); emit(ctx, v, pr.n, pr.closed);
      if (!all && !r.hole && (!main || r.area > main.r.area)) main = { r, pr: { xy: pr.xy.slice(0, pr.n * 2), n: pr.n, closed: pr.closed } };
    }
    if (main && !main.pr.closed) head = { xy: main.pr.xy, n: main.pr.n, off };
  }
  glowStroke(ctx, a.color, w, alpha, a.glow);
  if (!all && !a.borderPartial && a.fillAlpha > 0 && p > .55) {
    const f = list[0], off = Math.round(v.cx - f.cx);
    ctx.beginPath(); for (const r of f.rings) { loadXY(v, r.xy, r.n, off); emit(ctx, v, r.n, true); }
    ctx.globalAlpha = alpha * a.fillAlpha * clamp01((p - .55) / .45); ctx.fillStyle = a.color; ctx.fill('evenodd');
  }
  if (head) {
    const i = head.n - 1, q = project(v, head.xy[2 * i] + head.off, head.xy[2 * i + 1]);
    headDot(ctx, q.x, q.y, 4 * v.unit + w * .5, a.color, alpha);
  }
  ctx.restore();
}

export function drawRegionSelection(ctx,v,geo,selection){
  for(const target of selection)drawBorder(ctx,v,geo,THEMES.earth,{target,start:0,dur:10,animDur:1,easing:'linear',width:3,color:'#00e5ff',glow:true,fillAlpha:.12},1);
}

export function drawBorderEndpoints(ctx,v,geo,action){
  if(action?.type!=='border'||action.target?.kind==='all')return;
  const f=featureForTarget(geo,action.target);if(!f)return;
  const r=f.rings[borderRingOf(f,action.borderRing)];if(!r)return;
  const off=Math.round(v.cx-f.cx);
  for(const [t,label,color]of [[(action.borderFrom??0)/100,'Start','#00e5ff'],[(action.borderTo??100)/100,'End','#ffb703']]){
    if(label==='End'&&!action.borderPartial)continue;
    const point=borderSection(r,t,t),q=project(v,point.xy[0]+off,point.xy[1]);
    ctx.save();headDot(ctx,q.x,q.y,5*v.unit,color,1);ctx.font=`600 ${12*v.unit}px Arial`;ctx.textAlign='center';ctx.fillStyle=color;ctx.fillText(label,q.x,q.y-12*v.unit);ctx.restore();
  }
}

// ---------------------------------------------------------------- Animation: highlight
function featureRadius(f, x = f.cx, y = f.cy) { // cache the radius for the current reveal origin
  if (f._revealRadius?.x === x && f._revealRadius.y === y) return f._revealRadius.radius;
  let m = 0; for (const r of f.rings) for (let i = 0; i < r.n; i++) m = Math.max(m, Math.hypot(r.xy[2 * i] - x, r.xy[2 * i + 1] - y));
  f._revealRadius = { x, y, radius: m || .01 };
  return f._revealRadius.radius;
}
function drawHighlight(ctx, v, geo, th, a, frame, labels) {
  const alpha = actAlpha(a, frame); if (alpha <= 0) return;
  const t0 = actionProgress(a, frame), t = a.invert ? 1 - t0 : t0, p = a.invert ? Math.max(0, 1 - ease(a.easing, t0)) : ease(a.easing, t0), age = Math.max(0, frame - a.start), pop = ease('backOut', clamp01((t - .45) / .3)); // invert: the same grow played backwards
  if (['country', 'region', 'regions'].includes(a.target?.kind)) {
    const f = featureForTarget(geo,a.target); if (!f) return;
    const off = Math.round(v.cx - f.cx), path = () => { ctx.beginPath(); for (const r of f.rings) { loadXY(v, r.xy, r.n, off); emit(ctx, v, r.n, true); } };
    const originX = a.highlightOrigin ? lonToX(a.highlightOrigin.lon) : f.cx;
    const x = originX + Math.round(f.cx - originX), y = a.highlightOrigin ? latToY(a.highlightOrigin.lat) : f.cy;
    const c = project(v, f.cx + off, f.cy), rad = featureRadius(f, x, y) * v.S * 1.05 * p;
    ctx.save();
    if (a.dim > 0) { ctx.globalAlpha = a.dim * p * alpha; ctx.fillStyle = th.dim; ctx.fillRect(0, 0, v.W, v.H); ctx.globalAlpha = 1; path(); if (v.img) { ctx.save(); ctx.clip('evenodd'); drawImagery(ctx, v, v.img.im, v.img.id); ctx.restore(); } else { ctx.fillStyle = th.land[f.tint]; ctx.fill('evenodd'); } }
    if (rad > 0) { // colour, outline and pulse are revealed outward from the centre, clipped to the country
      ctx.save(); ctx.beginPath(); groundCircle(ctx, v, x, y, rad, off); ctx.clip();
      path(); ctx.globalAlpha = alpha * (th.relief ? (a.reliefOpacity ?? v.terrain.highlightOpacity) : (a.reliefOpacity ?? .78));
      ctx.fillStyle = th.relief ? (a.reliefColor || v.terrain.highlightColor) : a.color;
      // Hard-light can lift dark green terrain into warm gold while retaining
      // the elevation image's local contrast beneath the highlight.
      if (th.relief) ctx.globalCompositeOperation = 'hard-light';
      ctx.fill('evenodd'); ctx.globalCompositeOperation = 'source-over';
      ctx.lineJoin = 'round';
      if (th.relief) glowStroke(ctx, a.reliefColor || v.terrain.highlightColor, .8 * v.unit, alpha * .45, false);
      else glowStroke(ctx, a.color, 2.6 * v.unit, alpha, true);
      if (a.pulse) { const q = (age % 54) / 54; ctx.globalAlpha = alpha * (1 - q) * .35; ctx.fillStyle = '#fff'; path(); ctx.fill('evenodd'); }
      ctx.restore();
    }
    ctx.restore();
    if (a.showLabel && pop > 0) labels.push({ x: c.x, y: c.y, ground: { X: f.cx + off, Y: f.cy }, text: a.label || f.name, alpha: alpha * clamp01(pop * 1.5), scale: 1.1 * (.9 + .2 * pop) });
    return;
  }
  const r = resolveLoc(geo, a.target, v.cx); if (!r) return;
  const lat = yToLat(r.Y), rad = (a.radius / (40075 * Math.cos(lat * RAD))) * v.S; // km -> screen px
  const c = project(v, r.X, r.Y, 0);
  ctx.save();
  if (a.dim > 0) { ctx.globalAlpha = a.dim * p * alpha * .8; ctx.fillStyle = th.dim; ctx.fillRect(0, 0, v.W, v.H); }
  ctx.globalAlpha = 1;
  ctx.beginPath(); groundCircle(ctx, v, r.X, r.Y, rad * p);
  ctx.globalAlpha = alpha * .28; ctx.fillStyle = a.color; ctx.fill();
  glowStroke(ctx, a.color, 2.4 * v.unit, alpha, true);
  if (a.pulse) for (let i = 0; i < 3; i++) {
    const q = ((age / 60 + i / 3) % 1);
    ctx.beginPath(); groundCircle(ctx, v, r.X, r.Y, rad * (.15 + q * 1.1) * p);
    ctx.globalAlpha = alpha * (1 - q) * .7; ctx.strokeStyle = a.color; ctx.lineWidth = 2 * v.unit; ctx.stroke();
  }
  ctx.restore();
  const dot = ease('backOut', clamp01(t / .35)); // centre dot grows into place instead of fading
  if (dot > 0) { ctx.save(); ctx.globalAlpha = alpha; ctx.fillStyle = '#fff'; ctx.strokeStyle = a.color; ctx.lineWidth = 3 * v.unit; ctx.beginPath(); ctx.arc(c.x, c.y, 5 * v.unit * dot, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore(); }
  if (a.showLabel && pop > 0) labels.push({ x: c.x, y: c.y - 24 * v.unit, ground: { X: r.X, Y: r.Y }, groundOffset: { y: -24 * v.unit }, text: a.label || a.target.name, alpha: alpha * clamp01(pop * 1.5), scale: 1.1 * (.9 + .2 * pop) });
}

// ---------------------------------------------------------------- Animation: plane
const PLANE_HALF = [[1, 0], [.86, -.07], [.4, -.1], [.3, -.12], [-.05, -.85], [-.28, -.85], [-.18, -.14], [-.7, -.1], [-.88, -.36], [-1, -.36], [-.98, -.05], [-1, 0]];
function drawPlaneGlyph(ctx, x, y, ang, size, fill, stroke, alpha) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(size, size); ctx.globalAlpha = alpha;
  ctx.beginPath(); ctx.moveTo(1, 0);
  for (let i = 1; i < PLANE_HALF.length; i++) ctx.lineTo(PLANE_HALF[i][0], PLANE_HALF[i][1]);
  for (let i = PLANE_HALF.length - 2; i >= 0; i--) ctx.lineTo(PLANE_HALF[i][0], -PLANE_HALF[i][1]);
  ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.lineJoin = 'round'; ctx.strokeStyle = stroke; ctx.lineWidth = .09; ctx.stroke(); }
  ctx.restore();
}
// ---------------------------------------------------------------- Travel icons (all vector, drawn in a -1..1 box and scaled by the icon size)
export const TRAVEL_ICONS = {
  plane: { label: 'Plane', color: '#ffffff', lift: 50 },
  helicopter: { label: 'Helicopter', color: '#ffffff', lift: 40 },
  rocket: { label: 'Rocket', color: '#ffffff', lift: 80 },
  car: { label: 'Car', color: '#ff4d4d', lift: 0 },
  bus: { label: 'Bus', color: '#ffc300', lift: 0 },
  train: { label: 'Train', color: '#3a86ff', lift: 0 },
  ship: { label: 'Ship', color: '#ffffff', lift: 0 },
  person: { label: 'Person walking', color: '#ffffff', lift: 0 },
  bicycle: { label: 'Bicycle', color: '#ffffff', lift: 0 },
  money: { label: 'Money (coin)', color: '#ffc300', lift: 30 },
};
// how each icon behaves: rot = turns fully to the heading, flip = mirrors when heading west, tilt = max lean (radians), k = size factor
const ICON_RULES = { rocket: { rot: 1, k: 1 }, car: { flip: 1, tilt: .3, k: 1 }, bus: { flip: 1, tilt: .3, k: 1.05 }, train: { flip: 1, tilt: .3, k: 1.1 }, ship: { flip: 1, tilt: .12, k: 1.05 }, helicopter: { flip: 1, tilt: 0, k: 1 }, person: { flip: 1, tilt: 0, k: 1.15 }, bicycle: { flip: 1, tilt: .3, k: 1 }, money: { flip: 0, tilt: 0, k: .8 } };
const rrectP = (c, x, y, w, h, r) => { c.beginPath(); c.roundRect(x, y, w, h, r); };
function outline(c, P, col) { c.fillStyle = col; c.fill(); if (!P.shadow) { c.lineJoin = 'round'; c.strokeStyle = P.dark; c.lineWidth = .06; c.stroke(); } }
const box = (c, P, x, y, w, h, r, col) => { rrectP(c, x, y, w, h, r); outline(c, P, col); };
const disc = (c, P, x, y, r, col) => { c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); outline(c, P, col); };
const patch = (c, P, x, y, w, h, r, col) => { rrectP(c, x, y, w, h, r); c.fillStyle = col; c.fill(); };
function wheel(c, P, x, y, r, t) {
  disc(c, P, x, y, r, P.dark); if (P.shadow) return;
  c.beginPath(); c.arc(x, y, r * .5, 0, Math.PI * 2); c.fillStyle = P.light; c.fill();
  c.save(); c.translate(x, y); c.rotate(t); c.strokeStyle = P.dark; c.lineWidth = r * .16; c.lineCap = 'round';
  for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-r * .46, 0); c.lineTo(r * .46, 0); c.stroke(); }
  c.restore();
}
function limbs(c, P, list) { // thick round-capped strokes with a dark outline underneath
  c.lineCap = 'round'; c.lineJoin = 'round';
  for (const pass of [1, 0]) for (const [x1, y1, x2, y2, w, col] of list) { c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.lineWidth = w + (pass && !P.shadow ? .1 : 0); c.strokeStyle = pass ? P.dark : (col || P.fill); c.stroke(); }
}
const ICON_DRAW = {
  car(c, P, t) {
    box(c, P, -1, -.02, 2, .46, .12, P.fill);
    c.beginPath(); c.moveTo(-.58, -.02); c.lineTo(-.42, -.4); c.quadraticCurveTo(-.38, -.48, -.28, -.48); c.lineTo(.3, -.48); c.quadraticCurveTo(.4, -.48, .47, -.38); c.lineTo(.66, -.02); c.closePath(); outline(c, P, P.fill);
    c.fillStyle = P.glass; c.beginPath(); c.moveTo(-.4, -.08); c.lineTo(-.3, -.36); c.lineTo(.02, -.36); c.lineTo(.02, -.08); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(.1, -.08); c.lineTo(.1, -.36); c.lineTo(.3, -.36); c.lineTo(.5, -.08); c.closePath(); c.fill();
    patch(c, P, .9, .04, .1, .13, .03, P.lamp);
    wheel(c, P, -.55, .44, .25, t); wheel(c, P, .55, .44, .25, t);
  },
  bus(c, P, t) {
    box(c, P, -1, -.52, 2, .92, .14, P.fill);
    for (let i = 0; i < 5; i++) patch(c, P, -.88 + i * .33, -.4, .27, .3, .05, P.glass);
    patch(c, P, .77, -.4, .17, .55, .05, P.glass);
    c.save(); c.globalAlpha *= .35; c.fillStyle = P.dark; c.fillRect(-1, .17, 2, .09); c.restore();
    patch(c, P, .93, .24, .07, .1, .02, P.lamp);
    wheel(c, P, -.6, .4, .22, t); wheel(c, P, .55, .4, .22, t);
  },
  train(c, P, t) {
    box(c, P, -1, -.4, 2, .86, .16, P.fill);
    box(c, P, -.1, -.54, .34, .14, .04, P.dark);
    patch(c, P, -.78, -.26, .28, .34, .05, P.glass); patch(c, P, -.4, -.26, .28, .34, .05, P.glass); patch(c, P, .3, -.26, .5, .34, .05, P.glass);
    c.save(); c.globalAlpha *= .35; c.fillStyle = P.dark; c.fillRect(-1, .22, 2, .09); c.restore();
    c.beginPath(); c.arc(.93, .12, .06, 0, Math.PI * 2); c.fillStyle = P.lamp; c.fill();
    for (const x of [-.7, -.3, .3, .7]) wheel(c, P, x, .48, .17, t);
  },
  ship(c, P, t) {
    c.translate(0, Math.sin(t) * .04); c.rotate(Math.sin(t * .7) * .05);
    c.beginPath(); c.moveTo(-.96, .05); c.lineTo(1, .05); c.quadraticCurveTo(.92, .38, .62, .5); c.lineTo(-.72, .5); c.closePath(); outline(c, P, P.fill);
    c.save(); c.globalAlpha *= .35; c.fillStyle = P.dark; c.fillRect(-.9, .22, 1.8, .08); c.restore();
    box(c, P, -.5, -.3, .8, .36, .06, P.fill); box(c, P, -.15, -.62, .26, .34, .04, P.dark);
    for (const x of [-.36, -.16, .04, .24]) { c.beginPath(); c.arc(x, -.1, .07, 0, Math.PI * 2); c.fillStyle = P.glass; c.fill(); }
  },
  helicopter(c, P, t) {
    c.translate(0, Math.sin(t * .8) * .03);
    c.beginPath(); c.moveTo(-.35, -.1); c.lineTo(-1, -.2); c.lineTo(-1, -.06); c.lineTo(-.35, .14); c.closePath(); outline(c, P, P.fill);
    c.beginPath(); c.ellipse(.05, 0, .55, .34, 0, 0, Math.PI * 2); outline(c, P, P.fill);
    c.beginPath(); c.ellipse(.28, -.05, .24, .17, 0, 0, Math.PI * 2); c.fillStyle = P.glass; c.fill();
    c.strokeStyle = P.dark; c.lineWidth = .07; c.lineCap = 'round';
    c.beginPath(); c.moveTo(.05, -.34); c.lineTo(.05, -.52); c.moveTo(-.45, .55); c.lineTo(.55, .55); c.moveTo(-.2, .3); c.lineTo(-.25, .55); c.moveTo(.3, .3); c.lineTo(.35, .55); c.stroke();
    const L = .95 * (.25 + .75 * Math.abs(Math.cos(t * 3))); c.lineWidth = .09; c.beginPath(); c.moveTo(.05 - L, -.54); c.lineTo(.05 + L, -.54); c.stroke();
    const R = .22 * Math.abs(Math.cos(t * 4)) + .04; c.lineWidth = .06; c.beginPath(); c.moveTo(-1, -.13 - R); c.lineTo(-1, -.13 + R); c.stroke();
  },
  rocket(c, P, t) {
    const f = .5 + .5 * Math.sin(t * 9);
    if (!P.shadow) { c.beginPath(); c.moveTo(-.7, -.17); c.lineTo(-1.05 - .25 * f, 0); c.lineTo(-.7, .17); c.closePath(); c.fillStyle = '#ffb703'; c.fill(); c.beginPath(); c.moveTo(-.7, -.09); c.lineTo(-.9 - .12 * f, 0); c.lineTo(-.7, .09); c.closePath(); c.fillStyle = '#fff3b0'; c.fill(); }
    for (const s of [-1, 1]) { c.beginPath(); c.moveTo(-.35, s * .27); c.lineTo(-.85, s * .66); c.lineTo(-.72, s * .27); c.closePath(); outline(c, P, P.dark); }
    c.beginPath(); c.moveTo(1, 0); c.quadraticCurveTo(.55, -.3, -.5, -.28); c.lineTo(-.72, -.28); c.lineTo(-.72, .28); c.lineTo(-.5, .28); c.quadraticCurveTo(.55, .3, 1, 0); c.closePath(); outline(c, P, P.fill);
    c.beginPath(); c.arc(.2, 0, .13, 0, Math.PI * 2); c.fillStyle = P.glass; c.fill(); if (!P.shadow) { c.strokeStyle = P.dark; c.lineWidth = .05; c.stroke(); }
  },
  person(c, P, t) {
    c.translate(0, -Math.abs(Math.sin(t)) * .05);
    const a = Math.sin(t) * .7, leg = (k) => [0, .04, Math.sin(k) * .52, .04 + Math.cos(k) * .52, .17], arm = (k) => [0, -.4, -Math.sin(k) * .4, -.4 + Math.cos(k) * .38, .12];
    limbs(c, P, [leg(-a), arm(a), [0, -.5, 0, .04, .3], leg(a), arm(-a)]);
    disc(c, P, 0, -.74, .19, P.fill);
  },
  bicycle(c, P, t) {
    const ring = (x) => { c.lineWidth = .12; if (!P.shadow) { c.strokeStyle = P.dark; c.beginPath(); c.arc(x, .3, .36, 0, Math.PI * 2); c.stroke(); } c.lineWidth = .05; c.strokeStyle = P.fill; c.beginPath(); c.arc(x, .3, .36, 0, Math.PI * 2); c.stroke();
      if (!P.shadow) { c.save(); c.translate(x, .3); c.rotate(t); c.strokeStyle = P.dark; c.lineWidth = .025; for (let i = 0; i < 3; i++) { c.rotate(Math.PI / 3); c.beginPath(); c.moveTo(-.34, 0); c.lineTo(.34, 0); c.stroke(); } c.restore(); } };
    ring(-.62); ring(.62);
    const px = -.05 + Math.cos(t) * .14, py = .3 + Math.sin(t) * .14, hip = [-.28, -.24], knee = [(hip[0] + px) / 2 + .12, (hip[1] + py) / 2];
    limbs(c, P, [[-.62, .3, -.05, .3, .07], [-.62, .3, -.28, -.2, .07], [-.05, .3, -.28, -.2, .07], [-.28, -.2, .3, -.2, .07], [-.05, .3, .3, -.2, .07], [.3, -.2, .62, .3, .07], [.3, -.2, .26, -.38, .07], [.26, -.38, .46, -.38, .07],
      [hip[0], hip[1], knee[0], knee[1], .11], [knee[0], knee[1], px, py, .11], [-.28, -.26, -.05, -.66, .2], [-.05, -.66, .3, -.4, .09]]);
    disc(c, P, .02, -.86, .15, P.fill);
  },
  money(c, P, t, sym) {
    c.translate(0, -Math.abs(Math.sin(t * .8)) * .3); c.scale(Math.max(.14, Math.abs(Math.cos(t * .6))), 1);
    disc(c, P, 0, 0, .78, P.fill);
    if (P.shadow) return;
    c.beginPath(); c.arc(0, 0, .58, 0, Math.PI * 2); c.save(); c.globalAlpha *= .45; c.strokeStyle = P.dark; c.lineWidth = .06; c.stroke(); c.restore();
    const s = String(sym || '$').slice(0, 4); c.fillStyle = P.dark; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = `800 ${s.length > 2 ? .42 : s.length > 1 ? .6 : .95}px "Noto Sans Bengali", "Hind Siliguri", Arial, sans-serif`; c.fillText(s, 0, .05);
  },
};
/** Draws one travel icon centred on (x, y) heading `ang` (screen radians). `t` is an animation phase; shadow = flat black silhouette. */
function drawTravelIcon(ctx, kind, x, y, ang, size, color, alpha, t, symbol, shadow) {
  if (kind === 'plane') return drawPlaneGlyph(ctx, x, y, ang, size, shadow ? '#000' : color, shadow ? null : '#0b1620', alpha);
  const R = ICON_RULES[kind], dx = Math.cos(ang), dy = Math.sin(ang);
  ctx.save(); ctx.translate(x, y); ctx.globalAlpha = alpha;
  if (R.rot) ctx.rotate(ang);
  else {
    const left = R.flip && dx < 0;
    if (R.tilt) ctx.rotate(Math.max(-R.tilt, Math.min(R.tilt, Math.atan2(left ? -dy : dy, Math.abs(dx)))));
    if (left) ctx.scale(-1, 1);
  }
  ctx.scale(size * R.k, size * R.k);
  const P = shadow ? { shadow: true, fill: '#000', dark: '#000', light: '#000', glass: '#000', lamp: '#000' } : { fill: color, dark: '#0b1620', light: '#f4f8ff', glass: '#9fd3ee', lamp: '#ffe27a' };
  ICON_DRAW[kind](ctx, P, t, symbol);
  ctx.restore();
}
function loadRoute(v, r, s, off, lift) { // view-space points from the start of the route up to arc position s
  const p = routeAt(r, s), n = p.i + 2;
  ensure(n + 1);
  for (let i = 0; i <= p.i; i++) loadPt(v, i, r.X[i] + off, r.Y[i], lift * Math.sin(Math.PI * (r.cum[i] / (r.total || 1))));
  loadPt(v, p.i + 1, p.X + off, p.Y, lift * Math.sin(Math.PI * s));
  return n;
}
function drawPlane(ctx, v, geo, th, a, frame, labels, routeNames) {
  const r = planeRoute(geo, a), alpha = actAlpha(a, frame); if (!r || alpha <= 0) return;
  const t = actionProgress(a, frame), s = ease(a.easing, t), lift = a.lift * v.unit, off = Math.round(v.cx - r.mid);
  const E = u => lift * Math.sin(Math.PI * u), w = a.width * v.unit;
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (a.showPath) { // faint full route
    ctx.beginPath(); const n = loadRoute(v, r, 1, off, lift); emit(ctx, v, n, false);
    ctx.setLineDash([4 * v.unit, 7 * v.unit]); ctx.strokeStyle = a.color; ctx.globalAlpha = alpha * .35; ctx.lineWidth = Math.max(1, w * .6); ctx.stroke(); ctx.setLineDash([]);
  }
  // trail
  if (s > 0) {
    ctx.beginPath(); const n = loadRoute(v, r, s, off, lift); emit(ctx, v, n, false);
    if (a.dashed) ctx.setLineDash([10 * v.unit, 8 * v.unit]);
    glowStroke(ctx, a.color, w, alpha, a.glow); ctx.setLineDash([]);
  }
  // points of a drawn path: hollow until the traveler has passed them
  if (r.wpIdx && a.showWaypoints !== false) {
    for (let w = 1; w < r.wpIdx.length - 1; w++) {
      const i = r.wpIdx[w], u = r.cum[i] / (r.total || 1), q = project(v, r.X[i] + off, r.Y[i], lift * Math.sin(Math.PI * u)), passed = s >= u - 1e-6;
      ctx.globalAlpha = alpha; ctx.lineWidth = 2.2 * v.unit; ctx.strokeStyle = a.color; ctx.fillStyle = passed ? a.color : '#fff';
      ctx.beginPath(); ctx.arc(q.x, q.y, 3.8 * v.unit, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
  }
  // ends
  const A = project(v, r.X[0] + off, r.Y[0]), B = project(v, r.X[r.n - 1] + off, r.Y[r.n - 1]);
  for (const [pt, hit] of [[A, true], [B, s >= 1]]) {
    ctx.globalAlpha = alpha; ctx.fillStyle = '#fff'; ctx.strokeStyle = a.color; ctx.lineWidth = 3 * v.unit;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 5 * v.unit, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (hit && pt === B) { const q = ((frame - a.start - animationDuration(a)) / 40) % 1; if (frame >= a.start + animationDuration(a)) { ctx.globalAlpha = alpha * (1 - q) * .7; ctx.beginPath(); ctx.arc(pt.x, pt.y, (6 + q * 22) * v.unit, 0, Math.PI * 2); ctx.stroke(); } }
  }
  if (a.showLabels) {
    // A drawn path only names its ends when they sit on a known city or the user typed a label (never raw coordinates).
    const nameOf = (custom, loc) => custom || (a.mode === 'path' && (!loc || loc.kind === 'point') ? '' : loc?.name || '');
    const t1 = nameOf(a.fromLabel, a.from), t2 = nameOf(a.toLabel, a.to);
    const entered = text => {
      const key = routeLabelKey(text);
      const first = routeNames.reduce((entry, name) => routeLabelKey(name.text) === key ? Math.min(entry, name.enterS) : entry, Infinity);
      return first === Infinity || passedRouteEntry(s, first);
    };
    if (t1 && entered(t1)) labels.push({ x: A.x, y: A.y - 24 * v.unit, ground: { X: r.X[0] + off, Y: r.Y[0] }, groundOffset: { y: -24 * v.unit }, text: t1, alpha, scale: 1 });
    if (t2 && entered(t2)) labels.push({ x: B.x, y: B.y - 24 * v.unit, ground: { X: r.X[r.n - 1] + off, Y: r.Y[r.n - 1] }, groundOffset: { y: -24 * v.unit }, text: t2, alpha: alpha * clamp01(s * 4), scale: 1 });
  }
  if (a.showRouteLabels) {
    for (const name of routeNames) {
      if (!passedRouteEntry(s, name.enterS)) continue;
      const q = project(v, name.X + off, name.Y);
      if (q.z < v.near || q.x < -160 * v.unit || q.x > v.W + 160 * v.unit || q.y < -40 * v.unit || q.y > v.H + 40 * v.unit) continue;
      labels.push({ x: q.x, y: q.y + 22 * v.unit, ground: { X: name.X + off, Y: name.Y }, groundOffset: { y: 22 * v.unit }, text: name.text, alpha, scale: .82 });
    }
  }
  // aircraft + ground shadow
  if (t > 0 || frame >= a.start) {
    const pos = routeAt(r, s), e = E(s), g = project(v, pos.X + off, pos.Y, 0), body = project(v, pos.X + off, pos.Y, e);
    const p0 = routeAt(r, Math.max(0, s - .012)), p1 = routeAt(r, Math.min(1, s + .012));
    const q0 = project(v, p0.X + off, p0.Y, E(Math.max(0, s - .012))), q1 = project(v, p1.X + off, p1.Y, E(Math.min(1, s + .012)));
    const ang = r.total > 0 ? Math.atan2(q1.y - q0.y, q1.x - q0.x) : 0, size = a.size * v.unit * body.k;
    const sh = 1 + e / Math.max(1, 90 * v.unit);
    const kind = Object.hasOwn(TRAVEL_ICONS, a.icon) ? a.icon : 'plane', phase = t * animationDuration(a) * .35;
    drawTravelIcon(ctx, kind, g.x + e * .22, g.y + e * .34, ang, size * .86, '#000', alpha * .18 / sh, phase, a.symbol, true);
    drawTravelIcon(ctx, kind, body.x, body.y, ang, size, a.planeColor, alpha, phase, a.symbol, false);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Path editor (preview overlay only)
/** Screen positions of a drawn path's points, for the overlay and for picking them with the mouse. */
export function pathHandles(v, a) {
  const W = pathWorld(a); if (!W.length) return [];
  const r = pathRoute(a), xs = W.map(q => q[0]), mid = r ? r.mid : (Math.min(...xs) + Math.max(...xs)) / 2, off = Math.round(v.cx - mid);
  return W.map(q => { const s = project(v, q[0] + off, q[1]); return { x: s.x, y: s.y }; });
}
export function drawPathEditor(ctx, v, a) {
  const hs = pathHandles(v, a); if (!hs.length) return;
  const r = pathRoute(a);
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (r) {
    const xy = new Float64Array(r.n * 2), off = Math.round(v.cx - r.mid);
    for (let i = 0; i < r.n; i++) { xy[2 * i] = r.X[i]; xy[2 * i + 1] = r.Y[i]; }
    ctx.beginPath(); loadXY(v, xy, r.n, off); emit(ctx, v, r.n, false);
    ctx.globalAlpha = .4; ctx.strokeStyle = '#000'; ctx.lineWidth = 6 * v.unit; ctx.stroke();
    ctx.globalAlpha = 1; ctx.strokeStyle = a.color; ctx.lineWidth = 3 * v.unit; ctx.setLineDash([8 * v.unit, 6 * v.unit]); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.font = `700 ${Math.max(8, Math.round(10 * v.unit))}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  hs.forEach((h, i) => {
    ctx.beginPath(); ctx.arc(h.x, h.y, 9 * v.unit, 0, Math.PI * 2);
    ctx.fillStyle = i === 0 ? '#7cf08f' : i === hs.length - 1 && hs.length > 1 ? '#ffd166' : '#ffffff'; ctx.fill();
    ctx.lineWidth = 2.4 * v.unit; ctx.strokeStyle = '#10161b'; ctx.stroke();
    ctx.fillStyle = '#10161b'; ctx.fillText(String(i + 1), h.x, h.y + .5 * v.unit);
  });
  ctx.restore();
}

// ---------------------------------------------------------------- Image badge (a pin shown as a shaped picture)
export const BADGE_SHAPES = { polygon: 'Polygon', circle: 'Circle', rounded: 'Rounded square', star: 'Star' };
export const BADGE_STEMS = { none: 'No pointer', line: 'Line', pointer: 'Pointer (tapered)' };
export const BADGE_EXITS = { none: 'Stay until the bar ends', fade: 'Fade out', shrink: 'Shrink away', pop: 'Pop and vanish' };
export const BADGE_DEFAULTS = { badgeStem: 'none', badgeStemLen: 40, badgeExit: 'fade', badgeShape: 'polygon', badgeSides: 7, badgeBg: '#1b1b1b', badgeBorder: '#111111', badgeBorderW: 3, badgeShadow: true, badgeZoom: 1, badgeX: 0, badgeY: 0, badgeLabelY: 0 };
export const badgeOf = a => ({ ...BADGE_DEFAULTS, ...Object.fromEntries(Object.keys(BADGE_DEFAULTS).filter(k => a[k] !== undefined).map(k => [k, a[k]])) });
const badgeCache = new Map(); let badgeListener = null;
export const onBadgeImage = fn => { badgeListener = fn; };
function badgeEntry(src) {
  if (typeof Image === 'undefined' || !src) return null;
  let e = badgeCache.get(src);
  if (!e) { e = { img: new Image(), ok: false }; e.img.onload = () => { e.ok = true; badgeListener?.(); }; e.img.src = src; badgeCache.set(src, e); }
  return e;
}
/** Resolves once every badge picture in the project has loaded, so exports never miss one. */
export function preloadBadges(proj) {
  const srcs = [...new Set(proj.actions.filter(a => ((a.type === 'pin' && a.badge) || (a.type === 'object' && ['image', 'banner'].includes(a.glyph))) && a.image).map(a => a.image))];
  return Promise.all(srcs.map(src => new Promise(done => {
    const e = badgeEntry(src); if (!e || e.ok) { done(); return; }
    e.img.addEventListener('load', () => done()); e.img.addEventListener('error', () => done());
    if (e.img.complete && e.img.naturalWidth) { e.ok = true; done(); }
  })));
}
function badgePath(ctx, x, y, r, st) {
  ctx.beginPath();
  if (st.badgeShape === 'circle') ctx.arc(x, y, r, 0, Math.PI * 2);
  else if (st.badgeShape === 'rounded') rrect(ctx, x - r, y - r, r * 2, r * 2, r * .3);
  else {
    const n = clamp(Math.round(st.badgeSides), 3, 12), star = st.badgeShape === 'star', count = star ? n * 2 : n;
    for (let i = 0; i < count; i++) {
      const ang = -Math.PI / 2 + i * Math.PI * 2 / count, rad = star && i % 2 ? r * .52 : r;
      ctx[i ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * rad, y + Math.sin(ang) * rad);
    }
    ctx.closePath();
  }
}
// ---------------------------------------------------------------- Pin travel (a pin that moves from one place to another)
export const PIN_MODES = { stay: 'Stay in one place', move: 'Move to another place', path: 'Move along my path' };
/** The route a moving pin follows: a flight-style arc from its place to `to`, or the points the user drew. */
function pinRoute(geo, a) {
  if (a.mode === 'path') return planeRoute(geo, a);
  if (a.mode === 'move' && a.to) return planeRoute(geo, { id: a.id, mode: 'direct', from: a.place, to: a.to });
  return null;
}
/** Where a pin is at `frame`: its fixed place, or a point along its route (it moves for the animation duration, then stays at the end). */
function pinSpot(v, geo, a, frame) {
  const r = pinRoute(geo, a);
  if (!r) { const loc = resolveLoc(geo, a.place, v.cx); return loc && { X: loc.X, Y: loc.Y, route: null, p: 0 }; }
  const p = ease(a.easing, a.type === 'object' ? objectMoveProgress(a, frame) : actionProgress(a, frame)), pt = routeAt(r, p), off = Math.round(v.cx - r.mid);
  return { X: pt.X + off, Y: pt.Y, route: r, off, pt, p };
}
/** Progress of the pin's own appearance (drop / pop). A moving pin keeps the normal speed instead of stretching it over the whole journey. */
const pinAppear = (a, spot, frame) => (spot.route ? clamp01((frame - a.start) / Math.max(1, Math.min(animationDuration(a), 45))) : actionProgress(a, frame));
/** Without a custom label, a moving pin is named after the place it is leaving, then the one it is heading to. */
const pinName = (a, spot) => a.label || (spot.route && spot.p >= .5 && a.to?.name) || a.place.name;
function drawPinTrail(ctx, v, spot, a, alpha) {
  const r = spot.route; if (!r || a.trail === false || spot.p <= 0) return;
  ctx.save(); ctx.beginPath(); let on = false;
  for (let i = 0; i <= spot.pt.i; i++) { const q = project(v, r.X[i] + spot.off, r.Y[i]); if (q.z < v.near) { on = false; continue; } if (on) ctx.lineTo(q.x, q.y); else { ctx.moveTo(q.x, q.y); on = true; } }
  const e = project(v, spot.X, spot.Y); if (on && e.z >= v.near) ctx.lineTo(e.x, e.y);
  ctx.globalAlpha = alpha * .75; ctx.strokeStyle = a.color; ctx.lineWidth = 3 * v.unit; ctx.setLineDash([8 * v.unit, 6 * v.unit]); ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore();
}
function drawBadge(ctx, v, geo, a, frame, labels) {
  const alpha = actAlpha(a, frame), loc = pinSpot(v, geo, a, frame); if (!loc || alpha <= 0) return;
  const st = badgeOf(a), t = pinAppear(a, loc, frame), pop = ease('backOut', clamp01(t / .4));
  // exit: plays over the last frames of the item's bar (fewer when the bar is short)
  const span = Math.max(1, Math.min(18, Math.round(a.dur * .4))), q = clamp01((frame - (a.start + a.dur - span)) / span);
  let fade = 1, grow = 1;
  if (st.badgeExit === 'fade') fade = 1 - q;
  else if (st.badgeExit === 'shrink') grow = 1 - q * q;
  else if (st.badgeExit === 'pop') grow = q < .25 ? 1 + .18 * (q / .25) : 1.18 * (1 - (q - .25) / .75) ** 2;
  const k = pop * grow; if (k <= .001 || fade <= 0) return;
  const g = project(v, loc.X, loc.Y, 0), R = a.size * v.unit * 46, r = R * k, stem = st.badgeStem !== 'none';
  const reach = stem ? st.badgeStemLen * v.unit * a.size * k : 0, cx = g.x, cy = g.y - (stem ? r + reach : 0);
  const baseAlpha = alpha * clamp01(pop * 1.5) * fade;
  drawPinTrail(ctx, v, loc, a, baseAlpha);
  ctx.save(); ctx.globalAlpha = baseAlpha; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (stem) { // pointer from the badge down to the exact location
    const col = st.badgeBorderW > 0 ? st.badgeBorder : st.badgeBg, lw = Math.max(2, st.badgeBorderW) * v.unit;
    ctx.save(); ctx.globalAlpha = baseAlpha * .3; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(g.x, g.y, Math.max(4 * v.unit, r * .24), Math.max(1.5 * v.unit, r * .08), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    ctx.fillStyle = col; ctx.strokeStyle = col;
    const n = clamp(Math.round(st.badgeSides), 3, 12), low = cy + r * .9 * (st.badgeShape === 'star' ? .45 : st.badgeShape === 'polygon' && n % 2 ? Math.cos(Math.PI / n) : 1); // start at the badge's lower edge so a fade shows no overlap
    if (st.badgeStem === 'line') { ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(cx, low); ctx.lineTo(g.x, g.y); ctx.stroke(); ctx.beginPath(); ctx.arc(g.x, g.y, lw * 1.5, 0, Math.PI * 2); ctx.fill(); }
    else { ctx.beginPath(); ctx.moveTo(cx - r * .3, low); ctx.lineTo(cx + r * .3, low); ctx.lineTo(g.x, g.y); ctx.closePath(); ctx.fill(); }
  }
  if (st.badgeShadow) { ctx.shadowColor = '#000a'; ctx.shadowBlur = 14 * v.unit; ctx.shadowOffsetY = 4 * v.unit; }
  badgePath(ctx, cx, cy, r, st); ctx.fillStyle = st.badgeBg; ctx.fill();
  ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  const entry = a.image ? badgeEntry(a.image) : null;
  if (entry?.ok) { // fill the shape, cropping the picture; zoom and focus move the crop
    const img = entry.img, s = Math.max(2 * r / img.naturalWidth, 2 * r / img.naturalHeight) * st.badgeZoom, w = img.naturalWidth * s, h = img.naturalHeight * s;
    ctx.save(); badgePath(ctx, cx, cy, r, st); ctx.clip();
    ctx.drawImage(img, cx - w / 2 - st.badgeX / 100 * (w - 2 * r) / 2, cy - h / 2 - st.badgeY / 100 * (h - 2 * r) / 2, w, h);
    ctx.restore();
  }
  if (st.badgeBorderW > 0) { badgePath(ctx, cx, cy, r, st); ctx.lineWidth = st.badgeBorderW * v.unit; ctx.strokeStyle = st.badgeBorder; ctx.stroke(); }
  ctx.restore();
  if (a.showLabel) {
    const lp = ease('backOut', (t - .3) / .3);
    if (lp > 0) { const y = cy + R * (.9 + st.badgeLabelY / 100) * grow; labels.push({ x: cx, y, ground: { X: loc.X, Y: loc.Y }, groundOffset: { y: y - g.y }, text: pinName(a, loc), alpha: alpha * clamp01(lp * 1.5) * fade, scale: (.9 + .2 * lp) * Math.max(.05, grow) }); }
  }
}

// ---------------------------------------------------------------- Animation: pin
function drawPin(ctx, v, geo, th, a, frame, labels) {
  if (a.badge) { drawBadge(ctx, v, geo, a, frame, labels); return; }
  const alpha = actAlpha(a, frame), r = pinSpot(v, geo, a, frame); if (!r || alpha <= 0) return;
  const t = pinAppear(a, r, frame), showIcon = a.showIcon !== false;
  const g = project(v, r.X, r.Y, 0), s = a.size * v.unit * 24;
  drawPinTrail(ctx, v, r, a, alpha);
  if (showIcon) {
    const drop = clamp01(t / .45), fall = (1 - bounce(drop)) * 240 * v.unit, top = project(v, r.X, r.Y, fall);
    ctx.save(); ctx.lineJoin = 'round';
    // ground shadow + ripples
    ctx.globalAlpha = alpha * .28 * drop; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(g.x, g.y, s * .5 * (1 - fall / (700 * v.unit)), s * .2 * (1 - fall / (700 * v.unit)), 0, 0, Math.PI * 2); ctx.fill();
    if (t > .4) for (let i = 0; i < 2; i++) {
      const q = (((frame - a.start) / 50) + i / 2) % 1;
      ctx.beginPath(); groundCircle(ctx, v, r.X, r.Y, (10 + q * 54) * v.unit * a.size);
      ctx.globalAlpha = alpha * (1 - q) * .75; ctx.strokeStyle = a.color; ctx.lineWidth = 2.4 * v.unit; ctx.stroke();
    }
    // pin body (tip at the location)
    const x = top.x, y = top.y;
    ctx.globalAlpha = alpha; ctx.beginPath(); ctx.moveTo(x, y);
    ctx.bezierCurveTo(x - s * .1, y - s * .55, x - s * .62, y - s * .95, x - s * .62, y - s * 1.5);
    ctx.arc(x, y - s * 1.5, s * .62, Math.PI, 0, false);
    ctx.bezierCurveTo(x + s * .62, y - s * .95, x + s * .1, y - s * .55, x, y);
    ctx.fillStyle = a.color; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.2 * v.unit; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, y - s * 1.5, s * .24, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  if (a.showLabel) {
    const pop = ease('backOut', (t - .45) / .3), offset = showIcon ? -s * 2.5 - 14 * v.unit : 0;
    if (pop > 0) labels.push({ x: g.x, y: g.y + offset, ground: { X: r.X, Y: r.Y }, groundOffset: { y: offset }, text: pinName(a, r), alpha: alpha * clamp01(pop * 1.5), scale: .9 + .2 * pop });
  }
}

// Retain labels from projects saved while the standalone label tool was available.
function queueTextLabel(v, geo, a, frame, labels) {
  if (!actAlpha(a, frame) || !a.text.trim()) return;
  const p = clamp01(ease(a.easing, actionProgress(a, frame)));
  let x = v.W * (a.x ?? 50) / 100, y = v.H * (a.y ?? 15) / 100;
  if (a.labelPlacement === 'map') {
    const r = resolveLoc(geo, a.place, v.cx); if (!r) return;
    const q = project(v, r.X, r.Y); if (q.z < v.near) return;
    x = q.x + (a.offsetX ?? 0) * v.unit; y = q.y + (a.offsetY ?? -24) * v.unit;
  }
  const r = a.labelPlacement === 'map' ? resolveLoc(geo, a.place, v.cx) : null;
  labels.push({ x, y: y + (1 - p) * 12 * v.unit, ...(r ? { ground: { X: r.X, Y: r.Y }, groundOffset: { x: (a.offsetX ?? 0) * v.unit, y: ((a.offsetY ?? -24) + (1 - p) * 12) * v.unit } } : {}), text: a.text, alpha: p, scale: .94 + .06 * p });
}

// Helpers handed to map-objects.mjs (objects, effects, arrows and zones).
const OBJ_H = { drawBadge, objectImage: src => { const e = badgeEntry(src); return e?.ok ? e.img : null; }, resolveLoc, project, groundCircle, actionProgress: objectMoveProgress, actAlpha, planeRoute, routeAt, ease, clamp01, bounce };

// ---------------------------------------------------------------- Whole frame
/** Draws the project at `frame` onto a canvas context of size W x H. Returns the view used. */
export function drawMap(ctx, W, H, proj, frame, geo, previewCamera = null, { cacheBase = false } = {}) {
  const camera = previewCamera || cameraAt(proj, geo, W, H, frame);
  proj = { ...proj, actions: proj.actions.filter(a => a.visible !== false) };
  const th = THEMES[proj.theme] || THEMES.earth, v = makeView(camera, W, H), labels = [];
  v.fps = proj.fps;
  const area = areaOf(proj), routeNames = new Map(), controlledNames = new Set();
  for (const a of proj.actions) if (a.type === 'plane' && a.showRouteLabels) {
    const r = planeRoute(geo, a);
    const names = r ? routePlaceLabels(geo, r, { mode: a.routeLabelMode || 'auto', country: area.mode === 'country' ? area.country : undefined, detailLevel: area.detailLevel }) : [];
    routeNames.set(a, names);
    for (const name of names) controlledNames.add(routeLabelKey(name.text));
  }
  if (th.imagery && geo.imagery) v.img = { im: geo.imagery, id: proj.imagery || 'gibs' };
  if (th.relief) {
    v.terrain = reliefSettings(proj.terrain);
    if (geo.relief) { geo.relief.configure(proj.terrain); v.img = { im: geo.relief, id: 'relief' }; }
    v.tileFade = cacheBase;
  }
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (cacheBase) drawPreviewBase(ctx, v, geo, th, proj); else drawBase(ctx, v, geo, th, proj);
  // Route names belong to their travel clip, including before and after it.
  labels.push(...atlasMapLabels(proj, geo, v));
  drawAreaDetail(ctx, v, geo, th, proj, labels, controlledNames);
  const tag = (a, fn) => { const n = labels.length; fn(); for (let i = n; i < labels.length; i++) labels[i].item = a; }; // remember which item each label belongs to (for its style)
  for (const a of proj.actions) if (a.type === 'highlight') tag(a, () => drawHighlight(ctx, v, geo, th, a, frame, labels));
  // Composite texture over country highlights, underneath borders and labels.
  drawTexture(ctx, W, H, proj.texture);
  for (const a of proj.actions) if (a.type === 'border') drawBorder(ctx, v, geo, th, a, frame);
  for (const a of proj.actions) if (a.type === 'shape') tag(a, () => drawShape(OBJ_H, ctx, v, geo, a, frame, labels));
  // Travelers, pins, objects and effects stack in list order (later = in front), so Up / Down in the item list really changes what covers what.
  for (const a of proj.actions) {
    if (a.type === 'plane') tag(a, () => drawPlane(ctx, v, geo, th, a, frame, labels, routeNames.get(a) || []));
    else if (a.type === 'pin') tag(a, () => drawPin(ctx, v, geo, th, a, frame, labels));
    else if (a.type === 'object') tag(a, () => {
      if (!actAlpha(a, frame)) return;
      const count = Math.max(1, Math.min(100, Math.round(a.count || 1))), cols = Math.ceil(Math.sqrt(count)), rows = Math.ceil(count / cols);
      const defaultGap = a.glyph === 'banner' ? 160 : a.glyph === 'image' ? 104 : 64;
      const gapX = (a.gapX ?? defaultGap) * (a.size || 1) * v.unit, gapY = (a.gapY ?? defaultGap) * (a.size || 1) * v.unit;
      for (let i = 0; i < count; i++) {
        const dx = ((i % cols) - (Math.min(cols, count - Math.floor(i / cols) * cols) - 1) / 2) * gapX, dy = (Math.floor(i / cols) - (rows - 1) / 2) * gapY;
        ctx.save(); ctx.translate(dx, dy);
        const itemLabels = []; drawObject(OBJ_H, ctx, v, geo, { ...a, showLabel: a.showLabel && i === 0 }, frame, itemLabels);
        ctx.restore(); labels.push(...itemLabels.map(l => ({ ...l, x: l.x + dx, y: l.y + dy, groundOffset: { x: (l.groundOffset?.x || 0) + dx, y: (l.groundOffset?.y || 0) + dy } })));
      }
    });
    else if (a.type === 'effect') tag(a, () => drawEffect(OBJ_H, ctx, v, geo, a, frame, labels));
  }
  for (const a of proj.actions) if (a.type === 'label') tag(a, () => queueTextLabel(v, geo, a, frame, labels));
  for (const l of labels) drawLabel(ctx, v, th, l, { ...labelStyleOf(proj, l.item), ...(l.over || {}) });
  vignette(ctx, v, th);
  if (v.img) drawAttribution(ctx, v, v.img.im.attribution(v.img.id));
  ctx.restore();
  return v;
}

// ---------------------------------------------------------------- Project model
export const ACTION_TYPES = {
  border: { label: 'Border', icon: '▱', dur: 60, hint: 'Draw a country outline, or sweep every border' },
  plane: { label: 'Travel', icon: '✈', dur: 90, hint: 'Move a plane, bus, person, coin… from one place to another' },
  highlight: { label: 'Highlight', icon: '◎', dur: 45, hint: 'Light up a country or a place' },
  pin: { label: 'Pin', icon: '⌖', dur: 45, hint: 'Mark a location with a pin, text or picture, and move it from place to place' },
  object: { label: 'Object', icon: '◆', dur: 90, hint: 'Place a tank, ship, jet, soldier, base, city… and move or animate it' },
  effect: { label: 'Effect', icon: '✹', dur: 60, hint: 'Explosion, fire, smoke, shockwave, earthquake, missile strike' },
  shape: { label: 'Arrow / zone', icon: '➜', dur: 90, hint: 'Attack or retreat arrow, front line, occupied or no-fly zone' },
  label: { label: 'Map label', icon: 'Aa', dur: 90, hint: 'Place outlined atlas text on the map' },
};
const city = (name, lat, lon) => ({ kind: 'city', name, lat, lon });
export const PRESETS = {
  keyframed: { label: 'Keyframed camera', icon: '◇', hint: 'Key position, zoom, tilt and rotation anywhere on the timeline', def: { dur: 60 }, fields: [] },
  flyTo: { label: 'Fly to', icon: '↘', hint: 'Smooth zoom-and-glide to a place', def: { dur: 60, zoom: 5, pitch: 0, bearing: 0, autoFit: false }, fields: ['target', 'zoom', 'pitch', 'bearing', 'autoFit'] },
  swoop: { label: 'Cinematic swoop', icon: '↺', hint: 'Fly in while tilting and turning', def: { dur: 80, zoom: 5.5, pitch: 58, bearing: 35, autoFit: false }, fields: ['target', 'zoom', 'pitch', 'bearing', 'autoFit'] },
  worldView: { label: 'Back to start view', icon: '◍', hint: 'Pull out to the start view', def: { dur: 60 }, fields: [] },
  pushIn: { label: 'Push in', icon: '⊕', hint: 'Slow zoom in', def: { dur: 60, amount: .9 }, fields: ['amount'] },
  pullBack: { label: 'Pull back', icon: '⊖', hint: 'Slow zoom out', def: { dur: 60, amount: 1.2 }, fields: ['amount'] },
  orbit: { label: 'Orbit', icon: '⟳', hint: 'Rotate around the view', def: { dur: 90, degrees: 90, pitch: 55, amount: .3 }, fields: ['degrees', 'pitch', 'amount'] },
  tilt: { label: 'Tilt', icon: '◢', hint: 'Change the viewing angle', def: { dur: 45, pitch: 55, amount: .2 }, fields: ['pitch', 'amount'] },
  panTo: { label: 'Pan to', icon: '⇢', hint: 'Slide across without zooming', def: { dur: 60 }, fields: ['target'] },
  framePlane: { label: 'Frame route', icon: '▭', hint: 'Fit a travel route in view', def: { dur: 45, pitch: 0, bearing: 0 }, fields: ['planeId', 'pitch', 'bearing'] },
  followPlane: { label: 'Follow traveler', icon: '➤', hint: 'Chase the moving icon along its route', def: { dur: 90, zoom: 4, pitch: 45, lockHeading: false }, fields: ['planeId', 'zoom', 'pitch', 'lockHeading'] },
};
const uid = () => crypto.randomUUID();

export function makeAction(type, start, extra = {}) {
  const base = { id: uid(), type, name: ACTION_TYPES[type].label, start, dur: ACTION_TYPES[type].dur, easing: 'easeInOut' };
  const own = {
    border: { target: { kind: 'country', name: 'Brazil' }, color: '#e4572e', width: 3.5, glow: true, fillAlpha: .18, invert: false },
    plane: { from: city('London', 51.5072, -0.1276), to: city('New York', 40.7128, -74.006), color: '#ff6b35', planeColor: '#ffffff', icon: 'plane', symbol: '$', fromLabel: '', toLabel: '', width: 3, size: 20, lift: 50, glow: true, dashed: false, showPath: true, showLabels: true, showRouteLabels: false, routeLabelMode: 'auto', routeLabelTiming: 'visited', mode: 'direct', path: [], curve: 'smooth', showWaypoints: true },
    highlight: { target: { kind: 'country', name: 'Australia' }, color: '#ffb703', dim: .45, showLabel: true, label: '', pulse: true, radius: 400, invert: false },
    pin: { place: city('Paris', 48.8566, 2.3522), label: '', showIcon: true, showLabel: true, color: '#e63946', size: 1, mode: 'stay' },
    object: { place: city('Paris', 48.8566, 2.3522), glyph: 'tank', count: 1, color: OBJECT_ICONS.tank.color, size: 1.2, enter: 'drop', idle: 'none', exit: 'none', mode: 'stay', path: [], curve: 'smooth', trail: true, showLabel: false, label: '' },
    effect: { place: city('Paris', 48.8566, 2.3522), fx: 'explosion', color: EFFECTS.explosion.color, size: 1.5, repeat: 1, from: { kind: 'point', name: 'Launch site', lat: 45.5, lon: -1.5 }, showLabel: false, label: '' },
    shape: { shape: 'arrow', mode: 'path', path: [], curve: 'smooth', color: SHAPES.arrow.color, width: 6, fillAlpha: .28, showLabel: false, label: '' },
    label: { text: 'Your label', labelPlacement: 'screen', x: 50, y: 15, place: city('Paris', 48.8566, 2.3522), offsetX: 0, offsetY: -24, labelStyle: { shape: 'none', halo: true, size: 24 } },
  }[type];
  const a = { ...base, ...own, ...extra };
  a.animDur ??= a.dur;
  return a;
}
export function makeShot(preset, start, extra = {}) {
  const P = PRESETS[preset];
  return { id: uid(), kind: 'shot', preset, name: P.label, start, dur: 60, easing: 'easeInOut', target: city('Paris', 48.8566, 2.3522), zoom: 5, pitch: 0, bearing: 0, amount: .9, degrees: 90, planeId: '', autoFit: false, lockHeading: false, ...P.def, ...(preset === 'keyframed' ? { cameraKeys: [], cameraFrom: { ...DEFAULT_CAM }, cameraTo: { ...DEFAULT_CAM, zoom: 5 } } : {}), ...extra };
}

export function newMapProject() {
  return { version: 1, kind: 'map', name: 'Untitled map', width: 1280, height: 720, fps: 30, frames: 240, theme: 'earth', texture: { ...DEFAULT_TEXTURE }, labelStyle: { ...DEFAULT_LABEL_STYLE }, area: { ...DEFAULT_AREA }, graticule: true, camera: { init: { ...DEFAULT_CAM } }, shots: [], actions: [] };
}
export function demoMapProject() {
  const p = newMapProject(); p.name = 'Across the Atlantic'; p.frames = 330;
  const plane = makeAction('plane', 130, { name: 'Flight to New York', dur: 100, from: city('Paris', 48.8566, 2.3522), to: city('New York', 40.7128, -74.006), color: '#ff6b35', lift: 70, showLabels: false });
  p.actions = [
    makeAction('border', 0, { name: 'All borders', dur: 70, target: { kind: 'all', name: 'All countries' }, color: '#2a9d8f', width: 1.6, glow: false, fillAlpha: 0 }),
    makeAction('pin', 60, { name: 'Pin Paris', dur: 50 }),
    plane,
    makeAction('pin', 235, { name: 'Pin New York', dur: 45, place: city('New York', 40.7128, -74.006), color: '#3a86ff', label: '' }),
    makeAction('highlight', 255, { name: 'Spotlight USA', dur: 60, target: { kind: 'country', name: 'United States of America' }, label: 'United States', color: '#3a86ff', dim: .5, pulse: false }),
  ];
  p.shots = [
    makeShot('swoop', 45, { name: 'Swoop to Paris', dur: 70, target: city('Paris', 48.8566, 2.3522), zoom: 5, pitch: 50, bearing: 20 }),
    makeShot('framePlane', 120, { dur: 40, planeId: plane.id, pitch: 40, bearing: 0 }),
    makeShot('followPlane', 165, { dur: 80, planeId: plane.id, zoom: 3.6, pitch: 50 }),
    makeShot('flyTo', 245, { name: 'Fly to New York', dur: 70, target: city('New York', 40.7128, -74.006), zoom: 5.5, pitch: 30, bearing: 0 }),
  ];
  return p;
}

const ENUMS = { theme: Object.keys(THEMES), preset: Object.keys(PRESETS), easing: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'backOut', 'hold'] };
const isLoc = l => l && typeof l.name === 'string' && l.name.length < 200 && (l.kind === 'regions' ? Array.isArray(l.members) && l.members.length > 0 && l.members.length <= 200 && l.members.every(m => ['country','region'].includes(m?.kind) && isLoc(m)) : ['city', 'point', 'country', 'region'].includes(l.kind) && (['country', 'region'].includes(l.kind) || (Number.isFinite(l.lat) && Number.isFinite(l.lon) && Math.abs(l.lat) <= 90 && Math.abs(l.lon) <= 360)));
const num = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
const col = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);
function checkArea(s) {
  const bad = () => { throw Error('Invalid map area.'); };
  if (!s || typeof s !== 'object' || Array.isArray(s)) bad();
  if (s.mode !== undefined && !Object.hasOwn(AREA_MODES, s.mode)) bad();
  if (s.country !== undefined && (typeof s.country !== 'string' || !s.country || s.country.length > 100)) bad();
  if (s.neighbors !== undefined && !Object.hasOwn(NEIGHBOR_MODES, s.neighbors)) bad();
  if (s.detailLevel !== undefined && !isLevelId(s.detailLevel)) bad();
  if (s.detailCountries !== undefined && (!Array.isArray(s.detailCountries) || s.detailCountries.length > 200 || s.detailCountries.some(c=>typeof c!=='string'||!c||c.length>100))) bad();
  if (s.detailLevels !== undefined && (!s.detailLevels || typeof s.detailLevels!=='object' || Array.isArray(s.detailLevels) || Object.values(s.detailLevels).some(l=>!isLevelId(l)))) bad();
  if (s.pad !== undefined && !num(s.pad, .02, .45)) bad();
  for (const k of ['fit', 'name', 'cities']) if (s[k] !== undefined && typeof s[k] !== 'boolean') bad();
}
function checkPath(a) {
  const bad = () => { throw Error('Invalid travel path.'); };
  if (!Array.isArray(a.path) || a.path.length > 120) bad();
  for (const p of a.path) if (!p || !num(p.lat, -90, 90) || !num(p.lon, -540, 540)) bad();
  if (a.curve !== undefined && !Object.hasOwn(PATH_CURVES, a.curve)) bad();
}
function checkLabelStyle(s) {
  if (s === undefined) return;
  const bad = () => { throw Error('Invalid label style.'); };
  if (!s || typeof s !== 'object' || Array.isArray(s)) bad();
  if (s.font !== undefined && (typeof s.font !== 'string' || s.font.length > 60)) bad();
  if (s.weight !== undefined && !LABEL_WEIGHTS.some(w => w[0] === s.weight)) bad();
  if (s.shape !== undefined && !Object.hasOwn(LABEL_SHAPES, s.shape)) bad();
  if (s.placement !== undefined && !['screen', 'map'].includes(s.placement)) bad();
  for (const [k, lo, hi] of [['size', 6, 240], ['spacing', 0, 40], ['bgAlpha', 0, 1], ['borderW', 0, 8], ['referenceZoom', 0, 14], ['haloWidth', 0, 1]]) if (s[k] !== undefined && !num(s[k], lo, hi)) bad();
  if (s.scaleMode !== undefined && !['fixed', 'world'].includes(s.scaleMode)) bad();
  for (const k of ['text', 'bg', 'border']) if (s[k] !== undefined && !col(s[k])) bad();
  for (const k of ['italic', 'caps', 'useTheme', 'halo', 'shadow']) if (s[k] !== undefined && typeof s[k] !== 'boolean') bad();
}

/** Throws a readable Error when a file is not a usable map project. */
export function validateMapProject(p) {
  if (!p || p.version !== 1 || p.kind !== 'map' || !Array.isArray(p.actions) || !Array.isArray(p.shots)) throw Error('This is not a FrameFlow map project.');
  if (p.actions.length > 200 || p.shots.length > 200) throw Error('Too many items in this map project.');
  if (![24, 30, 60].includes(p.fps) || !Number.isSafeInteger(p.frames) || p.frames < 2) throw Error('Invalid frame settings.');
  if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 100 || p.height < 100 || p.width > 3840 || p.height > 3840) throw Error('Invalid canvas size.');
  if (!ENUMS.theme.includes(p.theme)) throw Error('Unknown map theme.');
  if (p.imagery !== undefined && !/^[a-z0-9_-]{1,20}$/i.test(p.imagery)) throw Error('Invalid imagery source.');
  validateRelief(p.terrain);
  validateAtlasLabels(p.atlasLabels);
  if (p.texture !== undefined && (!p.texture || !Object.hasOwn(TEXTURES, p.texture.type) || !num(p.texture.strength, 0, 1) || !num(p.texture.scale, .5, 3))) throw Error('Invalid map texture.');
  const i = p.camera?.init;
  if (!i || !num(i.lon, -540, 540) || !num(i.lat, -90, 90) || !num(i.zoom, 0, 14) || !num(i.bearing ?? 0, -3600, 3600) || !num(i.pitch ?? 0, 0, 75)) throw Error('Invalid start view.');
  checkLabelStyle(p.labelStyle);
  if (p.area !== undefined) checkArea(p.area);
  const ids = new Set();
  for (const it of [...p.actions, ...p.shots]) {
    if (it.visible !== undefined && typeof it.visible !== 'boolean') throw Error('Invalid layer visibility.');
    if ((it.animStart !== undefined || it.animEnd !== undefined) && (!Number.isSafeInteger(it.animStart) || !Number.isSafeInteger(it.animEnd) || it.animStart < it.start || it.animEnd <= it.animStart || it.animEnd > it.start + it.dur)) throw Error('Animation keyframes must be inside the timeline bar.');
    if (it.timingKeys !== undefined && (!Array.isArray(it.timingKeys) || it.timingKeys.length > 2 || new Set(it.timingKeys).size !== it.timingKeys.length || it.timingKeys.some(k => !['start', 'dur'].includes(k)))) throw Error('Invalid timing keyframes.');
    if (typeof it.id !== 'string' || ids.has(it.id) || typeof it.name !== 'string') throw Error('Invalid item.');
    ids.add(it.id);
    if (!Number.isSafeInteger(it.start) || it.start < 0 || !Number.isSafeInteger(it.dur) || it.dur < 1 || !Number.isSafeInteger(it.start + it.dur) || !ENUMS.easing.includes(it.easing)) throw Error('Invalid item timing.');
  }
  for (const a of p.actions) {
    if (!ACTION_TYPES[a.type]) throw Error('Unknown animation type.');
    if (a.animDur !== undefined && (!Number.isSafeInteger(a.animDur) || a.animDur < 1)) throw Error('Invalid animation duration.');
    if (a.type === 'border' && !(a.target?.kind === 'all' || (['country','region','regions'].includes(a.target?.kind) && isLoc(a.target)))) throw Error('Invalid border target.');
    if (a.type === 'border') {
      for(const k of ['borderFrom','borderTo'])if(a[k]!==undefined&&!num(a[k],0,100))throw Error('Invalid border endpoint.');
      if(a.borderRing!==undefined&&(!Number.isSafeInteger(a.borderRing)||a.borderRing<0))throw Error('Invalid border ring.');
      for(const k of ['borderPartial','borderReverse'])if(a[k]!==undefined&&typeof a[k]!=='boolean')throw Error('Invalid border option.');
    }
    if (a.type === 'plane' && a.mode !== undefined && !['direct', 'path'].includes(a.mode)) throw Error('Invalid travel mode.');
    if (a.type === 'plane' && a.mode === 'path') checkPath(a);
    else if (a.type === 'plane' && !(isLoc(a.from) && isLoc(a.to))) throw Error('Invalid plane route.');
    checkLabelStyle(a.labelStyle);
    if (a.type === 'plane' && ((a.icon !== undefined && !Object.hasOwn(TRAVEL_ICONS, a.icon)) || (a.symbol !== undefined && (typeof a.symbol !== 'string' || a.symbol.length > 4)) || [a.fromLabel, a.toLabel].some(x => x !== undefined && (typeof x !== 'string' || x.length > 80)))) throw Error('Invalid travel icon settings.');
    if (a.type === 'highlight' && !isLoc(a.target)) throw Error('Invalid highlight target.');
    if (a.type === 'highlight' && a.highlightOrigin !== undefined && !(a.highlightOrigin?.kind === 'point' && isLoc(a.highlightOrigin))) throw Error('Invalid highlight fill start.');
    if (['border', 'highlight'].includes(a.type) && a.invert !== undefined && typeof a.invert !== 'boolean') throw Error('Invalid invert option.');
    if (a.type === 'pin' && !isLoc(a.place)) throw Error('Invalid pin location.');
    if (a.type === 'pin' && a.showIcon !== undefined && typeof a.showIcon !== 'boolean') throw Error('Invalid pin icon setting.');
    if (a.type === 'pin' || (a.type === 'object' && ['image', 'banner'].includes(a.glyph))) {
      if (a.badge !== undefined && typeof a.badge !== 'boolean') throw Error('Invalid pin badge setting.');
      if (a.mode !== undefined && !Object.hasOwn(PIN_MODES, a.mode)) throw Error('Invalid pin movement.');
      if (a.mode === 'move' && !isLoc(a.to)) throw Error('Invalid pin destination.');
      if (a.mode === 'path') checkPath(a);
      if (a.trail !== undefined && typeof a.trail !== 'boolean') throw Error('Invalid pin trail setting.');
      if (a.image !== undefined && (typeof a.image !== 'string' || a.image.length > 2e6 || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(a.image))) throw Error('Invalid pin image.');
      if (a.badgeShape !== undefined && !Object.hasOwn(BADGE_SHAPES, a.badgeShape)) throw Error('Invalid badge shape.');
      if (a.badgeStem !== undefined && !Object.hasOwn(BADGE_STEMS, a.badgeStem)) throw Error('Invalid badge pointer.');
      if (a.badgeExit !== undefined && !Object.hasOwn(BADGE_EXITS, a.badgeExit)) throw Error('Invalid badge exit.');
      if (a.badgeShadow !== undefined && typeof a.badgeShadow !== 'boolean') throw Error('Invalid badge shadow.');
      for (const k of ['badgeBg', 'badgeBorder']) if (a[k] !== undefined && !/^#[0-9a-f]{6}$/i.test(a[k])) throw Error('Invalid badge color.');
      for (const [k, lo, hi] of [['badgeSides', 3, 12], ['badgeStemLen', 0, 300], ['badgeBorderW', 0, 20], ['badgeZoom', 1, 4], ['badgeX', -100, 100], ['badgeY', -100, 100], ['badgeLabelY', -100, 300]]) if (a[k] !== undefined && !num(a[k], lo, hi)) throw Error('Invalid badge ' + k + '.');
    }
    if (a.type === 'label') {
      if (typeof a.text !== 'string' || a.text.length > 160) throw Error('Invalid label text.');
      if (a.labelPlacement !== undefined && !['screen', 'map'].includes(a.labelPlacement)) throw Error('Invalid label placement.');
      if (a.labelPlacement === 'map' && !isLoc(a.place)) throw Error('Invalid label location.');
      for (const [k, lo, hi] of [['x', 0, 100], ['y', 0, 100], ['offsetX', -1000, 1000], ['offsetY', -1000, 1000]]) if (a[k] !== undefined && !num(a[k], lo, hi)) throw Error('Invalid label ' + k + '.');
    }
    if (a.type === 'plane' && ((a.showRouteLabels !== undefined && typeof a.showRouteLabels !== 'boolean') || (a.routeLabelMode !== undefined && !['auto', 'country', 'region'].includes(a.routeLabelMode)) || (a.routeLabelTiming !== undefined && !['all', 'visited'].includes(a.routeLabelTiming)))) throw Error('Invalid route label settings.');
    const inList = (list, x) => list.some(([k]) => k === x);
    if (a.type === 'object') {
      if (a.bannerTitle !== undefined && (typeof a.bannerTitle !== 'string' || a.bannerTitle.length > 100)) throw Error('Invalid banner title.');
      for (const k of ['bannerWind', 'bannerPole', 'bannerPlaque']) if (a[k] !== undefined && typeof a[k] !== 'boolean') throw Error('Invalid banner setting.');
      for (const [k,lo,hi] of [['bannerWindStrength',0,1],['bannerWindSpeed',.1,3],['bannerAspect',.35,2.5]]) if (a[k] !== undefined && !num(a[k],lo,hi)) throw Error('Invalid banner setting.');
      if (a.bannerPoleColor !== undefined && !col(a.bannerPoleColor)) throw Error('Invalid pole color.');
      for (const key of ['gapX', 'gapY']) if (a[key] !== undefined && !num(a[key], 0, 1000)) throw Error('Invalid object spacing.');
      if (a.count !== undefined && (!Number.isInteger(a.count) || a.count < 1 || a.count > 100)) throw Error('Object count must be between 1 and 100.');
      if ((a.moveStart !== undefined || a.moveEnd !== undefined) && (!Number.isSafeInteger(a.moveStart) || !Number.isSafeInteger(a.moveEnd) || a.moveStart < a.start || a.moveEnd <= a.moveStart || a.moveEnd > a.start + a.dur)) throw Error('Movement keyframes must be inside the object timeline bar, with the end after the start.');
      if (a.mode === 'move' && !isLoc(a.to)) throw Error('Invalid object destination.');
      if (!Object.hasOwn(OBJECT_ICONS, a.glyph) || (a.enter !== undefined && !inList(OBJECT_ENTER, a.enter)) || (a.idle !== undefined && !inList(OBJECT_IDLE, a.idle)) || (a.exit !== undefined && !inList(OBJECT_EXIT, a.exit)) || (a.mode !== undefined && !['stay', 'move', 'path'].includes(a.mode))) throw Error('Invalid object.');
      if (a.mode === 'path') checkPath(a); else if (!isLoc(a.place)) throw Error('Invalid object location.');
    }
    if (a.type === 'effect' && (!Object.hasOwn(EFFECTS, a.fx) || !isLoc(a.place) || (a.fx === 'strike' && !isLoc(a.from)) || (a.repeat !== undefined && !(Number.isInteger(a.repeat) && a.repeat >= 1 && a.repeat <= 10)))) throw Error('Invalid effect.');
    if (a.type === 'shape') { if (!Object.hasOwn(SHAPES, a.shape)) throw Error('Invalid shape.'); checkPath(a); }
    if (['object', 'effect', 'shape'].includes(a.type) && a.label !== undefined && (typeof a.label !== 'string' || a.label.length > 100)) throw Error('Invalid label.');
    if (((a.type !== 'label' || a.color !== undefined) && !col(a.color)) || (a.type === 'plane' && !col(a.planeColor))) throw Error('Invalid color.');
    if (a.reliefOpacity !== undefined && !num(a.reliefOpacity, 0, 1)) throw Error('Invalid highlight opacity.');
    if (a.reliefColor !== undefined && !col(a.reliefColor)) throw Error('Invalid highlight color.');
    for (const [k, lo, hi] of [['width', .5, 20], ['fillAlpha', 0, 1], ['size', .2, 80], ['lift', 0, 400], ['dim', 0, 1], ['radius', 1, 20000]]) if (a[k] !== undefined && !num(a[k], lo, hi)) throw Error('Invalid ' + k + '.');
  }
  for (const s of p.shots) {
    if (s.cameraKeys !== undefined) {
      if (!Array.isArray(s.cameraKeys) || s.cameraKeys.length > 1000) throw Error('Invalid camera keyframes.');
      const frames = new Set();
      for (const key of s.cameraKeys) {
        if (!Number.isSafeInteger(key.frame) || key.frame < s.start || key.frame > s.start + s.dur || frames.has(key.frame) || !key.values || Array.isArray(key.values) || !Object.keys(key.values).length) throw Error('Invalid camera keyframe.');
        frames.add(key.frame);
        for (const [field, value] of Object.entries(key.values)) if (!CAMERA_FIELDS[field] || !num(value, ...CAMERA_FIELDS[field])) throw Error('Invalid camera keyframe property.');
      }
    }
    if (s.animDur !== undefined && (!Number.isSafeInteger(s.animDur) || s.animDur < 1)) throw Error('Invalid camera animation duration.');
    if (!ENUMS.preset.includes(s.preset)) throw Error('Unknown camera preset.');
    if (s.preset === 'keyframed') for (const cam of [s.cameraFrom, s.cameraTo]) {
      if (!cam || !num(cam.lon, -540, 540) || !num(cam.lat, -85, 85) || !num(cam.zoom, 0, 14) || !num(cam.pitch, 0, 75) || !num(cam.bearing, -3600, 3600)) throw Error('Invalid camera keyframe.');
    }
    if (!isLoc(s.target)) throw Error('Invalid camera target.');
    for (const [k, lo, hi] of [['zoom', 0, 14], ['pitch', 0, 75], ['bearing', -3600, 3600], ['amount', -10, 10], ['degrees', -3600, 3600]]) if (!num(s[k], lo, hi)) throw Error('Invalid camera ' + k + '.');
  }
  // Freeze the original animation speed when opening projects saved before animDur.
  for (const a of p.actions) {
    a.animDur ??= a.dur;
    // Older route-name settings must also reveal names on entry.
    if (a.type === 'plane') a.routeLabelTiming = 'visited';
  }
  return p;
}
