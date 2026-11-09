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
  await waitFor(`location.protocol === 'http:' && document.readyState === 'complete'`);
  const damageReview=await evaluate(`(async()=>{
    const M=await import('./map-isometric-objects.mjs'),D=await import('./map-damage.mjs'),{OBJECT_ICONS}=await import('./map-objects.mjs');
    const samples=['tank','tank','tank','stoneFort','stoneFort','stoneFort'],states=['intact','damaged','burning','destroyed'];
    const sheet=document.createElement('canvas');sheet.width=1280;sheet.height=1440;const out=sheet.getContext('2d');
    out.fillStyle='#e8e3d8';out.fillRect(0,0,1280,1440);const failures=[];
    for(const [row,glyph]of samples.entries())for(const [col,state]of states.entries()){
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=240;const ctx=canvas.getContext('2d'),s=45;
      const action={glyph,objectView:['side','isometric','isometricBack'][row%3],objectAnimation:'none'},color=OBJECT_ICONS[glyph].color;
      const bounds=M.objectRenderBounds(glyph,color,0,action),profile={bounds,family:M.ISOMETRIC_MODELS[glyph].family,color,seed:glyph,...M.objectDamageGeometry(glyph,color,0,action)};
      const intact=target=>(action.objectView==='side'?M.drawSideObject:M.drawIsometricObject)(target,glyph,s,color,0,action,undefined,{shadows:false});
      const render=(seconds=2.5,progress=1)=>{ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,320,240);ctx.translate(160,180);
        if(state==='intact')intact(ctx);else if(state==='destroyed')D.drawDestruction(ctx,s,profile.family==='ship',progress,intact,profile);else D.drawDamage(ctx,s,state,seconds,intact,profile);
        return canvas.toDataURL();};
      const first=render();if(first!==render())failures.push(glyph+' '+state+': unstable seek');
      if(state==='burning'&&first===render(2.8))failures.push(glyph+': fire is static');
      if(state==='destroyed'&&first===render(2.5,.35))failures.push(glyph+': collapse is static');
      render();
      if(state==='damaged'){
        const mask=document.createElement('canvas');mask.width=320;mask.height=240;const m=mask.getContext('2d');m.translate(160,180);intact(m);
        const original=m.getImageData(0,0,320,240).data,damaged=ctx.getImageData(0,0,320,240).data;let stray=0,changed=0;
        for(let i=0;i<original.length;i+=4){if(original[i+3]===0&&damaged[i+3]>5)stray++;if(original[i+3]>10&&Math.abs(original[i]-damaged[i])>5)changed++;}
        if(stray>8)failures.push(glyph+': damage escapes silhouette ('+stray+')');if(changed<80)failures.push(glyph+': surface damage is missing');
      }
      out.drawImage(canvas,col*320,row*240);out.fillStyle='#26352e';out.font='15px sans-serif';out.fillText(glyph+' '+action.objectView+' / '+state,col*320+16,row*240+25);
    }
    return {failures,png:sheet.toDataURL().split(',')[1]};
  })()`);
  await writeFile(join(tmpdir(),'frameflow-object-damage-views-review.png'),Buffer.from(damageReview.png,'base64'));
  assert.deepEqual(damageReview.failures,[],'material damage follows silhouettes; fire and collapse animate deterministically');
  console.log('Damage surfaces: side, isometric, rear view, silhouette clipping, fire, collapse and scrubbing passed');
} finally {
  ws?.close(); chrome.kill(); server.closeAllConnections(); server.close();
  await new Promise(r => chrome.exitCode !== null ? r() : chrome.once('exit', r));
  assert.ok(resolve(profile).startsWith(resolve(tmpdir()) + sep));
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
}
