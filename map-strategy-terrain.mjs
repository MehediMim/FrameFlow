import { paintTerrainMaterial, terrainSprite } from './map-terrain-material.mjs';
// All variation is seeded, never frame-random.
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
    const x=x0+(col+.05+hash(col,row,seed)*.9)*step,y=y0+(row+.05+hash(row,col,seed+17)*.9)*step;
    if(inside(x,y))result.push({x,y,step,variant:hash(col,row,seed+39)});
  }
  return result;
}
function poly(c,points,color){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=color;c.fill();}
function ellipse(c,x,y,rx,ry,color){c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,Math.PI*2);c.fill();}
function shade(c,x,y,r,light,dark){const g=c.createRadialGradient(x-r*.3,y-r*.4,r*.05,x,y,r);g.addColorStop(0,light);g.addColorStop(1,dark);return g;}
export function drawTerrainMotif(c,kind,s,variant=0,seconds=0,color=null){
  c.save();
  c.scale(s,s);c.lineJoin='round';c.lineCap='round';
  if(['jungle','woodland','pineForest'].includes(kind)){
    ellipse(c,.23,.15,.82,.25,shade(c,.23,.15,.85,'#13251b65','#15251b00'));
    poly(c,[[-.07,.18],[-.05,-.72],[.07,-.72],[.1,.18]],'#67503a');
    c.strokeStyle='#ae9760';c.lineWidth=.025;c.beginPath();c.moveTo(-.025,.12);c.lineTo(-.02,-.6);c.stroke();
    if(kind==='pineForest'){
      for(let i=0;i<7;i++){
        const y=-1.55+i*.21,w=.14+i*.078,outline=[[0,y-.2]];
        for(let j=0;j<7;j++)outline.push([w*(j/6),y+.16+(j%2)*.065]);
        outline.push([w*.24,y+.26],[-w,y+.23]);
        const g=c.createLinearGradient(-w,0,w,0);g.addColorStop(0,'#78916a');g.addColorStop(.42,color||'#3e654b');g.addColorStop(1,'#1f3f33');poly(c,outline,g);
        c.strokeStyle='#9aa97755';c.lineWidth=.018;
        for(let j=0;j<5;j++){c.beginPath();c.moveTo(-w*.8+j*w*.3,y+.16);c.lineTo(j*w*.16-w*.25,y-.02);c.stroke();}
      }
    }else{
      const dark=kind==='jungle'?'#1d3d28':'#30482a',light=color||(kind==='jungle'?'#71924b':'#a0ac63');
      for(let i=0;i<28;i++){
        const angle=hash(i,5,Math.floor(variant*999))*Math.PI*2,r=Math.sqrt(hash(i,9,23))*.6,x=Math.cos(angle)*r,y=-.82+Math.sin(angle)*r*.68,sz=.18+hash(i,2,17)*.21;
        ellipse(c,x,y,sz,sz*.85,shade(c,x,y,sz,light,dark));
        for(let j=0;j<5;j++){const dx=(hash(i,j,61)-.5)*sz*1.5,dy=(hash(j,i,71)-.5)*sz;ellipse(c,x+dx,y+dy,.017,.009,'#d0d59a50');}
      }
      if(kind==='jungle'){c.strokeStyle='#9aa64b';c.lineWidth=.035;c.beginPath();c.moveTo(.26,-.8);c.quadraticCurveTo(.65,-.15,.22,.06);c.stroke();}
    }
  }else if(kind==='mountains'){
    ellipse(c,.22,.2,1.1,.27,'#28302b35');
    const peak=-.14+variant*.25,top=-1.12-variant*.32;
    const g=c.createLinearGradient(-1,-1,1,.3);g.addColorStop(0,'#c8c1a9');g.addColorStop(.48,color||'#969281');g.addColorStop(1,'#4f5853');
    poly(c,[[-1.1,.25],[-.83,-.3],[-.55,-.49],[peak,top],[.4,-.55],[.66,-.35],[1.13,.25]],g);
    poly(c,[[peak,top],[.4,-.55],[.66,-.35],[1.13,.25],[.36,.06],[.15,-.48]],'#4b534e80');
    for(let i=0;i<16;i++){
      const x=-.87+i*.115,y=top+(Math.abs(x-peak)*1.3);c.strokeStyle=i%3?'#333e364b':'#e3dac080';c.lineWidth=.014+hash(i,1,17)*.018;c.beginPath();c.moveTo(x,y);c.lineTo(x-.06,y+.22);c.lineTo(x+.08,y+.38);c.lineTo(x+.04,.18);c.stroke();
    }
    poly(c,[[peak-.24,top+.47],[peak,top],[peak+.26,top+.46],[peak+.12,top+.35],[peak+.04,top+.52],[peak-.07,top+.31]],'#e5e5dc');
    poly(c,[[-1.15,.27],[-.67,-.34],[-.41,-.13],[-.16,.27]],'#858b71');
    for(let i=0;i<25;i++){const x=-1+hash(i,3,19)*2,y=.04+hash(i,8,9)*.2;ellipse(c,x,y,.025+hash(i,2,4)*.04,.018,i%2?'#c0b89a':'#555d50');}
  }else if(kind==='hills'){
    for(const [x,y,r]of[[-.35,0,.78],[.25,.12,.7]]){
      const g=c.createLinearGradient(x-r,y-r*.5,x+r,y+.15);g.addColorStop(0,'#bec18a');g.addColorStop(.45,'#8b9c5d');g.addColorStop(1,'#4f693d00');c.fillStyle=g;c.beginPath();c.moveTo(x-r,y+.15);c.bezierCurveTo(x-r*.7,y-r,x+r*.2,y-r*.8,x+r,y+.15);c.closePath();c.fill();
      for(let i=0;i<26;i++){const dx=(hash(i,1,7)-.5)*r*1.4,dy=hash(i,4,4)*.2;c.strokeStyle='#d1cb8b60';c.lineWidth=.014;c.beginPath();c.moveTo(x+dx,y-dy);c.lineTo(x+dx+.015,y-dy-.045);c.stroke();}
    }
  }else if(kind==='desert'){
    const g=c.createLinearGradient(0,-.5,0,.3);g.addColorStop(0,'#f3d9a0');g.addColorStop(.35,'#d2ac6c');g.addColorStop(1,'#ad814900');c.fillStyle=g;c.beginPath();c.moveTo(-1.1,.25);c.bezierCurveTo(-.6,-.25,-.4,-.75,.15,-.32);c.quadraticCurveTo(.6,.13,1.1,.25);c.closePath();c.fill();
    poly(c,[[-.37,-.43],[.15,-.32],[1.1,.25],[.35,.05]],'#96704445');
    for(let i=0;i<9;i++){c.strokeStyle='#fff0bc55';c.lineWidth=.012;c.beginPath();c.moveTo(-.83+i*.055,.17-i*.035);c.quadraticCurveTo(-.3,-.36+i*.022,.3+i*.065,.19);c.stroke();}
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
    ellipse(c,0,.03,.9,.25,shade(c,0,.03,.9,'#f9faf0','#a6bcc300'));
    c.strokeStyle='#aebfb8';c.lineWidth=.04;c.beginPath();c.moveTo(-.7,.14);c.quadraticCurveTo(0,-.3,.7,.14);c.stroke();
    for(let i=0;i<6;i++){const x=(hash(i,3,37)-.5)*1.1,y=hash(i,2,31)*.15;ellipse(c,x,y,.02+hash(i,1,47)*.07,.015,'#a8bac080');}
  }else{
    c.strokeStyle=variant>.5?'#c5c57b':'#55763b';c.lineWidth=.065;
    for(let i=0;i<3;i++){c.beginPath();c.moveTo(i*.17-.17,.13);c.lineTo(i*.17-.26,-.17-(i%2)*.13);c.stroke();}
  }
  c.restore();
}
const terrainLayers=new WeakMap();
export function drawZoneLandscape(c,H,v,a,r,k,progress,seconds){
  let layer=terrainLayers.get(c);
  if(!layer){
    layer=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(v.W,v.H):typeof document!=='undefined'?document.createElement('canvas'):null;
    if(!layer){paintZoneLandscape(c,H,v,a,r,k,progress,seconds);return;}
    terrainLayers.set(c,layer);
  }
  if(layer.width!==v.W)layer.width=v.W;
  if(layer.height!==v.H)layer.height=v.H;
  const t=layer.getContext('2d');t.clearRect(0,0,v.W,v.H);
  t.beginPath();let count=0;
  for(let i=0;i<r.n;i++){
    const q=H.project(v,r.X[i]+k,r.Y[i]);if(q.z<v.near)continue;
    if(count++)t.lineTo(q.x,q.y);else t.moveTo(q.x,q.y);
  }
  if(count<3)return;
  t.closePath();
  paintZoneLandscape(t,H,v,{...a,terrainOpacity:1},r,k,1,seconds);
  // Erase toward the boundary with a smooth opacity ramp. The entire material,
  // including trees and fields, fades together without blurring interior detail.
  t.save();t.globalCompositeOperation='destination-out';t.strokeStyle='#000';t.lineJoin='round';t.setLineDash([]);
  const feather=18*v.unit,steps=24;
  // Painting motifs changes the current path, so rebuild the boundary for masking.
  t.beginPath();count=0;
  for(let i=0;i<r.n;i++){
    const q=H.project(v,r.X[i]+k,r.Y[i]);if(q.z<v.near)continue;
    if(count++)t.lineTo(q.x,q.y);else t.moveTo(q.x,q.y);
  }
  t.closePath();
  let previous=1;
  for(let i=steps;i>=0;i--){
    const x=i/steps,opacity=x*x*(3-2*x);
    t.lineWidth=2*feather*(i+.5)/steps;t.globalAlpha=1-opacity/previous;t.stroke();previous=opacity;
  }
  t.restore();
  c.save();c.globalAlpha=(a.terrainOpacity??.92)*progress;c.drawImage(layer,0,0);c.restore();
}
function paintZoneLandscape(c,H,v,a,r,k,progress,seconds){
  const kind=a.zoneTerrain;if(!kind||kind==='plain'||!Object.hasOwn(TERRAIN_COLORS,kind))return;
  c.save();c.clip();c.globalAlpha=(a.terrainOpacity??.92)*progress;
  c.fillStyle=TERRAIN_COLORS[kind];c.fillRect(0,0,v.W,v.H);
  const points=Array.from({length:r.n},(_,i)=>({x:r.X[i],y:r.Y[i]}));
  paintTerrainMaterial(c,H,v,points,k,kind,a.terrainSeed??0,a.terrainDensity??1,a.terrainScale??1);
  if(kind==='farmland'){c.restore();return;}
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
  for(const {q,size,variant}of visible){
    const forest=['jungle','woodland','pineForest'].includes(kind);
    const scale=size*(.65+variant*.7)*(forest?1.3:1);
    // Water retains its lightweight time-based ripples; static details are rasterized once.
    const sprite=kind==='river'?null:terrainSprite(kind,variant,drawTerrainMotif);
    if(sprite)c.drawImage(sprite,q.x-scale*1.6,q.y-scale*2,scale*3.2,scale*8/3);
    else{c.save();c.translate(q.x,q.y);drawTerrainMotif(c,kind,scale,variant,seconds);c.restore();}
  }
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
