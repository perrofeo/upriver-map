/**
 * telemetria.js — lo que el mapa le cuenta a la web que lo embebe.
 *
 * El mapa NO carga ningún script de analítica: sigue siendo un build sin
 * claves y sin terceros. Lo único que hace es emitir un `postMessage` al
 * documento padre cuando el visitante toca algo, y es la web
 * (therenderedchannel.com, que sí tiene GA4) la que decide si eso se mide y
 * cómo. Fuera del iframe —el mapa abierto a pelo— no se emite nada, porque no
 * hay nadie escuchando.
 *
 * Se manda el gesto, nunca al visitante: qué capa, qué estación, qué lugar.
 * Sin identificadores, sin cámara, sin URL.
 *
 * `targetOrigin` NUNCA es '*': se deduce del referrer —que en un iframe es la
 * página que nos mete— y se contrasta con la lista de abajo. Si el mapa lo
 * embebe cualquier otro sitio, el mensaje no sale.
 */

/** Orígenes a los que se les habla. El resto no recibe nada. */
export const ORIGENES = Object.freeze(['https://therenderedchannel.com']);

/** La marca del sobre: el oyente descarta todo mensaje que no la traiga. */
export const FUENTE = 'upriver-mapa';

/**
 * Vocabulario cerrado. El oyente de la web tiene esta misma lista y descarta
 * lo que no esté en ella, así que un nombre nuevo hay que darlo de alta en los
 * dos sitios. Es a propósito: impide que el mapa inunde GA4 con eventos
 * inventados el día que alguien añada un botón.
 */
export const EVENTOS = Object.freeze([
  'mapa_listo',       // el globo terminó de montarse: { ms }
  'mapa_vista',       // botones de vista:              { vista: imperio|rio }
  'mapa_capa',        // interruptor de capa:           { capa, estado: on|off }
  'mapa_estacion',    // deslizador de estación:        { estacion }
  'mapa_estilo',      // mirada:                        { estilo }
  'mapa_lugar',       // ficha abierta a mano:          { lugar }
  'mapa_recorrido',   // quipu:                         { accion: play|pausa }
  'mapa_episodio',    // el recorrido entra en un ep:   { episodio }
  'mapa_ver_episodio',// clic a YouTube:                { episodio, desde }
  'mapa_enlace',      // copiar enlace:                 { resultado }
]);

/**
 * Tope por carga de página. El deslizador de estación y el quipu pueden
 * disparar cientos de veces; el rebote de cada sitio de llamada es la primera
 * defensa y esto es la segunda. Pasado el tope el mapa se calla: una sesión
 * que ha dado 120 señales ya ha dicho todo lo que tenía que decir.
 */
export const TOPE = 120;

/**
 * Origen del padre, o null si no se le habla.
 * Acepta localhost con cualquier puerto para el `npm run dev` de la web.
 */
export function origenPermitido(referrer) {
  if (!referrer) return null;
  let origen;
  try { origen = new URL(referrer).origin; } catch { return null; }
  if (ORIGENES.includes(origen)) return origen;
  if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origen)) return origen;
  return null;
}

/**
 * Todo valor sale como cadena corta: GA4 no acepta otra cosa y así ningún
 * objeto del mapa se cuela entero por el mensaje. Máximo ocho campos.
 */
export function saneaDatos(datos) {
  const salida = {};
  if (!datos || typeof datos !== 'object') return salida;
  for (const [clave, valor] of Object.entries(datos)) {
    if (Object.keys(salida).length >= 8) break;
    if (valor === null || valor === undefined) continue;
    if (typeof valor === 'object') continue;
    if (!/^[a-z][a-z0-9_]{0,23}$/.test(clave)) continue;
    salida[clave] = String(valor).slice(0, 60);
  }
  return salida;
}

/**
 * Crea el emisor. Se inyecta todo para poder probarlo sin navegador.
 *
 * @param {object} o
 * @param {Window} o.ventana        la ventana del mapa
 * @param {Window} [o.padre]        `window.parent`
 * @param {string} [o.referrer]     `document.referrer`
 * @param {number} [o.tope]
 */
export function crearTelemetria({ ventana, padre = null, referrer = '', tope = TOPE } = {}) {
  // Sin padre, o siendo nosotros mismos el padre, no hay iframe: silencio.
  const enmarcado = !!padre && padre !== ventana;
  const destino = enmarcado ? origenPermitido(referrer) : null;
  let enviados = 0;
  let ultimo = '';

  function avisar(evento, datos) {
    if (!destino || enviados >= tope) return false;
    if (!EVENTOS.includes(evento)) return false;
    const limpios = saneaDatos(datos);
    // Dedupe del repetido inmediato: el deslizador rebotado sigue mandando el
    // mismo cubo dos veces seguidas cuando se mueve y vuelve.
    const huella = `${evento}:${JSON.stringify(limpios)}`;
    if (huella === ultimo) return false;
    ultimo = huella;
    enviados += 1;
    try {
      padre.postMessage({ fuente: FUENTE, evento, datos: limpios }, destino);
    } catch {
      return false;
    }
    return true;
  }

  return { avisar, get activa() { return !!destino; }, get destino() { return destino; } };
}

/**
 * Emisor del mapa. Arranca mudo y lo cablea `main.js`: los módulos importan
 * `avisar`, no la instancia, para no quedarse con el emisor mudo de antes del
 * arranque.
 */
let telemetria = { avisar: () => false, activa: false, destino: null };

export function instalarTelemetria(instancia) {
  telemetria = instancia;
  return telemetria;
}

/** Atajo para los módulos: `avisar('mapa_capa', { capa, estado })`. */
export function avisar(evento, datos) {
  return telemetria.avisar(evento, datos);
}

/**
 * Aviso con rebote, para los deslizadores: sólo sale cuando el visitante
 * suelta. Se crea en el cableado y resuelve el emisor en cada disparo.
 */
export function avisoRebotado(ms = 700) {
  let temporizador = null;
  return (evento, datos) => {
    clearTimeout(temporizador);
    temporizador = setTimeout(() => avisar(evento, datos), ms);
  };
}
