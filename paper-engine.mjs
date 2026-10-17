// FrameFlow Paper Studio engine: animated newspaper scenes (sheet, parts, camera).
// Pure data + canvas drawing. No DOM access except an optional canvas / image factory.
import { easings, fontStack } from './engine.mjs?v=motion-media-1';

export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const num = (v, d) => (Number.isFinite(+v) && v !== '' && v !== null ? +v : d);
const timingFrame = (v, fallback, min) => {
  if (v === undefined || v === null || v === '') return fallback;
  const n = Math.round(Number(v));
  if (!Number.isSafeInteger(n)) throw Error('Invalid item timing.');
  return Math.max(min, n);
};
const validateTiming = it => {
  if (!Number.isSafeInteger(it.start + it.dur)) throw Error('Invalid item timing.');
  return it;
};
export const uid = () => globalThis.crypto?.randomUUID?.() || 'p' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
function hash(a, b = 0, c = 0) {
  let x = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263) + Math.imul(c | 0, 2147483647)) | 0;
  x = Math.imul(x ^ (x >>> 13), 1274126177); x ^= x >>> 16; return (x >>> 0) / 4294967296;
}

// ------------------------------------------------------------------ environment hooks (tests can replace these)
let makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const c = document.createElement('canvas'); c.width = w; c.height = h; return c;
};
let scratch = null, noiseTile = null, fontEpoch = 0;
export function setCanvasFactory(fn) { makeCanvas = fn; scratch = null; noiseTile = null; }
/** Call after a web font finishes loading so cached text layouts are measured again. */
export function bumpFonts() { fontEpoch++; }
const measureCtx = () => (scratch ||= makeCanvas(8, 8).getContext('2d'));

const imgCache = new Map();
let imageLoader = src => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(Error('Image failed to load')); i.src = src; });
export function setImageLoader(fn) { imageLoader = fn; imgCache.clear(); }
function imageFor(src, onReady) {
  if (!src) return null;
  const e = imgCache.get(src); if (e) return e.img || null;
  const entry = { img: null }; imgCache.set(src, entry);
  imageLoader(src).then(i => { entry.img = i; onReady && onReady(); }).catch(() => { /* leave placeholder */ });
  return null;
}
export async function preloadImages(proj) {
  for (const src of Object.values(proj.assets || {})) {
    if (imgCache.get(src)?.img) continue;
    try { imgCache.set(src, { img: await imageLoader(src) }); } catch { /* skip broken image */ }
  }
}

const cache = new Map();
function cached(key, fn, max = 400) {
  let v = cache.get(key); if (v) return v;
  v = fn(); cache.set(key, v); if (cache.size > max) cache.delete(cache.keys().next().value); return v;
}
const canvasCache = new Map();
function cachedCanvas(key, fn) {
  let v = canvasCache.get(key); if (v) return v;
  v = fn(); canvasCache.set(key, v); if (canvasCache.size > 24) canvasCache.delete(canvasCache.keys().next().value); return v;
}

// ------------------------------------------------------------------ matrices [a,b,c,d,e,f]
const mmul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const mtr = (x, y) => [1, 0, 0, 1, x, y];
const mrot = r => [Math.cos(r), Math.sin(r), -Math.sin(r), Math.cos(r), 0, 0];
const msc = s => [s, 0, 0, s, 0, 0];
const minv = m => { const d = m[0] * m[3] - m[1] * m[2]; return [m[3] / d, -m[1] / d, -m[2] / d, m[0] / d, (m[2] * m[5] - m[3] * m[4]) / d, (m[1] * m[4] - m[0] * m[5]) / d]; };
export const mapply = (m, x, y) => ({ x: m[0] * x + m[2] * y + m[4], y: m[1] * x + m[3] * y + m[5] });
const RAD = Math.PI / 180;

// ------------------------------------------------------------------ catalogues
export const STOCKS = {
  newsprint: { label: 'Newsprint', color: '#e6dfcb', ink: '#1d1b18', wear: .25 },
  white: { label: 'Crisp white', color: '#f5f3ec', ink: '#16151a', wear: .08 },
  aged: { label: 'Aged yellow', color: '#dcc896', ink: '#2b2114', wear: .6 },
  sepia: { label: 'Sepia', color: '#cfb68c', ink: '#33261a', wear: .7 },
  pink: { label: 'Financial pink', color: '#f1d4c6', ink: '#2a1a18', wear: .15 },
  grey: { label: 'Recycled grey', color: '#d5d3cb', ink: '#1f2124', wear: .3 },
};
export const SCENES = { dark: 'Dark studio', light: 'Soft light', wood: 'Wooden desk', cork: 'Corkboard', color: 'Solid color' };
export const EDGES = { clean: 'Clean cut', torn: 'Torn edge' };
export const FOLDS = { none: 'No folds', half: 'Folded once', quarter: 'Folded twice' };
export const SHEET_ENTRANCES = { none: 'Already there', spin: 'Spin in', slideUp: 'Slide up', drop: 'Drop in', zoom: 'Zoom in', slap: 'Slap down' };
export const ANIMS = {
  none: 'Appears instantly', fade: 'Fade in', slideUp: 'Slide up', slideDown: 'Slide down', slideLeft: 'Slide in from the right', slideRight: 'Slide in from the left',
  pop: 'Pop', slam: 'Slam', wipe: 'Wipe (left to right)', type: 'Typewriter', words: 'Word by word', lines: 'Line by line', draw: 'Draw on',
};
export const EASE_OPTS = [['easeOut', 'Ease out'], ['easeInOut', 'Ease in & out'], ['linear', 'Linear'], ['easeIn', 'Ease in'], ['backOut', 'Overshoot']];
export const PLACEHOLDERS = { bridge: 'Bridge at sunrise', city: 'City skyline', person: 'Portrait' };
export const TREATMENTS = { bw: 'Black & white', halftone: 'Newspaper halftone', sepia: 'Sepia', color: 'Original color' };
export const MARKER_STYLES = { highlight: 'Highlighter', underline: 'Underline', circle: 'Circle', box: 'Box', strike: 'Strike through' };
export const RULE_STYLES = { single: 'Single', double: 'Double', thickThin: 'Thick & thin', dotted: 'Dotted', dashed: 'Dashed' };
export const DECO_SHAPES = { tape: 'Tape', pin: 'Push pin' };
export const SHOT_TYPES = {
  focus: { label: 'Focus on a part', icon: '◎', hint: 'Glides the camera to a headline, photo or any part', fields: ['target', 'fill', 'level'] },
  showAll: { label: 'Show whole sheet', icon: '▢', hint: 'Pulls back so the full sheet is visible', fields: [] },
  push: { label: 'Push in', icon: '⊕', hint: 'Slow zoom in, optionally toward a part', fields: ['target', 'amount'] },
  pull: { label: 'Pull out', icon: '⊖', hint: 'Zooms out', fields: ['amount'] },
  pan: { label: 'Pan', icon: '⇄', hint: 'Slides the camera across the sheet', fields: ['dx', 'dy'] },
  tilt: { label: 'Tilt / rotate', icon: '⟳', hint: 'Rotates the camera', fields: ['degrees'] },
  shake: { label: 'Camera shake', icon: '≋', hint: 'A quick impact shake, great with slams', fields: ['amp'] },
};

