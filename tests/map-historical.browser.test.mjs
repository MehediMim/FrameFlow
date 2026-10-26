import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const workspace=fileURLToPath(new URL('../',import.meta.url));
const browser=process.env.CHROME_PATH||['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(existsSync);
assert.ok(browser,'Set CHROME_PATH to a Chrome or Edge executable');
const profile=await mkdtemp(join(tmpdir(),'frameflow-historical-'));
const requests=[];let failHistorical=false;
const server=createServer(async(req,res)=>{
  try{
    requests.push(req.url);
    if(failHistorical&&req.url.includes('world-1300.json')){res.writeHead(503);res.end();return;}
    const path=resolve(workspace,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    assert.ok(path.startsWith(resolve(workspace)+sep));
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.json':'application/json','.css':'text/css'})[extname(path)]||'application/octet-stream');
    res.end(await readFile(path.endsWith(sep)?join(path,'index.html'):path));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
let browserLog='';
const chrome=spawn(browser,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-gpu','--window-size=1600,1000','about:blank'],{windowsHide:true,stdio:['ignore','ignore','pipe']});
chrome.stderr.on('data',chunk=>{browserLog+=chunk;});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try{
  let debugPort;
  for(let i=0;i<150;i++){
    try{debugPort=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}
  }
  assert.ok(debugPort,'Browser debugging did not start: '+browserLog.slice(-2000));
  const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json());
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,reject)=>{ws.addEventListener('open',r);ws.addEventListener('error',reject);});
  let serial=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const message=JSON.parse(event.data);
    if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails.exception?.description||message.params.exceptionDetails.text);
    if(message.id){const p=pending.get(message.id);pending.delete(message.id);message.error?p.reject(Error(message.error.message)):p.resolve(message.result);}
  });
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{
    const id=++serial,timer=setTimeout(()=>reject(Error('Debugger timeout: '+method)),45000);
    pending.set(id,{resolve:value=>{clearTimeout(timer);resolve(value);},reject:error=>{clearTimeout(timer);reject(error);}});
    ws.send(JSON.stringify({id,method,params}));
  });
  const evaluate=async expression=>{
    const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor=async expression=>{
    for(let i=0;i<150;i++){if(await evaluate(expression))return;await sleep(100);}
    throw Error(`Timed out: ${expression}\n${errors.join('\n')}`);
  };
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html#map`});
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  assert.ok(!requests.some(path=>path.includes('world-1300.json')),'modern projects do not download historical data');
  const source=value=>evaluate(`(()=>{const el=document.querySelector('#mMapBackground');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const historicalReady=`[...document.querySelectorAll('#mDlCountry option')].some(o=>o.value==='Yuan Dynasty')`;
  await source('historical1300');await waitFor(historicalReady);
  assert.equal(await evaluate(`document.querySelectorAll('#mDlCountry option').length`),151);
  assert.equal(await evaluate(`document.querySelectorAll('#mDlPlace option').length`),0);
  assert.equal(await evaluate(`document.querySelector('#mAreaBox').hidden`),true);
  assert.equal(await evaluate(`document.querySelector('#mAtlasLabels').hidden`),false);
  assert.ok(await evaluate(`document.querySelector('#mMapBackgroundNote').textContent.includes('CC BY 4.0')`));
  await evaluate(`document.querySelector('#mAddGrid [data-madd="highlight"]').click()`);
  const saved=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  assert.ok((await saved()).actions.at(-1).target.name!=='Australia','new highlights default to a historical territory');
  const yuanPoint=await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),zoom:i.zoom,pitch:0,bearing:0},p.width,p.height),q=E.project(v,E.lonToX(108.94),E.latToY(34.34)),r=document.querySelector('#mCanvas').getBoundingClientRect();return{x:r.x+q.x/p.width*r.width,y:r.y+q.y/p.height*r.height};})()`);
  for(const button of ['left','right'])for(const type of ['mousePressed','mouseReleased'])await cdp('Input.dispatchMouseEvent',{type,...yuanPoint,button,buttons:type==='mouseReleased'?0:button==='right'?2:1,clickCount:1});
  await evaluate(`document.querySelector('#mMapAddContext [data-direct-border]').click()`);
  assert.equal((await saved()).actions.at(-1).target.name,'Yuan Dynasty','direct historical territory selection creates a border');
  await source('modern');await waitFor(`[...document.querySelectorAll('#mDlCountry option')].some(o=>o.value==='India')`);
  await source('historical1300');await waitFor(historicalReady);
  assert.equal(requests.filter(path=>path.includes('world-1300.json')).length,1,'switching back reuses the historical map');
  const expected=await saved();
  await evaluate(`location.reload()`);await waitFor(historicalReady);
  assert.deepEqual(await saved(),expected,'historical source and layers survive reload');
  const parity=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),S=await import('./map-sources.mjs'),g=await S.createMapSources().load('historical1300'),p=E.newMapProject();
    p.mapBackground={mode:'historical1300'};p.atlasLabels={countries:true};p.camera.init={lon:80,lat:30,zoom:2.2,pitch:0,bearing:0};
    const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');
    E.drawMap(x,1280,720,p,0,g,null,{cacheBase:true});E.drawMap(x,1280,720,p,0,g,null,{cacheBase:true});
    const preview=c.toDataURL();E.drawMap(x,1280,720,p,0,g);return preview===c.toDataURL();
  })()`);
  assert.equal(parity,true,'cached preview and exported frame have identical pixels');
  await writeFile(join(tmpdir(),'frameflow-historical-1300.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  // Failure must show a retry action rather than drawing the modern map.
  failHistorical=true;await evaluate(`location.reload()`);
  await waitFor(`document.querySelector('#mMapSourceRetry')&&!document.querySelector('#mMapSourceRetry').hidden`);
  assert.equal(await evaluate(`document.querySelectorAll('#mDlCountry option').length`),0);
  failHistorical=false;await evaluate(`document.querySelector('#mMapSourceRetry').click()`);await waitFor(historicalReady);
  assert.deepEqual(errors,[]);
  console.log('AD 1300 browser: on-demand loading, historical targets, source switching, reload, preview/export pixel parity and retry passed.');
}finally{
  ws?.close();chrome.kill();server.closeAllConnections();server.close();
  await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
