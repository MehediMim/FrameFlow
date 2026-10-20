// Run with: node tests/map-timing.test.mjs
import assert from 'node:assert/strict';
import * as E from '../map-engine.mjs';
import { splitMapItem, retimeMapItem } from '../map-timing.mjs';

// A small country makes recorded canvas commands easy to compare without a DOM.
const topo = {
  transform: { scale: [1, 1], translate: [0, 0] },
  arcs: [[[-20, -15], [40, 0], [0, 30], [-40, 0], [0, -30]]],
  objects: { countries: { geometries: [{ type: 'Polygon', properties: { name: 'Testland' }, arcs: [[0]] }] } },
};
const geo = E.buildGeo(topo);
const W = 640, H = 360;
const place = (name, lon, lat = 0) => ({ kind: 'city', name, lon, lat });
const project = () => {
  const p = E.newMapProject();
  Object.assign(p.camera.init, { lon: 0, lat: 0, zoom: 2 });
  p.graticule = false;
  return p;
};

function recordingCanvas() {
  const commands = [], stack = [];
  let state = { globalAlpha: 1, letterSpacing: '0px' }, gradientId = 0;
  const methods = {};
  for (const name of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'fillRect', 'rect', 'clip', 'arc', 'arcTo', 'roundRect', 'ellipse', 'bezierCurveTo', 'setLineDash', 'translate', 'rotate', 'scale', 'fillText', 'strokeText']) {
    methods[name] = (...args) => commands.push([name, ...args]);
  }
  methods.save = () => { stack.push({ ...state }); commands.push(['save']); };
  methods.restore = () => { assert.ok(stack.length, 'canvas restore has a matching save'); state = stack.pop(); commands.push(['restore']); };
  methods.measureText = text => ({ width: String(text).length * 8 });
  methods.createRadialGradient = (...args) => {
    const id = gradientId++;
    commands.push(['createRadialGradient', id, ...args]);
    return { gradientId: id, addColorStop: (...stop) => commands.push(['addColorStop', id, ...stop]) };
  };
  methods.createLinearGradient = (...args) => {
    const id = gradientId++;
    commands.push(['createLinearGradient', id, ...args]);
    return { gradientId: id, addColorStop: (...stop) => commands.push(['addColorStop', id, ...stop]) };
  };
  const ctx = new Proxy({}, {
    has: (_, key) => key in state || key in methods,
    get: (_, key) => {
      if (key in methods) return methods[key];
      if (key in state) return state[key];
      throw Error(`Canvas method or property is not implemented: ${String(key)}`);
    },
    set: (_, key, value) => {
      state[key] = value;
      commands.push(['set', key, value && typeof value === 'object' ? { gradientId: value.gradientId } : value]);
      return true;
    },
  });
  return { ctx, commands, stack };
}

function render(p, frame) {
  const { ctx, commands, stack } = recordingCanvas();
  E.drawMap(ctx, W, H, p, frame, geo);
  assert.equal(stack.length, 0, 'frame rendering balances the canvas state');
  return commands;
}
const commandsOf = (commands, names) => commands.filter(([name]) => names.includes(name));

// Every visible part, including labels, trails, planned paths and dimming, must
// disappear at the clip boundary even when an old file requests keep:true.
for (const type of Object.keys(E.ACTION_TYPES)) {
  for (const keep of [true, false]) {
    const p = project(), a = E.makeAction(type, 20, {
      dur: 80, animDur: 20, keep, easing: 'linear',
      target: { kind: 'country', name: 'Testland' },
      from: place('Start', -10), to: place('End', 10), place: place('Pin', 0),
      path: [place('Start', -10), place('End', 10)],
      pulse: false,
    });
    p.actions = [a];
    const base = render({ ...p, actions: [] }, 0);
    for (const frame of [0, 19, 100, 101, 150]) {
      assert.deepEqual(render(p, frame), base, `${type} leaves no drawing outside its timeline interval (frame ${frame}, keep:${keep})`);
    }
    a.visible = false;
    assert.deepEqual(render(p, 25), base, `${type} hidden layer renders no pixels or labels`);
    a.visible = true;
    const moving = render(p, 25), held = render(p, 60);
    assert.notDeepEqual(moving, base, `${type} appears while animating`);
    assert.notDeepEqual(held, base, `${type} stays visible after its animation finishes inside the clip`);
    assert.notDeepEqual(moving, held, `${type} reaches a different completed appearance`);
    assert.notDeepEqual(render(p, 99), base, `${type} remains visible through the final clip frame`);

    // Extending a timeline bar must leave the animation's speed unchanged.
    a.dur = 140;
    assert.deepEqual(render(p, 25), moving, `${type} animation speed is independent of clip length`);
    assert.notDeepEqual(render(p, 100), base, `${type} remains visible in an extended clip`);
    assert.deepEqual(render(p, 160), base, `${type} disappears at its new end`);
  }
}

