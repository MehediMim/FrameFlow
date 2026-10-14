// FrameFlow Scene Studio engine (v2).
// Dependency-free perspective renderer. World units: metres; Y up; road runs along +Z.
// v2 changes: gesture clips per human, camera clips, detailed human/car/bus models, lit + culled polygons.

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const GESTURES = { idle: 'Idle', walk: 'Walk', run: 'Run', wave: 'Wave', point: 'Point', jump: 'Jump', sit: 'Sit', clap: 'Clap', bow: 'Bow' };
export const GESTURE_DURATION = { idle: 2, walk: 4, run: 3, wave: 2, point: 2, jump: 1.1, sit: 3, clap: 2, bow: 2 };
export const CAMERA_MODES = { first: 'First person', second: 'Second person', third: 'Third person', bird: 'Bird’s-eye' };
export const CAMERA_MOVES = { follow: 'Follow subject', static: 'Locked off', orbit: 'Orbit subject' };
export const CAMERA_PRESETS = {
  first:  { label: 'First person',  icon: '◉', mode: 'first',  move: 'follow', yaw: 0,  height: 1.6, distance: 6,  fov: 70 },
  second: { label: 'Second person', icon: '◎', mode: 'second', move: 'follow', yaw: 0,  height: 1.7, distance: 4,  fov: 55 },
  third:  { label: 'Third person',  icon: '▣', mode: 'third',  move: 'follow', yaw: 25, height: 4,   distance: 10, fov: 60 },
  bird:   { label: 'Bird’s-eye',    icon: '✈', mode: 'bird',   move: 'follow', yaw: 0,  height: 30,  distance: 14, fov: 60 },
  orbit:  { label: 'Orbit',         icon: '↻', mode: 'third',  move: 'orbit',  yaw: 25, height: 4,   distance: 10, fov: 60 },
  locked: { label: 'Locked off',    icon: '⌖', mode: 'third',  move: 'static', yaw: 60, height: 3,   distance: 14, fov: 55 }
};
const SPEED = { walk: 1.4, run: 3.8 };           // metres per second at speed 1
const rad = d => d * Math.PI / 180, lerp = (a, b, k) => a + (b - a) * k, ease = k => k * k * (3 - 2 * k);
const newId = () => globalThis.crypto?.randomUUID?.() || 'id' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const add = (a, b) => a.map((v, i) => v + b[i]), sub = (a, b) => a.map((v, i) => v - b[i]), mul = (a, k) => a.map(v => v * k);
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = a => { const n = Math.hypot(...a) || 1; return a.map(x => x / n); };
const avg = pts => { const n = pts.length; return [0, 1, 2].map(i => pts.reduce((s, p) => s + p[i], 0) / n); };

// ---------------------------------------------------------------- objects, clips, scenes
export const makeClip = (gesture = 'walk', start = 0, dur = GESTURE_DURATION[gesture] || 2, speed = 1) => ({ id: newId(), gesture, start, dur, speed });
export function makeCameraClip(preset = 'third', start = 0, dur = 3, target = null) { const { mode, move, yaw, height, distance, fov } = CAMERA_PRESETS[preset]; return { id: newId(), mode, move, yaw, height, distance, fov, start, dur, blend: .5, target }; }
export function makeObject(type, i = 0) {
  return { id: newId(), type, name: type[0].toUpperCase() + type.slice(1), x: type === 'human' ? 5 : 0, z: i * 3, endX: type === 'human' ? 5 : 0, endZ: 35 + i * 3,
    start: 0, duration: 12, scale: 1, color: type === 'human' ? '#b6f36e' : '#db795b', material: 'inherit', easing: 'linear', visible: true, clips: [] };
}
export function defaultScene() {
  const human = { ...makeObject('human'), name: 'Human', clips: [makeClip('walk', 0, 4), makeClip('wave', 4, 2.5), makeClip('run', 6.5, 3), makeClip('bow', 9.5, 2.5)] };
  const car = { ...makeObject('car'), x: -2, endX: -2, z: 8, endZ: 55, name: 'Car' };
  return { kind: 'frameflow-scene', version: 2, name: 'A walk through the city', duration: 12, fps: 30, material: 'white', left: 'city', right: 'park', roadWidth: 8, sky: '#cbd9e2',
    camera: { mode: 'third', move: 'follow', yaw: 25, height: 5, distance: 12, fov: 60, target: null },
    objects: [human, car],
    cameraClips: [
      { ...makeCameraClip('third', 0, 5, human.id), yaw: 25, height: 4, distance: 9 },
      { ...makeCameraClip('second', 5, 3.5, human.id), distance: 4 },
      { ...makeCameraClip('orbit', 8.5, 3.5, human.id), distance: 8 }
    ] };
}
// Overlapping clips: the clip that starts later wins, earlier ones are cut off where the next one begins.
export function resolveClips(clips = []) {
  const s = [...clips].sort((a, b) => a.start - b.start);
  return s.map((c, i) => ({ ...c, end: Math.min(c.start + c.dur, s[i + 1] ? s[i + 1].start : Infinity) })).filter(c => c.end > c.start);
}
export const activeClip = (clips, t) => resolveClips(clips).find(c => t >= c.start && t < c.end) || null;

