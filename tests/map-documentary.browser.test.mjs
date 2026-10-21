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
  const change=async(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await change('#mFps','30');
  const before=await stored();
  await change('#mTheme','documentary');
  let project=await stored();
  assert.equal(project.theme,'documentary');assert.equal(project.texture.type,'paper');assert.equal(project.atlasLabels.caps,true);
  assert.equal(await evaluate(`document.querySelector('#mTerrainBox').hidden`),false);
  assert.equal(await evaluate(`document.querySelector('#mTerrainLow').value`),'#aaa783');
  assert.deepEqual(project.actions,before.actions,'applying look preserves existing clips');
  await evaluate(`document.querySelector('#mUndo').click()`);
  assert.equal((await stored()).theme,before.theme,'look is undoable');
  await evaluate(`document.querySelector('#mRedo').click()`);
  assert.equal((await stored()).theme,'documentary');
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);
  await change('[data-mf="glyph"]','radioOperator');
  assert.equal((await stored()).actions.at(-1).glyph,'radioOperator');
  await evaluate(`document.querySelector('[data-madd="label"]').click()`);
  assert.equal((await stored()).actions.at(-1).labelStyle.font,'Oswald');
  assert.equal((await stored()).actions.at(-1).labelStyle.caps,true);
  project=await stored();await evaluate('location.reload()');
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  assert.deepEqual(await stored(),project,'documentary look, new troop and label survive reload');
  await evaluate(`document.querySelector('#mTerrainReset').click()`);
  assert.equal(await evaluate(`document.querySelector('#mTerrainLow').value`),'#aaa783','terrain reset keeps documentary defaults');
  // Draw the complete export path with deterministic DEM fixture tiles, without
  // depending on an external terrain server for visual regression checks.
  const result=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),D=await import('./map-documentary.mjs'),R=await import('./map-relief.mjs'),O=await import('./map-documentary-objects.mjs'),A=await import('./map-armies.mjs');
    const geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    const p=D.applyDocumentaryLook(E.newMapProject());p.camera.init={lon:12,lat:48,zoom:4,bearing:0,pitch:0};
    const realTerrain=${process.argv.includes('--real-terrain')};
    geo.relief=R.createRelief(realTerrain?{}:{load:async(z,x,y)=>{const size=64,heights=Float32Array.from({length:size*size},(_,i)=>{const lon=(x+(i%size)/size)/2**z*360-180,lat=E.yToLat((y+Math.floor(i/size)/size)/2**z);return Math.max(20,160+1500*Math.max(0,Math.sin(lon*.6)*Math.cos(lat*.9))+600*Math.sin(lon*1.5)*Math.sin(lat*1.4))});return {heights,size}}});
    p.actions=Object.entries(O.DOCUMENTARY_OBJECTS).map(([glyph,ic],i)=>E.makeAction('object',0,{glyph,color:ic.color,enter:'none',exit:'none',dur:240,size:1.8,showLabel:true,label:['RIFLE COMPANY','FIELD COMMAND','SIGNALS UNIT','AID STATION'][i],place:{kind:'point',name:'Map position',lon:2+i*5,lat:47+(i%2)*3}}));
    p.actions.push(E.makeAction('shape',0,{shape:'arrow',color:'#964e3d',dur:240,path:[{lat:44,lon:3},{lat:45,lon:10},{lat:46,lon:16}],width:8}));
    const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d',{willReadFrequently:true});
    await geo.relief.ready(E.imageryNeeds(p,geo,1280,720,90));await document.fonts.ready;
    E.validateMapProject(p);const v=E.drawMap(ctx,1280,720,p,90,geo);
    const pixels=ctx.getImageData(0,0,1280,720).data.slice();E.drawMap(ctx,1280,720,p,90,geo);
    const stable=ctx.getImageData(0,0,1280,720).data.every((v,i)=>v===pixels[i]);
    const image=c.toDataURL('image/png'),blob=await new Promise(r=>c.toBlob(r));
    const labels=E.atlasMapLabels(p,geo,v);const renderColors=new Set();for(let i=0;i<pixels.length;i+=16)renderColors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);
    // A large contact sheet makes the uniform and equipment details reviewable.
    const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=480;const g=sheet.getContext('2d');g.fillStyle='#e4d9bb';g.fillRect(0,0,1200,480);
    Object.entries(O.DOCUMENTARY_OBJECTS).forEach(([glyph,ic],i)=>{g.save();g.translate(155+i*295,240);ic.draw(g,140,ic.color);g.restore();g.fillStyle='#34392e';g.textAlign='center';g.font='600 19px Arial';g.fillText(ic.label,155+i*295,440,275)});
    return {stable,image,sheet:sheet.toDataURL('image/png'),size:blob.size,colors:renderColors.size,labels:labels.length,failed:geo.relief.failedCount()};
  })()`);
  assert.equal(result.stable,true,'same frame exports identical pixels');assert.equal(result.failed,0);
  assert.ok(result.size>50000,'PNG export contains map detail');assert.ok(result.colors>1000,'relief retains detailed tonal variation');assert.ok(result.labels>5);
  await writeFile(join(tmpdir(),'frameflow-documentary-map.png'),Buffer.from(result.image.split(',')[1],'base64'));
  await writeFile(join(tmpdir(),'frameflow-documentary-troops.png'),Buffer.from(result.sheet.split(',')[1],'base64'));
  assert.deepEqual(errors,[],'no browser runtime errors');
  console.log('Documentary UI, undo/redo, new troops, label defaults, save/reload, terrain reset, deterministic relief, and PNG rendering passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
