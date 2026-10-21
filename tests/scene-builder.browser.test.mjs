import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace=fileURLToPath(new URL('../',import.meta.url));
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(browser,'Chrome or Edge is required');
const profile=await mkdtemp(join(tmpdir(),'frameflow-builder-'));
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(workspace,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));assert.ok(path.startsWith(resolve(workspace)+sep));
    res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json'})[extname(path)]||'application/octet-stream');res.end(await readFile(path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const chrome=spawn(browser,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-gpu','--window-size=1600,1000','about:blank'],{windowsHide:true,stdio:'ignore'});
let ws;const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let port;for(let i=0;i<100;i++){try{port=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert.ok(port,'Browser debugger did not start');
  const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(r=>r.json());
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);await new Promise(r=>ws.addEventListener('open',r));
  let serial=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}});
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>reject(Error(`Timeout: ${method}`)),30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}throw Error(`Timed out: ${expression}\n${errors.join('\n')}`);};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const change=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-scene-v2'))`);
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/index.html#scene`});
  await waitFor(`document.querySelectorAll('[data-preset]').length===8`);
  await click('[data-mode="scene"]');
  assert.ok(await evaluate(`document.querySelectorAll('[data-add-sc]').length>=45`));
  await change('[data-field="assetCategory"]','Buildings');
  assert.equal(await evaluate(`!!document.querySelector('[data-add-sc="house"]')`),true);
  assert.equal(await evaluate(`!!document.querySelector('[data-add-sc="sofa"]')`),false);
  await change('[data-field="assetCategory"]','all');
  await evaluate(`(()=>{const e=document.querySelector('#scAssetSearch');e.value='sofa';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-add-sc]').length`),1);
  await evaluate(`(()=>{const e=document.querySelector('#scAssetSearch');e.value='';e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  for(const id of ['village','farm','riverside','park','plaza','room','cast','city']) {
    await click(`[data-preset="${id}"]`);
    assert.equal((await stored()).name,({village:'Village lane',farm:'Countryside farm',riverside:'Riverside',park:'Community park',plaza:'Market square',room:'Living room',cast:'Character lineup',city:'City intersection'})[id]);
    assert.ok(await evaluate(`document.querySelector('#scCanvas').toDataURL().length>10000`));
  }
  await click('[data-preset="cast"]');
  await change('[data-field="look.body"]','woman');await change('[data-field="look.hair"]','bun');await change('[data-field="look.glasses"]','true');await change('[data-field="look.expression"]','serious');
  let p=await stored();assert.equal(p.objects.find(o=>o.type==='human').look.body,'woman');assert.equal(p.objects.find(o=>o.type==='human').look.glasses,true);
  await click('[data-action="undo"]');assert.equal((await stored()).objects.find(o=>o.type==='human').look.expression,'happy');
  await click('[data-action="redo"]');
  await click('#scSettingsButton');await change('[data-field="environmentPreset"]','golden');await click('#scSettingsClose');
  assert.equal((await stored()).sky,'#efc3a0');
  const renders=await evaluate(`(async()=>{const {buildScenePreset}=await import('./scene-presets.mjs');const {renderScene}=await import('./scene-engine.mjs?v=builder-3');const c=document.createElement('canvas');c.width=1280;c.height=720;const images={};for(const id of ['cast','village','farm','room']){renderScene(c,buildScenePreset(id),0);images[id]=c.toDataURL();}return images;})()`);
  for(const [id,png] of Object.entries(renders))await writeFile(join(tmpdir(),`frameflow-builder-${id}.png`),Buffer.from(png.split(',')[1],'base64'));
  await click('[data-preset="village"]');
  const house=(await stored()).objects.find(o=>o.type==='house');await click(`[data-item="${house.id}"]`);
  await change('[data-field="object.width"]','8');await change('[data-field="object.roof"]','flat');await change('[data-field="object.windows"]','false');
  await click('[data-action="duplicate"]');p=await stored();assert.equal(p.objects.filter(o=>o.type==='house').length,4);
  await click('[data-action="undo"]');assert.equal((await stored()).objects.filter(o=>o.type==='house').length,3);
  p=await stored();await evaluate('location.reload()');await waitFor(`document.querySelectorAll('[data-preset]').length===8`);assert.deepEqual(await stored(),p);
  await click('[data-action="view2d"]');await click('[data-add-sc="pine"]');
  const point=await evaluate(`(()=>{const r=document.querySelector('#scCanvas').getBoundingClientRect();return{x:r.x+r.width*.5,y:r.y+r.height*.5};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',clickCount:1});
  assert.equal((await stored()).objects.at(-1).type,'pine');
  assert.equal((await stored()).objects.at(-1).grounding,'terrain','new props follow the landscape');
  await click('[data-action="view3d"]');
  await click('[data-texture-pack="coastal"]');assert.equal((await stored()).texturePack,'coastal');
  await click('[data-action="undo"]');assert.equal((await stored()).texturePack,'village');
  await click('[data-action="redo"]');assert.equal((await stored()).texturePack,'coastal');
  await click('[data-action="terrain-settings"]');
  await change('[data-field="terrain.type"]','dunes');await change('[data-field="terrain.height"]','12');await change('[data-field="terrain.seed"]','42');
  await change('[data-field="textureStrength"]','0.5');await click('#scSettingsClose');
  p=await stored();assert.equal(p.terrain.type,'dunes');assert.equal(p.terrain.seed,42);assert.equal(p.textureStrength,.5);
  const pine=p.objects.at(-1);await change('[data-field="object.surfaceTexture"]','bark');await change('[data-field="object.textureScale"]','2');
  assert.equal((await stored()).objects.find(o=>o.id===pine.id).surfaceTexture,'bark');
  await click('[data-add-sc="terrain"]');
  const terrainPoint=await evaluate(`(()=>{const r=document.querySelector('#scCanvas').getBoundingClientRect();return{x:r.x+r.width*.7,y:r.y+r.height*.35};})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...terrainPoint,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...terrainPoint,button:'left',clickCount:1});
  assert.equal((await stored()).objects.at(-1).type,'terrain');
  await change('[data-field="object.terrainProfile"]','ridged');await change('[data-field="object.height"]','8');
  assert.equal((await stored()).objects.at(-1).terrainProfile,'ridged');await click('[data-action="view3d"]');
  const materialResult=await evaluate(`(async()=>{
    const E=await import('./scene-engine.mjs?v=builder-3'),M=await import('./scene-environment.mjs');
    const c=document.createElement('canvas');c.width=960;c.height=540;const g=c.getContext('2d',{willReadFrequently:true});
    const p=E.defaultScene();Object.assign(p,{baseRoad:false,left:'none',right:'none',material:'texture',cameraClips:[],objects:[{...E.makeObject('house'),z:3,endZ:3}],textureStrength:.7});
    Object.assign(p.camera,{move:'static',fixedX:10,fixedZ:-13,aimX:0,aimZ:3,height:7});
    const hash=()=>{const a=g.getImageData(0,0,c.width,c.height).data;let h=2166136261;for(let i=0;i<a.length;i+=4)h=Math.imul(h^a[i]^a[i+1]<<8^a[i+2]<<16,16777619);return h>>>0;};
    const textures={};p.texturePack='none';
    for(const id of ['none',...Object.keys(M.SURFACE_TEXTURES)]){p.objects[0].surfaceTexture=id;E.validateScene(p);E.renderScene(c,p,0);textures[id]=hash();}
    const packs={};p.objects[0].surfaceTexture='auto';
    for(const id of Object.keys(M.TEXTURE_PACKS)){M.applyTexturePack(p,id);E.renderScene(c,p,0);packs[id]=hash();}
    M.applyTexturePack(p,'storybook');const terrains={};
    for(const type of Object.keys(M.TERRAIN_TYPES)){p.terrain={...M.DEFAULT_TERRAIN,type,height:14,flatRadius:12};E.renderScene(c,p,0);terrains[type]=hash();}
    E.renderScene(c,p,0);const first=hash();E.renderScene(c,p,0);const deterministic=hash()===first;
    const png=await new Promise(r=>c.toBlob(r,'image/png'));
    return{textures,packs,terrains,deterministic,pngSize:png.size,image:c.toDataURL()};
  })()`);
  assert.equal(new Set(Object.values(materialResult.textures)).size,Object.keys(materialResult.textures).length,'every surface texture changes actual pixels');
  assert.equal(new Set(Object.values(materialResult.packs)).size,7,'each pack has a distinct rendered appearance');
  assert.equal(new Set(Object.values(materialResult.terrains)).size,4,'all terrain profiles render distinct geometry');
  assert.equal(materialResult.deterministic,true,'textures stay stable between frames');assert.ok(materialResult.pngSize>10000);
  await writeFile(join(tmpdir(),'frameflow-materials-review.png'),Buffer.from(materialResult.image.split(',')[1],'base64'));
  p=await stored();await evaluate('location.reload()');await waitFor(`document.querySelectorAll('[data-preset]').length===8`);assert.deepEqual(await stored(),p,'new materials and terrain survive reload');
  await click('[data-action="view3d"]');
  await click('[data-action="story-demo"]');p=await stored();assert.equal(p.name,'An afternoon in the park');assert.equal(p.savedCameras.length,3);assert.equal(p.cameraClips.length,2);
  const firstHuman=p.objects.find(o=>o.type==='human'),otherHuman=p.objects.filter(o=>o.type==='human')[1];
  await change('[data-field="object.carry"]','box');await click('[data-action="sit-on-seat"]');
  p=await stored();assert.equal(p.objects.find(o=>o.id===firstHuman.id).clips.at(-1).gesture,'sit');
  const seatResult=await evaluate(`(async()=>{const E=await import('./scene-engine.mjs?v=builder-3'),p=JSON.parse(localStorage.getItem('frameflow-scene-v2'));const o=p.objects.find(o=>o.id===${JSON.stringify(firstHuman.id)});return E.characterState(p,o,1).seat?.id;})()`);
  assert.equal(seatResult,firstHuman.seatId);
  await click('[data-action="select-owner"]');await click('[data-action="talk-pair"]');p=await stored();assert.equal(p.objects.find(o=>o.id===otherHuman.id).talkTarget,firstHuman.id);assert.equal(p.objects.find(o=>o.id===otherHuman.id).clips.at(-1).gesture,'talk');
  await click('[data-action="atmosphere-settings"]');await change('#scSettings [data-field="weatherPreset"]','rain');await change('[data-field="atmosphere.wind"]','0.7');await click('#scSettingsClose');assert.equal((await stored()).atmosphere.rain,.65);
  const layoutClick=async(x,y)=>{const pt=await evaluate(`(()=>{const r=document.querySelector('#scCanvas').getBoundingClientRect();return{x:r.x+r.width*${x},y:r.y+r.height*${y}};})()`);await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...pt,button:'left',clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...pt,button:'left',clickCount:1});};
  const escape=()=>evaluate(`document.activeElement?.blur();document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);
  const path=(await stored()).objects.find(o=>o.type==='path');await click(`[data-item="${path.id}"]`);await click('[data-action="draw-scenery-curve"]');
  await layoutClick(.35,.65);await layoutClick(.5,.4);await layoutClick(.65,.5);await escape();p=await stored();assert.equal(p.objects.find(o=>o.id===path.id).curvePoints.length,3);
  await click('[data-action="sculpt-raise"]');await layoutClick(.85,.3);assert.equal((await stored()).terrain.sculpt.length,1);await click('[data-action="undo"]');assert.equal((await stored()).terrain.sculpt?.length??0,0);await click('[data-action="redo"]');assert.equal((await stored()).terrain.sculpt.length,1);
  const countBefore=(await stored()).objects.length;await change('[data-field="tool.radius"]','12');await click('[data-action="scatter-plants"]');await layoutClick(.8,.8);await escape();assert.ok((await stored()).objects.length>countBefore);await click('[data-action="undo"]');assert.equal((await stored()).objects.length,countBefore);await click('[data-action="redo"]');
  await click('[data-action="view3d"]');await change('[data-field="tool.cameraName"]','New angle');await click('[data-action="save-camera-view"]');p=await stored();assert.equal(p.savedCameras.length,4);
  await change('[data-field="tool.fromCamera"]',p.savedCameras[0].id);await change('[data-field="tool.toCamera"]',p.savedCameras[3].id);await click('[data-action="connect-camera-views"]');p=await stored();assert.deepEqual(p.cameraClips.at(-1).fromPose,p.savedCameras[0].pose);
  await change('[data-field="toPos.0"]','15');assert.equal((await stored()).cameraClips.at(-1).toPose.pos[0],15);await click('[data-action="swap-camera-ends"]');assert.equal((await stored()).cameraClips.at(-1).fromPose.pos[0],15);
  await click('[data-action="camera-sequence"]');assert.equal((await stored()).cameraClips.length,6);
  const storyRender=await evaluate(`(async()=>{
    const E=await import('./scene-engine.mjs?v=builder-3');const p=JSON.parse(localStorage.getItem('frameflow-scene-v2'));const c=document.createElement('canvas');c.width=960;c.height=540;const g=c.getContext('2d',{willReadFrequently:true});
    const fingerprint=()=>{let h=0;for(const n of g.getImageData(0,0,c.width,c.height).data)h=(Math.imul(h,31)+n)|0;return h;};
    E.renderScene(c,p,1);const first=fingerprint();E.renderScene(c,p,1);const same=fingerprint()===first;E.renderScene(c,p,2);const moved=fingerprint()!==first;
    const png=await new Promise(r=>c.toBlob(r,'image/png'));return{same,moved,size:png.size,image:c.toDataURL()};
  })()`);
  assert.equal(storyRender.same,true);assert.equal(storyRender.moved,true);assert.ok(storyRender.size>10000);await writeFile(join(tmpdir(),'frameflow-story-review.png'),Buffer.from(storyRender.image.split(',')[1],'base64'));
  p=await stored();await evaluate('location.reload()');await waitFor(`document.querySelectorAll('[data-preset]').length===8`);assert.deepEqual(await stored(),p,'story camera endpoints, interactions, weather, sculpt and curves persist');await click('[data-action="view3d"]');
  await writeFile(join(tmpdir(),'frameflow-builder-ui.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(errors,[]);
  console.log('Scene builder browser: materials, weather, chair/conversation/carry interactions, camera library/sequences, curved scenery, sculpt/scatter, stable animation, PNG, undo/redo and reload passed');
}finally{
  ws?.close();chrome.kill();server.closeAllConnections();server.close();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
