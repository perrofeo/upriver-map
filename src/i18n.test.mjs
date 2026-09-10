import { test } from 'node:test';
import assert from 'node:assert/strict';
import { t, texto, idioma } from './i18n.js';

test('sin window, el idioma es castellano y t() interpola', () => {
  assert.equal(idioma, 'es');
  assert.equal(t('quipu.veces', { n: 10 }), '10 veces más rápido');
  assert.equal(t('clave.que.no.existe'), 'clave.que.no.existe');
});

test('texto() acepta cadena u objeto por lengua con castellano de respaldo', () => {
  assert.equal(texto('hola'), 'hola');
  assert.equal(texto({ es: 'hola', en: 'hello' }, 'en'), 'hello');
  assert.equal(texto({ es: 'hola' }, 'eu'), 'hola');
  assert.equal(texto({ en: 'hello' }, 'eu'), 'hello');
  assert.equal(texto(null), '');
});
