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
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html#map`});
  await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  const rendering=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),T=await import('./map-strategy-terrain.mjs'),O=await import('./map-strategy-objects.mjs');
    const geo=E.buildGeo(await fetch('map-data/countries-110m.json').then(r=>r.json()));
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const c=canvas.getContext('2d');
    const p=E.newMapProject();p.theme='kingdom';p.frames=300;p.graticule=false;p.atlasLabels={countries:false,oceans:false};p.camera.init={lon:1,lat:46,zoom:5.3,pitch:0,bearing:0};
    const path=[{lon:-4,lat:42},{lon:6,lat:42},{lon:6,lat:49},{lon:-4,lat:49}];
    const zone=E.makeAction('shape',0,{id:'landscape',shape:'zone',path,curve:'straight',networkAnimation:'static',zoneTerrain:'jungle',terrainSeed:42,dur:300});p.actions=[zone];
    const render=frame=>{E.drawMap(c,960,640,p,frame,geo);return canvas.toDataURL();};
    const first=render(90),repeat=render(90);const seeded=first===repeat;
    zone.terrainSeed=43;const reseeded=render(90)!==first;zone.terrainSeed=42;
    const still=first===render(150),fills=[];
    for(const key of Object.keys(T.TERRAIN_COLORS)){zone.zoneTerrain=key;fills.push(render(90));}
    zone.zoneTerrain='plain';const plain=render(90);const distinct=new Set(fills).size===fills.length&&fills.every(f=>f!==plain);
    zone.zoneTerrain='river';const waterAnimated=render(90)!==render(120);
    p.fps=30;const at30=render(90);p.fps=60;const equalSeconds=render(180)===at30;p.fps=30;
    // The terrain layer may not alter any pixels outside its projected polygon.
    zone.zoneTerrain='jungle';zone.width=1;
    E.drawMap(c,960,640,{...p,actions:[]},90,geo);const base=c.getImageData(0,0,960,640).data;
    const v=E.drawMap(c,960,640,p,90,geo),pixels=c.getImageData(0,0,960,640).data;
    const points=path.map(q=>E.project(v,E.lonToX(q.lon),E.latToY(q.lat))),xs=points.map(p=>p.x),ys=points.map(p=>p.y);
    let outsideChanged=0,insideChanged=0;
    for(let y=0;y<640;y++)for(let x=0;x<960;x++){const i=(y*960+x)*4,changed=base[i]!==pixels[i]||base[i+1]!==pixels[i+1]||base[i+2]!==pixels[i+2];if(!changed)continue;if(x<Math.min(...xs)-3||x>Math.max(...xs)+3||y<Math.min(...ys)-3||y>Math.max(...ys)+3)outsideChanged++;else insideChanged++;}
    p.camera.init.pitch=45;p.camera.init.bearing=25;const tilted=render(90).startsWith('data:image/png');p.camera.init.pitch=0;p.camera.init.bearing=0;
    // Render every original object with the same drawing functions as the picker and exports.
    const sheet=document.createElement('canvas');sheet.width=1440;sheet.height=1000;const sc=sheet.getContext('2d');sc.fillStyle='#d4d3ae';sc.fillRect(0,0,sheet.width,sheet.height);
    const iconCanvas=document.createElement('canvas');iconCanvas.width=200;iconCanvas.height=200;const ic=iconCanvas.getContext('2d');const variants=[];
    Object.entries(O.STRATEGY_OBJECTS).forEach(([glyph,icon],i)=>{ic.clearRect(0,0,200,200);ic.save();ic.translate(100,110);icon.draw(ic,53,icon.color,3);ic.restore();variants.push(iconCanvas.toDataURL());sc.save();sc.translate(120+i%6*240,100+Math.floor(i/6)*235);icon.draw(sc,62,icon.color,3);sc.restore();sc.fillStyle='#253627';sc.font='14px Arial';sc.textAlign='center';sc.fillText(icon.label,120+i%6*240,190+Math.floor(i/6)*235);});
    const windmill=O.STRATEGY_OBJECTS.kingdomWindmill;ic.clearRect(0,0,200,200);ic.save();ic.translate(100,110);windmill.draw(ic,53,windmill.color,1);ic.restore();const millA=iconCanvas.toDataURL();ic.clearRect(0,0,200,200);ic.save();ic.translate(100,110);windmill.draw(ic,53,windmill.color,2);ic.restore();const millAnimated=millA!==iconCanvas.toDataURL();
    // A complete settlement combining several zone landscapes and miniature objects.
    p.actions=[];
    const area=(id,kind,x,y,w,h)=>E.makeAction('shape',0,{id,shape:'zone',path:[{lon:x,lat:y},{lon:x+w,lat:y},{lon:x+w,lat:y+h},{lon:x,lat:y+h}],curve:'straight',zoneTerrain:kind,terrainSeed:12,color:T.TERRAIN_COLORS[kind],networkAnimation:'static',dur:300,width:1});
    p.actions.push(area('forest','jungle',-4,44,3.3,5),area('ridge','mountains',3.8,46,2.6,3),area('fields','farmland',.8,43,3,2),area('water','river',-1.1,42.5,1.4,7));
    for(const [glyph,lon,lat]of [['kingdomTownCenter',1,46.7],['kingdomHouse',2.4,46.3],['kingdomWindmill',1.8,44.1],['kingdomCastle',3,48],['kingdomLumber',-2.2,46.5],['kingdomMine',4.7,47.4],['kingdomDock',-.5,45.3]])p.actions.push(E.makeAction('object',0,{glyph,color:O.STRATEGY_OBJECTS[glyph].color,place:{kind:'point',name:'Settlement',lon,lat},dur:300,size:1.35}));
    E.validateMapProject(p);localStorage.setItem('frameflow-map-v1',JSON.stringify(p));
    window.strategyProject=p;window.strategyGeo=geo;window.strategyCanvas=canvas;
    render(90);window.strategyReview=canvas.toDataURL();window.strategyObjectsReview=sheet.toDataURL();
    return {seeded,reseeded,still,distinct,waterAnimated,equalSeconds,outsideChanged,insideChanged,tilted,uniqueObjects:new Set(variants).size,millAnimated};
  })()`);
  assert.ok(rendering.seeded&&rendering.reseeded&&rendering.still&&rendering.distinct&&rendering.waterAnimated&&rendering.equalSeconds,JSON.stringify(rendering));
  assert.equal(rendering.outsideChanged,0,'landscape details stay clipped to their zone');assert.ok(rendering.insideChanged>1000);
  assert.equal(rendering.uniqueObjects,24);assert.ok(rendering.millAnimated&&rendering.tilted);
  for(const [name,key]of[['scene','strategyReview'],['objects','strategyObjectsReview']])await writeFile(join(tmpdir(),'frameflow-strategy-'+name+'.png'),Buffer.from((await evaluate('window.'+key)).split(',')[1],'base64'));
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mItems [data-mid]').length>=11&&document.querySelectorAll('#mDlCountry option').length>100`);
  assert.equal(await evaluate(`document.querySelector('#mTheme').value`),'kingdom','theme survives reload');
  await evaluate(`document.querySelector('#mItems [data-mid="forest"]').click()`);
  await waitFor(`!!document.querySelector('#mInspector [data-mf="zoneTerrain"]')`);
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-mf="zoneTerrain"]').value`),'jungle');
  const change=(key,value)=>evaluate(`(()=>{const el=document.querySelector('#mInspector [data-mf="'+${JSON.stringify(key)}+'"]');el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  await change('zoneTerrain','mountains');await waitFor(`!!document.querySelector('#mInspector [data-mf="terrainDensity"]')`);
  await change('terrainSeed','73');await change('terrainDensity','1.5');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.find(a=>a.id==='forest').terrainSeed`),73);
  await change('zoneTerrain','plain');assert.equal(await evaluate(`!!document.querySelector('#mInspector [data-mf="terrainDensity"]')`),false,'plain fill hides landscape-only settings');
  await change('zoneTerrain','jungle');
  await evaluate(`document.querySelector('#mItems [data-mid]').closest('#mItems');document.querySelector('[data-madd="object"]').click()`);
  await waitFor(`!!document.querySelector('#mInspector [data-mf="glyph"]')`);
  assert.equal(await evaluate(`!![...document.querySelectorAll('#mInspector optgroup')].find(el=>el.label.includes('Kingdom strategy'))`),true,'strategy objects appear in the type picker');
  await change('glyph','kingdomWindmill');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1).glyph`),'kingdomWindmill');
  await change('objectView','isometric');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1).objectView`),'isometric','object view is saved from Properties');
  assert.equal(await evaluate(`document.querySelector('#mInspector [data-object-preview]').dataset.objectView`),'isometric','picker reflects the selected view');
  const views=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),P=await import('./map-object-preview.mjs'),I=await import('./map-isometric-objects.mjs');
    const catalog=Object.keys(E.OBJECT_ICONS),same=[],empty=[],normalCalls=[];
    for(const glyph of catalog)if(P.objectPreview(glyph,'normal')===P.objectPreview(glyph,'isometric'))same.push(glyph);
    const atlas=document.createElement('canvas');atlas.width=1440;atlas.height=Math.ceil(catalog.length/8)*170;
    const ac=atlas.getContext('2d');ac.fillStyle='#e6e5d7';ac.fillRect(0,0,atlas.width,atlas.height);
    const tile=document.createElement('canvas');tile.width=tile.height=160;const tc=tile.getContext('2d');
    // Isometric drawing must work while the corresponding normal renderer throws.
    // Check actual coverage, not merely that its PNG differs from Normal.
    for(const [i,glyph]of catalog.entries()){
      const icon=E.OBJECT_ICONS[glyph],original=icon.draw;icon.draw=()=>{normalCalls.push(glyph);throw Error('Normal renderer used for '+glyph);};
      try{tc.clearRect(0,0,160,160);tc.save();tc.translate(80,122);I.drawIsometricObject(tc,glyph,35,icon.color,2);tc.restore();}finally{icon.draw=original;}
      const pixels=tc.getImageData(0,0,160,160).data;let coverage=0;for(let j=3;j<pixels.length;j+=4)if(pixels[j]>0)coverage++;
      if(coverage<100)empty.push(glyph);
      ac.drawImage(tile,i%8*180,Math.floor(i/8)*170);ac.fillStyle='#29392d';ac.font='12px Arial';ac.fillText(glyph,i%8*180+7,Math.floor(i/8)*170+160);
    }
    window.strategyIsometricCatalogReview=atlas.toDataURL();
    const closeups=['kingdomTownCenter','kingdomHouse','medievalCastle','stoneFort','tank','car','deliveryTruck','train','caravel','galleon','warship','submarine','musketeer','monarch','doctor','mughalCavalry','tree','kingdomPine','kingdomJungle','kingdomMountain','tajMahal','eiffelTower','cargoCrates','hourglass'];
    const detailSheet=document.createElement('canvas');detailSheet.width=1600;detailSheet.height=1920;const dc=detailSheet.getContext('2d');
    dc.fillStyle='#e8e4d7';dc.fillRect(0,0,1600,1920);
    for(const [i,glyph]of closeups.entries()){
      dc.save();dc.translate(i%4*400+200,Math.floor(i/4)*320+250);I.drawIsometricObject(dc,glyph,90,E.OBJECT_ICONS[glyph].color,2);dc.restore();
      dc.fillStyle='#30372c';dc.font='15px Arial';dc.fillText(glyph,i%4*400+20,Math.floor(i/4)*320+303);
    }
    window.strategyIsometricDetailsReview=detailSheet.toDataURL();
    const geo=E.buildGeo(await fetch('map-data/countries-110m.json').then(r=>r.json())),p=E.newMapProject();p.theme='paper';p.graticule=false;p.atlasLabels={countries:false,oceans:false};p.camera.init={lon:2,lat:48,zoom:4,pitch:0,bearing:0};
    const source=document.createElement('canvas');source.width=source.height=96;const sc=source.getContext('2d');sc.fillStyle='#cd603c';sc.fillRect(15,15,65,65);sc.fillStyle='#e9d5a3';sc.fillRect(35,30,25,35);const image=source.toDataURL();
    const texture=new Image();texture.src=image;await texture.decode();
    const modelFrame=(glyph,settings={},seconds=2)=>{tc.clearRect(0,0,160,160);tc.save();tc.translate(80,122);I.drawIsometricObject(tc,glyph,35,'#a45f43',seconds,settings,texture);tc.restore();return tile.toDataURL();};
    const picture=modelFrame('portrait',{label:'Commander'}),crop=modelFrame('portrait',{label:'Commander',badgeZoom:2})!==picture;
    const plaque=modelFrame('portrait',{label:'Admiral',plaqueColor:'#0088ff'})!==picture;
    const stillCloth=modelFrame('banner',{bannerWind:false,bannerTitle:'Standard'},1)===modelFrame('banner',{bannerWind:false,bannerTitle:'Standard'},2);
    const clothWidth=modelFrame('banner',{bannerAspect:.4})!==modelFrame('banner',{bannerAspect:1.5});
    const title=modelFrame('banner',{bannerTitle:'TITLE'})!==modelFrame('banner',{});
    // Reuse a detailed static model at a different scale/rotation and opacity.
    // Cached drawing must honor the destination transform and apply alpha once.
    tc.clearRect(0,0,160,160);tc.save();tc.translate(80,120);tc.scale(1.5,1.5);tc.rotate(.2);tc.globalAlpha=.5;I.drawIsometricObject(tc,'tank',26,'#75906a');tc.restore();
    const cachedPixels=tc.getImageData(0,0,160,160).data;let maxAlpha=0,cacheCoverage=0;for(let j=3;j<cachedPixels.length;j+=4){maxAlpha=Math.max(maxAlpha,cachedPixels[j]);if(cachedPixels[j]>8)cacheCoverage++;}
    const S=await import('./map-isometric-shadow.mjs'),O=await import('./map-objects.mjs');
    const shadowFrame=(glyph,pose={})=>{tc.clearRect(0,0,160,160);tc.save();tc.translate(50,100);I.drawIsometricShadow(tc,glyph,30,E.OBJECT_ICONS[glyph].color,2,{},null,pose);tc.restore();return tile.toDataURL();};
    const tankShadow=shadowFrame('tank'),treeShadow=shadowFrame('tree'),towerShadow=shadowFrame('eiffelTower');
    const shadowDistinct=new Set([tankShadow,treeShadow,towerShadow]).size===3,shadowStable=towerShadow===shadowFrame('eiffelTower');
    const shadowLift=shadowFrame('jet',{height:2})!==shadowFrame('jet',{height:0});
    const shadowRotation=shadowFrame('tank',{angle:Math.PI/2})!==tankShadow;
    const shadowCollapse=shadowFrame('eiffelTower',{flatten:.06})!==towerShadow;
    // An opaque overlap union must remain equally dark when faces are repeated.
    const simple=I.createIsometricModel('cargoCrates','#987043'),twice={faces:[...simple.faces,...simple.faces]};
    const shadowPixels=scene=>{tc.clearRect(0,0,160,160);tc.save();tc.translate(70,100);S.drawModelShadow(tc,scene,40);tc.restore();return [...tc.getImageData(0,0,160,160).data];};
    const once=shadowPixels(simple),repeated=shadowPixels(twice);let unionError=0;for(let j=3;j<once.length;j+=4)unionError=Math.max(unionError,Math.abs(once[j]-repeated[j]));
    // Check the actual object drawing path: the normal contact ellipse cannot
    // leak into the isometric branch or be painted a second time.
    let radialCalls=0;const radial=tc.createRadialGradient.bind(tc);tc.createRadialGradient=(...args)=>{radialCalls++;return radial(...args);};
    const helpers={actAlpha:()=>1,clamp01:x=>Math.max(0,Math.min(1,x)),project:(_v,_X,_Y,h=0)=>({x:80,y:110-h,z:1}),resolveLoc:()=>({X:0,Y:0})};
    const object={glyph:'tank',type:'object',mode:'stay',size:1,start:0,dur:240,enter:'none',exit:'none',idle:'none',color:'#75906a'};
    O.drawObject(helpers,tc,{unit:1,fps:30,near:0},null,object,90,[]);const normalEllipse=radialCalls;
    radialCalls=0;O.drawObject(helpers,tc,{unit:1,fps:30,near:0},null,{...object,objectView:'isometric'},90,[]);const isoEllipse=radialCalls;tc.createRadialGradient=radial;
    const canvas=document.createElement('canvas');canvas.width=400;canvas.height=300;const c=canvas.getContext('2d');
    const sheet=document.createElement('canvas');sheet.width=1200;sheet.height=1500;const context=sheet.getContext('2d');
    let distinct=0,deterministic=true,restored=true,damage=true;
    const glyphs=['tank','stoneFort','warship','kingdomTownCenter','kingdomWindmill','musketeer','portrait','banner','image','artwork'];
    for(const [index,glyph]of glyphs.entries()){
      const a=E.makeAction('object',0,{glyph,image,color:E.OBJECT_ICONS[glyph].color,size:2,place:{kind:'point',name:'View test',lon:2,lat:48},dur:240,showLabel:false});p.actions=[a];await E.preloadBadges(p);
      const render=()=>{E.drawMap(c,400,300,p,90,geo);return canvas.toDataURL();};
      const normal=render();context.drawImage(canvas,(index%3)*400,Math.floor(index/3)*375,200,150);
      a.objectView='isometric';const iso=render();context.drawImage(canvas,(index%3)*400+200,Math.floor(index/3)*375,200,150);
      if(normal!==iso)distinct++;deterministic&&=iso===render();a.objectView='normal';restored&&=normal===render();
      context.fillStyle='#edf0df';context.fillRect((index%3)*400,Math.floor(index/3)*375+150,400,35);context.fillStyle='#243629';context.font='15px Arial';context.fillText(glyph+' · normal / isometric',(index%3)*400+10,Math.floor(index/3)*375+172);
      if(!['image','artwork','portrait','banner'].includes(glyph)){a.objectView='isometric';for(const state of ['damaged','burning','destroyed']){a.damageState=state;damage&&=render()!==iso;}}
    }
    window.strategyObjectViewsReview=sheet.toDataURL();
    return {catalog:catalog.length,same,empty,normalCalls,missing:catalog.filter(glyph=>!I.ISOMETRIC_MODELS[glyph]),distinct,deterministic,restored,damage,crop,plaque,stillCloth,clothWidth,title,maxAlpha,cacheCoverage,shadowDistinct,shadowStable,shadowLift,shadowRotation,shadowCollapse,unionError,normalEllipse,isoEllipse};
  })()`);
  assert.deepEqual(views.same,[],'every catalog object has distinct Normal and Isometric previews');
  assert.deepEqual(views.missing,[],'every catalog object has an explicit isometric recipe');
  assert.deepEqual(views.empty,[],'every isometric model draws a visible miniature');
  assert.deepEqual(views.normalCalls,[],'isometric models never call normal-view renderers');
  assert.equal(views.distinct,10,'vector, image, portrait, banner and badge objects render both views');
  assert.ok(views.deterministic&&views.restored&&views.damage,JSON.stringify(views));
  assert.ok(views.crop&&views.plaque&&views.stillCloth&&views.clothWidth&&views.title,'isometric image crop, plaque styles, titles and cloth controls work: '+JSON.stringify(views));
  assert.ok(views.maxAlpha<=128&&views.maxAlpha>100&&views.cacheCoverage>300,'cached detailed models respect scale, rotation and opacity: '+JSON.stringify(views));
  assert.ok(views.shadowDistinct&&views.shadowStable&&views.shadowLift&&views.shadowRotation&&views.shadowCollapse,'cast shadows follow geometry, height, rotation and collapse: '+JSON.stringify(views));
  assert.ok(views.unionError<=1,'overlapping faces do not accumulate shadow opacity');
  assert.ok(views.normalEllipse>0&&views.isoEllipse===0,'only Normal view receives the generic oval shadow');
  await writeFile(join(tmpdir(),'frameflow-object-views.png'),Buffer.from((await evaluate('window.strategyObjectViewsReview')).split(',')[1],'base64'));
  await writeFile(join(tmpdir(),'frameflow-isometric-catalog.png'),Buffer.from((await evaluate('window.strategyIsometricCatalogReview')).split(',')[1],'base64'));
  await writeFile(join(tmpdir(),'frameflow-isometric-details.png'),Buffer.from((await evaluate('window.strategyIsometricDetailsReview')).split(',')[1],'base64'));
  const video=await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),{exportMapVideo}=await import('./map-video-export.mjs');const canvas=document.createElement('canvas');canvas.width=960;canvas.height=640;const p=JSON.parse(localStorage.getItem('frameflow-map-v1')),geo=E.buildGeo(await fetch('map-data/countries-110m.json').then(r=>r.json()));const blob=await exportMapVideo({canvas,fps:30,frames:6,draw:frame=>E.drawMap(canvas.getContext('2d'),canvas.width,canvas.height,p,90+frame,geo)});return {size:blob.size,type:blob.type};})()`);
  assert.ok(video.size>1000&&video.type==='video/webm','strategy terrain and objects encode to video');
  await evaluate(`location.reload()`);await waitFor(`document.querySelectorAll('#mDlCountry option').length>100`);
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.find(a=>a.id==='forest').zoneTerrain`),'jungle');
  assert.equal(await evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1')).actions.at(-1).objectView`),'isometric','isometric view survives project reload and video export');
  assert.deepEqual(errors,[]);console.log('Strategy theme, landscapes, 163 isometric models, geometry-based shadows, overlap opacity, height/rotation/collapse, picker, reload, PNG and video passed');
}finally{
  ws?.close();chrome.kill();server.closeAllConnections();server.close();await new Promise(r=>chrome.exitCode!==null?r():chrome.once('exit',r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir())+sep));await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});
}
