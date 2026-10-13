// FrameFlow shared left sidebar accordions: Motion, Map and Paper.
// Move existing elements without recreating event-bound controls.
const STUDIO_SELECTORS = [
  '.workspace.motion-only > .left',
  '#mapStudio .workspace > .left',
  '#paperStudio .workspace > .left'
];
const memory = new Map();

function titleOf(el) {
  const clone=el.cloneNode(true);
  clone.querySelectorAll('button,input,select').forEach(x=>x.remove());
  return (clone.textContent||'Section').replace(/[＋▣◉]/g,'').trim().replace(/\s+/g,' ')||'Section';
}
function isHeading(el) { return el?.nodeType===1 && el.matches('.section-title'); }
function isCamera(el) { return el?.nodeType===1 && el.matches('.ff-camera-controls'); }
function section(aside, name, nodes, index) {
  const details=document.createElement('details');
  details.className='ff-left-section';
  const key=aside.dataset.ffLeftStudio+':'+name.toLowerCase()+':'+index;
  details.dataset.sectionKey=key;
  details.open=memory.has(key)?memory.get(key):true;
  const summary=document.createElement('summary');
  summary.className='ff-left-summary';
  const txt=document.createElement('span');txt.textContent=name;
  const icon=document.createElement('span');icon.className='ff-left-chevron';icon.textContent='⌄';icon.setAttribute('aria-hidden','true');
  summary.append(txt,icon);
  const body=document.createElement('div');body.className='ff-left-content';body.append(...nodes);
  details.append(summary,body);
  details.addEventListener('toggle',()=>memory.set(key,details.open));
  return details;
}
function organize(aside) {
  const children=[...aside.children];
  // Only operate when a studio changed its top-level content, not after our own grouping.
  if (!children.some(c=>isHeading(c)||isCamera(c))) return;
  let current=[],title='TOOLS',number=0;
  const output=document.createDocumentFragment();
  const flush=()=>{if(current.length){output.append(section(aside,title,current,number++));current=[];}};
  for(const child of children){
    if(isHeading(child)){
      flush(); title=titleOf(child);
      // A heading's existing button is preserved; the heading itself becomes part of the section.
      if(child.querySelector('button,input,select')) current.push(child);
    } else if(isCamera(child)) {
      flush();
      const heading=child.querySelector(':scope > .section-title');
      const label=heading?titleOf(heading):'CAMERA';
      // Keep camera module's DOM subtree intact; its listeners and selectors remain valid.
      output.append(section(aside,label,[child],number++));
      title='TOOLS';
    } else if(child.classList.contains('ff-left-section')) {
      flush();output.append(child);
    } else current.push(child);
  }
  flush();
  aside.replaceChildren(output);
}
function install(aside,index){
  aside.dataset.ffLeftStudio=['motion','map','paper'][index];
  aside.classList.add('ff-left-accordion');
  let pending=false;
  const observer=new MutationObserver(records=>{
    if(!records.some(r=>r.type==='childList'&&r.target===aside))return;
    if(pending)return;
    pending=true;
    queueMicrotask(()=>{pending=false;organize(aside)});
  });
  observer.observe(aside,{childList:true});
  organize(aside);
}
STUDIO_SELECTORS.forEach((selector,i)=>{const aside=document.querySelector(selector);if(aside)install(aside,i)});
