import { defaultScene, cityScene, makeObject, makeClip, makeCameraClip, defaultLook, validateScene } from './scene-engine.mjs';
import { ENVIRONMENTS } from './scene-catalog.mjs';
import { applyTexturePack } from './scene-environment.mjs';
import { WEATHER_PRESETS, cameraSpecFromPose, scatterPlants } from './scene-storytelling.mjs';

export const SCENE_PRESETS = {
  city: ['City intersection', 'Streets, traffic and a neighborhood'],
  village: ['Village lane', 'Cottages, gardens and a village shop'],
  farm: ['Countryside farm', 'Barn, crops and a working windmill'],
  riverside: ['Riverside', 'Water, a bridge and woodland'],
  park: ['Community park', 'Paths, fountain and playground'],
  plaza: ['Market square', 'Shops, stalls and a meeting place'],
  room: ['Living room', 'An open room ready for a conversation'],
  cast: ['Character lineup', 'Start with an editable cast of four'],
};

export function buildScenePreset(id) {
  if(!Object.hasOwn(SCENE_PRESETS,id))throw Error('Unknown scene preset');
  const p=id==='city'?cityScene():defaultScene();
  Object.assign(p,{name:SCENE_PRESETS[id][0],baseRoad:false,left:'none',right:'none',material:'texture',...ENVIRONMENTS.day});
  delete p.label;
  if(id!=='city')Object.assign(p,{objects:[],cameraClips:[],duration:16});
  const put=(type,x,z,extra={})=>{const o=Object.assign(makeObject(type),{x,z,endX:x,endZ:z,duration:p.duration},extra);p.objects.push(o);return o;};
  const person=(x,z,body='man',outfit='casual',color='#6699ad',gesture='idle')=>put('human',x,z,{name:body==='man'?'Alex':body==='woman'?'Maya':body==='boy'?'Sam':'Lily',rotation:180,orientation:'fixed',color,look:{...defaultLook(body),outfit,expression:'happy'},clips:[makeClip(gesture,0,p.duration)]});
  const trees=(points,type='tree')=>points.forEach(([x,z],i)=>put(type,x,z,{scale:.8+(i%3)*.15}));
  if(id==='city') {
    put('shop',-12,13,{rotation:90,color:'#d8c2ab'});put('floor',13,16,{width:11,length:10});
    person(8,20,'woman');person(-7,6,'man','formal','#71819c');
  }
  if(id==='village'||id==='farm') {
    put('path',0,10,{width:3,length:42});
    put('house',-7,1,{rotation:90});put('house',7,8,{rotation:-90,color:'#e7d6af',accentColor:'#788979'});
    put('house',-8,19,{rotation:90,color:'#d8b59d'});put('shop',7,24,{rotation:-90,color:'#d6ccad'});
    put('fence',-6,-4,{width:9});put('fence',7,3,{width:9});put('flowers',-4,4);put('flowers',4,11);
    trees([[-12,9],[12,1],[-13,28],[13,30],[-15,-7]]);
    person(-1,11,'woman','dress','#b87c83');person(1,13,'boy','sporty','#d8a65b','wave');
    if(id==='farm') {
      put('barn',-18,15,{rotation:90});put('field',15,14,{width:10,length:12});put('field',15,-1,{color:'#91a15b'});
      put('windmill',-17,-4);put('tower',-22,27);put('fence',15,22,{width:12});
    } else {put('pond',15,20,{width:7,length:6});put('bench',3,20,{rotation:-90});}
    put('hill',-23,43,{width:30,length:18,height:6});put('hill',16,48,{width:35,length:20,height:8});
  }
  if(id==='riverside') {
    put('river',0,12,{width:8,length:60});put('bridge',0,10,{rotation:90,width:4,length:13});
    put('path',-10,12,{length:45});put('path',10,12,{length:45});
    trees([[-15,-4],[-16,8],[-14,23],[-18,33],[15,0],[16,15],[14,28]],'pine');
    put('house',15,35,{rotation:-90});put('rock',-5,24);put('rock',5,-3,{scale:1.6});put('bush',6,23);put('bench',-10,19);
    person(-7,10,'woman','hoodie','#b98d74');put('hill',-22,45,{width:30,height:10});
  }
  if(id==='park') {
    put('park',0,14,{width:40,length:36,color:'#89a777'});put('path',0,14,{width:3,length:36});put('path',0,14,{rotation:90,width:3,length:40});
    put('fountain',0,14);put('gazebo',-10,24);put('swing',10,5);put('flowers',-7,7);put('flowers',7,22);
    trees([[-15,0],[-15,12],[-15,29],[15,0],[15,19],[13,29]]);
    put('bench',-4,8,{rotation:90});put('bench',4,23,{rotation:-90});put('bin',5,25);
    person(2,10,'girl','sporty','#b987a3','wave');person(-2,20,'man','hoodie','#72958e');
  }
  if(id==='plaza') {
    put('floor',0,14,{width:32,length:30});put('fountain',0,16);
    for(const [x,z,r] of [[-12,6,90],[-12,22,90],[12,6,-90],[12,22,-90]])put('shop',x,z,{rotation:r,color:x<0?'#d9bda7':'#b5c9be'});
    for(const [x,z] of [[-5,3],[4,3],[-6,26],[6,26]])put('stall',x,z,{accentColor:x<0?'#b66d63':'#709b8c'});
    trees([[-16,-3],[16,-3],[-16,32],[16,32]]);put('sign',0,-1);put('bench',6,15,{rotation:-90});
    person(-3,11,'woman','dress','#a581a2');person(4,19,'man','casual','#748eaa');person(1,22,'girl','sporty','#bf9c65');
  }
  if(id==='room') {
    Object.assign(p,{ground:'#c6c1b6',sky:'#e5e5de'});
    put('floor',0,6,{width:12,length:10});put('wall',0,11,{width:12});put('wall',-6,6,{width:10,rotation:90});
    put('window',-5.72,7,{rotation:90,height:1.5,elevation:1});put('door',4,10.7);
    put('sofa',0,9,{width:3.5});put('table',0,6,{width:2.5,height:.6});put('chair',3,6,{rotation:90});
    put('shelf',-3,10.3);put('flowers',-4,3,{width:1,length:1,height:.8});
    person(1.8,7,'woman','casual','#b27f76');person(-1.8,7,'man','hoodie','#7793a5');
  }
  if(id==='cast') {
    put('floor',0,4,{width:14,length:8});
    ['man','woman','boy','girl'].forEach((body,i)=>person((i-1.5)*2.3,4,body,['casual','dress','hoodie','sporty'][i],['#729ab0','#bc8190','#8b9e75','#d5ad67'][i],i===3?'wave':'idle'));
  }
  if(id!=='city')p.camera={mode:'third',move:'static',yaw:25,height:id==='room'?7:id==='cast'?2.2:20,distance:30,fov:id==='cast'?40:55,target:null,fixedX:id==='cast'?0:id==='room'?12:30,fixedZ:id==='cast'?-7:id==='room'?-8:-27,aimX:0,aimZ:id==='cast'?4:id==='room'?6:13,aimHeight:id==='cast'?1:0};
  applyTexturePack(p,id==='village'||id==='farm'?'village':id==='room'?'storybook':id==='city'||id==='plaza'?'village':'storybook');
  if(['village','farm','riverside','park'].includes(id)) {p.terrain={type:'rolling',height:6,scale:40,flatRadius:34,seed:7};p.haze=.22;}
  return validateScene(p);
}