const INK = '#1d1b18';
const TEXT_ANIMS = ['wipe', 'type', 'words', 'slam', 'pop', 'fade', 'slideUp', 'slideDown', 'none'];
/** Every kind of part. `def` holds all fields the renderer reads. */
export const KINDS = {
  headline: { label: 'Headline', icon: 'H', hint: 'Big bold headline. It shrinks to fit its box.', anims: TEXT_ANIMS,
    def: { x: 50, y: 200, w: 1000, h: 200, text: 'YOUR HEADLINE GOES HERE', font: 'Playfair Display', weight: 800, size: 110, color: INK, align: 'left', valign: 'middle', italic: false, caps: true, lineH: 1.02, spacing: 0, autoFit: true, bg: '', border: 0, borderColor: INK, pad: 0, anim: 'wipe', dur: 28, easing: 'easeOut' } },
  text: { label: 'Text', icon: 'T', hint: 'Subheading, byline, caption or sidebar box', anims: ['fade', 'type', 'words', 'lines', 'wipe', 'slideUp', 'slideLeft', 'slideRight', 'none'],
    def: { x: 50, y: 420, w: 520, h: 120, text: 'Write something here.', font: 'Libre Baskerville', weight: 400, size: 28, color: INK, align: 'left', valign: 'top', italic: false, caps: false, lineH: 1.35, spacing: 0, autoFit: false, bg: '', border: 0, borderColor: INK, pad: 0, anim: 'fade', dur: 18, easing: 'easeOut' } },
  masthead: { label: 'Masthead', icon: '♛', hint: 'Newspaper name with rules and a date line', anims: ['wipe', 'type', 'fade', 'slideDown', 'pop', 'none'],
    def: { x: 50, y: 40, w: 1000, h: 150, text: 'THE DAILY CHRONICLE', font: 'UnifrakturCook', weight: 700, size: 100, color: INK, metaL: 'VOL. 1 · NO. 1', metaC: 'TUESDAY, OCTOBER 13, 2026', metaR: 'PRICE: FREE', metaFont: 'Libre Baskerville', rules: 'double', anim: 'wipe', dur: 20, easing: 'easeOut' } },
  columns: { label: 'Columns', icon: '☰', hint: 'Body text flowing through newspaper columns', anims: ['lines', 'wipe', 'type', 'fade', 'none'],
    def: { x: 50, y: 600, w: 1000, h: 420, text: '', font: 'Source Serif 4', weight: 400, size: 16, color: INK, lineH: 1.38, cols: 3, gap: 28, justify: true, dropCap: true, rules: true, mode: 'text', anim: 'lines', dur: 40, easing: 'linear' } },
  photo: { label: 'Photo', icon: '▧', hint: 'Picture with caption. Upload your own or use a sample.', anims: ['wipe', 'fade', 'pop', 'slam', 'slideUp', 'slideLeft', 'slideRight', 'none'],
    def: { x: 50, y: 440, w: 560, h: 380, img: '', placeholder: 'bridge', treat: 'bw', fit: 'cover', border: 3, borderColor: INK, caption: 'Caption goes here. Photo: Staff', capSize: 15, capFont: 'Libre Baskerville', color: INK, kenburns: 8, anim: 'wipe', dur: 22, easing: 'easeOut' } },
  banner: { label: 'Banner', icon: '▬', hint: 'Colored bar for BREAKING NEWS, EXTRA!, ALERT…', anims: ['slideLeft', 'slideRight', 'wipe', 'slam', 'pop', 'fade', 'none'],
    def: { x: 0, y: 160, w: 1000, h: 110, text: 'BREAKING NEWS', font: 'Anton', weight: 400, size: 96, bg: '#d90429', color: '#ffffff', shape: 'angled', stripes: true, flash: true, flashRate: 1.5, anim: 'slideLeft', dur: 16, easing: 'easeOut' } },
  stamp: { label: 'Stamp', icon: '◉', hint: 'Ink stamp that slams onto the page', anims: ['slam', 'pop', 'fade', 'none'],
    def: { x: 600, y: 520, w: 300, h: 100, text: 'EXCLUSIVE', font: 'Anton', weight: 400, size: 60, color: '#c1121f', rot: -8, border: 6, distress: .5, anim: 'slam', dur: 10, easing: 'easeOut' } },
  ticker: { label: 'Ticker', icon: '⇢', hint: 'Scrolling news strip', anims: ['slideUp', 'wipe', 'fade', 'none'],
    def: { x: 0, y: 700, w: 1000, h: 56, text: 'Headline one  •  Headline two  •  Headline three', label: 'LIVE', font: 'Oswald', weight: 600, size: 26, bg: '#111111', color: '#ffffff', labelBg: '#d90429', labelColor: '#ffffff', speed: 140, anim: 'slideUp', dur: 14, easing: 'easeOut' } },
  marker: { label: 'Marker', icon: '✎', hint: 'Highlight, underline or circle something', anims: ['draw', 'fade'],
    def: { x: 100, y: 300, w: 300, h: 60, style: 'highlight', color: '#ffe14a', target: '', width: 6, anim: 'draw', dur: 24, easing: 'easeInOut' } },
  rule: { label: 'Divider', icon: '═', hint: 'Horizontal or vertical divider line', anims: ['wipe', 'fade', 'none'],
    def: { x: 50, y: 560, w: 900, h: 12, style: 'double', color: INK, thickness: 3, anim: 'wipe', dur: 16, easing: 'easeOut' } },
  deco: { label: 'Tape / pin', icon: '📌', hint: 'Tape strip or push pin to hold a clipping', anims: ['pop', 'fade', 'slideDown', 'none'],
    def: { x: 20, y: 20, w: 120, h: 34, shape: 'tape', color: '#efe4a4', rot: -30, anim: 'pop', dur: 10, easing: 'backOut' } },
};

export function makePart(kind, start = 0, over = {}) {
  const k = KINDS[kind]; if (!k) throw Error('Unknown part: ' + kind);
  return { id: uid(), kind, name: k.label, start, keep: true, opacity: 1, ...JSON.parse(JSON.stringify(k.def)), ...over };
}
export function makeShot(type, start = 0, over = {}) {
  const base = { focus: { dur: 40, fill: .9, level: true }, showAll: { dur: 36 }, push: { dur: 60, amount: .25 }, pull: { dur: 36, amount: .25 }, pan: { dur: 40, dx: 0, dy: 300 }, tilt: { dur: 30, degrees: 8 }, shake: { dur: 14, amp: 14 } }[type];
  if (!base) throw Error('Unknown camera move: ' + type);
  return { id: uid(), kind: 'shot', type, name: SHOT_TYPES[type].label, start, easing: type === 'shake' ? 'linear' : 'easeInOut', target: '', ...base, ...over };
}

// ------------------------------------------------------------------ project
export function newPaperProject(over = {}) {
  return { version: 1, kind: 'paper', name: 'Untitled newspaper', width: 1280, height: 720, fps: 30, frames: 180, template: 'blank',
    scene: { type: 'dark', color: '#2a2f36' },
    paper: { w: 1200, h: 800, stock: 'newsprint', color: '', edge: 'clean', fold: 'half', wear: .25, grain: .5, shadow: true, tilt: 0, enter: 'zoom', start: 0, dur: 24, easing: 'easeOut' },
    camera: { x: 600, y: 400, zoom: 1, rot: 0 }, parts: [], shots: [], assets: {}, ...over };
}
export const paperColorOf = p => p.paper.color || STOCKS[p.paper.stock]?.color || '#e6dfcb';
export const inkOf = p => STOCKS[p.paper.stock]?.ink || INK;

