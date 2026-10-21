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
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' })[extname(file)] || 'application/octet-stream');
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

  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html`});
  await waitFor(`document.body.classList.contains('landing')&&document.querySelector('#mhPreviewPlay')&&document.querySelector('.mh-map-image').complete`);
  const evaluateInfo=await evaluate(`(()=>{const root=document.getElementById('landing'),ids=[...root.querySelectorAll('[id]')].map(e=>e.id);return {text:root.innerText,links:[...root.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),duplicates:ids.filter(id=>document.querySelectorAll('[id="'+id+'"]').length!==1),assets:[...root.querySelectorAll('img')].map(i=>({src:i.src,loaded:i.complete&&i.naturalWidth>0})),title:document.title};})()`);
  assert.ok(!/Motion Studio|Paper Studio|Scene Studio|four studios/i.test(evaluateInfo.text),'landing content is entirely map focused');
  assert.ok(!evaluateInfo.links.some(h=>['#motion','#paper','#scene'].includes(h)),'landing has no other studio CTAs');
  assert.deepEqual(evaluateInfo.duplicates,[],'landing IDs do not collide with editor controls');
  assert.ok(evaluateInfo.title.includes('Map Animation Studio'));
  assert.ok(evaluateInfo.assets[0].loaded,'hero map image loads');
  await waitFor(`document.getElementById('landing').dataset.showcaseReady`);
  assert.equal(await evaluate(`document.getElementById('landing').dataset.showcaseReady`),'true','real map and texture renderers complete');
  assert.equal(await evaluate(`document.querySelectorAll('[data-map-object]').length`),56,'historical, modern, and civilian map objects are on display');
  assert.equal(await evaluate(`document.querySelectorAll('[data-map-texture][data-rendered="true"]').length`),6,'six real texture finishes render without selection');
  assert.equal(await evaluate(`document.querySelectorAll('[data-map-style][data-rendered="true"]').length`),4,'four map palettes render with the actual map engine');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('[data-map-object]')).every(canvas=>canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data.some((v,i)=>i%4===3&&v>0))`),true,'every object preview contains a rendered illustration');
  const liveScene=await evaluate(`document.querySelector('[data-live-scene]').toDataURL()`);
  await sleep(250);
  assert.notEqual(await evaluate(`document.querySelector('[data-live-scene]').toDataURL()`),liveScene,'hero objects visibly animate without a click');
  assert.equal(await evaluate(`getComputedStyle(document.querySelector('[data-map-object]')).boxShadow`),'none','editor canvas shadows do not leak into the object collection');
  for(const id of ['features','journeys','markers','terrain','regions','campaign','networks','units','animation','sharing','feature-library','how','support'])assert.equal(await evaluate(`!!document.getElementById('${id}')`),true,'feature section '+id);
  assert.equal(await evaluate(`document.querySelectorAll('.mh-library-card:not([hidden])').length`),16,'all map feature groups are initially discoverable');
  assert.equal(await evaluate(`document.querySelectorAll('.mh-story-stage').length`),6,'six map storytelling themes are shown without selection');
  assert.equal(await evaluate(`document.querySelectorAll('.mh-story-picker, [data-story]').length`),0,'no click-to-reveal story controls remain');
  assert.equal(await evaluate(`document.getElementById('mhPreviewPlay').getAttribute('aria-pressed')`),'true','hero map starts animating automatically');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.mh-story-stage')).every(card=>card.getBoundingClientRect().height>0&&card.querySelector('.mh-atlas-caption>p:not(.mh-eyebrow)').textContent.length>40&&card.querySelector('animateMotion'))`),true,'every story includes a visible description and animated map');
  assert.equal(await evaluate(`new Set(Array.from(document.querySelectorAll('.mh-story-stage .mh-atlas-route:first-of-type')).map(path=>path.getAttribute('d'))).size`),6,'each story has its own map route');
  await evaluate(`document.getElementById('features').scrollIntoView()`);
  await waitFor(`document.querySelector('.mh-atlas-map img').complete&&document.querySelector('.mh-atlas-map img').naturalWidth>0`);
  const storyRect=await evaluate(`(()=>{const r=document.querySelector('.mh-story-stage').getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+100}})()`);
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',...storyRect});await sleep(500);
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.mh-story-stage')).transform`),'none','hover lifts the story card');
  assert.notEqual(await evaluate(`getComputedStyle(document.querySelector('.mh-atlas-map img')).transform`),'none','hover zooms the map');
  await cdp('Input.dispatchMouseEvent',{type:'mouseMoved',x:0,y:0});await sleep(500);
  await writeFile(join(tmpdir(),'frameflow-map-landing-atlas.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('#landing a[href^="#"]')).map(a=>a.hash).filter(hash=>hash!=='#map'&&hash!=='#home'&&!document.getElementById(hash.slice(1)))`),[],'every feature link has a destination');
  await evaluate(`document.querySelector('[data-feature-filter="movement"]').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('.mh-library-card:not([hidden])').length`),4,'category filter shows movement features');
  assert.equal(await evaluate(`document.querySelector('[data-feature-filter="movement"]').getAttribute('aria-pressed')`),'true');
  await evaluate(`document.querySelector('#mhFeatureSearch').value='follow traveler';document.querySelector('#mhFeatureSearch').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate(`document.querySelectorAll('.mh-library-card:not([hidden])').length`),2,'multi-word search combines with the selected category');
  await evaluate(`document.querySelector('#mhFeatureSearch').value='zzzzmissing';document.querySelector('#mhFeatureSearch').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.equal(await evaluate(`document.querySelector('#mhFeatureEmpty').hidden`),false,'empty search offers recovery');
  await evaluate(`document.querySelector('#mhFeatureReset').click()`);
  assert.equal(await evaluate(`document.querySelectorAll('.mh-library-card:not([hidden])').length`),16,'reset clears both search and category');
  assert.equal(await evaluate(`document.activeElement.id`),'mhFeatureSearch','reset returns keyboard focus to search');
  for(const section of ['terrain','textures','units','journeys','markers','feature-library']){
    await evaluate(`document.getElementById('${section}').scrollIntoView()`);
    await writeFile(join(tmpdir(),`frameflow-map-landing-${section}.png`),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await evaluate(`document.querySelector('#mhPreviewSeek').value='0';document.querySelector('#mhPreviewSeek').dispatchEvent(new Event('input',{bubbles:true}))`);
  const start=await evaluate(`document.querySelector('[data-demo-front]').getAttribute('d')`);
  await evaluate(`document.querySelector('#mhPreviewSeek').value='100';document.querySelector('#mhPreviewSeek').dispatchEvent(new Event('input',{bubbles:true}))`);
  assert.notEqual(await evaluate(`document.querySelector('[data-demo-front]').getAttribute('d')`),start,'scrubbing changes the map demonstration');
  assert.equal(await evaluate(`document.querySelector('#mhPreviewTime').textContent`),'00:08.00');
  await evaluate(`document.querySelector('#mhPreviewPlay').click()`);await sleep(250);
  assert.equal(await evaluate(`document.querySelector('#mhPreviewPlay').getAttribute('aria-pressed')`),'true');
  assert.ok(await evaluate(`Number(document.querySelector('#mhPreviewSeek').value)<100`),'preview playback advances and loops');
  await evaluate(`document.querySelector('#mhPreviewPlay').click()`);
  await evaluate(`document.querySelector('#landing a[href="#networks"]').click()`);
  await waitFor(`location.hash==='#networks'&&Math.abs(document.getElementById('networks').getBoundingClientRect().top)<70`);
  assert.equal(await evaluate(`document.body.classList.contains('landing')`),true,'feature anchors keep the landing page visible');
  await evaluate(`document.querySelector('#landing a[href="#home"]').click()`);await waitFor(`scrollY<2`);
  await writeFile(join(tmpdir(),'frameflow-map-landing-desktop.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  for(const width of [768,390]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
    await evaluate('window.scrollTo(0,0)');await sleep(100);
    const layout=await evaluate(`(()=>{const root=document.getElementById('landing'),r=document.querySelector('.mh-nav').getBoundingClientRect();return{pageWidth:document.documentElement.scrollWidth,viewport:innerWidth,navRight:r.right,heroRight:document.querySelector('.mh-preview').getBoundingClientRect().right,sections:[...root.querySelectorAll('.mh-section')].length};})()`);
    assert.ok(layout.pageWidth<=width,`no horizontal page overflow at ${width}px: ${JSON.stringify(layout)}`);
    assert.ok(layout.navRight<=width&&layout.heroRight<=width,'navigation and map preview fit');
    assert.equal(layout.sections,12);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.mh-style-study,.mh-texture-study,.mh-object-specimen')).every(card=>{const r=card.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})`),true,'terrain, texture, and object collections fit the viewport');
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.mh-story-stage')).every(card=>{const r=card.getBoundingClientRect();return r.width>0&&r.left>=0&&r.right<=innerWidth})`),true,'all story maps fit the viewport without selection');
    await evaluate(`document.getElementById('feature-library').scrollIntoView()`);
    assert.equal(await evaluate(`Array.from(document.querySelectorAll('.mh-library-card')).every(card=>{const r=card.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth})`),true,'feature library fits viewport');
    await evaluate(`document.getElementById('units').scrollIntoView()`);await waitFor(`document.querySelector('.mh-troop-sheet img').complete&&document.querySelector('.mh-troop-sheet img').naturalWidth>0`);
    await evaluate('window.scrollTo(0,0)');
    if(width===390)await writeFile(join(tmpdir(),'frameflow-map-landing-mobile.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1600,height:1000,deviceScaleFactor:1,mobile:false});
  await evaluate(`document.querySelector('#landing a[href="#map"]').click()`);
  await waitFor(`!document.body.classList.contains('landing')&&document.body.classList.contains('mode-map')&&document.querySelectorAll('#mDlCountry option').length>100`);
  assert.equal(await evaluate(`document.getElementById('export').tagName`),'BUTTON','Motion export control stays intact');
  assert.equal(await evaluate(`typeof document.getElementById('mExport').onclick`),'function','map export remains bound');
  assert.equal(await evaluate(`document.getElementById('mhPreviewPlay').getAttribute('aria-pressed')`),'false','preview pauses in editor');
  await evaluate(`document.getElementById('homeLink').click()`);await waitFor(`document.body.classList.contains('landing')`);
  await cdp('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  const motion=await evaluate(`getComputedStyle(document.querySelector('.mh-flow')).animationName`);assert.equal(motion,'none','reduced motion stops decorative animation');
  assert.equal(await evaluate(`Array.from(document.querySelectorAll('.mh-story-stage svg')).every(svg=>svg.animationsPaused())`),true,'reduced motion pauses all SVG atlas animations');
  assert.deepEqual(errors,[],'no browser runtime errors');
  console.log('Map-only landing content, all sections, unique IDs, preview controls, anchor routing, desktop/tablet/mobile layout, reduced motion and editor entry passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
