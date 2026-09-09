/**
 * interfaz.js — cableado del DOM: aspecto, estación, capas y enlace.
 *
 * La línea de tiempo y la ficha de entidad se montan aquí también en cuanto
 * existan (Fase 3). Todo el estado vive en los gestores; este módulo solo
 * traduce clics y deslizadores.
 */

import { ESTILOS, NOMBRES_ESTILO } from './estilos.js';

function aviso(texto, ms = 1800) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = texto;
  toast.hidden = false;
  clearTimeout(aviso._t);
  aviso._t = setTimeout(() => { toast.hidden = true; }, ms);
}

export function montarInterfaz({ viewer, basemap, estilos, capas, enlace, director }) {
  const interfaz = {
    tiempo: null,
    seleccion: null,
    setEstacion(valor) {
      basemap.setEstacion(valor);
      slider.value = String(Math.round(basemap.estacion * 100));
      enlace.programar();
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
  };

  // ── Estación ──────────────────────────────────────────────────────────
  const slider = document.getElementById('estacion-slider');
  slider.addEventListener('input', () => {
    basemap.setEstacion(Number(slider.value) / 100);
    capas.setEstacionActiva?.(basemap.estacion);
    enlace.programar();
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
      b.textContent = NOMBRES_ESTILO[nombre] || nombre;
      b.addEventListener('click', () => {
        estilos.setStyle(nombre);
        pintarEstilos();
        pintarParams();
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

  // Atajos: 1-7 estilos, como en gods-eye-view.
  const orden = ['normal', ...Object.keys(ESTILOS)];
  document.addEventListener('keydown', (e) => {
    if (e.target && ['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    const n = Number(e.key);
    if (n >= 1 && n <= orden.length) {
      estilos.setStyle(orden[n - 1]);
      pintarEstilos();
      pintarParams();
    }
  });

  // ── Capas ─────────────────────────────────────────────────────────────
  capas.buildTogglePanel(document.getElementById('capas-toggles'));
  capas.onChange(() => enlace.programar());

  // ── Enlace ────────────────────────────────────────────────────────────
  document.getElementById('btn-compartir').addEventListener('click', async () => {
    aviso((await enlace.copiar()) ? 'Enlace copiado' : 'No se pudo copiar el enlace');
  });

  void viewer;
  void director;
  return interfaz;
}
