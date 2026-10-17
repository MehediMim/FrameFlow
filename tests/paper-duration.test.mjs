// Run with: node tests/paper-duration.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as PE from '../paper-engine.mjs';

for (const fps of [24, 30, 60]) {
  for (const seconds of [120, 900, 3600, 86400]) {
    const p = PE.newPaperProject({ fps, frames: seconds * fps });
    const start = (seconds - 60) * fps, dur = 40 * fps;
    Object.assign(p.paper, { start, dur, enter: 'slideUp', easing: 'linear' });
    p.parts = [PE.makePart('headline', start, { dur })];
    p.shots = [PE.makeShot('pan', start, { dur, dx: 100, dy: 0, easing: 'linear' })];
    const reopened = PE.validatePaperProject(JSON.parse(JSON.stringify(p)));
    assert.equal(reopened.frames, seconds * fps, `${seconds}s at ${fps} fps remains intact`);
    for (const item of [reopened.paper, ...reopened.parts, ...reopened.shots]) {
      assert.equal(item.start, start);
      assert.equal(item.dur, dur);
    }
    assert.deepEqual(PE.validatePaperProject(JSON.parse(JSON.stringify(reopened))), reopened, 'long project survives another save/open');
    assert.equal(PE.cameraAt(reopened, start - 1).x, p.camera.x, 'late camera move waits for its start');
    assert.equal(PE.cameraAt(reopened, start + dur / 2).x, p.camera.x + 50, 'late camera move uses its full duration');
    assert.equal(PE.cameraAt(reopened, start + dur).x, p.camera.x + 100);
    assert.equal(PE.sheetAnim(reopened, start - 1).alpha, 0);
    assert.equal(PE.sheetAnim(reopened, start + dur / 2).dy, reopened.height * 1.15 / 2);
    assert.equal(PE.sheetAnim(reopened, start + dur).dy, 0);
  }
}

for (const frames of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1, 1.5, 1]) {
  assert.throws(() => PE.validatePaperProject(PE.newPaperProject({ frames })), /frame settings/);
}
assert.equal(PE.validatePaperProject(PE.newPaperProject({ frames: Number.MAX_SAFE_INTEGER })).frames, Number.MAX_SAFE_INTEGER);
for (const kind of ['paper', 'part', 'shot']) {
  for (const key of ['start', 'dur']) {
    for (const value of [NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const p = PE.newPaperProject();
      const item = kind === 'paper' ? p.paper : kind === 'part' ? PE.makePart('text') : PE.makeShot('pan');
      if (kind === 'part') p.parts.push(item);
      if (kind === 'shot') p.shots.push(item);
      item[key] = value;
      assert.throws(() => PE.validatePaperProject(p), /timing/, `${kind} rejects invalid ${key}`);
    }
  }
  const p = PE.newPaperProject();
  const item = kind === 'paper' ? p.paper : kind === 'part' ? PE.makePart('text') : PE.makeShot('pan');
  if (kind === 'part') p.parts.push(item);
  if (kind === 'shot') p.shots.push(item);
  item.start = Number.MAX_SAFE_INTEGER; item.dur = 1;
  assert.throws(() => PE.validatePaperProject(p), /timing/, `${kind} rejects an unsafe end frame`);
}

// Exercise the real settings/inspector handlers without drawing a browser UI.
const source = readFileSync(new URL('../paper-ui.js', import.meta.url), 'utf8');
const functionSource = (name, next) => source.slice(source.indexOf(`function ${name}(`), source.indexOf(next, source.indexOf(`function ${name}(`)));
const setup = [
  source.split('\n').find(line => line.startsWith('const validTiming =')),
  functionSource('ensureLength', '\nfunction syncFonts'),
  functionSource('syncDuration', '\nfunction renderSettings'),
  functionSource('bindSettings', '\n// ------------------------------------------------------------------ timeline'),
  functionSource('bindInspector', '\nasync function loadPicture'),
].join('\n');
const dragSource = source.slice(source.indexOf("window.addEventListener('pointermove',"), source.indexOf("window.addEventListener('pointerup',"));
function editor(p) {
  const elements = new Map(), fields = [], listeners = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', open: false, addEventListener() {}, setAttribute() {}, removeAttribute(k) { this[k] = ''; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    proj: p, frame: p.frames - 1, PE, fields,
    window: { addEventListener: (event, callback) => listeners.set(event, callback) },
    $: selector => selector.includes('#pInspector') || ['#pFont', '#pCapFont'].includes(selector) ? null : element(selector),
    $$: () => fields,
    pause() {}, checkpoint() {}, saveLocal() {}, renderAll() {}, changed() {}, notify() {}, renderTimeline() {}, draw() {},
    items: () => p.parts,
    frameFromEvent: e => e.testFrame,
    setTiming: (it, start, dur) => Object.assign(it, { start, dur }),
    isSheet: it => it.kind === 'sheet',
    get: (root, path) => path.split('.').reduce((a, k) => a[k], root),
    set: (root, path, v) => { const keys = path.split('.'), last = keys.pop(); keys.reduce((a, k) => a[k], root)[last] = v; },
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  });
  vm.runInContext(setup + '\nbindSettings();\n' + dragSource, context);
  return { context, element, fields, listeners };
}

