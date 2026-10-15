import { confirmStudio, exportMarkup } from './studio-ui.mjs';
import { drawShape, shapeInspector, bindShapeInspector } from './motion-shapes.mjs';
import { installAlignBar } from './motion-align.mjs';
import { applyCamera, attachMotionCamera, cameraAt, applyLayerDepth, unprojectLayerPoint, screenToCameraPoint, layerBlur, depthForLayer } from './motion-camera.mjs';
import {drawTextTexture,textTextureInspector,bindTextTextureInspector} from './motion-texture.mjs';
import { getAudioSnapshot, registerAudioStudio } from './audio-reference.mjs';
let audioUI = null;
let cameraUI = null;
import { sanitizeSvg, drawVector, vectorInspector, bindVectorInspector, preloadVectors, pinAt, setPinKey } from './vector-layers.mjs';

import { installMotionElements } from './motion-elements.mjs';

import { DEFAULT_LIST, DEFAULT_DIAGRAM, drawStructured, structuredInspector, bindStructuredInspector, validateStructured } from './motion-structured.mjs';
import { GRAPH_DEFAULT, drawGraph, graphInspector, bindGraphInspector, graphHit, normalizeGraph } from './motion-diagram.mjs';
import { CHART_TYPES, CHART_REVEALS, DEFAULT_CHART, parseChartData, drawChart } from './charts.mjs';

import { BACKGROUND_STYLES, DEFAULT_BACKGROUND, DEFAULT_TABLE, TABLE_THEMES, TABLE_ANIMATIONS, parseTable, drawBackgroundEffect, drawTable } from './motion-extras.mjs';

import { exportMapVideo as exportFrameVideo } from './map-video-export.mjs';

import{PROPS,easings,valueAt,poseAt,putKey,validateProject,fontStack,cleanFont,loadFont,loadFonts,fontPickerHtml,bindFontPicker}from'./engine.mjs';

const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)],canvas=$('#canvas'),ctx=canvas.getContext('2d');

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const icons={vector:'✧',text:'T',rect:'▢',circle:'○',image:'▧',table:'▤',chart:'▥',list:'☷',diagram:'◇',group:'▣'};

let project,selected,frame=45,playing=false,loop=true,showGrid=false,raf,startTime,startFrame,undoStack=[],redoStack=[],images=new Map,drag=null,keyDrag=null,clipDrag=null,exporting=false,selectedKey=null;




const uid=()=>crypto.randomUUID();

function layer(type,extra={}){return{id:uid(),name:{vector:'Vector',text:'Text',rect:'Rectangle',circle:'Ellipse',image:'Image',table:'Table',chart:'Chart',list:'List',diagram:'Diagram',group:'Group'}[type],type,x:640,y:360,w:260,h:160,scale:1,rotation:0,opacity:1,blur:0,color:'#b6f36e',radius:24,text:'Your next idea',fontSize:80,fontWeight:700,fontFamily:'Arial',visible:true,in:0,out:179,keys:{},...extra}}

function demo(){const p={version:1,name:'Make your move',width:1920,height:1080,fps:30,frames:180,bg:'#e7e9e1',layers:[]};const a=layer('text',{name:'Studio label',text:'FRAMEFLOW  /  MOTION STUDIES',fontSize:19,fontWeight:600,color:'#3c4a3d',x:352,y:107});const b=layer('text',{name:'Main headline',text:'Make your\nnext move.',fontSize:112,fontWeight:700,color:'#1c2920',x:411,y:337});const c=layer('text',{name:'Subheading',text:'A little motion. Endless possibility.',fontSize:23,fontWeight:400,color:'#62705f',x:358,y:522});const d=layer('rect',{name:'Dark card',x:974,y:340,w:320,h:390,color:'#20362b',rotation:-9,radius:36});const e=layer('circle',{name:'Lime orbit',x:987,y:287,w:245,h:245,color:'#b6f36e'});const f=layer('text',{name:'Orbit mark',text:'↗',x:987,y:283,fontSize:150,fontWeight:400,color:'#263b24'});const g=layer('text',{name:'Card caption',text:'CREATE. MOVE. REPEAT.',x:973,y:462,fontSize:16,fontWeight:600,color:'#c9dec6',rotation:-9});p.layers=[a,b,c,d,e,f,g];for(const l of[a,b,c]){putKey(l,'y',0,l.y+80,'easeOut');putKey(l,'y',30,l.y,'easeInOut');putKey(l,'opacity',0,0,'easeOut');putKey(l,'opacity',25,1,'linear')}for(const l of[d,e,f,g]){putKey(l,'scale',0,.3,'backOut');putKey(l,'scale',40,1,'easeInOut');putKey(l,'rotation',0,l.rotation-35,'easeOut');putKey(l,'rotation',40,l.rotation,'easeInOut')}putKey(e,'y',40,287);putKey(e,'y',95,312);putKey(e,'y',150,287);putKey(f,'y',40,283);putKey(f,'y',95,308);putKey(f,'y',150,283);return p}

function notify(s){$('#toast').textContent=s;$('#toast').classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>$('#toast').classList.remove('show'),2600);$('#status').textContent=s}

function checkpoint(){undoStack.push(JSON.stringify(project));if(undoStack.length>80)undoStack.shift();redoStack=[];updateHistory()}

function updateHistory(){const a=audioUI?.historyState();$('#undo').disabled=a?!a.undo:!undoStack.length;$('#redo').disabled=a?!a.redo:!redoStack.length}

function saveLocal(){try{localStorage.setItem('frameflow-project-v1',JSON.stringify(project));$('#saveState').textContent='Saved locally'}catch{$('#saveState').textContent='Save project to keep changes'}}

function changed(){saveLocal();renderUI()}

function history(direction){if(audioUI?.handlesHistory()){audioUI.history(direction);return;}pause();const from=direction==='undo'?undoStack:redoStack,to=direction==='undo'?redoStack:undoStack;if(!from.length)return;to.push(JSON.stringify(project));project=JSON.parse(from.pop());selected=project.layers.some(l=>l.id===selected)?selected:project.layers.at(-1)?.id;frame=Math.min(frame,project.frames-1);loadImages();changed();updateHistory()}

function current(){return project.layers.find(l=>l.id===selected)}

// ---- Multi-selection (Shift+click) and alignment helpers ----
// `selected` stays the primary layer; `multi` holds every selected id when 2+ are chosen.
const multi=new Set();let alignBar=null;
function multiIds(){if(multi.size<2||!multi.has(selected))return[];const ids=[...multi].filter(id=>project.layers.some(l=>l.id===id));return ids.length>1?ids:[]}
function toggleMulti(id){const base=new Set(multiIds().length?multiIds():(selected?[selected]:[]));if(base.has(id)){base.delete(id);if(selected===id)selected=[...base].at(-1)??null}else{base.add(id);selected=id}multi.clear();if(base.size>=2)base.forEach(x=>multi.add(x));selectedKey=null;cameraUI?.clear();renderUI()}
function hitLayerAt(p){for(const raw of[...project.layers].reverse()){if(raw.type==='group'||raw.visible===false||frame<raw.in||frame>raw.out)continue;const parent=groupOf(raw);if(parent&&parent.visible===false)continue;const l=poseAt(raw,frame),gp=groupPose(parent,frame);let pp=unprojectLayerPoint(project,raw,cameraAt(project,frame),p,layerCenter(l,parent,frame));if(gp){const ang=-gp.rotation*Math.PI/180,dx=p.x-gp.x,dy=p.y-gp.y;pp={x:gp.anchorX+(dx*Math.cos(ang)-dy*Math.sin(ang))/gp.scale,y:gp.anchorY+(dx*Math.sin(ang)+dy*Math.cos(ang))/gp.scale}}const a=-l.rotation*Math.PI/180,dx=pp.x-l.x,dy=pp.y-l.y,x=(dx*Math.cos(a)-dy*Math.sin(a))/l.scale,y=(dx*Math.sin(a)+dy*Math.cos(a))/l.scale,{w,h}=bounds(l);if(Math.abs(x)<=w/2+10&&Math.abs(y)<=h/2+10)return raw}return null}
// Axis-aligned box of a layer in composition pixels (includes rotation, scale and group transform).
function layerAABB(id){const raw=project.layers.find(l=>l.id===id);if(!raw||raw.type==='group')return null;const l=poseAt(raw,frame),{w,h}=bounds(l),r=l.rotation*Math.PI/180,c=Math.cos(r),s=Math.sin(r),g=groupPose(groupOf(raw),frame);const pts=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>{let X=l.x+l.scale*(x*c-y*s),Y=l.y+l.scale*(x*s+y*c);if(g){const dx=X-g.anchorX,dy=Y-g.anchorY,gr=g.rotation*Math.PI/180;[X,Y]=[g.x+g.scale*(dx*Math.cos(gr)-dy*Math.sin(gr)),g.y+g.scale*(dx*Math.sin(gr)+dy*Math.cos(gr))]}return[X,Y]});const xs=pts.map(q=>q[0]),ys=pts.map(q=>q[1]),x0=Math.min(...xs),y0=Math.min(...ys);return{id,x:x0,y:y0,w:Math.max(...xs)-x0,h:Math.max(...ys)-y0}}
// Move a layer by a composition-space delta at the current frame (respects keyframes, auto-key and groups).
function moveLayerScene(id,dx,dy){const raw=project.layers.find(l=>l.id===id);if(!raw)return;const g=groupPose(groupOf(raw),frame);if(g){const r=-g.rotation*Math.PI/180;[dx,dy]=[(dx*Math.cos(r)-dy*Math.sin(r))/g.scale,(dx*Math.sin(r)+dy*Math.cos(r))/g.scale]}const rd=v=>Math.round(v*100)/100;editProp(raw,'x',rd(valueAt(raw,'x',frame)+dx));editProp(raw,'y',rd(valueAt(raw,'y',frame)+dy))}
function drawMultiOverlay(){const ids=multiIds();if(playing||ids.length<2)return;const bs=ids.map(layerAABB).filter(Boolean);if(bs.length<2)return;ctx.save();applyCamera(ctx,project,frame);ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.strokeStyle='#7aac41';for(const b of bs)ctx.strokeRect(b.x-4,b.y-4,b.w+8,b.h+8);const x0=Math.min(...bs.map(b=>b.x)),y0=Math.min(...bs.map(b=>b.y)),x1=Math.max(...bs.map(b=>b.x+b.w)),y1=Math.max(...bs.map(b=>b.y+b.h));ctx.setLineDash([]);ctx.lineWidth=1.5;ctx.strokeStyle='#b6f36e';ctx.strokeRect(x0-10,y0-10,x1-x0+20,y1-y0+20);ctx.restore()}

function loadImages(){for(const l of project.layers){if(l.type==='image'&&!images.has(l.src)){const im=new Image;im.onload=()=>draw();im.src=l.src;images.set(l.src,im)}}}

function groupOf(l,scene=project){return l.parentId?scene.layers.find(g=>g.id===l.parentId&&g.type==='group'):null}

function groupPose(raw,at){return raw?{...poseAt(raw,at),anchorX:raw.anchorX??raw.x,anchorY:raw.anchorY??raw.y}:null}

function applyGroup(target,g){if(!g)return;target.translate(g.x,g.y);target.rotate(g.rotation*Math.PI/180);target.scale(g.scale,g.scale);target.translate(-g.anchorX,-g.anchorY);target.globalAlpha*=Math.max(0,Math.min(1,g.opacity))}

function scenePosition(l,at){l=poseAt(l,at);const g=groupPose(groupOf(l),at);if(!g)return{x:l.x,y:l.y};const dx=l.x-g.anchorX,dy=l.y-g.anchorY,r=g.rotation*Math.PI/180;return{x:g.x+g.scale*(dx*Math.cos(r)-dy*Math.sin(r)),y:g.y+g.scale*(dx*Math.sin(r)+dy*Math.cos(r))}}

function groupBounds(raw,at){
 const members=project.layers.filter(l=>l.parentId===raw.id);if(!members.length)return{w:160,h:100};
 const ax=raw.anchorX??raw.x,ay=raw.anchorY??raw.y;let halfW=30,halfH=30;
 for(const child of members){const l=poseAt(child,at),b=bounds(l),r=l.rotation*Math.PI/180;
  for(const x of[-b.w/2,b.w/2])for(const y of[-b.h/2,b.h/2]){halfW=Math.max(halfW,Math.abs(l.x-ax+l.scale*(x*Math.cos(r)-y*Math.sin(r))));halfH=Math.max(halfH,Math.abs(l.y-ay+l.scale*(x*Math.sin(r)+y*Math.cos(r))));}
 }
 return{w:halfW*2,h:halfH*2};
}

