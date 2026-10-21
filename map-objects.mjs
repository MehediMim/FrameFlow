// Map objects, effects and shapes: units, places and hazards you can place, move and animate
// (war maps, disasters, logistics...). Everything is drawn as vector shapes in code, so it looks the
// same on every device and in exported video. The engine passes its helpers in as `H`.
import { drawBanner } from './map-banner.mjs';
import { HISTORIC_OBJECTS } from './map-historic-objects.mjs';
import { DOCUMENTARY_OBJECTS } from './map-documentary-objects.mjs';
import { MODERN_OBJECTS, CIVILIAN_OBJECTS } from './map-modern-objects.mjs';
import { TIME_OBJECTS } from './map-time-objects.mjs';
import { LANDMARK_OBJECTS } from './map-landmark-objects.mjs';
import { PEOPLE_OBJECTS } from './map-people-objects.mjs';
import { NETWORK_SHAPES, pathAt, revealPolyline, clipPolyline, drawNetwork } from './map-path-animation.mjs';
import { BATTLE_EFFECTS, drawBattleEffect, targetedAttack } from './map-battle-effects.mjs';
import { drawDamage, drawRubble } from './map-damage.mjs';
const TAU = Math.PI * 2, dark = '#1d2226', light = '#eef2f4', metal = '#9aa5ad';
const stroke = (c, s) => { c.lineJoin = 'round'; c.strokeStyle = 'rgba(0,0,0,.55)'; c.lineWidth = Math.max(1, s * .05); c.stroke(); };
const poly = (c, pts, fill, s) => { c.beginPath(); pts.forEach(([x, y], i) => (i ? c.lineTo(x * s, y * s) : c.moveTo(x * s, y * s))); c.closePath(); c.fillStyle = fill; c.fill(); stroke(c, s); };
const rect = (c, x, y, w, h, fill, s, r = .06) => { c.beginPath(); c.roundRect(x * s, y * s, w * s, h * s, r * s); c.fillStyle = fill; c.fill(); stroke(c, s); };
const circ = (c, x, y, r, fill, s) => { c.beginPath(); c.arc(x * s, y * s, r * s, 0, TAU); c.fillStyle = fill; c.fill(); stroke(c, s); };

