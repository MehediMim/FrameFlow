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
  await waitFor(`document.querySelectorAll('#mTheme option').length>5`);await evaluate(`document.querySelector('[data-mode="map"]').click()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');localStorage.setItem('frameflow-map-v1',JSON.stringify(E.newMapProject()));location.reload();})()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('[data-madd="label"]').click()`);await change('#mInspector [data-lspreset]','curved');await change('#mInspector [data-ls="curveAngle"]','120');
  await change('#mInspector [data-mf="text"]','ATLANTIC OCEAN');
  await evaluate(`document.querySelector('[data-madd="highlight"]').click()`);await change('#mInspector [data-mf="highlightFill"]','flag');await change('#mInspector [data-mf="flagFit"]','stretch');
  const flagPath=join(profile,'flag.svg');await writeFile(flagPath,'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 200"><path fill="#e02020" d="M0 0h100v200H0z"/><path fill="#ffffff" d="M100 0h100v200H100z"/><path fill="#2060e0" d="M200 0h100v200H200z"/></svg>');
  const root=await cdp('DOM.getDocument'),file=await cdp('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#mInspector [data-badgefile]'});await cdp('DOM.setFileInputFiles',{nodeId:file.nodeId,files:[flagPath]});
  await waitFor(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions[1].image?.startsWith('data:image/png')`);
  let p=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);assert.equal(p.actions[0].labelStyle.textPath,'arc');assert.equal(p.actions[0].labelStyle.curveAngle,120);assert.equal(p.actions[1].highlightFill,'flag');
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);assert.deepEqual(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions`),p.actions);
  const result=await evaluate(String.raw`(async()=>{
    const E=await import('./map-engine.mjs');const p=JSON.parse(localStorage.getItem('frameflow-map-v1'));E.validateMapProject(p);
    const topo={transform:{scale:[1,1],translate:[0,0]},arcs:[[[-10,-10],[20,0],[0,20],[-20,0],[0,-20]],[[-3,-3],[0,6],[6,0],[0,-6],[-6,0]]],objects:{countries:{geometries:[{type:'Polygon',properties:{name:'Testland'},arcs:[[0],[1]]}]}}};
    const geo=E.buildGeo(topo),a={...p.actions[1],start:0,dur:240,animDur:20,target:{kind:'country',name:'Testland'},flagOpacity:1,dim:0,pulse:false,showLabel:false};
    p.theme='paper';p.graticule=false;p.camera.init={lon:0,lat:0,zoom:4,pitch:0,bearing:0};p.actions=[a];await E.preloadBadges(p);
    const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');
    const capture=actions=>{p.actions=actions;E.drawMap(x,1280,720,p,120,geo);return new Uint8ClampedArray(x.getImageData(0,0,1280,720).data);};
    const at=(data,lon,lat)=>{const v=E.makeView({cx:.5,cy:.5,...p.camera.init},1280,720),q=E.project(v,E.lonToX(lon),E.latToY(lat)),i=(Math.floor(q.y)*1280+Math.floor(q.x))*4;return Array.from(data.slice(i,i+4));};
    const base=capture([]),flag=capture([a]),samples=[at(flag,-7,6),at(flag,0,6),at(flag,7,6)];
    const same=(a,b)=>a.every((v,i)=>v===b[i]);const hole=same(at(base,0,0),at(flag,0,0)),outside=same(at(base,15,6),at(flag,15,6));
    const older=E.makeAction('highlight',0,{target:a.target,dim:0,pulse:false,showLabel:false,dur:240,animDur:20,color:'#00ff00'}),newer={...a,start:10};const latest=same(capture([newer]),capture([newer,older]));
    geo.byName.set('Test region',{...geo.byName.get('Testland'),name:'Test region'});const region=same(flag,capture([{...a,target:{kind:'region',name:'Test region',country:'Testland'}}]));
    p.camera.init.pitch=40;p.camera.init.bearing=25;const tilted=capture([a]),tiltSample=at(tilted,-7,6);
    p.camera.init.pitch=0;p.camera.init.bearing=0;const label={...p.actions[0],...E.makeAction('label',0,{text:'ATLANTIC',dur:240,animDur:20,labelPlacement:'map',place:{kind:'point',name:'Center',lon:0,lat:0},offsetY:0,labelStyle:{font:'Georgia',size:48,shape:'none',placement:'map',textPath:'arc',curveAngle:120,halo:true}})};
    const glyphs=[],rotations=[],translations=[],fill=x.fillText.bind(x),rotate=x.rotate.bind(x),translate=x.translate.bind(x);x.fillText=(t,...args)=>{glyphs.push(t);fill(t,...args);};x.rotate=t=>{rotations.push(t);rotate(t);};x.translate=(px,py)=>{translations.push([px,py]);translate(px,py);};
    capture([label]);const curve={glyphs:glyphs.join(''),bend:Math.max(...translations.map(p=>p[1]))-Math.min(...translations.map(p=>p[1])),rotates:rotations.some(r=>r>.1)&&rotations.some(r=>r<-.1)};
    const realGeo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));p.camera.init={lon:-12,lat:40,zoom:3.8,pitch:0,bearing:0};p.actions=[{...a,target:{kind:'country',name:'Spain'},flagOpacity:.9}, {...label,text:'ATLANTIC OCEAN',place:{kind:'point',name:'Atlantic',lon:-29,lat:40},labelStyle:{...label.labelStyle,size:36,curveAngle:100}}];
    E.drawMap(x,1280,720,p,120,realGeo);const png=await new Promise(r=>c.toBlob(r,'image/png'));window.cartographyProject=p;window.cartographyGeo=realGeo;window.cartographyCanvas=c;
    return {samples,hole,outside,latest,region,tiltSample,curve,png:png.size,image:c.toDataURL('image/png')};
  })()`);
  assert.ok(result.samples[0][0]>180&&result.samples[0][1]<90,'red stripe');assert.ok(result.samples[1].slice(0,3).every(v=>v>225),'white stripe');assert.ok(result.samples[2][2]>180&&result.samples[2][0]<90,'blue stripe');
  for(const k of ['hole','outside','latest','region'])assert.equal(result[k],true,k);assert.ok(result.tiltSample[0]>180&&result.tiltSample[1]<90,'flag follows tilted/rotated ground');
  assert.equal(result.curve.glyphs,'ATLANTIC');assert.ok(result.curve.bend>10);assert.equal(result.curve.rotates,true);assert.ok(result.png>1000);
  await writeFile(join(tmpdir(),'frameflow-curved-label-flag-review.png'),Buffer.from(result.image.split(',')[1],'base64'));
  const video=await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),V=await import('./map-video-export.mjs'),p=window.cartographyProject,c=window.cartographyCanvas;await E.preloadBadges(p);const blob=await V.exportMapVideo({canvas:c,fps:30,frames:3,draw:f=>E.drawMap(c.getContext('2d'),c.width,c.height,p,120+f,window.cartographyGeo)});return{size:blob.size,type:blob.type};})()`);
  assert.ok(video.size>1000&&video.type==='video/webm');assert.deepEqual(errors,[]);console.log('Curved label and flag highlight UI, upload/reload, country/region clipping and holes, tilted camera, overlap, PNG and WebM passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
