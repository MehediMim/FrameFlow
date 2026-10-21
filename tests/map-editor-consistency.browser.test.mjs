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
  await waitFor(`document.body?.classList.contains('mode-map')&&document.querySelectorAll('#mDlCountry option').length>100`);

  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(el.type==='checkbox')el.checked=${JSON.stringify(value)};else el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=E.newMapProject(),at=(lon,lat)=>({kind:'point',name:'Anchor',lon,lat});p.frames=3600;p.camera.init={lon:0,lat:44,zoom:4,bearing:0,pitch:0};p.actions=[
    E.makeAction('object',0,{id:'object',glyph:'tank',place:at(-12,47),dur:240,animDur:60}),
    E.makeAction('pin',0,{id:'pin',place:at(-5,47),dur:240,animDur:60}),
    E.makeAction('effect',0,{id:'effect',place:at(3,47),dur:240,animDur:60}),
    E.makeAction('label',0,{id:'label',text:'Map note',place:at(11,47),labelPlacement:'map',offsetX:0,offsetY:0,dur:240,animDur:60}),
    E.makeAction('shape',0,{id:'shape',shape:'distance',curve:'straight',path:[at(-12,39),at(-5,39)],dur:240,animDur:60}),
    E.makeAction('plane',0,{id:'travel',from:at(2,39),to:at(10,39),dur:240,animDur:60}),
    E.makeAction('label',0,{id:'screen',text:'Screen note',x:25,y:22,dur:240,animDur:60})];localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===8&&document.querySelectorAll('#mDlCountry option').length>100`);
  assert.ok(await evaluate(`Number(document.querySelector('#mZoomT').value)>5`),'long sparse timelines fit the actual content');
  assert.equal(await evaluate(`document.querySelectorAll('.ff-track-heading').length`),0,'no redundant section-heading rows');
  assert.ok(await evaluate(`[...document.querySelectorAll('#mTrackRows [data-mrow]')].every(row=>parseFloat(row.style.height)<=32)`),'timeline rows stay compact');
  await change('#mFrame',1);
  const point=(lon,lat)=>evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),zoom:i.zoom,bearing:i.bearing,pitch:i.pitch},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),r=document.querySelector('#mCanvas').getBoundingClientRect();return{x:r.x+q.x/p.width*r.width,y:r.y+q.y/p.height*r.height};})()`);
  const screen=()=>evaluate(`(()=>{const r=document.querySelector('#mCanvas').getBoundingClientRect();return{x:r.x+r.width*.25,y:r.y+r.height*.22};})()`);
  const mouse=(type,p,shift=false)=>cdp('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,modifiers:shift?8:0});
  const click=async(p,shift=false)=>{await mouse('mousePressed',p,shift);await mouse('mouseReleased',p,shift);};
  const drag=async(a,b)=>{await mouse('mousePressed',a);await mouse('mouseMoved',b);await mouse('mouseReleased',b);};
  const rightClick=async p=>{await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'right',buttons:2,clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'right',buttons:0,clickCount:1});};
  const primary=()=>evaluate(`document.querySelector('#mItems .selected')?.dataset.mid`);
  for(const [id,lon,lat,field] of [['pin',-5,47,'__pinDisplay'],['effect',3,47,'fx'],['label',11,47,'text'],['shape',-8,39,'shape']]){
    const p=await point(lon,lat);await click(p);
    assert.equal(await primary(),id,`${id} selects directly on the map`);
    assert.ok(await evaluate(`!!document.querySelector('#mMapContext [data-direct-field="${field}"]')`),`${id} has compact canvas controls`);
    const before=(await stored()).actions.find(a=>a.id===id);
    await drag(p,{x:p.x+20,y:p.y+12});
    const after=(await stored()).actions.find(a=>a.id===id);
    assert.notDeepEqual(id==='shape'?after.path:after.place,id==='shape'?before.path:before.place,`${id} drags on canvas`);
    if(id==='shape')assert.ok(Math.abs((after.path[1].lon-before.path[1].lon)-(after.path[0].lon-before.path[0].lon))<1e-6,'dragging a shape preserves its geometry');
    await evaluate(`document.querySelector('#mUndo').click()`);
    assert.deepEqual((await stored()).actions.find(a=>a.id===id),before,`${id} drag has one undo step`);
    await rightClick(p);
    assert.ok(await evaluate(`!!document.querySelector('[data-direct-context-duplicate]')&&!!document.querySelector('[data-direct-context-delete]')&&!!document.querySelector('[data-direct-context-visibility]')`),`${id} has the same context actions`);
    await evaluate(`document.querySelector('[data-direct-context-duplicate]').click()`);
    assert.equal((await stored()).actions.length,8);
    await evaluate(`document.querySelector('#mUndo').click()`);
  }
  const traveler=await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),zoom:i.zoom,bearing:0,pitch:0},p.width,p.height),a=p.actions.find(a=>a.id==='travel'),spot=E.objectLocationAt(v,{}, {...a,place:a.from,mode:'move'},30),q=E.project(v,spot.X,spot.Y,a.lift*v.unit*Math.sin(Math.PI*spot.p)),r=document.querySelector('#mCanvas').getBoundingClientRect();return{x:r.x+q.x/p.width*r.width,y:r.y+q.y/p.height*r.height};})()`);
  await click(traveler);assert.equal(await primary(),'travel','saved travelers select at their elevated rendered position');
  const routeBefore=(await stored()).actions.find(a=>a.id==='travel');
  await drag(traveler,{x:traveler.x+20,y:traveler.y+10});
  const routeAfter=(await stored()).actions.find(a=>a.id==='travel');
  assert.notDeepEqual(routeAfter.from,routeBefore.from);assert.deepEqual(routeAfter.to,routeBefore.to,'dragging a saved traveler preserves its destination');
  await evaluate(`document.querySelector('#mUndo').click()`);
  await click(await screen());assert.equal(await primary(),'screen','screen text selects from its rendered label');
  const screenBefore=(await stored()).actions.find(a=>a.id==='screen'),p=await screen();
  await drag(p,{x:p.x+30,y:p.y+15});
  assert.ok((await stored()).actions.find(a=>a.id==='screen').x>screenBefore.x,'screen text drags in canvas coordinates: '+JSON.stringify({before:screenBefore,after:(await stored()).actions.find(a=>a.id==='screen'),selected:await primary(),errors}));
  await evaluate(`document.querySelector('#mUndo').click()`);
  // A mixed Shift-selection uses shared fields without converting its layers.
  await click(await point(-12,47));await click(await point(-5,47),true);
  assert.equal(await evaluate(`document.querySelector('#mMapContext').dataset.selectionCount`),'2');
  await change('#mMapContext [data-direct-field="color"]','#559977');
  assert.ok((await stored()).actions.filter(a=>['object','pin'].includes(a.id)).every(a=>a.color==='#559977'));
  assert.equal(await evaluate(`document.querySelectorAll('#mItems .multi-selected').length`),2,'canvas and layer-list selection are synchronized');
  await rightClick(await point(-5,47));await evaluate(`document.querySelector('[data-direct-context-duplicate]').click()`);
  assert.equal((await stored()).actions.length,9,'Duplicate applies to the entire selection');
  assert.deepEqual((await stored()).actions.slice(-2).map(a=>a.type).sort(),['object','pin']);
  await evaluate(`document.querySelector('#mDelete').click()`);assert.equal((await stored()).actions.length,7,'Delete applies to both copies');
  await evaluate(`document.querySelector('#mUndo').click()`);assert.equal((await stored()).actions.length,9,'batch delete is one undo step');
  await evaluate(`document.querySelector('#mUndo').click()`);assert.equal((await stored()).actions.length,7,'batch duplication is one undo step');
  // Shift in the layer list follows the same selection model as Shift on the canvas.
  await evaluate(`document.querySelector('[data-mid="pin"]').click();document.querySelector('[data-mid="effect"]').dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));`);
  assert.equal(await evaluate(`document.querySelector('#mMapContext').dataset.selectionCount`),'2');
  await change('#mMapContext [data-direct-field="color"]','#aa7744');
  assert.ok((await stored()).actions.filter(a=>['pin','effect'].includes(a.id)).every(a=>a.color==='#aa7744'));
  await rightClick(await point(3,47));await evaluate(`document.querySelector('[data-direct-context-visibility]').click()`);
  assert.ok((await stored()).actions.filter(a=>['pin','effect'].includes(a.id)).every(a=>a.visible===false),'Hide applies to all selected layers');
  await evaluate(`document.querySelector('#mUndo').click()`);
  // Preview controls and the camera capture stay fixed under magnification.
  await evaluate(`document.querySelector('[data-mid="label"]').click();document.querySelector('#mapStudio [data-zoom="actual"]').click();for(let i=0;i<5;i++)document.querySelector('#mapStudio [data-zoom="in"]').click();const area=document.querySelector('#mCanvas').closest('.stage-area');area.scrollLeft=area.scrollWidth;area.scrollTop=area.scrollHeight;`);
  assert.ok(await evaluate(`(()=>{const b=document.querySelector('#mMapContext').getBoundingClientRect(),v=document.querySelector('.m-stage-viewport').getBoundingClientRect(),c=document.querySelector('#mCaptureView').getBoundingClientRect();return Math.abs(b.top-v.top-12)<2&&Math.abs(v.bottom-c.bottom-12)<2;})()`));
  await evaluate(`document.querySelector('#mapStudio [data-zoom="fit"]').click()`);
  await writeFile(join(tmpdir(),'frameflow-consistent-editor.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.equal(await evaluate(`document.querySelectorAll('#mMapContext .ff-palette').length`),0,'compact controls do not inherit full sidebar palettes');
  // Opening an existing camera is selection; only Capture or property edits add keys.
  await evaluate(`document.querySelector('[data-mpre="keyframed"]').click()`);
  assert.equal((await stored()).shots.find(s=>s.fullTimelineCamera).cameraKeys.length,0);
  await evaluate(`document.querySelector('[data-mpre="pushIn"]').click();document.querySelector('#mCaptureView').click()`);
  const captured=await stored();
  assert.equal(captured.camera.activeTrack,captured.shots.find(s=>s.fullTimelineCamera).id,'capture activates the permanent camera even alongside presets');
  await evaluate(`document.querySelector('[data-mid="pin"]').click();document.querySelector('[data-mid="effect"]').dispatchEvent(new MouseEvent('click',{shiftKey:true,bubbles:true}));document.activeElement?.blur();document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true}));`);
  assert.equal((await stored()).actions.length,9,'Ctrl+D duplicates a mixed selection with the shared layer action');
  await evaluate(`document.querySelector('#mUndo').click()`);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');E.validateMapProject(JSON.parse(localStorage.getItem('frameflow-map-v1')));})()`);
  // Focus in the old bar must not keep its controls bound to a different layer.
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1'));p.actions.push(...[['region-a','France','#aa5533','First'],['region-b','Germany','#3388aa','Second']].map(([id,name,color,label])=>E.makeAction('highlight',0,{id,target:{kind:'country',name},color,reliefColor:color,label,dur:240})),E.makeAction('border',240,{id:'region-border',target:{kind:'country',name:'France'},dur:120}));localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`!!document.querySelector('[data-mid="region-b"]')&&document.querySelectorAll('#mDlCountry option').length>100`);
  const laneTop=id=>evaluate(`document.querySelector('[data-mrow="${id}"]').style.top`);
  assert.ok([await laneTop('region-a'),await laneTop('region-b')].includes(await laneTop('region-border')),'non-overlapping fill and border can share a lane');
  assert.notEqual(await laneTop('object'),await laneTop('region-border'),'land and objects cannot share a lane even when their times do not overlap');
  await evaluate(`document.querySelector('[data-mclip="region-b"]').scrollIntoView({block:'nearest'});document.querySelector('[data-mid="region-a"]').click();document.querySelector('#mMapContext [data-direct-land="label"]').focus();`);
  const clip=await evaluate(`(()=>{const r=document.querySelector('[data-mclip="region-b"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await click(clip);
  assert.equal(await primary(),'region-b');
  assert.equal(await evaluate(`document.querySelector('#mMapContext [data-direct-land="label"]').value`),'Second','timeline selection replaces focused controls from the old layer');
  assert.equal(await evaluate(`document.querySelector('#mMapContext [data-direct-land="color"]').value`),'#3388aa');
  await change('#mMapContext [data-direct-land="label"]','Edited second');
  const regions=(await stored()).actions.filter(a=>['region-a','region-b'].includes(a.id));
  assert.deepEqual(regions.map(a=>a.label),['First','Edited second'],'the new controls edit only the selected layer');
  await evaluate(`document.querySelector('#mMapContext [data-direct-land="label"]').focus();document.querySelector('[data-mid="pin"]').click();`);
  assert.ok(await evaluate(`!!document.querySelector('#mMapContext [data-direct-field="__pinDisplay"]')&&!document.querySelector('#mMapContext [data-direct-land]')`),'layer-list selection changes the control type while the old field is focused');
  await evaluate(`document.querySelector('#mapStudio [data-zoom="fit"]').click();for(let i=0;i<4;i++)document.querySelector('#mapStudio [data-zoom="out"]').click();`);
  const empty=await evaluate(`(()=>{const r=document.querySelector('.m-stage-viewport .stage-area').getBoundingClientRect();return{x:r.left+8,y:r.top+80};})()`);
  assert.ok(await evaluate(`document.elementFromPoint(${empty.x},${empty.y}).matches('.stage-area,.canvas-wrap')`),'dismissal is tested on empty workspace outside the map');
  await click(empty);
  assert.equal(await primary(),undefined,'empty workspace clears selection');
  assert.ok(await evaluate(`document.querySelector('#mMapContext').hidden&&document.querySelector('#mMapContext').childElementCount===0`),'empty workspace dismisses and clears the bar');
  assert.deepEqual(errors,[]);
  console.log('Editor consistency: spatial layer selection, dragging, shared controls and context actions, mixed Shift-selection, batch actions, undo and pinned overlays passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
