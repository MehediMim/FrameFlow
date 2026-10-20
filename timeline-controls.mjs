import { installMagneticTimeline } from './timeline-magnet.mjs';
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const paths = {
  visibility: '<path d="M2 8s3-5 6-5 6 5 6 5-3 5-6 5-6-5-6-5Z"/><circle cx="8" cy="8" r="2"/>',
  up: '<path d="m4 10 4-4 4 4"/>',
  down: '<path d="m4 6 4 4 4-4"/>',
  duplicate: '<rect x="6" y="6" width="8" height="8" rx="1"/><path d="M10 6V2H2v8h4"/>',
  delete: '<path d="M2 4h12M6 4V2h4v2M4 4l1 10h6l1-10M7 7v4M9 7v4"/>',
};
const titles = { visibility: 'Hide layer', up: 'Move layer up', down: 'Move layer down', duplicate: 'Duplicate layer', delete: 'Delete layer' };

export function installTimelineControls(spec) {
  const timeline = document.querySelector(spec.timeline), scroll = document.querySelector(spec.scroll), zoom = document.querySelector(spec.zoom);
  if (!timeline || !scroll || !zoom) return;
  const handle = document.createElement('div');
  handle.className = 'ff-timeline-resize'; handle.tabIndex = 0; handle.setAttribute('role', 'separator');
  handle.setAttribute('aria-label', 'Resize timeline. Drag up or down, or use arrow keys.'); handle.setAttribute('aria-orientation', 'horizontal');
  handle.title = 'Drag to resize timeline'; handle.innerHTML = '<span aria-hidden="true">&#8597;</span>';
  timeline.prepend(handle);
  function resize(height) {
    const max = Math.max(150, window.innerHeight - 220), next = clamp(height, 150, max);
    timeline.style.setProperty('height', `${next}px`, 'important'); timeline.style.setProperty('flex-basis', `${next}px`, 'important');
    handle.setAttribute('aria-valuemin', '150'); handle.setAttribute('aria-valuemax', String(max)); handle.setAttribute('aria-valuenow', String(Math.round(next)));
    try { localStorage.setItem(`ff-timeline-height-${spec.name}`, String(next)); } catch {}
  }
  try { const stored = Number(localStorage.getItem(`ff-timeline-height-${spec.name}`)); if (stored > 0) resize(stored); } catch {}
  let gesture = null;
  handle.onpointerdown = e => { if (e.button !== 0) return; e.preventDefault(); gesture = { y: e.clientY, height: timeline.getBoundingClientRect().height }; handle.setPointerCapture(e.pointerId); document.body.classList.add('ff-timeline-resizing'); };
  window.addEventListener('pointermove', e => { if (gesture) resize(gesture.height + gesture.y - e.clientY); });
  const end = () => { gesture = null; document.body.classList.remove('ff-timeline-resizing'); };
  window.addEventListener('pointerup', end); window.addEventListener('pointercancel', end); window.addEventListener('blur', end);
  handle.onkeydown = e => { if (['ArrowUp', 'ArrowDown'].includes(e.key)) { e.preventDefault(); resize(timeline.getBoundingClientRect().height + (e.key === 'ArrowUp' ? 20 : -20)); } };
  window.addEventListener('resize', () => { if (timeline.style.height) resize(parseFloat(timeline.style.height)); });
  zoom.max = '16';
  zoom.step = 'any';
  scroll.addEventListener('wheel', e => {
    if (!(e.ctrlKey || e.metaKey) || !e.deltaY || e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
    e.preventDefault();
    const fixed = spec.fixedWidth || 0, x = clamp(e.clientX - scroll.getBoundingClientRect().left - fixed, 0, scroll.clientWidth - fixed);
    const oldWidth = Math.max(1, scroll.scrollWidth - fixed), anchor = (scroll.scrollLeft + x) / oldWidth;
    const delta = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? scroll.clientHeight : 1);
    zoom.value = String(clamp(Number(zoom.value) * Math.exp(-delta * .002), Number(zoom.min) || 1, Number(zoom.max)));
    zoom.dispatchEvent(new Event('input', { bubbles: true }));
    scroll.scrollLeft = anchor * (scroll.scrollWidth - fixed) - x;
  }, { passive: false });

  const containers = spec.containers.map(s => document.querySelector(s)).filter(Boolean);
  function refresh() {
    observer.disconnect();
    for (const container of containers) for (const row of container.querySelectorAll(spec.rows)) {
      const id = spec.id(row), item = spec.item(id); if (!item) continue;
      row.classList.toggle('ff-layer-hidden', item.visible === false || item.muted === true);
      let actions = row.querySelector(':scope > .ff-row-actions');
      if (!actions) {
        actions = document.createElement('span'); actions.className = 'ff-row-actions';
        actions.innerHTML = Object.entries(paths).map(([action, path]) => `<button type="button" data-row-action="${action}" title="${titles[action]}" aria-label="${titles[action]}"><svg viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round">${path}</svg></button>`).join('');
        actions.onpointerdown = e => e.stopPropagation(); actions.ondblclick = e => { e.preventDefault(); e.stopPropagation(); };
        actions.onclick = e => { const b = e.target.closest('[data-row-action]'); if (!b || b.disabled) return; e.preventDefault(); e.stopPropagation(); spec.action(id, b.dataset.rowAction); };
        row.append(actions);
      }
      for (const button of actions.children) {
        const action = button.dataset.rowAction;
        button.disabled = spec.enabled ? !spec.enabled(id, action) : false;
        if (action === 'visibility') { const hidden = item.visible === false || item.muted === true; const label = item.muted !== undefined ? (hidden ? 'Unmute audio' : 'Mute audio') : (hidden ? 'Show layer' : 'Hide layer'); button.title = label; button.setAttribute('aria-label', label); button.setAttribute('aria-pressed', String(hidden)); }
      }
    }
    for (const container of containers) observer.observe(container, { childList: true, subtree: true });
  }
  const observer = new MutationObserver(refresh);
  for (const container of containers) {
    observer.observe(container, { childList: true, subtree: true });
  }
  // Let the action buttons receive clicks, while preventing the row's selection handler.
  for (const container of containers) container.addEventListener('click', e => {
    const button = e.target.closest('[data-row-action]'); if (!button || button.disabled) return;
    const row = button.closest(spec.rows); if (!row) return;
    e.preventDefault(); e.stopImmediatePropagation(); spec.action(spec.id(row), button.dataset.rowAction);
  }, true);
  for (const selector of spec.oldButtons || []) document.querySelector(selector)?.classList.add('ff-obsolete-layer-action');
  refresh();
  installMagneticTimeline(timeline);
  return { refresh };
}
