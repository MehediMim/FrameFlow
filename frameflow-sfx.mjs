// FrameFlow automatic procedural sound effects. No external sound files or network requests.
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const TYPES={whoosh:'Whoosh',pop:'Pop',click:'Click',rise:'Rise',soft:'Soft tap'};
function waveform(type,rate=24000){
  const duration={whoosh:.48,pop:.22,click:.10,rise:.62,soft:.16}[type]||.22;
  const count=Math.round(duration*rate),samples=new Float32Array(count);
  let seed=1234567;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967295*2-1;};
  let filtered=0,phase=0;
  for(let i=0;i<count;i++){
    const t=i/rate,u=i/(count-1),noise=rand();filtered=filtered*.78+noise*.22;
    const env=Math.pow(Math.sin(Math.PI*u),type==='whoosh'?.9:1.4);
    const hz=type==='rise'?200+850*u:type==='pop'?520-350*u:type==='click'?1100-400*u:type==='soft'?260-120*u:130+440*u;
    phase+=2*Math.PI*hz/rate;
    let sample=type==='whoosh'?(filtered*.68+Math.sin(phase)*.20):type==='rise'?Math.sin(phase)*.6+filtered*.12:type==='click'?noise*.5+Math.sin(phase)*.4:type==='soft'?Math.sin(phase)*.3+filtered*.1:Math.sin(phase)*.55+filtered*.16;
    samples[i]=sample*env*.8;
  }
  return samples;
}
function wav(samples,rate){const b=new ArrayBuffer(44+samples.length*2),v=new DataView(b);const str=(i,s)=>{for(let n=0;n<s.length;n++)v.setUint8(i+n,s.charCodeAt(n));};str(0,'RIFF');v.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,samples.length*2,true);for(let i=0;i<samples.length;i++)v.setInt16(44+i*2,Math.round(clamp(samples[i],-1,1)*32767),true);return new Blob([b],{type:'audio/wav'});}
const dedupe=events=>{const used=new Set();return events.filter(e=>{const k=`${e.f}:${e.id}`;if(used.has(k))return false;used.add(k);return true;}).sort((a,b)=>a.f-b.f)};
export function motionEvents(p){let events=[];for(const l of p.layers||[]){if(l.visible===false||l.type==='group')continue;const type=l.type==='table'?'rise':l.type==='text'?'whoosh':l.type==='image'?'pop':'soft';events.push({f:Math.max(0,Math.round(l.in||0)),type,id:l.id+':in'});for(const [prop,keys] of Object.entries(l.keys||{})){if(!['x','y','scale','rotation','opacity'].includes(prop))continue;for(const k of keys||[])if(k.f>l.in&&k.f<=l.out)events.push({f:k.f,type:prop==='opacity'?'soft':prop==='scale'?'pop':'whoosh',id:l.id+':'+k.f});}}return dedupe(events);}
export function mapEvents(p){let events=[];for(const a of p.actions||[]){const type=({plane:'whoosh',pin:'pop',border:'rise',highlight:'soft',shot:'whoosh'})[a.type]||'click';events.push({f:Math.max(0,Math.round(a.start||0)),type,id:a.id||'action'});}for(const shot of p.shots||[])events.push({f:Math.max(0,Math.round(shot.start||0)),type:'whoosh',id:shot.id||'shot'});return dedupe(events);}
export function installAutoSfx({studio,project,playing}){
  const stage=document.querySelector(studio==='map'?'#mapStudio .stagebar':'body > .workspace.motion-only .stagebar');
  if(!stage)return{onFrame(){},reset(){}};
  let enabled=true,volume=.25,last=null,audio=null;
  const panel=document.createElement('div');panel.className='ff-sfx';panel.innerHTML=`<label class="ff-sfx-check"><input type="checkbox" checked> 🔊 Auto SFX</label><select aria-label="SFX sound"><option value="auto">Auto types</option>${Object.entries(TYPES).map(([v,n])=>`<option value="${v}">${n}</option>`).join('')}</select><input type="range" min="0" max="100" value="25" title="SFX volume" aria-label="SFX volume"><button type="button" title="Download synchronized SFX audio track">↓ WAV</button>`;
  stage.querySelector('div:last-child')?.append(panel);
  const checkbox=panel.querySelector('input[type=checkbox]'),sel=panel.querySelector('select'),range=panel.querySelector('input[type=range]'),button=panel.querySelector('button');
  checkbox.onchange=()=>{enabled=checkbox.checked;last=null};range.oninput=()=>volume=+range.value/100;
  function getEvents(){const p=project();return (studio==='map'?mapEvents(p):motionEvents(p)).filter(e=>e.f<p.frames);}
  async function playEvent(type){try{const A=window.AudioContext||window.webkitAudioContext;if(!A)return;audio??=new A();if(audio.state==='suspended')await audio.resume();const sample=waveform(type,audio.sampleRate),buffer=audio.createBuffer(1,sample.length,audio.sampleRate);buffer.getChannelData(0).set(sample);const source=audio.createBufferSource(),gain=audio.createGain();gain.gain.value=volume;source.buffer=buffer;source.connect(gain).connect(audio.destination);source.start();}catch(err){console.warn('SFX preview unavailable',err);}}
  function onFrame(f){if(!enabled||!playing()){last=null;return;}const previous=last;last=f;const lo=previous===null?f-1:previous;const ev=getEvents();const candidates=previous!==null&&f<previous?ev.filter(e=>e.f>lo||e.f<=f):ev.filter(e=>e.f>lo&&e.f<=f);for(const e of candidates.slice(0,4))playEvent(sel.value==='auto'?e.type:sel.value);}
  function renderAudio(){const p=project(),rate=24000,count=Math.ceil(p.frames/p.fps*rate),result=new Float32Array(count),ev=getEvents();for(const e of ev){const s=waveform(sel.value==='auto'?e.type:sel.value,rate),offset=Math.round(e.f/p.fps*rate);for(let i=0;i<s.length&&offset+i<count;i++)result[offset+i]+=s[i]*volume;}let peak=0;for(const v of result)peak=Math.max(peak,Math.abs(v));if(peak>1)for(let i=0;i<result.length;i++)result[i]/=peak;return wav(result,rate);}
  button.onclick=()=>{const blob=renderAudio(),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=(project().name||studio).replace(/[^a-z0-9_-]/gi,'_')+'_sfx.wav';link.click();setTimeout(()=>URL.revokeObjectURL(url),15000);};
  return{onFrame,reset(){last=null}};
}
