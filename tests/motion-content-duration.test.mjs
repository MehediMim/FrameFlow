// Run with: node tests/motion-content-duration.test.mjs
import assert from 'node:assert/strict';
import { DEFAULT_CHART, validateChart } from '../charts.mjs';
import { DEFAULT_TABLE, validateExtras, tableProgress } from '../motion-extras.mjs';
import { DEFAULT_LIST, DEFAULT_DIAGRAM, validateStructured, structuredInspector, bindStructuredInspector } from '../motion-structured.mjs';
import { GRAPH_DEFAULT, graphInspector, bindGraphInspector } from '../motion-diagram.mjs';
import { validateVector, bindVectorInspector, pinAt } from '../vector-layers.mjs';
import { makeCameraShot, cameraAt } from '../motion-camera.mjs';

const clone = value => structuredClone(value);
const tableLayer = duration => ({ type: 'table', color: '#ffffff', table: { ...clone(DEFAULT_TABLE), duration } });
const vectorLayer = () => ({ type: 'vector', in: 0, svgMarkup: '<svg viewBox="0 0 100 100"><path d="M0 0L100 100"/></svg>', vectorStart: 0, vectorDuration: 40 });
const validators = [
  ['chart', duration => validateChart({ ...clone(DEFAULT_CHART), duration })],
  ['table', duration => validateExtras({ layers: [tableLayer(duration)] })],
  ['list', duration => validateStructured({ type: 'list', structured: { ...clone(DEFAULT_LIST), duration } })],
  ['diagram', duration => validateStructured({ type: 'diagram', structured: { ...clone(DEFAULT_DIAGRAM), duration } })],
  ['graph', duration => validateStructured({ type: 'diagram', structured: { ...clone(GRAPH_DEFAULT), duration } })],
  ['vector', duration => validateVector({ ...vectorLayer(), vectorDuration: duration })],
];

for (const [name, validate] of validators) {
  for (const duration of [1, 1801, 3601, 100_000, 60 * 60 * 60 * 24, Number.MAX_SAFE_INTEGER]) {
    assert.doesNotThrow(() => validate(duration), `${name} supports ${duration} frames`);
  }
  for (const duration of [0, -1, 1.5, NaN, Infinity, -Infinity, '10000', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validate(duration), undefined, `${name} rejects invalid duration ${String(duration)}`);
  }
}

// Graphs retain their map of free node positions when saved and reopened;
// other unsupported layouts and free list layouts remain invalid.
{
  const layer = { type: 'diagram', structured: { ...clone(GRAPH_DEFAULT), duration: 100_000 } };
  const saved = JSON.parse(JSON.stringify(layer));
  assert.doesNotThrow(() => validateStructured(saved));
  assert.deepEqual(saved, layer);
  assert.throws(() => validateStructured({ type: 'list', structured: { ...clone(DEFAULT_LIST), layout: 'free' } }));
  assert.throws(() => validateStructured({ type: 'diagram', structured: { ...clone(DEFAULT_DIAGRAM), layout: 'unknown' } }));
}

// Late vector drawings and puppet-pin keyframes are not constrained by the
// former 1800-frame ceiling. Their interval end must remain representable.
{
  const layer = { ...vectorLayer(), vectorStart: 200_000, vectorDuration: 100_000,
    puppetPin: { x: .5, y: .5, radius: .32, keys: [{ f: 200_000, x: .2, y: .3 }, { f: 300_000, x: .8, y: .7 }] } };
  const saved = JSON.parse(JSON.stringify(layer));
  assert.doesNotThrow(() => validateVector(saved));
  assert.deepEqual(saved, layer);
  assert.ok(Math.abs(pinAt(saved, 250_000).x - .5) < 1e-10);
  for (const vectorStart of [-1, 1.5, Infinity, -Infinity, NaN, '20000', null, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => validateVector({ ...layer, vectorStart }), /SVG timing/i);
  }
  assert.throws(() => validateVector({ ...layer, vectorStart: Number.MAX_SAFE_INTEGER }), /SVG timing/i);
  assert.throws(() => validateVector({ ...layer, vectorStrokeWidth: 1801 }), /SVG setting/i, 'stroke width retains its visual size constraint');
  assert.throws(() => validateVector({ ...layer, vectorPinSize: 1801 }), /SVG setting/i, 'pin size retains its visual size constraint');
  const invalidPin = clone(layer);
  invalidPin.puppetPin.keys[0].f = Number.MAX_SAFE_INTEGER + 1;
  assert.throws(() => validateVector(invalidPin), /puppet pin/i);
}

