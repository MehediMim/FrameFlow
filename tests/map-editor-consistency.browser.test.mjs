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
  const trimBefore=(await stored()).actions.find(a=>a.id==='region-b');
  assert.ok(trimBefore.animDur<trimBefore.dur,'new layers leave a hold after their animation');
  const trimPoint=await evaluate(`(()=>{const r=document.querySelector('[data-mclip="region-b"] [data-h=r]').getBoundingClientRect();return{x:r.right-2,y:r.y+r.height/2};})()`);
  await drag(trimPoint,{x:trimPoint.x+30,y:trimPoint.y});
  const trimAfter=(await stored()).actions.find(a=>a.id==='region-b');
  assert.ok(trimAfter.dur>trimBefore.dur,'the bar edge can be extended directly');
  assert.equal(trimAfter.animDur,trimBefore.animDur,'trimming the bar does not move the animation diamond');
  await evaluate(`document.querySelector('#mMapContext [data-direct-land="label"]').focus();document.querySelector('[data-mid="pin"]').click();`);
  assert.ok(await evaluate(`!!document.querySelector('#mMapContext [data-direct-field="__pinDisplay"]')&&!document.querySelector('#mMapContext [data-direct-land]')`),'layer-list selection changes the control type while the old field is focused');
  await evaluate(`document.querySelector('#mapStudio [data-zoom="fit"]').click();for(let i=0;i<4;i++)document.querySelector('#mapStudio [data-zoom="out"]').click();`);
  const empty=await evaluate(`(()=>{const r=document.querySelector('.m-stage-viewport .stage-area').getBoundingClientRect();return{x:r.left+8,y:r.top+80};})()`);
  assert.ok(await evaluate(`document.elementFromPoint(${empty.x},${empty.y}).matches('.stage-area,.canvas-wrap')`),'dismissal is tested on empty workspace outside the map');
  await click(empty);
  assert.equal(await primary(),undefined,'empty workspace clears selection');
  assert.ok(await evaluate(`document.querySelector('#mMapContext').hidden&&document.querySelector('#mMapContext').childElementCount===0`),'empty workspace dismisses and clears the bar');
  await evaluate(`document.querySelector('[data-mid="object"]').click();document.querySelector('#mMapContext summary').click()`);
  await waitFor(`!!document.querySelector('body > .m-object-cascade:not([hidden])')`);
  const categoryPoint=await evaluate(`(()=>{const r=document.querySelector('body > .m-object-cascade [data-object-category="company"]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...categoryPoint,button:'none',buttons:0});
  await waitFor(`!document.querySelector('body > .m-object-cascade [data-object-category-panel="company"]').hidden`);
  assert.equal(await evaluate(`document.querySelectorAll('body > .m-object-cascade [data-object-category-panel]:not([hidden])').length`),1,'hover shows only the category beside its name');
  await waitFor(`[...document.querySelectorAll('body > .m-object-cascade [data-object-category-panel="company"] img')].every(img=>img.complete&&img.naturalWidth>0)`);
  await writeFile(join(tmpdir(),'frameflow-nested-object-picker.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const chosen=await evaluate(`(()=>{const el=document.querySelector('body > .m-object-cascade [data-object-category-panel="company"] [data-direct-object-choice]'),r=el.getBoundingClientRect();return{id:el.dataset.directObjectChoice,x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await click({x:chosen.x,y:chosen.y});
  assert.equal((await stored()).actions.find(a=>a.id==='object').glyph,chosen.id,'nested canvas picker changes the selected object');
  await waitFor(`!document.querySelector('body > .m-object-cascade')`);
  await evaluate(`document.querySelector('#mInspector [data-object-menu] summary').click()`);
  await waitFor(`!!document.querySelector('body > .m-object-cascade:not([hidden])')`);
  await evaluate(`document.querySelector('body > .m-object-cascade [data-object-category="transport"]').focus();document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));`);
  assert.ok(await evaluate(`!!document.activeElement.closest('[data-object-category-panel="transport"]')`),'keyboard navigation enters the adjacent object list');
  await evaluate(`document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));`);
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-object-menu]').open`),false,'Escape closes the nested menu');
  const timelineBeforeArrange=(await stored()).actions.map(a=>[a.id,a.start,a.dur,a.createdOrder]);
  await rightClick(await point(-12,47));
  assert.ok(await evaluate(`['forward','backward','front','back'].every(key=>document.querySelector('[data-direct-arrange-'+key+']'))`),'right-click offers all four arrangement commands');
  assert.ok(await evaluate(`document.querySelector('[data-direct-arrange-menu]').hidden`),'stacking commands start inside a closed Arrange submenu');
  const arrangePoint=await evaluate(`(()=>{const r=document.querySelector('[data-direct-arrange]').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...arrangePoint,button:'none',buttons:0});
  await waitFor(`!document.querySelector('[data-direct-arrange-menu]').hidden`);
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));`);
  assert.ok(await evaluate(`document.querySelector('[data-direct-arrange-menu]').hidden`),'Left closes the Arrange submenu');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));`);
  assert.ok(await evaluate(`!!document.activeElement.closest('[data-direct-arrange-menu]')`),'Right enters the Arrange submenu');
  await evaluate(`document.querySelector('[data-direct-arrange-front]').click()`);
  assert.equal(await evaluate(`(async()=>{const {mapStackOrder}=await import('./map-layer-actions.mjs');return mapStackOrder(JSON.parse(localStorage.getItem('frameflow-map-v1')).actions).filter(a=>['object','pin','shape','effect','plane'].includes(a.type)).at(-1).id;})()`),'object','Bring to front updates map stacking');
  assert.deepEqual((await stored()).actions.map(a=>[a.id,a.start,a.dur,a.createdOrder]),timelineBeforeArrange,'arrangement leaves timeline ordering and timing intact');
  await rightClick(await point(-12,47));await evaluate(`document.querySelector('[data-direct-arrange]').click();document.querySelector('[data-direct-arrange-back]').click()`);
  assert.equal(await evaluate(`(async()=>{const {mapStackOrder}=await import('./map-layer-actions.mjs');return mapStackOrder(JSON.parse(localStorage.getItem('frameflow-map-v1')).actions).filter(a=>['object','pin','shape','effect','plane'].includes(a.type))[0].id;})()`),'object','Send to back updates map stacking');
  await evaluate(`document.querySelector('#mUndo').click();document.querySelector('#mUndo').click()`);
  await rightClick(await point(-12,47));
  assert.ok(await evaluate(`document.querySelector('[data-direct-add-menu]').hidden&&!document.querySelector('#mMapAddContext > [data-direct-add-object]')`),'creation commands are nested inside Add');
  await evaluate(`document.querySelector('[data-direct-add]').click()`);
  assert.ok(await evaluate(`!document.querySelector('[data-direct-add-menu]').hidden&&['object','pin','shape','effect','scene','audio'].every(key=>document.querySelector('[data-direct-add-'+key+']')?.closest('[data-direct-add-menu]'))`),'Add includes tools that do not require a region selection');
  assert.equal(await evaluate(`document.querySelectorAll('#mMapAddContext [data-direct-add-highlight],#mMapAddContext [data-direct-add-border],#mMapAddContext [data-direct-highlight],#mMapAddContext [data-direct-border]').length`),0,'Add omits Border and Highlight without a selected region');
  await evaluate(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}));document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}));`);
  assert.ok(await evaluate(`!!document.activeElement.closest('[data-direct-add-menu]')`),'Add supports keyboard submenu navigation');
  await evaluate(`document.querySelector('input[type=file][accept^="audio/"]').addEventListener('click',e=>{window.__contextAudioRequested=true;e.preventDefault();},{once:true});document.querySelector('[data-direct-add-audio]').click()`);
  assert.equal(await evaluate(`window.__contextAudioRequested`),true,'nested Audio opens the existing file chooser');
  await rightClick(await point(-12,47));await evaluate(`document.querySelector('[data-direct-add]').click();document.querySelector('[data-direct-add-scene]').click()`);
  assert.equal((await stored()).actions.at(-1).type,'scene','nested Scene panel creates its layer');
  await evaluate(`document.querySelector('#mUndo').click();document.querySelector('[data-mid="object"]').click()`);
  const compositing=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs?v=map-order-1'),{arrangeLayers}=await import('./map-layer-actions.mjs');
    const geo=E.buildGeo(await fetch('map-data/countries-110m.json').then(r=>r.json())),p=E.newMapProject(),canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d');
    p.camera.init={lon:0,lat:44,zoom:4,pitch:0,bearing:0};p.atlasLabels={countries:false,oceans:false};p.graticule=false;
    E.OBJECT_ICONS.__stackProbe={label:'Stack probe',draw:(c,s,color)=>{c.fillStyle=color;c.fillRect(-70,-70,140,140);}};
    const object=E.makeAction('object',0,{id:'red',glyph:'__stackProbe',place:{kind:'point',name:'Anchor',lon:0,lat:44},color:'#ff0000',dur:120}),label=E.makeAction('label',0,{text:'MMMM',x:50,y:50,labelPlacement:'screen',dur:120,labelStyle:{shape:'none',size:40,text:'#ffffff',useTheme:false,halo:false,shadow:false}});
    const sample=actions=>{c.clearRect(0,0,320,180);E.drawMap(c,320,180,{...p,actions},60,geo);return [...c.getImageData(145,82,30,16).data];};
    try{const plain=sample([object]),labeled=sample([object,label]),text=sample([label]),base=sample([]);p.actions=[object,{...object,id:'blue',color:'#0000ff'}];const blue=sample(p.actions);arrangeLayers(p,['red'],'front');const red=sample(p.actions);return{behind:plain.every((v,i)=>v===labeled[i]),textVisible:text.some((v,i)=>v!==base[i]),changesStack:blue.some((v,i)=>v!==red[i])};}finally{delete E.OBJECT_ICONS.__stackProbe;}
  })()`);
  assert.deepEqual(compositing,{behind:true,textVisible:true,changesStack:true},'rendered pixels put labels behind objects and obey map arrangement');
  const pathMotion=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs?v=path-flow-1'),geo=E.buildGeo(await fetch('map-data/countries-110m.json').then(r=>r.json())),p=E.newMapProject(),canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const c=canvas.getContext('2d');
    p.camera.init={lon:0,lat:44,zoom:4,pitch:0,bearing:0};p.atlasLabels={countries:false,oceans:false};p.graticule=false;
    const path=[{lon:-4,lat:42},{lon:4,lat:42},{lon:4,lat:46},{lon:-4,lat:46}];
    const render=(a,frame)=>{c.clearRect(0,0,640,360);E.drawMap(c,640,360,{...p,actions:[a]},frame,geo);return canvas.toDataURL();};
    const results={};for(const shape of ['arrow','retreat','front','zone','noFly','road','railway','river']){
      const a=E.makeAction('shape',0,{shape,path,dur:300,animDur:30,width:8});
      results[shape]=render(a,60)!==render(a,75)&&render({...a,networkAnimation:'static'},60)===render({...a,networkAnimation:'static'},75)&&render({...a,flowSpeed:0},60)===render({...a,flowSpeed:0},75);
    }
    for(const shape of ['distance','area']){const a=E.makeAction('shape',0,{shape,path,dur:300,animDur:30,showDistanceArrow:true,showAreaBoundary:true});results[shape]=render(a,60)===render(a,75);}
    return results;
  })()`);
  assert.ok(Object.values(pathMotion).every(Boolean),'arrows, fronts, zones and networks keep flowing after reveal; static mode, zero speed and measurements stay still: '+JSON.stringify(pathMotion));
  await waitFor(`!!document.querySelector('#mInspector [data-mf="__lscustom"]')?.closest('.ff-inspector-section')`);
  assert.ok(await evaluate(`document.querySelector('#mInspector [data-mf="showLabel"]').closest('.ff-inspector-section')===document.querySelector('#mInspector [data-mf="__lscustom"]').closest('.ff-inspector-section')`),'label visibility and label style share one section');
  assert.equal(await evaluate(`[...document.querySelectorAll('#mInspector .ff-inspector-summary-label')].filter(el=>el.textContent==='LABEL').length`),1,'only one Label section is shown');
  assert.ok(await evaluate(`(()=>{const input=document.querySelector('#mInspector [data-mf="color"]'),row=input.closest('label'),palette=row.querySelector('.ff-palette'),content=row.closest('.ff-inspector-content'),r=row.getBoundingClientRect(),p=palette.getBoundingClientRect(),c=content.getBoundingClientRect(),chips=[...palette.children].map(el=>el.getBoundingClientRect());return r.width>c.width*.8&&p.width>c.width*.7&&chips.slice(0,8).every(el=>Math.abs(el.top-chips[0].top)<1)&&chips.every(el=>el.right<=c.right);})()`),'color swatches use the available inspector width without overflow');
  assert.ok(await evaluate(`(()=>{const el=document.querySelector('#mInspector [data-mf="__lscustom"]').closest('label'),c=el.closest('.ff-inspector-content');return el.getBoundingClientRect().width>c.getBoundingClientRect().width*.8;})()`),'label checkboxes occupy a full row');
  await evaluate(`document.querySelector('#mInspector [data-mf="__lscustom"]').scrollIntoView({block:'nearest'})`);
  await writeFile(join(tmpdir(),'frameflow-inspector-label-layout.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`document.querySelector('#mItems [data-mid="object"]').click()`);
  await waitFor(`!!document.querySelector('#mInspector [data-mf="enter"]')?.closest('[data-priority="advanced"]')`);
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf="enter"]').closest('details').open`),false,'animation options start in a collapsed Advanced section');
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf="damageState"]').closest('details').open`),true,'frequent appearance controls remain visible');
  assert.ok(await evaluate(`(()=>{const groups=[...document.querySelectorAll('#mInspector > .ff-inspector-section')];const firstAdvanced=groups.findIndex(el=>el.dataset.priority==='advanced');return firstAdvanced>0&&groups.slice(firstAdvanced).every(el=>el.dataset.priority==='advanced');})()`),'advanced sections follow essential controls');
  await evaluate(`document.querySelector('#mInspector [data-mf="enter"]').closest('details').querySelector('summary').click()`);
  await change('#mInspector [data-mf="objectAngle"]',12);
  await waitFor(`document.querySelector('#mInspector [data-mf="objectAngle"]').value==='12'`);
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf="enter"]').closest('details').open`),true,'expanded preferences survive property edits');
  await evaluate(`document.querySelector('#mInspector [data-mf="enter"]').closest('details').querySelector('summary').click()`);
  await change('#mInspector [data-mf="objectAngle"]',24);
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf="enter"]').closest('details').open`),false,'collapsed preferences survive property edits');
  await evaluate(`document.querySelector('.ff-inspector-group-heading button').click()`);
  assert.ok(await evaluate(`[...document.querySelectorAll('#mInspector [data-priority="advanced"]')].every(el=>el.open)`),'Expand all reveals advanced controls');
  const components=await evaluate(`(()=>{const css=selector=>getComputedStyle(document.querySelector(selector));return {primary:css('#mExport').backgroundColor,secondary:css('#mSave').backgroundColor,icon:css('#mAddGrid b').color,heading:css('.ff-left-summary').color,radius:css('#mExport').borderRadius,selected:css('#mItems .selected').boxShadow};})()`);
  assert.equal(components.primary,'rgb(182, 243, 110)','lime identifies the primary export action');
  assert.notEqual(components.secondary,components.primary,'secondary controls have neutral surfaces');
  assert.notEqual(components.icon,'rgb(182, 243, 110)','unselected tool icons are neutral');
  assert.notEqual(components.heading,'rgb(182, 243, 110)','panel headings are neutral');
  assert.ok(await evaluate(`[...document.querySelectorAll('#mAddGrid b,#mPresets b')].every(el=>el.querySelector('svg.ff-icon'))`),'tools and camera presets share stroke icons');
  assert.equal(components.radius,'6px','controls use the shared radius');
  assert.ok(components.selected.includes('182, 243, 110'),'selected layers have a lime edge');
  const sidebars=await evaluate(`(()=>{
    const compare=(left,right,fields)=>{const a=getComputedStyle(document.querySelector(left)),b=getComputedStyle(document.querySelector(right));return fields.every(field=>a[field]===b[field]);};
    const base='#mapStudio .workspace > ';
    return {
      shells:compare(base+'.left',base+'.right',['width','backgroundColor','paddingTop','paddingRight','paddingBottom','paddingLeft','scrollbarColor']),
      headers:compare(base+'.left > .ff-sidebar-header',base+'.right > .ff-sidebar-header',['height','padding','backgroundColor','borderBottomColor','position']),
      sections:compare('.ff-left-section','.ff-inspector-section',['backgroundColor','borderRadius','borderTopColor','marginBottom']),
      summaries:compare('.ff-left-summary','.ff-inspector-summary',['height','padding','fontSize','fontWeight','letterSpacing','backgroundColor','color']),
      content:compare('.ff-left-content','.ff-inspector-content',['padding']),
      pinned:!!document.querySelector(base+'.left > .ff-sidebar-header')&&!document.querySelector('.ff-left-section .ff-sidebar-header')
    };
  })()`);
  assert.ok(Object.values(sidebars).every(Boolean),'left and right panel shells, headers, cards, summaries and content share one design: '+JSON.stringify(sidebars));
  await evaluate(`document.querySelector('#mInspector').parentElement.scrollTop=0`);
  await writeFile(join(tmpdir(),'frameflow-interface-editor.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`document.querySelector('#mSettingsButton').click()`);
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('#mSettingsPanel .ff-settings-body')).display`),'grid','desktop categories and settings use a two-column layout');
  assert.equal(await evaluate(`document.querySelectorAll('#mSettingsPanel [role=tab]').length`),4,'settings have four categories without Starting view');
  assert.equal(await evaluate(`document.querySelectorAll('#mSettingsPanel [role=tabpanel]:not([hidden])').length`),1,'only one settings category is shown');
  assert.ok(await evaluate(`document.querySelector('#mSize').closest('[role=tabpanel]').hidden===false`),'document settings open first');
  await change('#mDuration',130);
  assert.equal((await stored()).frames,(await stored()).fps*130,'reorganized controls retain their bindings');
  await evaluate(`document.querySelector('#mSettingsTab1').click()`);
  assert.ok(await evaluate(`!document.querySelector('#mTheme').closest('[role=tabpanel]').hidden&&document.querySelector('#mSize').closest('[role=tabpanel]').hidden&&document.querySelector('#mTexture').offsetParent!==null`),'appearance controls are revealed without expanding a section');
  assert.equal(await evaluate(`document.querySelectorAll('#mSettingsPanel details').length`),0,'settings contain no collapsed subsections');
  assert.equal(await evaluate(`!!document.querySelector('#mRegion,#mStartZoom,#mStartPitch,#mStartBearing')`),false,'starting-view controls are removed');
  await evaluate(`document.querySelector('#mSettingsTab1').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowDown',bubbles:true}))`);
  assert.equal(await evaluate(`document.activeElement.id`),'mSettingsTab2','category navigation supports the keyboard');
  assert.ok(await evaluate(`!document.querySelector('#mLabelStyle').closest('[role=tabpanel]').hidden`),'label controls have their own category');
  assert.ok(await evaluate(`document.querySelector('#mAtlasLabels [data-atlas=countries]').offsetParent!==null&&document.querySelector('#mLabelStyle [data-ls=size]').offsetParent!==null`),'country labels and label style are both revealed');
  await change('#mAtlasLabels [data-atlas=countries]',false);
  assert.equal(await evaluate(`document.querySelectorAll('#mSettingsPanel details').length`),0,'editing settings preserves the expanded layout');
  await writeFile(join(tmpdir(),'frameflow-organized-settings.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await cdp('Emulation.setDeviceMetricsOverride',{width:480,height:800,deviceScaleFactor:1,mobile:false});
  assert.ok(await evaluate(`(()=>{const p=document.querySelector('#mSettingsPanel'),r=p.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&p.scrollWidth<=p.clientWidth+1;})()`),'settings fit narrow windows without horizontal overflow');
  await writeFile(join(tmpdir(),'frameflow-organized-settings-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`document.querySelector('#mSettingsPanel .ff-settings-footer button').click()`);
  assert.equal(await evaluate(`document.querySelector('#mSettingsPanel').open`),false);
  await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await change('#mSize','1080,1920');
  await waitFor(`!!document.querySelector('#mapStudio .ff-portrait-layout')`);
  assert.ok(await evaluate(`[...document.querySelectorAll('#mapStudio .workspace > .left,#mapStudio .workspace > .right')].every(panel=>{const r=panel.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth&&panel.scrollWidth<=panel.clientWidth+1;})`),'sidebar styling fits the portrait workspace');
  const magnetStates=await evaluate(`(async()=>{
    const button=document.querySelector('#mapStudio .ff-magnet-toggle');
    const state=()=>({label:button.textContent,pressed:button.getAttribute('aria-pressed'),enabled:button.closest('.timeline').dataset.magnetic,background:getComputedStyle(button).backgroundColor,color:getComputedStyle(button).color,width:button.getBoundingClientRect().width});
    const settle=()=>new Promise(resolve=>setTimeout(resolve,200));
    const on=state();button.click();await settle();const off=state();button.click();await settle();return {on,off,restored:state()};
  })()`);
  assert.ok(await evaluate(`(()=>{
    const buttons=[...document.querySelectorAll('body>header button.ff-icon-button,#mapStudio .ff-preview-actions button,#mapStudio .timeline-tools button')];
    return buttons.length>=17&&buttons.every(button=>button.querySelector('svg.ff-icon')&&button.title&&button.getAttribute('aria-label')&&!button.textContent.trim()&&button.getBoundingClientRect().width===34);
  })()`),'all three toolbars use compact icon buttons with tooltips and accessible names');
  assert.ok(await evaluate(`!document.querySelector('#mapStudio .stagebar')&&!!document.querySelector('#mapStudio .transport #mSnapshot')&&!!document.querySelector('#mapStudio .transport #mCompLabel')&&!!document.querySelector('#mapStudio .transport [data-preview-zoom]')`),'preview actions and canvas metadata share the bottom playback bar');
  const zoomChange=await evaluate(`(()=>{const label=document.querySelector('[data-zoom-label]'),before=label.textContent;document.querySelector('[data-zoom="in"]').click();const after=label.textContent;document.querySelector('[data-zoom="fit"]').click();return {before,after};})()`);
  assert.notEqual(zoomChange.before,zoomChange.after,'preview zoom remains functional after moving its controls');
  assert.equal(magnetStates.on.label,'');assert.equal(magnetStates.on.pressed,'true');assert.equal(magnetStates.on.enabled,'true');
  assert.equal(magnetStates.off.label,'');assert.equal(magnetStates.off.pressed,'false');assert.equal(magnetStates.off.enabled,'false');
  assert.notEqual(magnetStates.on.background,magnetStates.off.background,'Magnet has visibly different enabled and disabled surfaces');
  assert.notEqual(magnetStates.on.color,magnetStates.off.color,'enabled Magnet uses a distinct foreground');
  assert.equal(magnetStates.on.width,magnetStates.off.width,'toggling does not shift the toolbar');
  assert.deepEqual(magnetStates.restored,magnetStates.on);
  await evaluate(`document.querySelector('#mLoop').click()`);
  assert.equal(await evaluate(`document.querySelector('#mLoop').getAttribute('aria-pressed')`),'false');
  await evaluate(`document.querySelector('#mLoop').click();document.querySelector('#mPlay').click()`);
  assert.equal(await evaluate(`document.querySelector('#mPlay').getAttribute('aria-label')`),'Pause playback');
  await evaluate(`document.querySelector('#mPlay').click()`);
  assert.equal(await evaluate(`document.querySelector('#mPlay').getAttribute('aria-label')`),'Play animation');
  await change('#mSize','1280,720');
  await waitFor(`!document.querySelector('#mapStudio .ff-portrait-layout')`);
  for(const width of [1600,1100,980]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    assert.ok(await evaluate(`(()=>{
      const transport=document.querySelector('#mapStudio .transport').getBoundingClientRect(),head=document.querySelector('#mapStudio .timeline-head').getBoundingClientRect();
      const inside=(r,b)=>r.left>=b.left&&r.right<=b.right&&r.top>=b.top&&r.bottom<=b.bottom;
      return [...document.querySelectorAll('#mapStudio .play-controls button')].every(button=>{const r=button.getBoundingClientRect(),svg=button.querySelector('svg');return r.width===32&&r.height===32&&svg&&inside(r,transport)&&inside(svg.getBoundingClientRect(),r);})&&[...document.querySelectorAll('#mapStudio .ff-preview-actions button')].every(button=>inside(button.getBoundingClientRect(),transport))&&[...document.querySelectorAll('#mapStudio .timeline-tools button')].every(button=>inside(button.getBoundingClientRect(),head));
    })()`),width+'px: playback icons and timeline tools fit their bars');
    await writeFile(join(tmpdir(),'frameflow-playback-'+width+'.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  assert.deepEqual(errors,[]);
  console.log('Editor consistency: spatial layer selection, dragging, shared controls and context actions, mixed Shift-selection, batch actions, undo and pinned overlays passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
