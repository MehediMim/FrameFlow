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
const server = createServer(async (req, res) => {
  try {
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
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/index.html#motion` });
  console.log('Application opened; checking studios');
  await waitFor(`document.body.classList.contains('ff-unified')`);
  await waitFor(`!document.body.classList.contains('landing')`);

  const sections = () => evaluate(`Array.from(document.querySelectorAll('#inspector > details')).map(d=>({title:d.querySelector('summary span').textContent,open:d.open}))`);
  const sectionOf = selector => evaluate(`document.querySelector(${JSON.stringify(selector)})?.closest('details')?.querySelector('summary span').textContent`);
  for (const type of ['text','rect','circle','table','chart','list','diagram']) {
    await evaluate(`document.querySelector('[data-add="${type}"]').click()`);
    await waitFor(`!!document.querySelector('#inspector > details')`);
    const rows = await sections();
    assert.equal(rows[0].title,'TRANSFORM',`${type}: Transform is the first section`);
    assert.equal(rows[0].open,true,`${type}: Transform starts expanded`);
    const {motionSectionPriority} = await import('../inspector-panels.mjs');
    const ranks = rows.map(r=>motionSectionPriority(r.title));
    assert.deepEqual(ranks,[...ranks].sort((a,b)=>a-b),`${type}: sections follow importance`);
    assert.equal(await sectionOf('#p-x'),'TRANSFORM');
    assert.equal(await sectionOf('#easing'),'LAYER TIMING & KEYFRAMES');
    assert.equal(await sectionOf('#inFrame'),'LAYER TIMING & KEYFRAMES');
    assert.equal(await sectionOf('#fillColor'),'APPEARANCE');
    assert.equal(await sectionOf('#ffDepthAuto'),'DEPTH & PARALLAX');
    assert.equal(await sectionOf('#ffBlurNumber'),'BLUR');
    assert.equal(rows.find(r=>r.title==='BLUR').open,false);
    if(type==='text') {
      assert.equal(await sectionOf('#textContent'),'TEXT CONTENT');
      assert.equal(await sectionOf('#fontSize'),'TYPOGRAPHY');
    }
    if(type==='table') {
      assert.equal(await sectionOf('#tableFontSize'),'TABLE CELLS STYLE');
      assert.equal(await sectionOf('#tableAnimation'),'TABLE REVEAL');
      assert.equal(await evaluate(`document.querySelectorAll('#tableFontSize').length`),1);
    }
    // Moving DOM nodes into sections must preserve the original change handlers.
    await evaluate(`(()=>{const n=document.querySelector('#p-x');n.value=321;n.dispatchEvent(new Event('change'));})()`);
    await waitFor(`document.querySelector('#p-x').value==='321'`);
    const saved = await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1')).layers.at(-1).x`);
    assert.equal(saved,321,`${type}: edits persist`);
    console.log(`${type}: organized sections and working property edits`);
  }
  // Blur stays on the selected layer, including animated blur transitions.
  const beforeBlur = await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1'))`);
  await evaluate(`(()=>{const n=document.querySelector('#ffBlurNumber');n.value=6;n.dispatchEvent(new Event('change'));})()`);
  await evaluate(`document.querySelector('#ffAddBlurPulse').click()`);
  const afterBlur = await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1'))`);
  assert.equal(afterBlur.layers.length,beforeBlur.layers.length,'Blur creates no layer');
  const blurred = afterBlur.layers.at(-1);
  assert.deepEqual(blurred.fxClips,beforeBlur.layers.at(-1).fxClips,'Blur creates no effect clip');
  assert.deepEqual(blurred.keys.blur.map(k=>k.v),[6,25,6],'Blur animates and restores the layer property');
  const {valueAt} = await import('../engine.mjs');
  assert.equal(valueAt(blurred,'blur',blurred.keys.blur[1].f),25);
  assert.equal(valueAt(blurred,'blur',blurred.keys.blur[2].f+1),6);
  console.log('Blur: edits and transitions stay on the selected layer without extra clips');
  await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('frameflow-project-v1'));p.layers.at(-1).fxClips=[{id:'legacy-blur',kind:'blur',name:'blur',start:0,dur:30,amount:20,endBehavior:'return'}];localStorage.setItem('frameflow-project-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`!!document.querySelector('#p-x')?.closest('details') && !!document.querySelector('#ffBlurNumber')`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1')).layers.at(-1).fxClips.length`),0,'saved blur strips migrate on reload');
  assert.equal(await evaluate(`document.querySelectorAll('[data-fx-clip="legacy-blur"]').length`),0,'saved blur strip disappears');
  console.log('Saved blur: reload converts the old strip to layer keyframes');
  // The accordion remembers a collapsed core section through rerenders.
  await evaluate(`document.querySelector('#p-x').closest('details').open=false`);
  await sleep(50);
  await evaluate(`(()=>{const n=document.querySelector('#p-x');n.value=322;n.dispatchEvent(new Event('change'));})()`);
  await sleep(50);
  assert.equal(await evaluate(`document.querySelector('#p-x').closest('details').open`),false);

  await evaluate(`document.querySelector('#drawLine').click()`);
  const bounds=await evaluate(`(()=>{const r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
  const start={x:bounds.x+bounds.w*.3,y:bounds.y+bounds.h*.3};
  const end={x:bounds.x+bounds.w*.6,y:bounds.y+bounds.h*.5};
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...start,button:'left',clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...end,button:'left',buttons:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...end,button:'left',clickCount:1});
  await waitFor(`!!document.querySelector('#inspector [data-vector="vectorStroke"]')`);
  assert.equal(await sectionOf('[data-vector="vectorStroke"]'),'DRAWN LINE');
  assert.equal((await sections())[0].title,'TRANSFORM');
  assert.equal(await sectionOf('[data-vector="vectorDraw"]'),'DRAWING REVEAL');
  console.log('Draw: appearance and reveal are separate');
  await evaluate(`document.querySelector('[data-camera-add="focus"]').click()`);
  await waitFor(`!!document.querySelector('#inspector [data-cam="preset"]')`);
  assert.equal(await sectionOf('[data-cam="preset"]'),'CAMERA PRESET');
  assert.equal((await sections())[0].title,'3D-STYLE CAMERA / PARALLAX');
  assert.equal(await sectionOf('[data-cam="start"]'),'CAMERA SHOT');
  assert.equal(await sectionOf('[data-cam="strength"]'),'CAMERA SHAKE');
  assert.equal(await sectionOf('#ffCameraRemove'),'CAMERA ACTIONS');
  console.log('Camera: preset, timing, shake and actions are separate');
  assert.deepEqual(errors,[],'No browser runtime errors');
  console.log('Motion inspector hierarchy, grouping, edits and accordion state passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
