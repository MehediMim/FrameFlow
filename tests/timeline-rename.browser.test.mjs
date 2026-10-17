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
const server = createServer(async (req, res) => {
  try {
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
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/index.html#motion` });
  console.log('Application opened; checking studios');
  await waitFor(`document.body.classList.contains('ff-unified')`);
  await waitFor(`!document.body.classList.contains('landing')`);
  // Capture PNG downloads in memory so the browser test never writes user files.
  await evaluate(`(() => {
    window.__previewPngs=[];
    const encode=HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob=function(callback,type,...args){
      return encode.call(this,async blob=>{
        const data=new DataView(await blob.arrayBuffer());
        window.__previewPngs.push({type:blob.type,width:data.getUint32(16),height:data.getUint32(20)});
        callback(blob);
      },type,...args);
    };
    HTMLAnchorElement.prototype.click=function(){};
  })()`);
  const click = async selector => {
    const point=await evaluate(`(() => { const el=document.querySelector(${JSON.stringify(selector)});for(let p=el.parentElement;p;p=p.parentElement)if(p.tagName==='DETAILS')p.open=true;el.scrollIntoView({block:'nearest'});const r=el.getBoundingClientRect();if(!r.width||!r.height)throw Error('Control is hidden: '+${JSON.stringify(selector)});return {x:r.x+r.width/2,y:r.y+r.height/2}; })()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
    await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  };
  const studios = [
    ['motion', '#trackLabels [data-track-label]', '#layerName', 'frameflow-project-v1'],
    ['map', '#mTrackLabels [data-mtl]', '#mInspector [data-mf="name"]', 'frameflow-map-v1'],
    ['paper', '#pTrackLabels [data-ptl]:not([data-ptl="sheet"])', '#pInspector [data-pf="name"]', 'frameflow-paper-v1'],
    ['scene', '#scTracks [data-object]', '#scInspector [data-field="object.name"]', 'frameflow-scene-v2'],
  ];
  for (const [mode, row, oldField, store] of studios) {
    await waitFor(`!!document.querySelector(${JSON.stringify(row)})`);
    await evaluate(`document.querySelector('.modes [data-mode="${mode}"]').click()`);
    await waitFor(`document.body.classList.contains('mode-${mode}') || (${JSON.stringify(mode)} === 'motion' && !document.body.classList.contains('mode-map') && !document.body.classList.contains('mode-paper') && !document.body.classList.contains('mode-scene'))`);
    const selector = row + ' .ff-layer-name';
    const point = await evaluate(`(() => { const n = document.querySelector(${JSON.stringify(selector)}); n.scrollIntoView({block:'nearest'}); const r = n.getBoundingClientRect(); return {x:r.x+Math.min(25,r.width/2),y:r.y+r.height/2}; })()`);
    for (const count of [1, 2]) {
      await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', ...point, button: 'left', clickCount: count });
      await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', ...point, button: 'left', clickCount: count });
    }
    assert.equal(await evaluate(`!!document.querySelector(${JSON.stringify(oldField)})`), false, `${mode}: old name field must be removed`);
    const focused = await evaluate(`document.activeElement.classList.contains('ff-timeline-name-input')`);
    if (!focused) console.log(await evaluate(`({active:document.activeElement.tagName, hit:document.elementFromPoint(${point.x},${point.y})?.tagName, point:${JSON.stringify(point)}})`));
    assert.equal(focused, true, `${mode}: double-click must focus rename input; errors: ${errors.join('\n')}`);
    const name = `${mode} browser rename`;
    await cdp('Input.insertText', { text: name });
    await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
    assert.ok(await evaluate(`Object.values(JSON.parse(localStorage.getItem(${JSON.stringify(store)})) || {}).some(v => Array.isArray(v) && v.some(it => it.name === ${JSON.stringify(name)}))`), `${mode}: rename must persist`);
    console.log(`${mode}: browser rename passed`);
    const timeline = {
      motion: ['#scroll', '#tracks', '#trackRows', '#ruler', '#playhead > span'],
      map: ['#mScroll', '#mTracks', '#mTrackRows', '#mRuler', '#mPlayhead > span'],
      paper: ['#pScroll', '#pTracks', '#pTrackRows', '#pRuler', '#pPlayhead > span'],
      scene: ['#scTimelineScroll', '#scTracks', '#scTracks', '.sc-ruler-row', '.sc-ruler-head'],
    }[mode];
    const scrolling = await evaluate(`(async () => {
      const [scrollSel, tracksSel, rowsSel, rulerSel, handleSel] = ${JSON.stringify(timeline)};
      const scroll = document.querySelector(scrollSel), tracks = document.querySelector(tracksSel), rows = document.querySelector(rowsSel);
      const sample = rows.querySelector('.track-row,.sc-track');
      for (let i=0;i<30;i++) rows.append(sample.cloneNode(true));
      tracks.style.width = '200%';
      scroll.scrollTop = 0; scroll.scrollLeft = 0;
      const top = document.querySelector(rulerSel).getBoundingClientRect().top;
      scroll.scrollTop = 120; scroll.scrollLeft = 80;
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      const ruler = document.querySelector(rulerSel), rect = ruler.getBoundingClientRect();
      const header = document.elementFromPoint(scroll.getBoundingClientRect().left+100, rect.top+10);
      const handle = document.querySelector(handleSel).getBoundingClientRect();
      const label = scroll.parentElement.querySelector('.ruler-label');
      const labelRect = label?.getBoundingClientRect();
      const labelOnTop = !label || label.contains(document.elementFromPoint(labelRect.left+15,labelRect.top+10));
      return { top, after:rect.top, scrollTop:scroll.scrollTop, scrollLeft:scroll.scrollLeft,
        rulerOnTop:ruler.contains(header), labelOnTop, handleTop:handle.top, handleBottom:handle.bottom, rulerBottom:rect.bottom };
    })()`);
    assert.equal(scrolling.scrollTop, 120, `${mode}: fixture must scroll vertically`);
    assert.equal(scrolling.scrollLeft, 80, `${mode}: fixture must scroll horizontally`);
    assert.ok(Math.abs(scrolling.top - scrolling.after) < 1, `${mode}: ruler must stay at the top`);
    assert.ok(scrolling.rulerOnTop && scrolling.labelOnTop, `${mode}: rows must not cover timeline headers`);
    assert.ok(scrolling.handleTop >= scrolling.after && scrolling.handleBottom <= scrolling.rulerBottom, `${mode}: playhead handle must remain in the ruler`);
    console.log(`${mode}: sticky timeline ruler passed`);
    const preview = {
      motion:['.workspace.motion-only main','#canvas','#canvasZoom100','#canvasZoomFit','#canvasZoomIn','#canvasZoomOut','#snapshot','#motionFullscreen'],
      map:['#mapStudio main','#mCanvas','[data-zoom="actual"]','[data-zoom="fit"]','[data-zoom="in"]','[data-zoom="out"]','#mSnapshot','#mapFullscreen'],
      paper:['#paperStudio main','#pCanvas','[data-zoom="actual"]','[data-zoom="fit"]','[data-zoom="in"]','[data-zoom="out"]','#pSnapshot','#pFullscreen'],
      scene:['#sceneStudio main','#scCanvas','[data-zoom="actual"]','[data-zoom="fit"]','[data-zoom="in"]','[data-zoom="out"]','[data-action="png"]','[data-action="fullscreen"]'],
    }[mode];
    const [main,canvas,actual,fit,zoomIn,zoomOut,png,fullscreen]=preview;
    const scoped=selector=>`${main} ${selector}`;
    const metrics=()=>evaluate(`(() => {const c=document.querySelector(${JSON.stringify(canvas)}),r=c.getBoundingClientRect(),area=c.closest('.stage-area,.sc-stage');return {width:c.width,height:c.height,displayWidth:r.width,displayHeight:r.height,areaWidth:area.clientWidth,areaHeight:area.clientHeight,scrollLeft:area.scrollLeft,scrollTop:area.scrollTop};})()`);
    const order=await evaluate(`Array.from(document.querySelector(${JSON.stringify(main)}).querySelector('.canvas-zoom').children).map(n=>n.textContent.trim())`);
    assert.ok(order[0]==='−' && order[2]==='+' && order[3]==='100%' && order[4]==='Fit all' && order[5].includes('Fullscreen'),`${mode}: controls must match Motion's order`);
    await click(scoped(actual));
    const native=await metrics();
    assert.ok(Math.abs(native.displayWidth-native.width)<1 && Math.abs(native.displayHeight-native.height)<1,`${mode}: 100% must show native pixels`);
    await click(scoped(zoomIn)); const bigger=await metrics();
    assert.ok(Math.abs(bigger.displayWidth/native.width-1.1)<.01,`${mode}: zoom in must use the same increment`);
    await click(scoped(zoomOut)); const smaller=await metrics();
    assert.ok(Math.abs(smaller.displayWidth-native.width)<1,`${mode}: zoom out must reverse zoom in`);
    if(mode==='map')await waitFor(`document.querySelector('#mDlCountry').options.length>0`);
    const pngCount=await evaluate('window.__previewPngs.length');
    await click(scoped(png));
    await waitFor(`window.__previewPngs.length>${pngCount}`);
    const encoded=await evaluate('window.__previewPngs.at(-1)');
    assert.deepEqual(encoded,{type:'image/png',width:native.width,height:native.height},`${mode}: PNG must use project dimensions`);
    await click(scoped(fit));
    const fitted=await metrics();
    assert.ok(fitted.displayWidth<=fitted.areaWidth && fitted.displayHeight<=fitted.areaHeight,`${mode}: Fit all must show the entire canvas`);
    assert.equal(fitted.scrollLeft,0);assert.equal(fitted.scrollTop,0);
    await click(scoped(fullscreen));
    await waitFor(`document.fullscreenElement===document.querySelector(${JSON.stringify(main)})`);
    await waitFor(`document.querySelector(${JSON.stringify(scoped(fullscreen))}).getAttribute('aria-pressed')==='true'`);
    await click(scoped(actual));
    const fullNative=await metrics();
    assert.ok(Math.abs(fullNative.displayWidth-native.width)<1,`${mode}: 100% must also work fullscreen`);
    await click(scoped(fit));
    await click(scoped(fullscreen));
    await waitFor('!document.fullscreenElement');
    console.log(`${mode}: preview zoom, PNG and fullscreen passed`);
  }
  if(process.argv.includes('--lines')) {
    await evaluate(`document.querySelector('.modes [data-mode="motion"]').click()`);
    await click('#drawStraightLine');
    const rect=await evaluate(`(()=>{document.querySelector('#canvas').scrollIntoView({block:'center'});const r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
    const drag=async points=>{
      for(let i=0;i<points.length;i++){
        const [x,y]=points[i],point={x:rect.x+x*rect.w,y:rect.y+y*rect.h};
        await cdp('Input.dispatchMouseEvent',{type:i===0?'mousePressed':'mouseMoved',...point,button:'left',buttons:1,clickCount:1});
      }
      const [x,y]=points.at(-1);
      await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+x*rect.w,y:rect.y+y*rect.h,button:'left',clickCount:1});
    };
    await drag([[.2,.3],[.7,.3]]);
    await waitFor(`document.querySelector('#inspector').textContent.includes('DRAWN LINE')`);
    await evaluate(`(()=>{for(const [k,v]of [['vectorStroke','#ff0000'],['vectorStrokeWidth','14']]){const n=document.querySelector('[data-vector="'+k+'"]');n.value=v;n.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    const saved=await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1')).layers.at(-1)`);
    assert.ok(saved.isDrawnLine && saved.svgMarkup.includes(' L'));
    assert.equal(saved.vectorStroke,'#ff0000');assert.equal(saved.vectorStrokeWidth,14);
    await waitFor(`(()=>{const c=document.querySelector('#canvas'),p=c.getContext('2d').getImageData(Math.round(c.width*.45),Math.round(c.height*.3),1,1).data;return p[0]>200&&p[1]<40&&p[2]<40})()`);
    await click('#drawFreehandLine');await drag([[.3,.5],[.4,.6],[.5,.4],[.6,.5]]);
    await waitFor(`JSON.parse(localStorage.getItem('frameflow-project-v1')).layers.filter(l=>l.isDrawnLine).length===2`);
    await click('[data-camera-add="focus"]');
    await waitFor(`!!document.querySelector('[data-cam="frontBlur"]')`);
    await evaluate(`(()=>{for(const [k,v]of [['frontBlur','9'],['backBlur','27']]){const n=document.querySelector('[data-cam="'+k+'"]');n.value=v;n.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    const shot=await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1')).cameraShots.at(-1)`);
    assert.equal(shot.frontBlur,9);assert.equal(shot.backBlur,27);
    await cdp('Page.reload');await waitFor(`!!document.querySelector('#drawStraightLine')`);
    assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1')).layers.filter(l=>l.isDrawnLine).length`),2);
    console.log('Straight/freehand drawing, rendered line color/width, camera blur controls and reload passed');
  }
  if(process.env.FRAMEFLOW_MEDIA_TEST==='1'||process.argv.includes('--media')) {
    await evaluate(`document.querySelector('.modes [data-mode="motion"]').click()`);
    await evaluate(`(() => {for(const [id,value] of [['frame','0'],['duration','1'],['size','1280,720']]){const n=document.getElementById(id);n.value=value;n.dispatchEvent(new Event('change',{bubbles:true}));}})()`);
    console.log('Creating a video fixture with changing frames and original sound');
    const fixture=await evaluate(`(async()=>{
      const {exportMapVideo}=await import('./map-video-export.mjs');
      const c=document.createElement('canvas');c.width=96;c.height=64;const g=c.getContext('2d');
      const audio=new OfflineAudioContext(1,48000,48000).createBuffer(1,48000,48000),samples=audio.getChannelData(0);
      for(let i=0;i<samples.length;i++)samples[i]=.15*Math.sin(2*Math.PI*440*i/48000);
      const blob=await exportMapVideo({canvas:c,fps:24,frames:24,draw:f=>{g.fillStyle=f<12?'#ff0000':'#0000ff';g.fillRect(0,0,96,64)},audio:{layers:[{buffer:audio,start:0,source:0,duration:1,volume:1}]}});
      return await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.readAsDataURL(blob)});
    })()`);
    const fixtureFile=join(profile,'motion-sound.webm');await writeFile(fixtureFile,Buffer.from(fixture.split(',')[1],'base64'));
    const doc=await cdp('DOM.getDocument');const input=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#videoFile'});
    await cdp('DOM.setFileInputFiles',{nodeId:input.nodeId,files:[fixtureFile]});
    await waitFor(`!!document.querySelector('#videoMuted')`);
    await waitFor(`JSON.parse(localStorage.getItem('frameflow-project-v1')).layers.some(l=>l.type==='video')`);
    await waitFor(`document.querySelector('#inspector').textContent.includes('Original sound follows')`);
    const audioExpr=`(await import('./audio-reference.mjs?v=motion-media-1')).getAudioSnapshot('motion')`;
    assert.ok(await evaluate(`(async()=>!!(${audioExpr})?.layers.some(l=>l.buffer.duration>.9))()`),'video sound must be available for playback and export');
    await click('#videoMuted');
    assert.equal(await evaluate(`(async()=>${audioExpr})()`),null,'muting must remove original sound from export');
    await click('#videoMuted');
    const seek=async time=>evaluate(`(()=>{const n=document.querySelector('#frame');n.value=${time};n.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const pixel=`document.querySelector('#canvas').getContext('2d').getImageData(700,400,1,1).data`;
    await seek(0);await waitFor(`(()=>{const p=${pixel};return p[0]>180&&p[2]<60})()`);
    await seek(.75);await waitFor(`(()=>{const p=${pixel};return p[2]>180&&p[0]<60})()`);
    console.log('Video import, sound, mute and frame seeking passed');
    await seek(0);await click('#inspector [data-motion-path="draw"]');
    const bounds=await evaluate(`(()=>{const r=document.querySelector('#canvas').getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}})()`);
    for(const [x,y] of [[.25,.35],[.5,.65],[.75,.35]]) {
      const point={x:bounds.x+bounds.w*x,y:bounds.y+bounds.h*y};
      await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});
      await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
    }
    await click('#inspector [data-motion-path="draw"]');
    await evaluate(`(()=>{const n=document.querySelector('[data-path-field="dur"]');n.value=.3;n.dispatchEvent(new Event('change',{bubbles:true}));const d=document.querySelector('#duration');d.value=1;d.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    const movement=await evaluate(`JSON.parse(localStorage.getItem('frameflow-project-v1')).layers.find(l=>l.type==='video')`);
    assert.equal(movement.motionPath.points.length,3);assert.equal(movement.motionPath.dur,9);
    assert.ok(movement.keys.x.length>3 && movement.keys.y.length===movement.keys.x.length,'smooth path must generate timed position keys');
    assert.equal(movement.keys.x[0].v,movement.motionPath.points[0].x);assert.equal(movement.keys.x.at(-1).v,movement.motionPath.points.at(-1).x);
    await evaluate(`HTMLAnchorElement.prototype.click=function(){fetch(this.href).then(r=>r.blob()).then(blob=>{window.__motionExport=blob;window.__motionExportName=this.download;});}`);
    await click('#export');
    await waitFor(`!!window.__motionExport || document.querySelector('#exportStatus')?.textContent.startsWith('Export failed')`);
    assert.ok(await evaluate(`!!window.__motionExport`),await evaluate(`document.querySelector('#exportStatus').textContent`));
    const encoded=await evaluate(`(async()=>{const b=window.__motionExport;const text=new TextDecoder('latin1').decode(await b.arrayBuffer());return {size:b.size,type:b.type,audio:text.includes('A_OPUS'),name:window.__motionExportName};})()`);
    assert.ok(encoded.size>1000 && encoded.type==='video/webm' && encoded.audio && encoded.name.endsWith('.webm'),'export must include encoded video frames and original audio');
    console.log('Movement path drawing and video export with original sound passed');
  }
  assert.deepEqual(errors, [], 'No uncaught browser errors');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
