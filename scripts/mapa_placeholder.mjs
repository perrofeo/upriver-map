#!/usr/bin/env node
/**
 * mapa_placeholder.mjs — genera un mapa PROVISIONAL por estación para poder
 * desarrollar mientras se produce el definitivo.
 *
 * Dibuja sobre el bbox de src/mundo.js: retícula de 0,25°, el río y las
 * entidades de src/data/upriver/*.geojson con su nombre, y una marca de agua
 * «PROVISIONAL». La creciente ensancha el río y sombrea el bosque inundado.
 *
 * Salida: mapas/placeholder_<estacion>.png (4096×2048).
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MUNDO, coordenadaAPixel } from '../src/mundo.js';

const ANCHO = 4096;
const ALTO = 2048;
const DATOS = new URL('../src/data/upriver/', import.meta.url);

async function leerGeojson(nombre) {
  return JSON.parse(await readFile(new URL(nombre, DATOS), 'utf8'));
}

const px = (lon, lat) => {
  const p = coordenadaAPixel(lon, lat, ANCHO, ALTO);
  return `${p.px.toFixed(1)},${p.py.toFixed(1)}`;
};

const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Polilínea → trazo suave (Catmull-Rom a Bézier) en coordenadas de píxel. */
function trazoSuave(coords) {
  const p = coords.map(([lon, lat]) => coordenadaAPixel(lon, lat, ANCHO, ALTO));
  if (p.length < 3) return `M ${p.map((q) => `${q.px.toFixed(1)} ${q.py.toFixed(1)}`).join(' L ')}`;
  let d = `M ${p[0].px.toFixed(1)} ${p[0].py.toFixed(1)}`;
  for (let i = 0; i < p.length - 1; i++) {
    const p0 = p[Math.max(i - 1, 0)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(i + 2, p.length - 1)];
    const c1x = p1.px + (p2.px - p0.px) / 6, c1y = p1.py + (p2.py - p0.py) / 6;
    const c2x = p2.px - (p3.px - p1.px) / 6, c2y = p2.py - (p3.py - p1.py) / 6;
    d += ` C ${c1x.toFixed(1)} ${c1y.toFixed(1)}, ${c2x.toFixed(1)} ${c2y.toFixed(1)}, ${p2.px.toFixed(1)} ${p2.py.toFixed(1)}`;
  }
  return d;
}

const poligono = (anillo) => anillo.map(([lon, lat]) => px(lon, lat)).join(' ');

