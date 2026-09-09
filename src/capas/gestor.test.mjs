import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GestorCapas } from './gestor.js';

function capaFalsa(id) {
  const eventos = [];
  return {
    modulo: {
      id,
      nombre: id,
      icono: '·',
      init() { eventos.push('init'); },
      enable() { eventos.push('enable'); },
      disable() { eventos.push('disable'); },
      getParams() { return { x: 1 }; },
      setParams(p) { eventos.push(`params:${JSON.stringify(p)}`); },
    },
    eventos,
  };
}

test('registra, inicializa una vez y alterna', async () => {
  const g = new GestorCapas({});
  const { modulo, eventos } = capaFalsa('rio');
  g.register(modulo);
  assert.deepEqual(g.getAll(), [{ id: 'rio', name: 'rio', icon: '·', enabled: false }]);
  assert.equal(await g.setEnabled('rio', true), true);
  assert.equal(await g.setEnabled('rio', true), true);
  assert.equal(await g.setEnabled('rio', false), true);
  assert.equal(await g.setEnabled('rio', true), true);
  assert.deepEqual(eventos, ['init', 'enable', 'disable', 'enable']);
  assert.deepEqual(g.getEnabledIds(), ['rio']);
});

test('ids desconocidos devuelven undefined y los params pasan por la fachada', async () => {
  const g = new GestorCapas({});
  const { modulo, eventos } = capaFalsa('a');
  g.register(modulo);
  assert.equal(await g.setEnabled('nadie', true), undefined);
  assert.deepEqual(g.getLayerParams('a'), { x: 1 });
  assert.equal(g.getLayerParams('nadie'), null);
  g.setLayerParams('a', { y: 2 });
  assert.ok(eventos.includes('params:{"y":2}'));
  assert.throws(() => g.register({ id: 'Mal Id', nombre: 'x' }), TypeError);
});