// An extended table reveal still uses its configured duration at late frames.
{
  const table = { ...clone(DEFAULT_TABLE), duration: 100_000 };
  assert.equal(tableProgress(table, 0, 1, 0), 0);
  assert.equal(tableProgress(table, 0, 1, 50_000), .875);
  assert.equal(tableProgress(table, 0, 1, 100_000), 1);
}

// Camera shots can return smoothly across minutes at a late timeline position.
// The return still ends at the clip boundary, independently of project length.
for (const fps of [24, 30, 60]) {
  const p = { width: 1280, height: 720, fps, frames: 24 * 60 * 60 * fps, layers: [] };
  const shot = makeCameraShot(p, 'push', 2 * 60 * 60 * fps);
  Object.assign(shot, { dur: 600 * fps, returnTime: 120, easing: 'linear' });
  p.cameraShots = [shot];
  const arrival = cameraAt(p, shot.start + 480 * fps);
  const returning = cameraAt(p, shot.start + 540 * fps);
  const ended = cameraAt(p, shot.start + shot.dur);
  assert.ok(arrival.zoom > returning.zoom && returning.zoom > ended.zoom);
  assert.equal(ended.zoom, 1);
}

// Exercise the actual input handlers with small DOM doubles, including omitted
// maximum attributes and restoration after invalid numeric edits.
const oldDocument = globalThis.document, oldWindow = globalThis.window;
try {
  for (const [kind, bind, inspect, settings] of [
    ['struct', bindStructuredInspector, structuredInspector, DEFAULT_LIST],
    ['graph', bindGraphInspector, graphInspector, GRAPH_DEFAULT],
  ]) {
    const layer = { type: kind === 'struct' ? 'list' : 'diagram', structured: clone(settings) };
    const html = inspect(layer), inputTag = html.match(new RegExp(`<input[^>]*data-${kind}="duration"[^>]*>`))?.[0];
    assert.ok(inputTag, `${kind} exposes a reveal duration input`);
    assert.doesNotMatch(inputTag, /\bmax=/, `${kind} reveal input has no fixed maximum`);
    const input = { dataset: { [kind]: 'duration' }, type: 'number', value: '100000' };
    globalThis.document = { querySelectorAll: selector => selector === `[data-${kind}]` ? [input] : [] };
    let changes = 0;
    bind(layer, { checkpoint() {}, pause() {}, notify() {}, changed() { changes++; } });
    input.onchange();
    assert.equal(layer.structured.duration, 100_000);
    for (const invalid of ['Infinity', '-Infinity', 'NaN', String(Number.MAX_SAFE_INTEGER + 1)]) {
      input.value = invalid;
      input.onchange();
      assert.equal(layer.structured.duration, 100_000);
      assert.equal(Number(input.value), 100_000);
    }
    assert.equal(changes, 1, 'invalid input does not commit a project edit');
    input.value = '0'; input.onchange();
    assert.equal(layer.structured.duration, 1, 'the minimum reveal duration remains one frame');
  }

  for (const fps of [24, 30, 60]) {
    const layer = vectorLayer();
    const inputs = ['vectorStart', 'vectorDuration'].map(name => ({ dataset: { vector: name }, type: 'number', value: '7200' }));
    globalThis.document = { querySelectorAll: () => inputs, getElementById: () => null };
    globalThis.window = {};
    let changes = 0;
    bindVectorInspector(layer, (target, name, value) => { changes++; target[name] = value; }, fps);
    for (const input of inputs) input.onchange();
    assert.equal(layer.vectorStart, 7200 * fps);
    assert.equal(layer.vectorDuration, 7200 * fps);
    for (const input of inputs) {
      for (const invalid of ['Infinity', '-Infinity', 'NaN', '1e30']) {
        input.value = invalid; input.onchange();
        assert.equal(Number(input.value), 7200);
      }
    }
    assert.equal(changes, 2, 'invalid vector input does not commit a project edit');
  }
} finally {
  if (oldDocument === undefined) delete globalThis.document; else globalThis.document = oldDocument;
  if (oldWindow === undefined) delete globalThis.window; else globalThis.window = oldWindow;
}

console.log('motion content duration tests passed');
