// FrameFlow Scene Studio engine (v2).
// Dependency-free perspective renderer. World units: metres; Y up; road runs along +Z.
// Finishes: smooth, grainy texture or halftone dots, per scene and per object.
// Characters: boy / girl / man / woman bodies, hair, facial hair, outfits and skin tones (object.look).
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

// ---------------------------------------------------------------- characters
// Body proportions are multipliers on the adult-man reference model (h = overall height).
export const BODIES = {
  man: { label: 'Character', h: 1, eye: 1.65, head: 1.65, torso: 1, leg: 1, limb: 1.12, hip: 1, waist: 1, chest: 1, sw: 1, neck: 1, bust: 0, arm: 1, foot: 1, hair: 'short' }
};
export const OUTFITS = {
  casual: { label: 'T-shirt & jeans',   bottom: '#3c4757', shoe: '#ecece7', sole: '#c5c5be', sleeve: 'short', bottomType: 'long' },
  hoodie: { label: 'Hoodie & trousers', bottom: '#4a4f57', shoe: '#2d3138', sole: '#e5e5e0', sleeve: 'long',  bottomType: 'long', hood: true },
  formal: { label: 'Suit & tie',        bottom: '#272b34', shoe: '#241d1a', sole: '#14110f', sleeve: 'long',  bottomType: 'long', jacket: true },
  sporty: { label: 'Sports kit',        bottom: '#2a2f3a', shoe: '#e8f0f5', sole: '#9aa7b0', sleeve: 'short', bottomType: 'shorts' },
  dress:  { label: 'Dress',             bottom: '#3c4757', shoe: '#4a3329', sole: '#2a1c15', sleeve: 'short', bottomType: 'skirt' }
};
export const HAIR_STYLES = { short: 'Short', buzz: 'Buzz cut', curly: 'Curly', bob: 'Bob', long: 'Long', ponytail: 'Ponytail', bun: 'Bun', bald: 'Bald' };
export const FACIAL = { none: 'Clean shaven', stubble: 'Stubble', beard: 'Beard' };
export const SKIN_TONES = ['#f6d7c0', '#ebbf98', '#d4a173', '#b07a4f', '#80532f', '#53341f'];
export const HAIR_COLORS = ['#17120f', '#38291f', '#6b4423', '#a56b32', '#d8b26a', '#b8432f', '#8f8f94', '#e8e6e0'];
export const defaultLook = () => ({ body: 'man', outfit: 'formal', hair: 'short', hairColor: '#483039', skin: '#ebbf98', bottomColor: '#3c4757', facial: 'none' });
// Legacy body choices retain clothing and colors but now share one detailed rig.
export const humanLook = o => ({ ...defaultLook(), ...(o.look || {}), body: 'man' });
export const heightOf = o => o.type === 'human' ? (BODIES[humanLook(o).body]?.h ?? 1) : 1;
const mixHex = (a, b, k) => { const x = a.slice(1).match(/../g).map(v => parseInt(v, 16)), y = b.slice(1).match(/../g).map(v => parseInt(v, 16)); return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join(''); };