const isHex = s => typeof s === 'string' && /^#[0-9a-f]{6}$/i.test(s);
const str = (v, d, max = 4000) => (typeof v === 'string' ? v.slice(0, max) : d);
export function validatePaperProject(p) {
  if (!p || p.version !== 1 || p.kind !== 'paper' || !Array.isArray(p.parts) || !Array.isArray(p.shots)) throw Error('This is not a FrameFlow paper project.');
  if (p.parts.length > 150 || p.shots.length > 80) throw Error('This project has too many items.');
  if (![24, 30, 60].includes(p.fps) || !Number.isSafeInteger(p.frames) || p.frames < 2) throw Error('Invalid frame settings.');
  if (!Number.isInteger(p.width) || !Number.isInteger(p.height) || p.width < 100 || p.height < 100 || p.width > 3840 || p.height > 3840) throw Error('Invalid canvas size.');
  const base = newPaperProject();
  const out = { ...base, version: 1, kind: 'paper', name: str(p.name, 'Untitled newspaper', 100) || 'Untitled newspaper', width: p.width, height: p.height, fps: p.fps, frames: p.frames, template: str(p.template, 'blank', 40) };
  const sc = p.scene || {}; out.scene = { type: Object.hasOwn(SCENES, sc.type) ? sc.type : 'dark', color: isHex(sc.color) ? sc.color : base.scene.color };
  const pa = p.paper || {};
  out.paper = { ...base.paper, name: str(pa.name, 'Newspaper sheet', 100) || 'Newspaper sheet', w: clamp(num(pa.w, 1200), 200, 4000), h: clamp(num(pa.h, 800), 200, 5000), stock: Object.hasOwn(STOCKS, pa.stock) ? pa.stock : 'newsprint', color: isHex(pa.color) ? pa.color : '',
    edge: Object.hasOwn(EDGES, pa.edge) ? pa.edge : 'clean', fold: Object.hasOwn(FOLDS, pa.fold) ? pa.fold : 'none', wear: clamp(num(pa.wear, .25), 0, 1), grain: clamp(num(pa.grain, .5), 0, 1), shadow: pa.shadow !== false,
    tilt: clamp(num(pa.tilt, 0), -45, 45), enter: Object.hasOwn(SHEET_ENTRANCES, pa.enter) ? pa.enter : 'none', start: timingFrame(pa.start, 0, 0), dur: timingFrame(pa.dur, 24, 1), easing: Object.hasOwn(easings, pa.easing) ? pa.easing : 'easeOut' };
  validateTiming(out.paper);
  const cam = p.camera || {}; out.camera = { x: num(cam.x, out.paper.w / 2), y: num(cam.y, out.paper.h / 2), zoom: clamp(num(cam.zoom, 1), .05, 12), rot: clamp(num(cam.rot, 0), -720, 720) };
  const assets = {}; let total = 0;
  for (const [id, src] of Object.entries(p.assets || {})) {
    if (typeof src !== 'string' || !/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(src)) continue;
    total += src.length; if (total > 12e6) throw Error('The pictures in this project are too large.'); assets[String(id).slice(0, 60)] = src;
  }
  out.assets = assets;
  const ids = new Set();
  const fresh = id => { id = typeof id === 'string' && id && id.length < 80 && !ids.has(id) ? id : uid(); ids.add(id); return id; };
  out.parts = p.parts.map(raw => {
    const k = KINDS[raw?.kind]; if (!k) throw Error('Unknown part in project: ' + String(raw?.kind).slice(0, 20));
    const part = { ...makePart(raw.kind), id: fresh(raw.id) };
    for (const key of Object.keys(k.def)) {
      const dv = k.def[key], v = raw[key];
      if (v === undefined) continue;
      if (typeof dv === 'number') part[key] = clamp(num(v, dv), -20000, 20000);
      else if (typeof dv === 'boolean') part[key] = !!v;
      else if (typeof dv === 'string') part[key] = str(v, dv, key === 'text' ? 20000 : 400);
    }
    part.name = str(raw.name, k.label, 100) || k.label; part.start = timingFrame(raw.start, 0, 0); part.dur = timingFrame(raw.dur, k.def.dur, 1);
    validateTiming(part);
    part.keep = raw.keep !== false; part.opacity = clamp(num(raw.opacity, 1), 0, 1); part.w = Math.max(4, part.w); part.h = Math.max(2, part.h);
    if (!Object.hasOwn(easings, part.easing)) part.easing = k.def.easing;
    if (!k.anims.includes(part.anim)) part.anim = k.def.anim;
    if (part.kind === 'photo') { part.img = typeof raw.img === 'string' && assets[raw.img] ? raw.img : ''; if (!Object.hasOwn(PLACEHOLDERS, part.placeholder)) part.placeholder = 'bridge'; if (!Object.hasOwn(TREATMENTS, part.treat)) part.treat = 'bw'; part.fit = part.fit === 'contain' ? 'contain' : 'cover'; }
    if (part.kind === 'marker' && !Object.hasOwn(MARKER_STYLES, part.style)) part.style = 'highlight';
    if (part.kind === 'rule' && !Object.hasOwn(RULE_STYLES, part.style)) part.style = 'single';
    if (part.kind === 'deco' && !Object.hasOwn(DECO_SHAPES, part.shape)) part.shape = 'tape';
    if (part.kind === 'columns') part.cols = clamp(Math.round(part.cols), 1, 8);
    if (part.kind === 'banner') part.shape = part.shape === 'rect' ? 'rect' : 'angled';
    if (part.kind === 'columns') part.mode = part.mode === 'lines' ? 'lines' : 'text';
    if (part.kind === 'masthead') part.rules = ['none', 'single', 'double'].includes(part.rules) ? part.rules : 'double';
    if (['headline', 'text'].includes(part.kind)) { part.align = ['left', 'center', 'right'].includes(part.align) ? part.align : 'left'; part.valign = ['top', 'middle', 'bottom'].includes(part.valign) ? part.valign : 'top'; }
    for (const key of ['color', 'bg', 'borderColor', 'labelBg', 'labelColor']) if (key in part && part[key] && !isHex(part[key])) part[key] = k.def[key] ?? '';
    part.target = typeof raw.target === 'string' ? raw.target.slice(0, 80) : '';
    if (!['marker'].includes(part.kind)) delete part.target;
    return part;
  });
  out.shots = p.shots.map(raw => {
    if (!SHOT_TYPES[raw?.type]) throw Error('Unknown camera move in project.');
    const s = makeShot(raw.type, 0), keys = ['fill', 'amount', 'dx', 'dy', 'degrees', 'amp'];
    for (const k of keys) if (k in s) s[k] = clamp(num(raw[k], s[k]), -20000, 20000);
    s.id = fresh(raw.id); s.name = str(raw.name, s.name, 100) || s.name; s.start = timingFrame(raw.start, 0, 0); s.dur = timingFrame(raw.dur, s.dur, 1);
    validateTiming(s);
    s.level = raw.level !== false; s.target = typeof raw.target === 'string' ? raw.target.slice(0, 80) : '';
    s.easing = Object.hasOwn(easings, raw.easing) ? raw.easing : s.easing; return s;
  });
  return out;
}

export function paperFontsUsed(p) {
  const s = new Set();
  for (const part of p.parts) { if (part.font) s.add(part.font); if (part.capFont) s.add(part.capFont); if (part.metaFont) s.add(part.metaFont); }
  return [...s];
}

// ------------------------------------------------------------------ text layout
const fontCss = (p, size) => `${p.italic ? 'italic ' : ''}${p.weight || 400} ${size}px ${fontStack(p.font)}`;
const setSpacing = (ctx, px) => { if ('letterSpacing' in ctx) ctx.letterSpacing = px ? `${px}px` : '0px'; };
const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'grapheme' }) : null;
const graphemes = t => (seg ? [...seg.segment(t)].map(s => s.segment) : Array.from(t));
function wrapPara(ctx, para, widthOf) {
  const words = para.split(/\s+/).filter(Boolean), lines = []; let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (!cur || ctx.measureText(t).width <= widthOf(lines.length)) cur = t; else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur); return lines;
}
/** Lays out a block of text in a w × h box; autoFit shrinks the font until it fits. */
export function blockLayout(p, w, h) {
  const key = ['b', fontEpoch, p.text, p.font, p.weight, p.italic, p.size, p.lineH, p.spacing, p.caps, p.align, p.valign, p.autoFit, Math.round(w), Math.round(h)].join('|');
  return cached(key, () => {
    const ctx = measureCtx(), raw = String(p.text ?? ''), text = p.caps ? raw.toUpperCase() : raw, paras = text.split('\n');
    const build = size => {
      ctx.font = fontCss(p, size); setSpacing(ctx, (p.spacing || 0) * size / 100);
      const lines = []; for (const para of paras) { if (!para.trim()) { lines.push(''); continue; } lines.push(...wrapPara(ctx, para, () => w)); }
      return { lines, widest: Math.max(0, ...lines.map(t => ctx.measureText(t).width)) };
    };
    const lhOf = s => s * (p.lineH || 1.2);
    let size = Math.max(6, p.size || 24), res = build(size);
    if (p.autoFit) {
      const fits = (s, r) => r.lines.length * lhOf(s) <= h + .5 && r.widest <= w + .5;
      if (!fits(size, res)) { let lo = 6, hi = size; for (let i = 0; i < 14; i++) { const mid = (lo + hi) / 2; if (fits(mid, build(mid))) lo = mid; else hi = mid; } size = lo; res = build(size); }
    }
    const LH = lhOf(size); ctx.font = fontCss(p, size); setSpacing(ctx, (p.spacing || 0) * size / 100);
    const total = res.lines.length * LH, y0 = Math.max(0, p.valign === 'middle' ? (h - total) / 2 : p.valign === 'bottom' ? h - total : 0);
    const lines = res.lines.map((t, i) => { const tw = ctx.measureText(t).width; return { t, x: p.align === 'center' ? (w - tw) / 2 : p.align === 'right' ? w - tw : 0, y: y0 + i * LH + LH / 2, w: tw }; });
    return { size, lh: LH, lines, total };
  });
}
function drawBlock(ctx, p, L, prog, f, ox, oy, color) {
  const base = ctx.globalAlpha; ctx.font = fontCss(p, L.size); setSpacing(ctx, (p.spacing || 0) * L.size / 100);
  ctx.fillStyle = color; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const lines = L.lines;
  if (p.anim === 'type') {
    const gs = lines.map(l => graphemes(l.t)), total = gs.reduce((s, g) => s + g.length, 0); let left = Math.floor(prog * total + 1e-6), lastX = null, lastY = 0;
    lines.forEach((l, i) => { if (left <= 0) return; const s = gs[i].slice(0, left).join(''); ctx.fillText(s, ox + l.x, oy + l.y); lastX = ox + l.x + ctx.measureText(s).width; lastY = oy + l.y; left -= gs[i].length; });
    if (prog < 1 && lastX !== null && Math.floor(f / 8) % 2 === 0) ctx.fillRect(lastX + L.size * .06, lastY - L.size * .42, Math.max(2, L.size * .07), L.size * .84);
  } else if (p.anim === 'words') {
    const words = []; lines.forEach(l => { const parts = l.t.split(' '); parts.forEach((w, wi) => words.push({ t: w, x: l.x + ctx.measureText(parts.slice(0, wi).join(' ') + (wi ? ' ' : '')).width, y: l.y })); });
    const N = Math.max(1, words.length);
    words.forEach((w, i) => { const wp = clamp((prog - i / N * .7) / .3, 0, 1); if (wp <= 0) return; ctx.globalAlpha = base * wp; ctx.fillText(w.t, ox + w.x, oy + w.y + (1 - wp) * L.size * .35); });
    ctx.globalAlpha = base;
  } else if (p.anim === 'lines') {
    const n = Math.max(1, lines.length);
    lines.forEach((l, i) => { const lp = clamp((prog - i / n * .7) / .3, 0, 1); if (lp <= 0) return; ctx.globalAlpha = base * lp; ctx.fillText(l.t, ox + l.x, oy + l.y + (1 - lp) * L.size * .3); });
    ctx.globalAlpha = base;
  } else for (const l of lines) ctx.fillText(l.t, ox + l.x, oy + l.y);
}

