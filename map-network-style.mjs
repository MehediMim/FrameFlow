export const ROAD_STYLES=Object.freeze({asphalt:{label:'Asphalt road',surface:'#626867',edge:'#a29d88'},highway:{label:'Divided highway',surface:'#555e60',edge:'#b1b0a0'},residential:{label:'Residential street',surface:'#85867e',edge:'#cec7b5'},cobblestone:{label:'Cobblestone',surface:'#9d9682',edge:'#706e60'},dirt:{label:'Dirt / country track',surface:'#a48a5e',edge:'#82734f'}});
export const RAIL_STYLES=Object.freeze({wood:{label:'Timber sleepers',tie:'#816d54',bed:'#a09b89'},concrete:{label:'Concrete sleepers',tie:'#bbb9aa',bed:'#868b83'},double:{label:'Double track',tie:'#9b988a',bed:'#92968c'},tram:{label:'Urban tramway',tie:'#9f9c8f',bed:'#aaa99d'},narrow:{label:'Narrow gauge',tie:'#796a50',bed:'#9f977c'}});
export const ROAD_MARKINGS=Object.freeze({auto:'Automatic',dashed:'Dashed center line',solid:'Solid center line',double:'Double yellow',none:'No markings'});
export const networkHalfWidth=a=>a.shape==='road'?(a.width||6)*.5+(a.roadShoulder??(a.roadStyle==='residential'?3:1.5))+1:(a.width||6)*(a.railStyle==='double'?1.35:.7);
export const networkMargin=(a,unit=1)=>Math.max(40,(a.width||6)*(a.railStyle==='double'?1.6:1.2)+(a.roadShoulder??2)+12)*unit;
export function validateNetworkStyle(a){
  if(!['road','railway'].includes(a.shape))return;
  const bad=()=>{throw Error('Invalid road or railway design.');};
  if(a.width!==undefined&&(!Number.isFinite(a.width)||a.width<1||a.width>120))bad();
  for(const [key,options]of[['roadStyle',ROAD_STYLES],['railStyle',RAIL_STYLES],['roadMarkings',ROAD_MARKINGS]])if(a[key]!==undefined&&!Object.hasOwn(options,a[key]))bad();
  if(a.roadLanes!==undefined&&![1,2,3,4,6].includes(a.roadLanes))bad();
  if(a.roadShoulder!==undefined&&(!Number.isFinite(a.roadShoulder)||a.roadShoulder<0||a.roadShoulder>12))bad();
  if(a.sleeperSpacing!==undefined&&(!Number.isFinite(a.sleeperSpacing)||a.sleeperSpacing<.5||a.sleeperSpacing>2.5))bad();
  for(const key of ['roadEdgeLines','railBallast','railElectrified'])if(a[key]!==undefined&&typeof a[key]!=='boolean')bad();
}
export function offsetPolyline(points,offset){
  return points.map((p,i)=>{
    if(!p)return null;const a=points[i-1]||p,b=points[i+1]||p,dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
    return {x:p.x-dy/d*offset,y:p.y+dx/d*offset};
  });
}
function along(points,gap,draw){
  let carry=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];if(!a||!b){carry=0;continue;}
    const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);if(!d)continue;
    let t=carry;for(;t<d;t+=gap)draw(a.x+dx*t/d,a.y+dy*t/d,dx/d,dy/d);carry=t-d;
  }
}
const textures=new Map();
function texture(c,kind,unit){
  const edge=Math.max(16,Math.min(192,Math.round(48*unit))),key=kind+':'+edge;
  let canvas=textures.get(key);
  if(!canvas){
    canvas=typeof OffscreenCanvas!=='undefined'?new OffscreenCanvas(edge,edge):typeof document!=='undefined'?document.createElement('canvas'):null;
    if(!canvas)return null;canvas.width=canvas.height=edge;const t=canvas.getContext('2d');let seed=kind==='ballast'?37423:kind==='dirt'?94721:15401;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<260;i++){
      const x=random()*edge,y=random()*edge,r=(kind==='ballast'?.4+random()*1.1:.2+random()*.45)*edge/48;
      t.fillStyle=random()>.5?`rgba(235,229,207,${kind==='ballast'?.3:.14})`:`rgba(27,34,29,${kind==='ballast'?.24:.12})`;
      t.beginPath();t.moveTo(x-r,y);t.lineTo(x+r*.6,y-r*.7);t.lineTo(x+r,y+r*.6);t.lineTo(x-r*.7,y+r);t.closePath();t.fill();
    }
    textures.set(key,canvas);if(textures.size>16)textures.delete(textures.keys().next().value);
  }return c.createPattern?.(canvas,'repeat')||null;
}
export function drawRoadOrRail(c,points,a,unit,seconds){
  const w=(a.width||6)*unit,flow=['flow','both'].includes(a.networkAnimation),phase=seconds*(a.flowSpeed??24)*unit;
  const stroke=(p,col,width,dash=[],offset=0)=>{c.beginPath();let on=false;for(const q of p){if(q){if(on)c.lineTo(q.x,q.y);else c.moveTo(q.x,q.y);}on=!!q;}c.strokeStyle=col;c.lineWidth=width;c.setLineDash(dash);c.lineDashOffset=offset;c.stroke();};
  const shifted=(offset,col,width,dash=[],phase=0)=>stroke(offsetPolyline(points,offset),col,width,dash,phase);
  c.save();c.lineJoin='round';c.lineCap='round';
  if(a.shape==='road'){
    const type=a.roadStyle||'asphalt',style=ROAD_STYLES[type],lanes=a.roadLanes??(type==='highway'?4:type==='dirt'?1:2),shoulder=(a.roadShoulder??(type==='residential'?3:1.5))*unit;
    stroke(points,'#333c3280',w+shoulder*2+1.6*unit);stroke(points,style.edge,w+shoulder*2);stroke(points,a.color||style.surface,w);
    const grain=texture(c,type==='dirt'?'dirt':'asphalt',unit);if(grain)stroke(points,grain,w);
    if(type==='cobblestone'){
      for(let i=-2;i<=2;i++)shifted(i*w*.17,'#d0c7af70',Math.max(.45*unit,w*.055),[Math.max(2*unit,w*.14),1.1*unit],i%2?2*unit:0);
    }else if(type==='dirt'){
      for(const sign of[-1,1])shifted(sign*w*.23,'#6a604950',Math.max(.6*unit,w*.1));
      shifted(w*.46,'#c4ae7e',Math.max(.4*unit,w*.055),[3*unit,5*unit]);
    }
    if(a.roadEdgeLines!==false&&!['cobblestone','dirt'].includes(type))for(const sign of[-1,1])shifted(sign*w*.43,'#eee6ce',Math.max(.4*unit,w*.018));
    const marking=a.roadMarkings||'auto',marked=marking!=='none'&&!['cobblestone','dirt'].includes(type);
    if(marked){
      if(type==='highway'&&marking==='auto'){stroke(points,'#8c9675',w*.07);for(const sign of[-1,1])shifted(sign*w*.045,'#ddd8bd',Math.max(.35*unit,w*.012));}
      for(let j=1;j<lanes;j++){
        const offset=(j/lanes-.5)*w*.84,center=j*2===lanes;if(center&&type==='highway'&&marking==='auto')continue;
        if(center&&marking!=='auto')continue;
        shifted(offset,'#e8e3cf',Math.max(.4*unit,w*.017),[Math.max(4*unit,w*.4),Math.max(4*unit,w*.35)]);
      }
      if(marking==='double')for(const d of[-1,1])shifted(d*Math.max(.65*unit,w*.025),'#e5c565',Math.max(.45*unit,w*.018));
      else if(marking==='solid')shifted(0,'#e6c76a',Math.max(.45*unit,w*.018));
      else if(marking==='dashed')shifted(0,'#e8e3cf',Math.max(.45*unit,w*.018),[Math.max(4*unit,w*.4),Math.max(4*unit,w*.35)]);
    }
    if(flow)for(const sign of[-1,1])shifted(sign*w*.21,sign>0?'#f4d68a':'#d7e3de',Math.max(.9*unit,w*.12),[Math.max(2*unit,w*.14),Math.max(35*unit,w*3)],sign*phase);
  }else{
    const type=a.railStyle||'wood',style=RAIL_STYLES[type],centers=type==='double'?[-w*.65,w*.65]:[0],gauge=w*(type==='narrow'?.22:.31);
    if(a.railBallast!==false){stroke(points,style.bed,w*(type==='double'?2.6:1.35));const stones=texture(c,'ballast',unit);if(stones)stroke(points,stones,w*(type==='double'?2.6:1.35));}
    if(type==='tram')stroke(points,'#b8b5a7',w*1.16);
    for(const center of centers){
      const track=offsetPolyline(points,center);
      if(type!=='tram'){
        c.lineCap='butt';c.setLineDash([]);
        along(track,Math.max(3*unit,w*.36)*(a.sleeperSpacing??1),(x,y,dx,dy)=>{
          c.beginPath();c.moveTo(x-dy*w*.52,y+dx*w*.52);c.lineTo(x+dy*w*.52,y-dx*w*.52);c.strokeStyle='#4f514580';c.lineWidth=Math.max(1.3*unit,w*.15);c.stroke();
          c.strokeStyle=style.tie;c.lineWidth=Math.max(.8*unit,w*.105);c.stroke();
        });
      }
      for(const sign of[-1,1]){
        const rail=offsetPolyline(track,sign*gauge);stroke(rail,'#3b4546',Math.max(1.3*unit,w*.13));stroke(rail,a.color||'#839194',Math.max(.7*unit,w*.075));
        stroke(offsetPolyline(rail,-.02*w),'#d5d9d1',Math.max(.3*unit,w*.025));
      }
      if(flow)stroke(track,'#d9b269',Math.max(1.2*unit,w*.33),[Math.max(8*unit,w*.75),Math.max(45*unit,w*4)],-phase);
    }
    if(a.railElectrified){
      stroke(points.map(p=>p?{x:p.x,y:p.y-w*.9}:null),'#78857d',Math.max(.45*unit,w*.025));
      c.setLineDash([]);along(points,Math.max(36*unit,w*4),(x,y,dx,dy)=>{
        const nx=-dy,ny=dx,X=x+nx*w*(type==='double'?1.45:.8),Y=y+ny*w*(type==='double'?1.45:.8);
        c.beginPath();c.moveTo(X,Y);c.lineTo(X,Y-w*.9);c.lineTo(x,Y-w*.9);c.strokeStyle='#626e68';c.lineWidth=Math.max(.6*unit,w*.05);c.stroke();
      });
    }
  }c.restore();
}
