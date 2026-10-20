// Small vector illustrations for Age of Sail exploration and early modern war maps.
const ink='#332b24',wood='#775138',cream='#e8dab4',brass='#c5a052',steel='#9baba9';
function path(c,s,points,fill){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*s,y*s):c.moveTo(x*s,y*s));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=ink;c.lineWidth=s*.045;c.lineJoin='round';c.stroke();}
function box(c,s,x,y,w,h,fill){c.beginPath();c.roundRect(x*s,y*s,w*s,h*s,s*.035);c.fillStyle=fill;c.fill();c.strokeStyle=ink;c.lineWidth=s*.04;c.stroke();}
function line(c,s,x,y,X,Y,fill=ink,w=.045){c.beginPath();c.moveTo(x*s,y*s);c.lineTo(X*s,Y*s);c.strokeStyle=fill;c.lineWidth=s*w;c.lineCap='round';c.stroke();}
function circle(c,s,x,y,r,fill){c.beginPath();c.arc(x*s,y*s,r*s,0,Math.PI*2);c.fillStyle=fill;c.fill();c.strokeStyle=ink;c.lineWidth=s*.04;c.stroke();}
function wheel(c,s,x,y,r){circle(c,s,x,y,r,wood);circle(c,s,x,y,r*.66,'#b88b56');for(let i=0;i<6;i++){const a=i*Math.PI/3;line(c,s,x,y,x+Math.cos(a)*r*.7,y+Math.sin(a)*r*.7,ink,.025);}circle(c,s,x,y,.055,brass);}
function sail(c,s,x,y,w,h,t){
  const billow=Math.sin(t*2.4+x*3)*.035;
  c.beginPath();c.moveTo((x-w/2)*s,y*s);c.quadraticCurveTo(x*s,(y+.06)*s,(x+w/2)*s,y*s);
  c.bezierCurveTo((x+w*.37+billow)*s,(y+h*.4)*s,(x+w*.43)*s,(y+h*.8)*s,(x+w*.52)*s,(y+h)*s);
  c.quadraticCurveTo(x*s,(y+h+.06)*s,(x-w*.52)*s,(y+h)*s);
  c.quadraticCurveTo((x-w*.34+billow)*s,(y+h*.5)*s,(x-w/2)*s,y*s);c.fillStyle=cream;c.fill();c.strokeStyle=ink;c.lineWidth=s*.035;c.stroke();
  line(c,s,x-w*.3,y+.08,x-w*.3,y+h-.03,'#c4b38d',.018);line(c,s,x+w*.3,y+.08,x+w*.3,y+h-.03,'#c4b38d',.018);
}
function pennant(c,s,x,y,col,t){const wave=Math.sin(t*3)*.04;path(c,s,[[x,y],[x+.32,y+.08+wave],[x,y+.16]],col);}
function ship(c,s,col,t,kind){
  if(kind==='galley'){
    path(c,s,[[-1,-.05],[.95,-.05],[1.13,-.18],[.9,.3],[-.8,.3]],wood);
    line(c,s,0,-1.2,0,0,wood,.07);path(c,s,[[.02,-1.12],[.65,-.2],[.02,-.2]],cream);line(c,s,-.35,-1.15,.7,-.12,wood);
    for(let i=0;i<7;i++){const x=-.75+i*.23;line(c,s,x,.1,x-.25,.52+Math.sin(t*2)*.025,brass,.035);}box(c,s,-.85,-.18,.32,.15,col);return;
  }
  const g=kind==='galleon';
  path(c,s,[[-1,-.12],[-.83,.28],[-.6,.43],[.58,.43],[.92,.18],[1.1,-.22],[.73,-.1]],wood);
  box(c,s,-.98,-.42,.45,.34,col);if(g)box(c,s,-.94,-.66,.34,.24,col);box(c,s,.65,-.34,.32,.22,col);
  line(c,s,-.75,.2,.72,.2,brass,.045);line(c,s,-.7,.33,.58,.33,'#b48c5a',.025);
  for(let x=-.55;x<.65;x+=.27)box(c,s,x,.02,.11,.1,ink);
  const masts=g?[[-.42,-1.52],[.22,-1.8],[.7,-1.1]]:[[-.3,-1.45],[.4,-1.15]];
  for(const [x,top]of masts){
    line(c,s,x,top,x,-.08,wood,.055);line(c,s,x,top+.2,-.82,-.14,'#665743',.018);line(c,s,x,top+.2,.82,-.12,'#665743',.018);
    if(g){sail(c,s,x,top+.18,.55,.43,t);sail(c,s,x,top+.68,.7,.51,t);}
    else path(c,s,[[x+.025,top+.1],[x+.56,-.24],[x+.025,-.17]],cream);
    pennant(c,s,x,top,col,t);
  }
  line(c,s,.75,-.18,1.2,-.5,wood,.055);
}
function infantry(c,s,col,t,pike=false){
  const sway=Math.sin(t*2)*.015;
  box(c,s,-.23,.25,.17,.47,'#594538');box(c,s,.07,.25,.17,.47,'#594538');
  box(c,s,-.29,-.39,.57,.68,col);path(c,s,[[-.22,-.36],[.2,-.36],[.18,.08],[-.18,.08]],steel);
  line(c,s,-.2,-.28,.18,.14,cream,.06);box(c,s,-.25,.14,.5,.1,wood);circle(c,s,0,-.61,.19,'#d9ac81');
  path(c,s,[[-.27,-.68],[.28,-.68],[.19,-.91],[.03,-.98],[-.17,-.87]],steel);
  line(c,s,-.32,-.26,-.39,.12,col,.16);line(c,s,.26,-.23,.48,-.07+sway,col,.15);
  if(pike){line(c,s,.5,.7,.5,-1.7,wood,.045);path(c,s,[[.5,-1.95],[.43,-1.68],[.57,-1.68]],steel);}
  else{line(c,s,-.04,.02,.92,-.49,wood,.085);line(c,s,.51,-.29,.99,-.55,steel,.04);path(c,s,[[-.12,.03],[.09,-.08],[.18,.03],[-.03,.17]],wood);}
}
function cannon(c,s,col){
  path(c,s,[[-.65,.21],[-.46,-.15],[.37,-.15],[.65,.22]],wood);
  c.save();c.translate(-.15*s,-.12*s);c.rotate(-.22);box(c,s,-.5,-.16,1.53,.3,col);box(c,s,.84,-.2,.19,.38,brass);line(c,s,-.18,-.16,-.18,.14,brass,.055);line(c,s,.36,-.16,.36,.14,brass,.055);c.restore();
  wheel(c,s,-.32,.27,.3);wheel(c,s,.45,.27,.27);circle(c,s,-.87,.45,.1,ink);circle(c,s,-.67,.49,.09,ink);
}
function cavalry(c,s,col,t){
  const step=Math.sin(t*3)*.045;
  path(c,s,[[-.66,-.06],[-.44,-.29],[.35,-.27],[.55,-.65],[.8,-.81],[1.02,-.64],[.94,-.45],[.68,-.41],[.59,.06],[.28,.23],[-.42,.2]],wood);
  for(const[x,lean]of[[-.48,-.08],[-.23,.12],[.32,-.04],[.52,.1]])line(c,s,x,.1,x+lean+step,.65,wood,.1);
  line(c,s,-.62,-.04,-.88,.25,ink,.075);path(c,s,[[-.22,-.29],[.27,-.29],[.35,.05],[-.3,.06]],col);
  box(c,s,-.11,-.85,.32,.48,steel);circle(c,s,.05,-1.04,.15,'#d9ac81');path(c,s,[[-.15,-1.1],[.23,-1.1],[.13,-1.3],[-.05,-1.3]],steel);
  line(c,s,.12,-.66,.47,-1.21,steel,.055);line(c,s,.17,-.46,.78,-.53,ink,.02);
}
function fort(c,s,col){
  path(c,s,[[-.95,-.04],[-.95,.45],[.95,.45],[.95,-.04]],col);
  for(const x of[-.92,.55]){box(c,s,x,-.65,.38,1.1,col);for(let i=0;i<3;i++)box(c,s,x+i*.13,-.78,.1,.2,col);box(c,s,x+.13,-.39,.1,.18,ink);}
  box(c,s,-.54,-.15,1.1,.6,col);for(let i=0;i<6;i++)box(c,s,-.53+i*.2,-.28,.13,.2,col);
  path(c,s,[[-.15,.45],[-.15,.12],[0,-.02],[.15,.12],[.15,.45]],wood);line(c,s,.72,-.8,.72,-1.2,wood);pennant(c,s,.72,-1.2,'#963e39',0);
  for(let i=0;i<5;i++)line(c,s,-.43+i*.2,.23,-.3+i*.2,.23,'#6f6753',.02);
}
function explorer(c,s,col){
  box(c,s,-.2,.17,.15,.52,wood);box(c,s,.04,.17,.15,.52,wood);path(c,s,[[-.25,-.45],[.2,-.45],[.3,.25],[-.3,.25]],col);
  circle(c,s,0,-.65,.18,'#d9ac81');box(c,s,-.3,-.84,.61,.07,wood);path(c,s,[[-.2,-.83],[-.12,-1.05],[.15,-1.05],[.24,-.83]],col);
  line(c,s,-.2,-.27,-.42,.04,col,.13);line(c,s,.19,-.28,.44,-.3,col,.13);line(c,s,.39,-.3,.97,-.42,brass,.13);circle(c,s,.97,-.42,.09,wood);
  path(c,s,[[-.51,-.04],[-.26,.03],[-.3,.33],[-.58,.25]],cream);line(c,s,-.46,.06,-.35,.12,wood,.02);
}
function compass(c,s,col,t){
  circle(c,s,0,-.1,.88,brass);circle(c,s,0,-.1,.75,cream);
  for(let i=0;i<16;i++){const a=i*Math.PI/8;line(c,s,Math.cos(a)*.64,Math.sin(a)*.64-.1,Math.cos(a)*.72,Math.sin(a)*.72-.1,ink,.02);}
  c.save();c.translate(0,-.1*s);c.rotate(Math.sin(t*.8)*.08);path(c,s,[[0,-.61],[.17,0],[0,.61],[-.17,0]],col);path(c,s,[[0,0],[0,.61],[-.17,0]],ink);circle(c,s,0,0,.07,brass);c.restore();
  line(c,s,0,-1.08,0,-1.2,ink,.05);line(c,s,-.04,-1.17,.04,-1.11,ink,.025);
}
function chart(c,s,col){
  path(c,s,[[-.88,-.82],[.61,-.82],[.84,-.55],[.76,.68],[-.76,.68],[-.9,.43]],cream);
  path(c,s,[[-.48,-.57],[-.09,-.65],[.1,-.4],[-.08,-.12],[-.34,-.04],[-.5,.25],[-.63,.11]],col);
  path(c,s,[[.31,-.03],[.61,.06],[.59,.36],[.32,.47],[.14,.25]],col);
  c.save();c.setLineDash([s*.07,s*.06]);line(c,s,-.4,.44,.48,-.4,wood,.025);c.restore();
  circle(c,s,.48,-.4,.11,'#a14c3b');line(c,s,-.9,-.83,-.9,.58,wood,.08);line(c,s,.82,-.62,.78,.63,wood,.08);
}
function chest(c,s,col){
  box(c,s,-.75,-.07,1.5,.67,wood);path(c,s,[[-.75,-.08],[-.75,-.36],[-.53,-.66],[.5,-.66],[.75,-.37],[.75,-.08]],col);
  for(const x of[-.53,.36])box(c,s,x,-.61,.15,1.17,brass);box(c,s,-.12,-.09,.24,.25,brass);circle(c,s,0,.01,.035,ink);
  for(const[x,y]of[[.8,.56],[.61,.69],[-.85,.6]])circle(c,s,x,y,.12,brass);
}
function wagon(c,s,col){
  box(c,s,-.83,-.1,1.55,.54,wood);path(c,s,[[-.83,-.1],[-.8,-.61],[-.56,-.89],[.38,-.89],[.68,-.6],[.72,-.1]],cream);
  for(const x of[-.55,-.08,.4])line(c,s,x,-.83,x,-.14,'#ad9974',.025);
  box(c,s,-.85,.16,1.62,.13,col);line(c,s,.74,.22,1.1,.02,wood,.07);wheel(c,s,-.48,.46,.25);wheel(c,s,.46,.46,.25);
}
function entry(label,color,group,draw){return{label,color,group,historic:true,draw};}
export const HISTORIC_OBJECTS={
  caravel:entry('Caravel','#a65c42','exploration',(c,s,col,t)=>ship(c,s,col,t,'caravel')),
  galleon:entry('Galleon / sailing warship','#8c4438','warfare',(c,s,col,t)=>ship(c,s,col,t,'galleon')),
  galley:entry('Oared galley','#9a7445','warfare',(c,s,col,t)=>ship(c,s,col,t,'galley')),
  explorer:entry('Explorer with spyglass','#69764b','exploration',explorer),
  compass:entry('Mariner’s compass','#9f473c','exploration',compass),
  seaChart:entry('Parchment sea chart','#849371','exploration',chart),
  treasureChest:entry('Treasure chest','#986742','exploration',chest),
  supplyWagon:entry('Supply wagon','#8d6844','exploration',wagon),
  cannon:entry('Field cannon','#656d55','warfare',cannon),
  musketeer:entry('Musketeer','#9d4d40','warfare',(c,s,col,t)=>infantry(c,s,col,t)),
  pikeman:entry('Pikeman','#667e8c','warfare',(c,s,col,t)=>infantry(c,s,col,t,true)),
  cavalry:entry('Armored cavalry','#8c493d','warfare',cavalry),
  stoneFort:entry('Stone fort / coastal fortress','#9a9279','warfare',fort),
};
