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
  assert.equal(requests.some(r=>r.includes('-detail.json')),false,'no detail packs load on the world map');
  const change=async(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change'));})()`);
  const selectRegion=async name=>{
    await evaluate(`(()=>{const el=document.querySelector('#mRegionSearch');el.value=${JSON.stringify(name)};el.dispatchEvent(new Event('input'));})()`);
    await evaluate(`document.querySelector('#mRegionChoices input').click()`);
  };
  const saved=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await change('#mAreaCountry','Bangladesh');
  // Pick several countries directly on the map before adding an item.
  await evaluate(`(async()=>{window.testMapEngine=await import('./map-engine.mjs?v=multi-regions-1');const E=window.testMapEngine;window.testMapGeo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));})()`);
  const clickMap=async(lon,lat)=>evaluate(`(()=>{const E=window.testMapEngine,p=JSON.parse(localStorage.getItem('frameflow-map-v1')),c=document.querySelector('#mCanvas'),r=c.getBoundingClientRect(),v=E.makeView(E.cameraAt(p,window.testMapGeo,p.width,p.height,Math.round(Number(document.querySelector('#mFrame').value)*p.fps)),p.width,p.height),X=E.lonToX(${lon}),q=E.project(v,X+Math.round(v.cx-X),E.latToY(${lat}));c.dispatchEvent(new PointerEvent('pointerdown',{button:0,clientX:r.left+q.x/p.width*r.width,clientY:r.top+q.y/p.height*r.height,bubbles:true}));})()`);
  await evaluate(`document.querySelector('#mPickRegions').click()`);
  await clickMap(2.35,48.85);await clickMap(13.4,52.52);
  assert.equal(await evaluate(`document.querySelector('#mRegionCount').textContent`),'2 selected');
  await evaluate(`document.querySelector('#mPickRegions').click();document.querySelector('#mClearRegions').click()`);
  await selectRegion('Bangladesh');await selectRegion('Myanmar');
  const before=(await saved()).actions.length;
  await evaluate(`document.querySelector('#mAddSelectedBorder').click()`);
  let p=await saved();assert.equal(p.actions.length,before+1);assert.equal(p.actions.at(-1).target.members.length,2);
  await change('#mSelectionMode','separate');
  await evaluate(`document.querySelector('#mAddSelectedHighlight').click()`);
  p=await saved();assert.equal(p.actions.length,before+3);assert.deepEqual(p.actions.slice(-2).map(a=>a.target.name),['Bangladesh','Myanmar']);
  console.log('Countries add together as one item or separately as individual items');
  await change('#mAreaCountry','Bangladesh');
  assert.equal(requests.some(r=>r.includes('-detail.json')),false,'choosing a country alone does not load detail');
  await evaluate(`document.querySelector('#mAddDetailCountry').click()`);
  await waitFor(`document.querySelectorAll('#mDetailLevel option').length>=2`);
  await change('#mAreaCountry','Myanmar');
  await evaluate(`document.querySelector('#mAddDetailCountry').click()`);
  await waitFor(`document.querySelector('#mDetailLevel option')?.value==='division'`);
  p=await saved();assert.equal(p.area.mode,'world');assert.deepEqual(p.area.detailCountries,['Bangladesh','Myanmar']);
  await evaluate(`document.querySelector('#mClearRegions').click()`);
  await selectRegion('Dhaka');
  await evaluate(`document.querySelector('#mAddSelectedBorder').click()`);
  p=await saved();assert.equal(p.actions.at(-1).target.kind,'region');
  await evaluate(`document.querySelector('#mInspector [data-mf="borderPartial"]').click()`);
  await change('#mInspector [data-mf="borderFrom"]','20');await change('#mInspector [data-mf="borderTo"]','65');
  await evaluate(`document.querySelector('#mInspector [data-mf="borderReverse"]').click()`);
  p=await saved();assert.equal(p.actions.at(-1).borderFrom,20);assert.equal(p.actions.at(-1).borderTo,65);assert.equal(p.actions.at(-1).borderReverse,true);
  await change('#mFrame','1');
  await evaluate(`(async()=>{const E=window.testMapEngine;E.installCountryDetail(window.testMapGeo,await fetch('map-data/bangladesh-detail.json').then(r=>r.json()));})()`);
  const endpoint=await evaluate(`(async()=>{const E=window.testMapEngine,R=await import('./map-regions.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),a=p.actions.at(-1),f=window.testMapGeo.byName.get(a.target.name),r=f.rings[R.borderRingOf(f,a.borderRing)],q=R.borderSection(r,.3,.3);return {lon:E.xToLon(q.xy[0]),lat:E.yToLat(q.xy[1])};})()`);
  await evaluate(`document.querySelector('[data-borderpoint="borderFrom"]').click()`);
  await clickMap(endpoint.lon,endpoint.lat);
  p=await saved();assert.ok(Math.abs(p.actions.at(-1).borderFrom-30)<.01,'map endpoint snaps to the border');
  await evaluate(`location.reload()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>150`);
  p=await saved();assert.equal(p.actions.at(-1).borderPartial,true);assert.equal(p.area.mode,'world');
  const E=await import('../map-engine.mjs');E.validateMapProject(p);
  assert.deepEqual(errors,[],'no runtime errors during selection, rendering or reload');
  await evaluate(`document.querySelector('#mRegionSelection').open=true`);
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile(join(tmpdir(),'frameflow-map-review.png'),Buffer.from(screenshot.data,'base64'));
  console.log('Multiple detailed countries remain over the world map; partial borders survive reload');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
