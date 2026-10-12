// FrameFlow's built-in SVG element library. Assets become regular image layers
// so they work with timeline, presets, grouping, project save, PNG and WebM.
const SHAPES = [
  ['Arrow right','Arrows','<path d="M10 50H83M62 27l23 23-23 23"/>'],
  ['Arrow left','Arrows','<path d="M90 50H17M38 27L15 50l23 23"/>'],
  ['Arrow up','Arrows','<path d="M50 90V17M27 38l23-23 23 23"/>'],
  ['Double arrow','Arrows','<path d="M10 50H90M30 30L10 50l20 20M70 30l20 20-20 20"/>'],
  ['Curved arrow','Arrows','<path d="M16 77C18 12 82 12 82 60M59 38l23 23 14-26"/>'],
  ['Chevron','Arrows','<path d="M30 18l34 32-34 32"/>'],
  ['Location pin','Icons','<path d="M50 90S19 56 19 40a31 31 0 1162 0C81 56 50 90 50 90Z"/><circle cx="50" cy="40" r="11"/>'],
  ['Heart','Icons','<path d="M50 84L16 49C-2 21 35 8 50 32 65 8 102 21 84 49Z"/>'],
  ['Star','Icons','<path d="M50 8l13 27 30 4-22 21 5 31-26-15-26 15 5-31L7 39l30-4Z"/>'],
  ['Check','Icons','<path d="M15 51l23 23 47-49"/>'],
  ['Lightning','Icons','<path d="M56 7L20 56h29l-6 37 38-52H53Z"/>'],
  ['Play','Icons','<path d="M30 16v68l57-34Z"/>'],
  ['Pause','Icons','<path d="M31 19v62M69 19v62"/>'],
  ['Search','Icons','<circle cx="43" cy="43" r="27"/><path d="M63 63l26 26"/>'],
  ['Plus','Icons','<path d="M50 14v72M14 50h72"/>'],
  ['Crosshair','Icons','<circle cx="50" cy="50" r="28"/><circle cx="50" cy="50" r="8"/><path d="M50 5v15M50 80v15M5 50h15M80 50h15"/>'],
  ['Speech bubble','Callouts','<path d="M11 14H89V70H43L23 88V70H11Z"/>'],
  ['Rounded tag','Callouts','<path d="M10 23Q10 12 21 12H75L91 50 75 88H21Q10 88 10 77Z"/><circle cx="73" cy="50" r="6"/>'],
  ['Bookmark','Callouts','<path d="M24 10H76V90L50 73 24 90Z"/>'],
  ['Banner','Callouts','<path d="M7 22H93L79 50 93 78H7L21 50Z"/>'],
  ['Bracket','Callouts','<path d="M33 12H15V88H33M67 12H85V88H67"/>'],
  ['Diamond','Decorations','<path d="M50 6L94 50 50 94 6 50Z"/>'],
  ['Hexagon','Decorations','<path d="M28 11H72L94 50 72 89H28L6 50Z"/>'],
  ['Triangle','Decorations','<path d="M50 9L92 88H8Z"/>'],
  ['Ring','Decorations','<circle cx="50" cy="50" r="39"/>'],
  ['Orbit','Decorations','<ellipse cx="50" cy="50" rx="44" ry="18" transform="rotate(-28 50 50)"/><circle cx="81" cy="26" r="5"/>'],
  ['Sparkle','Decorations','<path d="M50 4l11 35 35 11-35 11-11 35-11-35L4 50l35-11Z"/>'],
  ['Waves','Decorations','<path d="M4 29q12-15 24 0t24 0t24 0t24 0M4 50q12-15 24 0t24 0t24 0t24 0M4 71q12-15 24 0t24 0t24 0t24 0"/>'],
  ['Grid','Decorations','<path d="M10 10H90V90H10Z M36 10V90M64 10V90M10 36H90M10 64H90"/>'],
  ['Progress arc','UI','<circle cx="50" cy="50" r="36" opacity=".28"/><path d="M50 14a36 36 0 0129 57"/>'],
  ['Slider','UI','<path d="M13 30H87M13 69H87"/><circle cx="39" cy="30" r="9"/><circle cx="68" cy="69" r="9"/>'],
  ['Bar signal','UI','<path d="M19 85V65M40 85V44M61 85V26M82 85V10"/>'],
  ['Loading dots','UI','<circle cx="23" cy="50" r="8"/><circle cx="50" cy="50" r="8"/><circle cx="77" cy="50" r="8"/>'],
];
const esc = s => String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const css = `
.ff-element-library{padding:14px 12px 22px;border-top:1px solid #343e39}
.ff-element-library[hidden]{display:none!important}
.ff-element-top{display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:14px}
.ff-element-top strong{font-size:12px}
.ff-element-tools{display:flex;flex-direction:column;gap:8px;margin-bottom:12px}
.ff-element-tools label{margin:0}
.ff-element-tools input[type=color]{width:48px;height:30px}
.ff-element-tools select{width:100%}
.ff-element-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px;max-height:58vh;overflow:auto;padding:2px}
.ff-element-card{white-space:normal;display:flex;flex-direction:column;align-items:center;gap:4px;background:#23292b;border:1px solid #3b4646;padding:6px 2px;border-radius:6px;font-size:9px;min-width:0}
.ff-element-card:hover,.ff-element-card:focus-visible{border-color:#b6f36e;background:#303b34}
.ff-element-card svg{width:34px;height:34px;max-width:100%}.ff-element-card span{text-align:center;line-height:1.2;overflow-wrap:anywhere}
.ff-element-foot{font-size:10px;color:#9ba99e;margin:12px 0 0;line-height:1.5}
.ff-element-picker-button{width:100%;margin:8px 0 12px;text-align:left}
`;
function svgFor(shape,color,fillMode=false) {
  const raw=shape[2]; const stroke=fillMode?'none':color,fill=fillMode?color:'none';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="400" height="400" fill="${fill}" stroke="${stroke}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${raw}</svg>`;
}
function rasterize(svg) {
  return new Promise((resolve,reject)=>{
    const img=new Image(); const url=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
    img.onload=()=>{try{const c=document.createElement('canvas');c.width=c.height=400;c.getContext('2d').drawImage(img,0,0);resolve(c.toDataURL('image/png'));}catch(e){reject(e)}finally{URL.revokeObjectURL(url)}};
    img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('Could not render SVG element'))};img.src=url;
  });
}
export function installMotionElements({ add, notify, vector=false, sanitizeSvg }) {
  const toolbar = document.querySelector('.workspace.motion-only .add-grid');
  const inspector = document.querySelector('.workspace.motion-only #inspector');
  if (!toolbar || !inspector) return;
  const style = document.createElement('style'); style.textContent = css; document.head.append(style);
  const openButton = document.createElement('button'); openButton.type = 'button';
  openButton.innerHTML = '<b>✦</b>Elements';
  openButton.title = 'Browse elements in the Properties sidebar'; toolbar.append(openButton);
  const library = document.createElement('section');
  library.className = 'ff-element-library'; library.hidden = true;
  library.innerHTML = `<div class="ff-element-top"><strong>✦ Elements</strong><button type="button" id="ffElementClose" aria-label="Return to layer properties">✕</button></div>
    <div class="ff-element-tools"><label>Category<select id="ffElementCategory"></select></label>
    <label>Color<input id="ffElementColor" type="color" value="#b6f36e"></label>
    <label class="m-chk"><input id="ffElementFill" type="checkbox"> Solid fill</label></div>
    <div class="ff-element-grid" id="ffElementGrid"></div>
    <p class="ff-element-foot">Select an element to add it at the current frame. Its layer will appear in the timeline.</p>`;
  inspector.insertAdjacentElement('afterend', library);
  const category = library.querySelector('#ffElementCategory');
  const color = library.querySelector('#ffElementColor');
  const solid = library.querySelector('#ffElementFill');
  const grid = library.querySelector('#ffElementGrid');
  for (const group of ['All', ...new Set(SHAPES.map(x => x[1]))]) {
    const opt = document.createElement('option'); opt.value = opt.textContent = group; category.append(opt);
  }
  function close() { library.hidden = true; inspector.hidden = false; }
  function open() { inspector.hidden = true; library.hidden = false; render(); }
  async function insert(shape, button) {
    button.disabled = true;
    try {
      if (vector && sanitizeSvg) {
        const markup = sanitizeSvg(svgFor(shape, color.value, solid.checked));
        close();add('vector',{name:shape[0],svgMarkup:markup,w:230,h:230,color:color.value,vectorFill:solid.checked?color.value:'#ffffff',vectorStroke:color.value,vectorStrokeWidth:solid.checked?0:7,vectorDraw:false,vectorDuration:40,vectorPin:false,vectorPinColor:'#ef476f',vectorPinSize:5});
      } else {
        const src = await rasterize(svgFor(shape, color.value, solid.checked));
        close();add('image',{name:shape[0],src,w:230,h:230,color:color.value});
      }
      notify(shape[0] + ' element added');
    } catch (e) { notify(e.message || String(e)); }
    finally { button.disabled = false; }
  }
  function render() {
    grid.replaceChildren();
    for (const shape of SHAPES) {
      if (category.value !== 'All' && shape[1] !== category.value) continue;
      const b = document.createElement('button'); b.type = 'button'; b.className = 'ff-element-card';
      b.title = 'Add ' + shape[0];
      b.innerHTML = svgFor(shape, color.value, solid.checked) + `<span>${esc(shape[0])}</span>`;
      b.onclick = () => insert(shape, b); grid.append(b);
    }
  }
  category.onchange = render; color.oninput = render; solid.onchange = render;
  openButton.onclick = open;
  library.querySelector('#ffElementClose').onclick = close;
  // Layer selection can happen in the layer list, timeline, or canvas.
  // Use capture so the properties panel is restored before the editor rerenders it.
  document.addEventListener('pointerdown', event => {
    if (library.hidden || !document.body.contains(library)) return;
    if (event.target.closest('.workspace.motion-only #layers .layer, .workspace.motion-only [data-track-label], .workspace.motion-only [data-row], .workspace.motion-only #canvas')) close();
  }, true);
  // Also handle keyboard/programmatic selection, if the editor emits this event.
  window.addEventListener('ff-motion-layer-selected', close);
  return { open, close };
}