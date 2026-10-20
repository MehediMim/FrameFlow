export const FORMATIONS = {grid:'Grid',row:'Row',wall:'Joined wall segments',column:'Column',staggered:'Staggered ranks',wedge:'Wedge',circle:'Circle'};
export const defaultObjectGap = a => a.formation==='wall'?52:a.glyph==='banner'?160:a.glyph==='image'?104:64;
export function objectOffsets(a) {
  const n=Math.max(1,Math.min(100,Math.round(a.count||1))), mode=a.formation||'grid';
  const gap=defaultObjectGap(a);
  const gx=a.gapX??gap,gy=a.gapY??gap,cols=['row','wall'].includes(mode)?n:mode==='column'?1:Math.max(1,Math.min(n,Math.round(a.formationCols||Math.ceil(Math.sqrt(n)))));
  const points=[];
  for(let i=0;i<n;i++){
    let x,y;
    if(mode==='circle') {const r=n===1?0:Math.max(gx,gy)*n/(2*Math.PI),angle=i/n*Math.PI*2-Math.PI/2;x=Math.cos(angle)*r;y=Math.sin(angle)*r;}
    else if(mode==='wedge') {let row=0,j=i;while(j>row){j-=row+1;row++;}x=(j-row/2)*gx;y=row*gy;}
    else {const row=Math.floor(i/cols),length=Math.min(cols,n-row*cols),align=a.formationAlign||'center';
      const shift=align==='left'?0:align==='right'?cols-length:(cols-length)/2;
      x=(i%cols+shift+(mode==='staggered'&&row%2?.5:0))*gx;y=row*gy;
    }
    points.push({x,y});
  }
  const cx=(Math.min(...points.map(p=>p.x))+Math.max(...points.map(p=>p.x)))/2,cy=(Math.min(...points.map(p=>p.y))+Math.max(...points.map(p=>p.y)))/2;
  const angle=(a.formationAngle||0)*Math.PI/180,c=Math.cos(angle),s=Math.sin(angle);
  return points.map(p=>({x:(p.x-cx)*c-(p.y-cy)*s,y:(p.x-cx)*s+(p.y-cy)*c}));
}
// Anchor-based arrangement for separately selected object items in the current view.
export function arrangementTargets(points, operation, gap=80) {
  if(points.length<2)return points.map(p=>({...p}));
  const xs=points.map(p=>p.x),ys=points.map(p=>p.y),left=Math.min(...xs),right=Math.max(...xs),top=Math.min(...ys),bottom=Math.max(...ys),cx=(left+right)/2,cy=(top+bottom)/2;
  const out=points.map(p=>({...p}));
  if(['row','column','grid','circle'].includes(operation)){
    const offsets=objectOffsets({count:points.length,formation:operation,gapX:gap,gapY:gap});
    return out.map((p,i)=>({...p,x:cx+offsets[i].x,y:cy+offsets[i].y}));
  }
  const align={left:['x',left],right:['x',right],centerX:['x',cx],top:['y',top],bottom:['y',bottom],centerY:['y',cy]}[operation];
  if(align)for(const p of out)p[align[0]]=align[1];
  if(operation==='distributeX'||operation==='distributeY'){
    const key=operation==='distributeX'?'x':'y',sorted=[...out].sort((a,b)=>a[key]-b[key]),lo=sorted[0][key],hi=sorted.at(-1)[key];
    sorted.forEach((p,i)=>p[key]=lo+(hi-lo)*i/(sorted.length-1));
  }
  return out;
}
