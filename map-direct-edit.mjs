import { paintObjectPreviews } from './map-object-preview.mjs';
import { PIN_STYLES, pinSizeAt } from './map-pin-styles.mjs';
import { bindObjectCascade } from './map-object-picker.mjs';
import { mapStackOrder } from './map-layer-actions.mjs?v=map-order-1';
import { objectLocationAt, project, screenToLonLat, lonToX, latToY, xToLon, yToLat, countryAt, regionAt, resolveLoc, drawRegionSelection, OBJECT_ICONS, EFFECTS, SHAPES, TRAVEL_ICONS } from './map-engine.mjs?v=path-flow-1';
import { objectSizeAt, objectPoseAt, putObjectKey } from './map-object-keys.mjs';
import { groupPoseAt, putGroupKey, makeObjectGroup } from './map-object-groups.mjs';
import { armyCopies } from './map-armies.mjs';
import { pathAt } from './map-path-animation.mjs';
import { objectOffsets } from './map-formations.mjs';
import { networkHalfWidth } from './map-network-style.mjs';
import { isIsometricView } from './map-object-view.mjs';
import { objectAnimationOptions } from './map-isometric-objects.mjs';

const wrap=lon=>((lon+180)%360+360)%360-180;
const spatial=a=>!(a?.type==='effect'&&a.fx==='sunlight')&&['object','group','pin','label','effect','plane','shape'].includes(a?.type);
const rotatable=a=>['object','group'].includes(a?.type);
const scalable=a=>['object','group','pin','effect','label'].includes(a?.type);
const key=t=>`${t.kind}:${t.country||''}:${t.name}`;
export function installDirectMapEditing(api){
  const {canvas}=api,selected=new Set(),lands=new Map();let drag=null,toolbarSelectionKey='';
  const landStyle={color:'#ffb703',showFill:true,showLabel:true,label:''};
  const bar=document.createElement('div');bar.id='mMapContext';bar.className='m-map-context';bar.hidden=true;bar.setAttribute('role','group');bar.setAttribute('aria-label','Selection settings');
  const overlayRoot=canvas.closest('.m-stage-viewport')||canvas.closest('.stage-area');
  const menu=document.createElement('div');menu.id='mMapAddContext';menu.className='m-map-add-context';menu.hidden=true;menu.setAttribute('role','menu');
  menu.innerHTML='<button type="button" role="menuitem" data-direct-add-object>Add object here</button>';overlayRoot.append(menu);
  let contextPoint=null,rightGesture=null,suppressContextUntil=0;
  const showAddMenu=(x,y,point)=>{
    if(!point||api.exporting?.())return;
    api.pause();contextPoint=point;
    const v=api.view(),X=lonToX(point.lon),found=hit(v,project(v,X+Math.round(v.cx-X),latToY(point.lat)));
    const activeLand=regionLayer();
    if(lands.size||activeLand&&!found){
      menu.replaceChildren();addMenu(true);
      if(activeLand&&!lands.size){appendContextControls(activeLand);appendLayerActions([activeLand.id]);}
      positionMenu(x,y);return;
    }
    if(found&&!selected.has(found.id)){lands.clear();selected.clear();selected.add(found.id);api.select(found.id);}
    menu.replaceChildren();
    if(selected.size&&api.current())appendContextControls(api.current());
    if(canGroup())menuButton('Group selected','directGroup',groupSelected);
    const group=found?.type==='group'?found:api.current()?.type==='group'?api.current():null;
    if(group)menuButton('Ungroup','directUngroup',()=>{selected.clear();selected.add(group.id);api.select(group.id);document.querySelector('#mInspector [data-group-ungroup]')?.click();});
    if(selected.size)appendLayerActions([...selected]);
    if(api.current())menuButton('Properties','directProperties',()=>{api.renderInspector();document.querySelector('#mInspector')?.scrollIntoView({block:'nearest'});});
    addMenu();
    positionMenu(x,y);
  };
  function menuButton(text,attribute,action,parent=menu){const button=document.createElement('button');button.type='button';button.setAttribute('role','menuitem');button.dataset[attribute]='';button.textContent=text;button.onclick=()=>{menu.hidden=true;action();};parent.append(button);return button;}
  function contextSubmenu(title,attribute,build){
    const holder=document.createElement('div');holder.className='m-map-submenu';
    const trigger=document.createElement('button');trigger.type='button';trigger.dataset[attribute]='';trigger.dataset.directSubmenu='';trigger.setAttribute('role','menuitem');trigger.setAttribute('aria-haspopup','menu');trigger.setAttribute('aria-expanded','false');
    const text=document.createElement('span');text.textContent=title;const arrow=document.createElement('span');arrow.textContent='\u203a';arrow.setAttribute('aria-hidden','true');trigger.append(text,arrow);
    const sub=document.createElement('div');sub.className='m-map-submenu-panel';sub.dataset[attribute+'Menu']='';sub.dataset.directSubmenuPanel='';sub.setAttribute('role','menu');sub.setAttribute('aria-label',title);sub.hidden=true;
    build(sub);
    const hide=()=>{sub.hidden=true;trigger.setAttribute('aria-expanded','false');};
    const show=()=>{for(const other of menu.querySelectorAll('[data-direct-submenu-panel]'))if(other!==sub){other.hidden=true;other.parentElement.querySelector('[data-direct-submenu]').setAttribute('aria-expanded','false');}sub.hidden=false;paintObjectPreviews(sub);const r=trigger.getBoundingClientRect(),s=sub.getBoundingClientRect();trigger.setAttribute('aria-expanded','true');sub.style.left=Math.max(8,r.right+s.width+8<=innerWidth?r.right:r.left-s.width)+'px';sub.style.top=Math.max(8,Math.min(innerHeight-s.height-8,r.top))+'px';};
    trigger.onclick=show;holder.onpointerenter=show;holder.onpointerleave=()=>{if(!document.querySelector('body > .m-object-cascade:not([hidden])'))hide();};
    holder.addEventListener('focusout',e=>{if(!holder.contains(e.relatedTarget)&&!e.relatedTarget?.closest('.m-object-cascade'))hide();});
    holder.append(trigger,sub);menu.append(holder);
  }
  function arrangeMenu(ids){
    contextSubmenu('Arrange','directArrange',sub=>{
      for(const [action,title] of [['forward','Bring forward'],['backward','Send backward'],['front','Bring to front'],['back','Send to back']])menuButton(title,'directArrange'+action[0].toUpperCase()+action.slice(1),()=>api.layerAction(ids,action),sub);
    });
  }
  function appendContextControls(a){
    const heading=document.createElement('div');heading.className='m-map-context-title';heading.setAttribute('role','presentation');heading.textContent=selected.size>1?`${selected.size} layers selected`:a.name||'Selected layer';menu.append(heading);
    contextSubmenu('Edit selection','directEdit',sub=>{
      sub.classList.add('m-map-edit-panel');bar.replaceChildren();bar.hidden=false;
      bar.dataset.layerId=a.id;bar.dataset.selectionCount=String(selected.size||1);
      bar.className='m-map-context';sub.append(bar);
      if(['highlight','border'].includes(a.type))landControls(a);
      else if(['object','group'].includes(a.type))objectControls(a);
      else layerControls(a);
    });
    const pins=[...selected].map(item).filter(a=>a?.type==='pin'&&!a.badge&&a.showIcon!==false);
    if(pins.length)contextSubmenu('Pin style','directPinStyle',sub=>{
      for(const [value,label] of Object.entries(PIN_STYLES)){
        const button=menuButton(label,'directPinStyle'+value[0].toUpperCase()+value.slice(1),()=>{
          api.pause();api.checkpoint();applySelection('pinStyle',value);api.changed();api.renderInspector();toolbar(true);
        },sub);
        button.setAttribute('role','menuitemradio');button.setAttribute('aria-checked',String(pins.every(a=>(a.pinStyle||'classic')===value)));
      }
    });
    const objects=[...selected].flatMap(id=>{const a=item(id);return a?.type==='group'?a.memberIds.map(item):[a];}).filter(a=>a?.type==='object'||a?.type==='pin'&&(a.showIcon!==false||a.badge));
    if(objects.length)contextSubmenu(objects.every(a=>a.type==='pin')?'Pin sizing':'Object sizing','directSizing',sub=>{
      for(const [value,label]of [['screen','Fixed on screen'],['map','Scale with map']]){
        const button=menuButton(label,'directSizing'+(value==='map'?'Map':'Screen'),()=>{
          api.pause();api.checkpoint();applySelection('sizeMode',value);api.changed();api.renderInspector();
        },sub);
        button.setAttribute('role','menuitemradio');button.setAttribute('aria-checked',String(objects.every(a=>(a.sizeMode||'screen')===value)));
      }
    });
  }
  function addMenu(regions=false){
    contextSubmenu('Add','directAdd',sub=>{
      const place=contextPoint&&{kind:'point',name:'Map position',lon:contextPoint.lon,lat:contextPoint.lat};
      const add=(type,extra)=>{contextPoint=null;lands.clear();selected.clear();api.add(type,extra);toolbar(true);api.draw();};
      for(const [type,title] of [['object','Object'],['pin','Pin / label'],['shape','Arrow / zone'],['effect','Effect']])menuButton(title,'directAdd'+type[0].toUpperCase()+type.slice(1),()=>add(type,type==='shape'?{path:[{lon:place.lon,lat:place.lat}]}:{place}),sub);
      if(regions){
        for(const type of ['highlight','border','label'])menuButton(type[0].toUpperCase()+type.slice(1)+' region'+(lands.size>1?'s':''),'direct'+type[0].toUpperCase()+type.slice(1),()=>applyLand(type),sub);
      }
      menuButton('Scene panel','directAddScene',()=>add('scene',{}),sub);
      menuButton('Audio\u2026','directAddAudio',()=>api.addAudio?.(),sub);
    });
  }
  function appendLayerActions(ids){
    if(ids.some(id=>['object','group','pin','plane','effect','shape'].includes(item(id)?.type))){
      arrangeMenu(ids);
    }
    const copy=menuButton(ids.length>1?'Copy selected':'Copy layer','directContextCopy',()=>api.copy?.());copy.dataset.shortcut='Ctrl+C';
    menuButton(ids.length>1?'Duplicate selected':'Duplicate','directContextDuplicate',()=>api.layerAction(ids,'duplicate'));
    const hidden=ids.some(id=>item(id)?.visible===false);
    menuButton(hidden?'Show selected':'Hide selected','directContextVisibility',()=>api.layerAction(ids,'visibility'));
    menuButton(ids.length>1?'Delete selected':'Delete','directContextDelete',()=>api.layerAction(ids,'delete'));
  }
  function positionMenu(x,y){
    const paste=menuButton('Paste at playhead','directContextPaste',()=>api.paste?.());paste.disabled=!api.canPaste?.();paste.dataset.shortcut='Ctrl+V';
    menu.hidden=false;const r=menu.getBoundingClientRect();menu.style.left=Math.max(8,Math.min(innerWidth-r.width-8,x))+'px';menu.style.top=Math.max(8,Math.min(innerHeight-r.height-8,y))+'px';menu.querySelector('button').focus({preventScroll:true});
  }
  document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target)&&!e.target.closest('.m-object-cascade'))menu.hidden=true;},true);
  overlayRoot.addEventListener('pointerdown',e=>{
    if(e.button!==0||api.busy()||!e.target.matches('.m-stage-viewport,.stage-area,.canvas-wrap,.stage-hint'))return;
    selected.clear();lands.clear();api.select(null);toolbar(true);
  });
  document.addEventListener('keydown',e=>{
    if(!document.body.classList.contains('mode-map')||document.querySelector('dialog[open]'))return;
    if(e.key==='Escape'&&document.querySelector('body > .m-object-cascade:not([hidden])'))return;
    const typing=['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)||document.activeElement?.isContentEditable;
    if((e.ctrlKey||e.metaKey)&&!typing&&!api.busy()){
      if(!e.altKey&&!e.repeat&&['c','v'].includes(e.key.toLowerCase())){e.preventDefault();e.stopImmediatePropagation();if(e.key.toLowerCase()==='c')api.copy?.();else api.paste?.();return;}
      if(e.key.toLowerCase()==='d'){e.preventDefault();e.stopImmediatePropagation();api.layerAction(selected.size?[...selected]:api.current()?[api.current().id]:[],'duplicate');return;}
      if(e.key.toLowerCase()==='g'){
        e.preventDefault();e.stopImmediatePropagation();
        if(e.shiftKey&&api.current()?.type==='group')document.querySelector('#mInspector [data-group-ungroup]')?.click();
        else if(canGroup())groupSelected();
        return;
      }
    }
    const sub=menu.querySelector('[data-direct-submenu-panel]:not([hidden])');
    if(!menu.hidden&&typing&&e.key!=='Escape')return;
    if(!menu.hidden&&e.key==='ArrowRight'&&document.activeElement?.matches('[data-direct-submenu]')){const trigger=document.activeElement;trigger.click();trigger.parentElement.querySelector('[data-direct-submenu-panel] button:not(:disabled)')?.focus();e.preventDefault();e.stopPropagation();return;}
    if(!menu.hidden&&sub&&['ArrowLeft','Escape'].includes(e.key)){sub.hidden=true;const trigger=sub.parentElement.querySelector('[data-direct-submenu]');trigger.setAttribute('aria-expanded','false');trigger.focus();e.preventDefault();e.stopPropagation();return;}
    if(!menu.hidden&&['ArrowDown','ArrowUp','Home','End'].includes(e.key)){
      const scope=document.activeElement?.closest('[data-direct-submenu-panel]')||menu;
      const buttons=[...scope.querySelectorAll(scope===menu?':scope > button:not(:disabled),:scope > .m-map-submenu > button:not(:disabled)':':scope > button:not(:disabled)')],at=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(at+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;
      buttons[next]?.focus();e.preventDefault();e.stopPropagation();return;
    }
    if(e.key==='Escape'&&!menu.hidden){menu.hidden=true;canvas.focus({preventScroll:true});e.preventDefault();e.stopPropagation();return;}
    if(e.key==='Escape'&&!api.busy()&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)){
      selected.clear();lands.clear();api.select(null);toolbar(true);api.draw();e.preventDefault();
    }
  },true);
  const item=id=>api.project().actions.find(a=>a.id===id);
  const coord=e=>{const b=canvas.getBoundingClientRect(),v=api.view();return{x:(e.clientX-b.left)/b.width*v.W,y:(e.clientY-b.top)/b.height*v.H};};
  const ground=(v,p)=>screenToLonLat(v,p.x,p.y);
  const loc=a=>a.type==='group'?groupPoseAt(a,api.frame()):resolveLoc(api.geo(),(a.type==='shape'||a.mode==='path')&&a.path?.length?{kind:'point',name:'Start',...pathAt(a,api.frame())[0]}:a.type==='plane'?a.from:a.place);
  function anchor(a,v){
    if((a.type==='label'||a.type==='pin'&&a.showIcon===false)&&a.labelPlacement==='screen')return{x:v.W*(a.x??50)/100,y:v.H*(a.y??15)/100,z:v.near+1};
    const p=loc(a);if(!p)return null;
    const X=a.type==='group'?lonToX(p.lon):p.X,Y=a.type==='group'?latToY(p.lat):p.Y;
    return project(v,X+Math.round(v.cx-X),Y);
  }
  function heading(a,v){
    if(isIsometricView(objectPoseAt(a,api.frame()))||!OBJECT_ICONS[a.glyph]?.rot||!['move','path'].includes(a.mode))return 0;
    const rendered=v.objects?.get(a.id)||a,A=objectLocationAt(v,api.geo(),rendered,Math.max(a.start,api.frame()-1)),B=objectLocationAt(v,api.geo(),rendered,Math.min(a.start+a.dur,api.frame()+1));
    if(!A||!B)return 0;const first=project(v,A.X,A.Y),last=project(v,B.X,B.Y);
    return Math.atan2(last.y-first.y,last.x-first.x)*180/Math.PI;
  }
  function handle(a,v){
    const p=anchor(a,v);if(!p||p.z<=v.near)return null;
    const angle=(a.type==='group'?groupPoseAt(a,api.frame()).rotation:(objectPoseAt(a,api.frame()).objectAngle+heading(a,v)))*Math.PI/180;
    let dx=Math.cos(angle),dy=Math.sin(angle);
    if(a.type==='group'){
      const pose=groupPoseAt(a,api.frame()),X=lonToX(pose.lon),Y=latToY(pose.lat),q=project(v,X+Math.round(v.cx-X)+dx*.001,Y+dy*.001);
      const n=Math.hypot(q.x-p.x,q.y-p.y)||1;dx=(q.x-p.x)/n;dy=(q.y-p.y)/n;
    }
    return{...p,hx:p.x+dx*72*v.unit,hy:p.y+dy*72*v.unit};
  }
  function sizeHandle(a,v){
    const p=anchor(a,v);if(!p||p.z<=v.near)return null;
    const size=(a.type==='label'||a.type==='pin'&&a.showIcon===false&&!a.badge)?(a.labelStyle?.size||api.project().labelStyle.size||16)/24:a.type==='group'?groupPoseAt(a,api.frame()).scale:a.type==='object'?objectSizeAt(a,api.frame(),v.cam.zoom):a.type==='pin'?pinSizeAt(a,v.cam.zoom):a.size||1;
    const radius=Math.max(48,52*size)*v.unit,offset=radius/Math.SQRT2;
    return{...p,sx:p.x-offset,sy:p.y+offset,radius};
  }
  function hit(v,p){
    const visible=a=>a&&a.visible!==false&&api.frame()>=a.start&&api.frame()<a.start+a.dur;
    for(const a of mapStackOrder(api.project().actions).reverse()){
      if(!visible(a)||!spatial(a)||a.type==='group')continue;
      if(a.type==='object'){
      const rendered=v.objects?.get(a.id);if(!rendered)continue;
      const spot=objectLocationAt(v,api.geo(),rendered,api.frame());if(!spot)continue;
      const q=project(v,spot.X,spot.Y);if(q.z<=v.near)continue;
      const size=objectSizeAt(a,api.frame(),v.cam.zoom)*(rendered._groupScale??1),s=26*size*v.unit;
      for(const off of objectOffsets(rendered.glyph==='army'?{...rendered,count:armyCopies(rendered).length}:rendered)){
        const x=q.x+off.x*size*v.unit,y=q.y+off.y*size*v.unit;
        const tall=['portrait','banner','flag'].includes(a.glyph),width=tall?Math.max(1.9,a.glyph==='banner'?1.4*(a.bannerAspect??.75)+.3:a.glyph==='flag'?.825*(a.bannerAspect??1.5)+.3:1.9):1.25;
        if(Math.abs(p.x-x)<Math.max(16*v.unit,s*width)&&p.y>y-s*(tall?5.85:2.8)&&p.y<y+s*.8){
          return api.project().actions.find(g=>g.type==='group'&&g.memberIds.includes(a.id))||a;
        }
      }
        continue;
      }
      if(a.type==='shape'){
        const points=pathAt(a,api.frame()).map(q=>{const X=lonToX(q.lon);return project(v,X+Math.round(v.cx-X),latToY(q.lat));});
        if(['zone','noFly','area'].includes(a.shape)&&points.length>2){
          let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const A=points[i],B=points[j];if((A.y>p.y)!==(B.y>p.y)&&p.x<(B.x-A.x)*(p.y-A.y)/(B.y-A.y)+A.x)inside=!inside;}if(inside)return a;
        }
        for(let i=1;i<points.length;i++){
          const A=points[i-1],B=points[i];if(A.z<=v.near||B.z<=v.near)continue;
          const dx=B.x-A.x,dy=B.y-A.y,t=Math.max(0,Math.min(1,((p.x-A.x)*dx+(p.y-A.y)*dy)/(dx*dx+dy*dy||1)));
          if(Math.hypot(p.x-A.x-t*dx,p.y-A.y-t*dy)<Math.max(10,['road','railway'].includes(a.shape)?networkHalfWidth(a):a.width||6)*v.unit)return a;
        }
        continue;
      }
      if(a.type==='label'||a.type==='pin'&&a.showIcon===false&&!a.badge)continue;
      const spot=objectLocationAt(v,api.geo(),a.type==='plane'?{...a,place:a.from,mode:a.mode==='path'?'path':'move'}:a,api.frame());if(!spot)continue;
      const q=project(v,spot.X,spot.Y,a.type==='plane'?(a.lift||0)*v.unit*Math.sin(Math.PI*spot.p):0),radius=(a.type==='effect'?35:24)*(a.type==='plane'?(a.size||20)/20:a.type==='pin'?pinSizeAt(a,v.cam.zoom):a.size||1)*v.unit;
      const pinWidth=a.type==='pin'?(a.badge?2:a.pinStyle==='flag'?1.4:1):1;
      if(q.z>v.near&&Math.abs(p.x-q.x)<radius*pinWidth&&p.y>q.y-radius*(a.type==='pin'?(a.badge?5:2.2):1.4)&&p.y<q.y+radius*(a.badge?2:1))return a;
    }

    for(const label of [...(v.labels||[])].reverse()){
      const a=item(label.item?.id);if(!visible(a)||!spatial(a)||label.alpha<=0)continue;
      const style={...api.project().labelStyle,...a.labelStyle},height=(style.size||16)*v.unit*(label.scale||1),width=Math.max(20*v.unit,String(label.text).length*height*.55);
      if(Math.abs(p.x-label.x)<width/2+6*v.unit&&Math.abs(p.y-label.y)<height)return api.project().actions.find(g=>g.type==='group'&&g.memberIds.includes(a.id))||a;
    }
    return null;
  }
  function canGroup(){
    return selected.size>1&&[...selected].every(id=>item(id)?.type==='object'&&!api.project().actions.some(g=>g.type==='group'&&g.memberIds.includes(id)));
  }
  function groupSelected(){
    if(!canGroup())return;
    try{
      const snapshot=structuredClone(api.project());
      const group=makeObjectGroup(snapshot,[...selected],a=>{const p=resolveLoc(api.geo(),a.place);return p&&{lon:xToLon(p.X),lat:yToLat(p.Y)};},crypto.randomUUID());
      api.pause();api.checkpoint();group.createdOrder=api.creationOrder();api.project().actions=snapshot.actions;
      menu.hidden=true;selected.clear();selected.add(group.id);api.select(group.id);api.changed();toolbar(true);
    }catch(error){api.notify?.(error.message);}
  }
  function applySelection(field,value){
    const roots=[...selected].map(item).filter(Boolean),objects=new Set();
    for(const root of roots){
      if(root.type==='group'){
        if(field==='color')root.color=value;
        for(const id of root.memberIds)objects.add(item(id));
      }else objects.add(root);
    }
    for(const object of objects){
      if(!object)continue;
      if(field==='glyph'){
        const old=OBJECT_ICONS[object.glyph],next=OBJECT_ICONS[value];if(!next)continue;
        if(object.color===old?.color)object.color=next.color;
        if(!object.name||object.name==='Object'||object.name===old?.label)object.name=next.label;
        if(object.objectAnimation&&!objectAnimationOptions(value).some(([key])=>key===object.objectAnimation))object.objectAnimation='auto';
      }
      const common=['color','label','showLabel','size','opacity'];
      const byType={pin:['__pinDisplay','labelPlacement','pinStyle','sizeMode'],label:['text','labelPlacement'],effect:['fx','repeat'],shape:['shape','width'],plane:['icon','planeColor'],object:['glyph','sizeMode']};
      if(!common.includes(field)&&!byType[object.type]?.includes(field))continue;
      if(field==='color'&&object.type==='label'){object.labelStyle={...api.project().labelStyle,...object.labelStyle,text:value};continue;}
      if(field==='__pinDisplay'){
        object.badge=false;object.showIcon=value!=='text';object.showLabel=value!=='icon';
        if(value==='text'){object.labelPlacement||='map';object.offsetX??=0;object.offsetY??=0;}
        continue;
      }
      if(field==='shape'){
        const old=SHAPES[object.shape],next=SHAPES[value];if(!next)continue;
        if(object.color===old?.color)object.color=next.color;
        if(['distance','area'].includes(value)){if(object.pathKeys?.length)object.path=pathAt(object,api.frame());delete object.pathKeys;object.curve='straight';if(value==='distance'&&object.path?.length>2)object.path=[object.path[0],object.path.at(-1)];}
      }
      if(field==='fx'||field==='icon'){
        const catalog=field==='fx'?EFFECTS:TRAVEL_ICONS,next=catalog[value],old=catalog[object[field]];if(!next)continue;
        if(object.color===old?.color)object.color=next.color;if(object.name===old?.label)object.name=next.label;
      }
      object[field]=value;
      if(field==='glyph'&&object.mode==='wallPath'&&!['stoneWall','palisade','earthwork','gatehouse','stoneFort','watchtower','bastion'].includes(value))object.mode='stay';
      if(field==='sizeMode'&&value==='map')object.sizeZoom=api.view()?.cam.zoom??api.project().camera.init.zoom;
    }
  }
  function objectControls(a){
    const inspector=document.querySelector('#mInspector'),group=a.type==='group';
    const homogeneous=[...selected].every(id=>item(id)?.type===a.type);
    const keys=group?['__groupColor']:['color'];
    const form=document.createElement('div');form.className='m-map-object-controls'+(group?' m-map-group-controls':!homogeneous?' m-map-layer-controls':'');
    const sources=group||!homogeneous?[]:[inspector.querySelector('[data-object-type]')?.closest('label'),inspector.querySelector('.m-object-picker')];
    for(const key of keys){const el=inspector.querySelector(`[data-mf="${key}"]`);if(!el)continue;if(el.type==='color'){const label=document.createElement('label');label.append('Color',el.cloneNode(true));sources.push(label);}else sources.push(el.closest('.m-loc')||el.closest('label'));}
    for(const source of sources.filter(Boolean))form.append(source.cloneNode(true));
    for(const el of form.querySelectorAll('[data-mf]')){el.dataset.directField=el.dataset.mf;delete el.dataset.mf;}
    for(const el of form.querySelectorAll('[data-object-choice]')){el.dataset.directObjectChoice=el.dataset.objectChoice;delete el.dataset.objectChoice;}
    for(const el of form.querySelectorAll('[data-mpick]')){el.dataset.directPick=el.dataset.mpick;delete el.dataset.mpick;}
    for(const el of form.querySelectorAll('[data-object-type]')){el.dataset.directType='';delete el.dataset.objectType;}
    for(const el of form.querySelectorAll('[data-object-menu]')){el.dataset.directObjectMenu='';delete el.dataset.objectMenu;}
    form.querySelector('[data-direct-type]')?.addEventListener('change',e=>{
      const source=document.querySelector('#mInspector [data-object-type]');if(source){source.value=e.target.value;source.dispatchEvent(new Event('change',{bubbles:true}));toolbar(true);}
    });
    let editing=false;
    const apply=(field,value,commit)=>{
      api.pause();if(!editing){api.checkpoint();editing=true;}
      applySelection(field.replace('__groupColor','color').replace('__groupSizeMode','sizeMode'),value);
      if(commit){editing=false;api.changed();api.renderInspector();toolbar(true);}else api.draw();
    };
    for(const el of form.querySelectorAll('[data-direct-field]')){
      el.oninput=()=>{if(el.type==='color')apply(el.dataset.directField,el.value,false);};
      el.onchange=()=>apply(el.dataset.directField,el.value,true);
    }
    for(const button of form.querySelectorAll('[data-direct-object-choice]'))button.onclick=()=>apply('glyph',button.dataset.directObjectChoice,true);
    for(const button of form.querySelectorAll('[data-direct-pick]'))button.onclick=()=>document.querySelector(`#mInspector [data-mpick="${button.dataset.directPick}"]`)?.click();
    const menu=form.querySelector('[data-direct-object-menu]');if(menu)bindObjectCascade(menu);
    form.querySelectorAll('.ff-palette').forEach(palette=>palette.remove());
    bar.append(form);paintObjectPreviews(form);
  }
  function layerControls(a){
    const fields={pin:['color','pinStyle','sizeMode'],label:['text'],effect:['color'],shape:['color'],plane:['color'],scene:['title']}[a.type]||[];
    const form=document.createElement('div');form.className='m-map-object-controls m-map-layer-controls';
    for(const field of fields){
      if(selected.size>1&&field!=='color'&&![...selected].every(id=>item(id)?.type===a.type))continue;
      const source=document.querySelector(`#mInspector [data-mf="${field}"]`);if(!source)continue;
      const label=source.closest('label').cloneNode(true),input=label.querySelector('[data-mf]');label.hidden=false;input.value=source.value;label.querySelectorAll('.ff-palette').forEach(palette=>palette.remove());input.dataset.directField=field;delete input.dataset.mf;
      input.removeAttribute('id');
      if(input.type==='range'){input.type='number';label.querySelector('.m-val')?.remove();}
      let editing=false;
      const send=commit=>{
        api.pause();if(!editing){api.checkpoint();editing=true;}
        const value=input.type==='checkbox'?input.checked:input.type==='number'?input.valueAsNumber:input.value;
        if(input.type==='number'&&(!Number.isFinite(value)||value<Number(input.min)||input.max&&value>Number(input.max)))return;
        applySelection(field,value);
        if(commit){editing=false;api.changed();api.renderInspector();toolbar(true);}else api.draw();
      };
      if(input.type==='color')input.oninput=()=>send(false);input.onchange=()=>send(true);
      form.append(label);
    }
    if(a.type==='label'){
      const label=document.createElement('label');label.textContent='Text color';const input=document.createElement('input');input.type='color';input.value=a.labelStyle?.text||api.project().labelStyle.text;input.dataset.directField='color';
      input.onchange=()=>{api.pause();api.checkpoint();applySelection('color',input.value);api.changed();api.renderInspector();toolbar(true);};label.append(input);form.append(label);
    }
    bar.append(form);
  }
  function regionLayer(){const a=api.current();return ['highlight','border'].includes(a?.type)&&['country','region','regions','polygon'].includes(a.target?.kind)?a:null;}
  function landTarget(){const members=[...lands.values()];return members.length===1?members[0]:{kind:'regions',name:`${members.length} regions`,members};}
  function applyLand(type){
    const existing=!lands.size&&regionLayer(),target=lands.size?landTarget():existing?.target;if(!target)return;
    const settings={...landStyle,...(existing?.type==='highlight'?{color:existing.color,showFill:existing.showFill!==false,showLabel:existing.showLabel,label:existing.label}:{}),regionLabels:true};
    if(type==='label'){settings.showFill=false;settings.showLabel=true;settings.labelStyle={...api.project().labelStyle,...existing?.labelStyle,text:settings.color};if(!existing)settings.name='Region label';}
    if(type==='highlight')settings.showFill=true;
    settings.reliefColor=settings.color;
    lands.clear();
    if(existing?.type==='highlight'&&type!=='border'){
      api.pause();api.checkpoint();Object.assign(existing,settings);api.changed();api.renderInspector();
    }else api.add(type==='border'?'border':'highlight',{target,...(type==='border'?{color:settings.color}:settings)});
    toolbar(true);api.draw();
  }
  function landControls(layer){
    const state=layer||landStyle,fill=layer?.type!=='border',count=lands.size||(layer?.target.kind==='regions'?layer.target.members.length:1);
    const controls=document.createElement('div');controls.className='m-map-land-controls';
    const status=document.createElement('span');status.textContent=`${count} ${count===1?'region':'regions'}`;controls.append(status);
    const field=(key,title,type,value)=>{
      const label=document.createElement('label');label.append(title);const input=document.createElement('input');input.type=type;input.dataset.directLand=key;
      if(type==='checkbox')input.checked=value;else input.value=value;
      if(type==='number'){input.min='.5';input.max='12';input.step='.5';}
      if(type==='text'){input.placeholder='Region names';input.maxLength=60;}
      let editing=false;
      const apply=commit=>{api.pause();if(layer&&!editing){api.checkpoint();editing=true;}state[key]=type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value;
        if(layer){if(key==='color'&&layer.type==='highlight'){layer.reliefColor=input.value;if(layer.showFill===false)layer.labelStyle={...api.project().labelStyle,...layer.labelStyle,text:input.value};}if(commit){editing=false;api.changed();api.renderInspector();}else api.draw();}
      };
      if(type==='color')input.oninput=()=>apply(false);input.onchange=()=>apply(true);
      label.append(input);controls.append(label);
    };
    field('color','Color','color',layer?.showFill===false?(layer.labelStyle?.text||state.color):(layer?.reliefColor||state.color));
    if(fill)field('showFill','Fill','checkbox',state.showFill!==false);
    if(fill){field('showLabel','Label','checkbox',state.showLabel!==false);field('label','Text','text',state.label||'');}
    else{field('width','Width','number',state.width??3.5);field('glow','Glow','checkbox',!!state.glow);}
    bar.append(controls);
  }
  function toolbar(force=false){
    for(const id of selected)if(!item(id))selected.delete(id);
    const current=api.current(),land=regionLayer(),object=!lands.size&&spatial(current);
    if(object&&!selected.has(current.id)){selected.clear();selected.add(current.id);}else if(!object&&!lands.size)selected.clear();
    const selectionKey=JSON.stringify([current?.id,[...lands.keys()],[...selected]]);
    if(force||selectionKey!==toolbarSelectionKey){
      menu.hidden=true;bar.hidden=true;bar.replaceChildren();
    }
    toolbarSelectionKey=selectionKey;
  }
  function begin(e,a,kind,p){
    api.pause();const v=api.view(),point=ground(v,p);if(!point)return;
    const ids=(selected.has(a.id)?[...selected]:[a.id]).filter(id=>kind==='rotate'?rotatable(item(id)):kind==='size'?scalable(item(id)):true);
    drag={pointer:e.pointerId,kind,point,screen:p,view:v,ids,snapshots:new Map(ids.map(id=>[id,structuredClone(item(id))])),activeId:a.id,sizeOrigin:anchor(a,v),sizeRadius:kind==='size'?sizeHandle(a,v)?.radius:0,changed:false};
    canvas.style.cursor=kind==='rotate'?'crosshair':kind==='size'?'nesw-resize':'grabbing';canvas.setPointerCapture(e.pointerId);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.button===2&&api.view())rightGesture={x:e.clientX,y:e.clientY,point:ground(api.view(),coord(e)),moved:false};
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(rightGesture&&Math.hypot(e.clientX-rightGesture.x,e.clientY-rightGesture.y)>4){rightGesture.moved=true;menu.hidden=true;}
  },true);
  canvas.addEventListener('pointerup',e=>{
    if(e.button!==2||!rightGesture)return;const gesture=rightGesture;rightGesture=null;suppressContextUntil=performance.now()+400;
    if(gesture.moved)return;
    showAddMenu(gesture.x,gesture.y,gesture.point);
  },true);
  canvas.addEventListener('pointercancel',()=>{rightGesture=null;menu.hidden=true;},true);
  canvas.addEventListener('contextmenu',e=>{
    e.preventDefault();e.stopPropagation();if(performance.now()<suppressContextUntil)return;
    if(!rightGesture&&api.view())showAddMenu(e.clientX,e.clientY,ground(api.view(),coord(e)));
  },true);
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||api.busy()||!api.view()||!api.geo())return;
    const v=api.view(),p=coord(e),a=api.current(),h=rotatable(a)&&handle(a,v);
    const resize=scalable(a)&&sizeHandle(a,v);
    if(resize&&Math.hypot(p.x-resize.sx,p.y-resize.sy)<12*v.unit&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();begin(e,a,'size',p);return;}
    if(h&&Math.hypot(p.x-h.hx,p.y-h.hy)<12*v.unit&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();begin(e,a,'rotate',p);return;}
    const found=hit(v,p);
    if(found){
      e.preventDefault();e.stopImmediatePropagation();lands.clear();
      if(e.shiftKey){if(!selected.size&&spatial(a))selected.add(a.id);if(selected.has(found.id))selected.delete(found.id);else selected.add(found.id);}
      else if(!selected.has(found.id)){selected.clear();selected.add(found.id);}
      api.select(e.shiftKey&&!selected.has(found.id)?[...selected].at(-1)||null:found.id);toolbar(true);api.draw();if(!e.shiftKey)begin(e,found,'move',p);return;
    }
    const point=ground(v,p);if(!point)return;
    const modern=!v.mapBackground||v.mapBackground==='modern',political=modern||v.mapBackground==='historical1300',region=modern&&regionAt(api.project(),api.geo(),point.lon,point.lat),name=political&&(region||countryAt(api.geo(),point.lon,point.lat));
    if(!name){lands.clear();selected.clear();api.select(null);toolbar(true);api.draw();return;}
    e.preventDefault();e.stopImmediatePropagation();api.pause();selected.clear();api.select(null);
    const target=region?{kind:'region',name,country:api.geo().byName.get(name)?.country}:{kind:'country',name};
    if(!e.shiftKey)lands.clear();if(lands.has(key(target)))lands.delete(key(target));else lands.set(key(target),target);
    toolbar(true);api.draw();
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!drag){
      if(api.busy()||!api.view())return;
      const v=api.view(),p=coord(e),a=api.current(),h=rotatable(a)&&handle(a,v);
      const resize=scalable(a)&&sizeHandle(a,v);
      canvas.style.cursor=resize&&Math.hypot(p.x-resize.sx,p.y-resize.sy)<12*v.unit?'nesw-resize':h&&Math.hypot(p.x-h.hx,p.y-h.hy)<12*v.unit?'crosshair':hit(v,p)?'grab':'';return;
    }
    if(e.pointerId!==drag.pointer)return;e.preventDefault();e.stopImmediatePropagation();
    const p=coord(e);if(!drag.changed&&Math.hypot(p.x-drag.screen.x,p.y-drag.screen.y)<3*drag.view.unit)return;
    const point=ground(drag.view,p)||(drag.ids.every(id=>{const a=item(id);return (a.type==='label'||a.type==='pin'&&a.showIcon===false)&&a.labelPlacement==='screen';})?drag.point:null);if(!point&&drag.kind!=='size')return;
    if(!drag.changed){api.checkpoint();drag.changed=true;}
    for(const id of drag.ids){
      const a=item(id),original=drag.snapshots.get(id);if(!a||!original)continue;
      if(drag.kind==='size'){
        const ratio=Math.hypot(p.x-drag.sizeOrigin.x,p.y-drag.sizeOrigin.y)/(drag.sizeRadius||1);
        if(a.type==='group'){
          const scale=Math.max(.1,Math.min(8,groupPoseAt(original,api.frame()).scale*ratio));
          if(a.groupKeys?.some(k=>k.values.scale!==undefined))putGroupKey(a,api.frame(),{scale});else a.transform={...a.transform,scale};
        }else if(a.type==='object'){
          const size=Math.max(.2,Math.min(8,objectPoseAt(original,api.frame()).size*ratio));
          if(a.autoObjectKey||a.objectKeys?.some(k=>k.values.size!==undefined))putObjectKey(a,api.frame(),{size});else a.size=size;
        }else if(a.type==='label'||a.type==='pin'&&a.showIcon===false){const style={...api.project().labelStyle,...original.labelStyle};a.labelStyle={...style,size:Math.max(6,Math.min(240,(style.size||16)*ratio))};
        }else{const [lo,hi]=a.type==='pin'?[.5,3]:[.4,6];a.size=Math.max(lo,Math.min(hi,(original.size||1)*ratio));}
      }else if(drag.kind==='rotate'){
        const active=drag.snapshots.get(drag.activeId),origin=anchor(active,drag.view);if(!origin)continue;
        let angle=Math.atan2(p.y-origin.y,p.x-origin.x)*180/Math.PI;
        if(a.type==='group'){
          const pose=groupPoseAt(original,api.frame());let dx=lonToX(point.lon)-lonToX(pose.lon);dx-=Math.round(dx);
          angle=Math.atan2(latToY(point.lat)-latToY(pose.lat),dx)*180/Math.PI;
          if(a.groupKeys?.length)putGroupKey(a,api.frame(),{rotation:angle});else a.transform={...a.transform,rotation:angle};
        }else{const activeAngle=objectPoseAt(active,api.frame()).objectAngle+heading(active,drag.view);angle=objectPoseAt(original,api.frame()).objectAngle+angle-activeAngle;if(a.autoObjectKey||a.objectKeys?.some(k=>k.values.objectAngle!==undefined))putObjectKey(a,api.frame(),{objectAngle:angle});else a.objectAngle=angle;}
      }else{
        const delta=wrap(point.lon-drag.point.lon),dy=latToY(point.lat)-latToY(drag.point.lat);
        if(a.type==='group'){
          const pose=groupPoseAt(original,api.frame()),values={lon:wrap(pose.lon+delta),lat:Math.max(-85,Math.min(85,yToLat(latToY(pose.lat)+dy)))};
          if(a.groupKeys?.length)putGroupKey(a,api.frame(),values);else a.transform={...a.transform,...values};
        }else if((a.type==='label'||a.type==='pin'&&a.showIcon===false)&&a.labelPlacement==='screen'){
          a.x=Math.max(0,Math.min(100,(original.x??50)+(p.x-drag.screen.x)/drag.view.W*100));
          a.y=Math.max(0,Math.min(100,(original.y??15)+(p.y-drag.screen.y)/drag.view.H*100));
        }else if(a.type==='shape'){
          const shift=point=>({...point,lon:wrap(point.lon+delta),lat:Math.max(-85,Math.min(85,yToLat(latToY(point.lat)+dy)))});
          a.path=original.path.map(shift);if(original.pathKeys)a.pathKeys=original.pathKeys.map(key=>({...key,path:key.path.map(shift)}));
        }else{
          const start=loc(original);if(!start)continue;
          const place={kind:'point',name:'Map position',lon:wrap(xToLon(start.X)+delta),lat:Math.max(-85,Math.min(85,yToLat(start.Y+dy)))};
          if(a.type==='plane')a.from=place;else a.place=place;if(original.mode==='path'&&original.path?.length){a.path=structuredClone(original.path);a.path[0]={lon:place.lon,lat:place.lat};a.from=place;}
        }
      }
    }
    api.draw();
  },true);
  const finish=e=>{
    if(!drag||drag.pointer!==e.pointerId)return;e.stopImmediatePropagation();
    const changed=drag.changed;drag=null;canvas.style.cursor='';if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
    if(changed){api.changed();api.renderInspector();}api.draw();
  };
  canvas.addEventListener('pointerup',finish,true);canvas.addEventListener('pointercancel',finish,true);
  function overlay(c,v){
    toolbar();
    for(const row of document.querySelectorAll('[data-mid],[data-mtl],[data-mrow],[data-mclip]'))row.classList.toggle('multi-selected',selected.has(row.dataset.mid||row.dataset.mtl||row.dataset.mrow||row.dataset.mclip)&&selected.size>1);
    if(api.busy())return;
    for(const id of selected)if(!item(id))selected.delete(id);
    if(lands.size)drawRegionSelection(c,v,api.geo(),[...lands.values()]);
    const a=api.current();if(!spatial(a)||a.visible===false||api.frame()<a.start||api.frame()>=a.start+a.dur)return;
    const ids=new Set([...selected,a.id]);c.save();c.strokeStyle='#ffe28a';c.fillStyle='#172126';c.lineWidth=2*v.unit;
    for(const id of ids){const it=item(id),p=it&&anchor(it,v);if(p&&p.z>v.near){c.beginPath();c.arc(p.x,p.y,8*v.unit,0,Math.PI*2);c.fill();c.stroke();}}
    const h=rotatable(a)&&handle(a,v);if(h){c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.hx,h.hy);c.stroke();c.beginPath();c.arc(h.hx,h.hy,7*v.unit,0,Math.PI*2);c.fillStyle='#ffe28a';c.fill();c.stroke();}
    const resize=scalable(a)&&sizeHandle(a,v);
    if(resize){
      c.strokeStyle='#77dce5';c.fillStyle='#172126';c.setLineDash([4*v.unit,4*v.unit]);c.beginPath();c.moveTo(resize.x,resize.y);c.lineTo(resize.sx,resize.sy);c.stroke();c.setLineDash([]);
      c.save();c.translate(resize.sx,resize.sy);c.rotate(Math.PI/4);c.fillRect(-6*v.unit,-6*v.unit,12*v.unit,12*v.unit);c.strokeRect(-6*v.unit,-6*v.unit,12*v.unit,12*v.unit);c.restore();
      c.fillStyle='#b9f3f5';c.font=`${11*v.unit}px sans-serif`;c.textAlign='right';c.fillText('Size',resize.sx-11*v.unit,resize.sy+4*v.unit);
    }
    c.restore();
  }
  const inspector=document.querySelector('#mInspector');
  if(inspector)new MutationObserver(()=>toolbar()).observe(inspector,{childList:true,subtree:true});
  function setSelection(ids){selected.clear();for(const id of ids)if(spatial(item(id)))selected.add(id);lands.clear();}
  function toggleSelection(id){
    if(!spatial(item(id)))return false;const current=api.current();if(!selected.size&&spatial(current))selected.add(current.id);
    if(selected.has(id))selected.delete(id);else selected.add(id);lands.clear();api.select(selected.has(id)?id:[...selected].at(-1)||null);return true;
  }
  return{overlay,setSelection,toggleSelection,selectionIds:()=>selected.size?[...selected]:api.current()?[api.current().id]:[]};
}
