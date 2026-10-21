import assert from 'node:assert/strict';
import { defaultScene, makeObject, validateScene } from '../scene-engine.mjs';
import { TEXTURE_PACKS, SURFACE_TEXTURES, applyTexturePack, surfaceTexture, terrainHeight, terrainMesh, DEFAULT_TERRAIN } from '../scene-environment.mjs';

for(const id of Object.keys(TEXTURE_PACKS)){
  const p=defaultScene();p.objects.push(makeObject('house'),makeObject('tree'),makeObject('pond'));
  const character=structuredClone(p.objects[0]),positions=p.objects.map(o=>[o.x,o.z,o.endX,o.endZ]);
  applyTexturePack(p,id);validateScene(p);
  assert.deepEqual(p.objects[0],character,'packs preserve character customization');
  assert.deepEqual(p.objects.map(o=>[o.x,o.z,o.endX,o.endZ]),positions,'packs preserve layout and routes');
  assert.deepEqual(validateScene(JSON.parse(JSON.stringify(p))),p,'pack settings survive reopening');
  if(id!=='none'){
    const house=p.objects.find(o=>o.type==='house');
    assert.ok(SURFACE_TEXTURES[surfaceTexture(p,house,house.color)]);
    assert.equal(surfaceTexture(p,house,'#465864'),'none','windows stay smooth');
    assert.equal(surfaceTexture(p,house,house.accentColor),'roof');
    assert.equal(surfaceTexture(p,character,character.color),'none','skin and clothing do not inherit masonry');
    house.surfaceTexture='wood';assert.equal(surfaceTexture(p,house,house.color),'wood');
    house.surfaceTexture='none';assert.equal(surfaceTexture(p,house,house.color),'none');
  }
}
for(const type of ['flat','rolling','ridged','dunes']){
  const q={...DEFAULT_TERRAIN,type};
  assert.equal(terrainHeight(0,12,q),-.15,'building area remains level');
  assert.equal(terrainHeight(5,15,q),-.15);
  const first=terrainMesh(q),again=terrainMesh(structuredClone(q));
  assert.equal(first,again,'repeated terrain reuses cached geometry');
  assert.ok(first.flat(2).every(Number.isFinite),'terrain contains finite coordinates');
  for(let x=-100;x<100;x+=10)assert.ok(terrainHeight(x,70,q)>=-.15&&terrainHeight(x,70,q)<=q.height);
  if(type!=='flat')assert.notEqual(terrainHeight(60,80,q),terrainHeight(60,80,{...q,seed:33}),'seed changes landscape');
  const p=defaultScene();p.terrain=q;validateScene(p);
}
const invalid=[
  p=>p.texturePack='missing',p=>p.groundTexture='missing',p=>p.textureScale=0,p=>p.textureStrength=2,
  p=>p.haze=-1,p=>p.terrain={type:'bad'},p=>p.terrain={type:'rolling',seed:1.2},
  p=>p.terrain={type:'rolling',height:26},p=>p.terrain={type:'rolling',scale:0},
  p=>p.terrain={type:'rolling',flatRadius:-1},p=>p.terrain=null,
  p=>p.objects[0].surfaceTexture='bad',p=>p.objects[0].textureScale=100,
  p=>p.objects[0].grounding='bad',p=>p.objects[0].terrainProfile='bad',
];
for(const change of invalid){const p=defaultScene();change(p);assert.throws(()=>validateScene(p),/Invalid/);}
console.log('Scene materials and terrain: palettes, surface overrides, deterministic geometry, persistence and validation passed');
