let promptRequest;
const loadPrompt=()=>promptRequest??=(async()=>{
  try{
    const response=await fetch(new URL('./storyboard-ai-prompt.txt',import.meta.url));
    if(!response.ok)throw Error('The AI instructions could not load.');
    const prompt=await response.text();
    if(!prompt.startsWith('Write a complete, importable FrameFlow storyboard JSON'))throw Error('The AI instructions file is unavailable.');
    return prompt;
  }catch(error){promptRequest=undefined;throw error;}
})();

/** One copy implementation shared by the guides and the editor's upload dialog. */
export function installStoryboardAICopy(root=document){
  for(const button of root.querySelectorAll('[data-copy-storyboard-ai]')){
    if(button.dataset.copyBound)continue;button.dataset.copyBound='true';
    const panel=button.closest('[data-storyboard-ai]'),status=panel.querySelector('[data-storyboard-ai-status]'),manual=panel.querySelector('[data-storyboard-ai-manual]');
    const original=button.textContent;
    button.addEventListener('click',async()=>{
      button.disabled=true;button.textContent='Preparing AI instructions…';status.textContent='';manual.hidden=true;
      try{
        const prompt=await loadPrompt();let copied=false;
        try{if(navigator.clipboard?.writeText){await navigator.clipboard.writeText(prompt);copied=true;}}catch{}
        if(!copied){
          manual.value=prompt;manual.hidden=false;manual.focus();manual.select();
          try{copied=document.execCommand('copy');}catch{}
          if(copied){manual.hidden=true;button.focus();}
        }
        status.textContent=copied?'Copied the full guide, every option and ID, and a working example. Paste into your AI and replace MY STORY BRIEF.':'Automatic copy is unavailable. The full prompt is selected below; press Ctrl+C (Cmd+C on Mac), or download the text file.';
      }catch(error){status.textContent=error.message+' Use Download AI instructions to save the file.';}
      finally{button.disabled=false;button.textContent=original;}
    });
  }
}
if(typeof document!=='undefined')installStoryboardAICopy();
