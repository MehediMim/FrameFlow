// Layered vector miniatures remain sharp in close-ups and video exports.
const ink='#30352a', leather='#6b5136', skin='#d3af85', cloth='#b9b08a', steel='#74776d';
function shape(c,s,points,fill){
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*s,y*s):c.moveTo(x*s,y*s));
  c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=ink;c.lineWidth=s*.025;c.lineJoin='round';c.stroke();
}
function box(c,s,x,y,w,h,fill,r=.025){
  c.beginPath();c.roundRect(x*s,y*s,w*s,h*s,r*s);c.fillStyle=fill;c.fill();
  c.strokeStyle=ink;c.lineWidth=s*.025;c.stroke();
}
function line(c,s,x,y,X,Y,color=ink,width=.025){
  c.beginPath();c.moveTo(x*s,y*s);c.lineTo(X*s,Y*s);c.strokeStyle=color;c.lineWidth=s*width;c.lineCap='round';c.stroke();
}
function oval(c,s,x,y,rx,ry,fill){
  c.beginPath();c.ellipse(x*s,y*s,rx*s,ry*s,0,0,Math.PI*2);c.fillStyle=fill;c.fill();
  c.strokeStyle=ink;c.lineWidth=s*.025;c.stroke();
}
export function drawDocumentarySoldier(c,s,col,role='rifleman'){
  // Pack and bedroll sit behind the silhouette; gaiters and boots anchor it.
  box(c,s,-.37,-.38,.25,.52,leather,.06);
  box(c,s,-.4,-.46,.28,.12,cloth,.045);
  if(role==='radio'){
    box(c,s,-.48,-.39,.28,.5,steel,.035);
    line(c,s,-.43,-.38,-.48,-1.21,ink,.018);
    for(let i=0;i<3;i++)line(c,s,-.44,-.27+i*.07,-.27,-.27+i*.07,cloth,.018);
  }
  shape(c,s,[[-.22,.12],[.02,.13],[-.04,.49],[-.11,.77],[-.28,.76],[-.24,.46]],col);
  shape(c,s,[[.04,.12],[.24,.12],[.22,.47],[.31,.75],[.12,.79],[.04,.48]],col);
  box(c,s,-.28,.57,.19,.2,cloth);box(c,s,.12,.57,.19,.2,cloth);
  box(c,s,-.32,.74,.25,.12,ink);box(c,s,.11,.75,.32,.12,ink);
  for(const x of[-.25,.15])for(let i=0;i<3;i++)line(c,s,x,.61+i*.045,x+.12,.61+i*.045,leather,.015);
  shape(c,s,[[-.23,-.43],[.19,-.43],[.29,-.21],[.25,.22],[-.26,.22],[-.3,-.18]],col);
  shape(c,s,[[-.12,-.43],[.09,-.43],[0,-.19]],cloth);
  line(c,s,-.18,-.39,.18,.09,cloth,.055);line(c,s,.14,-.38,-.14,.09,cloth,.05);
  box(c,s,-.29,.07,.57,.08,leather);box(c,s,-.035,.073,.09,.075,'#b5a36c',.01);
  for(const x of[-.23,.09]){box(c,s,x,-.17,.14,.17,cloth);line(c,s,x,-.12,x+.14,-.12,leather,.018);}
  for(const x of[-.29,.17]){box(c,s,x,.08,.12,.16,leather);line(c,s,x+.02,.12,x+.1,.12,cloth,.018);}
  // Neck, face, ear, helmet rim, chin strap and highlights.
  box(c,s,-.06,-.52,.13,.12,skin);
  shape(c,s,[[-.15,-.77],[.16,-.76],[.2,-.62],[.14,-.48],[-.06,-.48],[-.17,-.59]],skin);
  oval(c,s,-.13,-.63,.055,.07,skin);
  line(c,s,.06,-.66,.14,-.65,ink,.022);line(c,s,.13,-.6,.18,-.58,leather,.018);
  line(c,s,-.12,-.69,-.04,-.5,leather,.018);line(c,s,-.04,-.5,.13,-.53,leather,.018);
  if(role==='officer'){
    shape(c,s,[[-.23,-.78],[-.19,-.96],[.17,-.96],[.25,-.78]],col);
    box(c,s,-.22,-.8,.46,.075,leather);shape(c,s,[[-.05,-.72],[.29,-.72],[.21,-.66]],ink);
    box(c,s,-.025,-.89,.065,.06,'#c3ad71',.01);
  }else{
    c.beginPath();c.ellipse(0,-.77*s,.25*s,.2*s,0,Math.PI,Math.PI*2);
    c.closePath();c.fillStyle=col;c.fill();c.strokeStyle=ink;c.lineWidth=s*.025;c.stroke();
    box(c,s,-.28,-.79,.57,.065,col);
    line(c,s,-.15,-.88,.07,-.92,cloth,.022);
  }
  // Sleeves, hands and role-specific equipment.
  shape(c,s,[[-.26,-.37],[-.36,-.27],[-.36,-.04],[-.13,.08],[-.07,-.03],[-.24,-.15]],col);
  shape(c,s,[[.2,-.37],[.32,-.26],[.42,-.11],[.3,-.02],[.16,-.2]],col);
  if(role==='radio'){
    line(c,s,.31,-.1,.29,-.58,col,.13);box(c,s,.25,-.67,.08,.19,ink);
    oval(c,s,.28,-.49,.07,.06,skin);line(c,s,.29,-.47,.44,-.13,ink,.018);
    line(c,s,.44,-.13,.35,.15,ink,.018);
  }else if(role==='officer'){
    box(c,s,.26,-.13,.3,.16,ink);
    oval(c,s,.44,-.12,.035,.055,steel);oval(c,s,.54,-.12,.035,.055,steel);
    oval(c,s,.3,-.08,.07,.065,skin);
    line(c,s,-.19,-.35,.17,.06,leather,.045);
    box(c,s,.23,.14,.16,.26,leather);line(c,s,.27,.2,.34,.2,cloth,.02);
  }else if(role==='medic'){
    line(c,s,-.21,-.36,.31,.22,cloth,.055);box(c,s,.13,.12,.32,.28,cloth);
    oval(c,s,.29,.25,.07,.06,'#e8dfc7');box(c,s,-.36,-.24,.11,.13,cloth);
    oval(c,s,-.11,.035,.07,.055,skin);oval(c,s,.34,-.065,.07,.055,skin);
  }else{
    // Wooden stock, trigger guard, steel barrel, sights and sling.
    shape(c,s,[[-.21,.06],[-.13,-.04],[.46,-.29],[.5,-.2],[.02,.05],[-.11,.18]],leather);
    line(c,s,.27,-.22,.84,-.48,steel,.055);line(c,s,.79,-.48,.79,-.55,ink,.024);
    line(c,s,.01,.06,.63,-.28,cloth,.018);oval(c,s,.04,.065,.065,.045,ink);
    oval(c,s,-.1,.035,.075,.055,skin);oval(c,s,.34,-.185,.075,.055,skin);
  }
}
const unit=(label,color,role)=>({label,color,group:'documentary',draw:(c,s,col)=>drawDocumentarySoldier(c,s,col,role)});
export const DOCUMENTARY_OBJECTS={
  soldier:unit('Rifleman · field uniform','#737b50','rifleman'),
  fieldOfficer:unit('Field officer · binoculars','#72765a','officer'),
  radioOperator:unit('Radio operator · backpack set','#6c7752','radio'),
  fieldMedic:unit('Field medic · medical satchel','#8a8764','medic'),
};
