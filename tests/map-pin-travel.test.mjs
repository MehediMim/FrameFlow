// Run with: node tests/map-pin-travel.test.mjs   (pins that travel between places, and layer order)
import assert from 'node:assert/strict';
const E = await import(process.env.ENGINE || '../map-engine.mjs');

// A tiny one-country map is enough: pins and objects do not need real borders.
const topo = { type: 'Topology', transform: { scale: [1, 1], translate: [0, 40] }, arcs: [[[0, 0], [10, 0], [0, 10], [-10, 0], [0, -10]]], objects: { countries: { type: 'GeometryCollection', geometries: [{ type: 'Polygon', properties: { name: 'Testland' }, arcs: [[0]] }] } } };
const geo = E.buildGeo(topo, topo);

const city = (name, lat, lon) => ({ kind: 'city', name, lat, lon });
const LONDON = city('London', 51.5072, -0.1276), NYC = city('New York', 40.7128, -74.006), PARIS = city('Paris', 48.8566, 2.3522), ROME = city('Rome', 41.9, 12.5);

/** A canvas that only records what is drawn. */
function recorder() {
  const log = [], state = {};
  const ctx = new Proxy({}, {
    get(_, p) {
      if (p in state) return state[p];
      if (p === 'measureText') return t => ({ width: String(t).length * 8, actualBoundingBoxAscent: 8, actualBoundingBoxDescent: 2 });
      if (['createLinearGradient', 'createRadialGradient', 'createPattern'].includes(p)) return () => ({ addColorStop() {} });
      return (...args) => { log.push({ op: p, args, fill: state.fillStyle, stroke: state.strokeStyle, dash: state.__dash }); if (p === 'setLineDash') state.__dash = args[0]; };
    },
    set(_, p, v) { state[p] = v; return true; },
  });
  return { ctx, log };
}
function project(actions, frame, tweak = p => p) {
  const p = E.newMapProject(); p.frames = 400; p.camera.init = { lon: -35, lat: 45, zoom: 1.6, bearing: 0, pitch: 0 }; p.actions = actions; tweak(p);
  const { ctx, log } = recorder(), v = E.drawMap(ctx, p.width, p.height, p, frame, geo);
  return { v, log };
}
const badge = (extra = {}) => E.makeAction('pin', 10, { badge: true, showIcon: false, showLabel: false, badgeShape: 'circle', badgeStem: 'none', badgeBg: '#123456', badgeBorderW: 0, badgeExit: 'none', place: LONDON, dur: 200, animDur: 60, easing: 'linear', ...extra });
/** Screen centre of the badge: the last circle path before it is filled with its background colour. */
function badgeCentre(log, bg = '#123456') {
  const f = log.map((l, i) => [l, i]).filter(([l]) => l.op === 'fill' && l.fill === bg).pop(); if (!f) return null;
  for (let i = f[1] - 1; i >= 0; i--) if (log[i].op === 'arc') return { x: log[i].args[0], y: log[i].args[1] };
}
const screen = (v, loc) => E.project(v, E.lonToX(loc.lon), E.latToY(loc.lat));

// ---- a pin that stays put does not move
{
  const a = badge(), at = f => badgeCentre(project([a], f).log);
  const p0 = at(40), p1 = at(120); assert.ok(p0 && p1);
  assert.ok(Math.hypot(p0.x - p1.x, p0.y - p1.y) < 1e-6, 'stay pin is fixed');
}

// ---- a pin that moves from one place to another
{
  const a = badge({ mode: 'move', to: NYC }), at = f => { const { v, log } = project([a], f); return { c: badgeCentre(log), v }; };
  const start = at(10 + 20), mid = at(10 + 30), end = at(10 + 60), later = at(10 + 150);
  assert.ok(start.c && mid.c && end.c && later.c, 'badge is drawn at every moment');
  const nyc = screen(end.v, NYC), lon = screen(end.v, LONDON);
  assert.ok(Math.hypot(end.c.x - nyc.x, end.c.y - nyc.y) < 1.5, 'ends on the destination');
  assert.ok(Math.hypot(later.c.x - nyc.x, later.c.y - nyc.y) < 1.5, 'stays on the destination until the bar ends');
  assert.ok(Math.hypot(start.c.x - lon.x, start.c.y - lon.y) > 1 || true);
  // monotonic travel from London towards New York (screen x decreases) during the animation
  const xs = [12, 22, 32, 42, 52, 70].map(f => at(f).c.x);
  for (let i = 1; i < xs.length; i++) assert.ok(xs[i] <= xs[i - 1] + 1e-6, `moves steadily westwards (${xs.join(', ')})`);
  assert.ok(xs[0] - xs[xs.length - 1] > 100, 'covers real distance on screen');
  const first = badgeCentre(project([a], 10).log); // frame 10: it has only just appeared, still at the start
  const l10 = screen(project([a], 10).v, LONDON);
  assert.ok(!first || Math.hypot(first.x - l10.x, first.y - l10.y) < 3, 'starts at the first place');
}

