import { objectLocationAt, project, screenToLonLat, lonToX, latToY, xToLon, yToLat, countryAt, regionAt, resolveLoc, drawRegionSelection, OBJECT_ICONS } from './map-engine.mjs';
import { objectSizeAt, objectPoseAt, putObjectKey } from './map-object-keys.mjs';
import { groupPoseAt, putGroupKey, makeObjectGroup } from './map-object-groups.mjs';
import { armyCopies } from './map-armies.mjs';
import { objectOffsets } from './map-formations.mjs';

const wrap=lon=>((lon+180)%360+360)%360-180;
const key=t=>`${t.kind}:${t.country||''}:${t.name}`;
export function installDirectMapEditing(api){
  const {canvas}=api,selected=new Set(),lands=new Map();let drag=null;
  const bar=document.createElement('div');bar.id='mMapContext';bar.className='m-map-context';bar.hidden=true;
  canvas.closest('.stage-area').append(bar);
  const item=id=>api.project().actions.find(a=>a.id===id);
  const coord=e=>{const b=canvas.getBoundingClientRect(),v=api.view();return{x:(e.clientX-b.left)/b.width*v.W,y:(e.clientY-b.top)/b.height*v.H};};
  const ground=(v,p)=>screenToLonLat(v,p.x,p.y);
  const loc=a=>a.type==='group'?groupPoseAt(a,api.frame()):resolveLoc(api.geo(),a.mode==='path'&&a.path?.length?{kind:'point',name:'Start',...a.path[0]}:a.place);
  function anchor(a,v){
    const p=loc(a);if(!p)return null;
    const X=a.type==='group'?lonToX(p.lon):p.X,Y=a.type==='group'?latToY(p.lat):p.Y;
    return project(v,X+Math.round(v.cx-X),Y);
  }
  function heading(a,v){
    if(!OBJECT_ICONS[a.glyph]?.rot||!['move','path'].includes(a.mode))return 0;
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
  function hit(v,p){
    for(const rendered of [...(v.objects?.values()||[])].reverse()){
      const a=item(rendered.id);if(!a||a.visible===false||api.frame()<a.start||api.frame()>=a.start+a.dur)continue;
      const spot=objectLocationAt(v,api.geo(),rendered,api.frame());if(!spot)continue;
      const q=project(v,spot.X,spot.Y);if(q.z<=v.near)continue;
      const size=objectSizeAt(a,api.frame(),v.cam.zoom)*(rendered._groupScale??1),s=26*size*v.unit;
      for(const off of objectOffsets(rendered.glyph==='army'?{...rendered,count:armyCopies(rendered).length}:rendered)){
        const x=q.x+off.x*size*v.unit,y=q.y+off.y*size*v.unit;
        if(Math.abs(p.x-x)<Math.max(16*v.unit,s*1.25)&&p.y>y-s*2.8&&p.y<y+s*.8){
          return api.project().actions.find(g=>g.type==='group'&&g.memberIds.includes(a.id))||a;
        }
      }
    }
    return null;
  }
  function toolbar(){
    for(const id of selected)if(!item(id))selected.delete(id);
    bar.hidden=!lands.size&&selected.size<2;
    if(lands.size){
      bar.innerHTML=`<span>${lands.size} ${lands.size===1?'region':'regions'} selected</span><button data-direct-highlight>Highlight</button><button data-direct-border>Border</button><button data-direct-clear>Clear</button>`;
      for(const type of ['highlight','border'])bar.querySelector(`[data-direct-${type}]`).onclick=()=>{
        const members=[...lands.values()],target=members.length===1?members[0]:{kind:'regions',name:`${members.length} regions`,members};
        api.add(type,{target});lands.clear();toolbar();api.draw();
      };
    }else if(selected.size>1){
      const canGroup=[...selected].every(id=>item(id)?.type==='object'&&!api.project().actions.some(g=>g.type==='group'&&g.memberIds.includes(id)));
      bar.innerHTML=`<span>${selected.size} objects selected</span><button data-direct-group ${canGroup?'':'disabled'}>Group selected</button><button data-direct-clear>Clear</button>`;
      bar.querySelector('[data-direct-group]').onclick=()=>{
        api.pause();api.checkpoint();const group=makeObjectGroup(api.project(),[...selected],a=>{const p=resolveLoc(api.geo(),a.place);return p&&{lon:xToLon(p.X),lat:yToLat(p.Y)};},crypto.randomUUID());
        selected.clear();selected.add(group.id);api.select(group.id);api.changed();toolbar();
      };
    }
    bar.querySelector('[data-direct-clear]')?.addEventListener('click',()=>{selected.clear();lands.clear();toolbar();api.draw();});
  }
  function begin(e,a,kind,p){
    api.pause();const v=api.view(),point=ground(v,p);if(!point)return;
    const ids=kind==='rotate'?[a.id]:selected.has(a.id)?[...selected]:[a.id];
    drag={pointer:e.pointerId,kind,point,screen:p,view:v,ids,snapshots:new Map(ids.map(id=>[id,structuredClone(item(id))])),changed:false};
    canvas.style.cursor=kind==='rotate'?'crosshair':'grabbing';canvas.setPointerCapture(e.pointerId);
  }
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||api.busy()||!api.view()||!api.geo())return;
    const v=api.view(),p=coord(e),a=api.current(),h=['object','group'].includes(a?.type)&&handle(a,v);
    if(h&&Math.hypot(p.x-h.hx,p.y-h.hy)<12*v.unit&&!e.shiftKey){e.preventDefault();e.stopImmediatePropagation();begin(e,a,'rotate',p);return;}
    const found=hit(v,p);
    if(found){
      e.preventDefault();e.stopImmediatePropagation();lands.clear();
      if(e.shiftKey){if(!selected.size&&['object','group'].includes(a?.type))selected.add(a.id);if(selected.has(found.id))selected.delete(found.id);else selected.add(found.id);}
      else if(!selected.has(found.id)){selected.clear();selected.add(found.id);}
      api.select(e.shiftKey&&!selected.has(found.id)?[...selected].at(-1)||null:found.id);toolbar();api.draw();if(!e.shiftKey)begin(e,found,'move',p);return;
    }
    const point=ground(v,p);if(!point)return;
    const region=regionAt(api.project(),api.geo(),point.lon,point.lat),name=region||countryAt(api.geo(),point.lon,point.lat);
    if(!name){lands.clear();selected.clear();toolbar();api.draw();return;}
    e.preventDefault();e.stopImmediatePropagation();api.pause();selected.clear();api.select(null);
    const target=region?{kind:'region',name,country:api.geo().byName.get(name)?.country}:{kind:'country',name};
    if(!e.shiftKey)lands.clear();if(lands.has(key(target)))lands.delete(key(target));else lands.set(key(target),target);
    toolbar();api.draw();
  },true);
  canvas.addEventListener('pointermove',e=>{
    if(!drag){
      if(api.busy()||!api.view())return;
      const v=api.view(),p=coord(e),a=api.current(),h=['object','group'].includes(a?.type)&&handle(a,v);
      canvas.style.cursor=h&&Math.hypot(p.x-h.hx,p.y-h.hy)<12*v.unit?'crosshair':hit(v,p)?'grab':'';return;
    }
    if(e.pointerId!==drag.pointer)return;e.preventDefault();e.stopImmediatePropagation();
    const p=coord(e);if(!drag.changed&&Math.hypot(p.x-drag.screen.x,p.y-drag.screen.y)<3*drag.view.unit)return;
    const point=ground(drag.view,p);if(!point)return;
    if(!drag.changed){api.checkpoint();drag.changed=true;}
    for(const id of drag.ids){
      const a=item(id),original=drag.snapshots.get(id);if(!a||!original)continue;
      if(drag.kind==='rotate'){
        const origin=anchor(original,drag.view);if(!origin)continue;
        let angle=Math.atan2(p.y-origin.y,p.x-origin.x)*180/Math.PI;
        if(a.type==='group'){
          const pose=groupPoseAt(original,api.frame());let dx=lonToX(point.lon)-lonToX(pose.lon);dx-=Math.round(dx);
          angle=Math.atan2(latToY(point.lat)-latToY(pose.lat),dx)*180/Math.PI;
          if(a.groupKeys?.length)putGroupKey(a,api.frame(),{rotation:angle});else a.transform={...a.transform,rotation:angle};
        }else{angle-=heading(original,drag.view);if(a.autoObjectKey||a.objectKeys?.some(k=>k.values.objectAngle!==undefined))putObjectKey(a,api.frame(),{objectAngle:angle});else a.objectAngle=angle;}
      }else{
        const delta=wrap(point.lon-drag.point.lon),dy=latToY(point.lat)-latToY(drag.point.lat);
        if(a.type==='group'){
          const pose=groupPoseAt(original,api.frame()),values={lon:wrap(pose.lon+delta),lat:Math.max(-85,Math.min(85,yToLat(latToY(pose.lat)+dy)))};
          if(a.groupKeys?.length)putGroupKey(a,api.frame(),values);else a.transform={...a.transform,...values};
        }else{
          const start=loc(original);if(!start)continue;
          const place={kind:'point',name:'Map position',lon:wrap(xToLon(start.X)+delta),lat:Math.max(-85,Math.min(85,yToLat(start.Y+dy)))};
          a.place=place;if(original.mode==='path'&&original.path?.length){a.path=structuredClone(original.path);a.path[0]={lon:place.lon,lat:place.lat};a.from=place;}
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
    if(api.busy())return;
    for(const id of selected)if(!item(id))selected.delete(id);
    if(lands.size)drawRegionSelection(c,v,api.geo(),[...lands.values()]);
    const a=api.current();if(!['object','group'].includes(a?.type)||a.visible===false||api.frame()<a.start||api.frame()>=a.start+a.dur)return;
    const ids=new Set([...selected,a.id]);c.save();c.strokeStyle='#ffe28a';c.fillStyle='#172126';c.lineWidth=2*v.unit;
    for(const id of ids){const it=item(id),p=it&&anchor(it,v);if(p&&p.z>v.near){c.beginPath();c.arc(p.x,p.y,8*v.unit,0,Math.PI*2);c.fill();c.stroke();}}
    const h=handle(a,v);if(h){c.beginPath();c.moveTo(h.x,h.y);c.lineTo(h.hx,h.hy);c.stroke();c.beginPath();c.arc(h.hx,h.hy,7*v.unit,0,Math.PI*2);c.fillStyle='#ffe28a';c.fill();c.stroke();}
    c.restore();
  }
  return{overlay};
}
