// Shared geometry for multi-region items and partial border animation.
import { polygonFeature } from './map-area-selection.mjs';
export function detailCountriesOf(area) {
 return [...new Set([...(area.detailCountries || []), ...(area.mode === 'country' ? [area.country] : [])])];
}
export function targetMembers(target) { return target?.kind === 'regions' ? target.members : target ? [target] : []; }
export function targetFeatures(geo, target) {
 if(target?.kind==='polygon'){const f=featureForTarget(geo,target);return f?[f]:[];}
 const members=targetMembers(target),countries=new Set(members.filter(t=>t.kind==='country').map(t=>t.name));
 return [...new Set(members.filter(t=>t.kind!=='region'||!countries.has(t.country)).flatMap(t => t.kind === 'all'
  ? t.country ? Object.values(geo.details?.get(t.country)?.levels || {}).flat().filter(f => !t.level || f.level === t.level) : geo.hi.features
  : [t.kind==='country' ? geo.details?.get(t.name)?.country || geo.byName.get(t.name) : geo.byName.get(t.name)].filter(Boolean)))];
}
const groupCache=new WeakMap();
export function featureForTarget(geo,target){
 if(target?.kind==='polygon'){
  const signature=JSON.stringify([target.name,target.path]),prior=groupCache.get(target);
  if(prior?.signature===signature)return prior.feature;
  const feature=polygonFeature(target);groupCache.set(target,{signature,feature});return feature;
 }
 if(target?.kind!=='regions')return targetFeatures(geo,target)[0];
 const features=targetFeatures(geo,target),prior=groupCache.get(target);
 if(prior&&prior.name===target.name&&prior.features.length===features.length&&features.every((f,i)=>f===prior.features[i]))return prior.feature;
 const feature=combinedFeature(features,target.name);groupCache.set(target,{features,name:target.name,feature});return feature;
}

// Cancel matching shared edges and join the remaining edges into exterior rings.
// Detail packs preserve shared vertices; rounding absorbs projection noise.
export function combinedFeature(features, name='Selected regions') {
 if (!features.length) return null;
 const edges=new Map(), point=(x,y)=>`${x.toFixed(8)},${y.toFixed(8)}`;
 for(const f of features)for(const r of f.rings)for(let i=0;i<r.n-1;i++){
  const a=[r.xy[i*2],r.xy[i*2+1]],b=[r.xy[(i+1)*2],r.xy[(i+1)*2+1]],ka=point(...a),kb=point(...b);
  if(ka===kb)continue;
  const key=ka<kb?ka+'|'+kb:kb+'|'+ka;
  if(edges.has(key))edges.delete(key);else edges.set(key,{a,b,ka,kb});
 }
 const adjacency=new Map();
 for(const edge of edges.values())for(const key of [edge.ka,edge.kb]){if(!adjacency.has(key))adjacency.set(key,new Set());adjacency.get(key).add(edge)}
 const remaining=new Set(edges.values()),rings=[];
 while(remaining.size){
  const edge=remaining.values().next().value,coords=[...edge.a],start=edge.ka;let key=start,next=edge;
  while(next){
   remaining.delete(next);const forward=next.ka===key;coords.push(...(forward?next.b:next.a));key=forward?next.kb:next.ka;
   if(key===start)break;
   next=[...(adjacency.get(key)||[])].find(e=>remaining.has(e));
  }
  if(coords.length>=6){let area=0;for(let i=0;i<coords.length-2;i+=2)area+=coords[i]*coords[i+3]-coords[i+2]*coords[i+1];rings.push({xy:new Float64Array(coords),n:coords.length/2,area:Math.abs(area/2),hole:false})}
 }
 const bbox=[Math.min(...features.map(f=>f.bbox[0])),Math.min(...features.map(f=>f.bbox[1])),Math.max(...features.map(f=>f.bbox[2])),Math.max(...features.map(f=>f.bbox[3]))];
 const {_rr,_anchor,_revealRadius,...base}=features[0];
 return {...base,name,rings,bbox,mainBox:bbox,cx:(bbox[0]+bbox[2])/2,cy:(bbox[1]+bbox[3])/2};
}

export function borderRingOf(feature,index){
 if(Number.isInteger(index)&&feature.rings[index])return index;
 return feature.rings.reduce((best,r,i)=>!r.hole&&r.area>(feature.rings[best]?.area||0)?i:best,0);
}

export function borderSection(r,from,to,progress=1,reverse=false){
 const points=[];let total=0;const cum=[0];
 for(let i=1;i<r.n;i++){total+=Math.hypot(r.xy[2*i]-r.xy[2*i-2],r.xy[2*i+1]-r.xy[2*i-1]);cum.push(total)}
 const distance=reverse?from-to:to-from,span=(Math.abs(Math.abs(distance)-1)<1e-12?1:distance<0?distance+1:distance)*progress,dir=reverse?-1:1;
 const sample=t=>{const d=((t%1)+1)%1*total;let i=1;while(i<r.n-1&&cum[i]<d)i++;const u=(d-cum[i-1])/(cum[i]-cum[i-1]||1);return [r.xy[2*i-2]+(r.xy[2*i]-r.xy[2*i-2])*u,r.xy[2*i-1]+(r.xy[2*i+1]-r.xy[2*i-1])*u]};
 if(!total)return {xy:r.xy,n:0,closed:false};
 points.push(...sample(from));
 const vertices=[];
 for(let i=1;i<r.n;i++){const t=cum[i]/total;let offset=dir*(t-from);while(offset<=0)offset+=1;if(offset<span)vertices.push({offset,i})}
 vertices.sort((a,b)=>a.offset-b.offset);for(const {i}of vertices)points.push(r.xy[2*i],r.xy[2*i+1]);
 points.push(...sample(from+dir*span));
 return {xy:new Float64Array(points),n:points.length/2,closed:span>=1};
}

export function nearestBorderPosition(feature,x,y){
 let best=null;
 feature.rings.forEach((r,ring)=>{
  let total=0;for(let i=1;i<r.n;i++)total+=Math.hypot(r.xy[2*i]-r.xy[2*i-2],r.xy[2*i+1]-r.xy[2*i-1]);
  let along=0;
  for(let i=1;i<r.n;i++){
   const ax=r.xy[2*i-2],ay=r.xy[2*i-1],dx=r.xy[2*i]-ax,dy=r.xy[2*i+1]-ay,len=Math.hypot(dx,dy),u=Math.max(0,Math.min(1,((x-ax)*dx+(y-ay)*dy)/(len*len||1))),distance=Math.hypot(x-ax-u*dx,y-ay-u*dy);
   if(!best||distance<best.distance)best={ring,position:total?(along+len*u)/total:0,distance};along+=len;
  }
 });return best;
}
