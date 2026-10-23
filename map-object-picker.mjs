import { paintObjectPreviews } from './map-object-preview.mjs';

// The same cascading picker is used in Properties and the canvas toolbar.
export function bindObjectCascade(menu){
  const popup=menu.querySelector('.m-object-cascade'),summary=menu.querySelector('summary');
  if(!popup)return;
  // Canvas controls clone the Properties picker, including any generated UI.
  popup.querySelectorAll('.m-object-search,[data-object-category="recent"],[data-object-category="search"],[data-object-category-panel="recent"],[data-object-category-panel="search"]').forEach(el=>el.remove());
  const choice='[data-object-choice],[data-direct-object-choice]';
  const originals=[...popup.querySelectorAll(choice)],keyOf=el=>el.dataset.objectChoice||el.dataset.directObjectChoice;
  let recent=[];try{const saved=JSON.parse(localStorage.getItem('frameflow-recent-objects')||'[]');if(Array.isArray(saved))recent=saved.filter(key=>typeof key==='string').slice(0,8);}catch{}
  const tools=document.createElement('div');tools.className='m-object-search';
  tools.innerHTML='<input type="search" data-object-search aria-label="Search objects" placeholder="Search objects…" autocomplete="off">';
  popup.prepend(tools);const search=tools.firstElementChild;
  const types=popup.querySelector('.m-object-types'),submenus=popup.querySelector('.m-object-submenus');
  const special=(key,label)=>{
    const button=document.createElement('button');button.type='button';button.dataset.objectCategory=key;button.setAttribute('role','menuitem');button.setAttribute('aria-haspopup','true');button.textContent=label;
    const panel=document.createElement('div');panel.dataset.objectCategoryPanel=key;panel.setAttribute('role','listbox');panel.setAttribute('aria-label',label);panel.hidden=true;
    return{button,panel};
  };
  const recentUI=special('recent','Recent'),results=special('search','Search results');
  types.prepend(recentUI.button,results.button);submenus.prepend(recentUI.panel,results.panel);results.button.hidden=true;
  const categories=[...popup.querySelectorAll('[data-object-category]')];
  const panels=[...popup.querySelectorAll('[data-object-category-panel]')];
  let active=0,session=null,observer=null,previews=null,paintFrame=0;
  const pending=new Set();
  const stopPreviews=()=>{
    previews?.disconnect();previews=null;pending.clear();
    cancelAnimationFrame(paintFrame);paintFrame=0;
  };
  const paintNext=()=>{
    paintFrame=0;
    const img=pending.values().next().value;if(!img)return;
    pending.delete(img);
    if(session&&img.isConnected&&!panels[active].hidden&&panels[active].contains(img)){
      img.dataset.objectPreview=img.dataset.objectPreviewLazy;
      // Paint a single row between frames; never render a whole category in
      // the pointer/focus handler. Keep the lazy marker for future view changes.
      paintObjectPreviews(img.parentElement);
    }
    if(pending.size)paintFrame=requestAnimationFrame(paintNext);
  };
  const show=index=>{
    if(active===index&&previews)return;
    stopPreviews();
    active=index;
    categories.forEach((button,i)=>button.setAttribute('aria-expanded',String(i===index)));
    panels.forEach((panel,i)=>panel.hidden=i!==index);
    const panel=panels[index];
    previews=new IntersectionObserver(entries=>{
      for(const {target,isIntersecting}of entries){
        if(isIntersecting)pending.add(target);else pending.delete(target);
      }
      if(pending.size&&!paintFrame)paintFrame=requestAnimationFrame(paintNext);
    },{root:panel.parentElement});
    for(const img of panel.querySelectorAll('[data-object-preview-lazy]'))previews.observe(img);
  };
  const fill=(panel,label,rows)=>{
    panel.replaceChildren();const heading=document.createElement('h4');heading.textContent=label;panel.append(heading);
    for(const source of rows){
      const button=source.cloneNode(true),img=button.querySelector('img');
      if(img){img.removeAttribute('src');delete img.dataset.objectPreview;}
      button.onclick=()=>source.click();panel.append(button);
    }
    if(!rows.length){const empty=document.createElement('p');empty.className='m-object-empty';empty.textContent='No matching objects.';panel.append(empty);}
  };
  search.oninput=()=>{
    const query=search.value.trim().toLocaleLowerCase();results.button.hidden=!query;
    stopPreviews();
    if(!query){show(0);return;}
    const matches=originals.filter(row=>(row.textContent+' '+keyOf(row)).toLocaleLowerCase().includes(query));
    fill(results.panel,`${matches.length} results`,matches);submenus.scrollTop=0;show(1);
  };
  const close=()=>{
    stopPreviews();
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
  popup.addEventListener('click',e=>{
    const row=e.target.closest(choice);if(!row)return;
    const key=keyOf(row);recent=[key,...recent.filter(item=>item!==key)].slice(0,8);
    try{localStorage.setItem('frameflow-recent-objects',JSON.stringify(recent));}catch{}
    close();
  });
  const keyboard=e=>{
    if(e.key==='Escape'){e.preventDefault();e.stopPropagation();close();summary.focus();return;}
    if(e.target===search){
      if(e.key==='ArrowDown'){e.preventDefault();panels[active].querySelector(choice)?.focus();}
      return;
    }
    if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;
    e.preventDefault();e.stopPropagation();
    const inCategory=e.target.closest('[data-object-category]');
    if(inCategory){
      if(e.key==='ArrowRight'){panels[active].querySelector(choice)?.focus();return;}
      if(e.key==='ArrowLeft')return;
      const visible=categories.filter(button=>!button.hidden),at=visible.indexOf(inCategory);
      visible[e.key==='Home'?0:e.key==='End'?visible.length-1:(at+(e.key==='ArrowDown'?1:-1)+visible.length)%visible.length]?.focus();
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
    search.value='';results.button.hidden=true;
    const selected=originals.find(row=>row.getAttribute('aria-selected')==='true'),keys=[...new Set([...(selected?[keyOf(selected)]:[]),...recent])];
    fill(recentUI.panel,'Recently used',keys.map(key=>originals.find(row=>keyOf(row)===key)).filter(Boolean));
    show(0);summary.setAttribute('aria-expanded','true');
    document.addEventListener('pointerdown',e=>{if(!popup.contains(e.target)&&!menu.contains(e.target))close();},{capture:true,signal});
    window.addEventListener('resize',close,{signal});
    document.addEventListener('scroll',e=>{if(!popup.contains(e.target))close();},{capture:true,signal});
    document.addEventListener('focusin',e=>{if(!popup.contains(e.target)&&!menu.contains(e.target))close();},{signal});
    observer=new MutationObserver(()=>{if(!menu.isConnected)close();});
    observer.observe(document.body,{childList:true,subtree:true});
  };
}
