import { test } from 'node:test';
import assert from 'node:assert/strict';
// Solo las funciones puras: crearCapaFiccion importa cesium.
import { nombreMostrado, visibleEnEstacion } from './ficcion.js';

test('nombreMostrado sigue la lengua declarada', () => {
  assert.deepEqual(nombreMostrado({ nombre: { es: 'La ciudad', qu: 'Chimor Yaku' }, lengua: 'qu' }),
    { principal: 'Chimor Yaku', secundario: 'La ciudad' });
  assert.deepEqual(nombreMostrado({ nombre: { es: 'El palafito', qu: null }, lengua: 'es' }),
    { principal: 'El palafito', secundario: null });
});

test('visibleEnEstacion', () => {
  assert.ok(visibleEnEstacion({ estacion: 'ambas' }, 'creciente'));
  assert.ok(visibleEnEstacion({}, 'creciente'));
  assert.ok(!visibleEnEstacion({ estacion: 'vaciante' }, 'creciente'));
  assert.ok(visibleEnEstacion({ estacion: 'vaciante' }, 'vaciante'));
});
