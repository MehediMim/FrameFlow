import { buildGeo } from './map-engine.mjs?v=live-follow-3';

export const HISTORICAL_1300 = Object.freeze({
  mode: 'historical1300', title: 'World · c. AD 1300', year: 1300,
  file: 'map-data/world-1300.json',
  attribution: 'Cliopatria v0.2.0 · Seshat Global History Databank · CC BY 4.0. Boundaries are approximate; unrecorded areas remain plain land.',
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
      const [topology, land] = await Promise.all([json(HISTORICAL_1300.file), load('modern')]);
      if (topology.year !== 1300 || !topology.objects?.countries?.geometries?.length) throw Error('Invalid AD 1300 map data.');
      const geo = buildGeo(topology);
      return {...geo, source, land, historical: HISTORICAL_1300, hitFeatures: [...geo.hi.features].reverse(), cities: [], details: new Map()};
    })();
    cache.set(source, task);
    task.catch(() => { if (cache.get(source) === task) cache.delete(source); });
    return task;
  };
  return {load};
}
