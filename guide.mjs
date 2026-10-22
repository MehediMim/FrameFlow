import { LESSONS } from './guide-lessons.mjs';
import { interfaceIcon } from './interface-icons.mjs';
import { OBJECT_ICONS } from './map-objects.mjs';
import { drawDamage, drawDestruction } from './map-damage.mjs';

const $ = selector => document.querySelector(selector);
const canvas = $('#featureCanvas'), c = canvas.getContext('2d');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const ink = '#31483c', green = '#48785a', orange = '#b86337', paper = '#e9e5d8';
const atlas = new Image();atlas.src = 'assets/map-story-atlas.svg';
let current = LESSONS[0], progress = 0, playing = !reduced.matches, last = 0, raf = 0, activeStep = -1;
const duration = 12000;
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const ease = value => {const t = Math.max(0, Math.min(1, value));return t*t*(3-2*t);};

function navigation() {
  const words = $('#lessonSearch').value.toLowerCase().trim().split(/\s+/).filter(Boolean);
  const matches = LESSONS.filter(item => words.every(word => [item.title,item.category,item.description,...item.coverage,...item.steps.flat()].join(' ').toLowerCase().includes(word)));
  $('#lessonNav').innerHTML = [...new Set(matches.map(item => item.category))].map(category => `<section class="nav-section"><h3>${escape(category)}</h3>${matches.filter(item => item.category === category).map(item => `<a href="#${item.id}" ${item.id === current.id ? 'aria-current="page"' : ''}><span>${String(LESSONS.indexOf(item)+1).padStart(2,'0')}</span>${escape(item.title)}</a>`).join('')}</section>`).join('');
  $('#lessonCount').textContent = `${matches.length} of ${LESSONS.length} lessons${words.length ? ' found' : ' to explore'}`;
  $('#noLessons').hidden = matches.length !== 0;
}

function selectLesson(id, focus = false) {
  current = LESSONS.find(item => item.id === id) || LESSONS[0];
  progress = 0;last = 0;activeStep = -1;
  const index = LESSONS.indexOf(current);
  $('#lessonCategory').textContent = current.category;
  $('#lessonTitle').textContent = current.title;
  $('#lessonDescription').textContent = current.description;
  $('#lessonIndex').textContent = `${String(index+1).padStart(2,'0')} / ${LESSONS.length}`;
  canvas.setAttribute('aria-label', `${current.title}. ${current.description}`);
  $('#lessonSteps').innerHTML = current.steps.map(([title,description],i) => `<li><button type="button" data-step="${i}"><span class="step-label"><span>0${i+1}</span>${escape(title)}</span><p>${escape(description)}</p></button></li>`).join('');
  $('#lessonCoverage').innerHTML = current.coverage.map(text => `<span>${escape(text)}</span>`).join('');
  $('#previousLesson').disabled = index === 0;
  $('#nextLesson').disabled = index === LESSONS.length-1;
  document.title = `${current.title} — FrameFlow guide`;
  navigation();render();
  if (focus) $('#lessonTitle').focus({preventScroll:true});
}

