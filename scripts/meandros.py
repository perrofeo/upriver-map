#!/usr/bin/env python3
"""
meandros.py — da meandros al río grande y recoloca lo que vive en su orilla.

Parte de un trazado base del río grande (una polilínea suave, de la cabecera
a la desembocadura) y le superpone ondas perpendiculares de longitud de onda
larga (45-60 km, unas 10-14 veces el ancho del cauce, como un meandro de
llanura) y amplitud creciente río abajo. Después:
  - compacta el arranque (poblado, palafito, caño, túneles, peces muertos y
    barco) en un radio de ~10 km junto a la desembocadura;
  - acorta el caño de las Gargantas y baja las colinas;
  - encaja en el río nuevo la comunidad, la ciudad, el sitio del ritual, las
    bocas del desvío y las posiciones ancladas de las apariciones;
  - regenera la hidrografía sin nombre (cochas, islas, playas, tahuampa).

Uso: python3 scripts/meandros.py <carpeta_con_geojson_base> [--semilla 7]
Escribe en src/data/upriver/. Los datos base son los de antes de aplicar
meandros (git show <commit>:src/data/upriver/rutas.geojson, etc.).
"""
import json, math, random, sys, os

BASE = sys.argv[1] if len(sys.argv) > 1 else None
SEMILLA = int(sys.argv[sys.argv.index('--semilla') + 1]) if '--semilla' in sys.argv else 7
DEST = os.path.join(os.path.dirname(__file__), '..', 'src', 'data', 'upriver') + '/'
if not BASE:
    print(__doc__); sys.exit(2)
BASE = BASE.rstrip('/') + '/'

KM_LON = 111.32 * math.cos(math.radians(-5.4)); KM_LAT = 110.57
def km(a, b): return math.hypot((b[0] - a[0]) * KM_LON, (b[1] - a[1]) * KM_LAT)
def largo(c): return sum(km(c[i], c[i + 1]) for i in range(len(c) - 1))
r5 = lambda v: round(v, 5)
def carga(carpeta, n): return json.load(open(carpeta + n, encoding='utf-8'))
def guarda(n, d): open(DEST + n, 'w', encoding='utf-8').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')

rutas = carga(BASE, 'rutas.geojson'); R = {f['id']: f for f in rutas['features']}
base = R['rio-grande']['geometry']['coordinates']  # cabecera (SO) → desembocadura (NE)
acum = [0.0]
for i in range(len(base) - 1): acum.append(acum[-1] + km(base[i], base[i + 1]))
L = acum[-1]
def en(s):
    for i in range(len(base) - 1):
        if acum[i] <= s <= acum[i + 1]:
            t = (s - acum[i]) / max(acum[i + 1] - acum[i], 1e-9)
            return [base[i][0] + (base[i + 1][0] - base[i][0]) * t, base[i][1] + (base[i + 1][1] - base[i][1]) * t], i
    return base[-1], len(base) - 2

random.seed(SEMILLA)
fase = random.random() * 6.28
nuevo = []; s = 0.0
while s <= L:
    p, i = en(s)
    dx = (base[i + 1][0] - base[i][0]) * KM_LON; dy = (base[i + 1][1] - base[i][1]) * KM_LAT
    n = math.hypot(dx, dy) or 1; nx, ny = -dy / n, dx / n
    amp = 3.0 + 5.0 * (s / L) ** 1.2                     # 3 km en las colinas → 8 km en la llanura baja
    borde = min(1.0, s / 25.0, (L - s) / 20.0)          # se apaga en los extremos
    lam = 52.0 + 8.0 * math.sin(s / 90.0)                # longitud de onda 44-60 km
    onda = math.sin(2 * math.pi * s / lam + fase)
    onda = math.copysign(abs(onda) ** 0.85, onda)        # lóbulos algo más anchos que un seno
    off = amp * borde * onda
    nuevo.append([r5(p[0] + nx * off / KM_LON), r5(p[1] + ny * off / KM_LAT)])
    s += 1.5
