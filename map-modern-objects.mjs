import { surface, polygonSurface } from './map-object-materials.mjs';
// Layered map miniatures. Coordinates are normalized to roughly -1..1;
// time is seconds so animation matches in previews and frame-by-frame exports.
const ink='#28343b',glass='#a9d4df',cream='#e8e4d5',metal='#87969b';
const tau=Math.PI*2;
function tint(hex,n){return '#'+[1,3,5].map(i=>Math.max(0,Math.min(255,parseInt(hex.slice(i,i+2),16)+n)).toString(16).padStart(2,'0')).join('');}
function shape(c,s,points,fill){c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*s,y*s):c.moveTo(x*s,y*s));c.closePath();c.fillStyle=polygonSurface(c,fill,s,points);c.fill();c.strokeStyle=ink;c.lineWidth=s*.023;c.lineJoin='round';c.stroke();}
function box(c,s,x,y,w,h,fill,r=.025){c.beginPath();c.roundRect(x*s,y*s,w*s,h*s,r*s);c.fillStyle=surface(c,fill,x*s,y*s,w*s,h*s);c.fill();c.strokeStyle=ink;c.lineWidth=s*.023;c.stroke();}
function line(c,s,x,y,X,Y,color=ink,w=.02){c.beginPath();c.moveTo(x*s,y*s);c.lineTo(X*s,Y*s);c.strokeStyle=color;c.lineWidth=w*s;c.lineCap='round';c.stroke();}
function oval(c,s,x,y,rx,ry,fill){c.beginPath();c.ellipse(x*s,y*s,rx*s,ry*s,0,0,tau);c.fillStyle=surface(c,fill,(x-rx)*s,(y-ry)*s,rx*2*s,ry*2*s);c.fill();c.strokeStyle=ink;c.lineWidth=s*.023;c.stroke();}
function wheel(c,s,x,y,r=.16){
  oval(c,s,x,y,r,r,ink);oval(c,s,x,y,r*.72,r*.72,'#465056');
  oval(c,s,x,y,r*.56,r*.56,metal);
  for(let i=0;i<5;i++){const a=i*tau/5;oval(c,s,x+Math.cos(a)*r*.35,y+Math.sin(a)*r*.35,r*.07,r*.07,cream);}
  oval(c,s,x,y,r*.2,r*.2,cream);
}
function windows(c,s,x,y,n,w=.13,h=.16,gap=.05){for(let i=0;i<n;i++){box(c,s,x+i*(w+gap),y,w,h,glass,.015);line(c,s,x+i*(w+gap)+.02,y+.035,x+i*(w+gap)+w-.02,y+.035,'#dfedf0',.012);}}
function wake(c,s,t,y=.5){for(let j=0;j<3;j++){const x=-1.02-((t*.16+j*.16)%.35);line(c,s,x,y+j*.06,x+.25,y+j*.06,'#accbd0',.018);}}
function tank(c,s,col,t){
  box(c,s,-.98,.2,1.86,.43,ink,.16);
  for(let i=0;i<7;i++){const x=-.79+i*.24;wheel(c,s,x,.43,.14);line(c,s,x-.07,.43,x+.07,.43,'#48565a',.025);}
  for(let i=0;i<15;i++){const x=-.91+i*.12;line(c,s,x,.23,x+.04,.29,metal,.018);line(c,s,x,.58,x+.04,.64,metal,.018);}
  shape(c,s,[[-.98,.2],[-.8,-.08],[.62,-.08],[.95,.2]],col);
  box(c,s,-.77,.02,1.38,.14,tint(col,17));
  for(let i=0;i<4;i++)box(c,s,-.68+i*.29,.07,.23,.14,tint(col,-15));
  shape(c,s,[[-.45,-.11],[-.35,-.46],[.2,-.49],[.53,-.24],[.39,-.06]],col);
  line(c,s,-.24,-.4,.12,-.42,tint(col,45),.03);
  box(c,s,.37,-.31,.68,.075,metal);box(c,s,1.02,-.34,.13,.13,ink);
  oval(c,s,-.08,-.49,.17,.055,tint(col,-15));box(c,s,-.05,-.59,.07,.1,metal);
  line(c,s,-.4,-.45,-.46,-.88,ink,.015);line(c,s,.02,-.61,.24,-.61,ink,.025);
  for(let i=0;i<3;i++)line(c,s,-.65+i*.07,-.07,-.65+i*.07,.01,ink,.02);
  oval(c,s,.78,.13,.035,.035,'#f2d794');
  // Bolted armor seams, engine grilles, and a recessed sight.
  for(let i=0;i<7;i++)oval(c,s,-.68+i*.19,.04,.012,.012,'#c0c6a9');
  for(let i=0;i<5;i++)line(c,s,-.75+i*.065,-.02,-.72+i*.065,-.07,ink,.014);
  box(c,s,.17,-.38,.13,.065,ink);box(c,s,.19,-.37,.08,.035,glass);
}
function ship(c,s,col,t,civilian=false){
  wake(c,s,t);
  shape(c,s,[[-1.05,.12],[1.08,.12],[.86,.45],[-.8,.45]],col);
  line(c,s,-.81,.34,.85,.34,tint(col,35),.04);
  box(c,s,-.65,-.07,1.3,.19,tint(col,25));
  if(civilian){
    for(let i=0;i<5;i++){box(c,s,-.65+i*.23,-.32,.21,.23,i%2?'#be7454':'#d4b578');line(c,s,-.6+i*.23,-.3,-.6+i*.23,-.12,ink,.012);}
    box(c,s,.49,-.55,.35,.57,cream);windows(c,s,.52,-.49,2,.1,.1,.025);
    box(c,s,.53,-.7,.12,.15,tint(col,-10));
  }else{
    box(c,s,-.25,-.39,.57,.32,tint(col,18));box(c,s,-.1,-.59,.29,.2,cream);
    windows(c,s,-.07,-.54,2,.08,.08,.03);
    for(const x of[-.68,.55]){box(c,s,x,-.14,.24,.12,tint(col,-12));line(c,s,x+.12,-.11,x+.4,-.11,ink,.05);}
    line(c,s,.02,-.6,.02,-.97,metal,.025);line(c,s,-.19,-.81,.23,-.81,metal,.025);
    line(c,s,-.14,-.94,.18,-.94,ink,.025);oval(c,s,.02,-.97,.08,.04,cream);
  }
  for(let i=0;i<8;i++)oval(c,s,-.7+i*.19,.23,.02,.02,ink);
  for(let i=0;i<9;i++)line(c,s,-.84+i*.19,.11,-.84+i*.19,.01,cream,.012);
  line(c,s,-.86,.01,.82,.01,cream,.012);
}
function aircraft(c,s,col,t,passenger=false){
  shape(c,s,[[-.15,-.1],[-.55,-.88],[-.3,-.88],[.4,-.12]],tint(col,-22));
  shape(c,s,[[-.15,.1],[-.55,.88],[-.3,.88],[.4,.12]],col);
  shape(c,s,[[-.7,-.07],[-1,-.4],[-.76,-.42],[-.42,-.09]],tint(col,-20));
  shape(c,s,[[-.7,.07],[-1,.4],[-.76,.42],[-.42,.09]],col);
  shape(c,s,[[-1,0],[-.7,-.12],[.59,-.15],[1.08,0],[.59,.15],[-.7,.12]],col);
  line(c,s,-.65,0,.85,0,tint(col,40),.025);
  shape(c,s,[[.58,-.1],[.8,-.06],[.88,0],[.58,.04]],glass);
  if(passenger){for(let i=0;i<8;i++)oval(c,s,-.45+i*.12,-.07,.025,.025,ink);box(c,s,-.17,-.6,.3,.12,metal);box(c,s,-.17,.48,.3,.12,metal);}
  else{box(c,s,-.37,-.26,.35,.1,metal);box(c,s,-.37,.16,.35,.1,metal);line(c,s,-.8,-.1,-.53,-.1,ink,.04);}
  oval(c,s,-.42,-.77,.025,.025,Math.sin(t*3)>0?'#ef8a72':'#7d4d45');
}
function helicopter(c,s,col,t){
  shape(c,s,[[-.46,.05],[-1.02,-.17],[-1.04,-.38],[-.85,-.34],[-.76,-.12],[.02,-.08]],col);
  oval(c,s,.12,-.05,.55,.3,col);
  shape(c,s,[[.18,-.3],[.49,-.2],[.61,-.01],[.2,.02]],glass);
  line(c,s,.18,-.25,.2,.01,ink,.02);box(c,s,-.16,-.2,.24,.29,tint(col,-10));
  line(c,s,-.37,.21,-.29,.4,metal,.035);line(c,s,.35,.19,.43,.4,metal,.035);
  line(c,s,-.53,.41,.68,.41,ink,.045);line(c,s,.68,.41,.75,.34,ink,.04);
  line(c,s,-.03,-.33,-.03,-.51,metal,.06);
  const a=t*24;c.save();c.translate(-.03*s,-.52*s);c.scale(1,.2);c.rotate(a);
  line(c,s,-1,0,1,0,ink,.05);line(c,s,0,-.9,0,.9,metal,.04);c.restore();
  c.save();c.translate(-.95*s,-.23*s);c.rotate(-a);line(c,s,-.15,0,.15,0,cream,.035);line(c,s,0,-.15,0,.15,cream,.035);c.restore();
  oval(c,s,-.24,.03,.04,.04,'#e4cb7c');
}
function drone(c,s,col,t){
  for(const [x,y] of[[-.62,-.46],[.62,-.46],[-.62,.46],[.62,.46]]){
    line(c,s,0,0,x,y,metal,.08);oval(c,s,x,y,.21,.13,'#39474f');
    c.save();c.translate(x*s,y*s);c.rotate(t*24);line(c,s,-.24,0,.24,0,cream,.035);c.restore();
  }
  box(c,s,-.27,-.19,.54,.38,col,.1);line(c,s,-.15,-.13,.16,-.13,tint(col,45),.03);
  box(c,s,-.1,.2,.2,.12,metal);oval(c,s,0,.32,.09,.07,ink);oval(c,s,0,.32,.045,.035,glass);
}
function submarine(c,s,col,t){
  oval(c,s,0,.12,1,.28,col);line(c,s,-.7,.02,.62,.02,tint(col,35),.03);
  box(c,s,-.21,-.38,.38,.34,tint(col,-10),.08);line(c,s,.01,-.38,.01,-.72,metal,.04);line(c,s,.01,-.72,.22,-.72,metal,.04);
  line(c,s,-.12,-.36,-.12,-.58,ink,.025);shape(c,s,[[-.7,.06],[-.98,-.17],[-.85,.16]],col);
  for(let i=0;i<5;i++)oval(c,s,-.4+i*.18,.16,.025,.025,ink);
  c.save();c.translate(-1.02*s,.13*s);c.scale(.3,1);c.rotate(t*14);line(c,s,0,-.22,0,.22,metal,.06);c.restore();wake(c,s,t,.38);
}
function missile(c,s,col,t){
  shape(c,s,[[-.8,-.08],[-1.12-.08*Math.sin(t*20),0],[-.8,.08]],'#efac59');
  for(const y of[-1,1])shape(c,s,[[-.85,y*.06],[-1,y*.35],[-.6,y*.09]],metal);
  box(c,s,-.82,-.11,1.33,.22,col,.025);shape(c,s,[[.51,-.11],[1,0],[.51,.11]],'#b76753');
  for(const x of[-.6,.15])line(c,s,x,-.1,x,.1,metal,.025);line(c,s,-.66,-.05,.48,-.05,cream,.016);
}
function building(c,s,col,kind='house'){
  const hospital=kind==='hospital',school=kind==='school';
  shape(c,s,[[-.75,-.27],[-.53,-.46],[.91,-.46],[.71,-.27]],tint(col,25));
  box(c,s,-.75,-.27,1.47,.92,col);shape(c,s,[[.72,-.27],[.91,-.46],[.91,.47],[.72,.65]],tint(col,-25));
  if(kind==='house'){shape(c,s,[[-.9,-.27],[-.11,-.92],[.91,-.46],[.72,-.27],[-.1,-.71],[-.75,-.18]],'#9e6c54');box(c,s,.4,-.88,.16,.38,'#a78a6e');}
  if(school){box(c,s,-.34,-.6,.63,.35,cream);oval(c,s,-.02,-.44,.12,.12,cream);line(c,s,-.02,-.44,-.02,-.52,ink,.016);line(c,s,-.02,-.44,.04,-.41,ink,.016);}
  windows(c,s,-.59,-.1,4,.18,.2,.1);windows(c,s,-.59,.24,2,.18,.21,.1);
  box(c,s,.14,.22,.29,.43,tint(col,-40));line(c,s,.28,.24,.28,.64,cream,.015);
  if(hospital){box(c,s,-.12,-.64,.16,.34,'#be6558');box(c,s,-.21,-.55,.34,.16,'#be6558');}
  line(c,s,-.83,.66,.96,.66,metal,.03);
  // Masonry courses, a recessed door frame, sill, and side glazing.
  for(let row=0;row<4;row++){
    const y=-.19+row*.21;
    line(c,s,-.72,y,.7,y,tint(col,-18),.009);
    for(let j=0;j<5;j++){const x=-.65+j*.29+(row%2)*.1;if(x<.68)line(c,s,x,y,x,y+.07,tint(col,-18),.008);}
  }
  line(c,s,.12,.2,.12,.65,tint(col,35),.025);
  box(c,s,.11,.64,.36,.045,metal);oval(c,s,.37,.43,.018,.018,'#d9c89d');
  shape(c,s,[[.77,-.12],[.85,-.2],[.85,.02],[.77,.1]],glass);
}
function city(c,s,col){
  for(const [x,y,w,h] of[[-.96,-.25,.42,.88],[-.51,-.91,.48,1.54],[.02,-.52,.43,1.15],[.49,-.12,.43,.75]]){
    box(c,s,x,y,w,h,col);shape(c,s,[[x,y],[x+.1,y-.12],[x+w+.1,y-.12],[x+w,y]],tint(col,30));
    shape(c,s,[[x+w,y],[x+w+.1,y-.12],[x+w+.1,.51],[x+w,.63]],tint(col,-20));
    for(let j=0;j<Math.floor(h/.25);j++)windows(c,s,x+.07,y+.13+j*.25,2,.09,.1,.08);
  }
  line(c,s,-.27,-.92,-.27,-1.12,metal,.02);
}
function vehicle(c,s,col,kind='car'){
  const large=['bus','truck','ambulance','train'].includes(kind);
  box(c,s,-.98,large?-.44:-.12,1.93,large?.86:.49,col,.09);
  if(!large){shape(c,s,[[-.65,-.12],[-.38,-.55],[.29,-.55],[.64,-.12]],col);shape(c,s,[[-.48,-.17],[-.29,-.46],[.22,-.46],[.44,-.17]],glass);line(c,s,-.05,-.46,-.05,-.17,ink,.025);}
  else if(kind==='truck'){box(c,s,-.95,-.67,1.13,1.02,tint(col,20));box(c,s,.35,-.38,.45,.3,glass);line(c,s,.29,-.4,.29,.37,ink,.025);}
  else{windows(c,s,-.83,-.3,kind==='train'?5:4,.23,.26,.1);line(c,s,-.85,.1,.77,.1,tint(col,40),.035);}
  if(kind==='ambulance'){box(c,s,-.46,-.16,.13,.36,'#c75953');box(c,s,-.58,-.04,.37,.13,'#c75953');box(c,s,.16,-.56,.3,.1,'#bc655e');}
  if(kind==='train'){
    shape(c,s,[[.53,-.44],[.88,-.35],[1.03,.17],[.94,.39],[.53,.39]],tint(col,14));
    shape(c,s,[[.62,-.31],[.84,-.27],[.91,-.04],[.62,-.04]],glass);
    box(c,s,-.91,.4,1.84,.09,metal);box(c,s,-.63,-.55,.7,.1,metal);
    line(c,s,-.24,-.56,-.43,-.77,ink,.025);line(c,s,-.43,-.77,-.13,-.96,ink,.025);line(c,s,-.3,-.96,.05,-.96,metal,.035);
    for(const x of[-.74,-.48,.48,.74])wheel(c,s,x,.49,.12);
    line(c,s,-1.08,.69,1.08,.69,metal,.035);line(c,s,-1.08,.79,1.08,.79,metal,.025);
    for(let i=0;i<9;i++)line(c,s,-1+i*.25,.65,-.92+i*.25,.83,'#82715c',.028);
  }else{wheel(c,s,-.6,.42);wheel(c,s,.6,.42);}
  line(c,s,-.83,.25,.78,.25,tint(col,-25),.025);
  box(c,s,.85,.08,.11,.11,'#f1d89a');box(c,s,-1,.1,.09,.1,'#c26352');
  if(kind==='car')line(c,s,.2,.02,.38,.02,cream,.03);
}
function bicycle(c,s,col,t){
  for(const x of[-.65,.65]){oval(c,s,x,.35,.34,.34,ink);oval(c,s,x,.35,.28,.28,cream);for(let i=0;i<6;i++){const a=i*tau/6+t*2;line(c,s,x,.35,x+Math.cos(a)*.27,.35+Math.sin(a)*.27,metal,.012);}}
  for(const [x,y,X,Y] of[[-.65,.35,-.32,-.26],[-.32,-.26,.08,.35],[.08,.35,-.65,.35],[-.32,-.26,.4,-.26],[.4,-.26,.08,.35],[.4,-.26,.65,.35]])line(c,s,x,y,X,Y,col,.05);
  line(c,s,-.35,-.35,-.15,-.35,ink,.055);line(c,s,.4,-.26,.34,-.53,metal,.04);line(c,s,.34,-.53,.57,-.56,ink,.04);oval(c,s,.08,.35,.06,.06,metal);
}
function ferry(c,s,col,t){
  wake(c,s,t);shape(c,s,[[-1,.12],[1,.12],[.75,.5],[-.79,.5]],col);
  box(c,s,-.72,-.24,1.39,.36,cream);box(c,s,-.49,-.5,.84,.26,cream);windows(c,s,-.61,-.14,6,.12,.13,.08);windows(c,s,-.39,-.42,3,.14,.12,.08);
  line(c,s,-.69,.3,.73,.3,tint(col,35),.055);box(c,s,.39,-.47,.13,.23,tint(col,-10));oval(c,s,.64,.01,.065,.065,'#cd7959');
}
function camp(c,s,col){
  shape(c,s,[[-.98,.55],[-.45,-.45],[.32,.55]],col);shape(c,s,[[-.45,-.45],[.1,-.55],[.94,.45],[.32,.55]],tint(col,-24));
  shape(c,s,[[-.7,.54],[-.44,-.17],[-.15,.54]],'#3c4941');line(c,s,-.45,-.45,-.45,.55,cream,.025);
  line(c,s,-.89,.32,-1.08,.64,metal,.016);line(c,s,.77,.29,1.07,.62,metal,.016);line(c,s,.1,-.54,.66,.13,tint(col,40),.025);
}
function factory(c,s,col,t){
  box(c,s,-.87,-.1,1.67,.7,col);shape(c,s,[[-.87,-.1],[-.87,-.44],[-.35,-.1],[-.35,-.44],[.18,-.1],[.18,-.44],[.8,-.1]],tint(col,20));
  for(let i=0;i<4;i++)windows(c,s,-.73+i*.37,.11,1,.23,.2,0);
  for(const [x,y] of[[.4,-.83],[.67,-.66]]){box(c,s,x,y,.15,-y-.1,tint(col,-25));line(c,s,x-.025,y,x+.175,y,cream,.03);}
  for(let i=0;i<3;i++){const p=(t*.16+i/3)%1;c.save();c.globalAlpha=.32*(1-p);oval(c,s,.47+p*.2,-.94-p*.45,.09+p*.1,.07+p*.08,'#818b88');c.restore();}
}
function airport(c,s,col){
  shape(c,s,[[-1.08,.39],[.87,.39],[1.05,.66],[-.89,.66]],'#4d5b60');for(let i=0;i<7;i++)line(c,s,-.86+i*.26,.52,-.72+i*.26,.52,cream,.025);
  box(c,s,-.82,-.12,1.12,.42,col);windows(c,s,-.73,-.04,5,.13,.18,.06);box(c,s,.47,-.55,.15,.94,tint(col,-15));
  box(c,s,.3,-.75,.48,.25,col);windows(c,s,.35,-.7,2,.16,.13,.025);line(c,s,.54,-.76,.54,-1,metal,.018);oval(c,s,.54,-1,.08,.025,cream);
}
function base(c,s,col){
  shape(c,s,[[-.88,.5],[-.88,-.22],[-.54,-.62],[.48,-.62],[.88,-.22],[.88,.5]],col);
  shape(c,s,[[-.88,-.22],[-.54,-.62],[.48,-.62],[.88,-.22]],tint(col,20));
  box(c,s,-.57,-.17,1.1,.67,tint(col,-32));
  for(let i=0;i<7;i++)line(c,s,-.52,-.11+i*.085,.48,-.11+i*.085,metal,.015);
  windows(c,s,-.4,-.11,4,.14,.12,.07);box(c,s,.61,.09,.15,.41,ink);
  line(c,s,-.77,.49,-.77,-.99,metal,.025);shape(c,s,[[-.77,-.99],[-.35,-.87],[-.77,-.69]],'#b56852');
  for(const x of[-1,-.6,.6,1])line(c,s,x,.31,x,.71,metal,.018);
  line(c,s,-1,.41,1,.41,metal,.012);line(c,s,-1,.58,1,.58,metal,.012);
}
function lighthouse(c,s,col,t){
  shape(c,s,[[-.37,.65],[-.25,-.65],[.25,-.65],[.37,.65]],cream);
  for(const y of[-.35,.17])box(c,s,-.29,y,.58,.15,col);
  box(c,s,-.32,-.84,.64,.23,glass);shape(c,s,[[-.43,-.83],[0,-1.08],[.43,-.83]],col);
  box(c,s,-.12,.34,.24,.31,ink);line(c,s,-.46,-.57,.46,-.57,metal,.025);
  const p=(Math.sin(t*1.3)+1)/2;c.save();c.globalAlpha=.12+p*.12;shape(c,s,[[.32,-.77],[1.08,-.95],[1.08,-.52]],'#f4d595');c.restore();
}
function bridge(c,s,col){
  line(c,s,-1.05,.5,1.05,.5,col,.12);for(const x of[-.58,.58]){box(c,s,x-.06,-.77,.12,1.52,metal);line(c,s,x-.13,-.77,x+.13,-.77,cream,.035);}
  c.beginPath();c.moveTo(-s,-.05*s);c.quadraticCurveTo(-.8*s,.34*s,-.58*s,-.66*s);c.quadraticCurveTo(0,.32*s,.58*s,-.66*s);c.quadraticCurveTo(.8*s,.34*s,s,-.05*s);c.strokeStyle=col;c.lineWidth=s*.04;c.stroke();
  for(let i=0;i<9;i++){const x=-.45+i*.1125;line(c,s,x,-.4+Math.sin((i/8)*Math.PI)*.35,x,.45,metal,.016);}
  line(c,s,-1.05,.58,1.05,.58,ink,.035);
}
function windTurbine(c,s,col,t){
  shape(c,s,[[-.1,.8],[-.035,-.35],[.035,-.35],[.1,.8]],cream);box(c,s,-.2,.79,.4,.08,col);
  c.save();c.translate(0,-.36*s);c.rotate(t*.7);for(let i=0;i<3;i++){c.rotate(tau/3);shape(c,s,[[0,0],[.03,-.18],[.08,-.75],[-.02,-.81],[-.07,-.2]],cream);}c.restore();oval(c,s,0,-.36,.085,.085,col);
}
function solarFarm(c,s,col){
  for(let row=0;row<2;row++)for(let i=0;i<3;i++){
    const x=-.95+i*.64,y=-.6+row*.63;line(c,s,x+.2,y+.38,x+.2,y+.56,metal,.025);
    shape(c,s,[[x,y+.32],[x+.14,y],[x+.66,y],[x+.52,y+.32]],col);
    for(let j=1;j<4;j++)line(c,s,x+j*.13,y+.31,x+.14+j*.13,y,glass,.012);line(c,s,x+.07,y+.16,x+.59,y+.16,glass,.012);
  }
}
function tree(c,s,col){
  box(c,s,-.09,-.15,.18,.95,'#8b7154');for(const [x,y,r] of[[-.3,-.3,.36],[.3,-.3,.36],[0,-.64,.44],[0,-.1,.32]])oval(c,s,x,y,r,r,col);
  line(c,s,-.14,-.61,-.03,-.74,tint(col,35),.05);line(c,s,-.1,.43,-.1,.67,'#c2a278',.02);
}
function traveler(c,s,col,t){
  const step=Math.sin(t*3)*.12;
  line(c,s,-.1,.12,-.21-step,.72,'#485867',.16);line(c,s,.1,.12,.22+step,.72,'#485867',.16);
  box(c,s,-.33,.7,.26,.1,ink);box(c,s,.12,.7,.28,.1,ink);box(c,s,-.35,-.4,.22,.5,'#ad7e4e');
  box(c,s,-.23,-.44,.46,.64,col,.12);line(c,s,-.2,-.37,.23,.13,'#ded5b3',.04);
  line(c,s,.24,-.3,.45,-.02,col,.12);oval(c,s,.46,.02,.07,.07,'#d2ab84');
  oval(c,s,0,-.67,.18,.21,'#d2ab84');shape(c,s,[[-.23,-.77],[-.13,-.95],[.14,-.95],[.26,-.77]],'#9b865e');line(c,s,-.3,-.77,.32,-.77,ink,.04);line(c,s,.49,.06,.53,.83,'#8c7355',.025);
}
const entry=(label,color,group,draw,extra={})=>({label,color,group,timeUnit:'seconds',draw:(c,s,col=color,t=0)=>draw(c,s,col,t),...extra});
export const MODERN_OBJECTS={
  tank:entry('Tank','#6b7f4a','modern',tank),
  warship:entry('Warship','#8a9aa6','modern',ship),
  jet:entry('Fighter jet','#b9c3cc','modern',aircraft,{rot:1,air:1}),
  helicopter:entry('Helicopter','#6b7f4a','modern',helicopter,{air:1}),
  drone:entry('Drone','#647681','modern',drone,{rot:1,air:1}),
  submarine:entry('Submarine','#4a5a66','modern',submarine),
  missile:entry('Missile','#d9d9d9','modern',missile,{rot:1,air:1}),
  base:entry('Military base','#8b6f47','modern',base),
  city:entry('City skyline','#9fb4c2','places',city),
  camp:entry('Campsite / tents','#a0875a','nature',camp),
  factory:entry('Factory','#8d99a6','infrastructure',factory),
  airport:entry('Airport','#7d8c99','infrastructure',airport),
};
export const CIVILIAN_OBJECTS={
  car:entry('Passenger car','#b96c56','transport',(c,s,col)=>vehicle(c,s,col)),
  bus:entry('City bus','#cfac5b','transport',(c,s,col)=>vehicle(c,s,col,'bus')),
  train:entry('Passenger train','#628f9e','transport',(c,s,col)=>vehicle(c,s,col,'train')),
  deliveryTruck:entry('Delivery / cargo truck','#6e9b90','trade',(c,s,col)=>vehicle(c,s,col,'truck')),
  ambulance:entry('Ambulance','#e4e3cf','transport',(c,s,col)=>vehicle(c,s,col,'ambulance')),
  airliner:entry('Passenger airliner','#e8e5d8','transport',(c,s,col,t)=>aircraft(c,s,col,t,true),{rot:1,air:1}),
  cargoShip:entry('Container ship','#547d8d','trade',(c,s,col,t)=>ship(c,s,col,t,true)),
  ferry:entry('Passenger ferry','#6b93a0','transport',ferry),
  bicycle:entry('Bicycle','#668a72','transport',bicycle),
  house:entry('House','#c6a47b','places',(c,s,col)=>building(c,s,col)),
  hospital:entry('Hospital','#ced9d3','places',(c,s,col)=>building(c,s,col,'hospital')),
  school:entry('School','#bd9a70','places',(c,s,col)=>building(c,s,col,'school')),
  lighthouse:entry('Lighthouse','#b96d56','places',lighthouse),
  bridge:entry('Suspension bridge','#b68a67','infrastructure',bridge),
  windTurbine:entry('Wind turbine','#839e91','infrastructure',windTurbine),
  solarFarm:entry('Solar farm','#486d94','infrastructure',solarFarm),
  tree:entry('Leafy tree','#6d8c59','nature',tree),
  traveler:entry('Hiker / traveler','#a18b5c','nature',traveler),
};
