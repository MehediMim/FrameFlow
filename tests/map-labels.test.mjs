// Run with: node tests/map-labels.test.mjs
import assert from 'node:assert/strict';
import * as E from '../map-engine.mjs';

// Adjacent countries let the route cross a known boundary without external data.
const topo = {
  transform: { scale: [1, 1], translate: [0, 0] },
  arcs: [
    [[-20, -15], [20, 0], [0, 30], [-20, 0], [0, -30]],
    [[0, -15], [20, 0], [0, 30], [-20, 0], [0, -30]],
  ],
  objects: { countries: { geometries: [
    { type: 'Polygon', properties: { name: 'Westland' }, arcs: [[0]] },
    { type: 'Polygon', properties: { name: 'Eastland' }, arcs: [[1]] },
  ] } },
};
const geo = E.buildGeo(topo), W = 640, H = 360;
const place = (name, lon, lat = 0) => ({ kind: 'city', name, lon, lat });
const project = () => {
  const p = E.newMapProject();
  Object.assign(p.camera.init, { lon: 0, lat: 0, zoom: 2 });
  p.graticule = false;
  return p;
};
const near = (a, b, why) => assert.ok(Math.abs(a - b) < 1e-8, `${why}: ${a} ≈ ${b}`);

function recordingCanvas() {
  const commands = [], texts = [], stack = [];
  let state = { globalAlpha: 1, letterSpacing: '0px', matrix: [1, 0, 0, 1, 0, 0] }, gradientId = 0;
  const methods = {};
  for (const name of ['beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke', 'fillRect', 'clip', 'arc', 'arcTo', 'ellipse', 'bezierCurveTo', 'quadraticCurveTo', 'roundRect', 'setLineDash', 'strokeText']) {
    methods[name] = (...args) => commands.push([name, ...args]);
  }
  methods.save = () => { stack.push({ ...state, matrix: [...state.matrix] }); commands.push(['save']); };
  methods.restore = () => { assert.ok(stack.length, 'canvas restore has a matching save'); state = stack.pop(); commands.push(['restore']); };
  const transform = (a, b, c, d, e, f) => {
    const [A, B, C, D, X, Y] = state.matrix;
    state.matrix = [A * a + C * b, B * a + D * b, A * c + C * d, B * c + D * d, A * e + C * f + X, B * e + D * f + Y];
  };
  methods.translate = (x, y) => { transform(1, 0, 0, 1, x, y); commands.push(['translate', x, y]); };
  methods.scale = (x, y) => { transform(x, 0, 0, y, 0, 0); commands.push(['scale', x, y]); };
  methods.rotate = a => { transform(Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0); commands.push(['rotate', a]); };
  methods.transform = (...args) => { transform(...args); commands.push(['transform', ...args]); };
  methods.fillText = (text, x, y) => {
    texts.push({ text: String(text), x, y, alpha: state.globalAlpha, font: state.font, matrix: [...state.matrix] });
    commands.push(['fillText', text, x, y]);
  };
  methods.measureText = text => ({ width: String(text).length * 8 });
  for (const name of ['createRadialGradient', 'createLinearGradient']) {
    methods[name] = (...args) => {
      const id = gradientId++;
      commands.push([name, id, ...args]);
      return { gradientId: id, addColorStop: (...stop) => commands.push(['addColorStop', id, ...stop]) };
    };
  }
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
  return { ctx, commands, texts, stack };
}

function render(p, frame, width = W, height = H) {
  const recording = recordingCanvas();
  const view = E.drawMap(recording.ctx, width, height, p, frame, geo);
  assert.equal(recording.stack.length, 0, 'frame rendering balances canvas state');
  return { ...recording, view };
}
const names = result => result.texts.map(t => t.text).sort();
const text = (result, value) => {
  const found = result.texts.filter(t => t.text === value);
  assert.equal(found.length, 1, `renders one ${value} label`);
  return found[0];
};
const upright = label => assert.deepEqual(label.matrix.slice(0, 4), [1, 0, 0, 1], 'text remains upright in screen space');

const canvasPoint = label => {
  const [a, b, c, d, e, f] = label.matrix;
  return { x: a * label.x + c * label.y + e, y: b * label.x + d * label.y + f };
};
const attached = label => {
  assert.notDeepEqual(label.matrix.slice(0, 4), [1, 0, 0, 1], 'attached text rotates and tilts with the map plane');
  assert.ok(label.matrix.every(Number.isFinite), 'map label transform stays finite');
};

