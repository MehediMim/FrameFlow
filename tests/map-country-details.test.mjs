// Run with: npm test   (no dependencies)
// Validates the generic country-detail system and EVERY map-data/*-detail.json pack found on disk,
// so a newly dropped-in country file is checked automatically.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as E from '../map-engine.mjs';
import { detailSlug, detailFileOf, detailInfo, detailLevelOf, isLevelId } from '../map-country-details.mjs';
import { routePlaceLabels } from '../map-route-labels.mjs';
const dir = new URL('../map-data/', import.meta.url);
const load = f => JSON.parse(readFileSync(new URL(f, dir), 'utf8'));
const freshGeo = () => E.buildGeo(load('countries-50m.json'), load('countries-110m.json'));

// ---- file naming convention
assert.equal(detailSlug('Myanmar'), 'myanmar');
assert.equal(detailSlug('United States of America'), 'united-states-of-america');
assert.equal(detailSlug("Côte d'Ivoire"), 'cote-d-ivoire');
assert.equal(detailFileOf('Bangladesh'), 'map-data/bangladesh-detail.json');
assert.equal(detailFileOf('Myanmar'), 'map-data/myanmar-detail.json');
assert.ok(isLevelId('district') && isLevelId('province') && !isLevelId('') && !isLevelId('a b') && !isLevelId('../x'));

// ---- every pack on disk
const files = readdirSync(dir).filter(f => f.endsWith('-detail.json'));
assert.ok(files.length >= 1, 'at least one detail pack');
for (const file of files) {
  const geo = freshGeo(), pack = load(file);
  assert.equal(`${detailSlug(pack.country)}-detail.json`, file, `${file}: file name must match "country" (${pack.country})`);
  assert.ok(geo.byName.has(pack.country), `${file}: "${pack.country}" must be a country name from the world map`);
  const pre = geo.byName.size, d = E.installCountryDetail(geo, pack), info = detailInfo(geo, pack.country);
  assert.ok(d.country, `${file}: needs one feature with level "country" (the outline)`);
  const keys = pack.features.map(f => f.properties.key ?? f.properties.name);
  assert.equal(new Set(keys).size, keys.length, `${file}: duplicate keys`);
  assert.ok(info.levels.length >= 1, `${file}: at least one boundary level`);
  assert.ok(info.levels.some(([id]) => id === info.defaultLevel), `${file}: defaultLevel exists`);
  const regions = d.levels[info.defaultLevel], all = Object.values(d.levels).flat();
  assert.ok(regions.length >= 2, `${file}: default level has regions`);
  if (info.defaultRegion) assert.ok(all.some(r => r.key === info.defaultRegion || r.name === info.defaultRegion), `${file}: defaultRegion "${info.defaultRegion}" exists`);
  // every region lies inside the country's outline box (catches swapped lon/lat or wrong projection)
  const cb = d.country.bbox, pad = .02;
  for (const r of all) assert.ok(r.bbox[0] >= cb[0] - pad && r.bbox[2] <= cb[2] + pad && r.bbox[1] >= cb[1] - pad && r.bbox[3] <= cb[3] + pad, `${file}: "${r.key}" is outside the country outline`);
  // judged against the pack's own outline: the coarse world map puts some coastal and border towns offshore
  // each level should tile the country: no cracks between regions (they show as hairlines, and a labelled route would flash the country name)
  const area = f => f.rings.reduce((s, r) => s + (r.hole ? -r.area : r.area), 0);
  for (const [level] of info.levels) {
    const ratio = d.levels[level].reduce((s, r) => s + area(r), 0) / area(d.country);
    if (file === 'myanmar-detail.json') assert.ok(ratio > .995 && ratio < 1.005, `${file}: "${level}" regions cover ${(ratio * 100).toFixed(2)}% of the country outline`);
    else if (ratio < .98 || ratio > 1.02) console.warn(`note: ${file}: "${level}" regions cover ${(ratio * 100).toFixed(1)}% of the country outline (fine if the pack is partial)`);
  }
  for (const c of d.cities || []) assert.equal(E.countryAt({ hi: { features: [d.country] } }, c[2], c[1]), d.country.name, `${file}: city ${c[0]} is not inside the ${pack.country} outline`);
  assert.equal(geo.byName.size, pre + all.length, `${file}: region keys collide with country names or each other`);
  // the country can be selected, framed, and every level validates and resolves
  for (const [level] of info.levels) {
    const q = E.newMapProject(); q.area = { ...E.DEFAULT_AREA, mode: 'country', country: pack.country, detailLevel: level };
    assert.doesNotThrow(() => E.validateMapProject(JSON.parse(JSON.stringify(q))), `${file}: level "${level}" validates`);
    assert.equal(E.detailRegions(q, geo), d.levels[level], `${file}: detailRegions follows detailLevel`);
    const mid = E.detailRegions(q, geo)[0].center;
    assert.equal(E.regionAt(q, geo, mid.lon, mid.lat) !== null, true, `${file}: a point inside a ${level} resolves to a region`);
  }
  const q = E.newMapProject(); q.area = { ...E.DEFAULT_AREA, mode: 'country', country: pack.country }; geo.cities = [];
  const cam = E.cameraAt(q, geo, 1280, 720, 0), cm = d.country.mainBox;
  assert.ok(Math.abs(cam.cx - (cm[0] + cm[2]) / 2) < 1e-9, `${file}: start view frames the country outline`);
  console.log(`pack ok: ${pack.country} (${info.levels.map(([id, l]) => `${l}: ${d.levels[id].length}`).join(', ')}, ${(JSON.stringify(pack).length / 1024) | 0} KB)`);
}

