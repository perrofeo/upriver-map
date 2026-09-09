/**
 * enlace.js — enlaces compartibles (estado en el hash de la URL).
 *
 * Reescritura reducida del ShareLinkManager de gods-eye-view: conserva el
 * codec de cámara y estilo (mismos nombres de parámetro: lat, lon, alt,
 * heading, pitch, roll, style, sp, bloom, bi, sharpen, si) y añade lo que
 * es de Upriver: `t` (segundo de película), `est` (estación 0-100),
 * `sel` (entidad seleccionada) y `capas` (ids visibles).
 *
 * Formato: #v=3&lat=-4.9&lon=-74.7&alt=60000&heading=0&pitch=-45&roll=0
 *          &style=noir&sp=c.120_g.50_v.50&bloom=0&bi=0&sharpen=0&si=49
 *          &t=846&est=0&sel=tres-gargantas&capas=asentamientos.rutas
 */

import * as Cesium from 'cesium';

const VERSION = '3';
const DEBOUNCE_MS = 500;

const ESTILO_A_URL = Object.freeze({
  normal: 'normal',
  retro: 'crt',
  surveillance: 'nvg',
  thermal: 'flir',
  anime: 'anime',
  noir: 'noir',
  snow: 'snow',
});
const URL_A_ESTILO = Object.fromEntries(Object.entries(ESTILO_A_URL).map(([k, v]) => [v, k]));

/** Parámetros de cada estilo que viajan en `sp`, con su rango (copiado de gods-eye-view). */
export const REGISTRO_PARAMS_ESTILO = Object.freeze({
  retro: [
    { key: 'pixelation', token: 'p', min: 1, max: 10 },
    { key: 'distortion', token: 'd', min: 0, max: 1 },
    { key: 'instability', token: 'i', min: 0, max: 1 },
  ],
  surveillance: [
    { key: 'gain', token: 'g', min: 0, max: 1 },
    { key: 'bloom', token: 'b', min: 0, max: 1 },
    { key: 'scanlineStr', token: 's', min: 0, max: 1 },
    { key: 'pixelation', token: 'p', min: 1, max: 6 },
  ],
  thermal: [
    { key: 'sensitivity', token: 's', min: 0, max: 1 },
    { key: 'bloom', token: 'b', min: 0, max: 1 },
    { key: 'mode', token: 'm', min: 0, max: 1 },
    { key: 'pixelation', token: 'p', min: 1, max: 6 },
    { key: 'palette', token: 'a', min: 0, max: 1 },
  ],
  anime: [
    { key: 'saturation', token: 's', min: 0, max: 2 },
    { key: 'edgeThick', token: 'e', min: 0, max: 1 },
  ],
  noir: [
    { key: 'contrastAmt', token: 'c', min: 0, max: 2 },
    { key: 'grainAmt', token: 'g', min: 0, max: 1 },
    { key: 'vignetteAmt', token: 'v', min: 0, max: 1 },
  ],
  snow: [
    { key: 'density', token: 'd', min: 0, max: 1 },
    { key: 'wind', token: 'w', min: 0, max: 1 },
  ],
});

/** Codifica los parámetros del estilo activo en `sp`. */
export function codificarParamsEstilo(params, styleName, values) {
  const registro = REGISTRO_PARAMS_ESTILO[styleName];
  if (!registro || !values || typeof values !== 'object') {
    params.delete('sp');
    return;
  }
  const partes = [];
  for (const spec of registro) {
    const n = Number(values[spec.key]);
    if (!Number.isFinite(n)) continue;
    partes.push(`${spec.token}.${Math.round(Math.max(spec.min, Math.min(spec.max, n)) * 100)}`);
  }
  if (partes.length) params.set('sp', partes.join('_'));
  else params.delete('sp');
}

/** Decodifica `sp` para un estilo. */
export function decodificarParamsEstilo(params, styleName) {
  if (!params.has('sp')) return null;
  const registro = REGISTRO_PARAMS_ESTILO[styleName];
  if (!registro) return null;
  const porToken = new Map(registro.map((spec) => [spec.token, spec]));
  const out = {};
  for (const parte of String(params.get('sp') || '').split('_')) {
    const [token, raw, ...extra] = parte.split('.');
    if (extra.length || !/^-?\d+$/.test(raw || '')) continue;
    const spec = porToken.get(token);
    if (!spec) continue;
    out[spec.key] = Math.max(spec.min, Math.min(spec.max, Number(raw) / 100));
  }
  return Object.keys(out).length ? out : null;
}

const numOr = (value, fallback) => {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : fallback;
};