// ------------------------------------------------------------------ generic entrance
const NO_GENERIC = new Set(['type', 'words', 'lines', 'draw', 'none']);
function entrance(ctx, p, prog, r) {
  if (NO_GENERIC.has(p.anim) || prog >= 1) return;
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  switch (p.anim) {
    case 'fade': ctx.globalAlpha *= prog; break;
    case 'slideUp': ctx.globalAlpha *= clamp(prog * 2, 0, 1); ctx.translate(0, (1 - prog) * 70); break;
    case 'slideDown': ctx.globalAlpha *= clamp(prog * 2, 0, 1); ctx.translate(0, -(1 - prog) * 70); break;
    case 'slideLeft': ctx.globalAlpha *= clamp(prog * 2, 0, 1); ctx.translate((1 - prog) * 220, 0); break;
    case 'slideRight': ctx.globalAlpha *= clamp(prog * 2, 0, 1); ctx.translate(-(1 - prog) * 220, 0); break;
    case 'pop': { const s = Math.max(.01, .55 + .45 * prog); ctx.globalAlpha *= clamp(prog * 2.5, 0, 1); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); break; }
    case 'slam': { const s = 1 + (1 - prog) * 1.8; ctx.globalAlpha *= clamp(prog * 3, 0, 1); ctx.translate(cx, cy); ctx.scale(s, s); ctx.translate(-cx, -cy); break; }
    case 'wipe': ctx.beginPath(); ctx.rect(r.x - 30, r.y - 30, (r.w + 60) * prog, r.h + 60); ctx.clip(); break;
  }
}
function partProgress(p, f) {
  if (f < p.start) return -1;
  const t = (f - p.start) / Math.max(1, p.dur);
  if (p.keep === false && t > 1) return -1;
  if (p.anim === 'none') return 1;
  return (easings[p.easing] || easings.easeOut)(clamp(t, 0, 1));
}

