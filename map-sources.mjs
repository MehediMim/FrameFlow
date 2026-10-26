import { buildGeo } from './map-engine.mjs?v=live-follow-3';

export const HISTORICAL_1300 = Object.freeze({
  mode: 'historical1300', title: 'World · c. AD 1300', year: 1300,
  file: 'map-data/world-1300.json',
  attribution: 'Cliopatria v0.2.0 · Seshat Global History Databank · CC BY 4.0. Boundaries are approximate; unrecorded areas remain plain land.',
});
export const EUROPE_REGIONS = Object.freeze({
  file:'map-data/europe-mediterranean-regions.json',
  note:'Additional regions use modern administrative boundaries and documented approximate extents. They are selection areas, not medieval political borders. Select them individually for Border or Highlight.',
});
export const mapSourceOf = project => project.mapBackground?.mode === HISTORICAL_1300.mode ? HISTORICAL_1300.mode : 'modern';

// Cache each source independently. A failed request can be retried, and changing
// sources during loading never changes which promise an existing caller receives.
export function createMapSources(fetcher = (...args) => fetch(...args)) {
  const cache = new Map();
  const json = async path => {
    const response = await fetcher(path);
    if (!response.ok) throw Error(`${path}: HTTP ${response.status}`);
    return response.json();
  };
  const load = source => {
    if (cache.has(source)) return cache.get(source);
    const task = (async () => {
      if (source === 'modern') {
        const [hi, lo] = await Promise.all(['countries-50m.json','countries-110m.json'].map(file => json('map-data/' + file)));
        return {...buildGeo(hi, lo), source};
      }
      if (source !== HISTORICAL_1300.mode) throw Error('Unknown map source.');
      const [topology, land, regions] = await Promise.all([json(HISTORICAL_1300.file), load('modern'), json(EUROPE_REGIONS.file)]);
      if (topology.year !== 1300 || !topology.objects?.countries?.geometries?.length) throw Error('Invalid AD 1300 map data.');
      const geo = buildGeo(topology);
      if(regions.id!=='europe-mediterranean'||!regions.objects?.countries?.geometries?.length)throw Error('Invalid additional region data.');
      const additional=buildGeo(regions),metadata=new Map(regions.objects.countries.geometries.map(g=>[g.properties.name,g.properties]));
      for(const f of additional.hi.features){
        const meta=metadata.get(f.name);
        f.key=f.name;f.name=meta.label;f.country=meta.country;f.level='additional';
        f.aliases=meta.aliases||[];f.approximate=meta.approximate;f.selectionNote=meta.note;
        if(geo.byName.has(f.key))throw Error('Additional region key collides with a historical territory.');
        geo.byName.set(f.key,f);
      }
      const additionalRegions=additional.hi.features;
      const additionalHitFeatures=[...additionalRegions].sort((a,b)=>(a.bbox[2]-a.bbox[0])*(a.bbox[3]-a.bbox[1])-(b.bbox[2]-b.bbox[0])*(b.bbox[3]-b.bbox[1])).map(f=>({...f,name:f.key}));
      return {...geo, source, land, historical: HISTORICAL_1300, hitFeatures: [...geo.hi.features].reverse(), cities: [], details: new Map(),additionalRegions,additionalHitFeatures};
    })();
    cache.set(source, task);
    task.catch(() => { if (cache.get(source) === task) cache.delete(source); });
    return task;
  };
  return {load};
}