function bounds(l){if(l.type==='group')return groupBounds(l,frame);if(l.type==='text'){ctx.font=`${l.fontWeight||700} ${l.fontSize||80}px ${fontStack(l.fontFamily)}`;const lines=String(l.text||'').split('\n');return{w:Math.max(20,...lines.map(s=>ctx.measureText(s).width)),h:lines.length*(l.fontSize||80)*1.12}}return{w:l.w,h:l.h}}

// Keep one transparent work surface for blur compositing, avoiding one allocation per layer.
const fxCanvas=document.createElement('canvas'),fxCtx=fxCanvas.getContext('2d');
function layerCenter(l,parent,at){
 const g=groupPose(parent,at);if(!g)return {x:l.x,y:l.y};
 const r=g.rotation*Math.PI/180,dx=l.x-g.anchorX,dy=l.y-g.anchorY;
 return {x:g.x+g.scale*(dx*Math.cos(r)-dy*Math.sin(r)),y:g.y+g.scale*(dx*Math.sin(r)+dy*Math.cos(r))};
}
function paintMotionLayer(target,raw,l,parent,at,scene,overlay,cam){
 target.save();applyLayerDepth(target,scene,raw,cam,layerCenter(l,parent,at));
 applyGroup(target,groupPose(parent,at));target.translate(l.x,l.y);
 target.rotate(l.rotation*Math.PI/180);target.scale(l.scale,l.scale);
 target.globalAlpha*=Math.max(0,Math.min(1,l.opacity));target.fillStyle=l.color;
 const {w,h}=bounds(l);
 if(l.type==='diagram'){drawGraph(target,l,at)}else if(l.type==='list'){drawStructured(target,l,at)}else if(l.type==='table'){drawTable(target,l,at)}else if(l.type==='chart'){drawChart(target,l,at)}else if(l.type==='vector'){drawVector(target,l,at,w,h,overlay && selected===raw.id)}else if(l.type==='rect'||l.type==='circle'){drawShape(target,l,at,scene.fps)}else if(l.type==='text'){target.font=`${l.fontWeight||700} ${l.fontSize||80}px ${fontStack(l.fontFamily)}`;target.textAlign='center';target.textBaseline='middle';drawTextTexture(target,l,fontStack)}else{const im=images.get(l.src);if(im?.complete&&im.naturalWidth)target.drawImage(im,-w/2,-h/2,w,h)}
 target.restore();
}
// Crop each blur pass to the transformed layer bounds. This avoids repeatedly
// filtering a full 4K canvas for a small text or shape layer.
function blurredLayerCrop(target,raw,l,parent,scene,at,cam,blur){
 target.save();applyLayerDepth(target,scene,raw,cam,layerCenter(l,parent,at));
 applyGroup(target,groupPose(parent,at));target.translate(l.x,l.y);
 target.rotate(l.rotation*Math.PI/180);target.scale(l.scale,l.scale);
 const m=target.getTransform();target.restore();
 const {w,h}=bounds(l),points=[];
 for(const x of[-w/2,w/2])for(const y of[-h/2,h/2])points.push({x:m.a*x+m.c*y+m.e,y:m.b*x+m.d*y+m.f});
 const pad=Math.ceil(blur*3+Math.max(25,Math.min(w,h)*.06));
 const x0=Math.max(0,Math.floor(Math.min(...points.map(p=>p.x))-pad));
 const y0=Math.max(0,Math.floor(Math.min(...points.map(p=>p.y))-pad));
 const x1=Math.min(scene.width,Math.ceil(Math.max(...points.map(p=>p.x))+pad));
 const y1=Math.min(scene.height,Math.ceil(Math.max(...points.map(p=>p.y))+pad));
 return x1>x0&&y1>y0?{x:x0,y:y0,w:x1-x0,h:y1-y0}:null;
}
function drawScene(target,at,overlay=false,scene=project){
 const c=target.canvas;
 if(c.width!==scene.width||c.height!==scene.height){c.width=scene.width;c.height=scene.height;}
 target.setTransform(1,0,0,1,0,0);target.globalAlpha=1;target.globalCompositeOperation='source-over';target.filter='none';
 target.clearRect(0,0,c.width,c.height);target.fillStyle=scene.bg;target.fillRect(0,0,c.width,c.height);
 drawBackgroundEffect(target,c.width,c.height,at,scene.fps,scene.backgroundEffect);
 const cam=cameraAt(scene,at);
 target.save();applyCamera(target,scene,at,cam);
 for(const raw of scene.layers){
  if(raw.type==='group'||raw.visible===false||at<raw.in||at>raw.out)continue;
  const parent=groupOf(raw,scene);
  if(parent&&(parent.visible===false||at<parent.in||at>parent.out))continue;
  const l=poseAt(raw,at),blur=layerBlur(scene,{...raw,blur:l.blur??0},cam);
  if(blur<=.05){paintMotionLayer(target,raw,l,parent,at,scene,overlay,cam);continue;}
  const crop=blurredLayerCrop(target,raw,l,parent,scene,at,cam,blur);if(!crop)continue;
  if(fxCanvas.width!==crop.w||fxCanvas.height!==crop.h){fxCanvas.width=crop.w;fxCanvas.height=crop.h;}
  fxCtx.setTransform(1,0,0,1,0,0);fxCtx.filter='none';fxCtx.globalAlpha=1;
  fxCtx.clearRect(0,0,crop.w,crop.h);
  fxCtx.save();fxCtx.translate(-crop.x,-crop.y);applyCamera(fxCtx,scene,at,cam);
  paintMotionLayer(fxCtx,raw,l,parent,at,scene,false,cam);fxCtx.restore();
  // The blurred image contains *only this layer*, with padded transparent margins.
  target.save();target.setTransform(1,0,0,1,0,0);target.globalAlpha=1;
  target.filter=`blur(${blur.toFixed(2)}px)`;target.drawImage(fxCanvas,crop.x,crop.y);target.restore();
 }
 target.restore();
 if(overlay&&showGrid){target.save();target.strokeStyle='#7d8b7055';target.lineWidth=1;for(let x=0;x<c.width;x+=80){target.beginPath();target.moveTo(x,0);target.lineTo(x,c.height);target.stroke()}for(let y=0;y<c.height;y+=80){target.beginPath();target.moveTo(0,y);target.lineTo(c.width,y);target.stroke()}target.restore();}
 if(overlay&&!playing&&current()?.visible!==false){
  target.save();applyCamera(target,scene,at,cam);const raw=current();
  if(raw&&at>=raw.in&&at<=raw.out){const l=poseAt(raw,at),{w,h}=bounds(l);
   target.save();applyLayerDepth(target,scene,raw,cam,layerCenter(l,groupOf(raw,scene),at));
   applyGroup(target,groupPose(groupOf(raw,scene),at));target.translate(l.x,l.y);
   target.rotate(l.rotation*Math.PI/180);target.scale(l.scale,l.scale);
   target.strokeStyle='#7aac41';target.lineWidth=2/Math.max(.01,l.scale);target.setLineDash([6,4]);
   target.strokeRect(-w/2-8,-h/2-8,w+16,h+16);target.setLineDash([]);target.fillStyle='#e7f6d4';
   for(const x of[-w/2-8,w/2+8])for(const y of[-h/2-8,h/2+8]){target.fillRect(x-4,y-4,8,8);target.strokeRect(x-4,y-4,8,8)}
   const screenScale=Math.max(.001,Math.abs(l.scale*(groupPose(groupOf(raw,scene),at)?.scale??1))*cam.zoom*canvas.getBoundingClientRect().width/scene.width);
   target.fillStyle='#b6f36e';target.strokeStyle='#152414';target.lineWidth=1.5/screenScale;
   for(const sx of[-1,1])for(const sy of[-1,1]){target.beginPath();target.arc(sx*(w/2+8),sy*(h/2+8),6/screenScale,0,Math.PI*2);target.fill();target.stroke()}
   target.strokeStyle='#b6f36e';target.beginPath();target.moveTo(-5/screenScale,0);target.lineTo(5/screenScale,0);target.moveTo(0,-5/screenScale);target.lineTo(0,5/screenScale);target.stroke();
   target.restore();
  }target.restore();
 }
}

const seenFonts=new Set();

const usedFonts=scene=>scene.layers.flatMap(l=>l.type==='text'?[l.fontFamily||'Arial']:l.type==='table'?[l.table?.fontFamily||'Arial']:['list','diagram'].includes(l.type)?[l.structured?.font||'Arial']:[]);

function syncFonts(){for(const n of usedFonts(project)){const k=cleanFont(n);if(seenFonts.has(k))continue;seenFonts.add(k);loadFont(k).then(()=>draw())}}

function draw(){syncFonts();drawScene(ctx,frame,true);drawMultiOverlay();alignBar?.refresh()}

window.addEventListener('ff-vector-loaded',()=>{if(project)draw()});

function setFrame(n,refresh=true){frame=Math.max(0,Math.min(project.frames-1,Math.round(n)||0));$('#frame').value=+(frame/project.fps).toFixed(3);$('#frame').max=+((project.frames-1)/project.fps).toFixed(3);$('#timecode').textContent=`${String(Math.floor(frame/project.fps/60)).padStart(2,'0')}:${(frame/project.fps%60).toFixed(2).padStart(5,'0')}`;$('#playhead').style.left=`${frame/(project.frames-1)*100}%`;draw();window.dispatchEvent(new CustomEvent("ff-frame",{detail:{studio:"motion",frame,fps:project.fps,playing}}));if(refresh&&!playing)renderInspector()}

function pause(){playing=false;cancelAnimationFrame(raf);$('#play').textContent='▶';window.dispatchEvent(new CustomEvent('ff-play',{detail:{studio:'motion',playing:false,frame,fps:project.fps}}));draw()}

function play(){if(playing){pause();return}if(frame===project.frames-1)frame=0;playing=true;startTime=performance.now();startFrame=frame;$('#play').textContent='Ⅱ';window.dispatchEvent(new CustomEvent('ff-play',{detail:{studio:'motion',playing:true,frame,fps:project.fps}}));function tick(t){let f=startFrame+Math.floor((t-startTime)/1000*project.fps);if(f>=project.frames){if(loop){f%=project.frames}else{setFrame(project.frames-1,false);pause();renderInspector();return}}if(f!==frame)setFrame(f,false);raf=requestAnimationFrame(tick)}raf=requestAnimationFrame(tick)}

function renderUI(){ renderBackgroundSettings();$('#projectName').value=project.name;$('#fps').value=project.fps;$('#fpsLabel').textContent=project.fps+' FPS';$('#duration').value=+(project.frames/project.fps).toFixed(3);$('#background').value=project.bg;$('#size').value=project.width+','+project.height;$('#compLabel').textContent=`${project.width} × ${project.height}`;$('#layerCount').textContent=project.layers.length;canvas.style.aspectRatio=`${project.width}/${project.height}`;updateCanvasZoom();renderLayers();renderInspector();renderTimeline();setFrame(frame,false);updateHistory()}

function renderLayers(){const layers=[...project.layers].reverse().sort((a,b)=>a.parentId&&!b.parentId?1:!a.parentId&&b.parentId?-1:0);$('#layers').innerHTML=layers.map(l=>`<div class="layer ${(l.id===selected||multi.has(l.id)&&multiIds().includes(l.id))?'selected':''}" data-id="${esc(l.id)}"><input class="group-check" type="checkbox" data-group-check="${esc(l.id)}" ${l.parentId||l.type==='group'?'disabled':''}><span class="type">${icons[l.type]}</span><span class="name">${l.parentId?"↳ ":""}${esc(l.name)}</span><button data-visibility="${esc(l.id)}" title="${l.visible===false?'Show':'Hide'} layer">${l.visible===false?'◌':'◉'}</button></div>`).join('');$$('.layer').forEach(el=>el.onclick=e=>{if(e.target.closest('[data-visibility],.group-check'))return;if(e.shiftKey){toggleMulti(el.dataset.id);return}select(el.dataset.id)});$$('[data-visibility]').forEach(el=>el.onclick=()=>{checkpoint();const l=project.layers.find(x=>x.id===el.dataset.visibility);l.visible=l.visible===false;changed()});['duplicate','delete','up','down','keyAll'].forEach(id=>$('#'+id).disabled=id==='delete'?(!current()&&!cameraUI?.isActive()):!current());$('#ungroup').disabled=current()?.type!=='group';audioUI?.renderList()}