export function buildStoryScene(){
  const p=buildScenePreset('park');p.name='An afternoon in the park';p.atmosphere={...WEATHER_PRESETS.breeze,windDirection:35};delete p.atmosphere.label;
  const people=p.objects.filter(o=>o.type==='human'),seat=p.objects.find(o=>o.type==='bench');
  Object.assign(people[0],{seatId:seat.id,carry:'cup',clips:[makeClip('sit',0,6),makeClip('talk',6,10)],talkTarget:people[1].id});
  Object.assign(people[1],{x:0,z:10,endX:0,endZ:10,carry:'bag',clips:[makeClip('wave',0,3),makeClip('talk',6,10)],talkTarget:people[0].id});
  p.objects.find(o=>o.type==='path').curvePoints=[{x:0,z:-18},{x:-3,z:-6},{x:3,z:7},{x:0,z:18}];
  p.objects.push({...makeObject('pond'),x:-9,z:2,endX:-9,endZ:2,width:7,length:5,duration:p.duration});
  for(const q of scatterPlants({x:6,z:23,radius:9,count:8,type:'mixed',seed:43},p.objects))p.objects.push({...makeObject(q.type),...q,endX:q.x,endZ:q.z,duration:p.duration,grounding:'terrain'});
  const poses=[{pos:[22,12,-15],look:[0,1,14],fov:55},{pos:[8,5,3],look:[0,1,11],fov:50},{pos:[-9,4,12],look:[0,1,12],fov:50}];
  p.savedCameras=poses.map((pose,i)=>({id:`park-view-${i}`,name:['Establishing view','Meet the characters','Conversation'][i],pose}));
  p.camera=cameraSpecFromPose(poses[0]);p.cameraClips=poses.slice(1).map((pose,i)=>({...makeCameraClip('locked',i*8,8),name:i?'Around the conversation':'Into the park',fromPose:structuredClone(poses[i]),toPose:structuredClone(pose),blend:0,easing:'smooth'}));
  return validateScene(p);
}
