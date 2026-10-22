import { box, shape, line, oval } from './map-miniature-drawing.mjs';
import { drawPlaqueText } from './map-plaque-text.mjs';

const gold = '#c7a469', ink = '#302622', stone = '#b1a184';
function arch(c,s) {
  c.beginPath(); c.moveTo(-.78*s,.67*s); c.lineTo(-.78*s,-.65*s);
  c.bezierCurveTo(-.78*s,-1.58*s,.78*s,-1.58*s,.78*s,-.65*s);
  c.lineTo(.78*s,.67*s); c.closePath();
}
export function drawPortrait(c,s,color,a={},image=null) {
  c.save(); c.shadowColor='rgba(0,0,0,.6)'; c.shadowBlur=s*.16; c.shadowOffsetY=s*.06;
  arch(c,s); c.fillStyle=color; c.fill(); c.shadowColor='transparent';
  c.save(); arch(c,s); c.clip();
  const glow=c.createRadialGradient(-.2*s,-.7*s,0,0,0,1.8*s);
  glow.addColorStop(0,'rgba(255,235,177,.23)'); glow.addColorStop(1,'rgba(0,0,0,.5)');
  c.fillStyle=glow; c.fillRect(-s,-1.6*s,2*s,2.4*s);
  if(image) {
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;
    const scale=Math.max(1.56*s/iw,2.04*s/ih)*(a.badgeZoom??1),w=iw*scale,h=ih*scale;
    c.drawImage(image,-w/2+(a.badgeX??0)*s/100,-.35*s-h/2+(a.badgeY??0)*s/100,w,h);
  } else {
    shape(c,s,[[-.65,.65],[-.5,-.02],[0,-.25],[.5,-.02],[.65,.65]],'#d4bd83');
    oval(c,s,0,-.58,.31,.43,'#ae7959');
    shape(c,s,[[-.34,-.83],[-.34,-1.08],[-.18,-.99],[0,-1.22],[.18,-.99],[.34,-1.08],[.34,-.83]],gold);
    for(const x of [-.12,.12])oval(c,s,x,-.62,.025,.025,ink);
    line(c,s,-.1,-.37,.1,-.37,ink,.025);
    for(const x of [-.36,0,.36])line(c,s,x,.1,x,.6,gold,.05);
  }
  c.restore(); arch(c,s); c.strokeStyle=a.badgeBorder||gold; c.lineWidth=s*.045; c.stroke();
  // A small quartered shield and folded name ribbon echo illuminated portraits.
  shape(c,s,[[-.99,.1],[-.55,.1],[-.57,.48],[-.77,.62],[-.97,.48]],gold);
  box(c,s,-.94,.15,.34,.26,color);
  line(c,s,-.77,.15,-.77,.48,gold,.035); line(c,s,-.94,.29,-.6,.29,gold,.035);
  shape(c,s,[[-1.02,.57],[-1.4,.52],[-1.25,.78],[-1.4,1.02],[-.88,.91]],color);
  shape(c,s,[[1.02,.57],[1.4,.52],[1.25,.78],[1.4,1.02],[.88,.91]],color);
  box(c,s,-1.13,.57,2.26,.43,color);
  if(a.showLabel!==false){
    drawPlaqueText(c,s,a,a.label||'Commander',0,.79*s,2.06*s,.37*s);
  }
  c.restore();
}
function tower(c,s,x,y,h,col,roof=false) {
  box(c,s,x-.2,y,.4,h,col);
  for(let i=0;i<3;i++)box(c,s,x-.23+i*.17,y-.12,.12,.18,col);
  box(c,s,x-.055,y+.21,.11,.23,ink);
  if(roof)shape(c,s,[[x-.29,y-.1],[x,y-.65],[x+.29,y-.1]],'#775665');
}
function castle(c,s,col,kind) {
  const hill=kind==='citadel',ruin=kind==='castleRuins';
  if(hill)shape(c,s,[[-1.35,.9],[-.9,.35],[.7,.25],[1.35,.9]],'#7b8265');
  box(c,s,-.93,-.15,1.86,.88,col);
  for(let i=0;i<10;i++)box(c,s,-.94+i*.2,-.29,.13,.24,col);
  tower(c,s,-.86,-.6,1.4,col,kind==='medievalCastle');
  tower(c,s,.86,ruin?-.12:-.6,ruin?.9:1.4,col,kind==='medievalCastle');
  if(!ruin)tower(c,s,0,kind==='castleKeep'?-1.45:-1.05,1.5,stone,kind==='medievalCastle');
  shape(c,s,[[-.21,.74],[-.21,.22],[0,.05],[.21,.22],[.21,.74]],ink);
  for(const x of [-.55,.55])for(const y of [.13,.38,.62])line(c,s,x-.13,y,x+.13,y,'#7d715e',.02);
  if(ruin)for(let i=0;i<5;i++)box(c,s,-.6+i*.27,.77+(i%2)*.06,.22,.14,col);
  else {line(c,s,0,-1.08,0,-1.73,gold,.025);shape(c,s,[[0,-1.73],[.45,-1.61],[0,-1.48]],'#944b52');}
}
const entry=(label,kind)=>({label,color:'#b1a184',group:'defense',historic:true,labelOffset:2.8,draw:(c,s,col)=>castle(c,s,col,kind)});
export const MEDIEVAL_OBJECTS={
  portrait:{label:'Ruler portrait / ribbon',color:'#62376f',group:'images',historic:true,draw:(c,s,col)=>drawPortrait(c,s,col)},
  medievalCastle:entry('Medieval castle','medievalCastle'),
  castleKeep:entry('Castle keep','castleKeep'),
  citadel:entry('Hilltop citadel','citadel'),
  castleRuins:entry('Castle ruins','castleRuins'),
};
