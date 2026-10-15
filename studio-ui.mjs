// Shared chrome for all FrameFlow studios. Keep native controls and their listeners.
export const CANVAS_SIZES = [['1280,720','Landscape · 1280 × 720'],['1920,1080','Full HD · 1920 × 1080'],['1080,1920','Portrait · 1080 × 1920'],['1080,1080','Square · 1080 × 1080']];
const esc = v => String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
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
function install() {
  if(!document.getElementById('ffStudioStyles')){const css=document.createElement('link');css.id='ffStudioStyles';css.rel='stylesheet';css.href=new URL('./studio-ui.css',import.meta.url).href;document.head.append(css);}
  document.body.classList.add('ff-unified');
  const header=document.querySelector('body > header');
  for(const [id,anchor,mode] of [['new','open','motion'],['mNew','mOpen','map'],['pNew','pOpen','paper']]){
    const b=document.getElementById(id),a=document.getElementById(anchor);
    if(b&&a){b.textContent='＋ New project';b.classList.add(`${mode}-only`);header.insertBefore(b,a)}
  }
  const sceneNew=document.querySelector('#scToolbar [data-action=new]');if(sceneNew)sceneNew.textContent='＋ New project';
  const sceneSettings=document.getElementById('scSettingsButton');
  const sceneBar=document.querySelector('#sceneStudio .stagebar > div:last-child');
  if(sceneSettings&&sceneBar)sceneBar.prepend(sceneSettings);
  for(const prefix of ['motion','m','p','sc']){
    const panel=document.getElementById(prefix+'SettingsPanel'),button=document.getElementById(prefix+'SettingsButton');
    if(!panel)continue;panel.classList.add('ff-dialog','ff-settings');panel.setAttribute('aria-label','Canvas settings');
    const heading=panel.querySelector(':scope > .section-title');
    if(heading){const close=heading.querySelector('button');heading.replaceChildren(document.createTextNode('Canvas settings'));if(close)heading.append(close)}
    if(button){button.textContent='⚙ Canvas settings';button.setAttribute('aria-controls',panel.id);button.setAttribute('aria-haspopup','dialog');}
  }
  // Match the common Canvas → Frame rate / Duration order without cloning inputs.
  const mp=document.getElementById('mSettingsPanel'),size=document.getElementById('mSize'),fps=document.getElementById('mFps');
  if(mp&&size&&fps){const title=mp.firstElementChild;title.after(size.closest('label'));size.closest('label').after(fps.closest('.two'));}
  for(const id of ['modal','mModal','pModal'])document.getElementById(id)?.classList.add('ff-dialog');
  for(const el of document.querySelectorAll('.starter > .eyebrow,.starter > h3,.starter > p'))el.hidden=true;
  for(const el of document.querySelectorAll('.timeline-head > div > b'))el.textContent='Timeline';
  for(const el of document.querySelectorAll('.transport > label')){const t=[...el.childNodes].find(n=>n.nodeType===3);if(t)t.textContent='TIME (s) ';}
  for(const el of document.querySelectorAll('.ruler-label > span'))el.textContent='SECONDS →';
  // Do not let editor shortcuts modify a project while any shared dialog is open.
  window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]'))e.stopImmediatePropagation()},true);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install,{once:true});else queueMicrotask(install);