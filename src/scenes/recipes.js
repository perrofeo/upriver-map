/**
 * scenes/recipes.js — recetas de escena del director.
 *
 * En gods-eye-view aquí vivían cuatro recetas promocionales sobre la Tierra.
 * En Upriver el director es una herramienta de autoría: con CAPTURAR PLANO
 * se guardan poses de cámara y con EXPORTAR se obtiene el JSON que alimenta
 * la línea de tiempo. Esta receta única es un punto de partida sobre el bbox
 * del mundo; las poses reales las captura el autor.
 */

import { MUNDO } from '../mundo.js';

const centroLon = (MUNDO.oeste + MUNDO.este) / 2;
const centroLat = (MUNDO.norte + MUNDO.sur) / 2;

export const SCENE_RECIPES = [
  {
    id: 'upriver-vista-general',
    title: 'Upriver · vista general',
    durationSec: 8,
    style: 'normal',
    ui: { hidePanels: true, hudMode: 'off', safeFrame: '16:9' },
    layers: {},
    post: { bloom: 0, sharpen: false, detectionMode: 'OFF', styleParams: {} },
    cameraPath: [
      { lat: centroLat - 0.9, lon: centroLon, alt: 220000, heading: 0, pitch: -55, roll: 0, duration: 4, hold: 1 },
      { lat: centroLat - 0.4, lon: MUNDO.este - 0.3, alt: 60000, heading: -70, pitch: -40, roll: 0, duration: 4, hold: 1 },
    ],
  },
];

/**
 * Busca una receta por id.
 * @param {string} id
 * @returns {object|null}
 */
export function getSceneRecipeById(id) {
  return SCENE_RECIPES.find((recipe) => recipe.id === id) || null;
}
