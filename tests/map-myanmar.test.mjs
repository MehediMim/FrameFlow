// Run with: node tests/map-myanmar.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../map-engine.mjs';
import { routePlaceLabels } from '../map-route-labels.mjs';
import { COUNTRY_DETAILS, detailCountryFromLoc } from '../map-country-details.mjs';

const load = name => JSON.parse(readFileSync(new URL(`../map-data/${name}`, import.meta.url), 'utf8'));
const raw = load('myanmar-detail.json');
const geo = E.buildGeo(load('countries-50m.json'), load('countries-110m.json'));
const pack = E.installCountryDetail(geo, raw);
E.installCountryDetail(geo, load('bangladesh-detail.json'));
const regions = pack.levels.division;
const place = (name, lon, lat) => ({ kind: 'city', name, lon, lat });
const yangon = place('Yangon', 96.1561, 16.8661);
const mandalay = place('Mandalay', 96.0891, 21.9588);
const naypyitaw = place('Naypyitaw', 96.1297, 19.7633);
const project = level => {
  const p = E.newMapProject();
  Object.assign(p.area, { mode: 'country', country: 'Myanmar', cities: false, name: false });
  if (level !== undefined) p.area.detailLevel = level;
  p.graticule = false;
  return p;
};

// This pack intentionally stops at first-order states/regions, including the
// capital territory. It must not introduce district or township subdivisions.
assert.equal(raw.country, 'Myanmar');
assert.equal(regions.length, 15, 'all first-order areas are available');
assert.equal(pack.levels.district.length, 0);
assert.equal(pack.levels.local.length, 0);
assert.equal(new Set(regions.map(f => f.key)).size, 15, 'region keys are unique');
assert.ok(regions.every(f => f.country === 'Myanmar' && f.level === 'division'));
for (const name of [/Ayeyarwady|Irrawaddy/i, /Bago/i, /Chin/i, /Kachin/i, /Kayah/i, /Kayin|Karen/i, /Magway|Magwe/i, /Mandalay/i, /^Mon\b/i, /Nay\s*Pyi?\s*Taw/i, /Rakhine|Arakan/i, /Sagaing/i, /Shan/i, /Tanintharyi|Tenasserim/i, /Yangon/i]) {
  assert.equal(regions.filter(f => name.test(f.name)).length, 1, `${name} appears once among the states/regions`);
}
assert.ok(raw.sources?.length, 'the bundled boundaries include source attribution');
assert.ok(raw.features.filter(f => f.properties.level === 'country').length <= 1, 'the pack has at most one national outline');
assert.ok(raw.features.every(f => ['country', 'division'].includes(f.properties.level)));
assert.deepEqual(COUNTRY_DETAILS.Myanmar.levels.map(([key]) => key), ['division'], 'Myanmar picker exposes no unavailable deeper levels');
assert.equal(COUNTRY_DETAILS.Myanmar.defaultLevel, 'division');
assert.equal(E.detailLevelOf({}, 'Myanmar', 'local'), 'division', 'saved local selection resolves before the pack loads');
assert.equal(detailCountryFromLoc({ kind: 'region', name: regions[0].key }), 'Myanmar', 'saved region actions identify their detail pack');
assert.equal(detailCountryFromLoc({ kind: 'all', country: 'Myanmar' }), 'Myanmar', 'saved all-regions actions identify their detail pack');
let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
for (const f of raw.features) {
  assert.ok(['Polygon', 'MultiPolygon'].includes(f.geometry.type));
  const polygons = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const polygon of polygons) for (const ring of polygon) {
    assert.ok(ring.length >= 4, `${f.properties.name} has complete rings`);
    assert.deepEqual(ring[0], ring.at(-1), `${f.properties.name} has closed rings`);
    for (const [lon, lat] of ring) {
      assert.ok(Number.isFinite(lon) && Number.isFinite(lat), 'coordinates are finite');
      assert.ok(lon >= 90 && lon <= 103 && lat >= 8 && lat <= 30, 'coordinates use Myanmar longitude/latitude');
      west = Math.min(west, lon); east = Math.max(east, lon);
      south = Math.min(south, lat); north = Math.max(north, lat);
    }
  }
}
assert.ok(west < 93 && east > 100 && south < 11 && north > 28, 'the pack covers the national extent');

