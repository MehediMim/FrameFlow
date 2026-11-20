import { parseStoryboard, compileStoryboard, formatStoryboardTime } from './map-storyboard.mjs';
import { drawMap } from './map-engine.mjs?v=shape-sizing-1';
import { mapFontsUsed, preloadBadges } from './map-engine.mjs?v=shape-sizing-1';
import { loadFonts } from './fonts.mjs';
import { storyboardFromProject, STORYBOARD_MAX_BYTES } from './map-storyboard-editor.mjs';
import { prepareStoryboardMedia } from './map-storyboard-media.mjs';
import { installStoryboardAICopy } from './storyboard-ai-copy.mjs';

export function installStoryboardUI({getProject, prepareGeo, applyProject, pause,prepareAudio,getAudio=()=>undefined,getPreviewAudio=()=>[]}) {
  const dialog=document.createElement('dialog');
  dialog.id='mStoryboardDialog';dialog.className='ff-dialog ff-storyboard';
  dialog.setAttribute('aria-labelledby','mStoryboardTitle');
  dialog.innerHTML=`<div class="storyboard-heading"><div><p class="storyboard-eyebrow">STORY AUTOMATION</p><h2 id="mStoryboardTitle">Build a map from your storyboard</h2></div><button type="button" id="mStoryboardClose" aria-label="Close storyboard">✕</button></div>
    <p>Upload a timed JSON or text script. Preview the scenes, then generate editable map layers and camera keyframes for the full video.</p>
    <div class="storyboard-tools"><button type="button" id="mStoryboardUpload">Upload storyboard</button><span id="mStoryboardFileName">.json or .txt · up to 5 MB</span><input id="mStoryboardFile" type="file" accept=".json,.txt,application/json,text/plain" hidden></div>
    <div class="storyboard-tools"><button type="button" id="mStoryboardExport">Download current map as script</button><button type="button" id="mStoryboardMedia">Add supporting files</button><span id="mStoryboardMediaNames">Images and audio stay on your device.</span><input id="mStoryboardMediaFiles" type="file" accept="image/*,audio/*,.svg,.wav,.mp3,.m4a,.ogg,.flac" multiple hidden></div>
    <div class="storyboard-examples"><span>Start with a 4-minute example:</span><a href="examples/storyboard-4-minutes.json" download>JSON template</a><a href="examples/storyboard-4-minutes.txt" download>Text template</a><a href="storyboard-guide.html" target="_blank" rel="noopener">Format guide</a></div>
    <div class="storyboard-examples"><a href="storyboard-reference.html" target="_blank" rel="noopener">Every editor option</a><a href="storyboard-reference.json" download>Download option reference</a><a href="examples/storyboard-full-control.json" download>Full-control template</a></div>
    <details data-storyboard-ai><summary>Have an AI write your storyboard</summary><p>Copy the complete guide, every editor option and ID, and a working example. Paste it into your AI and replace <strong>MY STORY BRIEF</strong> with your story and duration.</p><div class="storyboard-ai-actions"><button type="button" data-copy-storyboard-ai>Copy full AI instructions</button><a href="storyboard-ai-prompt.txt" download>Download AI instructions</a></div><p data-storyboard-ai-status role="status" aria-live="polite"></p><textarea data-storyboard-ai-manual hidden readonly aria-label="Complete AI storyboard instructions for manual copying"></textarea></details>
    <label for="mStoryboardMotion">Motion preset</label><select id="mStoryboardMotion"><option value="script">Use script · cinematic by default</option><option value="cinematic">Cinematic · sustained camera motion and object resizing</option><option value="subtle">Subtle · slower zoom and smaller size changes</option><option value="none">Scripted motion only</option></select>
    <label for="mStoryboardText">Storyboard script</label><textarea id="mStoryboardText" rows="12" spellcheck="false" maxlength="5000000" placeholder='name: My story&#10;duration: 04:00&#10;&#10;[00:00 - 00:30] Opening scene&#10;description: Introduce the story.'></textarea>
    <p class="storyboard-hint">Scene times use the video clock. Native layers and cameraTracks use frame numbers. Use asset:filename for images and an audio list for timed sound clips; select their files above.</p>
    <div id="mStoryboardError" role="alert" hidden></div><div id="mStoryboardPreview" aria-live="polite"></div>
    <p class="storyboard-replace">Build applies the script's map settings, layers, camera, and video duration. An audio list replaces session audio; omit it to keep existing clips. Undo restores the previous edit.</p>
    <div class="ff-dialog-actions"><button type="button" id="mStoryboardPreviewButton">Preview storyboard</button><button type="button" id="mStoryboardBuild" class="primary" disabled>Build timeline</button></div>`;
  document.body.append(dialog);
  installStoryboardAICopy(dialog);
  const $=id=>dialog.querySelector('#'+id),text=$('mStoryboardText'),preview=$('mStoryboardPreview'),error=$('mStoryboardError'),build=$('mStoryboardBuild'),check=$('mStoryboardPreviewButton');
  let revision=0,result=null,validatedBase=null,busy=false,previewFrame=0,animation=0,player=null,previewAudioContext,previewAudio=[],previewPlayback=0;const files=new Map();
  const stopPreview=()=>{previewPlayback++;cancelAnimationFrame(animation);animation=0;for(const node of previewAudio){try{node.stop();}catch{}node.disconnect();}previewAudio=[];if(player){player.button.textContent='Play motion preview';player.button.setAttribute('aria-pressed','false');}};
  const invalidate=()=>{stopPreview();player=null;revision++;result=null;validatedBase=null;build.disabled=true;preview.replaceChildren();error.hidden=true;};
  const showError=e=>{error.textContent=e.message||String(e);error.hidden=false;};
  const setBusy=value=>{busy=value;check.disabled=value;check.textContent=value?'Checking storyboard…':'Preview storyboard';};
  const open=()=>{
    pause();
    if(!text.value&&getProject().storyboard?.source)text.value=JSON.stringify(getProject().storyboard.source,null,2);
    invalidate();if(!dialog.open)dialog.showModal();
  };
  document.getElementById('mStoryboard').addEventListener('click',open);
  $('mStoryboardClose').onclick=()=>dialog.close();
  dialog.addEventListener('close',invalidate);
  text.addEventListener('input',invalidate);
  $('mStoryboardMotion').addEventListener('change',invalidate);
  $('mStoryboardMedia').onclick=()=>$('mStoryboardMediaFiles').click();
  $('mStoryboardMediaFiles').onchange=e=>{
    invalidate();for(const file of e.target.files)files.set(file.name,file);e.target.value='';
    $('mStoryboardMediaNames').textContent=[...files.keys()].join(', ')||'Images and audio stay on your device.';
  };
  $('mStoryboardExport').onclick=()=>{
    try{
      const raw=storyboardFromProject(getProject(),getAudio()),blob=new Blob([JSON.stringify(raw,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
      a.href=url;a.download=(getProject().name||'map').replace(/[^a-z0-9 _-]/gi,'').trim()+'.storyboard.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
    }catch(e){showError(e);}
  };
  $('mStoryboardUpload').onclick=()=>$('mStoryboardFile').click();
  $('mStoryboardFile').onchange=async e=>{
    const file=e.target.files[0];e.target.value='';if(!file)return;
    invalidate();const current=revision;
    try {
      if(file.size>STORYBOARD_MAX_BYTES)throw Error('Storyboard must be smaller than 5 MB.');
      if(!/\.(json|txt)$/i.test(file.name))throw Error('Choose a .json or .txt storyboard file.');
      const contents=await file.text();if(current!==revision)return;
      text.value=contents;$('mStoryboardFileName').textContent=file.name;await validate();
    }catch(e){if(current===revision)showError(e);}
  };
  async function validate(){
    if(busy)return;
    invalidate();const current=revision;setBusy(true);
    try {
      let raw=await prepareStoryboardMedia(parseStoryboard(text.value),files);
      if(raw?.kind==='map')raw=storyboardFromProject(raw);
      const base=structuredClone(getProject()),geo=await prepareGeo(raw);
      if($('mStoryboardMotion').value!=='script')raw.motion=$('mStoryboardMotion').value;
      const compiled=compileStoryboard(raw,base,geo);
      if(compiled.audio!==undefined){
        if(!prepareAudio)throw Error('Audio scripting is unavailable in this editor.');
        compiled.audioLayers=await prepareAudio(compiled.audio,files);
      }
      await Promise.all([preloadBadges(compiled.project),loadFonts(mapFontsUsed(compiled.project))]);
      if(current!==revision)return;
      result=compiled;validatedBase=JSON.stringify(getProject());
      const summary=document.createElement('p');summary.className='storyboard-summary';
      summary.textContent=`${compiled.project.name} · ${formatStoryboardTime(compiled.project.frames/compiled.project.fps)} · ${compiled.project.fps} fps · ${compiled.scenes.length} scenes · ${compiled.project.actions.length} layers${compiled.audio?' · '+compiled.audio.length+' audio clips':''}`;
      const list=document.createElement('ol');list.className='storyboard-scenes';
      preview.append(summary);
      const motionPreview=document.createElement('section');motionPreview.className='storyboard-player';motionPreview.setAttribute('aria-label','Animated storyboard preview');
      motionPreview.innerHTML='<canvas id="mStoryboardMotionCanvas" width="640" height="360" aria-label="Storyboard animation"></canvas><div class="storyboard-player-controls"><button type="button" id="mStoryboardPlay" aria-pressed="false">Play motion preview</button><input id="mStoryboardScrub" type="range" min="0" step="1" aria-label="Storyboard preview time"><span id="mStoryboardPreviewTime"></span></div>';
      preview.append(motionPreview);
      player={canvas:$('mStoryboardMotionCanvas'),button:$('mStoryboardPlay'),scrub:$('mStoryboardScrub'),time:$('mStoryboardPreviewTime')};
      const previewScale=Math.min(1,640/Math.max(compiled.project.width,compiled.project.height));
      player.canvas.width=Math.round(compiled.project.width*previewScale);player.canvas.height=Math.round(compiled.project.height*previewScale);player.canvas.style.aspectRatio=`${compiled.project.width} / ${compiled.project.height}`;
      player.scrub.max=compiled.project.frames-1;previewFrame=0;
      const paint=()=>{
        if(!player)return;
        drawMap(player.canvas.getContext('2d'),player.canvas.width,player.canvas.height,compiled.project,previewFrame,geo);
        player.scrub.value=previewFrame;player.time.textContent=formatStoryboardTime(previewFrame/compiled.project.fps);
      };
      const play=()=>{
        stopPreview();if(previewFrame>=compiled.project.frames-1)previewFrame=0;
        const started=performance.now(),from=previewFrame,playback=previewPlayback,audioLayers=compiled.audioLayers??getPreviewAudio();
        player.button.textContent='Pause preview';player.button.setAttribute('aria-pressed','true');
        const tick=now=>{if(!player)return;previewFrame=Math.min(compiled.project.frames-1,from+Math.floor((now-started)/1000*compiled.project.fps));paint();if(previewFrame===compiled.project.frames-1){stopPreview();return;}animation=requestAnimationFrame(tick);};
        animation=requestAnimationFrame(tick);
        if(audioLayers.length){
          previewAudioContext??=new (window.AudioContext||window.webkitAudioContext)();
          const generation=revision;
          previewAudioContext.resume().then(()=>{
            if(!animation||generation!==revision||playback!==previewPlayback)return;
            const at=previewFrame/compiled.project.fps,ctx=previewAudioContext;
            for(const clip of audioLayers){
              const skip=Math.max(0,at-clip.start),length=clip.duration-skip;if(clip.muted||!clip.volume||length<=0)continue;
              const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=clip.buffer;gain.gain.value=clip.volume;source.connect(gain);gain.connect(ctx.destination);source.onended=()=>gain.disconnect();
              source.start(ctx.currentTime+Math.max(0,clip.start-at),clip.source+skip,length);previewAudio.push(source);
            }
          }).catch(showError);
        }
      };
      player.button.onclick=()=>{if(animation)stopPreview();else play();};
      player.scrub.oninput=()=>{stopPreview();previewFrame=Number(player.scrub.value);paint();};paint();
      for(const scene of compiled.scenes){
        const row=document.createElement('li'),time=document.createElement('span'),content=document.createElement('div'),title=document.createElement('strong');
        time.className='storyboard-time';time.textContent=`${formatStoryboardTime(scene.start/compiled.project.fps)} – ${formatStoryboardTime(scene.end/compiled.project.fps)}`;
        title.textContent=scene.title;content.append(title);
        const details=document.createElement('span');details.textContent=`${scene.type} · ${scene.layerIds.length} layers`;content.append(details);
        const motionDetails=document.createElement('span');motionDetails.textContent=`${scene.cameraMotion} · ${scene.resizingObjects} resizing objects`;content.append(motionDetails);
        if(scene.narration||scene.description){const p=document.createElement('p');p.textContent=scene.narration||scene.description;content.append(p);}
        const watch=document.createElement('button');watch.type='button';watch.textContent='Play scene';watch.onclick=()=>{previewFrame=scene.start;paint();play();motionPreview.scrollIntoView({block:'nearest',behavior:'smooth'});};content.append(watch);
        row.append(time,content);list.append(row);
      }
      preview.append(list);
      if(compiled.warnings.length){const warnings=document.createElement('ul');warnings.className='storyboard-warnings';for(const warning of compiled.warnings){const li=document.createElement('li');li.textContent=warning;warnings.append(li);}preview.append(warnings);}
      build.disabled=false;
    }catch(e){if(current===revision)showError(e);}finally{setBusy(false);}
  }
  check.onclick=validate;
  build.onclick=()=>{
    if(!result)return;
    if(JSON.stringify(getProject())!==validatedBase){invalidate();showError(Error('The map changed after preview. Preview the storyboard again before building.'));return;}
    const project=result.project;
    try{applyProject(project,result.audioLayers);dialog.close();}catch(e){showError(e);}
  };
}
