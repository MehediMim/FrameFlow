import { surface } from './map-object-materials.mjs';
// Damage is a persistent visual state, independent of entry/exit animation.
export const COLLAPSE_SECONDS = .9;

// Evaluate from the timeline so scrubbing and exported frames reproduce the same collapse.
// An object that starts destroyed is already rubble; only later state changes collapse.
export function destructionProgress(a, frame, fps = 30) {
  const track = (a.objectKeys || []).filter(k => k.values.damageState !== undefined).sort((a, b) => a.frame - b.frame);
  let state = track[0]?.values.damageState, start = null;
  for (const key of track) {
    if (key.frame > frame) break;
    const next = key.values.damageState;
    if (next !== state) start = next === 'destroyed' ? key.frame : null;
    state = next;
  }
  return start === null ? 1 : Math.max(0, Math.min(1, (frame - start) / (fps * COLLAPSE_SECONDS)));
}

export function drawDestruction(c, s, ship, progress, drawIntact, profile) {
  const wreck=profile&&damageSurface(c,s,'destroyed',drawIntact,profile);
  if(wreck){drawWreck(c,s,Math.max(0,Math.min(1,progress)),wreck,profile);return;}
  if (progress >= 1) { drawRubble(c, s, ship); return; }
  const p = Math.max(0, progress), fall = Math.min(1, p / .65), opacity = c.globalAlpha;
  c.save();
  c.globalAlpha = opacity * fall;
  drawRubble(c, s, ship);
  c.restore();
  if (fall < 1) {
    c.save();
    c.globalAlpha = opacity * (1 - fall * fall);
    c.translate(Math.sin(p * 55) * s * .035 * fall, s * .3 * fall * fall);
    c.rotate(Math.sin(p * 9) * .12 * fall);
    c.scale(1 + fall * .12, 1 - fall * .85);
    drawIntact(c);
    c.restore();
  }
  // Fixed particle trajectories keep playback independent of render order.
  c.save();
  for (let i = 0; i < 12; i++) {
    const q = Math.min(1, p / (.5 + (i % 3) * .1));
    const x = (i - 5.5) * s * (.08 + q * .16);
    const y = s * (.2 - (1 - q) * .8 - Math.sin(q * Math.PI) * (.45 + (i % 4) * .13));
    c.globalAlpha = opacity * Math.min(1, p * 20) * (1 - q);
    c.fillStyle = ship ? '#66503d' : '#82796a';
    c.save();c.translate(x, y);c.rotate(i + q * (i % 2 ? 5 : -5));
    c.fillRect(-s * .055, -s * .04, s * .11, s * .08);c.restore();
  }
  for (let i = 0; i < 7; i++) {
    const q = Math.max(0, (p - .1) / .9), r = s * (.15 + q * .42);
    c.globalAlpha = opacity * Math.sin(q * Math.PI) * .25;
    const x = (i - 3) * s * (.16 + q * .22), y = s * (.22 - q * (.4 + (i % 2) * .15));
    const dust = c.createRadialGradient(x, y, 0, x, y, r);
    dust.addColorStop(0, '#a99c85');dust.addColorStop(1, 'rgba(169,156,133,0)');
    c.fillStyle = dust;c.beginPath();c.arc(x, y, r, 0, Math.PI * 2);c.fill();
  }
  c.restore();
}

