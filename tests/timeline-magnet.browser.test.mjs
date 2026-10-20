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
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');localStorage.setItem('frameflow-map-v1',JSON.stringify(E.demoMapProject()));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);


  const click = async selector => {
    const q=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...q,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...q,button:'left',buttons:0,clickCount:1});
  };

  await click('[data-mode="motion"]');
  await waitFor(`document.querySelector('.timeline.motion-only [aria-pressed="true"]')?.textContent==='Magnet'`);
  await evaluate(`document.querySelector('#projectName').dispatchEvent(new Event('change',{bubbles:true}))`);
  const fixture = await evaluate(`(()=>{const p=JSON.parse(localStorage.getItem('frameflow-project-v1')); if(!p?.layers?.length) throw Error('No motion demo');p.frames=300;p.fps=30;p.cameraShots=[];const base=p.layers[0];p.layers=[{...structuredClone(base),id:'one',name:'First',in:0,out:59,keys:{}},{...structuredClone(base),id:'two',name:'Second',in:90,out:149,keys:{}},{...structuredClone(base),id:'three',name:'Overlap',in:30,out:119,keys:{}}];localStorage.setItem('frameflow-project-v1',JSON.stringify(p));location.reload();return true;})()`);
  await waitFor(`document.querySelector('[data-clip="two"]')`);
  const layout=await evaluate(`(()=>{const rows=['one','two','three'].map(id=>document.querySelector('[data-row="'+id+'"]'));return {tops:rows.map(r=>r.style.top),headings:[...document.querySelectorAll('#trackRows .ff-track-heading')].map(e=>e.textContent)}})()`);
  assert.deepEqual(layout.headings,['Camera','Subject','Audio']);
  assert.equal(layout.tops[0],layout.tops[1],'sequential clips share a lane');
  assert.notEqual(layout.tops[0],layout.tops[2],'overlapping clips use a separate lane');
  const pos=await evaluate(`(()=>{const clip=document.querySelector('[data-clip="two"]'),r=clip.getBoundingClientRect(),t=document.querySelector('#tracks').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2,width:t.width}})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',x:pos.x,y:pos.y,button:'left',buttons:1,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:pos.x-29/299*pos.width,y:pos.y,buttons:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:pos.x-29/299*pos.width,y:pos.y,button:'left',buttons:0,clickCount:1});
  const moved=await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1')).layers.find(l=>l.id==='two')`);
  assert.equal(moved.in,60,'clip snaps to 2 seconds while dragged');
  assert.equal(moved.out-moved.in,59,'moving keeps clip duration');
  await evaluate(`(()=>{const t=document.querySelector('#tracks').getBoundingClientRect();document.querySelector('#trackRows').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,button:0,clientX:t.left+t.width*120/299,clientY:t.top+40}));window.dispatchEvent(new PointerEvent('pointerup'));})()`);
  assert.equal(await evaluate(`Number(document.querySelector('#frame').value)`),4,'empty lanes remain scrubbable');
  await click('.timeline.motion-only .timeline-tools button[aria-pressed]');
  assert.equal(await evaluate(`document.querySelector('.timeline.motion-only').dataset.magnetic`),'false');
  for(const mode of ['map','paper']) {
    await click('[data-mode="'+mode+'"]');
    const prefix=mode==='map'?'m':'p';
    await waitFor(`document.querySelectorAll('#${prefix}TrackRows .ff-track-heading').length===3`);
    assert.ok(await evaluate(`[...document.querySelectorAll('#${prefix}Ruler .tick')].every(t=>t.textContent.endsWith('s'))`),'ruler uses seconds');
  }
  assert.deepEqual(errors,[],'no runtime exceptions');
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile(join(tmpdir(),'frameflow-magnetic-timeline.png'),Buffer.from(screenshot.data,'base64'));
  console.log('Shared Camera / Subject / Audio lanes, magnetic drag, toggle and seconds rulers passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
