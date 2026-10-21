import { paintObjectPreviews } from './map-object-preview.mjs';

// The same cascading picker is used in Properties and the canvas toolbar.
export function bindObjectCascade(menu){
  const popup=menu.querySelector('.m-object-cascade'),summary=menu.querySelector('summary');
  if(!popup)return;
  const categories=[...popup.querySelectorAll('[data-object-category]')];
  const panels=[...popup.querySelectorAll('[data-object-category-panel]')];
  const choice='[data-object-choice],[data-direct-object-choice]';
  let active=0,session=null,observer=null;
  const show=index=>{
    active=index;
    categories.forEach((button,i)=>button.setAttribute('aria-expanded',String(i===index)));
    panels.forEach((panel,i)=>panel.hidden=i!==index);
    const panel=panels[index];
    for(const img of panel.querySelectorAll('[data-object-preview-lazy]')){
      img.dataset.objectPreview=img.dataset.objectPreviewLazy;delete img.dataset.objectPreviewLazy;
    }
    paintObjectPreviews(panel);
  };
  const close=()=>{
    session?.abort();session=null;observer?.disconnect();observer=null;
    popup.hidden=true;menu.append(popup);menu.open=false;summary.setAttribute('aria-expanded','false');
  };
  const position=()=>{
    const r=summary.getBoundingClientRect(),gap=5,pad=8;
    popup.style.width=Math.min(480,window.innerWidth-pad*2)+'px';
    const below=window.innerHeight-r.bottom-pad,above=r.top-pad;
    const down=below>=Math.min(300,above),height=Math.max(100,Math.min(430,down?below:above)-gap);
    popup.style.height=height+'px';
    popup.style.left=Math.max(pad,Math.min(r.left,window.innerWidth-popup.offsetWidth-pad))+'px';
    popup.style.top=(down?r.bottom+gap:Math.max(pad,r.top-height-gap))+'px';
  };
  categories.forEach((button,i)=>{
    button.onpointerenter=()=>show(i);button.onfocus=()=>show(i);button.onclick=()=>show(i);
  });
  popup.addEventListener('click',e=>{if(e.target.closest(choice))close();});
  const keyboard=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();summary.focus();return;}
    if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    const inCategory=e.target.closest('[data-object-category]');
    if(inCategory){
      if(e.key==='ArrowRight'){panels[active].querySelector(choice)?.focus();return;}
      if(e.key==='ArrowLeft')return;
      const i=e.key==='Home'?0:e.key==='End'?categories.length-1:(active+(e.key==='ArrowDown'?1:-1)+categories.length)%categories.length;
      categories[i].focus();
    }else{
      if(e.key==='ArrowLeft'){categories[active].focus();return;}
      if(e.key==='ArrowRight')return;
      const options=[...panels[active].querySelectorAll(choice)],at=options.indexOf(document.activeElement);
      options[e.key==='Home'?0:e.key==='End'?options.length-1:(at+(e.key==='ArrowDown'?1:-1)+options.length)%options.length]?.focus();
    }
  };
  popup.addEventListener('keydown',keyboard);
  summary.addEventListener('keydown',e=>{
    if(e.key==='Escape'&&menu.open){e.preventDefault();e.stopPropagation();close();return;}
    if(['ArrowDown','ArrowRight'].includes(e.key)){e.preventDefault();menu.open=true;menu.ontoggle();categories[active].focus();}
  });
  menu.ontoggle=()=>{
    if(!menu.open){if(session)close();return;}
    if(session)return;
    session=new AbortController();const {signal}=session;
    document.body.append(popup);popup.hidden=false;position();
    const selected=panels.findIndex(panel=>panel.querySelector('[aria-selected=true]'));
    show(selected<0?0:selected);summary.setAttribute('aria-expanded','true');
    document.addEventListener('pointerdown',e=>{if(!popup.contains(e.target)&&!menu.contains(e.target))close();},{capture:true,signal});
    window.addEventListener('resize',close,{signal});
    document.addEventListener('scroll',e=>{if(!popup.contains(e.target))close();},{capture:true,signal});
    document.addEventListener('focusin',e=>{if(!popup.contains(e.target)&&!menu.contains(e.target))close();},{signal});
    observer=new MutationObserver(()=>{if(!menu.isConnected)close();});
    observer.observe(document.body,{childList:true,subtree:true});
  };
}