export async function generarPlaceholder(estacion, salida) {
  const [asent, rutas, imperio, accidentes, locs, hidro] = await Promise.all([
    leerGeojson('asentamientos.geojson'), leerGeojson('rutas.geojson'), leerGeojson('imperio.geojson'),
    leerGeojson('accidentes.geojson'), leerGeojson('localizaciones.geojson'), leerGeojson('hidrografia.geojson'),
  ]);
  const creciente = estacion === 'creciente';
  const fondo = creciente ? '#1e2a1f' : '#26331f';
  const agua = creciente ? '#7fa9b1' : '#5d8b95';
  const aguaNegra = creciente ? '#56818d' : '#3e5c66';
  const visible = (f) => f.properties.estacion === 'ambas' || f.properties.estacion === estacion;

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">`;
  svg += `<rect width="100%" height="100%" fill="${fondo}"/>`;
  // Colinas y territorio local del imperio.
  for (const f of accidentes.features.filter((x) => x.properties.subtipo === 'colinas')) {
    svg += `<polygon points="${poligono(f.geometry.coordinates[0])}" fill="#6b5b3e" fill-opacity="0.5" stroke="#8a7550" stroke-width="4"/>`;
  }
  for (const f of imperio.features.filter((x) => x.properties.tipo === 'territorio' && x.properties.escala === 'local')) {
    svg += `<polygon points="${poligono(f.geometry.coordinates[0])}" fill="#9a5b2f" fill-opacity="0.22" stroke="#c99a3e" stroke-width="6" stroke-dasharray="24 14"/>`;
  }
  // Bosque inundado (solo creciente por su estación), cochas, playas e islas.
  for (const f of hidro.features.filter(visible)) {
    const st = f.properties.subtipo;
    const pts = poligono(f.geometry.coordinates[0]);
    if (st === 'tahuampa') svg += `<polygon points="${pts}" fill="${agua}" fill-opacity="0.38"/>`;
    else if (st === 'cocha') svg += `<polygon points="${pts}" fill="${aguaNegra}"/>`;
  }
  // Red fluvial: el río de la frontera y el río grande anchos; caños y desvíos finos; ocultos discontinuos.
  const anchoRuta = (rango) => ({ principal: 44, secundario: 16, oculto: 9 }[rango] || 12);
  for (const f of imperio.features.filter((x) => x.properties.tipo === 'frontera')) {
    svg += `<path d="${trazoSuave(f.geometry.coordinates)}" fill="none" stroke="${agua}" stroke-width="${creciente ? 120 : 64}" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  for (const r of rutas.features.filter((f) => f.geometry.type === 'LineString' && f.geometry.coordinates.length)) {
    const rango = r.properties.rango;
    const w = anchoRuta(rango) * (creciente ? 2 : 1);
    const dash = rango === 'oculto' ? ' stroke-dasharray="26 20"' : '';
    svg += `<path d="${trazoSuave(r.geometry.coordinates)}" fill="none" stroke="${agua}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"${dash}/>`;
  }
  for (const f of hidro.features.filter(visible)) {
    const st = f.properties.subtipo;
    const pts = poligono(f.geometry.coordinates[0]);
    if (st === 'isla') svg += `<polygon points="${pts}" fill="#4a5a34" stroke="#6a7a4a" stroke-width="3"/>`;
    else if (st === 'playa') svg += `<polygon points="${pts}" fill="#cbb98a"/>`;
  }
  // La frontera del imperio: tumbaga, discontinua.
  for (const f of imperio.features.filter((x) => x.properties.tipo === 'frontera')) {
    svg += `<path d="${trazoSuave(f.geometry.coordinates)}" fill="none" stroke="#c99a3e" stroke-width="8" stroke-dasharray="40 26" stroke-linecap="round"/>`;
  }
  // Retícula 0,25°.
  for (let lon = MUNDO.oeste; lon <= MUNDO.este + 1e-9; lon += 0.25) {
    const x = coordenadaAPixel(lon, MUNDO.norte, ANCHO, ALTO).px;
    svg += `<line x1="${x}" y1="0" x2="${x}" y2="${ALTO}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>`;
    svg += `<text x="${x + 8}" y="${ALTO - 16}" font-family="monospace" font-size="28" fill="#ffffff" fill-opacity="0.5">${lon.toFixed(2)}°</text>`;
  }
  for (let lat = MUNDO.sur; lat <= MUNDO.norte + 1e-9; lat += 0.25) {
    const y = coordenadaAPixel(MUNDO.oeste, lat, ANCHO, ALTO).py;
    svg += `<line x1="0" y1="${y}" x2="${ANCHO}" y2="${y}" stroke="#ffffff" stroke-opacity="0.12" stroke-width="2"/>`;
    svg += `<text x="12" y="${y - 8}" font-family="monospace" font-size="28" fill="#ffffff" fill-opacity="0.5">${lat.toFixed(2)}°</text>`;
  }
  // Entidades puntuales.
  const puntos = [...asent.features, ...imperio.features, ...accidentes.features, ...locs.features]
    .filter((f) => f.geometry.type === 'Point' && f.properties.etiqueta !== false);
  for (const f of puntos) {
    const [lon, lat] = f.geometry.coordinates;
    const p = coordenadaAPixel(lon, lat, ANCHO, ALTO);
    const inundado = creciente && f.properties.estacion === 'vaciante';
    const color = f.properties.faccion === 'imperio' ? '#c99a3e' : f.properties.faccion === 'comerciantes' ? '#c98a5a' : '#e9dcc3';
    const nombre = f.properties.nombre[f.properties.lengua] || f.properties.nombre.es;
    svg += `<circle cx="${p.px}" cy="${p.py}" r="${f.properties.parte_de ? 10 : 18}" fill="${inundado ? agua : color}" stroke="#14110d" stroke-width="4"/>`;
    if (!f.properties.parte_de || !creciente) {
      svg += `<text x="${p.px + 26}" y="${p.py + (f.properties.parte_de ? 8 : 12)}" font-family="Alegreya, Georgia, serif" font-size="${f.properties.parte_de ? 28 : 40}" fill="${color}" stroke="#14110d" stroke-width="6" paint-order="stroke">${esc(nombre)}</text>`;
    }
  }
  // Marca de agua.
  svg += `<text x="${ANCHO / 2}" y="${ALTO / 2}" text-anchor="middle" font-family="Alegreya, Georgia, serif" font-size="180" fill="#ffffff" fill-opacity="0.08" transform="rotate(-12 ${ANCHO / 2} ${ALTO / 2})">MAPA PROVISIONAL · ${estacion.toUpperCase()}</text>`;
  svg += `<text x="${ANCHO - 24}" y="56" text-anchor="end" font-family="monospace" font-size="34" fill="#ffffff" fill-opacity="0.6">bbox ${MUNDO.oeste}…${MUNDO.este} × ${MUNDO.sur}…${MUNDO.norte} · ${ANCHO}×${ALTO}</text>`;
  svg += '</svg>';

  await mkdir(path.dirname(salida), { recursive: true });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(salida);
  return salida;
}

const invocado = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invocado) {
  for (const est of MUNDO.estaciones) {
    const salida = path.join('mapas', `placeholder_${est}.png`);
    await generarPlaceholder(est, salida);
    console.log(`→ ${salida}`);
  }
  void writeFile;
}
