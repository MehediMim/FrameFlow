export const OBJECT_ANIMATIONS=Object.freeze({auto:'Automatic',none:'Still',walk:'Walk',run:'Run',drive:'Wheels turning',operate:'Working',sway:'Sway in wind',sail:'Rock on water'});
export function objectAnimationTime(action,time){
  return action.objectAnimation==='none'?0:time*(action.objectAnimationSpeed??1);
}
export function validateObjectAnimation(action){
  if(action.objectAnimation!==undefined&&!Object.hasOwn(OBJECT_ANIMATIONS,action.objectAnimation))throw Error('Invalid object animation.');
  if(action.objectAnimationSpeed!==undefined&&(!Number.isFinite(action.objectAnimationSpeed)||action.objectAnimationSpeed<.25||action.objectAnimationSpeed>4))throw Error('Object animation speed must be between 0.25 and 4.');
}
