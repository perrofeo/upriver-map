import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EVENTOS, FUENTE, crearTelemetria, origenPermitido, saneaDatos } from './telemetria.js';

const ventana = { nombre: 'mapa' };
function padreEspia() {
  const enviados = [];
  return { enviados, postMessage: (mensaje, destino) => enviados.push({ mensaje, destino }) };
}
const REF = 'https://therenderedchannel.com/upriver/map';

test('sólo se habla a los orígenes de la lista', () => {
  assert.equal(origenPermitido(REF), 'https://therenderedchannel.com');
  assert.equal(origenPermitido('http://localhost:3000/upriver/map'), 'http://localhost:3000');
  assert.equal(origenPermitido('https://therenderedchannel.com.evil.test/'), null);
  assert.equal(origenPermitido('https://otro.com/'), null);
  assert.equal(origenPermitido(''), null);
  assert.equal(origenPermitido('no-es-una-url'), null);
});

test('fuera del iframe el emisor está mudo', () => {
  const padre = padreEspia();
  // Sin padre, y con el padre siendo uno mismo (mapa abierto a pelo).
  assert.equal(crearTelemetria({ ventana, padre: null, referrer: REF }).activa, false);
  assert.equal(crearTelemetria({ ventana, padre: ventana, referrer: REF }).activa, false);
  // Embebido por un sitio que no es la web: tampoco.
  const ajeno = crearTelemetria({ ventana, padre, referrer: 'https://ladron.test/' });
  assert.equal(ajeno.activa, false);
  assert.equal(ajeno.avisar('mapa_vista', { vista: 'rio' }), false);
  assert.equal(padre.enviados.length, 0);
});

test('el mensaje lleva la marca y va al origen concreto, nunca a *', () => {
  const padre = padreEspia();
  const tel = crearTelemetria({ ventana, padre, referrer: REF });
  assert.equal(tel.avisar('mapa_vista', { vista: 'imperio' }), true);
  const { mensaje, destino } = padre.enviados[0];
  assert.deepEqual(mensaje, { fuente: FUENTE, evento: 'mapa_vista', datos: { vista: 'imperio' } });
  assert.equal(destino, 'https://therenderedchannel.com');
});

test('vocabulario cerrado: lo que no está en EVENTOS no sale', () => {
  const padre = padreEspia();
  const tel = crearTelemetria({ ventana, padre, referrer: REF });
  assert.equal(tel.avisar('lo_que_sea', { a: '1' }), false);
  assert.equal(padre.enviados.length, 0);
  for (const evento of EVENTOS) assert.match(evento, /^mapa_[a-z_]+$/);
});

test('los datos salen como cadenas cortas y sin objetos', () => {
  assert.deepEqual(saneaDatos({ capa: 'rutas', n: 7, hondo: { a: 1 }, nada: null }), { capa: 'rutas', n: '7' });
  assert.deepEqual(saneaDatos(null), {});
  assert.deepEqual(saneaDatos({ 'Mal-Nombre': 'x' }), {});
  assert.equal(saneaDatos({ lugar: 'x'.repeat(200) }).lugar.length, 60);
  assert.equal(Object.keys(saneaDatos(Object.fromEntries(Array.from({ length: 20 }, (_, i) => [`c${i}`, i])))).length, 8);
});

test('el repetido inmediato se descarta, el alternado no', () => {
  const padre = padreEspia();
  const tel = crearTelemetria({ ventana, padre, referrer: REF });
  assert.equal(tel.avisar('mapa_estacion', { estacion: 'creciente' }), true);
  assert.equal(tel.avisar('mapa_estacion', { estacion: 'creciente' }), false);
  assert.equal(tel.avisar('mapa_estacion', { estacion: 'vaciante' }), true);
  assert.equal(tel.avisar('mapa_estacion', { estacion: 'creciente' }), true);
  assert.equal(padre.enviados.length, 3);
});

test('pasado el tope, silencio', () => {
  const padre = padreEspia();
  const tel = crearTelemetria({ ventana, padre, referrer: REF, tope: 3 });
  for (let i = 0; i < 10; i += 1) tel.avisar('mapa_lugar', { lugar: `l${i}` });
  assert.equal(padre.enviados.length, 3);
});

test('un postMessage que revienta no tumba el mapa', () => {
  const padre = { postMessage() { throw new Error('cross-origin'); } };
  const tel = crearTelemetria({ ventana, padre, referrer: REF });
  assert.equal(tel.avisar('mapa_listo', { ms: '900' }), false);
});
