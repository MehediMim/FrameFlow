// Repeatable, offline cartoon materials. Tiles contain transparent highlights and
// recesses so object colors and directional lighting remain visible underneath.
export const SURFACE_TEXTURES = {
  grass: 'Meadow grass', dirt: 'Earth / gravel', sand: 'Soft sand', stone: 'Cobblestone',
  brick: 'Brickwork', plaster: 'Painted plaster', wood: 'Wood planks', roof: 'Roof shingles',
  tiles: 'Paving tiles', water: 'Water ripples', bark: 'Tree bark', snow: 'Powder snow', leaves:'Painted leaves',
};
export const TEXTURE_SPECS = Object.fromEntries(Object.keys(SURFACE_TEXTURES).map(k=>[k,{S:128,T:({grass:4,dirt:3,sand:4,stone:2,brick:2,plaster:2,wood:2,roof:2,tiles:3,water:5,bark:1,snow:4,leaves:2})[k],a:({grass:.23,dirt:.25,sand:.2,stone:.35,brick:.35,plaster:.15,wood:.32,roof:.38,tiles:.3,water:.4,bark:.24,snow:.16,leaves:.2})[k]}]));
export const TEXTURE_PACKS = {
  none: { label:'Smooth / no pack', description:'Keep current colors and remove automatic textures.' },
  storybook: { label:'Storybook meadow', description:'Soft grass, warm plaster, shingles and timber.', ground:'#8ca96c',sky:'#c8e3ed', foliage:'#6e985a',wall:'#e7cfaa',accent:'#b57656',path:'#c6ad83',rock:'#98a397',water:'#76b8c7',groundTexture:'grass',wallTexture:'plaster' },
  village: { label:'Rustic village', description:'Earth paths, red brick, weathered wood and tiled roofs.',ground:'#94a16c',sky:'#d1e0df',foliage:'#73905b',wall:'#c9997a',accent:'#a6664f',path:'#bfa280',rock:'#9e998a',water:'#7aadb4',groundTexture:'grass',wallTexture:'brick' },
  coastal: { label:'Coastal sunshine',description:'Sand, whitewashed houses and turquoise water.',ground:'#d8c99b',sky:'#bce5ee',foliage:'#78a789',wall:'#eee4c8',accent:'#6b9da5',path:'#c6b78e',rock:'#b5afa0',water:'#68bfca',groundTexture:'sand',wallTexture:'plaster' },
  autumn: { label:'Autumn woodland',description:'Golden grass, copper leaves and warm stone.',ground:'#b4a06b',sky:'#e7d8bd',foliage:'#ba864e',wall:'#d7b790',accent:'#8a5e49',path:'#b69b76',rock:'#a59b88',water:'#88adb2',groundTexture:'grass',wallTexture:'stone' },
  alpine: { label:'Alpine winter',description:'Powder snow, blue stone and timber chalets.',ground:'#e3e9e7',sky:'#c8dce8',foliage:'#6c8b83',wall:'#b7b8af',accent:'#7e6557',path:'#c1c4bf',rock:'#98a6ae',water:'#8bb6ca',groundTexture:'snow',wallTexture:'wood' },
  desert: { label:'Desert oasis',description:'Wind-brushed dunes, adobe walls and warm sandstone.',ground:'#d4b382',sky:'#e8d8bd',foliage:'#929969',wall:'#dcb98d',accent:'#b77e5a',path:'#c4a175',rock:'#b19477',water:'#77b7b4',groundTexture:'sand',wallTexture:'plaster' },
};
const foliage=new Set(['tree','pine','palm','bush','hill','mound']);
const buildings=new Set(['building','house','shop','barn','wall','windmill']);
export function applyTexturePack(p,id) {
  if(!Object.hasOwn(TEXTURE_PACKS,id))throw Error('Invalid texture pack');
  p.texturePack=id;
  if(id==='none')return;
  const pack=TEXTURE_PACKS[id];
  Object.assign(p,{material:'texture',ground:pack.ground,sky:pack.sky});
  for(const o of p.objects){
    if(foliage.has(o.type)||o.type==='park')o.color=pack.foliage;
    if(buildings.has(o.type)){o.color=pack.wall;o.accentColor=pack.accent;}
    if(['path','field'].includes(o.type))o.color=pack.path;
    if(['rock','mountain','plateau'].includes(o.type))o.color=pack.rock;
    if(['pond','river'].includes(o.type))o.color=pack.water;
  }
}
export function surfaceTexture(p,o,color) {
  const pack=TEXTURE_PACKS[p.texturePack??'none'];
  if(!o)return p.groundTexture&&p.groundTexture!=='auto'?p.groundTexture:pack?.groundTexture??'none';
  if(o.surfaceTexture&&o.surfaceTexture!=='auto')return o.surfaceTexture;
  if(!pack||p.texturePack==='none'||p.texturePack===undefined)return 'none';
  // Detail colors get their own material rather than bricking over windows/faces.
  if(color==='#8d6e52')return 'bark';
  if(['#957253','#9c7555'].includes(color))return 'wood';
  if(['house','barn','shop','gazebo','stall'].includes(o.type)&&color===(o.accentColor??'#b16e53'))return 'roof';
  if(color!==o.color)return 'none';
  if(['tree','pine','palm','bush'].includes(o.type))return 'leaves';
  if(o.type==='terrain')return o.terrainProfile==='dunes'?'sand':o.terrainProfile==='ridged'?'stone':pack.groundTexture;
  if(foliage.has(o.type)||o.type==='park')return pack.groundTexture==='snow'?'snow':'grass';
  if(buildings.has(o.type))return pack.wallTexture;
  if(['fence','bridge','bench','table','chair','shelf','door'].includes(o.type))return 'wood';
  if(['rock','mountain','plateau','fountain'].includes(o.type))return 'stone';
  if(o.type==='path'||o.type==='field')return p.texturePack==='coastal'||p.texturePack==='desert'?'sand':'dirt';
  if(o.type==='road'||o.type==='junction')return 'dirt';
  if(o.type==='floor')return 'tiles';
  if(o.type==='pond'||o.type==='river')return 'water';
  return 'none';
}