// Pins independently control their marker and text. A text-only pin labels the
// geographic anchor itself, without leaving a marker shadow or animated ripples.
{
  const p = project(), loc = place('Optional pin', -8, 2);
  const a = E.makeAction('pin', 20, { dur: 180, animDur: 100, place: loc, label: 'Pin text' });
  p.actions = [a];
  assert.equal(a.showIcon, true, 'new pins show their marker by default');
  assert.equal(a.showLabel, true, 'new pins show their text by default');
  const complete = render(p, 140);
  assert.ok(complete.commands.some(([op]) => op === 'bezierCurveTo'), 'the default pin includes its marker');
  text(complete, 'Pin text');

  a.showIcon = false;
  const onlyText = render(p, 140), label = text(onlyText, 'Pin text');
  const baseline = render({ ...p, actions: [] }, 140);
  assert.deepEqual(onlyText.commands.filter(([op]) => ['ellipse', 'bezierCurveTo', 'arc'].includes(op)), [], 'text-only pins have no marker body or ground shadow');
  const count = (recording, op) => recording.commands.filter(([name]) => name === op).length;
  assert.equal(count(onlyText, 'stroke'), count(baseline, 'stroke'), 'text-only pins draw no ground ripples');
  const q = E.project(onlyText.view, E.lonToX(loc.lon), E.latToY(loc.lat));
  const fs = Number(label.font.match(/ (\d+)px /)[1]);
  upright(label);
  near(label.x, q.x, 'text-only pin centers text on its geographic anchor X');
  near(label.y, q.y + fs * .05, 'text-only pin has no marker-sized vertical offset');
  a.size = 4;
  assert.deepEqual(text(render(p, 140), 'Pin text'), label, 'hidden marker size cannot move or resize pin text');

  // Text keeps the existing delayed pop, controlled by animation duration.
  assert.ok(render(p, 65).texts.every(t => t.alpha < 1e-8), 'pin text waits through the first .45 of its animation');
  const emerging = text(render(p, 66), 'Pin text');
  assert.ok(emerging.alpha > 0 && emerging.alpha < label.alpha, 'text-only pin starts to fade in after its delayed entrance');
  assert.deepEqual(text(render(p, 95), 'Pin text'), label, 'pin text finishes its pop at .75 of animation duration');
  assert.ok(render(p, 50).texts.every(t => t.alpha < 1e-8), 'the longer animation has not revealed text yet');
  a.animDur = 40;
  assert.deepEqual(text(render(p, 50), 'Pin text'), label, 'shortening animation duration speeds up the text-only pin entrance');
  a.animDur = 100;

  // Reusing the project preset also attaches a text-only pin to the ground.
  Object.assign(p.camera.init, { bearing: 35, pitch: 55 });
  Object.assign(p.labelStyle, E.LABEL_PRESETS.map2d.style);
  const onMap = text(render(p, 140), 'Pin text');
  attached(onMap);
  assert.equal(E.labelStyleOf(p, a).placement, 'map', 'text-only pins inherit the map-attached project preset');
  near(onMap.x, 0, 'attached text-only pin is locally centered on its geographic anchor');
  near(onMap.y, Number(onMap.font.match(/ (\d+)px /)[1]) * .05, 'attached text-only pin has no marker-sized vertical offset');
  for (const frame of [0, 19, 200, 201]) {
    assert.deepEqual(render(p, frame).commands, render({ ...p, actions: [] }, frame).commands, `text-only pins obey timeline visibility at ${frame}`);
  }

  a.showIcon = true;
  a.showLabel = false;
  const onlyIcon = render(p, 140);
  assert.deepEqual(onlyIcon.texts, [], 'marker-only pins draw no text');
  assert.ok(onlyIcon.commands.some(([op]) => op === 'bezierCurveTo'), 'marker-only pins retain the pin body');
  a.showIcon = false;
  const hidden = render(p, 140), empty = render({ ...p, actions: [] }, 140);
  assert.deepEqual(hidden.texts, [], 'both visibility switches can hide a pin entirely');
  for (const op of ['fill', 'stroke', 'ellipse', 'bezierCurveTo', 'arc']) {
    assert.equal(count(hidden, op), count(empty, op), `fully hidden pins add no ${op} drawing`);
  }

  a.showLabel = true;
  a.showIcon = true;
  const explicitIcon = render(p, 140);
  delete a.showIcon;
  assert.deepEqual(render(p, 140).commands, explicitIcon.commands, 'legacy pins without showIcon still render their marker before validation');
}

