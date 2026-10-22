// FrameFlow landing: the live campaign "war table".
// One deterministic scene (render(t) is a pure function of time) powers both the hero
// (autoplay + scrubber + click-to-strike) and the scroll-scrubbed "three acts" section.
// It reads the bundled map-data/countries-110m.json and never touches an editor project.
import { interfaceIcon } from './interface-icons.mjs';

const root = document.getElementById('landing');

const DURATION = 30;
const ACT_STARTS = [0, 9.6, 19.2];
const WORLD = 4096;
const RED = [2.4, 47.2];            // The Western Crown's capital (lon, lat)
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a)); return t * t * (3 - 2 * t); };
const easeSine = t => -(Math.cos(Math.PI * t) - 1) / 2;
const mx = lon => (lon + 180) / 360 * WORLD;
const my = lat => {
  const p = clamp(lat, -85, 85) * Math.PI / 180;
  return (.5 - Math.log(Math.tan(Math.PI / 4 + p / 2)) / (2 * Math.PI)) * WORLD;
};
const lonOf = x => x / WORLD * 360 - 180;
const latOf = y => Math.atan(Math.sinh(Math.PI * (1 - 2 * y / WORLD))) * 180 / Math.PI;
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function curve(points, t) {
  if (t <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    if (t <= points[i][0]) {
      const [t0, v0] = points[i - 1], [t1, v1] = points[i];
      return lerp(v0, v1, (t - t0) / (t1 - t0));
    }
  }
  return points[points.length - 1][1];
}

/* ------------------------------------------------------------------ the campaign */
const CAMERA = [ // time, lon, lat, zoom
  [0, -6, 41, .92], [8.6, 11, 40.5, 1.12], [10.4, 8, 44, 1.28], [18.6, 15, 46, 1.38],
  [20.4, 27, 47, 1.42], [28.2, 22, 46.5, 1.72], [30, -6, 41, .92]
];
function cameraLinear(t) {
  t = clamp(t, 0, DURATION);
  for (let i = 1; i < CAMERA.length; i++) {
    if (t <= CAMERA[i][0]) {
      const a = CAMERA[i - 1], b = CAMERA[i], k = (t - a[0]) / (b[0] - a[0]);
      return [lerp(a[1], b[1], k), lerp(a[2], b[2], k), Math.log(lerp(a[3], b[3], k))];
    }
  }
  const e = CAMERA[CAMERA.length - 1];
  return [e[1], e[2], Math.log(e[3])];
}
function cameraAt(t) { // a triangular-kernel blur of the keyframes: moves never stop dead
  let lon = 0, lat = 0, z = 0, w = 0;
  for (let o = -1.2; o <= 1.2001; o += .3) {
    const k = 1.25 - Math.abs(o), p = cameraLinear(t + o);
    lon += p[0] * k; lat += p[1] * k; z += p[2] * k; w += k;
  }
  return { lon: lon / w, lat: lat / w, z: Math.exp(z / w) };
}

const ROUTES = [
  { t0: .9, dur: 6.6, icon: 'caravel', pts: [[-9.1, 38.7, 'Lisbon'], [-6.4, 36.5], [-5.4, 35.95, 'Gibraltar'], [0, 37.4], [3.1, 37.9, 'Algiers'], [10.6, 37.8, 'Tunis'], [19, 34.6], [25.5, 33.8], [29.9, 31.2, 'Alexandria']] },
  { t0: 2.0, dur: 6.8, icon: 'galleon', pts: [[12.3, 45.4, 'Venice'], [14.6, 43], [17.6, 40.2], [19.4, 37.6], [23.7, 37.9, 'Athens'], [26, 39], [29, 41, 'Constantinople'], [33, 43], [39.7, 41, 'Trebizond']] },
  { t0: 2.8, dur: 5.4, icon: 'caravel', pts: [[-9.1, 38.7], [-16, 40.5], [-25.7, 37.7, 'Azores'], [-31, 33.5], [-34, 28.5, 'Unknown waters']] }
];
const ARROWS_RED = [
  { t0: 10.4, dur: 3.2, a: [2.4, 47.2], c: [-6, 46.2], b: [-4.5, 38.8], icon: 'cavalry' },
  { t0: 11.6, dur: 3.2, a: [2.4, 47.2], c: [10.5, 45.6], b: [14.2, 41.4], icon: 'musketeer' },
  { t0: 13.0, dur: 3.4, a: [2.4, 47.2], c: [10, 52.4], b: [22, 51], icon: 'cavalry' },
  { t0: 14.8, dur: 3.6, a: [2.4, 47.2], c: [19, 43.8], b: [33.5, 44.6], icon: 'pikeman' }
];
const ARROWS_BLUE = [
  { t0: 20.4, dur: 3.4, a: [64, 55], c: [46, 53.5], b: [29, 51] },
  { t0: 21.2, dur: 3.4, a: [62, 41], c: [47, 42.4], b: [32, 41.4] }
];
const front0 = t => {
  const approach = 25 * (1 - smooth(19.2, 20.2, t));
  return 47 + approach - 34 * easeSine(clamp((t - 20.2) / 8)) + 5 * smooth(27.4, 29.2, t);
};
const frontLon = (lat, t) => front0(t) + 3.4 * Math.sin(lat * .42 + t * .8) + 1.6 * Math.sin(lat * .95 - t * 1.5) + (lat - 45) * .12;

