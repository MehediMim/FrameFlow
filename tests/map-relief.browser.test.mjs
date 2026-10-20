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

  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/index.html#map` });
  await waitFor(`document.querySelectorAll('#mTheme option').length > 5`);
  await evaluate(`document.querySelector('[data-mode="map"]').click()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length > 100`);
  await evaluate(`(() => { const el=document.querySelector('#mTheme'); el.value='relief'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  assert.equal(await evaluate(`document.querySelector('#mTerrainBox').hidden`), false);
  assert.equal(await evaluate(`document.querySelector('#mImageryBox').hidden`), true);
  await evaluate(`(() => { const el=document.querySelector('#mTerrainAzimuth'); el.value='270'; el.dispatchEvent(new Event('change',{bubbles:true})); })()`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).terrain.azimuth`), 270);
  await evaluate(`location.reload()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length > 100`);
  assert.equal(await evaluate(`document.querySelector('#mTerrainAzimuth').value`), '270');
  // Render real Spain/Portugal relief independently of editor camera state.
  const result = await evaluate(`(async () => {
    const E=await import('./map-engine.mjs'), R=await import('./map-relief.mjs');
    const [hi,lo]=await Promise.all(['50','110'].map(n=>fetch('map-data/countries-'+n+'m.json').then(r=>r.json())));
    const geo=E.buildGeo(hi,lo); geo.relief=R.createRelief();
    const p=E.newMapProject(); p.theme='relief'; p.graticule=false;
    p.camera.init={lon:-5,lat:39.5,zoom:5.2,bearing:0,pitch:0};
    const c=document.createElement('canvas'); c.width=1280;c.height=720;
    const ctx=c.getContext('2d');
    const tiles=E.imageryNeeds(p,geo,c.width,c.height,0);
    await geo.relief.ready(tiles);
    E.drawMap(ctx,c.width,c.height,p,100,geo);
    const before=ctx.getImageData(0,0,c.width,c.height).data;
    p.actions=['Spain','Portugal'].map(name=>E.makeAction('highlight',0,{target:{kind:'country',name},dur:240,animDur:30,showLabel:false,dim:0,pulse:false}));
    E.drawMap(ctx,c.width,c.height,p,100,geo);
    const after=ctx.getImageData(0,0,c.width,c.height).data;
    let changed=0,colors=new Set();
    for(let i=0;i<after.length;i+=4){if(before[i]!==after[i]||before[i+1]!==after[i+1])changed++;colors.add(after[i]+','+after[i+1]+','+after[i+2]);}
    window.reliefPreview=c;document.body.replaceChildren(c);c.style.cssText='width:100vw;height:auto';
    return {failed:geo.relief.failedCount(),tiles:tiles.length,changed,colors:colors.size};
  })()`);
  console.log('Live DEM rendering:', JSON.stringify(result));
  assert.equal(result.failed, 0, 'real DEM tiles load with CORS and decode without tainting export');
  assert.ok(result.changed > 10000, 'country highlights change visible terrain');
  assert.ok(result.colors > 3000, 'terrain retains detailed elevation shading');
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile(join(tmpdir(),'frameflow-relief-review.png'),Buffer.from(screenshot.data,'base64'));
  assert.deepEqual(errors, [], 'no browser runtime errors');
  console.log('Cartographic Relief settings persist; real DEMs and highlights render; screenshot in temp/frameflow-relief-review.png');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
