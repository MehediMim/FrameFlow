import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile,writeFile,mkdtemp,rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve,join,extname,sep } from 'node:path';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(browser,'Set CHROME_PATH to Chrome or Edge');
const profile=await mkdtemp(join(tmpdir(),'frameflow-strategy-'));
const server=createServer(async(req,res)=>{
  try{const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));assert.ok(path.startsWith(resolve(root)+sep));res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));}catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const port=server.address().port;
const chrome=spawn(browser,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-gpu','--window-size=1600,1100','about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
try{
  let debugPort;for(let i=0;i<100;i++){try{debugPort=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert.ok(debugPort,'Browser debugging started');
  const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json());ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j);});
  let serial=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>reject(Error(method+' timed out')),45000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100);}throw Error('Timed out: '+expression+'\n'+errors.join('\n'));};
  await cdp('Page.enable');
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html#map`});
  await cdp('Runtime.enable');
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);

  const result=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),T=await import('./map-strategy-terrain.mjs'),M=await import('./map-terrain-material.mjs');
    const geo=E.buildGeo(await fetch('map-data/countries-110m.json').then(r=>r.json()));
    const edge=document.createElement('canvas');edge.width=160;edge.height=120;const ec=edge.getContext('2d');
    const outline={n:4,X:[10,150,150,10],Y:[10,10,110,110]};
    T.drawZoneLandscape(ec,{project:(_v,x,y)=>({x,y,z:1})},{W:160,H:120,unit:1,near:0},{zoneTerrain:'farmland',terrainOpacity:1},outline,0,1,0);
    const edgeAlpha=[8,10,13,18,24,32,60].map(x=>ec.getImageData(x,60,1,1).data[3]);
    const contentFrames={},coverage={};
    for(const terrainContent of ['background','objects','both']){
      ec.clearRect(0,0,160,120);
      T.drawZoneLandscape(ec,{project:(_v,x,y)=>({x,y,z:1})},{W:160,H:120,unit:1,near:0},{zoneTerrain:'woodland',terrainOpacity:1,terrainContent},outline,0,1,0);
      contentFrames[terrainContent]=edge.toDataURL();
      const pixels=ec.getImageData(35,35,90,50).data;coverage[terrainContent]=0;
      for(let i=3;i<pixels.length;i+=4)if(pixels[i]>250)coverage[terrainContent]++;
    }
    const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;const c=canvas.getContext('2d');
    const p=E.newMapProject();p.mapBackground={mode:'blank',color:'#dee1d2'};p.graticule=false;p.atlasLabels={countries:false,oceans:false};p.frames=300;p.camera.init={lon:1,lat:46,zoom:5.3,pitch:0,bearing:0};
    const zone=E.makeAction('shape',0,{id:'terrain',shape:'zone',path:[{lon:-4,lat:42},{lon:6,lat:42},{lon:6,lat:49},{lon:-4,lat:49}],curve:'straight',networkAnimation:'static',zoneTerrain:'woodland',terrainSeed:42,dur:300,width:1});p.actions=[zone];
    const render=frame=>{E.drawMap(c,800,600,p,frame,geo);return canvas.toDataURL();};
    const first=render(90),stable=first===render(150);zone.terrainSeed=43;const reseeded=first!==render(90);zone.terrainSeed=42;
    const material=M.terrainMaterial('woodland',42),cacheReused=material===M.terrainMaterial('woodland',42),colors=new Set();
    const pixels=material.getContext('2d').getImageData(0,0,256,256).data;for(let i=0;i<pixels.length;i+=4)colors.add(pixels[i]+','+pixels[i+1]+','+pixels[i+2]);
    const sheet=document.createElement('canvas');sheet.width=1600;sheet.height=1350;const sc=sheet.getContext('2d');sc.fillStyle='#171f19';sc.fillRect(0,0,1600,1350);
    const images=[];for(const [i,kind]of Object.keys(T.TERRAIN_COLORS).entries()){
      zone.zoneTerrain=kind;images.push(render(90));sc.drawImage(canvas,i%4*400,Math.floor(i/4)*450,400,400);sc.fillStyle='#f2ead5';sc.font='18px Arial';sc.fillText(T.ZONE_TERRAINS[kind],i%4*400+18,Math.floor(i/4)*450+428);
    }
    window.terrainReview=sheet.toDataURL();zone.zoneTerrain='woodland';
    E.drawMap(c,800,600,{...p,actions:[]},90,geo);const before=c.getImageData(0,0,800,600).data;
    const v=E.drawMap(c,800,600,p,90,geo),after=c.getImageData(0,0,800,600).data,points=zone.path.map(q=>E.project(v,E.lonToX(q.lon),E.latToY(q.lat)));
    let leaked=0;for(let y=0;y<600;y++)for(let x=0;x<800;x++){
      const i=(y*800+x)*4;if(x>=Math.min(...points.map(q=>q.x))-3&&x<=Math.max(...points.map(q=>q.x))+3&&y>=Math.min(...points.map(q=>q.y))-3&&y<=Math.max(...points.map(q=>q.y))+3)continue;
      if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])leaked++;
    }
    zone.zoneTerrain='river';const animated=render(90)!==render(120);p.fps=60;const sameSeconds=render(180);p.fps=30;const fpsStable=sameSeconds===render(90);
    p.camera.init.pitch=40;p.camera.init.bearing=25;const tilted=render(90).length>10000;p.camera.init.pitch=0;p.camera.init.bearing=0;zone.zoneTerrain='woodland';
    const start=performance.now();for(let i=0;i<30;i++)E.drawMap(c,800,600,p,90+i,geo);const warmMs=(performance.now()-start)/30;
    const {exportMapVideo}=await import('./map-video-export.mjs');const blob=await exportMapVideo({canvas,fps:30,frames:6,draw:f=>E.drawMap(c,800,600,p,90+f,geo)});
    zone.zoneTerrain='farmland';const fields=render(90);zone.terrainDensity=2;const fieldDensity=fields!==render(90);zone.terrainDensity=1;zone.terrainScale=2;const fieldScale=fields!==render(90);zone.terrainScale=1;
    zone.curve='smooth';render(90);window.farmlandReview=canvas.toDataURL();localStorage.setItem('frameflow-map-v1',JSON.stringify(p));
    return {stable,reseeded,cacheReused,colors:colors.size,distinct:new Set(images).size,leaked,animated,fpsStable,tilted,warmMs,videoSize:blob.size,fieldDensity,fieldScale,edgeAlpha,contentDistinct:new Set(Object.values(contentFrames)).size,coverage};
  })()`);
  assert.ok(result.stable&&result.reseeded&&result.cacheReused,JSON.stringify(result));
  assert.ok(result.colors>1000,'materials contain fine color variation');assert.equal(result.distinct,12);assert.equal(result.leaked,0,'texture stays inside zone');
  assert.ok(result.animated&&result.fpsStable&&result.tilted,JSON.stringify(result));assert.ok(result.videoSize>1000);
  assert.ok(result.fieldDensity&&result.fieldScale,'farmland density and scale change field sizes');
  assert.equal(result.contentDistinct,3,'background, objects and combined content render independently');
  assert.equal(result.coverage.background,4500,'background fills the interior');
  assert.ok(result.coverage.objects>0&&result.coverage.objects<4000,'objects leave transparent ground between motifs: '+JSON.stringify(result.coverage));
  assert.equal(result.edgeAlpha[0],0,'feathering stays inside the drawn boundary');
  assert.ok(result.edgeAlpha[1]<10&&result.edgeAlpha[2]>result.edgeAlpha[1]&&result.edgeAlpha[3]>result.edgeAlpha[2]&&result.edgeAlpha[4]>result.edgeAlpha[3]&&result.edgeAlpha[5]===255&&result.edgeAlpha[6]===255,'terrain fades gradually to a sharp interior: '+result.edgeAlpha);
  await writeFile(join(tmpdir(),'frameflow-terrain-review.png'),Buffer.from((await evaluate('window.terrainReview')).split(',')[1],'base64'));
  await writeFile(join(tmpdir(),'frameflow-farmland-review.png'),Buffer.from((await evaluate('window.farmlandReview')).split(',')[1],'base64'));
  await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`document.querySelector('#mItems [data-mid="terrain"]').click()`);
  await waitFor(`!!document.querySelector('.m-shape-draw')`);
  assert.match(await evaluate(`document.querySelector('.m-shape-path-status').textContent`),/Closed boundary/);
  await evaluate(`document.querySelector('.m-shape-draw').click()`);
  const active=await evaluate(`(()=>{
    const b=document.querySelector('.m-shape-draw'),s=getComputedStyle(b);
    const luminance=color=>{const c=color.match(/[\\d.]+/g).slice(0,3).map(Number).map(v=>{v/=255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
    const a=luminance(s.color),z=luminance(s.backgroundColor);
    return {label:b.textContent,pressed:b.getAttribute('aria-pressed'),contrast:(Math.max(a,z)+.05)/(Math.min(a,z)+.05),disabled:b.disabled};
  })()`);
  assert.equal(active.label,'Finish drawing');assert.equal(active.pressed,'true');assert.equal(active.disabled,false);
  assert.ok(active.contrast>=4.5,'Finish drawing text has readable contrast: '+JSON.stringify(active));
  await writeFile(join(tmpdir(),'frameflow-terrain-editor.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`document.querySelector('.m-shape-draw').click()`);
  assert.equal(await evaluate(`document.querySelector('.m-shape-draw').getAttribute('aria-pressed')`),'false');
  assert.equal(await evaluate(`document.querySelector('.m-shape-draw').textContent`),'Edit on map');
  assert.equal(await evaluate(`document.querySelector('#mCanvas').style.cursor`),'');
  const change=async(key,value)=>evaluate(`(()=>{const el=document.querySelector('[data-mf="'+${JSON.stringify(key)}+'"]');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal(await evaluate(`document.querySelector('[data-mf="terrainContent"]').value`),'both','older terrain retains its combined appearance');
  await change('zoneTerrain','woodland');await change('terrainContent','background');
  assert.equal(await evaluate(`document.querySelector('[data-mf="terrainDensity"]')`),null,'background has no object density control');
  await change('terrainContent','objects');
  assert.ok(await evaluate(`!!document.querySelector('[data-mf="terrainDensity"]')`));
  const storedPath=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.find(a=>a.id==='terrain').path`);
  await evaluate(`document.querySelector('[data-madd="shape"]').click()`);
  await evaluate(`document.querySelector('[data-shape-choice="zone"]').click()`);
  await change('zoneTerrain','woodland');
  assert.equal(await evaluate(`document.querySelector('[data-mf="terrainContent"]').value`),'background','new terrain starts with the background alone');
  await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const savedContent=await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.find(a=>a.id==='terrain')`);
  assert.equal(savedContent.terrainContent,'objects');assert.deepEqual(savedContent.path,storedPath,'changing content preserves the boundary and persists after reload');
  assert.deepEqual(errors,[]);console.log('Terrain materials, cache reuse, seeds, clipping, all 12 landscapes, pitched camera, water animation and video passed',result);
}finally{
  ws?.close();chrome.kill();server.closeAllConnections();server.close();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
