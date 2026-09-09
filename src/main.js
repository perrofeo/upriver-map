/**
 * main.js — punto de entrada del mapa de Upriver.
 *
 * Reescritura del arranque de gods-eye-view sin proveedores externos, sin
 * claves y sin capas en vivo: globo liso sobre el elipsoide, teselas propias
 * desde el build, estilos GLSL, director de escenas (autoría), enlaces
 * compartibles y el gestor de render de gods-eye-view.
 */

import * as Cesium from 'cesium';
import { MUNDO } from './mundo.js';
import { Basemap, rectanguloMundo } from './basemap.js';
import { GestorEstilos } from './estilos.js';
import { GestorCapas } from './capas/gestor.js';
import { GestorEnlace } from './enlace.js';
import { SceneDirector } from './scenes/director.js';
import { installRenderGovernor, governorRequestRender, getRenderGovernorDiagnostics } from './renderGovernor.js';
import { montarInterfaz } from './interfaz.js';
import { crearCapaFiccion } from './capas/ficcion.js';
import { montarAutor } from './autor.js';
import episodiosJson from './data/upriver/episodios.json';
import poses from './data/upriver/poses.json';
import asentamientosRaw from './data/upriver/asentamientos.geojson?raw';
import rutasRaw from './data/upriver/rutas.geojson?raw';
import imperioRaw from './data/upriver/imperio.geojson?raw';
import accidentesRaw from './data/upriver/accidentes.geojson?raw';
import localizacionesRaw from './data/upriver/localizaciones.geojson?raw';
import hidrografiaRaw from './data/upriver/hidrografia.geojson?raw';

/** Capas de ficción, en el orden del panel. */
const CAPAS_FICCION = [
  { id: 'hidrografia', nombre: 'Cochas, islas y bosque inundado', icono: '≈', geojson: hidrografiaRaw },
  { id: 'rutas', nombre: 'El río', icono: '〜', geojson: rutasRaw },
  { id: 'imperio', nombre: 'El imperio', icono: '▲', geojson: imperioRaw },
  { id: 'asentamientos', nombre: 'Asentamientos', icono: '⌂', geojson: asentamientosRaw },
  { id: 'accidentes', nombre: 'Accidentes geográficos', icono: '≋', geojson: accidentesRaw },
  { id: 'localizaciones', nombre: 'Localizaciones', icono: '◦', geojson: localizacionesRaw },
];

// Cero servicios de terceros: sin token de ion no hay ninguna llamada a Cesium ion.
Cesium.Ion.defaultAccessToken = '';

function describirError(error) {
  if (error instanceof Error) return error.message || error.name;
  if (typeof error === 'string') return error;
  try { return JSON.stringify(error); } catch { return String(error); }
}