function pathLength(o) { return Math.hypot(o.endX - o.x, o.endZ - o.z); }
function travelled(o, t) {            // metres a human has walked/run by time t
  let d = 0;
  for (const c of resolveClips(o.clips)) { const sp = SPEED[c.gesture]; if (sp && t > c.start) d += sp * (c.speed || 1) * (Math.min(t, c.end) - c.start); }
  return d;
}
function travelFraction(o, t) {
  if (o.type === 'human') { const L = pathLength(o); return L < .01 ? 0 : Math.min(1, travelled(o, t) / L); }
  const k = clamp((t - o.start) / o.duration, 0, 1); return o.easing === 'smooth' ? ease(k) : k;
}
export function actorPosition(o, t) { const q = travelFraction(o, t); return [o.x + (o.endX - o.x) * q, 0, o.z + (o.endZ - o.z) * q]; }
export const headingOf = o => { const d = [o.endX - o.x, 0, o.endZ - o.z]; return Math.hypot(...d) < .1 ? [0, 0, 1] : norm(d); };

// ---------------------------------------------------------------- human poses
// Angles are radians. lt/rt: thigh swing (forward +), lk/rk: knee bend. la..ld / ra..rd: upper arm (forward, outward), forearm (forward, outward).
function idlePose(t) {
  const b = Math.sin(t * 2.1);
  return { lean: 0, hop: 0, hy: Math.sin(t * .4) * rad(3), hp: 0, lt: 0, lk: rad(3), rt: 0, rk: rad(3),
    la: .03 * b, lb: rad(7), lc: .18 + .04 * b, ld: rad(7), ra: -.03 * b, rb: rad(7), rc: .18 + .04 * b, rd: rad(7), sit: 0 };
}
function gesturePose(g, tl, sp = 1) {
  const P = idlePose(tl), set = o => Object.assign(P, o), TAU = 2 * Math.PI;
  if (g === 'walk') { const ph = TAU * .9 * sp * tl, s = Math.sin(ph), c = Math.cos(ph);
    set({ lean: rad(3), lt: rad(28) * s, rt: -rad(28) * s, lk: rad(6 + 42 * Math.max(0, c)), rk: rad(6 + 42 * Math.max(0, -c)),
      la: -rad(24) * s, ra: rad(24) * s, lc: -rad(24) * s + rad(20), rc: rad(24) * s + rad(20), lb: rad(6), rb: rad(6), hy: rad(3) * s }); }
  else if (g === 'run') { const ph = TAU * 1.35 * sp * tl, s = Math.sin(ph), c = Math.cos(ph);
    set({ lean: rad(14), lt: rad(48) * s, rt: -rad(48) * s, lk: rad(20 + 85 * Math.max(0, c)), rk: rad(20 + 85 * Math.max(0, -c)),
      la: -rad(55) * s, ra: rad(55) * s, lc: -rad(55) * s + rad(80), rc: rad(55) * s + rad(80), lb: rad(10), rb: rad(10), hy: rad(4) * s }); }
  else if (g === 'wave') set({ rb: rad(95), ra: 0, rc: 0, rd: rad(150) + rad(28) * Math.sin(TAU * 2.4 * sp * tl), hy: -rad(8), lean: rad(-2) });
  else if (g === 'point') set({ ra: rad(82), rb: rad(4), rc: rad(88), rd: rad(4), la: -rad(10), lb: rad(30), lc: rad(55), ld: rad(30), lean: rad(4), hy: rad(-10) });
  else if (g === 'jump') {
    const u = ((tl * sp) % 1.1) / 1.1, pts = [[0, 0], [.2, 1], [.3, 0], [.7, 0], [.78, .9], [1, 0]];
    let crouch = 0; for (let i = 0; i < pts.length - 1; i++) if (u >= pts[i][0] && u <= pts[i + 1][0]) crouch = lerp(pts[i][1], pts[i + 1][1], (u - pts[i][0]) / (pts[i + 1][0] - pts[i][0]));
    const air = u > .3 && u < .7 ? Math.sin(Math.PI * (u - .3) / .4) : 0, arms = rad(165) * air - rad(35) * crouch;
    set({ lt: rad(60) * crouch + rad(25) * air, rt: rad(60) * crouch + rad(25) * air, lk: rad(110) * crouch + rad(50) * air, rk: rad(110) * crouch + rad(50) * air,
      hop: .45 * air, la: arms, ra: arms, lc: arms, rc: arms, lb: rad(18), rb: rad(18), lean: rad(18) * crouch }); }
  else if (g === 'sit') set({ lt: rad(88), rt: rad(88), lk: rad(88), rk: rad(88), la: rad(35), ra: rad(35), lc: rad(80), rc: rad(80), lb: rad(12), rb: rad(12), lean: rad(4), sit: 1 });
  else if (g === 'clap') { const sw = .5 + .5 * Math.sin(TAU * 2.2 * sp * tl), d = rad(14) - rad(40) * sw;
    set({ la: rad(55), ra: rad(55), lb: rad(18), rb: rad(18), lc: rad(95), rc: rad(95), ld: d, rd: d, lean: rad(2) }); }
  else if (g === 'bow') { const l = rad(42) * (.5 - .5 * Math.cos(TAU * .45 * sp * tl)); set({ lean: l, hp: l * .35, la: rad(8), ra: rad(8), lc: rad(14), rc: rad(14) }); }
  return P;
}
const blendPose = (a, b, k) => Object.fromEntries(Object.keys(a).map(key => [key, lerp(a[key], b[key], k)]));
export function humanPose(o, t) {
  const cl = resolveClips(o.clips), act = cl.find(c => t >= c.start && t < c.end), B = .25, endPose = c => gesturePose(c.gesture, c.end - c.start, c.speed || 1);
  if (act) {
    const tl = t - act.start; let P = gesturePose(act.gesture, tl, act.speed || 1);
    if (tl < B) { const prev = [...cl].reverse().find(c => c.end <= act.start + 1e-6); P = blendPose(prev && act.start - prev.end < B ? endPose(prev) : idlePose(t), P, ease(tl / B)); }
    return P;
  }
  const last = [...cl].reverse().find(c => c.end <= t);
  return last && t - last.end < B ? blendPose(endPose(last), idlePose(t), ease((t - last.end) / B)) : idlePose(t);
}

