import { OBJECT_ICONS } from './map-objects.mjs';
import { buildGeo, drawMap, drawTexture, newMapProject } from './map-engine.mjs';

const root=document.getElementById('landing');
if(root){
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  const visible=new Set();
  const specimens=[...root.querySelectorAll('[data-map-object]')];
  const scene=root.querySelector('[data-live-scene]');
  let frame=0,last=0;
  const drawSpecimen=(canvas,seconds)=>{
    const icon=OBJECT_ICONS[canvas.dataset.mapObject],c=canvas.getContext('2d');
    if(!icon?.draw)return;
    c.clearRect(0,0,canvas.width,canvas.height);
    c.save();c.translate(120,110+Math.sin(seconds*1.4+specimens.indexOf(canvas))*(reduced.matches?0:5));
    icon.draw(c,64,icon.color,icon.historic||icon.timeUnit==='seconds'?seconds:seconds*30);c.restore();
  };
  function drawScene(seconds){
    if(!scene)return;
    const c=scene.getContext('2d');c.clearRect(0,0,1280,720);
    const t=(seconds%18)/18;
    for(let i=0;i<5;i++){
      c.save();c.translate(455+t*130+(i%3)*43,330+Math.floor(i/3)*54-t*35);
      OBJECT_ICONS.tank.draw(c,16,'#748052',seconds);c.restore();
    }
    c.save();c.translate(740-t*230,190+Math.sin(t*Math.PI)*80);c.rotate(-.22);
    OBJECT_ICONS.jet.draw(c,24,'#e5e0c6',seconds);c.restore();
    c.save();c.translate(190+t*90,570-t*45);OBJECT_ICONS.warship.draw(c,30,'#849493',seconds);c.restore();
    const pulse=(seconds%3)/3;
    c.save();c.strokeStyle=`rgba(237,178,107,${1-pulse})`;c.lineWidth=2;
    c.beginPath();c.arc(640,330,8+pulse*43,0,Math.PI*2);c.stroke();c.restore();
  }
  function active(){return !reduced.matches&&!document.hidden&&document.body.classList.contains('landing');}
  function tick(now){
    frame=0;if(!active()||!visible.size)return;
    if(now-last>50){
      for(const canvas of visible){if(canvas===scene)drawScene(now/1000);else drawSpecimen(canvas,now/1000);}
      last=now;
    }
    frame=requestAnimationFrame(tick);
  }
  function sync(){
    cancelAnimationFrame(frame);frame=0;
    if(active()&&visible.size)frame=requestAnimationFrame(tick);
    else if(reduced.matches){specimens.forEach(canvas=>drawSpecimen(canvas,0));drawScene(0);}
  }
  const observer=new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){if(isIntersecting)visible.add(target);else visible.delete(target);}
    sync();
  },{rootMargin:'100px'});
  specimens.forEach(canvas=>{drawSpecimen(canvas,0);observer.observe(canvas);});
  if(scene){drawScene(0);observer.observe(scene);}
  document.addEventListener('visibilitychange',sync);
  reduced.addEventListener('change',sync);
  new MutationObserver(sync).observe(document.body,{attributes:true,attributeFilter:['class']});

  // These are the real map and texture renderers, using bundled geography only.
  async function renderStudies(){
    const response=await fetch('map-data/countries-110m.json');
    if(!response.ok)throw Error('Map study geography unavailable');
    const topo=await response.json(),geo=buildGeo(topo,topo);
    const project=newMapProject();
    project.camera.init={lon:15,lat:45,zoom:3.4,bearing:-10,pitch:18};
    for(const canvas of root.querySelectorAll('[data-map-style]')){
      const p={...project,theme:canvas.dataset.mapStyle};
      drawMap(canvas.getContext('2d'),canvas.width,canvas.height,p,0,geo);
      canvas.dataset.rendered='true';
    }
    project.camera.init={lon:10,lat:43,zoom:3,bearing:0,pitch:0};
    project.theme='paper';
    for(const canvas of root.querySelectorAll('[data-map-texture]')){
      const base=canvas.parentElement.querySelector('[data-texture-base]');
      drawMap(base.getContext('2d'),base.width,base.height,project,0,geo);
      const c=canvas.getContext('2d');c.drawImage(base,0,0);
      drawTexture(c,canvas.width,canvas.height,{type:canvas.dataset.mapTexture,strength:1,scale:2.5});
      canvas.dataset.rendered='true';
    }
    root.dataset.showcaseReady='true';
  }
  renderStudies().catch(()=>{
    // The labelled canvas alternatives remain available if local data cannot load.
    root.dataset.showcaseReady='unavailable';
  });
}
