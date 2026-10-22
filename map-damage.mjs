import { surface } from './map-object-materials.mjs';
// Damage is a persistent visual state, independent of entry/exit animation.
export const COLLAPSE_SECONDS = .9;

// Evaluate from the timeline so scrubbing and exported frames reproduce the same collapse.
// An object that starts destroyed is already rubble; only later state changes collapse.
export function destructionProgress(a, frame, fps = 30) {
  const track = (a.objectKeys || []).filter(k => k.values.damageState !== undefined).sort((a, b) => a.frame - b.frame);
  let state = track[0]?.values.damageState, start = null;
  for (const key of track) {
    if (key.frame > frame) break;
    const next = key.values.damageState;
    if (next !== state) start = next === 'destroyed' ? key.frame : null;
    state = next;
  }
  return start === null ? 1 : Math.max(0, Math.min(1, (frame - start) / (fps * COLLAPSE_SECONDS)));
}

export function drawDestruction(c, s, ship, progress, drawIntact) {
  if (progress >= 1) { drawRubble(c, s, ship); return; }
  const p = Math.max(0, progress), fall = Math.min(1, p / .65), opacity = c.globalAlpha;
  c.save();
  c.globalAlpha = opacity * fall;
  drawRubble(c, s, ship);
  c.restore();
  if (fall < 1) {
    c.save();
    c.globalAlpha = opacity * (1 - fall * fall);
    c.translate(Math.sin(p * 55) * s * .035 * fall, s * .3 * fall * fall);
    c.rotate(Math.sin(p * 9) * .12 * fall);
    c.scale(1 + fall * .12, 1 - fall * .85);
    drawIntact();
    c.restore();
  }
  // Fixed particle trajectories keep playback independent of render order.
  c.save();
  for (let i = 0; i < 12; i++) {
    const q = Math.min(1, p / (.5 + (i % 3) * .1));
    const x = (i - 5.5) * s * (.08 + q * .16);
    const y = s * (.2 - (1 - q) * .8 - Math.sin(q * Math.PI) * (.45 + (i % 4) * .13));
    c.globalAlpha = opacity * Math.min(1, p * 20) * (1 - q);
    c.fillStyle = ship ? '#66503d' : '#82796a';
    c.save();c.translate(x, y);c.rotate(i + q * (i % 2 ? 5 : -5));
    c.fillRect(-s * .055, -s * .04, s * .11, s * .08);c.restore();
  }
  for (let i = 0; i < 7; i++) {
    const q = Math.max(0, (p - .1) / .9), r = s * (.15 + q * .42);
    c.globalAlpha = opacity * Math.sin(q * Math.PI) * .25;
    const x = (i - 3) * s * (.16 + q * .22), y = s * (.22 - q * (.4 + (i % 2) * .15));
    const dust = c.createRadialGradient(x, y, 0, x, y, r);
    dust.addColorStop(0, '#a99c85');dust.addColorStop(1, 'rgba(169,156,133,0)');
    c.fillStyle = dust;c.beginPath();c.arc(x, y, r, 0, Math.PI * 2);c.fill();
  }
  c.restore();
}

export function drawRubble(c,s,ship=false){
  c.fillStyle=ship?'#4c392d':'#686052';c.strokeStyle='#302a25';c.lineWidth=s*.035;
  for(let i=0;i<9;i++){
    const x=(i-4)*s*.19,y=s*(.14+(i%3)*.07),r=s*(.12+(i%2)*.055);
    c.fillStyle=surface(c,ship?'#66503d':'#82796a',x-r,y-r,2*r,1.25*r);
    c.beginPath();c.moveTo(x-r,y);c.lineTo(x-r*.4,y-r);c.lineTo(x+r*.8,y-r*.6);c.lineTo(x+r,y+r*.25);c.closePath();c.fill();c.stroke();
    c.beginPath();c.moveTo(x-r*.4,y-r);c.lineTo(x+r*.12,y-r*.15);c.lineTo(x+r,y+r*.25);c.strokeStyle='#494135';c.lineWidth=s*.015;c.stroke();
    c.strokeStyle='#302a25';c.lineWidth=s*.035;
  }
  if(ship){c.beginPath();c.moveTo(-s*.9,s*.2);c.lineTo(-s*.7,-s*.06);c.lineTo(s*.75,s*.03);c.lineTo(s*.5,s*.3);c.closePath();c.fill();c.stroke();c.beginPath();c.moveTo(-s*.2,s*.08);c.lineTo(s*.55,-s*.6);c.stroke();}
}
export function drawDamage(c,s,state,seconds){
  if(!state||state==='intact'||state==='destroyed')return;
  c.save();const opacity=c.globalAlpha;c.strokeStyle='#2d2724';c.lineWidth=Math.max(.7,s*.035);c.lineJoin='round';
  for(const off of[-.45,.25]){
    c.beginPath();c.moveTo(off*s,-s*.45);c.lineTo((off+.08)*s,-s*.2);c.lineTo((off-.08)*s,-s*.07);c.lineTo((off+.06)*s,s*.17);c.stroke();
    c.save();c.lineWidth=s*.016;c.beginPath();c.moveTo((off+.08)*s,-s*.2);c.lineTo((off+.22)*s,-s*.24);c.lineTo((off+.27)*s,-s*.35);c.moveTo((off-.08)*s,-s*.07);c.lineTo((off-.2)*s,-s*.02);c.stroke();c.restore();
  }
  if(state==='burning')for(let i=0;i<4;i++){
    const x=(i-1.5)*s*.32,h=s*(.48+.14*Math.sin(seconds*6+i));
    const flame=c.createLinearGradient(x,s*.12,x,-h);flame.addColorStop(0,'#fff1ad');flame.addColorStop(.35,'#f9b844');flame.addColorStop(1,'#be4829');
    c.fillStyle=flame;c.beginPath();c.moveTo(x-s*.16,s*.12);c.quadraticCurveTo(x-s*.21,-h*.4,x+s*.09*Math.sin(seconds*4+i),-h);c.quadraticCurveTo(x+s*.2,-h*.3,x+s*.15,s*.12);c.closePath();c.fill();
    const q=(seconds*.35+i/4)%1;c.globalAlpha=opacity*(1-q)*.28;c.fillStyle='#45423c';c.beginPath();c.arc(x+q*s*.35,-s*(.6+q*1.7),s*(.15+q*.25),0,Math.PI*2);c.fill();c.globalAlpha=opacity;
  }
  c.restore();
}