// Choosing Myanmar works from a fresh project and from saved Bangladesh
// projects whose selected detail level is more specific than this pack offers.
for (const level of [undefined, 'district', 'local', 'division']) {
  const p = project(level);
  assert.strictEqual(E.detailRegions(p, geo), regions, `level ${level} resolves to available states/regions`);
  assert.equal(E.detailLevelOf(geo, 'Myanmar', level), 'division');
  assert.doesNotThrow(() => E.validateMapProject(p));
}
assert.deepEqual(E.detailRegions(E.newMapProject(), geo), [], 'world mode does not paint detailed regions as countries');
assert.equal(E.detailRegions({ area: { mode: 'country', country: 'Bangladesh', detailLevel: 'district' } }, geo).length, 64, 'Bangladesh keeps its district detail');
for (const level of ['division', 'district', 'local']) assert.equal(E.detailLevelOf(geo, 'Bangladesh', level), level, `Bangladesh preserves its available ${level} selection`);
for (const [city, expected] of [[yangon, /Yangon/i], [mandalay, /Mandalay/i], [naypyitaw, /Nay\s*P(?:yi|y[i]?)\s*Taw/i]]) {
  const key = E.regionAt(project('local'), geo, city.lon, city.lat);
  assert.ok(key, `${city.name} can be picked on the detailed map`);
  assert.match(geo.byName.get(key).name, expected, `${city.name} belongs to the expected region`);
  const loc = E.lonLatOf(geo, { kind: 'region', name: key });
  assert.ok(Number.isFinite(loc?.lon) && Number.isFinite(loc?.lat), 'region actions and camera targets resolve coordinates');
}
const cityNames = E.citiesOf(geo, 'Myanmar').map(c => c[0]);
assert.ok(cityNames.some(n => /Yangon/i.test(n)) && cityNames.some(n => /Mandalay/i.test(n)), 'major cities are available as travel and pin targets');

function recordingCanvas() {
  const commands = [], texts = [], stack = [];
  let state = { globalAlpha: 1, letterSpacing: '0px' }, gradientId = 0;
  const methods = {};
  for (const name of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'fillRect', 'clip', 'arc', 'arcTo', 'ellipse', 'bezierCurveTo', 'quadraticCurveTo', 'roundRect', 'setLineDash', 'translate', 'rotate', 'scale', 'transform', 'strokeText']) {
    methods[name] = (...args) => commands.push([name, ...args]);
  }
  methods.save = () => { stack.push({ ...state }); commands.push(['save']); };
  methods.restore = () => { assert.ok(stack.length); state = stack.pop(); commands.push(['restore']); };
  methods.fillText = (text, ...args) => { texts.push(String(text)); commands.push(['fillText', text, ...args]); };
  methods.measureText = text => ({ width: String(text).length * 8 });
  for (const name of ['createRadialGradient', 'createLinearGradient']) methods[name] = (...args) => {
    const id = gradientId++;
    commands.push([name, id, ...args]);
    return { gradientId: id, addColorStop: (...stop) => commands.push(['addColorStop', id, ...stop]) };
  };
  const ctx = new Proxy({}, {
    has: (_, key) => key in methods || key in state,
    get: (_, key) => {
      if (key in methods) return methods[key];
      if (key in state) return state[key];
      throw Error(`Unimplemented canvas operation: ${String(key)}`);
    },
    set: (_, key, value) => {
      state[key] = value;
      commands.push(['set', key, value && typeof value === 'object' ? { gradientId: value.gradientId } : value]);
      return true;
    },
  });
  return { ctx, commands, texts, stack };
}
function render(p, frame = 80) {
  const result = recordingCanvas();
  E.drawMap(result.ctx, 960, 540, p, frame, geo);
  assert.equal(result.stack.length, 0, 'rendering balances canvas state');
  for (const command of result.commands) for (const value of command.slice(1)) {
    if (typeof value === 'number') assert.ok(Number.isFinite(value), 'rendered coordinates remain finite');
  }
  return result;
}

