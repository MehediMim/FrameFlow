import { shape, box, line, oval, miniature } from './map-miniature-drawing.mjs';
import { drawTerrainMotif } from './map-strategy-terrain.mjs';

const wood='#795334',stone='#b9ab87',straw='#c0a259',ink='#3b382c';
function ground(c,s){shape(c,s,[[-1.25,.65],[0,.05],[1.25,.65],[0,1.17]],'#9c9a59');}
function house(c,s,color,{x=0,y=0,scale=1,roof=straw,tower=false}={}){
  c.save();c.translate(x*s,y*s);s*=scale;
  shape(c,s,[[-.8,-.1],[0,.25],[0,.93],[-.8,.56]],stone);
  shape(c,s,[[0,.25],[.8,-.1],[.8,.56],[0,.93]],'#8e8267');
  shape(c,s,[[-.98,-.1],[-.2,-.88],[.97,-.35],[.12,.45]],roof);
  shape(c,s,[[.97,-.35],[.97,-.08],[.12,.62],[.12,.45]],'#8c633c');
  box(c,s,-.55,.27,.21,.39,wood);box(c,s,.33,.27,.18,.2,ink);
  line(c,s,-.76,.02,-.76,.53,wood,.04);line(c,s,-.1,.36,-.1,.84,wood,.04);
  line(c,s,-.8,.25,-.05,.6,wood,.045);
  if(tower){box(c,s,.2,-.9,.52,.98,stone);shape(c,s,[[.1,-.9],[.46,-1.42],[.83,-.9]],color);box(c,s,.38,-.65,.13,.22,ink);}
  else {box(c,s,.48,-.95,.15,.42,'#928674');line(c,s,-.2,-.88,.12,.42,'#e3c77b',.03);}
  c.restore();
}
function flag(c,s,color,x=.2,y=-1.3){line(c,s,x,y,x,y+.7,wood,.035);shape(c,s,[[x,y],[x+.44,y+.13],[x,y+.28]],color);}
function wheel(c,s,x,y){oval(c,s,x,y,.22,.25,'#503c2b');oval(c,s,x,y,.1,.13,'#aa8652');}
function building(c,s,color,t,kind){
  ground(c,s);
  if(kind==='farm'){
    for(let y=0;y<3;y++)for(let x=0;x<4;x++){c.save();c.translate((x-.5*y-1)*s*.4,(y*.21+.24)*s);drawTerrainMotif(c,'farmland',s*.33);c.restore();}
    return;
  }
  if(kind==='castle'){
    house(c,s,color,{scale:1.05,roof:'#77817b',tower:true});
    for(const x of[-.83,.76]){box(c,s,x-.2,-.5,.4,1.1,stone);for(let j=0;j<3;j++)box(c,s,x-.23+j*.16,-.66,.12,.22,stone);box(c,s,x-.06,-.25,.12,.27,ink);}
    flag(c,s,color,.45,-1.9);return;
  }
  if(kind==='dock'){
    shape(c,s,[[-1.3,.6],[.2,-.1],[1.4,.6],[-.2,1.25]],'#4e9fa8');
    for(let i=0;i<8;i++)line(c,s,-1+i*.25,.5-i*.1,-.2+i*.25,1-i*.1,'#9c764c',.11);
    house(c,s,color,{x:-.4,y:-.2,scale:.6,roof:color});
    shape(c,s,[[.25,.35],[1.1,.68],[.85,.91],[.04,.57]],wood);line(c,s,.65,.68,.65,-.46,wood,.035);shape(c,s,[[.68,-.4],[1.12,.35],[.68,.23]],'#eee1b5');return;
  }
  if(kind==='lumber'){
    house(c,s,color,{x:.25,scale:.7,roof:color});
    for(let i=0;i<5;i++){line(c,s,-1+i*.14,.48-i*.12,-.2+i*.14,.78-i*.12,wood,.15);oval(c,s,-1+i*.14,.48-i*.12,.07,.075,'#cead6c');}
    c.save();c.translate(-s*.7,-s*.45);drawTerrainMotif(c,'pineForest',s*.55);c.restore();return;
  }
  if(kind==='mine'){
    shape(c,s,[[-1.05,.55],[-.7,-.65],[.1,-1.02],[.7,.7]],'#8b8b79');
    shape(c,s,[[-.6,.58],[-.6,-.04],[-.27,-.25],[.1,-.04],[.1,.72]],ink);
    line(c,s,-.65,.6,-.65,-.1,wood,.13);line(c,s,.17,.73,.17,.02,wood,.13);line(c,s,-.65,-.1,.17,.02,wood,.13);
    for(const [x,y]of[[.58,.45],[.82,.67],[.38,.75]])shape(c,s,[[x-.2,y],[x-.1,y-.25],[x+.17,y-.18],[x+.2,y+.08]],'#d6ae48');return;
  }
  if(kind==='market'){
    house(c,s,color,{x:-.35,y:-.15,scale:.65,roof:'#a37b4c'});
    for(const x of[-.62,.58]){for(const dx of[-.35,.35])line(c,s,x+dx,.12,x+dx,.74,wood,.035);shape(c,s,[[x-.46,.16],[x,-.2],[x+.46,.16],[x,.38]],color);box(c,s,x-.36,.56,.72,.2,wood);for(let i=0;i<4;i++)oval(c,s,x-.23+i*.15,.5,.08,.07,i%2?'#b9a057':'#8d5d36');}
    return;
  }
  if(kind==='windmill'){
    shape(c,s,[[-.45,.7],[-.3,-.75],[.3,-.75],[.5,.7]],stone);shape(c,s,[[-.5,-.75],[0,-1.27],[.5,-.75]],color);box(c,s,-.1,.31,.23,.38,wood);
    c.save();c.translate(0,-s*.44);c.rotate(t*.7);for(let i=0;i<4;i++){c.rotate(Math.PI/2);line(c,s,0,0,.9,0,wood,.055);shape(c,s,[[.2,-.04],[.9,-.04],[.86,.2],[.24,.13]],'#e4d6ad');}oval(c,s,0,0,.1,.1,wood);c.restore();return;
  }
  if(kind==='monastery'){
    house(c,s,color,{roof:color,tower:true});line(c,s,.46,-1.42,.46,-1.82,stone,.045);line(c,s,.3,-1.67,.62,-1.67,stone,.045);return;
  }
  house(c,s,color,{roof:['townCenter','barracks','archery','stable','workshop'].includes(kind)?color:straw,tower:kind==='townCenter'});
  if(kind==='townCenter'){flag(c,s,color,.46,-1.9);box(c,s,-.95,.5,.6,.16,wood);}
  if(kind==='barracks'){line(c,s,-.95,.5,-.95,-.9,wood,.04);shape(c,s,[[-1.08,-.92],[-.95,-1.25],[-.82,-.92]],'#bec5bd');flag(c,s,color,.55,-1.4);}
  if(kind==='archery'){oval(c,s,-.75,.55,.3,.32,'#e2d3a7');oval(c,s,-.75,.55,.21,.23,color);oval(c,s,-.75,.55,.1,.11,'#e2d3a7');}
  if(kind==='stable'){
    shape(c,s,[[.4,.75],[.36,.22],[.56,-.06],[.92,.03],[.7,.17],[.71,.52]],'#86603e');line(c,s,.44,.61,.44,.94,wood,.05);line(c,s,.68,.58,.73,.91,wood,.05);}
  if(kind==='forge'){
    box(c,s,.6,-1.05,.21,.94,'#877969');shape(c,s,[[-.9,.55],[-.34,.72],[-.32,.9],[-.88,.74]],'#46504a');line(c,s,-.6,.72,-.6,1,wood,.08);
    for(let i=0;i<3;i++){c.save();c.globalAlpha=.23*(1-i/3);oval(c,s,.7+Math.sin(t+i)*.07,-1.2-i*.23,.12+i*.04,.16,'#b6b4a1');c.restore();}}
  if(kind==='granary'){for(const x of[-.75,-.33,.12])oval(c,s,x,.85,.18,.24,'#c5ad73');}
  if(kind==='workshop'){for(const x of[-.62,.55])wheel(c,s,x,.72);line(c,s,-.8,.48,.73,.48,wood,.1);}
}
function person(c,s,color,t,kind){
  const stride=Math.sin(t*5)*.09;
  oval(c,s,0,-.7,.18,.2,'#c49a6d');shape(c,s,[[-.25,-.47],[.2,-.47],[.31,.19],[-.28,.19]],color);
  line(c,s,-.13,.15,-.19-stride,.7,wood,.11);line(c,s,.12,.15,.2+stride,.7,wood,.11);
  line(c,s,-.23,-.34,-.42,.03,'#c49a6d',.1);line(c,s,.2,-.34,.43,-.16,'#c49a6d',.1);
  if(kind==='villager'){line(c,s,.42,-.65,.42,.65,wood,.04);shape(c,s,[[.27,-.68],[.57,-.68],[.53,-.45],[.3,-.47]],'#8e9b97');}
  if(kind==='spearman'){line(c,s,.43,-1.37,.43,.7,wood,.045);shape(c,s,[[.33,-1.37],[.43,-1.7],[.53,-1.37]],'#c2cecb');oval(c,s,-.34,-.05,.23,.34,stone);}
  if(kind==='archer'){c.beginPath();c.arc(.43*s,-.15*s,.65*s,-1.4,1.4);c.strokeStyle=wood;c.lineWidth=.04*s;c.stroke();line(c,s,.54,-.79,.54,.49,'#d5c9a0',.02);line(c,s,.3,-.1,1.05,-.1,wood,.025);}
}
const buildingEntry=(label,kind)=>miniature(label,'#a14f3d','kingdom',(c,s,col,t)=>building(c,s,col,t,kind));
const natureEntry=(label,kind)=>miniature(label,TERRAIN_OBJECT_COLOR[kind]||'#70924b','kingdom',(c,s,col,t)=>{c.save();c.globalAlpha*=.95;drawTerrainMotif(c,kind,s,0,t,col);c.restore();});
const TERRAIN_OBJECT_COLOR={jungle:'#426e35',pineForest:'#4e7652',mountains:'#929183'};
export const STRATEGY_OBJECTS={
  kingdomTownCenter:buildingEntry('Town center','townCenter'),kingdomHouse:buildingEntry('Thatched cottage','house'),
  kingdomBarracks:buildingEntry('Kingdom barracks','barracks'),kingdomArchery:buildingEntry('Archery range','archery'),
  kingdomStable:buildingEntry('Horse stable','stable'),kingdomMarket:buildingEntry('Village market','market'),
  kingdomForge:buildingEntry('Blacksmith forge','forge'),kingdomWindmill:buildingEntry('Working windmill','windmill'),
  kingdomFarm:buildingEntry('Cultivated farm plot','farm'),kingdomGranary:buildingEntry('Grain store','granary'),
  kingdomLumber:buildingEntry('Lumber camp','lumber'),kingdomMine:buildingEntry('Gold mining camp','mine'),
  kingdomMonastery:buildingEntry('Stone monastery','monastery'),kingdomWorkshop:buildingEntry('Siege workshop','workshop'),
  kingdomDock:buildingEntry('Timber dock','dock'),kingdomCastle:buildingEntry('Kingdom castle','castle'),
  kingdomVillager:miniature('Village worker','#a96e43','kingdom',(c,s,col,t)=>person(c,s,col,t,'villager')),
  kingdomSpearman:miniature('Kingdom spearman','#a14f3d','kingdom',(c,s,col,t)=>person(c,s,col,t,'spearman')),
  kingdomArcher:miniature('Kingdom archer','#557d48','kingdom',(c,s,col,t)=>person(c,s,col,t,'archer')),
  kingdomJungle:natureEntry('Tropical tree','jungle'),kingdomWoodland:natureEntry('Broadleaf tree','woodland'),
  kingdomPine:natureEntry('Pine tree','pineForest'),kingdomMountain:natureEntry('Rocky mountain','mountains'),
  kingdomGold:miniature('Gold deposit','#d6ae48','kingdom',(c,s,col)=>{for(const [x,y]of[[-.5,.15],[.12,.4],[.45,-.1]])shape(c,s,[[x-.34,y],[x-.16,y-.5],[x+.24,y-.4],[x+.4,y+.1]],col);})
};
