// Map Studio collapsible Properties panels.
// Existing inspector inputs/listeners are moved, not recreated, preserving editors.
const TARGETS = ['mInspector'];
const preferences = new Map();
const CSS_SECTION = 'ff-inspector-section';
const headingSelector = '.section-title';

function keyFor(panel, title) {
  return `${panel.id}:${title.toLowerCase().replace(/\s+/g, ' ').trim()}`;
}
function labelFromHeading(node) {
  const cloned = node.cloneNode(true);
  cloned.querySelectorAll('button, input, select, svg').forEach(n => n.remove());
  cloned.querySelectorAll('span').forEach(n => { if (!/[\p{L}\p{N}]/u.test(n.textContent)) n.remove(); });
  return (cloned.textContent || 'Section').trim().replace(/\s+/g, ' ') || 'Section';
}
function isSectionHeading(node) {
  return node instanceof HTMLElement && node.matches(headingSelector) &&
    !node.matches('summary') && !node.closest('details');
}
function needsArrangement(panel) {
  // A panel holding only its title has nothing to group; rewriting it would retrigger
  // the observer forever (a microtask loop that freezes the page).
  if (![...panel.childNodes].some(n => !(n.nodeType === Node.ELEMENT_NODE && n.matches('.inspector-title')))) return false;
  return [...panel.children].some(child => isSectionHeading(child)) ||
    ([...panel.children].some(child => child.classList.contains('inspector-title')) &&
      !panel.querySelector(`:scope > .${CSS_SECTION}`));
}
function arrange(panel) {
  if (!needsArrangement(panel)) return;
  // The studio just replaced its inspector markup. Move its original DOM nodes so
  // listeners already registered on controls remain valid.
  const nodes = [...panel.childNodes];
  if (!nodes.length) return;
  const fragment = document.createDocumentFragment();
  const sections = [];
  let group = [], currentTitle = 'GENERAL', serial = 0, hasHeading = false;
  let pinned = [];
  const flush = () => {
    if (!group.some(n => n.nodeType === Node.ELEMENT_NODE || n.textContent.trim())) { group = []; return; }
    const title = currentTitle;
    const k = keyFor(panel, title);
    serial++;
    const details = document.createElement('details');
    details.className = CSS_SECTION;
    details.dataset.sectionKey = k;
    const stored = preferences.get(k);
    details.open = panel.id==='mInspector' ? true : stored === undefined ? (panel.id === 'inspector' ? motionSectionPriority(title) <= 20 : serial === 1) : stored;
    const summary = document.createElement('summary');
    summary.className = 'ff-inspector-summary';
    const text = document.createElement('span');
    text.className = 'ff-inspector-summary-label';
    text.textContent = title;
    const chevron = document.createElement('span');
    chevron.className = 'ff-inspector-chevron';
    chevron.textContent = '⌄';
    chevron.setAttribute('aria-hidden','true');
    summary.append(text, chevron);
    const content = document.createElement('div');
    content.className = 'ff-inspector-content';
    content.append(...group);
    details.append(summary, content);
    details.addEventListener('toggle', () => preferences.set(k, details.open));
    sections.push({title, details});
    group = [];
  };
  // Keep the layer title immediately visible; put all property fields in groups.
  for (const node of nodes) {
    if (node.nodeType === Node.ELEMENT_NODE && node.matches('.inspector-title')) {
      if (!hasHeading && !group.length) pinned.push(node);
      else group.push(node);
      continue;
    }
    if (isSectionHeading(node)) {
      flush();
      currentTitle = labelFromHeading(node);
      hasHeading = true;
      // Keep heading buttons, if any, in content instead of losing their action.
      if (node.querySelector('button, input, select')) group.push(node);
    } else group.push(node);
  }
  flush();
  sections.forEach(({details}) => fragment.append(details));
  if (!fragment.childNodes.length) return;
  // Avoid triggering expensive studio rerenders, only replace this panel's children.
  panel.replaceChildren(...pinned, fragment);
}
function install(panel) {
  panel.classList.add('ff-inspector-accordion');
  let queued = false;
  const observer = new MutationObserver(mutations => {
    if (!mutations.some(m => m.type === 'childList' && m.target === panel)) return;
    if (queued) return;
    queued = true;
    queueMicrotask(() => { queued = false; arrange(panel); });
  });
  observer.observe(panel, { childList: true });
  arrange(panel);
}
for (const id of typeof document === 'undefined' ? [] : TARGETS) {
  const panel = document.getElementById(id);
  if (panel) install(panel);
}