// Each icon is drawn in a box of about -1..1 (s = half size in px), facing right.
// rot: turns fully to its heading when it moves; otherwise it just mirrors. air: floats above the ground.
export const OBJECT_ICONS = {
  image: { label: 'Image badge', color: '#ffffff' },
  artwork: { label: 'SVG / PNG image', color: '#ffffff' },
  banner: { label: 'Hanging image flag', color: '#b89963' },
  army: { label: 'Mixed army formation', color: '#9d4d40', group:'armies', historic:true, draw:(c,s,col,t)=>{for(const x of[-.55,.05,.65]){c.save();c.translate(x*s,0);OBJECT_ICONS.musketeer.draw(c,s*.55,col,t);c.restore();}} },
  ...HISTORIC_OBJECTS,
  ...DOCUMENTARY_OBJECTS,
  ...MODERN_OBJECTS,
  ...CIVILIAN_OBJECTS,
  ...TIME_OBJECTS,
  ...LANDMARK_OBJECTS,
  ...PEOPLE_OBJECTS,
  flag: { label: 'Flag', color: '#e63946', draw: (c, s, col, t) => { const top = [], bot = []; for (let i = 0; i <= 10; i++) { const x = .03 + i / 10 * .9, w = Math.sin(t * .2 + i * .6) * .05 * (i / 10 + .3); top.push([x, -.98 + w]); bot.push([x, -.45 + w]); } poly(c, [...top, ...bot.reverse()], col, s); rect(c, -.05, -1, .08, 1.4, light, s, .03); } },
  checkpoint: { label: 'Checkpoint', color: '#c9a227', draw: (c, s, col) => { rect(c, -.9, -.1, .5, .5, metal, s); rect(c, -.4, .08, 1.3, .12, '#e63946', s, .02); rect(c, -.05, .08, .2, .12, light, s, .01); rect(c, .4, .08, .2, .12, light, s, .01); rect(c, .85, -.1, .12, .5, dark, s, .02); } },
  storm: { label: 'Storm', color: '#7aa0c4', draw: (c, s, col) => { rect(c, -.75, -.2, 1.5, .35, col, s, .15); circ(c, -.4, -.2, .35, col, s); circ(c, 0, -.4, .45, col, s); circ(c, .4, -.2, .35, col, s); poly(c, [[0, .05], [-.25, .55], [0, .5], [-.1, 1], [.3, .35], [.05, .4]], '#ffd166', s); } },
  volcano: { label: 'Volcano', color: '#8b4a2b', draw: (c, s, col, t) => { poly(c, [[-1, .5], [-.25, -.4], [.25, -.4], [1, .5]], col, s); poly(c, [[-.25, -.4], [.25, -.4], [.12, -.18], [-.1, -.08]], '#ff5a1f', s); for (let i = 0; i < 3; i++) { const q = ((t * .015) + i / 3) % 1; c.globalAlpha *= .7; circ(c, Math.sin(i * 2 + q) * .2, -.55 - q * .8, .15 + q * .2, 'rgba(70,70,75,.55)', s); } } },
};
export const OBJECT_ENTER = [['drop', 'Drop in'], ['fade', 'Fade in'], ['grow', 'Grow'], ['none', 'Instant']];
export const OBJECT_IDLE = [['none', 'Still'], ['pulse', 'Pulse'], ['shake', 'Shake'], ['bob', 'Bob up and down'], ['spin', 'Spin']];
export const OBJECT_EXIT = [['none', 'Stay until the bar ends'], ['fade', 'Fade out'], ['shrink', 'Shrink'], ['explode', 'Explode']];
export const EFFECTS = {
  ...BATTLE_EFFECTS,
  explosion: { label: 'Explosion', color: '#ff7a1a' }, fire: { label: 'Fire', color: '#ff5a1f' }, smoke: { label: 'Smoke', color: '#6b7278' },
  shockwave: { label: 'Shockwave', color: '#ffffff' }, quake: { label: 'Earthquake rings', color: '#ff4d4d' }, blast: { label: 'Blast / danger radius', color: '#ff3b30' },
  strike: { label: 'Missile strike (launch → target)', color: '#ff7a1a' },
};
export const SHAPES = {
  ...NETWORK_SHAPES,
  arrow: { label: 'Attack arrow', color: '#e63946' }, retreat: { label: 'Retreat arrow', color: '#f4a261' }, front: { label: 'Front line', color: '#d62828' },
  zone: { label: 'Zone / occupied area', color: '#e9c46a' }, noFly: { label: 'No-fly / restricted zone', color: '#ff595e' },
};

