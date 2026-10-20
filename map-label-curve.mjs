/** Lay grapheme clusters along a circular baseline, centered at its midpoint. */
export function curvedGlyphs(text, measure, spacing, degrees) {
  const chars=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(text)].map(s=>s.segment):Array.from(text);
  const widths=chars.map(measure),width=widths.reduce((a,b)=>a+b,0)+Math.max(0,chars.length-1)*spacing;
  const sweep=degrees*Math.PI/180,radius=Math.abs(sweep)>1e-6?width/Math.abs(sweep):Infinity,sign=Math.sign(sweep)||1;
  let offset=-width/2;
  return chars.map((char,i)=>{const distance=offset+widths[i]/2,theta=distance/radius;offset+=widths[i]+spacing;
    return {char,x:Number.isFinite(radius)?radius*Math.sin(theta):distance,y:Number.isFinite(radius)?sign*radius*(1-Math.cos(theta)):0,angle:sign*theta,width:widths[i]};});
}
/** Crop normalized image coordinates to fill a map rectangle. */
export function flagImageCrop(imageAspect, mapAspect, fit='cover', zoom=1, x=0, y=0) {
  const w=(fit==='stretch'?1:Math.min(1,mapAspect/imageAspect))/zoom,h=(fit==='stretch'?1:Math.min(1,imageAspect/mapAspect))/zoom;
  return {x:(1-w)*(x+100)/200,y:(1-h)*(y+100)/200,w,h};
}
const flagPartsCache=new WeakMap();
/** Keep remote islands from shrinking a flag's mainland placement. */
export function flagFeatureParts(feature) {
  if(flagPartsCache.has(feature))return flagPartsCache.get(feature);
  const main=feature.mainBox||feature.bbox,parts=[],land=[];
  for(const ring of feature.rings){
    if(ring.hole)continue;
    const b=[Infinity,Infinity,-Infinity,-Infinity];
    for(let i=0;i<ring.n;i++){const x=ring.xy[2*i],y=ring.xy[2*i+1];b[0]=Math.min(b[0],x);b[1]=Math.min(b[1],y);b[2]=Math.max(b[2],x);b[3]=Math.max(b[3],y);}
    if(b[0]>=main[0]-1e-10&&b[1]>=main[1]-1e-10&&b[2]<=main[2]+1e-10&&b[3]<=main[3]+1e-10)land.push(ring);
    else parts.push({box:b,rings:[ring]});
  }
  if(land.length)parts.unshift({box:main,rings:land});
  flagPartsCache.set(feature,parts);return parts;
}