// ------------------------------------------------------------------ part renderers
function drawTextPart(ctx, p, prog, f, env, r) {
  const pad = p.pad || 0;
  if (p.bg) { ctx.fillStyle = p.bg; ctx.fillRect(r.x, r.y, r.w, r.h); }
  if (p.border > 0) { ctx.strokeStyle = p.borderColor || p.color; ctx.lineWidth = p.border; ctx.strokeRect(r.x + p.border / 2, r.y + p.border / 2, r.w - p.border, r.h - p.border); }
  drawBlock(ctx, p, blockLayout(p, r.w - 2 * pad, r.h - 2 * pad), prog, f, r.x + pad, r.y + pad, p.color);
}
function drawMasthead(ctx, p, prog, f, env, r) {
  const hasMeta = !!(p.metaL || p.metaC || p.metaR), metaSize = clamp(r.h * .1, 11, 18), metaH = hasMeta ? metaSize * 2.2 : 0;
  const top = p.rules === 'double' ? 14 : p.rules === 'single' ? 8 : 0, bottom = p.rules === 'none' ? 0 : 8;
  ctx.fillStyle = p.color;
  if (p.rules === 'double') { ctx.fillRect(r.x, r.y, r.w, 4); ctx.fillRect(r.x, r.y + 8, r.w, 1.5); } else if (p.rules === 'single') ctx.fillRect(r.x, r.y, r.w, 3);
  const titleH = Math.max(10, r.h - top - bottom - metaH), tp = { ...p, align: 'center', valign: 'middle', lineH: 1.05, spacing: 0, caps: false, autoFit: true, italic: false };
  drawBlock(ctx, p.anim === 'type' ? tp : { ...tp, anim: 'none' }, blockLayout(tp, r.w, titleH), prog, f, r.x, r.y + top, p.color);
  if (hasMeta) {
    const y = r.y + r.h - bottom - metaH; ctx.fillStyle = p.color; ctx.fillRect(r.x, y, r.w, 1.5);
    ctx.font = `600 ${metaSize}px ${fontStack(p.metaFont || 'Libre Baskerville')}`; setSpacing(ctx, metaSize * .06); ctx.textBaseline = 'middle';
    ctx.textAlign = 'left'; ctx.fillText(p.metaL || '', r.x + 2, y + metaH / 2 + 1); ctx.textAlign = 'center'; ctx.fillText(p.metaC || '', r.x + r.w / 2, y + metaH / 2 + 1); ctx.textAlign = 'right'; ctx.fillText(p.metaR || '', r.x + r.w - 2, y + metaH / 2 + 1);
    ctx.textAlign = 'left'; setSpacing(ctx, 0); ctx.fillRect(r.x, y + metaH, r.w, 1.5);
  }
  if (p.rules !== 'none') { ctx.fillStyle = p.color; if (p.rules === 'double') { ctx.fillRect(r.x, r.y + r.h - 4, r.w, 4); ctx.fillRect(r.x, r.y + r.h - 9, r.w, 1.5); } else ctx.fillRect(r.x, r.y + r.h - 3, r.w, 3); }
}
function columnsLayout(p) {
  const key = ['c', fontEpoch, p.text, p.font, p.weight, p.size, p.lineH, p.cols, p.gap, p.justify, p.dropCap, Math.round(p.w), Math.round(p.h)].join('|');
  return cached(key, () => {
    const ctx = measureCtx(), cols = clamp(Math.round(p.cols || 3), 1, 8), gap = p.gap ?? 24, colW = (p.w - gap * (cols - 1)) / cols, size = p.size || 16, lh = size * (p.lineH || 1.35), rows = Math.max(1, Math.floor(p.h / lh));
    ctx.font = fontCss({ ...p, italic: false }, size); setSpacing(ctx, 0);
    const paras = String(p.text || '').split(/\n+/).map(s => s.trim()).filter(Boolean), space = ctx.measureText(' ').width;
    let cap = null; if (p.dropCap && paras.length) {
      const ch = graphemes(paras[0])[0], capSize = lh * 2.9; ctx.font = fontCss({ ...p, weight: 700, italic: false }, capSize); cap = { ch, size: capSize, w: ctx.measureText(ch).width + 7 }; paras[0] = paras[0].slice(ch.length).trimStart(); ctx.font = fontCss({ ...p, italic: false }, size);
    }
    const flat = [];
    paras.forEach((para, pi) => {
      const indent = pi > 0 ? size * 1.1 : 0, capOn = pi === 0 && cap;
      const off = li => (capOn && li < 3 ? cap.w : 0) + (li === 0 ? indent : 0), widthOf = li => colW - off(li);
      const lines = wrapPara(ctx, para, widthOf);
      lines.forEach((t, li) => flat.push({ t, last: li === lines.length - 1, off: off(li), avail: widthOf(li) }));
    });
    const items = []; let placed = 0;
    flat.forEach((ln, idx) => {
      const col = Math.floor(idx / rows), row = idx % rows; if (col >= cols) return; placed++;
      const words = ln.t.split(' '), ws = words.map(w => ctx.measureText(w).width), natural = ws.reduce((a, b) => a + b, 0); let g = space;
      if (p.justify && !ln.last && words.length > 1) { const j = (ln.avail - natural) / (words.length - 1); if (j >= space * .6 && j <= space * 3) g = j; }
      let x = col * (colW + gap) + ln.off; const out = [];
      words.forEach((w, i) => { out.push({ t: w, x }); x += ws[i] + g; });
      items.push({ words: out, y: (row + .5) * lh, x0: col * (colW + gap) + ln.off, w: x - g - (col * (colW + gap) + ln.off) });
    });
    return { cols, colW, gap, lh, size, items, cap, placed, total: flat.length, overflow: flat.length - placed };
  });
}
function drawColumns(ctx, p, prog, f, env, r) {
  const L = columnsLayout(p), base = ctx.globalAlpha;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x - 2, r.y - 2, r.w + 4, r.h + 4); ctx.clip(); ctx.translate(r.x, r.y);
  if (p.rules && L.cols > 1) { ctx.globalAlpha = base * .45; ctx.fillStyle = p.color; for (let c = 1; c < L.cols; c++) ctx.fillRect(c * (L.colW + L.gap) - L.gap / 2 - .5, 0, 1, r.h); ctx.globalAlpha = base; }
  ctx.font = fontCss({ ...p, italic: false }, L.size); ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; setSpacing(ctx, 0); ctx.fillStyle = p.color;
  const n = Math.max(1, L.items.length), bars = p.mode === 'lines';
  const state = i => {
    if (p.anim === 'lines') { const lp = clamp((prog - i / n * .75) / .25, 0, 1); return { a: lp, dy: (1 - lp) * 5, clip: 1 }; }
    if (p.anim === 'type') return { a: 1, dy: 0, clip: clamp(prog * n - i, 0, 1) };
    return { a: 1, dy: 0, clip: 1 };
  };
  if (L.cap) {
    const s = state(0); if (s.a > 0 && s.clip > 0) { ctx.globalAlpha = base * s.a; ctx.font = fontCss({ ...p, weight: 700, italic: false }, L.cap.size); ctx.fillText(L.cap.ch, 0, L.lh * 1.5 + L.cap.size * .04); ctx.font = fontCss({ ...p, italic: false }, L.size); ctx.globalAlpha = base; }
  }
  L.items.forEach((it, i) => {
    const s = state(i); if (s.a <= 0 || s.clip <= 0) return;
    ctx.globalAlpha = base * s.a;
    if (s.clip < 1) { ctx.save(); ctx.beginPath(); ctx.rect(it.x0 - 2, it.y - L.lh / 2, (it.w + 4) * s.clip, L.lh); ctx.clip(); }
    if (bars) { ctx.globalAlpha = base * s.a * .5; ctx.fillRect(it.x0, it.y + s.dy - L.size * .22, it.w, L.size * .44); } else for (const w of it.words) ctx.fillText(w.t, w.x, it.y + s.dy);
    if (s.clip < 1) ctx.restore();
  });
  ctx.restore(); ctx.globalAlpha = base;
}
// -- photos
function placeholderArt(x, w, h, kind) {
  const sky = x.createLinearGradient(0, 0, 0, h);
  if (kind === 'person') {
    const bg = x.createRadialGradient(w * .5, h * .4, h * .05, w * .5, h * .5, h * .8); bg.addColorStop(0, '#d9d4c8'); bg.addColorStop(1, '#6f6a62'); x.fillStyle = bg; x.fillRect(0, 0, w, h);
    x.fillStyle = '#2b2824'; x.beginPath(); x.ellipse(w * .5, h * .38, h * .15, h * .19, 0, 0, 7); x.fill();
    x.beginPath(); x.ellipse(w * .5, h * 1.02, w * .36, h * .36, 0, Math.PI, 0); x.fill(); x.fillRect(w * .46, h * .5, w * .08, h * .12); return;
  }
  if (kind === 'city') {
    sky.addColorStop(0, '#9aa4ae'); sky.addColorStop(1, '#efe2c9'); x.fillStyle = sky; x.fillRect(0, 0, w, h);
    x.fillStyle = '#f6e9c8'; x.beginPath(); x.arc(w * .78, h * .3, w * .06, 0, 7); x.fill();
    for (let layer = 0; layer < 2; layer++) {
      x.fillStyle = layer ? '#2d3238' : '#6b747d'; let cx = -10;
      for (let i = 0; cx < w + 20; i++) { const bw = w * (.05 + hash(i, layer, 1) * .07), bh = h * (layer ? .25 + hash(i, 5, layer) * .35 : .3 + hash(i, 9, 3) * .35); x.fillRect(cx, h - bh, bw, bh); if (layer) { x.fillStyle = '#e8d9a8'; for (let wy = h - bh + 8; wy < h - 8; wy += 13) for (let wx = cx + 5; wx < cx + bw - 6; wx += 11) if (hash(wx | 0, wy | 0, 4) > .55) x.fillRect(wx, wy, 4, 6); x.fillStyle = '#2d3238'; } cx += bw + 2; }
    } return;
  }
  sky.addColorStop(0, '#8a96a3'); sky.addColorStop(.6, '#efdcb9'); sky.addColorStop(1, '#f4e8cf'); x.fillStyle = sky; x.fillRect(0, 0, w, h);
  x.fillStyle = '#fbefcf'; x.beginPath(); x.arc(w * .76, h * .32, w * .08, 0, 7); x.fill();
  const river = x.createLinearGradient(0, h * .66, 0, h); river.addColorStop(0, '#b9c4cc'); river.addColorStop(1, '#8c9aa5'); x.fillStyle = river; x.fillRect(0, h * .66, w, h * .34);
  x.fillStyle = '#242a30'; x.fillRect(0, h * .62, w, h * .035);
  const t1 = w * .28, t2 = w * .72, top = h * .2; x.fillRect(t1 - w * .012, top, w * .024, h * .45); x.fillRect(t2 - w * .012, top, w * .024, h * .45);
  x.strokeStyle = '#242a30'; x.lineWidth = Math.max(1.5, w * .003); x.beginPath(); x.moveTo(0, h * .58); x.lineTo(t1, top); x.quadraticCurveTo(w * .5, h * .56, t2, top); x.lineTo(w, h * .58); x.stroke();
  x.lineWidth = Math.max(1, w * .0016); for (let hx = t1 + 14; hx < t2; hx += 16) { const u = (hx - t1) / (t2 - t1), cy = (1 - u) * (1 - u) * top + 2 * u * (1 - u) * h * .56 + u * u * top; x.beginPath(); x.moveTo(hx, cy); x.lineTo(hx, h * .62); x.stroke(); }
  x.fillStyle = 'rgba(255,255,255,.12)'; for (let i = 0; i < 10; i++) x.fillRect(hash(i, 2) * w, h * (.7 + hash(i, 3) * .28), w * .12, 2);
}
function treat(x, w, h, mode) {
  if (mode === 'color') return;
  const d = x.getImageData(0, 0, w, h), a = d.data, n = w * h, lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = (.299 * a[i * 4] + .587 * a[i * 4 + 1] + .114 * a[i * 4 + 2]) / 255;
  if (mode === 'halftone') {
    x.setTransform(1, 0, 0, 1, 0, 0); x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.fillStyle = '#16140f';
    const cell = Math.max(4, Math.round(w / 100)); let row = 0;
    for (let cy = cell / 2; cy < h + cell; cy += cell * .866, row++) for (let cx = (row % 2 ? cell / 2 : 0); cx < w + cell; cx += cell) {
      const sx = clamp(Math.round(cx), 0, w - 1), sy = clamp(Math.round(cy), 0, h - 1); let l = 0, c = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const px = clamp(sx + dx * 2, 0, w - 1), py = clamp(sy + dy * 2, 0, h - 1); l += lum[py * w + px]; c++; }
      l = clamp((l / c - .5) * 1.25 + .52, 0, 1); const r = cell * .78 * Math.sqrt(1 - l);
      if (r > .35) { x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill(); }
    } return;
  }
  for (let i = 0; i < n; i++) {
    const v = clamp((lum[i] - .5) * 1.22 + .52, 0, 1) * 255;
    if (mode === 'sepia') { a[i * 4] = Math.min(255, v * 1.07 + 8); a[i * 4 + 1] = v * .91; a[i * 4 + 2] = v * .70; } else a[i * 4] = a[i * 4 + 1] = a[i * 4 + 2] = v;
  }
  x.putImageData(d, 0, 0);
}
function photoCanvas(p, env, w, h) {
  const src = p.img ? env.proj.assets?.[p.img] : null; let img = null;
  if (src) { img = imageFor(src, env.onImage); if (!img) return null; }
  const S = Math.min(1.5, 1600 / Math.max(w, h, 1)), cw = Math.max(8, Math.round(w * S)), ch = Math.max(8, Math.round(h * S));
  const key = ['ph', src ? p.img + ':' + src.length : p.placeholder, p.treat, p.fit, cw, ch].join('|');
  return cachedCanvas(key, () => {
    const c = makeCanvas(cw, ch), x = c.getContext('2d');
    if (img) {
      const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height, s = (p.fit === 'contain' ? Math.min : Math.max)(cw / iw, ch / ih);
      x.fillStyle = '#f2efe6'; x.fillRect(0, 0, cw, ch); x.drawImage(img, (cw - iw * s) / 2, (ch - ih * s) / 2, iw * s, ih * s);
    } else placeholderArt(x, cw, ch, p.placeholder);
    treat(x, cw, ch, p.treat); return c;
  });
}
function drawPhoto(ctx, p, prog, f, env, r) {
  const capOn = !!p.caption, capLines = capOn ? blockLayout({ text: p.caption, font: p.capFont, weight: 400, italic: true, size: p.capSize, lineH: 1.3, spacing: 0, caps: false, align: 'left', valign: 'top', autoFit: false }, r.w, 400) : null;
  const capH = capOn ? capLines.total + 12 : 0, ih = Math.max(10, r.h - capH), art = photoCanvas(p, env, r.w, ih);
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, ih); ctx.clip();
  if (art) {
    const kb = 1 + (p.kenburns || 0) / 100 * clamp((env.f - p.start) / Math.max(1, env.proj.frames - p.start), 0, 1), cx = r.x + r.w / 2, cy = r.y + ih / 2;
    ctx.globalCompositeOperation = 'multiply'; ctx.translate(cx, cy); ctx.scale(kb, kb); ctx.drawImage(art, -r.w / 2, -ih / 2, r.w, ih);
  } else { ctx.fillStyle = '#c9c4b8'; ctx.fillRect(r.x, r.y, r.w, ih); }
  ctx.restore();
  if (p.border > 0) { ctx.strokeStyle = p.borderColor; ctx.lineWidth = p.border; ctx.strokeRect(r.x + p.border / 2, r.y + p.border / 2, r.w - p.border, ih - p.border); }
  if (capOn) drawBlock(ctx, { ...p, font: p.capFont, italic: true, anim: 'none', spacing: 0 }, capLines, 1, f, r.x, r.y + ih + 8, p.color);
}
function drawBanner(ctx, p, prog, f, env, r) {
  const skew = p.shape === 'angled' ? r.h * .28 : 0, path = () => { ctx.beginPath(); if (skew) { ctx.moveTo(r.x + skew, r.y); ctx.lineTo(r.x + r.w, r.y); ctx.lineTo(r.x + r.w - skew, r.y + r.h); ctx.lineTo(r.x, r.y + r.h); ctx.closePath(); } else ctx.rect(r.x, r.y, r.w, r.h); };
  const base = ctx.globalAlpha, pulse = p.flash ? .74 + .26 * Math.abs(Math.sin(env.f / env.fps * Math.PI * (p.flashRate || 1.5))) : 1;
  ctx.save(); path(); ctx.clip(); ctx.globalAlpha = base * pulse; ctx.fillStyle = p.bg; ctx.fillRect(r.x, r.y, r.w, r.h); ctx.globalAlpha = base;
  if (p.stripes) { ctx.fillStyle = 'rgba(0,0,0,.22)'; for (const y of [r.y, r.y + r.h - 9]) for (let sx = r.x - 20; sx < r.x + r.w + 20; sx += 26) { ctx.beginPath(); ctx.moveTo(sx, y + 9); ctx.lineTo(sx + 13, y + 9); ctx.lineTo(sx + 22, y); ctx.lineTo(sx + 9, y); ctx.closePath(); ctx.fill(); } }
  ctx.restore();
  const tp = { ...p, align: 'center', valign: 'middle', lineH: 1, spacing: 0, caps: false, italic: false, autoFit: true, anim: p.anim === 'type' ? 'type' : 'none' }, pad = p.stripes ? 12 : 6;
  drawBlock(ctx, tp, blockLayout(tp, r.w - skew * 2 - 28, r.h - pad * 2), prog, f, r.x + skew + 14, r.y + pad, p.color);
}
function stampCanvas(p, w, h) {
  const key = ['st', fontEpoch, p.text, p.font, p.size, p.color, p.border, p.distress, Math.round(w), Math.round(h)].join('|');
  return cachedCanvas(key, () => {
    const S = 2, c = makeCanvas(Math.ceil(w * S), Math.ceil(h * S)), x = c.getContext('2d'); x.scale(S, S);
    const b = p.border || 0; x.strokeStyle = p.color; x.lineWidth = b; x.strokeRect(b / 2, b / 2, w - b, h - b); if (b > 2) { x.lineWidth = Math.max(1, b / 3); x.strokeRect(b * 1.7, b * 1.7, w - b * 3.4, h - b * 3.4); }
    const tp = { ...p, align: 'center', valign: 'middle', lineH: 1, spacing: 4, caps: false, italic: false, autoFit: true, anim: 'none' }, pad = b * 2.6 + 4;
    drawBlock(x, tp, blockLayout(tp, w - pad * 2, h - pad * 2), 1, 0, pad, pad, p.color);
    x.globalCompositeOperation = 'destination-out'; const n = Math.round((p.distress || 0) * 700);
    for (let i = 0; i < n; i++) { x.globalAlpha = .4 + hash(i, 4, 9) * .6; x.beginPath(); x.arc(hash(i, 1, 9) * w, hash(i, 2, 9) * h, .6 + hash(i, 3, 9) * 2.2, 0, 7); x.fill(); }
    return c;
  });
}
function drawStamp(ctx, p, prog, f, env, r) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2; ctx.translate(cx, cy); ctx.rotate((p.rot || 0) * RAD); ctx.translate(-cx, -cy);
  ctx.globalAlpha *= .92; ctx.drawImage(stampCanvas(p, r.w, r.h), r.x, r.y, r.w, r.h);
}
function drawTicker(ctx, p, prog, f, env, r) {
  ctx.save(); ctx.beginPath(); ctx.rect(r.x, r.y, r.w, r.h); ctx.clip(); ctx.fillStyle = p.bg; ctx.fillRect(r.x, r.y, r.w, r.h);
  const size = p.size || 24; ctx.font = fontCss({ ...p, italic: false }, size); setSpacing(ctx, 0); ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
  const label = p.label || '', lw = label ? ctx.measureText(label).width + size * 1.6 : 0, unit = String(p.text || ' ').trim() + '      ●      ', uw = Math.max(40, ctx.measureText(unit).width);
  const off = ((env.f - p.start) / env.fps * (p.speed || 100)) % uw; ctx.fillStyle = p.color;
  ctx.save(); ctx.beginPath(); ctx.rect(r.x + lw, r.y, r.w - lw, r.h); ctx.clip(); for (let x = r.x + lw + size - off - uw; x < r.x + r.w; x += uw) ctx.fillText(unit, x, r.y + r.h / 2 + 1); ctx.restore();
  if (label) { ctx.fillStyle = p.labelBg; ctx.fillRect(r.x, r.y, lw, r.h); ctx.fillStyle = p.labelColor; ctx.fillText(label, r.x + size * .8, r.y + r.h / 2 + 1); }
  ctx.restore();
}
/** Rectangles (paper coordinates) a marker draws over: each text line of its target, or its own box. */
export function markerRects(proj, p) {
  const t = p.target && proj.parts.find(q => q.id === p.target);
  if (!t) return [{ x: p.x, y: p.y, w: p.w, h: p.h }];
  if (t.kind === 'headline' || t.kind === 'text') {
    const pad = t.pad || 0, L = blockLayout(t, t.w - 2 * pad, t.h - 2 * pad), rs = L.lines.filter(l => l.t).map(l => ({ x: t.x + pad + l.x, y: t.y + pad + l.y - L.lh / 2, w: l.w, h: L.lh }));
    if (rs.length) return rs;
  }
  return [{ x: t.x, y: t.y, w: t.w, h: t.h }];
}
function drawMarker(ctx, p, prog, f, env, r) {
  const rects = markerRects(env.proj, p), n = rects.length, base = ctx.globalAlpha; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  if (p.anim === 'fade') prog = 1; // the generic fade-in already handled opacity
  const U = rects.reduce((a, q) => ({ x0: Math.min(a.x0, q.x), y0: Math.min(a.y0, q.y), x1: Math.max(a.x1, q.x + q.w), y1: Math.max(a.y1, q.y + q.h) }), { x0: 1e9, y0: 1e9, x1: -1e9, y1: -1e9 });
  if (p.style === 'highlight') { ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = p.color; rects.forEach((q, i) => { const s = clamp(prog * n - i, 0, 1); if (s > 0) ctx.fillRect(q.x - 5, q.y + q.h * .1, (q.w + 10) * s, q.h * .8); }); return; }
  ctx.strokeStyle = p.color; ctx.lineWidth = p.width || 5;
  if (p.style === 'underline' || p.style === 'strike') {
    rects.forEach((q, i) => { const s = clamp(prog * n - i, 0, 1); if (s <= 0) return; const y = q.y + q.h * (p.style === 'strike' ? .52 : .96), x0 = q.x - 4, x1 = x0 + (q.w + 8) * s; ctx.beginPath(); for (let x = x0, k = 0; x <= x1 + .1; x += 5, k++) { const yy = y + Math.sin(x * .05 + i) * 2 + (p.style === 'underline' ? 0 : Math.sin(x * .021) * 1.5); k ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); } ctx.stroke(); });
  } else if (p.style === 'circle') {
    const cx = (U.x0 + U.x1) / 2, cy = (U.y0 + U.y1) / 2, rx = (U.x1 - U.x0) / 2 * 1.12 + 14, ry = (U.y1 - U.y0) / 2 * 1.22 + 12, total = Math.PI * 2.16 * prog, a0 = -2.3;
    ctx.beginPath(); for (let a = 0, k = 0; a <= total + .001; a += .05, k++) { const g = 1 + .035 * Math.sin((a + a0) * 3 + 1.3) + .05 * a / (Math.PI * 2), x = cx + Math.cos(a0 + a) * rx * g, y = cy + Math.sin(a0 + a) * ry * g; k ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.stroke();
  } else if (p.style === 'box') {
    const pts = [[U.x0 - 8, U.y0 - 6], [U.x1 + 8, U.y0 - 4], [U.x1 + 6, U.y1 + 6], [U.x0 - 6, U.y1 + 4], [U.x0 - 8, U.y0 - 6]], lens = pts.slice(1).map((q, i) => Math.hypot(q[0] - pts[i][0], q[1] - pts[i][1])), tot = lens.reduce((a, b) => a + b, 0); let left = tot * prog;
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 0; i < 4 && left > 0; i++) { const s = Math.min(1, left / lens[i]); ctx.lineTo(lerp(pts[i][0], pts[i + 1][0], s), lerp(pts[i][1], pts[i + 1][1], s)); left -= lens[i]; } ctx.stroke();
  }
}
function drawRule(ctx, p, prog, f, env, r) {
  const horiz = r.w >= r.h, t = Math.max(1, p.thickness || 2), len = horiz ? r.w : r.h, cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  ctx.fillStyle = p.color; ctx.strokeStyle = p.color;
  const bar = (off, th) => horiz ? ctx.fillRect(r.x, cy + off - th / 2, len, th) : ctx.fillRect(cx + off - th / 2, r.y, th, len);
  if (p.style === 'double') { bar(-t * 1.2, t); bar(t * 1.2, t); } else if (p.style === 'thickThin') { bar(-t * .9, t * 1.8); bar(t * 1.4, Math.max(1, t * .6)); }
  else if (p.style === 'dotted' || p.style === 'dashed') { ctx.lineWidth = t; ctx.lineCap = p.style === 'dotted' ? 'round' : 'butt'; ctx.setLineDash(p.style === 'dotted' ? [.1, t * 2.4] : [t * 4, t * 2.5]); ctx.beginPath(); horiz ? (ctx.moveTo(r.x, cy), ctx.lineTo(r.x + len, cy)) : (ctx.moveTo(cx, r.y), ctx.lineTo(cx, r.y + len)); ctx.stroke(); ctx.setLineDash([]); }
  else bar(0, t);
}
function drawDeco(ctx, p, prog, f, env, r) {
  const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
  if (p.shape === 'pin') {
    const R = Math.min(r.w, r.h) / 2; ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 4;
    const g = ctx.createRadialGradient(cx - R * .3, cy - R * .35, R * .1, cx, cy, R); g.addColorStop(0, '#ff8a80'); g.addColorStop(.5, p.color || '#d62828'); g.addColorStop(1, '#7a0f0f'); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill(); ctx.restore(); return;
  }
  ctx.translate(cx, cy); ctx.rotate((p.rot || 0) * RAD); ctx.translate(-cx, -cy);
  ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.25)'; ctx.shadowBlur = 4; ctx.shadowOffsetY = 2; ctx.globalAlpha *= .78; ctx.fillStyle = p.color || '#efe4a4';
  ctx.beginPath(); const z = 4, steps = Math.max(2, Math.round(r.h / 5)); ctx.moveTo(r.x, r.y);
  ctx.lineTo(r.x + r.w, r.y); for (let i = 1; i <= steps; i++) ctx.lineTo(r.x + r.w + (i % 2 ? -z : 0), r.y + r.h * i / steps);
  ctx.lineTo(r.x, r.y + r.h); for (let i = steps - 1; i >= 0; i--) ctx.lineTo(r.x + (i % 2 ? z : 0), r.y + r.h * i / steps); ctx.closePath(); ctx.fill(); ctx.restore();
}
const DRAW = { headline: drawTextPart, text: drawTextPart, masthead: drawMasthead, columns: drawColumns, photo: drawPhoto, banner: drawBanner, stamp: drawStamp, ticker: drawTicker, marker: drawMarker, rule: drawRule, deco: drawDeco };

