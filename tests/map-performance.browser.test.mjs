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

  await evaluate(`(async()=>{const E=await import('./map-engine.mjs?v=invert-1'),p=E.demoMapProject();for(let i=0;i<24;i++)p.actions.push(E.makeAction('pin',0,{dur:p.frames,place:{kind:'point',name:'Pin '+i,lon:-60+i*5,lat:15}}));p.shots=[];localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`document.querySelector('[data-mpre="keyframed"]').click()`);
  await evaluate(`new Promise(r=>setTimeout(r,700))`);
  await cdp('Performance.enable');
  const read=async()=>Object.fromEntries((await cdp('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const before=await read();
  await evaluate(`new Promise(r=>setTimeout(r,1500))`);
  const idle=await read();
  console.log('Idle',JSON.stringify({taskMs:(idle.TaskDuration-before.TaskDuration)*1000,heapMB:idle.JSHeapUsedSize/1048576,nodes:idle.Nodes}));
  await evaluate(`window.__mapMutations={timeline:0,inspector:0};window.__mapObserver=new MutationObserver(ms=>{for(const m of ms){if(m.target===document.querySelector('#mTrackLabels'))window.__mapMutations.timeline++;if(m.target===document.querySelector('#mInspector'))window.__mapMutations.inspector++;}});window.__mapObserver.observe(document.querySelector('#mTrackLabels'),{childList:true});window.__mapObserver.observe(document.querySelector('#mInspector'),{childList:true});`);
  await cdp('Profiler.enable'); await cdp('Profiler.start');
  const elapsed=await evaluate(`(async()=>{const start=performance.now();for(let i=0;i<45;i++){const el=document.querySelector('#mFrame');el.value=i/30;el.dispatchEvent(new Event('change'));await new Promise(requestAnimationFrame);}return performance.now()-start})()`);
  const profile=(await cdp('Profiler.stop')).profile;
  const stats=new Map();for(const n of profile.nodes){const key=n.callFrame.functionName||n.callFrame.url;stats.set(key,(stats.get(key)||0)+(n.hitCount||0));}
  const mutations=await evaluate(`window.__mapMutations`);
  assert.equal(mutations.timeline,0,'scrubbing preserves timeline rows');
  assert.equal(mutations.inspector,0,'scrubbing preserves inspector controls');
  console.log('Scrub',JSON.stringify({elapsedMs:elapsed,...await evaluate(`window.__mapMutations`),top:[...stats].sort((a,b)=>b[1]-a[1]).slice(0,12)}));
  await evaluate(`window.__mapObserver.disconnect()`);
  assert.deepEqual(errors,[]);
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