// ---------------------------------------------------------------- camera
const subjectOf = (p, id) => p.objects.find(o => o.id === id) || p.objects.find(o => ['human', 'car', 'bus'].includes(o.type));
function rawCamera(p, c, t, t0) {
  const o = subjectOf(p, c.target), rig = o ? actorPosition(o, c.move === 'static' ? t0 : t) : [0, 0, 15], live = o ? actorPosition(o, t) : [0, 0, 15];
  const dir = o ? headingOf(o) : [0, 0, 1], eye = o?.type === 'human' ? 1.62 * o.scale : 1.4 * (o?.scale || 1);
  let pos, look;
  if (c.mode === 'first') { pos = [rig[0] + dir[0] * .12, eye, rig[2] + dir[2] * .12]; look = [pos[0] + dir[0] * 10, eye - .1, pos[2] + dir[2] * 10]; }
  else if (c.mode === 'second') { pos = [rig[0] + dir[0] * c.distance, c.height, rig[2] + dir[2] * c.distance]; look = [live[0], 1.1, live[2]]; }
  else { const yaw = rad(c.yaw + (c.move === 'orbit' ? (t - t0) * 18 : 0)); pos = [rig[0] + Math.sin(yaw) * c.distance, c.mode === 'bird' ? Math.max(20, c.height) : c.height, rig[2] - Math.cos(yaw) * c.distance]; look = [live[0], .9, live[2]]; }
  return { pos, look, fov: c.fov, hide: c.mode === 'first' ? o?.id : null };
}
const mixCam = (a, b, k) => ({ pos: a.pos.map((v, i) => lerp(v, b.pos[i], k)), look: a.look.map((v, i) => lerp(v, b.look[i], k)), fov: lerp(a.fov, b.fov, k), hide: k >= .5 ? b.hide : a.hide });
export function cameraAt(p, t) {
  const clips = resolveClips(p.cameraClips), base = () => rawCamera(p, p.camera, t, 0), act = clips.find(c => t >= c.start && t < c.end);
  if (act) {
    const cur = rawCamera(p, act, t, act.start), bl = act.blend ?? .5;
    if (bl > 0 && t < act.start + bl) { const prev = [...clips].reverse().find(c => c.end <= act.start + 1e-6), from = prev && act.start - prev.end < .02 ? rawCamera(p, prev, t, prev.start) : base(); return mixCam(from, cur, ease((t - act.start) / bl)); }
    return cur;
  }
  const last = [...clips].reverse().find(c => c.end <= t), bl = last?.blend ?? .5;
  return last && bl > 0 && t - last.end < bl ? mixCam(rawCamera(p, last, t, last.start), base(), ease((t - last.end) / bl)) : base();
}