// ---------------------------------------------------------------- objects
export function drawObject(H, c, v, geo, a, frame, labels) {
  if (!H.actAlpha(a, frame)) return;
  if (a.glyph === 'image') { H.drawBadge(c, v, geo, a, frame, labels); return; }
  const ic = OBJECT_ICONS[a.glyph] || OBJECT_ICONS.tank, u = v.unit, size = a.size || 1, s = 26 * size * u, t = frame - a.start;
  let X, Y, ang = null;
  if (a.mode === 'path' || a.mode === 'move') {
    const r = H.planeRoute(geo, a.mode === 'move' ? { ...a, mode: 'direct', from: a.place } : a); if (!r) return;
    const p = H.ease(a.easing, H.actionProgress(a, frame)), pt = H.routeAt(r, p), k = Math.round(v.cx - pt.X);
    X = pt.X + k; Y = pt.Y;
    const p0 = H.routeAt(r, Math.max(0, p - .02)), p1 = H.routeAt(r, Math.min(1, p + .02)), q0 = H.project(v, p0.X + k, p0.Y), q1 = H.project(v, p1.X + k, p1.Y);
    if (Math.hypot(q1.x - q0.x, q1.y - q0.y) > .5) ang = Math.atan2(q1.y - q0.y, q1.x - q0.x);
    if (a.trail !== false && pt.i > 0) {
      c.save(); c.beginPath(); let on = false;
      for (let i = 0; i <= pt.i; i++) { const q = H.project(v, r.X[i] + k, r.Y[i]); if (q.z < v.near) { on = false; continue; } if (on) c.lineTo(q.x, q.y); else { c.moveTo(q.x, q.y); on = true; } }
      const e = H.project(v, X, Y); if (on) c.lineTo(e.x, e.y);
      c.globalAlpha = .75; c.strokeStyle = a.color; c.lineWidth = 3 * u; c.setLineDash([8 * u, 6 * u]); c.lineCap = 'round'; c.stroke(); c.restore();
    }
  } else { const r = H.resolveLoc(geo, a.place, v.cx); if (!r) return; X = r.X; Y = r.Y; }
  const left = a.start + a.dur - frame;
  if (a.exit === 'explode') { const xe = H.clamp01(1 - left / 30); if (xe > .1) { c.save(); explosion(H, c, v, X, Y, s * 1.6, (xe - .1) / .9, '#ff7a1a', frame); c.restore(); return; } }
  const enter = a.enter === 'none' ? 1 : H.clamp01(t / 18), xd = a.exit === 'none' ? 0 : H.clamp01(1 - left / 18);
  let alpha = 1, sc = 1, dx = 0, dy = 0, rot = 0;
  if (a.enter === 'drop') { dy = -(1 - H.bounce(enter)) * 220 * u; alpha = H.clamp01(enter * 3); } else if (a.enter === 'fade') alpha = enter; else if (a.enter === 'grow') sc = H.ease('backOut', enter);
  if (a.idle === 'pulse') sc *= 1 + .08 * Math.sin(t * .35); else if (a.idle === 'shake') { dx = Math.sin(t * 2.3) * 2.2 * u; dy += Math.cos(t * 3.1) * 1.6 * u; } else if (a.idle === 'bob') dy += Math.sin(t * .2) * 5 * u; else if (a.idle === 'spin') rot = t * .12;
  if (a.exit === 'fade') alpha *= 1 - xd; else if (a.exit === 'shrink') sc *= 1 - xd;
  alpha *= (a.groupOpacity??1)*(a.opacity??1);
  if (alpha <= 0 || sc <= 0) return;
  const lift = ic.air ? 38 * size * u : 0, g0 = H.project(v, X, Y, 0), g = H.project(v, X, Y, lift);
  if (g.z < v.near) return;
  c.save();
  if(a.glyph!=='artwork'){c.globalAlpha = alpha * .28; c.fillStyle = '#000'; c.beginPath(); c.ellipse(g0.x, g0.y, s * .7 * sc, s * .18 * sc, 0, 0, TAU); c.fill();}
  c.globalAlpha = alpha; c.translate(g.x + dx, g.y - (ic.air || a._wallSegment ? 0 : s * .5 * sc) + dy);
  if (ang !== null && a.glyph !== 'banner') { if (ic.rot) c.rotate(ang); else if (Math.cos(ang) < 0) c.scale(-1, 1); }
  c.rotate(rot+((a.objectAngle||0)+(a.formation==='wall'?(a.formationAngle||0):0))*Math.PI/180); c.scale(sc, sc);
  if(a.damageState==='destroyed')drawRubble(c,s,['galleon','caravel','galley','warship','submarine','ferry','cargoShip'].includes(a.glyph));
  else{
    if(a.glyph==='banner')drawBanner(c,s,a.color,a,t/(v.fps||30),H.objectImage?.(a.image));
    else if(a.glyph==='artwork') {
      const img=H.objectImage?.(a.image);
      if(img){const factor=3.5*s/Math.max(img.naturalWidth,img.naturalHeight),w=img.naturalWidth*factor,h=img.naturalHeight*factor;c.drawImage(img,-w/2,-h/2,w,h);}
      else {c.strokeStyle='#ffffff';c.lineWidth=2*u;c.strokeRect(-s,-s,2*s,2*s);}
    }
    else ic.draw(c, s, a.color, ic.historic || ic.timeUnit==='seconds' ? t/(v.fps||30) : t);
    drawDamage(c,s,a.damageState,t/(v.fps||30));
  }
  c.restore();
  if (a.showLabel) { const off = -s * (ic.labelOffset ?? (a.glyph==='banner'?6:ic.historic?2.8:1.5)) - lift; labels.push({ x: g0.x + dx, y: g0.y + off, ground: { X, Y }, groundOffset: { y: off }, text: a.label || ic.label, alpha: alpha * Math.min(1, sc), scale: 1 }); }
}

// ---------------------------------------------------------------- effects
function fireball(c, x, y, r, col, alpha) {
  if (alpha <= 0 || r <= 0) return;
  const g = c.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, '#fff6c8'); g.addColorStop(.35, '#ffc93c'); g.addColorStop(.7, col); g.addColorStop(1, 'rgba(40,10,0,0)');
  c.globalAlpha = alpha; c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