function select(id){cameraUI?.clear();selected=id;selectedKey=null;multi.clear();renderUI()}

const labels={x:'Position X',y:'Position Y',w:'Width',h:'Height',scale:'Scale',rotation:'Rotation',opacity:'Opacity'};

// Reusable frame-accurate presets. Generated as editable ordinary keyframes.

const MOTION_PRESETS = {

  in: [['none','None'],['fade','Fade in'],['slide-left','Slide from left'],['slide-right','Slide from right'],['slide-up','Slide from bottom'],['slide-down','Slide from top'],['zoom','Zoom in'],['pop','Pop in'],['spin','Spin in']],

  out: [['none','None'],['fade','Fade out'],['slide-left','Slide left'],['slide-right','Slide right'],['slide-up','Slide up'],['slide-down','Slide down'],['zoom','Zoom out'],['pop','Shrink out'],['spin','Spin out']],

  loop: [['none','None'],['pulse','Pulse'],['float','Float'],['bounce','Bounce'],['sway','Sway'],['rotate','Rotate'],['breathe','Breathe']]

};

const presetOptions = type => MOTION_PRESETS[type].map(([key,name])=>`<option value="${key}">${name}</option>`).join('');

function animationInspector(l){const settings=l.animationPresets||{};return `<div class="section-title" style="margin-top:18px">ANIMATION PRESETS <span>✦</span></div><p class="mini-label">Temporary animation effects can return to their starting state. An entrance normally remains visible; an exit normally remains hidden. Manually created keyframes still hold their last value until another keyframe.</p>${['in','out','loop'].map(type=>{const s=settings[type]||{};return `<div class="ff-animation-preset"><label>${type==='in'?'Entrance':type==='out'?'Exit':'Loop'}<select data-preset-kind="${type}">${presetOptions(type)}</select></label><label>${type==='loop'?'Cycle (seconds)':'Duration (seconds)'}<input type="number" min="0.1" max="30" step="0.1" data-preset-duration="${type}" value="${s.duration|| (type==='loop'?2:0.7)}"></label><label>After effect<select data-preset-end="${type}"><option value="return" ${((s.endBehavior|| (type==='loop'?'return':'hold'))==='return')?'selected':''}>Return to starting state</option><option value="hold" ${((s.endBehavior||(type==='loop'?'return':'hold'))==='hold')?'selected':''}>Hold final state</option></select></label><button type="button" class="ff-apply-preset" data-apply-preset="${type}">Apply ${type==='in'?'In':type==='out'?'Out':'Loop'}</button></div>`}).join('')}<div class="section-title" style="margin-top:18px">RESTORE LAYER <span>↶</span></div><p class="mini-label">At the current playhead, smoothly return animated properties (including Gaussian blur) to their values at the layer's start. Useful for existing effects or custom keyframes.</p><div class="two"><label>Return duration (seconds)<input id="ffRestoreDuration" type="number" min="0.03" max="30" step="0.1" value="0.5"></label><button id="ffRestoreLayer" type="button">↶ Return to start</button></div>`}

function applyMotionPreset(l,kind,name,seconds,endBehavior=kind==='loop'?'return':'hold'){

  if(name==='none')return notify('Choose an animation first');

  const length=Math.max(1,Math.round(seconds*project.fps));

  const start=kind==='out'?Math.max(l.in,l.out-length):l.in;

  const end=kind==='in'?Math.min(l.out,l.in+length):kind==='loop'?Math.min(l.out,Math.max(l.in,frame)+length):l.out;
  // A loop now runs for its requested cycle at the current playhead, not
  // implicitly across the whole life of the layer.
  const effectStart=kind==='loop'?Math.min(l.out,Math.max(l.in,frame)):start;
  const returning=endBehavior==='return';
  const backFrames=returning&&kind!=='loop'?Math.min(Math.max(1,Math.round((end-effectStart)*.25)),Math.max(1,end-effectStart-1)):0;
  const peak=end-backFrames;

  if(end<=effectStart||peak<=effectStart)return notify('Layer is too short for this animation');

  const origin=kind==='loop'?Math.min(l.out,Math.max(l.in,frame)):(kind==='out'?Math.max(l.in,l.out-length):l.in);
  const base=Object.fromEntries(['x','y','scale','rotation','opacity'].map(k=>[k,valueAt(l,k,origin)]));

  const offset=Math.max(45,Math.min(project.width,project.height)*.12);

  let changes={};

  if(kind==='loop'){

    const amount=name==='bounce'?offset*.5:name==='float'?offset*.3:0;

    changes=name==='pulse'?{scale:[base.scale,base.scale*1.12,base.scale]}:

      name==='breathe'?{opacity:[base.opacity,Math.max(.15,base.opacity*.55),base.opacity]}:

      name==='float'||name==='bounce'?{y:[base.y,base.y-amount,base.y]}:

      name==='sway'?{rotation:[base.rotation,base.rotation+8,base.rotation]}:

      name==='rotate'?{rotation:[base.rotation,base.rotation+180,base.rotation+360]}:{};

  }else{

    const beginning=kind==='in';

    const movement=name==='slide-left'?[-offset,0]:name==='slide-right'?[offset,0]:name==='slide-up'?[0,offset]:name==='slide-down'?[0,-offset]:[0,0];

    if(name==='fade')changes={opacity:beginning?[0,base.opacity]:[base.opacity,0]};

    else if(name.startsWith('slide-')){

      changes={opacity:beginning?[0,base.opacity]:[base.opacity,0]};

      if(movement[0])changes.x=beginning?[base.x+movement[0],base.x]:[base.x,base.x-movement[0]];

      if(movement[1])changes.y=beginning?[base.y+movement[1],base.y]:[base.y,base.y-movement[1]];

    }else if(name==='zoom'||name==='pop'){

      const small=name==='pop'?.25:.7;

      changes={scale:beginning?[base.scale*small,base.scale]:[base.scale,base.scale*small],opacity:beginning?[0,base.opacity]:[base.opacity,0]};

    }else if(name==='spin')changes={rotation:beginning?[base.rotation-90,base.rotation]:[base.rotation,base.rotation+90],opacity:beginning?[0,base.opacity]:[base.opacity,0]};

  }

  if(!Object.keys(changes).length)return;

  checkpoint();

  for(const [prop,values] of Object.entries(changes)){

    const a=kind==='loop'?effectStart:start,b=kind==='loop'?end:peak;

    const keys=l.keys[prop]||[];

    l.keys[prop]=keys.filter(k=>k.f<a||k.f>(returning&&kind!=='loop'?end:b));

    if(kind==='loop'){

      const cycle=Math.max(2,length);let cycleIndex=0;

      for(let t=a;t<=b;t+=cycle){

        const last=Math.min(b,t+cycle),mid=Math.min(last,t+Math.round((last-t)/2));

        const vals=name==='rotate'?[base.rotation+cycleIndex*360,base.rotation+(cycleIndex+.5)*360,base.rotation+(cycleIndex+1)*360]:values;

        putKey(l,prop,t,vals[0],'easeInOut');

        if(mid>t&&mid<last)putKey(l,prop,mid,vals[1],'easeInOut');

        if(last>t)putKey(l,prop,last,vals[2],'easeInOut');

        cycleIndex++;

      }

    }else{

      putKey(l,prop,a,values[0],name==='pop'&&kind==='in'?'backOut':'easeInOut');

      putKey(l,prop,b,values[1],'easeInOut');

      // Exit/entrance keys preserve a neutral transform outside their window.

      if(kind==='in'&&b<l.out)putKey(l,prop,Math.min(b+1,l.out),values[1]);

      if(kind==='out'&&a>l.in)putKey(l,prop,Math.max(l.in,a-1),values[0]);
      if(returning&&peak<end){
        // Round-trip to where the effect began, with the return INCLUDED
        // inside its specified time window; never change unrelated later keys.
        putKey(l,prop,end,values[0],'easeInOut');
      }

    }

  }

  l.animationPresets ||= {};

  l.animationPresets[kind]={name,duration:seconds,endBehavior};

  changed();notify(`${kind.toUpperCase()} · ${name.replaceAll('-',' ')} applied`);

}

// Explicit return for manually edited keyframes, legacy preset effects and blur.
// It affects only the requested timeline interval; later manual keys are retained.
function restoreLayerAtPlayhead(l,seconds){
  const a=Math.max(l.in,Math.min(l.out,frame));
  const b=Math.min(l.out,a+Math.max(1,Math.round(seconds*project.fps)));
  if(b<=a)return notify('Move the playhead earlier to allow time to return');
  const changes=PROPS.filter(k=>{
    const from=valueAt(l,k,a),to=valueAt(l,k,l.in);
    return Number.isFinite(from)&&Number.isFinite(to)&&Math.abs(from-to)>1e-5;
  }).map(k=>({prop:k,from:valueAt(l,k,a),to:valueAt(l,k,l.in)}));
  if(!changes.length)return notify('This layer is already at its starting state');
  checkpoint();
  for(const {prop,from,to} of changes){
    l.keys[prop]=(l.keys[prop]||[]).filter(k=>k.f<=a||k.f>b);
    putKey(l,prop,a,from,'easeInOut');
    putKey(l,prop,b,to,'easeInOut');
  }
  changed();notify(`Return animation added to ${changes.length} properties`);
}

function bindAnimationInspector(l){
 $('#ffRestoreLayer').onclick=()=>restoreLayerAtPlayhead(l,Math.max(.03,+$('#ffRestoreDuration').value||.5));
 for(const kind of ['in','out','loop']){

   const s=l.animationPresets?.[kind];const picker=$(`[data-preset-kind="${kind}"]`);

   if(s)picker.value=s.name;

   $(`[data-apply-preset="${kind}"]`).onclick=()=>applyMotionPreset(l,kind,picker.value,Math.max(.1,+$(`[data-preset-duration="${kind}"]`).value||.7),$(`[data-preset-end="${kind}"]`).value);

 }

}


