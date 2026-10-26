"""Build selectable regions for the historical map, without animation layers.

Inputs (download separately, then pass their local paths):
  Natural Earth v5.1.2 ne_10m_admin_1_states_provinces.geojson
  geoBoundaries 9469f09 DEU ADM2 simplified GeoJSON (BKG government districts)
Uses Python's standard library. Source URLs and hashes are embedded in the output.
"""
import argparse
from collections import defaultdict
import hashlib
import json
from pathlib import Path

NE_URL = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_1_states_provinces.geojson'
DE_URL = 'https://media.githubusercontent.com/media/wmgeolab/geoBoundaries/9469f09/releaseData/gbOpen/DEU/ADM2/geoBoundaries-DEU-ADM2_simplified.geojson'
SCALE = 100000


def area(r):
    return abs(sum(a[0]*b[1]-b[0]*a[1] for a,b in zip(r,r[1:]))) / 2


def inside(p, r):
    x,y=p; hit=False
    for a,b in zip(r,r[1:]):
        if (a[1]>y)!=(b[1]>y) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            hit=not hit
    return hit


def dissolve(features):
    # Natural Earth and BKG preserve shared edges. Cancel those edges before
    # simplifying, so provincial/county seams do not become regional borders.
    edges=set()
    for feature in features:
        g=feature['geometry']
        polygons=[g['coordinates']] if g['type']=='Polygon' else g['coordinates']
        for polygon in polygons:
            for ring in polygon:
                points=[]
                for p in ring:
                    q=(round(p[0]*SCALE),round(p[1]*SCALE))
                    if not points or q!=points[-1]: points.append(q)
                if points and points[0]!=points[-1]: points.append(points[0])
                for a,b in zip(points,points[1:]):
                    edge=tuple(sorted((a,b)))
                    if edge in edges: edges.remove(edge)
                    else: edges.add(edge)
    adjacency=defaultdict(set)
    for a,b in edges:
        adjacency[a].add(b); adjacency[b].add(a)
    rings=[]
    while edges:
        a,b=min(edges); ring=[a]; start=a
        while True:
            edge=tuple(sorted((a,b)))
            edges.remove(edge); adjacency[a].remove(b); adjacency[b].remove(a)
            ring.append(b)
            if b==start: break
            candidates=adjacency[b]
            if not candidates: raise ValueError('Open dissolved boundary')
            a,b=b,min(candidates)
        if len(ring)>=4 and area(ring)>0: rings.append(ring)
    rings.sort(key=lambda r:-area(r))
    polygons=[]; hierarchy=[]
    for ring in rings:
        parent=next((i for i in range(len(hierarchy)-1,-1,-1) if inside(ring[0],hierarchy[i][0])),None)
        depth=0 if parent is None else hierarchy[parent][1]+1
        if depth%2==0:
            polygon=[ring];polygons.append(polygon)
        else:
            polygon=hierarchy[parent][2];polygon.append(ring)
        hierarchy.append((ring,depth,polygon))
    return [[[ [p[0]/SCALE,p[1]/SCALE] for p in ring] for ring in polygon] for polygon in polygons]


def simplify(points, tolerance=.001):
    # Split a closed ring at its farthest vertex before Douglas-Peucker.
    def segment(points):
        if len(points)<3: return points
        a,b=points[0],points[-1];dx=b[0]-a[0];dy=b[1]-a[1];den=dx*dx+dy*dy
        best=0;index=0
        for i,p in enumerate(points[1:-1],1):
            t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
            distance=(p[0]-a[0]-t*dx)**2+(p[1]-a[1]-t*dy)**2
            if distance>best: best=distance;index=i
        return segment(points[:index+1])[:-1]+segment(points[index:]) if best>tolerance*tolerance else [a,b]
    pivot=max(range(1,len(points)-1),key=lambda i:(points[i][0]-points[0][0])**2+(points[i][1]-points[0][1])**2)
    result=segment(points[:pivot+1])[:-1]+segment(points[pivot:])
    return result if len(result)>=4 else points


