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

// country maps + travel along a drawn path
{
  const { CITIES } = await import('../map-places.mjs');
  geo.cities = CITIES;
  const q = E.newMapProject();
  assert.equal(E.areaOf(q).mode, 'world', 'world map by default');
  q.area = { ...E.DEFAULT_AREA, mode: 'country', country: 'Bangladesh' };
  assert.doesNotThrow(() => E.validateMapProject(JSON.parse(JSON.stringify(q))), 'country area validates');
  const c0 = E.cameraAt(q, geo, 1280, 720, 0), bd = geo.byName.get('Bangladesh').mainBox;
  assert.ok(Math.abs(c0.cx - (bd[0] + bd[2]) / 2) < 1e-9 && c0.zoom > 5, 'start view frames the country');
  const us = E.makeAction('border', 0), usProj = E.newMapProject(); usProj.area = { ...E.DEFAULT_AREA, mode: 'country', country: 'United States of America' };
  assert.ok(E.cameraAt(usProj, geo, 1280, 720, 0).zoom > 2.5, 'USA frame ignores Alaska');
  assert.ok(E.citiesOf(geo, 'United States of America').length > 3 && E.citiesOf(geo, 'Bangladesh').length === 9, 'cities match map names');
  for (const bad of [{ mode: 'moon' }, { country: '' }, { neighbors: 'x' }, { pad: 2 }, { fit: 'yes' }]) { const z = JSON.parse(JSON.stringify(q)); Object.assign(z.area, bad); assert.throws(() => E.validateMapProject(z), /map area/i); }

  const bus = E.makeAction('plane', 0, { mode: 'path', icon: 'bus', path: [{ lat: 23.8, lon: 90.4 }, { lat: 24.9, lon: 91.9 }, { lat: 22.4, lon: 91.8 }] });
  const r = E.planeRoute(geo, bus);
  assert.ok(r && r.wpIdx.length === 3 && r.n > 50, 'path route through three points');
  assert.ok(Math.abs(r.X[r.wpIdx[1]] - E.lonToX(91.9)) < 1e-9, 'smooth path passes through its points');
  bus.curve = 'straight'; assert.ok(E.planeRoute(geo, bus).total > 0);
  assert.equal(E.planeRoute(geo, { ...bus, id: 'x', path: [{ lat: 1, lon: 1 }] }), null, 'one point is not a route');
  const wrap = E.planeRoute(geo, E.makeAction('plane', 0, { mode: 'path', path: [{ lat: 35, lon: 140 }, { lat: 50, lon: -170 }, { lat: 37, lon: -122 }] }));
  assert.ok(Math.max(...wrap.X) - Math.min(...wrap.X) < .5, 'path crosses the date line the short way');
  const z = E.newMapProject(); z.actions.push(bus); assert.doesNotThrow(() => E.validateMapProject(JSON.parse(JSON.stringify(z))));
  for (const b of [{ path: [{ lat: 99, lon: 0 }] }, { path: 'x' }, { curve: 'zigzag' }, { mode: 'swim' }]) { const y = JSON.parse(JSON.stringify(z)); Object.assign(y.actions[0], b); assert.throws(() => E.validateMapProject(y)); }
}
console.log('country map + path travel tests passed');
