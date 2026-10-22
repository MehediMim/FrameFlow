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
  await cdp('Runtime.enable');await cdp('Page.enable');
  await cdp('Page.navigate',{url:`http://127.0.0.1:${port}/index.html`});
  await waitFor(`!!document.querySelector('#mCanvas')`);
  const result=await evaluate(`(async()=>{
    const {drawIsometricObject,drawIsometricShadow,withObjectPreview}=await import('./map-isometric-objects.mjs');
    const {IsoScene}=await import('./map-isometric-geometry.mjs');
    const c=document.createElement('canvas');c.width=1280;c.height=720;const x=c.getContext('2d');
    const samples=[['doctor','walk'],['car','drive'],['kingdomCastle','auto']];let paints=0,faces=0;
    const original=IsoScene.prototype.draw;IsoScene.prototype.draw=function(...args){paints++;faces+=this.faces.length;return original.apply(this,args)};
    const frame=(f,preview)=>withObjectPreview(preview,()=>{
      x.clearRect(0,0,1280,720);
      for(let copy=0;copy<24;copy++){
        const [glyph,objectAnimation]=samples[copy%3],a={objectView:'isometric',objectAnimation};
        x.save();x.translate(80+(copy%8)*150,180+Math.floor(copy/8)*220);
        drawIsometricShadow(x,glyph,28,'#778866',f/30,a);drawIsometricObject(x,glyph,28,'#778866',f/30,a,undefined,{shadows:false});x.restore();
      }
    });
    const run=preview=>{
      const times=[],startPaints=paints,startFaces=faces;
      for(let f=0;f<6;f++){const start=performance.now();frame(f,preview);times.push(performance.now()-start);}
      return{objects:24,frames:6,modelPaints:paints-startPaints,faces:faces-startFaces,medianMs:times.toSorted((a,b)=>a-b)[3]};
    };
    try{
      const full=run(false),exportPixels=c.toDataURL(),preview=run(true),cached=run(true);
      frame(5,false);const exportUnchanged=exportPixels===c.toDataURL();
      return {full,preview,cached,exportUnchanged};
    }finally{IsoScene.prototype.draw=original;}
  })()`);
  console.log(JSON.stringify(result));
  assert.equal(result.full.modelPaints,18,'identical animated copies share one full-detail raster per frame');
  assert.equal(result.preview.modelPaints,18,'preview copies also share one raster per frame');
  assert.equal(result.cached.modelPaints,0,'returning to recent times reuses the completed frames');
  assert.ok(result.preview.faces<result.full.faces,'small preview models use fewer surfaces');
  assert.equal(result.exportUnchanged,true,'preview geometry never contaminates full-detail rendering');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