export function paintSurfaceTile(g,S,kind) {
  let seed=9381;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const line=(x,y,dx,dy,c,w=1)=>{g.strokeStyle=c;g.lineWidth=w;g.beginPath();g.moveTo(x,y);g.lineTo(x+dx,y+dy);g.stroke();};
  const dot=(x,y,r,c)=>{g.fillStyle=c;g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();};
  const dark='#26382c', light='#fff8dc';
  // Draw a 3×3 neighborhood so strokes crossing tile edges repeat seamlessly.
  const marks=[];
  if(['grass','dirt','sand','plaster','snow','bark'].includes(kind))for(let i=0;i<80;i++)marks.push([rnd()*S,rnd()*S,rnd()]);
  for(const dx of [-S,0,S])for(const dy of [-S,0,S]){
    g.save();g.translate(dx,dy);
    if(kind==='grass'){
      for(const [x,y,r] of marks.slice(0,10)){g.fillStyle=r>.5?'#26382c28':'#fff8dc38';g.beginPath();g.ellipse(x,y,8+r*12,4+r*5,0,0,Math.PI*2);g.fill();}
      for(const [x,y,r] of marks.slice(0,24)){line(x,y,3,-6-r*5,r>.4?dark:light,1.5);if(r>.6)line(x,y,-3,-5,dark,1.2);}
    }
    if(kind==='leaves')for(let i=0;i<22;i++){const x=(i*43)%S,y=(i*61)%S;g.fillStyle=i%3?'#26382c70':'#fff8dc90';g.beginPath();g.ellipse(x,y,4,8,i*.8,0,Math.PI*2);g.fill();}
    if(kind==='dirt'||kind==='snow'||kind==='plaster')for(const [x,y,r] of marks){dot(x,y,.6+r*1.5,r>.5?light:dark);if(kind==='dirt'&&r>.75)line(x,y,3,1,light,1.5);}
    if(kind==='sand'||kind==='water')for(let y=12;y<S;y+=20){g.beginPath();g.moveTo(0,y);for(let x=0;x<=S;x+=4)g.lineTo(x,y+Math.sin(x/S*Math.PI*2+y)*3);g.strokeStyle=kind==='water'?'#ecffff':dark;g.lineWidth=kind==='water'?2:1;g.stroke();}
    if(['brick','roof','stone','tiles'].includes(kind)){
      const cell=kind==='tiles'?S/4:S/3,hh=kind==='brick'?S/6:kind==='roof'?S/4:S/3;
      for(let row=0;row<Math.ceil(S/hh);row++)for(let col=-1;col<=Math.ceil(S/cell);col++){
        const x=col*cell+(row%2&&kind!=='tiles'?cell/2:0),y=row*hh;
        g.fillStyle=(row+col)%3===0?'#ffffff16':'#2430260c';g.fillRect(x+2,y+2,cell-4,hh-4);
        line(x,y,cell,0,dark,1.8);line(x,y,0,hh,dark,1.3);line(x+2,y+2,cell-4,0,light,.9);
      }
    }
    if(kind==='wood'||kind==='bark'){
      for(let x=0;x<S;x+=kind==='bark'?S/8:S/4){line(x,0,0,S,dark,2);line(x+2,0,0,S,light,1);}
      for(let i=0;i<22;i++){const x=(i*31)%S,y=(i*47)%S;line(x,y,Math.sin(i)*2,12+(i%5)*3,i%3?dark:light,.7);}
      if(kind==='wood'){g.strokeStyle=dark;g.lineWidth=1;g.beginPath();g.ellipse(S*.37,S*.42,3,8,0,0,Math.PI*2);g.stroke();}
    }
    g.restore();
  }
}

