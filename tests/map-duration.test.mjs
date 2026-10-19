// Run with: node tests/map-duration.test.mjs
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { newMapProject, makeAction, makeShot, validateMapProject, actionProgress } from '../map-engine.mjs';
import { OBJECT_ICONS, EFFECTS, SHAPES } from '../map-objects.mjs';
import { retimeMapItem } from '../map-timing.mjs';

// Project length, item visibility and animation duration all exceed the old
// limits, at every supported frame rate, and survive saving and reopening.
for (const fps of [24, 30, 60]) {
  const p = newMapProject();
  p.fps = fps;
  p.frames = fps * 24 * 60 * 60;
  const start = fps * 2 * 60 * 60, dur = fps * 5 * 60 * 60, animDur = fps * 60 * 60;
  p.actions = [makeAction('plane', start, { dur, animDur, easing: 'linear' })];
  p.shots = [makeShot('flyTo', start + dur, { dur: fps * 2 * 60 * 60 })];
  assert.equal(validateMapProject(p), p);
  const reopened = validateMapProject(JSON.parse(JSON.stringify(p)));
  assert.equal(reopened.frames / fps, 24 * 60 * 60);
  assert.equal(reopened.actions[0].start, start);
  assert.equal(reopened.actions[0].dur, dur);
  assert.equal(reopened.actions[0].animDur, animDur);
  assert.equal(reopened.shots[0].dur, fps * 2 * 60 * 60);
  assert.equal(actionProgress(reopened.actions[0], start - 1), 0);
  assert.equal(actionProgress(reopened.actions[0], start + animDur / 2), .5);
  assert.equal(actionProgress(reopened.actions[0], start + animDur), 1);
}

// Old projects without an independent animation duration retain their speed
// when opening and extending a long clip.
{
  const p = newMapProject();
  p.frames = 100_000;
  const action = makeAction('pin', 10_000, { dur: 25_000 });
  delete action.animDur;
  p.actions = [action];
  validateMapProject(p);
  action.dur = 50_000;
  assert.equal(action.animDur, 25_000);
  assert.equal(actionProgress(action, 22_500), .5);
}

// There is no substitute fixed duration cap. The numeric boundary is whether
// frame numbers and interval ends can be represented exactly by JavaScript.
{
  const p = newMapProject();
  p.frames = Number.MAX_SAFE_INTEGER;
  p.actions = [makeAction('pin', p.frames - 100, { dur: 100, animDur: p.frames })];
  assert.doesNotThrow(() => validateMapProject(JSON.parse(JSON.stringify(p))));
}

for (const frames of [0, 1, -1, 1.5, NaN, Infinity, -Infinity, '5000', null, Number.MAX_SAFE_INTEGER + 1]) {
  const p = newMapProject();
  p.frames = frames;
  assert.throws(() => validateMapProject(p), /frame settings/i, `rejects invalid project frame count ${String(frames)}`);
}

for (const type of ['action', 'shot']) {
  for (const key of ['start', 'dur']) {
    const invalid = [NaN, Infinity, -Infinity, '5000', null, Number.MAX_SAFE_INTEGER + 1, 1.5, -1];
    if (key === 'dur') invalid.push(0);
    for (const value of invalid) {
      const p = newMapProject(), it = type === 'action' ? makeAction('pin', 0) : makeShot('flyTo', 0);
      it[key] = value;
      p[type === 'action' ? 'actions' : 'shots'] = [it];
      assert.throws(() => validateMapProject(p), /item timing/i, `rejects invalid ${type} ${key} ${String(value)}`);
    }
  }
  const p = newMapProject(), it = type === 'action' ? makeAction('pin', Number.MAX_SAFE_INTEGER) : makeShot('flyTo', Number.MAX_SAFE_INTEGER);
  p[type === 'action' ? 'actions' : 'shots'] = [it];
  assert.throws(() => validateMapProject(p), /item timing/i, 'rejects an unrepresentable interval end');
}

for (const animDur of [0, -1, 1.5, NaN, Infinity, -Infinity, '5000', null, Number.MAX_SAFE_INTEGER + 1]) {
  const p = newMapProject();
  p.actions = [makeAction('pin', 0, { animDur })];
  // makeAction fills null with its default; imported explicit null is invalid.
  p.actions[0].animDur = animDur;
  assert.throws(() => validateMapProject(p), /animation duration/i, `rejects invalid animation duration ${String(animDur)}`);
}

assert.doesNotThrow(() => validateMapProject({ ...newMapProject(), frames: 2 }));

