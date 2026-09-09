/**
 * basemap.js — proveedor de imágenes propio, servido desde el build.
 *
 * Sustituye al MapStackController de gods-eye-view (Esri, Bing, OSM, Google
 * 3D). Aquí hay una sola fuente: la pirámide de teselas de `public/tiles/`,
 * cortada por `scripts/cortar_teselas.mjs` a partir de la imagen del mapa.
 *
 * Dos estaciones (bosque inundable): dos ImageryLayer apiladas sobre el
 * mismo bbox. La vaciante es la base; la creciente va encima con `alpha`
 * variable, así que el deslizador de estación es un fundido entre ambas.
 *
 * Sin terreno: la llanura amazónica va sobre el elipsoide liso, que es el
 * terreno por defecto del Viewer de Cesium.
 */

import * as Cesium from 'cesium';
import { MUNDO } from './mundo.js';

const BASE = import.meta.env?.BASE_URL || '/';

/** Lee el manifest que escribió el cortador de teselas. */
async function leerManifest(estacion) {
  const url = `${BASE}tiles/${estacion}/manifest.json`;
  const r = await fetch(url, { cache: 'no-cache' });
  if (!r.ok) throw new Error(`Sin teselas para «${estacion}» (${r.status} en ${url}). Ejecuta: npm run teselas`);
  return r.json();
}

/** Rectángulo del mundo en radianes. */
export function rectanguloMundo(mundo = MUNDO) {
  return Cesium.Rectangle.fromDegrees(mundo.oeste, mundo.sur, mundo.este, mundo.norte);
}

/** Crea el proveedor de una estación a partir de su manifest. */
export async function crearProveedor(estacion) {
  const manifest = await leerManifest(estacion);
  const rectangle = rectanguloMundo(manifest.mundo);
  const tilingScheme = new Cesium.GeographicTilingScheme({
    rectangle,
    numberOfLevelZeroTilesX: manifest.teselasNivel0.x,
    numberOfLevelZeroTilesY: manifest.teselasNivel0.y,
  });
  return new Cesium.UrlTemplateImageryProvider({
    url: `${BASE}tiles/${estacion}/{z}/{x}/{reverseY}.${manifest.formato}`,
    tilingScheme,
    rectangle,
    minimumLevel: 0,
    maximumLevel: manifest.nivelMaximo,
    tileWidth: manifest.tamanoTesela,
    tileHeight: manifest.tamanoTesela,
    hasAlphaChannel: false,
    credit: new Cesium.Credit('Mapa del mundo de Upriver © The Rendered'),
  });
}

export class Basemap {
  constructor(viewer) {
    this.viewer = viewer;
    /** @type {Record<string, Cesium.ImageryLayer>} */
    this.capas = {};
    this._estacion = 0;
    this.manifests = {};
  }

  /**
   * Carga el mundo entero de fondo y las dos estaciones encima. La creciente
   * empieza invisible.
   *
   * El fondo es Natural Earth II, que Cesium empaqueta en sus propios assets
   * (tres niveles, ~0,5 MB, sin fronteras políticas): sirve desde el build,
   * sin red, y da la escala continental para ver el tamaño del imperio.
   */
  async init() {
    try {
      const tierra = await Cesium.TileMapServiceImageryProvider.fromUrl(
        Cesium.buildModuleUrl('Assets/Textures/NaturalEarthII'),
      );
      const capaTierra = new Cesium.ImageryLayer(tierra);
      // Un mundo apagado: el mapa del río es lo que brilla.
      capaTierra.brightness = 0.55;
      capaTierra.saturation = 0.35;
      capaTierra.contrast = 1.05;
      this.viewer.imageryLayers.add(capaTierra);
      this.capas.tierra = capaTierra;
    } catch (e) {
      console.info('[basemap] sin fondo mundial:', e.message);
    }
    const [base, superior] = MUNDO.estaciones;
    const capaBase = new Cesium.ImageryLayer(await crearProveedor(base));
    this.viewer.imageryLayers.add(capaBase);
    this.capas[base] = capaBase;
    try {
      const capaSuperior = new Cesium.ImageryLayer(await crearProveedor(superior));
      capaSuperior.alpha = 0;
      // Oculta hasta que el deslizador la pida: así no se descargan sus teselas en vano.
      capaSuperior.show = false;
      this.viewer.imageryLayers.add(capaSuperior);
      this.capas[superior] = capaSuperior;
    } catch (e) {
      // Sin segunda estación el deslizador no hace nada; no es un fallo.
      console.info('[basemap]', e.message);
    }
    return this;
  }

  /** 0 = vaciante, 1 = creciente; valores intermedios funden. */
  setEstacion(valor) {
    const v = Math.max(0, Math.min(1, Number(valor) || 0));
    this._estacion = v;
    const superior = this.capas[MUNDO.estaciones[1]];
    if (superior) {
      superior.show = v > 0;
      superior.alpha = v;
    }
    this.viewer.scene.requestRender();
  }

  get estacion() {
    return this._estacion;
  }

  /** Nombre de la estación dominante para filtrar entidades. */
  get estacionDominante() {
    return this._estacion >= 0.5 ? MUNDO.estaciones[1] : MUNDO.estaciones[0];
  }
}