// ---------------------------------------------------------------- renderer
const BOX_FACES = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 3, 7, 4], [1, 5, 6, 2], [3, 2, 6, 7], [0, 4, 5, 1]];
const LIGHT = norm([-.35, .85, -.4]);
export function renderScene(canvas, p, t) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, cam = cameraAt(p, t);
  const fwd = norm(sub(cam.look, cam.pos)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd), focal = H / 2 / Math.tan(cam.fov * Math.PI / 360);
  const white = p.material === 'white', faces = []; let layer = 3, group = null;
  ctx.fillStyle = white ? '#e9edef' : p.sky; ctx.fillRect(0, 0, W, H);
  const view = v => { const d = sub(v, cam.pos); return [dot(d, right), dot(d, up), dot(d, fwd)]; };
  const rgbOf = col => col.slice(1).match(/../g).map(x => parseInt(x, 16));

  function push(points, col, shade, bias = 0, alpha = 1) {
    const vs = points.map(view), out = [];
    for (let i = 0; i < vs.length; i++) { const a = vs[i], b = vs[(i + 1) % vs.length], ain = a[2] >= .15, bin = b[2] >= .15;
      if (ain) out.push(a); if (ain !== bin) { const k = (.15 - a[2]) / (b[2] - a[2]); out.push(a.map((x, j) => x + (b[j] - x) * k)); } }
    if (out.length < 3) return;
    const depth = out.reduce((s, v) => s + v[2], 0) / out.length;
    faces.push({ layer, group, depth: depth - bias, alpha, col: `rgb(${rgbOf(col).map(x => Math.round(Math.min(255, x * shade))).join(',')})`, pts: out.map(v => [W / 2 + v[0] * focal / v[2], H / 2 - v[1] * focal / v[2]]) });
  }
  // Lit polygon: normal is oriented away from `center`, back faces are culled, brightness follows a fixed key light.
  function lit(pts, col, center, bias = 0, cull = true) {
    let n = [0, 0, 0]; for (let i = 0; i < pts.length; i++) n = add(n, cross(pts[i], pts[(i + 1) % pts.length]));
    const m = Math.hypot(...n); if (m < 1e-9) return; n = mul(n, 1 / m);
    const c = avg(pts); if (dot(n, sub(c, center)) < 0) n = mul(n, -1);
    if (cull && dot(n, sub(cam.pos, c)) <= 0) return;
    push(pts, col, Math.min(1.05, .5 + .5 * Math.max(0, dot(n, LIGHT)) + .07 * n[1]), bias);
  }
  const solid = (v, col, bias = 0) => { const c = avg(v); BOX_FACES.forEach(f => lit(f.map(i => v[i]), col, c, bias)); };
  function box(x, y, z, w, h, d, col, yaw = 0, bias = 0) {
    const cs = Math.cos(yaw), sn = Math.sin(yaw);
    solid([[-1, 0, -1], [1, 0, -1], [1, 1, -1], [-1, 1, -1], [-1, 0, 1], [1, 0, 1], [1, 1, 1], [-1, 1, 1]].map(([a, b, c]) => [x + a * w / 2 * cs + c * d / 2 * sn, y + b * h, z - a * w / 2 * sn + c * d / 2 * cs]), col, bias);
  }
  // Round tube between two world points (tapered), used for limbs, wheels, poles.
  function tube(a, b, r0, r1, col, sides = 8, bias = 0, capBias = bias, caps = true) {
    const ax = norm(sub(b, a)), u = norm(cross(ax, Math.abs(ax[1]) > .95 ? [1, 0, 0] : [0, 1, 0])), v = cross(ax, u), mid = avg([a, b]);
    const ring = (c, r) => Array.from({ length: sides }, (_, k) => { const q = k / sides * 2 * Math.PI; return add(c, add(mul(u, Math.cos(q) * r), mul(v, Math.sin(q) * r))); });
    const A = ring(a, r0), B = ring(b, r1);
    for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; lit([A[k], A[k2], B[k2], B[k]], col, mid, bias); }
    if (caps) { lit(A, col, b, capBias); lit(B, col, a, capBias); }
  }
  // Ellipsoid with its own orientation; colorFn(y, x, z) picks the colour from unit-sphere coordinates.
  function ball(c, rx, ry, rz, frame, col, segs = 8, rings = 6, colorFn = null, bias = 0) {
    const [R, U, F] = frame, P = (la, lo) => add(c, add(add(mul(R, rx * Math.cos(la) * Math.sin(lo)), mul(U, ry * Math.sin(la))), mul(F, rz * Math.cos(la) * Math.cos(lo))));
    for (let i = 0; i < rings; i++) { const l0 = -Math.PI / 2 + i / rings * Math.PI, l1 = -Math.PI / 2 + (i + 1) / rings * Math.PI;
      for (let k = 0; k < segs; k++) { const o0 = k / segs * 2 * Math.PI, o1 = (k + 1) / segs * 2 * Math.PI, lm = (l0 + l1) / 2, om = (o0 + o1) / 2;
        const color = colorFn ? colorFn(Math.sin(lm), Math.cos(lm) * Math.sin(om), Math.cos(lm) * Math.cos(om)) : col;
        lit([P(l0, o0), P(l0, o1), P(l1, o1), P(l1, o0)], color, c, bias); } }
  }
  const sphereFrame = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const shadow = (cx, cz, rx, rz, yaw) => { const keep = [layer, group]; layer = 2.5; group = null;
    push(Array.from({ length: 18 }, (_, i) => { const q = i / 18 * 2 * Math.PI, a = Math.cos(q) * rx, b = Math.sin(q) * rz; return [cx + a * Math.cos(yaw) + b * Math.sin(yaw), .03, cz - a * Math.sin(yaw) + b * Math.cos(yaw)]; }), '#000000', 1, 0, .24);
    [layer, group] = keep; };

  // ---- ground, road, roadside
  const road = p.roadWidth / 2;
  for (let z = -50; z < 150; z += 10) {
    layer = 0; box(0, -.25, z, 170, .1, 10, white ? '#e5e8e7' : '#7d9970');
    layer = 1; box(0, -.11, z, p.roadWidth, .1, 10, white ? '#babfc2' : '#424c55'); box(-road - 1, 0, z, 2, .12, 10, white ? '#f4f5f4' : '#c5bfb2'); box(road + 1, 0, z, 2, .12, 10, white ? '#f4f5f4' : '#c5bfb2');
    layer = 2; box(0, .01, z, .12, .02, 3, '#f5f1dd');
  }
  layer = 3;
  function tree(x, z, colored) { box(x, 0, z, .35, 2, .35, colored ? '#8d6e52' : '#e4e5e3'); box(x, 1.5, z, 2.5, 2, 2.5, colored ? '#739b61' : '#fafbf7'); box(x, 3, z, 1.6, 1.2, 1.6, colored ? '#87aa71' : '#f2f4ef'); }
  const pole = (a, b, w, col) => tube(a, b, w / 2, w / 2, col, 6);
  for (const side of [-1, 1]) for (let i = 0; i < 16; i++) {
    const z = i * 9 - 30, x = side * (road + 5), style = side < 0 ? p.left : p.right, colored = !white;
    if (style === 'city') { const h = 4 + (i * 7 % 11); box(x, 0, z, 4, h, 6, colored ? ['#b9c9d0', '#c9b6a1', '#aab7ad'][i % 3] : '#fafafa');
      if (colored) for (let y = 1; y < h - 1; y += 1.6) for (let zz = -2; zz <= 2; zz += 1.5) box(x - side * 2.02, y, z + zz, .04, .85, .7, '#6b8798', 0, 3); }
    if (style === 'trees' || style === 'park') tree(x, z, colored);
    if (style === 'park') { layer = 1; box(x + side * 4, .02, z, 5, .06, 7, colored ? '#729264' : '#e8ebe5'); layer = 3; box(x, .6, z + 3, 2, .15, .6, colored ? '#997553' : '#f4f4f4'); box(x - .7, 0, z + 3, .15, .6, .4, '#a5aaa9'); box(x + .7, 0, z + 3, .15, .6, .4, '#a5aaa9'); }
    if (style === 'playground') { if (i % 2 === 0) { const metal = colored ? '#d2a05f' : '#eceeed';
      pole([x - 2, 0, z], [x - 1, 3, z], .14, metal); pole([x + 2, 0, z], [x + 1, 3, z], .14, metal); pole([x - 1, 3, z], [x + 1, 3, z], .14, metal);
      for (const dx of [-.5, .5]) pole([x + dx, 3, z], [x + dx, .65, z], .035, '#9fa8aa'); box(x, .6, z, 1.2, .12, .5, metal); } else tree(x, z, colored); }
  }

  // ---- actors
  for (const o of p.objects) {
    if (!o.visible || t < o.start || t > o.start + o.duration || o.id === cam.hide) continue;
    const [x, , z] = actorPosition(o, t), colored = o.material === 'texture' || o.material === 'color' || (o.material === 'inherit' && !white), col = colored ? o.color : '#f5f5f2', s = o.scale;
    const yaw = Math.hypot(o.endX - o.x, o.endZ - o.z) < .1 ? 0 : Math.atan2(o.endX - o.x, o.endZ - o.z);
    const loc = (a, b, c) => [x + (a * Math.cos(yaw) + c * Math.sin(yaw)) * s, b * s, z + (-a * Math.sin(yaw) + c * Math.cos(yaw)) * s];
    const O = loc(0, 0, 0), dirW = (a, b, c) => norm(sub(loc(a, b, c), O));
    const lbox = (cx, y0, cz, w, h, d, color, bias = 0) => { const q = loc(cx, y0, cz); box(q[0], q[1], q[2], w * s, h * s, d * s, color, yaw, bias); };
    const dist = Math.hypot(x - cam.pos[0], z - cam.pos[2]), lod = dist < 14 ? 0 : dist < 40 ? 1 : 2, sides = [10, 7, 5][lod], limb = [8, 6, 4][lod], seg = [10, 7, 5][lod], rings = [7, 5, 4][lod];
    group = view(loc(0, .9, 0))[2];
    if (o.type === 'human') drawHuman();
    else if (o.type === 'car' || o.type === 'bus') drawVehicle(o.type === 'bus');
    else if (o.type === 'tree') { lbox(0, 0, 0, .35, 2, .35, colored ? '#8d6e52' : col); lbox(0, 1.5, 0, 2.5, 2, 2.5, col); lbox(0, 3, 0, 1.6, 1.2, 1.6, col); }
    else if (o.type === 'building') { lbox(0, 0, 0, 4, 8, 5, col);
      if (colored && o.material !== 'color') for (let y = 1; y < 7; y += 1.5) for (let xx = -1.3; xx < 2; xx += 1.3) { lbox(xx, y, -2.51, .65, .8, .03, '#647f8c', 3); lbox(xx, y, 2.51, .65, .8, .03, '#647f8c', 3); } }
    if (o.type === 'human') shadow(x, z, .42 * s, .3 * s, yaw); else if (o.type === 'car') shadow(x, z, 1.15 * s, 2.35 * s, yaw); else if (o.type === 'bus') shadow(x, z, 1.4 * s, 4.7 * s, yaw);
    group = null;

    function drawHuman() {
      const P = humanPose(o, t), C = colored ? { shirt: col, pants: '#3c4757', skin: '#dcb590', hair: '#38291f', shoe: '#24272a', dark: '#1d1f22', chair: '#8a6f55' }
        : { shirt: '#f5f5f2', pants: '#e2e5e4', skin: '#f5f5f2', hair: '#dcdedd', shoe: '#d1d4d3', dark: '#b4b9bb', chair: '#eceeed' };
      const L1 = .41, L2 = .41, FH = .07, th = [P.lt, P.rt], kb = [P.lk, P.rk];
      const py = Math.max(...[0, 1].map(i => L1 * Math.cos(th[i]) + L2 * Math.cos(th[i] - kb[i]))) + FH + P.hop;
      const w = (a, b, c) => loc(a, b, c), vadd = (base, dirv, k) => add(base, mul(dirv, k));
      // legs and shoes
      [-1, 1].forEach((sd, i) => { const hip = [sd * .09, py, 0], knee = add(hip, [0, -L1 * Math.cos(th[i]), L1 * Math.sin(th[i])]), a = th[i] - kb[i], ankle = add(knee, [0, -L2 * Math.cos(a), L2 * Math.sin(a)]);
        ball(w(...hip), .078 * s, .078 * s, .078 * s, sphereFrame, C.pants, seg, rings);
        tube(w(...hip), w(...knee), .076 * s, .06 * s, C.pants, limb, 0, 0, false); ball(w(...knee), .06 * s, .06 * s, .06 * s, sphereFrame, C.pants, seg, rings);
        tube(w(...knee), w(...ankle), .058 * s, .043 * s, C.pants, limb, 0, 0, true);
        lbox(ankle[0], ankle[1] - FH, ankle[2] + .065, .105, .07, .27, C.shoe); });
      // torso (lofted rings along the leaned spine)
      const l = P.lean, U = [0, Math.cos(l), Math.sin(l)], F = [0, -Math.sin(l), Math.cos(l)], base = [0, py, 0];
      const R = [{ h: -.07, rx: .15, rz: .10 }, { h: .03, rx: .16, rz: .105 }, { h: .14, rx: .145, rz: .095 }, { h: .30, rx: .165, rz: .105 }, { h: .42, rx: .19, rz: .115 }, { h: .495, rx: .205, rz: .10 }, { h: .55, rx: .085, rz: .07 }]
        .map(r => { const c = vadd(base, U, r.h); return Array.from({ length: sides }, (_, k) => { const q = k / sides * 2 * Math.PI; return w(...add(c, add(mul([1, 0, 0], Math.cos(q) * r.rx), mul(F, Math.sin(q) * r.rz)))); }); });
      const body = avg(R.flat());
      for (let i = 0; i < R.length - 1; i++) for (let k = 0; k < sides; k++) { const k2 = (k + 1) % sides; lit([R[i][k], R[i][k2], R[i + 1][k2], R[i + 1][k]], i === 0 ? C.pants : C.shirt, body); }
      lit(R[0], C.pants, body); lit(R.at(-1), C.shirt, body);
      // neck and head
      const neckA = w(...vadd(base, U, .52)), neckB = w(...vadd(base, U, .64)); tube(neckA, neckB, .05 * s, .045 * s, C.skin, limb, 0, 0, false);
      const hc = vadd(base, U, .745), cy = Math.cos(P.hy), sy = Math.sin(P.hy), f1 = add(mul(F, cy), mul([1, 0, 0], sy)), r1 = sub(mul([1, 0, 0], cy), mul(F, sy));
      const f2 = add(mul(f1, Math.cos(P.hp)), mul(U, -Math.sin(P.hp))), u2 = add(mul(U, Math.cos(P.hp)), mul(f1, Math.sin(P.hp)));
      const wd = v => dirW(...v), hf = [wd(r1), wd(u2), wd(f2)], hcw = w(...hc);
      const hair = (y, xx, zz) => (y > .5 || (zz < -.1 && y > -.4) || (y > .25 && zz < .35)) ? C.hair : C.skin;
      ball(hcw, .095 * s, .115 * s, .105 * s, hf, C.skin, seg, rings, colored ? hair : null);
      if (lod < 2) { const at = (a, b, c) => hcw.map((v, i) => v + (hf[0][i] * a + hf[1][i] * b + hf[2][i] * c) * s);
        ball(at(0, -.012, .105), .017 * s, .02 * s, .02 * s, hf, C.skin, 5, 3); for (const e of [-1, 1]) { ball(at(e * .038, .02, .097), .011 * s, .011 * s, .008 * s, hf, C.dark, 5, 3); ball(at(e * .097, 0, 0), .014 * s, .028 * s, .02 * s, hf, C.skin, 5, 3); } }
      // arms
      const arm = (sd, a, b) => [sd * Math.sin(b), -Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a)];
      [[-1, P.la, P.lb, P.lc, P.ld], [1, P.ra, P.rb, P.rc, P.rd]].forEach(([sd, a, b, c, d]) => {
        const S = add(vadd(base, U, .47), [sd * .215, 0, 0]), E = vadd(S, arm(sd, a, b), .29), Wr = vadd(E, arm(sd, c, d), .26), Hd = vadd(Wr, arm(sd, c, d), .05);
        ball(w(...S), .062 * s, .062 * s, .062 * s, sphereFrame, C.shirt, seg, rings);
        tube(w(...S), w(...E), .052 * s, .045 * s, C.shirt, limb, 0, 0, false); ball(w(...E), .047 * s, .047 * s, .047 * s, sphereFrame, C.shirt, seg, rings);
        tube(w(...E), w(...Wr), .042 * s, .031 * s, C.skin, limb, 0, 0, true); ball(w(...Hd), .04 * s, .04 * s, .04 * s, sphereFrame, C.skin, seg, rings); });
      if (P.sit > .55) { const y0 = py - .13; lbox(0, y0, -.03, .5, .05, .46, C.chair); lbox(0, y0 + .05, -.26, .46, .5, .04, C.chair); for (const a of [-1, 1]) for (const b of [-1, 1]) lbox(a * .22, 0, -.03 + b * .19, .04, y0, .04, C.dark); }
    }

    function drawVehicle(bus) {
      const G = colored ? { body: col, glass: '#4d6672', dark: '#2a2e32', tire: '#1c1e20', rim: '#cfd5d8', head: '#fff1c0', tail: '#d63a36', trim: '#e9edee' }
        : { body: '#f5f5f2', glass: '#cfd6d8', dark: '#b9bfc1', tire: '#a8aeb0', rim: '#eceeee', head: '#ffffff', tail: '#d6dadb', trim: '#ffffff' };
      const hex = (y0, y1, z0, z1, wd, color, bias = 0) => { const v = [[-wd[0], y0, z0[0]], [wd[0], y0, z0[0]], [wd[1], y1, z0[1]], [-wd[1], y1, z0[1]], [-wd[0], y0, z1[0]], [wd[0], y0, z1[0]], [wd[1], y1, z1[1]], [-wd[1], y1, z1[1]]].map(q => loc(...q)); solid(v, color, bias); return v; };
      const panel = (v, face, u0, u1, v0, v1, color, bias = 3) => {
        const [A, B, Cc, D] = { L: [0, 4, 7, 3], R: [1, 5, 6, 2], F: [4, 5, 6, 7], B: [0, 1, 2, 3] }[face].map(i => v[i]), pt = (u, q) => [0, 1, 2].map(i => A[i] * (1 - u) * (1 - q) + B[i] * u * (1 - q) + Cc[i] * u * q + D[i] * (1 - u) * q);
        lit([pt(u0, v0), pt(u1, v0), pt(u1, v1), pt(u0, v1)], color, avg(v), bias);
      };
      const wheel = (cx, cy, cz, r, hw, sd, spin) => {
        const out = cx + sd * hw, a = loc(cx - hw, cy, cz), b = loc(cx + hw, cy, cz), tw = sides + 4;
        tube(a, b, r * s, r * s, G.tire, tw, -5, 5, false);                            // tread drawn first; side walls added below
        const wc = loc(cx, cy, cz), outward = dirW(sd, 0, 0);
        if (dot(outward, sub(cam.pos, wc)) <= 0) return;                               // decals only on the camera-facing side
        const inside = loc(cx - sd * 1.2, cy, cz);
        const disc = (rr, dx, color, bias) => lit(Array.from({ length: tw }, (_, k) => { const q = k / tw * 2 * Math.PI; return loc(out + sd * dx, cy + Math.cos(q) * rr, cz + Math.sin(q) * rr); }), color, inside, bias);
        disc(r * 1.06, .002, G.dark, 5); disc(r * .93, .004, G.tire, 6); disc(r * .64, .006, G.rim, 7);
        for (let k = 0; k < 5; k++) { const q = spin + k * 2 * Math.PI / 5, c = Math.cos(q), n = Math.sin(q), pw = .05 * r;
          lit([[out + sd * .008, cy + c * r * .08 - n * pw, cz + n * r * .08 + c * pw], [out + sd * .008, cy + c * r * .6 - n * pw, cz + n * r * .6 + c * pw], [out + sd * .008, cy + c * r * .6 + n * pw, cz + n * r * .6 - c * pw], [out + sd * .008, cy + c * r * .08 + n * pw, cz + n * r * .08 - c * pw]].map(v => loc(...v)), G.dark, inside, 8); }
        disc(r * .16, .01, G.dark, 9);
      };
      const spin = pathLength(o) * travelFraction(o, t) / (bus ? .5 : .33);
      if (!bus) {
        const lower = hex(.22, .68, [-2.2, -2.14], [2.2, 2.12], [.86, .91], G.body);
        hex(.68, .8, [-2.14, -2.04], [-.95, -1.05], [.9, .84], G.body);           // trunk deck
        hex(.68, .78, [.9, .95], [2.12, 1.95], [.9, .84], G.body);                 // bonnet
        const cab = hex(.68, 1.38, [-1.35, -.88], [.98, .28], [.84, .7], G.body);  // greenhouse
        for (const f of ['L', 'R']) { panel(cab, f, .07, .46, .14, .86, G.glass); panel(cab, f, .54, .93, .14, .86, G.glass); }
        panel(cab, 'F', .07, .93, .1, .88, G.glass); panel(cab, 'B', .08, .92, .12, .86, G.glass);
        hex(.2, .45, [-2.26, -2.22], [-2.1, -2.1], [.85, .87], G.dark); hex(.2, .45, [2.1, 2.1], [2.26, 2.22], [.85, .87], G.dark);
        for (const sd of [-1, 1]) { lbox(sd * .58, .5, 2.17, .3, .12, .07, G.head); lbox(sd * .6, .5, -2.19, .3, .12, .06, G.tail); lbox(sd * .97, .96, .62, .16, .1, .12, G.body); lbox(sd * .915, .21, 0, .03, .08, 2.7, G.dark);
          for (const zz of [-1.38, 1.38]) wheel(sd * .8, .33, zz, .33, .11, sd, spin); }
        lbox(0, .4, 2.2, .6, .14, .04, G.dark); lbox(0, .4, -2.24, .36, .14, .02, '#f2f2ee', 3);
      } else {
        const body = hex(.35, 3.2, [-4.5, -4.5], [4.5, 4.4], [1.25, 1.2], G.body);
        for (const f of ['L', 'R']) { for (let i = 0; i < 7; i++) panel(body, f, .06 + i * .13, .06 + i * .13 + .105, .42, .84, G.glass); panel(body, f, .0, 1, .2, .28, G.trim); }
        panel(body, 'R', .83, .96, .1, .8, G.dark, 4); panel(body, 'F', .06, .94, .46, .9, G.glass); panel(body, 'F', .3, .7, .92, .98, G.dark, 4); panel(body, 'B', .1, .9, .5, .85, G.glass);
        lbox(0, 3.2, -1.2, 1.4, .25, 2.4, G.trim); lbox(0, 3.2, 2.3, 1.2, .12, 1.2, G.trim);
        for (const sd of [-1, 1]) { lbox(sd * .8, .55, 4.46, .3, .16, .07, G.head); lbox(sd * .9, .55, -4.52, .3, .16, .06, G.tail);
          for (const zz of [-3, 3]) wheel(sd * 1.1, .5, zz, .5, .13, sd, spin); }
      }
    }
  }

  // far-to-near painter order: ground layers first, then actor groups, then faces within each group
  faces.sort((a, b) => a.layer - b.layer || (b.group ?? b.depth) - (a.group ?? a.depth) || b.depth - a.depth);
  for (const f of faces) { ctx.globalAlpha = f.alpha; ctx.beginPath(); f.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = f.col; ctx.fill(); ctx.strokeStyle = f.col; ctx.lineWidth = .5; ctx.stroke(); }
  ctx.globalAlpha = 1;
  return { faces: faces.length, camera: cam };
}