const EVENTS = (() => { // artillery and blasts along the front, fixed once so every frame agrees
  const r = rng(11), out = [];
  for (let i = 0; i < 24; i++) {
    const t0 = 21.4 + i * .34 + r() * .22, lat = 36 + r() * 21;
    out.push({ t0, lat, off: -4.5 + r() * 7, big: r() > .72, shell: i % 3 === 0, seed: 100 + i, fromOff: 9 + r() * 5, fromLat: lat + (r() * 6 - 3) });
  }
  return out;
})();

const FACE = { jet: -1 }; // icons face right unless listed

/* ------------------------------------------------------------------ geography */
let worldPromise;
function loadWorld() {
  worldPromise ||= fetch('map-data/countries-110m.json')
    .then(r => { if (!r.ok) throw Error('geo'); return r.json(); })
    .then(buildWorld)
    .catch(() => ({ countries: [], all: null, theater: [], named: [] }));
  return worldPromise;
}
function buildWorld(topo) {
  const tr = topo.transform;
  const arcs = topo.arcs.map(a => {
    if (!tr) return a.map(p => [p[0], p[1]]);
    let x = 0, y = 0;
    return a.map(p => { x += p[0]; y += p[1]; return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]]; });
  });
  const arcPts = i => i < 0 ? arcs[~i].slice().reverse() : arcs[i];
  const ringPts = idx => { const out = []; idx.forEach((i, k) => { const p = arcPts(i); for (let j = k ? 1 : 0; j < p.length; j++) out.push(p[j]); }); return out; };
  const objs = topo.objects || {};
  const obj = objs.countries || objs[Object.keys(objs)[0]];
  const countries = [], all = new Path2D();
  for (const g of obj.geometries || [obj]) {
    const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
    const name = g.properties?.name || String(g.id ?? '');
    if (!polys.length || name === 'Antarctica') continue;
    const path = new Path2D(), bb = [1e9, 1e9, -1e9, -1e9];
    let best = -1, centroid = [0, 0];
    for (const poly of polys) poly.forEach((ring, ri) => {
      const pts = ringPts(ring);
      if (pts.length < 3) return;
      pts.forEach((p, k) => { const x = mx(p[0]), y = my(p[1]); if (k) path.lineTo(x, y); else path.moveTo(x, y); if (ri === 0) { bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); } });
      path.closePath();
      if (ri === 0) {
        let a = 0, cx = 0, cy = 0;
        for (let k = 0; k < pts.length - 1; k++) { const f = pts[k][0] * pts[k + 1][1] - pts[k + 1][0] * pts[k][1]; a += f; cx += (pts[k][0] + pts[k + 1][0]) * f; cy += (pts[k][1] + pts[k + 1][1]) * f; }
        a /= 2;
        if (Math.abs(a) > best) { best = Math.abs(a); centroid = a ? [cx / (6 * a), cy / (6 * a)] : pts[0]; }
      }
    });
    if (best < 0) continue;
    all.addPath(path);
    countries.push({ name, path, lon: centroid[0], lat: centroid[1], bb });
  }
  for (const c of countries) {
    const d = Math.hypot((c.lon - RED[0]) * Math.cos(c.lat * Math.PI / 180), c.lat - RED[1]);
    c.inTheater = c.lon > -14 && c.lon < 64 && c.lat > 26 && c.lat < 68;
    c.tRed = c.inTheater && d < 27 ? 10.1 + Math.pow(d / 27, .85) * 7.7 : 1e6;
    c.w = (c.bb[2] - c.bb[0]) * (c.bb[3] - c.bb[1]);
  }
  const grat = new Path2D();
  for (let lon = -180; lon <= 180; lon += 10) { grat.moveTo(mx(lon), my(-80)); grat.lineTo(mx(lon), my(80)); }
  for (let lat = -80; lat <= 80; lat += 10) { grat.moveTo(0, my(lat)); grat.lineTo(WORLD, my(lat)); }
  return {
    countries, all, grat,
    theater: countries.filter(c => c.inTheater),
    named: countries.filter(c => c.tRed < 1e5).sort((a, b) => b.w - a.w).slice(0, 11)
  };
}

let ICONS = null;
import('./map-objects.mjs').then(m => { ICONS = m.OBJECT_ICONS; }).catch(() => {});

/* ------------------------------------------------------------------ routes */
function buildRoute(def) {
  const P = def.pts.map(p => [mx(p[0]), my(p[1])]), dense = [], per = 18;
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)], p1 = P[i], p2 = P[i + 1], p3 = P[Math.min(P.length - 1, i + 2)];
    for (let k = 0; k < per; k++) {
      const u = k / per, u2 = u * u, u3 = u2 * u;
      dense.push([
        .5 * (2 * p1[0] + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3),
        .5 * (2 * p1[1] + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)
      ]);
    }
  }
  dense.push(P[P.length - 1]);
  const cum = [0];
  for (let i = 1; i < dense.length; i++) cum.push(cum[i - 1] + Math.hypot(dense[i][0] - dense[i - 1][0], dense[i][1] - dense[i - 1][1]));
  const r = { ...def, dense, cum, L: cum[cum.length - 1], pins: [] };
  def.pts.forEach((p, i) => {
    if (!p[2]) return;
    const target = cum[i * per] / r.L;
    let lo = def.t0, hi = def.t0 + def.dur;
    for (let n = 0; n < 24; n++) { const mid = (lo + hi) / 2; if (easeSine(clamp((mid - def.t0) / def.dur)) < target) lo = mid; else hi = mid; }
    r.pins.push({ lon: p[0], lat: p[1], name: p[2], at: hi, unknown: p[2] === 'Unknown waters' });
  });
  return r;
}
const BUILT_ROUTES = ROUTES.map(buildRoute);
const routeProgress = (r, t) => easeSine(clamp((t - r.t0) / r.dur));
function routeHead(r, t) {
  const d = routeProgress(r, t) * r.L;
  let i = 1;
  while (i < r.cum.length - 1 && r.cum[i] < d) i++;
  const k = (d - r.cum[i - 1]) / ((r.cum[i] - r.cum[i - 1]) || 1);
  const a = r.dense[i - 1], b = r.dense[i];
  return { x: lerp(a[0], b[0], k), y: lerp(a[1], b[1], k), idx: i, dx: b[0] - a[0] };
}

