import assert from 'node:assert/strict';
import { decodeTerrarium, shadeRelief, createRelief, validateRelief } from '../map-relief.mjs';
import { newMapProject, validateMapProject, imageryNeeds } from '../map-engine.mjs';

assert.deepEqual([...decodeTerrarium(new Uint8Array([128,0,0,255, 127,255,128,255, 131,232,0,255]))], [0, -.5, 1000]);
const size = 16, heights = new Float32Array(size * size).fill(1000);
const flat = shadeRelief(heights, size, 10, 400, {});
assert.ok(flat.every((v, i) => i % 4 === 3 ? v === 255 : v === flat[i % 4]), 'flat elevation has uniform color');
const slope = Float32Array.from(heights, (_, i) => 1000 + (i % size) * 70);
const east = shadeRelief(slope, size, 10, 400, { azimuth: 90, multidirectional: false });
const west = shadeRelief(slope, size, 10, 400, { azimuth: 270, multidirectional: false });
assert.ok(west[0] > east[0], 'west-facing slope is brighter under western sunlight');
const unshaded = shadeRelief(slope, size, 10, 400, { strength: 0, ambient: 0 });
assert.ok(unshaded[0] > east[0], 'strength controls directional shadows');
const shallow = shadeRelief(new Float32Array(size * size).fill(-10), size, 4, 8, {});
const deep = shadeRelief(new Float32Array(size * size).fill(-5500), size, 4, 8, {});
assert.ok(shallow[2] > deep[2], 'shallow waters are lighter than deep oceans');
for (const s of [{ altitude: 0 }, { low: 'bad' }, { bathymetry: 1 }, { highlightOpacity: NaN }]) assert.throws(() => validateRelief(s));
const p = newMapProject(); p.theme = 'relief'; p.terrain = { azimuth: 270, low: '#778877' };
validateMapProject(JSON.parse(JSON.stringify(p)));
let loads = 0, renders = 0, running = 0, peak = 0;
const provider = createRelief({ limit: 8, concurrency: 2,
  load: async () => { loads++; peak = Math.max(peak, ++running); await new Promise(r => setTimeout(r, 2)); running--; return { heights, size }; },
  render: async () => ({ width: size, height: size, revision: ++renders }),
});
const geo = { relief: provider, byName: new Map(), pick: () => ({ features: [] }), hi: { features: [] } };
for (const zoom of [.6, 4, 7, 12, 14]) {
  p.camera.init = { lon: 179, lat: 30, zoom, pitch: 35, bearing: 20 };
  const tiles = imageryNeeds(p, geo, 1280, 720, 0);
  assert.ok(tiles.length > 0 && tiles.length <= 140);
  assert.ok(tiles.every(t => t.src === 'relief' && t.z <= 14 && t.x >= 0 && t.x < 2 ** t.z && t.y >= 0 && t.y < 2 ** t.z));
}
const tiles = [0, 1, 2, 3].map(x => ({ src: 'relief', z: 3, x, y: 3 }));
await provider.ready(tiles);
assert.equal(loads, 4); assert.ok(peak <= 2);
await provider.ready(tiles); assert.equal(loads, 4); assert.equal(renders, 4);
provider.configure({ low: '#334455' }); await provider.ready(tiles);
assert.equal(loads, 4, 'changing palette reuses DEM heights'); assert.equal(renders, 8);
await assert.rejects(provider.ready(tiles, () => true), { name: 'AbortError' });
const offline = createRelief({ load: async () => { throw Error('offline'); } });
await offline.ready(tiles); assert.equal(offline.failedCount(), 4);
assert.equal(offline.get('relief', 3, 0, 3), null);
console.log('relief decoding, lighting, bathymetry, LOD, validation, caching and failure tests passed');