// ---------------------------------------------------------------- objects, clips, scenes
export const makeClip = (gesture = 'walk', start = 0, dur = GESTURE_DURATION[gesture] || 2, speed = 1) => ({ id: newId(), gesture, start, dur, speed });
export function makeCameraClip(preset = 'third', start = 0, dur = 3, target = null) { const { mode, move, yaw, height, distance, fov } = CAMERA_PRESETS[preset]; return { id: newId(), mode, move, yaw, height, distance, fov, start, dur, blend: .5, target }; }
export function makeObject(type, i = 0) {
  return { id: newId(), type, name: type[0].toUpperCase() + type.slice(1), x: type === 'human' ? 5 : 0, z: i * 3, endX: type === 'human' ? 5 : 0, endZ: 35 + i * 3,
    start: 0, duration: 12, scale: 1, color: type === 'human' ? '#bd6663' : '#db795b', material: type === 'human' ? 'color' : 'inherit', easing: 'linear', visible: true, clips: [], ...(type === 'human' ? { look: defaultLook('man') } : {}) };
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
  const dir = o ? headingOf(o) : [0, 0, 1], eye = o?.type === 'human' ? (BODIES[humanLook(o).body]?.eye ?? 1.62 * heightOf(o)) * o.scale : 1.4 * (o?.scale || 1);
  let pos, look;
  if (c.move === 'static' && Number.isFinite(c.fixedX) && Number.isFinite(c.fixedZ)) {
    pos = [c.fixedX, c.height, c.fixedZ]; look = [c.aimX ?? live[0], c.aimHeight ?? 1, c.aimZ ?? live[2]];
  }
  else if (c.mode === 'first') { pos = [rig[0] + dir[0] * .12, eye, rig[2] + dir[2] * .12]; look = [pos[0] + dir[0] * 10, eye - .1, pos[2] + dir[2] * 10]; }
  else if (c.mode === 'second') { pos = [rig[0] + dir[0] * c.distance, c.height, rig[2] + dir[2] * c.distance]; look = [live[0], 1.1, live[2]]; }
  else { const yaw = rad(c.yaw + (c.move === 'orbit' ? (t - t0) * 18 : 0)); pos = [rig[0] + Math.sin(yaw) * c.distance, c.mode === 'bird' ? Math.max(20, c.height) : c.height, rig[2] - Math.cos(yaw) * c.distance]; look = [live[0], .9, live[2]]; }
  return { pos, look, fov: c.fov, hide: c.mode === 'first' && !(c.move === 'static' && Number.isFinite(c.fixedX)) ? o?.id : null };
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

// ---------------------------------------------------------------- finishes / textures
// Every texture is a repeating vector (or noise) tile. It is mapped onto each polygon in perspective, so it follows
// the plane of every surface (road, wall, roof, limb). `T` is the tile size in metres at scale 1, `S` the tile in pixels.
export const FINISHES = { none: 'Smooth', grain: 'Grainy texture', halftone: 'Halftone dots', stripes: 'Diagonal stripes', checks: 'Checkerboard', waves: 'Waves' };
const FX_SPEC = { grain: { S: 128, T: 1.6, a: .55 }, halftone: { S: 64, T: .12, a: .62 }, stripes: { S: 64, T: .18, a: .32 }, checks: { S: 64, T: .3, a: .3 }, waves: { S: 64, T: .28, a: .4 } };
const mkCanvas = (w, h) => { const c = typeof OffscreenCanvas !== 'undefined' ? new OffscreenCanvas(w, h) : document.createElement('canvas'); c.width = w; c.height = h; return c; };
const patCache = new Map();
const PAINT = {
  grain: (g, S) => {   // film-like specks; the same tile every frame so video export is stable
    const img = g.createImageData(S, S); let seed = 1234567; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < S * S; i++) { const v = rnd() < .5 ? 0 : 255; img.data.set([v, v, v, Math.round(rnd() * 150)], i * 4); }
    g.putImageData(img, 0, 0);
  },
  halftone: (g, S, level, st) => {   // 45-degree dot screen, dots grow with shadow level (1 light … 5 dark)
    const r = S * .354 * (level / 5) * (.55 + .6 * st); g.fillStyle = '#000';
    for (const [cx, cy] of [[S / 4, S / 4], [3 * S / 4, 3 * S / 4]]) for (const dx of [-S, 0, S]) for (const dy of [-S, 0, S]) { g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, 2 * Math.PI); g.fill(); }
  },
  stripes: (g, S) => { g.strokeStyle = '#000'; g.lineWidth = S * .22; for (const k of [-1, 0, 1]) { g.beginPath(); g.moveTo(-S, -S - k * S); g.lineTo(2 * S, 2 * S - k * S); g.stroke(); } },
  checks: (g, S) => { g.fillStyle = '#000'; g.fillRect(0, 0, S / 2, S / 2); g.fillRect(S / 2, S / 2, S / 2, S / 2); g.fillStyle = 'rgba(255,255,255,.85)'; g.fillRect(S / 2, 0, S / 2, S / 2); g.fillRect(0, S / 2, S / 2, S / 2); },
  waves: (g, S) => {
    g.strokeStyle = '#000'; g.lineWidth = S * .07; g.lineCap = 'round';
    for (const y0 of [S / 4, 3 * S / 4]) { g.beginPath(); for (let x = -4; x <= S + 4; x += 2) { const y = y0 + Math.sin(x / S * 2 * Math.PI) * S * .09; x === -4 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke(); }
  }
};
function fxPattern(ctx, kind, level = 0, strength = .6) {
  const spec = FX_SPEC[kind]; if (!spec) return null;
  const key = `${kind}|${kind === 'halftone' ? level : 0}|${kind === 'halftone' ? Math.round(strength * 10) : 0}`;
  let pat = patCache.get(key);
  if (!pat) { const c = mkCanvas(spec.S, spec.S); PAINT[kind](c.getContext('2d'), spec.S, level, strength); pat = ctx.createPattern(c, 'repeat'); if (patCache.size > 120) patCache.clear(); patCache.set(key, pat); }
  return pat;
}
// Plane of a polygon. The texture is projected along the dominant axis of the surface normal (a box mapping): static
// scenery uses world axes so a pattern runs on across neighbouring tiles; actors use their own local axes, so the
// pattern stays continuous over their surfaces and travels with them.
function planeOf(points, frame) {
  let n = [0, 0, 0]; for (let i = 0; i < points.length; i++) n = add(n, cross(points[i], points[(i + 1) % points.length]));
  const m = Math.hypot(...n); if (m < 1e-9) return null; n = mul(n, 1 / m);
  const X = frame?.X || [1, 0, 0], Z = frame?.Z || [0, 0, 1], ax = [Math.abs(dot(n, X)), Math.abs(n[1]), Math.abs(dot(n, Z))], big = ax.indexOf(Math.max(...ax));
  return { n, p: points[0], o: frame?.o || [0, 0, 0], U: big === 0 ? Z : X, V: big === 1 ? Z : [0, 1, 0] };
}

