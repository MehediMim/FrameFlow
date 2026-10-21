import { OBJECT_ICONS } from './map-objects.mjs';

// Cache a static frame of the actual vector artwork, including tall masts/tools.
const previews = new Map();
export function objectPreview(glyph) {
  if (previews.has(glyph)) return previews.get(glyph);
  const icon = OBJECT_ICONS[glyph];
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 224;
  const c = canvas.getContext('2d');
  c.translate(112, 140);
  if (icon?.draw) {
    c.save(); icon.draw(c, 26, icon.color, 0); c.restore();
  } else {
    // Image-based objects have no artwork until the user supplies an image.
    c.strokeStyle = '#b6cbd2'; c.lineWidth = 3;
    c.strokeRect(-27, -34, 54, 44);
    c.beginPath(); c.moveTo(-23, 6); c.lineTo(-5, -15); c.lineTo(5, -4); c.lineTo(15, -16); c.lineTo(24, 6); c.stroke();
    c.beginPath(); c.arc(12, -23, 4, 0, Math.PI * 2); c.stroke();
    if (glyph === 'banner') { c.beginPath(); c.moveTo(-31, -42); c.lineTo(-31, 27); c.stroke(); }
  }
  // Fit the visible silhouette so a person, a wide vehicle, and a tall ship
  // share the same readable thumbnail size without cutting off their details.
  const pixels = c.getImageData(0, 0, 224, 224).data;
  let left = 224, top = 224, right = 0, bottom = 0;
  for (let y = 0; y < 224; y++) for (let x = 0; x < 224; x++) {
    if (pixels[(y * 224 + x) * 4 + 3] < 8) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  const thumb = document.createElement('canvas'); thumb.width = thumb.height = 112;
  if (right > left && bottom > top) {
    const w = right - left, h = bottom - top, scale = 96 / Math.max(w, h);
    thumb.getContext('2d').drawImage(canvas, left, top, w, h, (112 - w * scale) / 2, (112 - h * scale) / 2, w * scale, h * scale);
  }
  const url = thumb.toDataURL(); previews.set(glyph, url); return url;
}
export function paintObjectPreviews(root) {
  for (const img of root.querySelectorAll('img[data-object-preview]')) img.src = objectPreview(img.dataset.objectPreview);
}
