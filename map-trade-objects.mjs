import { box, shape, line, oval } from './map-miniature-drawing.mjs';

const wood='#b18a58',steel='#697e86',dark='#34434a',gold='#d5ad54';
function crate(c,s,x,y,r=.65){
  box(c,s,x,y,r,r,wood);
  for(const dx of [.12,.5])line(c,s,x+r*dx,y+.03,x+r*dx,y+r-.03,'#e1bf88',.035);
  line(c,s,x+.04,y+r-.06,x+r-.04,y+.06,'#7e5d3e',.05);
}
function container(c,s,x,y,col){
  box(c,s,x,y,1.22,.48,col);
  for(let i=1;i<9;i++)line(c,s,x+i*.13,y+.055,x+i*.13,y+.43,'#d6d0b7',.014);
}
function warehouse(c,s,col){
  box(c,s,-.8,-.45,1.6,1.1,col);
  shape(c,s,[[-.95,-.45],[0,-1.04],[.95,-.45]],'#697881');
  box(c,s,-.35,-.13,.7,.78,dark);
  for(let i=0;i<5;i++)line(c,s,-.3,-.08+i*.13,.3,-.08+i*.13,steel,.025);
  for(const x of [-.65,.48])box(c,s,x,-.25,.17,.23,'#b4d0cf');
}
function goods(c,s){crate(c,s,-.92,-.03,.8);crate(c,s,-.06,.04,.7);crate(c,s,-.47,-.7,.7);}
function trade(c,s,col,out){
  c.save();c.translate(s*.4,-s*.16);warehouse(c,s*.63,'#c2ae86');c.restore();
  crate(c,s,-1.05,.28,.55);
  c.save();c.translate(-.25*s,.1*s);if(out)c.scale(-1,1);
  shape(c,s,[[-.75,-.15],[.25,-.15],[.25,-.4],[.8,0],[.25,.4],[.25,.15],[-.75,.15]],col);c.restore();
}
function port(c,s,col){
  box(c,s,-1.08,.54,2.16,.17,'#a2987d');
  for(const x of [-.82,-.1,.72])box(c,s,x,.7,.12,.25,steel);
  line(c,s,-.65,.5,-.65,-1.25,steel,.13);line(c,s,-.9,-1.17,.98,-1.17,steel,.1);
  line(c,s,-.65,-1.12,.6,-1.12,gold,.06);line(c,s,-.65,-.4,.1,-1.12,steel,.045);
  line(c,s,.63,-1.12,.63,-.35,dark,.025);line(c,s,.5,-.31,.76,-.31,gold,.045);
  container(c,s,-.23,.04,col);
  for(const y of [.99,1.12])line(c,s,-1.05,y,1.05,y,'#6796a6',.035);
}
function sacks(c,s,col){
  for(const [x,y] of [[-.5,.12],[.35,.12],[0,-.51]]){
    oval(c,s,x,y,.38,.47,col);
    shape(c,s,[[x-.16,y-.34],[x-.23,y-.59],[x+.22,y-.59],[x+.14,y-.34]],col);
    line(c,s,x-.19,y-.36,x+.18,y-.36,dark,.04);
    for(let i=0;i<3;i++)line(c,s,x-.12+i*.12,y-.06,x-.06+i*.12,y+.14,'#e3cf9e',.03);
  }
}
function barrels(c,s,col){
  for(const [x,y] of [[-.45,-.1],[.43,.08]]){
    box(c,s,x-.32,y-.58,.64,1.08,col,.13);
    oval(c,s,x,y-.55,.32,.1,col);
    for(const h of [-.32,.22])line(c,s,x-.32,y+h,x+.32,y+h,steel,.09);
    oval(c,s,x,y-.55,.065,.025,dark);
  }
}
function coins(c,s){
  for(const [x,y,n] of [[-.6,.4,3],[0,.3,5],[.58,.5,2]])for(let i=0;i<n;i++){
    oval(c,s,x,y-i*.13,.31,.12,gold);line(c,s,x-.2,y-i*.13+.035,x+.2,y-i*.13+.035,'#f2d994',.02);
  }
}
const entry=(label,color,draw)=>({label,color,group:'trade',timeUnit:'seconds',draw:(c,s,col=color)=>draw(c,s,col)});
export const TRADE_OBJECTS={
  importGoods:entry('Import / incoming goods','#58a58b',(c,s,col)=>trade(c,s,col,false)),
  exportGoods:entry('Export / outgoing goods','#cf9850',(c,s,col)=>trade(c,s,col,true)),
  cargoCrates:entry('Cargo crates / merchandise',wood,goods),
  cargoContainers:entry('Shipping containers','#608e98',(c,s,col)=>{container(c,s,-1,-.1,col);container(c,s,-.58,-.62,'#b17a57');container(c,s,-.35,.42,'#8b9870');}),
  tradeWarehouse:entry('Trade warehouse','#b9a27d',warehouse),
  tradePort:entry('Trade port / loading crane','#608e98',port),
  grainSacks:entry('Grain / commodity sacks','#b5a075',sacks),
  tradeBarrels:entry('Oil / trade barrels','#9e7853',barrels),
  tradeCoins:entry('Gold / trade revenue',gold,coins),
};
