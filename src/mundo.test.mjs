import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MUNDO,
  aspectoEsperado,
  coordenadaAPixel,
  dentroDelMundo,
  dimensionesNivel,
  nivelMaximo,
  pixelACoordenada,
  vistaVertical,
} from './mundo.js';

test('el bbox es 2:1 y la rejilla del nivel 0 lo respeta', () => {
  assert.equal(aspectoEsperado(), 2);
  assert.equal(MUNDO.teselasNivel0.x / MUNDO.teselasNivel0.y, 2);
});

test('píxel ↔ coordenada es invertible y ancla las esquinas', () => {
  const w = 4096;
  const h = 2048;
  assert.deepEqual(pixelACoordenada(0, 0, w, h), { lon: MUNDO.oeste, lat: MUNDO.norte });
  assert.deepEqual(pixelACoordenada(w, h, w, h), { lon: MUNDO.este, lat: MUNDO.sur });
  const { px, py } = coordenadaAPixel(-74.7, -4.9, w, h);
  const vuelta = pixelACoordenada(px, py, w, h);
  assert.ok(Math.abs(vuelta.lon + 74.7) < 1e-9);
  assert.ok(Math.abs(vuelta.lat + 4.9) < 1e-9);
});

test('nivel máximo cubre la resolución de la imagen', () => {
  assert.equal(nivelMaximo(512), 0);
  assert.equal(nivelMaximo(4096), 3);
  assert.equal(nivelMaximo(8192), 4);
  assert.equal(nivelMaximo(5000), 4);
  assert.deepEqual(dimensionesNivel(3), { nx: 16, ny: 8, anchoPx: 4096, altoPx: 2048 });
});

test('dentroDelMundo', () => {
  assert.ok(dentroDelMundo(-74.7, -4.9));
  assert.ok(!dentroDelMundo(-70, -4.9));
});

test('la vista vertical mete el mundo entero en el hueco libre del móvil', () => {
  const fov = Math.PI / 3; // el de Cesium por defecto
  const pantalla = { anchoPx: 390, altoPx: 844, fov, reservaArriba: 56, reservaAbajo: 150, margen: 1 };
  const v = vistaVertical(pantalla);
  const latMedia = ((MUNDO.norte + MUNDO.sur) / 2) * (Math.PI / 180);
  const largo = (MUNDO.este - MUNDO.oeste) * 111_320 * Math.cos(latMedia);
  const corto = (MUNDO.norte - MUNDO.sur) * 110_574;
  const metrosPorPx = (2 * v.altura * Math.tan(fov / 2)) / 844;
  // El largo (este-oeste) cabe entre la cabecera y la línea de tiempo; el corto, de lado a lado.
  assert.ok(largo / metrosPorPx <= 844 - 56 - 150 + 1e-6);
  assert.ok(corto / metrosPorPx <= 390 + 1e-6);
  // Y una de las dos medidas es la que manda: justo, sin sobrar.
  assert.ok(Math.abs(largo / metrosPorPx - (844 - 56 - 150)) < 1e-6 || Math.abs(corto / metrosPorPx - 390) < 1e-6);
  assert.equal(v.rumbo, 270);
  // Hay más interfaz abajo que arriba: la cámara se va al este para que el mundo suba.
  assert.ok(v.lon > (MUNDO.oeste + MUNDO.este) / 2);
  assert.equal(v.lat, (MUNDO.norte + MUNDO.sur) / 2);
});

test('sin interfaz, la vista vertical se centra en el mundo', () => {
  const v = vistaVertical({ anchoPx: 768, altoPx: 1024, fov: Math.PI / 3 });
  assert.equal(v.lon, (MUNDO.oeste + MUNDO.este) / 2);
});
