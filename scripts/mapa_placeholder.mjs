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

export async function generarPlaceholder(estacion, salida) {
  const [asent, rutas, imperio, accidentes, locs] = await Promise.all([
    leerGeojson('asentamientos.geojson'), leerGeojson('rutas.geojson'), leerGeojson('imperio.geojson'),
    leerGeojson('accidentes.geojson'), leerGeojson('localizaciones.geojson'),
  ]);
  const creciente = estacion === 'creciente';
  const fondo = creciente ? '#22392c' : '#2b4a2f';
  const agua = creciente ? '#5a8ea6' : '#3f6f86';
  const rio = rutas.features.find((f) => f.id === 'rio');
  const rioPuntos = rio.geometry.coordinates.map(([lon, lat]) => px(lon, lat)).join(' ');
  const territorio = imperio.features.find((f) => f.id === 'territorio-imperio');
  const terrPuntos = territorio.geometry.coordinates[0].map(([lon, lat]) => px(lon, lat)).join(' ');

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">`;
  svg += `<rect width="100%" height="100%" fill="${fondo}"/>`;
  // Territorio del imperio: trama.
  svg += `<polygon points="${terrPuntos}" fill="#6b4a3a" fill-opacity="0.35" stroke="#a37a5c" stroke-width="6" stroke-dasharray="24 14"/>`;
  // Bosque inundado en creciente: banda ancha alrededor del río.
  if (creciente) {
    svg += `<polyline points="${rioPuntos}" fill="none" stroke="${agua}" stroke-opacity="0.45" stroke-width="360" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  svg += `<polyline points="${rioPuntos}" fill="none" stroke="${agua}" stroke-width="${creciente ? 110 : 46}" stroke-linejoin="round" stroke-linecap="round"/>`;
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
    .filter((f) => f.geometry.type === 'Point');
  for (const f of puntos) {
    const [lon, lat] = f.geometry.coordinates;
    const p = coordenadaAPixel(lon, lat, ANCHO, ALTO);
    const inundado = creciente && f.properties.estacion === 'vaciante';
    const color = f.properties.faccion === 'imperio' ? '#e0b070' : '#e8f2ea';
    const nombre = f.properties.nombre[f.properties.lengua] || f.properties.nombre.es;
    svg += `<circle cx="${p.px}" cy="${p.py}" r="${f.properties.parte_de ? 10 : 18}" fill="${inundado ? agua : color}" stroke="#101a14" stroke-width="4"/>`;
    if (!f.properties.parte_de || !creciente) {
      svg += `<text x="${p.px + 26}" y="${p.py + (f.properties.parte_de ? 8 : 12)}" font-family="sans-serif" font-size="${f.properties.parte_de ? 28 : 40}" fill="${color}" stroke="#101a14" stroke-width="6" paint-order="stroke">${esc(nombre)}</text>`;
    }
  }
  // Marca de agua.
  svg += `<text x="${ANCHO / 2}" y="${ALTO / 2}" text-anchor="middle" font-family="sans-serif" font-size="180" fill="#ffffff" fill-opacity="0.08" transform="rotate(-12 ${ANCHO / 2} ${ALTO / 2})">MAPA PROVISIONAL · ${estacion.toUpperCase()}</text>`;
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
