export const OBJECT_VIEWS={side:'Side view',isometric:'Isometric view',isometricBack:'Back isometric view'};
export const objectViewOf=a=>Object.hasOwn(OBJECT_VIEWS,a?.objectView)?a.objectView:'side';
export const isIsometricView=a=>['isometric','isometricBack'].includes(a?.objectView);
export const followsPathView=a=>isIsometricView(a)&&['move','path'].includes(a.mode)&&a.objectFacing!=='manual'&&!['image','artwork','portrait','banner'].includes(a.glyph);
// Both catalog views face right; only leftward travel mirrors the miniature.
export function pathViewFacing(a,dx,dy){
  const fallback={objectView:objectViewOf(a),mirror:a.objectDirection==='left'&&(!['move','path'].includes(a.mode)||a.objectFacing==='manual')};
  if(!followsPathView(a)||!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<1e-8)return fallback;
  const tolerance=Math.hypot(dx,dy)*.001;
  const objectView=dy < -tolerance?'isometricBack':dy > tolerance?'isometric':fallback.objectView;
  return {objectView,mirror:dx < -tolerance};
}
export function validateObjectView(a){
  if(a.objectDirection!==undefined&&!['left','right'].includes(a.objectDirection))throw Error('Invalid object facing direction.');
  if(a.objectFacing!==undefined&&!['path','manual'].includes(a.objectFacing))throw Error('Invalid object facing mode.');
  // Migrate the default view in saved projects.
  if(a.objectView==='normal')a.objectView='side';
  if(a.objectView!==undefined&&!Object.hasOwn(OBJECT_VIEWS,a.objectView))throw Error('Invalid object view.');
}
