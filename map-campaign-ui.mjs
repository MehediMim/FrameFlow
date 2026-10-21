import { pathAt, putPathKey, NETWORK_SHAPES, NETWORK_ANIMATIONS } from './map-path-animation.mjs';
import { regionsInsidePolygon, validPolygon } from './map-area-selection.mjs';
import { GROUP_FIELDS, groupPoseAt, putGroupKey, makeObjectGroup, ungroupObjects } from './map-object-groups.mjs';

const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function installCampaignUI(api){
  const {canvas}=api,$=s=>document.querySelector(s);let draft=null,groupPick=null;const selection=new Set(),collapsed=new Set();
  const item=id=>api.project().actions.find(a=>a.id===id),refresh=()=>{api.changed();api.renderInspector();};
  const inside=a=>api.frame()>=a.start&&api.frame()<=a.start+a.dur;
  const keyList=(a,kind,keys)=>`<div class="m-campaign-keys">${keys.map(k=>`<span><button type="button" data-campaign-seek="${k.frame}">${(k.frame/api.project().fps).toFixed(2)}s</button><button type="button" data-campaign-remove="${kind}:${k.frame}" aria-label="Remove keyframe at ${(k.frame/api.project().fps).toFixed(2)} seconds">×</button></span>`).join('')}</div>`;
  function regionFields(a){
    const active=draft?.id===a.id&&draft.purpose!=='exclude';
    return `<div class="m-area-tools"><label>Draw an area<select data-area-mode><option value="select">Select existing regions inside</option><option value="region" ${a.target?.kind==='polygon'?'selected':''}>Use drawn boundary as one region</option></select></label><label data-area-rule-label>Include regions by<select data-area-rule><option value="center">Center inside the area</option><option value="contained">Entire outline inside the area</option></select></label><label>Region name<input data-area-name maxlength="100" value="${esc(a.target?.kind==='polygon'?a.target.name:'Drawn region')}"></label><div class="two"><button type="button" data-area-draw>${active?'Redraw area':'Draw area on map'}</button><button type="button" data-area-apply ${active?'':'disabled'}>Apply area</button></div>${active?'<div class="two"><button type="button" data-area-back>Last point</button><button type="button" data-area-cancel>Cancel</button></div>':''}<p class="mini-label">Click corners or drag a closed area. Select existing countries/loaded regions, or use your exact outline as a new region. Enter applies; Esc cancels.</p></div>`;
  }
  function exclusionFields(a){
    const active=draft?.id===a.id&&draft.purpose==='exclude';
    return '<div class="section-title m-sep">EXCLUDE FROM HIGHLIGHT</div>'
      +`<div class="m-region-chips">${(a.highlightExclude||[]).map((part,i)=>`<button type="button" data-exclusion-remove="${i}" title="Include this area again">${esc(part.name)} &times;</button>`).join('')}</div>`
      +`<button type="button" data-exclusion-draw>${active?'Redraw excluded area':'Draw area to exclude'}</button>`
      +(active?'<label>Excluded area name<input data-exclusion-name maxlength="100" value="'+esc(draft.name)+'"></label><div class="two"><button type="button" data-exclusion-apply>Apply exclusion</button><button type="button" data-exclusion-back>Last point</button><button type="button" data-exclusion-cancel>Cancel</button></div>':'')
      +'<p class="mini-label">Keep the full country highlighted while leaving drawn areas unfilled. Click at least three corners, then Apply exclusion. You can exclude several areas.</p>';
  }
  function pathFields(a){
    const network=Object.hasOwn(NETWORK_SHAPES,a.shape),disabled=!inside(a);
    return `<div class="section-title m-sep">PATH ANIMATION</div>${network?api.F.sel('networkAnimation','Animation',a.networkAnimation||'reveal',Object.entries(NETWORK_ANIMATIONS))+api.F.num('flowSpeed','Flow / traffic speed (negative reverses)',a.flowSpeed??24,-200,200,1):api.F.chk('revealPath','Draw path progressively',a.revealPath!==false)}${a.shape==='front'?api.F.sel('frontSide','Front-line teeth',a.frontSide||'left',[['left','Left side'],['right','Right side']]):''}<div class="m-path-key-actions"><button type="button" data-path-capture ${disabled?'disabled':''}>◇ Key shape at playhead</button><button type="button" data-path-edit ${disabled?'disabled':''}>Edit shape at playhead</button></div>${disabled?'<p class="mini-label" data-path-time-help>Move the playhead inside this item’s timeline bar to key or edit its shape.</p>':''}${keyList(a,'path',a.pathKeys||[])}<p class="mini-label">Draw the initial path, then move the playhead and edit its shape. Keyed shapes blend between positions, including when point counts differ.</p>`;
  }
  function groupFields(a){
    const pose=groupPoseAt(a,api.frame()),disabled=!inside(a),labels={lon:'Longitude',lat:'Latitude',scale:'Scale',rotation:'Rotation (degrees)',opacity:'Opacity'};
    return `<p class="mini-label">${a.memberIds.length} objects. Changes at the playhead create group keyframes; each object keeps its own animation.</p><div class="two"><button type="button" data-group-position ${disabled?'disabled':''}>Pick group position</button><button type="button" data-group-key ${disabled?'disabled':''}>◇ Key group pose</button></div>${Object.entries(GROUP_FIELDS).map(([field,[min,max]])=>`<label>${labels[field]}<input data-group-field="${field}" type="number" min="${min}" max="${max}" step="${field==='rotation'?1:.01}" value="${+pose[field].toFixed(4)}" ${disabled?'disabled':''}></label>`).join('')}${keyList(a,'group',a.groupKeys||[])}<button type="button" data-group-ungroup>Ungroup at playhead</button><p class="mini-label">Ungroup keeps the current position, rotation and scale, and restores separate object layers.</p>`;
  }
  function cancelArea(){draft=null;groupPick=null;canvas.style.cursor='';api.draw();}
  function applyArea(){
    const a=item(draft?.id);if(!a)return cancelArea();
    if(!validPolygon(draft.path)){api.notify('Draw at least three corners enclosing an area.');return;}
    if(draft.purpose==='exclude'){
      if((a.highlightExclude||[]).length>=100){api.notify('A highlight can exclude up to 100 areas.');return;}
      const part={kind:'polygon',name:($('[data-exclusion-name]')?.value||draft.name||'Excluded area').trim().slice(0,100)||'Excluded area',path:structuredClone(draft.path)};
      api.pause();api.checkpoint();a.highlightExclude=[...(a.highlightExclude||[]),part];draft=null;canvas.style.cursor='';refresh();api.notify('Area excluded from highlight');return;
    }
    const mode=$('[data-area-mode]')?.value||draft.mode,path=draft.path;
    let target;
    if(mode==='region')target={kind:'polygon',name:($('[data-area-name]')?.value||'Drawn region').trim().slice(0,100)||'Drawn region',path:structuredClone(path)};
    else{
      const members=regionsInsidePolygon(api.geo(),path,api.area(),api.detailLevelOf,$('[data-area-rule]')?.value||'center');
      if(!members.length){api.notify('No regions match this area. Expand the outline or use a drawn boundary.');return;}
      if(members.length>200){api.notify('This area contains more than 200 regions. Draw a smaller area.');return;}
      target=members.length===1?members[0]:{kind:'regions',name:`${members.length} selected regions`,members};
    }
    api.pause();api.checkpoint();a.target=target;delete a.borderRing;draft=null;canvas.style.cursor='';refresh();api.notify(mode==='region'?'Drawn region applied':'Regions inside the area selected');
  }
  function bind(a){
    const root=$('#mInspector');
    const exclude=root.querySelector('[data-exclusion-draw]');if(exclude)exclude.onclick=()=>{
      api.endPathDraw(true);api.cancelPick();api.pause();draft={id:a.id,path:[],purpose:'exclude',name:'Excluded area '+((a.highlightExclude||[]).length+1),pressed:false};canvas.style.cursor='crosshair';api.renderInspector();api.draw();
    };
    const excludeName=root.querySelector('[data-exclusion-name]');if(excludeName)excludeName.oninput=()=>draft.name=excludeName.value;
    const excludeApply=root.querySelector('[data-exclusion-apply]');if(excludeApply)excludeApply.onclick=applyArea;
    const excludeBack=root.querySelector('[data-exclusion-back]');if(excludeBack)excludeBack.onclick=()=>{draft?.path.pop();api.draw();};
    const excludeCancel=root.querySelector('[data-exclusion-cancel]');if(excludeCancel)excludeCancel.onclick=()=>{cancelArea();api.renderInspector();};
    root.querySelectorAll('[data-exclusion-remove]').forEach(button=>button.onclick=()=>{api.pause();api.checkpoint();a.highlightExclude.splice(+button.dataset.exclusionRemove,1);refresh();});
    const draw=root.querySelector('[data-area-draw]');if(draw)draw.onclick=()=>{
      api.endPathDraw(true);api.cancelPick();api.pause();draft={id:a.id,path:[],mode:$('[data-area-mode]').value,rule:$('[data-area-rule]').value,name:$('[data-area-name]').value,pressed:false};canvas.style.cursor='crosshair';api.renderInspector();api.draw();
    };
    const mode=root.querySelector('[data-area-mode]');if(mode){const sync=()=>{const custom=mode.value==='region';root.querySelector('[data-area-rule-label]').hidden=custom;root.querySelector('[data-area-name]').closest('label').hidden=!custom;if(draft&&draft.purpose!=='exclude')draft.mode=mode.value;};mode.onchange=sync;if(draft?.id===a.id&&draft.purpose!=='exclude')mode.value=draft.mode;sync();}
    const apply=root.querySelector('[data-area-apply]');if(apply)apply.onclick=applyArea;
    if(draft?.id===a.id&&draft.purpose!=='exclude'){const rule=root.querySelector('[data-area-rule]'),name=root.querySelector('[data-area-name]');if(rule){rule.value=draft.rule;rule.onchange=()=>draft.rule=rule.value;}if(name){name.value=draft.name;name.oninput=()=>draft.name=name.value;}}
    const back=root.querySelector('[data-area-back]');if(back)back.onclick=()=>{draft?.path.pop();api.draw();};
    const cancel=root.querySelector('[data-area-cancel]');if(cancel)cancel.onclick=()=>{cancelArea();api.renderInspector();};
    root.querySelectorAll('[data-campaign-seek]').forEach(b=>b.onclick=()=>{api.endPathDraw(true);api.pause();api.seek(+b.dataset.campaignSeek);api.renderInspector();});
    root.querySelectorAll('[data-campaign-remove]').forEach(b=>b.onclick=()=>{api.pause();api.checkpoint();const[kind,frame]=b.dataset.campaignRemove.split(':'),field=kind==='path'?'pathKeys':'groupKeys';if(kind==='path')a.path=pathAt(a,api.frame());a[field]=a[field].filter(k=>k.frame!==+frame);refresh();});
    const capture=root.querySelector('[data-path-capture]');if(capture)capture.onclick=()=>{
      const path=api.editingPath(a.id)?a.path:pathAt(a,api.frame());if(path.length<2){api.notify('Draw at least two points first.');return;}
      api.pause();api.checkpoint();putPathKey(a,api.frame(),path);if(a.shape==='front')a.revealPath=false;refresh();
    };
    const edit=root.querySelector('[data-path-edit]');if(edit)edit.onclick=()=>{
      const path=pathAt(a,api.frame());if(path.length<2){api.startPathDraw(a.id);return;}
      api.pause();api.checkpoint();putPathKey(a,api.frame(),path);a.path=path;if(a.shape==='front')a.revealPath=false;api.changed();api.startPathDraw(a.id);
    };
    root.querySelectorAll('[data-group-field]').forEach(el=>el.onchange=()=>{const field=el.dataset.groupField,value=el.valueAsNumber,[min,max]=GROUP_FIELDS[field];if(!Number.isFinite(value)||value<min||value>max){api.renderInspector();return;}api.pause();api.checkpoint();putGroupKey(a,api.frame(),{[field]:value});refresh();});
    const groupKey=root.querySelector('[data-group-key]');if(groupKey)groupKey.onclick=()=>{api.pause();api.checkpoint();putGroupKey(a,api.frame(),groupPoseAt(a,api.frame()));refresh();};
    const position=root.querySelector('[data-group-position]');if(position)position.onclick=()=>{api.pause();api.endPathDraw(true);api.cancelPick();draft=null;groupPick=a.id;canvas.style.cursor='crosshair';api.notify('Click the new group position on the map.');};
    const ungroup=root.querySelector('[data-group-ungroup]');if(ungroup)ungroup.onclick=()=>{
      try{const snapshot=structuredClone(api.project()),group=snapshot.actions.find(g=>g.id===a.id);ungroupObjects(snapshot,group,api.frame(),api.resolve);api.pause();api.checkpoint();api.project().actions=snapshot.actions;api.select(a.memberIds.find(id=>snapshot.actions.some(a=>a.id===id)));refresh();}catch(e){api.notify(e.message);}
    };
  }
  function decorateItems(){
    const objects=api.project().actions.filter(a=>a.type==='object'),groups=api.project().actions.filter(a=>a.type==='group');
    for(const id of selection)if(!objects.some(a=>a.id===id))selection.delete(id);
    let bar=$('#mGroupTools');if(!bar){bar=document.createElement('div');bar.id='mGroupTools';bar.className='m-group-tools';$('#mItems').before(bar);}
    bar.innerHTML=`<button type="button" data-group-create ${selection.size<2?'disabled':''}>Group selected (${selection.size})</button><button type="button" data-group-clear>Clear</button>`;
    bar.querySelector('[data-group-clear]').onclick=()=>{selection.clear();decorateItems();};
    bar.querySelector('[data-group-create]').onclick=()=>{
      try{
        const selected=objects.filter(a=>selection.has(a.id));if(selected.length<2)return;
        api.pause();const snapshot=structuredClone(api.project());
        const group=makeObjectGroup(snapshot,[...selection],a=>{const p=api.resolve(a.place);return p&&{lon:p.X*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*p.Y)))*180/Math.PI};},crypto.randomUUID());
        api.checkpoint();api.project().actions=snapshot.actions;collapsed.add(group.id);selection.clear();api.select(group.id);refresh();api.notify('Objects grouped. Edit the group at the playhead to animate them together.');
      }catch(e){api.notify(e.message);}
    };
    for(const row of document.querySelectorAll('#mItems [data-mid]')){
      const a=item(row.dataset.mid);row.querySelectorAll('[data-group-check],[data-group-collapse]').forEach(e=>e.remove());row.hidden=false;
      if(a?.type==='group'){
        const toggle=document.createElement('button');toggle.type='button';toggle.dataset.groupCollapse=a.id;toggle.textContent=collapsed.has(a.id)?'▸':'▾';toggle.title='Expand or collapse group';toggle.setAttribute('aria-expanded',String(!collapsed.has(a.id)));toggle.onclick=e=>{e.stopPropagation();if(collapsed.has(a.id))collapsed.delete(a.id);else collapsed.add(a.id);decorateItems();decorateTimeline();};row.prepend(toggle);
      }
      if(a?.type!=='object')continue;const parent=groups.find(g=>g.memberIds.includes(a.id));row.classList.toggle('m-group-child',!!parent);if(parent){row.hidden=collapsed.has(parent.id);row.title=`In ${parent.name}`;continue;}
      const check=document.createElement('input');check.type='checkbox';check.dataset.groupCheck=a.id;check.checked=selection.has(a.id);check.setAttribute('aria-label',`Select ${a.name} for grouping`);check.onclick=e=>e.stopPropagation();check.onchange=()=>{if(check.checked)selection.add(a.id);else selection.delete(a.id);decorateItems();};row.prepend(check);
    }
  }
  function decorateTimeline(){
    const groups=api.project().actions.filter(a=>a.type==='group');for(const row of document.querySelectorAll('#mTrackLabels [data-mtl],#mTrackRows [data-mrow]')){const id=row.dataset.mtl||row.dataset.mrow,parent=groups.find(g=>g.memberIds.includes(id));row.hidden=!!parent&&collapsed.has(parent.id);row.classList.toggle('m-group-child',!!parent);}
  }
  function overlay(ctx,view){
    if(!draft||!view)return;const a=item(draft.id);if(!a||api.current()?.id!==draft.id){cancelArea();return;}
    const points=draft.path.map(p=>api.projectPoint(view,p)),hover=draft.hover&&api.projectPoint(view,draft.hover);if(!points.length)return;
    ctx.save();ctx.strokeStyle='#e9cc75';ctx.fillStyle='#e9cc7528';ctx.lineWidth=2*view.unit;ctx.setLineDash([6*view.unit,4*view.unit]);ctx.beginPath();let prior=false;for(const p of points){if(!p||p.z<=view.near){prior=false;continue;}if(prior)ctx.lineTo(p.x,p.y);else ctx.moveTo(p.x,p.y);prior=true;}if(hover&&prior)ctx.lineTo(hover.x,hover.y);if(points.length>=3){ctx.closePath();ctx.fill('evenodd');}ctx.stroke();ctx.setLineDash([]);for(const p of points)if(p&&p.z>view.near){ctx.beginPath();ctx.arc(p.x,p.y,3.5*view.unit,0,Math.PI*2);ctx.fillStyle='#e9cc75';ctx.fill();}ctx.restore();
  }
  const point=e=>api.pointAt(e);
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||(!draft&&!groupPick)||api.exporting())return;
    e.preventDefault();e.stopImmediatePropagation();const p=point(e);if(!p)return;
    if(groupPick){const a=item(groupPick);if(a&&api.current()?.id===groupPick&&inside(a)){api.checkpoint();putGroupKey(a,api.frame(),{lon:p.lon,lat:p.lat});}groupPick=null;canvas.style.cursor='';refresh();return;}
    if(draft.path.length>=120){api.notify('An area can contain up to 120 points.');return;}
    draft.path.push(p);draft.pressed=true;draft.last={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);api.draw();
  },true);
  canvas.addEventListener('pointermove',e=>{if(!draft)return;const p=point(e);if(!p)return;draft.hover=p;if(draft.pressed&&draft.path.length<120&&Math.hypot(e.clientX-draft.last.x,e.clientY-draft.last.y)>12){draft.path.push(p);draft.last={x:e.clientX,y:e.clientY};}api.draw();},true);
  canvas.addEventListener('pointerup',e=>{if(!draft)return;draft.pressed=false;if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);},true);
  canvas.addEventListener('pointercancel',()=>{if(draft)draft.pressed=false;},true);
  window.addEventListener('keydown',e=>{
    if((!draft&&!groupPick)||!document.body.classList.contains('mode-map')||document.querySelector('dialog[open]'))return;
    const typing=['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName);
    if(e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();cancelArea();api.renderInspector();}
    else if(!typing&&e.key==='Enter'&&draft){e.preventDefault();e.stopImmediatePropagation();applyArea();}
    else if(!typing&&['Backspace','Delete'].includes(e.key)&&draft){e.preventDefault();e.stopImmediatePropagation();draft.path.pop();api.draw();}
  },true);
  return{regionFields,exclusionFields,pathFields,groupFields,bind,decorateItems,decorateTimeline,overlay,cancel:cancelArea};
}