async function init() {
  const carga = document.getElementById('carga');
  const estado = carga.querySelector('.carga-estado');
  const parametros = new URLSearchParams(window.location.search);
  const modoAutor = parametros.has('autor');

  try {
    estado.textContent = 'Configurando el globo…';
    const creditos = document.createElement('div');
    creditos.id = 'creditos-cesium';
    document.body.appendChild(creditos);

    const viewer = new Cesium.Viewer('globo', {
      timeline: false,
      animation: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      vrButton: false,
      selectionIndicator: false,
      infoBox: false,
      baseLayer: false,
      creditContainer: creditos,
      shadows: false,
      // Sin `terrain`: elipsoide liso. Es la llanura.
    });
    viewer.targetFrameRate = 60;

    const { scene } = viewer;
    const { globe } = scene;
    globe.show = true;
    globe.baseColor = Cesium.Color.fromCssColorString('#14110d');
    globe.showGroundAtmosphere = false;
    globe.enableLighting = false;
    globe.depthTestAgainstTerrain = false;
    scene.skyAtmosphere.show = true;
    scene.fog.enabled = false;
    scene.moon.show = false;
    // Límites de cámara: del detalle de un asentamiento a ver el mundo entero.
    const control = scene.screenSpaceCameraController;
    control.minimumZoomDistance = 250;
    // Hasta ver el continente entero: el tamaño del imperio importa.
    control.maximumZoomDistance = 14_000_000;
    control.enableCollisionDetection = true;

    estado.textContent = 'Cargando el mapa…';
    // Las etiquetas del globo se rasterizan al crearse: la fuente tiene que estar antes.
    await Promise.all([document.fonts.load('500 14px Alegreya'), document.fonts.load('italic 500 14px Alegreya')]).catch(() => {});
    const basemap = await new Basemap(viewer).init();

    const capas = new GestorCapas(viewer);
    const colecciones = {};
    for (const def of CAPAS_FICCION) {
      colecciones[def.id] = JSON.parse(def.geojson);
      capas.register(crearCapaFiccion({ ...def, geojson: colecciones[def.id] }));
    }
    const estilos = new GestorEstilos(viewer, { onChange: () => enlace?.programar() });

    const enlace = new GestorEnlace(viewer, {
      obtenerEstado: () => ({
        ...estilos.getVisualState(),
        estacion: basemap.estacion,
        capas: capas.getEnabledIds(),
        t: interfaz?.tiempo ?? null,
        seleccion: interfaz?.seleccion ?? null,
      }),
    });

    const director = new SceneDirector(viewer, estilos, capas);

    installRenderGovernor(viewer);

    const interfaz = montarInterfaz({
      viewer, basemap, estilos, capas, enlace, director,
      episodios: episodiosJson.episodios,
      duracion: episodiosJson.duracion,
      poses,
    });

    // Restauración del enlace o vista inicial sobre el mundo entero.
    const compartido = enlace.leerHashInicial();
    if (compartido) {
      estado.textContent = 'Restaurando la vista compartida…';
      await estilos.applyVisualState({
        style: compartido.style,
        bloom: { ...compartido.bloom, version: 2 },
        sharpen: compartido.sharpen,
        styleParams: compartido.styleParams ? { [compartido.style]: compartido.styleParams } : null,
      });
      if (compartido.estacion !== null) interfaz.setEstacion(compartido.estacion);
      const visibles = compartido.capas || CAPAS_FICCION.map((c) => c.id);
      for (const id of visibles) await capas.setEnabled(id, true, { origin: 'share-restore' });
      // La t se coloca sin mover la cámara: manda la cámara del enlace.
      if (compartido.t !== null) interfaz.setTiempo(compartido.t, { moverCamara: !compartido.camera });
      await enlace.aplicarCamara(compartido.camera, { duracion: 0 });
      if (compartido.seleccion) interfaz.seleccionar(compartido.seleccion);
    } else {
      for (const def of CAPAS_FICCION) await capas.setEnabled(def.id, true, { origin: 'programmatic' });
      interfaz.setTiempo(0, { moverCamara: false });
      // Arranque: el continente con el imperio dibujado, y de ahí al río.
      interfaz.verImperio({ duracion: 0 });
      setTimeout(() => interfaz.verMundo({ duracion: 3.5 }), 1800);
    }
    interfaz.sincronizar();
    enlace.activar();

    // Modo autor: herramientas de corrección del mundo, solo con ?autor.
    let autor = null;
    if (modoAutor) {
      autor = montarAutor({ viewer, capas, interfaz, estilos, episodios: episodiosJson.episodios, poses, colecciones });
      interfaz.alSeleccionar = () => autor.pintar();
      autor.pintar();
    }

    // Pestaña oculta: parar el bucle de render (perf, gods-eye-view).
    const visibilidad = () => {
      viewer.useDefaultRenderLoop = !document.hidden;
      if (!document.hidden) governorRequestRender('visibility-restore');
    };
    document.addEventListener('visibilitychange', visibilidad);
    visibilidad();

    carga.classList.add('oculto');

    window.__upriver = {
      viewer, basemap, estilos, capas, enlace, director, interfaz, MUNDO, autor,
      diagnosticoRender: getRenderGovernorDiagnostics,
    };
  } catch (error) {
    console.error('Upriver: fallo de arranque', error);
    estado.textContent = `Error: ${describirError(error)}`;
    estado.classList.add('error');
  }
}

init();
