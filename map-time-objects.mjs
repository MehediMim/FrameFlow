import { surface, polygonSurface } from './map-object-materials.mjs';
// Time props use elapsed timeline seconds, including during scrubbing and export.
const TAU = Math.PI * 2, ink = '#293b48', paper = '#fff8e9';
function line(c, x, y, X, Y, color = ink, width = .035) {
  c.beginPath(); c.moveTo(x, y); c.lineTo(X, Y);
  c.strokeStyle = color; c.lineWidth = width; c.lineCap = 'round'; c.stroke();
}
function circle(c, x, y, r, color) {
  c.beginPath(); c.arc(x, y, r, 0, TAU); c.fillStyle = surface(c,color,x-r,y-r,r*2,r*2); c.fill();
}
function box(c, x, y, w, h, color, r = .06) {
  c.beginPath(); c.roundRect(x, y, w, h, r); c.fillStyle = surface(c,color,x,y,w,h); c.fill();
}
function polygon(c, points, color) {
  c.beginPath(); points.forEach(([x,y],i) => i ? c.lineTo(x,y) : c.moveTo(x,y));
  c.closePath(); c.fillStyle = polygonSurface(c,color,1,points); c.fill();
}
function hand(c, angle, length, color, width) {
  line(c, 0, 0, Math.sin(angle)*length, -Math.cos(angle)*length, color, width);
}
function dial(c, col, radius = .9) {
  circle(c, .035, .05, radius + .055, '#253745');
  circle(c, 0, 0, radius, col); circle(c, 0, 0, radius - .105, paper);
  for (let i=0; i<60; i++) {
    const a=i*TAU/60, outer=radius-.16, inner=outer-(i%5 ? .045 : .1);
    line(c, Math.sin(a)*inner, -Math.cos(a)*inner, Math.sin(a)*outer, -Math.cos(a)*outer, ink, i%5 ? .012 : .03);
  }
}
function entry(label, color, draw) {
  return { label, color, group:'time', timeUnit:'seconds', draw(c,s,col=color,t=0) {
    c.save(); c.scale(s,s); draw(c,col,Math.max(0,t)); c.restore();
  } };
}
export const TIME_OBJECTS = {
  clock: entry('Analog clock', '#528e9c', (c,col,t) => {
    dial(c,col);
    // Start at 10:10; each elapsed second advances the second hand by one tick.
    hand(c,(10+10/60+t/3600)*TAU/12,.38,ink,.075);
    hand(c,(10+t/60)*TAU/60,.57,ink,.05);
    hand(c,t*TAU/60,.65,'#d65d49',.025); circle(c,0,0,.07,col);
  }),
  stopwatch: entry('Stopwatch', '#d98b51', (c,col,t) => {
    box(c,-.13,-1.04,.26,.22,ink,.04); box(c,-.2,-1.08,.4,.1,col,.03);
    line(c,.57,-.65,.72,-.82,ink,.12); line(c,.67,-.87,.79,-.75,col,.12);
    dial(c,col,.79);
    circle(c,0,.28,.17,'#dce6e4');
    line(c,0,.28,Math.sin(t*TAU/3600)*.12,.28-Math.cos(t*TAU/3600)*.12,ink,.022);
    hand(c,t*TAU/60,.58,'#cf5747',.035); circle(c,0,0,.065,ink);
  }),
  hourglass: entry('Hourglass', '#bd985d', (c,col,t) => {
    for(const x of [-.54,.54])box(c,x-.035,-.78,.07,1.56,col,.02);
    const glass=[[-.4,-.72],[.4,-.72],[.36,-.4],[.07,0],[.36,.4],[.4,.72],[-.4,.72],[-.36,.4],[-.07,0],[-.36,-.4]];
    polygon(c,glass,'#d8ecec');
    const p=(t%10)/10, top=-.65+.59*p;
    // Clip both sand piles to the glass silhouette.
    c.save(); polygon(c,glass,'#d8ecec'); c.clip();
    polygon(c,[[-.45,top],[.45,top],[0,-.02]],'#d8ab58');
    line(c,0,-.01,0,.65-.5*p,'#c08b3e',.025);
    polygon(c,[[-.42,.72],[.42,.72],[0,.65-.5*p]],'#d8ab58'); c.restore();
    for(const y of [-.84,.74])box(c,-.65,y,1.3,.12,col,.035);
    line(c,-.3,-.58,-.23,-.34,'#ffffff',.035);
  }),
  calendar: entry('Calendar', '#bd6759', (c,col) => {
    box(c,-.86,-.76,1.76,1.65,ink,.12); box(c,-.9,-.82,1.76,1.65,paper,.12);
    box(c,-.9,-.82,1.76,.46,col,.12); box(c,-.9,-.56,1.76,.2,col,.01);
    for(const x of [-.49,.45]) { box(c,x-.065,-1,.13,.4,ink,.06); box(c,x-.025,-.97,.035,.28,'#bccbd0',.015); }
    for(let row=0;row<3;row++)for(let day=0;day<5;day++) {
      const x=-.65+day*.29,y=-.12+row*.28;
      box(c,x-.07,y-.07,.14,.14,row===1&&day===2?col:'#c2cecd',.025);
    }
    line(c,-.18,.17,-.1,.25,paper,.025); line(c,-.1,.25,.04,.08,paper,.025);
  }),
};
