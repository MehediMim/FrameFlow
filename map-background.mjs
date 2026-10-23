export const MAP_BACKGROUNDS={modern:'Modern world',coastline:'Land only · no modern borders',image:'Historical / custom map image',blank:'Blank canvas'};
export const DEFAULT_MAP_BACKGROUND={mode:'modern',color:'#eef1ec',west:-180,east:180,north:85.0511287798,south:-85.0511287798};
export const mapBackgroundOf=project=>({...DEFAULT_MAP_BACKGROUND,...project.mapBackground});
export function validateMapBackground(project){
  const b=project.mapBackground;if(b===undefined)return;
  if(!b||typeof b!=='object'||Array.isArray(b)||!Object.hasOwn(MAP_BACKGROUNDS,b.mode))throw Error('Invalid base map.');
  if(b.color!==undefined&&!/^#[0-9a-f]{6}$/i.test(b.color))throw Error('Invalid canvas background color.');
  if(b.name!==undefined&&(typeof b.name!=='string'||b.name.length>160))throw Error('Invalid map image name.');
  if(b.image!==undefined&&(typeof b.image!=='string'||b.image.length>1.9e6||!/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(b.image)))throw Error('Invalid base map image.');
  const bounds=mapBackgroundOf(project);
  if(![bounds.west,bounds.east,bounds.north,bounds.south].every(Number.isFinite)||bounds.west< -180||bounds.east>180||bounds.west>=bounds.east||bounds.south< -85.0511287798||bounds.north>85.0511287798||bounds.south>=bounds.north)throw Error('Invalid map image bounds.');
}
