/**
 * interfaz.js — cableado del DOM: aspecto, estación, capas, enlace, línea de
 * tiempo, ficha y selección en el globo.
 *
 * Todo el estado vive en los gestores; este módulo solo traduce clics y
 * deslizadores.
 */

import * as Cesium from 'cesium';
import { ESTILOS } from './estilos.js';
import { IDIOMAS, idioma, t, urlEnIdioma } from './i18n.js';
import { Ficha } from './ficha.js';
import { LineaTiempo } from './tiempo.js';
import { MUNDO } from './mundo.js';
import { rectanguloMundo } from './basemap.js';
import { avisar, avisoRebotado } from './telemetria.js';

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
      capas.setNivelEstacion(basemap.estacion);
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
        // En móvil la ficha aparece plegada: solo el nombre, y se abre tocándolo.
      document.getElementById('ficha').classList.toggle('plegada', window.matchMedia('(max-width: 760px)').matches);
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
  // El deslizador dispara en cada píxel: a la web se le cuenta sólo dónde se
  // ha quedado, y en tres cubos, que es lo que significa algo (¿la gente mira
  // el mundo seco, el inundado, o se queda a medias?).
  const cuboEstacion = (v) => (v < 0.2 ? 'vaciante' : v > 0.8 ? 'creciente' : 'media');
  const avisarEstacion = avisoRebotado();
  const slider = document.getElementById('estacion-slider');
  slider.addEventListener('input', () => {
    interfaz.setEstacion(Number(slider.value) / 100);
    avisarEstacion('mapa_estacion', { estacion: cuboEstacion(basemap.estacion) });
  });

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
      b.textContent = t(`estilo.${nombre}`);
      b.addEventListener('click', () => {
        estilos.setStyle(nombre);
        pintarEstilos();
        pintarParams();
        avisar('mapa_estilo', { estilo: nombre });
      });
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
  capas.onChange((evento) => {
    enlace.programar();
    // Sólo el interruptor tocado a mano: el encendido del arranque y el de un
    // enlace compartido llegan con su propio `origin` y no son un gesto.
    if (evento?.type === 'visibility' && evento.origin === 'user') {
      avisar('mapa_capa', { capa: evento.id, estado: evento.enabled ? 'on' : 'off' });
    }
  });

  // ── Ficha y línea de tiempo ───────────────────────────────────────────
  const ficha = new Ficha(document.getElementById('ficha'), {
    episodios,
    modoAutor: new URLSearchParams(window.location.search).has('autor'),
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
        document.getElementById('ficha').classList.toggle('plegada', window.matchMedia('(max-width: 760px)').matches);
      }
    },
    alCambiar: () => enlace.programar(),
  });
  interfaz.lineaTiempo = lineaTiempo;
  interfaz.ficha = ficha;
  const seleccionarManual = interfaz.seleccionar;
  interfaz.seleccionar = (fid, opciones) => {
    interfaz.seleccionAutomatica = false;
    const abierta = seleccionarManual(fid, opciones);
    // La ficha que abre sola el recorrido no cuenta: aquí sólo el lugar que
    // alguien ha decidido mirar.
    if (abierta) avisar('mapa_lugar', { lugar: fid });
    return abierta;
  };

  // ── Selección en el globo ─────────────────────────────────────────────
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    const entidad = picked?.id instanceof Cesium.Entity ? picked.id : null;
    const fid = entidad?.properties?.fid?.getValue?.(Cesium.JulianDate.now());
    if (fid) interfaz.seleccionar(fid);
    else if (interfaz.seleccion) { interfaz.seleccionAutomatica = false; deseleccionar(); }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // ── Móvil: el panel plegado en un botón; la ficha plegable por el título ──
  const panelLateral = document.getElementById('panel-lateral');
  const btnPanel = document.getElementById('btn-panel');
  const abrirPanel = (abierto) => {
    panelLateral.classList.toggle('abierto', abierto);
    btnPanel.setAttribute('aria-expanded', String(abierto));
  };
  btnPanel.addEventListener('click', () => abrirPanel(!panelLateral.classList.contains('abierto')));
  document.getElementById('btn-cerrar-panel').addEventListener('click', () => abrirPanel(false));
  const fichaEl = document.getElementById('ficha');
  fichaEl.addEventListener('click', (e) => {
    if (!e.target.closest('.ficha-cabecera') || e.target.closest('.ficha-cerrar')) return;
    if (window.matchMedia('(max-width: 760px)').matches) fichaEl.classList.toggle('plegada');
  });

  // ── Idioma ────────────────────────────────────────────────────────────
  const selectorIdioma = document.getElementById('idiomas');
  if (selectorIdioma) {
    for (const lang of IDIOMAS) {
      const a = document.createElement('a');
      a.href = urlEnIdioma(lang);
      a.textContent = lang;
      a.lang = lang;
      a.className = 'idioma' + (lang === idioma ? ' activo' : '');
      if (lang === idioma) a.setAttribute('aria-current', 'true');
      selectorIdioma.append(a);
    }
  }

  // ── Vistas ────────────────────────────────────────────────────────────
  document.getElementById('btn-imperio').addEventListener('click', () => {
    interfaz.verImperio();
    avisar('mapa_vista', { vista: 'imperio' });
  });
  document.getElementById('btn-mundo').addEventListener('click', () => {
    interfaz.verMundo();
    avisar('mapa_vista', { vista: 'rio' });
  });

  // ── Enlace ────────────────────────────────────────────────────────────
  document.getElementById('btn-compartir').addEventListener('click', async () => {
    const copiado = await enlace.copiar();
    aviso(copiado ? t('enlace.copiado') : t('enlace.fallo'));
    avisar('mapa_enlace', { resultado: copiado ? 'copiado' : 'fallo' });
  });

  return interfaz;
}
