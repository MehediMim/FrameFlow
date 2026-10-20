export const BATTLE_EFFECTS={
  cannonShot:{label:'Cannon fire',color:'#e9a04f',battle:true},
  musketVolley:{label:'Musket volley',color:'#f3c46d',battle:true},
  arrowVolley:{label:'Arrow volley',color:'#bfa36b',battle:true},
  artilleryBarrage:{label:'Artillery barrage',color:'#d68c4b',battle:true},
  meleeClash:{label:'Sword clash / fighting',color:'#f6d58c',battle:true},
  battleSmoke:{label:'Battlefield smoke',color:'#81796b',battle:true},
  siegeFire:{label:'Siege fire / embers',color:'#da692f',battle:true},
};
const TAU=Math.PI*2,clamp=x=>Math.max(0,Math.min(1,x));
const noise=i=>{const n=Math.sin(i*91.173+3.17)*43758.5453;return n-Math.floor(n);};
export function targetedAttack(from,to,scale){return{_targeted:true,battleRange:Math.hypot(to.x-from.x,to.y-from.y)/scale*40,battleAngle:Math.atan2(to.y-from.y,to.x-from.x)*180/Math.PI};}
function dot(c,x,y,r,col,alpha){if(alpha<=0)return;c.globalAlpha=alpha;c.fillStyle=col;c.beginPath();c.arc(x,y,Math.max(.005,r),0,TAU);c.fill();}
function stroke(c,x,y,X,Y,col,width,alpha){c.globalAlpha=alpha;c.strokeStyle=col;c.lineWidth=width;c.beginPath();c.moveTo(x,y);c.lineTo(X,Y);c.stroke();}
function flash(c,x,y,r,col,alpha){
  if(alpha<=0)return;c.globalAlpha=alpha;c.fillStyle=col;c.beginPath();
  for(let i=0;i<12;i++){const a=i/12*TAU,R=r*(i%2?.35:1),X=x+Math.cos(a)*R,Y=y+Math.sin(a)*R;if(i)c.lineTo(X,Y);else c.moveTo(X,Y);}c.closePath();c.fill();dot(c,x,y,r*.23,'#fff4cc',alpha);
}
function puff(c,x,y,q,col,env,size=1){
  if(q<0||q>=1)return;
  for(let i=0;i<5;i++)dot(c,x+(noise(i+3)-.5)*(.3+q*.6)*size+q*.4*size,y-q*.8*size+(noise(i+10)-.5)*.2*size,(.1+q*.26)*size,col,(1-q)*env*.25);
}
function impact(c,x,y,p,col,env){
  if(p<0||p>1)return;flash(c,x,y,.6*(1-p),col,env*(1-p)*.9);
  for(let i=0;i<9;i++){const a=noise(i+22)*TAU,r=p*(.5+noise(i)*.8);dot(c,x+Math.cos(a)*r,y+Math.sin(a)*r-p*.2,.045*(1-p),'#6b5140',env*(1-p));}
  puff(c,x,y,p,'#8e8472',env,1.6);
}
export function drawBattleEffect(c,fx,g,s,p,env,a,seconds){
  c.save();c.translate(g.x,g.y);c.rotate((a.battleAngle||0)*Math.PI/180);c.scale(s,s);c.lineCap='round';
  const n=Math.max(1,Math.min(12,Math.round(a.battleIntensity??5))),range=(a.battleRange??180)/40,spread=(a.battleSpread??35)*Math.PI/180;
  if(fx==='cannonShot'||fx==='musketVolley'||fx==='arrowVolley'){
    const shots=fx==='cannonShot'?1:n;
    for(let i=0;i<shots;i++){
      const q=clamp((p-i/(shots||1)*.26)/.74),active=p>=i/shots*.26;
      if(!active)continue;
      const angle=(a._targeted||shots===1?0:i/(shots-1)-.5)*spread,originY=(i-(shots-1)/2)*.18,targetY=a._targeted?-originY:0;
      c.save();c.translate(0,originY);c.rotate(angle);
      const flight=Math.min(1,q/.65),x=flight*range,y=targetY*flight+(fx==='musketVolley'?0:-Math.sin(flight*Math.PI)*range*.22);
      if(fx!=='arrowVolley'){flash(c,0,0,(fx==='cannonShot'?.6:.28)*(1-clamp(q/.15)),a.color,env*(1-clamp(q/.15)));puff(c,0,0,q,'#a49c89',env,fx==='cannonShot'?1.7:.8);}
      if(q>0&&q<.65){
        if(fx==='cannonShot')dot(c,x,y,.09,'#302b28',env);
        else if(fx==='musketVolley')stroke(c,Math.max(0,x-.38),y,x,y,'#ffe2a1',.025,env);
        else{const tilt=-Math.cos(flight*Math.PI)*.65;c.save();c.translate(x,y);c.rotate(tilt);stroke(c,-.36,0,.1,0,'#7a5437',.035,env);stroke(c,-.35,0,-.44,-.08,'#ede0bb',.035,env);stroke(c,-.35,0,-.44,.08,'#ede0bb',.035,env);c.globalAlpha=env;c.fillStyle='#aeb6b3';c.beginPath();c.moveTo(.2,0);c.lineTo(.07,-.055);c.lineTo(.07,.055);c.closePath();c.fill();c.restore();}
      }
      if(q>=.65)impact(c,range,targetY,(q-.65)/.35,a.color,env);
      c.restore();
    }
  }else if(fx==='artilleryBarrage'){
    for(let i=0;i<n;i++){const start=i/n*.55,q=(p-start)/.45;if(q<0||q>1)continue;impact(c,(noise(i+40)-.5)*range,(noise(i+70)-.5)*range*.55,q,a.color,env);}
  }else if(fx==='meleeClash'){
    const swing=Math.sin(p*Math.PI*4)*.32;
    for(const dir of[-1,1]){c.save();c.scale(dir,1);c.rotate(swing);stroke(c,-1.1,.65,.48,-.75,'#2e2723',.16,env);stroke(c,-.62,.21,.48,-.75,'#cad0c6',.1,env);stroke(c,-.79,.02,-.49,.35,'#b69354',.07,env);c.restore();}
    const sparks=Math.pow(Math.max(0,Math.sin(p*Math.PI*4)),6);flash(c,0,-.3,.5,a.color,env*sparks);
    for(let i=0;i<n+4;i++){const angle=noise(i+3)*TAU,r=((p*3+noise(i))%1)*1.6;stroke(c,Math.cos(angle)*r*.8,-.3+Math.sin(angle)*r*.8,Math.cos(angle)*r,-.3+Math.sin(angle)*r,a.color,.025,env*sparks*(1-r/2));}
  }else if(fx==='battleSmoke'){
    for(let i=0;i<n*2;i++){const q=(seconds*.28+i/(n*2))%1;const x=(noise(i+13)-.5)*range;puff(c,x,(noise(i+54)-.5)*.6,q,a.color,env,1+noise(i));}
  }else if(fx==='siegeFire'){
    for(let i=0;i<n;i++){const x=(i-(n-1)/2)*.3,h=.5+noise(i)+Math.sin(seconds*5+i)*.25;c.globalAlpha=env;c.fillStyle=a.color;c.beginPath();c.moveTo(x-.2,0);c.quadraticCurveTo(x-.25,-h*.5,x+Math.sin(seconds*3+i)*.12,-h);c.quadraticCurveTo(x+.3,-h*.4,x+.18,0);c.closePath();c.fill();dot(c,x,-.16,.12,'#ffd37b',env);const q=(seconds*.5+i/n)%1;dot(c,x+Math.sin(i+q*3)*.3,-q*2.3,.025,'#ffbd66',env*(1-q));puff(c,x,-.8,q,'#56534c',env,.8);}
  }
  c.restore();
}
