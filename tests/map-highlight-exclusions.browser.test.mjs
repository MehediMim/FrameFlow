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
  await waitFor(`document.body?.classList.contains('mode-map')&&document.querySelectorAll('#mDlCountry option').length>100`);
  const change=(selector,value)=>evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
  const stored=()=>evaluate(`JSON.parse(localStorage.getItem('frameflow-map-v1'))`);
  await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),p=E.newMapProject();p.frames=300;p.camera.init={lon:90,lat:24,zoom:5,bearing:0,pitch:0};p.area.detailCountries=['Bangladesh'];p.area.detailLevels={Bangladesh:'division'};
    p.actions=[E.makeAction('highlight',0,{id:'exclude-test',target:{kind:'country',name:'Bangladesh'},color:'#ff2020',dim:0,pulse:false,showLabel:false,dur:240,animDur:1})];
    localStorage.setItem('frameflow-map-v1',JSON.stringify(p));location.reload();
  })()`);
  await waitFor(`document.querySelector('[data-mid="exclude-test"]')&&[...document.querySelectorAll('#mDlCountry option')].some(o=>o.value.includes('Dhaka'))`);
  await evaluate(`document.querySelector('[data-mid="exclude-test"]').click()`);await change('#mFrame','4');
  assert.equal(await evaluate(`document.querySelector('[data-exclusion-draw]')`),null,'there is no separate exclusion drawing tool');
  await change('[data-mexclude]','not-a-real-region');
  assert.equal((await stored()).actions[0].highlightExclude,undefined,'invalid region names leave the highlight unchanged');
  await evaluate(`document.querySelector('[data-mexclude-pick]').click()`);
  const mapClick=async(lon,lat)=>{
    const point=await evaluate(`(async()=>{const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),i=p.camera.init,v=E.makeView({cx:E.lonToX(i.lon),cy:E.latToY(i.lat),...i},p.width,p.height),q=E.project(v,E.lonToX(${lon}),E.latToY(${lat})),b=document.querySelector('#mCanvas').getBoundingClientRect();return{x:b.left+q.x/p.width*b.width,y:b.top+q.y/p.height*b.height};})()`);
    await cdp('Input.dispatchMouseEvent',{type:'mousePressed',...point,button:'left',buttons:1,clickCount:1});await cdp('Input.dispatchMouseEvent',{type:'mouseReleased',...point,button:'left',buttons:0,clickCount:1});
  };
  await mapClick(90.4,23.8);
  let a=(await stored()).actions[0];assert.equal(a.target.name,'Bangladesh');assert.equal(a.highlightExclude.length,1);assert.equal(a.highlightExclude[0].kind,'region');
  assert.equal(a.highlightExclude[0].country,'Bangladesh');
  assert.equal(await evaluate(`document.querySelectorAll('[data-mexclude-remove]').length`),1);
  const excludedName=a.highlightExclude[0].name;
  await mapClick(90.4,23.8);assert.equal((await stored()).actions[0].highlightExclude.length,0,'clicking an excluded region includes it again');
  await evaluate(`document.querySelector('#mUndo').click()`);assert.equal((await stored()).actions[0].highlightExclude.length,1);
  await evaluate(`document.querySelector('#mRedo').click()`);assert.equal((await stored()).actions[0].highlightExclude.length,0);
  await evaluate(`(()=>{const button=document.querySelector('[data-mexclude-pick]');if(!button.classList.contains('active'))button.click();})()`);await mapClick(90.4,23.8);
  assert.equal((await stored()).actions[0].highlightExclude[0].name,excludedName);
  await evaluate(`document.querySelector('[data-mexclude-pick]').click()`);
  await change('[data-mexclude]','Dhaka');assert.equal((await stored()).actions[0].highlightExclude.length,1,'duplicate exclusions are ignored');
  await change('[data-mexclude]','Chattogram');assert.equal((await stored()).actions[0].highlightExclude.length,2,'regions can also be excluded by name');
  await evaluate(`document.querySelector('[data-mexclude-remove="1"]').click()`);
  assert.equal((await stored()).actions[0].highlightExclude.length,1);
  for(const fill of ['gradient','stripes','dots','color']){
    await change('[data-mf="highlightFill"]',fill);
    assert.equal((await stored()).actions[0].highlightFill,fill);
    if(fill==='gradient')await change('[data-mf="highlightColor2"]','#00ff00');
  }
  for(const animation of ['fade','left','right','down','up','none','radial']){
    await change('[data-mf="highlightAnimation"]',animation);
    assert.equal((await stored()).actions[0].highlightAnimation,animation);
  }
  const render=await evaluate(`(async()=>{
    const E=await import('./map-engine.mjs'),p=JSON.parse(localStorage.getItem('frameflow-map-v1')),geo=E.buildGeo(await fetch('map-data/countries-50m.json').then(r=>r.json()));
    p.camera.init={lon:2,lat:46,zoom:5,bearing:0,pitch:0};p.area.detailCountries=[];p.actions=[E.makeAction('highlight',0,{id:'render',target:{kind:'country',name:'France'},color:'#ff2020',dim:0,pulse:false,showLabel:false,dur:240,animDur:1,highlightExclude:[{kind:'polygon',name:'Mask',path:[{lon:1,lat:45},{lon:3,lat:45},{lon:3,lat:47},{lon:1,lat:47}]}]})];
    p.shots=[];p.area={...E.DEFAULT_AREA,mode:'world'};p.texture={type:'none'};p.atlasLabels={countries:false,oceans:false};p.actions[0].dim=0;p.actions[0].showLabel=false;
    const canvas=document.createElement('canvas');canvas.width=960;canvas.height=600;const ctx=canvas.getContext('2d');
    const sample=actions=>{const v=E.drawMap(ctx,960,600,{...p,actions},120,geo);return [[2,46],[-1,46],[2.5,46]].map(([lon,lat])=>{const q=E.project(v,E.lonToX(lon),E.latToY(lat));return [...ctx.getImageData(Math.round(q.x),Math.round(q.y),1,1).data];});};
    const a=p.actions[0],base=sample([]),cut=sample([a]),full=sample([{...a,highlightExclude:[]}]);
    const overlap={kind:'polygon',name:'Overlap',path:[{lon:2,lat:45},{lon:4,lat:45},{lon:4,lat:47},{lon:2,lat:47}]};
    const overlapping=sample([{...a,highlightExclude:[...a.highlightExclude,overlap]}]);
    const old={...a,id:'older',color:'#2020ff',highlightExclude:[]},under=sample([old]),stack=sample([old,{...a,start:1}]);
    const flagCanvas=document.createElement('canvas');flagCanvas.width=flagCanvas.height=32;flagCanvas.getContext('2d').fillStyle='#20ff20';flagCanvas.getContext('2d').fillRect(0,0,32,32);
    const flag={...a,highlightFill:'flag',image:flagCanvas.toDataURL()};await E.preloadBadges({...p,actions:[flag]});const flagCut=sample([flag]);
    // Every style respects masks; directional and fade reveals change over time
    // and produce identical frames when scrubbed backwards.
    const mainland={kind:'polygon',name:'Mainland test',path:[{lon:-4,lat:43},{lon:8,lat:43},{lon:8,lat:50},{lon:-4,lat:50}]};
    const variants=[];
    for(const highlightFill of ['color','gradient','stripes','dots']){
      for(const [highlightAnimation] of E.HIGHLIGHT_ANIMATIONS){
        const variant={...a,target:mainland,highlightFill,highlightAnimation,animDur:100};
        const end=sample([variant]);
        p.actions=[variant];E.drawMap(ctx,960,600,p,30,geo);const early=canvas.toDataURL();
        E.drawMap(ctx,960,600,p,70,geo);const later=canvas.toDataURL();
        E.drawMap(ctx,960,600,p,30,geo);const repeat=canvas.toDataURL();
        variants.push({highlightFill,highlightAnimation,mask:end[0],changed:early!==later,stable:early===repeat});
      }
    }
    const borders=[];
    for(const [borderAnimation] of E.BORDER_ANIMATIONS)for(const [borderStyle] of E.BORDER_STYLES){
      const border=E.makeAction('border',0,{target:mainland,borderAnimation,borderStyle,dur:240,animDur:100,fillAlpha:0});
      p.actions=[border];E.drawMap(ctx,960,600,p,30,geo);const early=canvas.toDataURL();
      E.drawMap(ctx,960,600,p,70,geo);const later=canvas.toDataURL();
      E.drawMap(ctx,960,600,p,30,geo);borders.push({borderAnimation,borderStyle,changed:early!==later,stable:early===canvas.toDataURL()});
    }
    p.actions=[a];sample([a]);const png=canvas.toDataURL();
    const {exportMapVideo}=await import('./map-video-export.mjs');const bytes=(await exportMapVideo({canvas,fps:24,frames:3,draw:frame=>E.drawMap(ctx,960,600,p,120+frame,geo)})).size;
    return {base,cut,full,overlapping,under,stack,flagCut,png,bytes,variants,borders};
  })()`);
  assert.deepEqual(render.cut[0],render.base[0],'excluded part shows the unchanged map');
  assert.deepEqual(render.cut[1],render.full[1],'remaining country receives the full highlight');
  assert.notDeepEqual(render.full[0],render.base[0],'test point is inside the country highlight');
  assert.deepEqual(render.overlapping[2],render.base[2],'overlapping exclusions remain excluded');
  assert.deepEqual(render.stack[0],render.under[0],'older highlights remain visible through newer exclusions');
  assert.deepEqual(render.flagCut[0],render.base[0],'flag fills respect exclusions');
  assert.notDeepEqual(render.flagCut[1],render.base[1],'flag still fills the rest of the country');
  for(const variant of render.variants){
    assert.deepEqual(variant.mask,render.base[0],JSON.stringify(variant));assert.ok(variant.stable,'highlight scrubbing is deterministic');
    if(variant.highlightAnimation!=='none')assert.ok(variant.changed,JSON.stringify(variant));
  }
  for(const border of render.borders){
    assert.ok(border.stable,'border scrubbing is deterministic');
    if(border.borderAnimation==='none')assert.equal(border.changed,false);else assert.ok(border.changed,JSON.stringify(border));
  }
  assert.ok(render.bytes>100);
  await writeFile(join(tmpdir(),'frameflow-highlight-exclusions.png'),Buffer.from(render.png.split(',')[1],'base64'));
  const saved=await stored();await evaluate('location.reload()');await waitFor(`document.querySelector('[data-mid="exclude-test"]')`);assert.deepEqual(await stored(),saved);
  await evaluate(`document.querySelector('[data-mid="exclude-test"]').click()`);assert.equal(await evaluate(`document.querySelectorAll('[data-mexclude-remove]').length`),1);
  await evaluate(`document.querySelector('[data-mexclude-remove]').click()`);assert.equal((await stored()).actions[0].highlightExclude.length,0);
  await evaluate(`document.querySelector('#mAddGrid [data-madd="border"]').click()`);
  for(const style of ['dashed','dotted','solid']){
    await change('[data-mf="borderStyle"]',style);
    assert.equal((await stored()).actions.at(-1).borderStyle,style);
  }
  for(const animation of ['fade','pulse','flow','none','draw']){
    await change('[data-mf="borderAnimation"]',animation);
    assert.equal((await stored()).actions.at(-1).borderAnimation,animation);
  }
  const borderSaved=await stored();await evaluate('location.reload()');
  await waitFor(`document.querySelector('[data-mid="'+${JSON.stringify(borderSaved.actions.at(-1).id)}+'"]')`);
  assert.deepEqual(await stored(),borderSaved,'new border settings survive reload');
  assert.deepEqual(errors,[]);
  console.log('Country highlight exclusions: region picking, name lookup, toggle, undo/redo, overlapping cuts, stacked highlights, flag fills, new fill and border styles, animations, deterministic scrubbing, persistence, removal and export passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
