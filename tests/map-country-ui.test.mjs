import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { COUNTRY_DETAILS, detailCountryFromLoc, detailLevelOf } from '../map-country-details.mjs';
import { areaOf, detailRegions, installCountryDetail } from '../map-engine.mjs';

// Exercise the editor's actual helpers without starting the browser editor.
const source = await readFile(new URL('../map-ui.js', import.meta.url), 'utf8');
const dataHelpers = source.slice(source.indexOf('const detailLoads ='), source.indexOf('// ------------------------------------------------------------------ drawing + playback'));
const settings = source.slice(source.indexOf('function renderAreaSettings()'), source.indexOf('function bindSettings()'));
const renderAll = source.match(/^function renderAll\(\).*$/m)[0];
const ring = [[95, 18], [97, 18], [97, 21], [95, 21], [95, 18]];
const region = (country, name, level) => ({ type: 'Feature', properties: { key: `${country} / ${name} / ${level}`, name, level }, geometry: { type: 'Polygon', coordinates: [ring] } });
const packs = {
  Bangladesh: { country: 'Bangladesh', defaultLevel: 'district', cities: [['Dhaka', 23.8, 90.4, 'Bangladesh']], features: ['division', 'district', 'local'].map(level => region('Bangladesh', 'Dhaka', level)) },
  Myanmar: { country: 'Myanmar', defaultLevel: 'division', cities: [['Yangon', 16.8, 96.1, 'Myanmar'], ['Mandalay', 21.9, 96.1, 'Myanmar']], features: [region('Myanmar', 'Yangon', 'division'), region('Myanmar', 'Mandalay', 'division')] },
};

