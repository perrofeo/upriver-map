#!/usr/bin/env node
/**
 * teselas.mjs — prepara public/tiles/<estación>/ para cada estación.
 *
 * Fuente por orden de preferencia:
 *   1. mapas/<estación>.png       — el mapa definitivo (producido por Igor)
 *   2. mapas/placeholder_<estación>.png — se genera si no existe
 *
 * `--si-faltan`: no vuelve a cortar si ya hay manifest.json (lo usa prebuild).
 */

import { access } from 'node:fs/promises';
import path from 'node:path';
import { MUNDO } from '../src/mundo.js';
import { cortarTeselas } from './cortar_teselas.mjs';
import { generarGrabado } from './mapa_grabado.mjs';

const existe = (p) => access(p).then(() => true, () => false);
const soloSiFaltan = process.argv.includes('--si-faltan');

for (const est of MUNDO.estaciones) {
  const salida = path.join('public', 'tiles', est);
  if (soloSiFaltan && await existe(path.join(salida, 'manifest.json'))) {
    console.log(`${est}: teselas ya presentes, no se cortan`);
    continue;
  }
  let fuente = path.join('mapas', `${est}.png`);
  if (!(await existe(fuente))) {
    // Sin mapa pintado a mano: el mapa grabado se regenera siempre desde los
    // datos de src/data/upriver, que cambian. ANCHO_GRABADO permite bajar la
    // resolución en desarrollo (por defecto 8192).
    fuente = path.join('mapas', `grabado_${est}.png`);
    const ancho = Number(process.env.ANCHO_GRABADO) || 8192;
    console.log(`${est}: sin mapa pintado a mano, dibujando el grabado a ${ancho} px`);
    await generarGrabado(est, fuente, { ancho });
  }
  console.log(`${est}: ${fuente} → ${salida}`);
  await cortarTeselas({ imagen: fuente, salida, formato: 'webp', calidad: 82 });
}
