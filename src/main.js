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
    globe.baseColor = Cesium.Color.fromCssColorString('#0f1d17');
    globe.showGroundAtmosphere = false;
    globe.enableLighting = false;
    globe.depthTestAgainstTerrain = false;
    scene.skyAtmosphere.show = true;
    scene.fog.enabled = false;
    scene.moon.show = false;
    // Límites de cámara: del detalle de un asentamiento a ver el mundo entero.
    const control = scene.screenSpaceCameraController;
    control.minimumZoomDistance = 250;
    control.maximumZoomDistance = 2_500_000;
    control.enableCollisionDetection = true;

    estado.textContent = 'Cargando el mapa…';
    const basemap = await new Basemap(viewer).init();

    const capas = new GestorCapas(viewer);
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
    if (modoAutor) document.getElementById('scene-panel').hidden = false;

    installRenderGovernor(viewer);

    const interfaz = montarInterfaz({ viewer, basemap, estilos, capas, enlace, director });

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
      if (compartido.capas) {
        for (const id of compartido.capas) await capas.setEnabled(id, true, { origin: 'share-restore' });
      }
      await enlace.aplicarCamara(compartido.camera, { duracion: 0 });
      if (compartido.t !== null) interfaz.setTiempo?.(compartido.t);
      if (compartido.seleccion) interfaz.seleccionar?.(compartido.seleccion);
    } else {
      viewer.camera.setView({ destination: rectanguloMundo(MUNDO) });
      viewer.camera.flyTo({
        destination: rectanguloMundo(MUNDO),
        duration: 2.0,
        easingFunction: Cesium.EasingFunction.CUBIC_IN_OUT,
      });
    }
    interfaz.sincronizar();
    enlace.activar();

    // Pestaña oculta: parar el bucle de render (perf, gods-eye-view).
    const visibilidad = () => {
      viewer.useDefaultRenderLoop = !document.hidden;
      if (!document.hidden) governorRequestRender('visibility-restore');
    };
    document.addEventListener('visibilitychange', visibilidad);
    visibilidad();

    carga.classList.add('oculto');

    window.__upriver = {
      viewer, basemap, estilos, capas, enlace, director, interfaz, MUNDO,
      diagnosticoRender: getRenderGovernorDiagnostics,
    };
  } catch (error) {
    console.error('Upriver: fallo de arranque', error);
    estado.textContent = `Error: ${describirError(error)}`;
    estado.classList.add('error');
  }
}

init();
