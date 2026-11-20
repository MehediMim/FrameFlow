import { importObjectImage } from './map-object-images.mjs';

/** Resolve only files deliberately selected in the supporting-files picker. */
export async function prepareStoryboardMedia(source,files){
  const raw=structuredClone(source),cache=new Map();
  async function image(name){
    if(!cache.has(name))cache.set(name,(async()=>{
      const file=files.get(name);if(!file)throw Error(`Missing supporting image "${name}". Choose it with Add supporting files.`);
      return importObjectImage(file,2048);
    })());
    return cache.get(name);
  }
  async function visit(value){
    if(!value||typeof value!=='object')return;
    for(const [key,child]of Object.entries(value)){
      if(key==='image'&&typeof child==='string'&&child.startsWith('asset:'))value[key]=await image(child.slice(6));
      else await visit(child);
    }
  }
  await visit(raw);return raw;
}
