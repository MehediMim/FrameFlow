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
  const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; const timer = setTimeout(() => reject(Error(`Debugger timeout: ${method}`)), 10000); pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: error => { clearTimeout(timer); reject(error); } }); ws.send(JSON.stringify({ id, method, params })); });
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
  await cdp('Page.navigate', { url: `http://127.0.0.1:${port}/index.html#map` });
  console.log('Application opened; checking studios');
  await waitFor(`document.body.classList.contains('ff-unified')`);
  await waitFor(`!document.body.classList.contains('landing')`);

  for (const [mode,id,selector] of [['motion','canvas','#size'],['map','mCanvas','#mSize'],['paper','pCanvas','#pSize'],['scene','scCanvas','[data-field="canvasSize"]']]) {
    await evaluate(`document.querySelector('[data-mode="${mode}"]').click()`);
    await waitFor(`document.querySelector('${selector}')`);
    for(const width of [1600,980]) {
      await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
      for(const size of ['1080,1920','1280,720','1080,1080']) {
        await evaluate(`(()=>{const el=document.querySelector('${selector}');el.value='${size}';el.dispatchEvent(new Event('change',{bubbles:true}));})()`);
        await sleep(250);
        const box=await evaluate(`(()=>{const c=document.getElementById('${id}'),w=c.closest('.workspace,.sc-workspace'),l=w.parentElement,t=l.querySelector('.timeline,.sc-timeline'),rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height}};return {portrait:l.classList.contains('ff-portrait-layout'),left:rect(w.querySelector('.left')),properties:rect(w.querySelector('.right')),preview:rect(w.querySelector('main')),timeline:rect(t),layout:rect(l),canvas:rect(c),area:rect(c.closest('.stage-area,.sc-stage')),pixels:[c.width,c.height],overflow:document.body.scrollWidth>innerWidth};})()`);
        assert.equal(box.portrait,size==='1080,1920',mode+' orientation');
        if(box.portrait) {
          assert.ok(Math.abs(box.properties.x-box.left.right)<2,mode+' properties beside left panel');
          assert.ok(Math.abs(box.timeline.right-box.preview.x)<2,mode+' timeline confined to left '+JSON.stringify(box));
          assert.ok(Math.abs(box.preview.bottom-box.layout.bottom)<2,mode+' preview spans full height');
          assert.ok(box.canvas.height<=box.area.height-46,mode+' portrait fits vertically '+JSON.stringify(box));
          assert.ok(box.canvas.width<=box.area.width-46,mode+' portrait fits horizontally');
          if(mode==='motion'&&width===1600)await writeFile(join(tmpdir(),'frameflow-portrait-layout.png'),Buffer.from((await cdp('Page.captureScreenshot',{format:'png'})).data,'base64'));
        } else {
          assert.ok(box.preview.x<box.properties.x,mode+' landscape/square properties restored');
          assert.ok(box.timeline.y>=box.preview.bottom-2,mode+' full-width timeline restored');
        }
        assert.deepEqual(box.pixels,size.split(',').map(Number));
        assert.equal(box.overflow,false,mode+' no page overflow');
      }
    }
    console.log(mode+': portrait workspace and landscape/square restore passed at 1600px and 980px');
  }
  assert.deepEqual(errors,[],'no browser runtime errors');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
