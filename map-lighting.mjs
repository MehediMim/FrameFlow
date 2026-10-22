const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
export const LEGACY_LIGHT=Object.freeze([-.35,.55,1]);
export const DEFAULT_LIGHTING=Object.freeze({enabled:false,preset:'day',azimuth:225,altitude:55,intensity:1,ambient:.5,warmth:0,shadowStrength:1});
export const LIGHTING_PRESETS=Object.freeze({
  day:{label:'Daylight',azimuth:225,altitude:55,intensity:1,ambient:.5,warmth:0,shadowStrength:1},
  golden:{label:'Golden hour',azimuth:265,altitude:14,intensity:1.05,ambient:.48,warmth:.65,shadowStrength:.9},
  dusk:{label:'Dusk',azimuth:280,altitude:1,intensity:.45,ambient:.3,warmth:.25,shadowStrength:.6},
  night:{label:'Night',azimuth:315,altitude:-15,intensity:0,ambient:.22,warmth:-.45,shadowStrength:.45},
});
export const lightingOf=project=>({...DEFAULT_LIGHTING,...project?.lighting});
export function lightingPreset(name){const {label,...values}=LIGHTING_PRESETS[name]||LIGHTING_PRESETS.day;return {...values,enabled:true,preset:name in LIGHTING_PRESETS?name:'day'};}
export function validateLighting(value){
  if(value===undefined)return;
  if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid scene sunlight settings.');
  if(value.enabled!==undefined&&typeof value.enabled!=='boolean')throw Error('Invalid scene sunlight switch.');
  if(value.preset!==undefined&&value.preset!=='custom'&&!Object.hasOwn(LIGHTING_PRESETS,value.preset))throw Error('Invalid sunlight preset.');
  for(const [key,lo,hi]of[['azimuth',0,360],['altitude',-20,85],['intensity',0,2],['ambient',0,1],['warmth',-1,1],['shadowStrength',0,1]])if(value[key]!==undefined&&(!Number.isFinite(value[key])||value[key]<lo||value[key]>hi))throw Error('Invalid sunlight '+key+'.');
}
function snapshot(value){
  const s={...DEFAULT_LIGHTING,...value};
  if(!s.enabled)return Object.freeze({...DEFAULT_LIGHTING,vector:LEGACY_LIGHT,sun:1,night:0,key:'legacy'});
  const az=s.azimuth*Math.PI/180,alt=s.altitude*Math.PI/180,vector=[Math.sin(az)*Math.cos(alt),-Math.cos(az)*Math.cos(alt),Math.sin(alt)];
  const sun=clamp(s.altitude/12,0,1)*s.intensity,night=1-clamp((s.altitude+8)/26,0,1);
  return Object.freeze({...s,vector:Object.freeze(vector),sun,night,key:JSON.stringify([s.azimuth,s.altitude,s.intensity,s.ambient,s.warmth,s.shadowStrength])});
}
let active=snapshot();
export const currentSceneLighting=()=>active;
export function withSceneLighting(value,draw){const previous=active;active=snapshot(value);try{return draw();}finally{active=previous;}}
export function applySceneLighting(c,width,height,value){
  const s=snapshot(value);if(!s.enabled)return;
  // Grade the completed frame, including flat artwork, paths, labels and water.
  const daylight=1-s.night,brightness=clamp(.18+s.ambient*.6+daylight*s.intensity*.55,.08,1.4);
  const warm=s.warmth,channels=[1+warm*.10-s.night*.11,1-Math.abs(warm)*.035-s.night*.045,1-warm*.13];
  const colors=channels.map(v=>Math.round(clamp(v*Math.min(1,brightness),0,1)*255));
  c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='multiply';c.fillStyle=`rgb(${colors.join(',')})`;c.fillRect(0,0,width,height);
  if(brightness>1){c.globalCompositeOperation='screen';c.fillStyle=`rgba(255,243,218,${(brightness-1)*.3})`;c.fillRect(0,0,width,height);}
  c.restore();
}
