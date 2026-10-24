// Small, seeded material maps and sprites are shared across frames and zones.
const materials=new Map(),sprites=new Map();
const hash=(x,y,s)=>{let n=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(s,1274126177);n=Math.imul(n^(n>>>13),1274126177);return((n^(n>>>16))>>>0)/4294967296;};
const palettes={
  grassland:[[57,77,35],[117,133,65],[166,157,90]],jungle:[[23,49,34],[49,77,40],[100,115,53]],
  woodland:[[43,65,35],[92,113,51],[150,144,82]],pineForest:[[30,52,44],[67,91,65],[123,135,95]],
  mountains:[[65,66,61],[124,121,106],[191,186,161]],hills:[[63,80,42],[118,134,68],[174,170,105]],
  river:[[24,68,82],[48,113,127],[119,167,157]],lake:[[24,61,82],[47,99,124],[106,155,167]],
  desert:[[149,115,65],[205,171,107],[237,212,156]],snow:[[155,179,184],[216,226,222],[246,244,231]],
  marsh:[[43,68,54],[82,107,72],[147,153,103]],farmland:[[83,76,40],[144,139,67],[195,179,104]]
};
function canvas(w,h){const t=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(w,h):typeof document!=='undefined'?document.createElement('canvas'):null;if(t){t.width=w;t.height=h;}return t;}
function bounded(cache,key,value,max){if(cache.size>=max)cache.delete(cache.keys().next().value);cache.set(key,value);return value;}
// Periodic value noise keeps the material seamless at every octave.
function noise(x,y,n,seed){const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy,s=u*u*(3-2*u),t=v*v*(3-2*v),a=hash(ix%n,iy%n,seed),b=hash((ix+1)%n,iy%n,seed),c=hash(ix%n,(iy+1)%n,seed),d=hash((ix+1)%n,(iy+1)%n,seed);return a+(b-a)*s+(c-a)*t+(a-b-c+d)*s*t;}
export function terrainMaterial(kind,seed=0){
  const key=kind+':'+seed;if(materials.has(key))return materials.get(key);
  const tile=canvas(256,256);if(!tile)return null;
  const c=tile.getContext('2d'),pixels=c.createImageData(256,256),height=new Float32Array(256*256),palette=palettes[kind]||palettes.grassland;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    let n=0;for(let octave=0;octave<5;octave++){const f=4*2**octave;n+=noise(x/256*f,y/256*f,f,seed+octave*19)*(.52/2**octave);}
    if(kind==='desert')n=n*.55+.24*(1+Math.sin(x*Math.PI/32+noise(x/64,y/64,4,seed)*4+y*Math.PI/64));
    if(kind==='farmland'){const field=hash(Math.floor(x/64),Math.floor(y/64),seed);n=n*.5+field*.38+Math.sin((field>.5?x:y)*1.1)*.045;}
    height[y*256+x]=n;
  }
  const relief={mountains:100,desert:70,hills:55,snow:35,river:20,lake:15}[kind]??32;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
    const i=y*256+x,n=height[i],mix=Math.max(0,Math.min(1,(n-.18)*1.65)),a=mix<.5?palette[0]:palette[1],b=mix<.5?palette[1]:palette[2],t=mix<.5?mix*2:(mix-.5)*2;
    const light=(height[y*256+(x+255)%256]-height[((y+1)%256)*256+x])*relief+(hash(x,y,seed+91)-.5)*12;
    for(let k=0;k<3;k++)pixels.data[i*4+k]=a[k]+(b[k]-a[k])*t+light;pixels.data[i*4+3]=255;
  }
  c.putImageData(pixels,0,0);
  if(kind==='farmland')for(let row=0;row<4;row++)for(let col=0;col<4;col++){
    const x=col*64,y=row*64,vertical=hash(col,row,seed)>.5;
    c.strokeStyle='#d2c29b';c.lineWidth=2;c.strokeRect(x+1,y+1,62,62);
    c.strokeStyle=hash(col,row,seed+6)>.5?'#e5d09570':'#344d2e80';c.lineWidth=1.2;
    for(let j=5;j<60;j+=3){c.beginPath();c.moveTo(x+(vertical?j:4),y+(vertical?4:j));c.lineTo(x+(vertical?j:60),y+(vertical?60:j));c.stroke();}
    for(let j=5;j<62;j+=5){c.fillStyle='#3a542b99';c.beginPath();c.ellipse(x+j,y+2,2,1.3,0,0,Math.PI*2);c.fill();}
  }
  // Fine sand ripples, grass fibres, rock seams and water highlights.
  for(let i=0;i<1100;i++){
    const x=hash(i,1,seed)*256,y=hash(i,2,seed)*256,v=hash(i,3,seed);
    c.strokeStyle=v>.55?'#fff3cc24':'#172c2524';c.lineWidth=.5+v*.5;c.beginPath();c.moveTo(x,y);
    if(kind==='desert'){c.bezierCurveTo(x+3,y-2,x+7,y-2,x+12,y-1);}
    else if(kind==='lake'||kind==='river'){c.strokeStyle='#c4e7da24';c.quadraticCurveTo(x+4,y+1.5,x+9,y);}
    else if(kind==='mountains'){c.lineTo(x+2,y+3);c.lineTo(x+1,y+6);}
    else{c.lineTo(x+v*2-1,y-1-v*2);}c.stroke();
  }
  return bounded(materials,key,tile,24);
}
export function paintTerrainMaterial(c,H,v,points,k,kind,seed,density=1,scale=1){
  const tile=terrainMaterial(kind,seed);if(!tile)return;
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),span=Math.max(Math.max(...xs)-x,Math.max(...ys)-y)/3*(kind==='farmland'?scale/Math.sqrt(density):1);
  if(!(span>0))return;
  const p=H.project(v,x+k,y),px=H.project(v,x+k+span,y),py=H.project(v,x+k,y+span);
  if([p,px,py].some(q=>q.z<v.near||!Number.isFinite(q.x)||!Number.isFinite(q.y)))return;
  const a=(px.x-p.x)/256,b=(px.y-p.y)/256,d=(py.x-p.x)/256,e=(py.y-p.y)/256,det=a*e-b*d;
  if(Math.abs(det)<1e-8)return;
  const pattern=c.createPattern(tile,'repeat');if(!pattern)return;
  // Canvas patterns receive the surface transform, preserving map alignment.
  pattern.setTransform({a,b,c:d,d:e,e:p.x,f:p.y});c.fillStyle=pattern;c.fillRect(0,0,v.W,v.H);
}
export function terrainSprite(kind,variant,draw){
  const bucket=Math.min(15,Math.floor(variant*16)),key=kind+':'+bucket;
  if(sprites.has(key))return sprites.get(key);
  const tile=canvas(192,160);if(!tile)return null;const c=tile.getContext('2d');c.translate(96,120);draw(c,kind,60,(bucket+.5)/16,0);
  return bounded(sprites,key,tile,192);
}
