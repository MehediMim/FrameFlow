import { shape, box, line, oval, arch, miniature, INK, IVORY } from './map-miniature-drawing.mjs';

// Stylized map miniatures, rather than portraits or regiment-specific uniforms.
const GOLD='#c6a45f', WOOD='#805b3a', SKIN='#ab7651', STEEL='#9da9aa';
const entry=(label,color,group,draw)=>({...miniature(label,color,group,draw),historic:true});
function wheel(c,s,x,y,r){
  oval(c,s,x,y,r,r,WOOD);oval(c,s,x,y,r*.72,r*.72,GOLD);
  for(let i=0;i<6;i++){const a=i*Math.PI/3;line(c,s,x,y,x+Math.cos(a)*r*.7,y+Math.sin(a)*r*.7,WOOD,.025);}
  oval(c,s,x,y,.04,.04,INK);
}
function turban(c,s,x,y,col){
  oval(c,s,x,y,.2,.13,col);line(c,s,x-.16,y+.02,x+.12,y-.07,IVORY,.035);
  line(c,s,x-.1,y+.07,x+.17,y-.02,GOLD,.025);oval(c,s,x+.1,y-.01,.03,.04,GOLD);
}
function person(c,s,col,t,kind='merchant'){
  const company=kind==='sepoy'||kind==='officer',sway=Math.sin(t*2)*.015;
  box(c,s,-.2,.1,.15,.52,company?IVORY:'#d1b58b');box(c,s,.06,.1,.15,.52,company?IVORY:'#d1b58b');
  box(c,s,-.23,.6,.2,.09,WOOD);box(c,s,.04,.6,.21,.09,WOOD);
  shape(c,s,[[-.24,-.53],[.22,-.53],[.3,.22],[-.3,.22]],col);
  line(c,s,-.2,-.49,.18,.17,company?IVORY:GOLD,.055);
  box(c,s,-.29,.08,.58,.08,company?'#252b35':GOLD);
  oval(c,s,0,-.73,.15,.19,SKIN);
  if(kind==='officer'){
    box(c,s,-.18,-1.13,.36,.29,'#2d343b');box(c,s,-.28,-.86,.57,.06,'#2d343b');
    line(c,s,0,-1.13,.06,-1.34,IVORY,.055);box(c,s,-.29,-.53,.13,.07,GOLD);
  }else turban(c,s,0,-.91,company?'#2b3b4d':col);
  line(c,s,-.23,-.4,-.39,-.04,col,.13);line(c,s,.22,-.4,.4,-.2+sway,col,.13);
  oval(c,s,.4,-.2+sway,.07,.07,SKIN);
  if(kind==='matchlock'||kind==='sepoy'){
    line(c,s,-.08,.11,.81,-1.04,WOOD,.08);line(c,s,.24,-.32,.88,-1.15,STEEL,.035);
    if(company)line(c,s,.88,-1.15,1,-1.33,STEEL,.025);
    else line(c,s,.18,-.23,.08,-.32,GOLD,.025);
  }else if(kind==='guard'){
    oval(c,s,-.42,-.06,.25,.29,STEEL);
    for(const [x,y]of[[-.51,-.15],[-.33,-.15],[-.51,.03],[-.33,.03]])oval(c,s,x,y,.025,.025,GOLD);
    c.beginPath();c.moveTo(.38*s,-.2*s);c.quadraticCurveTo(.83*s,-.55*s,.74*s,-.95*s);c.strokeStyle=STEEL;c.lineWidth=.06*s;c.stroke();
    line(c,s,.31,-.23,.49,-.14,GOLD,.04);
  }else if(kind==='merchant'){
    box(c,s,.23,-.22,.43,.5,WOOD);line(c,s,.3,-.13,.58,-.13,GOLD,.025);
    line(c,s,-.37,-.05,-.48,.65,WOOD,.035);
  }
}
function horse(c,s,col,t){
  const step=Math.sin(t*2.6)*.025;
  shape(c,s,[[-.8,-.07],[-.57,-.4],[.29,-.4],[.52,-.89],[.82,-1.02],[1.02,-.81],[.91,-.63],[.66,-.63],[.51,-.03],[.24,.14],[-.53,.15]],'#82573d');
  for(const [x,lean]of[[-.57,-.09],[-.35,.11],[.28,-.08],[.48,.1]])line(c,s,x,.03,x+lean+step,.65,'#82573d',.085);
  line(c,s,-.78,-.08,-1.01,.25,INK,.075);
  shape(c,s,[[-.35,-.42],[.22,-.42],[.33,-.03],[-.42,-.03]],col);
  line(c,s,-.33,-.09,.23,-.09,GOLD,.04);line(c,s,.53,-.7,.91,-.73,GOLD,.025);
  c.save();c.translate(-.04*s,-.55*s);person(c,s*.65,col,t,'guard');c.restore();
}
function elephant(c,s,col){
  for(const x of[-.61,-.36,.31,.55])box(c,s,x,.09,.18,.66,'#7b8889');
  oval(c,s,-.08,-.19,.9,.57,'#8e9b9a');oval(c,s,.72,-.43,.4,.42,'#8e9b9a');
  oval(c,s,.51,-.4,.24,.33,'#788584');
  c.beginPath();c.moveTo(1.01*s,-.45*s);c.bezierCurveTo(1.3*s,-.12*s,.99*s,.61*s,1.26*s,.48*s);c.strokeStyle='#8e9b9a';c.lineWidth=.18*s;c.lineCap='round';c.stroke();
  line(c,s,.88,-.16,1.12,-.01,IVORY,.055);oval(c,s,.86,-.52,.025,.025,INK);
  line(c,s,-.95,-.21,-1.06,.29,INK,.035);
  shape(c,s,[[-.7,-.6],[.42,-.6],[.46,.15],[-.67,.15]],col);
  for(let x=-.56;x<.4;x+=.19){line(c,s,x,-.5,x,.08,GOLD,.025);oval(c,s,x,.16,.04,.04,GOLD);}
  box(c,s,-.46,-1.02,.75,.45,GOLD);box(c,s,-.39,-.93,.61,.3,col);
  for(const x of[-.48,.29])line(c,s,x,-1.02,x,-1.54,GOLD,.035);
  shape(c,s,[[-.65,-1.48],[-.1,-1.79],[.46,-1.48]],col);line(c,s,-.1,-1.79,-.1,-1.94,GOLD,.04);
}
function gun(c,s,col,company=false){
  shape(c,s,[[-.83,.28],[-.44,-.05],[.39,-.05],[.8,.28]],WOOD);
  c.save();c.translate(-.2*s,-.22*s);c.rotate(-.15);
  box(c,s,-.54,-.15,1.6,.3,company?STEEL:GOLD);box(c,s,.9,-.2,.17,.4,col);
  for(const x of[-.26,.2,.64])box(c,s,x,-.18,.06,.36,col);c.restore();
  wheel(c,s,-.42,.28,.34);wheel(c,s,.43,.28,.3);
  for(const [x,y]of[[-.91,.59],[-.73,.6],[-.82,.44]])oval(c,s,x,y,.08,.08,INK);
  if(company){box(c,s,.76,.34,.36,.24,col);line(c,s,.8,.4,1.08,.4,GOLD,.025);}
}
function dome(c,s,x,y,r,col){
  c.beginPath();c.moveTo((x-r)*s,y*s);c.bezierCurveTo((x-r*1.2)*s,(y-r*.7)*s,(x-r*.2)*s,(y-r*.9)*s,x*s,(y-r*1.4)*s);
  c.bezierCurveTo((x+r*.2)*s,(y-r*.9)*s,(x+r*1.2)*s,(y-r*.7)*s,(x+r)*s,y*s);c.closePath();c.fillStyle=col;c.fill();c.strokeStyle=INK;c.lineWidth=.025*s;c.stroke();
  line(c,s,x,y-r*1.4,x,y-r*1.7,GOLD,.025);oval(c,s,x,y-r*1.7,.025,.025,GOLD);
}
function mughalFort(c,s,col){
  box(c,s,-1,-.38,2,1,col);
  for(let x=-.96;x<1;x+=.2)box(c,s,x,-.52,.13,.18,col);
  for(const x of[-.98,.6]){
    box(c,s,x,-.9,.4,1.5,col);dome(c,s,x+.2,-.92,.26,IVORY);
    arch(c,s,x+.12,-.51,.16,.3,INK);line(c,s,x,-.15,x+.4,-.15,GOLD,.025);
  }
  box(c,s,-.35,-.71,.7,1.3,col);arch(c,s,-.22,-.17,.44,.78,WOOD);
  dome(c,s,0,-.73,.4,IVORY);line(c,s,-.96,.35,-.4,.35,'#c58767',.025);line(c,s,.39,.35,.96,.35,'#c58767',.025);
}
function tomb(c,s,col){
  box(c,s,-1.09,.48,2.18,.18,col);box(c,s,-.69,-.25,1.38,.76,IVORY);
  box(c,s,-.36,-.43,.72,.94,col);arch(c,s,-.2,-.14,.4,.64,INK);
  dome(c,s,0,-.47,.52,IVORY);
  for(const x of[-.93,.8]){
    box(c,s,x,-.63,.13,1.11,IVORY);box(c,s,x-.06,-.7,.25,.08,col);dome(c,s,x+.065,-.77,.16,IVORY);
    for(const y of[-.36,.06,.35])line(c,s,x-.02,y,x+.15,y,GOLD,.025);
  }
  for(const x of[-.57,.4])arch(c,s,x,.01,.17,.32,'#697c7c');
}
function bullockCart(c,s,col,t){
  box(c,s,-1.1,-.24,1,.54,WOOD);box(c,s,-1.12,-.29,1.03,.11,col);
  for(const x of[-.91,-.58,-.25])box(c,s,x,-.64,.26,.34,col);
  line(c,s,-.1,.13,.83,.09,WOOD,.045);wheel(c,s,-.81,.39,.3);wheel(c,s,-.25,.39,.3);
  oval(c,s,.52,-.17,.48,.26,'#d6c9ad');oval(c,s,.92,-.38,.19,.21,'#d6c9ad');
  for(const x of[.2,.43,.71,.84])line(c,s,x,-.05,x+Math.sin(t*2)*.015,.5,'#d6c9ad',.065);
  line(c,s,.83,-.54,.76,-.74,IVORY,.04);line(c,s,1,-.54,1.04,-.74,IVORY,.04);
  line(c,s,.11,-.23,.98,-.25,col,.045);oval(c,s,.98,-.42,.022,.022,INK);
}
function palanquin(c,s,col){
  line(c,s,-1.25,.16,1.25,.16,WOOD,.08);box(c,s,-.68,-.63,1.36,.86,col);
  shape(c,s,[[-.86,-.64],[-.61,-.9],[.61,-.9],[.86,-.64]],GOLD);
  arch(c,s,-.43,-.48,.86,.69,INK);
  shape(c,s,[[-.41,-.43],[-.01,-.43],[-.24,.19],[-.41,.19]],IVORY);
  shape(c,s,[[.41,-.43],[.01,-.43],[.24,.19],[.41,.19]],IVORY);
  line(c,s,-.65,.26,.65,.26,GOLD,.04);oval(c,s,0,-1.03,.05,.1,GOLD);
}
function riverBoat(c,s,col,t){
  shape(c,s,[[-1.23,-.04],[-.91,.36],[.76,.36],[1.22,-.18],[.5,.03],[-.74,.03]],WOOD);
  shape(c,s,[[-.58,-.01],[-.51,-.54],[-.3,-.74],[.35,-.74],[.58,-.44],[.61,-.01]],col);
  for(const x of[-.38,-.12,.14,.4])line(c,s,x,-.65,x,-.05,GOLD,.025);
  line(c,s,-.71,-1.46,-.71,-.02,WOOD,.04);
  shape(c,s,[[-.67,-1.4],[.21,-.28],[-.67,-.28]],IVORY);
  line(c,s,.8,.01,1.14,.55+Math.sin(t)*.03,WOOD,.04);
}
function camel(c,s,col,t){
  shape(c,s,[[-.86,-.19],[-.57,-.34],[-.41,-.72],[-.17,-.76],[.03,-.33],[.39,-.27],[.48,-.98],[.69,-1.2],[1,-1.15],[1.06,-.97],[.73,-.91],[.74,-.05],[.35,.13],[-.55,.13]],'#b28a59');
  for(const x of[-.61,-.35,.39,.6])line(c,s,x,.03,x+Math.sin(t*2+x)*.025,.65,'#b28a59',.065);
  box(c,s,-.57,-.35,.43,.53,col);box(c,s,-.02,-.35,.43,.53,col);line(c,s,-.8,-.17,-.95,.2,WOOD,.025);
  line(c,s,.65,-.99,.97,-1.01,GOLD,.025);oval(c,s,.91,-1.09,.02,.02,INK);
}
function stepwell(c,s,col){
  shape(c,s,[[-1,-.58],[.22,-.95],[1,-.49],[-.18,-.08]],col);
  shape(c,s,[[-1,-.58],[-.18,-.08],[-.18,.74],[-1,.16]],'#997958');
  shape(c,s,[[1,-.49],[-.18,-.08],[-.18,.74],[1,.2]],col);
  for(let i=0;i<6;i++){
    const y=-.02+i*.105;line(c,s,-.9,y-.45,.15,y-.82,IVORY,.025);line(c,s,-.08,y+.05,.87,y-.3,IVORY,.025);
  }
  shape(c,s,[[-.5,.42],[-.05,.2],[.48,.42],[-.05,.65]],'#537f80');
  box(c,s,-1,-.74,.15,.32,col);box(c,s,.84,-.65,.15,.32,col);
}
function companyShip(c,s,col,t){
  shape(c,s,[[-1.1,-.13],[-.82,.37],[.58,.4],[1.12,-.25],[.54,-.1]],WOOD);
  box(c,s,-.98,-.38,.42,.3,col);line(c,s,-.78,.15,.73,.15,GOLD,.045);
  for(let x=-.6;x<.7;x+=.24)box(c,s,x,-.02,.1,.1,INK);
  for(const [x,top]of[[-.42,-1.58],[.2,-1.78],[.71,-1.3]]){
    line(c,s,x,top,x,-.13,WOOD,.04);
    for(const [dy,w]of[[.15,.52],[.65,.63]]){
      const y=top+dy,billow=Math.sin(t*1.5+x)*.025;
      shape(c,s,[[x-w/2,y],[x+w/2,y],[x+w*.55+billow,y+.43],[x-w*.55,y+.43]],IVORY);
      line(c,s,x-w/2,y,x+w/2,y,WOOD,.025);
    }
    shape(c,s,[[x,top],[x+.27,top+.05],[x,top+.13]],col);
    line(c,s,x,top+.1,-.8,-.14,'#a68c61',.015);
  }
  line(c,s,.84,-.15,1.25,-.53,WOOD,.045);
}
function tradingPost(c,s,col){
  box(c,s,-1.05,.45,2.1,.16,IVORY);box(c,s,-.88,-.71,1.76,1.16,col);
  shape(c,s,[[-1,-.73],[0,-1.2],[1,-.73]],IVORY);
  for(const x of[-.72,-.29,.15,.58]){box(c,s,x,-.62,.13,1.1,IVORY);box(c,s,x-.04,.39,.21,.08,IVORY);}
  arch(c,s,-.16,-.37,.32,.82,WOOD);
  for(const x of[-.5,.34])box(c,s,x,-.33,.18,.24,'#617b80');
  for(const x of[-1.05,.78]){box(c,s,x,.19,.29,.28,WOOD);line(c,s,x+.02,.23,x+.26,.43,GOLD,.025);}
}
function cargo(c,s,col){
  for(const [x,y,w,h]of[[-.92,-.2,.83,.73],[-.04,-.04,.91,.58],[-.47,-.78,.89,.56]]){
    box(c,s,x,y,w,h,col);line(c,s,x+.1,y,x+.1,y+h,GOLD,.055);line(c,s,x+w-.1,y,x+w-.1,y+h,GOLD,.055);
    line(c,s,x+.1,y+.08,x+w-.1,y+h-.08,WOOD,.025);
  }
  oval(c,s,.69,-.41,.3,.42,IVORY);line(c,s,.52,-.71,.87,-.71,WOOD,.04);
  shape(c,s,[[.6,-.3],[.69,-.49],[.78,-.3],[.69,-.16]],'#59754c');
}

