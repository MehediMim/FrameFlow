// FrameFlow Map Studio engine: vector world map, camera presets and map animations.
// Pure JavaScript with no DOM access, so it can be unit tested and rendered headlessly.
import { easings } from './engine.mjs';

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
  earth: { label: 'Earth vector', void: '#0b1620', ocean: '#a8d5ee', land: ['#e3ebc6', '#dbe7bc', '#e8e8c8', '#d8e5c3', '#e5e1c1'], border: '#ffffff', borderA: .9, bw: 1.1, grat: '#ffffff', gratA: .28, dim: '#06121c', vignette: .16, pill: 'rgba(12,28,40,.9)', pillText: '#ffffff' },
  dark: { label: 'Night', void: '#03060a', ocean: '#0c1a28', land: ['#1a2a3a', '#1d2e3f', '#182736', '#1b2c3b', '#203243'], border: '#3d5b75', borderA: .95, bw: 1, grat: '#6f9bbd', gratA: .12, dim: '#000000', vignette: .35, pill: 'rgba(235,242,248,.92)', pillText: '#0b1620' },
  paper: { label: 'Paper atlas', void: '#d9cfb8', ocean: '#f3eddf', land: ['#e2d6bb', '#dccfb1', '#e5dac1', '#d9ccae', '#e0d3b8'], border: '#faf5e8', borderA: .95, bw: 1.2, grat: '#b9a98a', gratA: .35, dim: '#2a2113', vignette: .1, pill: 'rgba(52,40,22,.9)', pillText: '#fbf4e2' },
  blueprint: { label: 'Blueprint', void: '#071a3d', ocean: '#0f2f66', land: ['#1b4b9b', '#1d4fa3', '#1a4794', '#1e53aa', '#1c4d9e'], border: '#8fb8ff', borderA: .85, bw: 1, grat: '#8fb8ff', gratA: .2, dim: '#020b1d', vignette: .25, pill: 'rgba(255,255,255,.92)', pillText: '#0a2250' },
};

// Texture tiles are seeded and cached: no per-frame noise or flickering in exports.
export const TEXTURES = { none: 'None', paper: 'Paper grain', grain: 'Film grain', linen: 'Linen', dots: 'Halftone dots' };
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
      const area = Math.abs(a2) / 2;
      rings.push({ xy, n, hole: ri > 0, area, cx: a2 ? cx / (3 * a2) : xy[0], cy: a2 ? cy / (3 * a2) : xy[1] });
    });
    if (!rings.length) continue;
    const outer = rings.filter(r => !r.hole), biggest = outer.reduce((m, r) => (r.area > m.area ? r : m), outer[0] || rings[0]);
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
      mainBox: box(outer.filter(r => r.area >= biggest.area * .25)),
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
  if (loc.kind === 'country') { const f = geo.byName.get(loc.name); return f ? { lon: f.center.lon, lat: f.center.lat } : null; }
  return Number.isFinite(loc.lat) && Number.isFinite(loc.lon) ? { lon: loc.lon, lat: loc.lat } : null;
}
function resolveLoc(geo, loc, nearX) {
  let X, Y, bbox = null;
  if (loc?.kind === 'country') {
    const f = geo.byName.get(loc.name); if (!f) return null;
    X = f.cx; Y = f.cy; bbox = f.mainBox.slice();
  } else if (loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)) { X = lonToX(loc.lon); Y = latToY(loc.lat); } else return null;
  if (nearX != null) { const k = Math.round(nearX - X); X += k; if (bbox) { bbox[0] += k; bbox[2] += k; } }
  return { X, Y, bbox };
}

