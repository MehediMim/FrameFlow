export const OBJECT_VIEWS={side:'Side view',isometric:'Isometric view',isometricBack:'Back isometric view'};
export const objectViewOf=a=>Object.hasOwn(OBJECT_VIEWS,a?.objectView)?a.objectView:'side';
export const isIsometricView=a=>['isometric','isometricBack'].includes(a?.objectView);
export function validateObjectView(a){
  // Migrate the default view in saved projects.
  if(a.objectView==='normal')a.objectView='side';
  if(a.objectView!==undefined&&!Object.hasOwn(OBJECT_VIEWS,a.objectView))throw Error('Invalid object view.');
}
