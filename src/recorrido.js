/**
 * recorrido.js — el minutaje como columna vertebral de la navegación.
 *
 * Funciones puras (sin Cesium ni DOM, testeables en Node) que convierten las
 * apariciones de las entidades y la tabla de episodios en un recorrido
 * ordenado de paradas, y calculan la pose de cámara en cualquier segundo `t`
 * de la película: quieta sobre la parada vigente, o interpolando hacia la
 * siguiente. Con esto el arrastre de la línea de tiempo es instantáneo y la
 * reproducción, determinista (misma t → misma pose).
 */

import { MUNDO } from './mundo.js';

/** Duración por defecto del vuelo entre dos paradas contiguas sin hueco (s). */
export const TRANSICION_S = 6;

/** Poses por defecto según el tipo de entidad (alt en metros, ángulos en grados). La cámara mira río arriba. */
const RUMBO = MUNDO.rumboRioArriba;
const POSE_POR_TIPO = {
  asentamiento: { alt: 14000, pitch: -44, heading: RUMBO },
  avanzada: { alt: 12000, pitch: -44, heading: RUMBO },
  accidente: { alt: 10000, pitch: -40, heading: RUMBO },
  localizacion: { alt: 12000, pitch: -44, heading: RUMBO },
  territorio: { alt: 60000, pitch: -60, heading: RUMBO },
  ruta: { alt: 60000, pitch: -60, heading: RUMBO },
};

/** mm:ss (o h:mm:ss) a partir de segundos. */
export function formatearTiempo(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  if (m >= 60) return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Episodio vigente en el segundo `t`, o null. */
export function episodioEn(episodios, t) {
  return episodios.find((e) => t >= e.desde && t < e.hasta) || (t >= episodios.at(-1)?.hasta ? episodios.at(-1) : null);
}

/**
 * Tramos [desde, hasta] de una entidad, resolviendo los que solo nombran el
 * episodio contra la tabla de episodios.
 */
export function tramosDeEntidad(feature, episodios) {
  const props = feature.properties || {};
  const out = [];
  for (const ap of props.apariciones || []) {
    const ep = episodios.find((e) => e.n === ap.episodio);
    const desde = Number.isFinite(ap.desde) ? ap.desde : ep?.desde;
    const hasta = Number.isFinite(ap.hasta) ? ap.hasta : ep?.hasta;
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) continue;
    out.push({ desde, hasta, episodio: ap.episodio, nota: ap.nota || null, camara: ap.camara !== false });
  }
  return out.sort((a, b) => a.desde - b.desde);
}

/** Posición geográfica representativa de una entidad (centroide simple). */
export function posicionDe(feature) {
  const g = feature.geometry;
  if (!g) return null;
  if (g.type === 'Point') return { lon: g.coordinates[0], lat: g.coordinates[1] };
  const puntos = g.type === 'LineString' ? g.coordinates
    : g.type === 'Polygon' ? g.coordinates[0]
      : g.type === 'MultiLineString' ? g.coordinates.flat() : [];
  if (!puntos.length) return null;
  const s = puntos.reduce((acc, [lon, lat]) => ({ lon: acc.lon + lon, lat: acc.lat + lat }), { lon: 0, lat: 0 });
  return { lon: s.lon / puntos.length, lat: s.lat / puntos.length };
}

/**
 * Pose de cámara sobre una entidad: la declarada en `properties.camara`, la
 * de `poses[id]` (capturada con el director) o la por defecto de su tipo.
 * @returns {{lon:number,lat:number,alt:number,heading:number,pitch:number,roll:number}|null}
 */
export function poseDeEntidad(feature, poses = {}) {
  const base = posicionDe(feature);
  if (!base) return null;
  const tipo = feature.properties?.tipo;
  const defecto = POSE_POR_TIPO[tipo] || POSE_POR_TIPO.localizacion;
  const capturada = poses[feature.id] || null;
  const declarada = feature.properties?.camara || null;
  const p = { ...defecto, ...(declarada || {}), ...(capturada || {}) };
  // La cámara mira al punto desde el sur-este por defecto: se desplaza hacia
  // atrás de la posición según heading y pitch para que el objetivo quede en
  // el centro del encuadre.
  const lon = Number.isFinite(p.lon) ? p.lon : base.lon;
  const lat = Number.isFinite(p.lat) ? p.lat : base.lat;
  const alt = p.alt;
  const pitchRad = (p.pitch * Math.PI) / 180;
  const headingRad = (p.heading * Math.PI) / 180;
  const retroceso = Number.isFinite(p.lon) ? 0 : alt / Math.tan(-pitchRad); // m sobre el suelo
  const mLon = 111_320 * Math.cos((lat * Math.PI) / 180);
  const mLat = 110_574;
  return {
    lon: lon - (Math.sin(headingRad) * retroceso) / mLon,
    lat: lat - (Math.cos(headingRad) * retroceso) / mLat,
    alt,
    heading: p.heading,
    pitch: p.pitch,
    roll: p.roll || 0,
  };
}

