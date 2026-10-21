const toX=lon=>(lon+180)/360,toY=lat=>(1-Math.log(Math.tan(Math.PI/4+Math.max(-85.05112878,Math.min(85.05112878,lat))*Math.PI/360))/Math.PI)/2;
function crosses(a,b,c,d){const orient=(p,q,r)=>(q.x-p.x)*(r.y-p.y)-(q.y-p.y)*(r.x-p.x),opposite=(a,b)=>(a>1e-12&&b< -1e-12)||(a< -1e-12&&b>1e-12);return opposite(orient(a,b,c),orient(a,b,d))&&opposite(orient(c,d,a),orient(c,d,b));}
export function polygonWorld(path){let prev;return path.map(p=>{let x=toX(p.lon);if(prev!==undefined)x+=Math.round(prev-x);prev=x;return{x,y:toY(p.lat)};});}
export function insidePolygon(point,ring){
  let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){
    const a=ring[j],b=ring[i],cross=(point.x-a.x)*(b.y-a.y)-(point.y-a.y)*(b.x-a.x);
    if(Math.abs(cross)<1e-10&&point.x>=Math.min(a.x,b.x)-1e-10&&point.x<=Math.max(a.x,b.x)+1e-10&&point.y>=Math.min(a.y,b.y)-1e-10&&point.y<=Math.max(a.y,b.y)+1e-10)return true;
    if((a.y>point.y)!==(b.y>point.y)&&point.x<(b.x-a.x)*(point.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
  }return inside;
}
export function polygonFeature(target){
  const pts=polygonWorld(target.path||[]);if(pts.length<3)return null;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),bbox=[Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)],xy=new Float64Array([...pts.flatMap(p=>[p.x,p.y]),pts[0].x,pts[0].y]);
  let area=0;for(let i=0;i<pts.length;i++)area+=pts[i].x*pts[(i+1)%pts.length].y-pts[(i+1)%pts.length].x*pts[i].y;
  return{name:target.name,rings:[{xy,n:pts.length+1,area:Math.abs(area/2),real:Math.abs(area/2),hole:false}],bbox,mainBox:bbox,cx:(bbox[0]+bbox[2])/2,cy:(bbox[1]+bbox[3])/2,tint:0};
}
export function regionsInsidePolygon(geo,path,area,levelOf,rule='center'){
  const polygon=polygonWorld(path);if(polygon.length<3)return[];
  const mid=polygon.reduce((n,p)=>n+p.x,0)/polygon.length,loaded=new Set(area.detailCountries||[]);
  if(area.mode==='country')loaded.add(area.country);
  const candidates=geo.hi.features.filter(f=>!loaded.has(f.name)).map(f=>({f,target:{kind:'country',name:f.name}}));
  for(const country of loaded){const pack=geo.details?.get(country),level=levelOf(geo,country,area.detailLevels?.[country]||area.detailLevel);const regions=pack?.levels?.[level]||[];if(!regions.length){const f=geo.byName.get(country);if(f)candidates.push({f,target:{kind:'country',name:country}});}else for(const f of regions)candidates.push({f,target:{kind:'region',name:f.key||f.name,country}});}
  return candidates.filter(({f})=>{const offset=Math.round(mid-f.cx);if(rule==='contained')return f.rings.filter(r=>!r.hole).every(r=>{for(let i=0;i<r.n;i++){const p={x:r.xy[i*2]+offset,y:r.xy[i*2+1]};if(!insidePolygon(p,polygon))return false;if(i){const prior={x:r.xy[(i-1)*2]+offset,y:r.xy[(i-1)*2+1]};for(let j=0;j<polygon.length;j++)if(crosses(prior,p,polygon[j],polygon[(j+1)%polygon.length]))return false;}}return true;});return insidePolygon({x:f.cx+offset,y:f.cy},polygon);}).map(c=>c.target);
}
export function validPolygon(path){
 if(!Array.isArray(path)||path.length<3||path.length>120||path.some(p=>!p||!Number.isFinite(p.lat)||Math.abs(p.lat)>90||!Number.isFinite(p.lon)||Math.abs(p.lon)>540))return false;
 const f=polygonFeature({name:'Region',path});if(!f||f.rings[0].area<=1e-12)return false;
 const pts=polygonWorld(path);for(let i=0;i<pts.length;i++)for(let j=i+2;j<pts.length;j++){if(i===0&&j===pts.length-1)continue;if(crosses(pts[i],pts[(i+1)%pts.length],pts[j],pts[(j+1)%pts.length]))return false;}return true;
}
