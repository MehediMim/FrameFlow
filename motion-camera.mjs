import { bindTimelineRename } from './timeline-rename.mjs?v=timeline-rename-2';
import { poseAt } from './engine.mjs';
// FrameFlow Motion Studio: layered 2.5D camera with focus tracking and depth of field.
// Camera motion is deterministic for a given timeline frame (including export).
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const finite=(n,d=0)=>Number.isFinite(Number(n))?Number(n):d;
const rad=n=>n*Math.PI/180;
const presets={
 push:['Push in',1,1.65,0,0,0,0],pull:['Pull back',1.65,1,0,0,0,0],
 panRight:['Pan right',1,1,-240,0,240,0],panLeft:['Pan left',1,1,240,0,-240,0],
 panUp:['Pan up',1,1,0,180,0,-180],panDown:['Pan down',1,1,0,-180,0,180],
 orbit:['3D orbit',1,1.08,0,0,0,0],tilt:['3D tilt',1,1,0,0,0,0],
 shake:['Handheld shake',1.06,1.06,0,0,0,0],focus:['Focus on layer',1,1.38,0,0,0,0],
 rackFocus:['Rack focus',1,1,0,0,0,0],dolly:['3D dolly in',1,1.08,0,0,0,0],
 crane:['3D crane',1,1.05,0,-130,0,100],arc:['3D parallax arc',1.02,1.1,-90,0,80,0],
 cinematic:['Cinematic push',1,1.35,0,0,0,0]
};
const cameraMods={
 push:[0,4,0,-2,0,-95],pull:[-4,0,-2,0,-95,0],
 panRight:[-6,7,0,0,0,0],panLeft:[7,-6,0,0,0,0],
 panUp:[0,0,3,-4,0,0],panDown:[0,0,-4,3,0,0],
 orbit:[-27,27,5,5,0,0],tilt:[0,0,-16,16,0,0],shake:[0,0,0,0,0,0],
 focus:[-5,6,1,4,0,-55],rackFocus:[0,0,0,0,0,0],dolly:[0,0,0,0,130,-200],
 crane:[-5,7,-13,11,0,-60],arc:[-24,24,6,6,0,-50],cinematic:[-12,10,-3,5,60,-120]
};
export const CAMERA_PRESETS=Object.fromEntries(Object.entries(presets).map(([k,v])=>[k,v[0]]));
export const cameraShots=p=>p.cameraShots||[];
export function depthForLayer(p,layer){
 if(!layer)return 0;
 if(Number.isFinite(layer.depth))return clamp(layer.depth,-500,500);
 // Older projects have no depth values. Their stacking order defines depth automatically.
 const idx=p.layers.findIndex(x=>x.id===layer.id);
 return idx<0?0:Math.min(500,(p.layers.length-1-idx)*55);
}
export function makeCameraShot(p,preset,frame,selectedId=null){
 const v=presets[preset]||presets.push,m=cameraMods[preset]||cameraMods.push;
 const dur=Math.min(Math.max(1,Math.round(p.fps*2)),Math.max(1,p.frames-frame));
 const focusId=p.layers.some(l=>l.id===selectedId&&l.type!=='group')?selectedId:(p.layers.findLast(l=>l.type!=='group')?.id||'');
 const shot={id:crypto.randomUUID(),name:v[0],preset,start:frame,dur,zoomA:v[1],zoomB:v[2],xA:v[3],yA:v[4],xB:v[5],yB:v[6],
 rotationA:0,rotationB:preset==='shake'?0:0,yawA:m[0],yawB:m[1],pitchA:m[2],pitchB:m[3],dollyA:m[4],dollyB:m[5],
 perspective:1200,easing:'easeInOut',strength:12,focusLayerId:focusId,
 depthOfField:['focus','rackFocus','cinematic'].includes(preset),
 aperture:preset==='rackFocus'?24:20,blurBehindOnly:preset!=='rackFocus',trackFocus:preset==='focus',
 focusFromDepth:preset==='rackFocus'?300:null,
 endBehavior:'return',returnTime:Math.min(.7,Math.max(.16,dur/p.fps*.28))};
 // A/B are absolute camera coordinates for the inspector, captured at the playhead.
 // Runtime uses B - A, so the same relative move follows other camera animation.
 return rebaseCameraShot(p,shot,frame);
}
const ease=(t,type)=>type==='linear'?t:type==='easeIn'?t*t*t:type==='easeOut'?1-(1-t)**3:t*t*(3-2*t);
const targetCenter=(p,layer,f)=>{
 if(!layer)return{x:p.width/2,y:p.height/2};
 const pos=poseAt(layer,f);let {x,y}=pos;
 const parent=p.layers.find(l=>l.id===layer.parentId&&l.type==='group');
 if(parent){const group=poseAt(parent,f),theta=rad(group.rotation),sc=group.scale;
  const dx=x-(parent.anchorX??parent.x),dy=y-(parent.anchorY??parent.y);
  x=group.x+sc*(dx*Math.cos(theta)-dy*Math.sin(theta));
  y=group.y+sc*(dx*Math.sin(theta)+dy*Math.cos(theta));
 }
 return {x,y};
};
function keyGroup(layer,k,f){const keys=layer.keys?.[k]||[];if(!keys.length)return finite(layer[k],k==='scale'?1:0);const a=[...keys].sort((x,y)=>x.f-y.f);if(f<=a[0].f)return a[0].v;for(let i=1;i<a.length;i++)if(f<=a[i].f){const p=a[i-1],q=a[i],t=clamp((f-p.f)/(q.f-p.f),0,1);return p.v+(q.v-p.v)*ease(t,p.e);}return a.at(-1).v;}
// Every shot is a RELATIVE, time-bounded camera effect. Its changes are
// composited on the camera pose already in progress at the evaluation frame;
// overlapping shots do not reset the camera to a frozen preset pose.
const neutralCamera=()=>({zoom:1,x:0,y:0,rotation:0,yaw:0,pitch:0,dolly:0,
 perspective:1200,depthOfField:false,aperture:0,focusLayerId:'',focusDepth:0,blurBehindOnly:true});
