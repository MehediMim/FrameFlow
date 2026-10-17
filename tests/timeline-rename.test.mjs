import assert from 'node:assert/strict';
import { bindTimelineRename } from '../timeline-rename.mjs';
import { newPaperProject, validatePaperProject } from '../paper-engine.mjs';

// Minimal DOM fixture, including replacing a row after its first selection click.
class Node {
  constructor(className = '', attributes = {}) { this.className = className; this.attributes = attributes; this.children = []; this.listeners = {}; this.textContent = 'Original'; }
  append(child) { this.children.push(child); child.parent = this; return child; }
  getAttribute(key) { return this.attributes[key]; }
  setAttribute(key, value) { this.attributes[key] = value; }
  closest(selector) {
    if (selector.startsWith('.') ? this.className === selector.slice(1) : selector.startsWith('[') ? Object.hasOwn(this.attributes, selector.slice(1, -1)) : false) return this;
    return this.parent?.closest(selector) || null;
  }
  contains(child) { return child === this || this.children.some(c => c.contains(child)); }
  querySelector(selector) { return this.children.find(c => c.closest(selector) === c) || null; }
  replaceWith(node) { const parent = this.parent; parent.children[parent.children.indexOf(this)] = node; node.parent = parent; this.parent = null; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  emit(type, props = {}) {
    const event = { target: this, button: 0, clientX: 30, clientY: 10, timeStamp: 100,
      preventDefault() { this.prevented = true; }, stopPropagation() { this.stopped = true; }, stopImmediatePropagation() { this.stopped = true; }, ...props };
    for (const fn of this.listeners[type] || []) fn(event);
    return event;
  }
  focus() { this.focused = true; }
  select() { this.selected = true; }
}
globalThis.document = { createElement: () => new Node() };

for (const attribute of ['data-track-label', 'data-mtl', 'data-ptl', 'data-object', 'data-cam-select', 'data-audio-label']) {
  const root = new Node(), item = { name: 'Original' }, history = [];
  let changes = 0, pauses = 0;
  function row() {
    const r = new Node('', { [attribute]: 'layer' }); r.append(new Node('ff-layer-name'));
    root.children = []; root.append(r); return r;
  }
  bindTimelineRename(root, { attribute, getItem: () => item,
    checkpoint: () => history.push(item.name), changed: () => { changes++; row(); }, pause: () => { pauses++; } });
  let clock = 100;
  function begin() {
    const first = row();
    assert.ok(!root.emit('pointerdown', { target: first.children[0], timeStamp: clock }).prevented);
    const replacement = row(); // The studio rebuilds the timeline on selection.
    const e = root.emit('pointerdown', { target: replacement.children[0], timeStamp: clock + 100 });
    clock += 1000;
    assert.ok(e.prevented && e.stopped);
    const input = replacement.children[0];
    assert.equal(input.className, 'ff-timeline-name-input');
    assert.ok(input.focused && input.selected);
    assert.equal(input.attributes['aria-label'], 'Layer name');
    return input;
  }
  let input = begin(); input.value = '  Renamed layer  '; input.emit('keydown', { key: 'Enter' }); input.emit('blur');
  assert.equal(item.name, 'Renamed layer'); assert.deepEqual(history, ['Original']); assert.equal(changes, 1);
  input = begin(); input.value = 'Discard'; input.emit('keydown', { key: 'Escape' }); input.emit('blur');
  assert.equal(item.name, 'Renamed layer'); assert.equal(changes, 1);
  input = begin(); input.value = '   '; input.emit('blur'); assert.equal(changes, 1);
  input = begin(); input.value = item.name; input.emit('keydown', { key: 'Enter' }); assert.equal(changes, 1);
  input = begin(); input.value = 'x'.repeat(120); input.emit('blur');
  assert.equal(item.name.length, 100); assert.equal(changes, 2); assert.equal(history.length, 2);
  assert.equal(pauses, 5);
}
const paper = newPaperProject(); paper.paper.name = 'Front page';
assert.equal(validatePaperProject(paper).paper.name, 'Front page', 'sheet names survive saving and reopening');
delete globalThis.document;
console.log('Timeline rename tests passed across all studio bindings');
