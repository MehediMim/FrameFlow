// DEM-only cartographic relief. Terrarium heights are metres in EPSG:3857.
// https://github.com/tilezen/joerd/blob/master/docs/formats.md
export const RELIEF_DEFAULTS = Object.freeze({
  azimuth: 315, altitude: 38, strength: .88, ambient: .3,
  exaggeration: 3, multidirectional: true, bathymetry: true,
  low: '#596653', middle: '#89917f', high: '#b9bbaa',
  shallow: '#7fc8ed', deep: '#246c93', highlightColor: '#e8be4f', highlightOpacity: .85,
});
export const RELIEF_ATTRIBUTION = 'Terrain: Mapzen / USGS / NOAA / Copernicus and contributors · frameflow terrain credits';
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * clamp(t, 0, 1));
export function reliefSettings(value = {}) { return { ...RELIEF_DEFAULTS, ...value }; }
export function validateRelief(s) {
  if (s === undefined) return;
  const bad = () => { throw Error('Invalid terrain settings.'); };
  if (!s || typeof s !== 'object' || Array.isArray(s)) bad();
  for (const [k, lo, hi] of [['azimuth', 0, 360], ['altitude', 5, 85], ['strength', 0, 1], ['ambient', 0, 1], ['exaggeration', .5, 6], ['highlightOpacity', 0, 1]])
    if (s[k] !== undefined && (!Number.isFinite(s[k]) || s[k] < lo || s[k] > hi)) bad();
  for (const k of ['low', 'middle', 'high', 'shallow', 'deep', 'highlightColor']) if (s[k] !== undefined && !/^#[0-9a-f]{6}$/i.test(s[k])) bad();
  for (const k of ['multidirectional', 'bathymetry']) if (s[k] !== undefined && typeof s[k] !== 'boolean') bad();
}
export function decodeTerrarium(rgba) {
  const heights = new Float32Array(rgba.length / 4);
  for (let i = 0; i < heights.length; i++) heights[i] = rgba[i * 4] * 256 + rgba[i * 4 + 1] + rgba[i * 4 + 2] / 256 - 32768;
  return heights;
}
// Central differences define the surface normal (equivalent to slope/aspect).
// At dataset edges use one-sided differences, rather than duplicating a sample.
export function shadeRelief(heights, size, z, tileY, settings) {
  const s = reliefSettings(settings), out = new Uint8ClampedArray(size * size * 4);
  const low = hex(s.low), mid = hex(s.middle), high = hex(s.high), shallow = hex(s.shallow), deep = hex(s.deep);
  const rad = Math.PI / 180, alt = s.altitude * rad;
  const lights = (s.multidirectional ? [-45, 0, 45] : [0]).map(d => {
    const a = (s.azimuth + d) * rad;
    return [Math.sin(a) * Math.cos(alt), -Math.cos(a) * Math.cos(alt), Math.sin(alt)];
  });
  const get = (x, y) => heights[clamp(y, 0, size - 1) * size + clamp(x, 0, size - 1)];
  for (let y = 0; y < size; y++) {
    const metres = 40075016.686 / (size * 2 ** z) / Math.cosh(Math.PI * (1 - 2 * (tileY + (y + .5) / size) / 2 ** z));
    for (let x = 0; x < size; x++) {
      const h = get(x, y), sea = h < 0;
      const dx = (get(x + 1, y) - get(x - 1, y)) / ((x === 0 || x === size - 1 ? 1 : 2) * metres) * s.exaggeration;
      const dy = (get(x, y + 1) - get(x, y - 1)) / ((y === 0 || y === size - 1 ? 1 : 2) * metres) * s.exaggeration;
      const norm = Math.hypot(dx, dy, 1);
      let light = 0;
      for (const l of lights) light += Math.max(0, (-dx * l[0] - dy * l[1] + l[2]) / norm);
      light /= lights.length;
      // A small curvature-based ambient term deepens concave valleys.
      const bowl = Math.max(0, (get(x - 3, y) + get(x + 3, y) + get(x, y - 3) + get(x, y + 3)) / 4 - h);
      const ambient = Math.min(.25, bowl / Math.max(20, metres * 3)) * s.ambient;
      const shade = sea && !s.bathymetry ? 1 : clamp(1 + (light - Math.sin(alt)) * s.strength * (sea ? .35 : 1.3) - ambient, .36, 1.28);
      // Retain a bright continental shelf, then deepen rapidly down the slope.
      const depth = clamp((-h - 180) / 3500, 0, 1);
      const oceanBlend = depth * depth * (3 - 2 * depth);
      const color = sea ? (s.bathymetry ? mix(shallow, deep, oceanBlend) : deep) : h < 1800 ? mix(low, mid, h / 1800) : mix(mid, high, (h - 1800) / 4200);
      const i = (y * size + x) * 4;
      for (let c = 0; c < 3; c++) out[i + c] = color[c] * shade;
      out[i + 3] = 255;
    }
  }
  return out;
}

// Bounded decoded-height and styled-tile caches. Recoloring never refetches a DEM.
// The browser's normal HTTP cache also reuses downloaded PNGs across sessions.
export function createRelief({ limit = 220, concurrency = 4, load = loadElevation, render = renderElevation } = {}) {
  const raw = new Map(), styled = new Map(), queue = [];
  let active = 0, failed = 0, current = reliefSettings(), generation = 0;
  const api = { onTile: null };
  const touch = (cache, key, value) => { cache.delete(key); cache.set(key, value); };
  const trim = cache => {
    for (const [key, e] of cache) {
      if (cache.size <= limit) break;
      if (e.state !== 'loading') { e.img?.close?.(); cache.delete(key); }
    }
  };
  const heights = (z, x, y) => {
    const key = `${z}/${x}/${y}`;
    let e = raw.get(key);
    if (!e) {
      e = { state: 'loading' }; raw.set(key, e);
      e.promise = load(z, x, y).then(value => { e.state = 'ok'; e.value = value; trim(raw); return value; }, err => { e.state = 'error'; trim(raw); throw err; });
    } else touch(raw, key, e);
    return e.promise;
  };
  async function pump() {
    while (active < concurrency && queue.length) {
      const job = queue.shift(); active++;
      (async () => {
        try {
          const data = await heights(job.z, job.x, job.y);
          if (job.generation !== generation) return;
          const img = await render(data, job.z, job.y, job.settings);
          if (job.generation !== generation) { img.close?.(); return; }
          job.e.img = img;
          job.e.state = 'ok'; job.e.time = performance.now();
        } catch { job.e.state = 'error'; failed++; }
        finally {
          if (job.e.state === 'loading') job.e.state = 'error';
          active--; job.e.resolve(); trim(styled); api.onTile?.(); pump();
        }
      })();
    }
  }
  api.configure = value => {
    const next = reliefSettings(value);
    if (JSON.stringify(next) === JSON.stringify(current)) return;
    current = next; generation++;
    for (const e of styled.values()) { e.img?.close?.(); e.resolve(); }
    styled.clear(); queue.splice(0);
  };
  const keyOf = (z, x, y) => `${generation}/${z}/${x}/${y}`;
  api.retain = tiles => {
    const visible = new Set(tiles.map(t => keyOf(t.z, t.x, t.y)));
    for (let i = queue.length - 1; i >= 0; i--) {
      const job = queue[i], key = keyOf(job.z, job.x, job.y);
      if (!visible.has(key)) { queue.splice(i, 1); styled.delete(key); job.e.resolve(); }
    }
  };
  api.get = (_id, z, x, y) => {
    const key = keyOf(z, x, y); let e = styled.get(key);
    if (!e) {
      e = { img: null, state: 'loading' }; e.promise = new Promise(resolve => { e.resolve = resolve; });
      styled.set(key, e); queue.push({ e, z, x, y, generation, settings: current }); pump(); trim(styled);
    } else touch(styled, key, e);
    return e.img;
  };
  api.peek = (_id, z, x, y) => styled.get(keyOf(z, x, y))?.img || null;
  api.opacity = (_id, z, x, y) => {
    const a = clamp((performance.now() - (styled.get(keyOf(z, x, y))?.time ?? 0)) / 240, 0, 1);
    if (a < 1) api.onTile?.();
    return a;
  };
  api.ready = async (tiles, cancelled = () => false) => {
    await Promise.all(tiles.map(t => { api.get(t.src, t.z, t.x, t.y); return styled.get(keyOf(t.z, t.x, t.y))?.promise; }));
    if (cancelled()) throw new DOMException('Export cancelled.', 'AbortError');
  };
  api.prefetch = tiles => { for (const t of tiles) api.get(t.src, t.z, t.x, t.y); };
  api.maxZoom = () => 14;
  api.attribution = () => RELIEF_ATTRIBUTION;
  api.failedCount = () => failed;
  return api;
}
function surface(size) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(size, size);
  const c = document.createElement('canvas'); c.width = c.height = size; return c;
}
async function loadElevation(z, x, y) {
  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await fetch(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${z}/${x}/${y}.png`, { mode: 'cors', signal: AbortSignal.timeout(20000) });
      if (!response.ok) throw Error(`DEM HTTP ${response.status}`);
      break;
    } catch (error) { if (attempt === 1) throw error; }
  }
  const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: 'none' });
  try {
    const size = bitmap.width, ctx = surface(size).getContext('2d', { willReadFrequently: true });
    ctx.drawImage(bitmap, 0, 0);
    return { heights: decodeTerrarium(ctx.getImageData(0, 0, size, size).data), size };
  } finally { bitmap.close(); }
}
async function renderElevation(data, z, y, settings) {
  // Yield between tiles so UI events and painting can run during bulk loading.
  await new Promise(resolve => setTimeout(resolve, 0));
  const canvas = surface(data.size), ctx = canvas.getContext('2d');
  ctx.putImageData(new ImageData(shadeRelief(data.heights, data.size, z, y, settings), data.size, data.size), 0, 0);
  return canvas;
}