/* ------------------------------------------------------------------ the table */
function createTable(canvas, opts = {}) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const fog = document.createElement('canvas'), fx = fog.getContext('2d');
  const sprite = (() => {
    const s = document.createElement('canvas'); s.width = s.height = 128;
    const c = s.getContext('2d'), g = c.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(0,0,0,1)'); g.addColorStop(.45, 'rgba(0,0,0,.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g; c.fillRect(0, 0, 128, 128); return s;
  })();
  const hatch = (() => {
    const s = document.createElement('canvas'); s.width = s.height = 10;
    const c = s.getContext('2d'); c.strokeStyle = 'rgba(223,193,138,.07)'; c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 10); c.lineTo(10, 0); c.stroke(); return s;
  })();
  let W = 0, H = 0, dpr = 1, world = { countries: [], all: null, theater: [], named: [] }, hatchFill = null;
  let pointer = null, strikes = [], vignette = null, slow = 0, frames = 0, lastNow = 0;
  const ox = () => (W > 900 ? (opts.ox ?? .5) : .5);

  loadWorld().then(w => { world = w; canvas.dataset.ready = String(!!w.all); opts.onReady?.(); });

  function resize() {
    const r = canvas.getBoundingClientRect();
    const nw = Math.max(1, Math.round(r.width)), nh = Math.max(1, Math.round(r.height));
    dpr = Math.min(devicePixelRatio || 1, opts.maxDpr ?? 1.5);
    if (nw === W && nh === H && canvas.width === Math.round(nw * dpr)) return;
    W = nw; H = nh;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    fog.width = Math.max(2, Math.round(W * dpr * .5)); fog.height = Math.max(2, Math.round(H * dpr * .5));
    hatchFill = ctx.createPattern(hatch, 'repeat');
    vignette = ctx.createRadialGradient(W * .5, H * .5, Math.min(W, H) * .3, W * .5, H * .5, Math.max(W, H) * .78);
    vignette.addColorStop(0, 'rgba(2,5,8,0)'); vignette.addColorStop(1, 'rgba(2,5,8,.78)');
  }

  function shakeAt(t, now) {
    let sx = 0, sy = 0;
    for (const e of EVENTS) {
      const age = t - e.t0;
      if (age < 0 || age > 1) continue;
      const a = (e.big ? 5 : 2.4) * Math.exp(-age * 7);
      sx += Math.sin(age * 95 + e.seed) * a; sy += Math.cos(age * 83 + e.seed) * a;
    }
    for (const s of strikes) {
      const age = (now - s.at) / 1000;
      if (age > 0 && age < 1) { const a = 6 * Math.exp(-age * 7); sx += Math.sin(age * 90 + s.seed) * a; sy += Math.cos(age * 80 + s.seed) * a; }
    }
    return [sx, sy];
  }

  function render(t, now = performance.now()) {
    resize();
    if (!W || !H) return null;
    const ui = clamp(W / 1440, .62, 1.2), cam = cameraAt(t);
    const base = Math.max(W / (110 / 360 * WORLD), H / (58 / 360 * WORLD));
    const s = base * cam.z, [shx, shy] = opts.shake === false ? [0, 0] : shakeAt(t, now);
    const sx = W * ox() - mx(cam.lon) * s + shx, sy = H * .5 - my(cam.lat) * s + shy;
    const toS = (lon, lat) => [mx(lon) * s + sx, my(lat) * s + sy];
    const wToS = (x, y) => [x * s + sx, y * s + sy];

    // ocean
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sea = ctx.createLinearGradient(0, 0, 0, H);
    sea.addColorStop(0, '#0b1823'); sea.addColorStop(1, '#050a0f');
    ctx.fillStyle = sea; ctx.fillRect(0, 0, W, H);

    // world space
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * sx, dpr * sy);
    const px = 1 / s;
    if (world.grat) { ctx.strokeStyle = 'rgba(223,193,138,.075)'; ctx.lineWidth = px; ctx.stroke(world.grat); }
    if (world.all) {
      ctx.fillStyle = '#17222c'; ctx.fill(world.all, 'evenodd');
      if (hatchFill) { ctx.fillStyle = hatchFill; ctx.fill(world.all, 'evenodd'); }
      ctx.strokeStyle = 'rgba(214,196,160,.2)'; ctx.lineWidth = .8 * px; ctx.stroke(world.all);
    }
    // The Western Crown, country by country
    for (const c of world.theater) {
      const a = smooth(c.tRed, c.tRed + 1.1, t);
      if (a <= .01) continue;
      ctx.globalAlpha = a * .62; ctx.fillStyle = '#b4342a'; ctx.fill(c.path, 'evenodd');
      const flash = 1 - smooth(c.tRed + .1, c.tRed + 1.1, t);
      if (flash > 0) { ctx.globalAlpha = flash * .55; ctx.fillStyle = '#ffb27a'; ctx.fill(c.path, 'evenodd'); }
      ctx.globalAlpha = a * .85; ctx.strokeStyle = '#ff7a55'; ctx.lineWidth = 1.5 * px; ctx.stroke(c.path);
    }
    ctx.globalAlpha = 1;

    // The Eastern Coalition, clipped to everything east of the front line
    const blueA = smooth(19.4, 20.4, t), fpts = [];
    if (blueA > 0 && world.all) {
      for (let lat = 74; lat >= 4; lat -= 1.25) fpts.push([mx(frontLon(lat, t)), my(lat)]);
      ctx.save();
      const clip = new Path2D();
      fpts.forEach((p, i) => i ? clip.lineTo(p[0], p[1]) : clip.moveTo(p[0], p[1]));
      clip.lineTo(WORLD * 1.6, my(4)); clip.lineTo(WORLD * 1.6, my(74)); clip.closePath();
      ctx.clip(clip);
      ctx.globalAlpha = blueA * .7; ctx.fillStyle = '#2f6a9c'; ctx.fill(world.all, 'evenodd');
      ctx.globalAlpha = blueA * .9; ctx.strokeStyle = '#9fd0f5'; ctx.lineWidth = 1.3 * px; ctx.stroke(world.all);
      ctx.restore(); ctx.globalAlpha = 1;
      // the front: glow, line, teeth
      const line = new Path2D(); fpts.forEach((p, i) => i ? line.lineTo(p[0], p[1]) : line.moveTo(p[0], p[1]));
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.globalAlpha = blueA; ctx.strokeStyle = 'rgba(255,107,74,.14)'; ctx.lineWidth = 22 * px; ctx.stroke(line);
      ctx.strokeStyle = 'rgba(255,107,74,.4)'; ctx.lineWidth = 7 * px; ctx.stroke(line);
      ctx.strokeStyle = '#ffd2b0'; ctx.lineWidth = 2.2 * px; ctx.stroke(line);
      ctx.fillStyle = '#ff6b4a'; ctx.beginPath();
      const step = 15 * px; let carry = 0;
      for (let i = 1; i < fpts.length; i++) {
        const [x0, y0] = fpts[i - 1], [x1, y1] = fpts[i], len = Math.hypot(x1 - x0, y1 - y0);
        if (!len) continue;
        const tx = (x1 - x0) / len, ty = (y1 - y0) / len;
        for (let d = step - carry; d < len; d += step) {
          const bx = x0 + tx * d, by = y0 + ty * d, hw = 5 * px;
          ctx.moveTo(bx - tx * hw, by - ty * hw); ctx.lineTo(bx + tx * hw, by + ty * hw);
          ctx.lineTo(bx + ty * 9 * px, by - tx * 9 * px);
        }
        carry = (carry + len) % step;
      }
      ctx.fill(); ctx.globalAlpha = 1;
    }

    // exploration routes
    for (const r of BUILT_ROUTES) {
      const p = routeProgress(r, t); if (p <= 0) continue;
      const head = routeHead(r, t), path = new Path2D();
      for (let i = 0; i < head.idx; i++) { if (i) path.lineTo(r.dense[i][0], r.dense[i][1]); else path.moveTo(r.dense[0][0], r.dense[0][1]); }
      path.lineTo(head.x, head.y);
      const keep = t > 9.4 ? lerp(1, .42, smooth(9.4, 11.5, t)) : 1;
      ctx.globalAlpha = keep; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.strokeStyle = 'rgba(232,207,148,.16)'; ctx.lineWidth = 9 * px; ctx.stroke(path);
      ctx.strokeStyle = '#ecd49b'; ctx.lineWidth = 2.4 * px;
      ctx.setLineDash([9 * px, 6 * px]); ctx.lineDashOffset = -t * 22 * px; ctx.stroke(path); ctx.setLineDash([]);
      ctx.globalAlpha = 1;
    }
    // attack arrows
    const arrow = (def, col, hot, fade) => {
      const k = easeSine(clamp((t - def.t0) / def.dur)); if (k <= 0 || fade <= 0) return null;
      const A = [mx(def.a[0]), my(def.a[1])], C = [mx(def.c[0]), my(def.c[1])], B = [mx(def.b[0]), my(def.b[1])];
      const at = u => [(1 - u) * (1 - u) * A[0] + 2 * (1 - u) * u * C[0] + u * u * B[0], (1 - u) * (1 - u) * A[1] + 2 * (1 - u) * u * C[1] + u * u * B[1]];
      const path = new Path2D(); const n = 28;
      for (let i = 0; i <= n; i++) { const q = at(k * i / n); if (i) path.lineTo(q[0], q[1]); else path.moveTo(q[0], q[1]); }
      ctx.globalAlpha = fade; ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(4,8,12,.8)'; ctx.lineWidth = 12 * px; ctx.stroke(path);
      ctx.strokeStyle = col; ctx.lineWidth = 7 * px; ctx.stroke(path);
      ctx.strokeStyle = hot; ctx.lineWidth = 2 * px; ctx.stroke(path);
      const e = at(k), q = at(Math.max(0, k - .04)), ang = Math.atan2(e[1] - q[1], e[0] - q[0]), h = 17 * px;
      ctx.fillStyle = col; ctx.strokeStyle = 'rgba(4,8,12,.8)'; ctx.lineWidth = 3 * px;
      ctx.beginPath(); ctx.moveTo(e[0] + Math.cos(ang) * h, e[1] + Math.sin(ang) * h);
      ctx.lineTo(e[0] + Math.cos(ang + 2.5) * h, e[1] + Math.sin(ang + 2.5) * h);
      ctx.lineTo(e[0] + Math.cos(ang - 2.5) * h, e[1] + Math.sin(ang - 2.5) * h); ctx.closePath(); ctx.stroke(); ctx.fill();
      ctx.globalAlpha = 1; return { k, end: e };
    };
    const redFade = 1 - smooth(21.5, 23.5, t);
    const redEnds = ARROWS_RED.map(a => arrow(a, '#c8402f', '#ffb199', redFade));
    ARROWS_BLUE.forEach(a => arrow(a, '#3f7fb2', '#bfe3ff', 1 - smooth(27, 29, t)));

    // atlas lettering attached to the map
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const lettering = (text, lon, lat, size, rot, color, alpha, italic) => {
      if (alpha <= .01) return;
      const [x, y] = [mx(lon), my(lat)];
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot * Math.PI / 180); ctx.globalAlpha = alpha;
      ctx.font = italic ? `italic 400 ${size}px Georgia, serif` : `800 ${size}px "Big Shoulders Display", Impact, "Arial Narrow", sans-serif`;
      ctx.letterSpacing = italic ? '0.12em' : '0.32em';
      ctx.fillStyle = color; ctx.fillText(text, 0, 0); ctx.restore(); ctx.globalAlpha = 1;
    };
    lettering('Mare Incognitum', -20.5, 33.5, 17, -6, '#d9c18c', (1 - smooth(5, 9, t)) * .8, true);
    lettering('WESTERN CROWN', 2.5, 49.4, 27, -5, '#ffd9bf', smooth(14.5, 16.5, t) * (1 - .55 * smooth(24, 27, t)), false);
    lettering('EASTERN COALITION', 47, 52.8, 25, -3, '#cfe9ff', smooth(21, 23, t), false);
    ctx.letterSpacing = '0px';

    // capital names, drawn as map text so they stay put with the geography
    if (t > 12) {
      ctx.font = `600 ${11}px "DM Sans", sans-serif`; ctx.letterSpacing = '0.16em';
      for (const c of world.named) {
        const a = smooth(c.tRed + .6, c.tRed + 1.8, t) * (1 - smooth(0, 6, mx(c.lon) - mx(frontLon(c.lat, t)) + 3));
        if (a <= .02) continue;
        ctx.globalAlpha = a * .85; ctx.fillStyle = '#f2dcc0'; ctx.fillText(c.name.toUpperCase(), mx(c.lon), my(c.lat));
      }
      ctx.globalAlpha = 1; ctx.letterSpacing = '0px';
    }

    // fog of the unknown (screen aligned, half resolution)
    const f = fog.width / W;
    fx.setTransform(1, 0, 0, 1, 0, 0); fx.globalCompositeOperation = 'source-over'; fx.clearRect(0, 0, fog.width, fog.height);
    fx.fillStyle = `rgba(3,7,11,${curve([[0, .95], [8, .9], [10, .78], [17, .62], [20, .5], [30, .46]], t)})`;
    fx.fillRect(0, 0, fog.width, fog.height);
    fx.globalCompositeOperation = 'destination-out'; fx.setTransform(f, 0, 0, f, 0, 0);
    const hole = (x, y, r, a = 1) => { fx.globalAlpha = a; fx.drawImage(sprite, x - r, y - r, r * 2, r * 2); };
    const stepPx = 38 * ui;
    for (const r of BUILT_ROUTES) {
      if (t <= r.t0) continue;
      const head = routeHead(r, t), stride = Math.max(1, Math.round(stepPx / ((r.L * s) / r.dense.length)));
      for (let i = 0; i < head.idx; i += stride) { const q = wToS(r.dense[i][0], r.dense[i][1]); hole(q[0], q[1], 100 * ui); }
      const q = wToS(head.x, head.y); hole(q[0], q[1], 130 * ui);
    }
    for (const c of world.theater) {
      const g = smooth(c.tRed, c.tRed + 1.8, t); if (g <= 0) continue;
      const q = toS(c.lon, c.lat), rad = clamp(Math.sqrt(c.w) * .85 * s, 45 * ui, 240 * ui);
      hole(q[0], q[1], rad * g);
    }
    if (blueA > 0) for (let lat = 34; lat <= 60; lat += 3.5) { const q = toS(frontLon(lat, t), lat); hole(q[0], q[1], 150 * ui, blueA); }
    if (pointer) hole(pointer.x, pointer.y, 120 * ui);
    fx.globalAlpha = 1; fx.globalCompositeOperation = 'source-over';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.drawImage(fog, 0, 0, W, H);

    // screen space: pins, units, effects
    const label = (text, x, y, font, color, alpha = 1, align = 'left') => {
      ctx.font = font; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.globalAlpha = alpha;
      ctx.lineWidth = 3.5; ctx.strokeStyle = 'rgba(4,8,12,.9)'; ctx.lineJoin = 'round'; ctx.strokeText(text, x, y);
      ctx.fillStyle = color; ctx.fillText(text, x, y); ctx.globalAlpha = 1;
    };
    const drawIcon = (name, x, y, size, color, dir, alpha = 1) => {
      const ic = ICONS && ICONS[name];
      ctx.save(); ctx.globalAlpha *= alpha; ctx.translate(x, y);
      if (dir * (FACE[name] || 1) < 0) ctx.scale(-1, 1);
      if (ic && ic.draw) { try { ic.draw(ctx, size, color, ic.historic || ic.timeUnit === 'seconds' ? t : t * 30); } catch (e) { /* keep drawing the rest of the frame */ } }
      else { ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(-size * .6, size * .2); ctx.lineTo(size * .6, size * .2); ctx.lineTo(size * .35, size * .6); ctx.lineTo(-size * .35, size * .6); ctx.closePath(); ctx.fill(); ctx.fillRect(-1, -size * .7, 2, size * .9); ctx.beginPath(); ctx.moveTo(1, -size * .7); ctx.lineTo(size * .6, size * .1); ctx.lineTo(1, size * .1); ctx.fill(); }
      ctx.restore();
    };
    for (const r of BUILT_ROUTES) {
      for (const pin of r.pins) {
        const age = t - pin.at; if (age < 0) continue;
        const [x, y] = toS(pin.lon, pin.lat), drop = 1 - easeSine(clamp(age / .5)), a = 1 - .45 * smooth(9.5, 11.5, t);
        const ring = (age % 2.6) / 2.6;
        ctx.globalAlpha = a * (1 - ring) * .7; ctx.strokeStyle = '#ecd49b'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(x, y - drop * 26, 4 + ring * 17 * ui, 0, 7); ctx.stroke();
        ctx.globalAlpha = a; ctx.fillStyle = pin.unknown ? '#0b1218' : '#ecd49b'; ctx.strokeStyle = '#ecd49b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y - drop * 26, 4.5, 0, 7); ctx.fill(); ctx.stroke();
        label(pin.name, x + 10, y - drop * 26 - 9, `italic 400 ${Math.round(12 * clamp(ui, .85, 1.1))}px Georgia, serif`, '#f1e3bf', a * smooth(0, .5, age));
      }
      if (t > r.t0 && t < r.t0 + r.dur + 4) {
        const h = routeHead(r, t), [x, y] = wToS(h.x, h.y), out = 1 - smooth(r.t0 + r.dur + .5, r.t0 + r.dur + 3.5, t);
        drawIcon(r.icon, x, y - 6 + Math.sin(t * 3 + r.t0) * 1.5, 15 * ui, '#e9dcc0', h.dx >= 0 ? 1 : -1, out);
      }
    }
    // armies
    const unit = (name, lon, lat, col, dir, alpha, size = 15) => { if (alpha > .02) { const [x, y] = toS(lon, lat); drawIcon(name, x, y + Math.sin(t * 2.4 + lon) * 1.5, size * ui, col, dir, alpha); } };
    redEnds.forEach((e, i) => { if (e && e.k > .96) unit(ARROWS_RED[i].icon, ARROWS_RED[i].b[0], ARROWS_RED[i].b[1], '#c9503e', 1, 1 - smooth(21.5, 23.5, t)); });
    unit('conqueror', RED[0], RED[1], '#c9503e', 1, smooth(10, 11, t) * (1 - smooth(22, 23.5, t)), 19);
    unit('stoneFort', RED[0] - 2.4, RED[1] - 1.2, '#c9503e', 1, smooth(11.6, 12.6, t) * (1 - smooth(22, 23.5, t)), 15);
    const war = smooth(20.8, 21.8, t);
    [[41.5, 0], [46.5, 1], [52, 2]].forEach(([lat], i) => {
      unit('cannonBattery', frontLon(lat, t) - 3.3, lat, '#c9503e', 1, war, 17);
      unit('cavalry', frontLon(lat - 3, t) + 2.8, lat - 3, '#5d93c4', -1, war, 15);
    });
    unit('galleon', lerp(0, 17, clamp((t - 20.5) / 8)), 36.4 + Math.sin(t * .6) * .5, '#e9dcc0', 1, war * (1 - smooth(27.6, 29, t)), 15);

    // artillery, impacts, strikes
    const blast = (x, y, age, big, seed, scale = 1) => {
      if (age < 0 || age > 3.2) return;
      const r = rng(seed), k = (big ? 1.45 : 1) * ui * scale;
      if (age < .3) { const g = ctx.createRadialGradient(x, y, 0, x, y, 95 * k); const a = (1 - age / .3) ** 2; g.addColorStop(0, `rgba(255,236,190,${a})`); g.addColorStop(.35, `rgba(255,140,70,${a * .7})`); g.addColorStop(1, 'rgba(255,80,40,0)'); ctx.fillStyle = g; ctx.fillRect(x - 100 * k, y - 100 * k, 200 * k, 200 * k); }
      for (let n = 0; n < 2; n++) { const a = age - n * .14; if (a < 0 || a > 1.3) continue; ctx.strokeStyle = `rgba(255,${190 - n * 40},140,${(1 - a / 1.3) ** 1.5})`; ctx.lineWidth = (3.2 - n) * (1 - a / 1.3) + .4; ctx.beginPath(); ctx.arc(x, y, (16 + a * 250) * k, 0, 7); ctx.stroke(); }
      for (let n = 0; n < 5; n++) { const a = age - n * .06; if (a < 0) continue; ctx.fillStyle = `rgba(18,22,26,${.32 * (1 - age / 3.2)})`; ctx.beginPath(); ctx.arc(x + (r() - .5) * 34 * k, y - a * 26 * k - n * 4, (13 + a * 20) * k, 0, 7); ctx.fill(); }
      if (age < 1.5) for (let n = 0; n < 12; n++) { const ang = r() * 6.28, sp = (40 + r() * 140) * k; ctx.fillStyle = `rgba(255,${150 + r() * 90 | 0},80,${1 - age / 1.5})`; ctx.beginPath(); ctx.arc(x + Math.cos(ang) * sp * age, y + Math.sin(ang) * sp * age + 120 * age * age * k, 1.8, 0, 7); ctx.fill(); }
    };
    for (const e of EVENTS) {
      const [x, y] = toS(frontLon(e.lat, e.t0) + e.off, e.lat);
      if (e.shell && t > e.t0 - 1 && t < e.t0) {
        const p = (t - (e.t0 - 1)), [x0, y0] = toS(frontLon(e.fromLat, e.t0 - 1) - e.fromOff, e.fromLat);
        const qx = lerp(x0, x, p), qy = lerp(y0, y, p) - Math.sin(p * Math.PI) * Math.hypot(x - x0, y - y0) * .32;
        ctx.strokeStyle = 'rgba(255,210,160,.28)'; ctx.setLineDash([4, 5]); ctx.lineWidth = 1.4; ctx.beginPath();
        for (let n = 0; n <= 24; n++) { const u = n / 24; const ax = lerp(x0, x, u), ay = lerp(y0, y, u) - Math.sin(u * Math.PI) * Math.hypot(x - x0, y - y0) * .32; if (n) ctx.lineTo(ax, ay); else ctx.moveTo(ax, ay); }
        ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = '#fff1d6'; ctx.beginPath(); ctx.arc(qx, qy, 3, 0, 7); ctx.fill();
      }
      blast(x, y, t - e.t0, e.big, e.seed);
    }
    strikes = strikes.filter(k => (now - k.at) / 1000 < 3.3);
    for (const k of strikes) blast(k.x, k.y, (now - k.at) / 1000, true, k.seed, 1.1);

    // film: letterbox bars, vignette, fades
    const beat = Math.max(...ACT_STARTS.map(a => 1 - smooth(0, 1.1, Math.abs(t - a - .5))));
    const bar = H * (.05 + .075 * beat);
    ctx.fillStyle = vignette; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = '#020407'; ctx.fillRect(0, 0, W, bar); ctx.fillRect(0, H - bar, W, bar);
    if (opts.loopFade !== false) {
      const dark = Math.max(smooth(28.9, 29.7, t), 1 - smooth(0, .9, t));
      if (dark > 0) { ctx.globalAlpha = dark; ctx.fillStyle = '#020407'; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    }

    // adaptive quality
    if (lastNow) { const dt = now - lastNow; if (dt < 200) { slow = slow * .95 + dt * .05; if (++frames > 40 && slow > 30 && (opts.maxDpr ?? 1.5) > 1) { opts.maxDpr = 1; canvas.width = 0; frames = 0; } } }
    lastNow = now;

    // HUD numbers
    let red = 0, blue = 0, total = 0;
    for (const c of world.theater) {
      const fxw = mx(frontLon(c.lat, t)), bf = blueA > 0 ? clamp((c.bb[2] - fxw) / ((c.bb[2] - c.bb[0]) || 1)) * blueA : 0;
      total += c.w; blue += c.w * bf; red += c.w * smooth(c.tRed, c.tRed + 1.1, t) * (1 - bf);
    }
    return { t, act: t >= ACT_STARTS[2] ? 2 : t >= ACT_STARTS[1] ? 1 : 0, red: total ? Math.round(red / total * 100) : 0, blue: total ? Math.round(blue / total * 100) : 0, lon: cam.lon, lat: cam.lat };
  }

  return {
    render, resize,
    setPointer: p => { pointer = p; },
    strike: (x, y) => { strikes.push({ x, y, at: performance.now(), seed: 500 + strikes.length * 7 + (Math.random() * 1000 | 0) }); },
    get animating() { return strikes.length > 0; },
    get ready() { return !!world.all; }
  };
}

