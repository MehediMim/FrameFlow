// A self-contained landing demonstration; it never changes an editor project.
const root=document.getElementById('landing');
if(root){
  const play=root.querySelector('#mhPreviewPlay'),seek=root.querySelector('#mhPreviewSeek'),time=root.querySelector('#mhPreviewTime');
  const reduced=matchMedia('(prefers-reduced-motion:reduce)');
  let playing=false,raf=0,last=0;
  function render(value){
    const t=Math.max(0,Math.min(1,value/100)),curve=Math.sin(t*Math.PI/2);
    root.querySelectorAll('[data-demo-front]').forEach(path=>path.setAttribute('d',`M${585+curve*110} 246 Q${655+curve*110} 360 ${560+curve*90} 510`));
    root.querySelectorAll('[data-demo-marker]').forEach(circle=>{circle.setAttribute('cx',String(575+curve*155));circle.setAttribute('cy',String(380-curve*80));});
    const line=root.querySelector('#mhFrontDemo');if(line)line.setAttribute('d',`M${275+curve*65} 44 Q${260+curve*145} 155 ${285+curve*40} 260`);
    const group=root.querySelector('#mhGroupDemo');if(group)group.setAttribute('transform',`translate(${150+curve*75} ${175-curve*35}) rotate(${curve*20})`);
    const head=root.querySelector('#mhDiagramPlayhead');if(head)head.style.left=`${24+t*66}%`;
    const traveler=root.querySelector('[data-demo-traveler]');if(traveler)traveler.setAttribute('transform',`translate(${232+curve*172} ${208+curve*110}) rotate(${20+curve*40})`);
    const hundredths=Math.round(t*800);time.textContent=`00:${String(Math.floor(hundredths/100)).padStart(2,'0')}.${String(hundredths%100).padStart(2,'0')}`;
    seek.value=String(value);
  }
  function tick(now){
    if(!playing||!document.body.classList.contains('landing')||document.hidden){raf=0;return;}
    if(last)render((Number(seek.value)+(now-last)/80)%100);
    last=now;raf=requestAnimationFrame(tick);
  }
  function setPlaying(value){
    playing=value;cancelAnimationFrame(raf);raf=0;last=0;play.setAttribute('aria-pressed',String(playing));play.setAttribute('aria-label',playing?'Pause map preview':'Play map preview');
    play.querySelector('[data-play-icon]').textContent=playing?'Ⅱ':'▶';play.querySelector('[data-play-text]').textContent=playing?'Pause preview':'Play preview';
    if(playing&&document.body.classList.contains('landing')&&!document.hidden)raf=requestAnimationFrame(tick);
  }
  play.addEventListener('click',()=>setPlaying(!playing));
  seek.addEventListener('input',()=>{setPlaying(false);render(Number(seek.value));});
  new MutationObserver(()=>{if(!document.body.classList.contains('landing'))setPlaying(false);}).observe(document.body,{attributes:true,attributeFilter:['class']});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
  reduced.addEventListener('change',()=>{if(reduced.matches)setPlaying(false);});
  render(Number(seek.value));

  // Keep visible map studies moving; suspend work offscreen and in the editor.
  const atlasMaps=[...root.querySelectorAll('.mh-story-stage svg')];
  const visibleMaps=new Set();
  function syncAtlasMotion(){
    const active=!reduced.matches&&!document.hidden&&document.body.classList.contains('landing');
    for(const svg of atlasMaps){if(active&&visibleMaps.has(svg))svg.unpauseAnimations();else svg.pauseAnimations();}
  }
  const atlasObserver=new IntersectionObserver(entries=>{
    for(const entry of entries){if(entry.isIntersecting)visibleMaps.add(entry.target);else visibleMaps.delete(entry.target);}
    syncAtlasMotion();
  },{rootMargin:'80px'});
  atlasMaps.forEach(svg=>atlasObserver.observe(svg));
  reduced.addEventListener('change',syncAtlasMotion);
  document.addEventListener('visibilitychange',syncAtlasMotion);
  new MutationObserver(syncAtlasMotion).observe(document.body,{attributes:true,attributeFilter:['class']});
  syncAtlasMotion();
  if(!reduced.matches)setPlaying(true);

  const search=root.querySelector('#mhFeatureSearch');
  const cards=[...root.querySelectorAll('[data-feature-category]')];
  const filters=[...root.querySelectorAll('[data-feature-filter]')];
  const status=root.querySelector('#mhFeatureStatus'),empty=root.querySelector('#mhFeatureEmpty');
  let category='all';
  const indexed=cards.map(card=>({card,text:card.textContent.toLocaleLowerCase()}));
  function filterFeatures(){
    const words=search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    let count=0;
    for(const {card,text} of indexed){
      const visible=(category==='all'||card.dataset.featureCategory===category)&&words.every(word=>text.includes(word));
      card.hidden=!visible;if(visible)count++;
    }
    for(const button of filters)button.setAttribute('aria-pressed',String(button.dataset.featureFilter===category));
    status.textContent=`${count} of ${cards.length} feature groups${category==='all'&&!words.length?' to explore':' shown'}`;
    empty.hidden=count!==0;
  }
  if(search){
    root.querySelector('.mh-library-controls').hidden=false;
    search.addEventListener('input',filterFeatures);
    for(const button of filters)button.addEventListener('click',()=>{category=button.dataset.featureFilter;filterFeatures();});
    root.querySelector('#mhFeatureReset').addEventListener('click',()=>{category='all';search.value='';filterFeatures();search.focus();});
    filterFeatures();
  }
}