// Radius highlights use a separate drawing branch from country highlights.
{
  const p = project();
  p.actions = [E.makeAction('highlight', 20, { dur: 80, animDur: 20, target: place('Spotlight', 0), pulse: false })];
  const base = render({ ...p, actions: [] }, 0);
  assert.deepEqual(render(p, 19), base);
  assert.notDeepEqual(render(p, 60), base);
  assert.deepEqual(render(p, 100), base, 'radius highlight, dimming and label end together');
}

// Completed geometry holds while ongoing decorative ripples can still animate.
for (const type of ['border', 'highlight', 'plane', 'pin']) {
  const p = project();
  p.actions = [E.makeAction(type, 20, {
    dur: 100, animDur: 20, easing: 'linear', pulse: false,
    target: { kind: 'country', name: 'Testland' },
    from: place('Start', -10), to: place('End', 10), place: place('Pin', 0),
  })];
  const first = render(p, 40), later = render(p, 70);
  if (type === 'plane') {
    assert.deepEqual(commandsOf(first, ['translate', 'rotate']), commandsOf(later, ['translate', 'rotate']), 'traveler stays at its destination after animation duration');
  } else if (type === 'pin') {
    assert.deepEqual(commandsOf(first, ['bezierCurveTo']), commandsOf(later, ['bezierCurveTo']), 'pin holds its landed position');
  } else {
    assert.deepEqual(first, later, `${type} holds its finished geometry`);
  }
}

// Animation duration can exceed the clip: the clip still cuts the action off.
{
  const p = project(), a = E.makeAction('plane', 20, { dur: 10, animDur: 80 });
  p.actions = [a];
  assert.equal(E.actionProgress(a, 25), 5 / 80);
  assert.deepEqual(render(p, 30), render({ ...p, actions: [] }, 30));
}

// A camera following an equatorial route must track the same duration and
// easing as its traveler, independently of the route clip's visible length.
for (const easing of ['linear', 'easeIn']) {
  const p = project(), a = E.makeAction('plane', 40, {
    dur: 120, animDur: 20, easing, from: place('Start', -10), to: place('End', 10),
  });
  p.actions = [a];
  p.shots = [E.makeShot('followPlane', 0, { dur: 60, planeId: a.id, zoom: 2, pitch: 0 })];
  const q = easing === 'linear' ? .25 : .25 ** 3;
  const following = E.cameraAt(p, geo, W, H, 45);
  assert.ok(Math.abs(following.cx - E.lonToX(-10 + 20 * q)) < 1e-9, `follow camera matches ${easing} travel progress`);
  a.dur = 180;
  assert.deepEqual(E.cameraAt(p, geo, W, H, 45), following, 'extending visibility leaves follow movement unchanged');
  assert.ok(Math.abs(E.cameraAt(p, geo, W, H, 80).cx - E.lonToX(10)) < 1e-9, 'follow camera holds at the completed destination');
}

