/**
 * datos.test.mjs — coherencia de los datos de ficción.
 *
 * Lo que Igor pidió el 2026-09-10: que ningún lugar caiga en el agua sin
 * querer. Los anchos de cauce son los mismos que dibuja scripts/mapa_grabado.mjs
 * (en píxeles sobre 4096, pasados a km con 108 m/px).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { MUNDO } from '../../mundo.js';

const leer = (n) => JSON.parse(readFileSync(new URL(n, import.meta.url), 'utf8'));
const rutas = leer('./rutas.geojson');
const imperio = leer('./imperio.geojson');
const hidro = leer('./hidrografia.geojson');
const lugares = [
  ...leer('./asentamientos.geojson').features,
  ...imperio.features.filter((f) => f.properties.tipo === 'avanzada'),
  ...leer('./localizaciones.geojson').features,
  ...leer('./accidentes.geojson').features.filter((f) => f.geometry.type === 'Point'),
];

const KM_LON = 111.32 * Math.cos((-5.4 * Math.PI) / 180);
const KM_LAT = 110.57;
const km = (a, b) => Math.hypot((b[0] - a[0]) * KM_LON, (b[1] - a[1]) * KM_LAT);
const M_POR_PX = 0.108; // km por píxel sobre una base de 4096 px y 443 km de ancho

/** Distancia de un punto a una polilínea y fracción de recorrido donde cae. */
function cercania(pt, linea) {
  let mejor = { d: Infinity, s: 0 };
  let acum = 0;
  const total = linea.slice(1).reduce((a, q, i) => a + km(linea[i], q), 0);
  for (let i = 0; i < linea.length - 1; i++) {
    const a = linea[i], b = linea[i + 1];
    const ax = 0, ay = 0, bx = (b[0] - a[0]) * KM_LON, by = (b[1] - a[1]) * KM_LAT;
    const px = (pt[0] - a[0]) * KM_LON, py = (pt[1] - a[1]) * KM_LAT;
    const l2 = bx * bx + by * by || 1e-9;
    const t = Math.max(0, Math.min(1, ((px - ax) * bx + (py - ay) * by) / l2));
    const d = Math.hypot(px - t * bx, py - t * by);
    const seg = Math.sqrt(l2);
    if (d < mejor.d) mejor = { d, s: (acum + t * seg) / total };
    acum += seg;
  }
  return mejor;
}

/** Medio ancho del cauce en km, como lo dibuja el mapa grabado (vaciante). */
function medioAncho(rango, fraccion) {
  if (rango === 'gran-rio') return (62 * M_POR_PX) / 2;
  if (rango === 'principal') {
    const wMax = 44 * M_POR_PX, wMin = wMax * 0.32;
    return (wMin + (wMax - wMin) * Math.pow(fraccion, 0.8)) / 2;
  }
  return ({ secundario: 10, oculto: 7 }[rango] || 12) * M_POR_PX / 2;
}

function dentroDePoligono([x, y], anillo) {
  let dentro = false;
  for (let i = 0, j = anillo.length - 1; i < anillo.length; j = i++) {
    const [xi, yi] = anillo[i], [xj, yj] = anillo[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

const cauces = [
  ...rutas.features.filter((f) => f.geometry.type === 'LineString' && f.geometry.coordinates.length > 1)
    .map((f) => ({ id: f.id, rango: f.properties.rango, linea: f.geometry.coordinates })),
  ...imperio.features.filter((f) => f.properties.tipo === 'gran-rio')
    .map((f) => ({ id: f.id, rango: 'gran-rio', linea: f.geometry.coordinates })),
];

test('todos los lugares caen dentro del mundo', () => {
  for (const f of lugares) {
    const [lon, lat] = f.geometry.coordinates;
    assert.ok(lon >= MUNDO.oeste && lon <= MUNDO.este && lat >= MUNDO.sur && lat <= MUNDO.norte, `${f.id} fuera del bbox`);
  }
});

test('ningún lugar cae en el agua sin quererlo', () => {
  const enElAgua = [];
  for (const f of lugares) {
    if (f.properties.sobre_agua) continue;
    const pt = f.geometry.coordinates;
    for (const c of cauces) {
      const { d, s } = cercania(pt, c.linea);
      const medio = medioAncho(c.rango, s);
      if (d < medio) enElAgua.push(`${f.id} a ${d.toFixed(2)} km del eje de ${c.id} (medio ancho ${medio.toFixed(2)} km)`);
    }
    for (const h of hidro.features) {
      if (['cocha', 'tahuampa'].includes(h.properties.subtipo) && h.properties.estacion !== 'creciente'
        && dentroDePoligono(pt, h.geometry.coordinates[0])) enElAgua.push(`${f.id} dentro de ${h.id}`);
    }
  }
  assert.deepEqual(enElAgua, [], `lugares en el agua:\n  ${enElAgua.join('\n  ')}`);
});

test('el sitio del ritual queda en seco en la crecida', () => {
  const sitio = lugares.find((f) => f.id === 'sitio-ritual').geometry.coordinates;
  for (const h of hidro.features.filter((x) => x.properties.subtipo === 'tahuampa')) {
    assert.ok(!dentroDePoligono(sitio, h.geometry.coordinates[0]), `el sitio del ritual cae en ${h.id}`);
  }
});

test('cada aparición con cámara de una ruta lleva posición o es un caño corto', () => {
  for (const f of rutas.features) {
    for (const ap of f.properties.apariciones || []) {
      if (ap.camara === true && f.properties.rango === 'principal') assert.ok(ap.posicion, `${f.id} EP${ap.episodio} sin posicion`);
    }
  }
});
