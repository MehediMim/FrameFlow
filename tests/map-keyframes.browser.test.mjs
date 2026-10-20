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
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');localStorage.setItem('frameflow-map-v1',JSON.stringify(E.newMapProject()));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);

  const change=async(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change'));})()`);
  const saved=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await evaluate(`document.querySelector('[data-mpre="keyframed"]').click()`);
  let p=await saved(); const shot=p.shots.at(-1), id=shot.id;
  assert.equal(await evaluate(`document.querySelectorAll('[data-key-item="${id}"]').length`),0,'new cameras have no default keys');
  await evaluate(`document.querySelector('[data-camera-center-pick]').click()`);
  await evaluate(`window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  assert.equal((await saved()).shots.at(-1).cameraKeys.length,0,'cancel picking does not add a key');
  await evaluate(`document.querySelector('[data-camera-center-pick]').click()`);
  const picked = await evaluate(`(async()=>{const E=await import('./map-engine.mjs?v=invert-1'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),c=document.querySelector('#mCanvas'),r=c.getBoundingClientRect(),sx=p.width*.6,sy=p.height*.55,ll=E.screenToLonLat(E.makeView(E.cameraAt(p,{},p.width,p.height,0),p.width,p.height),sx,sy);return {x:r.left+r.width*.6,y:r.top+r.height*.55,...ll};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',buttons:1,clickCount:1,x:picked.x,y:picked.y});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:picked.x,y:picked.y});
  p=await saved();
  const centerKey=p.shots.at(-1).cameraKeys[0];
  assert.ok(Math.abs(centerKey.values.lon-picked.lon)<.001);
  assert.ok(Math.abs(centerKey.values.lat-picked.lat)<.001);
  assert.deepEqual(Object.keys(centerKey.values).sort(),['lat','lon'],'picking keys only position');
  assert.equal(await evaluate(`document.querySelector('#mCanvas').style.cursor`),'');
  await change('[data-camera-field="zoom"]','3');
  await change('#mFrame','1');
  await change('[data-camera-field="zoom"]','6');
  await change('[data-camera-field="pitch"]','50');
  await change('[data-camera-field="bearing"]','90');
  p=await saved();
  assert.equal(p.shots.at(-1).cameraKeys.find(k=>k.frame===30).values.zoom,6);
  assert.equal(p.shots.at(-1).cameraKeys.find(k=>k.frame===30).values.pitch,50);
  assert.equal(p.shots.at(-1).cameraKeys.find(k=>k.frame===30).values.bearing,90);
  assert.equal(p.shots.at(-1).cameraKeys.find(k=>k.frame===30).values.lon,undefined,'zoom and tilt keys do not key position');
  await change('#mFrame','.5');
  await change('[data-camera-field="zoom"]','5');
  await change('[data-mf="__cameraTrack"]','zoom');
  assert.equal(await evaluate(`document.querySelectorAll('[data-key-item="${id}"]').length`),3);
  const dragKey = async (key, delta) => {
    const point = await evaluate(`(()=>{const b=document.querySelector('[data-key-item="${id}"][data-map-key="${key}"]');b.scrollIntoView({block:'nearest',inline:'nearest'});const r=b.getBoundingClientRect(),w=document.querySelector('#mTracks').getBoundingClientRect().width,p=JSON.parse(localStorage.getItem('frameflow-map-v1')),x=r.left+r.width/2,y=r.top+r.height/2;return {x,y,dx:${delta}*w/(p.frames-1),hit:document.elementFromPoint(x,y)?.closest('[data-map-key]')?.dataset.mapKey};})()`);
    assert.equal(point.hit, key, 'mouse can reach the visible diamond');
    await cdp('Input.dispatchMouseEvent', {type:'mouseMoved',x:point.x,y:point.y});
    await cdp('Input.dispatchMouseEvent', {type:'mousePressed',button:'left',buttons:1,clickCount:1,x:point.x,y:point.y});
    for(let i=1;i<=5;i++) await cdp('Input.dispatchMouseEvent', {type:'mouseMoved',buttons:1,x:point.x+point.dx*i/5,y:point.y});
    await cdp('Input.dispatchMouseEvent', {type:'mouseReleased',button:'left',buttons:0,clickCount:1,x:point.x+point.dx,y:point.y});
  };
  await dragKey('camera:15',5);
  p=await saved();
  assert.equal(p.shots.at(-1).start,shot.start); assert.equal(p.shots.at(-1).dur,shot.dur);
  assert.equal(p.shots.at(-1).cameraKeys.find(k=>k.frame===20).values.zoom,5);
  assert.equal(p.shots.at(-1).cameraKeys.some(k=>k.frame===15),false);
  await evaluate(`document.querySelector('[data-camera-nav="1"]').click()`);
  assert.equal(await evaluate(`document.querySelector('#mFrame').value`),'1');
  assert.equal(await evaluate(`document.querySelector('[data-camera-field="zoom"]').value`),'6');
  await evaluate(`document.querySelector('[data-camera-toggle="zoom"]').click()`);
  p=await saved();assert.equal(p.shots.at(-1).cameraKeys.find(k=>k.frame===30).values.zoom,undefined,'remove only selected property key');
  await evaluate(`document.querySelector('[data-camera-toggle="zoom"]').click()`);
  await change('[data-camera-field="zoom"]','6');
  await evaluate(`document.querySelector('[data-camera-view]').click()`);
  p=await saved();assert.equal(Object.keys(p.shots.at(-1).cameraKeys.find(k=>k.frame===30).values).length,5);
  await evaluate(`document.querySelector('#mAddGrid [data-madd="object"]').click()`);
  await change('[data-mf="__pinMove"]','move');
  p=await saved(); const object=p.actions.at(-1);
  assert.equal(await evaluate(`document.querySelectorAll('[data-key-item="${object.id}"]').length`),2);
  await evaluate(`document.querySelector('[data-key-item="${object.id}"][data-map-key="animationEnd"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`);
  p=await saved();assert.equal(p.actions.at(-1).animDur,object.animDur-1); assert.equal(p.actions.at(-1).dur,object.dur); assert.equal(p.actions.at(-1).start,object.start);
  await evaluate(`location.reload()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  p=await saved(); const E=await import('../map-engine.mjs');E.validateMapProject(p);
  assert.equal(p.shots.at(-1).cameraKeys.find(k=>k.frame===20).values.zoom,5,'camera keys persist after reload');
  await evaluate(`document.querySelector('[data-mid="${object.id}"]').click()`);
  await evaluate(`document.querySelector('[data-mpre="followPlane"]').click()`);
  p=await saved(); assert.equal(p.shots.at(-1).planeId,object.id,'Follow traveler selects the current moving object');
  await evaluate(`document.querySelector('[data-mid="${object.id}"]').click()`);
  await change('#mFrame','2');
  const splitButton = await evaluate(`(()=>{const r=document.querySelector('#mSplit').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...splitButton,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...splitButton,button:'left',buttons:0,clickCount:1});
  p=await saved();
  assert.equal(p.actions.length,2,'Split creates a second clip');
  assert.equal(p.actions[0].start+p.actions[0].dur,60);
  assert.equal(p.actions[1].start,60);
  assert.equal(p.actions[1].sourceStart,object.start,'split preserves original animation clock');
  await evaluate(`document.querySelector('#mUndo').click()`);
  assert.equal((await saved()).actions.length,1,'split can be undone');
  await evaluate(`document.querySelector('[data-mid="${object.id}"]').click()`);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'s',code:'KeyS',windowsVirtualKeyCode:83});
  await cdp('Input.dispatchKeyEvent',{type:'keyUp',key:'s',code:'KeyS',windowsVirtualKeyCode:83});
  assert.equal((await saved()).actions.length,2,'S splits the selected map item');
  await evaluate(`document.querySelector('#mUndo').click()`);
  await evaluate(`document.querySelector('#mRedo').click()`);
  await evaluate(`location.reload()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  p=await saved(); E.validateMapProject(p); assert.equal(p.actions.length,2,'split survives reload');
  assert.deepEqual(errors,[]);
  console.log('Camera properties, draggable timing keys, movement keys and project reload passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
