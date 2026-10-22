export const OBJECT_VIEWS={normal:'Normal',isometric:'Isometric'};
export function validateObjectView(a){
  if(a.objectView!==undefined&&!Object.hasOwn(OBJECT_VIEWS,a.objectView))throw Error('Invalid object view.');
}
