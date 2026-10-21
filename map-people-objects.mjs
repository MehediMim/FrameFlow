// Occupation miniatures: distinct uniforms, tools, and deterministic work gestures.
import { INK, IVORY, GLASS, shape, box, line, oval, miniature } from './map-miniature-drawing.mjs';
const steel='#8d9ba2',gold='#d9b25d';
const PEOPLE={
  doctor:{skin:'#b77f5c',hair:'#343332',coat:true,tool:'stethoscope'},
  nurse:{skin:'#e0ad88',hair:'#644431',tool:'medical'},
  engineer:{skin:'#8f5d43',hair:'#322d2b',hat:'hardhat',tool:'blueprint'},
  constructionWorker:{skin:'#c8946e',hair:'#4d382b',hat:'hardhat',vest:true,tool:'hammer'},
  farmer:{skin:'#9f6c4b',hair:'#332c27',hat:'straw',tool:'pitchfork'},
  chef:{skin:'#82573f',hair:'#2d2c29',hat:'chef',apron:true,tool:'pan'},
  teacher:{skin:'#d1a17b',hair:'#49342d',tool:'book'},
  firefighter:{skin:'#b7805d',hair:'#332b27',hat:'fire',vest:true,tool:'hose'},
  policeOfficer:{skin:'#d9a580',hair:'#4c382c',hat:'cap',tool:'radio'},
  scientist:{skin:'#91634c',hair:'#342f2a',coat:true,glasses:true,tool:'flask'},
  pilot:{skin:'#c99a76',hair:'#42382f',hat:'pilot',tool:'case'},
  officeWorker:{skin:'#79513c',hair:'#282d31',tool:'laptop'},
  artist:{skin:'#daa982',hair:'#65452f',hat:'beret',apron:true,tool:'palette'},
  photographer:{skin:'#aa7655',hair:'#34302d',tool:'camera'},
  mechanic:{skin:'#d3a37e',hair:'#4b352a',hat:'cap',tool:'wrench'},
  deliveryWorker:{skin:'#986448',hair:'#2e2926',hat:'cap',tool:'parcel'},
};
function hat(c,s,type,col){
  if(type==='chef'){
    box(c,s,-.21,-1.12,.42,.18,IVORY);for(const [x,y]of [[-.18,-1.19],[0,-1.28],[.18,-1.19]])oval(c,s,x,y,.15,.14,IVORY);
  }else if(type==='hardhat'||type==='fire'){
    oval(c,s,0,-1.03,.25,.18,type==='fire'?'#b84d3d':gold);box(c,s,-.31,-1.02,.62,.06,type==='fire'?'#b84d3d':gold);
    line(c,s,0,-1.2,0,-1.05,IVORY,.04);if(type==='fire')box(c,s,-.075,-1.07,.15,.13,gold);
  }else if(type==='straw'){
    shape(c,s,[[-.21,-1],[-.14,-1.19],[.14,-1.19],[.21,-1]],gold);oval(c,s,0,-1,.38,.065,gold);line(c,s,-.2,-1.05,.2,-1.05,'#82613f',.05);
  }else if(type==='beret'){
    oval(c,s,0,-1.07,.27,.11,col);line(c,s,.04,-1.17,.08,-1.23,INK,.035);
  }else{
    shape(c,s,[[-.24,-1.01],[-.22,-1.15],[.18,-1.15],[.24,-1.01]],col);box(c,s,-.25,-1.02,.56,.055,INK);
    if(type==='pilot'){line(c,s,-.2,-1.04,.2,-1.04,gold,.025);oval(c,s,0,-1.09,.055,.035,gold);}
  }
}
function tool(c,s,type,col,t,skin){
  const gesture=Math.sin(t*2)*.035;
  // Hands are drawn with each prop so that tools stay in the person's grasp.
  switch(type){
    case 'stethoscope':
      line(c,s,-.1,-.59,-.14,-.24,INK,.03);line(c,s,.1,-.59,.14,-.24,INK,.03);oval(c,s,0,-.24,.14,.13,INK);oval(c,s,0,-.24,.105,.095,IVORY);line(c,s,.14,-.24,.2,-.05,INK,.025);oval(c,s,.2,-.04,.055,.055,steel);
      box(c,s,.34,-.3,.29,.41,'#b6a17e');box(c,s,.39,-.34,.18,.06,steel);line(c,s,.41,-.15,.57,-.15,IVORY,.018);break;
    case 'medical':
      box(c,s,.29,-.1,.4,.32,IVORY,.05);box(c,s,.41,-.17,.16,.08,steel);line(c,s,.49,-.04,.49,.14,'#c66f62',.05);line(c,s,.4,.05,.58,.05,'#c66f62',.05);break;
    case 'blueprint':
      box(c,s,-.4,-.2,.85,.42,'#5c8da9');for(const x of [-.32,-.22])box(c,s,x,-.13,.21,.22,GLASS);line(c,s,.04,-.12,.32,-.12,IVORY,.025);line(c,s,.04,-.02,.25,-.02,IVORY,.02);oval(c,s,-.4,-.02,.05,.07,skin);oval(c,s,.46,-.02,.05,.07,skin);break;
    case 'hammer':
      box(c,s,-.25,-.02,.5,.11,'#786146');line(c,s,.44,.17,.44,-.44+gesture,'#a1855e',.065);shape(c,s,[[.28,-.45+gesture],[.62,-.45+gesture],[.65,-.32+gesture],[.51,-.3+gesture],[.51,-.36+gesture],[.28,-.34+gesture]],steel);break;
    case 'pitchfork':
      line(c,s,.52,.77,.52,-1.05,'#a38a61',.04);for(const x of [.38,.52,.66])line(c,s,x,-.88,x,-1.23,steel,.035);line(c,s,.38,-.88,.66,-.88,steel,.035);break;
    case 'pan':
      line(c,s,.29,-.06,.51,-.16+gesture,INK,.06);oval(c,s,.74,-.15+gesture,.31,.11,steel);oval(c,s,.74,-.18+gesture,.24,.055,'#d6ad60');line(c,s,.68,-.34+gesture,.68,-.45+gesture,IVORY,.018);break;
    case 'book':
      shape(c,s,[[-.49,-.27],[-.08,-.18],[0,-.09],[.08,-.18],[.49,-.27],[.49,.12],[.08,.21],[0,.16],[-.08,.21],[-.49,.12]],IVORY);line(c,s,0,-.09,0,.15,col,.025);for(const y of [-.12,-.03,.06]){line(c,s,-.4,y-.05,-.12,y,steel,.015);line(c,s,.12,y,.4,y-.05,steel,.015);}break;
    case 'hose':
      c.beginPath();c.moveTo(.45*s,-.05*s);c.bezierCurveTo(1*s,.1*s,.85*s,.73*s,1.1*s,.7*s);c.strokeStyle=gold;c.lineWidth=.085*s;c.stroke();line(c,s,.29,-.18,.56,-.21+gesture,steel,.1);break;
    case 'radio':
      shape(c,s,[[-.11,-.52],[.11,-.52],[.08,-.39],[0,-.34],[-.08,-.39]],gold);box(c,s,.34,-.4,.21,.32,INK);line(c,s,.4,-.4,.4,-.64,INK,.025);box(c,s,.38,-.33,.13,.08,GLASS);for(const y of [-.18,-.13])line(c,s,.39,y,.5,y,steel,.018);break;
    case 'flask':
      shape(c,s,[[.42,-.45],[.57,-.45],[.57,-.23],[.72,.08],[.27,.08],[.42,-.23]],GLASS);shape(c,s,[[.37,-.1],[.62,-.1],[.69,.05],[.3,.05]],'#9cba7b');line(c,s,.4,-.46,.59,-.46,IVORY,.035);oval(c,s,.48,-.01+gesture,.025,.025,IVORY);break;
    case 'case':
      for(const x of [-.16,.16]){line(c,s,x,-.56,x,-.42,gold,.055);line(c,s,x-.035,-.53,x+.035,-.53,INK,.018);}shape(c,s,[[-.05,-.57],[.05,-.57],[.035,-.26],[0,-.2],[-.035,-.26]],INK);box(c,s,.31,.01,.39,.33,'#64544b');box(c,s,.43,-.06,.14,.08,steel);break;
    case 'laptop':
      shape(c,s,[[-.06,-.58],[.06,-.58],[.04,-.27],[0,-.21],[-.04,-.27]],'#b47459');box(c,s,-.4,-.2,.8,.42,steel);box(c,s,-.34,-.14,.68,.29,INK);oval(c,s,0,.015,.035,.035,IVORY);line(c,s,-.44,.24,.44,.24,IVORY,.05);break;
    case 'palette':
      oval(c,s,-.38,-.02,.24,.17,'#b89b6c');for(const [x,y,paint]of [[-.5,-.06,'#b85c4e'],[-.35,-.12,'#5f8caa'],[-.22,-.02,'#d0af53'],[-.4,.07,'#78986a']])oval(c,s,x,y,.042,.035,paint);
      line(c,s,.43,.08,.57,-.49+gesture,'#ac8e63',.035);shape(c,s,[[.54,-.47+gesture],[.58,-.65+gesture],[.61,-.45+gesture]],'#647e9e');break;
    case 'camera':
      line(c,s,-.16,-.58,0,-.04,INK,.025);line(c,s,.16,-.58,0,-.04,INK,.025);box(c,s,-.33,-.26,.66,.39,INK,.05);box(c,s,-.2,-.33,.23,.08,steel);oval(c,s,.03,-.07,.145,.145,steel);oval(c,s,.03,-.07,.1,.1,GLASS);oval(c,s,-.23,-.17,.035,.025,IVORY);break;
    case 'wrench':
      line(c,s,.4,.14,.58,-.49+gesture,steel,.075);oval(c,s,.61,-.55+gesture,.12,.13,steel);shape(c,s,[[.55,-.67+gesture],[.61,-.56+gesture],[.69,-.64+gesture]],INK);box(c,s,-.23,-.3,.13,.1,IVORY);break;
    case 'parcel':
      box(c,s,-.42,-.23,.84,.55,'#b28e5e');box(c,s,-.055,-.23,.11,.55,'#ddc79c');box(c,s,.13,-.09,.19,.13,IVORY);line(c,s,.17,-.05,.28,-.05,steel,.015);break;
  }
}
function person(c,s,col,t,role){
  const spec=PEOPLE[role],skin=spec.skin,coat=spec.coat?IVORY:col;
  // Resting weight shift is small enough to keep feet planted on the map.
  const sway=Math.sin(t*1.7)*.015;
  line(c,s,-.12,.19,-.17,.68,'#4d5c64',.17);line(c,s,.12,.19,.2,.68,'#4d5c64',.17);
  box(c,s,-.29,.65,.26,.12,INK);box(c,s,.1,.65,.28,.12,INK);
  c.save();c.translate(sway*s,0);
  box(c,s,-.27,-.6,.54,.88,coat,.09);
  line(c,s,-.26,-.45,-.4,-.03,coat,.14);line(c,s,.26,-.45,.44,-.03,coat,.14);
  oval(c,s,-.4,-.01,.07,.08,skin);oval(c,s,.44,-.01,.07,.08,skin);
  if(spec.vest){shape(c,s,[[-.24,-.58],[-.06,-.54],[-.06,.16],[-.25,.16]],'#d8a555');shape(c,s,[[.24,-.58],[.06,-.54],[.06,.16],[.25,.16]],'#d8a555');line(c,s,-.25,-.05,.25,-.05,IVORY,.045);}
  if(spec.apron){shape(c,s,[[-.14,-.53],[.14,-.53],[.24,.23],[-.24,.23]],IVORY);line(c,s,-.16,-.07,.16,-.07,steel,.02);}
  if(spec.coat){shape(c,s,[[-.12,-.58],[.12,-.58],[0,-.32]],col);line(c,s,-.14,-.58,0,-.32,steel,.025);line(c,s,.14,-.58,0,-.32,steel,.025);box(c,s,-.2,-.16,.13,.11,col);for(const y of [-.2,-.06,.08])oval(c,s,0,y,.018,.018,steel);}
  box(c,s,-.07,-.7,.14,.15,skin);
  oval(c,s,0,-.87,.205,.25,spec.hair);oval(c,s,0,-.84,.18,.205,skin);
  shape(c,s,[[-.18,-.9],[-.18,-1],[0,-1.09],[.18,-1],[.18,-.91],[.06,-.99],[-.08,-.94]],spec.hair);
  for(const x of [-.065,.065])oval(c,s,x,-.86,.015,.02,INK);line(c,s,-.04,-.74,.04,-.74,'#81513e',.018);
  if(spec.glasses){for(const x of [-.08,.08])box(c,s,x-.055,-.91,.11,.09,GLASS);line(c,s,-.025,-.87,.025,-.87,INK,.018);}
  if(spec.hat)hat(c,s,spec.hat,col);
  tool(c,s,spec.tool,col,t,skin);c.restore();
}
const worker=(label,col,role)=>({...miniature(label,col,'people',(c,s,color,t)=>person(c,s,color,t,role)),labelOffset:2.1});
export const PEOPLE_OBJECTS={
  doctor:worker('Doctor','#78a5ac','doctor'),
  nurse:worker('Nurse','#78a7a2','nurse'),
  engineer:worker('Engineer / architect','#7396ae','engineer'),
  constructionWorker:worker('Construction worker','#bb7956','constructionWorker'),
  farmer:worker('Farmer','#80965e','farmer'),
  chef:worker('Chef','#dcd8c9','chef'),
  teacher:worker('Teacher','#aa8265','teacher'),
  firefighter:worker('Firefighter','#b06247','firefighter'),
  policeOfficer:worker('Police officer','#526e8a','policeOfficer'),
  scientist:worker('Scientist','#8eada2','scientist'),
  pilot:worker('Pilot','#6c7e91','pilot'),
  officeWorker:worker('Office worker','#71828d','officeWorker'),
  artist:worker('Artist / painter','#7d91a2','artist'),
  photographer:worker('Photographer','#9a8969','photographer'),
  mechanic:worker('Mechanic','#658b99','mechanic'),
  deliveryWorker:worker('Delivery worker','#af8059','deliveryWorker'),
};
