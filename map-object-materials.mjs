// Local surface lighting follows each piece of geometry in preview and export.
const tones = new Map();
export function surface(c, color, x, y, w, h) {
  if (!/^#[\da-f]{6}$/i.test(color) || !w || !h) return color;
  let palette = tones.get(color);
  if (!palette) {
    const rgb = [1, 3, 5].map(i => parseInt(color.slice(i, i + 2), 16));
    const mix = (target, amount) => '#' + rgb.map(v => Math.round(v + (target - v) * amount).toString(16).padStart(2, '0')).join('');
    palette = [mix(255, .22), color, mix(0, .23)];
    if (tones.size > 512) tones.clear();
    tones.set(color, palette);
  }
  const g = c.createLinearGradient(x, y, x + w * .35, y + h);
  g.addColorStop(0, palette[0]); g.addColorStop(.42, palette[1]); g.addColorStop(1, palette[2]);
  return g;
}
export function polygonSurface(c, color, s, points) {
  const xs = points.map(p => p[0]), ys = points.map(p => p[1]);
  const x = Math.min(...xs), y = Math.min(...ys);
  return surface(c, color, x * s, y * s, (Math.max(...xs) - x) * s, (Math.max(...ys) - y) * s);
}