nuevo.append([r5(base[-1][0]), r5(base[-1][1])])
R['rio-grande']['geometry']['coordinates'] = nuevo
print('río grande: %.0f km (base %.0f); sinuosidad %.2f' % (largo(nuevo), L, largo(nuevo) / km(nuevo[0], nuevo[-1])))

def mas_cercano(pt, linea): return min(linea, key=lambda q: km(q, pt))
def ajustar(pt, max_km=6.0):
    q = mas_cercano(pt, nuevo); return [r5(q[0]), r5(q[1])] if km(q, pt) <= max_km else pt

# ── Arranque compacto junto a la desembocadura ──
desemb = nuevo[-1]
def punto_a(dist):
    acc = 0.0
    for i in range(len(nuevo) - 1, 0, -1):
        d = km(nuevo[i], nuevo[i - 1])
        if acc + d >= dist:
            t = (dist - acc) / d; return [nuevo[i][0] + (nuevo[i - 1][0] - nuevo[i][0]) * t, nuevo[i][1] + (nuevo[i - 1][1] - nuevo[i][1]) * t]
        acc += d
salida_tuneles = punto_a(5.0); barco = punto_a(8.5)
poblado = [r5(desemb[0] + 0.045), r5(desemb[1] - 0.045)]
palafito = [r5(poblado[0] + 0.012), r5(poblado[1] - 0.028)]
entre = [(poblado[0] + palafito[0]) / 2, (poblado[1] + palafito[1]) / 2]
a = carga(BASE, 'asentamientos.geojson'); A = {f['id']: f for f in a['features']}
A['poblado']['geometry']['coordinates'] = poblado
A['palafito']['geometry']['coordinates'] = palafito
R['cano-del-poblado']['geometry']['coordinates'] = [palafito, [r5(entre[0]), r5(entre[1])], poblado, [r5((poblado[0] + desemb[0]) / 2), r5((poblado[1] + desemb[1]) / 2)], [r5(desemb[0]), r5(desemb[1])]]
R['tuneles-naturales']['geometry']['coordinates'] = [[r5(entre[0]), r5(entre[1])], [r5(entre[0] - 0.015), r5(entre[1] - 0.012)], [r5((entre[0] + salida_tuneles[0]) / 2 - 0.01), r5((entre[1] + salida_tuneles[1]) / 2)], [r5(salida_tuneles[0]), r5(salida_tuneles[1])]]
l = carga(BASE, 'localizaciones.geojson'); Lc = {f['id']: f for f in l['features']}
Lc['peces-muertos']['geometry']['coordinates'] = [r5(salida_tuneles[0] - 0.008), r5(salida_tuneles[1] - 0.006)]
Lc['barco']['geometry']['coordinates'] = [r5(barco[0]), r5(barco[1])]
Lc['humo-horizonte']['properties']['camara'] = {"lon": r5(palafito[0] + 0.02), "lat": r5(palafito[1] + 0.01), "alt": 900, "heading": 166, "pitch": -5}

# ── Encajar en el río lo que vive en su orilla ──
for fid in ('comunidad', 'ciudad'): A[fid]['geometry']['coordinates'] = ajustar(A[fid]['geometry']['coordinates'])
cx, cy = A['ciudad']['geometry']['coordinates']
for fid, (dx, dy) in {'hanan': (-0.055, -0.045), 'chaupin': (0.015, -0.012), 'urin': (0.062, 0.038)}.items():
    A[fid]['geometry']['coordinates'] = [r5(cx + dx), r5(cy + dy)]
Lc['sitio-ritual']['geometry']['coordinates'] = ajustar(Lc['sitio-ritual']['geometry']['coordinates'])
dv = R['desvio-rapidos']['geometry']['coordinates']; dv[0] = ajustar(dv[0]); dv[-1] = ajustar(dv[-1])
boca = ajustar([-75.50, -5.35])
R['cano-tres-gargantas']['geometry']['coordinates'] = [boca, [r5(boca[0] + 0.01), r5(boca[1] - 0.07)], [r5(boca[0] - 0.015), r5(boca[1] - 0.14)], [r5(boca[0]), r5(boca[1] - 0.19)]]
acc = carga(BASE, 'accidentes.geojson')
for f in acc['features']:
    if f['id'] == 'tres-gargantas': f['geometry']['coordinates'] = [r5(boca[0]), r5(boca[1] - 0.20)]
    if f['id'] == 'colinas':
        ccx, ccy = boca[0], boca[1] - 0.43
        f['geometry']['coordinates'] = [[[r5(ccx + dx), r5(ccy + dy)] for dx, dy in [(-0.32, 0.21), (-0.05, 0.24), (0.22, 0.14), (0.32, -0.12), (0.15, -0.36), (-0.22, -0.40), (-0.45, -0.16), (-0.40, 0.06), (-0.32, 0.21)]]]
