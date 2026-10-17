// Listen on the stable timeline container because selecting a row rebuilds it.
export function bindTimelineRename(root, { attribute, getItem, checkpoint, changed, pause, maxLength = 100 }) {
  if (!root) return;
  const selector = `[${attribute}]`;
  let lastTap = null, editing = null;
  function begin(row) {
    if (editing && !root.contains(editing)) editing = null;
    const id = row.getAttribute(attribute), item = getItem(id);
    const label = row.querySelector('.ff-layer-name');
    if (!item || !label || editing) return;
    pause();
    const input = document.createElement('input');
    input.className = 'ff-timeline-name-input'; input.type = 'text';
    const originalName = item.name || label.textContent;
    input.value = originalName; input.maxLength = maxLength;
    input.setAttribute('aria-label', 'Layer name');
    input.title = 'Enter to save · Escape to cancel';
    label.replaceWith(input); editing = input;
    let done = false;
    function finish(cancel = false) {
      if (done) return;
      done = true; editing = null; lastTap = null;
      const name = input.value.trim().slice(0, maxLength);
      input.replaceWith(label);
      // Empty names leave the existing name intact.
      if (!cancel && name && name !== originalName && getItem(id) === item) {
        checkpoint(); item.name = name; changed();
      }
    }
    input.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); finish(e.key === 'Escape'); }
    });
    input.addEventListener('blur', () => finish());
    input.focus(); input.select();
  }
  root.addEventListener('pointerdown', e => {
    if (e.target.closest('.ff-timeline-name-input')) { e.stopPropagation(); return; }
    const row = e.target.closest(selector);
    if (!row || !root.contains(row) || e.button !== 0 || e.target.closest('button')) { lastTap = null; return; }
    const id = row.getAttribute(attribute), now = e.timeStamp;
    if (lastTap && lastTap.id === id && now - lastTap.time < 450 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 12) {
      lastTap = null;
      e.preventDefault(); e.stopImmediatePropagation(); begin(row);
    } else lastTap = { id, time: now, x: e.clientX, y: e.clientY };
  }, true);
  for (const type of ['click', 'dblclick']) root.addEventListener(type, e => {
    if (editing && editing.closest(selector) === e.target.closest(selector)) {
      e.stopImmediatePropagation(); return;
    }
    if (type === 'dblclick') {
      const row = e.target.closest(selector);
      if (row && root.contains(row)) { e.preventDefault(); e.stopImmediatePropagation(); begin(row); }
    }
  }, true);
}