function explosion(H, c, v, X, Y, s, p, col, frame) {
  const g = H.project(v, X, Y, 0), u = v.unit, e = 1 - (1 - p) ** 3, cy = g.y - s * .35;
  if (p < .18) { c.globalAlpha = 1 - p / .18; c.fillStyle = '#fff'; c.beginPath(); c.arc(g.x, cy, s * (.5 + p * 3), 0, TAU); c.fill(); }
  fireball(c, g.x, cy, s * (.25 + e * 1.1), col, Math.max(0, 1 - p * p * 1.1));
  c.beginPath(); H.groundCircle(c, v, X, Y, s * (.4 + e * 2.4)); c.globalAlpha = Math.max(0, 1 - p) * .7; c.strokeStyle = '#fff'; c.lineWidth = 2.5 * u; c.stroke();
  c.fillStyle = '#ffd166';
  for (let i = 0; i < 14; i++) { const an = i * 2.399, d = s * (.3 + e * (.9 + (i % 4) * .35)); c.globalAlpha = Math.max(0, 1 - p) * .9; c.beginPath(); c.arc(g.x + Math.cos(an) * d, cy + Math.sin(an) * d * .7 + p * p * s * .5, 2.2 * u, 0, TAU); c.fill(); }
  if (p > .25) for (let i = 0; i < 5; i++) { const q = (p - .25) / .75; c.globalAlpha = (q < .4 ? q / .4 : (1 - q) / .6) * .45; c.fillStyle = '#3a3f44'; c.beginPath(); c.arc(g.x + (i - 2) * s * .28, g.y - s * (.5 + q * 1.4 + (i % 2) * .2), s * (.25 + q * .3), 0, TAU); c.fill(); }
}
function rings(H, c, v, X, Y, s, p, col, n, spread, w) {
  for (let i = 0; i < n; i++) { const q = (p * n * .6 + i / n) % 1; c.beginPath(); H.groundCircle(c, v, X, Y, s * (.2 + q * spread)); c.globalAlpha = (1 - q) * .85; c.strokeStyle = col; c.lineWidth = w * v.unit; c.stroke(); }
}
export function drawEffect(H, c, v, geo, a, frame, labels) {
  if (!H.actAlpha(a, frame)) return;
  const targetObject=a.attackTargeted&&v.objects?.get(a.attackTargetId);
  const r = targetObject ? H.objectLocationAt(v,geo,targetObject,frame) : H.resolveLoc(geo, a.place, v.cx); if (!r) return;
  const base = H.actionProgress(a, frame), rep = Math.max(1, a.repeat | 0 || 1), p = base >= 1 ? 1 : (base * rep) % 1, env = Math.min(1, base / .08, (1 - base) / .08 + .001);
  const u = v.unit, s = 40 * (a.size || 1) * u, g = H.project(v, r.X, r.Y, 0); if (g.z < v.near) return;
  c.save();
  if (EFFECTS[a.fx]?.battle){
    let origin=g,settings=a;
    if(a.attackTargeted&&['cannonShot','musketVolley','arrowVolley'].includes(a.fx)){
      const sourceObject=v.objects?.get(a.attackSourceId),from=sourceObject?H.objectLocationAt(v,geo,sourceObject,frame):H.resolveLoc(geo,a.from,v.cx);
      if(!from){c.restore();return;}
      origin=H.project(v,from.X,from.Y);if(origin.z<v.near){c.restore();return;}
      settings={...a,...targetedAttack(origin,g,s)};
    }
    drawBattleEffect(c,a.fx,origin,s,p,env,settings,(frame-a.start)/(v.fps||30));
  }
  else if (a.fx === 'explosion') explosion(H, c, v, r.X, r.Y, s, p, a.color, frame);
  else if (a.fx === 'shockwave') rings(H, c, v, r.X, r.Y, s, p, a.color, 3, 3, 3);
  else if (a.fx === 'quake') { rings(H, c, v, r.X, r.Y, s, p, a.color, 4, 2.6, 3.5); c.globalAlpha = 1; c.fillStyle = a.color; c.beginPath(); c.arc(g.x, g.y, 4 * u, 0, TAU); c.fill(); }
  else if (a.fx === 'blast') { const k = 1.5 * H.ease('easeOut', H.clamp01(p * 3)) * s; c.beginPath(); H.groundCircle(c, v, r.X, r.Y, Math.max(1, k)); c.globalAlpha = (.2 + .08 * Math.sin(frame * .3)) * env; c.fillStyle = a.color; c.fill(); c.globalAlpha = .9 * env; c.strokeStyle = a.color; c.lineWidth = 2.5 * u; c.stroke(); }
  else if (a.fx === 'fire') {
    c.globalAlpha = .25 * env; c.fillStyle = a.color; c.beginPath(); c.ellipse(g.x, g.y - s * .3, s * .7, s * .5, 0, 0, TAU); c.fill();
    for (let i = 0; i < 7; i++) { const f = Math.sin(frame * .4 + i * 1.7), x = g.x + (i - 3) * s * .16, h = s * (.7 + .35 * f) * (1 - Math.abs(i - 3) * .12), w = s * .17; c.globalAlpha = env; const gr = c.createLinearGradient(0, g.y, 0, g.y - h); gr.addColorStop(0, '#ffd166'); gr.addColorStop(1, a.color); c.fillStyle = gr; c.beginPath(); c.moveTo(x - w, g.y); c.quadraticCurveTo(x - w, g.y - h * .5, x + f * s * .06, g.y - h); c.quadraticCurveTo(x + w, g.y - h * .5, x + w, g.y); c.closePath(); c.fill(); }
  } else if (a.fx === 'smoke') {
    for (let i = 0; i < 8; i++) { const q = ((frame / 60) + i / 8) % 1; c.globalAlpha = (1 - q) * .45 * env; c.fillStyle = a.color; c.beginPath(); c.arc(g.x + Math.sin(i * 3 + q * 3) * s * .35, g.y - q * s * 1.8, s * (.18 + q * .3), 0, TAU); c.fill(); }
  } else if (a.fx === 'strike') {
    const f = a.from && H.resolveLoc(geo, a.from, r.X), fl = .6;
    if (f && p < fl) {
      const q = p / fl, at = k => { const kk = Math.max(0, k); return H.project(v, f.X + (r.X - f.X) * kk, f.Y + (r.Y - f.Y) * kk, Math.sin(Math.PI * kk) * 110 * u * (a.size || 1)); };
      const m = at(q), m0 = at(q - .03);
      c.beginPath(); for (let k = 0; k <= 12; k++) { const t = at(q - k * .025); if (k) c.lineTo(t.x, t.y); else c.moveTo(t.x, t.y); }
      c.globalAlpha = .7; c.strokeStyle = '#ffd9a0'; c.lineWidth = 2.5 * u; c.lineCap = 'round'; c.stroke();
      c.globalAlpha = 1; c.translate(m.x, m.y); c.rotate(Math.atan2(m.y - m0.y, m.x - m0.x)); OBJECT_ICONS.missile.draw(c, 13 * (a.size || 1) * u, '#d9d9d9', frame);
    } else if (p >= fl || !f) explosion(H, c, v, r.X, r.Y, s, f ? (p - fl) / (1 - fl) : p, a.color, frame);
  }
  c.restore();
  if (a.showLabel) labels.push({ x: g.x, y: g.y - s * 1.7, ground: { X: r.X, Y: r.Y }, groundOffset: { y: -s * 1.7 }, text: a.label || EFFECTS[a.fx].label, alpha: Math.min(1, env), scale: 1 });
}

