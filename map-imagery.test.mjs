// Run with: node tests/map-imagery.test.mjs   (no map-data or canvas needed)
import assert from 'node:assert/strict';
import * as E from '../map-engine.mjs';
import { createImagery, IMAGERY_SOURCES } from '../map-imagery.mjs';

const fake = { maxZoom: id => IMAGERY_SOURCES[id].maxZoom, attribution: () => 'x', get() { return null; }, peek() { return null; } };
const geo = { imagery: fake, byName: new Map(), names: [], pick: () => ({ features: [] }), hi: { features: [] }, cities: [] };
const base = () => { const p = E.newMapProject(); p.theme = 'satellite'; return p; };

assert.ok(E.THEMES.satellite.imagery, 'satellite theme is flagged as imagery');
for (const cam of [{ zoom: .6 }, { zoom: 3 }, { zoom: 7, bearing: 40 }, { zoom: 5, pitch: 70, bearing: 20 }, { zoom: 12 }]) {
  const p = base(); p.camera.init = { lon: 90, lat: 24, ...cam };
  const need = E.imageryNeeds(p, geo, 1280, 720, 0);
  assert.ok(need.length > 0 && need.length <= 140, `tile count in range for ${JSON.stringify(cam)}: ${need.length}`);
  const z = need[0].z, n = 2 ** z;
  assert.ok(z >= 0 && z <= 8, 'zoom capped to the source maximum');
  assert.ok(need.every(t => t.z === z && t.x >= 0 && t.x < n && t.y >= 0 && t.y < n), 'wrapped, valid indices');
  assert.equal(new Set(need.map(t => `${t.x},${t.y}`)).size, need.length, 'no duplicates');
}
// a non-imagery theme needs no tiles
const e = E.newMapProject(); assert.deepEqual(E.imageryNeeds(e, geo, 1280, 720, 0), []);
// world view repeats: tiles wrap around the date line
const w = base(); w.camera.init = { lon: 179, lat: 0, zoom: 2 };
const wn = E.imageryNeeds(w, geo, 1280, 720, 0); assert.ok(wn.some(t => t.x === 0) && wn.some(t => t.x === 2 ** wn[0].z - 1), 'wraps across 180°');
// validation
const v = base(); v.imagery = 'esri'; E.validateMapProject(v);
v.imagery = 'no spaces!'; assert.throws(() => E.validateMapProject(v));
// loader degrades safely when fetch fails (no CORS, offline): resolves instead of hanging
globalThis.fetch = () => Promise.reject(new Error('blocked'));
const im = createImagery(); await im.ready([{ src: 'gibs', z: 1, x: 0, y: 0 }]); assert.equal(im.get('gibs', 1, 0, 0), null); assert.equal(im.failedCount(), 1);
console.log('imagery tests passed');
