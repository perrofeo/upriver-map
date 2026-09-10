/**
 * mundo.js — definición geográfica del mundo de Upriver.
 *
 * Todo lo que sitúa una entidad en el globo sale de aquí: el bounding box del
 * mapa, la rejilla de teselas y la conversión píxel ↔ coordenada. Es un módulo
 * puro (sin Cesium) para que lo importen igual el cliente y los scripts de
 * Node que cortan las teselas.
 *
 * El mundo es inventado. La referencia real es la Reserva Nacional Pacaya
 * Samiria (Loreto, Perú), y el bbox se coloca sobre ella para que el globo
 * tenga una silueta de Tierra reconocible detrás. Fuera del bbox no hay
 * teselas: el globo pinta su color base («territorio no cartografiado»).
 *
 * Convención: el río grande baja de los Andes hacia el nordeste y desemboca
 * en el río de la frontera (el Marañón), junto al poblado de Jeshuco. «Río
 * arriba» es hacia el suroeste, hacia el corazón del imperio y la ciudad.
 */

export const MUNDO = Object.freeze({
  nombre: 'Upriver',
  /** Bounding box en grados WGS84. Relación 2:1 (4,0° × 2,0°, unos 444 × 222 km). */
  oeste: -77.5,
  este: -73.5,
  sur: -6.4,
  norte: -4.4,
  /** Rumbo (grados) de «río arriba»: hacia el suroeste. La cámara mira así por defecto. */
  rumboRioArriba: 232,
  /**
   * Rejilla del nivel 0 de la pirámide. Con 2×1 cada tesela del nivel 0 cubre
   * 1,0° × 1,0°; el nivel z tiene 2·2^z × 1·2^z teselas.
   */
  teselasNivel0: Object.freeze({ x: 2, y: 1 }),
  /** Lado de la tesela en píxeles. */
  tamanoTesela: 256,
  /** Estaciones del bosque inundable. La base es la vaciante. */
  estaciones: Object.freeze(['vaciante', 'creciente']),
  estacionBase: 'vaciante',
  /**
   * Pasos de la crecida para el deslizador: capas de teselas apiladas que se funden por tramos, para
   * que el agua CREZCA desde el cauce en vez de aparecer de golpe (Igor, 2026-09-10). Las intermedias
   * se generan en el build a partir de las dos pinturas (scripts/pintar_mapa.mjs, generarIntermedias).
   */
  pasosCrecida: Object.freeze([{ id: 'crecida_33', v: 0.33 }, { id: 'crecida_66', v: 0.66 }, { id: 'creciente', v: 1 }]),
});

/** Anchura del bbox en grados. */
export function anchoGrados(mundo = MUNDO) {
  return mundo.este - mundo.oeste;
}

/** Altura del bbox en grados. */
export function altoGrados(mundo = MUNDO) {
  return mundo.norte - mundo.sur;
}

/**
 * Metros por grado en la latitud media del mundo (esferoide aproximado).
 * Sirve para escalar distancias y para documentar cuánto mide el mapa.
 */
export function metrosPorGrado(mundo = MUNDO) {
  const latMedia = ((mundo.norte + mundo.sur) / 2) * (Math.PI / 180);
  return {
    lon: 111_320 * Math.cos(latMedia),
    lat: 110_574,
  };
}

/**
 * Convierte un píxel de la imagen del mapa (origen arriba-izquierda) en
 * coordenadas geográficas. La imagen se asume equirrectangular sobre el bbox.
 * @param {number} px columna, 0 = borde oeste
 * @param {number} py fila, 0 = borde norte
 * @param {number} anchoPx anchura de la imagen
 * @param {number} altoPx altura de la imagen
 * @returns {{lon: number, lat: number}}
 */
export function pixelACoordenada(px, py, anchoPx, altoPx, mundo = MUNDO) {
  return {
    lon: mundo.oeste + (px / anchoPx) * anchoGrados(mundo),
    lat: mundo.norte - (py / altoPx) * altoGrados(mundo),
  };
}

/**
 * Inversa de {@link pixelACoordenada}.
 * @returns {{px: number, py: number}}
 */
export function coordenadaAPixel(lon, lat, anchoPx, altoPx, mundo = MUNDO) {
  return {
    px: ((lon - mundo.oeste) / anchoGrados(mundo)) * anchoPx,
    py: ((mundo.norte - lat) / altoGrados(mundo)) * altoPx,
  };
}

/** Comprueba que una coordenada cae dentro del bbox. */
export function dentroDelMundo(lon, lat, mundo = MUNDO) {
  return lon >= mundo.oeste && lon <= mundo.este && lat >= mundo.sur && lat <= mundo.norte;
}

/**
 * Nivel máximo de la pirámide para una imagen de `anchoPx` de ancho: el
 * primer nivel cuyas teselas alcanzan o superan la resolución de la imagen.
 */
export function nivelMaximo(anchoPx, mundo = MUNDO) {
  const anchoNivel0 = mundo.tamanoTesela * mundo.teselasNivel0.x;
  return Math.max(0, Math.ceil(Math.log2(anchoPx / anchoNivel0)));
}

/** Dimensiones de la imagen y número de teselas en el nivel `z`. */
export function dimensionesNivel(z, mundo = MUNDO) {
  const nx = mundo.teselasNivel0.x * 2 ** z;
  const ny = mundo.teselasNivel0.y * 2 ** z;
  return {
    nx,
    ny,
    anchoPx: nx * mundo.tamanoTesela,
    altoPx: ny * mundo.tamanoTesela,
  };
}

/** Relación de aspecto que debe tener la imagen del mapa (ancho / alto). */
export function aspectoEsperado(mundo = MUNDO) {
  return anchoGrados(mundo) / altoGrados(mundo);
}
