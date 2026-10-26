import assert from 'node:assert/strict';
const E = await import(process.env.ENGINE || '../map-engine.mjs');
const { PIN_STYLES } = await import('../map-pin-styles.mjs');

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
// Styles render, survive validation, and preserve legacy defaults.
{
  for (const pinStyle of Object.keys(PIN_STYLES)) {
    const a = E.makeAction('pin', 0, {pinStyle, place:LONDON, showLabel:false, dur:200});
    const p=E.newMapProject();p.actions=[a];E.validateMapProject(p);
    assert.ok(project([a],60).log.some(l=>l.op==='fill'&&l.fill===a.color),pinStyle+' renders');
  }
  const a=E.makeAction('pin',0,{pinStyle:'dot',place:LONDON,showLabel:false,dur:200,sizeMode:'map',sizeZoom:2});
  const radius=(pin,zoom)=>project([pin],60,p=>{p.camera.init.zoom=zoom;}).log.find(l=>l.op==='arc').args[2];
  assert.ok(Math.abs(radius(a,3)/radius(a,2)-2)<1e-9,'map pin doubles for one zoom level');
  assert.equal(radius({...a,sizeMode:'screen'},3),radius({...a,sizeMode:'screen'},2),'fixed pin keeps its size');
  assert.equal(radius({...a,sizeMode:undefined},3),radius({...a,sizeMode:undefined},2),'legacy pin keeps its size');
  const image=badge({sizeMode:'map',sizeZoom:2});
  assert.ok(Math.abs(radius(image,3)/radius(image,2)-2)<1e-9,'legacy image badge scales too');
  for(const fields of [{pinStyle:'unknown'},{sizeMode:'bad'},{sizeZoom:15},{sizeZoom:NaN}]){
    const p=E.newMapProject();p.actions=[{...a,...fields}];assert.throws(()=>E.validateMapProject(p),/pin/);
  }
}
console.log('Pin styles, rendering, sizing, badges, validation and legacy defaults passed');