export function drawRubble(c,s,ship=false){
  c.fillStyle=ship?'#4c392d':'#686052';c.strokeStyle='#302a25';c.lineWidth=s*.035;
  for(let i=0;i<9;i++){
    const x=(i-4)*s*.19,y=s*(.14+(i%3)*.07),r=s*(.12+(i%2)*.055);
    c.fillStyle=surface(c,ship?'#66503d':'#82796a',x-r,y-r,2*r,1.25*r);
    c.beginPath();c.moveTo(x-r,y);c.lineTo(x-r*.4,y-r);c.lineTo(x+r*.8,y-r*.6);c.lineTo(x+r,y+r*.25);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(x-r*.4,y-r);c.lineTo(x+r*.12,y-r*.15);c.lineTo(x+r,y+r*.25);c.strokeStyle='#494135';c.lineWidth=s*.015;c.stroke();
    c.strokeStyle='#302a25';c.lineWidth=s*.035;
  }
  if(ship){c.beginPath();c.moveTo(-s*.9,s*.2);c.lineTo(-s*.7,-s*.06);c.lineTo(s*.75,s*.03);c.lineTo(s*.5,s*.3);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(-s*.2,s*.08);c.lineTo(s*.55,-s*.6);c.stroke();}
}
export function drawDamage(c,s,state,seconds,drawIntact,profile){
  if(!state||state==='intact'||state==='destroyed')return;
  const damaged=profile&&damageSurface(c,s,state,drawIntact,profile);
  if(damaged){
    c.drawImage(damaged.canvas,damaged.x,damaged.y,damaged.w,damaged.h);
    if(state==='burning')drawFire(c,s,seconds,profile);
    return;
  }
  drawIntact?.(c);
  c.save();const opacity=c.globalAlpha;c.strokeStyle='#2d2724';c.lineWidth=Math.max(.7,s*.035);c.lineJoin='round';
  for(const off of[-.45,.25]){
    c.beginPath();c.moveTo(off*s,-s*.45);c.lineTo((off+.08)*s,-s*.2);c.lineTo((off-.08)*s,-s*.07);c.lineTo((off+.06)*s,s*.17);c.stroke();
    c.save();c.lineWidth=s*.016;c.beginPath();c.moveTo((off+.08)*s,-s*.2);c.lineTo((off+.22)*s,-s*.24);c.lineTo((off+.27)*s,-s*.35);c.moveTo((off-.08)*s,-s*.07);c.lineTo((off-.2)*s,-s*.02);c.stroke();c.restore();
  }
  if(state==='burning')for(let i=0;i<4;i++){
    const x=(i-1.5)*s*.32,h=s*(.48+.14*Math.sin(seconds*6+i));
    const flame=c.createLinearGradient(x,s*.12,x,-h);flame.addColorStop(0,'#fff1ad');flame.addColorStop(.35,'#f9b844');flame.addColorStop(1,'#be4829');
    c.fillStyle=flame;c.beginPath();c.moveTo(x-s*.16,s*.12);c.quadraticCurveTo(x-s*.21,-h*.4,x+s*.09*Math.sin(seconds*4+i),-h);c.quadraticCurveTo(x+s*.2,-h*.3,x+s*.15,s*.12);c.closePath();c.fill();
    const q=(seconds*.35+i/4)%1;c.globalAlpha=opacity*(1-q)*.28;c.fillStyle='#45423c';c.beginPath();c.arc(x+q*s*.35,-s*(.6+q*1.7),s*(.15+q*.25),0,Math.PI*2);c.fill();c.globalAlpha=opacity;
  }
  c.restore();
}

