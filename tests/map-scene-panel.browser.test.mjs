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
  await waitFor(`document.querySelectorAll('#mTheme option').length>5`);
  await evaluate(`document.querySelector('[data-mode="map"]').click()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');const p=E.newMapProject();p.theme='paper';p.camera.init={lon:5,lat:44,zoom:3,pitch:0,bearing:0};localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('[data-madd="scene"]').click()`);
  await change('#mInspector [data-mf="startYear"]','1492');await change('#mInspector [data-mf="endYear"]','1522');
  await change('#mInspector [data-mf="eventTitle"]','Across the Atlantic');
  await change('#mInspector [data-mf="description"]','New routes connect distant shores.\nThe story continues in {year}.');
  await change('#mInspector [data-mf="panelSide"]','right');
  await evaluate(`document.querySelector('#mInspector [data-mf="autoYear"]').click()`);
  assert.equal(await evaluate(`!!document.querySelector('#mInspector [data-mf="endYear"]')`),false);
  await evaluate(`document.querySelector('#mInspector [data-mf="autoYear"]').click()`);
  await change('#mFrame','4');
  const stored=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  assert.equal(stored.actions[0].panelSide,'right');assert.equal(stored.actions[0].eventTitle,'Across the Atlantic');assert.ok(stored.actions[0].description.includes('\n'));assert.equal(stored.actions[0].endYear,1522);
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions`),stored.actions);
  const result=await evaluate(String.raw`(async()=>{
    const E=await import('./map-engine.mjs'),P=await import('./map-scene-panel.mjs');
    const geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json())),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),a=p.actions[0];E.validateMapProject(p);
    const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');
    const text=[],fill=x.fillText.bind(x);x.fillText=(s,px,py,...rest)=>{text.push({s,x:px,y:py,font:x.font});fill(s,px,py,...rest);};
    const read=()=>new Uint8ClampedArray(x.getImageData(0,0,1280,720).data);
    p.actions=[];E.drawMap(x,1280,720,p,120,geo);const base=read();p.actions=[a];a.fadeSeconds=0;
    const renders={};
    for(const side of ['left','right']){a.panelSide=side;text.length=0;E.drawMap(x,1280,720,p,120,geo);const pixels=read(),sample=(data,px)=>Array.from(data.slice((360*1280+px)*4,(360*1280+px)*4+4));renders[side]={year:text.find(t=>t.s==='1507'),title:text.find(t=>t.s.includes('Across')),dynamic:text.some(t=>t.s.includes('1507.')),edgeChanged:JSON.stringify(sample(base,side==='left'?10:1270))!==JSON.stringify(sample(pixels,side==='left'?10:1270)),oppositeSame:JSON.stringify(sample(base,side==='left'?1270:10))===JSON.stringify(sample(pixels,side==='left'?1270:10))};}
    text.length=0;E.drawMap(x,1280,720,p,0,geo);const first=text.some(t=>t.s==='1492');text.length=0;E.drawMap(x,1280,720,p,239,geo);const last=text.some(t=>t.s==='1522');
    a.panelSide='left';a.panelWidth=25;a.textScale=2;a.description='A detailed account of this event and its impact. '.repeat(40);text.length=0;E.drawMap(x,1280,720,p,120,geo);const fits=text.every(t=>t.y>=0&&t.y+parseFloat(t.font.match(/[\d.]+px/)[0])<=720);
    a.panelWidth=46;a.textScale=1;a.description='New routes connect distant shores.\nThe story continues in {year}.';E.drawMap(x,1280,720,p,120,geo);
    const png=await new Promise(r=>c.toBlob(r,'image/png'));window.sceneProject=p;window.sceneGeo=geo;window.sceneCanvas=c;
    return {renders,first,last,fits,png:png.size,image:c.toDataURL('image/png')};
  })()`);
  for(const side of ['left','right']){assert.ok(result.renders[side].year);assert.ok(result.renders[side].title);assert.equal(result.renders[side].dynamic,true);assert.equal(result.renders[side].edgeChanged,true);assert.equal(result.renders[side].oppositeSame,true);}
  assert.equal(result.first,true);assert.equal(result.last,true);assert.equal(result.fits,true);assert.ok(result.png>1000);
  await writeFile(join(tmpdir(),'frameflow-scene-panel-review.png'),Buffer.from(result.image.split(',')[1],'base64'));
  const video=await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),V=await import('./map-video-export.mjs'),p=window.sceneProject,c=window.sceneCanvas;p.actions[0].dur=6;p.actions[0].animDur=6;const blob=await V.exportMapVideo({canvas:c,fps:30,frames:6,draw:f=>E.drawMap(c.getContext('2d'),c.width,c.height,p,f,window.sceneGeo)});return{size:blob.size,type:blob.type};})()`);
  assert.ok(video.size>1000&&video.type==='video/webm');assert.deepEqual(errors,[]);
  console.log('Scene panel UI, save/reload, both gradients, automatic years, template text, long descriptions, PNG and WebM passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
