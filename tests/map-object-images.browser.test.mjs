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
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');const p=E.newMapProject();p.camera.init={lon:2,lat:48,zoom:4,pitch:0,bearing:0};localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);
  await change('#mInspector [data-mf="glyph"]','artwork');
  await change('#mInspector [data-mf="sizeMode"]','map');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions[0].sizeZoom`),4);
  const svgPath=join(profile,'artwork.svg');
  await writeFile(svgPath,`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100"><defs><linearGradient id="g"><stop stop-color="red"/><stop offset="1" stop-color="red"/></linearGradient></defs><style>.art { fill: url('#g'); }</style><rect class="art" x="20" y="20" width="160" height="60"/></svg>`);
  const upload=async path=>{const root=await cdp('DOM.getDocument');const file=await cdp('DOM.querySelector',{nodeId:root.root.nodeId,selector:'#mInspector [data-badgefile]'});await cdp('DOM.setFileInputFiles',{nodeId:file.nodeId,files:[path]});};
  await upload(svgPath);
  await waitFor(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions[0].image?.startsWith('data:image/png')`);
  const image=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions[0].image`);
  const pngPath=join(profile,'artwork.png');await writeFile(pngPath,Buffer.from(image.split(',')[1],'base64'));
  await evaluate(`document.querySelector('#mInspector [data-badgeclear]').click()`);await upload(pngPath);
  await waitFor(`!!JSON.parse(localStorage.getItem('frameflow-map-v1')).actions[0].image`);
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const result=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),I=await import('./map-object-images.mjs');
    const geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    const p=JSON.parse(localStorage.getItem('frameflow-map-v1'));E.validateMapProject(p);p.shots=[];
    const a=p.actions[0];a.enter='none';a.exit='none';a.showLabel=false;a.place={kind:'point',name:'Art',lon:2,lat:48};a.dur=200;
    p.theme='paper';p.graticule=false;p.texture={type:'none',strength:0,scale:1};await E.preloadBadges(p);
    const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');
    const img=new Image();img.src=a.image;await img.decode();const ic=document.createElement('canvas');ic.width=img.width;ic.height=img.height;const ix=ic.getContext('2d');ix.drawImage(img,0,0);
    const transparency=[ix.getImageData(0,0,1,1).data[3],ix.getImageData(img.width/2,img.height/2,1,1).data[3]];
    // Use DOM foreground canvases so draw calls on every layer can be observed.
    window.OffscreenCanvas=undefined;
    const original=CanvasRenderingContext2D.prototype.drawImage;let sizes=[];CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im.src===a.image&&args.length===4)sizes.push(args.slice(2));original.call(this,im,...args);};
    E.drawMap(x,1280,720,p,30,geo);p.camera.init.zoom=5;E.drawMap(x,1280,720,p,30,geo);a.sizeMode='screen';E.drawMap(x,1280,720,p,30,geo);p.camera.init.zoom=4;E.drawMap(x,1280,720,p,30,geo);
    CanvasRenderingContext2D.prototype.drawImage=original;
    const capture=actions=>{p.actions=actions;E.drawMap(x,1280,720,p,60,geo);return new Uint8ClampedArray(x.getImageData(0,0,1280,720).data);};
    const base={dur:200,animDur:10,showLabel:false,dim:0,pulse:false,easing:'linear'};
    const old=E.makeAction('highlight',0,{...base,target:{kind:'country',name:'France'},color:'#ff0000'}),newer=E.makeAction('highlight',20,{...base,target:{kind:'country',name:'France'},color:'#0000ff'});
    const equal=(a,b)=>a.every((v,i)=>v===b[i]);
    const only=capture([newer]),both=capture([newer,old]),sameStart=capture([{...old,start:20},newer]);
    const precedence=equal(only,both)&&equal(only,sameStart);
    const grouped={...old,target:{kind:'regions',name:'France and Germany',members:[old.target,{kind:'country',name:'Germany'}]}};
    const mixed=capture([grouped,newer]),groupOnly=capture([grouped]);const v=E.makeView({cx:E.lonToX(2),cy:E.latToY(48),zoom:4,pitch:0,bearing:0},1280,720);
    const pixel=(arr,lon,lat)=>{const q=E.project(v,E.lonToX(lon),E.latToY(lat)),n=(Math.floor(q.y)*1280+Math.floor(q.x))*4;return Array.from(arr.slice(n,n+4));};
    const overlap=JSON.stringify(pixel(mixed,2,48))===JSON.stringify(pixel(only,2,48));
    const unaffected=JSON.stringify(pixel(mixed,8,50))===JSON.stringify(pixel(groupOnly,8,50));
    p.actions=[old,{...newer,dur:30}];E.drawMap(x,1280,720,p,100,geo);const expired=x.getImageData(0,0,1280,720).data;p.actions=[old];E.drawMap(x,1280,720,p,100,geo);const resumes=equal(expired,x.getImageData(0,0,1280,720).data);
    p.actions=[a];const png=await new Promise(r=>c.toBlob(r,'image/png'));
    let rejected=false;try{await I.importObjectImage(new File(['<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>'],'bad.svg',{type:'image/svg+xml'}));}catch{rejected=true;}
    window.reviewProject=p;
    return {sizes,transparency,width:img.width,height:img.height,precedence,overlap,unaffected,resumes,png:png.size,rejected};
  })()`);
  assert.equal(result.width,1024);assert.equal(result.height,512);assert.deepEqual(result.transparency,[0,255]);
  assert.equal(result.sizes.length,4);assert.equal(result.sizes[1][0],result.sizes[0][0]*2);assert.equal(result.sizes[2][0],result.sizes[3][0]);assert.equal(result.sizes[0][0]/result.sizes[0][1],2);
  for(const key of ['precedence','overlap','unaffected','resumes','rejected'])assert.equal(result[key],true,key);
  assert.ok(result.png>1000);
  // Grouped image/trade objects, portrait uploads and plaque text controls.
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);
  await change('#mInspector [data-mf="glyph"]','portrait');
  assert.equal(await evaluate(`(()=>{const upload=document.querySelector('[data-badgeimg]'),movement=document.querySelector('[data-mf="__pinMove"]');return !!(upload.compareDocumentPosition(movement)&Node.DOCUMENT_POSITION_FOLLOWING)})()`),true,'portrait upload is above movement settings');
  assert.equal(await evaluate(`(()=>{const file=document.querySelector('[data-badgefile]');let clicked=false;const original=file.click;file.click=()=>{clicked=true};document.querySelector('[data-badgeimg]').click();file.click=original;return clicked})()`),true,'upload button opens the portrait file picker');
  await change('#mInspector [data-mf="label"]','Manuel');
  await upload(pngPath);
  await waitFor(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1).image?.startsWith('data:image/png')`);
  assert.equal(await evaluate(`document.querySelector('.m-portrait-image-preview')?.src===JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1).image`),true,'uploaded image is previewed in the portrait inspector');
  const categories=await evaluate(`(()=>{const s=document.querySelector('[data-mf="glyph"]');return [...s.querySelectorAll('optgroup')].map(g=>({label:g.label,values:[...g.children].map(o=>o.value)}))})()`);
  assert.deepEqual(categories.find(g=>g.label==='Images, portraits & flags').values.slice().sort(),['artwork','banner','image','portrait']);
  assert.ok(categories.find(g=>g.label==='Trade & cargo').values.includes('importGoods'));
  assert.ok(categories.find(g=>g.label==='Trade & cargo').values.includes('exportGoods'));
  await change('#mPlaqueFont','Georgia');
  await change('[data-mf="plaqueSize"]','11');
  await change('[data-mf="plaqueWeight"]','400');
  await change('[data-mf="plaqueColor"]','#ffd166');
  await evaluate(`document.querySelector('[data-mf="plaqueItalic"]').click();document.querySelector('[data-mf="plaqueFit"]').click()`);
  const styled=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1)`);
  assert.equal(styled.plaqueSize,11);assert.equal(styled.plaqueWeight,400);assert.equal(styled.plaqueItalic,true);assert.equal(styled.plaqueFit,false);assert.equal(styled.plaqueColor,'#ffd166');
  await change('#mInspector [data-mf="glyph"]','banner');
  assert.ok(await evaluate(`!!document.querySelector('#mPlaqueFont')&&!!document.querySelector('[data-mf="plaqueSize"]')`),'banner exposes plaque style controls too');
  await change('#mInspector [data-mf="glyph"]','portrait');
  const medieval=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),M=await import('./map-medieval-objects.mjs'),T=await import('./map-trade-objects.mjs');
    const p=E.newMapProject();p.theme='paper';p.graticule=false;p.camera.init={lon:2,lat:48,zoom:4,pitch:0,bearing:0};
    const saved=JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1);
    p.actions=Object.keys(M.MEDIEVAL_OBJECTS).map((glyph,i)=>E.makeAction('object',0,{glyph,color:E.OBJECT_ICONS[glyph].color,image:glyph==='portrait'?saved.image:undefined,label:glyph==='portrait'?'Manuel':'',showLabel:true,enter:'none',exit:'none',size:2,dur:240,place:{kind:'point',name:glyph,lon:-4+i*4,lat:48}}));
    const roundtrip=JSON.parse(JSON.stringify(p));E.validateMapProject(roundtrip);await E.preloadBadges(roundtrip);
    Object.assign(roundtrip.actions[0],{plaqueFont:saved.plaqueFont,plaqueSize:saved.plaqueSize,plaqueWeight:saved.plaqueWeight,plaqueColor:saved.plaqueColor,plaqueItalic:saved.plaqueItalic,plaqueFit:saved.plaqueFit});
    const geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    const c=document.createElement('canvas');c.width=1280;c.height=720;const ctx=c.getContext('2d');let portraits=0;const draw=CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage=function(im,...args){if(im.src===saved.image)portraits++;draw.call(this,im,...args)};
    E.drawMap(ctx,1280,720,roundtrip,40,geo);const first=ctx.getImageData(0,0,1280,720).data.slice();E.drawMap(ctx,1280,720,roundtrip,40,geo);
    CanvasRenderingContext2D.prototype.drawImage=draw;
    window.reviewProject=roundtrip;
    const second=ctx.getImageData(0,0,1280,720).data;
    const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=800;const g=sheet.getContext('2d');g.fillStyle='#e8dfcd';g.fillRect(0,0,1200,800);
    Object.entries(T.TRADE_OBJECTS).forEach(([key,icon],i)=>{const x=200+(i%3)*400,y=130+Math.floor(i/3)*260;g.save();g.translate(x,y);icon.draw(g,65,icon.color,0);g.restore();g.fillStyle='#303d36';g.font='18px Arial';g.textAlign='center';g.fillText(icon.label,x,y+105)});
    return{portraits,stable:first.every((v,i)=>v===second[i]),png:c.toDataURL(),tradeSheet:sheet.toDataURL()};
  })()`);
  assert.equal(medieval.portraits,2,'uploaded portrait is drawn after preload');assert.equal(medieval.stable,true);
  await writeFile(join(tmpdir(),'frameflow-medieval-objects.png'),Buffer.from(medieval.png.split(',')[1],'base64'));
  await writeFile(join(tmpdir(),'frameflow-trade-objects.png'),Buffer.from(medieval.tradeSheet.split(',')[1],'base64'));
  const video=await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),V=await import('./map-video-export.mjs');const p=window.reviewProject;p.width=640;p.height=360;p.frames=2;p.fps=30;p.audioTracks=[];const geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));await E.preloadBadges(p);const canvas=document.createElement('canvas');canvas.width=p.width;canvas.height=p.height;const b=await V.exportMapVideo({canvas,fps:p.fps,frames:p.frames,draw:f=>E.drawMap(canvas.getContext('2d'),p.width,p.height,p,f,geo)});return{size:b.size,type:b.type};})()`);
  assert.ok(video.size>1000&&video.type==='video/webm');
  assert.deepEqual(errors,[]);console.log('Object map/screen sizing, SVG/PNG uploads, transparency, reload, newest highlight/partial overlap/expiry, PNG and WebM passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