export const TERRAIN_TYPES={flat:'Flat ground',rolling:'Rolling countryside',ridged:'Mountain ridges',dunes:'Sand dunes'};
export const DEFAULT_TERRAIN={type:'flat',height:6,scale:35,flatRadius:28,seed:7};
export function terrainHeight(x,z,input={}) {
  const q={...DEFAULT_TERRAIN,...input};
  const radius=Math.hypot(x,z-12),fade=Math.max(0,Math.min(1,(radius-q.flatRadius)/18));
  const xx=x/q.scale+q.seed*.73,zz=z/q.scale-q.seed*.31;
  let h=q.type==='dunes'?.5+.5*Math.sin(xx*3+Math.sin(zz)):q.type==='ridged'?Math.pow(1-Math.abs(Math.sin(xx*1.5+Math.cos(zz))),2):.5+.25*Math.sin(xx*2+zz)+.25*Math.cos(zz*2-xx);
  let y=q.type==='flat'?-.15:-.15+q.height*h*fade*fade*(3-2*fade);
  for(const brush of q.sculpt??[]){const d=Math.hypot(x-brush.x,z-brush.z)/brush.radius;if(d>=1)continue;const k=(1-d*d)**2;y=brush.mode==='flatten'?y+(brush.level-y)*k:y+brush.amount*k;}
  return Math.max(-5,Math.min(35,y));
}
let cachedTerrainKey='',cachedTerrain;
export function terrainMesh(input={}) {
  const q={...DEFAULT_TERRAIN,...input},key=JSON.stringify(q);if(cachedTerrainKey===key)return cachedTerrain;
  const faces=[],step=8;
  for(let x=-144;x<192;x+=step)for(let z=-144;z<192;z+=step){
    const nearBrush=(q.sculpt??[]).some(b=>b.x+b.radius>=x&&b.x-b.radius<=x+step&&b.z+b.radius>=z&&b.z-b.radius<=z+step),n=nearBrush?8:1,cell=step/n;
    for(let i=0;i<n;i++)for(let j=0;j<n;j++){const px=x+i*cell,pz=z+j*cell;
    const a=[px,terrainHeight(px,pz,q),pz],b=[px+cell,terrainHeight(px+cell,pz,q),pz],c=[px+cell,terrainHeight(px+cell,pz+cell,q),pz+cell],d=[px,terrainHeight(px,pz+cell,q),pz+cell];faces.push([a,b,c],[a,c,d]);}
  }
  cachedTerrainKey=key;cachedTerrain=faces;return faces;
}
