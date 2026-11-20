import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {spawn} from 'node:child_process';
import {tmpdir} from 'node:os';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const workspace=fileURLToPath(new URL('../',import.meta.url));
const browser=process.env.CHROME_PATH||['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'].find(existsSync);
assert.ok(browser,'Set CHROME_PATH to a Chrome or Edge executable');
const profile=await mkdtemp(join(tmpdir(),'frameflow-storyboard-'));
const server=createServer(async(req,res)=>{
  try{
    const path=resolve(workspace,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    assert.ok(path.startsWith(resolve(workspace)+sep));
    const file=path.endsWith(sep)?join(path,'index.html'):path;
    res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.txt':'text/plain'})[extname(file)]||'application/octet-stream');
    res.end(await readFile(file));
  }catch{res.writeHead(404);res.end();}
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const port=server.address().port;
const chrome=spawn(browser,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--disable-background-networking','--disable-gpu','--window-size=1600,1000','about:blank'],{windowsHide:true,stdio:'ignore'});
chrome.on('error',e=>console.error(e.message));
let ws;
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
try{
  let debugPort;
  for(let i=0;i<100;i++){try{debugPort=(await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];break;}catch{await sleep(100);}}
  assert.ok(debugPort,'Browser debugging did not start');
  const pages=await fetch(`http://127.0.0.1:${debugPort}/json/list`,{signal:AbortSignal.timeout(10000)}).then(r=>r.json());
  ws=new WebSocket(pages.find(p=>p.type==='page').webSocketDebuggerUrl);
  await new Promise((r,reject)=>{ws.addEventListener('open',r);ws.addEventListener('error',reject);});
  let serial=0;const pending=new Map(),errors=[];
  ws.addEventListener('message',e=>{
    const msg=JSON.parse(e.data);
    if(msg.method==='Runtime.exceptionThrown')errors.push(msg.params.exceptionDetails.exception?.description||msg.params.exceptionDetails.text);
    if(msg.id){const p=pending.get(msg.id);pending.delete(msg.id);msg.error?p.reject(Error(msg.error.message)):p.resolve(msg.result);}
  });
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++serial;const timer=setTimeout(()=>reject(Error(`Debugger timeout: ${method}`)),45000);pending.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});ws.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
  const waitFor=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await sleep(100);}throw Error(`Timed out: ${expression}\n${errors.join('\n')}`);};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  const upload=async name=>{
    const doc=await cdp('DOM.getDocument');const {nodeId}=await cdp('DOM.querySelector',{nodeId:doc.root.nodeId,selector:'#mStoryboardFile'});
    await cdp('DOM.setFileInputFiles',{nodeId,files:[join(workspace,'examples',name)]});
  };
  const paste=script=>evaluate(`(()=>{const text=document.querySelector('#mStoryboardText');text.value=${JSON.stringify(script)};text.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html#map`});
  await waitFor(`document.body?.classList.contains('mode-map')&&document.querySelectorAll('#mDlCountry option').length>100`);
  const before=await stored();
  await click('#mStoryboard');await upload('storyboard-4-minutes.json');
  await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  assert.equal(await evaluate(`document.querySelectorAll('.storyboard-scenes li').length`),5);
  assert.match(await evaluate(`document.querySelector('.storyboard-summary').textContent`),/04:00/);
  assert.deepEqual(await stored(),before,'upload and preview preserve the current edit');
  assert.equal(await evaluate(`document.querySelector('#mStoryboardError').hidden`),true);
  assert.equal(await evaluate(`parseFloat(getComputedStyle(document.querySelector('#mStoryboardText')).fontSize)>=14`),true,'script text remains readable');
  assert.equal(await evaluate(`(()=>{const b=document.querySelector('#mStoryboardBuild').getBoundingClientRect();return b.top>=0&&b.bottom<=innerHeight;})()`),true,'build remains visible while reviewing the script');
  await evaluate(`(()=>{const s=document.querySelector('#mStoryboardScrub');s.value=1800;s.dispatchEvent(new Event('input'));})()`);
  const previewAtStart=await evaluate(`Number(document.querySelector('#mStoryboardScrub').value)`);
  await click('#mStoryboardPlay');await sleep(400);await click('#mStoryboardPlay');
  assert.ok(await evaluate(`Number(document.querySelector('#mStoryboardScrub').value)`)>previewAtStart,'the importer plays a moving preview');
  assert.deepEqual(await stored(),before,'motion preview preserves the current project');
  const previewImage=await evaluate(`document.querySelector('#mStoryboardMotionCanvas').toDataURL('image/png')`);
  await writeFile(join(tmpdir(),'frameflow-storyboard-motion.png'),Buffer.from(previewImage.split(',')[1],'base64'));
  const desktop=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'frameflow-storyboard-desktop.png'),Buffer.from(desktop.data,'base64'));
  await click('#mStoryboardBuild');
  assert.equal(await evaluate(`document.querySelector('#mStoryboardDialog').open`),false);
  const built=await stored();assert.equal(built.frames,7200);assert.equal(built.storyboard.scenes.length,5);assert.equal(built.shots.length,1);
  assert.equal(await evaluate(`Number(document.querySelector('#mDuration').value)`),240);
  assert.equal(await evaluate(`document.querySelectorAll('#mTrackRows [data-mrow]').length`),built.actions.length+1);
  await click('#mUndo');assert.deepEqual(await stored(),before,'build is one undo step');
  await click('#mRedo');assert.deepEqual(await stored(),built,'redo restores the entire storyboard');
  const force=built.actions.find(a=>a.name==='The advance · units');
  assert.ok(force.objectKeys.some(k=>k.values.size!==undefined));
  await evaluate(`document.querySelector('#mFrame').value=60;document.querySelector('#mFrame').dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('[data-mid="${force.id}"]').click()`);
  await evaluate(`(()=>{const s=document.querySelector('#mInspector [data-mf="size"]');s.value=1.7;s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  assert.equal((await stored()).actions.find(a=>a.id===force.id).objectKeys.find(k=>k.frame===1800).values.size,1.7,'resizing an imported object adds a key at the playhead');
  await click('#mUndo');assert.deepEqual(await stored(),built,'a resize can be undone independently of the build');
  const renderMotion=await evaluate(`(async()=>{const E=await import('./map-engine.mjs?v=shape-sizing-1'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),g=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json())),c=document.createElement('canvas');c.width=640;c.height=360;const ctx=c.getContext('2d');const images=[900,1800,2600,1800].map(f=>{E.drawMap(ctx,640,360,p,f,g);return c.toDataURL();});return {moving:images[0]!==images[1]&&images[1]!==images[2],repeatable:images[1]===images[3]};})()`);
  assert.equal(renderMotion.moving,true,'rendered frames show camera, route, and size motion');assert.equal(renderMotion.repeatable,true,'scrubbing renders the same frame deterministically');
  await evaluate(`document.querySelector('#mFrame').value=130;document.querySelector('#mFrame').dispatchEvent(new Event('change',{bubbles:true}))`);
  await click('#mPlay');await sleep(250);await click('#mPlay');
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100&&document.querySelectorAll('#mItems [data-mid]').length>10`);
  assert.deepEqual((await stored()).storyboard,built.storyboard,'source and narration survive reload');
  await click('#mStoryboard');
  assert.deepEqual(JSON.parse(await evaluate(`document.querySelector('#mStoryboardText').value`)),built.storyboard.source,'source can be reviewed after reload');
  await paste(JSON.stringify({duration:240,scenes:[{start:0,end:240,type:'travel',from:'Atlantis',to:'Berlin'}]}));
  await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardError').hidden`);
  assert.match(await evaluate(`document.querySelector('#mStoryboardError').textContent`),/Atlantis/);
  assert.equal(await evaluate(`document.querySelector('#mStoryboardBuild').disabled`),true);assert.deepEqual((await stored()).actions,built.actions,'invalid imports cannot change layers');
  await upload('storyboard-4-minutes.txt');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  await click('#mStoryboardBuild');assert.equal((await stored()).frames,7200);assert.equal((await stored()).storyboard.scenes.length,5);
  await click('#mStoryboard');await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  await evaluate(`document.querySelector('#mStoryboardMotion').value='subtle';document.querySelector('#mStoryboardMotion').dispatchEvent(new Event('change'))`);
  assert.equal(await evaluate(`document.querySelector('#mStoryboardBuild').disabled`),true,'changing the motion preset invalidates the preview');
  await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  await paste('duration: broken');assert.equal(await evaluate(`document.querySelector('#mStoryboardBuild').disabled`),true,'editing invalidates a prepared build');
  // Content from uploads must always be rendered as text.
  await paste(JSON.stringify({name:'Safe title',duration:10,scenes:[{start:0,end:10,title:'<img src=x onerror="window.storyboardXss=1">',narration:'<script>window.storyboardXss=1</script>'}]}));
  await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  assert.equal(await evaluate(`document.querySelectorAll('#mStoryboardPreview img,#mStoryboardPreview script').length`),0);assert.equal(await evaluate(`window.storyboardXss||0`),0);
  await upload('storyboard-4-minutes.json');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:false});
  assert.equal(await evaluate(`(()=>{const d=document.querySelector('#mStoryboardDialog');return d.scrollWidth<=d.clientWidth&&d.getBoundingClientRect().width<=window.innerWidth;})()`),true,'dialog fits narrow screens');
  const mobile=await cdp('Page.captureScreenshot',{format:'png'});await writeFile(join(tmpdir(),'frameflow-storyboard-mobile.png'),Buffer.from(mobile.data,'base64'));
  // Large files fail before parsing and leave the project intact.
  await evaluate(`(()=>{const dt=new DataTransfer();dt.items.add(new File(['x'.repeat(5000001)],'too-large.txt',{type:'text/plain'}));const f=document.querySelector('#mStoryboardFile');f.files=dt.files;f.dispatchEvent(new Event('change'));})()`);
  await waitFor(`!document.querySelector('#mStoryboardError').hidden`);assert.match(await evaluate(`document.querySelector('#mStoryboardError').textContent`),/5 MB/);
  // The download button exposes the actual editor model without losing advanced fields.
  const nativeBefore=await stored();
  await evaluate(`(()=>{window.storyboardAnchorClick=HTMLAnchorElement.prototype.click;HTMLAnchorElement.prototype.click=function(){window.storyboardDownloadUrl=this.href;};document.querySelector('#mStoryboardExport').click();HTMLAnchorElement.prototype.click=window.storyboardAnchorClick;})()`);
  const downloaded=await evaluate(`fetch(window.storyboardDownloadUrl).then(r=>r.json())`);
  assert.deepEqual(downloaded.layers,nativeBefore.actions);assert.deepEqual(downloaded.cameraTracks,nativeBefore.shots);assert.equal(downloaded.projectMode,'replace');
  await paste(JSON.stringify(downloaded));await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  await click('#mStoryboardBuild');assert.deepEqual((await stored()).actions,nativeBefore.actions);assert.deepEqual((await stored()).shots,nativeBefore.shots);
  await click('#mStoryboard');await paste(JSON.stringify(nativeBefore));await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  await click('#mStoryboardBuild');assert.deepEqual((await stored()).actions,nativeBefore.actions,'saved map files also roundtrip through the storyboard UI');
  // Supporting media are chosen locally; missing files cannot partially apply a script.
  const mediaScript={name:'Portrait with audio',duration:3,fps:30,motion:'none',project:{width:720,height:1280,mapBackground:{mode:'blank',color:'#202a32'}},audio:[{file:'voice.wav',start:.25,source:.25,duration:1.5,volume:.4,muted:false}],scenes:[{start:0,end:3,panel:false,actions:[{type:'object',unit:'artwork',place:{lat:50,lon:10},options:{image:'asset:marker.svg',size:1}}]}]};
  await click('#mStoryboard');await paste(JSON.stringify(mediaScript));await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardError').hidden`);
  assert.match(await evaluate(`document.querySelector('#mStoryboardError').textContent`),/Missing supporting image/);
  await evaluate(`(()=>{
    const length=16000,buffer=new ArrayBuffer(44+length*2),v=new DataView(buffer),str=(at,s)=>{for(let i=0;i<s.length;i++)v.setUint8(at+i,s.charCodeAt(i));};
    str(0,'RIFF');v.setUint32(4,36+length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,length*2,true);
    window.storyboardWav=buffer;
    const files=new DataTransfer();files.items.add(new File([buffer],'voice.wav',{type:'audio/wav'}));files.items.add(new File(['<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><circle cx="20" cy="20" r="18" fill="red"/></svg>'],'marker.svg',{type:'image/svg+xml'}));
    const input=document.querySelector('#mStoryboardMediaFiles');input.files=files.files;input.dispatchEvent(new Event('change'));
  })()`);
  await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);
  assert.ok(await evaluate(`document.querySelector('#mStoryboardMotionCanvas').height>document.querySelector('#mStoryboardMotionCanvas').width`),'preview respects a portrait canvas');
  const beforeMedia=await stored();await click('#mStoryboardBuild');let withMedia=await stored();
  assert.equal(withMedia.width,720);assert.equal(withMedia.height,1280);assert.match(withMedia.actions[0].image,/^data:image\/png;base64,/);
  const audioState=()=>evaluate(`(async()=>{const A=await import('./audio-reference.mjs?v=add-submenu-1');return A.getAudioSnapshot('map')?.layers.map(l=>({source:l.source,start:l.start,duration:l.duration,volume:l.volume,muted:l.muted}))||[];})()`);
  assert.deepEqual(await audioState(),[{source:.25,start:.25,duration:1.5,volume:.4,muted:false}]);
  await click('#mUndo');assert.deepEqual(await stored(),beforeMedia);assert.deepEqual(await audioState(),[],'undo restores previous audio and visual layers together');
  await click('#mRedo');assert.deepEqual(await stored(),withMedia);assert.equal((await audioState()).length,1,'redo restores the decoded audio');
  await click('#mStoryboard');await paste(JSON.stringify({...mediaScript,audio:[{file:'voice.wav',start:0,source:1,duration:3}]}));await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardError').hidden`);
  assert.match(await evaluate(`document.querySelector('#mStoryboardError').textContent`),/exceeds its source/);assert.deepEqual(await stored(),withMedia,'invalid audio cannot partially replace the edit');
  const stable=await evaluate(`(async()=>{const S=await import('./map-storyboard-editor.mjs'),A=await import('./audio-reference.mjs?v=add-submenu-1');return S.storyboardFromProject(JSON.parse(localStorage.getItem('frameflow-map-v1')),A.getAudioSnapshot('map').layers.map(l=>({id:l.id,name:l.name,file:l.fileName,start:l.start,source:l.source,duration:l.duration,volume:l.volume,muted:l.muted})));})()`);
  await paste(JSON.stringify(stable));await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);await click('#mStoryboardBuild');
  const identicalMap=await stored();await click('#mStoryboard');
  await evaluate(`(()=>{const buffer=window.storyboardWav.slice(0),v=new DataView(buffer);for(let at=44;at<buffer.byteLength;at+=2)v.setInt16(at,10000,true);const dt=new DataTransfer();dt.items.add(new File([buffer],'voice.wav',{type:'audio/wav'}));const input=document.querySelector('#mStoryboardMediaFiles');input.files=dt.files;input.dispatchEvent(new Event('change'));})()`);
  await click('#mStoryboardPreviewButton');await waitFor(`!document.querySelector('#mStoryboardBuild').disabled`);await click('#mStoryboardBuild');
  assert.deepEqual(await stored(),identicalMap,'an audio source may change without changing project JSON');
  const sample=()=>evaluate(`import('./audio-reference.mjs?v=add-submenu-1').then(A=>A.getAudioSnapshot('map').layers[0].buffer.getChannelData(0)[1000])`);
  assert.ok((await sample())>.2);await click('#mUndo');assert.equal(await sample(),0,'audio-only rebuilds undo even with identical visual snapshots');await click('#mRedo');assert.ok((await sample())>.2);
  for(const path of ['storyboard-guide.html','storyboard-reference.html','storyboard-reference.json','examples/storyboard-full-control.json','examples/storyboard-4-minutes.json','examples/storyboard-4-minutes.txt'])assert.equal((await fetch(`http://127.0.0.1:${port}/${path}`)).status,200);
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/storyboard-reference.html`});
  await waitFor(`document.querySelectorAll('#results .row').length>300`);
  await evaluate(`document.querySelector('#search').value='plaqueFont';document.querySelector('#search').dispatchEvent(new Event('input'))`);
  assert.equal(await evaluate(`document.querySelectorAll('#results .row').length`),1,'every-options reference is searchable');
  const copyState=await stored();
  for(const page of ['guide.html','storyboard-guide.html','storyboard-reference.html']){
    await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/${page}`});
    await waitFor(`document.querySelector('[data-copy-storyboard-ai]')?.dataset.copyBound==='true'`);
    await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async text=>{window.copiedStoryboardInstructions=text;}}});document.querySelector('[data-copy-storyboard-ai]').click()`);
    await waitFor(`document.querySelector('[data-storyboard-ai-status]').textContent.startsWith('Copied')`);
    const copied=await evaluate(`(async()=>{const expected=await fetch('storyboard-ai-prompt.txt').then(r=>r.text()),reference=await fetch('storyboard-reference.json').then(r=>r.json()),actual=window.copiedStoryboardInstructions;return {exact:actual===expected,brief:actual.includes('MY STORY BRIEF'),complete:reference.layerOptions.every(field=>actual.includes(JSON.stringify(field)))&&reference.enums.objects.every(item=>actual.includes(JSON.stringify(item.id))),manualHidden:document.querySelector('[data-storyboard-ai-manual]').hidden};})()`);
    assert.deepEqual(copied,{exact:true,brief:true,complete:true,manualHidden:true},`${page}: copies the complete self-contained AI prompt`);
  }
  await evaluate(`Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async()=>{throw Error('Clipboard blocked');}}});document.execCommand=()=>false;document.querySelector('[data-copy-storyboard-ai]').click()`);
  await waitFor(`!document.querySelector('[data-storyboard-ai-manual]').hidden`);
  assert.equal(await evaluate(`(()=>{const text=document.querySelector('[data-storyboard-ai-manual]');return text.value===window.copiedStoryboardInstructions&&text.selectionStart===0&&text.selectionEnd===text.value.length&&document.activeElement===text;})()`),true,'blocked clipboard access exposes the complete selected prompt for manual copy');
  assert.match(await evaluate(`document.querySelector('[data-storyboard-ai-status]').textContent`),/Ctrl\+C/);
  await evaluate(`document.execCommand=()=>{window.legacyStoryboardCopy=document.activeElement.value;return true;};document.querySelector('[data-copy-storyboard-ai]').click()`);
  await waitFor(`document.querySelector('[data-storyboard-ai-status]').textContent.startsWith('Copied')`);
  assert.equal(await evaluate(`window.legacyStoryboardCopy===window.copiedStoryboardInstructions&&document.querySelector('[data-storyboard-ai-manual]').hidden`),true,'legacy copy fallback uses the same full instructions');
  assert.deepEqual(await stored(),copyState,'guide copy controls leave the editor project untouched');
  assert.deepEqual(errors,[]);
  console.log(`Storyboard browser passed: JSON/text upload, preview, generation, playback, undo/redo, reload, invalidation, errors, safe text, narrow layout, and guide links. Screenshots: ${join(tmpdir(),'frameflow-storyboard-desktop.png')} and ${join(tmpdir(),'frameflow-storyboard-mobile.png')}`);
}finally{
  ws?.close();chrome.kill();server.closeAllConnections();server.close();
  await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep));
  await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
