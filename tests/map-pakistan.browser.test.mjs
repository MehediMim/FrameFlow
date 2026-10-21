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
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=E.newMapProject();p.camera.init={lon:69.5,lat:30.5,zoom:4.5,pitch:0,bearing:0};p.area.detailCountries=['Pakistan'];p.area.detailLevels={Pakistan:'division'};localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`[...document.querySelectorAll('#mDlCountry option')].some(o=>o.value==='Pakistan / Punjab')`);
  const regions=await evaluate(`[...document.querySelectorAll('#mDlCountry option')].filter(o=>o.value.startsWith('Pakistan / ')).map(o=>o.value)`);
  assert.equal(regions.length,7,'all seven provincial/territorial options load automatically');
  for(const name of ['Sindh','Punjab','Balochistan','Khyber Pakhtunkhwa','Islamabad Capital Territory','Gilgit-Baltistan','Azad Kashmir'])assert.ok(regions.includes('Pakistan / '+name));
  const point=(lon,lat)=>evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),zoom:i.zoom,bearing:0,pitch:0},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),r=document.querySelector('#mCanvas').getBoundingClientRect();return{x:r.x+q.x/p.width*r.width,y:r.y+q.y/p.height*r.height};})()`);
  const click=async(p,shift=false,button='left')=>{for(const type of ['mousePressed','mouseReleased'])await cdp('Input.dispatchMouseEvent',{type,...p,button,buttons:type==='mouseReleased'?0:button==='right'?2:1,modifiers:shift?8:0,clickCount:1});};
  await click(await point(74.3587,31.5204));
  await click(await point(67.0011,24.8607),true);
  assert.equal(await evaluate(`document.querySelector('#mMapContext').hidden`),true,'bare province selection has no premature settings');
  await click(await point(67.0011,24.8607),false,'right');
  await evaluate(`document.querySelector('#mMapAddContext [data-direct-highlight]').click()`);
  let p=await stored();const highlight=p.actions.at(-1);
  assert.deepEqual(highlight.target.members.map(t=>t.name).sort(),['Pakistan / Punjab','Pakistan / Sindh']);
  assert.ok(await evaluate(`!!document.querySelector('#mMapContext [data-direct-land="color"]')`));
  await change('[data-mexclude]','Pakistan / Punjab');
  assert.equal((await stored()).actions.at(-1).highlightExclude[0].name,'Pakistan / Punjab');
  await click(await point(66.975,30.1798));await click(await point(66.975,30.1798),false,'right');
  await evaluate(`document.querySelector('#mMapAddContext [data-direct-border]').click()`);
  assert.equal((await stored()).actions.at(-1).target.name,'Pakistan / Balochistan');
  await writeFile(join(tmpdir(),'frameflow-pakistan-provinces.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const saved=await stored();await evaluate('location.reload()');
  await waitFor(`[...document.querySelectorAll('#mDlCountry option')].some(o=>o.value==='Pakistan / Sindh')`);
  assert.deepEqual(await stored(),saved,'Pakistan detail selection, region layers and exclusions survive reload');
  assert.ok(requests.some(url=>url.includes('pakistan-detail.json')));
  assert.deepEqual(errors,[]);
  console.log('Pakistan browser: automatic detail loading, seven region options, Shift-picking, highlight, border, exclusion and reload passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
