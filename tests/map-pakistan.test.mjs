import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as E from '../map-engine.mjs';
import { detailFileOf, detailInfo } from '../map-country-details.mjs';
const load=name=>JSON.parse(readFileSync(new URL('../map-data/'+name,import.meta.url),'utf8'));
const geo=E.buildGeo(load('countries-50m.json'),load('countries-110m.json')),raw=load('pakistan-detail.json');
assert.equal(detailFileOf('Pakistan'),'map-data/pakistan-detail.json');
const pack=E.installCountryDetail(geo,raw),info=detailInfo(geo,'Pakistan');
assert.equal(pack.levels.division.length,7);
assert.deepEqual(info.levels,[['division','Provinces / territories']]);
const expected=['Balochistan','Sindh','Punjab','Khyber Pakhtunkhwa','Islamabad Capital Territory','Gilgit-Baltistan','Azad Kashmir'];
assert.deepEqual(pack.levels.division.map(r=>r.name).sort(),expected.sort());
assert.ok(pack.country);assert.equal(new Set(raw.features.map(f=>f.properties.key)).size,8);
const p=E.newMapProject();p.area={...E.DEFAULT_AREA,mode:'country',country:'Pakistan',detailLevel:'division'};
const cities={Quetta:'Balochistan',Karachi:'Sindh',Lahore:'Punjab',Peshawar:'Khyber Pakhtunkhwa',Islamabad:'Islamabad Capital Territory',Gilgit:'Gilgit-Baltistan',Muzaffarabad:'Azad Kashmir'};
for(const city of raw.cities){
  assert.equal(E.countryAt({hi:{features:[pack.country]}},city[2],city[1]),'Pakistan',city[0]+' is inside the country outline');
  if(cities[city[0]])assert.equal(E.regionAt(p,geo,city[2],city[1]),'Pakistan / '+cities[city[0]],city[0]+' resolves to its province/territory');
}
const area=f=>f.rings.reduce((n,r)=>n+(r.hole?-r.area:r.area),0);
assert.ok(Math.abs(pack.levels.division.reduce((n,r)=>n+area(r),0)/area(pack.country)-1)<.00001,'regions tile the dissolved country outline');
for(const region of pack.levels.division){
  const target={kind:'region',name:region.key,country:'Pakistan'};
  assert.ok(E.resolveLoc(geo,target));p.actions.push(E.makeAction('border',0,{target}));
}
p.actions.push(E.makeAction('highlight',0,{target:{kind:'country',name:'Pakistan'},highlightExclude:[{kind:'region',name:'Pakistan / Sindh',country:'Pakistan'}]}));
E.validateMapProject(JSON.parse(JSON.stringify(p)));
E.installCountryDetail(geo,load('india-detail.json'));
assert.equal(geo.byName.get('Pakistan / Punjab').country,'Pakistan','Punjab remains distinct when India is also loaded');
console.log('Pakistan: seven provinces/territories, dissolved outline, city containment, region picking, borders, exclusions and India coexistence passed');
