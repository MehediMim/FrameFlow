// Shared layer operations used by the canvas, keyboard and layer list.
export function copyLayers(project,ids){
  const chosen=new Set(ids),all=[...project.shots,...project.actions];
  const roots=all.filter(a=>chosen.has(a.id)&&!a.fullTimelineCamera&&!project.actions.some(g=>g.type==='group'&&chosen.has(g.id)&&g.memberIds.includes(a.id)));
  if(!roots.length)return null;
  const included=new Set(roots.flatMap(a=>[a.id,...(a.type==='group'?a.memberIds:[])]));
  return structuredClone({roots:roots.map(a=>a.id),start:Math.min(...roots.map(a=>a.start)),shots:project.shots.filter(a=>included.has(a.id)),actions:project.actions.filter(a=>included.has(a.id))});
}
export function pasteLayers(project,clipboard,frame,createId=()=>crypto.randomUUID()){
  if(!clipboard?.roots.length)return [];
  if(!Number.isSafeInteger(frame)||frame<0)throw Error('Choose a valid timeline frame.');
  if(project.actions.length+clipboard.actions.length>200)throw Error('A map can contain up to 200 items.');
  if(project.shots.length+clipboard.shots.length>200)throw Error('A map can contain up to 200 camera layers.');
  const source=[...clipboard.shots,...clipboard.actions],existing=[...project.shots,...project.actions],ids=new Map(source.map(a=>[a.id,createId()])),delta=frame-clipboard.start;
  const ranks=new Map(mapStackOrder(clipboard.actions).map((a,i)=>[a.id,i]));
  let order=Math.max(0,...existing.map((a,i)=>a.createdOrder??i+1));
  const mapOrder=Math.max(-1,...project.actions.map((a,i)=>a.mapOrder??i))+1;
  const copies=source.map(original=>{
    const a=structuredClone(original);a.id=ids.get(original.id);a.name+=' copy';a.createdOrder=++order;
    if(a.kind!=='shot')a.mapOrder=mapOrder+ranks.get(original.id);
    // A clipped group can retain members whose source begins before its bar.
    // Keep that source clock while clipping any negative visible start.
    const start=a.start+delta;
    if(start<0){a.sourceStart??=a.start;a.sourceDur??=a.dur;a.dur=Math.max(1,start+a.dur);if(start+original.dur<=0)a.visible=false;}
    a.start=Math.max(0,start);
    for(const field of ['sourceStart','animStart','animEnd','moveStart','moveEnd'])if(a[field]!==undefined)a[field]+=delta;
    for(const field of ['cameraKeys','objectKeys','pathKeys','groupKeys','lightingKeys'])for(const key of a[field]||[])key.frame+=delta;
    if(a.memberIds)a.memberIds=a.memberIds.map(id=>ids.get(id));
    for(const field of ['planeId','attackSourceId','attackTargetId'])if(ids.has(a[field]))a[field]=ids.get(a[field]);
    if(!Number.isSafeInteger(a.start+a.dur))throw Error('Pasted layer exceeds the timeline limit.');
    return a;
  });
  const end=Math.max(...copies.map(a=>a.start+a.dur));
  if(!Number.isSafeInteger(end+15))throw Error('Pasted layers exceed the timeline limit.');
  project.shots.push(...copies.filter(a=>a.kind==='shot'));project.actions.push(...copies.filter(a=>a.kind!=='shot'));
  if(end>project.frames)project.frames=end+15;
  return clipboard.roots.map(id=>ids.get(id));
}
export function mapStackOrder(actions){
  const ranks=new Map(actions.map((a,i)=>[a.id,a.mapOrder??i]));
  const members=new Set(actions.filter(a=>a.type==='group').flatMap(a=>a.memberIds));
  return actions.filter(a=>!members.has(a.id)).sort((a,b)=>ranks.get(a.id)-ranks.get(b.id)).flatMap(a=>a.type==='group'?[a,...actions.filter(child=>a.memberIds.includes(child.id)).sort((a,b)=>ranks.get(a.id)-ranks.get(b.id))]:[a]);
}
export function arrangeLayers(project,ids,mode){
  if(!['forward','backward','front','back'].includes(mode))throw Error('Unknown arrangement');
  const members=new Set(project.actions.filter(a=>a.type==='group').flatMap(a=>a.memberIds));
  const selected=new Set(ids.map(id=>project.actions.find(a=>a.type==='group'&&a.memberIds.includes(id))?.id||id));
  const roots=mapStackOrder(project.actions).filter(a=>!members.has(a.id)&&['object','group','pin','plane','shape','effect'].includes(a.type));
  const chosen=roots.filter(a=>selected.has(a.id));if(!chosen.length)return;
  let ordered=roots;
  if(mode==='front')ordered=[...roots.filter(a=>!selected.has(a.id)),...chosen];
  else if(mode==='back')ordered=[...chosen,...roots.filter(a=>!selected.has(a.id))];
  else if(mode==='forward'){
    for(let i=ordered.length-2;i>=0;i--)if(selected.has(ordered[i].id)&&!selected.has(ordered[i+1].id))[ordered[i],ordered[i+1]]=[ordered[i+1],ordered[i]];
  }else{
    for(let i=1;i<ordered.length;i++)if(selected.has(ordered[i].id)&&!selected.has(ordered[i-1].id))[ordered[i],ordered[i-1]]=[ordered[i-1],ordered[i]];
  }
  ordered.forEach((a,i)=>a.mapOrder=i);
}
export function duplicateLayers(project, ids, createId = () => crypto.randomUUID()) {
  const selected = new Set(ids), all = [...project.shots, ...project.actions];
  const roots = all.filter(a => selected.has(a.id) && !a.fullTimelineCamera &&
    !project.actions.some(g => g.type === 'group' && selected.has(g.id) && g.memberIds.includes(a.id)));
  const count = roots.reduce((n, a) => n + (a.kind === 'shot' ? 0 : 1 + (a.type === 'group' ? a.memberIds.length : 0)), 0);
  if (project.shots.length + roots.filter(a => a.kind === 'shot').length > 200) throw Error('A map can contain up to 200 camera layers.');
  if (project.actions.length + count > 200) throw Error('A map can contain up to 200 items.');
  let order = Math.max(0, ...all.map((a, i) => a.createdOrder ?? i + 1));
  const copies = [];
  for (const layer of roots) {
    const copy = structuredClone(layer); copy.id = createId(); copy.name += ' copy'; copy.createdOrder = ++order;
    copy.mapOrder=Math.max(0,...project.actions.map((a,i)=>a.mapOrder??i))+1;
    if (layer.type === 'group') copy.memberIds = layer.memberIds.map(id => {
      const child = structuredClone(project.actions.find(a => a.id === id));
      child.id = createId(); child.createdOrder = ++order; project.actions.push(child); return child.id;
    });
    (layer.kind === 'shot' ? project.shots : project.actions).push(copy); copies.push(copy.id);
  }
  return copies;
}
export function removeLayers(project, ids) {
  const removed = new Set(ids.filter(id => !project.shots.some(s => s.id === id && s.fullTimelineCamera)));
  for (const group of project.actions) if (group.type === 'group' && removed.has(group.id)) for (const id of group.memberIds) removed.add(id);
  project.shots = project.shots.filter(a => !removed.has(a.id));
  project.actions = project.actions.filter(a => !removed.has(a.id));
  for (const group of project.actions) if (group.type === 'group') group.memberIds = group.memberIds.filter(id => !removed.has(id));
  project.actions = project.actions.filter(a => a.type !== 'group' || a.memberIds.length);
  for (const shot of project.shots) if (removed.has(shot.planeId)) shot.planeId = '';
}