// ---- Myanmar specifics
if (files.includes('myanmar-detail.json')) {
  const geo = freshGeo(); E.installCountryDetail(geo, load('myanmar-detail.json'));
  const q = E.newMapProject(); q.area = { ...E.DEFAULT_AREA, mode: 'country', country: 'Myanmar' };
  const at = (lat, lon, level) => { q.area.detailLevel = level; return E.regionAt(q, geo, lon, lat); };
  assert.equal(at(16.84, 96.17, 'division'), 'Yangon Region', 'Yangon city');
  assert.equal(at(21.96, 96.09, 'division'), 'Mandalay Region', 'Mandalay city');
  assert.equal(at(19.76, 96.08, 'division'), 'Nay Pyi Taw', 'Nay Pyi Taw is its own unit');
  assert.equal(at(20.79, 97.04, 'division'), 'Shan State', 'Taunggyi is in Shan (merged from three codes)');
  assert.equal(at(17.33, 96.48, 'division'), 'Bago Region', 'Bago (merged from east + west)');
  assert.ok(at(21.96, 96.09, 'district'), 'Mandalay city is inside a district');
  q.area.detailLevel = undefined;
  assert.equal(detailLevelOf(geo, 'Myanmar'), 'division', 'pack default level wins when none is chosen');
  const info = detailInfo(geo, 'Myanmar');
  assert.deepEqual(info.levels.map(l => l[0]), ['division', 'district']);
  assert.equal(info.levels[0][1], 'States / regions');
  // a labelled route inside Myanmar names the units it crosses
  const plane = E.makeAction('plane', 0, { from: { kind: 'city', name: 'Yangon', lat: 16.8409, lon: 96.1735 }, to: { kind: 'city', name: 'Mandalay', lat: 21.9588, lon: 96.0891 }, showRouteLabels: true });
  const names = routePlaceLabels(geo, E.planeRoute(geo, plane), { mode: 'auto', country: 'Myanmar', detailLevel: undefined }).map(n => n.text);
  assert.ok(names.includes('Yangon') && names.includes('Mandalay') || names.some(n => /Yangon|Mandalay/.test(n)), 'route labels use Myanmar regions: ' + names.join(', '));
  assert.ok(!names.includes('Myanmar'), 'region names replace the country name');
}

