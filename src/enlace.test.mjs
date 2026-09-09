import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codificarParamsEstilo, decodificarParamsEstilo, leerHash } from './enlace.js';

test('leerHash devuelve null sin hash y cámara null sin coordenadas', () => {
  assert.equal(leerHash(''), null);
  assert.equal(leerHash('#'), null);
  const e = leerHash('#v=3&style=noir&t=846&est=50&sel=tres-gargantas&capas=a.b');
  assert.equal(e.camera, null);
  assert.equal(e.style, 'noir');
  assert.equal(e.t, 846);
  assert.equal(e.estacion, 0.5);
  assert.equal(e.seleccion, 'tres-gargantas');
  assert.deepEqual(e.capas, ['a', 'b']);
});

test('cámara y estilo con parámetros, ida y vuelta', () => {
  const params = new URLSearchParams();
  codificarParamsEstilo(params, 'noir', { contrastAmt: 1.2, grainAmt: 0.5, vignetteAmt: 9 });
  assert.equal(params.get('sp'), 'c.120_g.50_v.100');
  const e = leerHash(`#lat=-4.9&lon=-74.7&alt=1234.6&heading=90&pitch=-30&style=noir&${params}`);
  assert.deepEqual(e.camera, { lat: -4.9, lon: -74.7, alt: 1234.6, heading: 90, pitch: -30, roll: 0 });
  assert.deepEqual(e.styleParams, { contrastAmt: 1.2, grainAmt: 0.5, vignetteAmt: 1 });
  assert.equal(decodificarParamsEstilo(new URLSearchParams('sp=zz.1'), 'noir'), null);
});

test('valores no finitos caen a los defectos', () => {
  const e = leerHash('#lat=Infinity&lon=-74.7&t=nan');
  assert.equal(e.camera, null);
  assert.equal(e.t, 0);
});