def build(ne_path,de_path,output):
    ne=json.loads(Path(ne_path).read_text(encoding='utf-8'))['features']
    de=json.loads(Path(de_path).read_text(encoding='utf-8'))['features']
    specs=[]
    def select(country=None,iso=None,region=None,unit=None):
        result=[f for f in ne if (country is None or f['properties']['adm0_a3']==country)
                and (iso is None or f['properties']['iso_3166_2'] in iso)
                and (region is None or f['properties']['region'] in region)
                and (unit is None or f['properties']['geonunit']==unit)]
        if not result: raise ValueError(f'Empty selection: {country}, {iso}, {region}, {unit}')
        if iso is not None:
            found={f['properties']['iso_3166_2'] for f in result}
            if set(iso)!=found: raise ValueError(f'Missing ISO selections: {set(iso)-found}')
        return result
    def german(names):
        result=[f for f in de if f['properties']['shapeName'] in names]
        assert len(result)==len(names)
        return result
    def add(country,name,features,aliases=(),note='',approximate=False,polygon_filter=None):
        specs.append(dict(country=country,name=name,features=features,aliases=list(aliases),note=note,
                          approximate=approximate,polygon_filter=polygon_filter))
    add('Ukraine','Crimea',select(iso=['UA-43','UA-40']),['Caffa','Feodosia'],'Crimean peninsula: Crimea and Sevastopol administrative extents.')
    add('Turkey','Istanbul',select('TUR',iso=['TR-34']),['Constantinople'],'Istanbul province, rather than only the historic city.')
    add('Egypt','Alexandria',select('EGY',iso=['EG-ALX']),['Alexandria governorate'])
    for name,region,aliases in [('Sicily','Sicily',['Messina']),('Liguria','Liguria',['Genoa']),('Veneto','Veneto',['Venice']),('Tuscany','Toscana',[]),('Lazio','Lazio',[]),('Campania','Campania',[]),('Emilia-Romagna','Emilia-Romagna',[]),('Piedmont','Piemonte',[]),('Apulia','Apulia',['Puglia'])]:
        add('Italy',name,select('ITA',region=[region]),aliases)
    for name,region,aliases in [("Provence-Alpes-Côte d’Azur","Provence-Alpes-Côte-d'Azur",['Marseille','Provence-Alpes-Cote d Azur']),('Occitanie','Occitanie',[]),('Auvergne-Rhône-Alpes','Auvergne-Rhône-Alpes',[]),('Île-de-France','Île-de-France',['Ile-de-France']),('Normandy','Normandie',[]),('Nouvelle-Aquitaine','Nouvelle-Aquitaine',[])]:
        add('France',name,select('FRA',region=[region]),aliases)
    add('France','Burgundy',select('FRA',iso=['FR-21','FR-58','FR-71','FR-89']),['Bourgogne'],'Former Burgundy administrative region: Côte-d’Or, Nièvre, Saône-et-Loire and Yonne; excludes Franche-Comté.')
    for name,region in [('Catalonia','Cataluña'),('Valencia','Valenciana'),('Aragon','Aragón'),('Castile and León','Castilla y León'),('Andalusia','Andalucía')]:
        add('Spain',name,select('ESP',region=[region]))
    add('Tunisia','Tunis',select('TUN',iso=['TN-11']),note='Tunis governorate, rather than the entire metropolitan area.')
    add('Algeria','Coastal Algeria',select('DZA',iso=['DZ-'+s for s in ['13','46','31','27','02','42','16','35','15','06','18','21','23','36']]),note='Approximate coastal belt: all 14 source wilayas with a Mediterranean coast, including their inland portions.',approximate=True)
    add('Croatia','Dalmatia',select('HRV',iso=['HR-13','HR-15','HR-17','HR-19']),['Dubrovnik','Ragusa'],note='Approximate extent: Zadar, Šibenik-Knin, Split-Dalmatia and Dubrovnik-Neretva counties.',approximate=True)
    english=[('South West England','South West'),('London','Greater London'),('South East England','South East'),('North East England','North East'),('North West England','North West'),('Yorkshire and the Humber','Yorkshire and the Humber'),('East Midlands','East Midlands'),('West Midlands','West Midlands'),('East of England','East')]
    for name,region in english:
        aliases=['Melcombe','Dorset'] if region=='South West' else ['South East'] if region=='South East' else []
        add('United Kingdom',name,select('GBR',region=[region],unit='England'),aliases)
    add('United Kingdom','Rest of England',select('GBR',region=[r for _,r in english[3:]],unit='England'),note='England excluding South West England, London and South East England.')
    for unit in ['Wales','Scotland']:add('United Kingdom',unit,select('GBR',unit=unit))
    add('Ireland','Dublin',select('IRL',iso=['IE-D']),note='Dublin, Fingal, South Dublin and Dún Laoghaire–Rathdown combined.')
    add('Ireland','East coast',select('IRL',iso=['IE-LH','IE-MH','IE-D','IE-WW','IE-WX']),note='Approximate eastern coastal belt: Louth, Meath, Dublin, Wicklow and Wexford, including inland county areas.',approximate=True)
    for name,iso in [('Hesse','DE-HE'),('Bavaria','DE-BY'),('Saxony','DE-SN')]:add('Germany',name,select('DEU',iso=[iso]))
    add('Germany','Franconia',german(['Oberfranken','Mittelfranken','Unterfranken']),note='Approximate cultural extent using the three Bavarian administrative districts Upper, Middle and Lower Franconia; other Franconian areas are excluded.',approximate=True)
    add('Germany','Rhineland',german(['Düsseldorf','Köln','Koblenz','Trier','Rheinhessen-Pfalz','Saarland']),note='Approximate extent combining Düsseldorf, Cologne, Koblenz, Trier, Rheinhessen-Pfalz and Saarland government districts.',approximate=True)
    for name,iso in [('Vienna','AT-9'),('Tyrol','AT-7'),('Styria','AT-6')]:add('Austria',name,select('AUT',iso=[iso]))
    add('Switzerland','Whole country',select('CHE'),['Switzerland'],'Modern Switzerland outline, assembled from its cantons.')
    add('Belgium','Flanders',select('BEL',region=['Flemish']),note='Modern Flemish Region: five provinces; not the medieval County of Flanders.',approximate=True)
    add('Netherlands','Holland',select('NLD',iso=['NL-NH','NL-ZH']),note='North Holland and South Holland provinces combined.')
    add('Netherlands','Zeeland',select('NLD',iso=['NL-ZE']))
    add('Norway','Bergen',select('NOR',iso=['NO-12']),note='Approximate Bergen-area extent using the source’s Hordaland county boundary, not Bergen municipality.',approximate=True)
    add('Norway','Oslo',select('NOR',iso=['NO-03']))
    add('Denmark','Zealand',select('DNK',iso=['DK-85','DK-84']),note='Approximate extent using Zealand and Capital regions; Bornholm excluded, nearby southern islands retained.',approximate=True,polygon_filter=lambda p: min(x for x,y in p[0])>10.8 and max(x for x,y in p[0])<13.2)
    add('Denmark','Jutland',select('DNK',iso=['DK-81','DK-82','DK-83']),note='Jutland mainland and northern/nearby islands from the three western Danish regions; Funen and southern islands excluded.',approximate=True,polygon_filter=lambda p:max(y for x,y in p[0])>55.75)
    add('Sweden','Southern Sweden',select('SWE',iso=['SE-O','SE-E','SE-H','SE-K','SE-M','SE-N','SE-I','SE-F','SE-G']),note='Approximate southern extent: Västra Götaland, Östergötland, Kalmar, Blekinge, Skåne, Halland, Gotland, Jönköping and Kronoberg.',approximate=True)
    add('Sweden','Stockholm region',select('SWE',iso=['SE-AB']),['Stockholm'])
    add('Baltic states','Livonia',select('LVA')+select('EST'),note='Broad Latvia-and-Estonia proxy requested for the map; not a reconstructed medieval Livonian border. Latvia and Estonia are also available separately.',approximate=True)
    for country,code in [('Latvia','LVA'),('Estonia','EST'),('Lithuania','LTU')]:add(country,'Whole country',select(code),[country])
    add('Poland','Pomerania',select('POL',iso=['PL-ZP','PL-PM']),note='Polish West Pomeranian and Pomeranian voivodeships combined; German Vorpommern excluded.',approximate=True)
    add('Poland','Prussia',select(iso=['PL-WN','RU-KGD']),note='Approximate East Prussia proxy: modern Warmian-Masurian voivodeship and Kaliningrad oblast. Extends across modern Poland and Russia.',approximate=True)
    for name,codes in [('Pskov',['RU-PSK']),('Novgorod',['RU-NGR']),('Moscow',['RU-MOW','RU-MOS'])]:
        add('Russia',name,select('RUS',iso=codes),note='Modern oblast extent'+(' plus Moscow city.' if name=='Moscow' else '; not the medieval principality boundary.'))
    arcs=[];geometries=[]
    for spec in sorted(specs,key=lambda s:(s['country'],s['name'])):
        polygons=dissolve(spec['features'])
        if spec['polygon_filter']:polygons=[p for p in polygons if spec['polygon_filter'](p)]
        assert polygons,spec['name']
        indices=[]
        for polygon in polygons:
            rings=[]
            for ring in polygon:
                points=simplify(ring);previous=[0,0];delta=[]
                for p in points:
                    q=[round(p[0]*SCALE),round(p[1]*SCALE)]
                    delta.append([q[0]-previous[0],q[1]-previous[1]]);previous=q
                arcs.append(delta);rings.append([len(arcs)-1])
            indices.append(rings)
        components=[dict(id=f['properties'].get('adm1_code') or f['properties'].get('shapeID'),name=f['properties'].get('name') or f['properties'].get('shapeName')) for f in spec['features']]
        props=dict(name=spec['country']+' / '+spec['name'],label=spec['name'],country=spec['country'],aliases=spec['aliases'],approximate=spec['approximate'],note=spec['note'],components=components)
        geometries.append(dict(type='MultiPolygon',properties=props,arcs=indices))
    data=dict(type='Topology',id='europe-mediterranean',title='Europe & Mediterranean selection regions',
              note='Modern administrative extents and documented approximate composites for selection and animation over a historical background. These are not AD 1300 political borders or dated disease-spread boundaries.',
              sources=[dict(name='Natural Earth',version='v5.1.2',url=NE_URL,sha256=hashlib.sha256(Path(ne_path).read_bytes()).hexdigest(),license='Public domain',licenseUrl='https://www.naturalearthdata.com/about/terms-of-use/'),
                       dict(name='BKG government districts 2021 via geoBoundaries DEU ADM2',version='9469f09',url=DE_URL,sha256=hashlib.sha256(Path(de_path).read_bytes()).hexdigest(),license='Data licence Germany – attribution – version 2.0',licenseUrl='https://www.govdata.de/dl-de/by-2-0',attribution='© GeoBasis-DE / BKG 2021, via geoBoundaries; dissolved and simplified by FrameFlow.')],
              changes='Selected source components, dissolved shared edges, simplified at 0.001 degrees, quantized to 0.00001 degrees; named composites and island filters documented per feature.',
              transform=dict(scale=[1/SCALE,1/SCALE],translate=[0,0]),objects=dict(countries=dict(type='GeometryCollection',geometries=geometries)),arcs=arcs)
    Path(output).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    print(f'{len(geometries)} regions; {Path(output).stat().st_size:,} bytes; {output}')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('natural_earth');parser.add_argument('german_districts')
    parser.add_argument('--output',default=str(Path(__file__).resolve().parents[1]/'map-data'/'europe-mediterranean-regions.json'))
    args=parser.parse_args();build(args.natural_earth,args.german_districts,args.output)
