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
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=E.newMapProject();localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100&&document.querySelectorAll('#mTrackRows [data-mrow]').length===1`);
  await evaluate(`document.querySelector('#mCaptureView').click()`);
  const manual0=(await stored()).shots[0].cameraKeys[0];assert.ok(!manual0.pairId);
  await change('#mFrame',1);
  await evaluate(`document.querySelector('[data-mpre="pushIn"]').click()`);
  let project=await stored(),track=project.shots[0],pair=track.cameraKeys.filter(k=>k.pairId);
  assert.equal(project.shots.length,1);assert.equal(await evaluate(`document.querySelectorAll('#mTrackRows [data-mrow]').length`),1);
  assert.equal(pair.length,2);assert.deepEqual(pair.map(k=>k.frame),[30,90]);assert.equal(pair[0].pairId,pair[1].pairId);
  await change('#mFrame',1.5);await evaluate(`document.querySelector('#mCaptureView').click()`);
  const manual45=(await stored()).shots[0].cameraKeys.find(k=>k.frame===45);assert.ok(!manual45.pairId,'capture creates an independent manual key');
  const clickKey=async(id,button='left')=>{
    const p=await evaluate(`(()=>{const b=[...document.querySelectorAll('[data-camera-key-id]')].find(b=>b.dataset.cameraKeyId===${JSON.stringify(id)});b.scrollIntoView({block:'nearest'});const r=b.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
    for(const type of ['mousePressed','mouseReleased'])await cdp('Input.dispatchMouseEvent',{type,...p,button,buttons:type==='mouseReleased'?0:button==='right'?2:1,clickCount:1});
  };
  const press=async(key,code=key)=>{await cdp('Input.dispatchKeyEvent',{type:'keyDown',key,code});await cdp('Input.dispatchKeyEvent',{type:'keyUp',key,code});};
  await clickKey(pair[1].id);await press('Delete');
  assert.deepEqual((await stored()).shots[0].cameraKeys.map(k=>k.id).sort(),[manual0.id,manual45.id].sort(),'Delete on an endpoint removes both paired keys and preserves manual keys');
  await evaluate(`document.querySelector('#mUndo').click()`);assert.equal((await stored()).shots[0].cameraKeys.length,4);
  await clickKey(pair[0].id,'right');await waitFor(`!!document.querySelector('#mCameraKeyMenu')`);
  assert.equal(await evaluate(`document.querySelector('#mCameraKeyMenu button').textContent`),'Delete movement pair');
  await evaluate(`document.querySelector('#mCameraKeyMenu button').click()`);
  assert.equal((await stored()).shots[0].cameraKeys.length,2);await evaluate(`document.querySelector('#mUndo').click()`);
  await clickKey(manual45.id);await press('Backspace');
  assert.equal((await stored()).shots[0].cameraKeys.filter(k=>k.pairId).length,2,'normal deletion leaves the movement pair intact');
  assert.ok((await stored()).shots[0].cameraKeys.some(k=>k.id===manual0.id),'normal deletion leaves other normal keys intact');
  await evaluate(`document.querySelector('#mUndo').click()`);
  await change('#mFrame',0);await evaluate(`document.querySelector('[data-camera-delete]').click()`);
  assert.ok(!(await stored()).shots[0].cameraKeys.some(k=>k.id===manual0.id),'frame zero is also deletable');
  await evaluate(`document.querySelector('#mUndo').click()`);
  await change('#mFrame',3);await evaluate(`document.querySelector('[data-mpre="orbit"]').click()`);
  project=await stored();assert.equal(project.shots.length,1);assert.equal(project.shots[0].cameraKeys.filter(k=>k.pairId).length,4);
  assert.equal(project.shots[0].cameraKeys.filter(k=>k.frame===90&&k.pairId).length,2,'adjacent movements can share a timeline frame');
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('[data-camera-key-id]').length===6`);
  assert.deepEqual(await stored(),project,'paired and manual keys retain IDs and motion curves after reload');
  await clickKey(pair[1].id,'right');await evaluate(`document.querySelector('#mCameraKeyMenu button').click()`);
  assert.equal((await stored()).shots[0].cameraKeys.filter(k=>k.pairId).length,2,'deleting one shared endpoint preserves the other movement');
  assert.ok((await stored()).shots[0].cameraKeys.filter(k=>k.pairId).every(k=>k.preset==='orbit'),'the clicked shared endpoint removes its own movement, not its neighbor');
  // A project saved with separate preset layers opens as one camera track.
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=E.newMapProject();p.shots=[E.makeShot('pushIn',10),E.makeShot('orbit',100)];localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('[data-camera-key-id]').length===4&&document.querySelectorAll('#mTrackRows [data-mrow]').length===1`);
  project=await stored();assert.equal(project.shots.length,1);assert.equal(new Set(project.shots[0].cameraKeys.map(k=>k.pairId)).size,2);
  // Every key can be removed; the permanent track itself remains.
  for(const id of [project.shots[0].cameraKeys[0].id,project.shots[0].cameraKeys.at(-1).id]){await clickKey(id);await press('Delete');}
  assert.deepEqual((await stored()).shots[0].cameraKeys,[]);assert.equal((await stored()).shots[0].dur,(await stored()).frames);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');E.validateMapProject(JSON.parse(localStorage.getItem('frameflow-map-v1')));})()`);
  assert.deepEqual(errors,[]);
  console.log('Camera pairs browser: one timeline row, paired presets, independent captures, keyboard/context/inspector deletion, shared frames, undo, reload and legacy migration passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
