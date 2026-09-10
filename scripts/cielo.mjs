#!/usr/bin/env node
/**
 * cielo.mjs — el cielo estrellado de Cesium, a media resolución.
 *
 * Las seis caras del skybox que trae Cesium pesan 850 KB y son lo segundo
 * más pesado que descarga el visitante después del propio motor. A 512 px
 * las estrellas se ven igual sobre un globo y cuestan una cuarta parte.
 * Salida: public/cielo/<cara>.webp (se generan en prebuild si faltan).
 */

import { mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const ORIGEN = new URL('../node_modules/cesium/Build/Cesium/Assets/Textures/SkyBox/', import.meta.url);
const DESTINO = 'public/cielo';
const CARAS = ['px', 'mx', 'py', 'my', 'pz', 'mz'];

await mkdir(DESTINO, { recursive: true });
let hechas = 0;
for (const cara of CARAS) {
  const salida = path.join(DESTINO, `${cara}.webp`);
  if (await access(salida).then(() => true, () => false)) continue;
  await sharp(new URL(`tycho2t3_80_${cara}.jpg`, ORIGEN).pathname).resize(512, 512).webp({ quality: 78 }).toFile(salida);
  hechas++;
}
console.log(`cielo: ${hechas} caras generadas en ${DESTINO}`);
