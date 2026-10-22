import { OBJECT_ICONS } from './map-objects.mjs';
import { drawIsometricObject, drawSideObject } from './map-isometric-objects.mjs';

// Cache a static frame of the actual vector artwork, including tall masts/tools.
const previews = new Map();
export function objectPreview(glyph,view='side') {
  const key=glyph+':'+view;
  if (previews.has(key)) return previews.get(key);
  const icon = OBJECT_ICONS[glyph];
  const canvas = document.createElement('canvas');
  const W=448,H=W;
  canvas.width = canvas.height = W;
  const c = canvas.getContext('2d');
  c.translate(W/2,300);
  const draw=view==='isometric'?drawIsometricObject:drawSideObject;
  draw(c,glyph,26,icon?.color);
  // Fit the visible silhouette so a person, a wide vehicle, and a tall ship
  // share the same readable thumbnail size without cutting off their details.
  const pixels = c.getImageData(0, 0, W, H).data;
  let left = W, top = H, right = 0, bottom = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (pixels[(y * W + x) * 4 + 3] < 8) continue;
    left = Math.min(left, x); top = Math.min(top, y);
    right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
  }
  const thumb = document.createElement('canvas'); thumb.width = thumb.height = 112;
  if (right > left && bottom > top) {
    const w = right - left, h = bottom - top, scale = 96 / Math.max(w, h);
    thumb.getContext('2d').drawImage(canvas, left, top, w, h, (112 - w * scale) / 2, (112 - h * scale) / 2, w * scale, h * scale);
  }
  const url = thumb.toDataURL(); previews.set(key, url); return url;
}
export function paintObjectPreviews(root) {
  for (const img of root.querySelectorAll('img[data-object-preview]')) img.src = objectPreview(img.dataset.objectPreview,img.dataset.objectView||'side');
}
