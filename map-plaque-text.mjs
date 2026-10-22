import { fontStack } from './fonts.mjs';

export function plaqueStyle(a) {
  return {font:a.plaqueFont||'Georgia',size:a.plaqueSize??(a.glyph==='banner'?6.5:7.8),weight:a.plaqueWeight??700,italic:a.plaqueItalic??false,color:a.plaqueColor||(a.glyph==='banner'?'#242323':'#fff0d5'),fit:a.plaqueFit!==false};
}
// Size is measured at object scale 1. Automatic fitting can be disabled to
// retain a precise size; overflowing text is clipped to its plaque or ribbon.
export function drawPlaqueText(c,s,a,text,x,y,width,height,wrap=false) {
  const st=plaqueStyle(a);let fs=st.size*s/26;
  const font=()=>{c.font=`${st.italic?'italic ':''}${st.weight} ${fs}px ${fontStack(st.font)}`;};
  c.save();c.beginPath();c.rect(x-width/2,y-height/2,width,height);c.clip();
  c.fillStyle=st.color;c.textAlign='center';c.textBaseline='middle';font();
  const lines=[''];
  for(const word of String(text).trim().split(/\s+/)){
    const i=lines.length-1,next=(lines[i]+' '+word).trim();
    if(wrap&&i===0&&lines[i]&&c.measureText(next).width>width)lines.push(word);else lines[i]=next;
  }
  if(st.fit){fs*=Math.min(1,width/Math.max(1,...lines.map(l=>c.measureText(l).width)),height/(fs*1.15*lines.length));font();}
  lines.forEach((line,i)=>c.fillText(line,x,y+(i-(lines.length-1)/2)*fs*1.15));
  c.restore();
}
export function validatePlaqueStyle(a) {
  const bad=()=>{throw Error('Invalid plaque text style.');};
  if(a.plaqueFont!==undefined&&(typeof a.plaqueFont!=='string'||!a.plaqueFont.trim()||a.plaqueFont.length>60||/["'\\;{}<>\r\n]/.test(a.plaqueFont)))bad();
  if(a.plaqueSize!==undefined&&(!Number.isFinite(a.plaqueSize)||a.plaqueSize<4||a.plaqueSize>48))bad();
  if(a.plaqueWeight!==undefined&&![400,500,600,700,800,900].includes(a.plaqueWeight))bad();
  for(const key of ['plaqueItalic','plaqueFit'])if(a[key]!==undefined&&typeof a[key]!=='boolean')bad();
  if(a.plaqueColor!==undefined&&!/^#[0-9a-f]{6}$/i.test(a.plaqueColor))bad();
}
