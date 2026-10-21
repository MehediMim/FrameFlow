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
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=E.newMapProject();p.frames=300;p.camera.init={lon:2,lat:46,zoom:4,bearing:0,pitch:0};p.actions=[E.makeAction('object',0,{id:'one',glyph:'tank',dur:240,place:{kind:'point',name:'One',lon:0,lat:46}}),E.makeAction('object',0,{id:'two',glyph:'tank',dur:240,place:{kind:'point',name:'Two',lon:5,lat:46}})];localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===2&&document.querySelectorAll('#mDlCountry option').length>100`);
  const point=(lon,lat,dx=0,dy=0)=>evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),...i},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),b=document.querySelector('#mCanvas').getBoundingClientRect();return{x:b.left+(q.x+${dx}*v.unit)/p.width*b.width,y:b.top+(q.y+${dy}*v.unit)/p.height*b.height};})()`);
  const mouse=(type,p,shift=false)=>cdp('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,modifiers:shift?8:0});
  const click=async(lon,lat,shift=false)=>{const p=await point(lon,lat);await mouse('mousePressed',p,shift);await mouse('mouseReleased',p,shift);};
  const drag=async(from,to)=>{await mouse('mousePressed',from);await mouse('mouseMoved',to);await mouse('mouseReleased',to);};
  await click(0,46);
  assert.ok(await evaluate(`!!document.querySelector('[data-mf="__pinMove"]')`),'clicking a map object opens its common options');
  await writeFile(join(tmpdir(),'frameflow-direct-object-controls.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await drag(await point(0,46),await point(1,47));
  let a=(await stored()).actions[0];assert.ok(Math.abs(a.place.lon-1)<.01&&Math.abs(a.place.lat-47)<.01,'dragging edits the starting anchor');
  await drag(await point(1,47,72,0),await point(1,47,0,72));
  assert.ok(Math.abs((await stored()).actions[0].objectAngle-90)<1,'direction handle rotates the object');
  await evaluate(`document.querySelector('#mUndo').click()`);assert.ok(Math.abs((await stored()).actions[0].objectAngle||0)<1);await evaluate(`document.querySelector('#mRedo').click()`);
  await change('[data-mf="__pinMove"]','move');
  assert.deepEqual((await stored()).actions[0].place,a.place,'switching to move keeps the start');
  await change('[data-mf="to"]','45, 4');const destination=(await stored()).actions[0].to;
  await drag(await point(1,47),await point(2,47));
  assert.deepEqual((await stored()).actions[0].to,destination,'dragging the starting point preserves the destination');
  await change('[data-mf="__pinMove"]','stay');
  await click(5,46,true);assert.equal(await evaluate(`document.querySelector('[data-direct-group]').disabled`),false,'Shift-click selects multiple objects');
  await evaluate(`document.querySelector('[data-direct-group]').click()`);
  let p=await stored(),g=p.actions.find(a=>a.type==='group');assert.equal(g.memberIds.length,2);
  await change('[data-mf="__groupColor"]','#408050');p=await stored();assert.ok(p.actions.filter(a=>a.type==='object').every(a=>a.color==='#408050'));
  await change('[data-mf="__groupSizeMode"]','map');assert.ok((await stored()).actions.filter(a=>a.type==='object').every(a=>a.sizeMode==='map'));
  await change('[data-mf="__groupSizeMode"]','screen');
  await drag(await point(2,47),await point(3,47));
  p=await stored();g=p.actions.find(a=>a.type==='group');assert.ok(Math.abs(g.transform.lon-g.origin.lon-1)<.02,'dragging a member moves its group');
  await drag(await point(g.transform.lon,g.transform.lat,72,0),await point(g.transform.lon,g.transform.lat,0,-72));
  g=(await stored()).actions.find(a=>a.type==='group');assert.ok(Math.abs(g.transform.rotation+90)<1,'group direction handle rotates its members');
  await change('[data-mf="__groupMove"]','move');await change('[data-mf="__groupDestination"]','44, 7');g=(await stored()).actions.find(a=>a.type==='group');assert.ok(g.groupKeys.some(k=>Math.abs(k.values.lon-7)<.0001&&Math.abs(k.values.lat-44)<.0001),'group uses a destination without reentering its start');
  await click(-3,48);assert.ok(await evaluate(`!!document.querySelector('[data-direct-highlight]')`),'clicking land offers Highlight and Border');
  await click(-4,40,true);assert.ok(await evaluate(`document.querySelector('#mMapContext').textContent.includes('2 regions')`),'Shift-click selects multiple countries');
  await evaluate(`document.querySelector('[data-direct-highlight]').click()`);
  const highlight=(await stored()).actions.at(-1);assert.equal(highlight.type,'highlight');assert.equal(highlight.target.members.length,2);
  const saved=await stored();await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===4`);assert.deepEqual(await stored(),saved);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');E.validateMapProject(JSON.parse(localStorage.getItem('frameflow-map-v1')));})()`);
  assert.deepEqual(errors,[]);
  console.log('Direct map editing: object selection, anchor drag, rotation handles, movement destination, Shift selection, groups, sizing, country actions, undo and persistence passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
