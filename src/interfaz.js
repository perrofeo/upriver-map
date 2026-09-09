/**
 * interfaz.js — cableado del DOM: aspecto, estación, capas, enlace, línea de
 * tiempo, ficha y selección en el globo.
 *
 * Todo el estado vive en los gestores; este módulo solo traduce clics y
 * deslizadores.
 */

import * as Cesium from 'cesium';
import { ESTILOS, NOMBRES_ESTILO } from './estilos.js';
import { Ficha } from './ficha.js';
import { LineaTiempo } from './tiempo.js';
import { MUNDO } from './mundo.js';
import { rectanguloMundo } from './basemap.js';

function aviso(texto, ms = 1800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = texto;
  toast.hidden = false;
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => { toast.hidden = true; }, ms);
}

export function montarInterfaz({ viewer, basemap, estilos, capas, enlace, director, episodios, duracion, poses }) {
  const interfaz = {
    seleccion: null,
    get tiempo() { return lineaTiempo.t; },
    setEstacion(valor) {
      basemap.setEstacion(valor);
      capas.setEstacionActiva(basemap.estacionDominante);
      slider.value = String(Math.round(basemap.estacion * 100));
      enlace.programar();
    },
    setTiempo(t, opciones) { lineaTiempo.setTiempo(t, opciones); },
    /** Funde la estación hasta `valor` en unos segundos (la crecida del EP10). */
    setEstacionAnimada(valor, { duracion = 2500 } = {}) {
      cancelAnimationFrame(interfaz._animEstacion);
      const desde = basemap.estacion;
      const hasta = Math.max(0, Math.min(1, valor));
      if (Math.abs(hasta - desde) < 0.001) return;
      const t0 = performance.now();
      const paso = (ahora) => {
        const x = Math.min(1, (ahora - t0) / duracion);
        const e = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
        interfaz.setEstacion(desde + (hasta - desde) * e);
        if (x < 1) interfaz._animEstacion = requestAnimationFrame(paso);
      };
      interfaz._animEstacion = requestAnimationFrame(paso);
    },
    seleccionar(fid, { volar = false } = {}) {
      const hallazgo = fid ? capas.buscar(fid) : null;
      if (!hallazgo) { deseleccionar(); return false; }
      interfaz.seleccion = fid;
      capas.resaltar(fid);
      ficha.mostrar(hallazgo.feature);
      interfaz.alSeleccionar?.(fid);
      if (volar) {
        const entidad = hallazgo.capa.entidadDe(fid);
        if (entidad) viewer.flyTo(entidad, { duration: 1.6, offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 12_000) });
      }
      enlace.programar();
      return true;
    },
    sincronizar() {
      pintarEstilos();
      pintarParams();
      slider.value = String(Math.round(basemap.estacion * 100));
      bloomOn.checked = estilos.bloomEnabled;
      bloomInt.value = String(estilos.bloomIntensity);
      sharpenOn.checked = estilos.sharpenEnabled;
      sharpenInt.value = String(estilos.sharpenIntensity);
    },
    aviso,
    lineaTiempo: null,
    ficha: null,
    /** Vista del continente: el imperio entero. */
    verImperio({ duracion = 2.5 } = {}) {
      lineaTiempo?.pausar({ silencioso: true });
      const vista = { destination: Cesium.Cartesian3.fromDegrees(-69.5, -9.5, 9_500_000), orientation: { heading: 0, pitch: Cesium.Math.toRadians(-88), roll: 0 } };
      if (duracion <= 0) viewer.camera.setView(vista);
      else viewer.camera.flyTo({ ...vista, duration: duracion, easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT });
    },
    /** Vista del mundo del río entero. */
    verMundo({ duracion = 2.5 } = {}) {
      const destination = rectanguloMundo(MUNDO);
      if (duracion <= 0) viewer.camera.setView({ destination });
      else viewer.camera.flyTo({ destination, duration: duracion, easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT });
    },
  };

  function deseleccionar() {
    interfaz.seleccion = null;
    capas.resaltar(null);
    ficha.ocultar();
    enlace.programar();
    interfaz.alSeleccionar?.(null);
  }

  // ── Estación ──────────────────────────────────────────────────────────
  const slider = document.getElementById('estacion-slider');
  slider.addEventListener('input', () => interfaz.setEstacion(Number(slider.value) / 100));

  // ── Estilos ───────────────────────────────────────────────────────────
  const botones = document.getElementById('estilo-botones');
  const paramsBox = document.getElementById('estilo-params');
  const bloomOn = document.getElementById('bloom-on');
  const bloomInt = document.getElementById('bloom-int');
  const sharpenOn = document.getElementById('sharpen-on');
  const sharpenInt = document.getElementById('sharpen-int');

  function pintarEstilos() {
    botones.replaceChildren();
    for (const nombre of ['normal', ...Object.keys(ESTILOS)]) {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'estilo-btn' + (estilos.activeStyle === nombre ? ' activo' : '');
      b.dataset.estilo = nombre;
      b.textContent = NOMBRES_ESTILO[nombre] || nombre;
      b.addEventListener('click', () => { estilos.setStyle(nombre); pintarEstilos(); pintarParams(); });
      botones.append(b);
    }
  }

  function pintarParams() {
    paramsBox.replaceChildren();
    const shader = ESTILOS[estilos.activeStyle];
    if (!shader?.uniforms) return;
    const valores = estilos.getStyleParams(estilos.activeStyle) || {};
    for (const [key, meta] of Object.entries(shader.uniforms)) {
      const fila = document.createElement('label');
      fila.className = 'param-fila';
      const nombre = document.createElement('span');
      nombre.textContent = meta.label || key;
      const range = document.createElement('input');
      range.type = 'range';
      range.min = String(meta.min);
      range.max = String(meta.max);
      range.step = String((meta.max - meta.min) / 100);
      range.value = String(valores[key] ?? meta.default);
      const out = document.createElement('output');
      out.textContent = Number(range.value).toFixed(2);
      range.addEventListener('input', () => {
        estilos.setStyleParam(estilos.activeStyle, key, Number(range.value));
        out.textContent = Number(range.value).toFixed(2);
      });
      fila.append(nombre, range, out);
      paramsBox.append(fila);
    }
  }

  bloomOn.addEventListener('change', () => estilos.setBloom({ enabled: bloomOn.checked }));
  bloomInt.addEventListener('input', () => estilos.setBloom({ intensity: Number(bloomInt.value) }));
  sharpenOn.addEventListener('change', () => estilos.setSharpen({ enabled: sharpenOn.checked }));
  sharpenInt.addEventListener('input', () => estilos.setSharpen({ intensity: Number(sharpenInt.value) }));

  // Atajos: 1-7 estilos (como en gods-eye-view), espacio reproduce, Esc cierra.
  const orden = ['normal', ...Object.keys(ESTILOS)];
  document.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= orden.length) {
      estilos.setStyle(orden[n - 1]);
      pintarEstilos();
      pintarParams();
    } else if (e.key === ' ') {
      e.preventDefault();
      if (lineaTiempo.reproduciendo) lineaTiempo.pausar(); else lineaTiempo.reproducir();
    } else if (e.key === 'Escape' && !director.running) {
      deseleccionar();
    }
  });

  // ── Capas ─────────────────────────────────────────────────────────────
  capas.buildTogglePanel(document.getElementById('capas-toggles'));
  capas.onChange(() => enlace.programar());

  // ── Ficha y línea de tiempo ───────────────────────────────────────────
  const ficha = new Ficha(document.getElementById('ficha'), {
    episodios,
    irA: (t) => { lineaTiempo.pausar({ silencioso: true }); lineaTiempo.setTiempo(t); },
    alCerrar: () => { if (interfaz.seleccion) { interfaz.seleccion = null; capas.resaltar(null); enlace.programar(); } },
  });
  const lineaTiempo = new LineaTiempo({
    viewer,
    el: document.getElementById('linea-tiempo'),
    features: capas.todasLasFeatures(),
    episodios,
    duracion,
    poses,
    alCambiarParada: (parada) => {
      // Si la parada declara estación, el mundo cambia con ella: la crecida del EP10.
      if (parada?.estacion) interfaz.setEstacionAnimada(parada.estacion === 'creciente' ? 1 : 0);
      // La parada vigente abre su ficha, salvo que el usuario haya elegido otra.
      if (parada && (!interfaz.seleccion || interfaz.seleccionAutomatica)) {
        interfaz.seleccionAutomatica = true;
        interfaz.seleccion = parada.id;
        capas.resaltar(parada.id);
        ficha.mostrar(parada.feature);
      }
    },
    alCambiar: () => enlace.programar(),
  });
  interfaz.lineaTiempo = lineaTiempo;
  interfaz.ficha = ficha;
  const seleccionarManual = interfaz.seleccionar;
  interfaz.seleccionar = (fid, opciones) => { interfaz.seleccionAutomatica = false; return seleccionarManual(fid, opciones); };

  // ── Selección en el globo ─────────────────────────────────────────────
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    const entidad = picked?.id instanceof Cesium.Entity ? picked.id : null;
    const fid = entidad?.properties?.fid?.getValue?.(Cesium.JulianDate.now());
    if (fid) interfaz.seleccionar(fid);
    else if (interfaz.seleccion) { interfaz.seleccionAutomatica = false; deseleccionar(); }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // ── Vistas ────────────────────────────────────────────────────────────
  document.getElementById('btn-imperio').addEventListener('click', () => interfaz.verImperio());
  document.getElementById('btn-mundo').addEventListener('click', () => interfaz.verMundo());

  // ── Enlace ────────────────────────────────────────────────────────────
  document.getElementById('btn-compartir').addEventListener('click', async () => {
    aviso((await enlace.copiar()) ? 'Enlace copiado' : 'No se pudo copiar el enlace');
  });

  return interfaz;
}
