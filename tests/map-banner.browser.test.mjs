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
  await change('#mInspector [data-mf="glyph"]','banner');
  assert.equal(await evaluate(`!!document.querySelector('#mInspector [data-badgefile]')`),true);
  await change('#mInspector [data-mf="bannerTitle"]','RICHARD HAKLUYT');
  await change('#mInspector [data-mf="bannerWindStrength"]','0.75');
  const png=await evaluate(`(()=>{const c=document.createElement('canvas');c.width=240;c.height=320;const x=c.getContext('2d');x.fillStyle='#1d405c';x.fillRect(0,0,240,320);for(let i=0;i<8;i++){x.fillStyle=i%2?'#be9c4a':'#e4d8af';x.fillRect((i%2)*120,i*40,120,40);}x.fillStyle='#742e2e';x.beginPath();x.moveTo(120,50);x.lineTo(195,145);x.lineTo(120,270);x.lineTo(45,145);x.closePath();x.fill();x.fillStyle='#efe2bb';x.font='bold 70px Georgia';x.textAlign='center';x.fillText('R',120,175);return c.toDataURL('image/png').split(',')[1];})()`);
  const imagePath=join(profile,'banner-art.png');await writeFile(imagePath,Buffer.from(png,'base64'));
  const root=await cdp('DOM.getDocument');const file=await cdp('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#mInspector [data-badgefile]'});
  await cdp('DOM.setFileInputFiles',{nodeId:file.nodeId,files:[imagePath]});
  await waitFor(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1).image?.startsWith('data:image/png')`);
  let p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  assert.equal(p.actions.at(-1).bannerAspect,.75);assert.equal(p.actions.at(-1).bannerTitle,'RICHARD HAKLUYT');
  const E=await import('../map-engine.mjs');E.validateMapProject(p);
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  assert.equal(p.actions.at(-1).glyph,'banner');assert.ok(p.actions.at(-1).image);
  const rendered=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs');const topo=await fetch('map-data/countries-50m.json').then(r=>r.json());
    const geo=E.buildGeo(topo),p=E.newMapProject();p.graticule=false;p.theme='paper';p.camera.init={lon:2.35,lat:48.85,zoom:4,bearing:0,pitch:0};
    const saved=JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1);
    p.actions=[{...saved,start:0,dur:240,animDur:30,enter:'none',exit:'none',size:2,showLabel:false,place:{kind:'point',name:'Paris',lon:2.35,lat:48.85}}];
    await E.preloadBadges(p);const c=document.createElement('canvas');c.width=800;c.height=760;const x=c.getContext('2d');
    E.drawMap(x,800,760,p,30,geo);const first=x.getImageData(0,0,800,760).data;
    E.drawMap(x,800,760,p,60,geo);const next=x.getImageData(0,0,800,760).data;
    let changed=0;for(let i=0;i<first.length;i+=4)if(first[i]!==next[i]||first[i+1]!==next[i+1]||first[i+2]!==next[i+2])changed++;
    E.drawMap(x,800,760,p,60,geo);const repeat=x.getImageData(0,0,800,760).data;
    let repeatDiff=0;for(let i=0;i<repeat.length;i++)if(repeat[i]!==next[i])repeatDiff++;
    p.fps=60;E.drawMap(x,800,760,p,120,geo);const at60=x.getImageData(0,0,800,760).data;
    let fpsDiff=0;for(let i=0;i<at60.length;i++)if(at60[i]!==next[i])fpsDiff++;p.fps=30;
    p.actions[0].bannerWind=false;E.drawMap(x,800,760,p,30,geo);const still=x.getImageData(0,0,800,760).data;
    E.drawMap(x,800,760,p,60,geo);const stillNext=x.getImageData(0,0,800,760).data;
    let stillDiff=0;for(let i=0;i<still.length;i++)if(still[i]!==stillNext[i])stillDiff++;
    p.actions[0].bannerWind=true;E.drawMap(x,800,760,p,60,geo);
    document.body.replaceChildren(c);c.style.cssText='height:95vh;width:auto;display:block;margin:auto';
    return {changed,repeatDiff,stillDiff,fpsDiff,png:c.toDataURL('image/png').startsWith('data:image/png')};
  })()`);
  assert.ok(rendered.changed>1500,`cloth and image wave: ${JSON.stringify(rendered)}`);
  assert.equal(rendered.repeatDiff,0,'same frame is deterministic');assert.equal(rendered.fpsDiff,0,'wind speed is consistent at 30 and 60 fps');assert.equal(rendered.stillDiff,0,'wind switch stops motion');assert.ok(rendered.png);
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'frameflow-banner-review.png'),Buffer.from(screenshot.data,'base64'));
  assert.deepEqual(errors,[],'no runtime errors');console.log('Image upload, saved banner, animated cloth, wind switch, deterministic frames and PNG rendering passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
