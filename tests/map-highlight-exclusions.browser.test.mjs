import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace = fileURLToPath(new URL('../', import.meta.url));
const browser = process.env.CHROME_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(browser, 'Set CHROME_PATH to a Chrome or Edge executable');
const profile = await mkdtemp(join(tmpdir(), 'frameflow-rename-'));
const requests=[];
const server = createServer(async (req, res) => {
  try {
    requests.push(req.url);
    const path = resolve(workspace, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    assert.ok(path.startsWith(resolve(workspace) + sep));
    const file = path.endsWith(sep) ? join(path, 'index.html') : path;
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json' })[extname(file)] || 'application/octet-stream');
    res.end(await readFile(file));
  } catch { res.writeHead(404); res.end(); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const chrome = spawn(browser, ['--headless=new', '--remote-debugging-port=0', `--user-data-dir=${profile}`, '--no-first-run', '--disable-background-networking', '--disable-gpu', '--window-size=1600,1000', 'about:blank'], { windowsHide: true, stdio: 'ignore' });
chrome.on('error', e => console.error(e.message));
let ws;
const sleep = ms => new Promise(r => setTimeout(r, ms));
try {
  let debugPort;
  for (let i = 0; i < 100; i++) {
    try { debugPort = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break; } catch { await sleep(100); }
  }
  assert.ok(debugPort, 'Browser debugging did not start');
  console.log('Browser started; connecting debugger');
  const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`, { signal: AbortSignal.timeout(10000) }).then(r => r.json());
  ws = new WebSocket(pages.find(p => p.type === 'page').webSocketDebuggerUrl);
  await new Promise((r, reject) => { ws.addEventListener('open', r); ws.addEventListener('error', reject); });
  let serial = 0; const pending = new Map(), errors = [];
  ws.addEventListener('message', e => {
    const msg = JSON.parse(e.data);
    if (msg.method === 'Runtime.exceptionThrown') errors.push(msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text);
    if (msg.id) { const p = pending.get(msg.id); pending.delete(msg.id); msg.error ? p.reject(Error(msg.error.message)) : p.resolve(msg.result); }
  });
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => reject(Error(`Debugger timeout: ${method}`)), 45000); pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => {
    const r = await cdp('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
    return r.result.value;
  };
  const waitFor = async expression => {
    for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await sleep(100); }
    throw Error(`Timed out: ${expression}\n${errors.join('\n')}`);
  };
  await cdp('Runtime.enable'); await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1600, height: 1000, deviceScaleFactor: 1, mobile: false });






  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html#map`});
  await waitFor(`document.body?.classList.contains('mode-map')&&document.querySelectorAll('#mDlCountry option').length>100`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),p=E.newMapProject();p.frames=300;p.camera.init={lon:2,lat:46,zoom:5,bearing:0,pitch:0};
    p.actions=[E.makeAction('highlight',0,{id:'exclude-test',target:{kind:'country',name:'France'},color:'#ff2020',dim:0,pulse:false,showLabel:false,dur:240,animDur:1})];
    localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();
  })()`);
  await waitFor(`document.querySelector('[data-mid="exclude-test"]')&&document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`document.querySelector('[data-mid="exclude-test"]').click()`);await change('#mFrame','4');
  await evaluate(`document.querySelector('[data-exclusion-draw]').click()`);
  // Invalid outlines do not change the highlight.
  await evaluate(`document.querySelector('[data-exclusion-apply]').click()`);
  assert.equal((await stored()).actions[0].highlightExclude,undefined);
  const mapClick=async(lon,lat)=>{
    const point=await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),...i},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),b=document.querySelector('#mCanvas').getBoundingClientRect();return{x:b.left+q.x/p.width*b.width,y:b.top+q.y/p.height*b.height};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
  };
  for(const [lon,lat]of [[1,45],[3,45],[3,47],[1,47]])await mapClick(lon,lat);
  await change('[data-exclusion-name]','Leave this part unfilled');
  await evaluate(`document.querySelector('[data-exclusion-apply]').click()`);
  let a=(await stored()).actions[0];assert.equal(a.target.name,'France');assert.equal(a.highlightExclude.length,1);assert.equal(a.highlightExclude[0].path.length,4);
  await evaluate(`document.querySelector('#mUndo').click()`);assert.equal((await stored()).actions[0].highlightExclude,undefined);
  await evaluate(`document.querySelector('#mRedo').click()`);assert.equal((await stored()).actions[0].highlightExclude.length,1);
  await evaluate(`document.querySelector('[data-exclusion-draw]').click()`);await mapClick(-1,45);await evaluate(`document.querySelector('[data-exclusion-cancel]').click()`);
  assert.equal((await stored()).actions[0].highlightExclude.length,1,'cancel keeps committed exclusions');
  const render=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    p.texture={type:'none'};p.atlasLabels={countries:false,oceans:false};p.actions[0].dim=0;p.actions[0].showLabel=false;
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=600;const ctx=canvas.getContext('2d');
    const sample=actions=>{const v=E.drawMap(ctx,960,600,{...p,actions},120,geo);return [[2,46],[-1,46],[2.5,46]].map(([lon,lat])=>{const q=E.project(v,E.lonToX(lon),E.latToY(lat));return [...ctx.getImageData(Math.round(q.x),Math.round(q.y),1,1).data];});};
    const a=p.actions[0],base=sample([]),cut=sample([a]),full=sample([{...a,highlightExclude:[]}]);
    const overlap={kind:'polygon',name:'Overlap',path:[{lon:2,lat:45},{lon:4,lat:45},{lon:4,lat:47},{lon:2,lat:47}]};
    const overlapping=sample([{...a,highlightExclude:[...a.highlightExclude,overlap]}]);
    const old={...a,id:'older',color:'#2020ff',highlightExclude:[]},under=sample([old]),stack=sample([old,{...a,start:1}]);
    const flagCanvas=document.createElement('canvas');flagCanvas.width=flagCanvas.height=32;flagCanvas.getContext('2d').fillStyle='#20ff20';flagCanvas.getContext('2d').fillRect(0,0,32,32);
    const flag={...a,highlightFill:'flag',image:flagCanvas.toDataURL()};await E.preloadBadges({...p,actions:[flag]});const flagCut=sample([flag]);
    sample([a]);const png=canvas.toDataURL();
    const {exportMapVideo}=await import('./map-video-export.mjs');const bytes=(await exportMapVideo({canvas,fps:24,frames:3,draw:frame=>E.drawMap(ctx,960,600,p,120+frame,geo)})).size;
    return {base,cut,full,overlapping,under,stack,flagCut,png,bytes};
  })()`);
  assert.deepEqual(render.cut[0],render.base[0],'excluded part shows the unchanged map');
  assert.deepEqual(render.cut[1],render.full[1],'remaining country receives the full highlight');
  assert.notDeepEqual(render.full[0],render.base[0],'test point is inside the country highlight');
  assert.deepEqual(render.overlapping[2],render.base[2],'overlapping exclusions remain excluded');
  assert.deepEqual(render.stack[0],render.under[0],'older highlights remain visible through newer exclusions');
  assert.deepEqual(render.flagCut[0],render.base[0],'flag fills respect exclusions');
  assert.notDeepEqual(render.flagCut[1],render.base[1],'flag still fills the rest of the country');
  assert.ok(render.bytes>100);
  await writeFile(join(tmpdir(),'frameflow-highlight-exclusions.png'),Buffer.from(render.png.split(',')[1],'base64'));
  const saved=await stored();await evaluate('location.reload()');await waitFor(`document.querySelector('[data-mid="exclude-test"]')`);assert.deepEqual(await stored(),saved);
  await evaluate(`document.querySelector('[data-mid="exclude-test"]').click()`);assert.equal(await evaluate(`document.querySelectorAll('[data-exclusion-remove]').length`),1);
  await evaluate(`document.querySelector('[data-exclusion-remove]').click()`);assert.equal((await stored()).actions[0].highlightExclude.length,0);
  assert.deepEqual(errors,[]);
  console.log('Country highlight exclusions: drawing, invalid outlines, undo/redo, cancel, overlapping cuts, stacked highlights, flag fills, persistence, removal and export passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
