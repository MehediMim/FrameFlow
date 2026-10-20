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
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);
  const {HISTORIC_OBJECTS}=await import('../map-historic-objects.mjs'),E=await import('../map-engine.mjs');
  assert.equal(await evaluate(`document.querySelectorAll('#mInspector [data-mf="glyph"] optgroup').length`),3);
  for(const [glyph,icon] of Object.entries(HISTORIC_OBJECTS)){
    await change('#mInspector [data-mf="glyph"]',glyph);
    const p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);E.validateMapProject(p);
    assert.equal(p.actions.at(-1).glyph,glyph);assert.equal(p.actions.at(-1).color,icon.color);
  }
  await change('#mInspector [data-mf="glyph"]','galleon');
  await change('#mInspector [data-mf="__pinMove"]','move');
  let p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);E.validateMapProject(p);assert.ok(p.actions.at(-1).to);
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);assert.equal(p.actions.at(-1).glyph,'galleon');assert.equal(p.actions.at(-1).mode,'move');
  const integration=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),topo=await fetch('map-data/countries-50m.json').then(r=>r.json()),geo=E.buildGeo(topo);
    const p=E.newMapProject();p.graticule=false;p.camera.init={lon:-30,lat:30,zoom:2,pitch:0,bearing:0};
    p.actions=[E.makeAction('object',0,{glyph:'galleon',color:'#8c4438',mode:'move',from:{kind:'city',name:'Lisbon',lon:-9.14,lat:38.72},place:{kind:'city',name:'Lisbon',lon:-9.14,lat:38.72},to:{kind:'city',name:'Havana',lon:-82.37,lat:23.11},animDur:120,dur:240,enter:'none',exit:'none',trail:true,size:2})];
    const c=document.createElement('canvas');c.width=960;c.height=600;const x=c.getContext('2d');
    E.drawMap(x,960,600,p,30,geo);const first=x.getImageData(0,0,960,600).data;
    p.fps=60;p.actions[0].animDur=240;p.actions[0].dur=480;E.drawMap(x,960,600,p,60,geo);const sixty=x.getImageData(0,0,960,600).data;
    let fpsDiff=0;for(let i=0;i<first.length;i++)if(first[i]!==sixty[i])fpsDiff++;
    E.drawMap(x,960,600,p,180,geo);const moved=x.getImageData(0,0,960,600).data;let motion=0;for(let i=0;i<first.length;i+=4)if(first[i]!==moved[i])motion++;
    return {fpsDiff,motion,png:c.toDataURL().startsWith('data:image/png')};
  })()`);
  assert.equal(integration.fpsDiff,0,'historic ship motion and sails are frame-rate independent');assert.ok(integration.motion>100);assert.ok(integration.png);
  await evaluate(`(async()=>{
    const {HISTORIC_OBJECTS}=await import('./map-historic-objects.mjs');
    const c=document.createElement('canvas');c.width=1200;c.height=850;const x=c.getContext('2d');
    x.fillStyle='#172126';x.fillRect(0,0,c.width,c.height);x.fillStyle='#e6dac0';x.font='bold 25px Georgia';x.fillText('EXPLORATION & WARFARE',26,38);
    Object.entries(HISTORIC_OBJECTS).forEach(([key,icon],i)=>{
      const left=24+(i%5)*234,top=62+Math.floor(i/5)*258;
      x.fillStyle='#e8dfcc';x.beginPath();x.roundRect(left,top,218,242,10);x.fill();
      x.save();x.translate(left+109,top+135);icon.draw(x,49,icon.color,2);x.restore();
      x.fillStyle='#382e24';x.font='bold 13px Georgia';x.textAlign='center';x.fillText(icon.label,left+109,top+218,200);x.textAlign='left';
    });document.body.replaceChildren(c);c.style.cssText='height:98vh;width:auto;display:block;margin:auto';
  })()`);
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'frameflow-historic-objects-review.png'),Buffer.from(screenshot.data,'base64'));
  assert.deepEqual(errors,[],'all historical object renderers work');console.log('13 historic objects passed: picker groups, colors, validation, saved movement, animation FPS and PNG rendering');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