function box(x,y,w,h,fill=paper,border='#aeb6a0',radius=8) {
  c.beginPath();c.roundRect(x,y,w,h,radius);c.fillStyle=fill;c.fill();
  if(border){c.strokeStyle=border;c.lineWidth=1;c.stroke();}
}
function text(value,x,y,size=16,color=ink,weight='400') {
  c.fillStyle=color;c.font=`${weight} ${size}px Arial`;c.fillText(value,x,y);
}
function line(points,color=green,width=3,dash=[]) {
  c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.strokeStyle=color;c.lineWidth=width;c.setLineDash(dash);c.stroke();c.setLineDash([]);
}
function dot(x,y,r=5,color=green) {c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=color;c.fill();}
function tag(value,x,y,fill=ink) {c.font='600 12px Arial';const width=c.measureText(value).width;box(x,y,width+28,28,fill,null,4);text(value,x+12,y+19,12,'#f4f0df','600');}
function pointer(x,y) {
  c.save();c.translate(x,y);c.beginPath();c.moveTo(0,0);c.lineTo(3,25);c.lineTo(10,18);c.lineTo(18,33);c.lineTo(24,30);c.lineTo(16,16);c.lineTo(27,14);c.closePath();c.fillStyle='#faf8ef';c.strokeStyle=ink;c.lineWidth=2;c.fill();c.stroke();c.restore();
}
function pin(x,y,label,scale=1) {
  c.save();c.translate(x,y);c.scale(scale,scale);c.beginPath();c.moveTo(0,0);c.bezierCurveTo(-30,-35,-22,-60,0,-60);c.bezierCurveTo(22,-60,30,-35,0,0);c.fillStyle=orange;c.fill();dot(0,-39,7,'#eee5cb');c.restore();
  if(label){box(x-47,y+9,94,27,'#f7f3e7','#bcc2ad',3);text(label,x-35,y+28,12,ink,'600');}
}
function icon(glyph,x,y,size=38,angle=0) {
  const item=OBJECT_ICONS[glyph]||OBJECT_ICONS.tank;
  c.save();c.translate(x,y);c.rotate(angle);item.draw(c,size,item.color||green,progress*12);c.restore();
}
function route(t) {return {x:210+540*t,y:300-95*Math.sin(t*Math.PI)-65*t};}
function pathReveal(t,color=orange,width=4) {
  const pts=[];for(let i=0;i<=60;i++){const p=route(t*i/60);pts.push([p.x,p.y]);}line(pts,color,width);
}
function region(fill='#71956965',stroke=green,shift=0) {
  const pts=[[410+shift,120],[542+shift,100],[617+shift,175],[590+shift,285],[475+shift,307],[385+shift,220]];
  c.beginPath();pts.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=3;c.stroke();
}
function backdrop(p) {
  c.clearRect(0,0,960,510);c.fillStyle=paper;c.fillRect(0,0,960,510);
  if(atlas.complete&&atlas.naturalWidth){c.globalAlpha=.53;c.drawImage(atlas,0,0,960,453);c.globalAlpha=1;}
  c.strokeStyle='#536b5120';c.lineWidth=1;
  for(let x=0;x<960;x+=80){c.beginPath();c.moveTo(x,0);c.lineTo(x,510);c.stroke();}
  for(let y=0;y<510;y+=65){c.beginPath();c.moveTo(0,y);c.lineTo(960,y);c.stroke();}
  text('FRAMEFLOW / LEARNING ATLAS',24,30,10,'#5c6e59','600');
  text(current.category.toUpperCase(),24,48,8,'#73826e');
  c.save();c.translate(911,45);line([[0,24],[0,-9]],ink,1);text('N',-4,-16,10);text('✧',-9,12,24);c.restore();
}
function timeline(p,top=330,kind='timeline') {
  box(125,top,710,104,'#1d2b23','#5b6a53',7);
  const labels=kind==='audio'?['Narration','Camera','Scene']:['Camera','Route','Object'];
  const colors=kind==='audio'?['#8ba46f','#81aaa0','#d6ae72']:['#81aaa0','#d6ae72','#8ba46f'];
  labels.forEach((name,i)=>{
    text(name,143,top+29+i*25,11,'#c6d4b9');
    box(240+i*30,top+15+i*25,480-i*50,17,colors[i],null,3);
    if(kind==='audio'&&i===0){for(let n=0;n<95;n++){const h=2+Math.abs(Math.sin(n*1.7))*10;line([[245+n*4.8,top+23-h/2],[245+n*4.8,top+23+h/2]],'#344b31',1);}}
    else for(const x of [260+i*30,650-i*20]){c.save();c.translate(x,top+23+i*25);c.rotate(Math.PI/4);c.fillStyle='#203a2e';c.fillRect(-4,-4,8,8);c.restore();}
  });
  const x=240+p*480;line([[x,top+4],[x,top+98]],'#e4f5bb',2);dot(x,top+6,4,'#e4f5bb');
}

