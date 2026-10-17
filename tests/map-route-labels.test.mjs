import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { routePlaceLabels } from '../map-route-labels.mjs';
import { buildGeo, installCountryDetail, makeAction, planeRoute } from '../map-engine.mjs';

const ring = (points, hole = false) => ({ xy: new Float64Array(points.flat()), n: points.length, hole });
const rect = (left, top, right, bottom, hole = false) => ring([
  [left, top], [right, top], [right, bottom], [left, bottom], [left, top],
], hole);
const feature = (name, left, top, right, bottom, extra = {}) => ({ name, rings: [rect(left, top, right, bottom)], ...extra });
const route = (...points) => ({ n: points.length, X: Float64Array.from(points, p => p[0]), Y: Float64Array.from(points, p => p[1]) });
const names = labels => labels.map(l => l.text);
const world = (...features) => ({ hi: { features }, details: new Map() });
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} should equal ${b}`);

// Exact boundary intersections discover an intermediate sliver even when the
// route only has two points. Water is never given the neighboring country's name.
{
  const geo = world(feature('West', .1, .4, .2, .6), feature('Sliver', .40001, .4, .40002, .6), feature('East', .7, .4, .9, .6));
  const r = route([.15, .5], [.8, .5]), labels = routePlaceLabels(geo, r, { mode: 'country' });
  assert.deepEqual(names(labels), ['West', 'Sliver', 'East']);
  close(labels[1].X, .400015);
  close(labels[1].enterS, (.40001 - .15) / .65);
  for (const label of labels) {
    close(label.X, .15 + label.s * .65);
    assert.ok(label.enterS <= label.s && label.s <= 1);
  }
  assert.deepEqual(routePlaceLabels(geo, route([.25, .5], [.3, .5])), []);
}

// Auto/region use loaded detail at the requested level and preserve country
// fallback abroad. A selected country limits which packs supply region names.
{
  const geo = world(feature('Home', .1, .4, .5, .6), feature('Away', .5, .4, .9, .6));
  const r = route([.15, .5], [.85, .5]);
  const initial = routePlaceLabels(geo, r);
  assert.deepEqual(names(initial), ['Home', 'Away']);
  geo.details.set('Home', { levels: {
    district: [feature('North', .1, .4, .3, .6, { key: 'north' }), feature('South', .3, .4, .5, .6, { key: 'south' })],
    division: [feature('Central', .1, .4, .5, .6)],
  } });
  const loaded = routePlaceLabels(geo, r);
  assert.notStrictEqual(loaded, initial, 'late detail loading invalidates cached country names');
  assert.deepEqual(names(loaded), ['North', 'South', 'Away']);
  assert.strictEqual(routePlaceLabels(geo, r), loaded, 'unchanged frames reuse cached discoveries');
  assert.deepEqual(names(routePlaceLabels(geo, r, { mode: 'region', detailLevel: 'division' })), ['Central', 'Away']);
  assert.deepEqual(names(routePlaceLabels(geo, r, { mode: 'country' })), ['Home', 'Away']);
  assert.deepEqual(names(routePlaceLabels(geo, r, { country: 'Unknown' })), ['Home', 'Away']);
  geo.details.set('Away', { levels: { district: [feature('Overseas', .5, .4, .9, .6)] } });
  assert.deepEqual(names(routePlaceLabels(geo, r)), ['North', 'South', 'Overseas']);
  assert.deepEqual(names(routePlaceLabels(geo, r, { country: 'Home' })), ['North', 'South', 'Away']);
  geo.details.get('Home').levels.district = [feature('Replacement', .1, .4, .5, .6)];
  assert.deepEqual(names(routePlaceLabels(geo, r, { country: 'Home' })), ['Replacement', 'Away']);
}

// A hole belongs to its own polygon. Overlapping outer rings form a union;
// holes from another polygon must not subtract a valid island inside the lake.
{
  const land = { name: 'Island country', rings: [rect(.1, .1, .5, .9), rect(.2, .2, .4, .8, true), rect(.25, .3, .35, .7)] };
  const geo = world(land);
  assert.deepEqual(names(routePlaceLabels(geo, route([.26, .5], [.34, .5]))), ['Island country']);
  assert.deepEqual(routePlaceLabels(geo, route([.21, .5], [.24, .5])), []);
  const overlapping = { name: 'Union', rings: [rect(.1, .1, .4, .9), rect(.3, .1, .6, .9)] };
  assert.deepEqual(names(routePlaceLabels(world(overlapping), route([.32, .5], [.38, .5]))), ['Union']);
  const overlappingLakes = { name: 'Lakes', rings: [rect(.1, .1, .6, .9), rect(.2, .2, .4, .8, true), rect(.3, .2, .5, .8, true)] };
  assert.deepEqual(routePlaceLabels(world(overlappingLakes), route([.32, .5], [.38, .5])), [], 'overlapping holes remain water');
  const lakeRoute = route([.15, .5], [.45, .5]);
  const label = routePlaceLabels(geo, lakeRoute)[0];
  assert.ok(label.X < .2 || label.X > .4 || (label.X >= .25 && label.X <= .35), 'representative label stays on a visited land stretch');
}

// Geometry and route coordinates can use different world copies at the date
// line. Holes are independently unwrapped, as they are by buildGeo.
{
  const crossing = { name: 'Dateline', rings: [rect(.97, .4, 1.03, .6), rect(-.01, .45, .01, .55, true)] };
  const geo = world(crossing, feature('Next', .04, .4, .08, .6));
  const labels = routePlaceLabels(geo, route([.98, .42], [1.07, .42]));
  assert.deepEqual(names(labels), ['Dateline', 'Next']);
  assert.ok(labels[0].X > .98 && labels[1].X > 1, 'labels retain the route world copy');
  assert.deepEqual(routePlaceLabels(geo, route([.995, .5], [1.005, .5])), [], 'wrapped lake remains water');
  assert.deepEqual(names(routePlaceLabels(geo, route([-1.02, .42], [-.93, .42]))), ['Dateline', 'Next']);
}

// Revisiting a country gives one stable label on its longest continuous stay.
// Its reveal point is the first entry, even if the representative stay is later.
{
  const geo = world(feature('West', .1, .4, .3, .6), feature('East', .3, .4, .7, .6));
  const r = route([.29, .5], [.4, .5], [.15, .5]);
  const labels = routePlaceLabels(geo, r), west = labels.find(l => l.text === 'West');
  assert.equal(labels.length, 2);
  assert.equal(west.enterS, 0);
  assert.ok(west.s > .5, 'the longer return visit positions the West label');
  assert.strictEqual(routePlaceLabels(geo, r), labels);
  r.X[1] = .25;
  assert.deepEqual(names(routePlaceLabels(geo, r)), ['West'], 'in-place waypoint edits invalidate the cache');
  geo.hi.features = [feature('New map', .1, .4, .9, .6)];
  assert.deepEqual(names(routePlaceLabels(geo, r)), ['New map'], 'replacing geometry invalidates the cache');
  geo.hi.features[0].rings = [rect(.4, .4, .9, .6)];
  assert.deepEqual(routePlaceLabels(geo, r), [], 'replacing rings invalidates the geometry cache');
  geo.hi.features.push(feature('Inserted', .1, .4, .3, .6));
  assert.deepEqual(names(routePlaceLabels(geo, r)), ['Inserted'], 'inserting into a geometry array invalidates cached discoveries');
}

// Borders have deterministic ownership, and a country at an endpoint is still
// represented when the rest of the route lies over water.
{
  const geo = world(feature('First', .1, .4, .3, .6), feature('Second', .3, .4, .5, .6));
  assert.deepEqual(names(routePlaceLabels(geo, route([.3, .42], [.3, .58]))), ['First']);
  const endpoint = routePlaceLabels(geo, route([.1, .5], [.05, .5]));
  assert.deepEqual(names(endpoint), ['First']);
  assert.equal(endpoint[0].s, 0);
  assert.deepEqual(names(routePlaceLabels(geo, route([.2, .5], [.2, .5]))), ['First']);
  assert.deepEqual(routePlaceLabels(geo, null), []);
  assert.deepEqual(routePlaceLabels(geo, route([NaN, .5], [.2, .5])), []);
}

// Real Bangladesh detail: a direct flight crosses administrative regions even
// though none were supplied as explicit waypoints.
{
  const load = name => JSON.parse(readFileSync(new URL(`../map-data/${name}`, import.meta.url), 'utf8'));
  const geo = buildGeo(load('countries-50m.json'));
  installCountryDetail(geo, load('bangladesh-detail.json'));
  const a = makeAction('plane', 0, {
    from: { kind: 'city', name: 'Dhaka', lon: 90.411145, lat: 23.711525 },
    to: { kind: 'city', name: 'Chattogram', lon: 91.7832, lat: 22.3569 },
  });
  const r = planeRoute(geo, a), labels = routePlaceLabels(geo, r, { mode: 'region', country: 'Bangladesh' });
  assert.ok(labels.some(l => /Dhaka/i.test(l.text)), 'departure district is found');
  assert.ok(labels.some(l => /Chattogram|Chittagong/i.test(l.text)), 'arrival district is found');
  assert.ok(labels.length >= 3, 'intermediate districts are found');
  assert.equal(new Set(labels.map(l => l.key)).size, labels.length, 'repeated districts are labeled once');
  assert.ok(labels.every(l => Number.isFinite(l.X) && Number.isFinite(l.Y) && l.s >= 0 && l.s <= 1));
  assert.deepEqual(names(routePlaceLabels(geo, r, { mode: 'country' })), ['Bangladesh']);
}

console.log('map route label tests passed');
