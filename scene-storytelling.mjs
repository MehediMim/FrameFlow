// Timeline-safe helpers: every animated value is a function of scene time.
export const DEFAULT_ATMOSPHERE={clouds:0,rain:0,wind:0,windDirection:35,waterSpeed:0,shadowSoftness:0};
export const WEATHER_PRESETS={
  clear:{label:'Clear & calm',clouds:.15,rain:0,wind:.1,waterSpeed:.3,shadowSoftness:.65},
  breeze:{label:'Breezy afternoon',clouds:.45,rain:0,wind:.45,waterSpeed:.6,shadowSoftness:.75},
  rain:{label:'Rain shower',clouds:.8,rain:.65,wind:.4,waterSpeed:.8,shadowSoftness:.95},
  storm:{label:'Wind & heavy rain',clouds:1,rain:1,wind:.85,waterSpeed:1.2,shadowSoftness:1},
};
export const CARRY_PROPS={none:'Empty hands',box:'Parcel',bag:'Shopping bag',cup:'Cup'};
export const SCATTER_TYPES={tree:'Trees',pine:'Pines',bush:'Bushes',flowers:'Flowers',mixed:'Meadow mix'};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const smoothStep=u=>u*u*(3-2*u);
export function seededRandom(seed=7){let n=seed>>>0;return()=>((n=(Math.imul(n,1664525)+1013904223)>>>0)/4294967296);}
export function interpolatePose(a,b,u,easing='smooth'){
  const k=easing==='linear'?clamp(u,0,1):smoothStep(clamp(u,0,1));
  return{pos:a.pos.map((v,i)=>v+(b.pos[i]-v)*k),look:a.look.map((v,i)=>v+(b.look[i]-v)*k),fov:a.fov+(b.fov-a.fov)*k,hide:null};
}
export function cameraSpecFromPose(pose){return{mode:'third',move:'static',yaw:0,height:pose.pos[1],distance:12,fov:pose.fov,target:null,fixedX:pose.pos[0],fixedZ:pose.pos[2],aimX:pose.look[0],aimHeight:pose.look[1],aimZ:pose.look[2]};}
export function sampleCurve(points,subdivisions=10){
  if(points.length<2)return points.map(p=>({...p}));const out=[];
  for(let i=0;i<points.length-1;i++){
    const a=points[Math.max(0,i-1)],b=points[i],c=points[i+1],d=points[Math.min(points.length-1,i+2)];
    for(let j=0;j<subdivisions;j++){const u=j/subdivisions;const v=k=>.5*((2*b[k])+(-a[k]+c[k])*u+(2*a[k]-5*b[k]+4*c[k]-d[k])*u*u+(-a[k]+3*b[k]-3*c[k]+d[k])*u*u*u);out.push({x:v('x'),z:v('z')});}
  }
  out.push({...points.at(-1)});return out;
}
export function scatterPlants({x,z,radius=8,count=12,seed=7,type='mixed'},objects=[]){
  const random=seededRandom(seed),out=[],types=type==='mixed'?['bush','flowers','tree','flowers']: [type];
  for(let tries=0;out.length<count&&tries<count*35;tries++){
    const angle=random()*Math.PI*2,r=Math.sqrt(random())*radius,px=x+Math.cos(angle)*r,pz=z+Math.sin(angle)*r;
    if(px< -100||px>150||pz< -100||pz>150)continue;
    const blocked=objects.some(o=>{
      if(o.visible===false||['park','floor','hill','terrain'].includes(o.type))return false;
      const scale=o.scale??1,yaw=(o.rotation??0)*Math.PI/180,dx=px-o.x,dz=pz-o.z,lx=dx*Math.cos(yaw)-dz*Math.sin(yaw),lz=dx*Math.sin(yaw)+dz*Math.cos(yaw);
      if(o.curvePoints?.length>=2){const pts=sampleCurve(o.curvePoints,4);return pts.some(v=>Math.hypot(lx-v.x*scale,lz-v.z*scale)<(o.width??2)*scale/2+1);}
      return Math.abs(lx)<Math.max(1.4,(o.width??1)*scale/2+1)&&Math.abs(lz)<Math.max(1.4,(o.length??1)*scale/2+1);
    });
    if(blocked||out.some(o=>Math.hypot(px-o.x,pz-o.z)<1.6))continue;
    out.push({x:px,z:pz,type:types[Math.floor(random()*types.length)],scale:.65+random()*.65,rotation:random()*360-180});
  }
  return out;
}
export function drawClouds(ctx,W,H,atmosphere,t){
  const a={...DEFAULT_ATMOSPHERE,...atmosphere};if(!a.clouds)return;
  const random=seededRandom(41);ctx.save();ctx.globalAlpha=.3+a.clouds*.5;ctx.fillStyle=a.rain>.3?'#c3cbd0':'#fff9ec';
  for(let i=0;i<Math.round(3+a.clouds*10);i++){
    const size=(.04+random()*.06)*W,x=((random()*W+t*(2+a.wind*14))%(W+size*4))-size*2,y=(.03+random()*.3)*H;
    for(let j=0;j<4;j++){ctx.beginPath();ctx.ellipse(x+(j-1.5)*size*.5,y+(j%2)*size*.12,size*.6,size*.25,0,0,Math.PI*2);ctx.fill();}
  }
  ctx.restore();
}
export function drawRain(ctx,W,H,atmosphere,t){
  const a={...DEFAULT_ATMOSPHERE,...atmosphere};if(!a.rain)return;
  const random=seededRandom(83),slant=Math.sin(a.windDirection*Math.PI/180)*a.wind*25;
  ctx.save();ctx.strokeStyle='#d4e8ed';ctx.lineWidth=1;ctx.globalAlpha=.2+a.rain*.3;ctx.beginPath();
  for(let i=0;i<Math.round(a.rain*380);i++){
    const speed=.6+random()*.7,x0=random()*W,y0=random()*H;
    const y=(y0+t*H*speed)%(H+30)-20,x=((x0+t*slant*speed*10)%(W+60)+W+60)%(W+60)-30;
    ctx.moveTo(x,y);ctx.lineTo(x+slant*.4,y+10+speed*8);
  }
  ctx.stroke();ctx.restore();
}

