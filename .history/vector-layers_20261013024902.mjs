// FrameFlow editable SVG vector layers. No external dependencies.
const TAGS = new Set(['svg','g','path','circle','rect','ellipse','line','polyline','polygon']);
const ATTRS = new Set(['d','cx','cy','r','rx','ry','x','y','x1','y1','x2','y2','width','height','points','transform','viewBox','stroke-linejoin','stroke-linecap','fill-rule']);
const validColor = x => /^#[0-9a-f]{6}$/i.test(x || '');
const cache = new Map();
const esc = x => String(x).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
export function sanitizeSvg(input) {
  if (typeof input !== 'string' || input.length > 180000) throw Error('SVG must be smaller than 180 KB.');
  const doc = new DOMParser().parseFromString(input, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw Error('Invalid SVG document');
  let vb = (root.getAttribute('viewBox') || '').trim();
  const nums = vb.split(/[\s,]+/).map(Number);
  if (nums.length !== 4 || nums.some(x => !Number.isFinite(x)) || nums[2] <= 0 || nums[3] <= 0) {
    const w = parseFloat(root.getAttribute('width')) || 100, h = parseFloat(root.getAttribute('height')) || 100;
    vb = `0 0 ${Math.max(1, Math.min(10000,w))} ${Math.max(1,Math.min(10000,h))}`;
  }
  let count = 0;
  function clean(el) {
    if (!TAGS.has(el.localName) || ++count > 350) return '';
    const attrs = [...el.attributes].filter(a=>ATTRS.has(a.name) && a.value.length < 16000 && !/url\s*\(|javascript\s*:|data\s*:/i.test(a.value))
      .map(a=>` ${a.name}="${esc(a.value)}"`).join('');
    return `<${el.localName}${attrs}>${[...el.children].map(clean).join('')}</${el.localName}>`;
  }
  const children = [...root.children].map(clean).join('');
  if (!children) throw Error('This SVG has no supported vector shapes.');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${esc(vb)}">${children}</svg>`;
}
function prepared(layer) {
  const key = [layer.svgMarkup,layer.vectorFill,layer.vectorStroke,layer.vectorStrokeWidth].join('|');
  if (cache.has(key)) return cache.get(key);
  const dom = new DOMParser().parseFromString(layer.svgMarkup, 'image/svg+xml');
  const root = dom.documentElement;
  const vb = (root.getAttribute('viewBox')||'0 0 100 100').split(/[\s,]+/).map(Number);
  const fill = validColor(layer.vectorFill) ? layer.vectorFill : '#b6f36e';
  const stroke = validColor(layer.vectorStroke) ? layer.vectorStroke : '#ffffff';
  const width = Math.max(0,Math.min(80,+layer.vectorStrokeWidth||0));
  root.setAttribute('fill',fill);root.setAttribute('stroke',stroke);root.setAttribute('stroke-width',String(width));
  const paths=[...root.querySelectorAll('path')].filter(p=>p.getAttribute('d'));
  const pathInfo=paths.map(p=>{try {return {d:p.getAttribute('d'),length:p.getTotalLength(),el:p};}catch{return null}}).filter(Boolean);
  const svg = new XMLSerializer().serializeToString(root);
  const image=new Image();const uri='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
  const item={image,vb,pathInfo};cache.set(key,item);
  image.onload=()=>window.dispatchEvent(new Event('ff-vector-loaded'));
  image.src=uri;
  if (cache.size>80) cache.delete(cache.keys().next().value);
  return item;
}
function progress(layer,frame){
  const dur=Math.max(1,+layer.vectorDuration||40);
  return Math.max(0,Math.min(1,(frame-(layer.vectorStart??layer.in))/dur));
}
export function drawVector(ctx,layer,frame,w,h){
  if (!layer.svgMarkup) return;
  const {image,vb,pathInfo}=prepared(layer), [minX,minY,sw,sh]=vb;
  if(!sw||!sh)return;
  ctx.save();ctx.translate(-w/2,-h/2);ctx.scale(w/sw,h/sh);ctx.translate(-minX,-minY);
  const active=layer.vectorDraw && pathInfo.length;
  const t=(active||layer.vectorPin)?progress(layer,frame):1;
  if(!active || t>=1){if(image.complete&&image.naturalWidth)ctx.drawImage(image,minX,minY,sw,sh);}
  else {
    ctx.strokeStyle=layer.vectorStroke||'#ffffff';ctx.lineWidth=Math.max(1,+layer.vectorStrokeWidth||1);
    ctx.lineCap='round';ctx.lineJoin='round';
    for(const {d,length} of pathInfo){if(!(length>0))continue;
      ctx.setLineDash([length*t,length+1]);ctx.stroke(new Path2D(d));}
    ctx.setLineDash([]);
  }
  if(layer.vectorPin && pathInfo.length){
    let total=pathInfo.reduce((sum,p)=>sum+p.length,0), traveled=total*t,point=null;
    for(const p of pathInfo){if(traveled<=p.length){point=p.el.getPointAtLength(Math.max(0,traveled));break;}traveled-=p.length;}
    if(!point){const p=pathInfo.at(-1);point=p.el.getPointAtLength(p.length);}
    const radius=Math.max(2,Number(layer.vectorPinSize)||6);
    ctx.beginPath();ctx.fillStyle=validColor(layer.vectorPinColor)?layer.vectorPinColor:'#ef476f';
    ctx.arc(point.x,point.y,radius,0,2*Math.PI);ctx.fill();
    ctx.lineWidth=Math.max(1,radius*.25);ctx.strokeStyle='#fff';ctx.stroke();
  }
  ctx.restore();
}
export function vectorInspector(layer){
 const color=(name,id,value)=>`<label>${name}<input type="color" data-vector="${id}" value="${validColor(value)?value:'#ffffff'}"></label>`;
 return `<div class="section-title" style="margin-top:14px">SVG / VECTOR</div>
 <p class="mini-label">Scalable SVG layer · fill, stroke, path drawing and moving pinpoint</p>
 <div class="two">${color('Fill','vectorFill',layer.vectorFill)}${color('Stroke','vectorStroke',layer.vectorStroke)}</div>
 <label>Stroke width<input type="number" data-vector="vectorStrokeWidth" min="0" max="80" step="1" value="${layer.vectorStrokeWidth??5}"></label>
 <label class="m-chk"><input type="checkbox" data-vector="vectorDraw" ${layer.vectorDraw?'checked':''}> Draw path over time</label>
 <div class="two"><label>Start (seconds)<input type="number" data-vector="vectorStart" min="0" step=".033" value="${((layer.vectorStart??layer.in)/window.ffVectorFps).toFixed(2)}"></label>
 <label>Duration (seconds)<input type="number" data-vector="vectorDuration" min=".033" step=".033" value="${((layer.vectorDuration||40)/window.ffVectorFps).toFixed(2)}"></label></div>
 <label class="m-chk"><input type="checkbox" data-vector="vectorPin" ${layer.vectorPin?'checked':''}> Pinpoint follows path</label>
 <div class="two">${color('Pinpoint color','vectorPinColor',layer.vectorPinColor)}<label>Pin size<input type="number" data-vector="vectorPinSize" min="2" max="30" value="${layer.vectorPinSize||6}"></label></div>
 <p class="mini-label">Path tracing and pinpoint travel use the SVG's path geometry. Imported SVG shapes without paths remain static.</p>`;
}
export function bindVectorInspector(layer,commit,fps){
 window.ffVectorFps=fps;
 document.querySelectorAll('[data-vector]').forEach(el=>{
  el.onchange=()=>{
   const name=el.dataset.vector;
   let value=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;
   if(['vectorStart','vectorDuration'].includes(name))value=Math.round(value*fps);
   if(typeof value==='number'&&!Number.isFinite(value))return;
   commit(layer,name,value);
  };
 });
}
export function validateVector(layer){
 if(typeof layer.svgMarkup!=='string'||layer.svgMarkup.length>180000||!/^<svg\b/.test(layer.svgMarkup))throw Error('Invalid vector SVG');
 for(const key of ['vectorFill','vectorStroke','vectorPinColor'])if(layer[key]!==undefined&&!validColor(layer[key]))throw Error('Invalid SVG color');
 for(const key of ['vectorStrokeWidth','vectorStart','vectorDuration','vectorPinSize'])if(layer[key]!==undefined&&(!Number.isFinite(layer[key])||layer[key]<0||layer[key]>1800))throw Error('Invalid SVG setting');
}

export async function preloadVectors(scene){
 const waits=[];for(const layer of scene.layers||[]){if(layer.type!=='vector')continue;const im=prepared(layer).image;
 if(!im.complete||!im.naturalWidth)waits.push(im.decode());}
 await Promise.all(waits);
}