/** Draws one part; returns its rectangle in paper coordinates when visible. */
function drawPart(ctx, p, f, env) {
  const prog = partProgress(p, f); if (prog < 0) return null;
  const r = { x: p.x, y: p.y, w: p.w, h: p.h };
  ctx.save(); ctx.globalAlpha *= clamp(p.opacity ?? 1, 0, 1); entrance(ctx, p, prog, r);
  env.fadeP = prog;
  try { DRAW[p.kind]?.(ctx, p, prog, f, env, r); } finally { ctx.restore(); }
  if (p.kind === 'marker' && p.target) { const u = markerRects(env.proj, p); return { x: Math.min(...u.map(q => q.x)), y: Math.min(...u.map(q => q.y)), w: Math.max(...u.map(q => q.x + q.w)) - Math.min(...u.map(q => q.x)), h: Math.max(...u.map(q => q.y + q.h)) - Math.min(...u.map(q => q.y)) }; }
  return r;
}

// ------------------------------------------------------------------ camera and sheet
export const tiltMatrix = proj => { const { w, h, tilt } = proj.paper; return mmul(mtr(w / 2, h / 2), mmul(mrot((tilt || 0) * RAD), mtr(-w / 2, -h / 2))); };
const rectOf = (proj, id) => { const t = proj.parts.find(p => p.id === id); return t ? { x: t.x, y: t.y, w: t.w, h: t.h } : null; };
function fitZoom(rect, fill, W, H) { return clamp(Math.min(fill * W / Math.max(1, rect.w), fill * H / Math.max(1, rect.h)), .05, 12); }
function shotTarget(s, st, proj, W, H) {
  const tilt = tiltMatrix(proj), pa = proj.paper, rect = s.target ? rectOf(proj, s.target) : null, c = rect && mapply(tilt, rect.x + rect.w / 2, rect.y + rect.h / 2);
  const all = () => { const cc = mapply(tilt, pa.w / 2, pa.h / 2); return { x: cc.x, y: cc.y, zoom: clamp(Math.min(.92 * W / pa.w, .92 * H / pa.h), .05, 12), rot: 0 }; };
  switch (s.type) {
    case 'focus': return rect ? { x: c.x, y: c.y, zoom: fitZoom(rect, s.fill || .9, W, H), rot: s.level === false ? st.rot : -(pa.tilt || 0) } : all();
    case 'showAll': return all();
    case 'push': return { x: c ? c.x : st.x, y: c ? c.y : st.y, zoom: clamp(st.zoom * (1 + (s.amount || 0)), .05, 12), rot: st.rot };
    case 'pull': return { ...st, zoom: clamp(st.zoom / (1 + (s.amount || 0)), .05, 12) };
    case 'pan': return { ...st, x: st.x + (s.dx || 0), y: st.y + (s.dy || 0) };
    case 'tilt': return { ...st, rot: st.rot + (s.degrees || 0) };
  }
  return st;
}
const mix = (a, b, t) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t), zoom: a.zoom * Math.pow(b.zoom / a.zoom, t), rot: lerp(a.rot, b.rot, t) });
/** Camera at a frame: chains camera moves in time order; a later move interrupts an unfinished one. */
export function cameraAt(proj, f, W = proj.width, H = proj.height) {
  let st = { ...proj.camera };
  const shots = proj.shots.filter(s => s.type !== 'shake').sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  for (let i = 0; i < shots.length; i++) {
    const s = shots[i]; if (f < s.start) break;
    const nxt = shots[i + 1], lim = Math.min(s.start + s.dur, nxt ? nxt.start : Infinity), tgt = shotTarget(s, st, proj, W, H);
    const p = clamp((Math.min(f, lim) - s.start) / Math.max(1, s.dur), 0, 1), ns = mix(st, tgt, (easings[s.easing] || easings.easeInOut)(p));
    st = ns; if (f < lim) break;
  }
  let sx = 0, sy = 0, sr = 0;
  for (const s of proj.shots) if (s.type === 'shake' && f >= s.start && f < s.start + s.dur) { const k = 1 - (f - s.start) / Math.max(1, s.dur), a = (s.amp || 0) * k; sx += (hash(f, 1, 7) - .5) * 2 * a; sy += (hash(f, 2, 7) - .5) * 2 * a; sr += (hash(f, 3, 7) - .5) * a * .06; }
  return { ...st, sx, sy, sr };
}
export function sheetAnim(proj, f, H = proj.height) {
  const pa = proj.paper;
  if (pa.enter === 'none') return { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1 };
  if (f < pa.start) return { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 0 };
  const t = clamp((f - pa.start) / Math.max(1, pa.dur), 0, 1), e = (easings[pa.easing] || easings.easeOut)(t), o = { dx: 0, dy: 0, rot: 0, scale: 1, alpha: 1 };
  switch (pa.enter) {
    case 'spin': o.rot = (1 - e) * 720; o.scale = .05 + .95 * e; o.alpha = clamp(t * 4, 0, 1); break;
    case 'slideUp': o.dy = (1 - e) * H * 1.15; break;
    case 'drop': o.dy = -(1 - e) * H * 1.2; o.rot = -(1 - e) * 6; break;
    case 'zoom': o.scale = .6 + .4 * e; o.alpha = clamp(t * 2.5, 0, 1); break;
    case 'slap': o.scale = 1 + (1 - e) * .7; o.rot = (1 - e) * 4; o.alpha = clamp(t * 6, 0, 1); break;
  }
  return o;
}
export const camMatrix = (c, W, H) => mmul(mtr(W / 2 + c.sx, H / 2 + c.sy), mmul(mrot((c.rot + c.sr) * RAD), mmul(msc(c.zoom), mtr(-c.x, -c.y))));
export const sheetMatrix = (a, W, H) => mmul(mtr(W / 2 + a.dx, H / 2 + a.dy), mmul(mrot(a.rot * RAD), mmul(msc(a.scale), mtr(-W / 2, -H / 2))));

