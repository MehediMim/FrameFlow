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
  await waitFor(`document.body.classList.contains('mode-map')&&document.querySelectorAll('#mDlCountry option').length>100`);
  const review=await evaluate(`(async()=>{
    const {LANDMARK_OBJECTS}=await import('./map-landmark-objects.mjs');
    const {PEOPLE_OBJECTS}=await import('./map-people-objects.mjs');
    const E=await import('./map-engine.mjs');
    const {OBJECT_ICONS}=await import('./map-objects.mjs');
    const entries=Object.entries({...LANDMARK_OBJECTS,...PEOPLE_OBJECTS});
    const sheet=document.createElement('canvas');sheet.width=1440;sheet.height=1020;
    const c=sheet.getContext('2d');c.fillStyle='#192125';c.fillRect(0,0,sheet.width,sheet.height);
    c.fillStyle='#eee7d6';c.font='600 25px sans-serif';c.fillText('WORLD LANDMARKS',25,40);c.fillText('PEOPLE & OCCUPATIONS',25,540);
    let painted=0,deterministic=0,distinct=new Set();
    for(let i=0;i<entries.length;i++){
      const [key,icon]=entries[i],local=i%16,x=25+(local%8)*178,y=(i<16?90:590)+Math.floor(local/8)*235;
      const sprite=document.createElement('canvas');sprite.width=180;sprite.height=180;
      const sc=sprite.getContext('2d');
      const render=(color=icon.color)=>{sc.clearRect(0,0,180,180);sc.save();sc.translate(90,105);icon.draw(sc,43,color,1.5);sc.restore();return sprite.toDataURL();};
      const first=render();if(render()===first)deterministic++;
      if(sc.getImageData(0,0,180,180).data.some((v,j)=>j%4===3&&v>0))painted++;
      distinct.add(render('#a36176'));render();c.drawImage(sprite,x,y);c.fillStyle='#d9e0df';c.font='12px sans-serif';c.textAlign='center';
      const words=icon.label.split(' ');let row='',lines=[];for(const word of words){if((row+' '+word).trim().length>23){lines.push(row);row=word;}else row=(row+' '+word).trim();}lines.push(row);
      lines.forEach((text,j)=>c.fillText(text,x+90,y+187+j*16));
      if(render('#a36176')===first)throw Error(key+' does not support recoloring');
      if(OBJECT_ICONS[key]!==icon)throw Error(key+' is not registered');
    }
    window.objectLibrarySheet=sheet.toDataURL();
    const p=E.newMapProject();p.frames=180;p.actions=entries.map(([glyph],i)=>E.makeAction('object',0,{glyph,size:1.5,dur:180,enter:'none',place:{kind:'point',name:'Paris',lat:48.86,lon:2.35},label:OBJECT_ICONS[glyph].label}));
    localStorage.setItem('frameflow-map-v1',JSON.stringify(p));
    return {painted,deterministic,distinct:distinct.size,landmarks:Object.keys(LANDMARK_OBJECTS),people:Object.keys(PEOPLE_OBJECTS)};
  })()`);
  assert.equal(review.painted,32,'all new objects render visible pixels');
  assert.equal(review.deterministic,32,'all illustrations render deterministically at a fixed timeline time');
  assert.equal(review.distinct,32,'every landmark and occupation has a distinct illustration');
  await writeFile(join(tmpdir(),'frameflow-landmarks-people.png'),Buffer.from((await evaluate('window.objectLibrarySheet')).split(',')[1],'base64'));
  await evaluate('location.reload()');
  await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===32`);
  await evaluate(`document.querySelector('#mItems [data-mid]').click()`);
  await waitFor(`!!document.querySelector('[data-mf="glyph"]')`);
  const categories=await evaluate(`[...document.querySelector('[data-mf="glyph"]').options].map(o=>o.value)`);
  for(const glyph of [...review.landmarks,...review.people])assert.ok(categories.includes(glyph),'object picker includes '+glyph);
  const filter=await evaluate(`[...document.querySelectorAll('#mInspector select')].find(s=>[...s.options].some(o=>o.value==='all')&&[...s.options].some(o=>o.value==='landmarks'))?.outerHTML`);
  assert.ok(filter,'landmarks and people categories are available');
  for(const group of ['landmarks','people']){
    await evaluate(`(()=>{const s=[...document.querySelectorAll('#mInspector select')].find(s=>[...s.options].some(o=>o.value==='all')&&[...s.options].some(o=>o.value==='landmarks'));s.value='GROUP_VALUE';s.dispatchEvent(new Event('change',{bubbles:true}));})()`.replace('GROUP_VALUE',group));
    const glyphs=await evaluate(`[...document.querySelector('[data-mf="glyph"]').options].filter(o=>!o.disabled).map(o=>o.value)`);
    assert.deepEqual(glyphs,review[group],'category filter shows exactly the new '+group+' objects');
  }
  const saved=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.map(a=>a.glyph)`);
  assert.equal(saved.length,32,'saved project reopens all new objects');
  const videoBytes=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),{exportMapVideo}=await import('./map-video-export.mjs');
    const p=JSON.parse(localStorage.getItem('frameflow-map-v1'));
    const geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;
    const blob=await exportMapVideo({canvas,fps:24,frames:3,draw:frame=>E.drawMap(canvas.getContext('2d'),320,180,p,frame,geo)});
    return blob.size;
  })()`);
  assert.ok(videoBytes>100,'new object types render through the map video export pipeline');
  assert.deepEqual(errors,[],'no browser errors');
  console.log('32 unique landmark and occupation illustrations, recoloring, deterministic rendering, editor categories, filtering and project reload passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
