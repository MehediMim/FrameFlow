// Deterministic, frame-accurate shape textures and reveal masks.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,Number(v)||0));
const styles={none:'None',grain:'Film grain',speckles:'Ink speckles',dots:'Vector dots',hatch:'Diagonal lines',cross:'Crosshatch',stripes:'Stripes',grid:'Vector grid',checker:'Checkerboard',abstract:'Abstract blotches',brush:'Brush strokes'};
const reveals={none:'None',left:'Left → Right',right:'Right → Left',top:'Top → Bottom',bottom:'Bottom → Top',center:'Center outward',centerH:'Middle → Sides',centerV:'Middle → Top / Bottom'};
const defaults={texture:'none',textureColor:'#ffffff',strength:.35,spacing:16,thickness:2,reveal:'none',revealDuration:1,revealDelay:0,revealEase:'easeInOut'};
const prepared=l=>({...defaults,...(l.shapeStyle||{})});
const smooth=t=>t*t*(3-2*t);
function progress(s,l,frame,fps){let t=clamp((frame-l.in-s.revealDelay*fps)/Math.max(1,s.revealDuration*fps),0,1);return s.revealEase==='linear'?t:s.revealEase==='easeIn'?t*t*t:s.revealEase==='easeOut'?1-(1-t)**3:smooth(t)}
function seed(x){let v=x|0;v=Math.imul(v^(v>>>16),0x7feb352d);v=Math.imul(v^(v>>>15),0x846ca68b);return ((v^(v>>>16))>>>0)/4294967296}
// Deterministic art textures (seeded by position, so every frame and export matches).
function drawArtTexture(ctx,kind,w,h,step,line,color){
 const base=ctx.globalAlpha,area=w*h,hex=/^#[0-9a-f]{6}$/i.test(color)?color:'#ffffff';
 if(kind==='abstract'){
  const blobs=Math.round(clamp(area/(step*step*4),3,70));
  for(let i=0;i<blobs;i++){
   const n=seed(i*131+7),x=-w/2+seed(i*977+13)*w,y=-h/2+seed(i*571+29)*h,r=step*(1.2+seed(i*313+3)*3.6);
   const g=ctx.createRadialGradient(x,y,0,x,y,r);g.addColorStop(0,hex);g.addColorStop(1,hex+'00');
   ctx.globalAlpha=base*(.25+.75*n);ctx.fillStyle=g;ctx.fillRect(x-r,y-r,r*2,r*2);
  }
  ctx.strokeStyle=hex;ctx.lineWidth=Math.max(.5,line*.5);
  for(let i=0;i<Math.round(blobs/3);i++){
   const x=-w/2+seed(i*811+5)*w,y=-h/2+seed(i*433+17)*h,r=step*(.8+seed(i*199+11)*2.4),a=seed(i*61+1)*6.28;
   ctx.globalAlpha=base*(.35+.5*seed(i*17+9));ctx.beginPath();ctx.arc(x,y,r,a,a+1+seed(i*23+4)*3);ctx.stroke();
  }
  ctx.globalAlpha=base;return;
 }
 const strokes=Math.round(clamp(area/(step*step*1.5),4,160));ctx.strokeStyle=hex;ctx.lineCap='round';
 for(let i=0;i<strokes;i++){
  const x=-w/2+seed(i*977+13)*w,y=-h/2+seed(i*571+29)*h,len=step*(3+seed(i*313+3)*6),ang=(seed(i*131+7)-.5)*.5-.3,nb=3+Math.floor(seed(i*61+1)*6);
  ctx.save();ctx.translate(x,y);ctx.rotate(ang);
  for(let b=0;b<nb;b++){
   const k=i*53+b*7,off=(b-nb/2)*line*.75,start=seed(k+1)*len*.15,l=len*(.55+seed(k+2)*.45);
   ctx.globalAlpha=base*(.25+.75*seed(k+3));ctx.lineWidth=Math.max(.5,line*(.4+seed(k+4)*.5));
   ctx.beginPath();ctx.moveTo(start,off);ctx.lineTo(start+l,off+(seed(k+5)-.5)*line);ctx.stroke();
  }
  ctx.restore();
 }
 ctx.globalAlpha=base;
}
export function drawShape(ctx,l,frame,fps){const s=prepared(l),w=Math.max(1,l.w),h=Math.max(1,l.h),rad=Math.min(Math.max(0,l.radius||0),w/2,h/2);ctx.save();
 // Reveal is a clipping mask in local shape coordinates. It never deforms or scales the shape.
 if(s.reveal!=='none') {const p=progress(s,l,frame,fps);if(p<=0){ctx.restore();return;}ctx.beginPath();switch(s.reveal){case 'left':ctx.rect(-w/2,-h/2,w*p,h);break;case 'right':ctx.rect(w/2-w*p,-h/2,w*p,h);break;case 'top':ctx.rect(-w/2,-h/2,w,h*p);break;case 'bottom':ctx.rect(-w/2,h/2-h*p,w,h*p);break;case 'center':{const r=Math.hypot(w,h)*p/2;ctx.arc(0,0,r,0,Math.PI*2);break;}case 'centerH':ctx.rect(-w*p/2,-h/2,w*p,h);break;case 'centerV':ctx.rect(-w/2,-h*p/2,w,h*p);break;}ctx.clip();}
 ctx.beginPath();if(l.type==='circle')ctx.ellipse(0,0,w/2,h/2,0,0,Math.PI*2);else ctx.roundRect(-w/2,-h/2,w,h,rad);ctx.fillStyle=l.color;ctx.fill();ctx.clip();
 if(s.texture!=='none'&&s.strength>0){const step=clamp(s.spacing,3,120),line=clamp(s.thickness,.5,20);ctx.save();ctx.globalAlpha*=clamp(s.strength,0,1);ctx.fillStyle=ctx.strokeStyle=s.textureColor;ctx.lineWidth=line;
 if(s.texture==='grain'||s.texture==='speckles'){const cell=s.texture==='grain'?Math.max(3,step/3):Math.max(5,step/2);for(let y=-h/2;y<h/2;y+=cell)for(let x=-w/2;x<w/2;x+=cell){const n=seed(Math.round(x*13+y*971)+ 173);if(n>(s.texture==='grain'?.45:.82)){const rx=x+seed(Math.round(x*43+y*17))*cell,ry=y+seed(Math.round(x*29+y*71))*cell;ctx.beginPath();ctx.arc(rx,ry,Math.max(.5,line*(s.texture==='grain'?.35:1)*(.4+n)),0,Math.PI*2);ctx.fill();}}}
 else if(s.texture==='dots'){for(let y=-h/2;y<h/2+step;y+=step)for(let x=-w/2;x<w/2+step;x+=step){ctx.beginPath();ctx.arc(x,y,line,0,Math.PI*2);ctx.fill();}}
 else if(s.texture==='abstract'||s.texture==='brush')drawArtTexture(ctx,s.texture,w,h,step,line,s.textureColor);
 else if(s.texture==='checker'){for(let row=0,y=-h/2;y<h/2;y+=step,row++)for(let col=0,x=-w/2;x<w/2;x+=step,col++)if((row+col)%2===0)ctx.fillRect(x,y,step,step);}
 else {ctx.beginPath();if(['hatch','cross'].includes(s.texture)){for(let x=-h-w;x<h+w;x+=step){ctx.moveTo(x,-h/2);ctx.lineTo(x+h,h/2);}if(s.texture==='cross')for(let x=-h-w;x<h+w;x+=step){ctx.moveTo(x,h/2);ctx.lineTo(x+h,-h/2);}}
 if(['stripes','grid'].includes(s.texture))for(let x=-w/2;x<w/2+step;x+=step){ctx.moveTo(x,-h/2);ctx.lineTo(x,h/2);}if(s.texture==='grid')for(let y=-h/2;y<h/2+step;y+=step){ctx.moveTo(-w/2,y);ctx.lineTo(w/2,y);}ctx.stroke();}ctx.restore();}ctx.restore();}
