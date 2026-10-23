const groups=[['Arrows & boundaries',['arrow','front','zone']],['Routes & waterways',['road','railway','river']]];
const names={arrow:'Arrow',retreat:'Arrow',zone:'Zone',noFly:'Zone'};
const descriptions={
  arrow:'Show an advance or a direction of movement.',retreat:'Show a withdrawal with a dashed directional arrow.',
  front:'Mark a front line with teeth on the chosen side.',zone:'Outline an occupied area or add a landscape.',
  noFly:'Mark a restricted area with a hatched fill.',road:'Build a road with surface and traffic controls.',
  railway:'Build a railway along a drawn route.',river:'Draw a waterway with an animated current.',
  distance:'Measure the distance between two map points.',area:'Measure the area inside a drawn boundary.',
};
const marks={
  arrow:'<path d="M5 25Q16 10 30 14"/><path d="m23 7 10 7-11 7"/>',
  retreat:'<path d="M5 25Q16 10 30 14" stroke-dasharray="4 4"/><path d="m23 7 10 7-11 7"/>',
  front:'<path d="M4 25 14 19 25 20 35 10M10 21l-1-8 8 4m5 3 4-7 3 6"/>',
  zone:'<path d="m6 23 4-15 18-3 7 17-15 7Z" fill="currentColor" fill-opacity=".18"/>',
  noFly:'<path d="m6 23 4-15 18-3 7 17-15 7Z" fill="currentColor" fill-opacity=".12"/><path d="m10 21 13-14M17 25 30 11m-5 14 7-8" stroke-width="1"/>',
  road:'<path d="M6 29 34 3" stroke-width="9" opacity=".35"/><path d="M6 29 34 3" stroke-dasharray="3 4" stroke-width="1.5"/>',
  railway:'<path d="M8 29 34 5M4 25 30 1M5 29l7 2m-1-8 7 2m-1-8 7 2m-1-8 7 2m-1-8 7 2"/>',
  river:'<path d="M5 26C31 30 8 3 35 7" stroke-width="7" opacity=".4"/><path d="M5 26C31 30 8 3 35 7" stroke-width="1"/>',
  distance:'<path d="M7 24 33 8M5 20l5 8M30 4l5 8"/><circle cx="7" cy="24" r="2"/><circle cx="33" cy="8" r="2"/>',
  area:'<path d="M7 25V7h26v18Z" stroke-dasharray="3 3" fill="currentColor" fill-opacity=".12"/><path d="M14 20v-7h12v7Z" stroke-width="1"/>',
};
const icon=key=>`<svg viewBox="0 0 40 32" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${marks[key]||marks.arrow}</svg>`;
export function shapePicker(shapes,current){
  const selected=shapes[current]||shapes.arrow;
  const measurement=['distance','area'].includes(current),base=current==='retreat'?'arrow':current==='noFly'?'zone':current;
  const available=measurement?[['Measure',['distance','area']]]:groups;
  return `<div class="m-shape-picker"><label hidden>Shape type<select data-mf="shape" data-t="sel" aria-label="Shape type">${Object.entries(shapes).map(([key,s])=>`<option value="${key}" ${key===current?'selected':''}>${s.label}</option>`).join('')}</select></label>
    <details data-shape-menu><summary aria-label="${measurement?'Choose measurement':'Choose arrow or zone type'}"><span class="m-shape-symbol" style="color:${selected.color}">${icon(current)}</span><span><strong>${names[current]||selected.label}</strong><small>Change type</small></span><span class="m-shape-caret" aria-hidden="true">&#9662;</span></summary>
    <div class="m-shape-options">${available.map(([label,keys])=>`<div class="m-shape-group"><h4>${label}</h4><div>${keys.map(key=>`<button type="button" data-shape-choice="${key}" aria-pressed="${key===base}" title="${descriptions[key]}"><span class="m-shape-symbol" style="color:${shapes[key].color}">${icon(key)}</span><span>${names[key]||shapes[key].label}</span></button>`).join('')}</div></div>`).join('')}</div></details>
    <p class="mini-label m-shape-description">${descriptions[current]||''}</p></div>`;
}