// ------------------------------------------------------------------ scene + sheet drawing
function noise() {
  if (noiseTile) return noiseTile;
  const c = makeCanvas(128, 128), x = c.getContext('2d'), d = x.createImageData(128, 128);
  for (let i = 0; i < 128 * 128; i++) { const v = hash(i, 7) * 255; d.data[i * 4] = d.data[i * 4 + 1] = d.data[i * 4 + 2] = v; d.data[i * 4 + 3] = hash(i, 11) * 70; }
  x.putImageData(d, 0, 0); return (noiseTile = c);
}
function drawScene(ctx, W, H, sc, Cam) {
  const t = sc.type; ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (t === 'color') { ctx.fillStyle = sc.color || '#2a2f36'; ctx.fillRect(0, 0, W, H); const g = ctx.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, Math.max(W, H) * .8); g.addColorStop(0, 'rgba(255,255,255,.06)'); g.addColorStop(1, 'rgba(0,0,0,.35)'); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return; }
  if (t === 'dark' || t === 'light') {
    const g = ctx.createRadialGradient(W / 2, H * .45, H * .1, W / 2, H / 2, Math.max(W, H) * .75);
    if (t === 'dark') { g.addColorStop(0, '#343b44'); g.addColorStop(1, '#0d1013'); } else { g.addColorStop(0, '#f1f3f4'); g.addColorStop(1, '#aab3ba'); }
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); return;
  }
  const inv = minv(Cam), pts = [[0, 0], [W, 0], [W, H], [0, H]].map(([x, y]) => mapply(inv, x, y));
  const x0 = Math.min(...pts.map(q => q.x)), x1 = Math.max(...pts.map(q => q.x)), y0 = Math.min(...pts.map(q => q.y)), y1 = Math.max(...pts.map(q => q.y));
  ctx.setTransform(...Cam);
  if (t === 'wood') {
    const ph = 170, cols = ['#6b4a2f', '#7a5535', '#5f4029', '#70492c', '#654530'];
    for (let j = Math.floor(y0 / ph); j <= Math.floor(y1 / ph); j++) {
      ctx.fillStyle = cols[Math.floor(hash(j, 1) * cols.length)]; ctx.fillRect(x0, j * ph, x1 - x0, ph + 1);
      ctx.strokeStyle = 'rgba(0,0,0,.14)'; ctx.lineWidth = 1.4; for (let k = 0; k < 9; k++) { const y = j * ph + hash(j, k, 2) * ph; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y + (hash(j, k, 3) - .5) * 10); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,220,170,.06)'; for (let k = 0; k < 4; k++) { const y = j * ph + hash(j, k, 8) * ph; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); }
      ctx.fillStyle = 'rgba(0,0,0,.45)'; ctx.fillRect(x0, j * ph - 1.5, x1 - x0, 3);
      const jw = 900, off = hash(j, 4) * jw; for (let n = Math.floor((x0 - off) / jw); n <= Math.floor((x1 - off) / jw); n++) ctx.fillRect(off + n * jw, j * ph, 3, ph);
    }
    return;
  }
  const cell = 16, pal = ['#9c7143', '#c99f6e', '#8a6238', '#d6b080'];
  ctx.fillStyle = '#b58a5a'; ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  for (let cy = Math.floor(y0 / cell); cy <= Math.floor(y1 / cell); cy++) for (let cx = Math.floor(x0 / cell); cx <= Math.floor(x1 / cell); cx++) {
    const h1 = hash(cx, cy, 5); ctx.fillStyle = pal[Math.floor(hash(cx, cy, 6) * 4)]; const s = 1.5 + hash(cx, cy, 7) * 3.5; ctx.fillRect(cx * cell + hash(cx, cy, 8) * cell, cy * cell + hash(cx, cy, 9) * cell, s, s * (.6 + h1 * .6));
    if (h1 > .93) { ctx.fillStyle = 'rgba(60,35,15,.5)'; ctx.fillRect(cx * cell + hash(cx, cy, 10) * cell, cy * cell + hash(cx, cy, 11) * cell, 3, 3); }
  }
}
const outlineCache = new Map();
function outline(w, h, edge) {
  if (edge !== 'torn') return [[0, 0], [w, 0], [w, h], [0, h]];
  const key = w + 'x' + h; let o = outlineCache.get(key); if (o) return o;
  const pts = [], step = 16, amp = 5, rnd = (i, s) => (hash(i, s, 21) + hash(i, s + 9, 21)) - 1;
  for (let x = 0, i = 0; x < w; x += step, i++) pts.push([x, 1 + amp * (1 + rnd(i, 1))]);
  for (let y = 0, i = 0; y < h; y += step, i++) pts.push([w - 1 - amp * (1 + rnd(i, 2)), y]);
  for (let x = w, i = 0; x > 0; x -= step, i++) pts.push([x, h - 1 - amp * (1 + rnd(i, 3))]);
  for (let y = h, i = 0; y > 0; y -= step, i++) pts.push([1 + amp * (1 + rnd(i, 4)), y]);
  outlineCache.set(key, pts); return pts;
}
function sheetPath(ctx, pts) { ctx.beginPath(); pts.forEach((q, i) => (i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]))); ctx.closePath(); }
function crease(ctx, x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy), nx = -dy / len, ny = dx / len, hw = 16, g = ctx.createLinearGradient(x0 - nx * hw, y0 - ny * hw, x0 + nx * hw, y0 + ny * hw);
  g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(.44, 'rgba(0,0,0,.08)'); g.addColorStop(.5, 'rgba(0,0,0,.2)'); g.addColorStop(.56, 'rgba(255,255,255,.28)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.save(); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(x0 - nx * hw, y0 - ny * hw); ctx.lineTo(x1 - nx * hw, y1 - ny * hw); ctx.lineTo(x1 + nx * hw, y1 + ny * hw); ctx.lineTo(x0 + nx * hw, y0 + ny * hw); ctx.closePath(); ctx.fill(); ctx.restore();
}

