// Move absolute movement keys with their clip; clamp them when trimming it.
export function retimeMapItem(item, start, duration, moveKeys = true) {
  if (item.fullTimelineCamera) return;
  const shift = moveKeys ? start - item.start : 0;
  if (item.sourceStart !== undefined) {
    item.sourceStart += shift;
    for (const field of ['animStart', 'animEnd', 'moveStart', 'moveEnd']) if (item[field] !== undefined) item[field] += shift;
    for (const field of ['cameraKeys', 'objectKeys', 'pathKeys', 'groupKeys', 'lightingKeys']) for (const key of item[field] || []) key.frame += shift;
    item.start = start; item.dur = duration;
    return;
  }
  for (const keyName of ['cameraKeys','objectKeys','groupKeys', 'lightingKeys','pathKeys']) if (item[keyName]) {
    const merged = new Map();
    for (const key of item[keyName]) {
      const frame = Math.max(start, Math.min(start + duration, key.frame + shift));
      merged.set(frame, keyName==='pathKeys'?{frame,path:structuredClone(key.path)}:{ frame, values: { ...merged.get(frame)?.values, ...key.values } });
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
  const start = item.sourceStart ?? item.start;
  return { start: item.animStart ?? item.moveStart ?? start, end: item.animEnd ?? item.moveEnd ?? start + (item.animDur ?? item.sourceDur ?? item.dur) };
}

// Retain the source clock so cutting a clip never restarts its animation.
export function splitMapItem(item, frame, id) {
  if (item.fullTimelineCamera) return null;
  if (!Number.isSafeInteger(frame) || frame <= item.start || frame >= item.start + item.dur) return null;
  const right = structuredClone(item), end = item.start + item.dur;
  item.sourceStart ??= item.start; item.sourceDur ??= item.dur;
  right.sourceStart = item.sourceStart; right.sourceDur = item.sourceDur;
  item.dur = frame - item.start;
  right.start = frame; right.dur = end - frame; right.id = id;
  return right;
}

export function mapSourceItem(item) {
  return item.sourceStart === undefined ? item : { ...item, clipStart: item.start, clipEnd: item.start + item.dur, start: item.sourceStart, dur: item.sourceDur };
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

