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
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(el.type==='checkbox')el.checked=${JSON.stringify(value)};else el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=E.newMapProject();p.frames=300;p.camera.init={lon:-10,lat:44,zoom:4,bearing:0,pitch:0};p.actions=[E.makeAction('pin',0,{id:'pin',dur:240,place:{kind:'point',name:'Pin',lon:-10,lat:44}})];localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelector('[data-mid="pin"]')&&document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`document.querySelector('[data-mid="pin"]').click()`);
  const point=(lon,lat,dx=0,dy=0)=>evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),...i},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),b=document.querySelector('#mCanvas').getBoundingClientRect();return{x:b.left+(q.x+${dx}*v.unit)/p.width*b.width,y:b.top+(q.y+${dy}*v.unit)/p.height*b.height};})()`);
  const mouse=(type,p,shift=false)=>cdp('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,modifiers:shift?8:0});
  const click=async(lon,lat,shift=false)=>{const p=await point(lon,lat);await mouse('mousePressed',p,shift);await mouse('mouseReleased',p,shift);};
  const drag=async(from,to)=>{await mouse('mousePressed',from);await mouse('mouseMoved',to);await mouse('mouseReleased',to);};
  const rightClick=async p=>{await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'right',buttons:2,clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'right',buttons:0,clickCount:1});};
  await change('#mInspector [data-mf="pinStyle"]','diamond');
  assert.equal((await stored()).actions.at(-1).pinStyle,'diamond','inspector changes pin style');
  await rightClick(await point(-10,44));
  await evaluate(`document.querySelector('[data-direct-pin-style]').click();document.querySelector('[data-direct-pin-style-star]').click()`);
  assert.equal((await stored()).actions.at(-1).pinStyle,'star','canvas menu changes pin style');
  await rightClick(await point(-10,44));
  await evaluate(`document.querySelector('[data-direct-sizing]').click();document.querySelector('[data-direct-sizing-map]').click()`);
  assert.equal((await stored()).actions.at(-1).sizeMode,'map','canvas menu enables map scaling');
  assert.equal((await stored()).actions.at(-1).sizeZoom,(await stored()).camera.init.zoom,'map scaling anchors at current zoom');
  await rightClick(await point(-10,44));
  assert.equal(await evaluate(`document.querySelector('[data-direct-sizing-map]').getAttribute('aria-checked')`),'true');
  await evaluate(`document.querySelector('[data-direct-sizing]').click();document.querySelector('[data-direct-sizing-screen]').click()`);
  assert.equal((await stored()).actions.at(-1).sizeMode,'screen','canvas menu restores fixed size');
  await evaluate(`document.querySelector('#mUndo').click()`);
  assert.equal((await stored()).actions.at(-1).sizeMode,'map','pin sizing supports undo');
  const final=await stored();await evaluate('location.reload()');
  await waitFor(`document.querySelector('[data-mid="pin"]')&&document.querySelectorAll('#mDlCountry option').length>100`);
  assert.deepEqual(await stored(),final,'pin style and sizing persist');
  assert.deepEqual(errors,[]);
  console.log('Pin inspector, canvas style/sizing menus, checked state, undo and persistence passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
