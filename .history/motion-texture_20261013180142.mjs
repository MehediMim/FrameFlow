// FrameFlow Motion Studio — textured text. Deterministic textures are punched out
// of the glyph alpha, revealing the real composition background through the ink.
const clamp = (n,a,b) => Math.max(a,Math.min(b,Number(n)||0));
export const TEXT_TEXTURES = {none:'None',grain:'Fine noise',rough:'Rough grain',speckle:'Ink speckles',lines:'Hatched lines',paper:'Paper fibers'};
const TILE_SIZE=256, tiles=new Map(), glyphCache=new Map();
function createCanvas(w,h){const c=document.createElement('canvas');c.width=w;c.height=h;return c;}
function noiseTile(kind){
 if(tiles.has(kind))return tiles.get(kind);
 const c=createCanvas(TILE_SIZE,TILE_SIZE),x=c.getContext('2d');
 let seed=0x71baba+Object.keys(TEXT_TEXTURES).indexOf(kind)*7919;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 // The tile's alpha expresses the strength of the text's missing ink.
 if(kind==='grain'||kind==='rough'){
  const im=x.createImageData(256,256);
  for(let i=0;i<im.data.length;i+=4){const r=rnd();im.data[i]=im.data[i+1]=im.data[i+2]=0;
   im.data[i+3]=kind==='rough'?(r>.42?Math.round(135+110*r):0):(r>.30?Math.round(75+130*r):0);}
  x.putImageData(im,0,0);
 }
 if(kind==='speckle'){
  x.fillStyle='#000';
  for(let i=0;i<4800;i++){
   const r=.35+Math.pow(rnd(),2)*3.6;
   x.globalAlpha=.55+rnd()*.45;
   x.beginPath();x.arc(rnd()*256,rnd()*256,r,0,Math.PI*2);x.fill();
  }
  x.globalAlpha=1;
 }
 if(kind==='lines'){
  x.lineWidth=1.4;x.strokeStyle='#000';
  for(let i=-256;i<512;i+=8){x.beginPath();x.moveTo(i,0);x.lineTo(i+256,256);x.stroke();}
 }
 if(kind==='paper'){
  x.strokeStyle='#000';
  for(let i=0;i<3200;i++){x.globalAlpha=.2+rnd()*.7;x.lineWidth=.3+rnd()*.9;
   const a=rnd()*256,b=rnd()*256;x.beginPath();x.moveTo(a,b);x.lineTo(a+rnd()*9,b+rnd()*3);x.stroke();}
  x.globalAlpha=1;
 }
 tiles.set(kind,c);return c;
}
function geometry(ctx,l,fontStack){
 const size=clamp(l.fontSize||80,1,2000),lines=String(l.text??'').split('\n');
 const font=`${l.fontWeight||700} ${size}px ${fontStack(l.fontFamily)}`;
 ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';
 const step=size*1.12;
 const width=Math.max(20,...lines.map(s=>ctx.measureText(s).width));
 return {size,lines,font,step,width,height:lines.length*step};
}
export function drawTextTexture(ctx,l,fontStack){
 const {size,lines,font,step,width,height}=geometry(ctx,l,fontStack);
 const kind=Object.hasOwn(TEXT_TEXTURES,l.textTexture)?l.textTexture:'none';
 const amount=clamp(l.textNoise??.3,0,1);
 if(kind==='none'||amount<=0){lines.forEach((s,i)=>ctx.fillText(s,0,(i-(lines.length-1)/2)*step));return;}
 // Render only as large as needed, but cap memory for very large editable text.
 const max=4096, scale=Math.min(1,max/Math.max(width+size*.4,height+size*.4));
 const w=Math.max(1,Math.ceil((width+size*.4)*scale));
 const h=Math.max(1,Math.ceil((height+size*.4)*scale));
 // Cache source glyphs by typography; changing intensity does not rebuild them.
 const key=JSON.stringify([l.text,l.fontFamily,l.fontWeight,size,l.color,w,h,scale]);
 let base=glyphCache.get(key);
 if(!base){
  base=createCanvas(w,h);const b=base.getContext('2d');b.scale(scale,scale);
  b.font=font;b.textAlign='center';b.textBaseline='middle';b.fillStyle=l.color||'#ffffff';
  for(let i=0;i<lines.length;i++)b.fillText(lines[i],w/(2*scale),h/(2*scale)+(i-(lines.length-1)/2)*step);
  glyphCache.set(key,base);if(glyphCache.size>20)glyphCache.delete(glyphCache.keys().next().value);
 }
 const out=createCanvas(w,h),b=out.getContext('2d');b.drawImage(base,0,0);
 b.globalCompositeOperation='destination-out';
 b.globalAlpha=Math.min(1,amount*(kind==='grain'?.85:kind==='paper'?1:kind==='speckle'?1.85:1.2));
 const pat=b.createPattern(noiseTile(kind),'repeat');
 if(pat){b.fillStyle=pat;b.fillRect(0,0,w,h);}
 b.globalAlpha=1;b.globalCompositeOperation='source-over';
 ctx.drawImage(out,-w/(2*scale),-h/(2*scale),w/scale,h/scale);
}
export function textTextureInspector(l){return `<div class="section-title" style="margin-top:18px">TEXT TEXTURE & NOISE</div><label>Texture overlay<select id="textTexture">${Object.entries(TEXT_TEXTURES).map(([k,v])=>`<option value="${k}" ${k===(l.textTexture||'none')?'selected':''}>${v}</option>`).join('')}</select></label><label>Texture intensity <span id="textNoiseValue">${Math.round((l.textNoise??.3)*100)}%</span><input id="textNoise" type="range" min="0" max="100" step="1" value="${Math.round((l.textNoise??.3)*100)}"></label><p class="mini-label">Texture removes tiny areas of ink so the composition background shows through. Works with any text color. Select text and drag the ↘ corner handle to scale.</p>`;}
export function bindTextTextureInspector(l,{checkpoint,changed,draw}){
 document.getElementById('textTexture').onchange=e=>{checkpoint();l.textTexture=e.target.value;changed();};
 const s=document.getElementById('textNoise');
 // Record undo before editing, not after overwriting the previous value.
 s.onpointerdown=()=>checkpoint();
 s.oninput=e=>{document.getElementById('textNoiseValue').textContent=e.target.value+'%';l.textNoise=+e.target.value/100;draw();};
 s.onchange=e=>{l.textNoise=+e.target.value/100;changed();};
}
