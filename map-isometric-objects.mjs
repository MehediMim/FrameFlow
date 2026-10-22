import { IsoScene } from './map-isometric-geometry.mjs';
import { drawModelShadow } from './map-isometric-shadow.mjs';
import { currentSceneLighting } from './map-lighting.mjs';
import { objectViewOf } from './map-object-view.mjs';
import { OBJECT_ANIMATIONS, objectAnimationTime } from './map-object-animation.mjs';

// Explicit recipes for the complete catalog. No normal-view drawing function is
// used here: these miniatures are built from world-space volumes and surfaces.
const STONE='#b4b0a1',WOOD='#95643e',IRON='#56646b',GLASS='#7cb2bf',SKIN='#d5a176',GOLD='#d3a64d',WHITE='#eee6d1';
const models={};
const register=(family,recipes)=>{for(const [key,options]of Object.entries(recipes))models[key]={family,forward:['mounted','animal','vehicle','gun','ship','aircraft','bridge'].includes(family)||['bicycle','palanquin'].includes(key)?'x':'y',options:{...options,rustic:key.startsWith('kingdom')}};};
function slab(m,color='#8c9869',w=2.25,d=1.7){
  m.face([[-w*.6,-d*.6,-.012],[w*.6,-d*.6,-.012],[w*.6,d*.6,-.012],[-w*.6,d*.6,-.012]],color,1,false,'ground');m.faces.at(-1).groundColor=color;
}
function windows(m,x,y,z,w,h,count=3){
  for(let i=0;i<count;i++){
    const X=x+(i+.25)*w/count,W=w/count*.46;
    m.box(X-.018,y-.008,z-.018,W+.036,.018,h+.036,'#3f4845');m.box(X,y+.012,z,W,.012,h,GLASS);
    m.box(X-.025,y+.025,z-.025,W+.05,.045,.025,'#b5ac94');
    m.box(X+W*.48,y+.028,z,.012,.008,h,'#d3c9ae');
  }
}
function archOpening(m,x,y,z,w,h,stone=STONE){
  const radius=w/2,spring=h-radius,point=(a,R=radius)=>[x+w/2+Math.cos(a)*R,y,z+spring+Math.sin(a)*R];
  m.face([[x,y-.012,z],[x+w,y-.012,z],...Array.from({length:9},(_,i)=>point(i*Math.PI/8).map((v,k)=>k===1?v-.012:v))],'#343b37',1,false);
  for(const X of[x-.025,x+w-.025])m.box(X,y,z,.05,.025,spring,stone);
  for(let i=0;i<8;i++){const a=i*Math.PI/8,b=(i+1)*Math.PI/8;m.face([point(a),point(b),point(b,radius+.055),point(a,radius+.055)],stone,i%2?1:.94);}
}
function house(m,{x=-.7,y=-.5,z=0,w=1.4,d=1,h=.8,roof='#a96540',wall=WHITE}={}){
  m.withMaterial('plaster',()=>m.box(x,y,z,w,d,h,wall));
  m.box(x-.015,y-.015,z,w+.03,d+.03,.085,STONE);
  m.withMaterial(roof==='#b79859'?'thatch':'tile',()=>m.roof(x-.11,y-.1,z+h,w+.22,d+.2,.48,roof));
  m.beam([x-.12,y+d/2,z+h+.48],[x+w+.12,y+d/2,z+h+.48],.025,roof);
  for(const Y of[y-.08,y+d+.08])m.beam([x-.1,Y,z+h],[x+w+.1,Y,z+h],.022,WOOD);
  m.box(x+w*.41,y+d+.012,z,.28,.02,h*.7,'#49483d');m.bevelBox(x+w*.43,y+d+.038,z,.23,.035,h*.66,WOOD,.015);
  m.ball(x+w*.61,y+d+.08,z+h*.31,.012,.012,.012,GOLD,6,4);
  m.box(x+w*.36,y+d+.02,z,.4,.19,.055,STONE);windows(m,x+w*.035,y+d+.015,z+h*.48,w*.3,h*.25,1);windows(m,x+w*.69,y+d+.015,z+h*.48,w*.27,h*.25,1);
  m.box(x+w+.01,y+d*.25,z+h*.42,.025,d*.3,h*.25,GLASS);
  for(const X of[x+.02,x+w-.035])m.box(X,y+d+.025,z,.035,.035,h,WOOD);
  m.box(x+.02,y+d+.025,z+h-.07,w-.04,.035,.04,WOOD);
  m.beam([x+w+.045,y+d*.25,z+h*.42],[x+w+.045,y+d*.55,z+h*.67],.012,'#d2c6a4');
}
function tower(m,x,y,h=1.5,roof=true,color=STONE,r=.24){
  m.box(x-r,y-r,0,r*2,r*2,h,color);
  if(roof)m.cone(x,y,h,r*1.5,.45,'#92543c',4);
  else{m.box(x-r-.04,y-r-.04,h,r*2+.08,r*2+.08,.12,color);for(const dx of[-r,r-.1])for(const dy of[-r,r-.1])m.box(x+dx,y+dy,h+.12,.1,.1,.18,color);}
  m.box(x-.055,y+r+.007,h*.6,.11,.02,.22,'#3b4140');
  m.box(x-r-.012,y-r-.012,.08,r*2+.024,r*2+.024,.08,'#9a9584');
  m.box(x-r-.025,y-r-.025,h*.77,r*2+.05,r*2+.05,.04,color);
  for(const dx of[-r,r-.035])m.box(x+dx,y+r+.012,.1,.035,.025,h*.65,'#cbc3ad');
}
function flag(m,x,y,z,color,t=0){
  m.beam([x,y,0],[x,y,z],.025,WOOD);
  const pts=Array.from({length:7},(_,i)=>[x+i*.1,y+Math.sin(t*3+i*.6)*.04,z-.06+Math.sin(t*3+i*.6)*.015]);
  for(let i=0;i<pts.length-1;i++)m.face([pts[i],pts[i+1],pts[i+1].map((v,k)=>k===2?v-.34:v),pts[i].map((v,k)=>k===2?v-.34:v)],color,1,false,'cloth');
}
function cross(m,x,y,z,color='#bd4540'){
  m.box(x-.04,y,z-.18,.08,.035,.36,color);m.box(x-.16,y-.001,z-.04,.32,.038,.08,color);
}
function crates(m,x=0,y=0,kind='crates'){
  if(kind==='coins'){for(let i=0;i<4;i++)m.cylinder(x+(i%2)*.36,y+Math.floor(i/2)*.35,0,.24,.12+(i%3)*.12,GOLD);return;}
  for(let i=0;i<3;i++){
    const X=x+(i%2)*.53,Y=y+Math.floor(i/2)*.48,Z=i===2?.43:0;
    if(kind==='barrels'||kind==='sacks'){
      if(kind==='barrels'){m.cylinder(X+.2,Y+.2,Z,.23,.52,WOOD);for(const h of[.08,.38])m.cylinder(X+.2,Y+.2,Z+h,.237,.055,IRON);}
      else{m.ball(X+.2,Y+.2,Z+.25,.23,.21,.28,'#cab481');m.frustum(X+.2,Y+.2,Z+.47,.07,.1,.09,'#cab481',8);m.cylinder(X+.2,Y+.2,Z+.49,.075,.025,WOOD,8);}
    }else{m.box(X,Y,Z,.48,.43,.43,WOOD);m.beam([X,Y+.435,Z],[X+.48,Y+.435,Z+.43],.025,'#d8b981');m.beam([X+.48,Y+.435,Z],[X,Y+.435,Z+.43],.025,'#d8b981');}
  }
}
function tree(m,x,y,kind='leaf',scale=1){
  const h=scale*1.1;m.frustum(x,y,0,.105*scale,.045*scale,h,WOOD,9);
  if(kind==='pine'){
    for(let j=0;j<5;j++){
      const z=h*.35+j*.22*scale,r=(.52-j*.085)*scale;
      for(let i=0;i<12;i++){const a=i*Math.PI/6,b=(i+1)*Math.PI/6,R=r*(i%2?.83:1);m.face([[x+Math.cos(a)*R,y+Math.sin(a)*R,z],[x+Math.cos(b)*r*.9,y+Math.sin(b)*r*.9,z+.035*scale],[x,y,z+.55*scale]],j%2?'#456649':'#365c45',1,false);}
    }
  }
  else if(kind==='palm'){
    for(let j=0;j<7;j++)m.cylinder(x,y,j*h/8,.09*scale-j*.005*scale,.025*scale,'#75634b',9);
    for(let i=0;i<9;i++){
      const a=i*Math.PI*2/9,point=u=>[x+Math.cos(a)*u*.85*scale,y+Math.sin(a)*u*.85*scale,h+(.16+Math.sin(u*Math.PI)*.23-u*u*.35)*scale];
      for(let j=0;j<5;j++){
        const u=j/5,v=(j+1)/5,p=point(u),q=point(v),width=Math.sin(v*Math.PI)*.12*scale,previous=Math.sin(u*Math.PI)*.12*scale;
        for(const sign of[-1,1])m.face([p,q,[q[0]+Math.cos(a+Math.PI/2)*width*sign,q[1]+Math.sin(a+Math.PI/2)*width*sign,q[2]-.025*scale],[p[0]+Math.cos(a+Math.PI/2)*previous*sign,p[1]+Math.sin(a+Math.PI/2)*previous*sign,p[2]-.025*scale]],i%2?'#507645':'#385f37',1,false);
        m.tube(p,q,.003*scale,.003*scale,'#7b9250',5);
      }
    }for(const X of[-.07,.07])m.ball(x+X*scale,y,h,.08*scale,.06*scale,.08*scale,'#776043',8,4);
  }else{
    for(let i=0;i<9;i++){
      const a=i*2.399,r=(i%3===0?.38:.24)*scale,X=x+Math.cos(a)*r,Y=y+Math.sin(a)*r,Z=h+.1*scale+(i%3)*.17*scale;
      m.tube([x,y,h*.55],[X,Y,Z],.035*scale,.012*scale,WOOD,6);
      m.ball(X,Y,Z,(.27+(i%2)*.06)*scale,.25*scale,.29*scale,['#4a6c3f','#647c46','#3d603c'][i%3],10,6);
      for(let j=0;j<2;j++)m.ball(X+Math.cos(a+j)*.18*scale,Y+Math.sin(a+j)*.15*scale,Z+.13*scale,.13*scale,.13*scale,.13*scale,j?'#72874f':'#567542',7,4);
    }
  }
  for(let i=0;i<4;i++){const a=i*Math.PI/2;m.tube([x,y,.12*scale],[x+Math.cos(a)*.24*scale,y+Math.sin(a)*.24*scale,.015],.045*scale,.012*scale,WOOD,6);}
}
function person(m,o,col,t,x=0,y=0,z=0,scale=1){
  // Tapered limbs, an oval ribcage and a smaller head replace the block figure.
  const walking=!o.seated&&['walk','run'].includes(o.animation),running=o.animation==='run',phase=t*(running?10:6),stride=walking?Math.sin(phase)*(running?.32:.22):0,bob=walking?(1-Math.cos(phase*2))*(running?.035:.018):0;
  const q=(X,Y,Z)=>o.seated?[x+Y*scale,y-X*scale,z+(Z-.64)*scale]:[x+X*scale,y+(Y-(walking?Math.sign(X)*stride*.6*Math.max(0,Math.min(1,(Math.abs(X)-.17)/.14)):0))*scale,z+(Z+bob*Math.min(1,Z/.7))*scale],b=(X,Y,Z,w,d,h,c)=>m.box(...q(X,Y,Z),w*scale,d*scale,h*scale,c);
  const beam=(a,b,r,c)=>m.beam(q(...a),q(...b),r*scale,c);
  const limb=(a,b,r,R,c)=>m.tube(q(...a),q(...b),r*scale,R*scale,c,8);
  for(const X of[-.12,.12]){
    if(o.seated){const side=Math.sign(X);limb([X,0,.7],[side*.28,.15,.43],.08,.065,o.dress?col:'#505a60');limb([side*.28,.15,.43],[side*.29,.24,.05],.065,.045,o.dress?col:'#505a60');m.bevelBox(...q(side*.29,.22,.01),.13*scale,.2*scale,.1*scale,'#3d3832',.025);continue;}
    const step=Math.sign(X)*stride,lift=walking?Math.max(0,Math.sin(phase+(X<0?Math.PI:0)))*(running?.2:.12):0;
    m.bevelBox(...q(X-.065,-.08+step,lift),.13*scale,.24*scale,.12*scale,'#3d3832',.035*scale);
    limb([X,step,.12+lift],[X-.015,step*.55+.005,.38+lift*.5],.055,.073,o.dress?col:'#505a60');limb([X-.015,step*.55+.005,.38+lift*.5],[X*.85,0,.7],.073,.085,o.dress?col:'#505a60');
  }
  m.ball(...q(0,0,.86),.19*scale,.115*scale,.28*scale,o.coat||col);
  m.frustum(...q(0,0,.64),.16*scale,.19*scale,.43*scale,o.coat||col,10);
  b(-.19,-.12,.67,.38,.245,.045,WOOD);b(-.022,.132,.68,.05,.018,.045,GOLD);
  if(o.dress)m.frustum(...q(0,0,.12),.29*scale,.14*scale,.59*scale,col,12);
  limb([0,0,1.07],[0,0,1.25],.06,.055,SKIN);
  m.ball(...q(0,0,1.36),.125*scale,.108*scale,.17*scale,SKIN,14,8);
  m.ball(...q(-.025,-.035,1.46),.126*scale,.105*scale,.095*scale,'#674b38',10,6);
  m.ball(...q(.025,.107,1.35),.025*scale,.04*scale,.035*scale,SKIN,6,4);
  for(const X of[-.05,.052])b(X,.102,1.392,.019,.012,.015,'#423b34');
  beam([-.035,.108,1.28],[.04,.108,1.28],.006,'#8b5c4a');
  limb([-.17,0,1.04],[-.25,.04,.83],.073,.057,o.coat||col);limb([-.25,.04,.83],[-.31,.12,.69],.057,.04,o.coat||col);
  limb([.17,0,1.04],[.28,.07,.9],.073,.057,o.coat||col);limb([.28,.07,.9],[.35,.18,.79],.057,.04,o.coat||col);
  m.ball(...q(-.31,.12,.67),.045*scale,.036*scale,.065*scale,SKIN,8,4);m.ball(...q(.35,.18,.77),.045*scale,.036*scale,.065*scale,SKIN,8,4);
  for(const Z of[.78,.88,.98])m.ball(...q(0,.117,Z),.009*scale,.009*scale,.009*scale,GOLD,5,3);
  for(const X of[-.095,.095])beam([X,.108,.72],[X*.8,.109,.96],.005,'#515749');
  if(o.hat==='helmet'){m.ball(...q(0,0,1.5),.16*scale,.145*scale,.095*scale,IRON);m.cylinder(...q(0,0,1.46),.175*scale,.027*scale,IRON,12);beam([-.14,.02,1.47],[-.1,.09,1.27],.011,WOOD);}
  else if(o.hat==='crown'){m.cylinder(...q(0,0,1.5),.14*scale,.07*scale,GOLD,12);for(const X of[-.12,0,.12])b(X,-.12,1.57,.035,.035,.1,GOLD);}
  else if(o.hat==='turban'){m.ball(...q(0,0,1.53),.155*scale,.13*scale,.12*scale,WHITE);for(const Z of[1.49,1.53,1.57])beam([-.12,.08,Z],[.1,.12,Z+.01],.009,'#b9b5a6');b(-.02,.14,1.54,.04,.03,.06,GOLD);}
  else if(o.hat==='chef'){b(-.2,-.17,1.5,.4,.34,.22,WHITE);for(const X of[-.13,0,.13])m.ball(...q(X,0,1.76),.12*scale,.18*scale,.12*scale,WHITE);}
  else if(o.hat){const color=o.hat==='hardhat'?GOLD:o.hat==='straw'?'#d3bc80':o.hat==='nurse'?WHITE:col;m.cylinder(...q(0,0,1.5),.145*scale,.085*scale,color,12);m.cylinder(...q(0,0,1.49),(o.hat==='straw'?.24:.18)*scale,.025*scale,color,12);if(o.hat==='nurse')b(-.025,.15,1.52,.05,.015,.05,'#c44942');}
  if(o.tool==='rifle'||o.tool==='spear'||o.tool==='pike'){
    limb([.38,.21,.12],[.38,.21,o.tool==='rifle'?1.62:2.1],.026,.019,WOOD);limb([.38,.21,.7],[.38,.21,o.tool==='rifle'?1.72:2.28],.019,.014,IRON);
    if(o.tool==='rifle'){b(.35,.19,.13,.065,.06,.34,WOOD);b(.355,.17,.66,.055,.06,.09,IRON);beam([.35,.16,.68],[.4,.16,.76],.009,IRON);}
    if(o.tool!=='rifle')m.cone(...q(.38,.21,2.15),.07*scale,.25*scale,IRON,4);
  }else if(o.tool==='bow'){
    const pts=Array.from({length:9},(_,i)=>q(.37+Math.sin(i*Math.PI/8)*.3,.23,.35+i*.15));
    for(let i=1;i<pts.length;i++)m.beam(pts[i-1],pts[i],.025*scale,WOOD);m.beam(pts[0],pts.at(-1),.009*scale,WHITE);
  }else if(o.tool==='sword'){beam([.36,.2,.75],[.67,.2,1.6],.03,IRON);beam([.24,.2,.83],[.49,.2,.74],.035,GOLD);}
  else if(o.tool==='staff'||o.tool==='hoe'||o.tool==='axe'||o.tool==='wrench'){
    beam([-.38,.18,.03],[-.38,.18,1.55],.026,WOOD);
    if(o.tool!=='staff')b(-.53,.13,1.39,.34,.12,.16,IRON);
  }else if(o.tool==='book'||o.tool==='map')b(.25,.21,.73,.33,.07,.4,o.tool==='map'?WHITE:'#956049');
  else if(o.tool==='camera'||o.tool==='binoculars'){
    b(.18,.15,.89,.32,.2,.19,'#343f43');m.beam(q(.29,.3,.98),q(.29,.43,.98),.075*scale,IRON);
  }else if(o.tool==='spyglass'){m.beam(q(.25,.1,1.3),q(.75,.1,1.4),.055*scale,GOLD);}
  else if(o.tool==='palette'){m.ball(...q(.4,.22,.8),.17*scale,.07*scale,.22*scale,WOOD);beam([-.34,.16,.7],[-.38,.16,1.2],.014,WOOD);}
  else if(o.tool==='flask'){m.cone(...q(.38,.2,.75),.12*scale,.2*scale,GLASS);b(.35,.17,.94,.06,.06,.1,GLASS);}
  else if(o.tool==='parcel')b(.25,.17,.55,.36,.32,.36,WOOD);
  if(o.medical){b(-.48,.17,.5,.28,.16,.24,WHITE);cross(m,...q(-.34,.34,.62));}
  if(o.radio){b(-.2,-.32,.67,.4,.16,.4,IRON);beam([-.1,-.25,1],[-.1,-.25,1.82],.012,IRON);}
  if(o.tie)b(-.025,.182,.81,.05,.025,.25,GOLD);
}
function animal(m,kind,col,x=-.25,y=0){
  const elephant=kind==='elephant',camel=kind==='camel',h=elephant?.85:.65,L=elephant?1.3:1.1,W=elephant?.65:.4;
  for(const X of[-.6,.3])for(const Y of[-W*.4,W*.4]){
    m.tube([x+X,y+Y,.07],[x+X-.06,y+Y,h*.45],elephant?.1:.035,elephant?.13:.05,col,8);
    m.tube([x+X-.06,y+Y,h*.45],[x+X+.02,y+Y,h],elephant?.13:.05,elephant?.16:.09,col,8);
    m.bevelBox(x+X-.065,y+Y-.055,.01,.14,.12,.09,'#433f36',.025);
  }
  m.ball(x,y,h+.22,L*.6,W*.7,elephant?.42:.28,col);
  m.tube([x+.4,y,h+.25],[x+.7,y,h+(camel?.95:.65)],elephant?.24:.16,elephant?.17:.09,col,10);m.ball(x+.77,y,h+(camel?.92:.63),.25,.12,.17,col);
  m.ball(x+.88,y+.102,h+(camel?.98:.69),.016,.012,.016,'#242c2c',7,4);
  for(const Y of[-.085,.085])m.cone(x+.65,y+Y,h+(camel?1.08:.79),.045,.16,col,6);
  if(elephant){m.tube([x+.96,y,h+.5],[x+1.06,y,.6],.12,.08,col,10);m.tube([x+1.06,y,.6],[x+1.12,y,.22],.08,.045,col,10);m.ball(x+.59,y+.25,h+.48,.22,.065,.33,col);m.box(x-.4,y-.3,h+.52,.65,.6,.32,'#a8653f');for(const Y of[-.15,.15])m.tube([x+.83,y+Y,h+.42],[x+1.16,y+Y,h+.24],.045,.008,WHITE,8);}
  else if(camel)m.ball(x-.2,y,h+.5,.25,.22,.29,col);
  else{m.tube([x-.55,y,h+.28],[x-.85,y,h-.12],.045,.022,'#534536',8);m.beam([x+.4,y-.01,h+.29],[x+.63,y-.01,h+.68],.045,'#514432');}
  m.tube([x+.82,y+.125,h+.64],[x+.35,y+.24,h+.3],.008,.008,WOOD,6);m.box(x-.28,y-.23,h+.36,.48,.46,.045,'#785342');
}
register('person',{
  conqueror:{hat:'helmet',tool:'sword'},expeditionLeader:{hat:'straw',tool:'map'},general:{hat:'cap',tool:'sword',tie:true},
  admiral:{hat:'cap',tool:'spyglass',tie:true},monarch:{hat:'crown',tool:'staff',dress:true},queen:{hat:'crown',dress:true},navigator:{hat:'cap',tool:'map'},diplomat:{hat:'cap',tool:'book'},
  explorer:{hat:'straw',tool:'spyglass'},musketeer:{hat:'cap',tool:'rifle'},pikeman:{hat:'helmet',tool:'pike'},subcontinentMerchant:{hat:'turban',tool:'parcel',dress:true},
  mughalMatchlock:{hat:'turban',tool:'rifle'},companySepoy:{hat:'cap',tool:'rifle'},companyOfficer:{hat:'cap',tool:'sword',tie:true},soldier:{hat:'helmet',tool:'rifle'},fieldOfficer:{hat:'cap',tool:'binoculars'},radioOperator:{hat:'helmet',radio:true},fieldMedic:{hat:'helmet',medical:true},
  traveler:{hat:'straw',tool:'staff',radio:true},doctor:{coat:WHITE,medical:true},nurse:{hat:'nurse',coat:WHITE,medical:true},engineer:{hat:'hardhat',tool:'map'},constructionWorker:{hat:'hardhat',tool:'hoe'},farmer:{hat:'straw',tool:'hoe'},chef:{hat:'chef',coat:WHITE,tool:'book'},teacher:{tool:'book'},firefighter:{hat:'hardhat',tool:'axe'},policeOfficer:{hat:'cap',tool:'staff',tie:true},scientist:{coat:WHITE,tool:'flask'},pilot:{hat:'cap',tie:true},officeWorker:{tool:'book',tie:true},artist:{tool:'palette'},photographer:{tool:'camera'},mechanic:{hat:'cap',tool:'wrench'},deliveryWorker:{hat:'cap',tool:'parcel'},kingdomVillager:{tool:'hoe'},kingdomSpearman:{hat:'helmet',tool:'spear'},kingdomArcher:{tool:'bow'},
});
register('mounted',{mountedGeneral:{hat:'cap',tool:'sword'},cavalry:{hat:'helmet',tool:'sword'},mughalCavalry:{hat:'turban',tool:'spear'},mughalWarElephant:{hat:'turban',tool:'spear',animal:'elephant'}});
register('animal',{caravanCamel:{animal:'camel'}});
register('formation',{army:{}});

