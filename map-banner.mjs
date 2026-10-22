import { drawPlaqueText } from './map-plaque-text.mjs';
// A hanging image standard: the crossbar is fixed, the cloth flexes below it.
export function bannerPoint(u, v, width, height, seconds, strength = .45, speed = 1) {
  const phase = seconds * speed * 3.2, bend = strength * v * v;
  return {
    x: (u - .5) * width + Math.sin(phase - v * 4.8) * width * .13 * bend,
    y: v * height + Math.sin(phase - v * 6 + u * 4) * height * .025 * bend,
  };
}
function triangle(c, img, p, uv) {
  const [a,b,d] = p, [s,t,r] = uv;
  const det = (t.x-s.x)*(r.y-s.y)-(r.x-s.x)*(t.y-s.y);
  if (Math.abs(det)<1e-8) return;
  const A=((b.x-a.x)*(r.y-s.y)-(d.x-a.x)*(t.y-s.y))/det;
  const C=((d.x-a.x)*(t.x-s.x)-(b.x-a.x)*(r.x-s.x))/det;
  const B=((b.y-a.y)*(r.y-s.y)-(d.y-a.y)*(t.y-s.y))/det;
  const D=((d.y-a.y)*(t.x-s.x)-(b.y-a.y)*(r.x-s.x))/det;
  c.save();c.beginPath();
  // A tiny overlap hides raster hairlines between adjacent mesh triangles.
  const cx=(a.x+b.x+d.x)/3,cy=(a.y+b.y+d.y)/3;
  for(let i=0;i<3;i++) { const q=p[i],dx=q.x-cx,dy=q.y-cy,l=Math.hypot(dx,dy)||1; const x=q.x+dx/l*.8,y=q.y+dy/l*.8; if(i)c.lineTo(x,y);else c.moveTo(x,y); }
  c.closePath();c.clip();c.transform(A,B,C,D,a.x-A*s.x-C*s.y,a.y-B*s.x-D*s.y);c.drawImage(img,0,0);c.restore();
}
export function drawBanner(c, s, color, a, seconds, img = null) {
  const height=3.5*s,width=height*(a.bannerAspect??.75),top=-3.85*s;
  const wind=a.bannerWind===false?0:(a.bannerWindStrength??.45),speed=a.bannerWindSpeed??1;
  const wood=a.bannerPoleColor||'#65503a';
  const bar=(x,y,w,h)=>{
    c.fillStyle=wood;c.strokeStyle='#2e251e';c.lineWidth=Math.max(1,s*.04);
    c.beginPath();c.roundRect(x,y,w,h,s*.045);c.fill();c.stroke();
    c.beginPath();c.moveTo(x+s*.05,y+h*.22);c.lineTo(x+w-s*.05,y+h*.22);c.strokeStyle='rgba(255,236,193,.4)';c.lineWidth=Math.max(.6,s*.025);c.stroke();
  };
  if(a.bannerPole!==false) bar(-s*.065,-5.35*s,s*.13,5.85*s);
  // Title plaque stays rigid above the cloth, matching a historical standard.
  if(a.bannerPlaque!==false) {
    const y=-4.95*s,w=width*1.08;
    c.fillStyle='#e8e3d6';c.strokeStyle='#706c63';c.lineWidth=s*.025;
    c.beginPath();c.moveTo(-w/2,y);c.lineTo(w/2,y);c.lineTo(w/2-s*.05,y+s*.78);c.lineTo(-w/2+s*.05,y+s*.78);c.closePath();c.fill();c.stroke();
    if(a.bannerTitle){
      drawPlaqueText(c,s,{...a,glyph:'banner'},a.bannerTitle,0,y+s*.39,w*.87,s*.64,true);
    }
    bar(-w/2-s*.09,y-s*.08,w+s*.18,s*.12);
  }
  c.save();c.translate(0,top);
  const cols=8,rows=18,points=[];
  for(let j=0;j<=rows;j++)for(let i=0;i<=cols;i++)points.push(bannerPoint(i/cols,j/rows,width,height,seconds,wind,speed));
  const outline=()=>{
    c.beginPath();c.moveTo(points[0].x,points[0].y);
    for(let i=1;i<=cols;i++)c.lineTo(points[i].x,points[i].y);
    for(let j=1;j<=rows;j++){const p=points[j*(cols+1)+cols];c.lineTo(p.x,p.y);}
    for(let i=cols-1;i>=0;i--){const p=points[rows*(cols+1)+i];c.lineTo(p.x,p.y);}
    for(let j=rows-1;j>=0;j--){const p=points[j*(cols+1)];c.lineTo(p.x,p.y);}c.closePath();
  };
  outline();c.fillStyle=color;c.fill();
  // Clip the whole cloth as well as each triangle, including transparent artwork.
  c.save();outline();c.clip();
  for(let j=0;j<rows;j++)for(let i=0;i<cols;i++){
    const q=[points[j*(cols+1)+i],points[j*(cols+1)+i+1],points[(j+1)*(cols+1)+i+1],points[(j+1)*(cols+1)+i]];
    if(img){
      const uv=[{x:i/cols*img.width,y:j/rows*img.height},{x:(i+1)/cols*img.width,y:j/rows*img.height},{x:(i+1)/cols*img.width,y:(j+1)/rows*img.height},{x:i/cols*img.width,y:(j+1)/rows*img.height}];
      triangle(c,img,[q[0],q[1],q[3]],[uv[0],uv[1],uv[3]]);triangle(c,img,[q[1],q[2],q[3]],[uv[1],uv[2],uv[3]]);
    }
    const shade=Math.sin(seconds*speed*3.2-j/rows*6+i/cols*4)*wind*(j/rows)*.18;
    c.fillStyle=shade<0?`rgba(0,0,0,${-shade})`:`rgba(255,255,240,${shade})`;
    c.beginPath();q.forEach((p,k)=>k?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fill();
  }
  c.restore();outline();c.strokeStyle='rgba(38,28,20,.65)';c.lineWidth=Math.max(.6,s*.025);c.stroke();c.restore();
  bar(-width/2-s*.16,top-s*.1,width+s*.32,s*.16);
}