export const SUBCONTINENT_OBJECTS={
  bullockCart:entry('Bullock cart','#b38750','subcontinent',bullockCart),
  palanquin:entry('Palanquin','#a8524c','subcontinent',palanquin),
  bengalRiverBoat:entry('Bengal river boat','#a28b59','subcontinent',riverBoat),
  subcontinentMerchant:entry('Subcontinent merchant','#b38a54','subcontinent',(c,s,col,t)=>person(c,s,col,t)),
  caravanCamel:entry('Caravan camel','#9b5c43','subcontinent',camel),
  stepwell:entry('Stepwell','#c4a174','subcontinent',stepwell),
  mughalMatchlock:entry('Mughal matchlock infantry','#52725c','mughal',(c,s,col,t)=>person(c,s,col,t,'matchlock')),
  mughalCavalry:entry('Mughal cavalry','#8b4948','mughal',horse),
  mughalWarElephant:entry('War elephant with howdah','#9c4943','mughal',elephant),
  mughalCannon:entry('Mughal field cannon','#658272','mughal',(c,s,col)=>gun(c,s,col)),
  mughalFort:entry('Mughal red sandstone fort','#ac5946','mughal',mughalFort),
  mughalTomb:entry('Mughal domed tomb','#c5a16f','mughal',tomb),
  companySepoy:entry('Company sepoy','#ab4542','company',(c,s,col,t)=>person(c,s,col,t,'sepoy')),
  companyOfficer:entry('Company officer','#a44640','company',(c,s,col,t)=>person(c,s,col,t,'officer')),
  companyFieldGun:entry('Company field gun','#465d60','company',(c,s,col)=>gun(c,s,col,true)),
  eastIndiaman:entry('East Indiaman merchant ship','#a34d47','company',companyShip),
  companyTradingPost:entry('Company trading post','#c1a37a','company',tradingPost),
  companyCargo:entry('Company cargo and tea chests','#92704e','company',cargo),
};
