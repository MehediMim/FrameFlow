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
  assert.equal((await stored()).actions.length,0,'fresh editor starts with a clean map instead of demo objects');
  await evaluate(`document.querySelector('#mSettingsButton').click()`);
  await evaluate(`[...document.querySelectorAll('#mSettingsPanel [role="tab"]')].find(tab=>tab.textContent==='Base map').click()`);
  await change('#mMapBackground','blank');
  assert.equal((await stored()).mapBackground.mode,'blank');
  assert.equal(await evaluate(`document.querySelector('#mAreaBox').hidden`),true,'blank maps hide modern-boundary settings');
  const backgrounds=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),p=E.newMapProject(),geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    p.graticule=false;p.camera.init={lon:0,lat:0,zoom:2,pitch:0,bearing:0};
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d');
    let strokes=0;const stroke=c.stroke.bind(c);c.stroke=()=>{strokes++;stroke();};
    const capture=(mode,cacheBase=false,actions=[])=>{strokes=0;const v=E.drawMap(c,320,180,{...p,mapBackground:{mode,color:'#123456'},actions},30,geo,null,{cacheBase});return{png:canvas.toDataURL(),strokes,pixel:[...c.getImageData(160,90,1,1).data],labels:v.labels.length};};
    const modern=capture('modern'),coastline=capture('coastline'),blank=capture('blank'),cached=capture('blank',true);
    return{modernBorders:modern.strokes,coastBorders:coastline.strokes,blankPixel:blank.pixel,blankLabels:blank.labels,cachedSame:cached.png===blank.png,modesDiffer:modern.png!==coastline.png&&coastline.png!==blank.png,objectsWork:capture('blank',false,[E.makeAction('object',0,{place:{kind:'point',name:'Center',lon:0,lat:0}})]).png!==blank.png};
  })()`);
  assert.ok(backgrounds.modernBorders>0);assert.equal(backgrounds.coastBorders,0);assert.deepEqual(backgrounds.blankPixel,[18,52,86,255]);assert.equal(backgrounds.blankLabels,0);assert.equal(backgrounds.cachedSame,true);assert.equal(backgrounds.modesDiffer,true);assert.equal(backgrounds.objectsWork,true);
  await change('#mMapBackground','image');
  await evaluate(`(async()=>{
    const c=document.createElement('canvas');c.width=200;c.height=100;const x=c.getContext('2d');x.fillStyle='#cc4422';x.fillRect(0,0,100,100);x.fillStyle='#2255cc';x.fillRect(100,0,100,100);
    const blob=await new Promise(ok=>c.toBlob(ok)),transfer=new DataTransfer();transfer.items.add(new File([blob],'historical-test.png',{type:'image/png'}));const input=document.querySelector('#mMapBackgroundFile');input.files=transfer.files;input.dispatchEvent(new Event('change'));
  })()`);
  await waitFor(`document.querySelector('#mMapBackgroundImageName').textContent==='historical-test.png'`);
  await writeFile(join(tmpdir(),'frameflow-base-map-settings-review.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  const savedBackground=(await stored()).mapBackground;
  const imageMap=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),{exportMapVideo}=await import('./map-video-export.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));await E.preloadBadges(p);
    const canvas=document.createElement('canvas');canvas.width=320;canvas.height=180;const c=canvas.getContext('2d');p.camera.init={lon:-90,lat:0,zoom:2,pitch:0,bearing:0};p.shots=[];
    E.drawMap(c,320,180,p,0,geo);const left=[...c.getImageData(160,90,1,1).data];p.camera.init.lon=90;E.drawMap(c,320,180,p,0,geo);const right=[...c.getImageData(160,90,1,1).data];
    const blob=await exportMapVideo({canvas,fps:24,frames:2,draw:f=>E.drawMap(c,320,180,p,f,geo)});return{left,right,bytes:blob.size};
  })()`);
  assert.deepEqual(imageMap.left,[204,68,34,255]);assert.deepEqual(imageMap.right,[34,85,204,255]);assert.ok(imageMap.bytes>100,'custom maps are included in video exports and follow camera movement');
  await evaluate('location.reload()');await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  assert.deepEqual((await stored()).mapBackground,savedBackground,'uploaded map and source survive reload');
  await change('#mMapBackground','modern');
  await evaluate(`document.querySelector('[data-madd="shape"]').click()`);
  assert.ok(await evaluate(`['distance','area'].every(value=>document.querySelector('[data-mf="shape"] option[value="'+value+'"]'))`),'Distance and Area are entries in the existing shape dropdown');
  assert.equal(await evaluate(`document.querySelector('[data-mf="showMeasurement"]')`),null,'attack arrow has no measurement checkbox');
  await evaluate(`document.querySelector('[data-mpath="draw"]').click()`);
  await evaluate(`document.querySelector('[data-shape-menu]').open=true`);
  assert.equal(await evaluate(`document.querySelectorAll('[data-shape-choice] svg').length`),6,'primary shape tools have lightweight vector previews');
  assert.equal(await evaluate(`document.querySelectorAll('.m-shape-picker img').length`),0,'shape picker needs no image loading');
  await change('[data-mf="__arrowStyle"]','retreat');
  assert.equal((await stored()).actions.at(-1).shape,'retreat','Retreat remains available as an Arrow style');
  await evaluate(`document.querySelector('[data-shape-choice="zone"]').click()`);
  assert.equal((await stored()).actions.at(-1).shape,'zone','visual chooser changes the saved type');
  await evaluate(`document.querySelector('[data-mpath="clear"]').click()`);
  const geometryText=await evaluate(`document.querySelector('.m-shape-geometry').textContent`);
  assert.match(geometryText,/at least 3 points/,'closed boundaries explain their minimum geometry');
  assert.ok(await evaluate(`!!document.querySelector('[data-mf="zoneTerrain"]')`),'zones expose landscape controls');
  await change('[data-mf="__zoneStyle"]','noFly');
  assert.equal((await stored()).actions.at(-1).shape,'noFly','Restricted is a Zone style using compatible saved data');
  await change('[data-mf="__zoneStyle"]','zone');
  await change('[data-mf="zoneTerrain"]','woodland');
  assert.equal(await evaluate(`document.querySelector('[data-terrain-advanced]').open`),false,'landscape fine tuning is collapsed');
  await change('[data-mf="zoneTerrain"]','plain');
  assert.equal(await evaluate(`document.querySelectorAll('#mMapContext [data-direct-field="shape"]').length`),0,'detailed type controls stay in Properties');
  await evaluate(`document.querySelector('[data-shape-menu]').open=true`);
  const pickerLayout=await evaluate(`(()=>{
    const picker=document.querySelector('.m-shape-picker'),failures=[];
    for(const width of [180,240]){
      picker.style.width=width+'px';
      const options=picker.querySelector('.m-shape-options');
      if(options.scrollWidth>options.clientWidth)failures.push(width+': horizontal overflow');
      for(const row of picker.querySelectorAll('[data-shape-choice]')){
        const icon=row.firstElementChild.getBoundingClientRect(),label=row.lastElementChild.getBoundingClientRect(),r=row.getBoundingClientRect();
        if(label.left<icon.right||label.right>r.right||r.height>54)failures.push(width+': cramped '+row.dataset.shapeChoice);
      }
    }
    picker.style.width='180px';return failures;
  })()`);
  assert.deepEqual(pickerLayout,[],'shape rows fit narrow Properties panels without tall cards or overflow');
  await writeFile(join(tmpdir(),'frameflow-shape-picker-review.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  await evaluate(`document.querySelector('.m-shape-picker').style.width=''`);
  await evaluate(`document.querySelector('[data-shape-choice="road"]').click()`);
  assert.ok(await evaluate(`!!document.querySelector('[data-mf="roadStyle"]')&&!document.querySelector('[data-mf="zoneTerrain"]')`),'route styles expose their relevant controls');
  await change('[data-mf="__flowSpeed"]','42');
  await change('[data-mf="__reverseFlow"]',true);
  assert.equal((await stored()).actions.at(-1).flowSpeed,-42,'speed slider and reverse toggle preserve the renderer setting');
  await change('[data-mf="__reverseFlow"]',false);
  assert.equal((await stored()).actions.at(-1).flowSpeed,42);
  assert.equal(await evaluate(`document.querySelectorAll('[data-mf="__keyProperty"]').length`),0,'single-option keyframe selectors are removed');
  await evaluate(`document.querySelector('[data-measure-add]').click()`);
  const measureLayout=await evaluate(`(()=>{
    const button=document.querySelector('[data-measure-add]'),peer=document.querySelector('[data-madd="shape"]'),r=button.getBoundingClientRect(),p=peer.getBoundingClientRect();
    return{aligned:Math.abs(r.width-p.width)<1&&Math.abs(r.height-p.height)<1&&Math.abs(r.top-p.top)<1,submenu:!!document.querySelector('#mMeasureOptions')};
  })()`);
  assert.deepEqual(measureLayout,{aligned:true,submenu:false},'Measure matches the Add Layer tiles and adds directly without revealing options');
  await writeFile(join(tmpdir(),'frameflow-measure-menu-review.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.equal((await stored()).actions.at(-1).shape,'distance','Measure immediately creates a distance layer');
  await evaluate(`document.querySelector('[data-shape-choice="area"]').click()`);
  assert.equal((await stored()).actions.at(-1).shape,'area','Area is selected in Properties');
  await evaluate(`document.querySelector('[data-shape-choice="distance"]').click()`);
  assert.ok(await evaluate(`!!document.querySelector('[data-mf="showDistanceArrow"]')`));
  assert.equal(await evaluate(`document.querySelector('[data-path-capture]')`),null,'measurement shapes have no animation controls');
  await evaluate(`document.querySelector('#mInspector [data-mpath="draw"].active')?.click()`);
  await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),p=E.newMapProject();p.frames=300;p.camera.init={lon:3,lat:3,zoom:4,bearing:0,pitch:0};
    const pt=(lon,lat)=>({lon,lat});
    p.actions=[E.makeAction('shape',0,{id:'distance',shape:'distance',dur:240,path:[pt(0,2),pt(4,2)]}),E.makeAction('shape',0,{id:'area',shape:'area',dur:240,path:[pt(0,0),pt(1,0),pt(1,1),pt(0,1)]})];
    localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();
  })()`);
  await waitFor(`!!document.querySelector('#mItems [data-mid="distance"]')&&!!document.querySelector('#mItems [data-mid="area"]')&&document.querySelectorAll('#mDlCountry option').length>100`);
  await change('#mFrame',2);
  await select('distance');
  assert.equal(await evaluate(`document.querySelector('[data-path-points]').open`),false,'individual path points are hidden by default');
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
  await evaluate('location.reload()');await waitFor(`!!document.querySelector('#mItems [data-mid="distance"]')&&!!document.querySelector('#mItems [data-mid="area"]')`);
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
