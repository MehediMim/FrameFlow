// The same world-space sun drives surface lighting and ground projection.
export const ISOMETRIC_LIGHT=Object.freeze([-.35,.55,1]);
export const projectIso=([x,y,z])=>[(x-y)*.866025403784,(x+y)*.5-z];
const excluded=new Set(['ground','shadow']);
const area=p=>p.reduce((s,a,i)=>{const b=p[(i+1)%p.length];return s+a[0]*b[1]-a[1]*b[0];},0);
export function projectShadowPoint([x,y,z],{angle=0,mirror=false,height=0,flatten=1,light=ISOMETRIC_LIGHT}={}){
  const [X,Y]=projectIso([x,y,0]),co=Math.cos(angle),si=Math.sin(angle),u=X*co-Y*si,v=X*si+Y*co;
  const h=Math.max(0,z*flatten+height),denominator=Math.max(.18,light[2]),[dx,dy]=projectIso([-light[0]*h/denominator,-light[1]*h/denominator,0]);
  return [(mirror?-u:u)+dx,v+dy];
}
function hull(points){
  const sorted=points.toSorted((a,b)=>a[0]-b[0]||a[1]-b[1]),cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const half=list=>{const out=[];for(const p of list){while(out.length>1&&cross(out.at(-2),out.at(-1),p)<=0)out.pop();out.push(p);}out.pop();return out;};
  return [...half(sorted),...half(sorted.toReversed())];
}
const geometryCache=new WeakMap();
export function shadowGeometry(scene,pose={}){
  pose={...pose,light:scene.lighting?.vector||ISOMETRIC_LIGHT};const cast=!scene.lighting?.enabled||scene.lighting.sun>0;
  let cached=geometryCache.get(scene);if(!cached){cached=new Map();geometryCache.set(scene,cached);}
  const key=JSON.stringify([scene.faces.length,pose.angle||0,!!pose.mirror,pose.height||0,pose.flatten??1]);
  if(cached.has(key))return cached.get(key);
  const layers=[[],[],[]],contact=[],low=[],points=[];let maxHeight=0;
  for(const face of scene.faces){
    if(excluded.has(face.material)||face.image||face.text)continue;
    const polygon=face.points.map(p=>projectShadowPoint(p,pose));
    const height=face.points.reduce((s,p)=>s+Math.max(0,p[2]*(pose.flatten??1)+(pose.height||0)),0)/face.points.length;
    maxHeight=Math.max(maxHeight,...face.points.map(p=>Math.max(0,p[2]*(pose.flatten??1)+(pose.height||0))));
    if(cast&&Math.abs(area(polygon))>1e-9){layers[height<.4?0:height<1.15?1:2].push(polygon);points.push(...polygon);}
    if((pose.height||0)<.04){
      const ground=face.points.map(([x,y])=>projectShadowPoint([x,y,0],{...pose,height:0}));
      for(const p of face.points)if(p[2]<=.14)low.push(projectShadowPoint([p[0],p[1],0],{...pose,height:0}));
      if(face.points.every(p=>p[2]>=-.02&&p[2]<=.16)&&Math.abs(area(ground))>1e-8)contact.push(ground);
    }
  }
  if(!contact.length&&low.length>2){const p=hull(low);if(p.length>2)contact.push(p);}
  const blur=[.018,.045,.075].map(b=>b+Math.sqrt(Math.max(0,pose.height||0))*.035),padding=Math.max(...blur)*3+.025;
  points.push(...contact.flat());
  const bounds=points.length?{left:Math.min(...points.map(p=>p[0]))-padding,right:Math.max(...points.map(p=>p[0]))+padding,top:Math.min(...points.map(p=>p[1]))-padding,bottom:Math.max(...points.map(p=>p[1]))+padding}:{left:0,right:0,top:0,bottom:0};
  const geometry={layers,contact,blur,maxHeight,bounds};cached.set(key,geometry);if(cached.size>8)cached.delete(cached.keys().next().value);return geometry;
}
function path(c,polygons,size,dx=0,dy=0){
  c.beginPath();for(const source of polygons){const points=area(source)<0?source.toReversed():source;points.forEach(([x,y],i)=>i?c.lineTo(x*size+dx,y*size+dy):c.moveTo(x*size+dx,y*size+dy));c.closePath();}
}
function surface(w,h){
  const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(canvas){canvas.width=w;canvas.height=h;}return canvas;
}
const sceneIds=new WeakMap(),cache=new Map();let serial=0,pixels=0;
export function drawModelShadow(c,scene,size,pose={}){
  const geometry=shadowGeometry(scene,pose),{bounds,layers,contact,blur}=geometry,transform=c.getTransform?.();
  const ratio=transform?Math.max(1,Math.ceil(Math.max(Math.hypot(transform.a,transform.b),Math.hypot(transform.c,transform.d))*2)/2):1;
  if(!sceneIds.has(scene))sceneIds.set(scene,++serial);
  const key=JSON.stringify([sceneIds.get(scene),size,ratio,pose.angle||0,!!pose.mirror,pose.height||0,pose.flatten??1]);
  let entry=cache.get(key);
  if(!entry){
    const x=Math.floor(bounds.left*size*ratio),y=Math.floor(bounds.top*size*ratio),w=Math.ceil(bounds.right*size*ratio)-x,h=Math.ceil(bounds.bottom*size*ratio)-y;
    const canvas=w>0&&h>0&&w*h<=4e6?surface(w,h):null;
    if(!canvas){
      c.save();c.globalAlpha*=.23*(scene.lighting?.enabled?scene.lighting.shadowStrength*Math.min(1,scene.lighting.sun):1);c.fillStyle='#20271f';path(c,layers.flat(),size);c.fill();c.restore();return bounds;
    }
    const target=canvas.getContext('2d'),mask=surface(w,h),maskCtx=mask.getContext('2d'),penumbra=surface(w,h),soft=penumbra.getContext('2d');
    // Each band is a union mask. Hundreds of overlapping model faces must not
    // accumulate opacity; only the final mask receives the shadow opacity.
    for(let i=0;i<3;i++){
      soft.clearRect(0,0,w,h);path(soft,layers[i],size*ratio,-x,-y);soft.fillStyle='#20271f';soft.fill();
      maskCtx.filter=`blur(${Math.max(.4,blur[i]*size*ratio)}px)`;maskCtx.drawImage(penumbra,0,0);
    }
    target.globalAlpha=.23/(1+Math.max(0,pose.height||0)*.16)*(scene.lighting?.enabled?scene.lighting.shadowStrength*Math.min(1,scene.lighting.sun):1);target.drawImage(mask,0,0);
    soft.clearRect(0,0,w,h);path(soft,contact,size*ratio,-x,-y);soft.fillStyle='#141c16';soft.fill();
    target.filter=`blur(${Math.max(.45,size*ratio*.018)}px)`;target.globalAlpha=.22*(scene.lighting?.enabled?scene.lighting.shadowStrength*(.3+.7*scene.lighting.ambient):1);target.drawImage(penumbra,0,0);
    entry={canvas,x,y,w,h,ratio};
    while((pixels+w*h>8e6||cache.size>=256)&&cache.size){const old=cache.keys().next().value,prior=cache.get(old);pixels-=prior.w*prior.h;cache.delete(old);}
    cache.set(key,entry);pixels+=w*h;
  }
  c.drawImage(entry.canvas,entry.x/ratio,entry.y/ratio,entry.w/ratio,entry.h/ratio);return bounds;
}