// Reuse bounded scratch surfaces rather than allocating a canvas per object/frame.
let sourceLayer,weatherLayer,fireLayer;
const TAU=Math.PI*2;
const noise=(seed,i)=>{const n=Math.sin(seed*1.31+i*127.1)*43758.5453;return n-Math.floor(n);};
function seedOf(value){let seed=0;for(const ch of String(value||'object'))seed=(Math.imul(seed,31)+ch.charCodeAt(0))|0;return seed;}
function layer(previous,w,h){
  const canvas=previous||(typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):typeof document!=='undefined'?document.createElement('canvas'):null);
  if(!canvas)return null;
  if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
  return canvas;
}
function damageSurface(c,s,state,drawIntact,profile){
  if(!drawIntact)return null;
  const b=profile.bounds,w=(b.right-b.left)*s+4,h=(b.bottom-b.top)*s+4;
  if(!(w>0&&h>0&&Number.isFinite(w*h)))return null;
  const m=c.getTransform?.(),scale=m?Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d)):1;
  const ratio=Math.min(Math.max(1,scale),Math.sqrt(1.5e6/(w*h))),x=Math.floor((b.left*s-2)*ratio)/ratio,y=Math.floor((b.top*s-2)*ratio)/ratio;
  const W=Math.max(1,Math.ceil((b.right*s+2-x)*ratio)),H=Math.max(1,Math.ceil((b.bottom*s+2-y)*ratio));
  sourceLayer=layer(sourceLayer,W,H);weatherLayer=layer(weatherLayer,W,H);
  if(!sourceLayer||!weatherLayer)return null;
  const source=sourceLayer.getContext('2d'),weather=weatherLayer.getContext('2d');
  if(!source||!weather)return null;
  for(const ctx of [source,weather]){ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,W,H);ctx.globalAlpha=1;ctx.globalCompositeOperation='source-over';ctx.setTransform(ratio,0,0,ratio,-x*ratio,-y*ratio);}
  drawIntact(source);
  weatherSurface(weather,s,state,profile);
  // Clip soot, cracks and exposed material to the actual object, including gaps.
  weather.setTransform(1,0,0,1,0,0);weather.globalCompositeOperation='destination-in';weather.drawImage(sourceLayer,0,0);
  source.setTransform(1,0,0,1,0,0);source.drawImage(weatherLayer,0,0);
  return {canvas:sourceLayer,x,y,w:W/ratio,h:H/ratio};
}
function haze(c,x,y,r,color,alpha){
  c.save();c.globalAlpha*=alpha;
  const g=c.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,color);g.addColorStop(.42,color);g.addColorStop(1,color+'00');
  c.fillStyle=g;c.beginPath();c.arc(x,y,r,0,TAU);c.fill();c.restore();
}
function weatherSurface(c,s,state,profile){
  if(profile.surfaces?.length){weatherGeometry(c,s,state,profile);return;}
  const {bounds:b,family,seed}=profile;
  const hash=seedOf(seed),W=(b.right-b.left)*s,H=(b.bottom-b.top)*s,base=b.bottom*s;
  const masonry=['building','fort','landmark','bridge'].includes(family),metal=['vehicle','aircraft','gun'].includes(family),wood=['ship','goods','nature'].includes(family);
  const burned=state!=='damaged';
  c.fillStyle=burned?'rgba(24,20,17,.37)':'rgba(61,49,38,.12)';c.fillRect(b.left*s,b.top*s,W,H);
  for(let i=0;i<7;i++){
    const x=(b.left+.13*(b.right-b.left)+noise(hash,i)*.74*(b.right-b.left))*s;
    const y=base-H*(.14+noise(hash,i+20)*.7),r=Math.min(W,H)*(.1+noise(hash,i+40)*.12);
    haze(c,x,y,r*1.8,burned?'#191713':'#584a3b',burned?.8:.36);
    // Irregular impact cavities and scraped rims, rather than uniform zigzags.
    c.save();c.translate(x,y);c.rotate(noise(hash,i+60)*TAU);
    c.beginPath();for(let j=0;j<9;j++){const a=j*TAU/9,R=r*(.26+noise(hash,i*9+j+90)*.2);j?c.lineTo(Math.cos(a)*R,Math.sin(a)*R*.65):c.moveTo(Math.cos(a)*R,Math.sin(a)*R*.65);}c.closePath();
    c.fillStyle=metal?'#292c2a':wood?'#30261c':'#39372f';c.fill();c.strokeStyle=metal?'#b1aca0':wood?'#9e7952':'#b8ab91';c.lineWidth=Math.max(.45,s*.013);c.stroke();
    c.strokeStyle=burned?'#171614':'#39352e';c.lineWidth=Math.max(.5,s*.014);c.lineCap='round';
    for(let j=0;j<(masonry?4:2);j++){
      const a=j*TAU/(masonry?4:2)+noise(hash,i+j+150),L=r*(masonry?2.1:1.5);
      c.beginPath();c.moveTo(0,0);c.lineTo(Math.cos(a)*L*.4,Math.sin(a)*L*.4);c.lineTo(Math.cos(a+.3)*L*.7,Math.sin(a+.3)*L*.7);c.lineTo(Math.cos(a+.15)*L,Math.sin(a+.15)*L);c.stroke();
      if(masonry){c.beginPath();c.moveTo(Math.cos(a)*L*.4,Math.sin(a)*L*.4);c.lineTo(Math.cos(a-.65)*L*.7,Math.sin(a-.65)*L*.7);c.stroke();}
    }
    c.restore();
  }
  // Fine chipped edges and blistered paint stay stable while scrubbing.
  for(let i=0;i<42;i++){
    const x=b.left*s+noise(hash,i+300)*W,y=b.top*s+noise(hash,i+400)*H;
    c.fillStyle=i%3===0?(metal?'#afa99a':'#b2a082'):'#302b24';c.globalAlpha=.28+noise(hash,i+500)*.28;
    c.fillRect(x,y,s*(.012+noise(hash,i+600)*.034),s*.012);
  }
  c.globalAlpha=1;
}
function fireSites(s,profile){
  if(profile.sites)return profile.sites;
  const {bounds:b,family,seed}=profile,hash=seedOf(seed),W=(b.right-b.left)*s,H=(b.bottom-b.top)*s;
  const low=['vehicle','ship','aircraft','gun'].includes(family);
  return Array.from({length:3},(_,i)=>({x:b.left*s+W*(.24+i*.26),y:b.bottom*s-H*(low?.38:.27+noise(hash,i+700)*.35),h:Math.max(s*.45,Math.min(s*1.5,H*.55))*(.65+noise(hash,i+710)*.5)}));
}
function drawFire(c,s,seconds,profile){
  if(profile.surfaces?.length&&!profile.sites){drawDepthFire(c,s,seconds,profile);return;}
  const opacity=c.globalAlpha,hash=seedOf(profile.seed);let sites=fireSites(s,profile);
  c.save();
  // Flames and smoke rise on screen even when a vehicle is rotated or mirrored.
  const m=c.getTransform?.();
  if(m&&!profile.upright){
    const sx=Math.hypot(m.a,m.b),sy=Math.hypot(m.c,m.d);
    if(sx>0&&sy>0){sites=sites.map(site=>({...site,x:(m.a*site.x+m.c*site.y)/sx,y:(m.b*site.x+m.d*site.y)/sy}));c.setTransform(sx,0,0,sy,m.e,m.f);}
  }
  // Smoke is behind the flame: small dense bases expand into soft drifting plumes.
  const smokeCount=sites.length===1?12:36;
  for(let i=0;i<smokeCount;i++){
    const site=sites[i%sites.length],q=((seconds*.16+Math.floor(i/sites.length)/(smokeCount/sites.length)+(i%sites.length)*.18)%1+1)%1;
    const x=site.x+s*(q*q*.8+Math.sin(q*5+i%sites.length)*q*.12),y=site.y-site.h*.45-q*s*2.5;
    const r=s*(.13+q*.46),alpha=Math.sin(Math.PI*q)*.19;
    haze(c,x,y,r,q<.4?'#30312e':'#68675f',alpha);
  }
  for(let i=0;i<sites.length;i++){
    const site=sites[i];haze(c,site.x,site.y-site.h*.15,site.h*.85,'#ff6a16',.16);
    for(let j=0;j<5;j++){
      const pulse=.8+.14*Math.sin(seconds*9+i*2+j)+.08*Math.sin(seconds*17+j*3),h=site.h*pulse*(1-j*.1),w=s*(.12-j*.015);
      const x=site.x+(j-2)*s*.065,lean=Math.sin(seconds*6+i+j*.6)*s*.12+s*.07;
      const g=c.createLinearGradient(x,site.y,x,site.y-h);g.addColorStop(0,'#fff6bf');g.addColorStop(.23,'#ffd350');g.addColorStop(.58,'#f57a1e');g.addColorStop(.86,'#c33b1700');g.addColorStop(1,'#7b241000');
      c.globalAlpha=opacity*(.75+j*.045);c.fillStyle=g;c.beginPath();c.moveTo(x-w,site.y);c.bezierCurveTo(x-w*1.2,site.y-h*.4,x+lean-w*.4,site.y-h*.75,x+lean,site.y-h);c.bezierCurveTo(x+lean+w*.4,site.y-h*.58,x+w,site.y-h*.25,x+w,site.y);c.closePath();c.fill();
    }
  }
  for(let i=0;i<12;i++){
    const site=sites[i%sites.length],q=((seconds*.45+i*.217)%1+1)%1;
    c.globalAlpha=opacity*Math.sin(q*Math.PI)*.8;c.fillStyle=i%2?'#ffb044':'#ffe3a0';
    c.beginPath();c.ellipse(site.x+s*(q*.55+Math.sin(i*3+q*5)*.12),site.y-site.h*.5-q*s*1.65,Math.max(.4,s*.012),Math.max(.7,s*.026),.3,0,TAU);c.fill();
  }
  c.restore();
}

