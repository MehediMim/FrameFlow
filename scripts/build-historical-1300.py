"""Build the bundled AD 1300 snapshot using only Python's standard library.

Download cliopatria.geojson.zip from the pinned source URL below, then run:
  python scripts/build-historical-1300.py PATH_TO_ZIP
The original archive is a build input only; it is not shipped with the app.
"""
import argparse
import hashlib
import json
from pathlib import Path
import zipfile

SOURCE = 'https://raw.githubusercontent.com/Seshat-Global-History-Databank/cliopatria/v0.2.0/cliopatria.geojson.zip'
YEAR = 1300
SCALE = 10000


def build(archive, output):
    with zipfile.ZipFile(archive) as bundle:
        name = next(n for n in bundle.namelist() if n.endswith('.geojson') and not n.startswith('__MACOSX/'))
        data = json.loads(bundle.read(name))
    selected = [f for f in data['features'] if f['properties']['Type'] == 'POLITY'
                and f['properties']['FromYear'] <= YEAR <= f['properties']['ToYear']]
    # Parent realms first, constituent polities afterwards. Small overlapping
    # territories remain visible and clickable over larger ones.
    selected.sort(key=lambda f: (-f['properties']['Area'], f['properties']['Name']))
    arcs, geometries = [], []

    def ring_arc(ring):
        points = []
        for lon, lat, *_ in ring:
            point = [round(lon * SCALE), round(lat * SCALE)]
            if not points or point != points[-1]:
                points.append(point)
        if points and points[0] != points[-1]:
            points.append(points[0])
        if len(points) < 4:
            return None
        previous = [0, 0]
        delta = []
        for point in points:
            delta.append([point[0] - previous[0], point[1] - previous[1]])
            previous = point
        arcs.append(delta)
        return [len(arcs) - 1]

    for feature in selected:
        p, g = feature['properties'], feature['geometry']
        polygons = [g['coordinates']] if g['type'] == 'Polygon' else g['coordinates']
        poly_arcs = []
        for polygon in polygons:
            outer = ring_arc(polygon[0])
            if outer is None:
                continue
            rings = [outer]
            for ring in polygon[1:]:
                arc = ring_arc(ring)
                if arc is not None:
                    rings.append(arc)
            poly_arcs.append(rings)
        if not poly_arcs:
            continue
        name = p['Name']
        if name.startswith('(') and name.endswith(')'):
            name = name[1:-1] + ' (realm)'
        properties = dict(name=name, sourceName=p['Name'], fromYear=p['FromYear'], toYear=p['ToYear'],
                          area=p['Area'], memberOf=p['MemberOf'], wikipedia=p['Wikipedia'], wikidata=p['Wikidata'])
        geometries.append(dict(type='MultiPolygon', properties=properties, arcs=poly_arcs))
    names = [g['properties']['name'] for g in geometries]
    if len(set(names)) != len(names):
        raise ValueError('Snapshot contains duplicate territory names; resolve before publishing.')
    topology = dict(type='Topology', year=YEAR, title='World c. AD 1300',
                    source=dict(name='Cliopatria', version='v0.2.0', author='Seshat Global History Databank',
                                url=SOURCE, archiveSha256=hashlib.sha256(Path(archive).read_bytes()).hexdigest(),
                                license='CC BY 4.0', licenseUrl='https://creativecommons.org/licenses/by/4.0/',
                                citation='Bennett et al. (2025), Cliopatria, Scientific Data. https://doi.org/10.1038/s41597-025-04516-9',
                                changes='POLITY records active in AD 1300, inclusive dates; relations excluded; sorted by area; coordinates quantized to 0.0001 degrees; parent realm names annotated. No historical corrections applied.'),
                    note='Approximate recorded polity extents, including overlapping realms and their members. Plain land does not imply uninhabited or unclaimed land. Modern coastlines are used as context.',
                    transform=dict(scale=[1 / SCALE, 1 / SCALE], translate=[0, 0]),
                    objects=dict(countries=dict(type='GeometryCollection', geometries=geometries)), arcs=arcs)
    Path(output).write_text(json.dumps(topology, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(f'{len(geometries)} territories; {Path(output).stat().st_size:,} bytes; {output}')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('archive')
    parser.add_argument('--output', default=str(Path(__file__).resolve().parents[1] / 'map-data' / 'world-1300.json'))
    args = parser.parse_args()
    build(args.archive, args.output)
