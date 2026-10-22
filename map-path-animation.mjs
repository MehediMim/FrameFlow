import { easings } from './easings.mjs';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const NETWORK_SHAPES={road:{label:'Road',color:'#8c7353'},railway:{label:'Railway',color:'#414941'},river:{label:'River',color:'#6496ad'}};
export const NETWORK_ANIMATIONS={reveal:'Draw along path',flow:'Flow / traffic',both:'Draw and flow',static:'Static'};
export const pathAnimationMode=a=>a.networkAnimation??(a.revealPath===false?'flow':'both');
const copy=path=>path.map(p=>({...p}));
// Unwrap longitude before measuring or interpolating across the antimeridian.
function samples(path,n){
  if(!path.length)return[];
  const pts=copy(path);for(let i=1;i<pts.length;i++)pts[i].lon+=Math.round((pts[i-1].lon-pts[i].lon)/360)*360;
  const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i].lon-pts[i-1].lon,pts[i].lat-pts[i-1].lat));
  let j=1;return Array.from({length:n},(_,i)=>{const d=cum.at(-1)*i/(n-1);while(j<pts.length-1&&cum[j]<d)j++;const a=pts[j-1]||pts[0],b=pts[j]||a,t=(d-(cum[j-1]||0))/((cum[j]||0)-(cum[j-1]||0)||1);return{lon:a.lon+(b.lon-a.lon)*t,lat:a.lat+(b.lat-a.lat)*t};});
}
export function pathAt(a,frame){
  const keys=[...(a.pathKeys||[])].sort((a,b)=>a.frame-b.frame);if(!keys.length)return copy(a.path||[]);
  const next=keys.findIndex(k=>k.frame>frame);if(next===0)return copy(keys[0].path);if(next<0)return copy(keys.at(-1).path);
  const l=keys[next-1],r=keys[next];if(frame===l.frame)return copy(l.path);
  const n=Math.max(l.path.length,r.path.length),left=l.path.length===n?copy(l.path):samples(l.path,n),right=r.path.length===n?copy(r.path):samples(r.path,n);
  const t=clamp((easings[a.easing]||easings.easeInOut)((frame-l.frame)/(r.frame-l.frame)),0,1);
  return left.map((p,i)=>{const q=right[i],lon=q.lon+Math.round((p.lon-q.lon)/360)*360;return{lon:p.lon+(lon-p.lon)*t,lat:p.lat+(q.lat-p.lat)*t};});
}
export function putPathKey(a,frame,path,seed=true){
  if(path.length<2||path.length>120)throw Error('A path keyframe needs 2–120 points.');
  a.pathKeys||=[];
  if(seed&&frame>a.start&&!a.pathKeys.length)a.pathKeys.push({frame:a.start,path:copy(a.path?.length>=2?a.path:path)});
  const key=a.pathKeys.find(k=>k.frame===frame);if(key)key.path=copy(path);else a.pathKeys.push({frame,path:copy(path)});
  a.pathKeys.sort((a,b)=>a.frame-b.frame);
}
export function movePathKey(a,from,to){const key=a.pathKeys?.find(k=>k.frame===from);if(!key||from===to)return;a.pathKeys=a.pathKeys.filter(k=>k.frame!==from&&k.frame!==to);putPathKey(a,to,key.path,false);}
export function validatePathAnimation(a){
  if(a.revealPath!==undefined&&typeof a.revealPath!=='boolean')throw Error('Invalid path reveal.');
  if(a.networkAnimation!==undefined&&!Object.hasOwn(NETWORK_ANIMATIONS,a.networkAnimation))throw Error('Invalid network animation.');
  if(a.flowSpeed!==undefined&&(!Number.isFinite(a.flowSpeed)||Math.abs(a.flowSpeed)>200))throw Error('Invalid flow speed.');
  if(a.frontSide!==undefined&&!['left','right'].includes(a.frontSide))throw Error('Invalid front side.');
  if(a.pathKeys===undefined)return;
  if(!Array.isArray(a.pathKeys)||a.pathKeys.length>300)throw Error('Too many path keyframes.');
  const seen=new Set();for(const k of a.pathKeys){if(!k||!Number.isSafeInteger(k.frame)||k.frame<a.start||k.frame>a.start+a.dur||seen.has(k.frame)||!Array.isArray(k.path)||k.path.length<2||k.path.length>120||k.path.some(p=>!p||!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lon)||Math.abs(p.lon)>540))throw Error('Invalid path keyframe.');seen.add(k.frame);}
}
export function revealPolyline(points,progress){
  const total=points.reduce((d,p,i)=>d+(i&&p&&points[i-1]?Math.hypot(p.x-points[i-1].x,p.y-points[i-1].y):0),0),out=[];let remaining=total*clamp(progress,0,1);
  for(let i=0;i<points.length;i++){const p=points[i],prior=points[i-1];if(!p){out.push(null);continue;}if(!prior){out.push(p);continue;}const d=Math.hypot(p.x-prior.x,p.y-prior.y);if(d<=remaining){out.push(p);remaining-=d;}else{if(remaining>0)out.push({...p,x:prior.x+(p.x-prior.x)*remaining/d,y:prior.y+(p.y-prior.y)*remaining/d});break;}}
  return out;
}
// Clip before drawing railway ties so zooming into a long route remains bounded.
export function clipPolyline(points,width,height,margin=40){
  const out=[],xmin=-margin,ymin=-margin,xmax=width+margin,ymax=height+margin;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];if(!a||!b){out.push(null);continue;}
    const dx=b.x-a.x,dy=b.y-a.y;let lo=0,hi=1,rejected=false;
    for(const [p,q]of[[-dx,a.x-xmin],[dx,xmax-a.x],[-dy,a.y-ymin],[dy,ymax-a.y]]){if(!p){if(q<0)rejected=true;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);}
    if(rejected||lo>hi){out.push(null);continue;}
    const first={x:a.x+dx*lo,y:a.y+dy*lo},last={x:a.x+dx*hi,y:a.y+dy*hi},prior=out.at(-1);
    if(!prior||Math.hypot(prior.x-first.x,prior.y-first.y)>1e-5)out.push(null,first);
    out.push(last);if(hi<1)out.push(null);
  }return out;
}
export function drawNetwork(c,points,a,unit,seconds){
  const width=(a.width||6)*unit,flow=['flow','both'].includes(a.networkAnimation),phase=seconds*(a.flowSpeed??24)*unit;
  const path=()=>{c.beginPath();let prior=false;for(const p of points){if(p){if(prior)c.lineTo(p.x,p.y);else c.moveTo(p.x,p.y);}prior=!!p;}};
  const stroke=(color,w,dash=[],offset=0)=>{path();c.strokeStyle=color;c.lineWidth=w;c.setLineDash(dash);c.lineDashOffset=offset;c.stroke();};
  c.save();c.lineCap='round';c.lineJoin='round';
  if(a.shape==='river'){
    stroke('#365e64',width*1.8);stroke(a.color,width*1.5);
    if(flow){c.globalAlpha*=.6;stroke('#d9e8de',Math.max(.7*unit,width*.18),[10*unit,17*unit],-phase);}
  }else if(a.shape==='road'){
    stroke('#393d30',width*1.8);stroke(a.color,width*1.4);stroke('#e0d2a6',Math.max(.7*unit,width*.12),[9*unit,10*unit],flow?-phase:0);
  }else{
    stroke('#b6ab8b',width*2.2);
    let offset=0;const gap=Math.max(5*unit,width*.8);c.strokeStyle=a.color;c.lineWidth=Math.max(unit,width*.2);
    for(let i=1;i<points.length;i++){const l=points[i-1],r=points[i];if(!l||!r){offset=0;continue;}const dx=r.x-l.x,dy=r.y-l.y,len=Math.hypot(dx,dy);if(!len)continue;let d=offset;for(;d<len;d+=gap){const x=l.x+dx*d/len,y=l.y+dy*d/len;c.beginPath();c.moveTo(x-dy/len*width,y+dx/len*width);c.lineTo(x+dy/len*width,y-dx/len*width);c.stroke();}offset=d-len;}
    stroke(a.color,width*1.3);stroke('#d7ceb5',width*.65);
    if(flow){c.lineCap='butt';stroke('#e5b05b',width*.75,[14*unit,45*unit],-phase);}
  }
  c.restore();
}
