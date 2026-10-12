// Reference audio for animation timing. Not saved to projects or included in video exports.
const tracks = new Map();
for (const slot of document.querySelectorAll('[data-audio-studio]')) {
  const studio = slot.dataset.audioStudio;
  const state = { audio: new Audio(), url: null, duration: 0, peaks: null, frame: 0, fps: 30, playing: false, offset: 0 };
  state.audio.preload = 'auto';
  slot.innerHTML = `<div class="ff-audio"><button type="button" data-load>♫ Add audio</button><input type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" hidden><span class="ff-audio-name">No reference audio</span><canvas class="ff-audio-wave" height="37" aria-label="Audio waveform, click to move playhead"></canvas><button type="button" data-mute title="Mute reference track">🔊</button><input type="range" min="0" max="100" value="70" aria-label="Reference audio volume"><button type="button" data-remove title="Remove audio">✕</button></div>`;
  const q = s => slot.querySelector(s), file = q('input[type=file]'), wave = q('canvas'), name = q('.ff-audio-name');
  const paint = () => {
    const rect = wave.getBoundingClientRect(), width = Math.max(80, Math.round(rect.width * devicePixelRatio));
    const height = 37 * devicePixelRatio;
    if (wave.width !== width || wave.height !== height) { wave.width = width; wave.height = height; }
    const c = wave.getContext('2d'); c.clearRect(0,0,width,height);c.fillStyle='#142028';c.fillRect(0,0,width,height);
    const peaks = state.peaks;
    if (peaks) {c.fillStyle='#79b79f';for(let i=0;i<width;i++){const peak=peaks[Math.min(peaks.length-1,Math.floor(i/width*peaks.length))]||0;const h=Math.max(1,peak*height*.85);c.fillRect(i,(height-h)/2,1,h);}}
    else {c.strokeStyle='#3e5858';c.beginPath();c.moveTo(0,height/2);c.lineTo(width,height/2);c.stroke();}
    if(state.duration){const x=Math.max(0,Math.min(width,(state.frame/state.fps-state.offset)/state.duration*width));c.fillStyle='#b6f36e';c.fillRect(x,0,Math.max(2,devicePixelRatio),height);}
  };
  async function loadAudio(f) {
    state.audio.pause(); if(state.url)URL.revokeObjectURL(state.url);
    state.url=URL.createObjectURL(f);state.audio.src=state.url;state.offset=0;state.peaks=null;name.textContent=f.name;name.title=f.name;
    try {
      const bytes=await f.arrayBuffer();const context=new (window.AudioContext||window.webkitAudioContext)();
      try {const buffer=await context.decodeAudioData(bytes);const channels=Array.from({length:buffer.numberOfChannels},(_,i)=>buffer.getChannelData(i));const peaks=new Float32Array(1400);const step=Math.max(1,Math.floor(buffer.length/peaks.length));for(let i=0;i<peaks.length;i++){let hi=0;for(let j=i*step;j<Math.min(buffer.length,(i+1)*step);j+=Math.max(1,Math.floor(step/24))){for(const channel of channels)hi=Math.max(hi,Math.abs(channel[j]||0));}peaks[i]=hi;}state.peaks=peaks;state.duration=buffer.duration;}
      finally {await context.close();}
    } catch {state.duration=0;state.peaks=null;}
    paint();
  }
  q('[data-load]').onclick=()=>file.click();
  file.onchange=()=>{if(file.files?.[0])loadAudio(file.files[0]);file.value='';};
  q('[data-mute]').onclick=()=>{state.audio.muted=!state.audio.muted;q('[data-mute]').textContent=state.audio.muted?'🔇':'🔊';};
  q('input[type=range]').oninput=e=>{state.audio.volume=Number(e.target.value)/100;};state.audio.volume=.7;
  q('[data-remove]').onclick=()=>{state.audio.pause();state.audio.removeAttribute('src');state.audio.load();if(state.url)URL.revokeObjectURL(state.url);state.url=null;state.duration=0;state.peaks=null;name.textContent='No reference audio';paint();};
  wave.addEventListener('pointerdown',e=>{if(!state.duration)return;const rect=wave.getBoundingClientRect();const time=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width))*state.duration;state.offset=state.frame/state.fps-time;sync();paint();});
  function sync(){if(!state.url)return;const t=state.frame/state.fps-state.offset;
    if(t<0||t>=state.audio.duration){state.audio.pause();return;}
    if(Math.abs(state.audio.currentTime-t)>.15)try{state.audio.currentTime=t;}catch{}
    if(state.playing){state.audio.play().catch(()=>{});}else state.audio.pause();
  }
  tracks.set(studio,{state,sync,paint});
  new ResizeObserver(paint).observe(wave);
  paint();
}
window.addEventListener('ff-play',e=>{const track=tracks.get(e.detail.studio);if(!track)return;Object.assign(track.state,{frame:e.detail.frame,fps:e.detail.fps,playing:e.detail.playing});track.sync();track.paint();});
window.addEventListener('ff-frame',e=>{const track=tracks.get(e.detail.studio);if(!track)return;const state=track.state,was=state.frame;Object.assign(state,{frame:e.detail.frame,fps:e.detail.fps,playing:e.detail.playing});if(!state.playing||Math.abs(state.frame-was)>state.fps*1.3)track.sync();track.paint();});