function vehicle(m,o,col,t){
  const train=o.kind==='train',bus=o.kind==='bus',truck=o.kind==='truck',tank=o.kind==='tank',wagon=o.kind==='wagon';
  const L=bus||train?2.35:2,W=tank?1.05:.85;
  if(tank){
    for(const y of[-.65,.43]){m.box(-1.08,y,.08,2.16,.24,.4,'#343c35');for(let i=0;i<6;i++)m.wheel(-.88+i*.35,y+.12,.28,.14,.14,IRON,true);}
    m.bevelBox(-1,-.52,.4,2,1.04,.35,col,.13);m.bevelBox(-.5,-.35,.73,.95,.7,.32,col,.1);m.cylinder(-.08,0,1.05,.18,.045,IRON,16);
    m.tube([.25,0,.9],[1.48,0,.94],.062,.045,IRON,10);m.tube([1.38,0,.936],[1.55,0,.944],.072,.068,IRON,10);
    m.face([[1.552,-.045,.9],[1.552,.045,.9],[1.552,.045,.98],[1.552,-.045,.98]],'#1d2626',1,false);
    for(const y of[-.55,.52]){m.box(-1,y,.48,1.9,.055,.07,col);for(let x=-1.03;x<1.03;x+=.12)m.box(x,y-.03,.075,.035,.26,.045,'#8b9181');}
    for(let i=0;i<6;i++)m.box(-.9+i*.085,-.3,.765,.035,.45,.012,'#364339');
    m.box(-.32,.36,.78,.42,.025,.17,'#817f61');m.beam([-.32,-.2,1.08],[-.4,-.23,1.65],.009,IRON);
    for(const x of[-.72,.63])m.box(x,.53,.56,.22,.025,.09,'#b6b58d');return;
  }
  for(const x of[-L*.34,L*.34])for(const y of[-W/2-.06,W/2-.02])m.wheel(x,y,.24,wagon?.31:.23,.14,'#30383c',true);
  m.bevelBox(-L/2,-W/2,.28,L,W,.24,col,.055);
  if(wagon){m.box(-.9,-.4,.54,1.8,.8,.34,WOOD);crates(m,-.65,-.22);for(const x of[-.7,-.1,.5])m.box(x,.425,.54,.045,.04,.42,WOOD);m.beam([.9,0,.4],[1.5,0,.35],.05,WOOD);return;}
  if(truck){m.bevelBox(-1,-.43,.53,1.24,.86,.88,col,.035);m.bevelBox(.25,-.4,.53,.75,.8,.6,col,.075);m.box(.7,-.41,.8,.22,.82,.23,GLASS);m.box(.99,-.3,.6,.035,.6,.18,IRON);for(let z=.68;z<1.36;z+=.12)m.box(-.96,.435,z,1.16,.009,.01,'#939e94');m.box(.4,.414,.73,.3,.025,.22,GLASS);}
  else if(!bus&&!train&&o.kind!=='ambulance'){
    m.bevelBox(-.78,-.4,.5,1.53,.8,.12,col,.045);
    m.face([[-.62,.34,.62],[.49,.34,.62],[.26,.28,.94],[-.52,.28,.94]],col);
    m.face([[-.62,-.34,.62],[.49,-.34,.62],[.26,-.28,.94],[-.52,-.28,.94]],col);
    m.face([[.49,-.345,.62],[.49,.345,.62],[.26,.28,.94],[.26,-.28,.94]],GLASS,1,false);
    m.face([[-.72,-.34,.6],[-.72,.34,.6],[-.52,.28,.93],[-.52,-.28,.93]],GLASS,1,false);
    m.bevelBox(-.53,-.3,.9,.8,.6,.065,col,.02);
    for(const [a,b]of[[-.57,-.18],[-.13,.39]])m.face([[a,.345,.65],[b,.345,.65],[b-.13,.295,.89],[a+.045,.295,.89]],GLASS,1,false);
    if(m.view==='isometricBack')for(const [a,b]of[[-.57,-.18],[-.13,.39]])m.face([[a,-.345,.65],[b,-.345,.65],[b-.13,-.295,.89],[a+.045,-.295,.89]],GLASS,1,false);
    m.box(-.14,.36,.53,.018,.015,.35,'#454e4d');m.box(-.02,.37,.59,.09,.018,.015,IRON);
  }
  else{
    m.bevelBox(-L*.42,-W*.46,.52,L*.84,W*.92,bus||train?.78:.59,col,.05);
    windows(m,-L*.31,W*.47,.73,L*.62,bus||train?.35:.23,bus||train?6:3);
    m.box(L*.33,-W*.4,.7,.035,W*.8,bus||train?.5:.26,GLASS);
    if(train){m.bevelBox(-L*.45,-.41,1.27,L*.9,.82,.1,IRON,.045);m.beam([-.4,0,1.37],[0,0,1.58],.02,IRON);m.beam([0,0,1.58],[.4,0,1.37],.02,IRON);for(const y of[-.55,.55])m.beam([-1.5,y,.02],[1.5,y,.02],.025,IRON);}
  }
  for(const y of[-.32,.22])m.box(L/2+.01,y,.39,.035,.13,.1,'#f0d48a');
  m.box(L/2+.018,-.36,.28,.025,.72,.055,IRON);m.box(L/2+.02,-.16,.36,.026,.32,.1,'#303c3f');
  for(const y of[-W*.52,W*.52]){m.beam([.43,y,.88],[.45,y*1.16,.88],.018,IRON);m.box(.4,y*1.16,.84,.09,.04,.11,IRON);}
  for(const x of[-L*.4,L*.35])m.box(x,W*.51,.31,.15,.025,.025,'#d1d4c7');
  if(o.kind==='ambulance'){cross(m,-.45,W/2+.02,.87);m.box(.12,-.25,1.1,.35,.18,.13,'#c84b42');}
}
register('vehicle',{tank:{kind:'tank'},car:{kind:'car'},bus:{kind:'bus'},train:{kind:'train'},deliveryTruck:{kind:'truck'},ambulance:{kind:'ambulance'},supplyWagon:{kind:'wagon'},bullockCart:{kind:'wagon',animal:true}});
function gun(m,o,col){
  for(const y of[-.45,.32])m.wheel(-.1,y,.38,.36,.15,WOOD,true);
  for(const y of[-.16,.16])m.beam([-.9,y,.12],[.35,y,.54],.055,WOOD);
  m.box(-.23,-.27,.33,.3,.54,.22,WOOD);m.tube([-.4,0,.6],[1.12,0,.95],o.heavy?.145:.105,o.heavy?.12:.085,col,14);
  m.tube([.96,0,.914],[1.14,0,.955],o.heavy?.16:.12,o.heavy?.16:.12,IRON,14);m.tube([1.145,0,.956],[1.153,0,.958],o.heavy?.1:.075,o.heavy?.1:.075,'#232b2b',12);
  m.cylinder(-.37,0,.64,.09,.09,IRON,12);for(const y of[-.2,.2])m.beam([-.8,y,.13],[-.8,y,.26],.025,IRON);
}
register('gun',{cannon:{},mughalCannon:{heavy:true},companyFieldGun:{},cannonBattery:{battery:true}});

