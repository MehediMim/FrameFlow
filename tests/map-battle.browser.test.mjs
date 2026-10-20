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
  await evaluate(`document.querySelector('[data-mode="map"]').click()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const saved=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);
  await change('#mInspector [data-mf="glyph"]','stoneWall');await change('#mInspector [data-mf="count"]','8');
  await change('#mInspector [data-mf="formation"]','row');await change('#mInspector [data-mf="gapX"]','52');
  await change('#mInspector [data-mf="formationAngle"]','25');await change('#mInspector [data-mf="objectAngle"]','25');
  await change('#mInspector [data-mf="place"]','0, 0');
  let p=await saved();assert.equal(p.actions.at(-1).formation,'row');assert.equal(p.actions.at(-1).count,8);assert.equal(p.actions.at(-1).objectAngle,25);
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);await change('#mInspector [data-mf="glyph"]','cannonBattery');
  await change('#mInspector [data-mf="place"]','12, 20');await change('#mInspector [data-mf="__pinMove"]','move');
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);await change('#mInspector [data-mf="glyph"]','musketeer');await change('#mInspector [data-mf="place"]','-8, -20');
  const before=await saved();
  await evaluate(`document.querySelector('[data-arrange-select="all"]').click();document.querySelector('[data-arrange-op="centerY"]').click()`);
  p=await saved();const objects=p.actions.filter(a=>a.type==='object');assert.equal(objects.length,3);
  assert.ok(Math.max(...objects.map(a=>a.place.lat))-Math.min(...objects.map(a=>a.place.lat))<1e-6,'align anchors horizontally');
  const oldMoving=before.actions.find(a=>a.glyph==='cannonBattery'),moving=objects.find(a=>a.glyph==='cannonBattery');
  assert.ok(Math.abs((moving.to.lat-oldMoving.to.lat)-(moving.place.lat-oldMoving.place.lat))<1e-6,'arranging moves route destinations with their start');
  await evaluate(`document.querySelector('#mUndo').click()`);let undone=await saved();assert.deepEqual(undone.actions,before.actions,'arrange can be undone');
  await evaluate(`document.querySelector('#mRedo').click()`);assert.deepEqual((await saved()).actions,p.actions,'arrange can be redone');
  await evaluate(`document.querySelector('[data-madd="effect"]').click()`);
  const {BATTLE_EFFECTS}=await import('../map-battle-effects.mjs'),E=await import('../map-engine.mjs');
  for(const fx of Object.keys(BATTLE_EFFECTS)){
    await change('#mInspector [data-mf="fx"]',fx);await change('#mInspector [data-mf="battleAngle"]','25');
    await change('#mInspector [data-mf="battleIntensity"]','7');await change('#mInspector [data-mf="repeat"]','3');
    p=await saved();E.validateMapProject(p);assert.equal(p.actions.at(-1).fx,fx);assert.equal(p.actions.at(-1).battleAngle,25);
  }
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  p=await saved();E.validateMapProject(p);assert.equal(p.actions.find(a=>a.glyph==='stoneWall').formation,'row');assert.equal(p.actions.at(-1).fx,'siegeFire');
  const pixels=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),{BATTLE_EFFECTS}=await import('./map-battle-effects.mjs');const topo=await fetch('map-data/countries-50m.json').then(r=>r.json()),geo=E.buildGeo(topo),p=E.newMapProject();
    p.camera.init={lon:2.35,lat:48.85,zoom:4,pitch:0,bearing:0};p.graticule=false;p.actions=[E.makeAction('object',0,{glyph:'stoneWall',place:{kind:'point',name:'Paris',lon:2.35,lat:48.85},count:7,formation:'row',gapX:52,enter:'none',exit:'none'})];
    const c=document.createElement('canvas');c.width=960;c.height=600;const x=c.getContext('2d');let animated=0;
    for(const [fx,meta]of Object.entries(BATTLE_EFFECTS)){
      p.actions[1]=E.makeAction('effect',0,{fx,color:meta.color,dur:240,animDur:120,repeat:2,place:{kind:'point',name:'Paris',lon:2.35,lat:48.85},battleAngle:-15,battleIntensity:7});
      E.drawMap(x,960,600,p,30,geo);const a=x.getImageData(0,0,960,600).data;
      E.drawMap(x,960,600,p,48,geo);const b=x.getImageData(0,0,960,600).data;
      let changes=0;for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1])changes++;if(changes>20)animated++;
      const repeat=x.getImageData(0,0,960,600).data;E.drawMap(x,960,600,p,48,geo);const again=x.getImageData(0,0,960,600).data;for(let i=0;i<repeat.length;i++)if(repeat[i]!==again[i])throw Error('Non-deterministic effect '+fx);
    }
    return {animated,png:c.toDataURL().startsWith('data:image/png')};
  })()`);assert.equal(pixels.animated,7,'all battle effects animate');assert.ok(pixels.png);
  await evaluate(`(async()=>{
    const {HISTORIC_OBJECTS}=await import('./map-historic-objects.mjs'),{BATTLE_EFFECTS,drawBattleEffect}=await import('./map-battle-effects.mjs');
    const cards=[...Object.entries(HISTORIC_OBJECTS).filter(([,o])=>o.group==='defense'),...Object.entries(BATTLE_EFFECTS)];
    const c=document.createElement('canvas');c.width=1400;c.height=1000;const x=c.getContext('2d');x.fillStyle='#172126';x.fillRect(0,0,c.width,c.height);x.fillStyle='#e8dfcc';x.font='bold 27px Georgia';x.fillText('DEFENSES & BATTLE EFFECTS',24,39);
    cards.forEach(([key,meta],i)=>{const left=22+i%5*276,top=62+Math.floor(i/5)*310;
      x.fillStyle='#e8dfcc';x.beginPath();x.roundRect(left,top,260,292,10);x.fill();x.save();x.beginPath();x.rect(left,top,260,252);x.clip();
      if(meta.draw){x.translate(left+130,top+155);meta.draw(x,60,meta.color,1);}
      else drawBattleEffect(x,key,{x:left+(['cannonShot','musketVolley','arrowVolley'].includes(key)?40:130),y:top+145},42,key==='cannonShot'?.06:key==='musketVolley'?.2:.5,1,{color:meta.color,battleIntensity:6,battleRange:175,battleSpread:35},1.2);
      x.restore();x.fillStyle='#382e24';x.font='bold 14px Georgia';x.textAlign='center';x.fillText(meta.label,left+130,top+272,242);x.textAlign='left';
    });document.body.replaceChildren(c);c.style.cssText='height:98vh;width:auto;display:block;margin:auto';
  })()`);
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'frameflow-defense-battle-review.png'),Buffer.from(screenshot.data,'base64'));
  assert.deepEqual(errors,[],'no runtime errors');console.log('Defenses, formation controls, separate-object alignment, route shifts, undo/redo, seven battle effects, saved projects and PNG rendering passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
