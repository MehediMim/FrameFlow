import { sampleCurve } from './scene-storytelling.mjs';
// Shared catalog metadata and procedural models for Scene Studio.
// Dimensions are in metres. Every model uses the same local frame as the editor.
export const SCENERY = {
  house: ['House', 'Buildings', 6, 5, 3.2, '#e5c5a0'],
  shop: ['Shop / café', 'Buildings', 6, 5, 3.6, '#d9b8a2'],
  barn: ['Barn', 'Buildings', 8, 7, 4, '#b85c50'],
  tower: ['Water tower', 'Buildings', 3, 3, 7, '#91aeb9'],
  windmill: ['Windmill', 'Buildings', 4, 4, 7, '#e9ddc8'],
  gazebo: ['Gazebo', 'Buildings', 5, 5, 3, '#d3ad7c'],
  pine: ['Pine tree', 'Nature', 3, 3, 6, '#49775b'],
  palm: ['Palm tree', 'Nature', 4, 4, 5, '#6b9b65'],
  bush: ['Bush', 'Nature', 2, 1.5, 1, '#6b9659'],
  flowers: ['Flower bed', 'Nature', 3, 2, .6, '#e9acb4'],
  rock: ['Rock', 'Nature', 2, 1.8, 1.3, '#929b98'],
  hill: ['Hill', 'Nature', 20, 16, 5, '#89a575'],
  terrain: ['Terrain patch', 'Landscape', 24, 24, 5, '#8ca96c'],
  pond: ['Pond / lake', 'Landscape', 10, 8, .5, '#6cabbc'],
  river: ['River', 'Landscape', 7, 30, .5, '#78b7c6'],
  path: ['Footpath', 'Landscape', 2, 16, .5, '#cbb88f'],
  field: ['Crop field', 'Landscape', 10, 8, .8, '#c3b35f'],
  bridge: ['Bridge', 'Landscape', 4, 12, 1, '#a58b6a'],
  fence: ['Fence', 'Street & props', 8, .5, 1.2, '#cfb78e'],
  fountain: ['Fountain', 'Street & props', 4, 4, 2, '#b2c4c5'],
  sign: ['Signboard', 'Street & props', 2, .5, 2.3, '#638994'],
  bin: ['Waste bin', 'Street & props', .7, .7, 1, '#638577'],
  stall: ['Market stall', 'Street & props', 3, 2.5, 2.6, '#d59060'],
  swing: ['Swing set', 'Street & props', 4, 3, 3, '#d7ac68'],
  floor: ['Floor / plaza', 'Rooms', 12, 10, .5, '#c3baa6'],
  wall: ['Wall', 'Rooms', 10, .5, 3, '#e5dcca'],
  door: ['Door', 'Rooms', 1.2, .5, 2.4, '#9b7656'],
  window: ['Window panel', 'Rooms', 2, .5, 1.8, '#88b6c7'],
  table: ['Table', 'Rooms', 2.4, 1.4, .8, '#b49373'],
  chair: ['Chair', 'Rooms', .7, .8, 1, '#9c8068'],
  sofa: ['Sofa', 'Rooms', 2.8, 1.1, 1, '#78999c'],
  bed: ['Bed', 'Rooms', 2, 3, .9, '#b8a8b8'],
  shelf: ['Bookshelf', 'Rooms', 2.4, .6, 2.4, '#ad8c63'],
};
export const ASSET_GROUPS = {
  human: 'People & vehicles', car: 'People & vehicles', bus: 'People & vehicles',
  building: 'Buildings', tree: 'Nature', park: 'Landscape', road: 'Landscape', junction: 'Landscape', crossing: 'Landscape',
  traffic: 'Street & props', lamp: 'Street & props', bench: 'Street & props',
  ...Object.fromEntries(Object.entries(SCENERY).map(([k, v]) => [k, v[1]])),
};
export const SURFACES = ['road', 'junction', 'crossing', 'park', 'floor', 'path', 'field', 'pond', 'river'];
export const BUILDINGS = ['building', 'house', 'shop', 'barn'];
export const ROOFS = { pitched: 'Pitched roof', flat: 'Flat roof' };
export const TREE_STYLES = { round: 'Round canopy', layered: 'Layered canopy' };
export const ENVIRONMENTS = {
  day: { label: 'Clear day', sky: '#c8dfeb', ground: '#8fa77b', ambient: .52, sunAngle: -40 },
  golden: { label: 'Golden hour', sky: '#efc3a0', ground: '#a6a073', ambient: .46, sunAngle: 65 },
  overcast: { label: 'Overcast', sky: '#c3ced4', ground: '#879c82', ambient: .72, sunAngle: -20 },
  night: { label: 'Blue evening', sky: '#283c59', ground: '#4b6460', ambient: .3, sunAngle: 120 },
};