const blend=(a,b,t)=>a+(b-a)*t;
export function cameraAt(p,f){
 const state=neutralCamera();
 const shots=[...cameraShots(p)].sort((a,b)=>a.start-b.start);
 for(const s of shots){
  if(f<s.start)break;
  const dur=Math.max(1,finite(s.dur,1)),end=s.start+dur,hold=s.endBehavior==='hold';
  if(f>=end&&!hold)continue;
  const elapsed=clamp(f-s.start,0,dur);
  const requested=finite(s.returnTime,Math.min(.7,Math.max(.16,dur/(p.fps||30)*.28)));
  const returnFrames=clamp(Math.round(requested*(p.fps||30)),1,Math.max(1,dur-1));
  const moveFrames=hold?dur:Math.max(1,dur-returnFrames);
  const u=ease(clamp(elapsed/moveFrames,0,1),s.easing);
  const arrival=Math.min(Math.max(1,Math.round(moveFrames*.14)),Math.max(1,moveFrames));
  const fadeIn=ease(clamp(elapsed/arrival,0,1),'easeInOut');
  const fadeOut=hold||elapsed<=moveFrames?1:1-ease(clamp((elapsed-moveFrames)/returnFrames,0,1),'easeInOut');
  // Interpolate once. The final camera is the current underlying pose plus
  // (shot end - shot start), never the default camera plus an absolute preset end.
  const weight=u*(hold?1:fadeIn*fadeOut);
  const za=Math.max(.01,finite(s.zoomA,1));
  const ratio=Math.max(.01,finite(s.zoomB,za))/za;
  state.zoom*=1+(ratio-1)*weight;
  for(const k of ['x','y','rotation','yaw','pitch','dolly']){
   const initial=finite(s[k+'A']);
   state[k]+=(finite(s[k+'B'],initial)-initial)*weight;
  }
  state.perspective=blend(state.perspective,clamp(finite(s.perspective,1200),400,5000),weight);
  const subject=p.layers.find(l=>l.id===s.focusLayerId);
  if(s.trackFocus&&subject){const target=targetCenter(p,subject,Math.min(f,end));
   // Focus is a target camera position, NOT a second offset from zero. A held
   // pan is already in state.x/y; adding the target would overshoot it.
   state.x=blend(state.x,target.x-p.width/2,weight);
   state.y=blend(state.y,target.y-p.height/2,weight);
  }
  if(s.preset==='shake'&&elapsed<dur){const fade=Math.sin(Math.PI*u),mag=finite(s.strength,12)*fade*weight;
   state.x+=Math.sin(f*2.399)*mag;state.y+=Math.sin(f*1.943)*mag*.8;state.rotation+=Math.sin(f*1.31)*mag*.12;
  }
  if(s.depthOfField){
   const aperture=clamp(finite(s.aperture,18),0,45);
   state.aperture=blend(state.aperture,aperture,weight);
   if(weight>.0001){
    state.focusLayerId=s.focusLayerId||'';
    state.blurBehindOnly=s.blurBehindOnly!==false;
    const depth=subject?depthForLayer(p,subject):finite(s.focusDepth);
    const focus=s.preset==='rackFocus'&&Number.isFinite(s.focusFromDepth)
      ?blend(s.focusFromDepth,depth,u):depth;
    state.focusDepth=blend(state.focusDepth,focus,weight);
   }
   state.depthOfField=state.aperture>.001;
  }
 }
 return state;
}
// Re-anchor a preset at its actual start time, excluding the shot being moved.
// Preserve the user's intended movement delta and zoom ratio if the clip moves
// to another frame, or if an earlier camera clip changes.
export function rebaseCameraShot(p,shot,at=shot.start){
 const base=cameraAt({...p,cameraShots:cameraShots(p).filter(x=>x.id!==shot.id)},at);
 const za=Math.max(.01,finite(shot.zoomA,1));
 const ratio=Math.max(.01,finite(shot.zoomB,za))/za;
 const deltas=Object.fromEntries(['x','y','rotation','yaw','pitch','dolly'].map(k=>
  [k,finite(shot[k+'B'])-finite(shot[k+'A'])]));
 shot.start=at;
 shot.zoomA=base.zoom;shot.zoomB=base.zoom*ratio;
 for(const [k,delta] of Object.entries(deltas)){
  shot[k+'A']=base[k];shot[k+'B']=base[k]+delta;
 }
 shot.anchorMode='dynamic';
 return shot;
}
// 2D plane camera with yaw/pitch foreshortening. Local depth transform is applied separately.
export function applyCamera(ctx,p,f,camera=cameraAt(p,f)){
 const s=camera,cx=p.width/2,cy=p.height/2,ya=rad(s.yaw),pi=rad(s.pitch);
 ctx.translate(cx,cy);ctx.rotate(rad(s.rotation));ctx.scale(s.zoom,s.zoom);
 ctx.transform(Math.cos(ya),Math.sin(pi)*Math.sin(ya)*.16,-Math.sin(ya)*Math.sin(pi)*.18,Math.cos(pi),0,0);
 ctx.translate(-cx-s.x,-cy-s.y);
}
// Per-layer optical projection. No 3D meshes required; stacking depth makes parallax observable.
export function depthTransform(p,layer,camera){
 const depth=depthForLayer(p,layer),a=rad(camera.yaw),b=rad(camera.pitch);
 const active=Math.abs(camera.yaw)+Math.abs(camera.pitch)+Math.abs(camera.dolly)>0.001;
 return {depth,scale:active?clamp(camera.perspective/(camera.perspective+depth+camera.dolly),.22,4):1,
  dx:active?-depth*Math.sin(a)*.85:0,dy:active?depth*Math.sin(b)*.85:0};
}
export function applyLayerDepth(ctx,p,layer,camera,center){
 const {scale,dx,dy}=depthTransform(p,layer,camera);
 if(Math.abs(scale-1)<1e-7&&!dx&&!dy)return;
 ctx.translate(center.x+dx,center.y+dy);ctx.scale(scale,scale);ctx.translate(-center.x,-center.y);
}
export function unprojectLayerPoint(p,layer,camera,point,center){
 const {scale,dx,dy}=depthTransform(p,layer,camera);
 return {x:center.x+(point.x-center.x-dx)/scale,y:center.y+(point.y-center.y-dy)/scale};
}
export function screenToCameraPoint(p,f,sx,sy){
 const s=cameraAt(p,f),cx=p.width/2,cy=p.height/2,theta=-rad(s.rotation),dx=(sx-cx)/s.zoom,dy=(sy-cy)/s.zoom;
 const rx=dx*Math.cos(theta)-dy*Math.sin(theta),ry=dx*Math.sin(theta)+dy*Math.cos(theta),a=rad(s.yaw),b=rad(s.pitch);
 const aa=Math.cos(a),bb=Math.sin(b)*Math.sin(a)*.16,cc=-Math.sin(a)*Math.sin(b)*.18,dd=Math.cos(b),det=aa*dd-bb*cc||1;
 return {x:cx+s.x+(dd*rx-cc*ry)/det,y:cy+s.y+(-bb*rx+aa*ry)/det};
}
export function layerBlur(p,layer,camera){
 const own=clamp(finite(layer.blur,0),0,80);
 if(!camera.depthOfField||!camera.aperture)return own;
 const distance=depthForLayer(p,layer)-camera.focusDepth;
 const diff=camera.blurBehindOnly?Math.max(0,distance):Math.abs(distance);
 return clamp(Math.hypot(own,clamp(diff*.085*camera.aperture/18,0,50)),0,80);
}
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function attachMotionCamera(host){
 let active=null,drag=null;const $=s=>document.querySelector(s);
 const style=document.createElement('style');style.textContent=`.workspace.motion-only .ff-camera-controls{margin:0 0 18px;padding:0 0 14px;border-bottom:1px solid var(--line)}
.workspace.motion-only .ff-camera-preset-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px;margin:0 0 12px}
.workspace.motion-only .ff-camera-preset-grid button{display:flex;align-items:center;gap:7px;text-align:left;padding:8px 7px;font-size:10px;background:#202428;white-space:normal;line-height:1.2;min-height:37px}
.workspace.motion-only .ff-camera-preset-grid button b{font-size:15px;font-weight:400;width:16px;color:#9fd3ee;flex:none}
.workspace.motion-only .ff-camera-preset-grid button span{flex:1;min-width:0}
.workspace.motion-only .ff-camera-preset-grid button:hover{background:#2c3135;border-color:#59616a}
.ff-camera-clip{background:#4cc9f044!important;border-color:#4cc9f0!important}.ff-camera-clip.selected{outline:2px solid #b6f36e}.ff-camera-clip .clip-label{pointer-events:none}`;document.head.append(style);
 const ICONS={push:'⊕',pull:'⊖',panRight:'⇢',panLeft:'⇠',panUp:'↑',panDown:'↓',orbit:'⟳',tilt:'↻',shake:'≋',focus:'◎',rackFocus:'◉',dolly:'➔',crane:'↥',arc:'◔',cinematic:'✧'};
 const panel=document.createElement('div');panel.className='ff-camera-controls';
 panel.innerHTML='<div class="section-title">CAMERA PRESETS <span>▣</span></div><div class="m-presets ff-camera-preset-grid">'+Object.entries(CAMERA_PRESETS).map(([id,label])=>`<button type="button" data-camera-add="${id}" title="Add ${esc(label)}" aria-label="Add ${esc(label)} camera shot"><b>${ICONS[id]}</b><span>${esc(label)}</span></button>`).join('')+'</div><p class="mini-label">Select a subject layer, then add Focus on layer or Rack focus. Use Depth in layer properties to create parallax. Each blue camera clip returns to the preceding view unless Hold final is chosen.</p>';
 const aside=$('.workspace.motion-only .left'),anchor=aside?.querySelector('.add-grid');if(aside){if(aside.classList.contains('ff-left-accordion'))aside.append(panel);else if(anchor)anchor.insertAdjacentElement('afterend',panel);else aside.append(panel);}
 panel.addEventListener('click',e=>{const b=e.target.closest('[data-camera-add]');if(!b)return;host.pause();host.checkpoint();const p=host.project(),f=host.frame(),s=makeCameraShot(p,b.dataset.cameraAdd,f,host.selectedLayer());(p.cameraShots||(p.cameraShots=[])).push(s);active=s.id;host.selectLayer(null);host.changed();});
 const find=()=>cameraShots(host.project()).find(s=>s.id===active);
 bindTimelineRename($('#trackLabels'), { attribute: 'data-cam-select', getItem: id => cameraShots(host.project()).find(s => s.id === id), checkpoint: host.checkpoint, changed: host.changed, pause: host.pause, maxLength: 80 });
 function inspect(){
  const s=find();if(!s)return false;const p=host.project();
  rebaseCameraShot(p,s,s.start);
  const option=(key,label,val)=>`<label>${label}<input data-cam="${key}" type="number" step="1" ${key.endsWith('A')?'readonly title="Automatically follows the camera at shot start"':''} value="${finite(val)}"></label>`;
  $('#inspector').innerHTML=`<div class="inspector-title"><span>◉</span> ${esc(s.name)}</div>
  <label>Preset<select data-cam="preset">${Object.entries(CAMERA_PRESETS).map(([k,n])=>`<option value="${k}" ${k===s.preset?'selected':''}>${esc(n)}</option>`).join('')}</select></label>
  <div class="section-title">CAMERA SHOT</div><div class="two"><label>Start (s)<input data-cam="start" type="number" min="0" max="${(p.frames-1)/p.fps}" step="0.01" value="${(s.start/p.fps).toFixed(2)}"></label><label>Duration (s)<input data-cam="dur" type="number" min="0.03" max="${p.frames/p.fps}" step="0.01" value="${(s.dur/p.fps).toFixed(2)}"></label></div>
  <div class="section-title">3D-STYLE CAMERA / PARALLAX</div>
  <p class="mini-label">Start is automatically sampled at this clip's timeline position. End is relative to that start (and continues following any underlying camera motion). Move the clip to rebase both endpoints.</p>
  <div class="two"><label>Start zoom (auto)<input data-cam="zoomA" readonly title="Camera zoom at clip start" type="number" min="0.1" max="20" step="0.05" value="${finite(s.zoomA,1)}"></label><label>End zoom (target)<input data-cam="zoomB" type="number" min="0.1" max="20" step="0.05" value="${finite(s.zoomB,1)}"></label></div>
  <div class="two">${option('yawA','Start yaw °',s.yawA)}${option('yawB','End yaw °',s.yawB)}</div>
  <div class="two">${option('pitchA','Start pitch °',s.pitchA)}${option('pitchB','End pitch °',s.pitchB)}</div>
  <div class="two">${option('dollyA','Start dolly',s.dollyA)}${option('dollyB','End dolly',s.dollyB)}</div>
  <label>Perspective / focal length<input data-cam="perspective" type="number" min="400" max="5000" step="50" value="${finite(s.perspective,1200)}"></label>
  <div class="two">${option('xA','Start pan X',s.xA)}${option('xB','End pan X',s.xB)}</div>
  <div class="two">${option('yA','Start pan Y',s.yA)}${option('yB','End pan Y',s.yB)}</div>
  <div class="two">${option('rotationA','Start roll °',s.rotationA)}${option('rotationB','End roll °',s.rotationB)}</div>
  <div class="section-title">FOCUS / DEPTH OF FIELD</div>
  <label>Focus subject<select data-cam="focusLayerId"><option value="">Manual focus depth</option>${p.layers.filter(l=>l.type!=='group').map(l=>`<option value="${esc(l.id)}" ${l.id===s.focusLayerId?'selected':''}>${esc(l.name)}</option>`).join('')}</select></label>
  <label class="m-chk"><input type="checkbox" data-cam="trackFocus" ${s.trackFocus?'checked':''}> Track subject with camera</label>
  <label class="m-chk"><input type="checkbox" data-cam="depthOfField" ${s.depthOfField?'checked':''}> Enable depth of field</label>
  <label class="m-chk"><input type="checkbox" data-cam="blurBehindOnly" ${s.blurBehindOnly!==false?'checked':''}> Blur layers behind subject only</label>
  <label>Blur strength / aperture<input data-cam="aperture" type="range" min="0" max="45" step="1" value="${finite(s.aperture,20)}"><span class="ff-fx-value">${finite(s.aperture,20)}</span></label>
  <label>Manual focus depth<input data-cam="focusDepth" type="number" min="-500" max="500" step="5" value="${finite(s.focusDepth)}"></label>
  <label>Rack focus start depth<input data-cam="focusFromDepth" type="number" min="-500" max="500" step="5" value="${finite(s.focusFromDepth,300)}"></label>
  <div class="section-title">END BEHAVIOR</div>
  <label>When the camera clip finishes<select data-cam="endBehavior"><option value="return" ${s.endBehavior!=='hold'?'selected':''}>Return to previous view (default)</option><option value="hold" ${s.endBehavior==='hold'?'selected':''}>Hold final camera view</option></select></label>
  <label>Return time (seconds)<input data-cam="returnTime" type="number" min="0.03" step="0.05" value="${finite(s.returnTime,Math.min(.7,Math.max(.16,s.dur/p.fps*.28))).toFixed(2)}" ${s.endBehavior==='hold'?'disabled':''}></label>
  <p class="mini-label">Return smoothly restores pan, zoom, 3D rotation, parallax and focus blur. Hold final keeps the ending camera until another clip overrides it.</p>
  <div class="section-title">TIMING</div><label>Easing<select data-cam="easing">${['easeInOut','linear','easeIn','easeOut'].map(k=>`<option value="${k}" ${s.easing===k?'selected':''}>${k}</option>`).join('')}</select></label>
  <label>Shake strength<input data-cam="strength" type="number" min="0" max="100" value="${finite(s.strength,12)}"></label>
  <button id="ffCameraRemove" type="button">Delete camera shot</button><p class="mini-label">This is a layered 2.5D camera: the artwork remains flat, but camera rotation, perspective, parallax and optical blur are rendered frame by frame, including video exports.</p>`;
  $('#inspector').querySelectorAll('[data-cam]').forEach(el=>el.addEventListener(el.type==='range'?'change':'change',()=>{
   const k=el.dataset.cam,v=el.type==='checkbox'?el.checked:el.value;
   if(el.readOnly)return;
   if(k==='preset'){host.checkpoint();const withoutSelf={...p,cameraShots:cameraShots(p).filter(q=>q.id!==s.id)};
    const replacement=makeCameraShot(withoutSelf,v,s.start,s.focusLayerId);
    Object.assign(s,replacement,{id:s.id,start:s.start,dur:s.dur,endBehavior:s.endBehavior||'return',returnTime:s.returnTime??replacement.returnTime});}
   else{if(el.type==='number'&&!Number.isFinite(Number(v)))return;if(['start','dur','returnTime'].includes(k)&&(!Number.isSafeInteger(Math.round(Number(v)*p.fps))||(k==='returnTime'&&Number(v)<.03))){el.value=k==='returnTime'?s[k]:s[k]/p.fps;return;}host.checkpoint();if(k==='start')rebaseCameraShot(p,s,clamp(Math.round(Number(v)*p.fps),0,Math.max(0,p.frames-s.dur)));
    else if(k==='dur')s.dur=clamp(Math.round(Number(v)*p.fps),1,p.frames-s.start);
    else if(['name','easing','focusLayerId','endBehavior'].includes(k))s[k]=v;
    else if(el.type==='checkbox')s[k]=v;
    else s[k]=Number(v);
   }
   host.changed();
  }));
  $('#ffCameraRemove').onclick=()=>{host.checkpoint();p.cameraShots=p.cameraShots.filter(q=>q.id!==s.id);active=null;host.changed();};return true;
 }
 function timeline(){
  const p=host.project(),shots=[...cameraShots(p)].sort((a,b)=>a.start-b.start);if(!shots.length)return;
  const labs=$('#trackLabels'),rows=$('#trackRows');if(!labs||!rows)return;
  labs.insertAdjacentHTML('afterbegin',shots.map(s=>`<div class="track-label ${s.id===active?'selected':''}" data-cam-select="${s.id}"><span>◉</span><span class="ff-layer-name" title="Double-click or double-tap to rename">${esc(s.name)}</span></div>`).join(''));
  rows.insertAdjacentHTML('afterbegin',shots.map(s=>{const left=100*s.start/(p.frames-1),right=100*(p.frames-1-Math.min(p.frames-1,s.start+s.dur))/(p.frames-1);return `<div class="track-row" data-cam-select="${s.id}"><div class="clip clip-editable ff-camera-clip ${s.id===active?'selected':''}" data-camera-clip="${s.id}" style="left:${left}%;right:${right}%"><span class="clip-handle clip-left" data-camera-trim="left"></span><span class="clip-label">◉ ${esc(s.name)}</span><span class="clip-handle clip-right" data-camera-trim="right"></span></div></div>`}).join(''));
  rows.querySelectorAll('[data-camera-clip]').forEach(el=>el.onpointerdown=e=>{if(e.button!==0)return;e.stopPropagation();e.preventDefault();host.pause();const s=cameraShots(p).find(q=>q.id===el.dataset.cameraClip);if(!s)return;active=s.id;host.selectLayer(null);host.checkpoint();drag={id:s.id,startX:e.clientX,start:s.start,dur:s.dur,mode:e.target.closest('[data-camera-trim]')?.dataset.cameraTrim||'move'};host.renderInspector();timelineRefresh();});
  for(const el of document.querySelectorAll('[data-cam-select]'))if(!el.closest('[data-camera-clip]'))el.addEventListener('click',()=>{active=el.dataset.camSelect;host.selectLayer(null);host.renderInspector();host.renderTimeline();});
 }
 function timelineRefresh(){document.querySelectorAll('.ff-camera-clip').forEach(el=>el.classList.toggle('selected',el.dataset.cameraClip===active));}
 window.addEventListener('pointermove',e=>{if(!drag)return;const p=host.project(),s=cameraShots(p).find(x=>x.id===drag.id),width=$('#tracks')?.getBoundingClientRect().width||1;if(!s)return;const d=Math.round((e.clientX-drag.startX)/width*(p.frames-1));if(drag.mode==='move')rebaseCameraShot(p,s,clamp(drag.start+d,0,p.frames-s.dur));else if(drag.mode==='left'){const end=drag.start+drag.dur;rebaseCameraShot(p,s,clamp(drag.start+d,0,end-1));s.dur=end-s.start;}else s.dur=clamp(drag.dur+d,1,p.frames-s.start);host.draw();host.renderTimeline();});
 window.addEventListener('pointerup',()=>{if(drag){drag=null;host.changed();}});
 return {inspect,timeline,clear:()=>{active=null},isActive:()=>!!find(),removeSelected:()=>{const s=find();if(!s)return false;host.pause();host.checkpoint();const p=host.project();p.cameraShots=p.cameraShots.filter(x=>x.id!==s.id);active=null;host.changed();return true;}};
}