export function shapeInspector(l){const s=prepared(l),opts=(choices,val)=>Object.entries(choices).map(([k,v])=>`<option value="${k}" ${k===val?'selected':''}>${v}</option>`).join('');return `<div class="section-title" style="margin-top:18px">SHAPE TEXTURE & REVEAL</div><label>Texture pattern<select data-shape="texture">${opts(styles,s.texture)}</select></label><label>Texture color<input type="color" data-shape="textureColor" value="${s.textureColor}"></label><label>Texture strength <span id="shape-strength-label">${Math.round(s.strength*100)}%</span><input type="range" min="0" max="100" data-shape="strength" value="${Math.round(s.strength*100)}"></label><div class="two"><label>Pattern spacing<input type="number" min="3" max="120" data-shape="spacing" value="${s.spacing}"></label><label>Line / dot size<input type="number" min="0.5" max="20" step="0.5" data-shape="thickness" value="${s.thickness}"></label></div><div class="section-title" style="margin-top:18px">REVEAL DIRECTION</div><label>Reveal mask<select data-shape="reveal">${opts(reveals,s.reveal)}</select></label><div class="two"><label>Duration (seconds)<input type="number" min="0.03" max="60" step="0.1" data-shape="revealDuration" value="${s.revealDuration}"></label><label>Delay (seconds)<input type="number" min="0" max="60" step="0.1" data-shape="revealDelay" value="${s.revealDelay}"></label></div><label>Easing<select data-shape="revealEase">${opts({linear:'Linear',easeIn:'Ease in',easeOut:'Ease out',easeInOut:'Ease in & out'},s.revealEase)}</select></label><p class="mini-label">Reveal starts at the layer’s In time. Texture is clipped to the shape and rendered in PNG/video exports.</p>`;}
export function bindShapeInspector(l,{checkpoint,changed}){document.querySelectorAll('[data-shape]').forEach(el=>{const key=el.dataset.shape;const update=()=>{checkpoint();l.shapeStyle||={...defaults};let v=el.value;if(key==='strength')v=+v/100;else if(['spacing','thickness','revealDuration','revealDelay'].includes(key))v=+v;l.shapeStyle[key]=v;changed();};el.addEventListener('change',update);if(key==='strength')el.addEventListener('input',()=>{const label=document.getElementById('shape-strength-label');if(label)label.textContent=el.value+'%';});});}