// Existing projects retain their animation speed when edited and saved again.
{
  for (const type of Object.keys(E.ACTION_TYPES)) {
    assert.equal(E.makeAction(type, 0).animDur, E.ACTION_TYPES[type].dur);
    assert.equal(E.makeAction(type, 0, { dur: 77 }).animDur, 77);
    assert.equal(E.makeAction(type, 0, { dur: 77, animDur: 12 }).animDur, 12);
  }
  const p = project(), legacy = E.makeAction('pin', 10, { dur: 60, keep: true });
  delete legacy.animDur;
  p.actions = [legacy];
  assert.equal(E.actionProgress(legacy, 40), .5, 'legacy animation progress falls back to its original length');
  E.validateMapProject(p);
  assert.equal(legacy.animDur, 60, 'opening a legacy project captures its animation duration');
  legacy.dur = 120;
  assert.equal(E.actionProgress(legacy, 40), .5, 'trimming an imported clip preserves animation speed');
  assert.equal(E.actionProgress(legacy, 0), 0);
  assert.equal(E.actionProgress(legacy, 1000), 1);
  const reopened = E.validateMapProject(JSON.parse(JSON.stringify(p)));
  assert.equal(reopened.actions[0].animDur, 60, 'animation duration survives saving and reopening');
  for (const animDur of [0, -1, Number.MAX_SAFE_INTEGER + 1, Infinity, NaN, '20', null]) {
    const invalid = project();
    invalid.actions = [{ ...legacy, animDur }];
    assert.throws(() => E.validateMapProject(invalid), /animation duration/i, `rejects invalid animation duration ${String(animDur)}`);
  }
}

// Cuts preserve the source animation on both sides, including fades and keys.
for (const type of Object.keys(E.ACTION_TYPES)) {
  const p = project(), a = E.makeAction(type, 20, {
    dur: 100, animDur: 90, easing: 'easeInOut',
    target: { kind: 'country', name: 'Testland' },
    from: place('Start', -10), to: place('End', 10), place: place('Pin', 0),
    path: [place('Start', -10), place('End', 10)], pulse: false,
  });
  p.actions = [a];
  const frames = [19, 20, 40, 69, 70, 71, 100, 119, 120];
  const before = frames.map(f => render(p, f));
  assert.equal(splitMapItem(a, 20, 'invalid'), null);
  const right = splitMapItem(a, 70, `${a.id}-right`);
  p.actions.push(right);
  frames.forEach((f, i) => assert.deepEqual(render(p, f), before[i], `${type} split preserves frame ${f}`));
  E.validateMapProject(JSON.parse(JSON.stringify(p)));
  const sample = render({ ...p, actions: [right] }, 100);
  retimeMapItem(right, 90, right.dur);
  assert.deepEqual(render({ ...p, actions: [right] }, 120), sample, `${type} split clip moves with its source clock`);
}
for (const preset of ['pushIn', 'flyTo', 'orbit', 'keyframed']) {
  const p = project(), s = E.makeShot(preset, 20, { dur: 100 });
  p.shots = [s];
  const frames = [20, 50, 69, 70, 71, 100, 120, 150];
  const before = frames.map(f => E.cameraAt(p, geo, W, H, f));
  s.sourceFrom = E.cameraAt(p, geo, W, H, s.start);
  p.shots.push(splitMapItem(s, 70, `${s.id}-right`));
  frames.forEach((f, i) => assert.deepEqual(E.cameraAt(p, geo, W, H, f), before[i], `${preset} camera cut preserves frame ${f}`));
  E.validateMapProject(JSON.parse(JSON.stringify(p)));
}
// Follow the object's movement clock, including its stationary endpoint holds.
for (const mode of ['path', 'move']) {
  const p = project(), a = E.makeAction('object', 0, { mode, dur: 200, moveStart: 60, moveEnd: 120, easing: 'linear', place: place('Start', -10), to: place('End', 10), path: [place('Start', -10), place('End', 10)] });
  p.actions = [a]; p.shots = [E.makeShot('followPlane', 0, { dur: 200, planeId: a.id })];
  for (const f of [70, 90, 120, 150]) {
    const camera = E.cameraAt(p, geo, W, H, f), position = E.objectLocationAt({ cx: .5 }, geo, a, f);
    assert.ok(Math.abs(camera.cx - position.X) < 1e-10, `${mode} camera follows actual object position at ${f}`);
    assert.ok(Math.abs(camera.cy - position.Y) < 1e-10);
  }
}
console.log('map action timing tests passed');