/** Lee un hash y devuelve el estado que describe, o null si no hay nada útil. */
export function leerHash(hash) {
  const raw = String(hash || '').replace(/^#/, '');
  if (!raw) return null;
  const params = new URLSearchParams(raw);
  const lat = parseFloat(params.get('lat'));
  const lon = parseFloat(params.get('lon'));
  const style = URL_A_ESTILO[params.get('style')] || 'normal';
  const estado = {
    camera: Number.isFinite(lat) && Number.isFinite(lon)
      ? {
        lat,
        lon,
        alt: numOr(params.get('alt'), 60000),
        heading: numOr(params.get('heading'), 0),
        pitch: numOr(params.get('pitch'), -45),
        roll: numOr(params.get('roll'), 0),
      }
      : null,
    style,
    styleParams: decodificarParamsEstilo(params, style),
    bloom: { enabled: params.get('bloom') === '1', intensity: numOr(params.get('bi'), 0) },
    sharpen: { enabled: params.get('sharpen') === '1', intensity: numOr(params.get('si'), 49) },
    t: params.has('t') ? Math.max(0, numOr(params.get('t'), 0)) : null,
    estacion: params.has('est') ? Math.max(0, Math.min(1, numOr(params.get('est'), 0) / 100)) : null,
    seleccion: params.get('sel') || null,
    capas: params.has('capas') ? params.get('capas').split('.').filter(Boolean) : null,
  };
  return estado;
}

export class GestorEnlace {
  /**
   * @param {Cesium.Viewer} viewer
   * @param {{ obtenerEstado: () => object }} opciones
   *   obtenerEstado devuelve { style, styleParams, bloom, sharpen, t, estacion, seleccion, capas }
   */
  constructor(viewer, { obtenerEstado }) {
    this.viewer = viewer;
    this._obtenerEstado = obtenerEstado;
    this._timer = null;
    this._pausado = true; // hasta que termine la restauración inicial
    this._quitarListener = viewer.camera.changed.addEventListener(() => this.programar());
  }

  leerHashInicial() {
    return leerHash(window.location.hash);
  }

  /** Vuela a la cámara de un estado; resuelve al terminar o cancelarse. */
  aplicarCamara(camara, { duracion = 2.5 } = {}) {
    if (!camara) return Promise.resolve('skipped');
    const vista = {
      destination: Cesium.Cartesian3.fromDegrees(camara.lon, camara.lat, camara.alt),
      orientation: {
        heading: Cesium.Math.toRadians(camara.heading),
        pitch: Cesium.Math.toRadians(camara.pitch),
        roll: Cesium.Math.toRadians(camara.roll),
      },
    };
    if (duracion <= 0) {
      this.viewer.camera.setView(vista);
      return Promise.resolve('applied');
    }
    return new Promise((resolve) => {
      this.viewer.camera.flyTo({
        ...vista,
        duration: duracion,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
        complete: () => resolve('applied'),
        cancel: () => resolve('cancelled'),
      });
    });
  }

  /** A partir de aquí el hash se mantiene al día. */
  activar() {
    this._pausado = false;
    this.programar();
  }

  programar() {
    if (this._pausado) return;
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this._escribir(), DEBOUNCE_MS);
  }

  construirParams() {
    const carto = this.viewer.camera.positionCartographic;
    if (!carto) return null;
    const cam = this.viewer.camera;
    const estado = this._obtenerEstado?.() || {};
    const params = new URLSearchParams();
    params.set('v', VERSION);
    params.set('lat', Cesium.Math.toDegrees(carto.latitude).toFixed(4));
    params.set('lon', Cesium.Math.toDegrees(carto.longitude).toFixed(4));
    params.set('alt', Math.round(carto.height).toString());
    params.set('heading', Math.round(Cesium.Math.toDegrees(cam.heading)).toString());
    params.set('pitch', Math.round(Cesium.Math.toDegrees(cam.pitch)).toString());
    params.set('roll', Math.round(Cesium.Math.toDegrees(cam.roll)).toString());
    const style = estado.style || 'normal';
    params.set('style', ESTILO_A_URL[style] || 'normal');
    codificarParamsEstilo(params, style, estado.styleParams?.[style]);
    params.set('bloom', estado.bloom?.enabled ? '1' : '0');
    params.set('bi', Math.round(estado.bloom?.intensity || 0).toString());
    params.set('sharpen', estado.sharpen?.enabled ? '1' : '0');
    params.set('si', Math.round(estado.sharpen?.intensity ?? 49).toString());
    if (Number.isFinite(estado.t)) params.set('t', Math.round(estado.t).toString());
    if (Number.isFinite(estado.estacion)) params.set('est', Math.round(estado.estacion * 100).toString());
    if (estado.seleccion) params.set('sel', estado.seleccion);
    if (Array.isArray(estado.capas) && estado.capas.length) params.set('capas', estado.capas.join('.'));
    return params;
  }

  _escribir() {
    if (this._pausado) return;
    const params = this.construirParams();
    if (!params) return;
    history.replaceState(null, '', `#${params.toString()}`);
  }

  /** Copia la URL actual al portapapeles. */
  async copiar() {
    const params = this.construirParams();
    if (!params) return false;
    const url = new URL(window.location.href);
    url.hash = params.toString();
    try {
      await navigator.clipboard.writeText(url.href);
      return true;
    } catch {
      return false;
    }
  }

  destroy() {
    clearTimeout(this._timer);
    this._quitarListener?.();
  }
}