// Attached labels are an existing style preset, with the same font inheritance.
{
  const p = project(), a = E.makeAction('pin', 20);
  assert.ok(!E.ACTION_TYPES.label.hidden, 'map label tool is available for custom atlas names');
  assert.equal(E.DEFAULT_LABEL_STYLE.placement, 'screen', 'old projects keep their screen-facing labels');
  assert.equal(E.LABEL_PRESETS.map2d.label, '2D · Attached to map');
  assert.equal(E.LABEL_PRESETS.map2d.style.placement, 'map');
  for (const [key, preset] of Object.entries(E.LABEL_PRESETS)) {
    if (!['map2d', 'atlasGround'].includes(key)) assert.equal(preset.style.placement, 'screen', `${key} switches an attached label back to screen-facing`);
  }
  p.labelStyle.font = 'Verdana';
  a.labelStyle = { ...E.LABEL_PRESETS.map2d.style };
  assert.equal(E.labelStyleOf(p, a).font, 'Verdana');
  assert.equal(E.labelStyleOf(p, a).placement, 'map');
  a.labelStyle.font = 'Georgia';
  p.actions = [a];
  assert.ok(E.mapFontsUsed(p).includes('Georgia'), 'attached labels load custom fonts for preview and export');
  assert.doesNotThrow(() => E.validateMapProject(p));
}

// Existing action labels can be attached through an item preset, and keep their
// ordinary timeline lifetime and completed appearance.
for (const [type, extra, labelText] of [
  ['pin', { place: place('Pin location', -8, 2), label: 'Pin label' }, 'Pin label'],
  ['highlight', { target: place('Spotlight', -8, 2), label: 'Place highlight', pulse: false }, 'Place highlight'],
  ['highlight', { target: { kind: 'country', name: 'Westland' }, label: 'Country highlight', pulse: false }, 'Country highlight'],
]) {
  const p = project(), a = E.makeAction(type, 20, { dur: 80, animDur: 20, ...extra });
  Object.assign(p.camera.init, { bearing: 35, pitch: 55 });
  p.actions = [a];
  const screen = text(render(p, 60), labelText);
  upright(screen);
  a.labelStyle = { ...E.LABEL_PRESETS.map2d.style };
  const onMap = text(render(p, 60), labelText);
  attached(onMap);
  assert.deepEqual(text(render(p, 80), labelText), onMap, `${labelText} holds its completed label through the clip`);
  const point = canvasPoint(onMap);
  p.camera.init.lon = 6;
  const moved = text(render(p, 60), labelText), movedPoint = canvasPoint(moved);
  assert.notEqual(movedPoint.x, point.x, `${labelText} follows the geographic location while panning`);
  p.camera.init.bearing = 75;
  assert.notDeepEqual(text(render(p, 60), labelText).matrix.slice(0, 4), moved.matrix.slice(0, 4), `${labelText} rotates with map bearing`);
  for (const frame of [0, 19, 100, 101]) {
    assert.deepEqual(render(p, frame).commands, render({ ...p, actions: [] }, frame).commands, `${labelText} disappears outside its timeline interval at ${frame}`);
  }
  const finished = text(render(p, 60), labelText);
  a.dur = 140;
  assert.deepEqual(text(render(p, 130), labelText), finished, `${labelText} holds when the timeline bar is extended`);
  assert.deepEqual(render(p, 160).texts, [], `${labelText} disappears at the extended clip end`);
  Object.assign(a.labelStyle, E.LABEL_PRESETS.clean.style);
  upright(text(render(p, 60), labelText));
}

// At the camera center, the text basis has exactly the same bearing rotation and
// pitch foreshortening as map geometry. This detects a merely screen-facing tag.
{
  const p = project(), f = geo.byName.get('Westland');
  Object.assign(p.camera.init, { lon: E.xToLon(f.cx), lat: E.yToLat(f.cy), bearing: 35, pitch: 55 });
  p.actions = [E.makeAction('highlight', 0, { dur: 120, animDur: 20, target: { kind: 'country', name: f.name }, pulse: false, labelStyle: { ...E.LABEL_PRESETS.map2d.style } })];
  const result = render(p, 60), label = text(result, f.name), v = result.view;
  for (const [i, expected] of [v.cb, -v.sb * v.cp, v.sb, v.cb * v.cp].entries()) near(label.matrix[i], expected, `map text basis component ${i}`);
  near(label.matrix[4], W / 2, 'centered geographic label transforms around the map anchor X');
  near(label.matrix[5], H / 2, 'centered geographic label transforms around the map anchor Y');
  const larger = render(p, 60, W * 2, H * 2), largeLabel = text(larger, f.name);
  assert.deepEqual(largeLabel.matrix.slice(0, 4), label.matrix.slice(0, 4), 'export resolution preserves label orientation');
  assert.ok(Math.abs(Number(largeLabel.font.match(/ (\d+)px /)[1]) - Number(label.font.match(/ (\d+)px /)[1]) * 2) <= 1, 'export resolution scales label font size with pixel rounding');
}