function ship(m,o,col,t){
  const sail=o.sail,sub=o.sub,L=o.long?2.6:2.3,W=o.narrow?.55:.86;
  const outline=[[-L/2,-W*.3],[-L*.36,-W/2],[L*.35,-W/2],[L/2,0],[L*.35,W/2],[-L*.36,W/2]];
  if(sub){m.ball(0,0,.25,1.2,.28,.27,col,18,10);m.bevelBox(-.3,-.14,.38,.55,.28,.43,col,.07);m.tube([0,0,.8],[0,0,1.12],.023,.023,IRON);m.beam([0,0,1.12],[.2,0,1.12],.022,IRON);for(const x of[-.8,.65])m.face([[x,-.15,.28],[x+.14,-.48,.28],[x+.32,-.45,.28],[x+.18,0,.28]],col);m.face([[-1,0,.3],[-1.15,0,.8],[-.85,0,.3]],col);return;}
  const stations=[[-L*.5,W*.25,.27],[-L*.33,W*.49,.07],[0,W*.5,.04],[L*.32,W*.34,.14],[L*.5,.015,.4]];
  m.withMaterial(sail?'wood':'paint',()=>{
    for(let i=0;i<stations.length-1;i++)for(const sign of[-1,1]){
      const [x,w,z]=stations[i],[X,v,Z]=stations[i+1];
      m.face([[x,sign*w*.48,z],[X,sign*v*.48,Z],[X,sign*v,.3],[x,sign*w,.3]],sail?'#624c36':col,.82,false);
      m.face([[x,sign*w,.3],[X,sign*v,.3],[X,sign*v,.49],[x,sign*w,.49]],sail?WOOD:col,1,true);
      m.beam([x,sign*w,.5],[X,sign*v,.5],.018,sail?'#d5b080':IRON);
    }
    m.prism(outline,.47,.035,sail?'#b7986c':'#9caaa7');
  });
  for(const y of[-W*.46,W*.46]){
    m.beam([-L*.36,y,.62],[L*.29,y,.62],.009,sail?WOOD:WHITE);
    for(let x=-L*.34;x<L*.3;x+=.27)m.beam([x,y,.5],[x,y,.63],.007,sail?WOOD:WHITE);
    if(sail)for(let x=-L*.27;x<L*.3;x+=.29)m.box(x,y,.32,.095,.017,.09,'#292c28');
  }
  if(sail){
    m.box(-L*.43,-W*.36,.51,.38,W*.72,.3,col);
    for(let i=0;i<(o.masts||2);i++){
      const x=-.45+i*.65,z=1.9-i*.18;m.beam([x,0,.5],[x,0,z],.026,WOOD);
      m.beam([x,-.48,z-.2],[x,.48,z-.2],.022,WOOD);
      for(let row=0;row<3;row++)for(let j=0;j<5;j++){
        const point=(u,v)=>[x+Math.sin(u*Math.PI)*Math.sin(v*Math.PI)*.2+.06*v,(u-.5)*(.9-v*.1),z-.22-v*(z-1.04)];
        m.face([point(j/5,row/3),point((j+1)/5,row/3),point((j+1)/5,(row+1)/3),point(j/5,(row+1)/3)],row===2?'#d9d0b5':WHITE,1,false,'cloth');
      }
      for(const y of[-W*.44,W*.44]){m.beam([x,0,z],[-L*.32,y,.5],.0045,'#665a45');m.beam([x,0,z],[L*.3,y,.5],.0045,'#665a45');}
      for(let j=1;j<4;j++){const Y=-.45+j*.18;m.beam([x,Y,z-.23],[x+.06,Y*.9,.83],.003,'#c7ba99');}
      if(o.triangle)m.face([[x,0,z-.1],[x+.6,0,.75],[x+.05,0,.75]],WHITE);
      flag(m,x,0,z+.16,col,t);
    }
    if(o.oars)for(let i=0;i<6;i++)for(const sign of[-1,1])m.beam([-.7+i*.27,sign*.3,.38],[-.85+i*.27,sign*.9,.04],.023,WOOD);
    if(o.canopy){m.box(-.5,-.32,.51,.9,.64,.45,WOOD);m.roof(-.6,-.4,.96,1.1,.8,.25,'#c6b383');}
  }else if(o.cargo){
    for(let x=-.8;x<.6;x+=.48)for(const y of[-.33,.02]){m.box(x,y,.51,.44,.31,.26,(x<0?'#b05e42':'#6e8c77'));m.box(x,y,.77,.44,.31,.23,x<0?col:'#c3a865');}
    m.box(-1,-.3,.52,.3,.6,.6,WHITE);windows(m,-1,.305,.9,.3,.13,2);
  }else{
    m.box(-.65,-.29,.51,1.1,.58,.35,col);m.box(-.35,-.21,.86,.65,.42,.3,WHITE);windows(m,-.35,.215,.99,.65,.12,3);m.cylinder(-.65,0,.86,.12,.35,IRON);
    if(o.ferry){windows(m,-.65,.3,.65,1.1,.15,6);m.box(-.45,-.25,1.17,.9,.5,.08,col);}
    else{m.cylinder(.62,0,.51,.2,.17,IRON);m.beam([.62,0,.68],[1.12,0,.72],.035,IRON);m.beam([-.03,0,1.16],[-.03,0,1.75],.023,IRON);m.beam([-.3,0,1.51],[.3,0,1.51],.02,IRON);}
  }
  if(!sail){for(const x of[-.75,-.35,.05,.45])m.ball(x,W*.49,.35,.027,.015,.027,'#364b50',6,4);for(let i=0;i<3;i++)m.box(-.35+i*.2,-.18,1.18,.04,.34,.02,IRON);}
  m.tube([L*.37,0,.5],[L*.37,0,.76],.012,.012,IRON,6);
}
register('ship',{caravel:{sail:true,triangle:true,masts:2},galleon:{sail:true,masts:3,long:true},galley:{sail:true,masts:1,oars:true,narrow:true,long:true},eastIndiaman:{sail:true,masts:3},bengalRiverBoat:{sail:true,masts:1,canopy:true,narrow:true},warship:{},cargoShip:{cargo:true,long:true},ferry:{ferry:true},submarine:{sub:true}});
function aircraft(m,o,col,t){
  if(o.kind==='drone'){
    m.box(-.22,-.19,.3,.44,.38,.2,col);
    for(const x of[-.7,.7])for(const y of[-.6,.6]){m.beam([0,0,.4],[x,y,.4],.035,IRON);m.cylinder(x,y,.4,.06,.08,IRON);const a=t*18;const dx=Math.cos(a)*.28,dy=Math.sin(a)*.28;m.beam([x-dx,y-dy,.49],[x+dx,y+dy,.49],.025,col);}return;
  }
  if(o.kind==='helicopter'){
    m.ball(0,0,.6,.7,.37,.36,col);m.ball(.4,.07,.72,.32,.3,.23,GLASS);m.beam([-.4,0,.6],[-1.2,0,.9],.07,col);
    for(const y of[-.35,.35]){m.beam([-.45,y,.08],[.6,y,.08],.025,IRON);m.beam([-.2,y,.08],[-.2,y,.45],.025,IRON);}
    m.beam([0,0,.8],[0,0,1.25],.035,IRON);const a=t*16;for(let i=0;i<2;i++){const angle=a+i*Math.PI/2;m.beam([-Math.cos(angle)*1.15,-Math.sin(angle)*1.15,1.25],[Math.cos(angle)*1.15,Math.sin(angle)*1.15,1.25],.03,IRON);}m.beam([-1.2,-.25,.9],[-1.2,.25,.9],.025,IRON);return;
  }
  const missile=o.kind==='missile';m.ball(0,0,.5,1.2,missile?.13:.18,missile?.13:.18,col);
  if(missile){for(let i=0;i<8;i++){const a=i*Math.PI/4,b=(i+1)*Math.PI/4;m.face([[.95,Math.cos(a)*.13,.5+Math.sin(a)*.13],[.95,Math.cos(b)*.13,.5+Math.sin(b)*.13],[1.45,0,.5]],col,.8+i*.04);}}
  else m.ball(.52,0,.64,.25,.13,.1,GLASS,14,8);
  for(const sign of[-1,1]){
    if(!missile)m.face([[-.35,0,.5],[.2,sign*1.25,.47],[-.25,sign*1.25,.47],[-.8,0,.5]],col,sign>0?.9:1.2);
    m.face([[-1,0,.55],[-.75,sign*.45,.55],[-1.1,sign*.45,.55]],col);
  }m.face([[-.9,0,.55],[-1.1,0,1.04],[-.5,0,.55]],col,.75);
  if(o.kind==='airliner')for(const y of[-.38,.38])m.ball(-.05,y,.3,.25,.12,.12,IRON);
  if(!missile){
    for(const sign of[-1,1]){
      m.face([[-.24,sign*.25,.512],[.13,sign*1.1,.482],[.02,sign*1.1,.482],[-.42,sign*.25,.512]],'#7d8b8d',1,false);
      m.tube([-1.11,sign*.1,.5],[-.93,sign*.1,.5],.065,.09,IRON,12);
      if(o.kind==='airliner')for(let i=0;i<8;i++)m.ball(-.6+i*.15,sign*.175,.55,.022,.011,.026,'#45616d',6,4);
    }
  }
}
register('aircraft',{jet:{kind:'jet'},airliner:{kind:'airliner'},helicopter:{kind:'helicopter'},drone:{kind:'drone'},missile:{kind:'missile'}});