// Run the actual UI handlers with small DOM substitutes: settings, inspector
// edits and timeline drags must all keep timings beyond the old limits.
const source = readFileSync(new URL('../map-ui.js', import.meta.url), 'utf8');
const section = (start, next) => source.slice(source.indexOf(start), source.indexOf(next, source.indexOf(start)));
const setup = [
  section('function ensureLength(', '\n// ------------------------------------------------------------------ map data'),
  section('function syncMapDuration(', '\nfunction renderSettings'),
  section('function bindSettings(', '\n// ------------------------------------------------------------------ timeline'),
  section('function bindInspector(', '\nfunction centerLonLat'),
  section("window.addEventListener('pointermove',", "window.addEventListener('pointerup',"),
].join('\n');
function editor(p) {
  const elements = new Map(), fields = [], listeners = new Map();
  const element = id => {
    if (!elements.has(id)) elements.set(id, { value: '', closest: () => null, removeAttribute(k) { this[k] = ''; } });
    return elements.get(id);
  };
  const context = vm.createContext({
    OBJECT_ICONS, EFFECTS, SHAPES, retimeMapItem, bindCameraInspector() {},
    proj: p, frame: p.frames - 1,
    $: selector => selector.startsWith('#mInspector') ? null : element(selector),
    $$: selector => selector === '#mInspector [data-mf]' ? fields : [],
    window: { addEventListener: (event, callback) => listeners.set(event, callback) },
    pause() {}, checkpoint() {}, saveLocal() {}, renderAll() {}, changed() {}, notify() {}, renderTimeline() {}, renderInspector() {}, draw() {},
    items: () => [...p.shots, ...p.actions],
    isShot: it => it.kind === 'shot',
    frameFromEvent: e => e.testFrame,
    clamp: (v, min, max) => Math.max(min, Math.min(max, v)),
  });
  vm.runInContext(setup + '\nbindSettings();', context);
  return { context, element, fields, listeners };
}

for (const fps of [24, 30, 60]) {
  const p = newMapProject(); p.fps = fps; p.frames = 3600 * fps;
  p.actions = [makeAction('pin', 0)];
  p.shots = [makeShot('flyTo', 0)];
  const { context, element, fields, listeners } = editor(p);
  vm.runInContext('syncMapDuration();', context);
  assert.equal(element('#mDuration').max, '', 'duration input has no fixed maximum');
  assert.equal(element('#mDuration').value, 3600);
  element('#mDuration').onchange({ target: { value: '7200' } });
  assert.equal(p.frames, 7200 * fps, 'Map duration setting accepts hours');
  for (const value of ['Infinity', '1e999', '1e30', '']) {
    element('#mDuration').onchange({ target: { value } });
    assert.equal(p.frames, 7200 * fps, 'invalid duration leaves existing project intact');
  }
  element('#mDuration').onchange({ target: { value: '0' } });
  assert.equal(p.frames, 2, 'project duration keeps its two frame minimum');
  element('#mDuration').onchange({ target: { value: '7200' } });

  for (const [collection, index] of [['actions', 0], ['shots', 0]]) {
    const item = p[collection][index];
    fields.splice(0, fields.length, ...['start', 'dur', ...(collection === 'actions' ? ['animDur'] : [])].map(key => ({
      dataset: { mf: key, t: 'num' }, min: key === 'start' ? '0' : '1', max: '', value: '',
    })));
    context.item = item;
    vm.runInContext('bindInspector(item);', context);
    const edit = (key, value) => { const input = fields.find(f => f.dataset.mf === key); input.value = String(value); input.onchange(); return input; };
    edit('start', 9 * 3600 * fps);
    edit('dur', 2 * 3600 * fps);
    assert.equal(item.start, 9 * 3600 * fps, 'Map inspector start remains uncapped when max is absent');
    assert.equal(item.dur, 2 * 3600 * fps, 'Map inspector duration remains uncapped');
    assert.ok(p.frames >= item.start + item.dur, 'late timing grows the project');
    if (collection === 'actions') {
      const frames = p.frames;
      edit('animDur', 12 * 3600 * fps);
      assert.equal(item.animDur, 12 * 3600 * fps, 'animation duration can exceed both clip and project lengths');
      assert.equal(p.frames, frames, 'animation duration stays independent of clip length');
    }
    for (const input of fields) {
      const key = input.dataset.mf, previous = item[key];
      for (const invalid of ['Infinity', '1e30']) {
        edit(key, invalid);
        assert.equal(item[key], previous, 'unsafe inspector timing is rejected');
        assert.equal(input.value, previous);
      }
    }
    const originalDuration = item.dur, animDur = item.animDur;
    context.drag = { kind: 'clip', id: item.id, mode: 'r', start: item.start, dur: item.dur, x0: 0 };
    listeners.get('pointermove')({ testFrame: 5 * 3600 * fps });
    assert.equal(item.dur, originalDuration + 5 * 3600 * fps, 'Map edge drag can extend clips by hours');
    assert.equal(item.animDur, animDur, 'clip dragging preserves the animation duration');
    assert.ok(p.frames >= item.start + item.dur, 'long drag grows the project');
    edit('start', -1); edit('dur', 0);
    assert.equal(item.start, 0); assert.equal(item.dur, 1, 'clip duration stays at least one frame');
  }
  assert.equal(vm.runInContext('ensureLength(Number.MAX_SAFE_INTEGER);', context), true);
  assert.equal(p.frames, Number.MAX_SAFE_INTEGER, 'timeline growth adds no fixed replacement cap');
  assert.equal(vm.runInContext('ensureLength(Number.MAX_SAFE_INTEGER + 1);', context), false);
  assert.equal(p.frames, Number.MAX_SAFE_INTEGER, 'unsafe growth leaves the project intact');
}

console.log('map duration tests passed');
