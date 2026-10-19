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
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => reject(Error(`Debugger timeout: ${method}`)), 10000); pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); ws.send(JSON.stringify({ id, method, params })); });
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
  console.log('Application opened; checking studios');
  await waitFor(`document.body.classList.contains('ff-unified')`);
  await waitFor(`!document.body.classList.contains('landing')`);

  await evaluate(`document.querySelector('[data-mode="map"]').click()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');localStorage.setItem('frameflow-map-v1',JSON.stringify(E.demoMapProject()));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);


  const click = async selector => {
    const q=await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('Missing '+${JSON.stringify(selector)});for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...q,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...q,button:'left',buttons:0,clickCount:1});
  };
  const hiddenPaper = await evaluate(`(async()=>{const E=await import('./paper-engine.mjs'),p=E.newPaperProject();p.paper.grain=0;p.paper.wear=0;p.parts=[E.makePart('headline',0,{text:'Visible layer',visible:false})];const c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');E.drawPaper(ctx,640,360,p,40);const hidden=c.toDataURL();p.parts=[];E.drawPaper(ctx,640,360,p,40);const absent=c.toDataURL();p.parts=[E.makePart('headline',0,{text:'Visible layer'})];E.drawPaper(ctx,640,360,p,40);return {matches:hidden===absent,differs:c.toDataURL()!==absent};})()`);
  assert.equal(hiddenPaper.matches,true,'hidden paper part renders the same pixels as no part');
  assert.equal(hiddenPaper.differs,true,'visible paper part contributes pixels');
  const specs=[
    {mode:'motion',timeline:'.timeline.motion-only',scroll:'#scroll',zoom:'#zoom',row:'#trackLabels [data-track-label]',attr:'data-track-label',key:'frameflow-project-v1',list:'layers'},
    {mode:'map',timeline:'#mapStudio .timeline',scroll:'#mScroll',zoom:'#mZoomT',row:'#mTrackLabels [data-mtl]',attr:'data-mtl',key:'frameflow-map-v1',list:'actions'},
    {mode:'paper',timeline:'#paperStudio .timeline',scroll:'#pScroll',zoom:'#pZoomT',row:'#pTrackLabels [data-ptl]',attr:'data-ptl',key:'frameflow-paper-v1',list:'parts'},
    {mode:'scene',timeline:'#sceneStudio .sc-timeline',scroll:'#scTimelineScroll',zoom:'#scTimelineZoom',row:'#scTracks [data-object]',attr:'data-object',key:'frameflow-scene-v2',list:'objects'},
  ];
  for(const s of specs){
    await click(`[data-mode="${s.mode}"]`);
    await waitFor(`document.querySelectorAll('${s.row} .ff-row-actions').length>0`);
    const height=await evaluate(`document.querySelector('${s.timeline}').getBoundingClientRect().height`);
    const handle=await evaluate(`(()=>{const r=document.querySelector('${s.timeline} .ff-timeline-resize').getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...handle,button:'left',buttons:1,clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:handle.x,y:handle.y-60,buttons:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:handle.x,y:handle.y-60,button:'left',buttons:0,clickCount:1});
    const resized=await evaluate(`(()=>{const el=document.querySelector('${s.timeline}'),h=el.querySelector('.ff-timeline-resize');return {height:el.getBoundingClientRect().height,style:el.getAttribute('style'),handle:h.getBoundingClientRect().height,hit:document.elementFromPoint(${handle.x},${handle.y})?.className}})()`);
    assert.ok(Math.abs(resized.height-height-60)<2,`${s.mode} timeline resizes by mouse: before ${height}, after ${JSON.stringify(resized)}`);
    const zoom=await evaluate(`Number(document.querySelector('${s.zoom}').value)`);
    await evaluate(`document.querySelector('${s.scroll}').style.maxHeight='70px'`);
    const point=await evaluate(`(()=>{const r=document.querySelector('${s.scroll}').getBoundingClientRect();return{x:r.left+r.width*.7,y:r.top+10}})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:150});
    await waitFor(`document.querySelector('${s.scroll}').scrollTop>0`);
    assert.equal(await evaluate(`Number(document.querySelector('${s.zoom}').value)`),zoom,`${s.mode} normal wheel does not zoom`);
    assert.ok(await evaluate(`document.querySelector('${s.scroll}').scrollTop>0`),`${s.mode} normal wheel scrolls rows`);
    await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:-200,modifiers:2});
    await waitFor(`Number(document.querySelector('${s.zoom}').value)>${zoom}`);
    await cdp('Input.dispatchMouseEvent',{type:'mouseWheel',...point,deltaX:0,deltaY:200,modifiers:2});
    await waitFor(`Number(document.querySelector('${s.zoom}').value)<${zoom+0.1}`);
    await evaluate(`(async()=>{const scroll=document.querySelector('${s.scroll}');scroll.style.maxHeight='';scroll.scrollTop=0;scroll.dispatchEvent(new Event('scroll'));await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));})()`);
    // The last visual row is a normal editable layer rather than the camera/sheet row.
    const id=await evaluate(`Array.from(document.querySelectorAll('${s.row}')).at(-1).getAttribute('${s.attr}')`);
    const row=`${s.row}[${s.attr}="${id}"]`;
    await click(`${row} [data-row-action="visibility"]`);
    const saved=()=>evaluate(`JSON.parse(localStorage.getItem('${s.key}'))`);
    let p=await saved(); assert.equal(p[s.list].find(l=>l.id===id).visible,false,`${s.mode} hide persists`);
    await click(`${row} [data-row-action="visibility"]`);
    p=await saved();assert.equal(p[s.list].find(l=>l.id===id).visible,true);
    const count=p[s.list].length, order=p[s.list].map(l=>l.id);
    const move=await evaluate(`(()=>{const row=document.querySelector(${JSON.stringify(row)});return ['up','down'].find(a=>!row.querySelector('[data-row-action="'+a+'"]').disabled)})()`);
    if(move){await click(`${row} [data-row-action="${move}"]`);p=await saved();assert.notDeepEqual(p[s.list].map(l=>l.id),order,`${s.mode} reorder works`);}
    await click(`${row} [data-row-action="duplicate"]`);
    p=await saved();assert.equal(p[s.list].length,count+1,`${s.mode} duplicate works`);
    const copy=p[s.list].find(l=>!order.includes(l.id));assert.ok(copy);
    await waitFor(`document.querySelector('${s.row}[${s.attr}="${copy.id}"] [data-row-action="delete"]')!==null`);
    await click(`${s.row}[${s.attr}="${copy.id}"] [data-row-action="delete"]`);
    p=await saved();assert.equal(p[s.list].length,count,`${s.mode} delete works`);
    await click(`${row} [data-row-action="visibility"]`);
    console.log(`${s.mode}: resize, wheel zoom, visibility, reorder, duplicate and delete passed`);
  }
  await evaluate(`location.reload()`);
  await waitFor(`document.querySelectorAll('.ff-timeline-resize').length===4`);
  for(const s of specs){await click(`[data-mode="${s.mode}"]`);await waitFor(`document.querySelectorAll('${s.row} .ff-row-actions').length>0`);const p=await evaluate(`JSON.parse(localStorage.getItem('${s.key}'))`);assert.ok(p[s.list].some(l=>l.visible===false),`${s.mode} hidden state survives reload`);}
  assert.deepEqual(errors,[],'no browser runtime errors');
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});
  await writeFile(join(tmpdir(),'frameflow-timeline-controls.png'),Buffer.from(screenshot.data,'base64'));
  console.log('All studio timeline controls and saved visibility passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
