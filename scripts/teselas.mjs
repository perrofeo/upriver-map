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
import { generarPlaceholder } from './mapa_placeholder.mjs';

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
    fuente = path.join('mapas', `placeholder_${est}.png`);
    if (!(await existe(fuente))) {
      console.log(`${est}: sin mapa definitivo, generando placeholder`);
      await generarPlaceholder(est, fuente);
    }
  }
  console.log(`${est}: ${fuente} → ${salida}`);
  await cortarTeselas({ imagen: fuente, salida, formato: 'webp', calidad: 82 });
}
