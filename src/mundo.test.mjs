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
