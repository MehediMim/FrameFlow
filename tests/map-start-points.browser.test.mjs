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
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => reject(Error(`Debugger timeout: ${method}`)), 10000); pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); ws.send(JSON.stringify({ id, method, params })); });
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
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/index.html#map` });
  console.log('Application opened; checking studios');
  await waitFor(`document.body.classList.contains('ff-unified')`);
  await waitFor(`!document.body.classList.contains('landing')`);

  await evaluate(`document.querySelector('[data-mode="map"]').click()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const change=async(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change'));})()`);
  const saved=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await evaluate(`(async()=>{window.testMapEngine=await import('./map-engine.mjs?v=invert-1');window.testMapGeo=window.testMapEngine.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));})()`);
  const clickMap=async(lon,lat)=>evaluate(`(()=>{const E=window.testMapEngine,p=JSON.parse(localStorage.getItem('frameflow-map-v1')),c=document.querySelector('#mCanvas'),r=c.getBoundingClientRect(),v=E.makeView(E.cameraAt(p,window.testMapGeo,p.width,p.height,Math.round(Number(document.querySelector('#mFrame').value)*p.fps)),p.width,p.height),X=E.lonToX(${lon}),q=E.project(v,X+Math.round(v.cx-X),E.latToY(${lat}));c.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:r.left+q.x/p.width*r.width,clientY:r.top+q.y/p.height*r.height,bubbles:true}));})()`);
  await evaluate(`document.querySelector('#mAddGrid [data-madd="border"]').click()`);
  await change('#mInspector [data-madd]','Bangladesh');
  // Remove the default Australia target so this item has one outline.
  await evaluate(`document.querySelector('#mInspector [data-mrm="0"]').click()`);
  await change('#mInspector [data-mf="borderFrom"]','33.3');
  let p=await saved();assert.equal(p.actions.at(-1).borderFrom,33.3);assert.ok(!p.actions.at(-1).borderPartial);
  const endpoint=await evaluate(`(async()=>{const E=window.testMapEngine,R=await import('./map-regions.mjs'),f=window.testMapGeo.byName.get('Bangladesh'),r=f.rings[R.borderRingOf(f)],q=R.borderSection(r,.3,.3);return {lon:E.xToLon(q.xy[0]),lat:E.yToLat(q.xy[1])};})()`);
  await evaluate(`document.querySelector('[data-borderpoint="borderFrom"]').click()`);
  await clickMap(endpoint.lon,endpoint.lat);
  p=await saved();assert.ok(Math.abs(p.actions.at(-1).borderFrom-30)<.1,'full border start snaps to the outline');
  await evaluate(`document.querySelector('#mInspector [data-mf="borderPartial"]').click()`);
  await change('#mInspector [data-mf="borderTo"]','65');
  p=await saved();assert.equal(p.actions.at(-1).borderTo,65);const borderId=p.actions.at(-1).id;
  await evaluate(`document.querySelector('#mAddGrid [data-madd="highlight"]').click()`);
  await evaluate(`document.querySelector('[data-mpick="highlightOrigin"]').click()`);
  await clickMap(135,-25);
  p=await saved();assert.ok(Math.abs(p.actions.at(-1).highlightOrigin.lon-135)<.01);assert.ok(Math.abs(p.actions.at(-1).highlightOrigin.lat+25)<.01);
  await evaluate(`document.querySelector('[data-highlight-reset]').click()`);
  p=await saved();assert.equal(p.actions.at(-1).highlightOrigin,undefined);
  await change('#mInspector [data-mf="highlightOrigin"]','-25, 135');
  p=await saved();assert.equal(p.actions.at(-1).highlightOrigin.kind,'point');
  await evaluate(`location.reload()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>150`);
  p=await saved();assert.equal(p.actions.at(-1).highlightOrigin.lon,135,'fill start survives reload');
  const border=p.actions.find(a=>a.id===borderId);assert.ok(Math.abs(border.borderFrom-30)<.1);assert.equal(border.borderTo,65);
  const E=await import('../map-engine.mjs');E.validateMapProject(p);
  assert.deepEqual(errors,[],'no runtime errors during picking or reload');
  console.log('Full border start picking, partial endpoints, fill origin, reset and reload passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