function fort(m,o,col,t){
  slab(m,o.hill?'#7f8a60':'#a0a07e');if(o.hill)m.cone(0,0,-.08,1.15,.45,'#7f8a60',6);
  if(o.kind==='palisade'){for(let i=0;i<9;i++){const x=-1+i*.24;m.cylinder(x,0,0,.11,1,WOOD,5);m.cone(x,0,1,.11,.2,WOOD,5);}return;}
  if(o.kind==='wall'||o.kind==='earthwork'){m.box(-1,-.18,0,2,.36,o.kind==='earthwork'?.45:.85,o.kind==='earthwork'?'#857351':col);if(o.kind==='wall')for(let x=-1;x<1;x+=.28)m.box(x,-.18,.85,.15,.36,.2,col);else for(let x=-.8;x<1;x+=.35)m.beam([x,-.4,.06],[x,.3,.7],.055,WOOD);return;}
  if(o.kind==='watchtower'){for(const x of[-.3,.3])for(const y of[-.3,.3])m.beam([x,y,0],[x,y,1.5],.05,WOOD);m.box(-.43,-.43,1.08,.86,.86,.35,WOOD);m.roof(-.5,-.5,1.43,1,1,.45,col);m.beam([-.3,.33,0],[.3,.33,1.08],.03,WOOD);return;}
  const ruin=o.kind==='ruins',gate=o.kind==='gatehouse',keep=o.kind==='keep';
  if(keep){tower(m,0,0,1.7,false,col,.55);flag(m,0,0,2.35,'#ae5141',t);return;}
  m.box(-.9,-.6,0,1.8,.2,ruin?.42:.7,col);m.box(-.9,-.4,0,.2,1,.7,col);m.box(.7,-.4,0,.2,1,.7,col);
  for(const x of[-.9,.4])m.box(x,.42,0,.5,.2,ruin?.3:.9,col);
  if(!ruin)m.box(-.4,.42,.62,.8,.2,.28,col);
  for(const x of[-.8,.8])for(const y of[-.5,.5])tower(m,x,y,ruin?(x<0?.65:1.04):gate?1.28:1.4,!!o.roofs,col,.22);
  if(!gate&&!ruin)house(m,{x:-.4,y:-.3,w:.8,d:.6,h:1.15,wall:col,roof:'#875440'});
  if(!ruin){archOpening(m,-.25,.645,0,.5,.62,col);for(let x=-.2;x<.25;x+=.075)m.beam([x,.65,.02],[x,.65,.53],.009,'#49483b');m.beam([-.2,.65,.29],[.2,.65,.29],.012,WOOD);}
  if(o.kind==='bastion')for(const x of[-1,1])m.prism([[x-.2,-.15],[x,-.5],[x+.2,-.15],[x,.2]],0,.65,col);
  if(ruin)for(let i=0;i<5;i++)m.box(-.6+i*.28,.65,0,.18,.17,.12,STONE);else flag(m,.8,.5,1.95,'#ae5141',t);
}
register('fort',{
  stoneWall:{kind:'wall'},palisade:{kind:'palisade'},watchtower:{kind:'watchtower'},gatehouse:{kind:'gatehouse'},bastion:{kind:'bastion'},earthwork:{kind:'earthwork'},stoneFort:{},mughalFort:{},medievalCastle:{roofs:true},castleKeep:{kind:'keep'},citadel:{hill:true},castleRuins:{kind:'ruins'},kingdomCastle:{},
});
function building(m,o,col,t){
  slab(m);const k=o.kind;
  if(k==='city'){for(const [x,y,h]of[[-.8,-.5,1.1],[0,-.5,1.9],[.55,-.2,1.4],[-.5,.25,.75]]){m.box(x,y,0,.45,.45,h,col);for(let z=.25;z<h;z+=.3)windows(m,x,y+.455,z,.45,.12,2);}return;}
  if(k==='factory'){house(m,{h:.65,roof:IRON,wall:col});m.cylinder(-.65,-.4,0,.13,1.65,'#8f7461');for(let i=0;i<3;i++){const p=o.animation==='operate'?(t*.35+i/3)%1:0;m.ball(-.65+i*.14+p*.2,-.4,1.8+i*.17+p*.4,.17+i*.03+p*.05,.14,.14,'#b2b3a7');}return;}
  if(k==='airport'){m.box(-1,-.65,.01,2, .45,.04,IRON);for(let x=-.9;x<1;x+=.3)m.box(x,-.44,.06,.14,.025,.005,WHITE);house(m,{x:-.7,y:.05,w:1.15,d:.55,h:.5,roof:IRON,wall:col});tower(m,.8,.4,1.35,false,col,.13);m.box(.56,.16,1.2,.48,.48,.3,GLASS);return;}
  if(k==='solar'){for(const x of[-.75,.2])for(const y of[-.5,.25]){m.beam([x+.25,y+.2,0],[x+.25,y+.2,.38],.035,IRON);m.face([[x,y,.5],[x+.7,y,.5],[x+.7,y+.5,.25],[x,y+.5,.25]],'#365a76');for(let i=1;i<4;i++)m.beam([x+i*.175,y,.502],[x+i*.175,y+.5,.252],.008,'#91b0bb');}return;}
  if(k==='windTurbine'||k==='windmill'){
    if(k==='windmill'){m.cylinder(0,0,0,.38,1.25,col,8);m.cone(0,0,1.25,.49,.45,'#81553c',8);}else m.cylinder(0,0,0,.065,1.9,WHITE,8);
    const z=k==='windmill'?1.1:1.85,y=.42,n=k==='windmill'?4:3;
    for(let i=0;i<n;i++){
      const a=t*1.7+i*Math.PI*2/n,r=k==='windmill'?.85:1;m.beam([0,y,z],[Math.cos(a)*r,y,z+Math.sin(a)*r],k==='windmill'?.023:.025,k==='windmill'?WOOD:WHITE);
      if(k==='windmill'){
        const p=(u,v)=>[Math.cos(a)*u-Math.sin(a)*v,y,z+Math.sin(a)*u+Math.cos(a)*v];
        m.beam(p(.25,.14),p(r,.14),.012,WOOD);for(let u=.25;u<r;u+=.11)m.beam(p(u,0),p(u,.14),.012,'#baaa82');
      }
    }return;
  }
  if(k==='farm'){for(let y=-.6;y<.7;y+=.23){m.box(-1,y,0,2,.14,.06,'#866341');for(let x=-.9;x<1;x+=.19)m.cone(x,y+.07,.07,.055,.22,'#c6ae57',4);}m.box(.6,-.6,0,.22,.22,.42,WOOD);return;}
  if(k==='dock'){m.box(-1,-.65,-.07,2,1.3,.07,'#699da2');for(let i=0;i<8;i++)m.box(-.8+i*.2,-.15,.17,.18,.65,.07,WOOD);for(const x of[-.8,.6])for(const y of[-.15,.4])m.cylinder(x,y,-.04,.055,.5,WOOD,6);house(m,{x:-.8,y:-.6,w:.8,d:.45,h:.48});return;}
  if(k==='lumber'){tree(m,-.65,-.25,'pine',.8);for(let i=0;i<3;i++)m.beam([-.3,i*.18, .12],[.8,i*.18,.12],.09,WOOD);house(m,{x:.25,y:-.65,w:.7,d:.55,h:.4});return;}
  if(k==='mine'){m.cone(-.5,-.15,0,.65,.8,'#8c8b7d',5);m.box(-.74,.23,0,.5,.08,.45,WOOD);m.box(-.63,.32,0,.28,.02,.35,'#303a35');crates(m,.2,-.2);return;}
  if(k==='market'){for(const x of[-.75,.35]){for(const X of[x,x+.6])for(const y of[-.4,.35])m.beam([X,y,0],[X,y,.85],.025,WOOD);m.roof(x-.08,-.48,.85,.76,.9,.18,col);m.box(x,-.3,.3,.6,.55,.12,WOOD);for(let i=0;i<3;i++)m.ball(x+.12+i*.18,.13,.48,.08,.08,.08,i%2?'#b8a457':'#b85a3c');}return;}
  if(k==='base'){house(m,{x:-.8,y:-.55,w:1,d:.7,h:.6,wall:col,roof:col});tower(m,.75,-.3,1.25,false,IRON,.12);flag(m,.65,.4,1.3,col,t);return;}
  if(k==='camp'){for(const x of[-.6,.4]){m.roof(x-.35,-.3,0,.7,.85,.7,col);m.face([[x+.35,-.3,0],[x+.35,.55,0],[x+.35,.125,.7]],'#4f5140');}return;}
  if(k==='lighthouse'){for(let i=0;i<5;i++)m.cylinder(0,0,i*.29,.24-i*.012,.29,i%2?'#ba5e48':WHITE,10);m.cylinder(0,0,1.45,.29,.25,GLASS,8);m.cone(0,0,1.7,.37,.25,col,8);return;}
  if(k==='tomb'){m.box(-.65,-.5,0,1.3,1,.75,col);m.ball(0,0,1.02,.48,.44,.42,WHITE);m.cone(0,0,1.41,.055,.2,GOLD,6);for(const x of[-.85,.85])tower(m,x,-.4,1.18,false,col,.1);return;}
  house(m,{wall:o.rustic?'#c6b797':col,roof:o.thatch?'#b79859':o.roof||'#985d43',h:o.tall?1.12:.78});
  if(k==='town'){tower(m,0,-.3,1.6,true,col,.24);flag(m,0,-.3,2.3,'#a64f3b',t);}
  if(k==='barracks')for(const x of[-.85,.85]){m.beam([x,.45,0],[x,.45,1.4],.025,IRON);m.cone(x,.45,1.4,.06,.22,IRON,4);}
  if(k==='archery'){m.cylinder(.85,.5,0,.04,.7,WOOD);m.wheel(.85,.48,.82,.27,.05,WHITE);m.wheel(.85,.54,.82,.16,.02,'#b35943');m.wheel(.85,.57,.82,.06,.02,GOLD);}
  if(k==='stable')animal(m,'horse','#926342',.65,.4);
  if(k==='hospital')cross(m,0,.525,.65);
  if(k==='school')flag(m,.65,-.35,1.8,col,t);
  if(k==='forge'){m.cylinder(.55,-.25,.6,.14,1.05,STONE,6);m.box(.65,.3,0,.3,.25,.3,IRON);}
  if(k==='granary'){m.cylinder(.75,.1,0,.25,.75,'#ae9270',10);m.cone(.75,.1,.75,.3,.3,'#aa7750');}
  if(k==='monastery'){tower(m,-.4,-.2,1.6,true,STONE,.2);cross(m,-.4,.02,2.25,GOLD);}
  if(k==='workshop'){m.wheel(.65,.5,.35,.32,.1,WOOD);m.beam([.4,.5,.3],[.95,.5,1.1],.04,WOOD);}
  if(k==='warehouse')crates(m,.3,.65);
  if(k==='tradingPost'){for(const x of[-.6,.6])m.cylinder(x,.65,0,.055,.85,WHITE,8);flag(m,.7,-.4,1.8,'#a85b46',t);}
}
register('building',{
  base:{kind:'base'},city:{kind:'city'},camp:{kind:'camp'},factory:{kind:'factory'},airport:{kind:'airport'},house:{kind:'house'},hospital:{kind:'hospital',roof:'#7e8e83'},school:{kind:'school'},lighthouse:{kind:'lighthouse'},windTurbine:{kind:'windTurbine'},solarFarm:{kind:'solar'},mughalTomb:{kind:'tomb'},companyTradingPost:{kind:'tradingPost'},tradeWarehouse:{kind:'warehouse'},
  kingdomTownCenter:{kind:'town'},kingdomHouse:{thatch:true},kingdomBarracks:{kind:'barracks'},kingdomArchery:{kind:'archery'},kingdomStable:{kind:'stable'},kingdomMarket:{kind:'market'},kingdomForge:{kind:'forge'},kingdomWindmill:{kind:'windmill'},kingdomFarm:{kind:'farm'},kingdomGranary:{kind:'granary',thatch:true},kingdomLumber:{kind:'lumber'},kingdomMine:{kind:'mine'},kingdomMonastery:{kind:'monastery',tall:true},kingdomWorkshop:{kind:'workshop'},kingdomDock:{kind:'dock'},
});