function outline(c,points,s=1){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*s,y*s):c.moveTo(x*s,y*s));c.closePath();}
function faceFrame(face){
  const a=face.points[0],A=face.world[0];
  for(let i=1;i<face.points.length-1;i++)for(let j=i+1;j<face.points.length;j++){
    const b=face.points[i],d=face.points[j],det=(b[0]-a[0])*(d[1]-a[1])-(b[1]-a[1])*(d[0]-a[0]);
    if(Math.abs(det)<1e-7)continue;
    return {a,b,d,A,B:face.world[i],D:face.world[j],det};
  }
}
function weatherGeometry(c,s,state,profile){
  const hash=seedOf(profile.seed),burned=state!=='damaged';
  for(const face of profile.surfaces){
    const frame=faceFrame(face);if(!frame)continue;
    const {a,b,d,A,B,D}=frame,U=Math.hypot(...B.map((v,i)=>v-A[i])),V=Math.hypot(...D.map((v,i)=>v-A[i]));
    c.save();outline(c,face.points,s);c.clip();
    // Foreground armor, wheels and windows cover marks on surfaces behind them.
    c.clearRect(profile.bounds.left*s-1,profile.bounds.top*s-1,(profile.bounds.right-profile.bounds.left)*s+2,(profile.bounds.bottom-profile.bounds.top)*s+2);
    if(['ground','shadow'].includes(face.material)||face.artwork){c.restore();continue;}
    c.fillStyle=burned?'rgba(27,23,20,.23)':'rgba(45,37,28,.12)';c.fill();
    c.transform((b[0]-a[0])*s/U,(b[1]-a[1])*s/U,(d[0]-a[0])*s/V,(d[1]-a[1])*s/V,a[0]*s,a[1]*s);
    const metal=['vehicle','aircraft','gun'].includes(profile.family)||['metal','rubber'].includes(face.material);
    const glass=face.material==='glass',wood=face.material==='wood'||profile.family==='ship';
    const id=face.id*37,count=U*V>.035&&noise(hash,id+1)<.95?Math.min(2,1+Math.floor(U*V*.7)):0;
    for(let i=0;i<count;i++){
      const x=U*(.22+noise(hash,id+i+2)*.56),y=V*(.2+noise(hash,id+i+6)*.6),r=Math.min(U,V,.8)*(.14+noise(hash,id+i+10)*.1);
      haze(c,x,y,r*3.2,burned?'#201b16':'#4a4137',burned?.55:.21);
      c.lineCap='round';c.lineJoin='round';c.lineWidth=metal?.012:.01;
      c.strokeStyle=metal?'rgba(18,21,20,.8)':wood?'rgba(34,24,16,.7)':'rgba(36,32,26,.7)';
      if(metal){
        // Shallow dents and scraped paint follow armor, rather than stone cracks.
        c.beginPath();c.ellipse(x,y,r,r*.48,-.45,0,TAU);c.fillStyle='#242724';c.fill();
        c.beginPath();c.moveTo(x-r*1.6,y+r*.65);c.lineTo(x+r*1.7,y-r*.8);c.stroke();
        c.strokeStyle='rgba(171,169,149,.55)';c.lineWidth=.004;c.beginPath();c.moveTo(x-r*1.5,y+r*.7);c.lineTo(x+r*1.6,y-r*.72);c.stroke();
      }else{
        for(let j=0;j<(glass?5:3);j++){
          const angle=j*TAU/(glass?5:3)+noise(hash,id+20),length=r*(glass?3.5:2.7);
          c.beginPath();c.moveTo(x,y);c.lineTo(x+Math.cos(angle)*length*.4,y+Math.sin(angle)*length*.4);
          c.lineTo(x+Math.cos(angle+.2)*length*.7,y+Math.sin(angle+.2)*length*.7);c.lineTo(x+Math.cos(angle+.1)*length,y+Math.sin(angle+.1)*length);c.stroke();
        }
      }
    }
    c.restore();
  }
}
export function damageFireSites(profile){
  if(!profile.surfaces?.length)return [];
  const hash=seedOf(profile.seed),candidates=[];
  for(const face of profile.surfaces){
    if(['ground','shadow','cloth'].includes(face.material)||face.artwork)continue;
    const f=faceFrame(face);if(!f)continue;
    const u=f.B.map((v,i)=>v-f.A[i]),v=f.D.map((q,i)=>q-f.A[i]),n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
    const area=Math.hypot(...n);if(area<.055||Math.abs(n[2])/area<.65)continue;
    const weights=face.world.map((_,i)=>.5+noise(hash,face.id*13+i)),sum=weights.reduce((a,b)=>a+b,0);
    const world=[0,1,2].map(axis=>face.world.reduce((total,p,i)=>total+p[axis]*weights[i]/sum,0));
    if(world[2]<.13)continue;
    const point=[0,1].map(axis=>face.points.reduce((total,p,i)=>total+p[axis]*weights[i]/sum,0));
    candidates.push({faceId:face.id,world,x:point[0],y:point[1],depth:profile.view==='side'?world[1]:world[0]+world[1]+world[2],h:.5+noise(hash,face.id+750)*.65,score:area*(.7+noise(hash,face.id+760)*.3)});
  }
  const sites=[];
  for(const site of candidates.sort((a,b)=>b.score-a.score)){
    if(sites.every(other=>Math.hypot(site.x-other.x,site.y-other.y)>.35))sites.push(site);
    if(sites.length===4)break;
  }
  return sites.sort((a,b)=>a.depth-b.depth);
}
export function fireOccluder(face,site,view){
  const f=faceFrame(face);if(!f)return [];
  const depth=p=>view==='side'?p[1]:p[0]+p[1]+p[2],{a,b,d,det}=f,da=depth(f.A),db=depth(f.B),dd=depth(f.D);
  const X=((db-da)*(d[1]-a[1])-(dd-da)*(b[1]-a[1]))/det,Y=((b[0]-a[0])*(dd-da)-(d[0]-a[0])*(db-da))/det,C=da-X*a[0]-Y*a[1];
  const diff=p=>X*p[0]+Y*p[1]+C-site.depth+(view==='side'?0:p[1]-site.y)-.015;
  const result=[];
  for(let i=0;i<face.points.length;i++){
    const p=face.points[i],q=face.points[(i+1)%face.points.length],dp=diff(p),dq=diff(q);
    if(dp>0)result.push(p);
    if((dp>0)!==(dq>0)){const t=dp/(dp-dq);result.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
  }
  return result;
}
function drawDepthFire(c,s,seconds,profile){
  const sites=damageFireSites(profile);if(!sites.length){drawFire(c,s,seconds,{...profile,surfaces:null});return;}
  const m=c.getTransform(),sx=Math.hypot(m.a,m.b),sy=Math.hypot(m.c,m.d);if(!sx||!sy)return;
  const upright=p=>[(m.a*p[0]+m.c*p[1])/sx,(m.b*p[0]+m.d*p[1])/sy];
  c.save();c.setTransform(sx,0,0,sy,m.e,m.f);
  for(const site of sites){
    const point=upright([site.x*s,site.y*s]),x=point[0]-s*1.1,y=point[1]-s*(site.h+3.1),w=s*3,h=s*(site.h+3.5);
    const ratio=Math.min(Math.max(1,sx,sy),Math.sqrt(1.5e6/(w*h))),W=Math.ceil(w*ratio),H=Math.ceil(h*ratio);
    fireLayer=layer(fireLayer,W,H);const target=fireLayer?.getContext('2d');if(!target)continue;
    target.setTransform(1,0,0,1,0,0);target.clearRect(0,0,W,H);target.globalCompositeOperation='source-over';target.globalAlpha=1;
    target.setTransform(ratio,0,0,ratio,-x*ratio,-y*ratio);
    drawFire(target,s,seconds+noise(seedOf(profile.seed),site.faceId)*2,{...profile,surfaces:null,sites:[{x:point[0],y:point[1],h:site.h*s}],upright:true});
    target.globalAlpha=1;target.globalCompositeOperation='destination-out';target.fillStyle='#000';
    for(const face of profile.surfaces){
      if(['ground','shadow'].includes(face.material))continue;
      const polygon=fireOccluder(face,site,profile.view);if(polygon.length<3)continue;
      outline(target,polygon.map(p=>upright([p[0]*s,p[1]*s])));target.fill();
    }
    c.drawImage(fireLayer,x,y,W/ratio,H/ratio);
  }
  c.restore();
}
function drawGeometryWreck(c,s,p,source,profile){
  if(p===0){c.drawImage(source.canvas,source.x,source.y,source.w,source.h);return;}
  const hash=seedOf(profile.seed),iso=profile.view!=='side',project=([x,y,z])=>iso?[(x-y)*.866025403784,(x+y)*.5-z]:[x,-z];
  const faces=[];
  for(const face of profile.surfaces){
    if(['ground','shadow'].includes(face.material)||face.artwork)continue;
    const delay=noise(hash,face.id)*.1,q=Math.max(0,Math.min(1,(p-delay)/(.8-delay))),fall=q*q*(3-2*q);
    const center=[0,1,2].map(axis=>face.world.reduce((sum,v)=>sum+v[axis],0)/face.world.length);
    const dx=(noise(hash,face.id+30)-.5)*.65,dy=(noise(hash,face.id+60)-.5)*.65;
    const vehicle=['vehicle','aircraft','gun'].includes(profile.family);
    const world=face.world.map(([x,y,z])=>[x+dx*fall,y+dy*fall,z*(1-fall)+Math.max(.015,.05+noise(hash,face.id+90)*.14+center[2]*(vehicle?.22:.12)+(z-center[2])*(vehicle?.45:.3)+(x-center[0])*(noise(hash,face.id+110)-.5)*.4)*fall+Math.sin(q*Math.PI)*.12]);
    faces.push({points:world.map(project),depth:world.reduce((sum,[x,y,z])=>sum+(iso?x+y+z:y),0)/world.length,color:face.color});
  }
  c.save();
  c.save();c.scale(1,iso?.48:.2);haze(c,0,0,s*1.3,'#292721',.22*Math.min(1,p*3));c.restore();
  for(const face of faces.sort((a,b)=>a.depth-b.depth)){
    outline(c,face.points,s);c.fillStyle=face.color||profile.color||'#59594d';c.fill();
    c.fillStyle='rgba(24,22,19,.32)';c.fill();c.strokeStyle='rgba(25,24,20,.35)';c.lineWidth=Math.max(.35,s*.005);c.stroke();
  }
  if(p<1)for(let i=0;i<9;i++){
    const q=Math.max(0,(p-.08)/.92),ground=project([(noise(hash,i+100)-.5)*2,(noise(hash,i+120)-.5)*1.3,0]);
    haze(c,ground[0]*s,ground[1]*s-s*q*.5,s*(.14+q*.45),'#9a8c77',Math.sin(q*Math.PI)*.22);
  }
  c.restore();
}
function drawWreck(c,s,p,source,profile){
  if(profile.surfaces?.length){drawGeometryWreck(c,s,p,source,profile);return;}
  const opacity=c.globalAlpha,hash=seedOf(profile.seed),b=profile.bounds;
  const masonry=['building','fort','landmark','bridge'].includes(profile.family),base=b.bottom*s,W=source.w,H=source.h;
  c.save();
  c.save();c.translate((b.left+b.right)*s/2,base);c.scale(1,.22);
  haze(c,0,0,Math.max(s*.6,W*.55),'#28251f',.35*Math.min(1,p*3));c.restore();
  // Fragments retain the original facade, hull, wheels and paint. Each section
  // falls separately, with a fixed trajectory rather than random per-frame noise.
  const cols=4,rows=3,sw=source.canvas.width/cols,sh=source.canvas.height/rows;
  for(let row=rows-1;row>=0;row--)for(let col=0;col<cols;col++){
    const i=row*cols+col,delay=noise(hash,i)*.12,q=Math.max(0,Math.min(1,(p-delay)/(.72-delay))),fall=q*q*(3-2*q);
    const ox=source.x+(col+.5)*W/cols,oy=source.y+(row+.5)*H/rows;
    const tx=ox+(noise(hash,i+30)-.5)*s*(row===rows-1?.35:1.2),ty=base-s*(.04+noise(hash,i+50)*.2);
    c.save();c.translate(ox+(tx-ox)*fall,oy+(ty-oy)*fall-Math.sin(q*Math.PI)*s*.15);
    c.rotate((noise(hash,i+70)-.5)*fall*(masonry?1.1:.65));c.scale(1+fall*.08,1-fall*(masonry?.58:.48));
    c.drawImage(source.canvas,col*sw,row*sh,sw,sh,-W/cols/2,-H/rows/2,W/cols,H/rows);c.restore();
  }
  // Small material fragments settle around the recognizable wreck.
  for(let i=0;i<24;i++){
    const q=Math.min(1,p*1.6),x=(b.left+(b.right-b.left)*noise(hash,i+100))*s+(noise(hash,i+130)-.5)*s*q;
    const y=base+s*(noise(hash,i+160)*.3-.05)-Math.sin(q*Math.PI)*s*(.25+noise(hash,i+190)*.65);
    c.globalAlpha=opacity*Math.min(1,p*8);c.save();c.translate(x,y);c.rotate(noise(hash,i+220)*TAU+q*2);
    c.fillStyle=masonry?(i%3?'#776e5c':'#b0a18a'):profile.family==='ship'?'#584431':i%3?'#414641':profile.color||'#6b7067';
    const r=s*(.035+noise(hash,i+250)*.06);c.beginPath();c.moveTo(-r,0);c.lineTo(-r*.3,-r*.7);c.lineTo(r,-r*.25);c.lineTo(r*.6,r*.4);c.closePath();c.fill();c.restore();
  }
  if(p>0&&p<1)for(let i=0;i<9;i++){
    const q=Math.max(0,(p-.08)/.92),x=(b.left+(b.right-b.left)*i/8)*s+s*q*.2,y=base-s*q*(.35+noise(hash,i+280)*.5);
    c.globalAlpha=opacity;haze(c,x,y,s*(.18+q*.5),masonry?'#a3947b':'#69675e',Math.sin(q*Math.PI)*.29);
  }
  c.restore();
}