function layerFXInspector(l){
 if(l.type==='group')return '';
 const blur=Number(valueAt(l,'blur',frame)??0),blurKeys=l.keys.blur||[],keyed=blurKeys.some(k=>k.f===frame);
 const autoDepth=!Number.isFinite(l.depth),depth=autoDepth?depthForLayer(project,l):l.depth;
 return `<div class="section-title" style="margin-top:18px">EFFECTS / DEPTH <span>◉</span></div>
 <p class="mini-label">Gaussian blur is applied to the entire layer, not to separate strokes or textures. Keyframe it for blur transitions.</p>
 <label>Gaussian blur · pixels<input type="range" id="ffBlurRange" min="0" max="80" step="0.5" value="${blur}"></label>
 <div class="two"><label>Blur amount<input id="ffBlurNumber" type="number" min="0" max="80" step="0.5" value="${blur}"></label><label>Blur keyframe<button id="ffBlurKey" class="key ${blurKeys.length?'animated':''} ${keyed?'current':''}" title="Toggle blur keyframe">${keyed?'◆':'◇'}</button></label></div>
 <div class="two"><label>Temporary blur (px)<input id="ffBlurPulse" type="number" min="0" max="80" step="1" value="25"></label><label>Effect duration (s)<input id="ffBlurPulseDur" type="number" min="0.1" max="30" step="0.1" value="1"></label></div><button id="ffAddBlurPulse" type="button">◉ Add blur → return to sharp</button>
 <label class="m-chk"><input type="checkbox" id="ffDepthAuto" ${autoDepth?'checked':''}> Automatic depth from layer order</label>
 <label>Layer depth · farther is positive<input id="ffLayerDepth" type="number" min="-500" max="500" step="5" value="${depth}" ${autoDepth?'disabled':''}></label>
 <p class="mini-label">In focus shots, the selected subject stays sharp while layers behind it become blurry. Manual depth also controls 3D-style parallax.</p>`;
}
function bindLayerFX(l){
 if(l.type==='group')return;
 const range=$('#ffBlurRange'),num=$('#ffBlurNumber'),key=$('#ffBlurKey'),dauto=$('#ffDepthAuto'),depth=$('#ffLayerDepth');
 if(!range||!num||!key||!dauto||!depth)return;
 range.oninput=()=>{num.value=range.value};
 range.onchange=num.onchange=e=>{let v=Math.max(0,Math.min(80,Number(e.target.value)||0));checkpoint();editProp(l,'blur',v);changed()};
 key.onclick=()=>{pause();checkpoint();const list=l.keys.blur||[],i=list.findIndex(k=>k.f===frame),v=valueAt(l,'blur',frame)||0;if(i>=0){list.splice(i,1);if(!list.length)l.blur=v}else putKey(l,'blur',frame,v,'easeInOut');changed()};
 $('#ffAddBlurPulse').onclick=()=>{
   const a=Math.max(l.in,Math.min(l.out,frame));
   const b=Math.min(l.out,a+Math.max(2,Math.round((+$('#ffBlurPulseDur').value||1)*project.fps)));
   if(b-a<2)return notify('Not enough time for temporary blur');
   const from=valueAt(l,'blur',a)??0,peak=Math.max(0,Math.min(80,+$('#ffBlurPulse').value||0));
   const mid=a+Math.floor((b-a)/2);
   checkpoint();l.keys.blur=(l.keys.blur||[]).filter(k=>k.f<a||k.f>b);
   putKey(l,'blur',a,from,'easeInOut');putKey(l,'blur',mid,peak,'easeInOut');putKey(l,'blur',b,from,'easeInOut');
   changed();notify('Temporary Gaussian blur added (returns to original blur)');
 };
 dauto.onchange=()=>{checkpoint();if(dauto.checked)delete l.depth;else l.depth=depthForLayer(project,l);changed()};
 depth.onchange=()=>{const v=Number(depth.value);if(!Number.isFinite(v))return;checkpoint();l.depth=Math.max(-500,Math.min(500,v));changed()};
}
function renderInspector(){if(cameraUI?.inspect())return;if(audioUI?.renderInspector())return;window.ffVectorFps=project.fps;const l=current();if(!l){$('#inspector').innerHTML='<p class="muted">Select a layer to edit its properties.<br><br>Add text, a shape, an image, or a table to start.</p>';return}const props=['text','group'].includes(l.type)?['x','y','scale','rotation','opacity']:PROPS.filter(x=>x!=='blur');$('#inspector').innerHTML=`<div class="inspector-title"><span>${icons[l.type]}</span> ${esc(l.name)}</div><label>Layer name<input id="layerName" value="${esc(l.name)}" maxlength="100"></label>${l.type==='group'?'<p class="mini-label">Group keyframes transform all children together. Change a group property at a new time to create its keyframe automatically. Click a child while the group is selected to move the whole group; Alt-click selects the group from a child.</p>':''}${l.type==='list'?structuredInspector(l,esc):l.type==='diagram'?graphInspector(l):''}${l.type==='table'?tableInspector(l):''}${l.type==='chart'?chartInspector(l):''}${l.type==='vector'?vectorInspector(l):''}${animationInspector(l)}${['rect','circle'].includes(l.type)?shapeInspector(l):''}${layerFXInspector(l)}${l.type==='text'?`<label>Text<textarea id="textContent">${esc(l.text)}</textarea></label>${fontPickerHtml('fontFamily','Font',l.fontFamily)}<div class="two"><label>Font size<input id="fontSize" type="number" min="8" max="800" value="${l.fontSize}"></label><label>Weight<select id="fontWeight"><option value="400">Regular</option><option value="600">Semibold</option><option value="700">Bold</option></select></label></div>${textTextureInspector(l)}`:''}<div class="section-title" style="margin-top:18px">TRANSFORM <span>◆</span></div>${props.map(prop=>{const keys=l.keys[prop]||[],at=keys.some(k=>k.f===frame),v=valueAt(l,prop,frame);return`<div class="property"><label for="p-${prop}">${labels[prop]}</label><input id="p-${prop}" data-prop="${prop}" type="number" step="${['scale','opacity'].includes(prop)?'.01':'1'}" value="${Number(v.toFixed(2))}"><button class="key ${keys.length?'animated':''} ${at?'current':''}" data-key="${prop}" title="${at?'Remove':'Add'} keyframe at frame ${frame}">${at?'◆':'◇'}</button></div>`}).join('')}<label class="color-row">${['image','group','vector'].includes(l.type)?'':'Fill / accent color'}${['image','group','vector'].includes(l.type)?'':`<input id="fillColor" type="color" value="${l.color}">`}</label><label>Easing from this frame<select id="easing">${Object.keys(easings).map(e=>`<option value="${e}">${({linear:'Linear',easeIn:'Ease in',easeOut:'Ease out',easeInOut:'Ease in & out',backOut:'Overshoot',hold:'Hold'})[e]}</option>`).join('')}</select></label><div class="two"><label>In time (s)<input id="inFrame" type="number" min="0" max="${+((project.frames-1)/project.fps).toFixed(3)}" step="0.001" value="${+(l.in/project.fps).toFixed(3)}"></label><label>Out time (s)<input id="outFrame" type="number" min="0" max="${+((project.frames-1)/project.fps).toFixed(3)}" step="0.001" value="${+(l.out/project.fps).toFixed(3)}"></label></div><p class="mini-label">Drag any green corner handle to scale around the center anchor. ◆ A filled diamond marks a keyframe here. Auto-key adds keys to animated properties when you edit.</p>`;

if(['rect','circle'].includes(l.type))bindShapeInspector(l,{checkpoint,changed});if(l.type==='list')bindStructuredInspector(l,{checkpoint,changed,pause,notify});if(l.type==='diagram')bindGraphInspector(l,{checkpoint,changed,pause,notify});if(l.type==='table')bindTableInspector(l);if(l.type==='chart')bindChartInspector(l);if(l.type==='vector')bindVectorInspector(l,(item,key,value)=>{checkpoint();item[key]=value;changed()},project.fps);bindAnimationInspector(l);bindLayerFX(l);

$$('[data-prop]').forEach(el=>el.onchange=()=>{let v=Number(el.value);if(!Number.isFinite(v))return;const prop=el.dataset.prop;if(prop==='opacity')v=Math.max(0,Math.min(1,v));if(prop==='scale')v=Math.max(.01,Math.min(20,v));if(prop==='w'||prop==='h')v=Math.max(1,Math.min(10000,v));checkpoint();editProp(l,prop,v);changed()});$$('[data-key]').forEach(el=>el.onclick=()=>{pause();checkpoint();const prop=el.dataset.key,keys=l.keys[prop]||[],at=keys.findIndex(k=>k.f===frame),v=valueAt(l,prop,frame);if(at>=0){keys.splice(at,1);if(!keys.length)l[prop]=v}else putKey(l,prop,frame,v,$('#easing').value);changed()});$('#layerName').onchange=e=>{checkpoint();l.name=e.target.value||'Untitled layer';changed()};if(l.type==='text'){bindTextTextureInspector(l,{checkpoint,changed,draw});$('#fontWeight').value=l.fontWeight;$('#textContent').onchange=e=>{checkpoint();l.text=e.target.value;changed()};$('#fontSize').onchange=e=>{checkpoint();l.fontSize=Math.max(8,Math.min(800,+e.target.value||80));changed()};$('#fontWeight').onchange=e=>{checkpoint();l.fontWeight=+e.target.value;changed()};bindFontPicker('fontFamily',n=>{checkpoint();l.fontFamily=n;changed()})}if($('#fillColor'))$('#fillColor').onchange=e=>{checkpoint();l.color=e.target.value;changed()};const anyKey=Object.values(l.keys).flat().find(k=>k.f===frame);$('#easing').value=anyKey?.e||'easeInOut';$('#easing').onchange=e=>{const ks=Object.values(l.keys).flat().filter(k=>k.f===frame);if(!ks.length){notify('Add a keyframe here before changing easing');return}checkpoint();ks.forEach(k=>k.e=e.target.value);changed()};$('#inFrame').onchange=e=>{checkpoint();l.in=Math.max(0,Math.min(l.out,Math.round(+e.target.value*project.fps)||0));changed()};$('#outFrame').onchange=e=>{checkpoint();l.out=Math.max(l.in,Math.min(project.frames-1,Math.round(+e.target.value*project.fps)||0));changed()}}

function editProp(l,prop,v){const keys=l.keys[prop]||[],at=keys.find(k=>k.f===frame);if(at)at.v=v;else if(keys.length&&($('#autoKey').checked||l.type==='group'))putKey(l,prop,frame,v);else if(keys.length){const delta=v-valueAt(l,prop,frame);keys.forEach(k=>k.v+=delta);l[prop]+=delta}else l[prop]=v}

function renderTimeline(){

 const zoom=+$('#zoom').value;$('#tracks').style.width=`${zoom*100}%`;

 const duration=project.frames/project.fps,step=[.1,.2,.25,.5,1,2,5,10,15,30,60].find(s=>duration/s<=12*zoom)||60;

 let ticks='';for(let s=0;s<duration;s+=step){const f=s*project.fps;ticks+=`<span class="tick" style="left:${f/(project.frames-1)*100}%">${+s.toFixed(2)}s</span>`}$('#ruler').innerHTML=ticks;

 const ls=[...project.layers].reverse();

 $('#trackLabels').innerHTML=ls.map(l=>`<div class="track-label ${l.id===selected?'selected':''}" data-track-label="${l.id}"><span>${icons[l.type]}</span>${esc(l.name)}</div>`).join('');

 $('#trackRows').innerHTML=ls.map(l=>{

  const fs=[...new Set(Object.values(l.keys).flat().map(k=>k.f))].filter(f=>f<project.frames).sort((a,b)=>a-b);

  const left=l.in/(project.frames-1)*100,right=100-Math.min(l.out,project.frames-1)/(project.frames-1)*100;

  return `<div class="track-row ${l.id===selected?'selected':''}" data-row="${l.id}"><div class="clip clip-editable" data-clip="${l.id}" style="left:${left}%;right:${right}%" title="Drag to move · drag edges to trim"><span class="clip-handle clip-left" data-trim="left"></span><span class="clip-label">${esc(l.name)}</span><span class="clip-handle clip-right" data-trim="right"></span></div>${fs.map(f=>`<button class="diamond ${selectedKey?.id===l.id&&selectedKey.f===f?'chosen':''}" style="left:${f/(project.frames-1)*100}%" data-layer="${l.id}" data-f="${f}" title="${(f/project.fps).toFixed(2)}s · drag to move · Alt click to delete" aria-label="Keyframe ${f} on ${esc(l.name)}"></button>`).join('')}</div>`;

 }).join('');

 $$('[data-track-label]').forEach(el=>el.onclick=()=>select(el.dataset.trackLabel));


 $('#trackLabels').style.transform=`translateY(-${$('#scroll').scrollTop}px)`;

 $$('.diamond').forEach(el=>el.onpointerdown=e=>{e.preventDefault();e.stopPropagation();pause();const id=el.dataset.layer,f=+el.dataset.f;selected=id;selectedKey={id,f};if(e.altKey){checkpoint();const l=current();for(const prop of PROPS){const v=valueAt(l,prop,f);l.keys[prop]=(l.keys[prop]||[]).filter(k=>k.f!==f);if(!l.keys[prop].length)l[prop]=v}changed();return}checkpoint();keyDrag={id,from:f,to:f,keys:JSON.parse(JSON.stringify(current().keys))};setFrame(f);renderLayers();renderTimeline()});

 $$('[data-clip]').forEach(el=>el.onpointerdown=e=>{

  if(e.button!==0)return;e.preventDefault();e.stopPropagation();pause();

  const l=project.layers.find(x=>x.id===el.dataset.clip);if(!l)return;

  const mode=e.target.closest('[data-trim]')?.dataset.trim||'move';checkpoint();selected=l.id;selectedKey=null;

  clipDrag={id:l.id,mode,startX:e.clientX,startIn:l.in,startOut:l.out,keys:JSON.parse(JSON.stringify(l.keys))};

  renderLayers();renderInspector();

 });

 $$('[data-row]').forEach(el=>el.onpointerdown=e=>{if(e.target.closest('.diamond,.clip-editable'))return;selected=el.dataset.row;selectedKey=null;scrub(e);renderLayers();renderTimeline()});

 audioUI?.renderTimeline();
 cameraUI?.timeline();
}

function updateClipDrag(e){

 if(!clipDrag)return;const d=clipDrag,l=project.layers.find(x=>x.id===d.id);if(!l)return;

 const width=$('#tracks').getBoundingClientRect().width;

 const offset=Math.round((e.clientX-d.startX)/width*(project.frames-1));

 if(d.mode==='move'){

  const shift=Math.max(-d.startIn,Math.min(project.frames-1-d.startOut,offset));

  l.in=d.startIn+shift;l.out=d.startOut+shift;

  l.keys=JSON.parse(JSON.stringify(d.keys));

  for(const keys of Object.values(l.keys))for(const k of keys)k.f+=shift;

 }else if(d.mode==='left')l.in=Math.max(0,Math.min(d.startOut,d.startIn+offset));

 else l.out=Math.max(d.startIn,Math.min(project.frames-1,d.startOut+offset));

 draw();renderTimeline();renderInspector();

}



