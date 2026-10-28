import assert from 'node:assert/strict';
import { ANTIQUE_ATLAS, ANTIQUE_LABEL, applyAntiqueLook } from '../map-antique.mjs';
import { newMapProject, makeAction, validateMapProject, LABEL_PRESETS, mapFontsUsed } from '../map-engine.mjs';

const p = newMapProject();
p.actions = [makeAction('pin', 0, { label: 'Paris', labelStyle: { font: 'Arial', text: '#ff0000' } })];
p.camera.init = { lon: 12, lat: 47, zoom: 3.5, pitch: 25, bearing: 10 };
const original = structuredClone(p);
assert.equal(applyAntiqueLook(p), p);
validateMapProject(p);
assert.deepEqual(p.actions, original.actions);
assert.deepEqual(p.camera, original.camera);
assert.equal(p.graticule, false);
assert.deepEqual(p.atlasLabels, ANTIQUE_ATLAS);
assert.deepEqual(LABEL_PRESETS.antique.style, ANTIQUE_LABEL);
assert.ok(mapFontsUsed(p).includes('Georgia'));
const saved = JSON.parse(JSON.stringify(p));
validateMapProject(saved);
assert.deepEqual(saved, p);
// Applying to a second project must not share mutable style objects.
const other = applyAntiqueLook(newMapProject());
other.atlasLabels.text = '#000000';other.texture.strength = 0;
assert.equal(p.atlasLabels.text, ANTIQUE_ATLAS.text);
assert.equal(p.texture.strength, .22);
console.log('Antique look validation, persistence, clip/camera preservation, fonts and independent settings passed');