for ap in R['rio-grande']['properties']['apariciones']:
    if ap.get('posicion'):
        q = mas_cercano(ap['posicion'], nuevo); ap['posicion'] = [r5(q[0]), r5(q[1])]
guarda('rutas.geojson', rutas); guarda('asentamientos.geojson', a); guarda('localizaciones.geojson', l); guarda('accidentes.geojson', acc)

# ── Hidrografía sin nombre sobre el río nuevo ──
def elipse(cx, cy, rx, ry, rot=0.0, n=18):
    out = []
    for k in range(n):
        t = 2 * math.pi * k / n; x = rx * math.cos(t); y = ry * math.sin(t)
        out.append([r5(cx + x * math.cos(rot) - y * math.sin(rot)), r5(cy + x * math.sin(rot) + y * math.cos(rot))])
    return out + [out[0]]
def banda(linea, ancho):
    izq = []; der = []
    for i, (x, y) in enumerate(linea):
        x0, y0 = linea[max(i - 1, 0)]; x1, y1 = linea[min(i + 1, len(linea) - 1)]
        dx, dy = (x1 - x0) * KM_LON, (y1 - y0) * KM_LAT; n = math.hypot(dx, dy) or 1; nx, ny = -dy / n, dx / n
        izq.append([r5(x + nx * ancho / KM_LON), r5(y + ny * ancho / KM_LAT)]); der.append([r5(x - nx * ancho / KM_LON), r5(y - ny * ancho / KM_LAT)])
    return izq + der[::-1] + [izq[0]]
hid = {"type": "FeatureCollection", "_esquema": "ver README.md", "features": []}
HIDRO_NOMBRES = {  # es -> {es, en, eu}: las tres lenguas del mapa
    "Una cocha: meandro abandonado, agua negra": {"es": "Una cocha: meandro abandonado, agua negra", "en": "A cocha: an abandoned meander, black water", "eu": "Cocha bat: meandro abandonatua, ur beltza"},
    "Una isla del río grande": {"es": "Una isla del río grande", "en": "An island in the big river", "eu": "Ibai handiko uharte bat"},
    "Una playa de arena que la creciente cubre": {"es": "Una playa de arena que la creciente cubre", "en": "A sandbank the flood covers", "eu": "Uholdeak estaltzen duen hondartza bat"},
    "Bosque inundado: en creciente el río grande se sale al monte": {"es": "Bosque inundado: en creciente el río grande se sale al monte", "en": "Flooded forest: in the flood season the big river spills into the woods", "eu": "Baso urpetua: uholdean ibai handia basora ateratzen da"},
    "Bosque inundado del tramo alto": {"es": "Bosque inundado del tramo alto", "en": "Flooded forest of the upper stretch", "eu": "Goiko tarteko baso urpetua"},
    "La orilla inundada del gran río del norte": {"es": "La orilla inundada del gran río del norte", "en": "The flooded bank of the great river of the north", "eu": "Iparraldeko ibai handiaren ertz urpetua"},
}

def h(id_, coords, subtipo, estacion, desc):
    hid['features'].append({"type": "Feature", "id": id_, "geometry": {"type": "Polygon", "coordinates": [coords]},
        "properties": {"tipo": "hidrografia", "subtipo": subtipo, "faccion": "ninguna", "nombre": {**HIDRO_NOMBRES[desc], "qu": None}, "lengua": "es", "etiqueta": False,
            "estacion": estacion, "descripcion": HIDRO_NOMBRES[desc], "apariciones": [], "notas": "Placeholder sin nombre: textura del río, generada sobre el trazado (scripts/meandros.py).", "fuente": "Igor (2026-09-09): «desarrolla más el mapa del río»", "placeholder": True}})
