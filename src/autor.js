/**
 * autor.js — modo autor (`?autor` en la URL).
 *
 * Herramientas para que el autor corrija el mundo sin tocar JSON:
 * - arrastrar un lugar sobre el globo lo mueve;
 * - con el quipu en un momento, «Empieza aquí» / «Termina aquí» fijan el
 *   tramo de la aparición del lugar seleccionado en ese episodio;
 * - «Cámara aquí» guarda la pose actual como pose de ese lugar;
 * - «Exportar» descarga un único JSON con todas las colecciones y las poses,
 *   que `node scripts/importar_datos.mjs <fichero>` vuelca en src/data/upriver/.
 *
 * Los cambios viven en localStorage hasta que se exportan o se descartan;
 * el visitante normal nunca los ve.
 */

import * as Cesium from 'cesium';
import { formatearTiempo, segundoEnEpisodio, episodioEn } from './recorrido.js';
import { nombreMostrado } from './capas/ficcion.js';

const CLAVE = 'upriver.autor.cambios.v1';

function leerCambios() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE) || '{}');
  } catch {
    return {};
  }
}

export function montarAutor({ viewer, capas, interfaz, estilos, episodios, poses, colecciones }) {
  document.body.classList.add('autor');
  const cambios = { geometrias: {}, apariciones: {}, poses: {}, ...leerCambios() };
  const guardar = () => localStorage.setItem(CLAVE, JSON.stringify(cambios));

  // ── Aplicar cambios guardados ──
  for (const [fid, coords] of Object.entries(cambios.geometrias)) {
    const h = capas.buscar(fid);
    if (h) h.capa.moverEntidad(fid, coords[0], coords[1]);
  }
  for (const [fid, aps] of Object.entries(cambios.apariciones)) {
    const h = capas.buscar(fid);
    if (h) h.feature.properties.apariciones = aps;
  }
  Object.assign(poses, cambios.poses);
  interfaz.lineaTiempo.reconstruir({ features: capas.todasLasFeatures(), poses });

  // ── Panel ──
  const panel = document.getElementById('panel-autor');
  panel.hidden = false;
  const $ = (sel) => panel.querySelector(sel);
  const coord = $('#autor-coord');
  const seleccionado = $('#autor-seleccionado');
  const listaAp = $('#autor-apariciones');
  const estado = $('#autor-estado');
  const aviso = (t) => { estado.textContent = t; };

  function pintar() {
    const fid = interfaz.seleccion;
    const h = fid ? capas.buscar(fid) : null;
    seleccionado.textContent = h ? nombreMostrado(h.feature.properties).principal : 'Ningún lugar seleccionado';
    listaAp.replaceChildren();
    if (!h) return;
    const aps = h.feature.properties.apariciones || [];
    aps.forEach((ap, i) => {
      const ep = episodios.find((e) => e.n === ap.episodio);
      const fila = document.createElement('div');
      fila.className = 'autor-ap';
      const txt = document.createElement('span');
      const d = Number.isFinite(ap.desde) ? formatearTiempo(ap.desde) : '0:00';
      const hs = Number.isFinite(ap.hasta) ? formatearTiempo(ap.hasta) : (ep ? formatearTiempo(ep.duracion) : '');
      txt.textContent = `Ep. ${ap.episodio} · ${d} a ${hs}${ap.camara === false ? ' · sin cámara' : ''}${ap.provisional ? ' · provisional' : ''}`;
      const b1 = boton('Empieza aquí', () => fijar(h, i, 'desde'));
      const b2 = boton('Termina aquí', () => fijar(h, i, 'hasta'));
      const b3 = boton(ap.camara === false ? 'Con cámara' : 'Sin cámara', () => { ap.camara = ap.camara === false ? undefined : false; if (ap.camara === undefined) delete ap.camara; anotar(h); });
      const b4 = boton('Quitar', () => { aps.splice(i, 1); anotar(h); });
      fila.append(txt, b1, b2, b3, b4);
      listaAp.append(fila);
    });
    listaAp.append(boton('Añadir aparición en el episodio actual', () => {
      const ep = episodioEn(episodios, interfaz.lineaTiempo.t);
      if (!ep) return;
      aps.push({ episodio: ep.n, desde: Math.round(segundoEnEpisodio(episodios, interfaz.lineaTiempo.t)), provisional: true });
      anotar(h);
    }));
  }

  function boton(texto, fn) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'autor-btn';
    b.textContent = texto;
    b.addEventListener('click', fn);
    return b;
  }

  function fijar(h, i, campo) {
    const t = interfaz.lineaTiempo.t;
    const ep = episodioEn(episodios, t);
    const ap = h.feature.properties.apariciones[i];
    if (!ep || ep.n !== ap.episodio) { aviso(`El quipu está en el episodio ${ep?.n ?? '?'}; esta aparición es del ${ap.episodio}.`); return; }
    ap[campo] = Math.round(segundoEnEpisodio(episodios, t) * 10) / 10;
    ap.provisional = false;
    anotar(h);
    aviso(`${campo === 'desde' ? 'Empieza' : 'Termina'} en ${formatearTiempo(ap[campo])} del episodio ${ep.n}.`);
  }

  function anotar(h) {
    cambios.apariciones[h.feature.id] = h.feature.properties.apariciones;
    guardar();
    interfaz.lineaTiempo.reconstruir({ features: capas.todasLasFeatures(), poses });
    if (interfaz.ficha.feature?.id === h.feature.id) interfaz.ficha.mostrar(h.feature);
    pintar();
  }

  // ── Cámara aquí ──
  $('#autor-camara').addEventListener('click', () => {
    const fid = interfaz.seleccion;
    if (!fid) { aviso('Selecciona un lugar primero.'); return; }
    const pose = estilos.getCameraState();
    cambios.poses[fid] = poses[fid] = { lon: pose.lon, lat: pose.lat, alt: Math.round(pose.alt), heading: Math.round(pose.heading), pitch: Math.round(pose.pitch * 10) / 10 };
    guardar();
    interfaz.lineaTiempo.reconstruir({ poses });
    aviso(`Cámara guardada para ${fid}.`);
  });
  $('#autor-camara-quitar').addEventListener('click', () => {
    const fid = interfaz.seleccion;
    if (!fid || !poses[fid]) return;
    delete poses[fid];
    delete cambios.poses[fid];
    guardar();
    interfaz.lineaTiempo.reconstruir({ poses });
    aviso(`Cámara de ${fid} vuelve a la pose por defecto.`);
  });

  // ── Arrastre de lugares ──
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  let arrastrando = null;
  const control = viewer.scene.screenSpaceCameraController;
  handler.setInputAction((e) => {
    const picked = viewer.scene.pick(e.position);
    const ent = picked?.id instanceof Cesium.Entity ? picked.id : null;
    const fid = ent?.properties?.fid?.getValue?.(Cesium.JulianDate.now());
    const h = fid ? capas.buscar(fid) : null;
    if (h && h.feature.geometry.type === 'Point') {
      arrastrando = { fid, capa: h.capa, origen: { x: e.position.x, y: e.position.y }, movido: false };
      control.enableInputs = false;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);
  handler.setInputAction((m) => {
    if (!arrastrando) {
      const c = viewer.camera.pickEllipsoid(m.endPosition, viewer.scene.globe.ellipsoid);
      if (c) {
        const g = Cesium.Cartographic.fromCartesian(c);
        coord.textContent = `${Cesium.Math.toDegrees(g.longitude).toFixed(4)}, ${Cesium.Math.toDegrees(g.latitude).toFixed(4)}`;
      }
      return;
    }
    // Un clic con el pulso normal no es un arrastre: hacen falta unos píxeles.
    if (!arrastrando.movido && Math.hypot(m.endPosition.x - arrastrando.origen.x, m.endPosition.y - arrastrando.origen.y) < 4) return;
    arrastrando.movido = true;
    const c = viewer.camera.pickEllipsoid(m.endPosition, viewer.scene.globe.ellipsoid);
    if (!c) return;
    const g = Cesium.Cartographic.fromCartesian(c);
    arrastrando.capa.moverEntidad(arrastrando.fid, Cesium.Math.toDegrees(g.longitude), Cesium.Math.toDegrees(g.latitude));
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
  handler.setInputAction(() => {
    if (!arrastrando) return;
    control.enableInputs = true;
    const { fid, capa, movido } = arrastrando;
    arrastrando = null;
    if (!movido) return; // fue un clic: la selección normal ya se ha ocupado
    const f = capa.buscar(fid);
    cambios.geometrias[fid] = f.geometry.coordinates;
    guardar();
    interfaz.lineaTiempo.reconstruir({ features: capas.todasLasFeatures(), poses });
    aviso(`${fid} movido a ${f.geometry.coordinates.join(', ')}.`);
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  // Copiar coordenada del puntero.
  $('#autor-copiar-coord').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(coord.textContent); aviso('Coordenada copiada.'); } catch { aviso('No se pudo copiar.'); }
  });

  // ── Exportar / descartar ──
  $('#autor-exportar').addEventListener('click', () => {
    const paquete = { generado: new Date().toISOString(), colecciones: {}, poses };
    for (const [nombre, coleccion] of Object.entries(colecciones)) paquete.colecciones[nombre] = coleccion;
    const blob = new Blob([JSON.stringify(paquete, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `upriver-datos-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    aviso('Exportado. Vuélcalo con: node scripts/importar_datos.mjs <fichero>');
  });
  $('#autor-descartar').addEventListener('click', () => {
    if (!confirm('¿Descartar todos los cambios del modo autor guardados en este navegador?')) return;
    localStorage.removeItem(CLAVE);
    location.reload();
  });
  $('#autor-director').addEventListener('click', () => {
    const sp = document.getElementById('scene-panel');
    sp.hidden = !sp.hidden;
  });

  const cuantos = Object.keys(cambios.geometrias).length + Object.keys(cambios.apariciones).length + Object.keys(cambios.poses).length;
  aviso(cuantos ? `${cuantos} cambios guardados en este navegador, sin exportar.` : 'Sin cambios pendientes.');
  return { pintar, cambios };
}
