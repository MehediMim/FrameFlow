// FrameFlow Motion Studio — textured text. Deterministic textures are punched out
// of the glyph alpha, revealing the real composition background through the ink.
const clamp = (n,a,b) => Math.max(a,Math.min(b,Number(n)||0));
export const TEXT_TEXTURES = {none:'None',grain:'Fine noise',rough:'Rough grain',speckle:'Ink speckles',lines:'Hatched lines',paper:'Paper fibers',vectorHatch:'Vector · diagonal hatch',vectorCross:'Vector · crosshatch',vectorDots:'Vector · halftone dots',vectorStripes:'Vector · parallel stripes',vectorGrid:'Vector · grid',vectorChevrons:'Vector · chevrons'};
const TILE_SIZE=256, tiles=new Map(), glyphCache=new Map();
const VECTOR_TYPES=new Set(['vectorHatch','vectorCross','vectorDots','vectorStripes','vectorGrid','vectorChevrons']);
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
// Vector patterns are rendered as paths, not raster noise. Spacing and stroke width
// are measured in composition pixels; they stay sharp when the text is scaled.
function drawVectorPattern(ctx,kind,w,h,spacing,weight,color="#000"){
 const step=Math.max(3,spacing),lw=Math.max(.5,weight);
 ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineWidth=lw;
 const stroke=(x1,y1,x2,y2)=>{ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);};
 if(kind==='vectorDots'){
  const radius=Math.max(.6,lw*.72);
  ctx.beginPath();for(let y=step/2;y<h;y+=step)for(let x=step/2;x<w;x+=step){ctx.moveTo(x+radius,y);ctx.arc(x,y,radius,0,Math.PI*2);}ctx.fill();return;
 }
 ctx.beginPath();
 if(kind==='vectorStripes'||kind==='vectorGrid')for(let x=0;x<=w+step;x+=step)stroke(x,0,x,h);
 if(kind==='vectorGrid')for(let y=0;y<=h+step;y+=step)stroke(0,y,w,y);
 if(kind==='vectorHatch'||kind==='vectorCross'){
  for(let x=-h;x<w+h;x+=step)stroke(x,0,x+h,h);
  if(kind==='vectorCross')for(let x=0;x<w+h*2;x+=step)stroke(x,0,x-h,h);
 }
 if(kind==='vectorChevrons')for(let y=-step;y<h+step;y+=step)for(let x=-step;x<w+step;x+=step*2){stroke(x,y,x+step,y+step);stroke(x+step,y+step,x+step*2,y);}
 ctx.stroke();
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
 const strokeWidth=clamp(l.textStrokeWidth??0,0,60);
 const strokeColor=l.textStrokeColor||'#111111';
 const shadow=l.textShadowEnabled===true,extrude=l.textFullShadow===true;
 const shadowColor=l.textShadowColor||'#000000';
 const dx=clamp(l.textShadowX??12,-150,150),dy=clamp(l.textShadowY??12,-150,150);
 const blur=clamp(l.textShadowBlur??16,0,100),depth=clamp(l.textFullShadowDepth??18,0,120);
 const mirror=l.textMirror===true;
 // Include stroke, shadow and reflection in the temporary render bounds.
 const pad=size*.3+strokeWidth+Math.max(Math.abs(dx),Math.abs(dy))+depth+blur*2+10;
 const rawW=width+pad*2,rawH=height+pad*2;
 const scale=Math.min(1,4096/Math.max(rawW,rawH));
 const w=Math.max(1,Math.ceil(rawW*scale)),h=Math.max(1,Math.ceil(rawH*scale));
 const base=createCanvas(w,h),b=base.getContext('2d');
 b.scale(scale,scale);b.font=font;b.textAlign='center';b.textBaseline='middle';
 const cx=rawW/2,cy=rawH/2;
 const drawLines=(c,mode)=>lines.forEach((txt,i)=>{const y=cy+(i-(lines.length-1)/2)*step;if(mode==='stroke')c.strokeText(txt,cx,y);else c.fillText(txt,cx,y);});
 b.fillStyle=l.color||'#ffffff';drawLines(b,'fill');
 if(kind!=='none'&&amount>0){
  const pattern=createCanvas(w,h),t=pattern.getContext('2d');
  if(VECTOR_TYPES.has(kind)){
   t.scale(scale,scale);t.globalAlpha=amount;
   drawVectorPattern(t,kind,rawW,rawH,clamp(l.vectorTextureSpacing??13,4,90),clamp(l.vectorTextureWidth??2.4,.5,15),l.vectorTextureColor||'#ffffff');
  }else{
   t.globalAlpha=clamp(amount*(kind==='grain'?.85:kind==='paper'?1:kind==='speckle'?1.85:1.2),0,1);
   const pat=t.createPattern(noiseTile(kind),'repeat');if(pat){t.fillStyle=pat;t.fillRect(0,0,w,h);}
  }
  // Preserve the base text color; paint vectors over the text rather than erasing its ink.
  b.save();b.setTransform(1,0,0,1,0,0);b.globalCompositeOperation=VECTOR_TYPES.has(kind)?'source-atop':'destination-out';b.drawImage(pattern,0,0);b.restore();
 }
 if(strokeWidth>0){b.strokeStyle=strokeColor;b.lineWidth=strokeWidth;b.lineJoin='round';drawLines(b,'stroke');}
 const rendered=createCanvas(w,h),r=rendered.getContext('2d');
 // Shadow is composited behind the finished glyphs, not on top of the texture.
 if(extrude&&depth>0){
  r.save();r.scale(scale,scale);r.font=font;r.textAlign='center';r.textBaseline='middle';
  r.fillStyle=shadowColor;r.strokeStyle=shadowColor;r.lineWidth=Math.max(1,strokeWidth);
  const count=Math.max(1,Math.ceil(depth/2));
  for(let i=count;i>=1;i--){const t=i/count;r.save();r.translate(dx*t,dy*t);drawLines(r,'fill');if(strokeWidth>0)drawLines(r,'stroke');r.restore();}
  r.restore();
 }
 if(shadow){r.save();r.shadowColor=shadowColor;r.shadowBlur=blur*scale;r.shadowOffsetX=dx*scale;r.shadowOffsetY=dy*scale;r.drawImage(base,0,0);r.restore();}
 r.drawImage(base,0,0);
 ctx.drawImage(rendered,-rawW/2,-rawH/2,rawW,rawH);
 if(mirror){
  const gap=clamp(l.textMirrorGap??12,0,120),strength=clamp(l.textMirrorOpacity??.35,0,1);
  const reflectionTop=height/2+gap,reflectionHeight=Math.max(1,height);
  ctx.save();ctx.beginPath();ctx.rect(-rawW/2,reflectionTop,rawW,reflectionHeight);ctx.clip();
  // Reflect around the original glyph bounding box's bottom edge.
  ctx.translate(0,height+gap);ctx.scale(1,-1);ctx.globalAlpha*=strength;
  ctx.drawImage(rendered,-rawW/2,-rawH/2,rawW,rawH);ctx.restore();
  // Fade reflection away from the baseline using destination-out on a bounded mask
  // would erase underlying scene pixels, so use a separate translucent overlay only.
 }
}
export function textTextureInspector(l){
 const kind=l.textTexture||'none';
 const color=(id,label,value)=>`<label>${label}<input id="${id}" type="color" value="${value}"></label>`;
 const check=(id,label,value)=>`<label class="m-chk"><input id="${id}" type="checkbox" ${value?'checked':''}> ${label}</label>`;
 const slider=(id,label,value,min,max,step=1)=>`<label>${label} <span id="${id}Value">${value}</span><input id="${id}" type="range" min="${min}" max="${max}" step="${step}" value="${value}"></label>`;
 return `<div class="section-title" style="margin-top:18px">TEXT TEXTURE & NOISE</div>
 <label>Texture overlay<select id="textTexture">${Object.entries(TEXT_TEXTURES).map(([k,v])=>`<option value="${k}" ${k===kind?'selected':''}>${v}</option>`).join('')}</select></label>
 ${slider('textNoise','Texture intensity (%)',Math.round((l.textNoise??.3)*100),0,100)}
 <div id="vectorTextureOptions" style="display:${VECTOR_TYPES.has(kind)?'block':'none'}">
 ${color('vectorTextureColor','Vector pattern color',l.vectorTextureColor||'#ffffff')}
 ${slider('vectorTextureSpacing','Vector spacing (px)',l.vectorTextureSpacing??13,4,90)}
 ${slider('vectorTextureWidth','Vector line / dot width (px)',l.vectorTextureWidth??2.4,.5,15,.5)}
 </div>
 <div class="section-title" style="margin-top:18px">TEXT OUTLINE & EFFECTS</div>
 <div class="two">${color('textStrokeColor','Stroke color',l.textStrokeColor||'#111111')}${slider('textStrokeWidth','Stroke width',l.textStrokeWidth??0,0,60)}</div>
 ${check('textShadowEnabled','Soft shadow',l.textShadowEnabled)}
 ${check('textFullShadow','Full shadow / solid extrusion',l.textFullShadow)}
 ${color('textShadowColor','Shadow color',l.textShadowColor||'#000000')}
 <div class="two">${slider('textShadowX','Shadow X',l.textShadowX??12,-150,150)}${slider('textShadowY','Shadow Y',l.textShadowY??12,-150,150)}</div>
 <div class="two">${slider('textShadowBlur','Shadow blur',l.textShadowBlur??16,0,100)}${slider('textFullShadowDepth','Extrusion depth',l.textFullShadowDepth??18,0,120)}</div>
 ${check('textMirror','Mirror / reflection',l.textMirror)}
 <div class="two">${slider('textMirrorGap','Mirror gap',l.textMirrorGap??12,0,120)}${slider('textMirrorOpacity','Mirror opacity (%)',Math.round((l.textMirrorOpacity??.35)*100),0,100)}</div>
 <p class="mini-label">Vector textures overlay the fill color. Noise wears away the ink. Stroke, shadows and reflection are applied in the same layer.</p>`;
}
export function bindTextTextureInspector(l,{checkpoint,changed,draw}){
 const select=document.getElementById('textTexture');if(select)select.onchange=e=>{checkpoint();l.textTexture=e.target.value;changed();};
 for(const [id,field] of [['vectorTextureColor','vectorTextureColor'],['textStrokeColor','textStrokeColor'],['textShadowColor','textShadowColor']]){
  const el=document.getElementById(id);if(el)el.onchange=e=>{checkpoint();l[field]=e.target.value;changed();};
 }
 for(const id of ['textShadowEnabled','textFullShadow','textMirror']){const el=document.getElementById(id);if(el)el.onchange=e=>{checkpoint();l[id]=e.target.checked;changed();};}
 const ranges={textNoise:['textNoise',v=>v/100,v=>Math.round(v*100)],vectorTextureSpacing:['vectorTextureSpacing',Number],vectorTextureWidth:['vectorTextureWidth',Number],textStrokeWidth:['textStrokeWidth',Number],textShadowX:['textShadowX',Number],textShadowY:['textShadowY',Number],textShadowBlur:['textShadowBlur',Number],textFullShadowDepth:['textFullShadowDepth',Number],textMirrorGap:['textMirrorGap',Number],textMirrorOpacity:['textMirrorOpacity',v=>v/100,v=>Math.round(v*100)]};
 for(const [id,[field,conv,display]] of Object.entries(ranges)){
  const el=document.getElementById(id);if(!el)continue;
  el.onpointerdown=()=>checkpoint();el.oninput=e=>{l[field]=conv(+e.target.value);document.getElementById(id+'Value').textContent=display?display(l[field]):String(l[field]);draw();};
  el.onchange=e=>{l[field]=conv(+e.target.value);changed();};
 }
}
