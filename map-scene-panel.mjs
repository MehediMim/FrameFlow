import { animationKeysOf } from './map-timing.mjs';
export const SCENE_PANEL_DEFAULTS = {
  panelSide: 'left', panelWidth: 46, panelAlign: 'center', panelOpacity: .92,
  panelColor: '#111a20', textColor: '#f1ede2', accentColor: '#d9b767',
  eventTitle: 'Age of Exploration', description: 'Add the story behind this moment on the map.',
  startYear: 1500, endYear: 1600, autoYear: true, yearEra: '', textScale: 1, fadeSeconds: .25,
};
export function sceneYearAt(a, frame) {
  const start = a.startYear ?? SCENE_PANEL_DEFAULTS.startYear;
  const keys=animationKeysOf(a),end=Math.min(a.start+a.dur,keys.end);
  const t = Math.max(0, Math.min(1, (frame - keys.start) / Math.max(1, end - keys.start - 1)));
  return Math.round(start + (a.autoYear === false ? 0 : ((a.endYear ?? start) - start) * t));
}
export function validateScenePanel(a) {
  const d = { ...SCENE_PANEL_DEFAULTS, ...a };
  if (!['left','right'].includes(d.panelSide) || !['top','center','bottom'].includes(d.panelAlign) || !['','CE','BCE'].includes(d.yearEra) || typeof d.autoYear !== 'boolean') throw Error('Invalid scene panel setting.');
  for (const [key,lo,hi] of [['panelWidth',25,70],['panelOpacity',0,1],['textScale',.6,2],['fadeSeconds',0,2],['startYear',1,9999],['endYear',1,9999]]) {
    if (!Number.isFinite(d[key]) || d[key]<lo || d[key]>hi || (key.endsWith('Year') && !Number.isInteger(d[key]))) throw Error('Invalid scene panel '+key+'.');
  }
  for(const key of ['panelColor','textColor','accentColor'])if(!/^#[a-f0-9]{6}$/i.test(d[key]))throw Error('Invalid scene panel color.');
  for(const [key,max] of [['eventTitle',160],['description',2000]])if(typeof d[key]!=='string'||d[key].length>max)throw Error('Invalid scene panel text.');
}
function wrap(ctx, text, width) {
  const lines=[];
  for(const paragraph of text.split('\n')) {
    let line='';
    for(const word of paragraph.split(/\s+/).filter(Boolean)) {
      if(line && ctx.measureText(line+' '+word).width>width){lines.push(line);line='';}
      // Break unusually long names/URLs rather than spilling into the map.
      for(const char of (line?' ':'')+word) {
        if(line && ctx.measureText(line+char).width>width){lines.push(line);line='';}
        line+=char;
      }
    }
    lines.push(line);
  }
  return lines;
}
/** Screen-space overlay, shared by preview, PNG and video rendering. */
export function drawScenePanel(ctx, W, H, a, frame, fps = 30) {
  if(a.visible===false || frame<a.start || frame>=a.start+a.dur)return;
  const d={...SCENE_PANEL_DEFAULTS,...a},u=Math.min(W,H)/720;
  const fade=a.dur<3?0:Math.min(d.fadeSeconds*fps,a.dur/4);
  const alpha=fade?Math.min(1,(frame-a.start)/fade,(a.start+a.dur-frame)/fade):1;
  if(alpha<=0)return;
  const width=W*d.panelWidth/100,left=d.panelSide==='left',edge=left?0:W,pad=40*u;
  const textWidth=Math.max(20,width*.78-pad*2),x=left?pad:W-pad-textWidth;
  ctx.save();ctx.globalAlpha=alpha;
  const g=ctx.createLinearGradient(edge,0,left?width:W-width,0);
  const rgb=d.panelColor.match(/\w\w/g).map(h=>parseInt(h,16)).join(',');
  g.addColorStop(0,`rgba(${rgb},${d.panelOpacity})`);g.addColorStop(.6,`rgba(${rgb},${d.panelOpacity*.94})`);g.addColorStop(1,`rgba(${rgb},0)`);
  ctx.fillStyle=g;ctx.fillRect(left?0:W-width,0,width,H);
  const year=String(sceneYearAt(d,frame))+(d.yearEra?' '+d.yearEra:'');
  const title=d.eventTitle.replaceAll('{year}',year),description=d.description.replaceAll('{year}',year);
  let scale=d.textScale*u,layout;
  for(let attempt=0;attempt<18;attempt++) {
    ctx.font=`600 ${32*scale}px Georgia, serif`;const titles=title?wrap(ctx,title,textWidth):[];
    ctx.font=`${19*scale}px Arial, sans-serif`;const paragraphs=description?wrap(ctx,description,textWidth):[];
    const height=105*scale+(titles.length?22*scale+titles.length*39*scale:0)+(paragraphs.length?24*scale+paragraphs.length*29*scale:0);
    layout={titles,paragraphs,height};if(height<=H-pad*2)break;scale*=.88;
  }
  let y=d.panelAlign==='top'?pad:d.panelAlign==='bottom'?H-pad-layout.height:(H-layout.height)/2;
  ctx.beginPath();ctx.rect(x-pad/4,0,textWidth+pad/2,H);ctx.clip();ctx.textAlign='left';ctx.textBaseline='top';
  ctx.fillStyle=d.accentColor;ctx.fillRect(x,y,Math.min(textWidth,46*u),3*u);y+=18*scale;
  let yearSize=78*scale;ctx.font=`600 ${yearSize}px Georgia, serif`;
  yearSize*=Math.min(1,textWidth/Math.max(1,ctx.measureText(year).width));ctx.font=`600 ${yearSize}px Georgia, serif`;ctx.fillText(year,x,y);y+=87*scale;
  ctx.fillStyle=d.textColor;
  if(layout.titles.length){y+=22*scale;ctx.font=`600 ${32*scale}px Georgia, serif`;for(const line of layout.titles){ctx.fillText(line,x,y);y+=39*scale;}}
  if(layout.paragraphs.length){y+=24*scale;ctx.font=`${19*scale}px Arial, sans-serif`;for(const line of layout.paragraphs){ctx.fillText(line,x,y);y+=29*scale;}}
  ctx.restore();
}