random.seed(SEMILLA + 4)
n = len(nuevo); ci = 0
# cochas: en el lado exterior de los meandros, a 3-5 km del cauce; una cada ~35 km
for k in range(24, n - 16, 24):
    p = nuevo[k]; q = nuevo[k + 2]; dx, dy = (q[0] - p[0]) * KM_LON, (q[1] - p[1]) * KM_LAT; m = math.hypot(dx, dy) or 1
    lado = 1 if ci % 2 == 0 else -1; d = 3.5 + random.random() * 1.5
    cx2 = p[0] + (-dy / m) * lado * d / KM_LON; cy2 = p[1] + (dx / m) * lado * d / KM_LAT
    ci += 1; h(f"cocha-{ci}", elipse(cx2, cy2, 0.028 + random.random() * 0.02, 0.012 + random.random() * 0.008, rot=math.atan2(dy, dx)), "cocha", "ambas", "Una cocha: meandro abandonado, agua negra")
ii = 0
for k in range(n - 40, n - 6, 10):
    p = nuevo[k]; q = nuevo[k + 1]; ii += 1
    h(f"isla-{ii}", elipse(p[0], p[1], 0.02, 0.005, rot=math.atan2((q[1] - p[1]) * KM_LAT, (q[0] - p[0]) * KM_LON)), "isla", "vaciante", "Una isla del río grande")
pi = 0
for k in range(50, n - 44, 40):
    p = nuevo[k]; q = nuevo[k + 1]; pi += 1
    h(f"playa-{pi}", elipse(p[0], p[1], 0.014, 0.004, rot=math.atan2((q[1] - p[1]) * KM_LAT, (q[0] - p[0]) * KM_LON)), "playa", "vaciante", "Una playa de arena que la creciente cubre")
h("tahuampa-baja", banda(nuevo[n // 2:], 7.0), "tahuampa", "creciente", "Bosque inundado: en creciente el río grande se sale al monte")
h("tahuampa-alta", banda(nuevo[12:n // 2 + 1], 4.5), "tahuampa", "creciente", "Bosque inundado del tramo alto")
imp = carga(BASE, 'imperio.geojson'); fr = [f for f in imp['features'] if f['id'] == 'gran-rio-norte'][0]['geometry']['coordinates']
h("tahuampa-frontera", banda(fr, 8.0), "tahuampa", "creciente", "La orilla inundada del gran río del norte")
guarda('hidrografia.geojson', hid)

# ── Medidas ──
def idx(pt): return min(range(len(nuevo)), key=lambda k: km(nuevo[k], pt))
def tramo(p1, p2):
    i1, i2 = sorted([idx(p1), idx(p2)]); return largo(nuevo[i1:i2 + 1])
P = lambda f: f['geometry']['coordinates']
etapas = [('palafito → túneles → peces muertos', largo(R['cano-del-poblado']['geometry']['coordinates'][:2]) + largo(R['tuneles-naturales']['geometry']['coordinates'])),
    ('peces muertos → barco', tramo(P(Lc['peces-muertos']), P(Lc['barco']))), ('barco → cruce del desvío', tramo(P(Lc['barco']), dv[0])), ('desvío (brazo)', largo(dv)),
    ('cruce → boca del caño de las Gargantas', tramo(dv[0], boca)), ('caño de las Gargantas ida y vuelta', 2 * largo(R['cano-tres-gargantas']['geometry']['coordinates'])),
    ('boca → comunidad', tramo(boca, P(A['comunidad']))), ('comunidad → ciudad', tramo(P(A['comunidad']), P(A['ciudad'])))]
tot = 0
for nm, d in etapas: tot += d; print('%-44s %5.0f km' % (nm, d))
print('%-44s %5.0f km' % ('TOTAL palafito → ciudad', tot))
print('%-44s %5.0f km' % ('vuelta ciudad → palafito (río abajo)', tramo(P(A['ciudad']), P(Lc['peces-muertos'])) + largo(R['tuneles-naturales']['geometry']['coordinates'])))