// Away from the center, perspective changes both the local glyph basis and its
// offset. Compare against independent finite differences of the map projection.
{
  const p = project(), loc = place('Perspective pin', 8, 4);
  Object.assign(p.camera.init, { bearing: 35, pitch: 55 });
  const a = E.makeAction('pin', 0, { dur: 120, animDur: 20, place: loc, labelStyle: { ...E.LABEL_PRESETS.map2d.style } });
  p.actions = [a];
  const result = render(p, 60), label = text(result, loc.name), v = result.view;
  const X = E.lonToX(loc.lon), Y = E.latToY(loc.lat), q = E.project(v, X, Y), step = .001;
  const xp = E.project(v, X + step / v.S, Y), xm = E.project(v, X - step / v.S, Y);
  const yp = E.project(v, X, Y + step / v.S), ym = E.project(v, X, Y - step / v.S);
  const expected = [(xp.x - xm.x) / (2 * step), (xp.y - xm.y) / (2 * step), (yp.x - ym.x) / (2 * step), (yp.y - ym.y) / (2 * step)];
  for (let i = 0; i < 4; i++) assert.ok(Math.abs(label.matrix[i] - expected[i]) < 1e-6, `perspective label basis component ${i} follows ground projection`);
  near(label.matrix[4], q.x, 'perspective label anchor follows projected longitude');
  near(label.matrix[5], q.y, 'perspective label anchor follows projected latitude');
  const fs = Number(label.font.match(/ (\d+)px /)[1]);
  near(label.x, 0, 'pin text is locally centered above its map anchor');
  near(label.y, -(a.size * v.unit * 24 * 2.5 + 14 * v.unit) + fs * .05, 'pin label offset is transformed with the map plane');
}

// A project preset also reaches the country name and city labels in area mode.
{
  const p = project();
  p.area = { ...p.area, mode: 'country', country: 'Westland', fit: false, name: true, cities: true };
  Object.assign(p.camera.init, { bearing: 30, pitch: 50 });
  geo.cities = [['West City', 0, -12, 'Westland']];
  const screen = render(p, 0);
  for (const label of screen.texts) upright(label);
  Object.assign(p.labelStyle, E.LABEL_PRESETS.map2d.style);
  const onMap = render(p, 0);
  assert.deepEqual(names(onMap), ['WESTLAND', 'West City']);
  for (const label of onMap.texts) attached(label);
  delete geo.cities;
}

// Detailed-country names also move onto the ground, instead of keeping the
// fixed title position used by the screen-facing preset.
{
  E.installCountryDetail(geo, {
    country: 'Westland', cities: [], features: [{
      properties: { key: 'Westland', name: 'Westland', level: 'country' },
      geometry: { type: 'Polygon', coordinates: [[[-20, -15], [0, -15], [0, 15], [-20, 15], [-20, -15]]] },
    }],
  });
  const p = project();
  p.area = { ...p.area, mode: 'country', country: 'Westland', fit: false, cities: false };
  Object.assign(p.camera.init, { bearing: 30, pitch: 50 });
  const screen = text(render(p, 0), 'WESTLAND');
  const fs = Number(screen.font.match(/ (\d+)px /)[1]);
  near(screen.x, W / 2 + fs * .14 / 2, 'detailed country retains its default header X with letter spacing');
  near(screen.y, 28 * (H / 720) + fs * .05, 'detailed country retains its default header Y');
  Object.assign(p.labelStyle, E.LABEL_PRESETS.map2d.style);
  const result = render(p, 0), label = text(result, 'WESTLAND'), b = geo.details.get('Westland').country.mainBox;
  const q = E.project(result.view, (b[0] + b[2]) / 2, (b[1] + b[3]) / 2);
  attached(label);
  near(label.matrix[4], q.x, 'attached detailed-country name uses a geographic anchor X');
  near(label.matrix[5], q.y, 'attached detailed-country name uses a geographic anchor Y');
  p.camera.init.lon = 5;
  assert.notEqual(text(render(p, 0), 'WESTLAND').matrix[4], label.matrix[4], 'detailed country name pans with the map');
  geo.details.delete('Westland');
}

// Labels crossing the near plane must not stretch across the frame. Both the
// anchor and the complete label bounds have to stay in front of the camera.
{
  const p = project();
  Object.assign(p.camera.init, { zoom: 4, pitch: 55 });
  const v = render(p, 0).view;
  for (const margin of [-1, 3]) {
    const Y = v.cy + (v.d - (v.near + margin)) / (v.sp * v.S);
    const loc = place('Clipped label', 0, E.yToLat(Y));
    p.actions = [E.makeAction('highlight', 0, { dur: 120, animDur: 20, target: loc, pulse: false, labelStyle: { ...E.LABEL_PRESETS.map2d.style, size: 80 } })];
    const q = E.project(v, E.lonToX(loc.lon), E.latToY(loc.lat));
    near(q.z, v.near + margin, 'near-plane fixture has the intended depth');
    assert.deepEqual(render(p, 60).texts, [], margin < 0 ? 'label behind the near plane is hidden' : 'label crossing the near plane is hidden while its anchor is in front');
  }
}

