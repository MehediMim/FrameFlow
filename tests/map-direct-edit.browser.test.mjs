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
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=E.newMapProject();p.frames=300;p.camera.init={lon:2,lat:46,zoom:4,bearing:0,pitch:0};p.actions=[E.makeAction('object',0,{id:'one',glyph:'tank',dur:240,place:{kind:'point',name:'One',lon:0,lat:46}}),E.makeAction('object',0,{id:'two',glyph:'tank',dur:240,place:{kind:'point',name:'Two',lon:5,lat:46}})];localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===3&&document.querySelectorAll('#mDlCountry option').length>100`);
  const cameraVisible=()=>evaluate(`(()=>{const b=document.querySelector('#mCaptureView'),r=b.getBoundingClientRect(),v=document.querySelector('.m-stage-viewport').getBoundingClientRect();return Math.abs(r.left-v.left-12)<2&&Math.abs(v.bottom-r.bottom-12)<2&&b.contains(document.elementFromPoint(r.left+r.width/2,r.top+r.height/2));})()`);
  assert.ok(await cameraVisible(),'camera is visible at the viewport corner');
  await evaluate(`(()=>{document.querySelector('#mapStudio [data-zoom="actual"]').click();for(let i=0;i<8;i++)document.querySelector('#mapStudio [data-zoom="in"]').click();const area=document.querySelector('#mCanvas').closest('.stage-area');area.scrollLeft=area.scrollWidth;area.scrollTop=area.scrollHeight;})()`);
  assert.ok(await cameraVisible(),'camera stays pinned after zooming in and scrolling to the far corner');
  await evaluate(`for(let i=0;i<12;i++)document.querySelector('#mapStudio [data-zoom="out"]').click();`);
  assert.ok(await cameraVisible(),'camera stays pinned after zooming out');
  await evaluate(`document.querySelector('#mapStudio [data-zoom="fit"]').click()`);
  const checkPinnedBar=async()=>{
    const pinned=()=>evaluate(`(()=>{const bar=document.querySelector('#mMapContext'),r=bar.getBoundingClientRect(),v=document.querySelector('.m-stage-viewport').getBoundingClientRect(),control=bar.querySelector('summary,select:not([hidden]),input:not([hidden]):not([type=hidden])'),c=control.getBoundingClientRect();return !bar.hidden&&Math.abs(r.top-v.top-12)<2&&Math.abs((r.left+r.right-v.left-v.right)/2)<2&&bar.contains(document.elementFromPoint(c.left+c.width/2,c.top+c.height/2));})()`);
    assert.ok(await pinned(),'canvas controls are visible at the viewport top');
    await evaluate(`(()=>{document.querySelector('#mapStudio [data-zoom="actual"]').click();for(let i=0;i<8;i++)document.querySelector('#mapStudio [data-zoom="in"]').click();const area=document.querySelector('#mCanvas').closest('.stage-area');area.scrollLeft=area.scrollWidth;area.scrollTop=area.scrollHeight;})()`);
    assert.ok(await pinned(),'canvas controls stay visible and usable after zooming in and scrolling');
    await evaluate(`for(let i=0;i<12;i++)document.querySelector('#mapStudio [data-zoom="out"]').click();`);
    assert.ok(await pinned(),'canvas controls stay visible after zooming out');
    await evaluate(`document.querySelector('#mapStudio [data-zoom="fit"]').click()`);
  };
  const point=(lon,lat,dx=0,dy=0)=>evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),...i},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),b=document.querySelector('#mCanvas').getBoundingClientRect();return{x:b.left+(q.x+${dx}*v.unit)/p.width*b.width,y:b.top+(q.y+${dy}*v.unit)/p.height*b.height};})()`);
  const mouse=(type,p,shift=false)=>cdp('Input.dispatchMouseEvent',{type,...p,button:'left',buttons:type==='mouseReleased'?0:1,clickCount:1,modifiers:shift?8:0});
  const click=async(lon,lat,shift=false)=>{const p=await point(lon,lat);await mouse('mousePressed',p,shift);await mouse('mouseReleased',p,shift);};
  const drag=async(from,to)=>{await mouse('mousePressed',from);await mouse('mouseMoved',to);await mouse('mouseReleased',to);};
  const rightClick=async p=>{await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...p,button:'right',buttons:2,clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...p,button:'right',buttons:0,clickCount:1});};
  await click(0,46);
  assert.ok(await evaluate(`!document.querySelector('#mMapContext').hidden&&!!document.querySelector('#mMapContext [data-direct-field="color"]')`),'object options appear over the canvas');
  assert.equal(await evaluate(`document.querySelectorAll('#mMapContext [data-direct-field="__pinMove"],#mMapContext [data-direct-field="__groupMove"],#mMapContext input[type="range"]').length`),0,'canvas panel has no movement control or size slider');
  await checkPinnedBar();
  const sizeOffset=52*1.2/Math.SQRT2;
  const beforeSize=(await stored()).actions[0];
  await drag(await point(0,46,-sizeOffset,sizeOffset),await point(0,46,-sizeOffset*2,sizeOffset*2));
  assert.ok(Math.abs((await stored()).actions[0].size-2.4)<.02,'canvas size anchor resizes the object');
  assert.deepEqual((await stored()).actions[0].place,beforeSize.place,'resizing keeps the position anchored');
  await evaluate(`document.querySelector('#mUndo').click()`);assert.ok(Math.abs((await stored()).actions[0].size-1.2)<.01);
  await evaluate(`document.querySelector('#mRedo').click()`);assert.ok(Math.abs((await stored()).actions[0].size-2.4)<.02);
  await evaluate(`document.querySelector('#mUndo').click()`);
  await change('#mMapContext [data-direct-field="color"]','#807040');assert.equal((await stored()).actions[0].color,'#807040');
  await change('#mMapContext [data-direct-field="sizeMode"]','map');assert.equal(await evaluate(`document.querySelector('#mMapContext [data-direct-field="sizeZoom"]')`),null,'anchor zoom is absent from the canvas bar');
  await change('#mMapContext [data-direct-field="sizeMode"]','screen');
  const beforeDuplicate=(await stored()).actions[0];
  assert.equal(await evaluate(`document.querySelectorAll('#mMapContext .m-map-context-heading,#mMapContext [data-direct-duplicate],#mMapContext [data-direct-clear]').length`),0,'canvas controls have no heading, Duplicate, or close button');
  await rightClick(await point(0,46));await waitFor(`!document.querySelector('#mMapAddContext').hidden`);
  await evaluate(`document.querySelector('[data-direct-context-duplicate]').click()`);
  const duplicated=(await stored()).actions.at(-1);
  assert.equal((await stored()).actions.length,3,'right-click Duplicate creates an object copy');
  assert.equal(duplicated.glyph,beforeDuplicate.glyph);assert.deepEqual(duplicated.place,beforeDuplicate.place);assert.equal(duplicated.start,beforeDuplicate.start,'duplicate starts at the same timeline position');assert.equal(duplicated.dur,beforeDuplicate.dur);
  assert.equal(await evaluate(`document.querySelector('#mTrackRows [data-mrow]').dataset.mrow`),duplicated.id);
  await evaluate(`document.querySelector('#mUndo').click()`);assert.equal((await stored()).actions.length,2);await click(0,46);


  assert.ok(await evaluate(`!!document.querySelector('[data-mf="__pinMove"]')`),'clicking a map object opens its common options');
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf]').dataset.mf`),'__pinMove','Movement is first in the right properties');
  await waitFor(`[...document.querySelectorAll('#mInspector .ff-inspector-section')].every(section=>section.open)`);
  assert.equal(await evaluate(`document.querySelectorAll('#mInspector details:not([open]):not([data-object-menu])').length`),0,'right properties are revealed');

  await writeFile(join(tmpdir(),'frameflow-direct-object-controls.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await drag(await point(0,46),await point(1,47));
  let a=(await stored()).actions[0];assert.ok(Math.abs(a.place.lon-1)<.01&&Math.abs(a.place.lat-47)<.01,'dragging edits the starting anchor');
  await drag(await point(1,47,72,0),await point(1,47,0,72));
  assert.ok(Math.abs((await stored()).actions[0].objectAngle-90)<1,'direction handle rotates the object');
  await evaluate(`document.querySelector('#mUndo').click()`);assert.ok(Math.abs((await stored()).actions[0].objectAngle||0)<1);await evaluate(`document.querySelector('#mRedo').click()`);
  await change('[data-mf="__pinMove"]','move');
  assert.deepEqual((await stored()).actions[0].place,a.place,'switching to move keeps the start');
  await change('[data-mf="to"]','45, 4');const destination=(await stored()).actions[0].to;
  await drag(await point(1,47),await point(2,47));
  assert.deepEqual((await stored()).actions[0].to,destination,'dragging the starting point preserves the destination');
  await change('[data-mf="__pinMove"]','stay');
  await click(5,46,true);
  assert.equal(await evaluate(`document.querySelector('#mMapContext [data-direct-group]')`),null,'grouping is absent from the canvas bar');
  assert.equal(await evaluate(`document.querySelector('#mInspector .m-arrange')`),null,'arrangement checklist is removed');
  assert.equal(await evaluate(`document.querySelectorAll('#mAddGrid [data-madd="plane"],#mAddGrid [data-madd="label"]').length`),0,'Travel and Label share the Object and Pin tools');
  const beforeBatch=await stored();
  await change('#mMapContext [data-direct-field="color"]','#5599aa');
  assert.ok((await stored()).actions.every(a=>a.color==='#5599aa'),'canvas color applies to every selected object');
  assert.equal((await stored()).actions.filter(a=>a.type==='group').length,0,'batch edits do not create a group');
  await evaluate(`document.querySelector('#mUndo').click()`);
  assert.deepEqual((await stored()).actions,beforeBatch.actions,'one undo restores the batch');
  await change('#mMapContext [data-direct-field="sizeMode"]','map');
  assert.ok((await stored()).actions.every(a=>a.sizeMode==='map'),'canvas sizing mode applies to all selected objects');
  await change('#mMapContext [data-direct-field="sizeMode"]','screen');
  await evaluate(`document.querySelector('#mMapContext [data-direct-object-choice="bicycle"]').click()`);
  assert.ok((await stored()).actions.every(a=>a.glyph==='bicycle'),'object choice applies to the selection');
  await evaluate(`document.querySelector('#mUndo').click()`);
  const beforeBatchSize=await stored(),batchOffset=52*1.2/Math.SQRT2;
  await drag(await point(5,46,-batchOffset,batchOffset),await point(5,46,-batchOffset*1.5,batchOffset*1.5));
  assert.ok((await stored()).actions.every((a,i)=>Math.abs(a.size-beforeBatchSize.actions[i].size*1.5)<.03),'size handle changes every selected object');
  await evaluate(`document.querySelector('#mUndo').click()`);
  await rightClick(await point(5,46));
  assert.equal(await evaluate(`document.querySelector('#mMapAddContext [data-direct-group]').disabled`),false,'Group selected is in the right-click menu');
  await evaluate(`document.querySelector('[data-direct-group]').click()`);
  let p=await stored(),g=p.actions.find(a=>a.type==='group');assert.equal(g.memberIds.length,2);
  const groupOffset=52/Math.SQRT2;
  await drag(await point(g.transform.lon,g.transform.lat,-groupOffset,groupOffset),await point(g.transform.lon,g.transform.lat,-groupOffset*1.5,groupOffset*1.5));
  assert.ok(Math.abs((await stored()).actions.find(a=>a.type==='group').transform.scale-1.5)<.02,'canvas size anchor resizes the group');
  await evaluate(`document.querySelector('#mUndo').click()`);

  await change('[data-mf="__groupColor"]','#408050');p=await stored();assert.ok(p.actions.filter(a=>a.type==='object').every(a=>a.color==='#408050'));
  await change('[data-mf="__groupSizeMode"]','map');assert.ok((await stored()).actions.filter(a=>a.type==='object').every(a=>a.sizeMode==='map'));
  await change('[data-mf="__groupSizeMode"]','screen');
  await drag(await point(2,47),await point(3,47));
  p=await stored();g=p.actions.find(a=>a.type==='group');assert.ok(Math.abs(g.transform.lon-g.origin.lon-1)<.02,'dragging a member moves its group');
  await drag(await point(g.transform.lon,g.transform.lat,72,0),await point(g.transform.lon,g.transform.lat,0,-72));
  g=(await stored()).actions.find(a=>a.type==='group');assert.ok(Math.abs(g.transform.rotation+90)<1,'group direction handle rotates its members');
  await change('[data-mf="__groupMove"]','move');await change('[data-mf="__groupDestination"]','44, 7');g=(await stored()).actions.find(a=>a.type==='group');assert.ok(g.groupKeys.some(k=>Math.abs(k.values.lon-7)<.0001&&Math.abs(k.values.lat-44)<.0001),'group uses a destination without reentering its start');
  await click(-3,48);assert.ok(await evaluate(`document.querySelector('#mMapContext').hidden`),'bare land selection has no premature settings bar');
  assert.equal(await evaluate(`document.querySelectorAll('#mMapContext [data-direct-highlight],#mMapContext [data-direct-border]').length`),0,'region actions moved to right-click');
  await rightClick(await point(-3,48));
  assert.ok(await evaluate(`!!document.querySelector('#mMapAddContext [data-direct-label]')`),'selected land context menu includes Label');
  assert.equal(await evaluate(`document.querySelector('#mMapAddContext > [data-direct-add-object]')`),null,'Add object is nested alongside region actions');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  await click(-4,40,true);assert.equal(await evaluate(`document.querySelector('#mMapContext').dataset.selectionCount`),'2','Shift-click selects multiple countries');
  assert.ok(await evaluate(`document.querySelector('#mMapContext').hidden`),'multiple bare regions also have no settings bar');
  await rightClick(await point(-4,40));
  await evaluate(`document.querySelector('[data-direct-add]').click();document.querySelector('#mMapAddContext [data-direct-label]').click()`);
  const regionLabel=(await stored()).actions.at(-1);
  assert.equal(regionLabel.type,'highlight');assert.equal(regionLabel.showFill,false);assert.equal(regionLabel.showLabel,true);assert.equal(regionLabel.regionLabels,true);assert.equal(regionLabel.target.members.length,2);
  await checkPinnedBar();
  await change('#mMapContext [data-direct-land="showFill"]',true);
  assert.equal((await stored()).actions.at(-1).showFill,true,'top fill control enables highlight on the same label layer');
  await change('#mMapContext [data-direct-land="color"]','#6688aa');
  assert.equal((await stored()).actions.at(-1).color,'#6688aa','top region color edits the selected layer');
  await evaluate(`document.querySelector('#mUndo').click();document.querySelector('#mUndo').click();document.querySelector('#mUndo').click()`);
  await click(-3,48);await click(-4,40,true);
  await rightClick(await point(-4,40));
  await evaluate(`document.querySelector('[data-direct-add]').click();document.querySelector('#mMapAddContext [data-direct-highlight]').click()`);
  const highlight=(await stored()).actions.at(-1);assert.equal(highlight.type,'highlight');assert.equal(highlight.target.members.length,2);assert.equal(highlight.dim,0);assert.equal(highlight.pulse,false);
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf]').dataset.mf`),'__hmode','land properties put region controls before keyframe settings');
  assert.equal(await evaluate(`document.querySelector('#mTrackRows [data-mrow]').dataset.mrow`),highlight.id,'newest timeline item is at the top');
  await evaluate(`document.querySelector('[data-mpre="flyTo"]').click()`);const shot=(await stored()).shots.at(-1);
  assert.equal((await stored()).shots.length,1,'presets add keys to the existing camera track');
  assert.equal(shot.cameraKeys.filter(k=>k.pairId).length,2,'preset creates paired endpoints');

  const rightPoint=await point(-6,44);
  await rightClick(rightPoint);await waitFor(`!document.querySelector('#mMapAddContext').hidden`);
  await evaluate(`document.querySelector('[data-direct-add]').click();document.querySelector('[data-direct-add-object]').click()`);
  const placed=(await stored()).actions.at(-1);
  assert.equal(placed.type,'object');assert.equal(placed.enter,'none');
  assert.ok(Math.abs(placed.place.lon+6)<.01&&Math.abs(placed.place.lat-44)<.01,'right-click adds the object at that position: '+JSON.stringify(placed.place)+' frame='+await evaluate(`document.querySelector('#mFrame').value`));
  assert.equal(await evaluate(`document.querySelector('#mCanvas').style.cursor`),'','right-click placement does not ask for another position');
  assert.equal(await evaluate(`document.querySelector('#mTrackRows [data-mrow]').dataset.mrow`),placed.id);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...rightPoint,button:'right',buttons:2,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:rightPoint.x+30,y:rightPoint.y+15,button:'right',buttons:2});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:rightPoint.x+30,y:rightPoint.y+15,button:'right',buttons:0,clickCount:1});
  assert.equal(await evaluate(`document.querySelector('#mMapAddContext').hidden`),true,'right-drag pans without opening the add menu');
  await click(-15,44);assert.equal(await evaluate(`document.querySelector('#mMapContext').hidden`),true,'clicking empty map space dismisses the bar without a close button');
  const saved=await evaluate(`(async()=>{const E=await import('./map-engine.mjs');return E.validateMapProject(JSON.parse(localStorage.getItem('frameflow-map-v1')));})()`);await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===6`);assert.deepEqual(await stored(),saved);
  assert.equal(await evaluate(`document.querySelector('#mTrackRows [data-mrow]').dataset.mrow`),placed.id,'timeline order survives reload');
  assert.equal((await stored()).actions.find(a=>a.type==='group').memberIds.length,2,'group membership survives reload');
  const memberPosition=await evaluate(`(async()=>{const G=await import('./map-object-groups.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),g=p.actions.find(a=>a.type==='group');return G.transformGroupObject(p.actions.find(a=>a.id===g.memberIds[0]),g,0).place;})()`);
  await click(memberPosition.lon,memberPosition.lat);
  assert.ok(await evaluate(`!!document.querySelector('#mMapContext [data-direct-field="__groupColor"]')`),'clicking a member reselects its persistent group');
  await rightClick(await point(memberPosition.lon,memberPosition.lat));
  assert.ok(await evaluate(`!!document.querySelector('[data-direct-ungroup]')`),'right-click group offers explicit Ungroup');
  await evaluate(`document.querySelector('[data-direct-ungroup]').click()`);
  assert.equal((await stored()).actions.filter(a=>a.type==='group').length,0,'only explicit Ungroup dissolves the group');
  await evaluate(`document.querySelector('#mUndo').click()`);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');E.validateMapProject(JSON.parse(localStorage.getItem('frameflow-map-v1')));})()`);
  // Context additions use the clicked coordinate, including labels.
  await evaluate(`document.querySelector('#mResetView').click();document.querySelector('#mStart').click()`);
  for (const type of ['pin']) {
    await rightClick(await point(-10,44));
    await evaluate(`document.querySelector('[data-direct-add]').click();document.querySelector('[data-direct-add-${type}]').click()`);
    const item=(await stored()).actions.at(-1);
    assert.equal(item.type,type);
    assert.ok(Math.abs(item.place.lon+10)<.01&&Math.abs(item.place.lat-44)<.01,`${type} uses right-click position`);
  }
  assert.equal(await evaluate(`document.querySelector('[data-direct-add-label]')`),null,'right-click has one merged Pin / label entry');
  const pinBefore=(await stored()).actions.at(-1);
  await change('#mInspector [data-mf="label"]','Merged map text');
  await change('#mInspector [data-mf="__pinDisplay"]','text');
  assert.equal((await stored()).actions.at(-1).showIcon,false);
  assert.equal((await stored()).actions.at(-1).label,'Merged map text');
  await change('#mInspector [data-mf="labelPlacement"]','screen');
  await change('#mInspector [data-mf="x"]',35);
  assert.equal((await stored()).actions.at(-1).x,35,'merged labels support canvas positioning');
  await change('#mInspector [data-mf="__pinDisplay"]','both');
  assert.deepEqual((await stored()).actions.at(-1).place,pinBefore.place,'switching pin/text preserves the map anchor');
  assert.equal((await stored()).actions.at(-1).showIcon,true);
  await evaluate(`document.querySelector('[data-mid="${shot.id}"]').click();document.querySelector('[data-camera-delete]').click()`);
  await change('#mFrame',2);
  const panPoint=await point(-10,44);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...panPoint,button:'right',buttons:2,clickCount:1});
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:panPoint.x+50,y:panPoint.y+20,button:'right',buttons:2});
  await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:panPoint.x+50,y:panPoint.y+20,button:'right',buttons:0,clickCount:1});
  await evaluate(`document.querySelector('#mCaptureView').click()`);
  let camera=(await stored()).shots.find(s=>s.fullTimelineCamera);
  assert.equal(camera.start,0);assert.equal(camera.dur,(await stored()).frames);
  assert.deepEqual(camera.cameraKeys.map(k=>k.frame),[0,60]);
  assert.ok(Math.abs(camera.cameraKeys[1].values.lon-2)>.01,'capture saves panned view');
  assert.equal(await evaluate(`document.querySelector('#mResetView').hidden`),true);
  assert.equal(await evaluate(`document.querySelector('#mSplit').disabled&&document.querySelector('#mDelete').disabled&&document.querySelector('#mDuplicate').disabled`),true);
  assert.equal(await evaluate(`document.querySelectorAll('[data-mclip="${camera.id}"] [data-h]').length`),0,'permanent camera has no trim handles');
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf="preset"]').disabled`),true);
  await change('#mDuration',20);assert.equal((await stored()).shots.find(s=>s.fullTimelineCamera).dur,600);
  await change('#mDuration',1);
  camera=(await stored()).shots.find(s=>s.fullTimelineCamera);
  assert.equal(camera.dur,30);assert.ok(camera.cameraKeys.every(k=>k.frame<30));
  const final=await stored();await evaluate('location.reload()');
  await waitFor(`document.querySelector('[data-mclip="${camera.id}"]')`);
  assert.deepEqual(await stored(),final,'permanent camera and keys persist');
  assert.deepEqual(errors,[]);
  console.log('Direct map editing: object selection, anchor drag, rotation handles, movement destination, Shift selection, groups, sizing, country actions, undo and persistence passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
