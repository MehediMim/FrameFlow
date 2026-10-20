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
  const change = (selector,value) => evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('[data-mode="map"]').click()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length > 100`);
  await evaluate(`document.querySelector('#mAtlasLabels [data-atlas="countries"]').click()`);
  await evaluate(`document.querySelector('#mAtlasLabels [data-atlas="oceans"]').click()`);
  await change('#mAtlasLabels [data-atlas="size"]', '42');
  let p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  assert.equal(p.atlasLabels.countries,true);assert.equal(p.atlasLabels.oceans,true);assert.equal(p.atlasLabels.size,42);
  await change('#mAtlasLabels [data-atlas="scaleMode"]','world');
  await change('#mAtlasLabels [data-atlas="referenceZoom"]','4');
  await change('#mAtlasLabels [data-atlas="scaleMode"]','fixed');
  await evaluate(`document.querySelector('[data-madd="label"]').click()`);
  await change('#mInspector [data-mf="text"]','Il Khanate');
  p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  const label=p.actions.at(-1);
  assert.equal(label.type,'label');assert.equal(label.labelPlacement,'map');assert.equal(label.text,'Il Khanate');
  assert.equal(label.labelStyle.placement,'map');assert.equal(label.labelStyle.scaleMode,'fixed');
  await change('#mInspector [data-mf="labelPlacement"]','screen');
  assert.equal(await evaluate(`!!document.querySelector('#mInspector [data-mf="x"]')`),true,'canvas anchor exposes canvas coordinates');
  await change('#mInspector [data-mf="labelPlacement"]','map');
  assert.equal(await evaluate(`!!document.querySelector('#mInspector [data-mf="offsetX"]')`),true);
  const E=await import('../map-engine.mjs');
  E.validateMapProject(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`));
  await evaluate(`location.reload()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length > 100`);
  assert.equal(await evaluate(`document.querySelector('#mAtlasLabels [data-atlas="countries"]').checked`),true);
  assert.equal(await evaluate(`document.querySelector('#mAtlasLabels [data-atlas="oceans"]').checked`),true);
  p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  E.validateMapProject(p);
  assert.equal(p.atlasLabels.scaleMode,'fixed');assert.equal(p.actions.at(-1).text,'Il Khanate');
  await evaluate(`document.querySelector('#mSettingsButton').click();document.querySelector('#mAtlasLabels details').open=true`);
  await change('#mTheme','relief');
  await evaluate(`document.querySelector('#mTerrainBox').open=true`);
  await waitFor(`document.querySelectorAll('#mTerrainBox .ff-palette').length === 6`);
  for (const [width,height] of [[1600,1000],[1024,768],[720,900]]) {
    await cdp('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
    const layout=await evaluate(`(()=>{
      const panel=document.querySelector('#mSettingsPanel'),body=panel.querySelector('.ff-settings-body'),footer=panel.querySelector('.ff-settings-footer');
      const rect=panel.getBoundingClientRect(),foot=footer.getBoundingClientRect();
      const palettes=[...panel.querySelectorAll('label > .ff-palette')].filter(p=>p.getBoundingClientRect().width);
      return {inside:body.contains(document.querySelector('#mTerrainBox'))&&body.contains(document.querySelector('#mAtlasLabels')),
        noHorizontalOverflow:body.scrollWidth <= body.clientWidth+1,
        footerVisible:foot.bottom <= rect.bottom+1&&foot.top >= rect.top,
        fitsViewport:rect.top>=0&&rect.bottom<=innerHeight+1&&rect.left>=0&&rect.right<=innerWidth+1,
        palettesFit:palettes.every(p=>{const a=p.getBoundingClientRect(),b=p.parentElement.getBoundingClientRect(),input=p.parentElement.querySelector('input[type=color]').getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.top>=input.bottom-1;}),
        degree:document.querySelector('#mTerrainAzimuthValue').textContent,
        scrollable:body.scrollHeight>body.clientHeight};
    })()`);
    assert.ok(Object.values(layout).every(Boolean),`settings layout at ${width}x${height}: ${JSON.stringify(layout)}`);
    assert.ok(layout.degree.endsWith('\u00b0'),'sun direction uses a degree symbol');
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1024,height:900,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('#mTerrainLow').scrollIntoView({block:'center'})`);
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile(join(tmpdir(),'frameflow-atlas-labels-review.png'),Buffer.from(screenshot.data,'base64'));
  const geometry=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs');
    const topo=await fetch('map-data/countries-50m.json').then(r=>r.json());
    const geo=E.buildGeo(topo),p=E.newMapProject();p.theme='earth';p.graticule=false;
    p.atlasLabels={countries:true,oceans:true,declutter:true};
    p.camera.init={lon:12,lat:47,zoom:3.7,pitch:0,bearing:0};
    const c=document.createElement('canvas');c.width=1280;c.height=720;
    const view=E.drawMap(c.getContext('2d'),c.width,c.height,p,0,geo);
    const labels=E.atlasMapLabels({...p,atlasLabels:{...p.atlasLabels,declutter:false}},geo,view);
    document.body.replaceChildren(c);c.style.cssText='width:100vw;height:auto';
    return {count:labels.length,angles:new Set(labels.map(l=>l.angle)).size,sizes:new Set(labels.map(l=>Math.round(l.over.size))).size};
  })()`);
  assert.ok(geometry.count>15&&geometry.angles>3&&geometry.sizes>8,`country geometry determines sizes/angles: ${JSON.stringify(geometry)}`);
  const mapScreenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile(join(tmpdir(),'frameflow-country-label-fit-review.png'),Buffer.from(mapScreenshot.data,'base64'));
  assert.deepEqual(errors,[],'no runtime errors adding or configuring atlas labels');
  console.log('Atlas controls and responsive settings layout passed: terrain stays inside scroll body, palettes fit, footer stays visible');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
