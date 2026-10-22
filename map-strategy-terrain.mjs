// Original illustrated strategy-map terrain. All variation is seeded, never frame-random.
export const ZONE_TERRAINS = {
  plain:'Plain color', grassland:'Grassland', jungle:'Jungle', woodland:'Woodland',
  pineForest:'Pine forest', mountains:'Mountains', hills:'Rolling hills',
  river:'River / flowing water', lake:'Lake', desert:'Desert dunes',
  snow:'Snowfields', marsh:'Marsh / wetlands', farmland:'Farmland'
};
export const TERRAIN_COLORS={grassland:'#80a04b',jungle:'#426e35',woodland:'#729047',pineForest:'#62816a',mountains:'#929183',hills:'#8d9c58',river:'#4c9fae',lake:'#4a94b0',desert:'#d3b875',snow:'#dce4dc',marsh:'#6d9272',farmland:'#9fa553'};
const hash=(x,y,seed=0)=>{let n=Math.imul(x|0,374761393)^Math.imul(y|0,668265263)^Math.imul(seed|0,1274126177);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967296;};
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export function validateZoneTerrain(a){
  if(a.zoneTerrain!==undefined&&!Object.hasOwn(ZONE_TERRAINS,a.zoneTerrain))throw Error('Invalid zone landscape.');
  for(const [key,lo,hi]of[['terrainDensity',.3,2],['terrainScale',.5,2.5],['terrainOpacity',0,1],['terrainSeed',0,9999]])if(a[key]!==undefined&&(!Number.isFinite(a[key])||a[key]<lo||a[key]>hi||key==='terrainSeed'&&!Number.isInteger(a[key])))throw Error('Invalid zone landscape settings.');
}
// Anchor details to geographic geometry rather than screen pixels or playback order.
export function landscapePlacements(points,density=1,seed=0){
  if(points.length<3)return[];
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x0=Math.min(...xs),y0=Math.min(...ys),x1=Math.max(...xs),y1=Math.max(...ys);
  const step=Math.max(x1-x0,y1-y0)/Math.max(4,16*Math.sqrt(clamp(density,.3,2)));
  if(!Number.isFinite(step)||step<=0)return[];
  const inside=(x,y)=>{let yes=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)yes=!yes;}return yes;};
  const result=[];
  for(let row=0;row<48&&y0+(row+.25)*step<y1;row++)for(let col=0;col<48&&x0+(col+.25)*step<x1;col++){
    const x=x0+(col+.2+hash(col,row,seed)*.6)*step,y=y0+(row+.2+hash(row,col,seed+17)*.6)*step;
    if(inside(x,y))result.push({x,y,step,variant:hash(col,row,seed+39)});
  }
  return result;
}
function poly(c,points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
export function drawTerrainMotif(c,kind,s,variant=0,seconds=0,color=null){
  c.save();
  c.scale(s,s);c.lineJoin='round';c.lineCap='round';
  if(['jungle','woodland','pineForest'].includes(kind)){
    c.fillStyle='#182e2440';c.beginPath();c.ellipse(.12,.19,.72,.25,0,0,Math.PI*2);c.fill();
    c.fillStyle='#62482b';c.fillRect(-.085,-.45,.17,.7);
    if(kind==='pineForest'){
      for(let i=0;i<3;i++){const y=-1.25+i*.35,w=.36+i*.16;poly(c,[[-w,y+.6],[0,y-.15],[w,y+.6]],['#315842',color||'#426c4c','#537d53'][i]);poly(c,[[0,y-.15],[w,y+.6],[.08,y+.55]],'#254b3a');}
    }else{
      const palette=kind==='jungle'?['#284e2d','#366a35','#4b813d']:['#47682d','#63853a','#88a04c'];
      if(color)palette[1]=color;
      for(const [x,y,r,i]of[[-.35,-.6,.44,0],[.34,-.63,.47,0],[0,-1.05,.51,1],[-.17,-1.1,.25,2]]){c.fillStyle=palette[i];c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fill();}
      if(kind==='jungle'){c.strokeStyle='#9aa64b';c.lineWidth=.035;c.beginPath();c.moveTo(.26,-.8);c.quadraticCurveTo(.65,-.15,.22,.06);c.stroke();}
    }
  }else if(kind==='mountains'){
    poly(c,[[-.95,.25],[-.12,-1.24],[.98,.25]],color||'#716f61');poly(c,[[-.12,-1.24],[.98,.25],[.23,.13]],'#aaa58e');
    poly(c,[[-.48,-.6],[-.12,-1.24],[.34,-.6],[.09,-.69],[-.05,-.53],[-.22,-.75]],'#eee9cf');
    poly(c,[[-1.1,.3],[-.58,-.47],[.04,.3]],'#8a8a72');
  }else if(kind==='hills'){
    for(const [x,y,r,col]of[[-.35,0,.7,'#677d40'],[.25,-.1,.6,'#98aa5b']]){c.fillStyle=col;c.beginPath();c.ellipse(x,y,r,r*.5,0,Math.PI,Math.PI*2);c.lineTo(x+r,y+.15);c.lineTo(x-r,y+.15);c.closePath();c.fill();}
  }else if(kind==='desert'){
    c.fillStyle='#c5a163';c.beginPath();c.moveTo(-1,.2);c.quadraticCurveTo(-.1,-.7,.95,.2);c.closePath();c.fill();
    c.fillStyle='#edcf8a';c.beginPath();c.moveTo(-1,.2);c.quadraticCurveTo(-.15,-.7,.95,.2);c.quadraticCurveTo(.08,-.16,-1,.2);c.fill();
  }else if(kind==='farmland'){
    poly(c,[[-.9,0],[0,-.45],[.9,0],[0,.45]],'#80613a');
    for(let i=0;i<6;i++){const x=-.65+i*.22;c.strokeStyle=i%2?'#c1b45c':'#879344';c.lineWidth=.08;c.beginPath();c.moveTo(x,-.02);c.lineTo(x+.52,.24);c.stroke();}
  }else if(kind==='river'||kind==='lake'||kind==='marsh'){
    const shift=kind==='river'?Math.sin(seconds*1.2+variant*6)*.12:0;
    const opacity=c.globalAlpha;
    c.strokeStyle=kind==='marsh'?'#a9c7a0':'#a8e2dd';c.lineWidth=.045;c.globalAlpha*=.65;
    for(let i=0;i<3;i++){const y=-.4+i*.24;c.beginPath();c.moveTo(-.65+shift,y);c.quadraticCurveTo(0,y+.16,.65+shift,y);c.stroke();}
    if(kind==='marsh'){c.globalAlpha=opacity;c.strokeStyle='#4c663c';for(let i=0;i<4;i++){c.beginPath();c.moveTo(i*.18-.3,.3);c.lineTo(i*.18-.4,-.35-i*.04);c.stroke();}}
  }else if(kind==='snow'){
    c.strokeStyle='#aebfb8';c.lineWidth=.04;c.beginPath();c.moveTo(-.7,.14);c.quadraticCurveTo(0,-.3,.7,.14);c.stroke();
    poly(c,[[-.3,-.06],[-.1,-.43],[.19,-.06]],'#f6f5e9');
  }else{
    c.strokeStyle=variant>.5?'#c5c57b':'#55763b';c.lineWidth=.065;
    for(let i=0;i<3;i++){c.beginPath();c.moveTo(i*.17-.17,.13);c.lineTo(i*.17-.26,-.17-(i%2)*.13);c.stroke();}
  }
  c.restore();
}
export function drawZoneLandscape(c,H,v,a,r,k,progress,seconds){
  const kind=a.zoneTerrain;if(!kind||kind==='plain'||!Object.hasOwn(TERRAIN_COLORS,kind))return;
  c.save();c.clip();c.globalAlpha=(a.terrainOpacity??.92)*progress;
  c.fillStyle=TERRAIN_COLORS[kind];c.fillRect(0,0,v.W,v.H);
  const points=Array.from({length:r.n},(_,i)=>({x:r.X[i],y:r.Y[i]}));
  const visible=[];
  const density=(a.terrainDensity??1)*(kind==='mountains'?.3:kind==='hills'?.55:1);
  for(const entry of landscapePlacements(points,density,a.terrainSeed??0)){
    const q=H.project(v,entry.x+k,entry.y),next=H.project(v,entry.x+k+entry.step,entry.y);
    if(q.z<v.near||next.z<v.near||![q.x,q.y,next.x,next.y].every(Number.isFinite))continue;
    const size=clamp(Math.hypot(next.x-q.x,next.y-q.y)*.55*(a.terrainScale??1),3*v.unit,65*v.unit);
    if(q.x< -size*2||q.x>v.W+size*2||q.y< -size*2||q.y>v.H+size*2)continue;
    visible.push({...entry,q,size});
  }
  visible.sort((a,b)=>a.q.y-b.q.y);
  for(const {q,size,variant}of visible){c.save();c.translate(q.x,q.y);drawTerrainMotif(c,kind,size*(.8+variant*.35),variant,seconds);c.restore();}
  c.restore();
}
const patterns=new WeakMap();
export function strategyGroundPattern(c,color,water=false){
  let cache=patterns.get(c);if(!cache){cache=new Map();patterns.set(c,cache);}
  const key=color+water;if(cache.has(key))return cache.get(key);
  const tile=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(64,32):typeof document!=='undefined'?document.createElement('canvas'):null;
  if(!tile)return color;
  tile.width=64;tile.height=32;const p=tile.getContext('2d');p.fillStyle=color;p.fillRect(0,0,64,32);
  if(water){p.strokeStyle='#b3dfd03a';p.lineWidth=1;for(const [x,y]of[[4,8],[35,23]]){p.beginPath();p.moveTo(x,y);p.quadraticCurveTo(x+8,y+3,x+18,y);p.stroke();}}
  else{
    p.strokeStyle='#304b2820';p.beginPath();p.moveTo(0,16);p.lineTo(32,0);p.lineTo(64,16);p.lineTo(32,32);p.closePath();p.stroke();
    p.strokeStyle='#d5d88c60';p.lineWidth=.8;for(const [x,y]of[[9,9],[38,20],[55,7]]){p.beginPath();p.moveTo(x,y+2);p.lineTo(x-1,y-1);p.moveTo(x,y+2);p.lineTo(x+2,y-2);p.stroke();}
  }
  const pattern=c.createPattern(tile,'repeat');cache.set(key,pattern||color);return pattern||color;
}