/**
 * Construye el recorrido: paradas ordenadas por `desde`, una por tramo con
 * cámara, sin las partes de otra entidad (`parte_de`).
 * @returns {Array<{id:string, desde:number, hasta:number, episodio:number, nota:string|null, feature:object}>}
 */
export function construirRecorrido(features, episodios) {
  const paradas = [];
  for (const f of features) {
    const props = f.properties || {};
    if (props.parte_de) continue;
    if (!['asentamiento', 'avanzada', 'accidente', 'localizacion'].includes(props.tipo)) continue;
    for (const tramo of tramosDeEntidad(f, episodios)) {
      if (!tramo.camara) continue;
      paradas.push({ id: f.id, feature: f, ...tramo });
    }
  }
  paradas.sort((a, b) => a.desde - b.desde || a.hasta - b.hasta);
  // Si dos paradas se solapan, la que empieza después recorta a la anterior.
  for (let i = 1; i < paradas.length; i++) {
    if (paradas[i].desde < paradas[i - 1].hasta) paradas[i - 1].hasta = paradas[i].desde;
  }
  // Paradas contiguas de la misma entidad se funden en una sola.
  const fundidas = [];
  for (const p of paradas.filter((x) => x.hasta > x.desde)) {
    const ultima = fundidas.at(-1);
    if (ultima && ultima.id === p.id && Math.abs(ultima.hasta - p.desde) < 1e-6) {
      ultima.hasta = p.hasta;
      ultima.episodios = [...(ultima.episodios || [ultima.episodio]), p.episodio];
    } else {
      fundidas.push({ ...p, episodios: [p.episodio] });
    }
  }
  return fundidas;
}

/** Índice de la parada vigente o inmediatamente anterior a `t`. */
export function indiceParada(recorrido, t) {
  let idx = -1;
  for (let i = 0; i < recorrido.length; i++) {
    if (recorrido[i].desde <= t) idx = i;
    else break;
  }
  return idx;
}

const easeCubico = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const lerp = (a, b, s) => a + (b - a) * s;
function lerpAngulo(a, b, s) {
  let d = ((b - a + 540) % 360) - 180;
  return (a + d * s + 360) % 360;
}

/** Interpola dos poses con arco de altitud proporcional a la distancia. */
export function interpolarPose(a, b, s) {
  const e = easeCubico(Math.max(0, Math.min(1, s)));
  const distDeg = Math.hypot(b.lon - a.lon, b.lat - a.lat);
  const arco = Math.min(distDeg * 111_320 * 0.35, 60_000) * Math.sin(Math.PI * e);
  return {
    lon: lerp(a.lon, b.lon, e),
    lat: lerp(a.lat, b.lat, e),
    alt: Math.exp(lerp(Math.log(a.alt), Math.log(b.alt), e)) + arco,
    heading: lerpAngulo(a.heading, b.heading, e),
    pitch: lerp(a.pitch, b.pitch, e),
    roll: lerp(a.roll || 0, b.roll || 0, e),
  };
}

/**
 * Pose de la cámara en el segundo `t` de la película.
 * - Antes de la primera parada: su pose.
 * - Dentro de una parada: quieta.
 * - Entre el fin de una parada y el inicio de la siguiente (o en los últimos
 *   TRANSICION_S segundos de una parada si no hay hueco): vuelo interpolado.
 * @returns {{pose: object, parada: object|null, siguiente: object|null, progreso: number}}
 */
export function poseEn(recorrido, t, poses = {}) {
  if (!recorrido.length) return { pose: null, parada: null, siguiente: null, progreso: 0 };
  const idx = indiceParada(recorrido, t);
  if (idx < 0) {
    const p = recorrido[0];
    return { pose: poseDeEntidad(p.feature, poses), parada: p, siguiente: null, progreso: 0 };
  }
  const actual = recorrido[idx];
  const siguiente = recorrido[idx + 1] || null;
  const poseActual = poseDeEntidad(actual.feature, poses);
  if (!siguiente) return { pose: poseActual, parada: actual, siguiente: null, progreso: 0 };
  const poseSiguiente = poseDeEntidad(siguiente.feature, poses);
  const hueco = siguiente.desde - actual.hasta;
  const inicioVuelo = hueco > 0 ? actual.hasta : Math.max(actual.desde, siguiente.desde - TRANSICION_S);
  const finVuelo = siguiente.desde;
  if (t < inicioVuelo) return { pose: poseActual, parada: actual, siguiente, progreso: 0 };
  const s = finVuelo > inicioVuelo ? (t - inicioVuelo) / (finVuelo - inicioVuelo) : 1;
  return { pose: interpolarPose(poseActual, poseSiguiente, s), parada: actual, siguiente, progreso: s };
}
