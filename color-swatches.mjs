// FrameFlow shared color presets. Automatically enhances every existing and future
// native color picker in Motion Studio, Map Studio, and chart/table editors.
const PRESETS = [
  ['#ffffff','White'],['#e7e9e1','Ivory'],['#a3a3a3','Gray'],['#111827','Charcoal'],
  ['#000000','Black'],['#b6f36e','Lime'],['#22c55e','Green'],['#14b8a6','Teal'],
  ['#38bdf8','Sky'],['#2563eb','Blue'],['#8b5cf6','Purple'],['#ec4899','Pink'],
  ['#ef4444','Red'],['#f97316','Orange'],['#facc15','Yellow'],['#a16207','Brown']
];
function decorate(picker) {
  if (picker.dataset.ffColorSwatches || picker.closest('.ff-palette')) return;
  picker.dataset.ffColorSwatches = 'true';
  const palette = document.createElement('span');
  palette.className = 'ff-palette';
  palette.setAttribute('role', 'group');
  palette.setAttribute('aria-label', 'Preset colors');
  const paintActive = () => {
    for (const b of palette.children) {
      const selected = b.dataset.color === picker.value.toLowerCase();
      b.classList.toggle('selected', selected);
      b.setAttribute('aria-pressed', String(selected));
    }
  };
  for (const [hex, name] of PRESETS) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'ff-color-chip';
    button.dataset.color = hex;
    button.style.setProperty('--chip-color', hex);
    button.title = `${name} · ${hex}`;
    button.setAttribute('aria-label', `${name} ${hex}`);
    button.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      if (picker.disabled || picker.value.toLowerCase() === hex) return;
      picker.value = hex;
      // Existing FrameFlow controls mostly commit edits on 'change'; dispatching
      // that event also handles dynamically rendered inspectors and undo history.
      picker.dispatchEvent(new Event('input', { bubbles: true }));
      picker.dispatchEvent(new Event('change', { bubbles: true }));
      paintActive();
    });
    palette.append(button);
  }
  picker.insertAdjacentElement('afterend', palette);
  picker.addEventListener('input', paintActive);
  picker.addEventListener('change', paintActive);
  paintActive();
}
const scan = node => {
  if (!(node instanceof Element)) return;
  if (node.matches('input[type="color"]')) decorate(node);
  node.querySelectorAll('input[type="color"]').forEach(decorate);
};
scan(document.documentElement);
new MutationObserver(records => {
  for (const record of records) for (const node of record.addedNodes) scan(node);
}).observe(document.documentElement, { childList: true, subtree: true });
