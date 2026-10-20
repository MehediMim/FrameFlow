import assert from 'node:assert/strict';
import { packTimeline, magneticDelta } from '../timeline-magnet.mjs';

const packed = packTimeline([
  { id: 'later', start: 30, end: 60 },
  { id: 'first', start: 0, end: 30 },
  { id: 'overlap', start: 10, end: 40 },
]);
assert.equal(packed.count, 2);
assert.equal(packed.lanes.get('first'), packed.lanes.get('later'));
assert.notEqual(packed.lanes.get('first'), packed.lanes.get('overlap'));
assert.equal(packTimeline([]).count, 1);
assert.equal(magneticDelta(18, 0, 30, 'move', [50], 3), 20, 'moving end snaps to next start');
assert.equal(magneticDelta(18, 0, 30, 'r', [50], 3), 20, 'right trim snaps');
assert.equal(magneticDelta(18, 0, 30, 'l', [20], 3), 20, 'left trim snaps');
assert.equal(magneticDelta(18, 0, 30, 'move', [60], 3), 18, 'distant edges do not attract');
console.log('Magnetic snapping and shared lane packing passed');
