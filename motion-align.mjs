// FrameFlow Motion Studio: align / distribute for several selected layers.
// Geometry is pure (no DOM) so it can be tested; the bar is a small floating toolbar
// shown over the canvas while two or more layers are selected (Shift+click).

export function unionBox(boxes) {
  const x = Math.min(...boxes.map(b => b.x)), y = Math.min(...boxes.map(b => b.y));
  const r = Math.max(...boxes.map(b => b.x + b.w)), btm = Math.max(...boxes.map(b => b.y + b.h));
  return { x, y, w: r - x, h: btm - y };
}

// boxes: [{id,x,y,w,h}] in composition pixels. ref: {x,y,w,h} to align against.
export function alignDeltas(boxes, op, ref) {
  const out = new Map();
  for (const b of boxes) {
    let dx = 0, dy = 0;
    if (op === 'left') dx = ref.x - b.x;
    else if (op === 'hcenter') dx = ref.x + ref.w / 2 - (b.x + b.w / 2);
    else if (op === 'right') dx = ref.x + ref.w - (b.x + b.w);
    else if (op === 'top') dy = ref.y - b.y;
    else if (op === 'vmiddle') dy = ref.y + ref.h / 2 - (b.y + b.h / 2);
    else if (op === 'bottom') dy = ref.y + ref.h - (b.y + b.h);
    out.set(b.id, { dx, dy });
  }
  return out;
}

// Equal gaps between layers, keeping the outer edges of the selection where they are.
export function distributeDeltas(boxes, axis) {
  const out = new Map(boxes.map(b => [b.id, { dx: 0, dy: 0 }]));
  if (boxes.length < 3) return out;
  const pos = axis === 'h' ? 'x' : 'y', size = axis === 'h' ? 'w' : 'h', key = axis === 'h' ? 'dx' : 'dy';
  const sorted = [...boxes].sort((a, b) => (a[pos] + a[size] / 2) - (b[pos] + b[size] / 2));
  const start = Math.min(...boxes.map(b => b[pos])), end = Math.max(...boxes.map(b => b[pos] + b[size]));
  const gap = (end - start - sorted.reduce((t, b) => t + b[size], 0)) / (sorted.length - 1);
  let cursor = start;
  for (const b of sorted) { out.get(b.id)[key] = cursor - b[pos]; cursor += b[size] + gap; }
  return out;
}

const ICON = (inner) => `<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true">${inner}</svg>`;
const R = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1" stroke="none"/>`;
const ICONS = {
  left: ICON(`<path d="M3.5 3v18" fill="none"/>${R(6.5, 6, 13, 4)}${R(6.5, 14, 8, 4)}`),
  hcenter: ICON(`<path d="M12 3v18" fill="none"/>${R(5, 6, 14, 4)}${R(8, 14, 8, 4)}`),
  right: ICON(`<path d="M20.5 3v18" fill="none"/>${R(4.5, 6, 13, 4)}${R(9.5, 14, 8, 4)}`),
  top: ICON(`<path d="M3 3.5h18" fill="none"/>${R(6, 6.5, 4, 13)}${R(14, 6.5, 4, 8)}`),
  vmiddle: ICON(`<path d="M3 12h18" fill="none"/>${R(6, 5, 4, 14)}${R(14, 8, 4, 8)}`),
  bottom: ICON(`<path d="M3 20.5h18" fill="none"/>${R(6, 4.5, 4, 13)}${R(14, 9.5, 4, 8)}`),
  dh: ICON(`<path d="M3.5 3v18M20.5 3v18" fill="none"/>${R(9, 7, 6, 10)}`),
  dv: ICON(`<path d="M3 3.5h18M3 20.5h18" fill="none"/>${R(7, 9, 10, 6)}`)
};
const TITLES = {
  left: 'Align left edges', hcenter: 'Align horizontal centers', right: 'Align right edges',
  top: 'Align top edges', vmiddle: 'Align vertical middles', bottom: 'Align bottom edges',
  dh: 'Distribute horizontally (3+ layers)', dv: 'Distribute vertically (3+ layers)'
};