for (const fps of [24, 30, 60]) {
  const p = PE.newPaperProject({ fps, frames: fps * 3600 });
  p.parts = [PE.makePart('text', fps * 3200, { dur: fps * 120 })];
  p.shots = [PE.makeShot('pan', fps * 3300, { dur: fps * 240 })];
  Object.assign(p.paper, { start: fps * 3000, dur: fps * 90 });
  const { context, element, fields, listeners } = editor(p);
  vm.runInContext('syncDuration();', context);
  assert.equal(element('#pDuration').max, '', 'duration input has no fixed maximum');
  assert.equal(element('#pDuration').value, 3600);
  element('#pDuration').onchange({ target: { value: '7200' } });
  assert.equal(p.frames, 7200 * fps, 'duration setting accepts two hours');
  for (const value of ['Infinity', '1e999', '1e30', '']) {
    element('#pDuration').onchange({ target: { value } });
    assert.equal(p.frames, 7200 * fps, 'invalid duration leaves existing project intact');
  }
  for (const nextFps of [60, 24, 30, fps]) {
    element('#pFps').onchange({ target: { value: String(nextFps) } });
    assert.equal(p.fps, nextFps);
    assert.equal(p.frames, 7200 * nextFps, 'FPS changes preserve long project length in seconds');
    assert.equal(p.parts[0].start, 3200 * nextFps);
    assert.equal(p.parts[0].dur, 120 * nextFps);
    assert.equal(p.shots[0].start, 3300 * nextFps);
    assert.equal(p.shots[0].dur, 240 * nextFps);
    assert.equal(p.paper.start, 3000 * nextFps);
    assert.equal(p.paper.dur, 90 * nextFps);
  }
  const startInput = { dataset: { pf: 'start', t: 'num' }, min: '0', max: '', value: String(8000 * fps) };
  fields.push(startInput);
  vm.runInContext('bindInspector(proj.parts[0]);', context);
  startInput.onchange();
  assert.equal(p.parts[0].start, 8000 * fps, 'uncapped inspector start does not clamp to zero when max is absent');
  assert.ok(p.frames >= p.parts[0].start + p.parts[0].dur, 'late timing expands the project');
  const original = p.parts[0].start;
  startInput.value = '1e30'; startInput.onchange();
  assert.equal(p.parts[0].start, original, 'unsafe inspector timing is rejected');
  assert.equal(startInput.value, original);
  const item = p.parts[0], previousDur = item.dur;
  context.drag = { kind: 'clip', id: item.id, mode: 'r', start: item.start, dur: item.dur, x0: 0 };
  listeners.get('pointermove')({ testFrame: 10000 * fps });
  assert.equal(item.dur, previousDur + 10000 * fps, 'dragging a clip edge can extend it for hours');
  assert.ok(p.frames >= item.start + item.dur, 'long edge drag grows the project');
}

console.log('Paper duration tests passed.');