export function drawScenery(o, { lbox: b, loc, tube, ball, solid, lit, frame, col, colored, s, t, waterTime=0 }) {
  if (!SCENERY[o.type]) return false;
  const spec = SCENERY[o.type], w = o.width ?? spec[2], d = o.length ?? spec[3], h = o.height ?? spec[4];
  const wood = colored ? '#957253' : '#d4d7d3', dark = colored ? '#465864' : '#abb8bd';
  const accent = colored ? (o.accentColor ?? '#b16e53') : '#d5d9d8';
  const post = (x, z, height = h) => b(x, 0, z, .13, height, .13, wood);
  const ell = (x,y,z,rx,ry,rz,c=col) => ball(loc(x,y,z),rx*s,ry*s,rz*s,frame,c,12,8);
  const roof = (base, rise) => {
    if (o.roof === 'flat') { b(0,base,0,w+.4,.2,d+.4,accent); return; }
    solid([[-w/2-.3,base,-d/2-.3],[w/2+.3,base,-d/2-.3],[.02,base+rise,-d/2-.3],[-.02,base+rise,-d/2-.3],[-w/2-.3,base,d/2+.3],[w/2+.3,base,d/2+.3],[.02,base+rise,d/2+.3],[-.02,base+rise,d/2+.3]].map(v=>loc(...v)),accent);
  };
  if (['house','shop','barn'].includes(o.type)) {
    b(0,0,0,w,h,d,col);
    // A closed wedge is represented as a box with a raised ridge (8 vertices).
    if (o.roof === 'flat') b(0,h,0,w+.4,.22,d+.4,accent);
    else solid([[-w/2-.3,h,-d/2-.3],[w/2+.3,h,-d/2-.3],[.02,h+1.5,-d/2-.3],[-.02,h+1.5,-d/2-.3],[-w/2-.3,h,d/2+.3],[w/2+.3,h,d/2+.3],[.02,h+1.5,d/2+.3],[-.02,h+1.5,d/2+.3]].map(v=>loc(...v)),accent);
    b(0,0,d/2+.03,o.type==='barn'?w*.5:1.05,Math.min(h*.8,2.2),.08,wood);
    if(o.windows!==false) for(const sd of [-1,1]) {
      b(sd*w*.3,h*.48,d/2+.05,w*.18,h*.28,.07,dark);
      b(sd*w*.3,h*.48,-d/2-.05,w*.18,h*.28,.07,dark);
      b(sd*w*.3,h*.48,d/2+.1,.07,h*.28,.04,accent);
    }
    if(o.type==='shop') { for(let i=0;i<8;i++)b(-w/2+(i+.5)*w/8,h*.73,d/2+.6,w/8,.15,1.3,i%2?col:accent); }
  } else if(o.type==='pine') {
    b(0,0,0,.28,h,.28,wood);
    for(let i=0;i<3;i++)tube(loc(0,h*(.2+i*.2),0),loc(0,h*(.65+i*.17),0),w*(.5-i*.12)*s,.02*s,col,10);
  } else if(o.type==='palm') {
    tube(loc(0,0,0),loc(.3,h,0),.18*s,.1*s,wood,8);
    for(let i=0;i<7;i++){const a=i*Math.PI*2/7; tube(loc(.3,h,0),loc(Math.cos(a)*w/2,h-.6,Math.sin(a)*d/2),.24*s,.03*s,col,6);}
  } else if(o.type==='terrain') {
    const seed=(o.terrainSeed??7)*.73,profile=o.terrainProfile??'rolling',steps=12;
    const point=(i,j)=>{const u=i/steps,v=j/steps,envelope=Math.sin(u*Math.PI)*Math.sin(v*Math.PI),wave=profile==='dunes'?.5+.5*Math.sin(u*9+Math.sin(v*5)+seed):profile==='ridged'?Math.pow(1-Math.abs(Math.sin(u*6+Math.cos(v*4)+seed)),2):.55+.22*Math.sin(u*8+seed)+.22*Math.cos(v*7-seed);return loc((u-.5)*w,h*envelope*wave,(v-.5)*d);};
    const center=loc(0,-10,0);
    for(let i=0;i<steps;i++)for(let j=0;j<steps;j++){const a=point(i,j),b=point(i+1,j),c=point(i+1,j+1),d=point(i,j+1);lit([a,b,c],col,center,0,false);lit([a,c,d],col,center,0,false);}
  } else if(['bush','rock','hill'].includes(o.type)) ell(0,0,0,w/2,h,d/2);
  else if(['pond','river','path','field','floor'].includes(o.type)) {
    if(['path','river'].includes(o.type)&&o.curvePoints?.length>=2){
      const pts=sampleCurve(o.curvePoints),center=loc(0,-10,0);
      const edge=(i,side)=>{const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1;return loc(pts[i].x+side*dz/len*w/2,.02,pts[i].z-side*dx/len*w/2);};
      for(let i=1;i<pts.length;i++)lit([edge(i-1,-1),edge(i-1,1),edge(i,1),edge(i,-1)],col,center,0,false);
    }else{
      b(0,o.type==='floor'?-.06:-.04,0,w,.06,d,col);
      if(['pond','river'].includes(o.type))for(let i=0;i<6;i++)b(Math.sin(i*3+waterTime*.3)*w*.25,.025,-d*.4+((i*d/7+waterTime*.12)%(d*.85)),w*.2,.012,.04,colored?'#c1e6e8':col);
    }
    if(o.type==='field')for(let x=-w/2+.5;x<w/2;x+=1)for(let z=-d/2+.4;z<d/2;z+=1.3){b(x,0,z,.06,h,.06,wood);ell(x,h,z,.16,.17,.12,col);}
  } else if(o.type==='flowers') {
    b(0,0,0,w,.15,d,wood);for(let i=0;i<12;i++){const x=((i*7)%12)/12*w-w/2+.1,z=((i*5)%11)/11*d-d/2+.1;b(x,.15,z,.04,h*.7,.04,'#63865d');ell(x,h,z,.16,.1,.16,i%3?col:accent);}
  } else if(['fence','bridge'].includes(o.type)) {
    if(o.type==='bridge')b(0,h*.65,0,w,.2,d,col);
    for(const sd of [-1,1]) {
      if(o.type==='fence'){for(let x=-w/2;x<=w/2;x+=.8)post(x,0);b(0,h*.35,0,w,.12,.12,col);b(0,h*.78,0,w,.12,.12,col);break;}
      for(let z=-d/2;z<=d/2;z+=2)post(sd*w/2,z,h+1);
      b(sd*w/2,h+1,0,.12,.12,d,col);
    }
  } else if(['gazebo','stall','swing'].includes(o.type)) {
    for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])post(x,z);
    if(o.type==='swing') {b(0,h,0,w+.3,.15,.15,col);for(const x of [-.5,.5])tube(loc(x,h,0),loc(x,.7,Math.sin(t*1.5)*.35),.015*s,.015*s,dark,6);b(0,.65,Math.sin(t*1.5)*.35,1.2,.1,.5,wood);}
    else {roof(h,1);if(o.type==='stall'){b(0,.85,0,w,.18,d,wood);for(let i=0;i<6;i++)ell((i-2.5)*w/7,1.1,0,.18,.18,.18,i%2?col:accent);}else b(0,0,0,w+.5,.15,d+.5,wood);}
  } else if(o.type==='tower') {
    for(const x of [-w*.35,w*.35])for(const z of [-d*.35,d*.35])post(x,z,h*.75);
    tube(loc(0,h*.65,0),loc(0,h,0),w*.5*s,w*.5*s,col,16);
  } else if(o.type==='windmill') {
    tube(loc(0,0,0),loc(0,h,0),w*.5*s,w*.25*s,col,12);
    for(let i=0;i<4;i++){const a=t*.6+i*Math.PI/2; tube(loc(0,h*.8,d*.3),loc(Math.cos(a)*h*.4,h*.8+Math.sin(a)*h*.4,d*.3),.15*s,.28*s,accent,4);}
  } else if(o.type==='fountain') {
    tube(loc(0,0,0),loc(0,.4,0),w*.5*s,w*.5*s,col,20);ell(0,.43,0,w*.43,.05,d*.43,'#8bc9d4');tube(loc(0,.4,0),loc(0,h,0),.15*s,.3*s,col,12);ell(0,h,0,.5,.1,.5,'#b9e3e8');
  } else if(o.type==='sign') {post(0,0);b(0,h*.6,0,w,h*.4,.15,col);b(0,h*.78,.09,w*.65,.06,.03,accent);b(0,h*.65,.09,w*.45,.05,.03,accent);}
  else if(o.type==='bin') {b(0,0,0,w,h,d,col);b(0,h,0,w+.1,.08,d+.1,dark);}
  else if(['wall','door','window'].includes(o.type)) {
    b(0,0,0,w,h,d,col);
    if(o.type==='door'){b(w*.3,h*.45,d/2+.03,.09,.09,.07,accent);b(0,h*.5,d/2+.02,w*.75,h*.75,.02,wood);}
    if(o.type==='window'){b(0,0,d/2+.02,.06,h,.03,accent);for(const y of [0,h/2,h-.06])b(0,y,d/2+.02,w,.06,.03,accent);}
  } else if(['table','chair'].includes(o.type)) {
    const seat=o.type==='chair'?h*.5:h;
    b(0,seat,0,w,.12,d,col);for(const x of [-w*.4,w*.4])for(const z of [-d*.4,d*.4])b(x,0,z,.09,seat,.09,wood);
    if(o.type==='chair')b(0,seat,-d*.43,w,h-seat,.12,col);
  } else if(o.type==='sofa') {
    b(0,.15,0,w,.3,d,wood);b(0,.45,0,w,.2,d,col);b(0,.5,-d*.4,w,h-.5,.2,col);for(const sd of [-1,1])b(sd*(w/2-.12),.4,0,.24,.4,d,col);
  } else if(o.type==='bed') {
    b(0,0,0,w,h*.4,d,wood);b(0,h*.4,0,w,h*.3,d,col);b(0,0,-d/2,w,h,.15,wood);for(const sd of [-1,1])b(sd*w*.24,h*.7,-d*.3,w*.42,.13,d*.23,'#f2eadd');b(0,h*.7,d*.14,w,.05,d*.65,accent);
  } else if(o.type==='shelf') {
    for(const sd of [-1,1])b(sd*w/2,0,0,.1,h,d,wood);
    for(let y=0;y<h;y+=.55){b(0,y,0,w,.08,d,wood);for(let i=0;i<8;i++)b(-w*.4+i*w*.11,y+.08,0,w*.075,.3+(i%3)*.05,d*.65,i%2?col:accent);}
  }
  return true;
}