function bridge(m,o,col){
  m.box(-1.4,-.4,.38,2.8,.8,.1,'#8b8e87');
  for(let x=-1.3;x<1.4;x+=.32)m.box(x,-.015,.483,.13,.03,.004,WHITE);
  for(const x of[-.8,.8]){
    for(const y of[-.38,.38]){
      m.box(x-.055,y-.055,-.05,.11,.11,o.beam?.44:1.55,col);
      if(o.towers){tower(m,x,y,1.45,true,STONE,.12);m.box(x-.17,y-.17,1.22,.34,.34,.04,STONE);}
    }
    if(!o.beam)for(const z of[1.02,1.4])m.beam([x,-.4,z],[x,.4,z],.03,col);
  }
  for(const y of[-.41,.41]){
    m.beam([-1.4,y,.61],[1.4,y,.61],.012,col);
    for(let i=0;i<12;i++)m.beam([-1.35+i*.24,y,.48],[-1.35+i*.24,y,.61],.008,col);
    if(!o.beam){
      const Z=x=>Math.abs(x)<=.8?.72+.78*(x/.8)**2:1.5-(Math.abs(x)-.8)*1.25;
      for(let i=0;i<24;i++){const x=-1.35+i*2.7/24,X=x+2.7/24;m.tube([x,y,Z(x)],[X,y,Z(X)],.009,.009,col,6);if(i%2===0)m.tube([x,y,.49],[x,y,Z(x)],.005,.005,IRON,5);}
    }
  }
  if(o.truss)for(const y of[-.4,.4])for(let i=0;i<6;i++){const x=-1.35+i*.45;m.beam([x,y,.55],[x+.225,y,.9],.025,IRON);m.beam([x+.225,y,.9],[x+.45,y,.55],.025,IRON);}
}
register('bridge',{bridge:{},goldenGateBridge:{},towerBridge:{towers:true},padmaBridge:{beam:true,truss:true}});
function landmark(m,o,col,t){
  slab(m,'#aaa78b');const k=o.kind;
  if(k==='eiffel'){
    m.material='metal';
    for(const x of[-.65,.65])for(const y of[-.5,.5]){
      for(const dx of[-1,1])for(const dy of[-1,1])m.tube([x+dx*.065,y+dy*.05,0],[x*.35+dx*.025,y*.35+dy*.025,1.15],.012,.009,col,6);
      m.beam([x*.35,y*.35,1.15],[0,0,2.5],.011,col);
      for(let i=0;i<5;i++){
        const u=i/5,v=(i+1)/5,X=x*(1-.65*u),Y=y*(1-.65*u),A=x*(1-.65*v),B=y*(1-.65*v),r=.065-u*.04,R=.065-v*.04;
        m.beam([X-r,Y+.05,1.15*u],[A+R,B+.05,1.15*v],.006,col);m.beam([X+r,Y+.05,1.15*u],[A-R,B+.05,1.15*v],.006,col);
        m.beam([X+.065,Y-r,1.15*u],[A+.065,B+R,1.15*v],.006,col);m.beam([X+.065,Y+r,1.15*u],[A+.065,B-R,1.15*v],.006,col);
      }
      m.box(x-.1,y-.1,0,.2,.2,.05,STONE);
    }
    for(let i=0;i<8;i++){
      const z=1.15+i*.16,w=.23*(1-i/8),next=.23*(1-(i+1)/8);
      m.beam([-w,w*.75,z],[w,w*.75,z],.008,col);m.beam([w,-w*.75,z],[w,w*.75,z],.008,col);
      m.beam([-w,w*.75,z],[next,next*.75,z+.16],.005,col);m.beam([w,w*.75,z],[-next,next*.75,z+.16],.005,col);
    }
    m.box(-.42,-.32,.85,.84,.64,.055,col);m.box(-.23,-.18,1.45,.46,.36,.045,col);m.beam([0,0,2.5],[0,0,2.85],.009,col);return;
  }
  if(k==='liberty'){
    m.box(-.4,-.35,0,.8,.7,.4,STONE);m.cone(0,0,.4,.29,1.15,col,7);m.ball(0,0,1.7,.15,.14,.18,col);m.beam([-.15,0,1.43],[-.48,0,2.05],.055,col);m.cone(-.48,0,2.05,.11,.23,GOLD,6);m.box(.12,.08,1.03,.22,.09,.35,col);for(let i=0;i<5;i++)m.beam([0,0,1.8],[Math.cos(i*1.25)*.27,Math.sin(i*1.25)*.23,1.97],.018,col);return;
  }
  if(k==='taj'){
    m.material='marble';m.box(-1.1,-.85,0,2.2,1.7,.09,WHITE);m.box(-.7,-.5,.09,1.4,1,.72,WHITE);m.cylinder(0,0,.8,.32,.17,WHITE,20);m.ball(0,0,1.07,.4,.36,.34,WHITE,20,12);m.cone(0,0,1.38,.12,.22,WHITE,12);m.cone(0,0,1.6,.025,.14,GOLD,8);
    archOpening(m,-.18,.513,.14,.36,.51,'#d2d0bb');for(const x of[-.57,.38])archOpening(m,x,.513,.2,.2,.29,'#d2d0bb');
    for(const x of[-.95,.95])for(const y of[-.7,.7]){
      m.cylinder(x,y,.09,.075,1.15,WHITE,14);for(const z of[.45,.85,1.24])m.cylinder(x,y,z,.105,.04,WHITE,14);m.ball(x,y,1.36,.1,.1,.13,WHITE,12,8);m.cone(x,y,1.48,.022,.1,GOLD,6);
    }
    for(const x of[-.53,.53])for(const y of[-.35,.35]){m.cylinder(x,y,.81,.1,.12,WHITE,10);m.ball(x,y,1,.14,.14,.14,WHITE,12,8);}
    return;
  }
  if(k==='bigBen'){
    tower(m,0,0,1.85,true,col,.28);m.box(-.34,-.34,1.2,.68,.68,.48,col);m.wheel(0,.35,1.46,.18,.025,WHITE);
    for(let i=0;i<12;i++){const a=i*Math.PI/6;m.beam([Math.cos(a)*.135,.385,1.46+Math.sin(a)*.135],[Math.cos(a)*.16,.385,1.46+Math.sin(a)*.16],.004,IRON);}
    m.beam([0,.39,1.46],[0,.39,1.59],.009,IRON);m.beam([0,.39,1.46],[.1,.39,1.42],.009,IRON);
    for(const x of[-.28,.28])for(const y of[-.28,.28])m.cone(x,y,1.77,.05,.28,col,6);m.beam([0,0,2.25],[0,0,2.42],.01,GOLD);return;
  }
  if(k==='colosseum'||k==='pisa'){
    const n=16,floors=k==='pisa'?6:3,rx=k==='pisa'?.36:1.05,ry=k==='pisa'?.36:.7;
    for(let j=0;j<floors;j++){
      const shift=k==='pisa'?j*.035:0;
      for(let i=0;i<n;i++){const a=i*Math.PI*2/n,b=(i+1)*Math.PI*2/n,x=shift+Math.cos(a)*rx,y=Math.sin(a)*ry,X=shift+Math.cos(b)*rx,Y=Math.sin(b)*ry,z=j*.27;
        m.face([[x,y,z+.22],[X,Y,z+.22],[X,Y,z+.28],[x,y,z+.28]],col,1.1);m.beam([x,y,z],[x,y,z+.24],.035,col);
        const local=(u,Z)=>[x+(X-x)*u,y+(Y-y)*u,Z],opening=[[.15,z],[.85,z],...Array.from({length:7},(_,q)=>[.5+Math.cos(q*Math.PI/6)*.35,z+.11+Math.sin(q*Math.PI/6)*.1])];
        m.face(opening.map(([u,Z])=>local(u,Z)),'#5a594e',1,false);
        for(let q=0;q<6;q++){
          const a=q*Math.PI/6,b=(q+1)*Math.PI/6;
          m.face([local(.5+Math.cos(a)*.35,z+.11+Math.sin(a)*.1),local(.5+Math.cos(b)*.35,z+.11+Math.sin(b)*.1),local(.5+Math.cos(b)*.45,z+.11+Math.sin(b)*.15),local(.5+Math.cos(a)*.45,z+.11+Math.sin(a)*.15)],col,q%2?1:.94);
        }
        if(j===0)m.face([[x*.86,y*.86,0],[X*.86,Y*.86,0],[X*.86,Y*.86,.08],[x*.86,y*.86,.08]],'#786d55');
      }
    }return;
  }
  if(k==='pyramids'){for(const [x,y,r,h]of[[-.45,-.2,.65,1.2],[.55,.05,.5,.9],[-.6,.65,.28,.5]])m.cone(x,y,0,r,h,col,4);return;}
  if(k==='wall'){for(const [x,y,h]of[[-.85,-.35,.65],[0,0,1],[.8,.3,.8]]){tower(m,x,y,h,false,col,.2);m.box(x-.5,y-.12,0,.6,.24,h*.6,col);for(let i=0;i<3;i++)m.box(x-.5+i*.2,y-.12,h*.6,.1,.24,.12,col);}return;}
  if(k==='burj'){for(let i=0;i<7;i++){const w=.75-i*.085;m.box(-w/2,-w/2,i*.3,w,w,.35,col);for(let z=i*.3;z<(i+1)*.3;z+=.1)m.box(-w/2,w/2+.002,z,w,.008,.015,GLASS);}m.beam([0,0,2.1],[0,0,2.7],.015,IRON);return;}
  if(k==='petronas'){for(const x of[-.5,.5]){for(let i=0;i<7;i++)m.cylinder(x,0,i*.24,.24-i*.018,.24,col,8);m.cone(x,0,1.68,.14,.42,col,8);}m.box(-.5,-.08,.85,1,.16,.12,IRON);return;}
  if(k==='opera'){
    m.box(-1,-.6,0,2,1.2,.15,'#c5b79a');
    for(const [x,y,h]of[[-.65,-.2,.9],[-.05,-.2,1.2],[.55,-.1,.85],[-.35,.35,.7]]){
      const point=(u,v,sign)=>[x-.35+u*.7,y+sign*Math.sin(u*Math.PI)*.32*v,.15+(h-.15)*Math.sin(u*Math.PI/2)*(1-v)];
      for(const sign of[-1,1])for(let i=0;i<8;i++)for(let j=0;j<3;j++)m.face([point(i/8,j/3,sign),point((i+1)/8,j/3,sign),point((i+1)/8,(j+1)/3,sign),point(i/8,(j+1)/3,sign)],WHITE,1,false,'tile');
    }return;
  }
  if(k==='parliament'){m.box(-.5,-.45,0,1,.9,1,col);for(const x of[-.75,.55])m.box(x,-.55,0,.25,1.1,.75,col);m.cylinder(0,0,1,.4,.17,col,8);m.wheel(0,.46,.53,.25,.015,'#514f48');m.face([[.51,-.25,.2],[.51,.25,.2],[.51,0,.75]],'#514f48');return;}
  if(k==='gate'){for(let i=0;i<6;i++)m.cylinder(-.9+i*.36,0,0,.065,.85,col,8);m.box(-1,-.25,.85,2,.5,.22,col);for(const x of[-.25,.25])animal(m,'horse','#667a65',x,0);m.box(-.32,-.22,1.07,.64,.44,.16,IRON);return;}
}
register('landmark',{eiffelTower:{kind:'eiffel'},statueOfLiberty:{kind:'liberty'},tajMahal:{kind:'taj'},bigBen:{kind:'bigBen'},colosseum:{kind:'colosseum'},gizaPyramids:{kind:'pyramids'},greatWall:{kind:'wall'},burjKhalifa:{kind:'burj'},petronasTowers:{kind:'petronas'},sydneyOperaHouse:{kind:'opera'},leaningTowerPisa:{kind:'pisa'},nationalParliament:{kind:'parliament'},brandenburgGate:{kind:'gate'}});

