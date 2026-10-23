import { ISOMETRIC_MODELS } from './map-isometric-objects.mjs';
import { animationKeysOf } from './map-timing.mjs';

const clamp=x=>Math.max(0,Math.min(1,x));
const trailLifetime=kind=>kind==='wake'?2.4:.8;
export function naturalTrailKind(glyph){
  const family=ISOMETRIC_MODELS[glyph]?.family;
  if(family==='ship')return 'wake';
  if(['vehicle','gun'].includes(family)||glyph==='bicycle')return 'tracks';
  return 'route';
}
export const movementTrailKind=a=>a.trailStyle==='route'?'route':naturalTrailKind(a.glyph);
export function validateObjectTrail(a){
  if(a.trailStyle!==undefined&&!['auto','route'].includes(a.trailStyle))throw Error('Invalid object trail style.');
  if(a.trail!==undefined&&typeof a.trail!=='boolean')throw Error('Invalid object trail setting.');
}

// Sample only traveled ground, with a fixed upper bound independent of route
// length or playback duration. Nothing accumulates between rendered frames.
export function movementTrailGeometry(H,v,route,a,frame,progress,wrap,size){
  const kind=movementTrailKind(a),end=clamp(progress),fps=v.fps||30;
  if(a.trail===false||kind==='route'||!['move','path'].includes(a.mode)||end<=0)return [];
  const start=clamp(H.ease(a.easing,H.actionProgress(a,Math.max(a.start,frame-fps*trailLifetime(kind)))));
  if(end-start<1e-8)return [];
  const count=kind==='wake'?64:32,points=[];
  for(let i=0;i<=count;i++){
    const point=H.routeAt(route,start+(end-start)*i/count),q=H.project(v,point.X+wrap,point.Y);
    points.push(q.z>=v.near&&Number.isFinite(q.x)&&Number.isFinite(q.y)?{x:q.x,y:q.y}:null);
  }
  // Keep marks beside the moving object even on fast or very long routes.
  const tail=[],maxLength=kind==='wake'?Math.max(24*(v.unit||1),size*8):Math.max(10*(v.unit||1),size*2);
  let behind=0;
  for(let i=points.length-1;i>=0;i--){
    const point=points[i];if(!point)break;
    const previous=tail.at(-1),length=previous?Math.hypot(point.x-previous.x,point.y-previous.y):0;
    if(previous&&behind+length>maxLength){const f=(maxLength-behind)/length;tail.push({x:previous.x+(point.x-previous.x)*f,y:previous.y+(point.y-previous.y)*f,behind:maxLength});break;}
    behind+=length;tail.push({...point,behind});
  }
  return tail;
}

function offsets(points,width){
  return points.map((p,i)=>{
    if(!p)return null;
    const before=points[i-1]||p,after=points[i+1]||p,dx=after.x-before.x,dy=after.y-before.y,length=Math.hypot(dx,dy)||1,w=width(p);
    return {...p,left:[p.x-dy/length*w,p.y+dx/length*w],right:[p.x+dy/length*w,p.y-dx/length*w]};
  });
}
function strokeSide(c,points,side,accept=()=>true){
  c.beginPath();
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];if(!a||!b||!accept(b))continue;
    const A=side?a[side]:[a.x,a.y],B=side?b[side]:[b.x,b.y];c.moveTo(...A);c.lineTo(...B);
  }
  c.stroke();
}
const trailCache=new WeakMap();
export function drawMovementTrail(H,c,v,route,a,frame,progress,wrap,size){
  if(a.trail===false||!['move','path'].includes(a.mode))return;
  let cache=trailCache.get(v);if(!cache){cache=new Map();trailCache.set(v,cache);}
  const key=JSON.stringify([movementTrailKind(a),v.fps,frame,progress,wrap,size,a.start,a.dur,a.moveStart,a.moveEnd,a.animStart,a.animEnd,a.animDur,a.easing]);
  let entry=cache.get(route);
  if(!entry||entry.key!==key){entry={key,points:movementTrailGeometry(H,v,route,a,frame,progress,wrap,size)};cache.set(route,entry);if(cache.size>64)cache.delete(cache.keys().next().value);}
  const points=entry.points;
  if(points.filter(Boolean).length<2)return;
  const kind=movementTrailKind(a),unit=v.unit||1;
  const moveEnd=a.moveEnd??animationKeysOf(a).end,fade=clamp(1-Math.max(0,frame-moveEnd)/((v.fps||30)*trailLifetime(kind)));
  const opacity=(a.opacity??1)*(a.groupOpacity??1)*fade;
  if(opacity<=0)return;
  c.save();c.lineCap='round';c.lineJoin='round';c.setLineDash([]);
  if(kind==='tracks'){
    const rails=offsets(points,()=>a.glyph==='bicycle'?0:size*.24);
    c.globalAlpha*=opacity*.42;c.strokeStyle='#493c2a';c.lineWidth=Math.max(.7*unit,size*.055);
    strokeSide(c,rails,'left');if(a.glyph!=='bicycle')strokeSide(c,rails,'right');
    c.globalAlpha*=.7;c.lineWidth=Math.max(.6*unit,size*.035);c.setLineDash([Math.max(unit,size*.055),Math.max(unit,size*.08)]);
    strokeSide(c,rails,'left');if(a.glyph!=='bicycle')strokeSide(c,rails,'right');
  }else{
    const length=Math.max(24*unit,size*8),wake=offsets(points,p=>size*(.18+.65*p.behind/length));
    const alpha=c.globalAlpha;
    for(let band=0;band<4;band++){
      const accept=p=>Math.min(3,Math.floor(p.behind/length*4))===band;
      c.globalAlpha=alpha*opacity*(1-band/4)*.48;c.strokeStyle='#87cbd9';c.lineWidth=Math.max(unit,size*.25);strokeSide(c,wake,null,accept);
      c.strokeStyle='#efffff';c.lineWidth=Math.max(.8*unit,size*.045);strokeSide(c,wake,'left',accept);strokeSide(c,wake,'right',accept);
    }
  }
  c.restore();
}
