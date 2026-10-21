// Shared layer operations used by the canvas, keyboard and layer list.
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