// Route names reveal at the traveler's actual entry, using animation duration
// rather than clip length. Endpoint names keep their independent switch.
for (const mode of ['direct', 'path']) {
  const p = project(), a = E.makeAction('plane', 20, {
    dur: 140, animDur: 100, easing: 'linear', mode,
    from: place('Origin', -15), to: place('Destination', 15),
    path: [{ lon: -15, lat: 0 }, { lon: -5, lat: 0 }, { lon: 5, lat: 0 }, { lon: 15, lat: 0 }],
    curve: 'straight', lift: 0, showLabels: false,
  });
  p.actions = [a];
  assert.equal(a.showRouteLabels, false, 'route place names are optional by default');
  assert.equal(a.routeLabelTiming, 'visited', 'new travel actions reveal names on entry');
  assert.deepEqual(names(render(p, 70)), [], `${mode}: disabled route and endpoint labels draw no text`);
  a.showLabels = true;
  assert.deepEqual(names(render(p, 70)), ['Destination', 'Origin'], `${mode}: endpoint names remain independently available`);
  a.showLabels = false;
  Object.assign(a, { showRouteLabels: true, routeLabelMode: 'country' });
  assert.deepEqual(names(render(p, 20)), ['Westland'], `${mode}: only the starting country appears at the start`);
  assert.deepEqual(names(render(p, 69.999)), ['Westland'], `${mode}: the next country stays hidden immediately before its border`);
  assert.deepEqual(names(render(p, 70)), ['Eastland', 'Westland'], `${mode}: the next country appears exactly when the traveler crosses its border`);
  assert.deepEqual(names(render(p, 70.001)), ['Eastland', 'Westland'], `${mode}: visited names remain immediately after the border crossing`);
  assert.deepEqual(names(render(p, 120)), ['Eastland', 'Westland'], `${mode}: earlier country names remain after reaching the destination`);
  assert.deepEqual(names(render(p, 30)), ['Westland'], `${mode}: scrubbing backward hides countries the traveler has not entered at that frame`);
  a.showLabels = true;
  assert.deepEqual(names(render(p, 70)), ['Destination', 'Eastland', 'Origin', 'Westland'], `${mode}: both sets of names can appear together`);
  for (const label of render(p, 70).texts) upright(label);
  a.toLabel = 'Eastland';
  assert.deepEqual(names(render(p, 20)), ['Origin', 'Westland'], `${mode}: a destination label matching a future country cannot reveal it at departure`);
  assert.deepEqual(names(render(p, 69.999)), ['Origin', 'Westland'], `${mode}: a matching destination name stays hidden until country entry`);
  assert.ok(names(render(p, 70)).includes('Eastland'), `${mode}: matching destination names become available when the country is entered`);
  a.toLabel = '';
  a.showLabels = false;
  for (const frame of [19, 160, 180]) assert.deepEqual(names(render(p, frame)), [], `${mode}: route names obey timeline visibility at frame ${frame}`);

  // Extending the timeline holds names after arrival without delaying entry.
  a.dur = 240;
  assert.deepEqual(names(render(p, 69.999)), ['Westland'], `${mode}: a longer timeline does not reveal the next country early`);
  assert.deepEqual(names(render(p, 70)), ['Eastland', 'Westland'], `${mode}: a longer timeline does not delay the border crossing`);
  assert.deepEqual(names(render(p, 250)), ['Eastland', 'Westland'], `${mode}: visited names hold through the extended timeline`);
  assert.deepEqual(names(render(p, 260)), [], `${mode}: names disappear at the extended clip end`);
  a.dur = 140;
  a.animDur = 40;
  assert.deepEqual(names(render(p, 39.999)), ['Westland'], `${mode}: a shorter animation uses its own border time`);
  assert.deepEqual(names(render(p, 40)), ['Eastland', 'Westland'], `${mode}: changing animation duration changes when a region is entered`);

  // Ease-in has traveled only .125 of the route halfway through its duration;
  // the halfway border is reached at cbrt(.5), between frames 99 and 100.
  Object.assign(a, { animDur: 100, easing: 'easeIn' });
  assert.deepEqual(names(render(p, 70)), ['Westland'], `${mode}: eased movement does not reveal regions at the linear border time`);
  assert.deepEqual(names(render(p, 99)), ['Westland'], `${mode}: the next region stays hidden until the eased traveler enters`);
  assert.deepEqual(names(render(p, 100)), ['Eastland', 'Westland'], `${mode}: the label reveals after the eased crossing`);
  Object.assign(a, { animDur: 100, easing: 'linear' });

  // Old projects may reach the renderer before validation. Neither the former
  // "all" value nor an absent value may restore the initial flood of names.
  for (const timing of ['all', undefined]) {
    if (timing === undefined) delete a.routeLabelTiming;
    else a.routeLabelTiming = timing;
    assert.deepEqual(names(render(p, 20)), ['Westland'], `${mode}: legacy timing ${timing} cannot reveal future countries before validation`);
    assert.deepEqual(names(render(p, 70)), ['Eastland', 'Westland'], `${mode}: legacy timing ${timing} still reveals at the crossing`);
    const reopened = E.validateMapProject(JSON.parse(JSON.stringify(p)));
    assert.equal(reopened.actions[0].routeLabelTiming, 'visited', `${mode}: saved legacy timing ${timing} migrates to on-entry reveal`);
    assert.deepEqual(names(render(reopened, 20)), ['Westland'], `${mode}: migrated projects keep future countries hidden`);
  }

  Object.assign(p.camera.init, { bearing: 35, pitch: 55 });
  Object.assign(p.labelStyle, E.LABEL_PRESETS.map2d.style);
  a.showLabels = true;
  const attachedRoute = render(p, 120);
  assert.deepEqual(names(attachedRoute), ['Destination', 'Eastland', 'Origin', 'Westland'], `${mode}: endpoints and crossed country names share the existing map-attached preset`);
  for (const label of attachedRoute.texts) attached(label);
  a.showLabels = false;
  assert.deepEqual(names(render(p, 20)), ['Westland'], `${mode}: attached labels start with the departure country only`);
  assert.deepEqual(names(render(p, 69.999)), ['Westland'], `${mode}: attached labels withhold the country ahead`);
  assert.deepEqual(names(render(p, 70)), ['Eastland', 'Westland'], `${mode}: attached names appear at the crossing`);
  for (const frame of [19, 160]) assert.deepEqual(names(render(p, frame)), [], `${mode}: attached route labels obey timeline visibility`);
  E.validateMapProject(p);
}

