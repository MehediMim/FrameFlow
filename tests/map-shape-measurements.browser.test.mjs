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
assert.ok(browser,'Set CHROME_PATH to Chrome or Edge');
const profile=await mkdtemp(join(tmpdir(),'frameflow-measurements-'));
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(workspace,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    assert.ok(path.startsWith(resolve(workspace)+sep));
    const file=path.endsWith(sep)?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json'})[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const chrome=spawn(browser,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-gpu','--window-size=1600,1000','about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try{
  let debugPort;
  for(let i=0;i<100;i++){try{debugPort=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert.ok(debugPort,'Browser debugging started');
  const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json());
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,reject)=>{ws.addEventListener('open',r);ws.addEventListener('error',reject);});
  let serial=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',e=>{
    const msg=JSON.parse(e.data);
    if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);if(p)msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}
  });
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>reject(Error('Debugger timeout: '+method)),45000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100);}throw Error(`Timed out: ${expression}\n${errors.join('\n')}`);};
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(el.type==='checkbox')el.checked=${JSON.stringify(value)};else el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const select=id=>evaluate(`document.querySelector('#mItems [data-mid="${id}"]').click()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);

  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html#map`});
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  await evaluate(`document.querySelector('[data-madd="shape"]').click()`);
  assert.ok(await evaluate(`['distance','area'].every(value=>document.querySelector('[data-mf="shape"] option[value="'+value+'"]'))`),'Distance and Area are entries in the existing shape dropdown');
  assert.equal(await evaluate(`document.querySelector('[data-mf="showMeasurement"]')`),null,'attack arrow has no measurement checkbox');
  await evaluate(`document.querySelector('[data-mpath="draw"]').click()`);
  await change('[data-mf="shape"]','distance');
  assert.ok(await evaluate(`!!document.querySelector('[data-mf="showDistanceArrow"]')`));
  assert.equal(await evaluate(`document.querySelector('[data-path-capture]')`),null,'measurement shapes have no animation controls');
  await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),p=E.newMapProject();p.frames=300;p.camera.init={lon:3,lat:3,zoom:4,bearing:0,pitch:0};
    const pt=(lon,lat)=>({lon,lat});
    p.actions=[E.makeAction('shape',0,{id:'distance',shape:'distance',dur:240,path:[pt(0,2),pt(4,2)]}),E.makeAction('shape',0,{id:'area',shape:'area',dur:240,path:[pt(0,0),pt(1,0),pt(1,1),pt(0,1)]})];
    localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();
  })()`);
  await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===2&&document.querySelectorAll('#mDlCountry option').length>100`);
  await change('#mFrame',2);
  await select('distance');
  const original=(await stored()).actions[0].path;
  await change('[data-mf="showDistanceArrow"]',true);
  assert.deepEqual((await stored()).actions[0].path,original,'optional arrow keeps the measured endpoints');
  await change('[data-mf="__lscustom"]',true);
  await change('[data-mf="measurementUnit"]','imperial');
  assert.ok(await evaluate(`document.querySelector('[data-shape-measurement]').textContent.includes('mi')`));
  await change('[data-mf="measurementUnit"]','metric');
  await select('area');
  assert.equal(await evaluate(`document.querySelector('[data-mf="shape"]').value`),'area');
  assert.ok(await evaluate(`document.querySelector('[data-shape-measurement]').textContent.includes('Area:')`));
  await change('[data-mf="showAreaBoundary"]',true);
  await change('[data-mf="measurementUnit"]','imperial');
  const rendering=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),{exportMapVideo}=await import('./map-video-export.mjs');
    const p=JSON.parse(localStorage.getItem('frameflow-map-v1')),geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    p.actions=p.actions.filter(a=>a.id!=='empty');
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const c=canvas.getContext('2d'),texts=[];
    const fill=c.fillText.bind(c);c.fillText=(text,...args)=>{texts.push(text);return fill(text,...args);};
    E.drawMap(c,640,360,p,60,geo);const png=canvas.toDataURL();
    const blob=await exportMapVideo({canvas,fps:24,frames:3,draw:frame=>E.drawMap(c,640,360,p,60+frame,geo)});
    return {texts,bytes:blob.size,png};
  })()`);
  assert.ok(rendering.texts.some(t=>t.endsWith(' km')),'distance is drawn with the arrow and in exports');
  assert.ok(rendering.texts.some(t=>t.endsWith(' mi\u00b2')),'area is drawn with the zone and in exports');
  assert.ok(rendering.bytes>100,'measurement labels support video export');
  await writeFile(join(tmpdir(),'frameflow-shape-measurements.png'),Buffer.from(rendering.png.split(',')[1],'base64'));
  const saved=await stored();
  await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mItems [data-mid]').length===2`);
  assert.deepEqual(await stored(),saved,'measurement options and shape geometry survive reload');
  await select('area');
  assert.equal(await evaluate(`document.querySelector('[data-mf="showAreaBoundary"]').checked`),true);
  assert.equal(await evaluate(`document.querySelector('[data-mf="measurementUnit"]').value`),'imperial');
  assert.deepEqual(errors,[],'no browser runtime errors');
  console.log('Distance and Area shape choices, optional arrows and boundaries, units, persistence and video export passed');
}finally{
  ws?.close();chrome.kill();server.closeAllConnections();server.close();
  await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