// ---------------------------------------------------------------- Plane routes (great circles)
const routeCache = new Map();
export function planeRoute(geo, a) {
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
  const route = { key, n: N + 1, X, Y, cum, total: cum[N], A, B };
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
    case 'flyTo': case 'swoop': {
      const r = resolveLoc(geo, s.target, from.cx); if (!r) return from;
      const fit = s.autoFit && s.target.kind === 'country' && r.bbox;
      return fly(from, {
        cx: fit ? (r.bbox[0] + r.bbox[2]) / 2 : r.X, cy: fit ? (r.bbox[1] + r.bbox[3]) / 2 : r.Y,
        zoom: fit ? fitZoom(r.bbox, W, H, .24) : s.zoom, pitch: s.pitch, bearing: s.bearing,
      }, t, W, H);
    }
    case 'worldView': {
      const w = camFrom(pr.camera.init); w.cx += Math.round(from.cx - w.cx);
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
      const a = pr.actions.find(x => x.id === s.planeId && x.type === 'plane'), r = a && planeRoute(geo, a); if (!r) return from;
      const b = routeBox(r), off = Math.round(from.cx - (b[0] + b[2]) / 2); b[0] += off; b[2] += off;
      return fly(from, { cx: (b[0] + b[2]) / 2, cy: (b[1] + b[3]) / 2, zoom: fitZoom(b, W, H, .38), pitch: s.pitch, bearing: s.bearing }, t, W, H);
    }
    case 'followPlane': {
      const a = pr.actions.find(x => x.id === s.planeId && x.type === 'plane'), r = a && planeRoute(geo, a); if (!r) return from;
      const q = ease('easeInOut', (frame - a.start) / Math.max(1, a.dur)), p = routeAt(r, q);
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
  return shotState(s, from, clamp01((frame - s.start) / Math.max(1, s.dur)), Math.min(frame, end), c);
}

/** Camera state at a frame: start view followed by each preset shot in order. */
export function cameraAt(proj, geo, W, H, frame) {
  const init = camFrom(proj.camera.init), shots = [...proj.shots].sort((a, b) => a.start - b.start), c = { geo, W, H, project: proj };
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
function drawLabel(ctx, v, th, l) {
  const fs = Math.round(14 * v.unit * (l.scale || 1));
  ctx.save();
  ctx.font = `600 ${fs}px Arial, sans-serif`;
  const w = ctx.measureText(l.text).width + fs * 1.5, h = fs * 1.9;
  ctx.globalAlpha = clamp01(l.alpha);
  ctx.fillStyle = th.pill; rrect(ctx, l.x - w / 2, l.y - h / 2, w, h, h / 2); ctx.fill();
  ctx.fillStyle = th.pillText; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(l.text, l.x, l.y + fs * .05);
  ctx.restore();
}
const bounce = t => { const n = 7.5625, d = 2.75; if (t < 1 / d) return n * t * t; if (t < 2 / d) return n * (t -= 1.5 / d) * t + .75; if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + .9375; return n * (t -= 2.625 / d) * t + .984375; };
const actAlpha = (a, frame) => (frame < a.start ? 0 : a.keep !== false || frame <= a.start + a.dur ? 1 : clamp01(1 - (frame - a.start - a.dur) / 10));

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

// ---------------------------------------------------------------- Base map
function drawBase(ctx, v, geo, th, proj) {
  ctx.fillStyle = th.void; ctx.fillRect(0, 0, v.W, v.H);
  const k0 = Math.round(v.cx);
  ctx.beginPath(); loadXY(v, new Float64Array([k0 - 4, 0, k0 + 5, 0, k0 + 5, 1, k0 - 4, 1]), 4, 0); emit(ctx, v, 4, true);
  ctx.fillStyle = th.ocean; ctx.fill();
  if (proj.graticule) {
    ctx.beginPath();
    for (let i = -48; i <= 60; i++) { const X = k0 + i / 12; if (Math.abs(X - v.cx) > 3) continue; loadXY(v, new Float64Array([X, 0, X, 1]), 2, 0); emit(ctx, v, 2, false); }
    for (const lat of [-60, -30, 0, 30, 60]) { const Y = latToY(lat); loadXY(v, new Float64Array([k0 - 4, Y, k0 + 5, Y]), 2, 0); emit(ctx, v, 2, false); }
    ctx.strokeStyle = th.grat; ctx.globalAlpha = th.gratA; ctx.lineWidth = Math.max(.6, v.unit * .8); ctx.stroke(); ctx.globalAlpha = 1;
  }
  const set = geo.pick(v.cam.zoom);
  ctx.strokeStyle = th.border; ctx.lineWidth = th.bw * v.unit;
  for (let k = k0 - 1; k <= k0 + 1; k++) for (const f of set.features) {
    if (!bboxVisible(v, f.bbox, k)) continue;
    ctx.beginPath();
    for (const r of f.rings) { loadXY(v, r.xy, r.n, k); emit(ctx, v, r.n, true); }
    ctx.fillStyle = th.land[f.tint]; ctx.fill('evenodd');
    ctx.globalAlpha = th.borderA; ctx.stroke(); ctx.globalAlpha = 1;
  }
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
  const t = clamp01((frame - a.start) / Math.max(1, a.dur)), p = ease(a.easing, t), w = a.width * v.unit;
  const all = a.target?.kind === 'all', list = all ? geo.pick(v.cam.zoom).features : [geo.byName.get(a.target?.name)].filter(Boolean);
  if (!list.length) return;
  ctx.save();
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  let head = null;
  for (const f of list) {
    const off = Math.round(v.cx - f.cx), local = all ? clamp01((p * 1.7 - f.cx * .7) ) : p;
    if (local <= 0 || !bboxVisible(v, f.bbox, off, 80)) continue;
    let main = null;
    for (const r of f.rings) {
      const pr = partialRing(r, local);
      loadXY(v, pr.xy, pr.n, off); emit(ctx, v, pr.n, pr.closed);
      if (!all && !r.hole && (!main || r.area > main.r.area)) main = { r, pr: { xy: pr.xy.slice(0, pr.n * 2), n: pr.n, closed: pr.closed } };
    }
    if (main && !main.pr.closed) head = { xy: main.pr.xy, n: main.pr.n, off };
  }
  glowStroke(ctx, a.color, w, alpha, a.glow);
  if (!all && a.fillAlpha > 0 && p > .55) {
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

// ---------------------------------------------------------------- Animation: highlight
function drawHighlight(ctx, v, geo, th, a, frame, labels) {
  const alpha = actAlpha(a, frame); if (alpha <= 0) return;
  const t = clamp01((frame - a.start) / Math.max(1, a.dur)), p = ease(a.easing, t), age = Math.max(0, frame - a.start);
  if (a.target?.kind === 'country') {
    const f = geo.byName.get(a.target.name); if (!f) return;
    const off = Math.round(v.cx - f.cx), path = () => { ctx.beginPath(); for (const r of f.rings) { loadXY(v, r.xy, r.n, off); emit(ctx, v, r.n, true); } };
    ctx.save();
    if (a.dim > 0) { ctx.globalAlpha = a.dim * p * alpha; ctx.fillStyle = th.dim; ctx.fillRect(0, 0, v.W, v.H); ctx.globalAlpha = 1; path(); ctx.fillStyle = th.land[f.tint]; ctx.fill('evenodd'); }
    path(); ctx.globalAlpha = alpha * p * .78; ctx.fillStyle = a.color; ctx.fill('evenodd');
    ctx.lineJoin = 'round'; glowStroke(ctx, a.color, 2.6 * v.unit, alpha * clamp01(p * 2), true);
    if (a.pulse) { const q = (age % 54) / 54; ctx.globalAlpha = alpha * (1 - q) * .35 * p; ctx.fillStyle = '#fff'; path(); ctx.fill('evenodd'); }
    ctx.restore();
    if (a.showLabel) { const c = project(v, f.cx + off, f.cy); labels.push({ x: c.x, y: c.y, text: a.label || f.name, alpha: alpha * clamp01((p - .4) / .4), scale: 1.1 }); }
    return;
  }
  const r = resolveLoc(geo, a.target, v.cx); if (!r) return;
  const lat = yToLat(r.Y), rad = (a.radius / (40075 * Math.cos(lat * RAD))) * v.S; // km -> screen px
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
  const c = project(v, r.X, r.Y, 0);
  ctx.save(); ctx.globalAlpha = alpha * p; ctx.fillStyle = '#fff'; ctx.strokeStyle = a.color; ctx.lineWidth = 3 * v.unit;
  ctx.beginPath(); ctx.arc(c.x, c.y, 5 * v.unit, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); ctx.restore();
  if (a.showLabel) labels.push({ x: c.x, y: c.y - 24 * v.unit, text: a.label || a.target.name, alpha: alpha * clamp01((p - .4) / .4), scale: 1.1 });
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
function loadRoute(v, r, s, off, lift) { // view-space points from the start of the route up to arc position s
  const p = routeAt(r, s), n = p.i + 2;
  ensure(n + 1);
  for (let i = 0; i <= p.i; i++) loadPt(v, i, r.X[i] + off, r.Y[i], lift * Math.sin(Math.PI * (r.cum[i] / (r.total || 1))));
  loadPt(v, p.i + 1, p.X + off, p.Y, lift * Math.sin(Math.PI * s));
  return n;
}
function drawPlane(ctx, v, geo, th, a, frame, labels) {
  const r = planeRoute(geo, a), alpha = actAlpha(a, frame); if (!r || alpha <= 0) return;
  const t = clamp01((frame - a.start) / Math.max(1, a.dur)), s = ease(a.easing, t), lift = a.lift * v.unit, off = Math.round(v.cx - (r.X[0] + r.X[r.n - 1]) / 2);
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
  // ends
  const A = project(v, r.X[0] + off, r.Y[0]), B = project(v, r.X[r.n - 1] + off, r.Y[r.n - 1]);
  for (const [pt, hit] of [[A, true], [B, s >= 1]]) {
    ctx.globalAlpha = alpha; ctx.fillStyle = '#fff'; ctx.strokeStyle = a.color; ctx.lineWidth = 3 * v.unit;
    ctx.beginPath(); ctx.arc(pt.x, pt.y, 5 * v.unit, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    if (hit && pt === B) { const q = ((frame - a.start - a.dur) / 40) % 1; if (frame >= a.start + a.dur) { ctx.globalAlpha = alpha * (1 - q) * .7; ctx.beginPath(); ctx.arc(pt.x, pt.y, (6 + q * 22) * v.unit, 0, Math.PI * 2); ctx.stroke(); } }
  }
  if (a.showLabels) {
    labels.push({ x: A.x, y: A.y - 24 * v.unit, text: a.from.name, alpha, scale: 1 });
    labels.push({ x: B.x, y: B.y - 24 * v.unit, text: a.to.name, alpha: alpha * clamp01(s * 4), scale: 1 });
  }
  // aircraft + ground shadow
  if (t > 0 || frame >= a.start) {
    const pos = routeAt(r, s), e = E(s), g = project(v, pos.X + off, pos.Y, 0), body = project(v, pos.X + off, pos.Y, e);
    const p0 = routeAt(r, Math.max(0, s - .012)), p1 = routeAt(r, Math.min(1, s + .012));
    const q0 = project(v, p0.X + off, p0.Y, E(Math.max(0, s - .012))), q1 = project(v, p1.X + off, p1.Y, E(Math.min(1, s + .012)));
    const ang = r.total > 0 ? Math.atan2(q1.y - q0.y, q1.x - q0.x) : 0, size = a.size * v.unit * body.k;
    const sh = 1 + e / Math.max(1, 90 * v.unit);
    drawPlaneGlyph(ctx, g.x + e * .22, g.y + e * .34, ang, size * .86, '#000', null, alpha * .18 / sh);
    drawPlaneGlyph(ctx, body.x, body.y, ang, size, a.planeColor, '#0b1620', alpha);
  }
  ctx.restore();
}

// ---------------------------------------------------------------- Animation: pin
function drawPin(ctx, v, geo, th, a, frame, labels) {
  const alpha = actAlpha(a, frame), r = resolveLoc(geo, a.place, v.cx); if (!r || alpha <= 0) return;
  const t = (frame - a.start) / Math.max(1, a.dur), drop = clamp01(t / .45), fall = (1 - bounce(drop)) * 240 * v.unit;
  const g = project(v, r.X, r.Y, 0), top = project(v, r.X, r.Y, fall), s = a.size * v.unit * 24;
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
  if (a.showLabel) {
    const pop = ease('backOut', (t - .45) / .3);
    if (pop > 0) labels.push({ x: g.x, y: g.y - s * 2.5 - 14 * v.unit, text: a.label || a.place.name, alpha: alpha * clamp01(pop * 1.5), scale: .9 + .2 * pop });
  }
}

// ---------------------------------------------------------------- Whole frame
/** Draws the project at `frame` onto a canvas context of size W x H. Returns the view used. */
export function drawMap(ctx, W, H, proj, frame, geo) {
  const th = THEMES[proj.theme] || THEMES.earth, v = makeView(cameraAt(proj, geo, W, H, frame), W, H), labels = [];
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  drawBase(ctx, v, geo, th, proj);
  // Apply color highlights first so the map texture covers highlighted land too.
  // Keep the texture beneath borders, routes, pins, and labels for crisp details.
  for (const a of proj.actions) if (a.type === 'highlight') drawHighlight(ctx, v, geo, th, a, frame, labels);
  drawTexture(ctx, W, H, proj.texture);
  for (const a of proj.actions) if (a.type === 'border') drawBorder(ctx, v, geo, th, a, frame);
  for (const a of proj.actions) if (a.type === 'plane') drawPlane(ctx, v, geo, th, a, frame, labels);
  for (const a of proj.actions) if (a.type === 'pin') drawPin(ctx, v, geo, th, a, frame, labels);
  for (const l of labels) drawLabel(ctx, v, th, l);
  vignette(ctx, v, th);
  ctx.restore();
  return v;
}

// ---------------------------------------------------------------- Project model
export const ACTION_TYPES = {
  border: { label: 'Border', icon: '▱', dur: 60, hint: 'Draw a country outline, or sweep every border' },
  plane: { label: 'Plane', icon: '✈', dur: 90, hint: 'Fly a plane from one place to another' },
  highlight: { label: 'Highlight', icon: '◎', dur: 45, hint: 'Light up a country or a place' },
  pin: { label: 'Pin', icon: '⌖', dur: 45, hint: 'Drop a pin on a location' },
};
const city = (name, lat, lon) => ({ kind: 'city', name, lat, lon });
export const PRESETS = {
  flyTo: { label: 'Fly to', icon: '↘', hint: 'Smooth zoom-and-glide to a place', def: { dur: 60, zoom: 5, pitch: 0, bearing: 0, autoFit: false }, fields: ['target', 'zoom', 'pitch', 'bearing', 'autoFit'] },
  swoop: { label: 'Cinematic swoop', icon: '↺', hint: 'Fly in while tilting and turning', def: { dur: 80, zoom: 5.5, pitch: 58, bearing: 35, autoFit: false }, fields: ['target', 'zoom', 'pitch', 'bearing', 'autoFit'] },
  worldView: { label: 'Back to world', icon: '◍', hint: 'Pull out to the start view', def: { dur: 60 }, fields: [] },
  pushIn: { label: 'Push in', icon: '⊕', hint: 'Slow zoom in', def: { dur: 60, amount: .9 }, fields: ['amount'] },
  pullBack: { label: 'Pull back', icon: '⊖', hint: 'Slow zoom out', def: { dur: 60, amount: 1.2 }, fields: ['amount'] },
  orbit: { label: 'Orbit', icon: '⟳', hint: 'Rotate around the view', def: { dur: 90, degrees: 90, pitch: 55, amount: .3 }, fields: ['degrees', 'pitch', 'amount'] },
  tilt: { label: 'Tilt', icon: '◢', hint: 'Change the viewing angle', def: { dur: 45, pitch: 55, amount: .2 }, fields: ['pitch', 'amount'] },
  panTo: { label: 'Pan to', icon: '⇢', hint: 'Slide across without zooming', def: { dur: 60 }, fields: ['target'] },
  framePlane: { label: 'Frame flight', icon: '▭', hint: 'Fit a plane route in view', def: { dur: 45, pitch: 0, bearing: 0 }, fields: ['planeId', 'pitch', 'bearing'] },
  followPlane: { label: 'Follow plane', icon: '➤', hint: 'Chase the plane in flight', def: { dur: 90, zoom: 4, pitch: 45, lockHeading: false }, fields: ['planeId', 'zoom', 'pitch', 'lockHeading'] },
};
const uid = () => crypto.randomUUID();

export function makeAction(type, start, extra = {}) {
  const base = { id: uid(), type, name: ACTION_TYPES[type].label, start, dur: ACTION_TYPES[type].dur, easing: 'easeInOut', keep: true };
  const own = {
    border: { target: { kind: 'country', name: 'Brazil' }, color: '#e4572e', width: 3.5, glow: true, fillAlpha: .18 },
    plane: { from: city('London', 51.5072, -0.1276), to: city('New York', 40.7128, -74.006), color: '#ff6b35', planeColor: '#ffffff', width: 3, size: 20, lift: 50, glow: true, dashed: false, showPath: true, showLabels: true },
    highlight: { target: { kind: 'country', name: 'Australia' }, color: '#ffb703', dim: .45, showLabel: true, label: '', pulse: true, radius: 400 },
    pin: { place: city('Paris', 48.8566, 2.3522), label: '', showLabel: true, color: '#e63946', size: 1 },
  }[type];
  return { ...base, ...own, ...extra };
}
export function makeShot(preset, start, extra = {}) {
  const P = PRESETS[preset];
  return { id: uid(), kind: 'shot', preset, name: P.label, start, dur: 60, easing: 'easeInOut', target: city('Paris', 48.8566, 2.3522), zoom: 5, pitch: 0, bearing: 0, amount: .9, degrees: 90, planeId: '', autoFit: false, lockHeading: false, ...P.def, ...extra };
}

export function newMapProject() {
  return { version: 1, kind: 'map', name: 'Untitled map', width: 1280, height: 720, fps: 30, frames: 240, theme: 'earth', texture: { ...DEFAULT_TEXTURE }, graticule: true, camera: { init: { ...DEFAULT_CAM } }, shots: [], actions: [] };
}
export function demoMapProject() {
  const p = newMapProject(); p.name = 'Across the Atlantic'; p.frames = 330;
  const plane = makeAction('plane', 130, { dur: 100, from: city('Paris', 48.8566, 2.3522), to: city('New York', 40.7128, -74.006), color: '#ff6b35', lift: 70, showLabels: false });
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
const isLoc = l => l && ['city', 'point', 'country'].includes(l.kind) && typeof l.name === 'string' && l.name.length < 200 && (l.kind === 'country' || (Number.isFinite(l.lat) && Number.isFinite(l.lon) && Math.abs(l.lat) <= 90 && Math.abs(l.lon) <= 360));
const num = (v, a, b) => Number.isFinite(v) && v >= a && v <= b;
const col = c => typeof c === 'string' && /^#[0-9a-f]{6}$/i.test(c);

/** Throws a readable Error when a file is not a usable map project. */
export function validateMapProject(p) {
  if (!p || p.version !== 1 || p.kind !== 'map' || !Array.isArray(p.actions) || !Array.isArray(p.shots)) throw Error('This is not a FrameFlow map project.');
  if (p.actions.length > 200 || p.shots.length > 200) throw Error('Too many items in this map project.');
  if (![24, 30, 60].includes(p.fps) || !Number.isInteger(p.frames) || p.frames < 2 || p.frames > 1800) throw Error('Invalid frame settings.');
  if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 100 || p.height < 100 || p.width > 3840 || p.height > 3840) throw Error('Invalid canvas size.');
  if (!ENUMS.theme.includes(p.theme)) throw Error('Unknown map theme.');
  if (p.texture !== undefined && (!p.texture || !Object.hasOwn(TEXTURES, p.texture.type) || !num(p.texture.strength, 0, 1) || !num(p.texture.scale, .5, 3))) throw Error('Invalid map texture.');
  const i = p.camera?.init;
  if (!i || !num(i.lon, -540, 540) || !num(i.lat, -90, 90) || !num(i.zoom, 0, 14) || !num(i.bearing ?? 0, -3600, 3600) || !num(i.pitch ?? 0, 0, 75)) throw Error('Invalid start view.');
  const ids = new Set();
  for (const it of [...p.actions, ...p.shots]) {
    if (typeof it.id !== 'string' || ids.has(it.id) || typeof it.name !== 'string') throw Error('Invalid item.');
    ids.add(it.id);
    if (!Number.isFinite(it.start) || it.start < 0 || !Number.isFinite(it.dur) || it.dur < 1 || it.dur > 3600 || !ENUMS.easing.includes(it.easing)) throw Error('Invalid item timing.');
  }
  for (const a of p.actions) {
    if (!ACTION_TYPES[a.type]) throw Error('Unknown animation type.');
    if (a.type === 'border' && !((a.target?.kind === 'all') || (a.target?.kind === 'country' && typeof a.target.name === 'string'))) throw Error('Invalid border target.');
    if (a.type === 'plane' && !(isLoc(a.from) && isLoc(a.to))) throw Error('Invalid plane route.');
    if (a.type === 'highlight' && !isLoc(a.target)) throw Error('Invalid highlight target.');
    if (a.type === 'pin' && !isLoc(a.place)) throw Error('Invalid pin location.');
    if (!col(a.color) || (a.type === 'plane' && !col(a.planeColor))) throw Error('Invalid color.');
    for (const [k, lo, hi] of [['width', .5, 20], ['fillAlpha', 0, 1], ['size', .2, 80], ['lift', 0, 400], ['dim', 0, 1], ['radius', 1, 20000]]) if (a[k] !== undefined && !num(a[k], lo, hi)) throw Error('Invalid ' + k + '.');
  }
  for (const s of p.shots) {
    if (!ENUMS.preset.includes(s.preset)) throw Error('Unknown camera preset.');
    if (!isLoc(s.target)) throw Error('Invalid camera target.');
    for (const [k, lo, hi] of [['zoom', 0, 14], ['pitch', 0, 75], ['bearing', -3600, 3600], ['amount', -10, 10], ['degrees', -3600, 3600]]) if (!num(s[k], lo, hi)) throw Error('Invalid camera ' + k + '.');
  }
  return p;
}