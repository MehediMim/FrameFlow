import { poseAt } from './engine.mjs?v=motion-media-1';

// Convert saved blur strips to the layer property without changing rendered frames.
export function migrateBlurClips(project) {
 let migrated=false;
 for(const layer of project.layers){
  const clips=(layer.fxClips||[]).filter(fx=>fx.kind==='blur'||fx.name==='blur');
  if(!clips.length)continue;
  const source={...layer,fxClips:clips},keys=[];
  for(let f=0;f<project.frames;f++){
   const key={f,v:poseAt(source,f).blur||0,e:'linear'};
   // Keep curved motion frame-accurate, but collapse constant/linear runs.
   while(keys.length>=2){
    const a=keys.at(-2),b=keys.at(-1);
    if(Math.abs((b.v-a.v)*(key.f-b.f)-(key.v-b.v)*(b.f-a.f))>1e-9)break;
    keys.pop();
   }
   keys.push(key);
  }
  layer.keys.blur=keys;
  layer.fxClips=layer.fxClips.filter(fx=>!clips.includes(fx));
  migrated=true;
 }
 return migrated;
}