function frameFromEvent(e){const b=$('#tracks').getBoundingClientRect();return Math.max(0,Math.min(project.frames-1,Math.round((e.clientX-b.left)/b.width*(project.frames-1))))}

function scrub(e){pause();setFrame(frameFromEvent(e));drag={kind:'scrub'}}

$('#ruler').onpointerdown=scrub;$('#scroll').onscroll=()=>$('#trackLabels').style.transform=`translateY(-${$('#scroll').scrollTop}px)`;

function point(e,raw=null){const b=canvas.getBoundingClientRect(),sx=(e.clientX-b.left)/b.width*project.width,sy=(e.clientY-b.top)/b.height*project.height;const base=screenToCameraPoint(project,frame,sx,sy);if(!raw||raw.type==='group')return base;const l=poseAt(raw,frame),parent=groupOf(raw),center=layerCenter(l,parent,frame);return unprojectLayerPoint(project,raw,cameraAt(project,frame),base,center)}

// Puppet handle receives pointer events before layer dragging.

function pinCanvasPoint(layer,at){const p=pinAt(layer,at);if(!p)return null;const l=poseAt(layer,at),gp=groupPose(groupOf(layer),at),w=l.w,h=l.h;

 let x=(p.x-.5)*w*l.scale,y=(p.y-.5)*h*l.scale;

 const a=l.rotation*Math.PI/180;[x,y]=[x*Math.cos(a)-y*Math.sin(a),x*Math.sin(a)+y*Math.cos(a)];x+=l.x;y+=l.y;

 if(gp){const dx=x-gp.anchorX,dy=y-gp.anchorY,ang=gp.rotation*Math.PI/180;x=gp.x+(dx*Math.cos(ang)-dy*Math.sin(ang))*gp.scale;y=gp.y+(dx*Math.sin(ang)+dy*Math.cos(ang))*gp.scale;}

 return {x,y};}

function canvasToPin(layer,p,at){const l=poseAt(layer,at),gp=groupPose(groupOf(layer),at);let x=p.x,y=p.y;

 if(gp){const dx=x-gp.x,dy=y-gp.y,a=-gp.rotation*Math.PI/180;x=gp.anchorX+(dx*Math.cos(a)-dy*Math.sin(a))/gp.scale;y=gp.anchorY+(dx*Math.sin(a)+dy*Math.cos(a))/gp.scale;}

 let dx=x-l.x,dy=y-l.y,a=-l.rotation*Math.PI/180;

 return {x:.5+(dx*Math.cos(a)-dy*Math.sin(a))/(l.w*l.scale),y:.5+(dx*Math.sin(a)+dy*Math.cos(a))/(l.h*l.scale)};}

// Double-click an ordinary text layer to edit the actual text in place.
canvas.addEventListener('dblclick',e=>{
  if(e.button!==0)return;
  const p=point(e);
  let hit=null;
  for(const raw of [...project.layers].reverse()){
    if(raw.type!=='text'||raw.visible===false||frame<raw.in||frame>raw.out)continue;
    const l=poseAt(raw,frame),parent=groupPose(groupOf(raw),frame);
    let q=p;
    if(parent){const dx=q.x-parent.x,dy=q.y-parent.y,r=-parent.rotation*Math.PI/180;
      q={x:parent.anchorX+(dx*Math.cos(r)-dy*Math.sin(r))/parent.scale,y:parent.anchorY+(dx*Math.sin(r)+dy*Math.cos(r))/parent.scale};}
    const dx=q.x-l.x,dy=q.y-l.y,r=-l.rotation*Math.PI/180;
    const lx=(dx*Math.cos(r)-dy*Math.sin(r))/l.scale,ly=(dx*Math.sin(r)+dy*Math.cos(r))/l.scale;
    const b=bounds(l);if(Math.abs(lx)<=b.w/2+10&&Math.abs(ly)<=b.h/2+10){hit=raw;break;}
  }
  if(!hit)return;
  e.preventDefault();pause();select(hit.id);
  document.querySelector('.ff-inline-text-editor')?.remove();
  const pose=poseAt(hit,frame),b=bounds(pose),r=canvas.getBoundingClientRect();
  const center=scenePosition(hit,frame),scaleX=r.width/project.width,scaleY=r.height/project.height;
  const edit=document.createElement('textarea');edit.className='ff-inline-text-editor';
  edit.value=hit.text||'';edit.spellcheck=false;
  Object.assign(edit.style,{position:'fixed',zIndex:'9999',left:(r.left+(center.x-b.w*pose.scale/2)*scaleX)+'px',top:(r.top+(center.y-b.h*pose.scale/2)*scaleY)+'px',width:Math.max(100,b.w*pose.scale*scaleX)+'px',height:Math.max(42,b.h*pose.scale*scaleY)+'px',font:`${pose.fontWeight||700} ${Math.max(12,pose.fontSize*pose.scale*scaleX)}px ${fontStack(pose.fontFamily)}`,color:pose.color,background:'#10191ef2',border:'2px solid #79cced',borderRadius:'6px',padding:'4px',resize:'both',outline:'none',textAlign:'center',lineHeight:'1.12'});
  document.body.append(edit);edit.focus();edit.select();
  let saved=false;function finish(commit){if(saved)return;saved=true;if(commit&&edit.value!==hit.text){checkpoint();hit.text=edit.value;changed();}edit.remove();draw();}
  edit.addEventListener('keydown',evt=>{if(evt.key==='Escape'){evt.preventDefault();finish(false);}else if(evt.key==='Enter'&&(evt.ctrlKey||evt.metaKey)){evt.preventDefault();finish(true);}});
  edit.addEventListener('blur',()=>finish(true),{once:true});
});

canvas.onpointerdown=e=>{if(e.button!==0)return;pause();const p=point(e);
 if(e.shiftKey){const h=hitLayerAt(p);if(h)toggleMulti(h.id);return}
 const textSel=current();if(textSel&&textSel.visible!==false&&frame>=textSel.in&&frame<=textSel.out){const pose=poseAt(textSel,frame),b=bounds(pose),gp=groupPose(groupOf(textSel),frame);let q=point(e,textSel);if(gp){const ang=-gp.rotation*Math.PI/180,dx=q.x-gp.x,dy=q.y-gp.y;q={x:gp.anchorX+(dx*Math.cos(ang)-dy*Math.sin(ang))/gp.scale,y:gp.anchorY+(dx*Math.sin(ang)+dy*Math.cos(ang))/gp.scale};}const a=-pose.rotation*Math.PI/180,dx=q.x-pose.x,dy=q.y-pose.y,local={x:(dx*Math.cos(a)-dy*Math.sin(a))/pose.scale,y:(dx*Math.sin(a)+dy*Math.cos(a))/pose.scale};if([-1,1].some(sx=>[-1,1].some(sy=>Math.hypot(local.x-sx*(b.w/2+8),local.y-sy*(b.h/2+8))<14/Math.max(.001,Math.abs(pose.scale*(gp?.scale??1))*cameraAt(project,frame).zoom*canvas.getBoundingClientRect().width/project.width)))){checkpoint();drag={kind:'layer-scale',id:textSel.id,initial:pose.scale,dist:Math.max(.0001,Math.hypot(dx,dy)),anchor:pose,parent:gp};canvas.setPointerCapture(e.pointerId);return;}}


 const active=current();if(active?.type==='vector'&&active.puppetPin){if(e.altKey){const pos=canvasToPin(active,p,frame);if(pos.x>=0&&pos.x<=1&&pos.y>=0&&pos.y<=1){checkpoint();active.puppetPin={...active.puppetPin,x:pos.x,y:pos.y,keys:[{f:frame,x:pos.x,y:pos.y}]};changed();return;}}const hp=pinCanvasPoint(active,frame);

  if(hp&&Math.hypot(p.x-hp.x,p.y-hp.y)<Math.max(14,active.w*.04)){checkpoint();drag={kind:'puppet',id:active.id};canvas.setPointerCapture(e.pointerId);return;}}

 const graphLayer=current();if(graphLayer?.type==='diagram'&&graphLayer.visible!==false&&frame>=graphLayer.in&&frame<=graphLayer.out){
 const pose=poseAt(graphLayer,frame),gp=groupPose(groupOf(graphLayer),frame);let q=p;
 if(gp){const a=-gp.rotation*Math.PI/180,dx=q.x-gp.x,dy=q.y-gp.y;q={x:gp.anchorX+(dx*Math.cos(a)-dy*Math.sin(a))/gp.scale,y:gp.anchorY+(dx*Math.sin(a)+dy*Math.cos(a))/gp.scale};}
 const a=-pose.rotation*Math.PI/180,dx=q.x-pose.x,dy=q.y-pose.y,local={x:(dx*Math.cos(a)-dy*Math.sin(a))/pose.scale,y:(dx*Math.sin(a)+dy*Math.cos(a))/pose.scale};
 const node=graphHit(pose,local);if(node>=0){checkpoint();drag={kind:'graph-node',id:graphLayer.id,node};canvas.setPointerCapture(e.pointerId);return;}}
 let hit;for(const raw of[...project.layers].reverse()){if(raw.type==='group'||raw.visible===false||frame<raw.in||frame>raw.out)continue;const parent=groupOf(raw);if(parent&&parent.visible===false)continue;const l=poseAt(raw,frame),gp=groupPose(parent,frame);let pp=unprojectLayerPoint(project,raw,cameraAt(project,frame),p,layerCenter(l,parent,frame));if(gp){const ang=-gp.rotation*Math.PI/180,dx=p.x-gp.x,dy=p.y-gp.y;pp={x:gp.anchorX+(dx*Math.cos(ang)-dy*Math.sin(ang))/gp.scale,y:gp.anchorY+(dx*Math.sin(ang)+dy*Math.cos(ang))/gp.scale}}const a=-l.rotation*Math.PI/180,dx=pp.x-l.x,dy=pp.y-l.y,x=(dx*Math.cos(a)-dy*Math.sin(a))/l.scale,y=(dx*Math.sin(a)+dy*Math.cos(a))/l.scale,{w,h}=bounds(l);if(Math.abs(x)<=w/2+10&&Math.abs(y)<=h/2+10){hit=raw;break}}if(hit){if(hit.parentId&&(e.altKey||selected===hit.parentId))hit=groupOf(hit);const keepMulti=multiIds().includes(hit.id),others=keepMulti?multiIds().filter(i=>i!==hit.id).map(i=>project.layers.find(z=>z.id===i)).filter(Boolean).map(o=>({id:o.id,x:valueAt(o,'x',frame),y:valueAt(o,'y',frame),parent:groupPose(groupOf(o),frame)})):[];if(keepMulti){selected=hit.id;selectedKey=null;cameraUI?.clear();renderLayers();renderInspector();draw()}else select(hit.id);checkpoint();drag={kind:'move',start:point(e,hit),x:valueAt(hit,'x',frame),y:valueAt(hit,'y',frame),parent:groupPose(groupOf(hit),frame),others};canvas.setPointerCapture(e.pointerId)}else select(null)};

