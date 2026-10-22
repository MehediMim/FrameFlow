import { setIconButton } from './interface-icons.mjs';
// Intervals use an exclusive end so adjacent clips can occupy the same lane.
export function packTimeline(clips) {
  const ends = [], lanes = new Map();
  for (const c of [...clips].sort((a, b) => a.start - b.start || a.end - b.end)) {
    let lane = ends.findIndex(end => end <= c.start + 1e-7);
    if (lane < 0) lane = ends.length;
    ends[lane] = c.end; lanes.set(c.id, lane);
  }
  return { lanes, count: Math.max(1, ends.length) };
}

export function magneticDelta(delta, start, end, mode, targets, threshold) {
  const edges = mode === 'move' ? [start, end] : [mode === 'left' || mode === 'l' ? start : end];
  let correction = 0, distance = threshold + 1e-9;
  for (const edge of edges) for (const target of targets) {
    const d = target - (edge + delta);
    if (Math.abs(d) < distance) { distance = Math.abs(d); correction = d; }
  }
  return delta + correction;
}

const clipSelector = '[data-clip],[data-mclip],[data-pclip],[data-camera-clip],[data-audio-clip]';
export function snapTimelineDelta(tracks, delta, start, end, mode, id, last, fps, event) {
  if (!tracks || event?.altKey || tracks.closest('.timeline')?.dataset.magnetic === 'false') return delta;
  const targets = [0, last], width = tracks.getBoundingClientRect().width || 1;
  for (const clip of tracks.querySelectorAll(clipSelector)) {
    if (Object.values(clip.dataset).includes(id)) continue;
    const left = parseFloat(clip.style.left) / 100 * last;
    const right = clip.style.width ? left + parseFloat(clip.style.width) / 100 * last : (1 - parseFloat(clip.style.right) / 100) * last;
    if (Number.isFinite(left)) targets.push(left);
    if (Number.isFinite(right)) targets.push(right);
  }
  const head = tracks.querySelector('#playhead,.m-playhead');
  if (head) targets.push(parseFloat(head.style.left) / 100 * last);
  // Only nearby second marks are needed, even in a very long project.
  for (const edge of [start, end]) targets.push(Math.round((edge + delta) / fps) * fps);
  return Math.round(magneticDelta(delta, start, end, mode, targets.filter(Number.isFinite), 8 / width * last));
}

export function installMagneticTimeline(timeline) {
  const rows = timeline.querySelector('#trackRows,#mTrackRows,#pTrackRows');
  const labels = timeline.querySelector('#trackLabels,#mTrackLabels,#pTrackLabels');
  if (!rows || !labels) return;
  timeline.dataset.magnetic = 'true';
  const toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'ff-magnet-toggle';
  toggle.setAttribute('aria-label', 'Magnetic snapping');
  const renderState = () => {
    const enabled = timeline.dataset.magnetic === 'true';
    setIconButton(toggle, 'magnet', 'Magnetic snapping');
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.title = `Magnetic snapping ${enabled ? 'on' : 'off'}. Snap to clips, playhead and seconds. Hold Alt while dragging to bypass.`;
  };
  toggle.onclick = () => { timeline.dataset.magnetic = String(timeline.dataset.magnetic !== 'true'); renderState(); };
  renderState();
  timeline.querySelector('.timeline-tools')?.prepend(toggle);
  // Empty space remains scrubbable after the individual rows share lanes.
  rows.addEventListener('pointerdown', event => {
    if (event.target !== rows || event.button !== 0) return;
    timeline.querySelector('#ruler,#mRuler,#pRuler')?.dispatchEvent(new PointerEvent('pointerdown', {
      clientX: event.clientX, clientY: event.clientY, button: 0, pointerId: event.pointerId, bubbles: true,
    }));
  });
  const groupOf = row => {
    if(row.hasAttribute('data-audio-row'))return 'Audio';
    if(row.hasAttribute('data-cam-select')||row.querySelector('.t-shot'))return 'Camera';
    if(row.hasAttribute('data-mrow')){
      if(row.querySelector('.t-highlight,.t-border'))return 'Land';
      if(row.querySelector('.t-object,.t-group,.t-plane'))return 'Object';
      if(row.querySelector('.t-pin,.t-label'))return 'Label';
      if(row.querySelector('.t-shape'))return 'Shape';
      if(row.querySelector('.t-effect'))return 'Effect';
    }
    return 'Subject';
  };
  function layout() {
    observer.disconnect();
    rows.querySelectorAll('.ff-track-heading').forEach(el => el.remove());
    labels.querySelectorAll('.ff-track-heading').forEach(el => el.remove());
    const entries = [...rows.children].map((row, id) => {
      const clip = row.querySelector(clipSelector), left = parseFloat(clip?.style.left) || 0;
      const end = clip?.style.width ? left + parseFloat(clip.style.width) : 100 - (parseFloat(clip?.style.right) || 0);
      return { id, row, label: labels.children[id], group: groupOf(row), start: left, end };
    }).filter(entry=>!entry.row.hidden&&!entry.label?.hidden);
    let top = 0;
    for (const group of ['Camera', 'Land', 'Object', 'Label', 'Shape', 'Effect', 'Subject', 'Audio']) {
      const members = entries.filter(e => e.group === group);if(!members.length)continue;
      const packed = packTimeline(members);
      const representatives = new Map();
      for (const entry of members) {
        const lane = packed.lanes.get(entry.id);
        if (!representatives.has(lane) || entry.row.classList.contains('selected') || entry.row.querySelector('.selected')) representatives.set(lane, entry);
        Object.assign(entry.row.style, { position: 'absolute', top: `${top + lane * 32}px`, width: '100%', height: '32px', pointerEvents: 'none', background: 'transparent' });
        for (const child of entry.row.children) child.style.pointerEvents = 'auto';
      }
      for (const entry of members) if (entry.label) {
        Object.assign(entry.label.style, { position: 'absolute', top: `${top + packed.lanes.get(entry.id) * 32}px`, width: '100%', height: '32px', display: representatives.get(packed.lanes.get(entry.id)) === entry ? '' : 'none' });
      }
      top += packed.count * 32;
    }
    for (const parent of [rows, labels]) Object.assign(parent.style, { position: 'relative', height: `${top}px` });
    observer.observe(rows, { childList: true, subtree: true, attributes: true, attributeFilter: ['style','hidden'] });
  }
  const observer = new MutationObserver(layout);
  layout();
}