function editor({ country = 'Myanmar', mode = 'country', detailLevel = 'district', actions = [], failures = [] } = {}) {
  const nodes = new Map(), calls = [], messages = [], fail = new Set(failures);
  function node(id) {
    let html = '';
    const el = {
      value: '', hidden: false, disabled: false, textContent: '', checked: false,
      get innerHTML() { return html; },
      set innerHTML(value) { html = value; },
      get options() { return [...html.matchAll(/<option value="([^"]*)"/g)].map(match => ({ value: match[1] })); },
      insertAdjacentHTML(where, value) {
        for (const match of value.matchAll(/id="([^"]+)"/g)) node(match[1]);
        html = where === 'afterbegin' ? value + html : html + value;
      },
    };
    nodes.set('#' + id, el); return el;
  }
  for (const id of ['mDlBorder', 'mDlCountry', 'mDlPlace', 'mDlAny', 'mAreaCountry', 'mAreaMode', 'mAreaBox', 'mAreaNeighbors', 'mAreaFit', 'mAreaName', 'mAreaCities', 'mAreaPad', 'mAreaPadValue', 'mRegion', 'mStartZoom', 'mAreaNote']) node(id);
  let renders = 0;
  const state = vm.createContext({
    COUNTRY_DETAILS, detailCountryFromLoc, detailLevelOf, areaOf, detailRegions, installCountryDetail,
    proj: { area: { mode, country, detailLevel }, actions, shots: [] },
    geo: { details: new Map(), byName: new Map(), names: ['Bangladesh', 'Myanmar', 'India'] },
    CITIES: [['Global city', 20, 78, 'India'], ['Yangon', 16.8, 96.1, 'Myanmar']],
    $: selector => nodes.get(selector) || null,
    esc: value => String(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;'),
    fetch: async file => {
      const name = Object.keys(COUNTRY_DETAILS).find(name => COUNTRY_DETAILS[name].file === file);
      calls.push(name);
      return fail.has(name) ? { ok: false, status: 503 } : { ok: true, json: async () => structuredClone(packs[name]) };
    },
    notify: message => messages.push(message),
    renderSettings: () => { renders++; assert.ok(renders < 30, 'detail rendering should not loop'); state.renderAreaSettings(); },
    renderItems() {}, renderInspector() {}, renderTimeline() {}, setFrame() {}, updateHistory() {}, pause() {}, checkpoint() {}, saveLocal() {},
    frame: 0, pathDraw: null, pathDrag: null, canvas: { style: {} },
  });
  vm.runInContext(dataHelpers + settings + renderAll + '\nglobalThis.api = { ensureDetail, detailCountry, requiredDetailCountries, neededDetailCountries, localCities, defaultRegion, parseLoc, buildLists, detailLoads, detailErrors };', state);
  return { state, api: state.api, nodes, calls, messages, fail, get renders() { return renders; } };
}

{
  const e = editor();
  assert.equal(await e.api.ensureDetail(), true);
  assert.deepEqual(e.calls, ['Myanmar']);
  assert.equal(e.api.detailCountry(), 'Myanmar');
  assert.equal(e.nodes.get('#mDetailLevel').value, 'division');
  assert.equal(e.nodes.get('#mDetailLevel').options.length, 1);
  assert.match(e.nodes.get('#mDetailLevel').innerHTML, /States \/ regions/);
  assert.equal(e.nodes.get('#mDetailLevel').disabled, true);
  assert.deepEqual(Array.from(e.api.localCities(), city => city[0]), ['Yangon', 'Mandalay']);
  assert.equal(e.api.defaultRegion().name, 'Myanmar / Yangon / division');
  assert.equal(e.api.parseLoc('Yangon', 'country').kind, 'region');
  assert.equal(e.api.parseLoc('Mandalay', 'place').kind, 'city');
  for (const text of ['All regions', 'all']) {
    const target = e.api.parseLoc(text, 'border');
    assert.equal(target.country, 'Myanmar');
    assert.equal(target.level, 'division');
  }
  assert.match(e.nodes.get('#mDlBorder').innerHTML, /Myanmar \/ Yangon \/ division/);
  assert.match(e.nodes.get('#mDlBorder').innerHTML, /States \/ regions/);

  e.state.proj.area.country = 'Bangladesh';
  assert.equal(await e.api.ensureDetail(), true);
  assert.equal(e.nodes.get('#mDetailLevel').value, 'district');
  assert.equal(e.nodes.get('#mDetailLevel').options.length, 3);
  assert.equal(e.nodes.get('#mDetailLevel').disabled, false);
  assert.deepEqual(Array.from(e.api.localCities(), city => city[0]), ['Dhaka']);
  assert.equal(e.api.parseLoc('all', 'border').level, 'district');

  e.state.proj.area.country = 'Myanmar'; e.state.renderAll();
  assert.equal(e.nodes.get('#mDetailLevel').value, 'division');
  assert.equal(e.state.proj.area.detailLevel, 'district', 'visiting Myanmar preserves the Bangladesh preference');
  e.state.proj.area.country = 'India'; e.state.renderAll();
  assert.equal(e.nodes.get('#mDetailLabel').hidden, true);
  assert.match(e.nodes.get('#mDetailStatus').textContent, /country outline/);
  assert.equal(e.api.parseLoc('all', 'border').country, undefined);
}

{
  const e = editor({ mode: 'world', actions: [{ type: 'highlight', target: { kind: 'region', name: 'Myanmar / Yangon / division' } }] });
  assert.deepEqual(Array.from(e.api.requiredDetailCountries()), ['Myanmar']);
  assert.equal(await e.api.ensureDetail(), true);
  assert.deepEqual(e.calls, ['Myanmar']);
  assert.equal(e.api.detailCountry(), null);
  assert.deepEqual(Array.from(e.api.localCities(), city => city[0]), ['Global city', 'Yangon']);
}

{
  const e = editor({ mode: 'world', actions: [{ type: 'plane', showRouteLabels: true, routeLabelMode: 'region' }], failures: ['Myanmar'] });
  assert.deepEqual(Array.from(e.api.neededDetailCountries()), ['Bangladesh', 'Myanmar']);
  const results = await Promise.all([e.api.ensureDetail(), e.api.ensureDetail()]);
  assert.deepEqual(results, [true, true], 'optional regional labels may fall back to country names');
  assert.deepEqual(e.calls.sort(), ['Bangladesh', 'Myanmar'], 'concurrent requests share each pack load');
  for (let i = 0; i < 3; i++) { e.state.renderAll(); assert.equal(await e.api.ensureDetail(), true); }
  assert.equal(e.calls.length, 2, 'failed detail stays cached during rendering');
  assert.equal(e.nodes.get('#mAreaBox').hidden, true);
  assert.equal(e.nodes.get('#mDetailRetry').hidden, false, 'world routes can retry optional detail');

  e.state.proj.actions.push({ type: 'border', target: { kind: 'all', country: 'Myanmar', level: 'district' } });
  assert.equal(await e.api.ensureDetail(), false, 'saved regional items require their data before export');
  e.fail.delete('Myanmar');
  e.nodes.get('#mDetailRetry').onclick();
  assert.equal(await e.api.ensureDetail(), true);
  assert.equal(e.calls.filter(name => name === 'Myanmar').length, 2);
  assert.equal(e.nodes.get('#mDetailRetry').hidden, true);
}

{
  const e = editor({ failures: ['Myanmar'] });
  assert.equal(await e.api.ensureDetail(), false, 'the selected detailed country requires its pack');
  assert.match(e.nodes.get('#mDetailStatus').textContent, /map-data\/myanmar-detail.json/);
  assert.equal(e.nodes.get('#mDetailRetry').textContent, 'Retry Myanmar detail');
}

console.log('Map country UI tests passed');