window.addEventListener('pointermove',e=>{if(clipDrag){updateClipDrag(e);return}if(keyDrag){const to=frameFromEvent(e),l=current();l.keys=JSON.parse(JSON.stringify(keyDrag.keys));if(to!==keyDrag.from){for(const prop of PROPS){let ks=l.keys[prop]||[],moving=ks.find(k=>k.f===keyDrag.from);if(moving){ks=ks.filter(k=>k.f!==to||k===moving);moving.f=to;ks.sort((a,b)=>a.f-b.f);l.keys[prop]=ks}}}keyDrag.to=to;selectedKey={id:l.id,f:to};setFrame(to);renderTimeline();return}if(!drag)return;if(drag.kind==='puppet'){const layer=project.layers.find(z=>z.id===drag.id);if(layer?.puppetPin){const pos=canvasToPin(layer,point(e,layer),frame);setPinKey(layer,frame,pos.x,pos.y);draw();}return;}if(drag.kind==='layer-scale'){const layer=project.layers.find(z=>z.id===drag.id);if(!layer)return;let q=point(e,layer);const gp=drag.parent;if(gp){const a=-gp.rotation*Math.PI/180,dx=q.x-gp.x,dy=q.y-gp.y;q={x:gp.anchorX+(dx*Math.cos(a)-dy*Math.sin(a))/gp.scale,y:gp.anchorY+(dx*Math.sin(a)+dy*Math.cos(a))/gp.scale};}const pose=drag.anchor,a=-pose.rotation*Math.PI/180,dx=q.x-pose.x,dy=q.y-pose.y,dist=Math.hypot(dx*Math.cos(a)-dy*Math.sin(a),dx*Math.sin(a)+dy*Math.cos(a));editProp(layer,'scale',Math.max(.01,Math.min(20,drag.initial*dist/drag.dist)));draw();return;}if(drag.kind==='graph-node'){const layer=project.layers.find(q=>q.id===drag.id);if(!layer)return;const pose=poseAt(layer,frame),gp=groupPose(groupOf(layer),frame);let q=point(e,layer);if(gp){const a=-gp.rotation*Math.PI/180,dx=q.x-gp.x,dy=q.y-gp.y;q={x:gp.anchorX+(dx*Math.cos(a)-dy*Math.sin(a))/gp.scale,y:gp.anchorY+(dx*Math.sin(a)+dy*Math.cos(a))/gp.scale};}const a=-pose.rotation*Math.PI/180,dx=q.x-pose.x,dy=q.y-pose.y;layer.structured.nodes[drag.node].x=Math.max(0,Math.min(1,.5+(dx*Math.cos(a)-dy*Math.sin(a))/(pose.w*pose.scale)));layer.structured.nodes[drag.node].y=Math.max(0,Math.min(1,.5+(dx*Math.sin(a)+dy*Math.cos(a))/(pose.h*pose.scale)));draw();return;}if(drag.kind==='scrub'){setFrame(frameFromEvent(e));return}const l=current();if(!l)return;const p=point(e,l);let dx=p.x-drag.start.x,dy=p.y-drag.start.y;const rawDx=dx,rawDy=dy;if(drag.parent){const g=drag.parent,r=-g.rotation*Math.PI/180;[dx,dy]=[(dx*Math.cos(r)-dy*Math.sin(r))/g.scale,(dx*Math.sin(r)+dy*Math.cos(r))/g.scale]}editProp(l,'x',Math.round(drag.x+dx));editProp(l,'y',Math.round(drag.y+dy));for(const o of drag.others||[]){const lo=project.layers.find(z=>z.id===o.id);if(!lo)continue;let ox=rawDx,oy=rawDy;if(o.parent){const g=o.parent,r=-g.rotation*Math.PI/180;[ox,oy]=[(ox*Math.cos(r)-oy*Math.sin(r))/g.scale,(ox*Math.sin(r)+oy*Math.cos(r))/g.scale]}editProp(lo,'x',Math.round(o.x+ox));editProp(lo,'y',Math.round(o.y+oy))}draw();renderInspector()});

window.addEventListener('pointercancel',()=>{if(drag?.kind==='layer-scale'){changed();drag=null;}});
window.addEventListener('pointerup',()=>{if(drag?.kind==='move'||drag?.kind==='puppet'||drag?.kind==='graph-node'||drag?.kind==='layer-scale'||keyDrag||clipDrag)changed();drag=null;keyDrag=null;clipDrag=null});

function add(type,extra={}){pause();checkpoint();if(type==='list'||type==='diagram'){extra={w:project.width*.68,h:project.height*.58,structured:structuredClone(type==='list'?DEFAULT_LIST:GRAPH_DEFAULT),...extra};}if(type==='chart'){extra={w:project.width*.70,h:project.height*.62,chart:structuredClone(DEFAULT_CHART),...extra};}if(type==='table'){extra={w:project.width*.76,h:project.height*.6,table:JSON.parse(JSON.stringify(DEFAULT_TABLE)),...extra};}const l=layer(type,{x:project.width/2,y:project.height/2,in:frame,out:project.frames-1,...extra});project.layers.push(l);selected=l.id;if(l.type==='image')loadImages();changed()}

function tableInspector(l){const t=l.table;return `<div class="section-title" style="margin-top:18px">TABLE CONTENT</div><label>Title<input id="tableTitle" maxlength="160" value="${esc(t.title)}"></label><label>Information / subtitle<input id="tableInfo" maxlength="240" value="${esc(t.info)}"></label><label>Headers and rows<textarea id="tableData" rows="7" spellcheck="false">${esc(t.data.map(row=>row.join(' | ')).join('\n'))}</textarea></label><p class="mini-label">First line = column headers. One row per line; separate columns with | or paste tab-separated cells from a spreadsheet. Up to 30 data rows and 8 columns.</p><div class="section-title" style="margin-top:14px">TITLE STYLE</div><div class="two"><label>Size<input data-table-typo="titleFontSize" type="number" min="8" max="100" value="${t.titleFontSize??30}"></label><label>Weight<select data-table-typo="titleWeight">${[400,500,600,700,800].map(n=>`<option value="${n}" ${Number(t.titleWeight??700)===n?'selected':''}>${n}</option>`).join('')}</select></label></div>${fontPickerHtml('tableTitleFont','Title font',t.titleFontFamily||t.fontFamily)}<label>Color<input data-table-typo="titleColor" type="color" value="${t.titleColor||'#e8f1e4'}"></label><div class="section-title" style="margin-top:14px">INFORMATION STYLE</div><div class="two"><label>Size<input data-table-typo="infoFontSize" type="number" min="8" max="100" value="${t.infoFontSize??16}"></label><label>Weight<select data-table-typo="infoWeight">${[400,500,600,700,800].map(n=>`<option value="${n}" ${Number(t.infoWeight??400)===n?'selected':''}>${n}</option>`).join('')}</select></label></div>${fontPickerHtml('tableInfoFont','Information font',t.infoFontFamily||t.fontFamily)}<label>Color<input data-table-typo="infoColor" type="color" value="${t.infoColor||'#a8bba4'}"></label><div class="section-title" style="margin-top:14px">TABLE CELLS STYLE</div><div class="two"><label>Body size<input id="tableFontSizeInline" type="number" min="8" max="100" value="${t.fontSize}"></label><label>Header size<input data-table-typo="headerFontSize" type="number" min="8" max="100" value="${t.headerFontSize??t.fontSize}"></label></div><label>Header weight<select data-table-typo="headerWeight">${[400,500,600,700,800].map(n=>`<option value="${n}" ${Number(t.headerWeight??700)===n?'selected':''}>${n}</option>`).join('')}</select></label>${fontPickerHtml('tableFont','Body font',t.fontFamily)}<label>Table style<select id="tableTheme">${Object.entries(TABLE_THEMES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Reveal animation<select id="tableAnimation">${Object.entries(TABLE_ANIMATIONS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><div class="two"><label>Reveal frames<input id="tableDuration" type="number" min="1" max="1800" value="${t.duration}"></label><label>Text size<input id="tableFontSize" type="number" min="8" max="100" value="${t.fontSize}"></label></div><p class="mini-label">Reveal starts at the layer's In frame. All rows are visible after ${t.duration} frames. Extend Out frame if needed. Transform keyframes animate the whole table.</p>`;}

function bindTableInspector(l){$('#tableFontSizeInline').onchange=e=>{checkpoint();l.table.fontSize=Math.max(8,Math.min(100,Number(e.target.value)||26));changed()};document.querySelectorAll('[data-table-typo]').forEach(el=>el.onchange=()=>{pause();checkpoint();l.table[el.dataset.tableTypo]=el.type==='number'||el.tagName==='SELECT'?Number(el.value):el.value;changed()});

  $('#tableTheme').value=l.table.theme;$('#tableAnimation').value=l.table.animation;

  for(const [id,key] of [['tableTitle','title'],['tableInfo','info'],['tableTheme','theme'],['tableAnimation','animation']])$('#'+id).onchange=e=>{pause();checkpoint();l.table[key]=e.target.value;changed()};

  bindFontPicker('tableFont',n=>{pause();checkpoint();l.table.fontFamily=n;changed()});
  for(const [id,key] of [['tableTitleFont','titleFontFamily'],['tableInfoFont','infoFontFamily']])bindFontPicker(id,n=>{pause();checkpoint();l.table[key]=n;changed()});

  $('#tableData').onchange=e=>{let data;try{data=parseTable(e.target.value)}catch(err){notify(err.message);renderInspector();return}pause();checkpoint();l.table.data=data;changed()};

  for(const [id,key,lo,hi] of [['tableDuration','duration',1,1800],['tableFontSize','fontSize',8,100]])$('#'+id).onchange=e=>{pause();checkpoint();l.table[key]=Math.max(lo,Math.min(hi,Math.round(+e.target.value)||lo));changed()};

}

const motionSettings=$('#motionSettingsPanel');

$('#motionSettingsButton').onclick=()=>{if(!motionSettings.open)motionSettings.showModal()};

$('#motionSettingsClose').onclick=()=>motionSettings.close();

motionSettings.addEventListener('click',e=>{if(e.target===motionSettings)motionSettings.close()});

function chartInspector(l){const c={...DEFAULT_CHART,...l.chart},colors=c.colors||DEFAULT_CHART.colors;const colorsUI=Array.from({length:6},(_,i)=>`<label>Series ${i+1}<input type="color" data-chart-color="${i}" value="${colors[i%colors.length]}"></label>`).join('');return `<div class="section-title" style="margin-top:18px">CHART</div><label>Visualization<select id="chartType">${`${c.type==='table'?'<option value="table">Legacy table chart</option>':''}${Object.entries(CHART_TYPES).filter(([k])=>k!=='table').map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}`}</select></label><label>Title<input id="chartTitle" maxlength="160" value="${esc(c.title)}"></label><label>Subtitle<input id="chartSubtitle" maxlength="160" value="${esc(c.subtitle)}"></label><label>Chart data<textarea id="chartData" rows="7" spellcheck="false">${esc(c.data.map(r=>r.join(' | ')).join('\n'))}</textarea></label><p class="mini-label">Enter one row per line as Name | Number. This data works for all chart types.</p><div class="section-title" style="margin-top:18px">TITLE STYLE</div><div class="two"><label>Title size<input data-chart-typo="titleSize" type="number" min="8" max="100" value="${c.titleSize??25}"></label><label>Title weight<select data-chart-typo="titleWeight">${[400,500,600,700,800].map(n=>`<option value="${n}" ${Number(c.titleWeight??700)===n?'selected':''}>${n}</option>`).join('')}</select></label></div>${fontPickerHtml('chartTitleFont','Title font',c.titleFontFamily||c.fontFamily)}<div class="section-title" style="margin-top:18px">SUBTITLE STYLE</div><div class="two"><label>Subtitle size<input data-chart-typo="subtitleSize" type="number" min="8" max="100" value="${c.subtitleSize??15}"></label><label>Subtitle weight<select data-chart-typo="subtitleWeight">${[400,500,600,700,800].map(n=>`<option value="${n}" ${Number(c.subtitleWeight??400)===n?'selected':''}>${n}</option>`).join('')}</select></label></div>${fontPickerHtml('chartSubtitleFont','Subtitle font',c.subtitleFontFamily||c.fontFamily)}<div class="section-title" style="margin-top:18px">LABEL / VALUE STYLE</div>${fontPickerHtml('chartLabelFont','Label font',c.labelFontFamily||c.fontFamily)}<label>Label weight<select data-chart-typo="labelWeight">${[400,500,600,700,800].map(n=>`<option value="${n}" ${Number(c.labelWeight??400)===n?'selected':''}>${n}</option>`).join('')}</select></label><div class="section-title" style="margin-top:18px">TYPOGRAPHY</div>${fontPickerHtml('chartFont','Font family',c.fontFamily)}<div class="two"><label>Text size<input id="chartSize" type="number" min="8" max="80" value="${c.fontSize}"></label><label>Font weight<select id="chartWeight"><option value="400">Regular</option><option value="500">Medium</option><option value="600">Semibold</option><option value="700">Bold</option><option value="800">Extra bold</option></select></label></div><div class="section-title" style="margin-top:18px">COLORS & APPEARANCE</div><div class="two"><label>Title color<input id="chartTitleColor" type="color" value="${c.titleColor}"></label><label>Text / labels<input id="chartTextColor" type="color" value="${c.textColor}"></label><label>Subtitle color<input id="chartSubtitleColor" type="color" value="${c.subtitleColor}"></label><label>Grid / lines<input id="chartGridColor" type="color" value="${c.gridColor}"></label></div><div class="two">${colorsUI}</div><label class="m-chk"><input id="chartBackground" type="checkbox"> Show chart background</label><div class="two"><label>Background color<input id="chartBackgroundColor" type="color" value="${c.backgroundColor}"></label><label>Background opacity<input id="chartBackgroundOpacity" type="number" min="0" max="1" step=".05" value="${c.backgroundOpacity}"></label></div><div class="two"><label>Line width<input id="chartStrokeWidth" type="number" min="1" max="20" value="${c.strokeWidth}"></label><label>Corner radius<input id="chartCornerRadius" type="number" min="0" max="50" value="${c.cornerRadius}"></label></div><label class="m-chk"><input id="chartValues" type="checkbox"> Show values</label><label class="m-chk"><input id="chartGrid" type="checkbox"> Show grid</label><label class="m-chk"><input id="chartAxes" type="checkbox"> Show axes / scale</label><label class="m-chk"><input id="chartLegend" type="checkbox"> Show legend</label><div class="section-title" style="margin-top:18px">ANIMATION</div><label>Reveal animation<select id="chartReveal">${Object.entries(CHART_REVEALS).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label>Reveal duration (frames)<input id="chartDuration" type="number" min="1" max="1800" value="${c.duration}"></label><p class="mini-label">Edits update directly in the composition. The reveal begins at the layer's In frame.</p>`;}