export function validateStorytelling(p){
  const finite=(v,a,b)=>typeof v==='number'&&Number.isFinite(v)&&v>=a&&v<=b;
  const vector=(v,y0=0,y1=60)=>Array.isArray(v)&&v.length===3&&finite(v[0],-100,150)&&finite(v[1],y0,y1)&&finite(v[2],-100,150);
  const pose=v=>v&&vector(v.pos,1,60)&&vector(v.look)&&finite(v.fov,25,100);
  if(p.atmosphere!==undefined){
    if(!p.atmosphere||typeof p.atmosphere!=='object'||Array.isArray(p.atmosphere))throw Error('Invalid atmosphere');
    const a={...DEFAULT_ATMOSPHERE,...p.atmosphere};
    if(!['clouds','rain','wind','shadowSoftness'].every(k=>finite(a[k],0,1))||!finite(a.waterSpeed,0,2)||!finite(a.windDirection,-180,180))throw Error('Invalid atmosphere');
  }
  if(p.savedCameras!==undefined){const ids=new Set();if(!Array.isArray(p.savedCameras)||p.savedCameras.length>24)throw Error('Invalid saved cameras');for(const c of p.savedCameras){if(!c||typeof c.id!=='string'||ids.has(c.id)||typeof c.name!=='string'||c.name.length>120||!pose(c.pose))throw Error('Invalid saved camera');ids.add(c.id);}}
  for(const c of p.cameraClips){if((c.fromPose||c.toPose)&&(!pose(c.fromPose)||!pose(c.toPose)))throw Error('Invalid camera endpoints');if(c.easing!==undefined&&!['smooth','linear'].includes(c.easing))throw Error('Invalid camera easing');}
  if(p.terrain?.sculpt!==undefined){if(!Array.isArray(p.terrain.sculpt)||p.terrain.sculpt.length>160)throw Error('Invalid terrain sculpting');for(const b of p.terrain.sculpt){if(!b||!finite(b.x,-100,150)||!finite(b.z,-100,150)||!finite(b.radius,2,30)||!['raise','lower','flatten'].includes(b.mode)||!finite(b.amount,-4,4)||!finite(b.level,-5,35))throw Error('Invalid terrain brush');}}
  for(const o of p.objects){
    if(o.carry!==undefined&&!Object.hasOwn(CARRY_PROPS,o.carry))throw Error('Invalid carried prop');
    for(const key of ['seatId','talkTarget'])if(o[key]!==undefined&&o[key]!==null&&typeof o[key]!=='string')throw Error('Invalid interaction target');
    if(o.curvePoints!==undefined&&(!['path','river'].includes(o.type)||!Array.isArray(o.curvePoints)||o.curvePoints.length>24||o.curvePoints.some(v=>!v||!finite(v.x,-150,150)||!finite(v.z,-150,150))))throw Error('Invalid scenery curve');
  }
}