// Loaded administrative detail follows the same entry behavior: the next
// district appears at its own boundary, before the route enters another country.
{
  const rectangle = (key, name, left, right) => ({
    properties: { key, name, level: 'district' },
    geometry: { type: 'Polygon', coordinates: [[[left, -15], [right, -15], [right, 15], [left, 15], [left, -15]]] },
  });
  E.installCountryDetail(geo, {
    country: 'Westland', cities: [], features: [
      rectangle('west-district', 'West district', -20, -10),
      rectangle('east-district', 'East district', -10, 0),
    ],
  });
  for (const mode of ['direct', 'path']) {
    const p = project();
    p.actions = [E.makeAction('plane', 20, {
      dur: 120, animDur: 100, easing: 'linear', mode,
      from: place('Origin', -15), to: place('Destination', 15),
      path: [{ lon: -15, lat: 0 }, { lon: 15, lat: 0 }], curve: 'straight',
      lift: 0, showLabels: false, showRouteLabels: true, routeLabelMode: 'region',
    })];
    assert.deepEqual(names(render(p, 20)), ['West district'], `${mode}: only the initial district is named at departure`);
    assert.deepEqual(names(render(p, 36)), ['West district'], `${mode}: the following district stays hidden before entry`);
    assert.deepEqual(names(render(p, 37)), ['East district', 'West district'], `${mode}: entering a district reveals its name`);
    assert.deepEqual(names(render(p, 69.999)), ['East district', 'West district'], `${mode}: the foreign country stays hidden until entry`);
    assert.deepEqual(names(render(p, 70)), ['East district', 'Eastland', 'West district'], `${mode}: abroad, country fallback also reveals on entry`);
    assert.deepEqual(names(render(p, 20)), ['West district'], `${mode}: scrubbing resets region visibility from the current position`);
  }

  // Country-mode annotations can contain the same district names before a
  // travel action starts. Those map labels must not leak the route ahead.
  E.installCountryDetail(geo, {
    country: 'Westland',
    cities: [['East district', 2, -5, 'Westland'], ['Unrelated city', 7, -10, 'Westland']],
    features: [
      { ...rectangle('Westland', 'Westland', -20, 0), properties: { key: 'Westland', name: 'Westland', level: 'country' } },
      rectangle('west-district', 'West district · Westland', -20, -10),
      rectangle('east-district', 'East district · Westland', -10, 0),
    ],
  });
  const p = project();
  Object.assign(p.camera.init, { lon: -10, zoom: 3.5 });
  p.area = { ...p.area, mode: 'country', country: 'Westland', fit: false, cities: true, name: true };
  const baseline = names(render(p, 0));
  assert.ok(baseline.includes('East district'), 'country-mode fixture has a future district/city label without travel');
  assert.ok(baseline.includes('Unrelated city'), 'country-mode fixture has an unrelated annotation');
  p.actions = [E.makeAction('plane', 20, {
    dur: 120, animDur: 100, easing: 'linear',
    from: place('Origin', -15), to: place('Destination', 15),
    lift: 0, showLabels: false, showRouteLabels: true, routeLabelMode: 'region',
  })];
  const routeNames = result => names(result).filter(name => /district|Eastland/.test(name));
  assert.deepEqual(routeNames(render(p, 0)), [], 'country-mode route names do not appear before the travel clip');
  assert.deepEqual(routeNames(render(p, 20)), ['West district · Westland'], 'map annotations do not reveal future district names at departure');
  assert.deepEqual(routeNames(render(p, 36)), ['West district · Westland'], 'future district city and base aliases stay hidden before entry');
  assert.deepEqual(routeNames(render(p, 37)), ['East district · Westland', 'West district · Westland'], 'entered districts have one route label each without duplicate aliases');
  assert.deepEqual(routeNames(render(p, 140)), [], 'route-owned map names disappear when the clip ends');
  assert.ok(names(render(p, 20)).includes('Unrelated city'), 'unrelated map annotations remain available during travel');
  assert.ok(names(render(p, 140)).includes('Unrelated city'), 'unrelated map annotations remain after travel');
  Object.assign(p.actions[0], { showLabels: true, toLabel: 'East district' });
  assert.ok(!names(render(p, 36)).includes('East district'), 'a custom endpoint label matching a district alias stays hidden before entry');
  assert.ok(names(render(p, 37)).includes('East district'), 'a matching endpoint district alias appears when its region is entered');
  geo.details.delete('Westland');
}

