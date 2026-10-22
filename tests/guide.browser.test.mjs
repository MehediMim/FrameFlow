import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { resolve, join, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LESSONS } from '../guide-lessons.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(browser,'Set CHROME_PATH to Chrome or Edge');
const profile=await mkdtemp(join(tmpdir(),'frameflow-guide-'));
const missing=[];
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(root,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    assert.ok(path.startsWith(resolve(root)+sep));
    res.setHeader('Content-Type',({'.html':'text/html','.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml'})[extname(path)]||'application/octet-stream');
    res.end(await readFile(path));
  }catch{if(req.url!=='/favicon.ico')missing.push(req.url);res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const chrome=spawn(browser,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-gpu','--window-size=1440,1100','about:blank'],{windowsHide:true,stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let ws;
try{
  let debugPort;
  for(let i=0;i<100;i++){try{debugPort=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert.ok(debugPort,'Browser debugging started');
  const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`).then(r=>r.json());
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,j)=>{ws.addEventListener('open',r);ws.addEventListener('error',j);});
  let serial=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',event=>{
    const msg=JSON.parse(event.data);
    if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}
  });
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial,timer=setTimeout(()=>reject(Error(method+' timed out')),30000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(result.exceptionDetails.exception?.description||result.exceptionDetails.text);return result.result.value;};
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}throw Error(`Timed out: ${expression}\n${errors.join('\n')}`);};
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1100,deviceScaleFactor:1,mobile:false});
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/guide.html#damage`});
  await waitFor(`document.querySelector('#lessonTitle')?.textContent==='Animate damage & destruction'`);
  assert.equal(await evaluate(`document.querySelector('#playDemo').getAttribute('aria-pressed')`),'false','reduced motion disables autoplay');
  assert.deepEqual(await evaluate(`(()=>{const css=getComputedStyle(document.querySelector('#playDemo'));return {radius:css.borderRadius,color:css.color,icon:!!document.querySelector('#playDemo .ff-icon')};})()`),{radius:'6px',color:'rgb(233, 238, 232)',icon:true},'guide playback uses shared neutral controls and stroke icons');
  await evaluate(`localStorage.setItem('frameflow-map-v1','project-sentinel')`);
  await waitFor(`document.querySelectorAll('#lessonNav a').length===${LESSONS.length}`);
  const seek=async value=>evaluate(`(()=>{const slider=document.querySelector('#demoSeek');slider.value=${value};slider.dispatchEvent(new Event('input',{bubbles:true}));return document.querySelector('canvas').toDataURL();})()`);
  const frames=[];
  for(const item of LESSONS){
    await evaluate(`location.hash=${JSON.stringify(item.id)}`);
    await waitFor(`document.querySelector('#lessonTitle').textContent===${JSON.stringify(item.title)}`);
    assert.equal(await evaluate(`document.querySelectorAll('#lessonSteps button').length`),3);
    const first=await seek(80),second=await seek(550),third=await seek(950);
    assert.ok(first!==second||second!==third,`${item.id}: demonstration changes across steps`);
    assert.equal(third,await seek(950),`${item.id}: scrubbing is repeatable`);
    frames.push(item.id);
  }
  await evaluate(`document.querySelector('#lessonSearch').value='falling debris';document.querySelector('#lessonSearch').dispatchEvent(new Event('input'))`);
  assert.deepEqual(await evaluate(`[...document.querySelectorAll('#lessonNav a')].map(a=>a.hash)`),['#damage'],'search includes toolkit details');
  await evaluate(`document.querySelector('#lessonSearch').value='zzzz-no-feature';document.querySelector('#lessonSearch').dispatchEvent(new Event('input'))`);
  assert.equal(await evaluate(`document.querySelector('#noLessons').hidden`),false);
  await evaluate(`document.querySelector('#clearSearch').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('#lessonNav a').length`),LESSONS.length);
  await evaluate(`location.hash='routes'`);await waitFor(`document.querySelector('#lessonTitle').textContent==='Animate a journey'`);
  await evaluate(`document.querySelector('[data-step="1"]').click()`);
  assert.equal(await evaluate(`document.querySelector('#playDemo').getAttribute('aria-pressed')`),'false');
  assert.equal(await evaluate(`document.querySelector('#stepNumber').textContent`),'2');
  await evaluate(`document.querySelector('#nextLesson').click()`);await waitFor(`location.hash==='#networks'&&document.querySelector('#lessonTitle').textContent.includes('railways')`);
  await cdp('Page.reload');await waitFor(`document.querySelector('#lessonTitle')?.textContent==='Draw roads, railways & rivers'`);
  await evaluate(`document.querySelector('#playDemo').click()`);
  const time=await evaluate(`document.querySelector('#demoSeek').value`);await sleep(350);
  assert.notEqual(await evaluate(`document.querySelector('#demoSeek').value`),time,'explicit play advances animation');
  await evaluate(`document.querySelector('#playDemo').click()`);
  const paused=await evaluate(`document.querySelector('#demoSeek').value`);await sleep(150);
  assert.equal(await evaluate(`document.querySelector('#demoSeek').value`),paused,'pause holds the frame');
  await evaluate(`document.querySelector('#replayDemo').click()`);
  assert.equal(await evaluate(`document.querySelector('#playDemo').getAttribute('aria-pressed')`),'true');
  await evaluate(`document.querySelector('#playDemo').click()`);
  assert.equal(await evaluate(`localStorage.getItem('frameflow-map-v1')`),'project-sentinel','guide does not modify the editor project');
  for(const width of [1440,900,390]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1100,deviceScaleFactor:1,mobile:width<720});
    assert.equal(await evaluate(`document.documentElement.scrollWidth<=innerWidth`),true,`${width}px has no horizontal overflow`);
    const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});
    await writeFile(join(tmpdir(),`frameflow-guide-${width}.png`),Buffer.from(shot.data,'base64'));
  }
  const home=await readFile(join(root,'index.html'),'utf8');
  assert.ok(home.includes('href="guide.html"'),'site links to the guide');
  assert.deepEqual(missing,[],'all guide dependencies load');assert.deepEqual(errors,[],'no runtime errors in any lesson');
  console.log(`${frames.length} animated lessons passed: deep links, all demo steps, deterministic scrubbing, search, playback, reduced motion, desktop/tablet/mobile layouts and project isolation`);
}finally{
  ws?.close();chrome.kill();server.closeAllConnections();server.close();
  await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
