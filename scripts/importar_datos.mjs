#!/usr/bin/env node
/**
 * importar_datos.mjs — vuelca en src/data/upriver/ un paquete exportado por el
 * modo autor (`?autor` → Exportar).
 *
 * Uso: node scripts/importar_datos.mjs ~/Descargas/upriver-datos-2026-09-09.json
 *
 * Escribe cada colección en su .geojson y las poses en poses.json, con la misma
 * sangría que el resto del repo, para que el diff de git sea legible.
 */

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const fichero = process.argv[2];
if (!fichero) {
  console.error('Uso: importar_datos.mjs <paquete.json>');
  process.exit(2);
}
const paquete = JSON.parse(await readFile(fichero, 'utf8'));
const destino = new URL('../src/data/upriver/', import.meta.url);
let n = 0;
for (const [nombre, coleccion] of Object.entries(paquete.colecciones || {})) {
  if (!/^[a-z]+$/.test(nombre)) continue;
  const salida = new URL(`${nombre}.geojson`, destino);
  await writeFile(salida, `${JSON.stringify(coleccion, null, 2)}\n`);
  console.log(`→ ${path.basename(salida.pathname)} (${coleccion.features?.length ?? 0} features)`);
  n++;
}
if (paquete.poses) {
  await writeFile(new URL('poses.json', destino), `${JSON.stringify(paquete.poses, null, 2)}\n`);
  console.log(`→ poses.json (${Object.keys(paquete.poses).length} poses)`);
}
console.log(`${n} colecciones importadas. Revisa el diff, corre npm run teselas y npm test.`);