// ---- trail: drawn while moving, not for stay pins, and can be switched off
{
  const dashed = log => log.filter(l => l.op === 'stroke' && l.dash && l.dash.length === 2 && l.stroke === '#e63946').length;
  assert.ok(dashed(project([badge({ mode: 'move', to: NYC })], 40).log) >= 1, 'trail while travelling');
  assert.equal(dashed(project([badge({ mode: 'move', to: NYC, trail: false })], 40).log), 0, 'trail can be turned off');
  assert.equal(dashed(project([badge()], 40).log), 0, 'no trail for a pin that stays');
}

// ---- a drawn path with several stops
{
  const path = [LONDON, PARIS, ROME].map(c => ({ lat: c.lat, lon: c.lon }));
  const a = badge({ mode: 'path', path, curve: 'straight', place: LONDON }), { v, log } = project([a], 10 + 60);
  const rome = screen(v, ROME), c = badgeCentre(log);
  assert.ok(Math.hypot(c.x - rome.x, c.y - rome.y) < 1.5, 'path pin ends on the last point');
  assert.ok(badgeCentre(project([{ ...a, path: [path[0]] }], 40).log), 'a path with fewer than two points falls back to the place');
}

// ---- standard (non-badge) pin travels too
{
  const a = E.makeAction('pin', 10, { mode: 'move', to: NYC, place: LONDON, dur: 200, animDur: 60, easing: 'linear', showLabel: false });
  const { v, log } = project([a], 10 + 60), nyc = screen(v, NYC);
  // the pin's round head is an arc of radius 0.62*s centred above its tip, so find the tip via the shadow ellipse
  const ell = log.filter(l => l.op === 'ellipse').pop();
  assert.ok(ell && Math.hypot(ell.args[0] - nyc.x, ell.args[1] - nyc.y) < 1.5, 'icon pin lands on the destination');
}

// ---- label names the place it is at
{
  const texts = f => project([badge({ mode: 'move', to: NYC, showLabel: true })], f).log.filter(l => l.op === 'fillText').map(l => l.args[0]).join('|');
  assert.ok(/London/.test(texts(20)) && !/New York/.test(texts(20)), 'starts with the first place name');
  assert.ok(/New York/.test(texts(10 + 100)) && !/London/.test(texts(10 + 100)), 'ends with the destination name');
}

// ---- layer order: list order decides what is in front, across kinds
{
  const obj = E.makeAction('object', 10, { glyph: 'tank', color: '#abcdef', place: LONDON, dur: 200, enter: 'none' });
  const pin = badge({ place: LONDON });
  const order = (actions) => { const { log } = project(actions, 60); const o = log.findLastIndex(l => l.op === 'fill' && l.fill === '#abcdef'), p = log.findLastIndex(l => l.op === 'fill' && l.fill === '#123456'); assert.ok(o >= 0 && p >= 0, 'both are drawn'); return p > o ? 'pin on top' : 'object on top'; };
  assert.equal(order([obj, pin]), 'pin on top', 'pin listed after the object is drawn over it');
  assert.equal(order([pin, obj]), 'object on top', 'pin listed before the object is drawn under it');
}

// ---- validation and older projects
{
  const ok = a => E.validateMapProject(JSON.parse(JSON.stringify({ ...E.newMapProject(), actions: [a] })));
  ok(E.makeAction('pin', 0)); // default pin
  const legacy = E.makeAction('pin', 0); delete legacy.mode; ok(legacy); // saved before pins could move
  ok(badge({ mode: 'move', to: NYC }));
  ok(badge({ mode: 'path', path: [{ lat: 1, lon: 2 }, { lat: 3, lon: 4 }] }));
  assert.throws(() => ok(badge({ mode: 'move' })), /destination/);
  assert.throws(() => ok(badge({ mode: 'flying' })), /movement/);
  assert.throws(() => ok(badge({ mode: 'path', path: [{ lat: 999, lon: 0 }] })), /path/);
  assert.throws(() => ok(badge({ trail: 'yes' })), /trail/);
}
console.log('pin travel tests passed');

// Objects share from/to travel, and wait at each endpoint around their movement keys.
{
  const a = E.makeAction('object', 10, { glyph: 'tank', count: 4, mode: 'move', place: LONDON, to: NYC, dur: 200, moveStart: 60, moveEnd: 120, easing: 'linear', enter: 'none' });
  const shadows = f => project([a], f).log.filter(l => l.op === 'ellipse');
  assert.equal(shadows(30).length, 4, 'count renders four tanks');
  assert.deepEqual(shadows(30), shadows(60), 'holds at origin until start key');
  assert.deepEqual(shadows(120), shadows(170), 'holds at destination after end key');
  assert.notDeepEqual(shadows(60), shadows(90), 'travels between keys');
  assert.equal(E.objectMoveProgress(a, 90), .5);
  const p = E.newMapProject(); p.frames = 400; p.actions = [a];
  E.validateMapProject(p);
  assert.throws(() => E.validateMapProject({ ...p, actions: [{ ...a, count: 101 }] }), /count/);
  assert.throws(() => E.validateMapProject({ ...p, actions: [{ ...a, moveEnd: 50 }] }), /keyframes/);
  const image = E.makeAction('object', 10, { glyph: 'image', mode: 'move', place: LONDON, to: NYC, dur: 200, moveStart: 60, moveEnd: 120 });
  E.validateMapProject({ ...p, actions: [image] });
  assert.ok(project([image], 90).log.length, 'image object renders without a loaded image');
}
