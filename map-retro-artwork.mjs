import { drawPlaqueText } from './map-plaque-text.mjs';

// Front-facing cartographic markers. Fine surface detail is deterministic and
// uses the same bounded raster cache as the rest of the object illustrations.
function gradient(c,x,y,w,h,colors){
  const g=c.createLinearGradient(x,y,x+w,y+h);colors.forEach((color,i)=>g.addColorStop(i/(colors.length-1),color));return g;
}
function grain(c,x,y,w,h,count=80){
  c.save();
  for(let i=0;i<count;i++){
    const px=((i*73+19)%257)/257,py=((i*137+31)%251)/251;
    c.fillStyle=i%3?'#251b1315':'#fff5cf22';c.fillRect(x+px*w,y+py*h,.009+(i%4)*.004,.005+(i%3)*.006);
  }
  c.restore();
}
function wood(c,x,y,w,h,color='#554332',vertical=false){
  c.fillStyle=gradient(c,x,y,vertical?w:0,vertical?0:h,['#1e1b17',color,'#a18a65',color,'#29241d']);c.fillRect(x,y,w,h);
  c.lineWidth=.012;
  for(let i=1;i<7;i++){
    const f=i/7;c.strokeStyle=i%2?'#160f0e55':'#e2c89b38';c.beginPath();
    if(vertical){c.moveTo(x+w*f,y+.03);c.bezierCurveTo(x+w*f-.02,y+h*.3,x+w*f+.018,y+h*.6,x+w*f,y+h-.03);}
    else{c.moveTo(x+.03,y+h*f);c.bezierCurveTo(x+w*.3,y+h*f-.018,x+w*.7,y+h*f+.013,x+w-.03,y+h*f);}
    c.stroke();
  }
  c.strokeStyle='#17130ec0';c.lineWidth=.018;c.strokeRect(x,y,w,h);
}
function nail(c,x,y){
  c.fillStyle='#26201a';c.beginPath();c.arc(x+.008,y+.01,.034,0,Math.PI*2);c.fill();
  c.fillStyle='#b19a70';c.beginPath();c.arc(x,y,.025,0,Math.PI*2);c.fill();
  c.strokeStyle='#403526';c.lineWidth=.009;c.beginPath();c.moveTo(x-.014,y);c.lineTo(x+.014,y);c.stroke();
}
function plaque(c,a,title,width=2.9,y=-5.25){
  c.fillStyle=gradient(c,-width/2,y,0,.78,['#b9b3a0','#eee9d7','#d4cfbc']);c.fillRect(-width/2,y,width,.78);
  grain(c,-width/2,y,width,.78,100);
  c.strokeStyle='#3b362a';c.lineWidth=.035;c.strokeRect(-width/2+.055,y+.045,width-.11,.69);
  wood(c,-width/2-.15,y-.12,width+.3,.16,a.bannerPoleColor||'#584a37');
  wood(c,-width/2-.2,y+.76,width+.4,.17,a.bannerPoleColor||'#584a37');
  for(const x of [-width/2+.08,width/2-.08]){nail(c,x,y-.04);nail(c,x,y+.84);}
  drawPlaqueText(c,26,a,String(title||'').toUpperCase(),0,y+.38,width-.24,.61,true);
}
function portrait(c,a,color,image,shadowScale){
  const left=-1.2,top=-4.25,w=2.4,h=3.1;
  c.save();c.shadowColor='#0009';c.shadowBlur=.15*shadowScale;c.shadowOffsetX=.045*shadowScale;c.shadowOffsetY=.065*shadowScale;
  wood(c,-.085,-5.7,.17,5.72,'#51412f',true);c.shadowColor='transparent';
  c.fillStyle='#171816';c.fillRect(left-.14,top-.14,w+.28,h+.28);
  c.save();c.beginPath();c.rect(left,top,w,h);c.clip();
  c.fillStyle=color||'#504b3e';c.fillRect(left,top,w,h);
  if(image){
    const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height,k=Math.max(w/iw,h/ih)*(a.badgeZoom??1),W=iw*k,H=ih*k;
    c.filter='sepia(.22) saturate(.82)';c.drawImage(image,left+(w-W)/2-(a.badgeX??0)/100*(W-w)/2,top+(h-H)/2-(a.badgeY??0)/100*(H-h)/2,W,H);c.filter='none';
  }else{
    c.fillStyle='#aaa38b';c.beginPath();c.ellipse(0,top+1.15,.43,.57,0,0,Math.PI*2);c.fill();
    c.fillStyle='#343a35';c.beginPath();c.moveTo(-1,top+h);c.lineTo(-.75,top+2.14);c.quadraticCurveTo(0,top+1.55,.75,top+2.14);c.lineTo(1,top+h);c.fill();
    c.fillStyle='#e2d9b8';c.beginPath();c.moveTo(-.21,top+1.83);c.lineTo(.25,top+1.83);c.lineTo(.43,top+h);c.lineTo(.13,top+h);c.fill();
  }
  c.fillStyle=gradient(c,left,top,w,h,['#e6ce8b15','#00000000','#17130f70']);c.fillRect(left,top,w,h);grain(c,left,top,w,h,120);c.restore();
  const frame=a.badgeBorder||'#4c4032';
  wood(c,left-.14,top-.14,w+.28,.14,frame);wood(c,left-.14,top+h,w+.28,.15,frame);
  wood(c,left-.14,top,.14,h,frame,true);wood(c,left+w,top,.14,h,frame,true);
  c.strokeStyle='#d5c79a70';c.lineWidth=.018;c.strokeRect(left-.025,top-.025,w+.05,h+.05);
  for(const x of [left-.065,left+w+.065])for(const y of [top-.065,top+h+.075])nail(c,x,y);
  if(a.showLabel!==false)plaque(c,a,a.label||'Portrait');
  c.restore();
}
function cloth(c,glyph,a,color,t,image,shadowScale){
  const banner=glyph==='banner',h=banner?2.8:1.65,w=h*(a.bannerAspect??(banner?.75:1.5)),top=banner?-4.15:-4.4,left=-w/2;
  const pole=banner?0:left-.17,woodColor=a.bannerPoleColor||'#65503a';
  if(a.bannerPole!==false)wood(c,pole-.055,-5.55,.11,5.56,woodColor,true);
  wood(c,left-.15,top-.18,w+.3,.13,woodColor);
  const wind=a.bannerWind===false?0:(a.bannerWindStrength??.45),phase=wind?t*(a.bannerWindSpeed??1)*2.5:0;
  c.save();c.shadowColor='#0005';c.shadowBlur=.08*shadowScale;c.shadowOffsetY=.05*shadowScale;
  for(let i=0;i<28;i++){
    const u=i/28,x=left+u*w,sw=w/28+.003,drop=Math.sin(phase+u*6)*wind*.16,H=h+drop;
    if(image){const iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;c.drawImage(image,u*iw,0,iw/28,ih,x,top,sw,H);}
    else{c.fillStyle=color||'#ae4c3b';c.fillRect(x,top,sw,H);}
    c.shadowColor='transparent';c.fillStyle=Math.cos(phase+u*6)>0?`rgba(255,239,198,${.04+.09*Math.abs(Math.cos(phase+u*6))})`:`rgba(24,19,13,${.04+.16*Math.abs(Math.cos(phase+u*6))})`;c.fillRect(x,top,sw,H);
  }
  c.strokeStyle='#d6c49e99';c.lineWidth=.012;c.setLineDash([.028,.035]);c.strokeRect(left+.035,top+.04,w-.07,h-.08);c.setLineDash([]);grain(c,left,top,w,h,70);
  for(const x of [left+.1,left+w-.1]){c.strokeStyle='#bfb092';c.lineWidth=.018;c.beginPath();c.ellipse(x,top-.025,.04,.08,0,0,Math.PI*2);c.stroke();}
  c.restore();
  if(banner&&a.bannerPlaque!==false)plaque(c,{...a,glyph:'banner'},a.bannerTitle||'Flag',Math.max(2.4,w+.1));
}
export function frontArtworkScene(glyph,color,t,a,image){
  a={...a};
  const w=glyph==='banner'?Math.max(1.8,2.8*(a.bannerAspect??.75)/2+.3):glyph==='flag'?Math.max(1.9,1.65*(a.bannerAspect??1.5)/2+.3):1.9;
  const bounds={left:-w,right:w,top:-5.85,bottom:.18};
  return {bounds:()=>bounds,draw(c,size){
    const matrix=c.getTransform?.(),shadowScale=size*(matrix?Math.max(Math.hypot(matrix.a,matrix.b),Math.hypot(matrix.c,matrix.d)):1);
    c.save();c.scale(size,size);
    if(glyph==='portrait')portrait(c,a,color,image,shadowScale);
    else if(glyph==='banner'||glyph==='flag')cloth(c,glyph,a,color,t,image,shadowScale);
    else{
      c.fillStyle='#d8cfb6';c.fillRect(-1.6,-3.2,3.2,3.2);
      if(image)c.drawImage(image,-1.5,-3.1,3,3);else grain(c,-1.5,-3.1,3,3,120);
      c.strokeStyle='#5d4b37';c.lineWidth=.07;c.strokeRect(-1.6,-3.2,3.2,3.2);
    }
    c.restore();return bounds;
  }};
}