// New fields survive file round trips and reject malformed imported settings.
{
  const p = project();
  p.actions = [E.makeAction('pin', 12, {
    dur: 90, animDur: 30, label: 'Saved map label', place: place('Saved anchor', 5, 3),
    showIcon: false, showLabel: true,
    labelStyle: { ...E.LABEL_PRESETS.map2d.style, font: 'Georgia', shape: 'rounded', useTheme: false, bg: '#334455', text: '#f5f5f5', size: 31 },
  }), E.makeAction('plane', 0, { showRouteLabels: true, routeLabelMode: 'region', routeLabelTiming: 'visited' })];
  Object.assign(p.labelStyle, E.LABEL_PRESETS.map2d.style);
  const reopened = E.validateMapProject(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(reopened.actions, p.actions, 'attached preset, fonts and route names survive save/reopen');
  assert.equal(reopened.actions[0].showIcon, false, 'saving and reopening preserves a text-only pin');
  assert.equal(reopened.actions[0].showLabel, true, 'saving and reopening preserves visible pin text');
  assert.deepEqual(reopened.labelStyle, p.labelStyle, 'project-wide attachment survives save/reopen');
  for (const showIcon of ['false', null, 0]) {
    const invalid = project(); invalid.actions = [E.makeAction('pin', 0, { showIcon })];
    assert.throws(() => E.validateMapProject(invalid), undefined, `rejects non-boolean marker visibility ${JSON.stringify(showIcon)}`);
  }
  for (const placement of ['ground', '', null, true, 2]) {
    const invalid = project(); invalid.actions = [E.makeAction('pin', 0, { labelStyle: { placement } })];
    assert.throws(() => E.validateMapProject(invalid), undefined, `rejects invalid per-action placement ${JSON.stringify(placement)}`);
    invalid.actions = [];
    invalid.labelStyle.placement = placement;
    assert.throws(() => E.validateMapProject(invalid), undefined, `rejects invalid project placement ${JSON.stringify(placement)}`);
  }
  const old = project(); delete old.labelStyle.placement;
  old.actions = [E.makeAction('pin', 0)];
  assert.doesNotThrow(() => E.validateMapProject(old), 'projects without placement retain backwards-compatible defaults');
  assert.equal(E.labelStyleOf(old, old.actions[0]).placement, 'screen');
  if (E.ACTION_TYPES.label) {
    const legacy = project();
    legacy.actions = [E.makeAction('label', 0, { text: 'Previously saved text', labelPlacement: 'map', place: place('Saved anchor', 5, 3) })];
    const saved = JSON.parse(JSON.stringify(legacy));
    assert.deepEqual(E.validateMapProject(saved).actions, legacy.actions, 'hidden legacy labels remain valid when reopening an existing project');
  }
  const travel = E.makeAction('plane', 0);
  for (const extra of [{ showRouteLabels: 'yes' }, { routeLabelMode: 'planet' }, { routeLabelTiming: 'future' }]) {
    const invalid = project(); invalid.actions = [{ ...travel, ...extra }];
    assert.throws(() => E.validateMapProject(invalid), undefined, `rejects invalid route label fields ${JSON.stringify(extra)}`);
  }
}

// Automatic geographic names use the same anchors and fixed fonts at every zoom.
{
  const p = project(); p.atlasLabels = { countries: true, oceans: false, declutter: false, scaleMode: 'fixed' };
  const a = render(p, 0), country = text(a, 'Westland');
  p.camera.init.zoom += 1;
  const b = render(p, 0), closer = text(b, 'Westland');
  assert.equal(country.font, closer.font, 'zoom leaves fixed label font size unchanged');
  assert.notDeepEqual(country.matrix.slice(4), closer.matrix.slice(4), 'geographic anchor follows camera zoom');
  p.camera.init.bearing = 30;
  const rotated = text(render(p, 0), 'Westland');
  assert.notEqual(rotated.matrix[1], 0, 'flat atlas text rotates with the map');
  p.atlasLabels.scaleMode = 'world'; p.atlasLabels.referenceZoom = p.camera.init.zoom;
  const atReference = text(render(p, 0), 'Westland'); p.camera.init.zoom++;
  const zoomed = text(render(p, 0), 'Westland');
  const pixels = t => Number(t.font.match(/([0-9.]+)px/)[1]);
  assert.ok(Math.abs(pixels(zoomed) - pixels(atReference) * 2) <= 1, 'optional geographic sizing scales with zoom within pixel rounding');
  const saved = JSON.parse(JSON.stringify(p)); E.validateMapProject(saved);
  assert.deepEqual(saved.atlasLabels, p.atlasLabels);
  assert.ok(E.mapFontsUsed(p).includes('Libre Baskerville'));
  for (const config of [{size: NaN}, {countries: 1}, {scaleMode: 'bad'}, {opacity: 2}, {text: 'red'}]) {
    const invalid = project(); invalid.atlasLabels = config;
    assert.throws(() => E.validateMapProject(invalid));
  }
  p.atlasLabels = { oceans: true, countries: false, declutter: false };
  p.camera.init = { lon: -40, lat: 32, zoom: 2, bearing: 0, pitch: 0 };
  assert.ok(names(render(p, 0)).includes('North Atlantic Ocean'), 'oceans can be enabled separately');
  p.atlasLabels = {countries: false, oceans: false};
  assert.deepEqual(names(render(p, 0)), [], 'both label groups can be disabled');
}
// Shape fitting follows country proportions and respects interior holes.
{
  const { countryLabelLayout } = await import('../map-atlas-labels.mjs');
  const makeFeature = (width, height, angle = 0) => {
    const a = angle * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    const points = [[-width/2,-height/2],[width/2,-height/2],[width/2,height/2],[-width/2,height/2],[-width/2,-height/2]].map(([x,y])=>[x*c-y*s,x*s+y*c]);
    return { mainBox: [Math.min(...points.map(p=>p[0])), Math.min(...points.map(p=>p[1])), Math.max(...points.map(p=>p[0])), Math.max(...points.map(p=>p[1]))], rings: [{n:5,xy:new Float64Array(points.flat())}] };
  };
  const center = {x:0,y:0}, wide=makeFeature(.2,.04), tall=makeFeature(.04,.2), diagonal=makeFeature(.2,.025,30);
  const a=countryLabelLayout(wide,center,5), b=countryLabelLayout(tall,center,5), c=countryLabelLayout(diagonal,center,5);
  assert.equal(a.angle,0,'wide countries get horizontal baselines');
  assert.equal(Math.abs(b.angle),90,'tall countries get vertical baselines');
  assert.equal(c.angle,30,'diagonal countries follow their shape');
  assert.ok(countryLabelLayout(makeFeature(.1,.02),center,5).width < a.width,'smaller countries receive smaller text footprints');
  assert.equal(countryLabelLayout(tall,center,5,false).angle,0,'automatic angles can be disabled');
  wide.rings.push({n:5,xy:new Float64Array([-.01,-.01,.01,-.01,.01,.01,-.01,.01,-.01,-.01])});
  assert.equal(countryLabelLayout(wide,center,4).width,0,'text cannot be fitted across a hole at its anchor');
}
console.log('map label tests passed');
