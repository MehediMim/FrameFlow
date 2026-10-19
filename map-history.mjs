// Bound retained snapshots as well as their count, especially for image layers.
export function trimMapHistory(undo, redo, maxChars = 16 * 1024 * 1024) {
  let size = [...undo, ...redo].reduce((sum, state) => sum + state.length, 0);
  while (undo.length > 80) size -= undo.shift().length;
  while (redo.length > 80) size -= redo.shift().length;
  while (size > maxChars && undo.length + redo.length > 1) {
    const stack = undo.length > 1 || !redo.length ? undo : redo;
    size -= stack.shift().length;
  }
}
