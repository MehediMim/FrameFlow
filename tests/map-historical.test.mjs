import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createMapSources, mapSourceOf, HISTORICAL_1300, EUROPE_REGIONS } from '../map-sources.mjs';
import { MAP_BACKGROUNDS } from '../map-background.mjs';
import * as E from '../map-engine.mjs';

const read = path => JSON.parse(readFileSync(new URL('../' + path, import.meta.url), 'utf8'));
const requests = [];
const sources = createMapSources(async path => {
  requests.push(path);
  return {ok:true, json:async()=>read(path)};
});
const modern = await sources.load('modern');
assert.equal(requests.length,2,'modern projects only request the existing two base files');
const loading = sources.load(HISTORICAL_1300.mode);
assert.equal(loading,sources.load(HISTORICAL_1300.mode),'concurrent requests reuse one source load');
const historical = await loading;
assert.equal(await sources.load('modern'),modern,'switching back reuses modern geography');
assert.equal(await sources.load(HISTORICAL_1300.mode),historical,'historical geography is cached');
assert.equal(requests.filter(path=>path.endsWith('world-1300.json')).length,1);
assert.equal(requests.filter(path=>path===EUROPE_REGIONS.file).length,1,'additional regions load once with the historical source');
assert.equal(historical.land,modern);
assert.equal(historical.names.length,151);
assert.ok(historical.names.includes('Yuan Dynasty'));
assert.ok(historical.names.includes('Khalji Dynasty'));
assert.ok(historical.names.includes('Mali Empire'));
assert.ok(historical.names.includes('Chimu Empire'));
assert.ok(!historical.names.includes('India')&&!historical.names.includes('Pakistan'));
assert.equal(historical.cities.length,0,'modern cities are not presented as medieval cities');
for (const f of historical.hi.features) {
  assert.ok(f.rings.length);
  assert.ok(f.bbox.every(Number.isFinite));
  for (const r of f.rings) assert.ok(r.n >= 4 && [...r.xy].every(Number.isFinite));
}
const snapshot = read(HISTORICAL_1300.file);
assert.equal(snapshot.source.license,'CC BY 4.0');
assert.ok(snapshot.source.archiveSha256.match(/^[a-f0-9]{64}$/));
for (const g of snapshot.objects.countries.geometries) assert.ok(g.properties.fromYear<=1300&&g.properties.toYear>=1300);
assert.equal(E.countryAt(historical,108.94,34.34),'Yuan Dynasty','historical picking near Xi’an');
assert.equal(E.countryAt(historical,31.24,30.04),'Mamluk Sultanate','historical picking near Cairo');
assert.equal(E.countryAt(historical,2.35,48.85),'Kingdom of France','constituent territory wins over the parent realm');
assert.ok(MAP_BACKGROUNDS.historical1300);
const p=E.newMapProject(); p.mapBackground={mode:HISTORICAL_1300.mode};p.atlasLabels={countries:true,declutter:false,fitCountries:false};
assert.equal(p.actions.length,0,'loading selectable regions does not create animations');
assert.equal(E.detailRegions(p,historical).length,68);
assert.equal(new Set(historical.additionalRegions.map(f=>f.key)).size,68);
const expected={
  Ukraine:['Crimea'],Turkey:['Istanbul'],Egypt:['Alexandria'],Italy:['Sicily','Liguria','Veneto','Tuscany','Lazio','Campania','Emilia-Romagna','Piedmont','Apulia'],
  France:['Provence-Alpes-Côte d’Azur','Occitanie','Auvergne-Rhône-Alpes','Burgundy','Île-de-France','Normandy','Nouvelle-Aquitaine'],
  Spain:['Catalonia','Valencia','Aragon','Castile and León','Andalusia'],Tunisia:['Tunis'],Algeria:['Coastal Algeria'],Croatia:['Dalmatia'],
  'United Kingdom':['South West England','London','South East England','Rest of England','Wales','Scotland','North East England','North West England','Yorkshire and the Humber','East Midlands','West Midlands','East of England'],
  Ireland:['Dublin','East coast'],Germany:['Rhineland','Hesse','Bavaria','Saxony','Franconia'],Austria:['Vienna','Tyrol','Styria'],Switzerland:['Whole country'],Belgium:['Flanders'],Netherlands:['Holland','Zeeland'],
  Norway:['Bergen','Oslo'],Denmark:['Zealand','Jutland'],Sweden:['Southern Sweden','Stockholm region'],'Baltic states':['Livonia'],Latvia:['Whole country'],Estonia:['Whole country'],Lithuania:['Whole country'],Poland:['Pomerania','Prussia'],Russia:['Pskov','Novgorod','Moscow'],
};
for(const [country,names]of Object.entries(expected))for(const name of names){
  const key=country+' / '+name,f=historical.byName.get(key);
  assert.ok(f,key+' is independently selectable');assert.equal(f.level,'additional');
  assert.ok(f.rings.length&&f.rings.every(r=>r.n>=4&&[...r.xy].every(Number.isFinite)),key+' has usable geometry');
  const target={kind:'region',name:key,country};assert.ok(E.resolveLoc(historical,target));
  E.validateMapProject({...p,actions:[E.makeAction('highlight',0,{target}),E.makeAction('border',0,{target})]});
}
for(const [key,lon,lat]of [
 ['Ukraine / Crimea',35.38,45.03],['Turkey / Istanbul',28.9784,41.0082],['Egypt / Alexandria',29.92,31.20],['Italy / Sicily',15.55,38.19],['Italy / Liguria',8.94,44.41],['Italy / Veneto',12.33,45.44],
 ['France / Provence-Alpes-Côte d’Azur',5.37,43.30],['France / Île-de-France',2.35,48.85],['Germany / Franconia',11.08,49.45],['Germany / Rhineland',6.96,50.94],['Croatia / Dalmatia',18.09,42.65],
 ['United Kingdom / South West England',-2.4544,50.6179],['Ireland / Dublin',-6.26,53.35],['Norway / Bergen',5.32,60.39],['Norway / Oslo',10.75,59.91],['Denmark / Zealand',12.56,55.68],['Denmark / Jutland',9.92,57.05],['Sweden / Stockholm region',18.06,59.33],['Russia / Moscow',37.62,55.75],
])assert.equal(E.regionAt(p,historical,lon,lat),key,'direct selection at '+key);
assert.ok(historical.byName.get('Germany / Franconia').approximate);
assert.ok(historical.byName.get('Norway / Bergen').selectionNote.includes('Hordaland'));
p.mapBackground.additionalRegions=false;
assert.equal(E.detailRegions(p,historical).length,0);assert.equal(E.regionAt(p,historical,15.55,38.19),null);
assert.ok(E.resolveLoc(historical,{kind:'region',name:'Italy / Sicily',country:'Italy'}),'disabling picking preserves saved region targets');
p.mapBackground.additionalRegions=true;
assert.throws(()=>E.validateMapProject({...p,mapBackground:{mode:'historical1300',additionalRegions:'yes'}}),/additional region/);
assert.equal(mapSourceOf(p),HISTORICAL_1300.mode);
assert.equal(mapSourceOf(E.newMapProject()),'modern');
const v=E.makeView({cx:E.lonToX(60),cy:E.latToY(25),zoom:.8,pitch:0,bearing:0},1280,720);
const labels=E.atlasMapLabels(p,historical,v);
assert.deepEqual(E.atlasMapLabels(p,modern,v),[],'missing historical data cannot leak modern country labels');
assert.ok(labels.some(l=>l.text==='Yuan Dynasty'));
assert.ok(labels.every(l=>!historical.additionalRegions.some(f=>f.key===l.text)),'additional modern region labels do not replace historical atlas names');
assert.ok(labels.every(l=>!modern.names.includes(l.text)),'automatic labels come from historical territories');
p.actions=[E.makeAction('highlight',0,{target:{kind:'country',name:'Yuan Dynasty'}}),E.makeAction('border',0,{target:{kind:'country',name:'Mamluk Sultanate'}})];
E.validateMapProject(JSON.parse(JSON.stringify(p)));
assert.ok(E.resolveLoc(historical,p.actions[0].target));
assert.deepEqual(E.imageryNeeds(p,historical,1280,720,0),[],'historical maps need no modern imagery tiles');
const gradient=()=>({addColorStop(){}}),calls={fill:0,stroke:0,texts:[]};
const ctx=new Proxy({canvas:{width:1280,height:720}}, {get:(o,key)=>key in o?o[key]:key==='measureText'?s=>({width:s.length*8}):key==='createLinearGradient'||key==='createRadialGradient'?gradient:(...args)=>{if(key==='fill'||key==='stroke')calls[key]++;if(key==='fillText')calls.texts.push(args[0]);},set:(o,k,v)=>(o[k]=v,true)});
E.drawMap(ctx,1280,720,p,45,historical);
assert.ok(calls.fill>0&&calls.stroke>0,'historical base and animated territories render');
let failures=1;
const retrySources=createMapSources(async path=>path===HISTORICAL_1300.file&&failures-- >0?{ok:false,status:503}:{ok:true,json:async()=>read(path)});
await assert.rejects(retrySources.load(HISTORICAL_1300.mode),/503/);
assert.equal((await retrySources.load(HISTORICAL_1300.mode)).names.length,151,'failed historical fetch can be retried');
let regionFailures=1;
const retryRegions=createMapSources(async path=>path===EUROPE_REGIONS.file&&regionFailures-- >0?{ok:false,status:503}:{ok:true,json:async()=>read(path)});
await assert.rejects(retryRegions.load(HISTORICAL_1300.mode),/503/);
assert.equal((await retryRegions.load(HISTORICAL_1300.mode)).additionalRegions.length,68,'additional region fetch failures can be retried');
console.log(`68 individually selectable regions; ${gzipSync(readFileSync(new URL('../'+EUROPE_REGIONS.file,import.meta.url))).length} bytes gzip. Coverage, anchors, target validation, picking toggle and retry passed.`);
console.log(`AD 1300: ${historical.names.length} territories; ${gzipSync(readFileSync(new URL('../'+HISTORICAL_1300.file,import.meta.url))).length} bytes gzip. Loading, caching, picking, labels, animations, validation and retry passed.`);