// ---------------------------------------------------------------- renderer
const BOX_FACES = [[0, 1, 2, 3], [4, 7, 6, 5], [0, 3, 7, 4], [1, 5, 6, 2], [3, 2, 6, 7], [0, 4, 5, 1]];
const LIGHT = norm([-.35, .85, -.4]);
export function renderScene(canvas, p, t) {
  const ctx = canvas.getContext('2d'), W = canvas.width, H = canvas.height, cam = cameraAt(p, t);
  const fwd = norm(sub(cam.look, cam.pos)), right = norm(cross(fwd, [0, 1, 0])), up = cross(right, fwd), focal = H / 2 / Math.tan(cam.fov * Math.PI / 360);
  const FX = p.finish || 'none', FXS = clamp(p.finishStrength ?? .6, 0, 1), FXSC = clamp(p.finishScale ?? 1, .1, 8);
  const white = p.material === 'white', faces = []; let layer = 3, group = null, fx = FX, fxs = FXSC, frame = null;
  ctx.fillStyle = white ? '#e9edef' : p.sky; ctx.fillRect(0, 0, W, H);
  if (FX === 'grain') { ctx.globalAlpha = .12 + .3 * FXS; ctx.fillStyle = fxPattern(ctx, 'grain'); ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
  const view = v => { const d = sub(v, cam.pos); return [dot(d, right), dot(d, up), dot(d, fwd)]; };
  const rgbOf = col => col.slice(1).match(/../g).map(x => parseInt(x, 16));

  function push(points, col, shade, bias = 0, alpha = 1) {
    const vs = points.map(view), out = [];
    for (let i = 0; i < vs.length; i++) { const a = vs[i], b = vs[(i + 1) % vs.length], ain = a[2] >= .15, bin = b[2] >= .15;
      if (ain) out.push(a); if (ain !== bin) { const k = (.15 - a[2]) / (b[2] - a[2]); out.push(a.map((x, j) => x + (b[j] - x) * k)); } }
    if (out.length < 3) return;
    const depth = out.reduce((s, v) => s + v[2], 0) / out.length;
    const tint = k => `rgb(${rgbOf(col).map(x => Math.round(Math.min(255, x * k))).join(',')})`, half = fx === 'halftone';
    faces.push({ layer, group, depth: depth - bias, zv: depth, alpha, fx, fxs, plane: fx !== 'none' ? planeOf(points, frame) : null, col: tint(half ? 1 : shade), level: half ? Math.round(clamp((1.05 - shade) / .6, 0, 1) * 5) : 0, pts: out.map(v => [W / 2 + v[0] * focal / v[2], H / 2 - v[1] * focal / v[2]]) });
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
        if (color == null) continue; lit([P(l0, o0), P(l0, o1), P(l1, o1), P(l1, o0)], color, c, bias); } }
  }
  const sphereFrame = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const shadow = (cx, cz, rx, rz, yaw) => { const keep = [layer, group], keepFx = fx; layer = 2.5; group = null; fx = 'none';
    push(Array.from({ length: 18 }, (_, i) => { const q = i / 18 * 2 * Math.PI, a = Math.cos(q) * rx, b = Math.sin(q) * rz; return [cx + a * Math.cos(yaw) + b * Math.sin(yaw), .03, cz - a * Math.sin(yaw) + b * Math.cos(yaw)]; }), '#000000', 1, 0, .24);
    [layer, group] = keep; fx = keepFx; };

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
    const [x, , z] = actorPosition(o, t), colored = o.material === 'texture' || o.material === 'color' || (o.material === 'inherit' && !white), col = colored ? o.color : '#f5f5f2', s = o.scale * heightOf(o);
    const yaw = Math.hypot(o.endX - o.x, o.endZ - o.z) < .1 ? 0 : Math.atan2(o.endX - o.x, o.endZ - o.z);
    const loc = (a, b, c) => [x + (a * Math.cos(yaw) + c * Math.sin(yaw)) * s, b * s, z + (-a * Math.sin(yaw) + c * Math.cos(yaw)) * s];
    const O = loc(0, 0, 0), dirW = (a, b, c) => norm(sub(loc(a, b, c), O));
    const lbox = (cx, y0, cz, w, h, d, color, bias = 0) => { const q = loc(cx, y0, cz); box(q[0], q[1], q[2], w * s, h * s, d * s, color, yaw, bias); };
    const dist = Math.hypot(x - cam.pos[0], z - cam.pos[2]), lod = dist < 14 ? 0 : dist < 40 ? 1 : 2, sides = [24, 14, 8][lod], limb = [16, 10, 6][lod], seg = [24, 14, 8][lod], rings = [16, 10, 6][lod];
    group = view(loc(0, .9, 0))[2]; fx = o.finish && o.finish !== 'inherit' ? o.finish : FX; fxs = FXSC * clamp(o.finishScale ?? 1, .1, 8); frame = { o: [x, 0, z], X: [Math.cos(yaw), 0, -Math.sin(yaw)], Z: [Math.sin(yaw), 0, Math.cos(yaw)] };
    if (o.type === 'human') drawHuman();
    else if (o.type === 'car' || o.type === 'bus') drawVehicle(o.type === 'bus');
    else if (o.type === 'tree') { lbox(0, 0, 0, .35, 2, .35, colored ? '#8d6e52' : col); lbox(0, 1.5, 0, 2.5, 2, 2.5, col); lbox(0, 3, 0, 1.6, 1.2, 1.6, col); }
    else if (o.type === 'building') { lbox(0, 0, 0, 4, 8, 5, col);
      if (colored && o.material !== 'color') for (let y = 1; y < 7; y += 1.5) for (let xx = -1.3; xx < 2; xx += 1.3) { lbox(xx, y, -2.51, .65, .8, .03, '#647f8c', 3); lbox(xx, y, 2.51, .65, .8, .03, '#647f8c', 3); } }
    if (o.type === 'human') shadow(x, z, .42 * s, .3 * s, yaw); else if (o.type === 'car') shadow(x, z, 1.15 * s, 2.35 * s, yaw); else if (o.type === 'bus') shadow(x, z, 1.4 * s, 4.7 * s, yaw);
    group = null; frame = null;

    function drawHuman() {
      const look = humanLook(o), B = BODIES[look.body] || BODIES.man, OF = OUTFITS[look.outfit] || OUTFITS.casual, P = humanPose(o, t);
      const C = colored
        ? { top: col, bottom: look.bottomColor, skin: look.skin, hair: look.hairColor, shoe: OF.shoe, sole: OF.sole, dark: '#1d1f22', chair: '#8a6f55', white: '#f4f4f0', tie: '#8c2f39',
            lip: mixHex(look.skin, B.bust || look.body === 'girl' ? '#c0505a' : '#8a3d35', B.bust || look.body === 'girl' ? .55 : .35), brow: look.hairColor }
        : { top: '#f5f5f2', bottom: '#e2e5e4', skin: '#f5f5f2', hair: '#dcdedd', shoe: '#d1d4d3', sole: '#eceeed', dark: '#b4b9bb', chair: '#eceeed', white: '#ffffff', tie: '#d4d8d9', lip: '#e6e8e7', brow: '#d0d3d2' };
      const k = s * B.limb, hs = s * B.head, tl = B.torso, shorts = OF.bottomType === 'shorts', skirt = OF.bottomType === 'skirt';
      const L1 = .41 * B.leg, L2 = .41 * B.leg, FH = .07, th = [P.lt, P.rt], kb = [P.lk, P.rk];
      const py = Math.max(...[0, 1].map(i => L1 * Math.cos(th[i]) + L2 * Math.cos(th[i] - kb[i]))) + FH + P.hop;
      const w = (a, b, c) => loc(a, b, c), vadd = (base, dirv, q) => add(base, mul(dirv, q)), wd = v => dirW(...v);
      // legs, trousers / shorts / bare legs, shoes
      [-1, 1].forEach((sd, i) => {
        const hip = [sd * .09 * B.hip, py, 0], knee = add(hip, [0, -L1 * Math.cos(th[i]), L1 * Math.sin(th[i])]), a = th[i] - kb[i], ankle = add(knee, [0, -L2 * Math.cos(a), L2 * Math.sin(a)]);
        const bare = shorts || skirt, mid = add(hip, mul(sub(knee, hip), .62));
        ball(w(...hip), .078 * k, .078 * k, .078 * k, sphereFrame, skirt ? C.top : C.bottom, seg, rings);
        if (shorts) { tube(w(...hip), w(...mid), .076 * k, .07 * k, C.bottom, limb, 0, 0, true); tube(w(...mid), w(...knee), .068 * k, .06 * k, C.skin, limb, 0, 0, false); }
        else tube(w(...hip), w(...knee), .076 * k, .06 * k, skirt ? C.skin : C.bottom, limb, 0, 0, false);
        ball(w(...knee), .06 * k, .06 * k, .06 * k, sphereFrame, bare ? C.skin : C.bottom, seg, rings);
        tube(w(...knee), w(...ankle), .058 * k, .043 * k, bare ? C.skin : C.bottom, limb, 0, 0, true);
        const fx = ankle[0], fy = ankle[1] - FH, fz = ankle[2] + .065 * B.foot;
        const shoeFrame = [wd([1,0,0]), wd([0,1,0]), wd([0,0,1])];
        ball(w(fx, fy + .037, fz), .062*s, .045*s, .145*s, shoeFrame, C.shoe, seg, rings);
        ball(w(fx, fy + .014, fz), .064*s, .017*s, .148*s, shoeFrame, C.sole, seg, 6);
        if (lod === 0) for (let j=0;j<4;j++) tube(w(fx-.035,fy+.077,fz+j*.015),w(fx+.035,fy+.077,fz+j*.015),.003*s,.003*s,C.white,6);

      });
      // torso: lofted rings shaped by body type (waist, bust, shoulders) and outfit (jacket, hoodie, skirt)
      const l = P.lean, U = [0, Math.cos(l), Math.sin(l)], F = [0, -Math.sin(l), Math.cos(l)], base = [0, py, 0];
      const spec = [
        { h: -.08, rx: .150 * B.hip, rz: .100 }, { h: 0, rx: .168 * B.hip, rz: .112 }, { h: .12, rx: .140 * B.waist, rz: .095 }, { h: .24, rx: .150 * B.chest, rz: .100 },
        { h: .36, rx: .168 * B.chest, rz: .108 + .03 * B.bust, fo: .012 * B.bust }, { h: .44, rx: .188 * B.sw, rz: .104 }, { h: .50, rx: .205 * B.sw, rz: .094 },
        { h: .535, rx: .115 * B.neck, rz: .08 }, { h: .555, rx: .075 * B.neck, rz: .065 }];
      const drop = skirt ? [{ h: -.36, rx: .27 * B.hip, rz: .2 }, { h: -.22, rx: .21 * B.hip, rz: .155 }]
        : OF.jacket ? [{ h: -.2, rx: .175 * B.hip, rz: .118 }] : OF.hood ? [{ h: -.14, rx: .172 * B.hip, rz: .116 }] : [];
      spec.unshift(...drop); const longTop = drop.length > 0;
      const centers = spec.map(r => vadd(vadd(base, U, r.h * tl), F, r.fo || 0));
      const R = spec.map((r, ri) => Array.from({ length: sides }, (_, q) => { const a = q / sides * 2 * Math.PI; return w(...add(centers[ri], add(mul([1, 0, 0], Math.cos(a) * r.rx), mul(F, Math.sin(a) * r.rz)))); }));
      const cw = centers.map(c => w(...c));
      for (let i = 0; i < R.length - 1; i++) for (let q = 0; q < sides; q++) { const q2 = (q + 1) % sides;
        lit([R[i][q], R[i][q2], R[i + 1][q2], R[i + 1][q]], (!longTop && i === 0) ? C.bottom : C.top, avg([cw[i], cw[i + 1]])); }
      lit(R[0], longTop ? C.top : C.bottom, cw[1]); lit(R.at(-1), C.top, cw.at(-2));
      const tf = [wd([1, 0, 0]), wd(U), wd(F)];
      if (lod < 2) {
        const front = .112 + .042 * B.bust, onTorso = (h, f) => w(...vadd(vadd(base, U, h * tl), F, f));
        if (OF.jacket) {   // white shirt V, tie and knot
          ball(onTorso(.38, front), .052 * s, .12 * s * tl, .01 * s, tf, C.white, 6, 3, null, .04);
          ball(onTorso(.34, front + .006), .02 * s, .1 * s * tl, .01 * s, tf, C.tie, 6, 3, null, .06);
          ball(onTorso(.44, front - .004), .026 * s, .022 * s, .014 * s, tf, C.tie, 6, 3, null, .06);
        }
        if (OF.hood) ball(onTorso(.56, -.07), .115 * s * B.neck, .08 * s, .085 * s, tf, C.top, seg, rings, null, .02);
      }
      // neck and head
      const neckH = .635 * tl;
      tube(w(...vadd(base, U, .52 * tl)), w(...vadd(base, U, neckH + .01)), .052 * s * B.neck, .046 * s * B.neck, C.skin, limb, 0, 0, false);
      const hc = vadd(base, U, neckH + .105 * B.head), cy = Math.cos(P.hy), sy = Math.sin(P.hy), f1 = add(mul(F, cy), mul([1, 0, 0], sy)), r1 = sub(mul([1, 0, 0], cy), mul(F, sy));
      const f2 = add(mul(f1, Math.cos(P.hp)), mul(U, -Math.sin(P.hp))), u2 = add(mul(U, Math.cos(P.hp)), mul(f1, Math.sin(P.hp)));
      const hf = [wd(r1), wd(u2), wd(f2)], hcw = w(...hc), at = (a, b, c) => hcw.map((v, i) => v + (hf[0][i] * a + hf[1][i] * b + hf[2][i] * c) * hs);
      const style = look.hair, hairOn = style !== 'bald', hairShade = style === 'buzz' ? mixHex(C.skin, C.hair, .78) : C.hair;
      const capMask = (y, x, z) => z > .38 ? y > .66 : (y > .22 || (z < -.1 && y > -.45) || (Math.abs(x) > .8 && y > -.05));
      const beardMask = (y, x, z) => y < -.2 && y > -.92 && z > -.15 && (z > .12 || Math.abs(x) > .72);
      const beardOn = colored && look.body === 'man' && look.facial !== 'none', beardColor = look.facial === 'beard' ? C.hair : mixHex(C.skin, C.hair, .4);
      ball(hcw, .095 * hs, .115 * hs, .105 * hs, hf, C.skin, seg, rings, (y, x, z) => hairOn && capMask(y, x, z) ? hairShade : beardOn && beardMask(y, x, z) ? beardColor : C.skin);
      const hv = (c, rx, ry, rz, mask, bias = .03) => ball(at(...c), rx * hs, ry * hs, rz * hs, hf, hairShade, seg, rings, mask ? (y, x, z) => mask(y, x, z) ? hairShade : null : null, bias);
      if (hairOn && style !== 'buzz') {
        hv([0, .012, -.014], .1015, .1215, .1125, capMask);
        if (style === 'long') { hv([0, -.13, -.055], .104, .2, .08, (y, x, z) => z < .25); for (const e of [-1, 1]) hv([e * .098, -.12, .012], .028, .15, .052, null); }
        else if (style === 'ponytail') {
          const a = at(0, .045, -.105), b = at(0, -.03, -.185), c = at(0, -.17, -.2), d = at(0, -.31, -.185);
          tube(a, b, .05 * hs, .05 * hs, hairShade, limb, .02, .02, false); tube(b, c, .05 * hs, .046 * hs, hairShade, limb, .02, .02, false); tube(c, d, .046 * hs, .02 * hs, hairShade, limb, .02, .02, true);
          ball(b, .056 * hs, .056 * hs, .056 * hs, sphereFrame, hairShade, seg, rings, null, .03);
        }
        else if (style === 'bun') hv([0, .125, -.05], .056, .052, .052, null);
        else if (style === 'bob') hv([0, -.045, -.012], .112, .105, .108, (y, x, z) => z < .25 ? true : y > .66);
        else if (style === 'curly') {
          hv([0, .035, -.012], .132, .126, .126, (y, x, z) => z > .5 ? y > .66 : y > -.45);
          for (const [a, b, c] of [[.105, .07, .02], [-.105, .07, .02], [.07, .115, 0], [-.07, .115, 0], [0, .14, -.02], [.1, -.03, -.06], [-.1, -.03, -.06], [0, -.04, -.115]]) hv([a, b, c], .055, .055, .055, null);
        }
      }
      // Sculpted facial volumes and fine features follow the animated head frame.
      const face = (x,y,z,rx,ry,rz,color,detail=16) => ball(at(x,y,z),rx*hs,ry*hs,rz*hs,hf,color, lod===0?detail:10,lod===0?10:6,null,.001);
      if (lod < 2) {
        face(0,-.062,.032,.069,.055,.071,C.skin,24); // jaw and chin
        face(0,-.006,.101,.012,.033,.014,C.skin);
        face(0,-.025,.119,.017,.015,.019,C.skin); // nose tip
        for (const e of [-1,1]) {
          face(e*.064,-.025,.072,.029,.033,.026,C.skin);
          face(e*.099,-.005,0,.019,.034,.023,C.skin);
          face(e*.107,-.004,.018,.009,.021,.006,C.lip);
          face(e*.039,.019,.095,.019,.014,.009,C.white);
          face(e*.039,.019,.103,.010,.012,.004,C.hair);
          face(e*.039,.019,.107,.005,.008,.002,C.dark);
          face(e*.036,.024,.109,.0025,.003,.0015,C.white,8);
          face(e*.041,.047,.095,.026,.006,.008,C.brow);
          face(e*.011,-.035,.122,.004,.0025,.002,C.lip,8);
          // Thin round glasses: actual 3D rim segments and temple arms.
          for (let j=0;j<24;j++) {
            const a=j*Math.PI/12,b=(j+1)*Math.PI/12;
            tube(at(e*.043+.032*Math.cos(a),.015+.029*Math.sin(a),.115),at(e*.043+.032*Math.cos(b),.015+.029*Math.sin(b),.115),.0018*hs,.0018*hs,C.sole,5);
          }
          tube(at(e*.075,.02,.115),at(e*.104,.02,-.012),.002*hs,.002*hs,C.sole,6);
        }
        tube(at(-.011,.022,.115),at(.011,.022,.115),.0018*hs,.0018*hs,C.sole,6);
        face(0,-.057,.096,.028,.014,.008,C.lip);
        face(0,-.056,.103,.023,.009,.003,C.dark);
        face(0,-.051,.106,.021,.0035,.002,C.white);
      }
      if (hairOn && style === 'short') {
        // Overlapping swept locks form a continuous hairstyle, with a side part.
        for (const [x,y,z,rx,ry,rz] of [[-.063,.066,.055,.037,.065,.045],[-.025,.108,.026,.055,.038,.072],[.026,.112,.009,.059,.037,.077],[.064,.086,-.009,.04,.043,.066],[.082,.038,-.03,.022,.048,.048]]) hv([x,y,z],rx,ry,rz,null,.001);
      }
      // arms: sleeves follow the outfit, hands are flattened ellipsoids along the forearm
      const arm = (sd, a, b) => [sd * Math.sin(b), -Math.cos(b) * Math.cos(a), Math.cos(b) * Math.sin(a)];
      const sleeve = OF.sleeve, upperC = sleeve === 'none' ? C.skin : C.top, foreC = sleeve === 'long' ? C.top : C.skin, elbowC = sleeve === 'long' ? C.top : C.skin;
      [[-1, P.la, P.lb, P.lc, P.ld], [1, P.ra, P.rb, P.rc, P.rd]].forEach(([sd, a, b, c, d]) => {
        const S = add(vadd(base, U, .47 * tl), [sd * .215 * B.sw, 0, 0]), E = vadd(S, arm(sd, a, b), .29 * B.arm), Wr = vadd(E, arm(sd, c, d), .26 * B.arm), fd = arm(sd, c, d);
        ball(w(...S), .062 * k, .062 * k, .062 * k, sphereFrame, upperC, seg, rings);
        tube(w(...S), w(...E), .052 * k, .045 * k, upperC, limb, 0, 0, false); ball(w(...E), .047 * k, .047 * k, .047 * k, sphereFrame, elbowC, seg, rings);
        tube(w(...E), w(...Wr), .042 * k, .031 * k, foreC, limb, 0, 0, true);
        const Uw = wd(fd), Rw = Math.abs(Uw[1]) > .95 ? [1, 0, 0] : norm(cross(Uw, [0, 1, 0])), Fw = cross(Rw, Uw);
        const palm = w(...vadd(Wr, fd, .04)), handFrame = [Rw, Uw, Fw];
        ball(palm, .032*k, .044*s, .018*k, handFrame, C.skin, seg, rings);
        const hp = (x,y,z) => add(palm,add(mul(Rw,x*s),add(mul(Uw,y*s),mul(Fw,z*s))));
        if (lod < 2) {
          // Four individually modelled fingers, knuckles and a separate thumb.
          for (let j=0;j<4;j++) {
            const xx=(j-1.5)*.016, len=[.049,.061,.057,.043][j], bend=activeClip(o.clips,t)?.gesture==='point' && j!==0 ? .022 : .006;
            const A=hp(xx,.029,0), Bp=hp(xx,.029+len*.52,bend), D=hp(xx,.029+len,bend*1.5);
            tube(A,Bp,.008*s,.007*s,C.skin,10); tube(Bp,D,.007*s,.0055*s,C.skin,10);
            ball(Bp,.007*s,.007*s,.007*s,handFrame,C.skin,10,6);
            ball(D,.0055*s,.006*s,.0055*s,handFrame,C.skin,10,6);
          }
          tube(hp(sd*.025,0,0),hp(sd*.047,.023,.005),.011*s,.009*s,C.skin,10);
          tube(hp(sd*.047,.023,.005),hp(sd*.052,.045,.009),.009*s,.006*s,C.skin,10);
        }

      });
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

  // Texture of one face: ray-cast the screen onto the face's plane so the tile keeps its true size and perspective.
  // Large faces (road, ground) are filled in small patches, each with its own local affine fit.
  function paintFx(f) {
    const spec = FX_SPEC[f.fx]; if (!spec || !f.plane || (f.fx === 'halftone' && f.level < 1)) return;
    const T = spec.T * f.fxs, S = spec.S, k = S / T, px = T * focal / Math.max(.2, f.zv);
    const fade = f.fx === 'grain' ? clamp((px / S - .3) / .9, 0, 1) : clamp((px - 5) / 10, 0, 1);
    if (fade <= .02) return;
    const pat = fxPattern(ctx, f.fx, f.level, FXS); if (!pat) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of f.pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    x0 = Math.max(0, Math.floor(x0)); y0 = Math.max(0, Math.floor(y0)); x1 = Math.min(W, Math.ceil(x1)); y1 = Math.min(H, Math.ceil(y1));
    if (x1 <= x0 || y1 <= y0) return;
    const { n, p: p0, o, U, V } = f.plane, base = dot(sub(p0, cam.pos), n);
    const hit = (sx, sy) => {
      const d = add(add(mul(right, (sx - W / 2) / focal), mul(up, (H / 2 - sy) / focal)), fwd), den = dot(d, n); if (Math.abs(den) < 1e-3) return null;
      const t = base / den; if (t <= 0) return null; const q = sub(add(cam.pos, mul(d, t)), o); return [dot(q, U) * k, dot(q, V) * k];
    };
    // Affine map pattern -> screen through three exact point pairs; the pattern repeats every S, so coordinates are wrapped.
    const affine = (s0, s1, s2, q0, q1, q2) => {
      const sx = Math.floor(q0[0] / S) * S, sy = Math.floor(q0[1] / S) * S, a0 = [q0[0] - sx, q0[1] - sy];
      const qa = [q1[0] - q0[0], q1[1] - q0[1]], qb = [q2[0] - q0[0], q2[1] - q0[1]], sa = [s1[0] - s0[0], s1[1] - s0[1]], sb = [s2[0] - s0[0], s2[1] - s0[1]], det = qa[0] * qb[1] - qb[0] * qa[1];
      if (Math.abs(det) < 1e-9) return null;
      const m00 = (sa[0] * qb[1] - sb[0] * qa[1]) / det, m01 = (sb[0] * qa[0] - sa[0] * qb[0]) / det, m10 = (sa[1] * qb[1] - sb[1] * qa[1]) / det, m11 = (sb[1] * qa[0] - sa[1] * qb[0]) / det;
      return [m00, m10, m01, m11, s0[0] - m00 * a0[0] - m01 * a0[1], s0[1] - m10 * a0[0] - m11 * a0[1]];
    };
    const path = () => { ctx.beginPath(); f.pts.forEach(([x, y], i) => i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)); ctx.closePath(); };
    ctx.globalAlpha = f.alpha * clamp(spec.a * (.5 + .8 * FXS), 0, 1) * fade; ctx.fillStyle = pat;
    let budget = 3000;   // triangles per face, keeps pathological views cheap
    const mid = (A, B) => vert((A.s[0] + B.s[0]) / 2, (A.s[1] + B.s[1]) / 2);
    const tri = (A, B, D, depth = 0) => {
      if (depth < 3 && budget > 0) {   // split where the perspective mapping is far from linear
        const M = [mid(A, B), mid(B, D), mid(D, A)];
        if (M.every(Boolean)) {
          let err = 0;
          [[A, B, M[0]], [B, D, M[1]], [D, A, M[2]]].forEach(([P1, P2, Mq]) => {
            const lq = Math.hypot(P2.q[0] - P1.q[0], P2.q[1] - P1.q[1]), ls = Math.hypot(P2.s[0] - P1.s[0], P2.s[1] - P1.s[1]);
            if (lq > 1e-6) err = Math.max(err, Math.hypot(Mq.q[0] - (P1.q[0] + P2.q[0]) / 2, Mq.q[1] - (P1.q[1] + P2.q[1]) / 2) * ls / lq);
          });
          if (err > .6) { budget -= 4; tri(A, M[0], M[2], depth + 1); tri(M[0], B, M[1], depth + 1); tri(M[2], M[1], D, depth + 1); tri(M[0], M[1], M[2], depth + 1); return; }
        }
      }
      const m = affine(A.s, B.s, D.s, A.q, B.q, D.q); if (!m) return;
      ctx.beginPath(); ctx.moveTo(...A.s); ctx.lineTo(...B.s); ctx.lineTo(...D.s); ctx.closePath(); ctx.setTransform(...m); ctx.fill(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    };
    const vert = (sx, sy) => { const q = hit(sx, sy); return q ? { s: [sx, sy], q } : null; };
    if (x1 - x0 <= 96 && y1 - y0 <= 96) {   // small face: one affine fit around its centre
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, A = vert(cx, cy), B = vert(cx + 8, cy), D = vert(cx, cy + 8); if (!A || !B || !D) return;
      const m = affine(A.s, B.s, D.s, A.q, B.q, D.q); if (!m) return; path(); ctx.setTransform(...m); ctx.fill(); ctx.setTransform(1, 0, 0, 1, 0, 0); return;
    }
    // large face (road, walls): a grid of triangles whose corners are ray-cast exactly, so the pattern stays continuous
    const nx = Math.ceil((x1 - x0) / 48), ny = Math.ceil((y1 - y0) / 48), gw = (x1 - x0) / nx, gh = (y1 - y0) / ny, G = [];
    for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) G.push(vert(x0 + i * gw, y0 + j * gh));
    ctx.save(); path(); ctx.clip();
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const A = G[j * (nx + 1) + i], B = G[j * (nx + 1) + i + 1], D = G[(j + 1) * (nx + 1) + i], E = G[(j + 1) * (nx + 1) + i + 1];
      if (A && B && D) tri(A, B, D); if (B && E && D) tri(B, E, D);
    }
    ctx.restore();
  }

  // far-to-near painter order: ground layers first, then actor groups, then faces within each group
  faces.sort((a, b) => a.layer - b.layer || (b.group ?? b.depth) - (a.group ?? a.depth) || b.depth - a.depth);
  for (const f of faces) {
    ctx.globalAlpha = f.alpha; ctx.beginPath(); f.pts.forEach(([px, py], i) => i ? ctx.lineTo(px, py) : ctx.moveTo(px, py)); ctx.closePath(); ctx.fillStyle = f.col; ctx.fill(); ctx.strokeStyle = f.col; ctx.lineWidth = .5; ctx.stroke();
    if (f.alpha >= .5) paintFx(f);
  }
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
  if (!Object.hasOwn(FINISHES, q.finish ?? 'none') || !finite(q.finishStrength ?? .6, 0, 1) || !finite(q.finishScale ?? 1, .1, 8)) throw Error('Invalid finish');
  const camSpec = k => { if (!CAMERA_MODES[k.mode] || !CAMERA_MOVES[k.move]) throw Error('Invalid camera');
    for (const [f, a, b] of [['yaw', -360, 360], ['height', 1, 60], ['distance', 2, 80], ['fov', 25, 100]]) if (!finite(k[f], a, b)) throw Error('Invalid camera value'); };
  const fixedSpec = c => { for (const key of ['fixedX','fixedZ','aimX','aimZ']) if (c[key] !== undefined && !finite(c[key], -100, 150)) throw Error('Invalid camera position'); if(c.aimHeight !== undefined && !finite(c.aimHeight,0,60)) throw Error('Invalid camera aim'); };
  camSpec(q.camera); fixedSpec(q.camera); q.cameraClips.forEach(fixedSpec);
  if (!Array.isArray(q.cameraClips) || q.cameraClips.length > 100) throw Error('Invalid camera shots');
  const ids = new Set();
  for (const c of q.cameraClips) { camSpec(c); if (typeof c.id !== 'string' || ids.has(c.id) || !finite(c.start, 0, q.duration) || !finite(c.dur, .1, 120) || !finite(c.blend ?? .5, 0, 5)) throw Error('Invalid camera shot timing'); ids.add(c.id); }
  const objIds = new Set();
  for (const o of q.objects) {
    if (typeof o.id !== 'string' || objIds.has(o.id) || typeof o.name !== 'string' || !['human', 'car', 'bus', 'tree', 'building'].includes(o.type) || !['inherit', 'white', 'color', 'texture'].includes(o.material) || !['linear', 'smooth'].includes(o.easing) || typeof o.visible !== 'boolean' || !HEX.test(o.color)) throw Error('Invalid object');
    objIds.add(o.id);
    if (!((o.finish ?? 'inherit') === 'inherit' || Object.hasOwn(FINISHES, o.finish)) || !finite(o.finishScale ?? 1, .1, 8)) throw Error('Invalid finish');
    if (o.type === 'human') { const lk = humanLook(o); if (!BODIES[lk.body] || !OUTFITS[lk.outfit] || !HAIR_STYLES[lk.hair] || !FACIAL[lk.facial] || ![lk.skin, lk.hairColor, lk.bottomColor].every(v => HEX.test(v))) throw Error('Invalid character look'); }
    for (const f of ['x', 'z', 'endX', 'endZ']) if (!finite(o[f], -100, 150)) throw Error('Invalid position');
    if (!finite(o.scale, .2, 4) || !finite(o.start, 0, q.duration) || !finite(o.duration, .1, 120)) throw Error('Invalid timing or scale');
    if (!Array.isArray(o.clips) || o.clips.length > 60) throw Error('Invalid gesture clips');
    for (const c of o.clips) { if (typeof c.id !== 'string' || ids.has(c.id) || !GESTURES[c.gesture] || !finite(c.start, 0, q.duration) || !finite(c.dur, .1, 120) || !finite(c.speed ?? 1, .25, 3)) throw Error('Invalid gesture clip'); ids.add(c.id); }
  }
  return q;
}