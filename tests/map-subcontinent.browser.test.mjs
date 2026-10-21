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
    const {SUBCONTINENT_OBJECTS}=await import('./map-subcontinent-objects.mjs'),E=await import('./map-engine.mjs');
    const {objectPreview}=await import('./map-object-preview.mjs'),{ARMY_PRESETS,validateArmyUnits}=await import('./map-armies.mjs');
    const entries=Object.entries(SUBCONTINENT_OBJECTS),sheet=document.createElement('canvas');sheet.width=1320;sheet.height=900;
    const c=sheet.getContext('2d');c.fillStyle='#192125';c.fillRect(0,0,sheet.width,sheet.height);
    const p=E.newMapProject();p.frames=300;p.camera.init={lon:80,lat:22,zoom:3,bearing:0,pitch:0};
    const distinct=new Set(),groups={};
    for(let i=0;i<entries.length;i++){
      const [key,icon]=entries[i];(groups[icon.group]||=[]).push(key);
      const canvas=document.createElement('canvas');canvas.width=canvas.height=220;const sc=canvas.getContext('2d');
      const render=color=>{sc.clearRect(0,0,220,220);sc.save();sc.translate(110,142);icon.draw(sc,52,color,1.5);sc.restore();return canvas.toDataURL();};
      const first=render(icon.color);if(first!==render(icon.color))throw Error(key+' is not deterministic');
      if(first===render('#8d60bc'))throw Error(key+' cannot be recolored');render(icon.color);distinct.add(first);
      const pixels=sc.getImageData(0,0,220,220).data;if(!pixels.some((v,j)=>j%4===3&&v>0))throw Error(key+' is empty');
      const img=new Image();img.src=objectPreview(key);await img.decode();if(!img.naturalWidth)throw Error(key+' has no picker thumbnail');
      const x=(i%6)*220,y=Math.floor(i/6)*300;c.drawImage(canvas,x,y);c.drawImage(img,x+11,y+233,32,32);
      c.fillStyle='#d9e0df';c.font='12px sans-serif';c.textAlign='center';
      const words=icon.label.split(' ');let row='',lines=[];for(const word of words){if((row+' '+word).trim().length>27){lines.push(row);row=word;}else row=(row+' '+word).trim();}lines.push(row);
      lines.forEach((text,j)=>c.fillText(text,x+119,y+247+j*17));
      p.actions.push(E.makeAction('object',0,{glyph:key,color:icon.color,dur:240,enter:'none',place:{kind:'point',name:'Subcontinent test',lon:72+(i%6)*3,lat:29-Math.floor(i/6)*4}}));
    }
    for(const key of ['mughalColumn','companyColumn'])validateArmyUnits(ARMY_PRESETS[key].units,E.OBJECT_ICONS);
    E.validateMapProject(JSON.parse(JSON.stringify(p)));
    localStorage.setItem('frameflow-map-v1',JSON.stringify(p));
    return {png:sheet.toDataURL(),count:entries.length,unique:distinct.size,groups};
  })()`);
  assert.equal(review.count,18);assert.equal(review.unique,18,'all miniatures have distinct artwork');
  const imagePath=join(tmpdir(),'frameflow-subcontinent-objects.png');await writeFile(imagePath,Buffer.from(review.png.split(',')[1],'base64'));
  console.log('Visual review: '+imagePath);
  await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===18&&document.querySelectorAll('#mDlCountry option').length>100`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('#mItems [data-mid]').click()`);
  for(const [group,glyphs]of Object.entries(review.groups)){
    await change('[data-object-type]',group);
    assert.deepEqual(await evaluate(`[...document.querySelectorAll('[data-object-choice]')].map(el=>el.dataset.objectChoice)`),glyphs);
    await evaluate(`document.querySelector('[data-object-menu]').open=true`);
    await waitFor(`[...document.querySelectorAll('[data-object-choice] img')].every(img=>img.complete&&img.naturalWidth>0)`);
    await evaluate(`document.querySelector('[data-object-choice="${glyphs[0]}"]').click()`);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions[0].glyph`),glyphs[0]);
  }
  await change('[data-object-type]','all');await change('[data-mf="glyph"]','army');
  for(const preset of ['mughalColumn','companyColumn']){
    await change('[data-army-preset]',preset);
    const units=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions[0].armyUnits`);
    assert.ok(units.length>=3,'army preset loads regional units');
  }
  const saved=await evaluate(`localStorage.getItem('frameflow-map-v1')`);
  await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===18`);
  assert.equal(await evaluate(`localStorage.getItem('frameflow-map-v1')`),saved,'new object selections and armies survive reload');
  const bytes=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),{exportMapVideo}=await import('./map-video-export.mjs');
    const p=JSON.parse(localStorage.getItem('frameflow-map-v1'));E.validateMapProject(p);
    const geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;
    return (await exportMapVideo({canvas,fps:24,frames:3,draw:frame=>E.drawMap(canvas.getContext('2d'),640,360,p,frame,geo)})).size;
  })()`);
  assert.ok(bytes>100);assert.deepEqual(errors,[]);
  console.log('18 subcontinent miniatures: distinct rendering, recoloring, thumbnail icons, category filtering, army presets, persistence and video export passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
