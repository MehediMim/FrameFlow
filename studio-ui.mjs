// Shared chrome for all FrameFlow studios. Keep native controls and their listeners.
export const CANVAS_SIZES = [['1280,720','Landscape · 1280 × 720'],['1920,1080','Full HD · 1920 × 1080'],['1080,1920','Portrait · 1080 × 1920'],['1080,1080','Square · 1080 × 1080']];
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function settingsSection(title, content, { collapsible = false, open = true } = {}) {
  return collapsible
    ? `<details class="ff-settings-section"${open ? ' open' : ''}><summary>${esc(title)}</summary><div class="ff-settings-fields">${content}</div></details>`
    : `<section class="ff-settings-section"><h3>${esc(title)}</h3><div class="ff-settings-fields">${content}</div></section>`;
}
function arrangeSettings(panel, prefix) {
  const heading = panel.querySelector(':scope > .section-title');
  const close = heading?.querySelector('button');
  if (!heading) return;
  const title = document.createElement('h2');
  title.id = `${prefix}SettingsTitle`;title.textContent = 'Canvas settings';
  heading.replaceChildren(title);if(close){close.setAttribute('aria-label','Close canvas settings');heading.append(close);}
  panel.setAttribute('aria-labelledby', title.id);
  const body = document.createElement('div');body.className = 'ff-settings-body';
  if (prefix === 'sc') body.append(document.getElementById('scSettings'));
  else {
    const section = (name, nodes) => {
      const holder = document.createElement('div');holder.innerHTML = settingsSection(name, '');
      const group = holder.firstElementChild;
      for (const node of nodes) if(node) group.querySelector('.ff-settings-fields').append(node);
      body.append(group);
    };
    const control = id => document.getElementById(id)?.closest('label');
    const size = control(prefix === 'motion' ? 'size' : `${prefix}Size`);
    const timing = document.getElementById(prefix === 'motion' ? 'fps' : `${prefix}Fps`)?.closest('.two');
    section('Composition', [size, timing]);
    if(prefix === 'motion') section('Appearance', [control('background')]);
    if(prefix === 'm') {
      section('Map appearance', [control('mTheme'), control('mImagery'), document.getElementById('mTerrainBox'), document.getElementById('mAtlasLabels'), control('mGrat'), document.getElementById('mTextureSection'), document.getElementById('mLabelStyle')]);
      section('Country details', [document.getElementById('mAreaBox')]);
      section('Starting view', [control('mRegion'), document.getElementById('mStartZoom')?.closest('.two'), control('mStartBearing')]);
    }
  }
  heading.after(body);
  const footer = document.createElement('div');footer.className = 'ff-settings-footer';
  const note = document.createElement('span');note.textContent = 'Changes apply immediately';
  const done = document.createElement('button');done.type = 'button';done.className = 'primary';done.textContent = 'Done';done.addEventListener('click',()=>panel.close());
  footer.append(note,done);panel.append(footer);
}
export function confirmStudio(message, title = 'Create new project', accept = 'Create project') {
  return new Promise(resolve => {
    const d = document.createElement('dialog'); d.className='ff-dialog ff-confirm';
    d.innerHTML=`<h2>${esc(title)}</h2><p>${esc(message)}</p><div class="ff-dialog-actions"><button data-no autofocus>Cancel</button><button data-yes class="primary">${esc(accept)}</button></div>`;
    d.setAttribute('aria-label',title); document.body.append(d); let accepted=false;
    d.querySelector('[data-no]').onclick=()=>d.close();
    d.querySelector('[data-yes]').onclick=()=>{accepted=true;d.close()};
    d.addEventListener('close',()=>{d.remove();resolve(accepted)},{once:true}); d.showModal();
  });
}
export function alertStudio(message) {
  const d=document.createElement('dialog');d.className='ff-dialog';d.setAttribute('aria-label','Project message');
  d.innerHTML=`<h2>Project message</h2><p>${esc(message)}</p><button autofocus>Close</button>`;
  document.body.append(d);d.querySelector('button').onclick=()=>d.close();d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();
}
export function exportMarkup({width,height,fps,frames,progressId,statusId,audio=true}) {
  return `<h2>Export video</h2><p class="ff-export-meta">${width} × ${height} · ${fps} FPS · ${(frames/fps).toFixed(2)} seconds · WebM</p><p>Every frame is encoded in order. Keep this window open until the download starts.</p>${audio?'<p class="ff-export-note">Retained audio parts are included with your volume and mute settings.</p>':''}<progress aria-label="Export progress" id="${progressId}" max="${frames}" value="0"></progress><p role="status" aria-live="polite" id="${statusId}">Preparing…</p>`;
}
export function sceneExportDialog(spec) {
  const d=document.createElement('dialog');d.className='ff-dialog';d.setAttribute('aria-label','Export video');
  d.innerHTML=exportMarkup({...spec,progressId:'scExportProgress',statusId:'scExportStatus',audio:false})+'<button>Cancel export</button>';
  document.body.append(d); const button=d.querySelector('button'), status=d.querySelector('[role=status]');
  let running=true,cancelled=false;
  function cancel(){cancelled=true;button.disabled=true;status.textContent='Cancelling…'}
  button.onclick=()=>running?cancel():d.close();
  d.addEventListener('cancel',e=>{if(running){e.preventDefault();cancel()}});
  d.addEventListener('close',()=>d.remove(),{once:true});d.showModal();
  return {cancelled:()=>cancelled,progress:n=>{d.querySelector('progress').value=n;status.textContent=`Rendering frame ${n} of ${spec.frames}`},finish:message=>{running=false;status.textContent=message;button.disabled=false;button.textContent='Close'}};
}
// Preview zoom only: never change the canvas resolution, camera or exported pixels.
export function installCanvasZoom(canvas,root) {
  if(!canvas||!root||root.querySelector('[data-preview-zoom]'))return;
  const area=canvas.closest('.stage-area,.sc-stage'),bar=root.querySelector('.stagebar');
  if(!area||!bar)return;
  let wrap=canvas.parentElement;
  if(wrap===area){wrap=document.createElement('div');canvas.before(wrap);wrap.append(canvas);}
  wrap.classList.add('ff-zoom-wrap');area.classList.add('ff-zoom-area');canvas.classList.add('ff-zoom-canvas');
  const controls=document.createElement('div');controls.className='canvas-zoom';controls.dataset.previewZoom='';controls.setAttribute('role','group');controls.setAttribute('aria-label','Preview zoom');
  controls.innerHTML='<button type="button" data-zoom="out" title="Zoom out" aria-label="Zoom out">−</button><span data-zoom-label>Fit</span><button type="button" data-zoom="in" title="Zoom in" aria-label="Zoom in">+</button><button type="button" data-zoom="actual">100%</button><button type="button" data-zoom="fit">Fit all</button>';
  const actions=bar.querySelector(':scope > div:last-of-type');
  (actions||bar).append(controls);
  const fullscreen=bar.querySelector('#mapFullscreen,#pFullscreen,[data-action="fullscreen"]');
  if(fullscreen)controls.append(fullscreen);
  let scale=1,mode='fit';
  function update(){
    const aw=area.clientWidth,ah=area.clientHeight;if(!aw||!ah)return;
    if(mode==='fit')scale=Math.max(.05,Math.min((aw-48)/canvas.width,(ah-48)/canvas.height));
    const w=canvas.width*scale,h=canvas.height*scale;
    canvas.style.setProperty('width',w+'px','important');canvas.style.setProperty('height',h+'px','important');
    wrap.style.width=Math.max(aw,w+48)+'px';wrap.style.height=Math.max(ah,h+48)+'px';
    controls.querySelector('[data-zoom-label]').textContent=Math.round(scale*100)+'%';
  }
  function set(value){
    const x=(area.scrollLeft+area.clientWidth/2)/Math.max(1,area.scrollWidth),y=(area.scrollTop+area.clientHeight/2)/Math.max(1,area.scrollHeight);
    mode='manual';scale=Math.max(.05,Math.min(4,value));update();
    area.scrollLeft=Math.max(0,x*area.scrollWidth-area.clientWidth/2);area.scrollTop=Math.max(0,y*area.scrollHeight-area.clientHeight/2);
  }
  controls.addEventListener('click',e=>{const action=e.target.closest('[data-zoom]')?.dataset.zoom;
    if(action==='fit'){mode='fit';update();area.scrollLeft=area.scrollTop=0;}
    else if(action)set(action==='actual'?1:scale*(action==='in'?1.1:1/1.1));
  });
  area.addEventListener('wheel',e=>{if(e.ctrlKey||e.metaKey){e.preventDefault();e.stopImmediatePropagation();set(scale*(e.deltaY<0?1.1:1/1.1))}},{passive:false,capture:true});
  // Middle-button drag pans the preview without editing scene content.
  let pan=null;window.addEventListener('blur',()=>{pan=null});
  area.addEventListener('pointerdown',e=>{if(e.button!==1)return;e.preventDefault();e.stopImmediatePropagation();pan={x:e.clientX,y:e.clientY,l:area.scrollLeft,t:area.scrollTop};area.setPointerCapture(e.pointerId)},{capture:true});
  area.addEventListener('pointermove',e=>{if(!pan)return;e.preventDefault();e.stopImmediatePropagation();area.scrollLeft=pan.l-(e.clientX-pan.x);area.scrollTop=pan.t-(e.clientY-pan.y)},{capture:true});
  const end=e=>{if(!pan)return;pan=null;e.stopImmediatePropagation();if(area.hasPointerCapture(e.pointerId))area.releasePointerCapture(e.pointerId)};
  area.addEventListener('pointerup',end,true);area.addEventListener('pointercancel',end,true);
  new ResizeObserver(update).observe(area);
  let dimensions=canvas.width+','+canvas.height;
  new MutationObserver(()=>{const next=canvas.width+','+canvas.height;if(next!==dimensions){dimensions=next;update()}}).observe(canvas,{attributes:true,attributeFilter:['width','height']});
  window.addEventListener('resize',update);document.addEventListener('fullscreenchange',()=>requestAnimationFrame(update));update();
  return {update,set,get scale(){return scale},get mode(){return mode}};
}
function install() {
  if(!document.getElementById('ffStudioStyles')){const css=document.createElement('link');css.id='ffStudioStyles';css.rel='stylesheet';css.href=new URL('./studio-ui.css',import.meta.url).href;document.head.append(css);}
  document.body.classList.add('ff-unified');
  const header=document.querySelector('body > header');
  for(const [id,anchor,mode] of [['new','open','motion'],['mNew','mOpen','map'],['pNew','pOpen','paper']]){
    const b=document.getElementById(id),a=document.getElementById(anchor);
    if(b&&a){b.textContent='＋ New project';b.classList.add(`${mode}-only`);header.insertBefore(b,a)}
  }
  const sceneNew=document.querySelector('#scToolbar [data-action=new]');if(sceneNew)sceneNew.textContent='＋ New project';
  for(const [settings,newId,mode] of [['motionSettingsButton','new','motion'],['mSettingsButton','mNew','map'],['pSettingsButton','pNew','paper']]){
    const b=document.getElementById(settings),n=document.getElementById(newId);
    if(b&&n){b.classList.add(mode+'-only');n.after(b);}
  }
  const sceneSettings=document.getElementById('scSettingsButton');
  if(sceneSettings&&sceneNew)sceneNew.after(sceneSettings);
  for(const [canvasId,rootId] of [['mCanvas','mapStudio'],['pCanvas','paperStudio'],['scCanvas','sceneStudio']]){
    installCanvasZoom(document.getElementById(canvasId),document.getElementById(rootId));
  }
  for(const canvasId of ['canvas','mCanvas','pCanvas','scCanvas']){
    const preview=document.getElementById(canvasId)?.closest('main');
    if(!preview)continue;
    preview.classList.add('ff-preview');
    const png=preview.querySelector('#snapshot,#mSnapshot,#pSnapshot,[data-action="png"]');
    if(png){png.textContent='PNG ↓';png.title='Download current frame as PNG';png.setAttribute('aria-label','Download current frame as PNG');}
    const button=preview.querySelector('#motionFullscreen,#mapFullscreen,#pFullscreen,[data-action="fullscreen"]');
    if(button){
      const update=()=>{const active=document.fullscreenElement===preview;button.textContent=active?'⛶ Exit fullscreen':'⛶ Fullscreen';button.title=active?'Exit fullscreen (Esc or F)':'Show preview fullscreen (F)';button.setAttribute('aria-pressed',String(active));};
      document.addEventListener('fullscreenchange',update);update();
    }
  }
  for(const prefix of ['motion','m','p','sc']){
    const panel=document.getElementById(prefix+'SettingsPanel'),button=document.getElementById(prefix+'SettingsButton');
    if(!panel)continue;panel.classList.add('ff-dialog','ff-settings');panel.setAttribute('aria-label','Canvas settings');
    arrangeSettings(panel,prefix);
    if(button){button.textContent='⚙ Canvas settings';button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-haspopup','dialog');}
  }
  for(const id of ['modal','mModal','pModal'])document.getElementById(id)?.classList.add('ff-dialog');
  for(const el of document.querySelectorAll('.starter > .eyebrow,.starter > h3,.starter > p'))el.hidden=true;
  for(const el of document.querySelectorAll('.timeline-head > div > b'))el.textContent='Timeline';
  for(const el of document.querySelectorAll('.transport > label')){const t=[...el.childNodes].find(n=>n.nodeType===3);if(t)t.textContent='TIME (s) ';}
  for(const el of document.querySelectorAll('.ruler-label > span'))el.textContent='SECONDS →';
  // Do not let editor shortcuts modify a project while any shared dialog is open.
  window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))e.stopImmediatePropagation()},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else queueMicrotask(install);
