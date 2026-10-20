// Move absolute movement keys with their clip; clamp them when trimming it.
export function retimeMapItem(item, start, duration, moveKeys = true) {
  const shift = moveKeys ? start - item.start : 0;
  for (const keyName of ['cameraKeys','objectKeys']) if (item[keyName]) {
    const merged = new Map();
    for (const key of item[keyName]) {
      const frame = Math.max(start, Math.min(start + duration, key.frame + shift));
      merged.set(frame, { frame, values: { ...merged.get(frame)?.values, ...key.values } });
    }
    item[keyName] = [...merged.values()].sort((a, b) => a.frame - b.frame);
  }
  if (item.animStart !== undefined) {
    item.animStart = Math.max(start, Math.min(start + duration - 1, item.animStart + shift));
    item.animEnd = Math.max(item.animStart + 1, Math.min(start + duration, item.animEnd + shift));
    item.animDur = item.animEnd - item.animStart;
  }
  if (item.moveStart !== undefined) {
    item.moveStart = Math.max(start, Math.min(start + duration - 1, item.moveStart + shift));
    item.moveEnd = Math.max(item.moveStart + 1, Math.min(start + duration, item.moveEnd + shift));
  }
  item.start = start;
  item.dur = duration;
}
export function animationKeysOf(item) {
  return { start: item.animStart ?? item.moveStart ?? item.start, end: item.animEnd ?? item.moveEnd ?? item.start + (item.animDur ?? item.dur) };
}

export function setAnimationKey(item, key, frame) {
  const keys = animationKeysOf(item), finish = item.start + item.dur;
  const start = Math.max(item.start, Math.min(finish - 1, keys.start));
  const end = Math.max(start + 1, Math.min(finish, keys.end));
  item.animStart = key === 'animationStart' ? Math.max(item.start, Math.min(end - 1, Math.round(frame))) : start;
  item.animEnd = key === 'animationEnd' ? Math.max(start + 1, Math.min(finish, Math.round(frame))) : end;
  item.animDur = item.animEnd - item.animStart;
  delete item.moveStart; delete item.moveEnd;
}

