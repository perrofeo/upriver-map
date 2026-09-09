import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  construirRecorrido, formatearTiempo, interpolarPose, poseDeEntidad, poseEn, tramosDeEntidad, episodioEn,
  segundoEnEpisodio, enlaceYoutube,
} from './recorrido.js';

const episodios = [
  { n: 1, inicio: 0, duracion: 100, youtubeId: 'AAA' },
  { n: 2, inicio: 100, duracion: 100, youtubeId: 'BBB' },
  { n: 3, inicio: 200, duracion: 100 },
];
const punto = (id, lon, lat, tipo, apariciones, extra = {}) => ({
  type: 'Feature', id, geometry: { type: 'Point', coordinates: [lon, lat] },
  properties: { tipo, apariciones, ...extra },
});

test('formatearTiempo', () => {
  assert.equal(formatearTiempo(0), '0:00');
  assert.equal(formatearTiempo(846.083), '14:06');
  assert.equal(formatearTiempo(2443.136), '40:43');
  assert.equal(formatearTiempo(3661), '1:01:01');
});

test('tramos: segundos de episodio → segundos de serie; el episodio entero si no hay desde/hasta', () => {
  const f = punto('a', 0, 0, 'asentamiento', [{ episodio: 2 }, { episodio: 2, desde: 10, hasta: 20, camara: false }]);
  const t = tramosDeEntidad(f, episodios).map(({ desde, hasta, dentroDesde, dentroHasta, episodio, camara }) => ({ desde, hasta, dentroDesde, dentroHasta, episodio, camara }));
  assert.deepEqual(t, [
    { desde: 100, hasta: 200, dentroDesde: 0, dentroHasta: 100, episodio: 2, camara: true },
    { desde: 110, hasta: 120, dentroDesde: 10, dentroHasta: 20, episodio: 2, camara: false },
  ]);
  assert.equal(episodioEn(episodios, 150).n, 2);
  assert.equal(episodioEn(episodios, 300).n, 3);
  assert.equal(segundoEnEpisodio(episodios, 150), 50);
  assert.equal(enlaceYoutube(episodios[1], 50.7), 'https://youtu.be/BBB?t=50');
  assert.equal(enlaceYoutube(episodios[0], 0), 'https://youtu.be/AAA');
  assert.equal(enlaceYoutube(episodios[2], 5), null);
});

test('recorrido: ordenado, sin partes ni menciones, y los solapes se recortan', () => {
  const a = punto('a', -74, -5, 'asentamiento', [{ episodio: 1 }, { episodio: 3 }]);
  const b = punto('b', -75, -4.8, 'accidente', [{ episodio: 2 }, { episodio: 1, camara: false }]);
  const c = punto('c', -75.1, -4.8, 'asentamiento', [{ episodio: 2 }], { parte_de: 'b' });
  const d = punto('d', -75.2, -4.7, 'localizacion', [{ episodio: 2, desde: 50 }]);
  const r = construirRecorrido([a, b, c, d], episodios);
  assert.deepEqual(r.map((p) => [p.id, p.desde, p.hasta]), [
    ['a', 0, 100], ['b', 100, 150], ['d', 150, 200], ['a', 200, 300],
  ]);
});

test('recorrido: una ruta solo es parada con camara:true explícito', () => {
  const rio = { type: 'Feature', id: 'rio', geometry: { type: 'LineString', coordinates: [[-74, -5], [-75, -5]] },
    properties: { tipo: 'ruta', apariciones: [{ episodio: 1 }] } };
  const tunel = { type: 'Feature', id: 'tunel', geometry: { type: 'LineString', coordinates: [[-74, -5], [-74.2, -5.1]] },
    properties: { tipo: 'ruta', apariciones: [{ episodio: 1, desde: 30, hasta: 90, camara: true }] } };
  const r = construirRecorrido([rio, tunel], episodios);
  assert.deepEqual(r.map((p) => [p.id, p.desde, p.hasta]), [['tunel', 30, 90]]);
});

test('recorrido: dos episodios seguidos en el mismo lugar son una sola parada', () => {
  const a = punto('a', -74, -5, 'accidente', [{ episodio: 1 }, { episodio: 2 }]);
  const b = punto('b', -75, -4.8, 'asentamiento', [{ episodio: 3 }]);
  const r = construirRecorrido([a, b], episodios);
  assert.deepEqual(r.map((p) => [p.id, p.desde, p.hasta, p.episodios]), [
    ['a', 0, 200, [1, 2]], ['b', 200, 300, [3]],
  ]);
});

test('poseEn: quieta dentro de la parada, interpolada en el hueco, determinista', () => {
  const a = punto('a', -74, -5, 'asentamiento', [{ episodio: 1, hasta: 80 }]);
  const b = punto('b', -75, -4.8, 'accidente', [{ episodio: 2 }]);
  const r = construirRecorrido([a, b], episodios);
  assert.deepEqual(r.map((p) => [p.desde, p.hasta]), [[0, 80], [100, 200]]);
  const pa = poseDeEntidad(a);
  const pb = poseDeEntidad(b);
  assert.deepEqual(poseEn(r, 40).pose, pa);
  assert.deepEqual(poseEn(r, -5).pose, pa);
  const mitad = poseEn(r, 90);
  assert.equal(mitad.parada.id, 'a');
  assert.equal(mitad.siguiente.id, 'b');
  assert.ok(Math.abs(mitad.progreso - 0.5) < 1e-9);
  assert.ok(mitad.pose.lon < pa.lon && mitad.pose.lon > pb.lon - 0.2);
  assert.ok(mitad.pose.alt > pa.alt, 'el vuelo hace arco');
  assert.deepEqual(poseEn(r, 90).pose, mitad.pose);
  assert.deepEqual(poseEn(r, 150).pose, pb);
  assert.deepEqual(poseEn(r, 999).pose, pb);
});

test('sin hueco, el vuelo ocupa los últimos segundos de la parada anterior', () => {
  const a = punto('a', -74, -5, 'asentamiento', [{ episodio: 1 }]);
  const b = punto('b', -75, -4.8, 'accidente', [{ episodio: 2 }]);
  const r = construirRecorrido([a, b], episodios);
  assert.equal(poseEn(r, 93).progreso, 0);
  assert.ok(poseEn(r, 97).progreso > 0 && poseEn(r, 97).progreso < 1);
});

test('poseDeEntidad retrocede la cámara según heading y pitch, y respeta overrides', () => {
  const f = punto('a', -74, -5, 'asentamiento', []);
  const p = poseDeEntidad(f);
  assert.ok(p.lon > -74 && p.lat > -5, 'mira río arriba (suroeste): la cámara queda al nordeste');
  assert.equal(p.alt, 14000);
  const capturada = poseDeEntidad(f, { a: { lon: -73.5, lat: -5.1, alt: 1500, heading: 300, pitch: -12 } });
  assert.deepEqual(capturada, { lon: -73.5, lat: -5.1, alt: 1500, heading: 300, pitch: -12, roll: 0 });
  const i = interpolarPose({ lon: 0, lat: 0, alt: 1000, heading: 350, pitch: -40, roll: 0 },
    { lon: 1, lat: 0, alt: 1000, heading: 10, pitch: -40, roll: 0 }, 0.5);
  assert.ok(Math.abs(i.heading) < 1e-9 || Math.abs(i.heading - 360) < 1e-9, 'el heading va por el arco corto');
});