function goods(m,o,col){
  slab(m,'#a7a084',2,1.5);
  if(o.kind==='containers'){for(const [x,y,z,c]of[[-.9,-.5,0,col],[-.9,.1,0,'#b46f48'],[-.9,-.5,.45,'#728d88']]){m.box(x,y,z,1.8,.5,.43,c);for(let i=0;i<9;i++)m.box(x+i*.2,y+.505,z+.03,.015,.01,.37,IRON);}return;}
  if(o.kind==='port'){m.box(-1,-.6,0,2,1.2,.13,STONE);m.box(-.7,-.4,.13,.3,.3,.3,IRON);m.beam([-.55,-.25,.4],[-.55,-.25,1.8],.055,col);m.beam([-.8,-.25,1.8],[1,-.25,1.8],.045,col);m.beam([.8,-.25,1.8],[.8,-.25,.75],.015,IRON);crates(m,.3,0);return;}
  crates(m,-.65,-.4,o.kind);
  if(o.arrow){const sign=o.arrow==='in'?-1:1,x=.1,y=.8,z=.5;m.beam([x-sign*.65,y,z],[x+sign*.65,y,z],.055,col);m.face([[x+sign*.8,y,z],[x+sign*.4,y-.2,z],[x+sign*.4,y+.2,z]],col);}
}
register('goods',{cargoCrates:{kind:'crates'},companyCargo:{kind:'crates'},cargoContainers:{kind:'containers'},grainSacks:{kind:'sacks'},tradeBarrels:{kind:'barrels'},tradeCoins:{kind:'coins'},importGoods:{kind:'crates',arrow:'in'},exportGoods:{kind:'crates',arrow:'out'},tradePort:{kind:'port'}});
function nature(m,o,col,t){
  slab(m,'#8f996b',1.8,1.5);
  if(o.kind==='tree'){tree(m,0,0,'leaf');return;}if(o.kind==='palm'||o.kind==='pine'){tree(m,0,0,o.kind);return;}
  if(o.kind==='gold'){for(const [x,y,r,h]of[[-.4,-.2,.4,.45],[.3,.1,.4,.65],[-.3,.35,.3,.35]])m.cone(x,y,0,r,h,col,5);return;}
  if(o.kind==='mountain'||o.kind==='volcano'){
    const volcano=o.kind==='volcano',n=13,ring=(r,z,phase)=>Array.from({length:n},(_,i)=>{const a=i*Math.PI*2/n,rough=.85+.15*Math.sin(i*2.78+phase);return[Math.cos(a)*r*rough+.13*z,Math.sin(a)*r*rough-.08*z,z+Math.sin(i*3.1+phase)*r*.13];});
    const rings=[ring(1.05,.015,0),ring(.69,.45,.9),ring(.33,1.05,.4),ring(volcano?.19:.035,volcano?1.35:1.65,1.2)];
    for(let j=0;j<rings.length-1;j++)for(let i=0;i<n;i++){
      const k=(i+1)%n,a=rings[j][i],b=rings[j][k],c=rings[j+1][k],d=rings[j+1][i],color=!volcano&&j===2?(i%3?'#deded0':'#b9bdaf'):['#88877a','#737b71','#95958a','#6e746d'][i%4];
      m.face([a,b,d],volcano?col:color,1,false,'earth');m.face([b,c,d],volcano?col:color,1,false,'earth');
      if(j<2&&i%3===0)m.beam(a,d,.005,'#565e57');
    }
    for(let i=0;i<7;i++){const a=i*2.399,r=.72+i%2*.2;m.ball(Math.cos(a)*r,Math.sin(a)*r,.045,.09,.065,.065,'#868a7c',7,4);}
    if(volcano){m.face(rings.at(-1),'#372d28',1,false);m.cylinder(.18,-.1,1.3,.12,.025,'#d76a27',10);for(let i=0;i<3;i++){const p=(t*.35+i/3)%1;m.ball(.18+p*.3,-.1,1.6+p*.7,.15+p*.12,.14+p*.1,.18,'#8c8c83');}}
    return;
  }
}
register('nature',{tree:{kind:'tree'},kingdomWoodland:{kind:'tree'},kingdomJungle:{kind:'palm'},kingdomPine:{kind:'pine'},kingdomMountain:{kind:'mountain'},kingdomGold:{kind:'gold'},volcano:{kind:'volcano'}});
function imageModel(m,o,col,t,a,image){
  const k=o.kind;
  if(k==='flag'||k==='banner'){
    m.box(-.7,-.3,0,.45,.45,.12,STONE);
    if(k==='flag')flag(m,-.48,0,2.25,col,t);
    else if(a.bannerPole!==false)m.beam([-.48,0,0],[-.48,0,2.65],.025,a.bannerPoleColor||WOOD);
    if(k==='banner'){
      const width=1.44*(a.bannerAspect??.75),left=.15-width/2,right=left+width;
      m.beam([left-.12,0,2.2],[right+.12,0,2.2],.035,a.bannerPoleColor||WOOD);
      const wind=a.bannerWind===false?0:(a.bannerWindStrength??.45),speed=a.bannerWindSpeed??1;
      // A hanging cloth mesh bends in world space while its crossbar stays rigid.
      for(let i=0;i<8;i++){
        const z0=.68+i*.18,z1=z0+.18,y0=wind?Math.sin(t*speed*3.2-i*.5)*wind*.13*(8-i)/8:0,y1=wind?Math.sin(t*speed*3.2-(i+1)*.5)*wind*.13*(7-i)/8:0;
        const points=[[left,y1,z1],[right,y1,z1],[right,y0,z0],[left,y0,z0]];
        m.face(points,col,1,false,'cloth');
        if(image){
          // Each strip samples the matching part of the image (no icon rasterization).
          m.texture(points,image,col,{slice:[0,(7-i)/8,1,1/8]});
        }
      }
      if(a.bannerPlaque!==false){m.box(left-.07,-.06,2.3,width+.14,.12,.28,WHITE);m.text([[left-.02,.067,2.55],[right+.02,.067,2.55],[right+.02,.067,2.33],[left-.02,.067,2.33]],a.bannerTitle,{...a,glyph:'banner'});}
    }return;
  }
  // Uploaded pixels are a texture on a modeled frame, rather than a shaded
  // extrusion of their silhouette. The picture itself remains user-supplied.
  if(k==='artwork'&&image){
    const factor=3.5/Math.max(image.naturalWidth||image.width,image.naturalHeight||image.height),w=(image.naturalWidth||image.width)*factor,h=(image.naturalHeight||image.height)*factor;
    // A free uploaded image has no frame or opaque backing in either view.
    m.texture([[-w/2,0,h],[w/2,0,h],[w/2,0,0],[-w/2,0,0]],image,col,{fit:'contain'});m.faces.shift();return;
  }
  const portrait=k==='portrait',w=portrait?1.25:1.8,h=portrait?1.6:1.2;
  const trim=a.badgeBorder||GOLD;
  m.box(-w/2,-.1,.25,w,.2,h,col);m.texture([[-w/2+.08,.108,.25+h-.08],[w/2-.08,.108,.25+h-.08],[w/2-.08,.108,.33],[-w/2+.08,.108,.33]],image,WHITE,{zoom:a.badgeZoom,x:a.badgeX,y:a.badgeY,fit:k==='artwork'?'contain':'cover'});
  for(const x of[-w/2,w/2-.06])m.box(x,.11,.25,.06,.04,h,trim);for(const z of[.25,.25+h-.06])m.box(-w/2,.11,z,w,.04,.06,trim);
  m.box(-.55,-.3,0,1.1,.6,.12,STONE);m.beam([0,0,.1],[0,0,.6],.06,WOOD);
  if(!image){m.cone(0,.13,.5,.22,.5,'#8ba27c',4);m.ball(.32,.15,1.08,.09,.02,.09,GOLD);}
  if(portrait){m.box(-.6,.12,.13,1.2,.07,.22,col);if(a.showLabel!==false)m.text([[-.56,.197,.33],[.56,.197,.33],[.56,.197,.15],[-.56,.197,.15]],a.label||'Commander',{...a,glyph:'portrait'});}
}
register('image',{image:{kind:'image'},artwork:{kind:'artwork'},portrait:{kind:'portrait'},banner:{kind:'banner'},flag:{kind:'flag'}});
function timepiece(m,o,col,t){
  if(o.kind==='hourglass'){
    for(const z of[0,1.55])m.box(-.4,-.3,z,.8,.6,.12,WOOD);
    for(const x of[-.32,.32])for(const y of[-.22,.22])m.beam([x,y,.1],[x,y,1.55],.035,GOLD);
    m.frustum(0,0,.8,.025,.29,.65,'#a9c9c7',10);m.cone(0,0,.15,.29,.65,'#d7b775',10);m.cylinder(0,0,.67,.025,.3,GOLD,8);return;
  }
  if(o.kind==='calendar'){
    m.box(-.65,-.12,0,1.3,.24,1.3,WHITE);m.box(-.65,.13,1.05,1.3,.025,.25,col);for(let j=0;j<3;j++)for(let i=0;i<4;i++)m.box(-.48+i*.27,.136,.18+j*.25,.14,.015,.12,j===1&&i===2?col:IRON);for(const x of[-.4,.4])m.beam([x,-.08,1.35],[x,.22,1.35],.04,IRON);return;
  }
  m.wheel(0,-.15,.8,.7,.22,col);m.wheel(0,.08,.8,.6,.025,WHITE);
  for(let i=0;i<12;i++){const a=i*Math.PI/6;m.beam([Math.sin(a)*.49,.115,.8+Math.cos(a)*.49],[Math.sin(a)*.55,.115,.8+Math.cos(a)*.55],.012,IRON);}
  for(const [r,a]of[[.32,t/60],[.47,t]])m.beam([0,.12,.8],[Math.sin(a)*r,.12,.8+Math.cos(a)*r],.018,IRON);
  if(o.kind==='stopwatch'){m.box(-.14,-.07,1.5,.28,.18,.16,IRON);m.beam([-.1,-.04,1.64],[.1,-.04,1.64],.055,col);}else m.box(-.45,-.25,0,.9,.5,.1,WOOD);
}
register('time',{clock:{kind:'clock'},stopwatch:{kind:'stopwatch'},hourglass:{kind:'hourglass'},calendar:{kind:'calendar'}});
function accessory(m,o,col,t){
  const k=o.kind;
  if(k==='compass'){m.cylinder(0,0,0,.72,.18,GOLD,16);m.cylinder(0,0,.18,.62,.025,WHITE,16);m.face([[-.1,0,.21],[0,-.53,.21],[.1,0,.21],[0,.53,.21]],'#ad5144');m.cylinder(0,0,.215,.055,.03,IRON,8);return;}
  if(k==='chart'){m.box(-.9,-.6,0,1.8,1.2,.04,'#d6bd89');m.face([[-.5,-.3,.045],[-.1,-.4,.045],[.25,0,.045],[-.2,.35,.045]],'#7d946c');m.beam([-.7,.4,.05],[.6,-.35,.05],.012,'#b3784b');return;}
  if(k==='chest'){m.box(-.7,-.45,0,1.4,.9,.65,WOOD);m.roof(-.7,-.45,.65,1.4,.9,.26,WOOD);for(const x of[-.5,.4])m.box(x,-.46,0,.1,.93,.7,GOLD);m.box(-.09,.47,.45,.18,.025,.22,GOLD);return;}
  if(k==='stepwell'){for(let i=0;i<5;i++){const w=1.9-i*.27,z=.5-i*.1;m.box(-w/2,-w/2,0,w,.14,z,STONE);m.box(-w/2,w/2-.14,0,w,.14,z,STONE);m.box(-w/2,-w/2,0,.14,w,z,STONE);m.box(w/2-.14,-w/2,0,.14,w,z,STONE);}m.box(-.25,-.25,.01,.5,.5,.03,'#679c9f');return;}
  if(k==='palanquin'){m.box(-.6,-.4,.45,1.2,.8,.55,col);m.roof(-.75,-.5,1,1.5,1,.35,WOOD);for(const y of[-.3,.3])m.beam([-1.2,y,.55],[1.2,y,.55],.045,WOOD);m.box(-.2,.41,.45,.4,.025,.5,WHITE);return;}
  if(k==='bicycle'){
    for(const x of[-.7,.7]){m.wheel(x,0,.38,.37,.05,IRON,true);for(let i=0;i<6;i++){const a=i*Math.PI/3;m.beam([x,.06,.38],[x+Math.cos(a)*.34,.06,.38+Math.sin(a)*.34],.008,WHITE);}}
    for(const [a,b]of[[[-.7,0,.38],[-.2,0,.95]],[[-.2,0,.95],[.12,0,.38]],[[.12,0,.38],[-.7,0,.38]],[[.12,0,.38],[.55,0,.95]],[[.55,0,.95],[-.2,0,.95]],[[.55,0,.95],[.7,0,.38]]])m.beam(a,b,.025,col);m.box(-.37,-.14,.98,.32,.28,.05,WOOD);m.beam([.55,0,.95],[.55,0,1.2],.025,IRON);m.beam([.55,-.2,1.2],[.55,.2,1.2],.025,IRON);return;
  }
  if(k==='checkpoint'){m.box(-.9,-.22,0,.4,.44,.65,IRON);m.box(-.65,-.05,.58,1.65,.1,.12,col);for(let i=0;i<4;i++)m.box(-.5+i*.4,.055,.58,.17,.012,.12,WHITE);m.box(.8,-.15,0,.12,.3,.6,IRON);return;}
  if(k==='storm'){
    for(const [x,y,z,r]of[[-.5,0,1.1,.4],[0,0,1.25,.5],[.5,0,1.1,.35]])m.ball(x,y,z,r,.3,r,col);
    m.face([[.05,.1,.95],[-.35,.1,.38],[-.02,.1,.43],[-.2,.1,-.1],[.4,.1,.58],[.1,.1,.54]],GOLD);return;
  }
}
register('accessory',{compass:{kind:'compass'},seaChart:{kind:'chart'},treasureChest:{kind:'chest'},stepwell:{kind:'stepwell'},palanquin:{kind:'palanquin'},bicycle:{kind:'bicycle'},checkpoint:{kind:'checkpoint'},storm:{kind:'storm'}});

