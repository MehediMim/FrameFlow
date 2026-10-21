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

  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html`});
  await waitFor(`document.body.classList.contains('landing')&&document.querySelector('#mhPreviewPlay')&&document.querySelector('.mh-map-image').complete`);
  const evaluateInfo=await evaluate(`(()=>{const root=document.getElementById('landing'),ids=[...root.querySelectorAll('[id]')].map(e=>e.id);return {text:root.innerText,links:[...root.querySelectorAll('a[href]')].map(a=>a.getAttribute('href')),duplicates:ids.filter(id=>document.querySelectorAll('[id="'+id+'"]').length!==1),assets:[...root.querySelectorAll('img')].map(i=>({src:i.src,loaded:i.complete&&i.naturalWidth>0})),title:document.title};})()`);
  assert.ok(!/Motion Studio|Paper Studio|Scene Studio|four studios/i.test(evaluateInfo.text),'landing content is entirely map focused');
  assert.ok(!evaluateInfo.links.some(h=>['#motion','#paper','#scene'].includes(h)),'landing has no other studio CTAs');
  assert.deepEqual(evaluateInfo.duplicates,[],'landing IDs do not collide with editor controls');
  assert.ok(evaluateInfo.title.includes('Map Animation Studio'));
  assert.ok(evaluateInfo.assets[0].loaded,'hero map image loads');
  for(const id of ['features','terrain','regions','campaign','networks','units','animation','sharing','how','support'])assert.equal(await evaluate(`!!document.getElementById('${id}')`),true,'feature section '+id);
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
    assert.equal(layout.sections,8);
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
  assert.deepEqual(errors,[],'no browser runtime errors');
  console.log('Map-only landing content, all sections, unique IDs, preview controls, anchor routing, desktop/tablet/mobile layout, reduced motion and editor entry passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