// ---------------------------------------------------------------- shapes (arrows, front lines, zones)
export function drawShape(H, c, v, geo, a, frame, labels) {
  if(a.pathKeys?.length)a={...a,path:pathAt(a,frame)};
  if (!H.actAlpha(a, frame) || a.mode !== 'path' || (a.path || []).length < 2) return;
  const r = H.planeRoute(geo, a); if (!r) return;
  const u = v.unit, k = Math.round(v.cx - r.mid), p = a.revealPath===false?1:H.ease(a.easing, H.actionProgress(a, frame)), P = [];
  for (let i = 0; i < r.n; i++) { const q = H.project(v, r.X[i] + k, r.Y[i]); P.push(q.z < v.near ? null : q); }
  const zone = a.shape === 'zone' || a.shape === 'noFly', w = (a.width || 6) * u;
  let text = null;
  c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
  if(Object.hasOwn(NETWORK_SHAPES,a.shape)){
    const visible=['static','flow'].includes(a.networkAnimation)?P:revealPolyline(P,p);
    drawNetwork(c,clipPolyline(visible,v.W,v.H,40*u),a,u,(frame-a.start)/(v.fps||30));
    const end=visible.filter(Boolean).at(-1);c.restore();
    if(a.showLabel&&a.label&&end)labels.push({x:end.x,y:end.y-16*u,text:a.label,alpha:1,scale:1});
    return;
  }
  if (zone) {
    const pts = P.filter(Boolean); if (pts.length < 3) { c.restore(); return; }
    c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath();
    c.globalAlpha = (a.fillAlpha ?? .28) * p; c.fillStyle = a.color; c.fill();
    if (a.shape === 'noFly') {
      let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; for (const q of pts) { x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
      c.save(); c.clip(); c.beginPath(); for (let x = x0 - (y1 - y0); x < x1; x += 12 * u) { c.moveTo(x, y1); c.lineTo(x + (y1 - y0), y0); } c.globalAlpha = .55 * p; c.strokeStyle = a.color; c.lineWidth = 1.6 * u; c.stroke(); c.restore();
    }
    c.beginPath(); pts.forEach((q, i) => (i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y))); c.closePath();
    c.globalAlpha = .95 * p; c.strokeStyle = a.color; c.lineWidth = w * .6; c.setLineDash(a.shape === 'noFly' ? [10 * u, 7 * u] : []); c.stroke();
    text = { x: pts.reduce((s, q) => s + q.x, 0) / pts.length, y: pts.reduce((s, q) => s + q.y, 0) / pts.length };
  } else {
    const e = p * (r.n - 1), L = []; let i = 0;
    if(a.shape==='front')L.push(...revealPolyline(P,p));
    else{
      for (; i <= Math.floor(e) && i < r.n; i++) { if (!P[i]) break; L.push(P[i]); }
      if (i === Math.floor(e) + 1 && P[i] && e % 1 > 0) L.push({ x: P[i - 1].x + (P[i].x - P[i - 1].x) * (e % 1), y: P[i - 1].y + (P[i].y - P[i - 1].y) * (e % 1) });
    }
    if (L.filter(Boolean).length < 2) { c.restore(); return; }
    const path = () => { c.beginPath();let pen=false;for(const q of L){if(q){if(pen)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);}pen=!!q;} };
    const lw = a.shape === 'front' ? w * .8 : w * 1.4, dash = a.shape === 'retreat' ? [10 * u, 7 * u] : [];
    path(); c.globalAlpha = .35; c.strokeStyle = '#000'; c.lineWidth = lw + 3 * u; c.setLineDash(dash); c.stroke();
    path(); c.globalAlpha = .95; c.strokeStyle = a.color; c.lineWidth = lw; c.stroke(); c.setLineDash([]);
    const end = L.filter(Boolean).at(-1);
    if (a.shape === 'front') {
      const gap = 24 * u * (.6 + (a.width || 6) / 12), th = 9 * u * (.6 + (a.width || 6) / 12); let acc = gap / 2;
      c.fillStyle = a.color; c.globalAlpha = .95;
      const visible=clipPolyline(L,v.W,v.H,th*3);let teeth=0;
      for (let j = 1; j < visible.length&&teeth<4000; j++) {
        if(!visible[j]||!visible[j-1]){acc=gap/2;continue;}
        const dx = visible[j].x - visible[j - 1].x, dy = visible[j].y - visible[j - 1].y, len = Math.hypot(dx, dy); if (!len) continue;
        const side=a.frontSide==='right'?-1:1,ux = dx / len, uy = dy / len; let d = acc;
        for (; d < len&&teeth<4000; d += gap,teeth++) { const bx = visible[j - 1].x + ux * d, by = visible[j - 1].y + uy * d; c.beginPath(); c.moveTo(bx - ux * th * .6, by - uy * th * .6); c.lineTo(bx + ux * th * .6, by + uy * th * .6); c.lineTo(bx - uy * th * 1.2*side, by + ux * th * 1.2*side); c.closePath(); c.fill(); }
        acc = d - len;
      }
    } else if (p > .03) {
      let ref = L[L.length - 2]; for (let j = L.length - 2; j >= 0; j--) { ref = L[j]; if (Math.hypot(end.x - ref.x, end.y - ref.y) > w * 3) break; }
      const dx = end.x - ref.x, dy = end.y - ref.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, hl = w * 3.2, hw = w * 1.7;
      c.beginPath(); c.moveTo(end.x + ux * hl * .3, end.y + uy * hl * .3); c.lineTo(end.x - ux * hl * .7 - uy * hw, end.y - uy * hl * .7 + ux * hw); c.lineTo(end.x - ux * hl * .7 + uy * hw, end.y - uy * hl * .7 - ux * hw); c.closePath();
      c.globalAlpha = .95; c.fillStyle = a.color; c.fill(); c.strokeStyle = 'rgba(0,0,0,.45)'; c.lineWidth = 1.5 * u; c.stroke();
    }
    text = { x: end.x, y: end.y - 18 * u };
  }
  c.restore();
  if (a.showLabel && a.label && text) labels.push({ x: text.x, y: text.y, text: a.label, alpha: Math.min(1, p * 2), scale: 1 });
}
