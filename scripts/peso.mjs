#!/usr/bin/env node
/** peso.mjs — tamaño del build por partes (dist/). */
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

async function tamano(dir) {
  let total = 0;
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    total += e.isDirectory() ? await tamano(p) : (await stat(p)).size;
  }
  return total;
}
const mb = (n) => `${(n / 1_048_576).toFixed(2)} MB`;
const raiz = process.argv[2] || 'dist';
const partes = ['assets', 'cesium', 'tiles'];
let suma = 0;
for (const parte of partes) {
  try {
    const t = await tamano(path.join(raiz, parte));
    suma += t;
    console.log(`${parte.padEnd(8)} ${mb(t)}`);
  } catch { /* no existe */ }
}
console.log(`${'total'.padEnd(8)} ${mb(await tamano(raiz))}`);
