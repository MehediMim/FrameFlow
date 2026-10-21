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
  await evaluate(`document.querySelector('[data-mode="map"]').click()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`(async()=>{const E=await import('./map-engine.mjs');const p=E.newMapProject();p.camera.init={lon:2,lat:48,zoom:4,bearing:0,pitch:0};localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();})()`);
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const saved=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);await change('#mInspector [data-mf="glyph"]','stoneFort');
  assert.equal(await evaluate(`document.querySelectorAll('[data-object-search], [data-object-choice], .m-object-library').length`),0,'object selection uses only the two dropdowns');
  await change('#mInspector [data-mf="glyph"]','tank');
  assert.ok(await evaluate(`!!document.querySelector('#mItems img[data-object-preview="tank"]')`),'selected object keeps its layer preview');
  await change('#mInspector [data-mf="glyph"]','stoneFort');
  await evaluate(`document.querySelector('#mInspector [data-mf="autoObjectKey"]').click()`);
  await change('#mFrame','1');await change('#mInspector [data-mf="size"]','2');await change('#mInspector [data-mf="objectAngle"]','90');await change('#mInspector [data-mf="damageState"]','damaged');
  await change('#mFrame','2');await change('#mInspector [data-mf="damageState"]','burning');
  await change('#mFrame','3');await change('#mInspector [data-mf="damageState"]','destroyed');
  let p=await saved(),fort=p.actions[0];
  assert.ok(fort.objectKeys.some(k=>k.frame===30&&k.values.size===2&&k.values.objectAngle===90));assert.ok(fort.objectKeys.some(k=>k.frame===60&&k.values.damageState==='burning'));
  await change('#mInspector [data-mf="__objectTrack"]','size');
  await evaluate(`document.querySelector('[data-map-key="object:size:30"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true}))`);
  p=await saved();assert.ok(p.actions[0].objectKeys.some(k=>k.frame===31&&k.values.size===2),'size keys retime independently');
  await evaluate(`document.querySelector('[data-map-key="object:size:31"]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowLeft',bubbles:true}))`);
  await change('#mFrame','0');await change('#mInspector [data-mf="__objectTrack"]','all');
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);await change('#mInspector [data-mf="glyph"]','stoneWall');await change('#mInspector [data-mf="__pinMove"]','wallPath');
  const clickMap=async(lon,lat)=>{const point=await evaluate(`(async()=>{const E=await import('./map-engine.mjs');const p=JSON.parse(localStorage.getItem('frameflow-map-v1'));const v=E.makeView({cx:E.lonToX(p.camera.init.lon),cy:E.latToY(p.camera.init.lat),...p.camera.init},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),b=document.querySelector('#mCanvas').getBoundingClientRect();return{x:b.left+q.x/p.width*b.width,y:b.top+q.y/p.height*b.height};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});};
  await clickMap(-5,48.8);await clickMap(1,49.7);await clickMap(7,48.3);
  await evaluate(`document.querySelector('#mInspector [data-mpath="draw"]').click()`);
  await change('#mInspector [data-mf="wallTowerEvery"]','3');await evaluate(`document.querySelector('#mInspector [data-mf="wallGate"]').click()`);
  p=await saved();assert.equal(p.actions[1].mode,'wallPath');assert.equal(p.actions[1].path.length,3);assert.equal(p.actions[1].wallGate,true);
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);await change('#mInspector [data-mf="glyph"]','army');
  await change('#mInspector [data-army-preset]','siege');await change('#mInspector [data-mf="armyName"]','Red siege guard');
  await evaluate(`document.querySelector('#mInspector [data-army-add]').click()`);await change('#mInspector [data-army-unit="4"]','cavalry');await evaluate(`document.querySelector('#mInspector [data-army-save]').click()`);
  p=await saved();assert.equal(p.armyPresets.length,1);assert.ok(p.armyPresets[0].units.some(u=>u.glyph==='cavalry'));
  const presetId=p.armyPresets[0].id;
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);await change('#mInspector [data-mf="glyph"]','army');await change('#mInspector [data-army-preset]',`saved:${presetId}`);
  p=await saved();assert.deepEqual(p.actions[3].armyUnits,p.armyPresets[0].units,'saved mixed roster can be reused');
  await evaluate(`document.querySelector('[data-madd="effect"]').click()`);await change('#mInspector [data-mf="fx"]','cannonShot');await evaluate(`document.querySelector('#mInspector [data-mf="attackTargeted"]').click()`);
  await change('#mInspector [data-mf="from"]','48, -4');await change('#mInspector [data-mf="place"]','48, 4');
  await change('#mInspector [data-mf="attackSourceId"]',p.actions[2].id);await change('#mInspector [data-mf="attackTargetId"]',p.actions[0].id);
  p=await saved();const E=await import('../map-engine.mjs');E.validateMapProject(p);assert.equal(p.actions[4].attackTargeted,true);assert.equal(p.actions[4].attackTargetId,p.actions[0].id);
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);p=await saved();E.validateMapProject(p);assert.equal(p.actions[0].objectKeys.length,4);assert.equal(p.actions[1].path.length,3);assert.equal(p.armyPresets[0].name,'Red siege guard');
  // New miniatures must work as saved editor objects, not only as gallery art.
  const {MODERN_OBJECTS,CIVILIAN_OBJECTS}=await import('../map-modern-objects.mjs');
  await evaluate(`document.querySelector('[data-madd="object"]').click()`);await change('#mInspector [data-mf="glyph"]','car');
  assert.equal((await saved()).actions.at(-1).glyph,'car','civilian vehicles are selected inside Object');
  for(const [glyph,icon] of Object.entries({...MODERN_OBJECTS,...CIVILIAN_OBJECTS})){
    await change('#mInspector [data-mf="glyph"]',glyph);
    const project=await saved();E.validateMapProject(JSON.parse(JSON.stringify(project)));
    assert.equal(project.actions.at(-1).glyph,glyph,'picker saves '+glyph);
    assert.equal(project.actions.at(-1).color,icon.color,'new objects use their default palette');
  }
  const categories=await evaluate(`Array.from(document.querySelectorAll('#mInspector [data-mf="glyph"] optgroup')).map(group=>group.label)`);
  for(const category of ['Travel & civilian transport','Cities & everyday places','Infrastructure & clean energy','Nature & outdoors','Modern military'])assert.ok(categories.includes(category),'picker exposes '+category);
  await change('#mInspector [data-mf="glyph"]','ferry');await change('#mInspector [data-mf="__pinMove"]','move');
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  p=await saved();E.validateMapProject(p);assert.equal(p.actions.at(-1).glyph,'ferry');assert.equal(p.actions.at(-1).mode,'move','civilian movement survives project reload');
  for(const glyph of ['clock','stopwatch','hourglass','calendar']) {
    await evaluate(`document.querySelector('[data-madd="object"]').click()`);
    await change('#mInspector [data-mf="glyph"]',glyph);
    const project=await saved(); E.validateMapProject(project);
    assert.equal(project.actions.at(-1).glyph,glyph,'time props can be selected and saved');
  }
  assert.ok((await evaluate(`Array.from(document.querySelectorAll('#mInspector optgroup')).map(g=>g.label)`)).includes('Time & planning'));
  const beforeFilter=await saved();
  await change('#mInspector [data-object-type]','time');
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#mInspector [data-mf="glyph"] option:not(:disabled)')).map(o=>o.value)`),['clock','stopwatch','hourglass','calendar']);
  await change('#mInspector [data-object-type]','transport');
  assert.deepEqual(await saved(),beforeFilter,'browsing types leaves the project unchanged');
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf="glyph"]').value`),'','filtering offers only objects in the selected category');
  assert.ok(await evaluate(`Array.from(document.querySelectorAll('#mInspector [data-mf="glyph"] option:not(:disabled)')).every(o=>o.value!=='clock'&&o.value!=='calendar')`));
  await change('#mInspector [data-mf="glyph"]','ferry');
  assert.equal((await saved()).actions.at(-1).glyph,'ferry','filtered selection changes the object');
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-object-type]').value`),'transport','type selection survives inspector updates');
  await change('#mInspector [data-object-type]','time');
  await change('#mInspector [data-mf="glyph"]','calendar');
  await change('#mInspector [data-object-type]','all');
  assert.ok((await evaluate(`document.querySelectorAll('#mInspector [data-mf="glyph"] option').length`))>50,'All types restores the catalog');
  await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  assert.deepEqual((await saved()).actions.slice(-4).map(a=>a.glyph),['clock','stopwatch','hourglass','calendar'],'time props survive reload');
  const render=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs');const topo=await fetch('map-data/countries-50m.json').then(r=>r.json()),geo=E.buildGeo(topo),p=JSON.parse(localStorage.getItem('frameflow-map-v1'));
    const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');
    p.theme='paper';p.graticule=false;p.camera.init={lon:2,lat:48,zoom:4,pitch:0,bearing:0};
    for(const a of p.actions){a.enter='none';a.exit='none';a.dur=240;a.animDur=120;}
    p.actions[0].place={kind:'point',name:'Fort',lon:6,lat:47.8};p.actions[2].place={kind:'point',name:'Attackers',lon:-3,lat:47};p.actions[3].place={kind:'point',name:'Cavalry',lon:3,lat:45.7};
    p.actions[0].objectKeys=[{frame:0,values:{size:1.7,objectAngle:0,damageState:'intact'}},{frame:90,values:{size:2,objectAngle:0,damageState:'burning'}}];
    E.drawMap(x,1280,720,p,30,geo);const first=x.getImageData(0,0,1280,720).data;
    E.drawMap(x,1280,720,p,75,geo);const second=x.getImageData(0,0,1280,720).data;let animated=0;for(let i=0;i<first.length;i+=4)if(first[i]!==second[i]||first[i+1]!==second[i+1])animated++;
    const damageFrames=[];const isolated={...p,actions:[{...p.actions[0],objectKeys:[],size:2,objectAngle:0}]};
    for(const state of ['intact','damaged','burning','destroyed']){isolated.actions[0].damageState=state;E.drawMap(x,1280,720,isolated,60,geo);damageFrames.push(new Uint8ClampedArray(x.getImageData(0,0,1280,720).data));}
    const damageDifferent=damageFrames.slice(1).every((pixels,j)=>{let diff=0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==damageFrames[j][i]||pixels[i+1]!==damageFrames[j][i+1])diff++;return diff>40;});
    window.workflowProject=p;window.workflowGeo=geo;window.workflowCanvas=c;E.drawMap(x,1280,720,p,105,geo);document.body.replaceChildren(c);c.style.cssText='width:96vw;height:auto;display:block;margin:auto';
    return{animated,damageDifferent,png:c.toDataURL().startsWith('data:image/png')};
  })()`);
  assert.ok(render.animated>500);assert.ok(render.damageDifferent,'all four damage states look distinct');assert.ok(render.png);
  const video=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),{exportMapVideo}=await import('./map-video-export.mjs'),p=structuredClone(window.workflowProject),c=window.workflowCanvas;
    p.fps=24;p.frames=12;for(const a of p.actions){a.start=0;a.dur=12;a.animDur=12;delete a.objectKeys;}
    p.actions[0].objectKeys=[{frame:0,values:{size:1.5,objectAngle:0,damageState:'intact'}},{frame:3,values:{size:1.8,objectAngle:30,damageState:'damaged'}},{frame:6,values:{damageState:'burning'}},{frame:9,values:{damageState:'destroyed'}}];
    const blob=await exportMapVideo({canvas:c,fps:24,frames:12,draw:f=>E.drawMap(c.getContext('2d'),c.width,c.height,p,f,window.workflowGeo)});
    E.drawMap(c.getContext('2d'),c.width,c.height,window.workflowProject,105,window.workflowGeo);return{size:blob.size,type:blob.type};
  })()`);
  assert.ok(video.size>1000&&video.type==='video/webm','keyframed objects and battle scene encode to video');
  const screenshot=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'frameflow-object-workflows-review.png'),Buffer.from(screenshot.data,'base64'));
  const timeReview=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),{TIME_OBJECTS}=await import('./map-time-objects.mjs');
    const canvas=document.createElement('canvas');canvas.width=1000;canvas.height=300;
    const c=canvas.getContext('2d'),probe=document.createElement('canvas');probe.width=256;probe.height=256;
    const pc=probe.getContext('2d'),results=[];
    const snapshot=(icon,color,t)=>{pc.clearRect(0,0,256,256);pc.save();pc.translate(128,128);icon.draw(pc,85,color,t);pc.restore();return probe.toDataURL();};
    for(const [i,[glyph,icon]] of Object.entries(TIME_OBJECTS).entries()){
      const before=snapshot(icon,icon.color,0),after=snapshot(icon,icon.color,4);
      const stable=after===snapshot(icon,icon.color,4),colored=after!==snapshot(icon,'#a43fa1',4);
      const project=E.newMapProject();project.camera.init={lon:0,lat:0,zoom:2,bearing:0,pitch:0};
      project.actions=[E.makeAction('object',0,{glyph,color:icon.color,place:{kind:'point',lon:0,lat:0},size:3,enter:'none',idle:'none',exit:'none',dur:300})];
      project.fps=30;E.drawMap(pc,256,256,project,120,window.workflowGeo);const at30=probe.toDataURL();
      project.fps=60;E.drawMap(pc,256,256,project,240,window.workflowGeo);const equalSeconds=at30===probe.toDataURL();
      results.push({glyph,stable,colored,animated:before!==after,equalSeconds});
      c.save();c.translate(125+i*250,145);icon.draw(c,85,icon.color,4);c.restore();
      c.fillStyle='#293b48';c.font='18px Arial';c.textAlign='center';c.fillText(icon.label,125+i*250,268);
    }
    window.timeObjectReview=canvas.toDataURL();return results;
  })()`);
  for(const result of timeReview){
    assert.ok(result.stable&&result.colored&&result.equalSeconds,JSON.stringify(result));
    assert.equal(result.animated,result.glyph!=='calendar','clock, stopwatch and sand animate with timeline time');
  }
  await writeFile(join(tmpdir(),'frameflow-time-objects-review.png'),Buffer.from(await evaluate(`window.timeObjectReview.split(',')[1]`),'base64'));
  const modernReview=await evaluate(`(async()=>{
    const {MODERN_OBJECTS,CIVILIAN_OBJECTS}=await import('./map-modern-objects.mjs');
    const icons=Object.entries({...MODERN_OBJECTS,...CIVILIAN_OBJECTS});
    const c=document.createElement('canvas');c.width=1536;c.height=1080;const x=c.getContext('2d');
    x.fillStyle='#e7dfc9';x.fillRect(0,0,c.width,c.height);x.fillStyle='#334439';x.font='26px Georgia';x.fillText('Modern details & everyday map objects',38,43);
    const probe=document.createElement('canvas');probe.width=probe.height=256;const pc=probe.getContext('2d');
    let colored=0,deterministic=0;
    for(let i=0;i<icons.length;i++){
      const [key,icon]=icons[i],cx=128+(i%6)*256,cy=145+Math.floor(i/6)*196;
      x.save();x.translate(cx,cy);icon.draw(x,65,icon.color,.7);x.restore();
      x.fillStyle='#465747';x.font='13px Arial';x.textAlign='center';x.fillText(icon.label,cx,cy+81);
      const render=(color,time)=>{pc.clearRect(0,0,256,256);pc.save();pc.translate(128,128);icon.draw(pc,72,color,time);pc.restore();return probe.toDataURL();};
      const first=render(icon.color,.7);if(first===render(icon.color,.7))deterministic++;
      if(first!==render('#ce536a',.7))colored++;
    }
    const changed=[];for(const key of ['helicopter','drone','submarine','factory','bicycle','ferry','windTurbine','traveler']){
      const icon={...MODERN_OBJECTS,...CIVILIAN_OBJECTS}[key];
      pc.clearRect(0,0,256,256);pc.save();pc.translate(128,128);icon.draw(pc,72,icon.color,0);pc.restore();const before=probe.toDataURL();
      pc.clearRect(0,0,256,256);pc.save();pc.translate(128,128);icon.draw(pc,72,icon.color,.43);pc.restore();if(before!==probe.toDataURL())changed.push(key);
    }
    const E=await import('./map-engine.mjs'),project=E.newMapProject();project.theme='paper';project.camera.init={lon:0,lat:0,zoom:2,bearing:0,pitch:0};
    project.actions=[E.makeAction('object',0,{glyph:'windTurbine',color:'#839e91',place:{kind:'point',lon:0,lat:0},size:3,enter:'none',idle:'none',exit:'none',dur:240})];
    project.fps=30;E.drawMap(pc,256,256,project,30,window.workflowGeo);const atThirty=probe.toDataURL();
    project.fps=60;E.drawMap(pc,256,256,project,60,window.workflowGeo);const equalSeconds=atThirty===probe.toDataURL();
    document.body.replaceChildren(c);c.style.cssText='width:96vw;height:auto;display:block;margin:auto;box-shadow:none';
    return{total:icons.length,colored,deterministic,changed,equalSeconds};
  })()`);
  assert.equal(modernReview.total,30);assert.equal(modernReview.colored,30,'all modern and civilian illustrations respond to object color');
  assert.equal(modernReview.deterministic,30,'the same timeline time renders identical export frames');
  assert.equal(modernReview.changed.length,8,'rotors, propellers, wakes, smoke, wheels, turbines and walking animate');
  assert.equal(modernReview.equalSeconds,true,'modern object animation matches at equal elapsed seconds in 30 FPS and 60 FPS projects');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1200,deviceScaleFactor:1,mobile:false});
  await writeFile(join(tmpdir(),'frameflow-modern-civilian-objects-review.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[],'no runtime errors');console.log('Five object workflows passed: keyframes/timeline, drawn walls, damage states, saved armies, targeted attacks, reload, PNG and video encoding');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