// ---------------------------------------------------------------- validation + migration
const HEX = /^#[0-9a-f]{6}$/i, finite = (x, a, b) => typeof x === 'number' && Number.isFinite(x) && x >= a && x <= b;
export function migrateScene(q) {
  if (q?.kind !== 'frameflow-scene' || ![1, 2].includes(q.version)) throw Error('Invalid Scene Studio project');
  if (q.version === 2) { q.cameraClips ||= []; return q; }
  const m = JSON.parse(JSON.stringify(q)); m.version = 2; m.cameraClips = [];
  for (const o of m.objects || []) { o.clips = o.type === 'human' && o.gesture ? [makeClip(o.gesture, o.start, o.duration)] : []; delete o.gesture; }
  const c = m.camera || {}, keys = [...(c.keys || [])].sort((a, b) => a.t - b.t);
  if (c.move === 'keyframes' && keys.length) m.cameraClips = keys.map((k, i) => ({ id: newId(), mode: c.mode, move: 'follow', yaw: k.yaw, height: k.height, distance: k.distance, fov: k.fov, target: c.target || null, start: k.t, dur: Math.max(.1, (keys[i + 1]?.t ?? m.duration) - k.t), blend: .5 }));
  if (c.move === 'keyframes') c.move = 'follow'; delete c.keys; return m;
}
export function validateScene(input) {
  const q = migrateScene(input);
  if (typeof q.name !== 'string' || !finite(q.duration, 1, 120) || ![24, 30, 60].includes(q.fps) || !Array.isArray(q.objects) || q.objects.length > 80) throw Error('Invalid Scene Studio project');
  if (!['white', 'texture'].includes(q.material) || !HEX.test(q.sky) || !finite(q.roadWidth, 4, 20) || ![q.left, q.right].every(v => ['city', 'park', 'trees', 'playground', 'none'].includes(v))) throw Error('Invalid environment');
  const camSpec = k => { if (!CAMERA_MODES[k.mode] || !CAMERA_MOVES[k.move]) throw Error('Invalid camera');
    for (const [f, a, b] of [['yaw', -360, 360], ['height', 1, 60], ['distance', 2, 80], ['fov', 25, 100]]) if (!finite(k[f], a, b)) throw Error('Invalid camera value'); };
  camSpec(q.camera);
  if (!Array.isArray(q.cameraClips) || q.cameraClips.length > 100) throw Error('Invalid camera shots');
  const ids = new Set();
  for (const c of q.cameraClips) { camSpec(c); if (typeof c.id !== 'string' || ids.has(c.id) || !finite(c.start, 0, q.duration) || !finite(c.dur, .1, 120) || !finite(c.blend ?? .5, 0, 5)) throw Error('Invalid camera shot timing'); ids.add(c.id); }
  const objIds = new Set();
  for (const o of q.objects) {
    if (typeof o.id !== 'string' || objIds.has(o.id) || typeof o.name !== 'string' || !['human', 'car', 'bus', 'tree', 'building'].includes(o.type) || !['inherit', 'white', 'color', 'texture'].includes(o.material) || !['linear', 'smooth'].includes(o.easing) || typeof o.visible !== 'boolean' || !HEX.test(o.color)) throw Error('Invalid object');
    objIds.add(o.id);
    for (const f of ['x', 'z', 'endX', 'endZ']) if (!finite(o[f], -100, 150)) throw Error('Invalid position');
    if (!finite(o.scale, .2, 4) || !finite(o.start, 0, q.duration) || !finite(o.duration, .1, 120)) throw Error('Invalid timing or scale');
    if (!Array.isArray(o.clips) || o.clips.length > 60) throw Error('Invalid gesture clips');
    for (const c of o.clips) { if (typeof c.id !== 'string' || ids.has(c.id) || !GESTURES[c.gesture] || !finite(c.start, 0, q.duration) || !finite(c.dur, .1, 120) || !finite(c.speed ?? 1, .25, 3)) throw Error('Invalid gesture clip'); ids.add(c.id); }
  }
  return q;
}
