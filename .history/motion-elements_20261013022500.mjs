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
.ff-element-dialog{width:min(760px,92vw);max-height:85vh;overflow:auto;background:#191e21;color:#edf0e9;border:1px solid #465047;border-radius:15px;padding:22px;box-shadow:0 35px 120px #000b}
.ff-element-dialog::backdrop{background:#020605bc;backdrop-filter:blur(5px)}
.ff-element-top{display:flex;justify-content:space-between;align-items:center;gap:12px;margin-bottom:18px}
.ff-element-top h2{font:700 19px Manrope,sans-serif;margin:0}
.ff-element-tools{display:flex;align-items:end;gap:12px;flex-wrap:wrap;margin-bottom:14px}
.ff-element-tools label{margin:0;min-width:110px}.ff-element-tools input[type=color]{width:38px;height:33px}
.ff-element-tools select{min-width:150px}
.ff-element-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;max-height:48vh;overflow:auto;padding:3px}
.ff-element-card{white-space:normal;display:flex;flex-direction:column;align-items:center;gap:9px;background:#23292b;border:1px solid #3b4646;padding:14px 7px;border-radius:9px;font-size:11px}
.ff-element-card:hover,.ff-element-card:focus-visible{border-color:#b6f36e;background:#303b34}
.ff-element-card svg{width:66px;height:66px}.ff-element-card span{text-align:center;line-height:1.3}
.ff-element-foot{font-size:11px;color:#9ba99e;margin:14px 0 0}
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
export function installMotionElements({ add, notify }) {
  const toolbar=document.querySelector('.workspace.motion-only .add-grid');if(!toolbar)return;
  const style=document.createElement('style');style.textContent=css;document.head.append(style);
  const openButton=document.createElement('button');openButton.type='button';openButton.innerHTML='<b>✦</b>Elements';openButton.title='SVG shapes, icons and motion templates';toolbar.append(openButton);
  const dlg=document.createElement('dialog');dlg.className='ff-element-dialog';dlg.setAttribute('aria-label','Elements library');
  dlg.innerHTML=`<div class="ff-element-top"><h2>✦ Elements library</h2><button type="button" id="ffElementClose" aria-label="Close">✕</button></div><div class="ff-element-tools"><label>Category<select id="ffElementCategory"></select></label><label>Element color<input id="ffElementColor" type="color" value="#b6f36e"></label><label><input id="ffElementFill" type="checkbox"> Solid fill</label></div><div class="ff-element-grid" id="ffElementGrid"></div><p class="ff-element-foot">Click an element to add it at the playhead. It becomes an image layer supporting timeline, animation presets, resizing and groups.</p>`;
  document.body.append(dlg);
  const category=dlg.querySelector('#ffElementCategory'),color=dlg.querySelector('#ffElementColor'),solid=dlg.querySelector('#ffElementFill'),grid=dlg.querySelector('#ffElementGrid');
  for(const group of ['All',...new Set(SHAPES.map(x=>x[1]))]){const opt=document.createElement('option');opt.value=opt.textContent=group;category.append(opt)}
  function render(){grid.innerHTML='';for(const [i,shape] of SHAPES.entries()){if(category.value!=='All'&&shape[1]!==category.value)continue;const b=document.createElement('button');b.type='button';b.className='ff-element-card';b.title='Add '+shape[0];b.innerHTML=svgFor(shape,color.value,solid.checked)+`<span>${esc(shape[0])}</span>`;b.addEventListener('click',async()=>{b.disabled=true;try{const src=await rasterize(svgFor(shape,color.value,solid.checked));add('image',{name:shape[0],src,w:230,h:230,color:color.value});dlg.close();notify(shape[0]+' element added')}catch(e){notify(e.message)}finally{b.disabled=false}});grid.append(b)}}
  category.addEventListener('change',render);color.addEventListener('input',render);solid.addEventListener('change',render);
  openButton.onclick=()=>{render();dlg.showModal()};dlg.querySelector('#ffElementClose').onclick=()=>dlg.close();dlg.addEventListener('click',e=>{if(e.target===dlg)dlg.close()});
}
