import { surface, polygonSurface } from './map-object-materials.mjs';
// Small, outlined vector primitives shared by landmark and occupation miniatures.
export const INK = '#293840', IVORY = '#eee7d6', GLASS = '#9dc9d6';
export function shape(c,s,points,fill) {
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x*s,y*s):c.moveTo(x*s,y*s));
  c.closePath();c.fillStyle=polygonSurface(c,fill,s,points);c.fill();c.strokeStyle=INK;c.lineWidth=.025*s;c.lineJoin='round';c.stroke();
}
export function box(c,s,x,y,w,h,fill,r=.02) {
  c.beginPath();c.roundRect(x*s,y*s,w*s,h*s,r*s);c.fillStyle=surface(c,fill,x*s,y*s,w*s,h*s);c.fill();c.strokeStyle=INK;c.lineWidth=.025*s;c.stroke();
}
export function line(c,s,x,y,X,Y,col=INK,w=.025) {
  c.beginPath();c.moveTo(x*s,y*s);c.lineTo(X*s,Y*s);c.strokeStyle=col;c.lineWidth=w*s;c.lineCap='round';c.stroke();
}
export function oval(c,s,x,y,rx,ry,fill) {
  c.beginPath();c.ellipse(x*s,y*s,rx*s,ry*s,0,0,Math.PI*2);c.fillStyle=surface(c,fill,(x-rx)*s,(y-ry)*s,rx*2*s,ry*2*s);c.fill();c.strokeStyle=INK;c.lineWidth=.025*s;c.stroke();
}
export function arch(c,s,x,y,w,h,fill) {
  c.beginPath();c.moveTo(x*s,(y+h)*s);c.lineTo(x*s,(y+w*.5)*s);
  c.bezierCurveTo(x*s,(y-w*.17)*s,(x+w)*s,(y-w*.17)*s,(x+w)*s,(y+w*.5)*s);
  c.lineTo((x+w)*s,(y+h)*s);c.closePath();c.fillStyle=surface(c,fill,x*s,y*s,w*s,h*s);c.fill();c.strokeStyle=INK;c.lineWidth=.022*s;c.stroke();
}
export const miniature = (label,color,group,draw) => ({label,color,group,timeUnit:'seconds',draw:(c,s,col=color,t=0)=>draw(c,s,col,t)});
