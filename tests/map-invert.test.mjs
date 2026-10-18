// Run with: node tests/map-invert.test.mjs   (Invert option: highlight and border grow, played backwards)
import assert from 'node:assert/strict';
const E = await import(process.env.ENGINE || '../map-engine.mjs');

const topo = { type: 'Topology', transform: { scale: [1, 1], translate: [0, 40] }, arcs: [[[0, 0], [10, 0], [0, 10], [-10, 0], [0, -10]]], objects: { countries: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', properties: { name: 'Testland' }, arcs: [[0]] }] } } };
const geo = E.buildGeo(topo, topo);

function render(action, frame) {
  const log = [], state = {};
  const ctx = new Proxy({}, {
    get(_, p) {
      if (p in state) return state[p];
      if (p === 'measureText') return t => ({ width: String(t).length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (/^create/.test(p)) return () => ({ addColorStop() {} });
      return (...args) => { log.push({ op: p, args, fill: state.fillStyle, stroke: state.strokeStyle, ga: state.globalAlpha }); };
    },
    set(_, p, v) { state[p] = v; return true; },
  });
  const proj = E.newMapProject(); proj.frames = 300; proj.camera.init = { lon: 5, lat: 45, zoom: 4, bearing: 0, pitch: 0 }; proj.actions = [action];
  E.drawMap(ctx, proj.width, proj.height, proj, frame, geo);
  return log;
}
const START = 10, ANIM = 40;
const mk = (type, extra) => E.makeAction(type, START, { dur: 100, animDur: ANIM, easing: 'linear', ...extra });
const dimAlphas = log => log.filter(l => l.op === 'fillRect' && l.fill === E.THEMES.earth.dim).map(l => l.ga);
const fillAlphas = (log, color) => log.filter(l => l.op === 'fill' && l.fill === color).map(l => l.ga);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const cases = {
  'highlight (country)': () => mk('highlight', { target: { kind: 'country', name: 'Testland' }, dim: .5, pulse: false, showLabel: true, color: '#ffb703' }),
  'highlight (place)': () => mk('highlight', { target: { kind: 'city', name: 'Paris', lat: 48.8, lon: 2.3 }, dim: .5, pulse: false, showLabel: true, color: '#ffb703' }),
  'border': () => mk('border', { target: { kind: 'country', name: 'Testland' }, fillAlpha: .3, color: '#e4572e' }),
};

for (const [name, make] of Object.entries(cases)) {
  const normal = make(), inverted = { ...make(), invert: true };
  // exact time reversal: k frames into the normal grow == k frames before the end of the inverted one
  for (const k of [0, 5, 16, 28, 40]) {
    assert.ok(same(render(normal, START + k), render(inverted, START + ANIM - k)), `${name}: inverted frame mirrors the normal animation (k=${k})`);
  }
  assert.ok(!same(render(normal, START + 10), render(inverted, START + 10)), `${name}: invert changes the picture`);
  // after the animation the grown shape stays for a normal item, and is gone for an inverted one
  assert.ok(!same(render(normal, START + 60), render(inverted, START + 60)), `${name}: ends differently`);
}

// concrete checks on the dim and fill, so "starts full, ends empty" is explicit
{
  const hl = cases['highlight (country)'](), inv = { ...hl, invert: true };
  assert.equal(Math.max(...dimAlphas(render(hl, START))), 0, 'normal highlight starts undimmed');
  assert.ok(Math.abs(Math.max(...dimAlphas(render(hl, START + ANIM))) - .5) < 1e-9, 'normal highlight ends fully dimmed');
  assert.ok(Math.abs(Math.max(...dimAlphas(render(inv, START))) - .5) < 1e-9, 'inverted highlight starts fully shown');
  assert.equal(Math.max(...dimAlphas(render(inv, START + ANIM))), 0, 'inverted highlight ends empty');
  const b = cases.border(), ib = { ...b, invert: true };
  assert.equal(fillAlphas(render(b, START), '#e4572e').length, 0, 'normal border starts unfilled');
  assert.ok(Math.abs(Math.max(...fillAlphas(render(b, START + ANIM), '#e4572e')) - .3) < 1e-9, 'normal border ends filled');
  assert.ok(Math.abs(Math.max(...fillAlphas(render(ib, START), '#e4572e')) - .3) < 1e-9, 'inverted border starts fully drawn and filled');
  assert.equal(fillAlphas(render(ib, START + ANIM), '#e4572e').length, 0, 'inverted border ends empty');
}

// "Overshoot" easing exceeds 1: the inverted value must never go negative
for (const type of ['highlight', 'border']) {
  const a = { ...cases[type === 'highlight' ? 'highlight (place)' : 'border'](), easing: 'backOut', invert: true };
  for (let f = START; f <= START + 60; f++) for (const x of dimAlphas(render(a, f))) assert.ok(x >= 0, `${type}: no negative alpha at frame ${f}`);
}

// validation and older projects
{
  const ok = a => E.validateMapProject(JSON.parse(JSON.stringify({ ...E.newMapProject(), actions: [a] })));
  ok(E.makeAction('border', 0)); ok(E.makeAction('highlight', 0));
  const old = E.makeAction('border', 0); delete old.invert; ok(old); // saved before Invert existed
  ok({ ...E.makeAction('highlight', 0), invert: true });
  assert.throws(() => ok({ ...E.makeAction('border', 0), invert: 'yes' }), /invert/i);
  assert.throws(() => ok({ ...E.makeAction('highlight', 0), invert: 1 }), /invert/i);
}
console.log('invert tests passed');
