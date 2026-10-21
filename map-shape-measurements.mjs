// Geographic measurements of the same sampled Mercator path used by the renderer.
const R=6371.0088, RAD=Math.PI/180, MILE=1.609344;
const lat=y=>Math.atan(Math.sinh(Math.PI*(1-2*y)));
const logCosh=z=>Math.abs(z)+Math.log1p(Math.exp(-2*Math.abs(z)))-Math.LN2;
const zone=a=>['zone','noFly'].includes(a.shape);
export function measureShape(a,route){
  const area=zone(a),imperial=a.measurementUnit==='imperial';
  let km=0;
  if(route?.n>=2&&(!area||(a.path||[]).length>=3)){
    for(let i=0;i<(area?route.n:route.n-1);i++){
      const j=(i+1)%route.n,x=route.X[i],y=route.Y[i],X=route.X[j],Y=route.Y[j];
      if(area){
        // Integrate sin(latitude) along each rendered segment, including closure.
        const z=Math.PI*(1-2*y),Z=Math.PI*(1-2*Y);
        const mean=Math.abs(Z-z)<1e-9?Math.tanh((z+Z)/2):(logCosh(Z)-logCosh(z))/(Z-z);
        km+=(X-x)*2*Math.PI*mean*R*R;
      }else{
        const phi=lat(y),Phi=lat(Y),d=(X-x)*Math.PI;
        const h=Math.sin((Phi-phi)/2)**2+Math.cos(phi)*Math.cos(Phi)*Math.sin(d)**2;
        km+=2*R*Math.asin(Math.sqrt(Math.max(0,Math.min(1,h))));
      }
    }
  }
  km=Math.abs(km);
  if(area){const surface=4*Math.PI*R*R;km%=surface;km=Math.min(km,surface-km);}
  const factor=imperial?(area?MILE*MILE:MILE):1;
  return {kind:area?'area':'length',value:km/factor,valueKm:km,unit:area?(imperial?'mi²':'km²'):(imperial?'mi':'km')};
}
export function measurementText(m){
  const number=m.value>0&&m.value<.01?'<0.01':m.value.toLocaleString('en-US',{maximumFractionDigits:2});
  return `${number} ${m.unit}`;
}
export function shapeLabel(a,route){
  return [a.showLabel&&a.label,a.showMeasurement&&measurementText(measureShape(a,route))].filter(Boolean).join(' · ');
}
export function validateShapeMeasurement(a){
  if(a.measurementOnly!==undefined&&typeof a.measurementOnly!=='boolean')throw Error('Invalid measurement display.');
  if(a.showMeasurement!==undefined&&typeof a.showMeasurement!=='boolean')throw Error('Invalid measurement label.');
  if(a.measurementUnit!==undefined&&!['metric','imperial'].includes(a.measurementUnit))throw Error('Invalid measurement units.');
}
// Return a resized copy. The caller commits it only after all limits are checked.
// Arrows stay anchored at their first point; zones scale around their vertex center.
export function resizeShape(a,target,routeFor){
  if(!Number.isFinite(target)||target<.01)throw Error('Enter a length or area of at least 0.01.');
  const area=zone(a),points=(a.path||[]).map(p=>({...p}));
  if(points.length<(area?3:2))throw Error(area?'Draw at least three points for an area.':'Draw at least two points for a length.');
  const current=measureShape(a,routeFor(a));
  if(current.value<1e-9)throw Error('Draw a non-zero length or area before resizing.');
  const world=[];for(const p of points){let x=(p.lon+180)/360;if(world.length)x+=Math.round(world.at(-1).x-x);world.push({x,y:(1-Math.asinh(Math.tan(Math.max(-85,Math.min(85,p.lat))*RAD))/Math.PI)/2});}
  const center=area?world.reduce((sum,p)=>({x:sum.x+p.x/world.length,y:sum.y+p.y/world.length}),{x:0,y:0}):world[0];
  const yMin=(1-Math.asinh(Math.tan(85*RAD))/Math.PI)/2,yMax=1-yMin;
  let maxScale=1e6;
  const span=Math.max(...world.map(p=>p.x))-Math.min(...world.map(p=>p.x));
  if(span)maxScale=Math.min(maxScale,.499/span);
  for(const p of world){const dx=p.x-center.x,dy=p.y-center.y;if(dx)maxScale=Math.min(maxScale,.499/Math.abs(dx));if(dy)maxScale=Math.min(maxScale,(dy>0?yMax-center.y:center.y-yMin)/Math.abs(dy));}
  const at=scale=>({...a,path:world.map((p,i)=>{
    const x=center.x+(p.x-center.x)*scale,y=center.y+(p.y-center.y)*scale;
    const lon=x*360-180;
    return {...points[i],lon:((lon+180)%360+360)%360-180,lat:lat(y)/RAD};
  })});
  const value=scale=>measureShape(at(scale),routeFor(at(scale))).value;
  const maxValue=value(maxScale);
  if(target>maxValue*(1+1e-8))throw Error('That size extends beyond the map limits. Choose a smaller value.');
  let lo=0,hi=maxScale;
  for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(value(mid)<target)lo=mid;else hi=mid;}
  const resized=at((lo+hi)/2);
  if(Math.abs(measureShape(resized,routeFor(resized)).value-target)>Math.max(.0001,target*.0001))throw Error('That size cannot be fitted here. Choose a smaller value.');
  return resized.path;
}
