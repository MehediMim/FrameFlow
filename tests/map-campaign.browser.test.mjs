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
  const click=selector=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.click();})()`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  const seek=seconds=>change('#mFrame',String(seconds));
  const canvasPoint=(lon,lat)=>evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),zoom:i.zoom,bearing:i.bearing,pitch:i.pitch},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),r=document.querySelector('#mCanvas').getBoundingClientRect();return{x:r.x+q.x/p.width*r.width,y:r.y+q.y/p.height*r.height};})()`);
  const mouse=async(type,p)=>cdp('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1});
  const mapClick=async(lon,lat)=>{const p=await canvasPoint(lon,lat);await mouse('mousePressed',p);await mouse('mouseReleased',p);};
  const enter=()=>evaluate(`(()=>{document.activeElement?.blur();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}));})()`);
  const select=id=>click('[data-mid="'+id+'"]');
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');const p=E.newMapProject();p.frames=360;p.camera.init={lon:8,lat:48,zoom:4,bearing:0,pitch:0};localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  assert.equal(await evaluate(`document.querySelectorAll('#mAddGrid [data-map-feature],#mAddGrid [data-map-object-add]').length`),0,'specialized tools stay inside Arrow / zone and Object');
  await click('[data-madd="shape"]');await change('[data-mf="shape"]','front');
  for(const p of [[6,43],[7,47],[8,51]])await mapClick(...p);await enter();
  let p=await stored(),front=p.actions.at(-1);assert.equal(front.path.length,3);
  await click('[data-path-capture]');await seek(2);await click('[data-path-edit]');
  const from=await canvasPoint(7,47),to=await canvasPoint(10,48);await mouse('mousePressed',from);await mouse('mouseMoved',to);await mouse('mouseReleased',to);await enter();
  p=await stored();front=p.actions.find(a=>a.id===front.id);assert.deepEqual(front.pathKeys.map(k=>k.frame),[0,60]);assert.ok(front.pathKeys[1].path[1].lon>9);
  await evaluate(`(()=>{const el=document.querySelector('[data-key-item="${front.id}"][data-map-key="path:60"]');el.focus();el.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));})()`);
  assert.ok((await stored()).actions.find(a=>a.id===front.id).pathKeys.some(k=>k.frame===61),'path diamonds retime with keyboard');
  await evaluate(`(()=>{const inspector=document.getElementById('mInspector');inspector.style.width='240px';const section=document.querySelector('[data-path-capture]').closest('details');if(section)section.open=true;})()`);
  assert.equal(await evaluate(`(()=>{const buttons=[...document.querySelectorAll('.m-path-key-actions>button')],content=buttons[0].closest('.ff-inspector-content')||buttons[0].parentElement.parentElement,r=content.getBoundingClientRect();return buttons.every(button=>{const b=button.getBoundingClientRect();return b.width>0&&b.left>=r.left&&b.right<=r.right&&button.scrollWidth<=button.clientWidth});})()`),true,'path key and edit controls fit a narrow inspector without clipping');
  await evaluate(`document.querySelector('[data-path-capture]').scrollIntoView({block:'center'})`);
  await writeFile(join(tmpdir(),'frameflow-path-inspector-review.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`document.getElementById('mInspector').style.removeProperty('width')`);
  console.log('Front-line drawing, point dragging, shape keys and timeline diamonds passed');
  await seek(0);
  for(const [shape,path] of [['road',[[-3,44],[2,46],[6,48]]],['railway',[[3,43],[6,45],[10,46]]],['river',[[13,51],[13,48],[15,45]]]]){
    await click('[data-madd="shape"]');await change('[data-mf="shape"]',shape);for(const point of path)await mapClick(...point);await enter();await change('[data-mf="networkAnimation"]','both');
    assert.equal((await stored()).actions.at(-1).shape,shape);
  }
  await click('[data-madd="highlight"]');await change('[data-area-mode]','region');await click('[data-area-draw]');
  for(const point of [[-4,42],[5,42],[5,50],[-4,50]])await mapClick(...point);await click('[data-area-apply]');
  p=await stored();let highlight=p.actions.at(-1);assert.equal(highlight.target.kind,'polygon');assert.equal(highlight.target.path.length,4);
  await change('[data-area-mode]','select');await click('[data-area-draw]');for(const point of [[-8,39],[19,39],[19,56],[-8,56]])await mapClick(...point);await enter();
  p=await stored();highlight=p.actions.find(a=>a.id===highlight.id);assert.equal(highlight.target.kind,'regions');assert.ok(highlight.target.members.some(m=>m.name==='France'));assert.ok(!highlight.target.members.some(m=>m.name==='Brazil'));
  await click('[data-madd="border"]');await change('[data-area-mode]','region');await click('[data-area-draw]');for(const point of [[9,43],[18,43],[18,50],[9,50]])await mapClick(...point);await enter();
  assert.equal((await stored()).actions.at(-1).target.kind,'polygon');
  console.log('Road/rail/river paths and both drawn-area selection modes passed');
  const objects=[];
  for(const [glyph,place]of [['soldier','Paris'],['tank','Berlin']]){await click('[data-madd="object"]');await change('[data-mf="glyph"]',glyph);await change('[data-mf="place"]',place);objects.push((await stored()).actions.at(-1).id);}
  // Group through the current layer selection workflow; grouping checkboxes
  // were replaced by Shift-selection and the Group shortcut.
  await evaluate(`document.activeElement?.blur();document.querySelector('[data-mid="${objects[0]}"]').click();document.querySelector('[data-mid="${objects[1]}"]').dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'g',ctrlKey:true,bubbles:true}));`);
  p=await stored();let group=p.actions.find(a=>a.type==='group');assert.ok(group);assert.deepEqual(group.memberIds,objects);
  await evaluate(`(()=>{const toggle=document.querySelector('[data-group-collapse="${group.id}"]');if(toggle.getAttribute('aria-expanded')==='true')toggle.click();})()`);
  assert.equal(await evaluate(`document.querySelector('[data-mtl="${objects[0]}"]').hidden`),true,'group collapses child rows');
  await click('[data-group-key]');await seek(2);
  await change('[data-group-field="lon"]',String(group.origin.lon+5));await change('[data-group-field="scale"]','1.5');await change('[data-group-field="rotation"]','20');await change('[data-group-field="opacity"]','0.8');
  p=await stored();group=p.actions.find(a=>a.id===group.id);assert.deepEqual(group.groupKeys.map(k=>k.frame),[0,60]);assert.equal(group.groupKeys[1].values.scale,1.5);
  await click('#mDuplicate');p=await stored();assert.equal(p.actions.filter(a=>a.type==='group').length,2);assert.equal(new Set(p.actions.filter(a=>a.type==='group').flatMap(a=>a.memberIds)).size,4);
  await click('#mUndo');await select(group.id);await seek(1);await click('#mSplit');p=await stored();assert.equal(p.actions.filter(a=>a.type==='group').length,2);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');E.validateMapProject(JSON.parse(localStorage.getItem('frameflow-map-v1')));})()`);
  await click('#mUndo');await select(group.id);await seek(2);await click('[data-group-ungroup]');assert.ok(!(await stored()).actions.some(a=>a.type==='group'));
  await click('#mUndo');await select(group.id);await seek(2);
  const geometry=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),G=await import('./map-object-groups.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));E.validateMapProject(p);
    const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d',{willReadFrequently:true});
    const hash=()=>{let h=0;for(const n of x.getImageData(0,0,c.width,c.height).data)h=(Math.imul(h,31)+n)|0;return h;};
    E.drawMap(x,1280,720,p,30,geo);const first=hash();E.drawMap(x,1280,720,p,30,geo);const stable=hash()===first;E.drawMap(x,1280,720,p,60,geo);const moved=hash()!==first;
    const network=p.actions.filter(a=>['road','railway','river'].includes(a.shape));const np={...p,actions:network};E.drawMap(x,1280,720,np,45,geo);const networkFirst=hash();E.drawMap(x,1280,720,np,75,geo);const flow=hash()!==networkFirst;
    const zoomStart=performance.now();E.drawMap(x,1280,720,{...p,camera:{init:{...p.camera.init,zoom:14}}},60,geo);if(performance.now()-zoomStart>3000)throw Error('Extreme zoom made campaign path rendering too slow');
    E.drawMap(x,1280,720,p,60,geo);const grouped=hash(),ungrouped=structuredClone(p);G.ungroupObjects(ungrouped,ungrouped.actions.find(a=>a.type==='group'),60,loc=>E.resolveLoc(geo,loc));E.validateMapProject(ungrouped);E.drawMap(x,1280,720,ungrouped,60,geo);const preservesUngroup=hash()===grouped;
    if(!preservesUngroup)throw Error('Ungroup changes rendered appearance');
    const g=p.actions.find(a=>a.type==='group'),gp={...p,actions:p.actions.filter(a=>a.type==='group'||g.memberIds.includes(a.id))};g.visible=false;E.drawMap(x,1280,720,gp,60,geo);const hidden=hash();E.drawMap(x,1280,720,{...p,actions:[]},60,geo);const hidesChildren=hidden===hash();
    E.drawMap(x,1280,720,p,60,geo);const blob=await new Promise(r=>c.toBlob(r));return{stable,moved,flow,hidesChildren,png:blob.size};
  })()`);
  assert.equal(geometry.stable,true);assert.equal(geometry.moved,true);assert.equal(geometry.flow,true);assert.equal(geometry.hidesChildren,true);assert.ok(geometry.png>10000);
  // Loading normalizes legacy group defaults, including an omitted animDur.
  p=await evaluate(`(async()=>{const E=await import('./map-engine.mjs');return E.validateMapProject(JSON.parse(localStorage.getItem('frameflow-map-v1')));})()`);
  await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);assert.deepEqual(await stored(),p,'all campaign edits survive reload');
  await select(group.id);await seek(2);await writeFile(join(tmpdir(),'frameflow-campaign-workspace.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[],'no campaign browser runtime errors');
  console.log('Groups animate, collapse, duplicate, split and ungroup; deterministic export, flow, visibility, undo and reload passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
