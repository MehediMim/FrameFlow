const externalUrls = value => [...value.matchAll(/url\(([^)]*)\)/gi)].some(m => !m[1].trim().replace(/^['"]|['"]$/g, '').startsWith('#'));
/** Rasterize uploaded artwork once; saved projects and exports need no external files. */
export async function importObjectImage(file, max = 1024) {
  const svg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
  if (!svg && !/^image\//.test(file.type)) throw Error('Choose an SVG, PNG or other image file.');
  if (file.size > 15e6) throw Error('That image is larger than 15 MB.');
  let source = file;
  if (svg) {
    const doc = new DOMParser().parseFromString(await file.text(), 'image/svg+xml');
    const root = doc.documentElement;
    if (root.localName !== 'svg' || doc.querySelector('parsererror')) throw Error('That SVG could not be read.');
    for (const el of [root, ...root.querySelectorAll('*')]) {
      if (['script', 'foreignObject', 'iframe', 'animate', 'animateTransform', 'set'].includes(el.localName)) { el.remove(); continue; }
      for (const attr of [...el.attributes]) {
        if (/^on/i.test(attr.name)) el.removeAttributeNode(attr);
        else if ((/href$/i.test(attr.name) && !attr.value.startsWith('#')) || externalUrls(attr.value)) throw Error('Embed SVG artwork without linked images or external resources.');
      }
    }
    for (const style of root.querySelectorAll('style')) if (/@import/i.test(style.textContent) || externalUrls(style.textContent)) throw Error('Embed SVG artwork without external styles or fonts.');
    const box = root.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number);
    const width = parseFloat(root.getAttribute('width')), height = parseFloat(root.getAttribute('height'));
    const intrinsic = width > 0 && height > 0 && !/%/.test((root.getAttribute('width') || '') + (root.getAttribute('height') || ''));
    const ratio = intrinsic ? width / height : box?.length === 4 && box[2] > 0 && box[3] > 0 ? box[2] / box[3] : 1;
    // Give dimensionless SVGs a viewport and retain detail from small vector files.
    if (!root.hasAttribute('viewBox') && intrinsic) root.setAttribute('viewBox', `0 0 ${width} ${height}`);
    root.setAttribute('width', String(max * Math.min(1, ratio)));
    root.setAttribute('height', String(max / Math.max(1, ratio)));
    source = new Blob([new XMLSerializer().serializeToString(root)], { type: 'image/svg+xml' });
  }
  const url = URL.createObjectURL(source);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(Error('That image could not be read.')); i.src = url; });
    if (!img.naturalWidth || !img.naturalHeight) throw Error('That image has no visible dimensions.');
    const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight)), canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(img.naturalWidth * k)); canvas.height = Math.max(1, Math.round(img.naturalHeight * k));
    canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
    const out = canvas.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', .88);
    if (out.length > 1.9e6) throw Error('That image is too detailed. Try a smaller one.');
    return out;
  } finally { URL.revokeObjectURL(url); }
}