function drawDemo(p) {
  backdrop(p);
  const stage=Math.min(2,Math.floor(p*3)), t=ease(p), local=(p*3)%1, id=current.demo;
  if(['workspace','selection'].includes(id)) {
    box(75,90,140,222,'#f6f2e6');text('ADD A LAYER',92,114,10,ink,'700');
    ['Pin / label','Object','Highlight','Arrow / zone','Effect'].forEach((name,i)=>{box(87,130+i*31,116,26,i===1?'#d4e0bc':'#e9e6d9',null,3);text(name,98,148+i*31,11);});
    icon('tank',490,220,48,stage===2?t*.2:0);pin(655,210,'Location');
    if(stage>=1){c.strokeStyle=green;c.setLineDash([5,4]);c.strokeRect(420,151,142,108);c.setLineDash([]);for(const [x,y]of [[420,151],[562,151],[562,259],[420,259]])box(x-4,y-4,8,8,'#b6f36e',green,0);}
    box(745,105,148,190,'#f6f2e6');text('PROPERTIES',759,129,10,ink,'700');
    ['Size','Rotation','Color'].forEach((label,i)=>{text(label,759,161+i*39,11);box(824,145+i*39,55,24,'#e4e7d7',null,3);text(i===0?'1.2':i===1?'0°':'●',835,162+i*39,11);});
    pointer(stage===0?153:stage===1?510:837,stage===0?170:stage===1?240:170);timeline(p);
  } else if(id==='canvas') {
    const w=stage===0?510:stage===1?340:215,h=stage===2?290:230,x=480-w/2;
    box(x,92,w,h,'#f7f3e6','#62815e',4);c.save();c.beginPath();c.rect(x+2,94,w-4,h-4);c.clip();region();pin(480,234,'Your story');c.restore();
    text(['LANDSCAPE · 1920 × 1080','SQUARE · 1080 × 1080','PORTRAIT · 1080 × 1920'][stage],295,411,16,ink,'600');
    tag(['Set your canvas','Choose your format','Compose for your audience'][stage],40,77);
  } else if(id==='styles') {
    const themes=[['PAPER ATLAS','#e7e1ce','#637b56'],['BLUEPRINT','#213d50','#a4d6dd'],['NIGHT','#182724','#c3dd8d']];
    const [label,bg,col]=themes[stage];c.fillStyle=bg;c.fillRect(0,62,960,370);
    c.strokeStyle=col;c.lineWidth=2;
    for(let i=0;i<6;i++){c.beginPath();c.ellipse(480,250,100+i*49,60+i*16,-.2,0,Math.PI*2);c.stroke();}
    c.save();c.translate(0,0);region(col+'55',col);c.restore();text(label,40,95,14,col,'700');
    themes.forEach(([name,bg,color],i)=>{box(250+i*157,362,145,40,bg,i===stage?'#dca75a':color);text(name,265+i*157,387,11,color,'700');});
  } else if(id==='terrain') {
    for(let j=0;j<9;j++){c.beginPath();for(let i=0;i<=120;i++){const x=130+i*6,y=310+j*8-Math.exp(-(((x-450)/160)**2))*(75+j*10)+Math.sin(x*.025+j*.4)*9;c.lineTo(x,y);}c.lineTo(850,410);c.lineTo(130,410);c.closePath();c.fillStyle=['#b6c2a1','#a8b592','#98a584','#8a997b','#7b8c72','#6f816b','#647762','#566d5b','#4a6253'][j];c.fill();}
    const sunX=260+t*430;dot(sunX,110,19,'#d3aa5a');line([[sunX,142],[480,240]],'#aa8a4f',2,[6,7]);
    tag(['Elevation shapes the scene','Change the palette & light','Add depth to your shot'][stage],40,77);
    text('LOWLANDS',140,393,10,'#eff0d8');text('HIGHLANDS',428,204,10,ink,'700');
  } else if(['places','regions','borders','highlights'].includes(id)) {
    if(id==='places'){box(85,88,290,44,'#f6f2e6');text(stage?'Country details → Administrative level':'Search a city or country…',100,115,13);pin(510+t*60,245,'Your place');if(stage>0)region('#69835c20');if(stage===2)for(let i=0;i<4;i++){line([[420+i*35,153],[480+i*25,280]],'#71946a',1);text(['North','East','South','Town'][i],420+i*60,340-(i%2)*24,11);}}
    if(id==='regions'){region(stage===0?'#71956920':'#71956980');if(stage>0)region('#b97d4b55','#a2754b',145);if(stage===2){line([[330,85],[790,85],[790,332],[330,332],[330,85]],ink,2,[7,5]);tag('Combined region',411,347);}pointer(400+t*200,150+t*130);}
    if(id==='borders'){c.save();c.setLineDash([900]);c.lineDashOffset=900*(1-Math.min(1,p*1.7));region('#71956920');c.restore();tag(stage===2?'Reverse or trim the reveal':'Draw the boundary over time',335,352);}
    if(id==='highlights'){region(`rgba(100,143,81,${.15+t*.55})`);if(stage>0){region('#ac714455','#b47549',145);tag('Selected territory',420,345);}if(stage===2){c.globalAlpha=.2+.15*Math.sin(p*50);c.strokeStyle=orange;c.lineWidth=3;c.beginPath();c.arc(535,205,70+local*40,0,Math.PI*2);c.stroke();c.globalAlpha=1;}}
  } else if(['pins','labels'].includes(id)) {
    if(id==='pins'){pin(330,210,'City A',.7+ease(p*3)*.3);if(stage>0)pin(610,270,stage===2?'Your image':'City B');const r=20+local*55;c.strokeStyle='#aa714b';c.globalAlpha=1-local;c.beginPath();c.ellipse(330,212,r,r*.35,0,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
    else {text('THE NORTHERN TERRITORIES',220,205,stage===0?18:25,ink,'600');if(stage>0){c.save();c.translate(475,285);for(const [i,char]of [...'GREAT OCEAN'].entries()){c.save();c.translate((i-5)*21,Math.sin(i*.3)*-22);c.rotate(Math.cos(i*.3)*-.13);text(char,0,0,18,'#48746a');c.restore();}c.restore();}if(stage===2)tag('Style → Font · Outline · Spacing',295,350);}
  } else if(['routes','networks'].includes(id)) {
    pathReveal(1,'#546b492a',id==='networks'?16:3);pathReveal(Math.min(1,p*1.3),id==='networks'?'#687652':orange,id==='networks'?8:4);
    if(id==='networks') {for(let i=0;i<22;i++){const a=route(i/22);line([[a.x,a.y-8],[a.x,a.y+8]],ink,2);}if(stage>0){for(let i=0;i<5;i++){const a=route((p*1.5+i/5)%1);dot(a.x,a.y,4,'#eacb79');}}}
    else {const a=route(t);icon('tank',a.x,a.y-11,27,-.2);pin(210,300,'Start',.7);pin(750,235,'Destination',.7);}
    if(stage===0)for(const point of [route(0),route(.5),route(1)])dot(point.x,point.y,5,ink);
    tag(id==='routes'?'Places → Path → Traveler':'Draw → Style → Reveal & flow',310,365);
  } else if(['objects','artwork','formations','groups','walls'].includes(id)) {
    if(id==='objects'){['tank','stoneFort','warship'].forEach((glyph,i)=>{icon(glyph,285+i*200,240+Math.sin(p*20+i)*6,48,stage===2?Math.sin(p*10)*.1:0);text(['Vehicles','Structures','Ships'][i],250+i*200,325,13);});}
    if(id==='artwork'){box(230,124,170,175,'#f8f3e6',green);text('YOUR ART',262,275,13,ink,'700');c.save();c.translate(315,202);c.rotate(Math.sin(p*9)*.1);c.fillStyle=orange;c.fillRect(-35,-35,70,70);dot(0,0,18,paper);c.restore();line([[560,110],[560,320]],ink,4);c.beginPath();c.moveTo(563,114);for(let i=0;i<=30;i++)c.lineTo(563+i*5,114+Math.sin(i*.2+p*24)*8);for(let i=30;i>=0;i--)c.lineTo(563+i*5,213+Math.sin(i*.2+p*24)*8);c.closePath();c.fillStyle=green;c.fill();text('IMAGE FLAG',580,350,13,ink,'700');}
    if(id==='formations'||id==='groups'){c.save();c.translate(400+t*100,210);c.rotate(id==='groups'?t*.25:0);for(let i=0;i<9;i++)icon(i%3===0?'cannon':'musketeer',(i%3-1)*66,(Math.floor(i/3)-1)*53,23);if(stage>0){c.strokeStyle=green;c.setLineDash([5,5]);c.strokeRect(-115,-98,230,197);c.setLineDash([]);}c.restore();tag(id==='groups'?'One transform. Every member.':'Mixed units. Shared movement.',310,365);}
    if(id==='walls'){const count=3+Math.floor(t*7);for(let i=0;i<count;i++)icon(i===5?'gatehouse':i%3===0?'watchtower':'stoneWall',180+i*64,255-Math.sin(i*.4)*45,34);line([[150,282],[815,245]],'#5d775a',1,[4,5]);tag('Draw a path → Repeat structures → Add gates',235,355);}
  } else if(id==='damage') {
    c.save();c.translate(485,263);const draw=()=>OBJECT_ICONS.stoneFort.draw(c,94,'#927449',p*12);
    if(stage<2){draw();drawDamage(c,94,stage===0?'damaged':'burning',p*12);}else drawDestruction(c,94,false,Math.min(1,local*4),draw);
    c.restore();tag(['DAMAGED','BURNING','DESTROYED'][stage],425,355);
  } else if(id==='effects') {
    icon('cannon',235,275,48);icon('stoneFort',720,260,60);const q=(p*2)%1;
    c.strokeStyle='#b56c3780';c.setLineDash([5,6]);c.beginPath();c.moveTo(270,251);c.quadraticCurveTo(480,72,700,210);c.stroke();c.setLineDash([]);
    dot(270+430*q,251-360*q*(1-q)-41*q,8,orange);
    if(q>.7){c.globalAlpha=(q-.7)/.3;c.strokeStyle=orange;c.lineWidth=6;c.beginPath();c.arc(715,224,20+(q-.7)*180,0,Math.PI*2);c.stroke();c.globalAlpha=1;}
    tag('Source → Target → Impact',325,365);
  } else if(['shapes','measurements'].includes(id)) {
    if(id==='shapes'){pathReveal(Math.min(1,p*2),orange,14);const a=route(Math.min(1,p*2));c.save();c.translate(a.x,a.y);c.rotate(-.2);c.beginPath();c.moveTo(14,0);c.lineTo(-20,-19);c.lineTo(-20,19);c.closePath();c.fillStyle=orange;c.fill();c.restore();if(stage>0)region('#67865c40');if(stage===2){for(let i=0;i<9;i++){const x=530+Math.sin(i*.55+p*4)*38,y=105+i*25;line([[x,y],[x+13,y+10],[x,y+20]],green,3);}}}
    else {const w=240+120*t;box(300,138,w,166,'#80976840',green,0);line([[300,326],[300+w,326]],ink,2);line([[300,319],[300,333]],ink,2);line([[300+w,319],[300+w,333]],ink,2);tag(`${Math.round(120+t*60)} km`,340,340);text(`${Math.round(12400+t*6400).toLocaleString()} km²`,370,230,28,ink,'600');}
  } else if(id==='camera') {
    c.save();c.translate(480,235);c.scale(1+t*.4,1+t*.4);c.rotate(t*.12);c.translate(-480,-235);region();pin(520,240,'Subject');c.restore();
    c.strokeStyle=ink;c.lineWidth=2;const x=245+t*70,y=90+t*35,w=470-t*140,h=280-t*70;
    for(const [a,b,dirX,dirY]of [[x,y,1,1],[x+w,y,-1,1],[x,y+h,1,-1],[x+w,y+h,-1,-1]])line([[a,b+dirY*25],[a,b],[a+dirX*25,b]],ink,3);
    tag(['Compose the first view','Capture the next view','Smooth motion between keys'][stage],290,380);
  } else if(id==='keyframes') {
    const size=28+t*35;icon('tank',250+t*450,225,size,t*.5);timeline(p);
    tag(['Set a starting value','Change a later value','FrameFlow fills the motion'][stage],290,80);
  } else if(id==='timeline'||id==='audio') {
    pin(350+t*260,210,'Story moment');timeline(p,295,id);tag(id==='audio'?'Narration + camera + map events':'Visibility bars + animation diamonds',260,80);
    if(id==='audio'){c.strokeStyle=green;c.lineWidth=2;c.beginPath();for(let i=0;i<70;i++){const x=270+i*6,y=240+Math.sin(i*.65+p*15)*Math.sin(i*.12)*15;i?c.lineTo(x,y):c.moveTo(x,y);}c.stroke();}
  } else if(id==='scenes') {
    region('#76986150');const a=ease(p*4);c.save();c.globalAlpha=a;
    const gradient=c.createLinearGradient(0,0,600,0);gradient.addColorStop(0,'#17271ff5');gradient.addColorStop(1,'#17271f00');c.fillStyle=gradient;c.fillRect(0,65,690,360);
    text('CHAPTER 01',60,125,12,'#bed797','700');text('1848',55,204,64,'#e7d4a0');text('A changing world',60,250,27,'#faf3df','600');text('Give the moment a date, a title,',60,290,16,'#cad1be');text('and the context it deserves.',60,315,16,'#cad1be');c.restore();
  } else if(['export','projects'].includes(id)) {
    box(270,85,420,300,'#f6f3e7','#8c9e80',9);text(id==='export'?'EXPORT YOUR STORY':'YOUR PROJECT',300,122,13,ink,'700');
    if(id==='export'){box(300,145,160,105,'#d5dcc2',null,3);pin(380,215,'',.65);text('WebM video',490,174,15,ink,'600');text('PNG snapshot',490,207,13);text('Landscape · Square · Portrait',300,283,12);box(300,305,360,9,'#cbd2ba',null,4);box(300,305,Math.max(4,t*360),9,green,null,4);text(`${Math.round(t*100)}% rendered`,300,345,12);}
    else {text('My map story',300,173,24,ink,'600');text('my-map-story.framemap.json',300,212,15);['Name','Save project','Open & continue'].forEach((label,i)=>{box(300,239+i*37,360,29,stage===i?'#d5e4b9':'#e7e8d9',null,3);text(`${i+1}   ${label}`,313,259+i*37,12);});}
  }
}

function render() {
  const step=Math.min(2,Math.floor(progress*3));
  if(step!==activeStep){
    activeStep=step;
    $('#stepNumber').textContent=String(step+1);
    $('#stepCaption').textContent=current.steps[step][0];
    $('#demoPhase').textContent=`STEP ${step+1} OF 3`;
    $('#lessonSteps').querySelectorAll('button').forEach((button,index)=>{if(index===step)button.setAttribute('aria-current','step');else button.removeAttribute('aria-current');});
  }
  $('#demoSeek').value=String(Math.round(progress*1000));
  $('#demoTime').textContent=`0:${String(Math.floor(progress*12)).padStart(2,'0')} / 0:12`;
  drawDemo(progress);
}
function tick(now) {
  raf=0;
  if(!playing||document.hidden)return;
  if(last)progress=(progress+(now-last)/duration)%1;
  last=now;render();raf=requestAnimationFrame(tick);
}
function syncPlayback() {
  cancelAnimationFrame(raf);raf=0;last=0;
  $('#playDemo').innerHTML=interfaceIcon(playing?'pause':'play')+`<span>${playing?'Pause':'Play'}</span>`;
  $('#playDemo').setAttribute('aria-label',playing?'Pause animation':'Play animation');
  $('#playDemo').setAttribute('aria-pressed',String(playing));
  if(playing&&!document.hidden)raf=requestAnimationFrame(tick);
}
$('#lessonSearch').addEventListener('input',navigation);
$('#clearSearch').addEventListener('click',()=>{$('#lessonSearch').value='';navigation();$('#lessonSearch').focus();});
$('#lessonNav').addEventListener('click',event=>{const link=event.target.closest('a');if(!link)return;event.preventDefault();const id=link.hash.slice(1);if(location.hash!==link.hash)location.hash=id;else selectLesson(id,true);});
$('#playDemo').addEventListener('click',()=>{playing=!playing;syncPlayback();});
$('#replayDemo').addEventListener('click',()=>{progress=0;playing=true;render();syncPlayback();});
$('#demoSeek').addEventListener('input',event=>{progress=Number(event.target.value)/1000;playing=false;render();syncPlayback();});
$('#lessonSteps').addEventListener('click',event=>{const button=event.target.closest('[data-step]');if(!button)return;progress=(Number(button.dataset.step)+.1)/3;playing=false;render();syncPlayback();});
$('#previousLesson').addEventListener('click',()=>{location.hash=LESSONS[LESSONS.indexOf(current)-1].id;});
$('#nextLesson').addEventListener('click',()=>{location.hash=LESSONS[LESSONS.indexOf(current)+1].id;});
window.addEventListener('hashchange',()=>selectLesson(location.hash.slice(1),true));
document.addEventListener('visibilitychange',syncPlayback);
reduced.addEventListener('change',()=>{if(reduced.matches){playing=false;syncPlayback();}});
atlas.addEventListener('load',render);
$('#replayDemo').innerHTML=interfaceIcon('replay')+'<span>Replay</span>';
selectLesson(location.hash.slice(1));syncPlayback();