/**
 * Draws the whole scene for one frame. Returns the view used, so the editor can hit-test:
 * { M, inv, scale, rects: Map(partId -> paper-space rect), cam, sheet }.
 */
export function drawPaper(ctx, W, H, proj, f, opts = {}) {
  const cam = cameraAt(proj, f, W, H), sa = sheetAnim(proj, f, H), Cam = camMatrix(cam, W, H), tilt = tiltMatrix(proj), M = mmul(sheetMatrix(sa, W, H), mmul(Cam, tilt)), pa = proj.paper;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over'; ctx.clearRect(0, 0, W, H);
  drawScene(ctx, W, H, proj.scene, Cam);
  const rects = new Map(), scale = Math.hypot(M[0], M[1]);
  if (sa.alpha > 0) {
    const color = paperColorOf(proj), pts = outline(pa.w, pa.h, pa.edge), wear = pa.wear ?? .25;
    ctx.setTransform(...M); ctx.globalAlpha = sa.alpha;
    if (pa.shadow) { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.5)'; ctx.shadowBlur = clamp(34 * scale, 6, 80); ctx.shadowOffsetY = clamp(14 * scale, 3, 40); ctx.fillStyle = color; sheetPath(ctx, pts); ctx.fill(); ctx.restore(); }
    const env = { proj, f, fps: proj.fps, onImage: opts.onImage, fadeP: 1 };
    ctx.save(); sheetPath(ctx, pts); ctx.clip(); ctx.fillStyle = color; ctx.fillRect(0, 0, pa.w, pa.h);
    const g = ctx.createRadialGradient(pa.w / 2, pa.h / 2, Math.min(pa.w, pa.h) * .25, pa.w / 2, pa.h / 2, Math.hypot(pa.w, pa.h) * .55); g.addColorStop(0, 'rgba(255,255,255,.05)'); g.addColorStop(1, `rgba(96,64,20,${.1 + wear * .4})`); ctx.fillStyle = g; ctx.fillRect(0, 0, pa.w, pa.h);
    if (pa.grain > 0) { ctx.save(); ctx.globalAlpha = sa.alpha * pa.grain * .5; ctx.fillStyle = ctx.createPattern(noise(), 'repeat'); ctx.fillRect(0, 0, pa.w, pa.h); ctx.restore(); }
    const stains = Math.round(wear * 9); for (let i = 0; i < stains; i++) { const sx = hash(i, 1, 33) * pa.w, sy = hash(i, 2, 33) * pa.h, sr = 40 + hash(i, 3, 33) * 160, sg = ctx.createRadialGradient(sx, sy, 0, sx, sy, sr); sg.addColorStop(0, `rgba(120,80,30,${.05 + hash(i, 4, 33) * .08})`); sg.addColorStop(1, 'rgba(120,80,30,0)'); ctx.fillStyle = sg; ctx.fillRect(sx - sr, sy - sr, sr * 2, sr * 2); }
    const decos = [];
    for (const part of proj.parts) { if (part.kind === 'deco') { decos.push(part); continue; } const r = drawPart(ctx, part, f, env); if (r) rects.set(part.id, r); }
    ctx.globalAlpha = sa.alpha;
    if (pa.fold === 'half' || pa.fold === 'quarter') crease(ctx, 0, pa.h / 2, pa.w, pa.h / 2);
    if (pa.fold === 'quarter') crease(ctx, pa.w / 2, 0, pa.w / 2, pa.h);
    ctx.restore();
    // Tape and pins hang over the edge of the sheet, so they are drawn outside its clip.
    ctx.globalAlpha = sa.alpha; for (const part of decos) { const r = drawPart(ctx, part, f, env); if (r) rects.set(part.id, r); }
  }
  ctx.restore();
  return { M, inv: minv(M), scale, rects, cam, sheet: sa };
}

/** Topmost visible part under a screen point, or null. */
export function hitTest(proj, view, sx, sy, slop = 0) {
  const q = mapply(view.inv, sx, sy), pad = slop / Math.max(.01, view.scale);
  for (let i = proj.parts.length - 1; i >= 0; i--) {
    const part = proj.parts[i], r = view.rects.get(part.id); if (!r) continue;
    if (q.x >= r.x - pad && q.x <= r.x + r.w + pad && q.y >= r.y - pad && q.y <= r.y + r.h + pad) return part.id;
  }
  return null;
}
export const toPaper = (view, sx, sy) => mapply(view.inv, sx, sy);
export function columnsOverflow(p) { return p.kind === 'columns' ? columnsLayout(p).overflow : 0; }
