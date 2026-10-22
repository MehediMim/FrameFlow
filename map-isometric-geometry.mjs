import { drawPlaqueText } from './map-plaque-text.mjs';
import { drawModelShadow, shadowGeometry, ISOMETRIC_LIGHT, projectIso } from './map-isometric-shadow.mjs';
import { currentSceneLighting } from './map-lighting.mjs';
export { projectIso } from './map-isometric-shadow.mjs';
// World-space miniature geometry. X/Y lie on the ground; Z is height.
// Faces are constructed independently of the normal-view icon artwork.
const TAU=Math.PI*2;
function tint(color,amount){
  const rgb=/^#[\da-f]{6}$/i.test(color)?[parseInt(color.slice(1,3),16),parseInt(color.slice(3,5),16),parseInt(color.slice(5,7),16)]:/^rgb\(/.test(color)?color.match(/[\d.]+/g).map(Number):null;
  if(!rgb)return color;
  return `rgb(${rgb.map(v=>Math.round(Math.max(0,Math.min(255,v*amount)))).join(',')})`;
}
function materialFor(color){
  if(['#95643e','#674b38','#805d42','#926342','#b99865'].includes(color))return 'wood';
  if(['#56646b','#30383c','#343f43','#b5bdba'].includes(color))return 'metal';
  if(['#7cb2bf','#a9c9c7'].includes(color))return 'glass';
  if(color==='#d5a176')return 'skin';if(color==='#d3a64d')return 'metal';
  if(['#b4b0a1','#b1a184'].includes(color))return 'stone';return null;
}
function illumination(n,settings){
  const vector=settings?.vector||ISOMETRIC_LIGHT,diffuse=Math.max(0,n.reduce((s,v,i)=>s+v*vector[i],0)/Math.hypot(...vector));
  return settings?.enabled ? .52+settings.ambient*.3+diffuse*Math.min(1.5,settings.sun)*.45 : .67+.48*diffuse;
}
function lighting(points,settings){
  const a=points[0],b=points[1],d=points.at(-1),u=b.map((v,i)=>v-a[i]),v=d.map((q,i)=>q-a[i]);
  let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],l=Math.hypot(...n)||1;
  if(n[0]+n[1]+n[2]<0)n=n.map(q=>-q);n=n.map(q=>q/l);
  return illumination(n,settings);
}
function finishFace(c,f,p,size){
  const material=f.material;if(f.smooth||!material||['smooth','skin','cloth'].includes(material)||p.length<3)return;
  const [a,b]=p,d=p.at(-1),W=Math.hypot(...f.points[1].map((v,i)=>v-f.points[0][i])),H=Math.hypot(...f.points.at(-1).map((v,i)=>v-f.points[0][i]));
  if(W*size<4||H*size<3)return;
  c.save();c.clip();c.transform((b[0]-a[0])*size/W,(b[1]-a[1])*size/W,(d[0]-a[0])*size/H,(d[1]-a[1])*size/H,a[0]*size,a[1]*size);
  c.lineWidth=.006;c.strokeStyle='rgba(35,27,20,.23)';c.beginPath();
  if(material==='stone'||material==='tile'){
    const h=material==='tile'?.105:.13,w=material==='tile'?.14:.27;
    for(let j=0;j<H/h;j++){
      const y=j*h;c.moveTo(0,y);c.lineTo(W,y);
      for(let x=-(j%2)*w/2;x<W;x+=w){
        const variation=Math.sin(x*71+j*13.7);c.fillStyle=variation>0?`rgba(234,219,183,${variation*.07})`:`rgba(45,37,28,${-variation*.055})`;c.fillRect(x+.008,y+.008,w-.016,h-.016);
        c.moveTo(x,y);c.lineTo(x,y+h);
      }
    }
  }else if(material==='wood'){
    for(let y=.07;y<H;y+=.105){c.moveTo(0,y);c.lineTo(W,y);for(let i=0;i<3;i++){const x=(i+.23)*W/3;c.moveTo(x,y-.025);c.bezierCurveTo(x+.08,y-.04,x+.18,y-.01,x+.3,y-.026);}}
  }else if(material==='thatch'){
    c.strokeStyle='rgba(86,66,28,.3)';c.lineWidth=.004;
    for(let x=0;x<W;x+=.035){const shift=Math.sin(x*163)*.014;c.moveTo(x,0);c.lineTo(x+shift,H);}
    for(let y=.16;y<H;y+=.18){c.moveTo(0,y);c.lineTo(W,y);}
  }else if(material==='glass'){
    c.strokeStyle='rgba(224,242,240,.48)';c.lineWidth=.025;
    for(let x=-H;x<W;x+=.35){c.moveTo(x,0);c.lineTo(x+H,H);}
  }else if(material==='earth'||material==='plaster'){
    c.strokeStyle=material==='earth'?'rgba(56,66,36,.26)':'rgba(68,55,38,.13)';
    for(let i=0;i<Math.min(90,W*H*60);i++){const x=((i*37.37)%97)/97*W,y=((i*23.13)%83)/83*H;c.moveTo(x,y);c.lineTo(x+.015,y+.005);}
  }else if(material==='marble'){
    c.strokeStyle='rgba(126,132,122,.15)';c.lineWidth=.004;
    for(let j=0;j<3;j++){for(let i=0;i<=12;i++){const x=i/12*W,y=(j+.4)*H/3+Math.sin(i*.6+j)*H*.045;if(i)c.lineTo(x,y);else c.moveTo(x,y);}}
  }else if(material==='metal'||material==='paint'){
    c.strokeStyle='rgba(230,236,223,.25)';c.moveTo(.012,.012);c.lineTo(W-.012,.012);
    c.strokeStyle='rgba(30,36,32,.24)';
    for(let x=.1;x<W;x+=.24){c.moveTo(x,H-.045);c.lineTo(x+.014,H-.045);}
  }
  c.stroke();c.restore();
}
const cross2=(a,b,p)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
function intersection(subject,clip){
  const orientation=Math.sign(clip.reduce((sum,a,i)=>{const b=clip[(i+1)%clip.length];return sum+a[0]*b[1]-a[1]*b[0];},0));
  let points=subject;
  for(let i=0;i<clip.length&&points.length;i++){
    const a=clip[i],b=clip[(i+1)%clip.length],input=points;points=[];
    for(let j=0;j<input.length;j++){
      const p=input[j],q=input[(j+1)%input.length],dp=cross2(a,b,p)*orientation,dq=cross2(a,b,q)*orientation;
      if(dp>=-1e-8)points.push(p);
      if((dp>=0)!==(dq>=0)){const k=dp/(dp-dq);points.push([p[0]+(q[0]-p[0])*k,p[1]+(q[1]-p[1])*k]);}
    }
  }return points;
}
export const projectSide=([x,y,z])=>[x,-z];
function projectedFace(face,index,view){
  const side=view==='side',p=face.points.map(side?projectSide:projectIso),depth=face.points.map(([x,y,z])=>side?y:x+y+z);
  const a=p[0];let plane=null;
  for(let i=1;i<p.length-1&&!plane;i++){
    const b=p[i],d=p[i+1],det=cross2(a,b,d);if(Math.abs(det)<1e-8)continue;
    const A=((depth[i]-depth[0])*(d[1]-a[1])-(depth[i+1]-depth[0])*(b[1]-a[1]))/det;
    const B=((b[0]-a[0])*(depth[i+1]-depth[0])-(d[0]-a[0])*(depth[i]-depth[0]))/det;
    plane=[A,B,depth[0]-A*a[0]-B*a[1]];
  }
  return {face,index,p,plane,x0:Math.min(...p.map(q=>q[0])),x1:Math.max(...p.map(q=>q[0])),y0:Math.min(...p.map(q=>q[1])),y1:Math.max(...p.map(q=>q[1])),after:[],incoming:0};
}
// Average-depth sorting alone hides decals behind the wall or tabletop that
// carries them. Compare depth at the actual projected overlap, then order the
// faces by those occlusion dependencies. Unrelated faces retain stable ordering.
function paintOrder(faces,view){
  const nodes=faces.map((face,index)=>projectedFace(face,index,view)).filter(n=>n.plane);
  nodes.sort((a,b)=>a.face.depth-b.face.depth||a.index-b.index);
  for(let i=0;i<nodes.length;i++)for(let j=i+1;j<nodes.length;j++){
    const a=nodes[i],b=nodes[j];
    if(Math.min(a.x1,b.x1)-Math.max(a.x0,b.x0)<1e-7||Math.min(a.y1,b.y1)-Math.max(a.y0,b.y0)<1e-7)continue;
    const overlap=intersection(a.p,b.p);if(overlap.length<3)continue;
    const area=Math.abs(overlap.reduce((sum,p,k)=>{const q=overlap[(k+1)%overlap.length];return sum+p[0]*q[1]-p[1]*q[0];},0));if(area<1e-8)continue;
    const x=overlap.reduce((sum,p)=>sum+p[0],0)/overlap.length,y=overlap.reduce((sum,p)=>sum+p[1],0)/overlap.length;
    const delta=(a.plane[0]-b.plane[0])*x+(a.plane[1]-b.plane[1])*y+a.plane[2]-b.plane[2];
    const aFirst=Math.abs(delta)<1e-7?a.index<b.index:delta<0,back=aFirst?a:b,front=aFirst?b:a;back.after.push(front);front.incoming++;
  }
  const ordered=[];
  while(ordered.length<nodes.length){const next=nodes.find(n=>!n.done&&n.incoming===0)||nodes.find(n=>!n.done);next.done=true;ordered.push(next);for(const n of next.after)n.incoming--;}
  return ordered.map(({face,p})=>({face,p}));
}
export class IsoScene{
  constructor(view='isometric'){this.view=view;this.complete=view==='isometricBack';this.faces=[];this.material='matte';this.lighting=currentSceneLighting();this._ordered=null;this._bounds=null;}
  withMaterial(material,draw){const previous=this.material;this.material=material;try{draw();}finally{this.material=previous;}}
  face(points,color,shade=1,edge=true,material=materialFor(color)||this.material){this._ordered=null;this._bounds=null;const base=material==='glass'&&this.lighting.enabled&&this.lighting.night>.4?'#f1ca78':color;this.faces.push({points,color:tint(base,lighting(points,this.lighting)*Math.sqrt(shade)),material,edge,depth:points.reduce((s,[x,y,z])=>s+x+y+z,0)/points.length});}
  box(x,y,z,w,d,h,color){
    this.face([[x,y,z+h],[x+w,y,z+h],[x+w,y+d,z+h],[x,y+d,z+h]],color,1.18);
    this.face([[x+w,y,z],[x+w,y+d,z],[x+w,y+d,z+h],[x+w,y,z+h]],color,.72);
    this.face([[x,y+d,z],[x+w,y+d,z],[x+w,y+d,z+h],[x,y+d,z+h]],color,.95);
    if(this.complete){
      this.face([[x,y,z],[x,y+d,z],[x,y+d,z+h],[x,y,z+h]],color,.72);
      this.face([[x,y,z],[x+w,y,z],[x+w,y,z+h],[x,y,z+h]],color,.95);
    }
  }
  prism(points,z,h,color){
    this.face(points.map(([x,y])=>[x,y,z+h]),color,1.16);
    points.forEach(([x,y],i)=>{const [X,Y]=points[(i+1)%points.length];if(this.complete||Y>=y||X<=x)this.face([[x,y,z],[X,Y,z],[X,Y,z+h],[x,y,z+h]],color,.7+.22*(i%3));});
  }
  roof(x,y,z,w,d,h,color){
    const a=[x,y,z],b=[x+w,y,z],c=[x+w,y+d,z],e=[x,y+d,z],r=[x,y+d/2,z+h],s=[x+w,y+d/2,z+h];
    this.face([a,b,s,r],color,.8);this.face([r,s,c,e],color,1.13);this.face([b,c,s],color,.66);
    if(this.complete)this.face([a,e,r],color,.66);
  }
  cone(x,y,z,r,h,color,n=8){
    for(let i=0;i<n;i++){const a=i*TAU/n,b=(i+1)*TAU/n;this.face([[x+Math.cos(a)*r,y+Math.sin(a)*r,z],[x+Math.cos(b)*r,y+Math.sin(b)*r,z],[x,y,z+h]],color,.8+.25*Math.cos(a-2));}
  }
  cylinder(x,y,z,r,h,color,n=12){
    const points=Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*r,y+Math.sin(i*TAU/n)*r]);this.prism(points,z,h,color);
  }
  frustum(x,y,z,r0,r1,h,color,n=12){
    const lower=Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*r0,y+Math.sin(i*TAU/n)*r0,z]);
    const upper=Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*r1,y+Math.sin(i*TAU/n)*r1,z+h]);
    this.face(upper,color,1.15);for(let i=0;i<n;i++)this.face([lower[i],lower[(i+1)%n],upper[(i+1)%n],upper[i]],color,.82+.2*Math.cos(i*TAU/n-2));
  }
  ball(x,y,z,rx,ry,rz,color,n=12,rings=8){
    const p=(i,j)=>{const a=i*TAU/n,b=-Math.PI/2+j*Math.PI/rings;return[x+rx*Math.cos(a)*Math.cos(b),y+ry*Math.sin(a)*Math.cos(b),z+rz*Math.sin(b)];};
    const light=(i,j)=>{const a=i*TAU/n,b=-Math.PI/2+j*Math.PI/rings,N=[Math.cos(a)*Math.cos(b)/rx,Math.sin(a)*Math.cos(b)/ry,Math.sin(b)/rz],l=Math.hypot(...N)||1;return illumination(N.map(v=>v/l),this.lighting);};
    for(let j=0;j<rings;j++)for(let i=0;i<n;i++){
      this.face([p(i,j),p(i+1,j),p(i+1,j+1),p(i,j+1)],color,1,false,['skin','glass','metal'].includes(materialFor(color))?materialFor(color):'smooth');
      this.faces.at(-1).smooth={color,values:[light(i,j),light(i+1,j),light(i+1,j+1),light(i,j+1)]};
    }
  }
  tube(a,b,r0,r1,color,n=10){
    const v=b.map((q,i)=>q-a[i]),l=Math.hypot(...v)||1,u=Math.abs(v[2])/l<.9?[-v[1],v[0],0]:[1,0,0],ul=Math.hypot(...u);for(let i=0;i<3;i++)u[i]/=ul;
    const w=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]].map(q=>q/l);
    const ring=(p,r)=>Array.from({length:n},(_,j)=>p.map((q,i)=>q+r*(u[i]*Math.cos(j*TAU/n)+w[i]*Math.sin(j*TAU/n))));
    const A=ring(a,r0),B=ring(b,r1);this.face(B,color,1,false);for(let i=0;i<n;i++)this.face([A[i],A[(i+1)%n],B[(i+1)%n],B[i]],color,1,false);
    if(this.complete)this.face(A,color,1,false);
  }
  bevelBox(x,y,z,w,d,h,color,r=.06){
    r=Math.min(r,w/3,d/3,h/3);
    const outline=[[x+r,y],[x+w-r,y],[x+w,y+r],[x+w,y+d-r],[x+w-r,y+d],[x+r,y+d],[x,y+d-r],[x,y+r]];
    this.prism(outline,z,h-r,color);const top=outline.map(([X,Y])=>[Math.max(x+r,Math.min(x+w-r,X)),Math.max(y+r,Math.min(y+d-r,Y)),z+h]);
    this.face(top,color,1.12);outline.forEach(([X,Y],i)=>{const j=(i+1)%outline.length;this.face([[X,Y,z+h-r],[...outline[j],z+h-r],top[j],top[i]],color,1.08,false);});
  }
  beam(a,b,r,color){
    const v=b.map((q,i)=>q-a[i]),l=Math.hypot(...v)||1,u=Math.abs(v[2])/l<.9?[-v[1],v[0],0]:[1,0,0],ul=Math.hypot(...u);for(let i=0;i<3;i++)u[i]=u[i]/ul*r;
    const w=[v[1]*u[2]-v[2]*u[1],v[2]*u[0]-v[0]*u[2],v[0]*u[1]-v[1]*u[0]].map(q=>q/l);
    const ring=p=>[[1,1],[-1,1],[-1,-1],[1,-1]].map(([k,j])=>p.map((q,i)=>q+k*u[i]+j*w[i]));
    const A=ring(a),B=ring(b);this.face(B,color,1.2);for(let i=0;i<4;i++)this.face([A[i],A[(i+1)%4],B[(i+1)%4],B[i]],color,.7+i*.13);
    if(this.complete)this.face(A,color,1.2);
  }
  // A wheel has a real axle and a visible circular side in the Y plane.
  wheel(x,y,z,r,width=.12,color='#30383c',backHub=false){
    const n=16,points=Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*r,y,z+Math.sin(i*TAU/n)*r]);
    this.face(points,color,.75,false);this.face(points.map(([X,Y,Z])=>[X,Y+width,Z]),color,1.02,false,'rubber');
    for(let i=0;i<n;i++){const a=points[i],b=points[(i+1)%n];this.face([a,b,[b[0],b[1]+width,b[2]],[a[0],a[1]+width,a[2]]],color,i%2?.85:1,false,'rubber');}
    const hubStart=this.faces.length,metal=color==='#30383c',R=r*(metal?.56:.78),Y=y+width+.003;
    this.face(Array.from({length:n},(_,i)=>[x+Math.cos(i*TAU/n)*R,Y,z+Math.sin(i*TAU/n)*R]),metal?'#9da5a0':'#544b3a',1,false,'metal');
    for(let i=0;i<6;i++){const a=i*TAU/6+(this.wheelPhase||0),b=a+.16;this.face([[x,Y+.003,z],[x+Math.cos(a)*R*.9,Y+.003,z+Math.sin(a)*R*.9],[x+Math.cos(b)*R*.9,Y+.003,z+Math.sin(b)*R*.9]],metal?'#485050':'#b89962',1,false);}
    this.beam([x,Y,z],[x,Y+.012,z],r*.17,metal?'#c4c8bf':'#88734f');
    if(backHub&&this.complete)for(const face of this.faces.slice(hubStart)){
      const points=face.points.map(([X,Y,Z])=>[X,2*y+width-Y,Z]);
      this.faces.push({...face,points,depth:points.reduce((sum,[X,Y,Z])=>sum+X+Y+Z,0)/points.length});
    }
  }
  texture(points,image,color='#e6d4ab',crop={}){
    this.face(points,color,1);if(image)this.faces.push({points,image,crop,depth:points.reduce((s,[x,y,z])=>s+x+y+z,0)/points.length+.0001});
  }
  text(points,text,style={}){
    if(text){this._ordered=null;this._bounds=null;this.faces.push({points,text,style:{...style},depth:points.reduce((s,[x,y,z])=>s+x+y+z,0)/points.length+.0002});}
  }
  bounds(shadows=true){
    const ordered=this._ordered||(this._ordered=paintOrder(this.faces,this.view));
    if(!this._bounds){const points=ordered.flatMap(n=>n.p);this._bounds={top:Math.min(...points.map(p=>p[1])),bottom:Math.max(...points.map(p=>p[1])),left:Math.min(...points.map(p=>p[0])),right:Math.max(...points.map(p=>p[0]))};}
    if(!shadows)return this._bounds;
    const b=shadowGeometry(this).bounds;return {left:Math.min(b.left,this._bounds.left),right:Math.max(b.right,this._bounds.right),top:Math.min(b.top,this._bounds.top),bottom:Math.max(b.bottom,this._bounds.bottom)};
  }
  draw(c,size,{shadows=true}={}){
    if(shadows)drawModelShadow(c,this,size);
    c.save();c.lineJoin='round';c.lineWidth=Math.max(.22,size*.007);c.strokeStyle='#292b2580';
    const ordered=this._ordered||(this._ordered=paintOrder(this.faces,this.view));
    for(const {face:f,p} of ordered){if(f.material==='shadow')continue;c.beginPath();p.forEach(([x,y],i)=>i?c.lineTo(x*size,y*size):c.moveTo(x*size,y*size));c.closePath();
      if(f.material==='ground'){
        const [a,b,,d]=p;c.save();c.clip();c.transform((b[0]-a[0])*size,(b[1]-a[1])*size,(d[0]-a[0])*size,(d[1]-a[1])*size,a[0]*size,a[1]*size);const g=c.createRadialGradient?.(.5,.5,0,.5,.5,.5);if(g?.addColorStop){g.addColorStop(0,f.groundColor+'66');g.addColorStop(1,f.groundColor+'00');c.fillStyle=g;c.fillRect(0,0,1,1);}c.restore();
      }else if(f.image||f.text){
        const [a,b,,d]=p,w=256,h=w*Math.hypot(...f.points[3].map((v,i)=>v-f.points[0][i]))/Math.hypot(...f.points[1].map((v,i)=>v-f.points[0][i]));
        c.save();c.clip();c.transform((b[0]-a[0])*size/w,(b[1]-a[1])*size/w,(d[0]-a[0])*size/h,(d[1]-a[1])*size/h,a[0]*size,a[1]*size);
        if(f.image){
          const fullW=f.image.naturalWidth||f.image.width,fullH=f.image.naturalHeight||f.image.height,[sx,sy,sw,sh]=f.crop.slice||[0,0,1,1],iw=fullW*sw,ih=fullH*sh;
          if(iw&&ih){const fit=f.crop.fit==='contain'?Math.min:Math.max,k=fit(w/iw,h/ih)*(f.crop.zoom??1),W=iw*k,H=ih*k;c.drawImage(f.image,sx*fullW,sy*fullH,iw,ih,(w-W)/2-(f.crop.x||0)/100*(W-w)/2,(h-H)/2-(f.crop.y||0)/100*(H-h)/2,W,H);}
        }else{
          const worldWidth=Math.hypot(...f.points[1].map((v,i)=>v-f.points[0][i]));drawPlaqueText(c,w/worldWidth,f.style,f.text,w/2,h/2,w*.94,h*.94,f.style.glyph==='banner');
        }c.restore();
      }else{
        c.fillStyle=f.color;
        const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]),x0=Math.min(...xs)*size,x1=Math.max(...xs)*size,y0=Math.min(...ys)*size,y1=Math.max(...ys)*size;
        if(f.edge&&(x1-x0)*(y1-y0)>18){const g=c.createLinearGradient?.(x0,y0,x1*.35+x0*.65,y1);if(g?.addColorStop){g.addColorStop(0,tint(f.color,f.material==='metal'?1.2:1.08));g.addColorStop(.45,f.color);g.addColorStop(1,tint(f.color,.88));c.fillStyle=g;}}
        if(f.smooth){const {values,color}=f.smooth,lo=values.indexOf(Math.min(...values)),hi=values.indexOf(Math.max(...values)),a=p[lo],b=p[hi];const g=c.createLinearGradient?.(a[0]*size,a[1]*size,b[0]*size,b[1]*size);if(g?.addColorStop){g.addColorStop(0,tint(color,values[lo]));g.addColorStop(1,tint(color,values[hi]));c.fillStyle=g;}}
        c.fill();if(f.edge)c.stroke();else if(f.smooth){c.save();c.strokeStyle=c.fillStyle;c.lineWidth=.3;c.stroke();c.restore();}finishFace(c,f,p,size);
      }
    }c.restore();
    return this.bounds(shadows);
  }
}
