import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {compileStoryboard,parseStoryboard} from '../map-storyboard.mjs';
import {storyboardFromProject,storyboardProjectBase} from '../map-storyboard-editor.mjs';
import {LAYER_OPTION_FIELDS} from '../map-storyboard-fields.mjs';
import {buildGeo,newMapProject,validateMapProject,makeAction,makeShot,PRESETS,drawMap} from '../map-engine.mjs';
import {lightingAt} from '../map-lighting-keys.mjs';
import {groupPoseAt} from '../map-object-groups.mjs';
import {pathAt} from '../map-path-animation.mjs';
import {buildStoryboardAIPrompt,storyboardGuideText} from '../storyboard-ai-prompt.mjs';
const read=file=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
const geo=buildGeo(JSON.parse(read('map-data/countries-50m.json'))),base=newMapProject();
const full=compileStoryboard(read('examples/storyboard-full-control.json'),base,geo).project;
assert.equal(full.actions.length,11);assert.equal(full.width,1280);assert.equal(full.labelStyle.font,'Georgia');
validateMapProject(full);
const group=full.actions.find(a=>a.type==='group'),sun=full.actions.find(a=>a.fx==='sunlight'),front=full.actions.find(a=>a.shape==='front');
assert.deepEqual(group.memberIds,['cavalry','guns']);assert.ok(groupPoseAt(group,900).scale>1);
assert.ok(lightingAt(sun,1500).altitude<20);assert.notDeepEqual(pathAt(front,0),pathAt(front,1500));
assert.equal(full.actions.find(a=>a.name==='Linked cannon attack').attackSourceId,'guns');
assert.equal(full.actions.find(a=>a.name==='Commander banner').plaqueFont,'Georgia');
assert.ok(full.shots[0].cameraKeys.some(k=>k.preset==='orbit'&&k.samples));
const backup=storyboardFromProject(full),copy=compileStoryboard(backup,newMapProject(),geo).project;
const withoutPlan=p=>{const out=structuredClone(p);delete out.storyboard;return out;};
assert.deepEqual(withoutPlan(copy),withoutPlan(full),'native storyboard roundtrip preserves every project, layer, group and camera property');
const other=structuredClone(base);other.atlasLabels={countries:true};other.imagery='satellite';other.mapBackground={mode:'blank',color:'#eeeeee'};
assert.deepEqual(withoutPlan(compileStoryboard(backup,other,geo).project),withoutPlan(full),'complete scripts replace settings independently of the current map');
assert.deepEqual(withoutPlan(compileStoryboard(full,base,geo).project),withoutPlan(full),'ordinary saved map files are accepted as full editor scripts');
assert.equal(backup.storyboard,undefined);assert.equal(backup.project.storyboard,undefined,'export does not recursively embed import history');
for(let i=0,p=full;i<4;i++){p=compileStoryboard(storyboardFromProject(p),base,geo).project;assert.equal(JSON.stringify(p).length,JSON.stringify(copy).length,'repeated roundtrips do not grow');}
for(const filename of ['map-ui.js','map-campaign-ui.mjs'])for(const m of read(filename).matchAll(/F\.(?:sel|range|num|chk|text|color|loc)\(\s*['"]([^'"]+)['"]/g)){
  const key=m[1];if(key.startsWith('__')||key.includes('.')||['id','type','name','start','dur','preset'].includes(key))continue;
  assert.ok(LAYER_OPTION_FIELDS.includes(key),`${filename}: manual field ${key} is scriptable`);
}
const reference=JSON.parse(read('storyboard-reference.json'));assert.deepEqual(reference.layerOptions,LAYER_OPTION_FIELDS);
const prompt=read('storyboard-ai-prompt.txt');
assert.equal(prompt,buildStoryboardAIPrompt({guide:storyboardGuideText(read('storyboard-guide.html')),reference,example:JSON.parse(read('examples/storyboard-full-control.json'))}),'the copyable AI instructions include the current entire guide, catalogue and worked example');
assert.ok(prompt.includes('MY STORY BRIEF'));assert.ok(prompt.includes('Native layers'));
for(const field of LAYER_OPTION_FIELDS)assert.ok(prompt.includes(JSON.stringify(field)),`${field} is included in the copied AI reference`);
for(const item of [...reference.enums.objects,...reference.enums.effects,...reference.enums.cameraPresets])assert.ok(prompt.includes(JSON.stringify(item.id)),`${item.id} is included in the copied AI reference`);
assert.ok(reference.enums.objects.length>150);assert.equal(reference.enums.cameraPresets.length,Object.keys(PRESETS).length);
const point={kind:'point',name:'Test',lat:50,lon:10};
for(const preset of Object.keys(PRESETS).filter(p=>p!=='keyframed')){
  const raw={duration:10,motion:'none',scenes:[{start:0,end:10,panel:false,camera:{preset,target:'France',object:'traveler',options:{autoFit:true}},actions:[{id:'traveler',type:'object',unit:'tank',from:'Paris',to:'Berlin'}]}]};
  const p=compileStoryboard(raw,base,geo).project;validateMapProject(p);assert.ok(p.shots[0].cameraKeys.some(k=>k.preset===preset),`${preset} keeps native motion samples`);
}
const image='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jOZkAAAAASUVORK5CYII=';
const custom={duration:20,motion:'none',project:{width:720,height:1280,mapBackground:{mode:'image',image,west:0,east:20,south:40,north:60},atlasLabels:{countries:true,font:'Georgia',text:'#ffffff'},terrain:{exaggeration:2},area:{detailCountries:['Bangladesh']}},scenes:[{start:0,end:20,panel:false,actions:[
  {type:'object',id:'wall',options:{glyph:'stoneWall',mode:'wallPath',wallSpacing:24,wallTowerEvery:4,wallGate:true},path:['Paris','Berlin']},
  {type:'object',unit:'image',place:point,options:{image,badgeShape:'circle',badgeZoom:1.2,plaqueFit:false}},
  {type:'border',target:{kind:'all',name:'All countries'},options:{borderStyle:'dashed',visible:false,mapOrder:8}},
  {type:'highlight',target:'France',options:{highlightExclude:['Belgium'],highlightOrigin:'Paris',highlightFill:'stripes',highlightColor2:'#ffffff',highlightPercent:70}},
  {type:'plane',from:'Paris',to:'Berlin',options:{icon:'money',symbol:'$',planeColor:'#ffd166',showRouteLabels:true}},
  {type:'object',unit:'tank',place:point,animation:{start:2,end:10},movement:{start:3,end:9},keys:[{frame:300,values:{objectAngle:45}}]}
]}]};
const customProject=compileStoryboard(custom,base,geo).project;validateMapProject(customProject);assert.equal(customProject.height,1280);assert.equal(customProject.actions[0].mode,'wallPath');assert.equal(customProject.actions[3].highlightOrigin.kind,'point');assert.equal(customProject.actions[5].animStart,60);assert.equal(customProject.actions[5].moveStart,90);
const split=makeAction('object',0,{place:point,dur:300,animDur:300,sourceStart:0,sourceDur:600,objectKeys:[{frame:0,values:{size:1}},{frame:600,values:{size:2}}]});
const native=structuredClone(base);native.actions=[split];native.shots=[makeShot('keyframed',0,{dur:native.frames,cameraFrom:native.camera.init,cameraTo:native.camera.init,cameraKeys:[]})];validateMapProject(native);
assert.deepEqual(withoutPlan(compileStoryboard(storyboardFromProject(native),base,geo).project),native,'split source clocks and off-clip keys survive');
const audio=compileStoryboard({duration:20,layers:[],audio:[{id:'voice',file:'voice.wav',start:'00:02',source:1,duration:5,volume:.4,muted:true}]},base,geo).audio;
assert.deepEqual(audio,[{id:'voice',file:'voice.wav',name:'voice.wav',start:2,source:1,duration:5,volume:.4,muted:true}]);
assert.throws(()=>compileStoryboard({duration:20,layers:[],audio:[{file:'voice.wav',start:18,duration:5}]},base,geo),/fit inside/);
assert.throws(()=>compileStoryboard({duration:20,layers:[],audio:[{file:'../voice.wav',duration:5}]},base,geo),/supporting audio file/);
assert.throws(()=>compileStoryboard({duration:20,layers:[{type:'object',id:'voice',place:point}],audio:[{id:'voice',file:'voice.wav',duration:5}]},base,geo),/already used/);
assert.throws(()=>compileStoryboard({duration:20,project:{width:99},layers:[]},base,geo),/canvas size/);
assert.throws(()=>compileStoryboard({duration:20,layers:[{type:'group',memberIds:['missing'],origin:{lon:0,lat:0}}]},base,geo),/group|belong/);
assert.throws(()=>compileStoryboard(JSON.parse('{"duration":20,"layers":[],"project":{"__proto__":{}}}'),base,geo),/Unsupported script field/);
assert.equal(storyboardProjectBase({project:{mapBackground:{mode:'historical1300'}}},base).mapBackground.mode,'historical1300');
console.log('Full editor scripting: manual-control coverage, native roundtrips, all camera presets, groups, lighting/path keys, walls, images, split clocks, project settings, references and audio manifests passed');