const CSS = `.workspace.motion-only main{position:relative}
.ff-align-bar{position:absolute;z-index:30;top:54px;left:50%;transform:translateX(-50%);display:none;align-items:center;gap:4px;padding:5px 8px;background:#1b2023f2;border:1px solid #4f6140;border-radius:10px;box-shadow:0 8px 30px #0009}
.ff-align-bar.show{display:flex}
.ff-align-bar button{padding:0;display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;background:#202428;border:1px solid #363b40;border-radius:6px;color:#d9e3d3;cursor:pointer}
.ff-align-bar button:hover{background:#2c3729;border-color:var(--accent,#b6f36e);color:var(--accent,#b6f36e)}
.ff-align-bar button:disabled{opacity:.3;pointer-events:none}
.ff-align-bar .ff-align-clear{width:auto;padding:0 9px;font-size:10px}
.ff-align-sep{width:1px;height:20px;background:#363b40;margin:0 4px}
.ff-align-bar label{display:flex;gap:5px;align-items:center;margin:0;font-size:10px;color:#98a1a8;white-space:nowrap}
.ff-align-bar select{padding:4px 6px;font-size:10px;width:auto}
.ff-align-count{font-size:10px;color:var(--accent,#b6f36e);white-space:nowrap;margin:0 4px 0 2px;font-weight:600}
.workspace.motion-only main:fullscreen .ff-align-bar{display:none!important}`;

// host: { mount, ids(), box(id), move(id,dx,dy), size(), playing(), begin(), done(), clear(), notify(msg) }
export function installAlignBar(host) {
  const mount = host.mount;
  if (!mount) return null;
  const style = document.createElement('style'); style.textContent = CSS; document.head.append(style);
  const bar = document.createElement('div');
  bar.className = 'ff-align-bar'; bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Align selected layers');
  const btn = op => `<button type="button" data-align="${op}" title="${TITLES[op]}" aria-label="${TITLES[op]}">${ICONS[op]}</button>`;
  bar.innerHTML = `<span class="ff-align-count"></span>${['left', 'hcenter', 'right'].map(btn).join('')}<span class="ff-align-sep"></span>${['top', 'vmiddle', 'bottom'].map(btn).join('')}<span class="ff-align-sep"></span>${['dh', 'dv'].map(btn).join('')}<span class="ff-align-sep"></span><label>Align to<select data-align-to><option value="selection">Selection</option><option value="canvas">Canvas</option></select></label><span class="ff-align-sep"></span><button type="button" class="ff-align-clear" data-align-clear title="Deselect extra layers (Esc)">Clear</button>`;
  mount.append(bar);
  const count = bar.querySelector('.ff-align-count'), toSel = bar.querySelector('[data-align-to]');

  function refresh() {
    const n = host.ids().length;
    const show = n >= 2 && !host.playing();
    bar.classList.toggle('show', show);
    if (!show) return;
    count.textContent = `${n} selected`;
    for (const b of bar.querySelectorAll('[data-align="dh"],[data-align="dv"]')) b.disabled = n < 3;
  }

  function run(op) {
    const boxes = host.ids().map(host.box).filter(Boolean);
    if (boxes.length < 2) { host.notify?.('Select at least two layers (Shift+click)'); return; }
    let deltas;
    if (op === 'dh' || op === 'dv') deltas = distributeDeltas(boxes, op === 'dh' ? 'h' : 'v');
    else {
      const size = host.size();
      const ref = toSel.value === 'canvas' ? { x: 0, y: 0, w: size.w, h: size.h } : unionBox(boxes);
      deltas = alignDeltas(boxes, op, ref);
    }
    if (![...deltas.values()].some(d => Math.abs(d.dx) > .01 || Math.abs(d.dy) > .01)) return; // already aligned
    host.begin();
    for (const [id, d] of deltas) if (Math.abs(d.dx) > .01 || Math.abs(d.dy) > .01) host.move(id, d.dx, d.dy);
    host.done();
  }

  bar.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.align) run(b.dataset.align);
    else if (b.hasAttribute('data-align-clear')) host.clear();
    b.blur(); // keep Space = play/pause working after a click
  });
  bar.addEventListener('pointerdown', e => e.stopPropagation());
  window.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !bar.classList.contains('show')) return;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) return;
    host.clear();
  });
  refresh();
  return { refresh };
}