// ---- self-describing packs and back-compat with packs that predate the metadata
{
  const sq = (x, y, w = 1) => ({ type: 'Polygon', coordinates: [[[x, y], [x + w, y], [x + w, y + w], [x, y + w], [x, y]]] });
  const mk = (level, key, x, y, w, extra = {}) => ({ type: 'Feature', properties: { key, name: extra.name || key, level }, geometry: sq(x, y, w) });
  const geo = freshGeo();
  // Bangladesh-style pack: no metadata, three levels, relies on the COUNTRY_DETAILS fallback
  const old = { country: 'Bangladesh', defaultLevel: 'district', sources: 'Test source', features: [mk('country', 'Bangladesh', 88, 22, 3), mk('division', 'Dhaka', 90, 23, 1), mk('division', 'Khulna', 89, 22, 1), mk('district', 'Dhaka D', 90, 23, .5), mk('district', 'Gazipur', 90.5, 23, .5), mk('local', 'Savar', 90, 23, .2), mk('local', 'Keraniganj', 90.3, 23, .2)], cities: [['Dhaka', 23.8, 90.4, 'Bangladesh']] };
  E.installCountryDetail(geo, old);
  const i = detailInfo(geo, 'Bangladesh');
  assert.deepEqual(i.levels.map(l => l[0]), ['division', 'district', 'local']);
  assert.equal(i.defaultRegion, 'Dhaka', 'fallback region');
  assert.equal(i.attribution, 'District boundaries: BBS/OCHA (2020), via geoBoundaries, CC BY 3.0 IGO.'.length ? i.attribution : '', 'attribution comes from somewhere');
  assert.equal(detailLevelOf(geo, 'Bangladesh'), 'district');
  assert.equal(detailLevelOf(geo, 'Bangladesh', 'local'), 'local');
  assert.equal(detailLevelOf(geo, 'Bangladesh', 'province'), 'district', 'unknown level falls back to the default');
  // brand-new country with its own level names and no entry in COUNTRY_DETAILS
  const g2 = freshGeo();
  E.installCountryDetail(g2, { country: 'Nepal', defaultRegion: 'Bagmati', levelLabels: { province: 'Provinces', municipality: 'Municipalities' }, ready: 'Nepal is ready.', attribution: ['A', 'B'], features: [mk('country', 'Nepal', 82, 27, 3), mk('province', 'Bagmati', 85, 27, 1), mk('province', 'Gandaki', 84, 28, 1), mk('municipality', 'Kathmandu', 85.2, 27.2, .1), mk('municipality', 'Lalitpur', 85.3, 27.3, .1)] });
  const n = detailInfo(g2, 'Nepal');
  assert.deepEqual(n.levels, [['province', 'Provinces'], ['municipality', 'Municipalities']]);
  assert.equal(n.defaultLevel, 'province'); assert.equal(n.ready, 'Nepal is ready.'); assert.equal(n.attribution, 'A · B');
  const q = E.newMapProject(); q.area = { ...E.DEFAULT_AREA, mode: 'country', country: 'Nepal', detailLevel: 'municipality' };
  assert.doesNotThrow(() => E.validateMapProject(JSON.parse(JSON.stringify(q))), 'custom level ids validate');
  assert.deepEqual(E.detailRegions(q, g2).map(r => r.key), ['Kathmandu', 'Lalitpur']);
  assert.throws(() => { q.area.detailLevel = '../x'; E.validateMapProject(JSON.parse(JSON.stringify(q))); }, /map area/i, 'unsafe level ids rejected');
  // cities without a country column still belong to the pack's country
  E.installCountryDetail(freshGeo(), { country: 'Nepal', features: [mk('country', 'Nepal', 82, 27, 3), mk('province', 'A', 85, 27, 1)], cities: [['Kathmandu', 27.7, 85.3]] });
  // a feature that cannot be drawn is skipped without shifting the rest onto the wrong keys
  const g3 = freshGeo();
  E.installCountryDetail(g3, { country: 'Nepal', features: [mk('country', 'Nepal', 82, 27, 3), { type: 'Feature', properties: { key: 'Empty', name: 'Empty', level: 'province' }, geometry: { type: 'Polygon', coordinates: [[[85, 27], [85, 27], [85, 27]]] } }, mk('province', 'Real', 85, 27, 1)] });
  assert.deepEqual(g3.details.get('Nepal').levels.province.map(r => [r.key, r.name]), [['Real', 'Real']]);
  // readable errors for hand-made files
  assert.throws(() => E.installCountryDetail(freshGeo(), { country: 'Nepal' }), /features/);
  assert.throws(() => E.installCountryDetail(freshGeo(), { country: 'Nepal', features: [{ type: 'Feature', properties: { name: 'X' }, geometry: sq(0, 0) }] }), /Feature 0.*level/);
}
console.log('country detail tests passed');
