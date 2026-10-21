// Recognizable architectural miniatures, drawn entirely in vectors for video export.
import { INK, IVORY, GLASS, shape, box, line, oval, arch, miniature } from './map-miniature-drawing.mjs';
const stone='#d5bd91',shadow='#7b8078';
function plinth(c,s,col,w=1.7){box(c,s,-w/2,.62,w,.12,col);}
function eiffel(c,s,col){
  for(const side of [-1,1]){
    shape(c,s,[[side*.03,-1.25],[side*.15,-.37],[side*.6,.64],[side*.83,.64],[side*.3,-.4],[side*.09,-1.25]],col);
    for(let i=0;i<6;i++){const y=-.35+i*.16,x=.19+i*.075;line(c,s,side*x,y,side*(x+.23),y+.16,IVORY,.015);line(c,s,side*(x+.15),y,side*(x+.075),y+.16,INK,.017);}
  }
  line(c,s,0,-1.5,0,-1.21,col,.035);box(c,s,-.2,-.5,.4,.075,col);box(c,s,-.43,.05,.86,.09,col);
  line(c,s,-.55,.59,0,.24,col,.065);line(c,s,0,.24,.55,.59,col,.065);plinth(c,s,col);
}
function liberty(c,s,col,t){
  box(c,s,-.39,.32,.78,.3,stone);box(c,s,-.46,.6,.92,.14,stone);
  shape(c,s,[[-.32,.32],[-.18,-.46],[.16,-.46],[.31,.32]],col);
  for(const x of [-.17,-.04,.1])line(c,s,x,-.3,x*.8,.27,IVORY,.016);
  line(c,s,-.16,-.36,-.46,-.93,col,.14);line(c,s,-.46,-.93,-.5,-1.14,col,.1);
  box(c,s,-.57,-1.23,.14,.16,stone);shape(c,s,[[-.56,-1.23],[-.62,-1.38],[-.52,-1.57],[-.44,-1.38],[-.44,-1.23]],'#e3ac50');
  line(c,s,-.52,-1.28,-.52,-1.4-.025*Math.sin(t*3),IVORY,.035);
  oval(c,s,0,-.69,.16,.2,col);for(let i=0;i<7;i++){const a=Math.PI+i*Math.PI/6;line(c,s,Math.cos(a)*.16,-.7+Math.sin(a)*.15,Math.cos(a)*.28,-.7+Math.sin(a)*.28,col,.035);}
  shape(c,s,[[.17,-.4],[.4,-.3],[.33,.06],[.13,-.02]],'#8ba898');
}
function taj(c,s,col){
  plinth(c,s,stone,2.2);box(c,s,-.66,-.03,1.32,.64,col);
  for(const x of [-.88,.88]){box(c,s,x-.055,-.68,.11,1.3,col);for(const y of [-.64,-.12,.42])box(c,s,x-.09,y,.18,.055,stone);oval(c,s,x,-.76,.1,.1,col);line(c,s,x,-.97,x,-.84,stone,.025);}
  for(const x of [-.43,.43]){box(c,s,x-.13,-.26,.26,.25,col);oval(c,s,x,-.31,.15,.12,col);}
  box(c,s,-.27,-.44,.54,.43,col);oval(c,s,0,-.6,.36,.32,col);shape(c,s,[[-.28,-.79],[0,-1.1],[.28,-.79]],col);line(c,s,0,-1.25,0,-1.06,stone,.028);
  arch(c,s,-.17,.03,.34,.57,shadow);for(const x of [-.52,.34])arch(c,s,x,.17,.18,.33,shadow);line(c,s,-.63,.52,.63,.52,stone,.025);
}
function bigBen(c,s,col){
  box(c,s,-.29,-.61,.58,1.24,col);for(const x of [-.2,-.06,.08])box(c,s,x,-.18,.09,.7,shadow);
  box(c,s,-.34,-1.04,.68,.5,col);oval(c,s,0,-.8,.2,.2,IVORY);line(c,s,0,-.8,0,-.94,INK,.025);line(c,s,0,-.8,.11,-.74,INK,.025);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;line(c,s,Math.cos(a)*.16,-.8+Math.sin(a)*.16,Math.cos(a)*.18,-.8+Math.sin(a)*.18,INK,.014);}
  shape(c,s,[[-.3,-1.07],[0,-1.52],[.3,-1.07]],'#607575');line(c,s,0,-1.68,0,-1.5,col,.03);
  for(const x of [-.29,.29]){box(c,s,x-.025,-1.2,.05,.25,col);line(c,s,x,-1.28,x,-1.2,col,.025);}plinth(c,s,col,.85);
}
function colosseum(c,s,col){
  oval(c,s,0,-.42,1,.3,col);oval(c,s,0,-.43,.73,.16,shadow);
  shape(c,s,[[-1,-.42],[-.85,-.19],[0,-.05],[.85,-.19],[1,-.42],[1,.44],[.77,.65],[-.77,.65],[-1,.44]],col);
  for(let row=0;row<3;row++)for(let i=0;i<9;i++){const x=-.9+i*.205,y=-.2+row*.27+(.08-Math.abs(x)*.07);arch(c,s,x,y,.13,.2,shadow);}
  for(const y of [.03,.3,.57])line(c,s,-.95,y,.95,y,stone,.035);
  shape(c,s,[[.53,-.25],[.68,-.53],[.83,-.54],[.83,-.18]],col);plinth(c,s,stone,2.2);
}
function pyramids(c,s,col){
  shape(c,s,[[-1.12,.6],[-.48,-.98],[.32,.6]],col);shape(c,s,[[-.48,-.98],[.32,.6],[-.16,.6]],'#ab895a');
  shape(c,s,[[-.16,.6],[.46,-.66],[1.15,.6]],col);shape(c,s,[[.46,-.66],[1.15,.6],[.72,.6]],'#ab895a');
  for(let i=0;i<7;i++){const y=.5-i*.17;line(c,s,-1.02+i*.065,y,-.19-i*.035,y,'#e6d0a3',.015);}plinth(c,s,stone,2.4);
}
function wall(c,s,col){
  shape(c,s,[[-1.1,.55],[-1.1,.16],[-.5,-.04],[0,.16],[.57,-.21],[1.1,-.37],[1.1,.07],[.57,.2],[0,.59],[-.5,.39]],col);
  for(let i=0;i<9;i++){const x=-1.04+i*.24,y=x<-.5?.12:(x<0?-.02+x*.3:.1-x*.42);box(c,s,x,y-.12,.13,.19,col);}
  for(const [x,y]of [[-.56,-.01],[.7,-.31]]){box(c,s,x-.2,y-.49,.4,.8,col);shape(c,s,[[x-.28,y-.49],[x,y-.75],[x+.28,y-.49]],'#697e75');arch(c,s,x-.07,y-.07,.14,.35,shadow);box(c,s,x-.22,y-.5,.44,.07,stone);}
  for(const y of [.25,.4])line(c,s,-1.02,y,-.66,y,stone,.018);
}
function burj(c,s,col){
  for(const [x,y,w,h]of [[-.42,.17,.84,.48],[-.31,-.25,.62,.91],[-.21,-.69,.42,1.35],[-.12,-1.04,.24,1.7],[-.045,-1.35,.09,2]]){
    box(c,s,x,y,w,h,col,.01);for(let Y=y+.06;Y<.6;Y+=.1)line(c,s,x+.025,Y,x+w-.025,Y,GLASS,.018);
  }line(c,s,0,-1.64,0,-1.34,IVORY,.025);plinth(c,s,shadow,1.2);
}
function petronas(c,s,col){
  for(const x of [-.43,.43]){
    box(c,s,x-.2,-.76,.4,1.39,col);box(c,s,x-.14,-1.05,.28,.29,col);shape(c,s,[[x-.14,-1.06],[x,-1.3],[x+.14,-1.06]],col);line(c,s,x,-1.52,x,-1.27,col,.025);
    for(let y=-.72;y<.6;y+=.12)line(c,s,x-.21,y,x+.21,y,GLASS,.035);
    for(const dx of [-.1,0,.1])line(c,s,x+dx,-.73,x+dx,.58,IVORY,.015);
  }box(c,s,-.25,-.29,.5,.14,GLASS);line(c,s,-.24,-.15,-.39,.14,col,.04);line(c,s,.24,-.15,.39,.14,col,.04);plinth(c,s,shadow,1.45);
}
function opera(c,s,col){
  box(c,s,-1.1,.46,2.2,.18,stone);line(c,s,-1.12,.72,1.12,.72,GLASS,.055);
  for(const [x,y,w]of [[-.98,-.24,.58],[-.55,-.82,.85],[.05,-.56,.74],[.56,-.12,.47]]){
    c.beginPath();c.moveTo(x*s,.46*s);c.quadraticCurveTo((x+w*.13)*s,(y-.1)*s,(x+w*.32)*s,y*s);c.quadraticCurveTo((x+w*.7)*s,(y+.05)*s,(x+w)*s,.46*s);c.closePath();c.fillStyle=col;c.fill();c.strokeStyle=INK;c.lineWidth=s*.025;c.stroke();
    line(c,s,x+w*.32,y,x+w*.54,.44,stone,.025);line(c,s,x+w*.32,y,x+w*.8,.44,stone,.018);
  }for(let i=0;i<10;i++)box(c,s,-.87+i*.18,.48,.09,.13,shadow);
}
function suspension(c,s,col,padma=false){
  const deck=.36;
  line(c,s,-1.22,.64,1.22,.64,GLASS,.045);
  if(padma){
    box(c,s,-1.14,.13,2.28,.32,col);for(let i=0;i<7;i++){const x=-1.1+i*.32;line(c,s,x,.42,x+.16,.16,IVORY,.035);line(c,s,x+.16,.16,x+.32,.42,IVORY,.035);}
    for(const x of [-.85,0,.85]){shape(c,s,[[x-.07,.43],[x-.11,.68],[x+.11,.68],[x+.07,.43]],stone);}line(c,s,-1.14,.08,1.14,.08,INK,.04);
  }else{
    for(const x of [-.65,.65]){box(c,s,x-.06,-.9,.12,1.56,col);for(const y of [-.65,-.25,.2])line(c,s,x-.13,y,x+.13,y,col,.06);}
    c.beginPath();c.moveTo(-1.2*s,.2*s);c.lineTo(-.65*s,-.83*s);c.quadraticCurveTo(0,.28*s,.65*s,-.83*s);c.lineTo(1.2*s,.2*s);c.strokeStyle=col;c.lineWidth=.045*s;c.stroke();
    for(let i=0;i<=12;i++){const x=-.6+i*.1,y=-.83+.55*(1-(x/.65)**2);line(c,s,x,y,x,deck,col,.02);}box(c,s,-1.2,deck,2.4,.1,col);
  }
}
function towerBridge(c,s,col){
  for(const x of [-.62,.62]){
    box(c,s,x-.2,-.45,.4,1.04,col);arch(c,s,x-.09,.2,.18,.39,shadow);box(c,s,x-.26,-.54,.52,.12,col);
    for(const dx of [-.2,.2]){box(c,s,x+dx-.055,-.78,.11,.28,col);shape(c,s,[[x+dx-.1,-.8],[x+dx,-1.04],[x+dx+.1,-.8]],'#628c9c');}
    box(c,s,x-.11,-.35,.22,.25,GLASS);
  }
  box(c,s,-.43,-.39,.86,.1,GLASS);box(c,s,-1.2,.47,2.4,.1,stone);for(const side of [-1,1]){line(c,s,side*.62,-.46,side*1.2,.43,'#629eb3',.07);line(c,s,side*.62,-.29,side*1.2,.46,'#629eb3',.04);}line(c,s,-1.2,.7,1.2,.7,GLASS,.04);
}
function pisa(c,s,col){
  c.save();c.translate(.1*s,.62*s);c.rotate(.095);
  box(c,s,-.36,-1.65,.72,1.65,col);oval(c,s,0,-1.65,.36,.1,col);
  for(let j=0;j<6;j++){const y=-1.5+j*.24;for(let i=0;i<5;i++)arch(c,s,-.3+i*.13,y,.08,.15,shadow);box(c,s,-.4,y+.17,.8,.055,col);}
  box(c,s,-.24,-1.91,.48,.25,col);oval(c,s,0,-1.91,.24,.065,col);c.restore();plinth(c,s,stone,1.1);
}
function parliament(c,s,col){
  box(c,s,-.72,-.31,1.44,.91,col);box(c,s,-.38,-.73,.76,1.33,col);shape(c,s,[[-.38,-.73],[0,-.86],[.38,-.73]],col);
  for(const x of [-.85,.85]){box(c,s,x-.15,-.08,.3,.68,col);oval(c,s,x,.14,.1,.13,shadow);}
  oval(c,s,0,-.17,.22,.22,shadow);shape(c,s,[[-.26,.59],[0,.24],[.26,.59]],shadow);for(const x of [-.61,.45])box(c,s,x,-.16,.16,.43,shadow);
  line(c,s,-1.1,.72,1.1,.72,GLASS,.07);plinth(c,s,stone,2.05);
}
function brandenburg(c,s,col){
  for(let i=0;i<6;i++){const x=-.83+i*.3;box(c,s,x,-.29,.13,.9,col);box(c,s,x-.035,-.32,.2,.08,stone);box(c,s,x-.035,.53,.2,.08,stone);}
  box(c,s,-1.02,-.52,2.04,.22,col);box(c,s,-.8,-.69,1.6,.17,col);box(c,s,-.4,-.84,.8,.15,stone);
  for(const x of [-.27,-.09,.09,.27]){line(c,s,x,-.84,x-.015,-1.04,shadow,.06);oval(c,s,x,-1.08,.045,.07,shadow);}line(c,s,0,-1.12,0,-1.28,shadow,.035);plinth(c,s,stone,2.2);
}
const landmark=(label,col,draw)=>({...miniature(label,col,'landmarks',draw),labelOffset:2.5});
export const LANDMARK_OBJECTS={
  eiffelTower:landmark('Eiffel Tower','#a9947b',eiffel),
  statueOfLiberty:landmark('Statue of Liberty','#83a99b',liberty),
  tajMahal:landmark('Taj Mahal','#eee7d6',taj),
  bigBen:landmark('Big Ben / Elizabeth Tower','#c4ad7a',bigBen),
  colosseum:landmark('Colosseum','#c7ab83',colosseum),
  gizaPyramids:landmark('Pyramids of Giza','#d6bd87',pyramids),
  greatWall:landmark('Great Wall of China','#a8a18d',wall),
  burjKhalifa:landmark('Burj Khalifa','#93b5c4',burj),
  petronasTowers:landmark('Petronas Twin Towers','#b8c7c9',petronas),
  sydneyOperaHouse:landmark('Sydney Opera House','#efe9d5',opera),
  goldenGateBridge:landmark('Golden Gate Bridge','#bf6c4d',(c,s,col)=>suspension(c,s,col)),
  towerBridge:landmark('Tower Bridge','#c1b799',towerBridge),
  leaningTowerPisa:landmark('Leaning Tower of Pisa','#e1d5b7',pisa),
  padmaBridge:landmark('Padma Bridge','#a8b7b4',(c,s,col)=>suspension(c,s,col,true)),
  nationalParliament:landmark('Bangladesh National Parliament','#c6c3ad',parliament),
  brandenburgGate:landmark('Brandenburg Gate','#d4c6a5',brandenburg),
};
