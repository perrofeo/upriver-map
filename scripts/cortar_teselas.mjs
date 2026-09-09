#!/usr/bin/env node
/**
 * cortar_teselas.mjs — corta una imagen de mapa en una pirámide de teselas.
 *
 * Uso:
 *   node scripts/cortar_teselas.mjs <imagen> <carpeta_salida> [--formato webp|png|jpg] [--calidad 82]
 *
 * La imagen se asume equirrectangular sobre el bbox de src/mundo.js. Se
 * comprueba su relación de aspecto y, si difiere de la esperada en más de un
 * 1 %, se avisa (la imagen se estira igualmente al bbox).
 *
 * Salida: <carpeta>/<z>/<x>/<y>.<formato> con `y` en orden TMS (0 = sur), que
 * es lo que consume `{reverseY}` del UrlTemplateImageryProvider de Cesium, y
 * un manifest.json con los datos que necesita el proveedor.
 *
 * No requiere GDAL: para un mapa plano con bbox conocido no hay reproyección
 * que hacer, solo reescalar y recortar. sharp lo hace en segundos.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MUNDO, aspectoEsperado, dimensionesNivel, nivelMaximo } from '../src/mundo.js';

function leerArgumentos(argv) {
  const posicionales = [];
  const opciones = { formato: 'webp', calidad: 82 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--formato') opciones.formato = argv[++i];
    else if (a === '--calidad') opciones.calidad = Number(argv[++i]);
    else posicionales.push(a);
  }
  if (posicionales.length < 2) {
    console.error('Uso: cortar_teselas.mjs <imagen> <carpeta_salida> [--formato webp|png|jpg] [--calidad 82]');
    process.exit(2);
  }
  return { imagen: posicionales[0], salida: posicionales[1], ...opciones };
}

function codificador(instancia, formato, calidad) {
  if (formato === 'png') return instancia.png({ compressionLevel: 9 });
  if (formato === 'jpg' || formato === 'jpeg') return instancia.jpeg({ quality: calidad });
  return instancia.webp({ quality: calidad });
}

export async function cortarTeselas({ imagen, salida, formato = 'webp', calidad = 82, log = console.log }) {
  const meta = await sharp(imagen).metadata();
  const aspecto = meta.width / meta.height;
  const esperado = aspectoEsperado();
  if (Math.abs(aspecto / esperado - 1) > 0.01) {
    console.warn(`⚠️  Aspecto ${aspecto.toFixed(3)} ≠ esperado ${esperado.toFixed(3)}: la imagen se estira al bbox.`);
  }
  const zMax = nivelMaximo(meta.width);
  const T = MUNDO.tamanoTesela;
  let total = 0;

  for (let z = 0; z <= zMax; z++) {
    const { nx, ny, anchoPx, altoPx } = dimensionesNivel(z);
    // Reescalado del nivel entero a raw: una sola decodificación por nivel.
    const raw = await sharp(imagen)
      .resize(anchoPx, altoPx, { fit: 'fill', kernel: 'lanczos3' })
      .removeAlpha()
      .raw()
      .toBuffer();
    const trabajos = [];
    for (let x = 0; x < nx; x++) {
      await mkdir(path.join(salida, String(z), String(x)), { recursive: true });
      for (let y = 0; y < ny; y++) {
        const yTms = ny - 1 - y;
        const destino = path.join(salida, String(z), String(x), `${yTms}.${formato}`);
        const tesela = sharp(raw, { raw: { width: anchoPx, height: altoPx, channels: 3 } })
          .extract({ left: x * T, top: y * T, width: T, height: T });
        trabajos.push(codificador(tesela, formato, calidad).toFile(destino));
        if (trabajos.length >= 32) {
          await Promise.all(trabajos.splice(0));
        }
      }
    }
    await Promise.all(trabajos);
    total += nx * ny;
    log(`  nivel ${z}: ${nx}×${ny} teselas (${anchoPx}×${altoPx} px)`);
  }

  const manifest = {
    mundo: { oeste: MUNDO.oeste, este: MUNDO.este, sur: MUNDO.sur, norte: MUNDO.norte },
    teselasNivel0: MUNDO.teselasNivel0,
    tamanoTesela: T,
    nivelMaximo: zMax,
    formato,
    origen: { fichero: path.basename(imagen), ancho: meta.width, alto: meta.height },
    generado: new Date().toISOString(),
  };
  await writeFile(path.join(salida, 'manifest.json'), JSON.stringify(manifest, null, 2));
  log(`  ${total} teselas → ${salida}`);
  return manifest;
}

const invocado = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invocado) {
  const args = leerArgumentos(process.argv.slice(2));
  console.log(`Cortando ${args.imagen} → ${args.salida} (${args.formato})`);
  cortarTeselas(args).catch((e) => { console.error(e); process.exit(1); });
}
