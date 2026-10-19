import { bindTimelineRename } from './timeline-rename.mjs?v=timeline-rename-2';
// Audio layers share the editor's selection, inspector and timeline. Media stays in this session.
const studios = new Map();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const copy = layers => layers.map(l => ({...l})); // AudioBuffers and waveform caches are immutable/shared.
const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
export function getAudioSnapshot(studio) {
  const s = studios.get(studio); if (s?.loading) throw Error('Audio is still loading. Wait before exporting.');
  const layers = s ? [...s.layers, ...(s.extraLayers?.() || [])].filter(l => !l.muted && l.volume > 0).map(l => ({...l})) : [];
  return layers?.length ? {layers} : null;
}
export function registerAudioStudio(studio, host) {
  const state = { layers: [], history: [], future: [], loading: false, generation: 0, extraLayers: host.getExtraAudioLayers };
  studios.set(studio, state);
  let context, sources = [], anchor, playing = false, drag = null, pendingReplace = null;
  const $ = s => document.querySelector(s);
  const current = () => state.layers.find(l => l.id === host.getSelected());
  const time = () => host.getFrame() / host.getFps();
  const duration = () => host.getFrames() / host.getFps();
  const notify = msg => host.notify(msg);
  const checkpoint = () => {state.history.push(copy(state.layers));if(state.history.length>60)state.history.shift();state.future=[];};
  function stop() {for(const {source,gain} of sources){try{source.stop();}catch{}source.disconnect();gain.disconnect();}sources=[];anchor=null;}
  function audioContext() {return context ||= new (window.AudioContext || window.webkitAudioContext)();}
  function sync(force=false) {
    const layers = [...state.layers, ...(state.extraLayers?.() || [])];
    if(!playing || !layers.length){stop();return;}
    const ctx=audioContext(),t=time();
    const sameLayers=anchor&&layers.length===anchor.layers.length&&layers.every((l,i)=>['buffer','start','source','duration','volume','muted'].every(k=>l[k]===anchor.layers[i][k]));
    if(!force && sameLayers && Math.abs(t-(anchor.time+ctx.currentTime-anchor.clock))<.12)return;
    stop();
    if(ctx.state!=='running'){ctx.resume().then(()=>sync(true)).catch(()=>notify('Click Play to enable audio.'));return;}
    anchor={time:t,clock:ctx.currentTime,layers:copy(layers)};
    for(const l of layers){
      if(l.muted||!l.volume)continue;
      const skip=Math.max(0,t-l.start),len=Math.min(l.duration-skip,duration()-Math.max(t,l.start));if(len<=0)continue;
      const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=l.buffer;gain.gain.value=l.volume;source.connect(gain);gain.connect(ctx.destination);
      source.start(ctx.currentTime+Math.max(0,l.start-t),l.source+skip,len);sources.push({source,gain});
    }
  }
  function refresh(id=host.getSelected()) {sync(true);host.select(id);}
  function history(direction) {
    const from=direction==='undo'?state.history:state.future,to=direction==='undo'?state.future:state.history;
    if(!from.length)return;host.pause();to.push(copy(state.layers));state.layers=from.pop();refresh(state.layers.some(l=>l.id===host.getSelected())?host.getSelected():state.layers.at(-1)?.id||null);
  }
  function remove(){const l=current();if(!l)return false;host.pause();checkpoint();state.layers=state.layers.filter(a=>a.id!==l.id);refresh(state.layers.at(-1)?.id||null);return true;}
  function duplicate(){const l=current();if(!l)return false;host.pause();checkpoint();const c={...l,id:crypto.randomUUID(),name:l.name+' copy'};state.layers.push(c);refresh(c.id);return true;}
  function canMove(d){const l=current();if(!l)return false;const j=state.layers.indexOf(l)+d;return j>=0&&j<state.layers.length;}
  function move(d){if(!canMove(d))return false;const l=current(),i=state.layers.indexOf(l);host.pause();checkpoint();[state.layers[i],state.layers[i+d]]=[state.layers[i+d],state.layers[i]];refresh(l.id);return true;}
  function split(){const l=current(),t=time();if(!l||t<=l.start+1e-6||t>=l.start+l.duration-1e-6){notify('Move the playhead inside the selected audio layer.');return;}
    host.pause();checkpoint();const left=t-l.start,c={...l,id:crypto.randomUUID(),name:l.name+' · part 2',start:t,source:l.source+left,duration:l.duration-left};l.duration=left;state.layers.splice(state.layers.indexOf(l)+1,0,c);refresh(c.id);
  }
  const input=document.createElement('input');input.type='file';input.accept='audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac';input.hidden=true;document.body.append(input);
  const slot=document.querySelector(`[data-audio-studio="${studio}"]`);if(slot)slot.hidden=true;
  const add=document.createElement('button');add.type='button';add.innerHTML='<b>♫</b>Audio';add.title='Add an audio layer';$(host.addGrid).append(add);
  add.onclick=()=>{pendingReplace=null;input.click();};
  input.onchange=async()=>{
    const file=input.files?.[0],replaceId=pendingReplace;input.value='';pendingReplace=null;if(!file)return;
    const generation=++state.generation;state.loading=true;notify('Loading audio…');
    try{
      const buffer=await audioContext().decodeAudioData(await file.arrayBuffer());if(generation!==state.generation)return;
      const peaks=new Float32Array(1000);
      for(let i=0;i<peaks.length;i++){const a=Math.floor(i*buffer.length/peaks.length),b=Math.floor((i+1)*buffer.length/peaks.length);for(let ch=0;ch<buffer.numberOfChannels;ch++){const data=buffer.getChannelData(ch);for(let j=a;j<b;j+=Math.max(1,Math.floor((b-a)/20)))peaks[i]=Math.max(peaks[i],Math.abs(data[j]));}}
      const old=replaceId?state.layers.find(l=>l.id===replaceId):null;if(replaceId&&!old){notify('The selected audio layer was removed.');return;}
      host.pause();checkpoint();
      if(old){old.buffer=buffer;old.peaks=peaks;old.fileName=file.name;old.source=0;old.duration=Math.min(old.duration,buffer.duration);refresh(old.id);notify('Audio replaced. Layer position, name, volume and mute were kept.');}
      else{const start=clamp(time(),0,Math.max(0,duration()-1/host.getFps()));const l={id:crypto.randomUUID(),name:file.name,fileName:file.name,buffer,peaks,start,source:0,duration:Math.min(buffer.duration,duration()-start),volume:.7,muted:false};state.layers.push(l);refresh(l.id);notify('Audio layer added. Drag its timeline edges to trim.');}
    }catch(e){if(generation===state.generation)notify('Could not load audio: '+e.message);}
    finally{if(generation===state.generation)state.loading=false;}
  };
  function renderList(){
    const box=$(host.list);box.querySelectorAll('[data-audio-layer]').forEach(n=>n.remove());
    if(state.layers.length)box.querySelector('.m-empty')?.remove();
    for(const l of state.layers){const row=document.createElement('div');row.className=`${studio==='motion'?'layer':'m-item'} ${current()?.id===l.id?'selected':''}`;row.dataset.audioLayer=l.id;
      row.innerHTML=`<span class="type">♫</span><span class="name">${esc(l.name)}</span><button type="button" title="${l.muted?'Unmute':'Mute'} audio layer">${l.muted?'🔇':'🔊'}</button>`;
      row.onclick=()=>host.select(l.id);row.querySelector('button').onclick=e=>{e.stopPropagation();checkpoint();l.muted=!l.muted;refresh(l.id);};box.append(row);
    }
    if(current())for(const id of host.actionButtons)$(id).disabled=false;
    const counter=$(host.counter);if(counter)counter.textContent=host.visualCount()+state.layers.length;
    host.updateHistory?.();
  }
  function renderInspector(){
    const l=current();if(!l)return false;
    if(host.inspectorTitle)$(host.inspectorTitle).textContent='Audio layer';
    const box=$(host.inspector),number=(key,label,value,min,max)=>`<label>${label}<input data-audio-prop="${key}" type="number" min="${min}" max="${max}" step="0.001" value="${+value.toFixed(4)}"></label>`;
    box.innerHTML=`<div class="inspector-title"><span>♫</span> Audio layer</div><div class="section-title">AUDIO SOURCE</div><p class="mini-label">Source: ${esc(l.fileName)}</p><button type="button" data-audio-replace>Replace audio…</button><div class="section-title" style="margin-top:18px">TIMING</div>${number('start','Timeline start (s)',l.start,0,Math.max(0,duration()-l.duration))}${number('source','Source start (s)',l.source,0,l.buffer.duration-l.duration)}${number('duration','Length (s)',l.duration,.001,Math.min(l.buffer.duration-l.source,duration()-l.start))}<div class="section-title">VOLUME</div><label>Volume (%)<input data-audio-prop="volume" type="number" min="0" max="100" step="1" value="${Math.round(l.volume*100)}"></label><label class="m-chk"><input data-audio-prop="muted" type="checkbox" ${l.muted?'checked':''}> Mute layer</label><div class="section-title">AUDIO ACTIONS</div><div style="display:flex;gap:6px;flex-wrap:wrap"><button type="button" data-audio-split>✂ Split at playhead</button><button type="button" data-audio-duplicate>Duplicate</button><button type="button" data-audio-delete>Delete layer</button><button type="button" data-audio-undo ${state.history.length?'':'disabled'}>Undo audio</button><button type="button" data-audio-redo ${state.future.length?'':'disabled'}>Redo audio</button></div><p class="mini-label">Drag the audio clip to move it. Drag its edges to trim. Split parts become independent layers. Overlapping audio layers mix in preview and export. Audio is session-only and is not embedded in saved projects.</p>`;
    box.querySelector('[data-audio-replace]').onclick=()=>{pendingReplace=l.id;input.click();};
    box.querySelector('[data-audio-split]').onclick=split;box.querySelector('[data-audio-duplicate]').onclick=duplicate;box.querySelector('[data-audio-delete]').onclick=remove;
    box.querySelector('[data-audio-undo]').onclick=()=>history('undo');box.querySelector('[data-audio-redo]').onclick=()=>history('redo');
    box.querySelectorAll('[data-audio-prop]').forEach(el=>el.onchange=()=>{
      const key=el.dataset.audioProp,v=Number(el.value);if(!['name','muted'].includes(key)&&!Number.isFinite(v)){renderInspector();return;}
      host.pause();checkpoint();
      if(key==='name')l.name=el.value.trim().slice(0,100)||'Audio';else if(key==='muted')l.muted=el.checked;else if(key==='volume')l.volume=clamp(v/100,0,1);
      else if(key==='start')l.start=clamp(v,0,Math.max(0,duration()-l.duration));
      else if(key==='source')l.source=clamp(v,0,Math.max(0,l.buffer.duration-l.duration));
      else l.duration=clamp(v,.001,Math.max(.001,Math.min(l.buffer.duration-l.source,duration()-l.start)));
      refresh(l.id);
    });return true;
  }
  function waveform(l){
    const points=[];for(let x=0;x<120;x++){const t=l.source+x/119*l.duration,index=clamp(Math.floor(t/l.buffer.duration*l.peaks.length),0,l.peaks.length-1),h=l.peaks[index]*10;points.push(`M${x} ${12-h}v${2*h}`);}
    return `<svg viewBox="0 0 120 24" preserveAspectRatio="none" aria-hidden="true" style="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;opacity:.65"><path d="${points.join(' ')}" stroke="#9bcebd" stroke-width=".6"/></svg>`;
  }
  bindTimelineRename($(host.trackLabels), { attribute: 'data-audio-label', getItem: id => state.layers.find(l => l.id === id), checkpoint, changed: () => refresh(), pause: host.pause });
  function renderTimeline(){
    const labels=$(host.trackLabels),rows=$(host.trackRows),last=Math.max(1,host.getFrames()-1)/host.getFps();
    labels.querySelectorAll('[data-audio-label]').forEach(n=>n.remove());rows.querySelectorAll('[data-audio-row]').forEach(n=>n.remove());
    for(const l of state.layers){const label=document.createElement('div');label.className=`track-label ${current()?.id===l.id?'selected':''}`;label.dataset.audioLabel=l.id;label.innerHTML=`<span>♫</span><span class="ff-layer-name" title="Double-click or double-tap to rename">${esc(l.name)}</span>`;label.onclick=()=>host.select(l.id);labels.append(label);
      const row=document.createElement('div');row.className=`track-row ${current()?.id===l.id?'selected':''}`;row.style.overflow='hidden';row.dataset.audioRow=l.id;
      row.innerHTML=`<div data-audio-clip="${l.id}" title="${esc(l.name)} · drag to move, edges to trim" style="position:absolute;top:6px;height:25px;left:${l.start/last*100}%;width:${l.duration/last*100}%;min-width:3px;background:${l.muted?'#393c42':'#294b45'};border:1px solid ${current()?.id===l.id?'#b6f36e':'#679589'};border-radius:4px;cursor:grab;overflow:hidden">${waveform(l)}<span data-edge="left" style="position:absolute;left:0;top:0;bottom:0;width:8px;cursor:ew-resize;z-index:2;background:#ffffff30"></span><span style="position:relative;padding-left:10px;font-size:9px;pointer-events:none;text-shadow:0 1px 3px #000">${esc(l.name)}</span><span data-edge="right" style="position:absolute;right:0;top:0;bottom:0;width:8px;cursor:ew-resize;z-index:2;background:#ffffff30"></span></div>`;
      row.onpointerdown=e=>{if(e.button!==0)return;e.preventDefault();e.stopPropagation();host.pause();const clip=e.target.closest('[data-audio-clip]'),rect=$(host.tracks).getBoundingClientRect();
        if(!clip){host.select(l.id);host.seek(Math.round(clamp((e.clientX-rect.left)/rect.width,0,1)*(host.getFrames()-1)));return;}
        drag={id:l.id,mode:e.target.dataset.edge||'move',x:e.clientX,width:rect.width,last,original:{...l},saved:false};host.select(l.id);
      };rows.append(row);
    }
  }
  window.addEventListener('pointermove',e=>{
    if(!drag)return;const l=state.layers.find(l=>l.id===drag.id);if(!l)return;
    const d=Math.round((e.clientX-drag.x)/drag.width*drag.last*host.getFps())/host.getFps(),o=drag.original,min=Math.min(o.duration,1/host.getFps());
    if(!drag.saved){if(!d)return;checkpoint();drag.saved=true;}
    if(drag.mode==='move')l.start=clamp(o.start+d,0,Math.max(0,duration()-o.duration));
    else if(drag.mode==='left'){const delta=clamp(d,Math.max(-o.start,-o.source),o.duration-min);l.start=o.start+delta;l.source=o.source+delta;l.duration=o.duration-delta;}
    else l.duration=clamp(o.duration+d,min,Math.max(min,Math.min(o.buffer.duration-o.source,duration()-o.start)));
    renderTimeline();renderInspector();
  });
  window.addEventListener('pointerup',()=>{if(drag){drag=null;refresh();}});
  for(const type of ['ff-play','ff-frame'])window.addEventListener(type,e=>{if(e.detail.studio!==studio)return;playing=e.detail.playing;sync(type==='ff-play');});
  window.addEventListener('blur',()=>{if(drag){drag=null;refresh();}});
  return {renderList,renderTimeline,renderInspector,remove,duplicate,move,canMove,history,syncPlayback:()=>sync(true),isSelected:()=>!!current(),
    item: id => state.layers.find(l => l.id === id),
    rowEnabled(id, action) { const i = state.layers.findIndex(l => l.id === id); return i >= 0 && (action === 'up' ? i > 0 : action === 'down' ? i < state.layers.length - 1 : true); },
    rowAction(id, action) { host.pause(); host.select(id); if(action === 'visibility') { checkpoint(); const l=current(); l.muted=!l.muted; refresh(id); } else if(action === 'up' || action === 'down') move(action === 'up' ? -1 : 1); else if(action === 'duplicate') duplicate(); else if(action === 'delete') remove(); },
    handlesHistory:()=>!!current()||(!host.getSelected()&&!!(state.history.length||state.future.length)),
    historyState:()=>current()||(!host.getSelected()&&(state.history.length||state.future.length))?{undo:!!state.history.length,redo:!!state.future.length}:null,
    reset(){++state.generation;state.loading=false;state.layers=[];state.history=[];state.future=[];stop();},count:()=>state.layers.length};
}