// Existing highlights, borders and the all-regions sweep use the new pack.
{
  const p = project('district'), base = render(p);
  const count = (r, op) => r.commands.filter(c => c[0] === op).length;
  for (const level of [undefined, 'district', 'local', 'division']) {
    p.actions = [E.makeAction('border', 0, { dur: 160, animDur: 40, glow: false, target: { kind: 'all', country: 'Myanmar', ...(level ? { level } : {}) } })];
    const result = render(p);
    assert.ok(count(result, 'lineTo') > count(base, 'lineTo'), `all-region border sweep finds Myanmar areas with level ${level}`);
  }
  const key = E.regionAt(p, geo, yangon.lon, yangon.lat);
  for (const target of [{ kind: 'country', name: 'Myanmar' }, { kind: 'region', name: key }]) {
    for (const type of ['highlight', 'border']) {
      p.actions = [E.makeAction(type, 0, { dur: 160, animDur: 40, target, pulse: false })];
      assert.doesNotThrow(() => E.validateMapProject(p));
      assert.notDeepEqual(render(p).commands, base.commands, `${type} draws its ${target.kind} target`);
    }
  }
}

// Route labels discover intermediate states and appear only after entry. The
// default district level must resolve to Myanmar's available first-order areas.
{
  const p = project('local');
  const a = E.makeAction('plane', 20, { dur: 160, animDur: 100, easing: 'linear', from: yangon, to: mandalay, lift: 0, showLabels: false, showRouteLabels: true });
  p.actions = [a];
  const route = E.planeRoute(geo, a);
  for (const mode of ['auto', 'region']) {
    const labels = routePlaceLabels(geo, route, { mode, country: 'Myanmar', detailLevel: 'district' });
    assert.ok(labels.length >= 3, 'intermediate areas are discovered without explicit waypoints');
    assert.match(labels[0].text, /Yangon/i);
    assert.match(labels.at(-1).text, /Mandalay/i);
    assert.ok(labels.every(l => l.key.startsWith('region:Myanmar:') && Number.isFinite(l.enterS)), 'available states supply route names');
    assert.equal(labels[0].enterS, 0, 'departure area is reached immediately');
    a.routeLabelMode = mode;
    const names = frame => render(p, frame).texts;
    assert.deepEqual(names(19), [], 'travel-owned names are hidden before the clip');
    assert.deepEqual(names(20), [labels[0].text], 'future regions are hidden at departure');
    for (const label of labels.slice(1)) {
      const entryFrame = a.start + label.enterS * a.animDur;
      assert.ok(!names(entryFrame - .001).includes(label.text), `${label.text} stays hidden before entry`);
      assert.ok(names(entryFrame + .001).includes(label.text), `${label.text} appears on entry`);
    }
    assert.deepEqual(new Set(names(150)), new Set(labels.map(l => l.text)), 'visited names hold inside the timeline clip');
    assert.deepEqual(names(180), [], 'all route names disappear at the clip end');
  }
  const countryNames = routePlaceLabels(geo, route, { mode: 'country' }).map(l => l.text);
  assert.deepEqual(countryNames, ['Myanmar'], 'country labels remain independently available');
}

// World travel resolves each loaded pack's level independently. A Myanmar
// state-only pack must not force Bangladesh to abandon its district detail.
{
  const a = E.makeAction('plane', 0, { from: yangon, to: place('Dhaka', 90.411145, 23.711525) });
  const labels = routePlaceLabels(geo, E.planeRoute(geo, a), { mode: 'region', detailLevel: 'district' });
  assert.ok(labels.some(l => l.key.startsWith('region:Myanmar:')), 'world routes include Myanmar states');
  assert.ok(labels.some(l => l.key.startsWith('region:Bangladesh:') && /Dhaka/i.test(l.text)), 'world routes preserve Bangladesh districts');
}

console.log('map Myanmar tests passed');
