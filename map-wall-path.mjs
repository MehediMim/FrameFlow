// Place segment centers along a projected polyline, carrying geographic coordinates
// and the screen-space tangent. Repeating segments stay joined at any zoom.
export function wallPlacements(points,spacing=52,limit=1200){
  const segments=[];let total=0;
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];if(!a||!b)continue;
    const length=Math.hypot(b.x-a.x,b.y-a.y);if(length<1e-6)continue;
    segments.push({a,b,length,start:total});total+=length;
  }
  if(!total)return[];
  const count=Math.max(1,Math.min(limit,Math.ceil(total/Math.max(1,spacing)))),step=total/count,out=[];let index=0;
  for(let i=0;i<count;i++){
    const distance=(i+.5)*step;while(index<segments.length-1&&distance>segments[index].start+segments[index].length)index++;
    const {a,b,length,start}=segments[index],t=(distance-start)/length;
    out.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,X:a.X+(b.X-a.X)*t,Y:a.Y+(b.Y-a.Y)*t,angle:Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI,index:i});
  }
  return out;
}