const families={
  person:(m,o,c,t)=>person(m,o,c,t),ship,aircraft,fort,building,bridge,landmark,goods,nature,image:imageModel,time:timepiece,accessory,
  mounted:(m,o,c,t)=>{animal(m,o.animal||'horse',o.animal?'#8b8d82':'#8c6244');person(m,{...o,seated:true},c,t,-.2,0,o.animal?1.72:1.04,.8);},
  animal:(m,o)=>{animal(m,o.animal,'#b99865');crates(m,-.55,-.15);},
  formation:(m,o,c,t)=>{for(const [x,y]of[[-.6,-.3],[.45,-.3],[0,.5]])person(m,{hat:'helmet',tool:'rifle',animation:o.animation},c,t,x,y,0,.65);},
  vehicle:(m,o,c,t)=>{vehicle(m,o,c,t);if(o.animal)animal(m,'horse','#b19b7a',1.8,0);},
  gun:(m,o,c)=>{
    if(!o.battery){gun(m,o,c);return;}
    slab(m);
    for(const y of[-.5,.45]){
      const sub=new IsoScene(m.view);sub.wheelPhase=m.wheelPhase;gun(sub,o,c);
      for(const f of sub.faces){f.points=f.points.map(([x,Y,z])=>[x*.75,Y*.75+y,z*.75]);f.depth=f.points.reduce((s,[x,Y,z])=>s+x+Y+z,0)/f.points.length;m.faces.push(f);}
    }
  },
};
export const ISOMETRIC_MODELS=Object.freeze(models);
function animationChoices(recipe){
  if(!recipe)return [];
  const {family,options:o}=recipe;
  if(['person','formation'].includes(family))return ['walk','run'];
  if(['vehicle','gun'].includes(family)||o.kind==='bicycle')return ['drive'];
  if(family==='ship')return ['sail'];
  if(family==='nature'&&['tree','pine','palm'].includes(o.kind))return ['sway'];
  if(animated(recipe)||family==='building'&&o.kind==='factory')return ['operate'];
  return [];
}
export const objectAnimationOptions=glyph=>['auto','none',...animationChoices(models[glyph])].map(key=>[key,OBJECT_ANIMATIONS[key]]);
export function objectAnimationOf(glyph,action={}){
  const recipe=models[glyph],choice=action.objectAnimation||'auto';
  if(choice==='none')return 'none';
  if(animationChoices(recipe).includes(choice))return choice;
  if(['move','path'].includes(action.mode)){
    if(['person','formation'].includes(recipe?.family))return 'walk';
    if(recipe?.family==='vehicle')return 'drive';
  }
  return 'auto';
}
export function createIsometricModel(glyph,color,t=0,action={},image,view='isometric'){
  const recipe=models[glyph];if(!recipe)throw Error(`Missing isometric model: ${glyph}`);
  const scene=new IsoScene(view);scene.material=({person:'cloth',mounted:'cloth',formation:'cloth',vehicle:'paint',ship:'paint',aircraft:'paint',fort:'stone',building:'plaster',landmark:'stone',bridge:'metal',nature:'earth',goods:'wood',image:'wood',time:'metal',accessory:'metal'})[recipe.family]||'matte';
  // Each recipe declares its native forward axis. Both isometric views face
  // right: +X projects down-right, while -Y projects up-right from behind.
  const turns=view==='side'?0:(recipe.forward==='y'?1:0)+(view==='isometricBack'?1:0);
  scene.complete||=turns>0;
  const animation=objectAnimationOf(glyph,action);t=objectAnimationTime(action,t);
  if(animation==='drive')scene.wheelPhase=t*6;
  families[recipe.family](scene,{...recipe.options,animation},color||'#919c72',t,action,image);
  if(animation==='sway'||animation==='sail')for(const face of scene.faces){
    face.points=face.points.map(([x,y,z])=>{
      if(animation==='sway')return [x+Math.sin(t*2)*.045*Math.max(0,z)**1.5,y,z];
      const angle=Math.sin(t*1.8)*.035,c=Math.cos(angle),s=Math.sin(angle);
      return [x,y*c-(z-.3)*s,.3+y*s+(z-.3)*c+.025*(1-Math.cos(t*1.8))];
    });
  }
  if(turns){
    // Rotate world geometry, retaining readable front text and the same sun.
    for(const face of scene.faces){
      face.points=face.points.map(([x,y,z])=>turns===1?[y,-x,z]:[-x,-y,z]);
      face.depth=face.points.reduce((sum,[x,y,z])=>sum+x+y+z,0)/face.points.length;
    }
  }
  return scene;
}
function modelFor(glyph,color,t,action,image,view='isometric'){
  const recipe=models[glyph];if(!recipe)throw Error(`Missing isometric model: ${glyph}`);
  // Keep immutable static geometry and its face ordering between animation
  // frames. Size, movement, damage and canvas rotation remain outside the model.
  let imageId=0;if(image){if(!imageIds.has(image))imageIds.set(image,++imageSerial);imageId=imageIds.get(image);}
  const animation=objectAnimationOf(glyph,action),key=JSON.stringify([glyph,color,view,imageId,currentSceneLighting().key,animation,action.objectAnimationSpeed??1,...imageSettings.map(k=>action[k])]);
  if(animation!=='none'&&(animation!=='auto'||animated(recipe))){
    let previous=animatedModels.get(key);
    if(!previous||previous.time!==t){previous={scene:createIsometricModel(glyph,color,t,action,image,view),time:t};animatedModels.set(key,previous);if(animatedModels.size>32)animatedModels.delete(animatedModels.keys().next().value);}
    return {scene:previous.scene,key,animated:true};
  }
  let scene=modelCache.get(key);
  if(!scene){scene=createIsometricModel(glyph,color,t,action,image,view);modelCache.set(key,scene);if(modelCache.size>256)modelCache.delete(modelCache.keys().next().value);}
  return {scene,key,animated:false};
}
export function drawIsometricObject(c,glyph,size,color,t=0,action={},image,{shadows=true}={}){
  const model=modelFor(glyph,color,t,action,image,objectViewOf(action)==='isometricBack'?'isometricBack':'isometric');
  return model.animated?model.scene.draw(c,size,{shadows}):drawStaticModel(c,model.scene,size,model.key,shadows);
}
export function drawSideObject(c,glyph,size,color,t=0,action={},image){
  const model=modelFor(glyph,color,t,action,image,'side');
  return model.animated?model.scene.draw(c,size,{shadows:false}):drawStaticModel(c,model.scene,size,model.key,false);
}
export function drawIsometricShadow(c,glyph,size,color,t=0,action={},image,pose={}){
  return drawModelShadow(c,modelFor(glyph,color,t,action,image,objectViewOf(action)==='isometricBack'?'isometricBack':'isometric').scene,size,pose);
}
const modelCache=new Map(),animatedModels=new Map(),imageIds=new WeakMap();let imageSerial=0;
// Rasterize completed static geometry at the actual output scale. This avoids
// repainting hundreds of material surfaces for every tree or infantry copy.
// Animated models still render their changing geometry on every frame.
const rasterCache=new Map();let rasterPixels=0;
if(typeof document!=='undefined')document.fonts?.addEventListener('loadingdone',()=>{rasterCache.clear();rasterPixels=0;});
function drawStaticModel(c,scene,size,key,shadows){
  const matrix=c.getTransform?.();
  if(!matrix||(typeof OffscreenCanvas==='undefined'&&typeof document==='undefined'))return scene.draw(c,size,{shadows});
  const ratio=Math.max(1,Math.ceil(Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d))*2)/2),bounds=scene.bounds(shadows),padding=3;
  const x=Math.floor(bounds.left*size*ratio)-padding,y=Math.floor(bounds.top*size*ratio)-padding,w=Math.ceil(bounds.right*size*ratio)-x+padding,h=Math.ceil(bounds.bottom*size*ratio)-y+padding;
  if(w*h>4e6||w<=0||h<=0)return scene.draw(c,size,{shadows});
  const cacheKey=key+':'+size+':'+ratio+':'+shadows;let entry=rasterCache.get(cacheKey);
  if(!entry){
    const canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):document.createElement('canvas');canvas.width=w;canvas.height=h;
    const target=canvas.getContext('2d');if(!target)return scene.draw(c,size,{shadows});
    target.setTransform(ratio,0,0,ratio,-x,-y);scene.draw(target,size,{shadows});entry={canvas,x,y,w,h,ratio};
    while(rasterPixels+w*h>8e6&&rasterCache.size){const oldest=rasterCache.keys().next().value,previous=rasterCache.get(oldest);rasterPixels-=previous.w*previous.h;rasterCache.delete(oldest);}
    rasterCache.set(cacheKey,entry);rasterPixels+=w*h;
  }
  c.drawImage(entry.canvas,entry.x/entry.ratio,entry.y/entry.ratio,entry.w/entry.ratio,entry.h/entry.ratio);return bounds;
}
const imageSettings=['badgeZoom','badgeX','badgeY','badgeBorder','plaqueColor','showLabel','label','plaqueFont','plaqueSize','plaqueWeight','plaqueItalic','plaqueFit','bannerAspect','bannerPole','bannerPoleColor','bannerPlaque','bannerTitle','bannerWind','bannerWindStrength','bannerWindSpeed'];
function animated({family,options:o}){
  if(family==='ship')return !!o.sail;
  if(family==='aircraft')return ['drone','helicopter'].includes(o.kind);
  if(family==='fort')return !['palisade','wall','earthwork','watchtower','ruins'].includes(o.kind);
  if(family==='building')return ['town','base','school','tradingPost','windmill','windTurbine'].includes(o.kind);
  if(family==='nature')return o.kind==='volcano';
  if(family==='image')return ['flag','banner'].includes(o.kind);
  if(family==='time')return ['clock','stopwatch'].includes(o.kind);
  return false;
}
