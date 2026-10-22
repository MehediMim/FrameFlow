export const OBJECT_VIEWS={side:'Side view',isometric:'Isometric view'};
export const objectViewOf=a=>a?.objectView==='isometric'?'isometric':'side';
export function validateObjectView(a){
  // Migrate the default view in saved projects.
  if(a.objectView==='normal')a.objectView='side';
  if(a.objectView!==undefined&&!Object.hasOwn(OBJECT_VIEWS,a.objectView))throw Error('Invalid object view.');
}
