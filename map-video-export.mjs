// Offline VP8/WebM export. No wall-clock playback or captureStream involved.
// WebCodecs timestamps are microseconds; this WebM uses a 1000 ns timecode scale.
const bytes = (...parts) => new Blob(parts);
function uint(n) {
  const a = []; do { a.unshift(n % 256); n = Math.floor(n / 256); } while (n);
  return new Uint8Array(a);
}
function size(n) {
  let width = 1;
  while (n >= 2 ** (7 * width) - 1) width++;
  const a = new Uint8Array(width);
  for (let i = width - 1; i >= 0; i--) { a[i] = n % 256; n = Math.floor(n / 256); }
  a[0] |= 1 << (8 - width); return a;
}
function element(id, body) {
  const b = body instanceof Blob ? body : bytes(body);
  return bytes(uint(id), size(b.size), b);
}
const number = (id, n) => element(id, uint(n));
const string = (id, s) => element(id, new TextEncoder().encode(s));
function float(n) { const a = new Uint8Array(8); new DataView(a.buffer).setFloat64(0, n); return a; }

export function muxWebM(chunks, { width, height, fps, frames }) {
  const header = element(0x1a45dfa3, bytes(number(0x4286, 1), number(0x42f7, 1),
    number(0x42f2, 4), number(0x42f3, 8), string(0x4282, 'webm'), number(0x4287, 2), number(0x4285, 2)));
  const info = element(0x1549a966, bytes(number(0x2ad7b1, 1000),
    element(0x4489, float(frames * 1e6 / fps)), string(0x4d80, 'FrameFlow'), string(0x5741, 'FrameFlow')));
  const tracks = element(0x1654ae6b, element(0xae, bytes(number(0xd7, 1), number(0x73c5, 1),
    number(0x83, 1), number(0x9c, 0), string(0x86, 'V_VP8'), number(0x23e383, Math.round(1e9 / fps)),
    element(0xe0, bytes(number(0xb0, width), number(0xba, height))))));
  // A cluster per frame keeps block-relative timestamps at zero, even for long clips.
  const clusters = chunks.map(c => element(0x1f43b675, bytes(number(0xe7, c.timestamp),
    element(0xa3, bytes(new Uint8Array([0x81, 0, 0, c.type === 'key' ? 0x80 : 0]), c.data)))));
  return new Blob([header, element(0x18538067, bytes(info, tracks, ...clusters))], { type: 'video/webm' });
}

export async function exportMapVideo({ canvas, fps, frames, draw, cancelled = () => false, progress = () => {} }) {
  if (!globalThis.VideoEncoder || !globalThis.VideoFrame) {
    throw Error('Frame-by-frame export needs a browser with WebCodecs (Chrome or Edge). Open the app over HTTPS or localhost.');
  }
  const config = { codec: 'vp8', width: canvas.width, height: canvas.height,
    bitrate: 12_000_000, framerate: fps, latencyMode: 'quality' };
  const support = await VideoEncoder.isConfigSupported(config);
  if (!support.supported) throw Error('VP8 encoding is unavailable at this resolution. Try a smaller resolution or Chrome/Edge.');
  const chunks = []; let failure;
  const encoder = new VideoEncoder({ output(chunk) {
    const data = new Uint8Array(chunk.byteLength); chunk.copyTo(data);
    chunks.push({ timestamp: chunk.timestamp, type: chunk.type, data });
  }, error(e) { failure = e; } });
  const check = () => { if (cancelled()) throw new DOMException('Export cancelled.', 'AbortError'); if (failure) throw failure; };
  try {
    encoder.configure(config);
    for (let f = 0; f < frames; f++) {
      check(); await draw(f); check();
      const timestamp = Math.round(f * 1e6 / fps);
      const vf = new VideoFrame(canvas, { timestamp, duration: Math.round((f + 1) * 1e6 / fps) - timestamp });
      try { encoder.encode(vf, { keyFrame: f % Math.max(1, Math.round(fps * 2)) === 0 }); }
      finally { vf.close(); }
      // Bound pending encoder work, while allowing slow frames to take as long as needed.
      if ((f + 1) % 8 === 0) { await encoder.flush(); check(); }
      progress(f + 1);
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    await encoder.flush(); check();
    chunks.sort((a, b) => a.timestamp - b.timestamp);
    if (chunks.length !== frames || chunks.some((c, f) => c.timestamp !== Math.round(f * 1e6 / fps))) {
      throw Error('The encoder did not return every frame. No incomplete video was saved.');
    }
    return muxWebM(chunks, { width: canvas.width, height: canvas.height, fps, frames });
  } finally { if (encoder.state !== 'closed') encoder.close(); }
}