function bindChartInspector(l){const c=l.chart;document.querySelectorAll('[data-chart-typo]').forEach(el=>el.onchange=()=>{pause();checkpoint();c[el.dataset.chartTypo]=el.type==='number'||el.tagName==='SELECT'?Number(el.value):el.value.slice(0,60);changed()});const edit=(key,read)=>e=>{pause();checkpoint();c[key]=read(e.target);changed()};for(const [id,key] of [['chartType','type'],['chartTitle','title'],['chartSubtitle','subtitle'],['chartReveal','reveal']]){const el=$('#'+id);el.value=c[key];el.onchange=edit(key,el=>el.value)}for(const [id,key] of [['chartValues','showValues'],['chartGrid','showGrid'],['chartLegend','showLegend'],['chartBackground','showBackground'],['chartAxes','showAxes']]){const el=$('#'+id);el.checked=c[key]??DEFAULT_CHART[key];el.onchange=edit(key,el=>el.checked)}$('#chartData').onchange=e=>{let v;try{v=parseChartData(e.target.value)}catch(err){notify(err.message);renderInspector();return}pause();checkpoint();c.data=v;changed()};for(const [id,key,lo,hi] of [['chartDuration','duration',1,1800],['chartSize','fontSize',8,80],['chartWeight','fontWeight',400,800],['chartStrokeWidth','strokeWidth',1,20],['chartCornerRadius','cornerRadius',0,50],['chartBackgroundOpacity','backgroundOpacity',0,1]]){const el=$('#'+id);el.value=c[key]??DEFAULT_CHART[key];el.onchange=edit(key,el=>Math.max(lo,Math.min(hi,+el.value||0)))}for(const [id,key] of [['chartTitleColor','titleColor'],['chartTextColor','textColor'],['chartSubtitleColor','subtitleColor'],['chartGridColor','gridColor'],['chartBackgroundColor','backgroundColor']])$('#'+id).onchange=edit(key,el=>el.value);$$('[data-chart-color]').forEach(el=>el.onchange=e=>{pause();checkpoint();let colors=[...c.colors];while(colors.length<6)colors.push(colors[colors.length%Math.max(1,c.colors.length)]||'#b6f36e');colors[+el.dataset.chartColor]=e.target.value;c.colors=colors;changed()});bindFontPicker('chartFont',name=>{pause();checkpoint();c.fontFamily=name;changed()});for(const [id,key] of [['chartTitleFont','titleFontFamily'],['chartSubtitleFont','subtitleFontFamily'],['chartLabelFont','labelFontFamily']])bindFontPicker(id,name=>{pause();checkpoint();c[key]=name;changed()});}

function installMotionExtrasUI(){

  document.querySelector('.workspace.motion-only .add-grid').insertAdjacentHTML('beforeend','<button data-add="table"><b>▤</b>Table</button><button data-add="chart"><b>▥</b>Chart</button><button data-add="list"><b>☷</b>List</button><button data-add="diagram"><b>◇</b>Diagram</button>');

  installMotionElements({add,notify,vector:true,sanitizeSvg});

  $('#background').closest('label').insertAdjacentHTML('afterend',`<div class="section-title" style="margin-top:18px">BACKGROUND STYLE</div><label>Pattern<select id="backgroundStyle">${Object.entries(BACKGROUND_STYLES).map(([k,v])=>`<option value="${k}">${v}</option>`).join('')}</select></label><label class="m-chk"><input id="backgroundAnimated" type="checkbox"> Animate background</label><div class="two"><label>Speed<input id="backgroundSpeed" type="number" min="0" max="4" step=".1"></label><label>Spacing<input id="backgroundSpacing" type="number" min="20" max="200" step="4"></label></div><label>Strength <span class="m-val" id="backgroundStrengthValue"></span><input id="backgroundStrength" type="range" min="0" max="100"></label><label class="color-row">Pattern color<input id="backgroundPatternColor" type="color"></label><p class="mini-label">These backgrounds appear in PNG and video exports. Play or scrub the timeline to preview movement. The stage Grid button is an editing guide only.</p>`);

  const edit=fn=>e=>{pause();checkpoint();project.backgroundEffect={...DEFAULT_BACKGROUND,...project.backgroundEffect};fn(project.backgroundEffect,e.target);changed()};

  $('#backgroundStyle').onchange=edit((b,el)=>b.style=el.value);

  $('#backgroundAnimated').onchange=edit((b,el)=>b.animated=el.checked);

  $('#backgroundSpeed').onchange=edit((b,el)=>b.speed=Math.max(0,Math.min(4,+el.value||0)));

  $('#backgroundSpacing').onchange=edit((b,el)=>b.spacing=Math.max(20,Math.min(200,+el.value||64)));

  $('#backgroundStrength').onchange=edit((b,el)=>b.opacity=+el.value/100);

  $('#backgroundStrength').oninput=e=>$('#backgroundStrengthValue').textContent=e.target.value+'%';

  $('#backgroundPatternColor').onchange=edit((b,el)=>b.color=el.value);

}

function renderBackgroundSettings(){const b={...DEFAULT_BACKGROUND,...project.backgroundEffect};$('#backgroundStyle').value=b.style;$('#backgroundAnimated').checked=b.animated;$('#backgroundSpeed').value=b.speed;$('#backgroundSpacing').value=b.spacing;$('#backgroundStrength').value=Math.round(b.opacity*100);$('#backgroundStrengthValue').textContent=Math.round(b.opacity*100)+'%';$('#backgroundPatternColor').value=b.color;for(const id of ['backgroundAnimated','backgroundSpeed','backgroundSpacing','backgroundStrength','backgroundPatternColor'])$('#'+id).disabled=b.style==='none';$('#backgroundSpacing').disabled=b.style==='none'||b.style==='glow';$('#backgroundSpeed').disabled=b.style==='none'||!b.animated;}



function groupSelected(){const ids=[...document.querySelectorAll('.group-check:checked')].map(x=>x.dataset.groupCheck);if(ids.length<2){notify('Check at least two ungrouped layers');return}const children=project.layers.filter(l=>ids.includes(l.id)&&!l.parentId&&l.type!=='group');if(children.length<2){notify('Select at least two ungrouped layers');return}checkpoint();const x=children.reduce((s,l)=>s+l.x,0)/children.length,y=children.reduce((s,l)=>s+l.y,0)/children.length;const group=layer('group',{name:'New group',x,y,anchorX:x,anchorY:y,w:160,h:100,in:Math.min(...children.map(l=>l.in)),out:Math.max(...children.map(l=>l.out))});project.layers.push(group);children.forEach(l=>l.parentId=group.id);selected=group.id;changed();notify('Group created. Add keyframes to animate all members.')}

function ungroupSelected(){const g=current();if(g?.type!=='group')return;if(Object.values(g.keys).some(ks=>ks.length)){notify('Remove group keyframes before ungrouping to avoid losing motion');return}checkpoint();for(const child of project.layers.filter(l=>l.parentId===g.id)){// Bake static group transform; animated groups require keyframe baking before separation.

 const ax=g.anchorX??g.x,ay=g.anchorY??g.y,dx=child.x-ax,dy=child.y-ay,r=g.rotation*Math.PI/180;child.x=g.x+g.scale*(dx*Math.cos(r)-dy*Math.sin(r));child.y=g.y+g.scale*(dx*Math.sin(r)+dy*Math.cos(r));child.rotation+=g.rotation;child.scale*=g.scale;child.opacity*=g.opacity;delete child.parentId}

 project.layers=project.layers.filter(l=>l.id!==g.id);selected=null;changed()}

const groupTools=document.createElement('div');groupTools.className='group-tools';groupTools.innerHTML='<button id="makeGroup" title="Check two or more layers first">Group checked</button><button id="ungroup" title="Ungroup selected group">Ungroup</button>';$('#layers').after(groupTools);$('#makeGroup').onclick=groupSelected;$('#ungroup').onclick=ungroupSelected;

let canvasZoom=1,zoomMode='fit';

// Canvas zoom is scoped to Motion Studio only. The canvas can be panned at
// large zoom levels, but the preview never exposes platform scrollbars.
function updateCanvasZoom(){
  const area=$('.workspace.motion-only .stage-area');
  const wrap=$('.workspace.motion-only .canvas-wrap');
  if(!area||!wrap||!project)return;
  const aw=area.clientWidth,ah=area.clientHeight;
  if(aw<=0||ah<=0)return;
  const gutter=24;
  const fit=Math.max(.05,Math.min((aw-2*gutter)/project.width,(ah-2*gutter)/project.height));
  const scale=zoomMode==='fit'?fit:canvasZoom;
  const w=project.width*scale,h=project.height*scale;
  canvas.style.width=`${w}px`;
  canvas.style.height=`${h}px`;
  wrap.style.width=`${Math.max(aw,w+2*gutter)}px`;
  wrap.style.height=`${Math.max(ah,h+2*gutter)}px`;
  wrap.style.minWidth='0';wrap.style.minHeight='0';
  wrap.style.margin='0';wrap.style.display='flex';
  wrap.style.alignItems='center';wrap.style.justifyContent='center';
  area.style.overflow='auto';
  area.style.scrollbarWidth='none';area.style.msOverflowStyle='none';
  // Chromium/WebKit scrollbar hiding is defined in the existing editor CSS.
  $('#canvasZoomLabel').textContent=`${Math.round(scale*100)}%`;
  if(zoomMode==='fit')canvasZoom=scale;
}
function setCanvasZoom(value){
  const area=$('.workspace.motion-only .stage-area');
  const centerX=area.scrollLeft+area.clientWidth/2;
  const centerY=area.scrollTop+area.clientHeight/2;
  const oldW=area.scrollWidth,oldH=area.scrollHeight;
  zoomMode='manual';canvasZoom=Math.max(.05,Math.min(4,value));
  updateCanvasZoom();
  area.scrollLeft=Math.max(0,centerX/Math.max(1,oldW)*area.scrollWidth-area.clientWidth/2);
  area.scrollTop=Math.max(0,centerY/Math.max(1,oldH)*area.scrollHeight-area.clientHeight/2);
}
$('#canvasZoomIn').onclick=()=>setCanvasZoom(canvasZoom*1.1);
$('#canvasZoomOut').onclick=()=>setCanvasZoom(canvasZoom/1.1);
$('#canvasZoomFit').onclick=()=>{zoomMode='fit';updateCanvasZoom();const area=$('.workspace.motion-only .stage-area');area.scrollLeft=0;area.scrollTop=0};
$('#canvasZoom100').onclick=()=>setCanvasZoom(1);
$('.workspace.motion-only .stage-area').addEventListener('wheel',evt=>{
  if(evt.ctrlKey||evt.metaKey){evt.preventDefault();setCanvasZoom(canvasZoom*(evt.deltaY<0?1.1:1/1.1))}
},{passive:false});
window.addEventListener('resize',updateCanvasZoom);

// Only the Motion Studio preview enters fullscreen; the timeline and sidebars stay unchanged.

const motionPreview=$('.workspace.motion-only main');

const fullscreenButton=$('#motionFullscreen');

async function toggleMotionFullscreen(){

  try {

    if(document.fullscreenElement===motionPreview)await document.exitFullscreen();

    else if(!document.fullscreenElement)await motionPreview.requestFullscreen();

    else notify('Exit the current fullscreen view first');

  }catch(err){notify('Fullscreen unavailable: '+(err?.message||err))}

}

fullscreenButton.addEventListener('click',toggleMotionFullscreen);

