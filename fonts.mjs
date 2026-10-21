// Font loading and picker utilities for Map Studio.
export const FONT_GROUPS = ['Basic', 'Sans-serif', 'Serif', 'Display & handwriting', 'Monospace', 'Bangla (বাংলা)'];
export const FONTS = [
  { n: 'Arial', g: 'sans-serif', c: 0, sys: 1 }, { n: 'Verdana', g: 'sans-serif', c: 0, sys: 1 }, { n: 'Trebuchet MS', g: 'sans-serif', c: 0, sys: 1 },
  { n: 'Georgia', g: 'serif', c: 0, sys: 1 }, { n: 'Times New Roman', g: 'serif', c: 0, sys: 1 }, { n: 'Courier New', g: 'monospace', c: 0, sys: 1 }, { n: 'Impact', g: 'sans-serif', c: 0, sys: 1 },
  { n: 'Inter', g: 'sans-serif', c: 1, w: '400;600;700;800' }, { n: 'Poppins', g: 'sans-serif', c: 1, w: '400;600;700;800' }, { n: 'Montserrat', g: 'sans-serif', c: 1, w: '400;600;700;800' },
  { n: 'Roboto', g: 'sans-serif', c: 1, w: '400;700' }, { n: 'Open Sans', g: 'sans-serif', c: 1, w: '400;600;700;800' }, { n: 'Lato', g: 'sans-serif', c: 1, w: '400;700' },
  { n: 'DM Sans', g: 'sans-serif', c: 1, w: '400;600;700' }, { n: 'Manrope', g: 'sans-serif', c: 1, w: '400;600;700;800' }, { n: 'Space Grotesk', g: 'sans-serif', c: 1, w: '400;600;700' },
  { n: 'Raleway', g: 'sans-serif', c: 1, w: '400;600;700;800' }, { n: 'Nunito', g: 'sans-serif', c: 1, w: '400;600;700;800' }, { n: 'Oswald', g: 'sans-serif', c: 1, w: '400;600;700' },
  { n: 'Playfair Display', g: 'serif', c: 2, w: '400;600;700;800' }, { n: 'Merriweather', g: 'serif', c: 2, w: '400;700' }, { n: 'Lora', g: 'serif', c: 2, w: '400;600;700' },
  { n: 'Source Serif 4', g: 'serif', c: 2, w: '400;600;700' }, { n: 'Cinzel', g: 'serif', c: 2, w: '400;600;700;800' },
  { n: 'Bebas Neue', g: 'sans-serif', c: 3, w: '400' }, { n: 'Anton', g: 'sans-serif', c: 3, w: '400' }, { n: 'Archivo Black', g: 'sans-serif', c: 3, w: '400' },
  { n: 'Abril Fatface', g: 'serif', c: 3, w: '400' }, { n: 'Lobster', g: 'cursive', c: 3, w: '400' }, { n: 'Pacifico', g: 'cursive', c: 3, w: '400' },
  { n: 'Caveat', g: 'cursive', c: 3, w: '400;600;700' }, { n: 'Permanent Marker', g: 'cursive', c: 3, w: '400' }, { n: 'Bangers', g: 'cursive', c: 3, w: '400' },
  { n: 'Roboto Mono', g: 'monospace', c: 4, w: '400;700' }, { n: 'JetBrains Mono', g: 'monospace', c: 4, w: '400;700;800' },
  { n: 'Headline Bangla Regular Unicode', g: 'sans-serif', c: 5, css: 'https://db.onlinewebfonts.com/c/34f489006eb9119cd72ec882cf0f41a8?family=Headline+Bangla+Regular+Unicode' },
  { n: 'Hind Siliguri', g: 'sans-serif', c: 5, w: '400;600;700' }, { n: 'Noto Sans Bengali', g: 'sans-serif', c: 5, w: '400;600;700;800' }, { n: 'Noto Serif Bengali', g: 'serif', c: 5, w: '400;600;700;800' },
  { n: 'Baloo Da 2', g: 'sans-serif', c: 5, w: '400;600;700;800' }, { n: 'Anek Bangla', g: 'sans-serif', c: 5, w: '400;600;700;800' }, { n: 'Tiro Bangla', g: 'serif', c: 5, w: '400' },
  { n: 'Mina', g: 'sans-serif', c: 5, w: '400;700' }, { n: 'Galada', g: 'cursive', c: 5, w: '400' },
  // Newspaper faces (used by Paper Studio)
  { n: 'UnifrakturCook', g: 'serif', c: 3, w: '700' }, { n: 'Old Standard TT', g: 'serif', c: 2, w: '400;700' }, { n: 'Libre Baskerville', g: 'serif', c: 2, w: '400;700' },
  { n: 'Special Elite', g: 'monospace', c: 4, w: '400' }, { n: 'DM Serif Display', g: 'serif', c: 3, w: '400' }, { n: 'Rozha One', g: 'serif', c: 3, w: '400' },
];
const FONT_BY = Object.fromEntries(FONTS.map(f => [f.n, f]));
/** Strips characters that could break a CSS font string; falls back to Arial. */
export function cleanFont(name, fallback = 'Arial') { const s = String(name ?? '').replace(/["'\\;{}<>\r\n]/g, '').trim().slice(0, 60); return s || fallback; }
/** CSS font-family list for canvas/DOM, e.g. `"Poppins", sans-serif`. */
export function fontStack(name) { const n = cleanFont(name), f = FONT_BY[n]; return `"${n}", ${f?.g || 'sans-serif'}`; }
export const isKnownFont = name => Object.hasOwn(FONT_BY, cleanFont(name));

const fontJobs = new Map();
/** Loads a font from Google Fonts (any family name works; installed fonts need nothing). Resolves true/false, never rejects. */
export function loadFont(name) {
  const n = cleanFont(name), f = FONT_BY[n];
  if (typeof document === 'undefined' || f?.sys) return Promise.resolve(true);
  if (fontJobs.has(n)) return fontJobs.get(n);
  const job = new Promise(resolve => {
    const fam = encodeURIComponent(n).replace(/%20/g, '+');
    const attempt = spec => {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = f?.css || `https://fonts.googleapis.com/css2?family=${fam}${spec}&display=swap`;
      link.onload = () => Promise.all((f?.css ? [400] : [400, 600, 700, 800]).map(w => document.fonts.load(`${w} 24px "${n}"`, 'অআকখ বাংলা ১২৩'))).then(() => resolve(true), () => resolve(false));
      link.onerror = () => { link.remove(); if (!f?.css && spec) attempt(''); else resolve(false); };
      document.head.appendChild(link);
    };
    attempt(f?.w ? `:wght@${f.w}` : ':wght@400;600;700;800');
  });
  fontJobs.set(n, job); return job;
}
export const loadFonts = names => Promise.all([...new Set(names.map(x => cleanFont(x)))].map(loadFont));

const escHtml = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** <select> + optional custom-name box. Pair with bindFontPicker(). */
export function fontPickerHtml(id, label, value) {
  const cur = cleanFont(value), known = isKnownFont(cur);
  const groups = FONT_GROUPS.map((g, i) => `<optgroup label="${escHtml(g)}">${FONTS.filter(f => f.c === i).map(f => `<option value="${escHtml(f.n)}" ${f.n === cur ? 'selected' : ''}>${escHtml(f.n)}</option>`).join('')}</optgroup>`).join('');
  return `<label>${label}<select id="${id}">${groups}<option value="__custom" ${known ? '' : 'selected'}>Custom font name…</option></select></label>` +
    `<label id="${id}CustomRow" style="${known ? 'display:none' : ''}">Font name<input id="${id}Custom" maxlength="60" value="${known ? '' : escHtml(cur)}" placeholder="Any Google Font, or one installed on this computer"></label>`;
}
/** Calls onPick(fontName) when the person chooses a listed font or finishes typing a custom one. */
export function bindFontPicker(id, onPick) {
  const sel = document.getElementById(id), row = document.getElementById(id + 'CustomRow'), box = document.getElementById(id + 'Custom');
  sel.onchange = () => { if (sel.value === '__custom') { row.style.display = ''; box.focus(); return; } row.style.display = 'none'; onPick(sel.value); };
  box.onchange = () => { const n = cleanFont(box.value, ''); if (n) onPick(n); };
}
