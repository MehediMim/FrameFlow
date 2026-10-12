// Run with: npm test   (no dependencies; checks camera, projection, routes and validation)
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../map-engine.mjs';
const load = f => JSON.parse(readFileSync(new URL('../map-data/' + f, import.meta.url), 'utf8'));
const geo = E.buildGeo(load('countries-50m.json'), load('countries-110m.json'));

assert.ok(geo.byName.has('Brazil') && geo.names.length > 200, 'countries loaded');
assert.equal(E.countryAt(geo, -47, -15), 'Brazil');
assert.equal(E.countryAt(geo, -30, 0), null);

// projection round trip (flat and tilted/rotated)
for (const cam of [{ zoom: 3, pitch: 0, bearing: 0 }, { zoom: 4, pitch: 50, bearing: 30 }]) {
  const v = E.makeView({ cx: E.lonToX(10), cy: E.latToY(45), ...cam }, 1280, 720);
  const p = E.project(v, E.lonToX(14), E.latToY(47)), back = E.screenToLonLat(v, p.x, p.y);
  assert.ok(Math.abs(back.lon - 14) < 1e-6 && Math.abs(back.lat - 47) < 1e-6, 'screen round trip');
}

// camera chain: starts at the start view, ends on the target
const p = E.demoMapProject();
const start = E.cameraAt(p, geo, 1280, 720, 0);
assert.equal(start.zoom, p.camera.init.zoom);
const swoop = p.shots.find(s => s.preset === 'swoop'), end = E.cameraAt(p, geo, 1280, 720, swoop.start + swoop.dur);
assert.ok(Math.abs(end.zoom - swoop.zoom) < 1e-6 && Math.abs(end.pitch - swoop.pitch) < 1e-6);

// plane route: great circle ends at both places, takes the short way across the date line
const plane = E.makeAction('plane', 0, { from: { kind: 'city', name: 'Tokyo', lat: 35.7, lon: 139.7 }, to: { kind: 'city', name: 'Los Angeles', lat: 34, lon: -118.2 } });
const r = E.planeRoute(geo, plane);
assert.ok(Math.abs(r.X[r.n - 1] - r.X[0]) < .5, 'crosses the Pacific, not the whole world');

// validation
E.validateMapProject(JSON.parse(JSON.stringify(p)));
assert.throws(() => E.validateMapProject({ version: 1, layers: [] }));
console.log('map engine tests passed');

// label styles and travel icons
{
  const q = E.demoMapProject();
  assert.equal(E.labelStyleOf(q).font, 'Arial', 'default label style');
  assert.equal(E.labelStyleOf(q, { labelStyle: { font: 'Lobster', size: 20 } }).size, 20, 'item override wins');
  q.labelStyle = { ...E.DEFAULT_LABEL_STYLE, font: 'Hind Siliguri', shape: 'tag' };
  const plane = q.actions.find(a => a.type === 'plane'); plane.icon = 'bus'; plane.symbol = '৳'; plane.fromLabel = 'ঢাকা'; plane.labelStyle = { caps: true, spacing: 8 };
  assert.doesNotThrow(() => E.validateMapProject(JSON.parse(JSON.stringify(q))), 'styled project validates');
  assert.deepEqual(E.mapFontsUsed(q), ['Hind Siliguri']);
  for (const bad of [{ shape: 'blob' }, { size: 500 }, { text: 'red' }, { weight: 555 }, { font: 'x'.repeat(61) }]) { const z = JSON.parse(JSON.stringify(q)); z.labelStyle = { ...z.labelStyle, ...bad }; assert.throws(() => E.validateMapProject(z), /label style/i); }
  const z = JSON.parse(JSON.stringify(q)); z.actions.find(a => a.type === 'plane').icon = 'ufo'; assert.throws(() => E.validateMapProject(z), /travel icon/i);
  assert.equal(Object.keys(E.TRAVEL_ICONS).length, 10, 'ten icons');
  assert.doesNotThrow(() => E.validateMapProject(E.newMapProject()), 'new project validates');
}
console.log('label style + icon tests passed');