document.addEventListener('fullscreenchange',()=>{

  const on=document.fullscreenElement===motionPreview;

  fullscreenButton.textContent=on?'⛶ Exit fullscreen':'⛶ Fullscreen';

  fullscreenButton.title=on?'Exit fullscreen (Esc or F)':'Show composition fullscreen (F)';

  // Resize after the fullscreen layout has been applied.

  requestAnimationFrame(updateCanvasZoom);

});

window.addEventListener('keydown',event=>{

  if(event.key.toLowerCase()!=='f'||event.repeat||event.ctrlKey||event.altKey||event.metaKey)return;

  if(document.querySelector('dialog[open]')||document.body.classList.contains('mode-scene')||document.body.classList.contains('mode-map')||document.body.classList.contains('mode-paper')||$('#modal').open||motionSettings.open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;

  event.preventDefault();toggleMotionFullscreen();

});





installMotionExtrasUI();

$$('[data-add]').forEach(el=>el.onclick=()=>add(el.dataset.add));$('#duplicate').onclick=()=>{if(audioUI?.duplicate())return;if(!current())return;if(current().type==='group'){notify('Duplicate child layers individually');return}checkpoint();const l=JSON.parse(JSON.stringify(current()));l.id=uid();l.name+=' copy';l.x+=30;l.y+=30;for(const prop of['x','y'])for(const k of l.keys[prop]||[])k.v+=30;project.layers.push(l);selected=l.id;changed()};$('#delete').onclick=()=>{if(cameraUI?.removeSelected())return;if(audioUI?.remove())return;if(!current())return;checkpoint();if(current().type==='group'){if(Object.values(current().keys).some(ks=>ks.length)){notify('Remove group keys or ungroup first');undoStack.pop();updateHistory();return}project.layers.forEach(l=>{if(l.parentId===selected)delete l.parentId})};project.layers=project.layers.filter(l=>l.id!==selected);selected=project.layers.at(-1)?.id;changed()};function reorder(delta){const i=project.layers.findIndex(l=>l.id===selected),j=i+delta;if(i<0||j<0||j>=project.layers.length)return;checkpoint();[project.layers[i],project.layers[j]]=[project.layers[j],project.layers[i]];changed()}$('#up').onclick=()=>reorder(1);$('#down').onclick=()=>reorder(-1);

$('#keyAll').onclick=()=>{const l=current();if(!l)return;pause();checkpoint();for(const p of['x','y','scale','rotation','opacity'])putKey(l,p,frame,valueAt(l,p,frame));changed();notify(`Transform keyed at ${(frame/project.fps).toFixed(2)}s`)};

$('#play').onclick=play;$('#start').onclick=()=>{pause();setFrame(0)};$('#end').onclick=()=>{pause();setFrame(project.frames-1)};$('#prev').onclick=()=>{pause();setFrame(frame-1)};$('#next').onclick=()=>{pause();setFrame(frame+1)};$('#loop').onclick=()=>{loop=!loop;$('#loop').classList.toggle('active',loop)};$('#frame').onchange=e=>{pause();setFrame(+e.target.value*project.fps)};$('#grid').onclick=()=>{showGrid=!showGrid;$('#grid').classList.toggle('active',showGrid);draw()};$('#zoom').oninput=()=>{renderTimeline();setFrame(frame,false)};

$('#projectName').onchange=e=>{checkpoint();project.name=e.target.value.trim()||'Untitled composition';changed()};$('#fps').onchange=e=>{pause();checkpoint();project.fps=+e.target.value;changed()};$('#duration').onchange=e=>{pause();checkpoint();const old=project.frames;project.frames=Math.max(2,Math.min(1800,Math.round(+e.target.value*project.fps)||180));for(const l of project.layers){if(l.out===old-1||l.out>=project.frames)l.out=project.frames-1;l.in=Math.min(l.in,l.out)}frame=Math.min(frame,project.frames-1);changed()};$('#size').onchange=e=>{checkpoint();const[w,h]=e.target.value.split(',').map(Number);project.width=w;project.height=h;changed()};$('#background').onchange=e=>{checkpoint();project.bg=e.target.value;changed()};$('#undo').onclick=()=>history('undo');$('#redo').onclick=()=>history('redo');

function download(blob,name){const u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),30000)}function filename(){return(project.name||'composition').replace(/[^a-z0-9 _-]/gi,'').trim()||'composition'}

$('#save').onclick=()=>{download(new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),filename()+'.frameflow.json');notify('Project downloaded')};$('#open').onclick=()=>$('#projectFile').click();$('#projectFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;try{if(f.size>30e6)throw Error('Project is larger than 30 MB.');const p=validateProject(JSON.parse(await f.text()));pause();checkpoint();project=p;audioUI?.reset();selected=p.layers.at(-1)?.id;frame=0;loadImages();changed();notify('Project opened')}catch(err){notify(err.message)}e.target.value=''};

$('#image').onclick=()=>$('#imageFile').click();$('#imageFile').onchange=e=>{const f=e.target.files[0];if(!f)return;if(f.size>10e6){notify('Choose an image smaller than 10 MB');return}const r=new FileReader;r.onload=()=>{const im=new Image;im.onload=()=>{const max=Math.min(project.width,project.height)*.65,s=Math.min(1,max/Math.max(im.width,im.height));const temp=document.createElement('canvas');temp.width=im.width*s;temp.height=im.height*s;temp.getContext('2d').drawImage(im,0,0,temp.width,temp.height);const src=temp.toDataURL('image/png'),converted=new Image;converted.onload=()=>{images.set(src,converted);add('image',{name:f.name,w:temp.width,h:temp.height,src})};converted.src=src};im.onerror=()=>notify('Could not read this image');im.src=r.result};r.readAsDataURL(f);e.target.value=''};



// SVG import: editable vector geometry is retained in project JSON.

{ const btn=document.createElement('button');btn.type='button';btn.innerHTML='<b>✧</b> SVG';btn.title='Import editable SVG';

 document.querySelector('.workspace.motion-only .add-grid').append(btn);

 const file=document.createElement('input');file.type='file';file.accept='.svg,image/svg+xml';file.hidden=true;document.body.append(file);

 btn.onclick=()=>file.click();file.onchange=async()=>{const f=file.files[0];file.value='';if(!f)return;

 try{if(f.size>180000)throw Error('SVG must be smaller than 180 KB');const svgMarkup=sanitizeSvg(await f.text());

 add('vector',{name:f.name.replace(/\.svg$/i,''),svgMarkup,w:250,h:250,vectorFill:'#b6f36e',vectorStroke:'#ffffff',vectorStrokeWidth:5,vectorDraw:false,vectorStart:frame,vectorDuration:40,vectorPin:false,vectorPinColor:'#ef476f',vectorPinSize:5});

 }catch(e){notify('SVG import: '+e.message)}};

}

$('#snapshot').onclick=()=>{const c=document.createElement('canvas');drawScene(c.getContext('2d'),frame);c.toBlob(b=>download(b,filename()+`-frame-${frame}.png`),'image/png')};

function modal(html){$('#modalBody').innerHTML=html;$('#closeModal').textContent='Close';$('#modal').showModal()}

$('#help').onclick=()=>modal(`<h2>Make your first move.</h2><ol><li>Select a layer and go to frame 0.</li><li>Click <b>◇ Key transform</b> to record its starting pose.</li><li>Move to a later frame. Drag the layer or change a property; Auto-key records the next pose.</li><li>Press Space to preview, then export your video.</li></ol><p><b>Timeline:</b> drag diamonds to retime keys. Alt-click a diamond to remove the keys at that frame. Property diamonds toggle one key. Easing controls motion to the next key.</p><p><b>Shortcuts:</b> Space play/pause · ← → one frame · Shift + arrows ten frames · K key transform · Ctrl/Cmd Z undo · Ctrl/Cmd Shift Z redo · Delete remove layer.</p><p>Your latest project is saved in this browser. Use <b>Save project</b> to keep a portable copy. Video exports include retained audio parts. Audio files and edits are session-only and are not embedded in saved project files.</p>`);$('#closeModal').onclick=()=>{if(exporting){exporting=false;$('#closeModal').disabled=true}else $('#modal').close()};$('#modal').addEventListener('cancel',e=>{if(exporting){e.preventDefault();exporting=false}});

$('#new').onclick=async()=>{if(!await confirmStudio('Start an empty composition? Your current edit can be restored with Undo.'))return;pause();checkpoint();audioUI?.reset();project={version:1,name:'Untitled composition',width:1920,height:1080,fps:30,frames:180,bg:'#e7e9e1',layers:[]};selected=null;frame=0;changed()};$('#demo').onclick=async()=>{if(!await confirmStudio('Load the demo? Your current edit can be restored with Undo.', 'Load demo', 'Load demo'))return;pause();checkpoint();audioUI?.reset();project=demo();selected=project.layers[1].id;frame=45;changed()};

$('#export').onclick=async()=>{

  if(exporting)return;pause();

  const snapshot=JSON.parse(JSON.stringify(project)), name=filename();

  modal(exportMarkup({...snapshot, progressId:'progress', statusId:'exportStatus'}));

  $('#closeModal').textContent='Cancel export';exporting=true;

  const c=document.createElement('canvas');c.width=snapshot.width;c.height=snapshot.height;const ec=c.getContext('2d');

  try{

    await loadFonts(usedFonts(snapshot));await document.fonts.ready;await preloadVectors(snapshot);

    await Promise.all(snapshot.layers.filter(l=>l.type==='image').map(async l=>{let im=images.get(l.src);if(!im){im=new Image();im.src=l.src;images.set(l.src,im);}await im.decode();}));

    const video=await exportFrameVideo({audio:getAudioSnapshot('motion'),canvas:c,fps:snapshot.fps,frames:snapshot.frames,draw:f=>drawScene(ec,f,false,snapshot),cancelled:()=>!exporting,progress:n=>{$('#progress').value=n;$('#exportStatus').textContent=`Rendering frame ${n} of ${snapshot.frames}`;}});

    if(!exporting){$('#exportStatus').textContent='Export cancelled.';return;}

    download(video,name+'.webm');$('#exportStatus').textContent='All frames encoded. Download started.';notify('Video exported');

  }catch(e){$('#exportStatus').textContent=e.name==='AbortError'?'Export cancelled.':'Export failed: '+e.message;}

  finally{exporting=false;$('#closeModal').disabled=false;$('#closeModal').textContent='Close';}

};

window.addEventListener('keydown',e=>{if(document.querySelector('dialog[open]')||document.body.classList.contains('mode-scene')||document.body.classList.contains('mode-map')||document.body.classList.contains('mode-paper')||$('#modal').open||motionSettings.open||['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName))return;if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();history(e.shiftKey?'redo':'undo');return}if(e.code==='Space'){e.preventDefault();play()}else if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();pause();setFrame(frame+(e.key==='ArrowRight'?1:-1)*(e.shiftKey?10:1))}else if(e.key.toLowerCase()==='k')$('#keyAll').click();else if(e.key==='Delete'||e.key==='Backspace'){if(!cameraUI?.removeSelected())$('#delete').click();e.preventDefault()}});

audioUI = registerAudioStudio('motion', {
 getSelected:()=>selected, getFrame:()=>frame, getFps:()=>project.fps, getFrames:()=>project.frames,
 select, pause, seek:setFrame, notify, updateHistory, visualCount:()=>project.layers.length,
 addGrid:'.workspace.motion-only .add-grid', list:'#layers', counter:'#layerCount', inspector:'#inspector',
 trackLabels:'#trackLabels', trackRows:'#trackRows', tracks:'#tracks', actionButtons:['#duplicate','#delete']
});
cameraUI = attachMotionCamera({project:()=>project,frame:()=>frame,selectedLayer:()=>selected,checkpoint,changed,pause,selectLayer:id=>{selected=id;selectedKey=null},renderInspector,renderTimeline,draw,notify});
alignBar=installAlignBar({mount:document.querySelector('.workspace.motion-only main'),ids:()=>multiIds(),box:id=>layerAABB(id),move:moveLayerScene,size:()=>({w:project.width,h:project.height}),playing:()=>playing,begin:()=>{pause();checkpoint()},done:()=>changed(),clear:()=>{multi.clear();renderLayers();draw()},notify});
try{const saved=localStorage.getItem('frameflow-project-v1');project=saved?validateProject(JSON.parse(saved)):demo()}catch{project=demo()}selected=project.layers.find(l=>l.name==='Main headline')?.id||project.layers.at(-1)?.id;frame=Math.min(frame,project.frames-1);loadImages();renderUI();

window.addEventListener('frameflow:mode',()=>{if(playing)pause()});
window.addEventListener('ff-structured-loaded',()=>{if(project)draw()});