/* ------------------------------------------------------------------ page wiring */
if (root) {
  const landing = () => document.body.classList.contains('landing');
  const fmt = t => `00:${String(Math.floor(t)).padStart(2, '0')}.${Math.floor((t % 1) * 10)}`;
  const coord = (lat, lon) => `${Math.abs(Math.round(lat))}° ${lat >= 0 ? 'N' : 'S'} / ${Math.abs(Math.round(lon))}° ${lon >= 0 ? 'E' : 'W'}`;

  const ACT_COPY = [
    { year: 1492, name: 'Act I · The unknown coast', title: 'The fleets leave harbor', text: 'Routes cross open water. Every new coastline is a discovery.' },
    { year: 1507, name: 'Act II · The conquest', title: 'A realm takes shape', text: 'Borders change hands. Arrows push the crown across the continent.' },
    { year: 1521, name: 'Act III · The front', title: 'The line will not hold', text: 'Artillery opens. The front breaks, and breaks again.' }
  ];

  // ---------- hero
  const stage = root.querySelector('[data-war-stage="hero"]');
  if (stage) {
    const canvas = stage.querySelector('canvas'), play = stage.querySelector('#mhWarPlay'), seek = stage.querySelector('#mhWarSeek');
    const timeEl = stage.querySelector('#mhWarTime'), actName = stage.querySelector('[data-war-act-name]');
    const yearEl = stage.querySelector('[data-war-year]'), titleEl = stage.querySelector('[data-war-act-title]'), textEl = stage.querySelector('[data-war-act-text]');
    const redEl = stage.querySelector('[data-war-red]'), blueEl = stage.querySelector('[data-war-blue]');
    const redBar = stage.querySelector('[data-war-redbar]'), blueBar = stage.querySelector('[data-war-bluebar]'), coordEl = stage.querySelector('[data-war-coord]');
    const lines = [...stage.querySelectorAll('[data-war-line]')], panel = stage.querySelector('.mh-war-panel');
    const table = createTable(canvas, { ox: .66, onReady: () => kick() });
    let t = reduced.matches ? 17.6 : 0, playing = !reduced.matches, visible = true, raf = 0, last = 0, lastAct = -1, lastYear = 0, idleUntil = 0;

    function hud(info) {
      if (!info) return;
      timeEl.textContent = fmt(t); seek.value = String(Math.round(t * 10)); seek.style.setProperty('--p', `${t / DURATION * 100}%`);
      coordEl.textContent = coord(info.lat, info.lon);
      redEl.textContent = `${info.red}%`; blueEl.textContent = `${info.blue}%`;
      redBar.style.width = `${info.red}%`; blueBar.style.width = `${info.blue}%`;
      const year = ACT_COPY[0].year + Math.floor(t / DURATION * (ACT_COPY[2].year - ACT_COPY[0].year));
      if (year !== lastYear) { yearEl.textContent = year; lastYear = year; }
      if (info.act !== lastAct) {
        lastAct = info.act; const c = ACT_COPY[info.act];
        actName.textContent = c.name; titleEl.textContent = c.title; textEl.textContent = c.text;
        lines.forEach((el, i) => el.classList.toggle('is-on', i === info.act));
        stage.dataset.act = String(info.act);
        panel.classList.remove('swap'); void panel.offsetWidth; panel.classList.add('swap');
      }
    }
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden || !landing()) return;
      const dt = Math.min(.05, (now - (last || now)) / 1000); last = now;
      if (playing) t = (t + dt) % DURATION;
      hud(table.render(t, now));
      if (playing || table.animating || now < idleUntil) raf = requestAnimationFrame(frame); else last = 0;
    }
    function kick() { if (!raf && visible && !document.hidden && landing()) raf = requestAnimationFrame(frame); }
    function setPlaying(v) {
      playing = v; last = 0;
      play.setAttribute('aria-pressed', String(v)); play.setAttribute('aria-label', v ? 'Pause campaign preview' : 'Play campaign preview');
      play.querySelector('[data-play-icon]').innerHTML = interfaceIcon(v ? 'pause' : 'play'); play.querySelector('[data-play-text]').textContent = v ? 'Pause' : 'Play';
      kick();
    }
    play.addEventListener('click', () => setPlaying(!playing));
    seek.addEventListener('input', () => { t = Number(seek.value) / 10; setPlaying(false); idleUntil = performance.now() + 300; kick(); });
    stage.querySelectorAll('[data-war-jump]').forEach(b => b.addEventListener('click', () => { t = ACT_STARTS[Number(b.dataset.warJump)] + .9; setPlaying(false); idleUntil = performance.now() + 300; kick(); }));
    const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
    stage.addEventListener('pointermove', e => { if (e.pointerType === 'touch') return; table.setPointer(local(e)); idleUntil = performance.now() + 900; kick(); });
    stage.addEventListener('pointerleave', () => { table.setPointer(null); kick(); });
    stage.addEventListener('pointerdown', e => {
      if (reduced.matches || e.target.closest('a,button,input,.mh-war-controls,.mh-war-copy')) return;
      const p = local(e); table.strike(p.x, p.y); kick();
    });
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }, { rootMargin: '60px' }).observe(stage);
    new ResizeObserver(() => { table.resize(); idleUntil = performance.now() + 200; kick(); }).observe(stage);
    document.addEventListener('visibilitychange', () => { last = 0; kick(); });
    new MutationObserver(() => { setPlaying(landing() && !reduced.matches); }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    reduced.addEventListener('change', () => setPlaying(!reduced.matches));
    setPlaying(playing);
    kick();
  }

  // ---------- three acts, scrubbed by scroll
  const acts = root.querySelector('[data-acts]');
  if (acts) {
    const canvas = acts.querySelector('canvas'), track = acts.querySelector('.mh-acts-track'), sticky = acts.querySelector('.mh-acts-sticky');
    const chapters = [...acts.querySelectorAll('[data-act]')], playhead = acts.querySelector('[data-acts-playhead]'), rail = [...acts.querySelectorAll('[data-acts-rail] > li')];
    const timeEl = acts.querySelector('[data-acts-time]');
    const table = createTable(canvas, { ox: .62, loopFade: false, shake: true, onReady: () => { shown = -1; kick(); } });
    let cur = 0, shown = -1, raf = 0, visible = false, lastAct = -1;
    const target = () => {
      if (reduced.matches || getComputedStyle(sticky).position !== 'sticky') return 17.6;
      const r = track.getBoundingClientRect(), total = Math.max(1, r.height - innerHeight);
      return clamp(-r.top / total) * (DURATION - 1.2);
    };
    function frame(now) {
      raf = 0;
      if (!visible || document.hidden || !landing()) return;
      const goal = target(); cur += (goal - cur) * (reduced.matches ? 1 : .14);
      if (Math.abs(goal - cur) < .004) cur = goal;
      if (Math.abs(cur - shown) > .0005 || table.animating) {
        shown = cur; const info = table.render(cur, now);
        if (info) {
          playhead.style.setProperty('--ph', String(cur / DURATION)); timeEl.textContent = fmt(cur);
          if (info.act !== lastAct) { lastAct = info.act; chapters.forEach((c, i) => c.classList.toggle('is-on', i === info.act)); rail.forEach((r, i) => r.classList.toggle('is-done', i <= info.act)); acts.dataset.act = String(info.act); }
        }
      }
      if (Math.abs(goal - cur) > .004 || table.animating) raf = requestAnimationFrame(frame);
    }
    function kick() { if (!raf && visible && !document.hidden && landing()) raf = requestAnimationFrame(frame); }
    new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) kick(); }, { rootMargin: '120px' }).observe(acts);
    new ResizeObserver(() => { table.resize(); shown = -1; kick(); }).observe(sticky);
    window.addEventListener('scroll', kick, { passive: true });
    reduced.addEventListener('change', () => { shown = -1; kick(); });
    document.addEventListener('visibilitychange', kick);
    new MutationObserver(kick).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }
}
