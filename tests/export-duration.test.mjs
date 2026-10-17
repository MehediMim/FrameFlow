// Run with: node tests/export-duration.test.mjs
// Small synthetic packets verify the container's long timestamps without encoding video.
import assert from 'node:assert/strict';
import { muxWebM } from '../map-video-export.mjs';

function elements(data, start = 0, end = data.length) {
  const result = [];
  for (let offset = start; offset < end;) {
    const begin = offset;
    let marker = 0x80, idWidth = 1;
    while (!(data[offset] & marker)) { marker /= 2; idWidth++; }
    let id = 0;
    for (let i = 0; i < idWidth; i++) id = id * 256 + data[offset++];
    marker = 0x80;
    let sizeWidth = 1;
    while (!(data[offset] & marker)) { marker /= 2; sizeWidth++; }
    let size = data[offset++] & (marker - 1);
    for (let i = 1; i < sizeWidth; i++) size = size * 256 + data[offset++];
    assert.ok(offset + size <= end, 'EBML element stays within its parent');
    result.push({ id, data: data.subarray(offset, offset + size), begin });
    offset += size;
  }
  return result;
}
const unsigned = data => [...data].reduce((value, byte) => value * 256 + byte, 0);
const float64 = data => new DataView(data.buffer, data.byteOffset, data.byteLength).getFloat64(0);

for (const fps of [24, 30, 60]) {
  for (const duration of [61, 21_600, 90_000]) {
    const frames = duration * fps, last = Math.round((frames - 1) * 1e6 / fps);
    const video = [
      { timestamp: last, type: 'delta', data: new Uint8Array([3]) },
      { timestamp: 0, type: 'key', data: new Uint8Array([1]) },
      { timestamp: 60_500_000, type: 'key', data: new Uint8Array([2]) },
    ];
    const audio = {
      channels: 2, preSkip: 312, description: new Uint8Array(19),
      chunks: [
        { timestamp: 60_750_000, type: 'key', data: new Uint8Array([5]) },
        { timestamp: 250_000, type: 'key', data: new Uint8Array([4]) },
        { timestamp: last - 10_000, type: 'key', data: new Uint8Array([6]), discardPadding: 5_000_000 },
      ],
    };
    const blob = muxWebM(video, { width: 640, height: 360, fps, frames, audio });
    assert.equal(blob.type, 'video/webm');
    assert.ok(blob.size < 2_000, 'long duration does not require intermediate packets in a container test');
    const segment = elements(new Uint8Array(await blob.arrayBuffer())).find(e => e.id === 0x18538067);
    const contents = elements(segment.data), info = elements(contents.find(e => e.id === 0x1549a966).data);
    assert.equal(unsigned(info.find(e => e.id === 0x2ad7b1).data), 1000, 'timecode units are microseconds');
    assert.equal(float64(info.find(e => e.id === 0x4489).data), duration * 1e6, `${duration}s duration survives WebM metadata at ${fps} fps`);

    const packets = contents.filter(e => e.id === 0x1f43b675).map(cluster => {
      const children = elements(cluster.data), timestamp = unsigned(children.find(e => e.id === 0xe7).data);
      const group = children.find(e => e.id === 0xa0), grouped = group && elements(group.data);
      const block = children.find(e => e.id === 0xa3) || grouped.find(e => e.id === 0xa1);
      assert.equal(new DataView(block.data.buffer, block.data.byteOffset, block.data.byteLength).getInt16(1), 0, 'relative block timestamps do not overflow');
      return { timestamp, track: block.data[0] & 0x7f, payload: block.data[4], padding: grouped ? unsigned(grouped.find(e => e.id === 0x75a2).data) : 0 };
    });
    const expected = [...video.map(c => ({ ...c, track: 1 })), ...audio.chunks.map(c => ({ ...c, track: 2 }))]
      .sort((a, b) => a.timestamp - b.timestamp || a.track - b.track)
      .map(c => ({ timestamp: c.timestamp, track: c.track, payload: c.data[0], padding: c.discardPadding || 0 }));
    assert.deepEqual(packets, expected, 'video and audio packets retain long timestamps and interleaving');
    assert.equal(packets.at(-1).timestamp, last, 'last frame timestamp is preserved beyond 32-bit range');
  }
}

// Long exports contain more packets than JavaScript permits as function arguments.
// A size-only Blob stand-in avoids retaining hundreds of thousands of native Blobs.
{
  const NativeBlob = globalThis.Blob;
  class SizeOnlyBlob {
    constructor(parts = [], options = {}) {
      this.size = parts.reduce((sum, part) => sum + (part.size ?? part.byteLength ?? 0), 0);
      this.type = options.type || '';
    }
  }
  globalThis.Blob = SizeOnlyBlob;
  try {
    const count = 150_000, data = new Uint8Array([1]);
    const audio = { channels: 1, preSkip: 312, description: new Uint8Array(19), chunks: Array.from({ length: count }, (_, i) => ({ timestamp: i * 20_000, type: 'key', data })) };
    const blob = muxWebM([{ timestamp: 0, type: 'key', data }], { width: 640, height: 360, fps: 30, frames: 90_000, audio });
    assert.equal(blob.type, 'video/webm');
    assert.ok(blob.size > count, 'large packet counts mux without a function-argument overflow');
  } finally {
    globalThis.Blob = NativeBlob;
  }
}

console.log('video export duration tests passed');
