#!/usr/bin/env node
/**
 * mapa_grabado.mjs — dibuja el mapa del mundo a partir de los datos, en el
 * estilo de la cartografía imperial (docs/DISENO.md): grabado sobre piedra
 * ahumada, selva punteada, colinas a rayas, ríos con orilla de tumbaga,
 * bosque inundado tramado, cochas de agua negra, la raya de la frontera y una
 * retícula fina. Sin rótulos: los pinta el globo.
 *
 * Es generativo: cada vez que cambian los datos de src/data/upriver/ el mapa
 * se redibuja y cuadra con el globo. Si existe mapas/<estación>.png pintado a
 * mano, ese manda (ver scripts/teselas.mjs).
 *
 * Uso: node scripts/mapa_grabado.mjs [--ancho 8192]
 * Salida: mapas/grabado_<estacion>.png
 */

import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { MUNDO, coordenadaAPixel } from '../src/mundo.js';

const DATOS = new URL('../src/data/upriver/', import.meta.url);
const PALETA = {
  piedra: '#14110d',
  selva: '#2b3424',
  selvaClara: '#3a4630',
  agua: '#5f8d98',
  aguaCreciente: '#6f9ea8',
  aguaNegra: '#35515b',
  arena: '#c8b58a',
  colina: '#5a4a33',
  colinaLinea: '#8a7550',
  tumbaga: '#c99a3e',
  cobre: '#9a5b2f',
  hueso: '#e9dcc3',
};

async function leerGeojson(nombre) {
  return JSON.parse(await readFile(new URL(nombre, DATOS), 'utf8'));
}

export async function generarGrabado(estacion, salida, { ancho = 8192, grano = true } = {}) {
  const ANCHO = ancho;
  const ALTO = Math.round(ancho / 2);
  const k = ANCHO / 4096; // escala de trazos respecto a la base de 4096
  const P = (lon, lat) => coordenadaAPixel(lon, lat, ANCHO, ALTO);
  const px = (lon, lat) => { const p = P(lon, lat); return `${p.px.toFixed(1)},${p.py.toFixed(1)}`; };
  const poligono = (anillo) => anillo.map(([lon, lat]) => px(lon, lat)).join(' ');
  const trazo = (coords) => {
    const p = coords.map(([lon, lat]) => P(lon, lat));
    if (p.length < 3) return `M ${p.map((q) => `${q.px.toFixed(1)} ${q.py.toFixed(1)}`).join(' L ')}`;
    let d = `M ${p[0].px.toFixed(1)} ${p[0].py.toFixed(1)}`;
    for (let i = 0; i < p.length - 1; i++) {
      const p0 = p[Math.max(i - 1, 0)], p1 = p[i], p2 = p[i + 1], p3 = p[Math.min(i + 2, p.length - 1)];
      d += ` C ${(p1.px + (p2.px - p0.px) / 6).toFixed(1)} ${(p1.py + (p2.py - p0.py) / 6).toFixed(1)}, ${(p2.px - (p3.px - p1.px) / 6).toFixed(1)} ${(p2.py - (p3.py - p1.py) / 6).toFixed(1)}, ${p2.px.toFixed(1)} ${p2.py.toFixed(1)}`;
    }
    return d;
  };

  const [rutas, imperio, accidentes, hidro] = await Promise.all([
    leerGeojson('rutas.geojson'), leerGeojson('imperio.geojson'), leerGeojson('accidentes.geojson'), leerGeojson('hidrografia.geojson'),
  ]);
  const creciente = estacion === 'creciente';
  const visible = (f) => f.properties.estacion === 'ambas' || f.properties.estacion === estacion;
  const agua = creciente ? PALETA.aguaCreciente : PALETA.agua;
  // Anchos en px sobre 4096 (× k). Un caño de 10 px son ~1,1 km a 8192; el test de datos usa estas mismas cifras.
  const anchoRuta = (rango) => ({ principal: 44, secundario: 10, oculto: 7 }[rango] || 12) * k * (creciente ? 1.9 : 1);

  const s = [];
  s.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">`);
  s.push(`<defs>
    <pattern id="selva" width="${14 * k}" height="${14 * k}" patternUnits="userSpaceOnUse" patternTransform="rotate(17)">
      <rect width="100%" height="100%" fill="${PALETA.selva}"/>
      <circle cx="${3 * k}" cy="${4 * k}" r="${1.1 * k}" fill="${PALETA.selvaClara}"/>
      <circle cx="${10 * k}" cy="${10 * k}" r="${0.9 * k}" fill="${PALETA.selvaClara}"/>
      <circle cx="${8 * k}" cy="${2 * k}" r="${0.6 * k}" fill="${PALETA.piedra}" fill-opacity="0.5"/>
    </pattern>
    <pattern id="colinas" width="${10 * k}" height="${10 * k}" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)">
      <rect width="100%" height="100%" fill="${PALETA.colina}" fill-opacity="0.55"/>
      <line x1="0" y1="${5 * k}" x2="${10 * k}" y2="${5 * k}" stroke="${PALETA.colinaLinea}" stroke-width="${1.2 * k}"/>
    </pattern>
    <pattern id="tahuampa" width="${12 * k}" height="${12 * k}" patternUnits="userSpaceOnUse" patternTransform="rotate(30)">
      <rect width="100%" height="100%" fill="${agua}" fill-opacity="0.34"/>
      <line x1="0" y1="${6 * k}" x2="${12 * k}" y2="${6 * k}" stroke="${agua}" stroke-width="${1 * k}" stroke-opacity="0.7"/>
    </pattern>
    <pattern id="imperio" width="${12 * k}" height="${12 * k}" patternUnits="userSpaceOnUse">
      <rect x="${3 * k}" y="${3 * k}" width="${2.4 * k}" height="${2.4 * k}" fill="${PALETA.cobre}" fill-opacity="0.28"/>
      <rect x="${8 * k}" y="${8 * k}" width="${1.6 * k}" height="${1.6 * k}" fill="${PALETA.tumbaga}" fill-opacity="0.18"/>
    </pattern>
    <pattern id="tocapu" width="${36 * k}" height="${8 * k}" patternUnits="userSpaceOnUse">
      <rect width="${8 * k}" height="${8 * k}" fill="${PALETA.tumbaga}"/>
      <rect x="${12 * k}" width="${8 * k}" height="${8 * k}" fill="${PALETA.cobre}"/>
      <rect x="${24 * k}" width="${4 * k}" height="${8 * k}" fill="${PALETA.tumbaga}" fill-opacity="0.6"/>
    </pattern>
  </defs>`);
  // Fondo de selva punteada.
  s.push(`<rect width="100%" height="100%" fill="url(#selva)"/>`);
  // Colinas: relleno a rayas y dos anillos de curva de nivel.
  for (const f of accidentes.features.filter((x) => x.properties.subtipo === 'colinas')) {
    const anillo = f.geometry.coordinates[0];
    s.push(`<polygon points="${poligono(anillo)}" fill="url(#colinas)" stroke="${PALETA.colinaLinea}" stroke-width="${2 * k}"/>`);
    const cx = anillo.reduce((a, c) => a + c[0], 0) / anillo.length, cy = anillo.reduce((a, c) => a + c[1], 0) / anillo.length;
    for (const e of [0.72, 0.45]) {
      const interior = anillo.map(([lon, lat]) => [cx + (lon - cx) * e, cy + (lat - cy) * e]);
      s.push(`<polygon points="${poligono(interior)}" fill="none" stroke="${PALETA.colinaLinea}" stroke-width="${1.4 * k}" stroke-opacity="0.8"/>`);
    }
  }
  // Territorio local del imperio: trama de tocapu y borde discontinuo.
  for (const f of imperio.features.filter((x) => x.properties.tipo === 'territorio' && x.properties.escala === 'local')) {
    s.push(`<polygon points="${poligono(f.geometry.coordinates[0])}" fill="url(#imperio)" stroke="${PALETA.tumbaga}" stroke-width="${5 * k}" stroke-dasharray="${26 * k} ${14 * k}"/>`);
  }
  // Bosque inundado y cochas.
  for (const f of hidro.features.filter(visible)) {
    const st = f.properties.subtipo, pts = poligono(f.geometry.coordinates[0]);
    if (st === 'tahuampa') s.push(`<polygon points="${pts}" fill="url(#tahuampa)"/>`);
    else if (st === 'cocha') s.push(`<polygon points="${pts}" fill="${PALETA.aguaNegra}" stroke="${PALETA.tumbaga}" stroke-width="${1.5 * k}" stroke-opacity="0.55"/>`);
  }
  // Ríos: orilla de tumbaga fina bajo el agua. El río grande se estrecha río
  // arriba: se dibuja por tramos con anchura decreciente desde la desembocadura.
  const tramosRioGrande = (f) => {
    const c = f.geometry.coordinates; // de la cabecera (SO) a la desembocadura (NE)
    const wMax = anchoRuta('principal'), wMin = wMax * 0.32;
    const out = [];
    for (let i = 0; i < c.length - 1; i++) {
      const t = i / (c.length - 2);
      const w = wMin + (wMax - wMin) * Math.pow(t, 0.8);
      const desde = Math.max(0, i - 1), hasta = Math.min(c.length, i + 3);
      out.push({ d: trazo(c.slice(desde, hasta)), w, dash: '', tramo: true });
    }
    return out;
  };
  const rios = [
    ...imperio.features.filter((x) => x.properties.tipo === 'frontera').map((f) => ({ d: trazo(f.geometry.coordinates), w: (creciente ? 118 : 62) * k, dash: '' })),
    ...rutas.features.filter((f) => f.geometry.type === 'LineString' && f.geometry.coordinates.length && f.properties.rango !== 'principal')
      .map((f) => ({ d: trazo(f.geometry.coordinates), w: anchoRuta(f.properties.rango), dash: f.properties.rango === 'oculto' ? ` stroke-dasharray="${26 * k} ${18 * k}"` : '' })),
    ...rutas.features.filter((f) => f.properties.rango === 'principal').flatMap(tramosRioGrande),
  ];
  for (const r of rios) s.push(`<path d="${r.d}" fill="none" stroke="${PALETA.tumbaga}" stroke-opacity="0.55" stroke-width="${r.w + 3 * k}" stroke-linejoin="round" stroke-linecap="round"${r.dash}/>`);
  for (const r of rios) s.push(`<path d="${r.d}" fill="none" stroke="${agua}" stroke-width="${r.w}" stroke-linejoin="round" stroke-linecap="round"${r.dash}/>`);
  // Línea de corriente en el río de la frontera y en el río grande.
  const corrientes = [
    ...imperio.features.filter((x) => x.properties.tipo === 'frontera').map((f) => trazo(f.geometry.coordinates)),
    ...rutas.features.filter((f) => f.properties.rango === 'principal').map((f) => trazo(f.geometry.coordinates)),
  ];
  for (const d of corrientes) s.push(`<path d="${d}" fill="none" stroke="${PALETA.hueso}" stroke-opacity="0.18" stroke-width="${1.2 * k}" stroke-dasharray="${40 * k} ${28 * k}"/>`);
  // Islas y playas.
  for (const f of hidro.features.filter(visible)) {
    const st = f.properties.subtipo, pts = poligono(f.geometry.coordinates[0]);
    if (st === 'isla') s.push(`<polygon points="${pts}" fill="url(#selva)" stroke="${PALETA.tumbaga}" stroke-width="${1.5 * k}" stroke-opacity="0.6"/>`);
    else if (st === 'playa') s.push(`<polygon points="${pts}" fill="${PALETA.arena}"/>`);
  }
  // La raya de la frontera sobre su río.
  for (const f of imperio.features.filter((x) => x.properties.tipo === 'frontera')) {
    s.push(`<path d="${trazo(f.geometry.coordinates)}" fill="none" stroke="${PALETA.tumbaga}" stroke-width="${6 * k}" stroke-dasharray="${40 * k} ${26 * k}" stroke-linecap="round"/>`);
  }
  // Retícula fina de 0,25°.
  for (let lon = MUNDO.oeste; lon <= MUNDO.este + 1e-9; lon += 0.25) {
    const x = P(lon, MUNDO.norte).px;
    s.push(`<line x1="${x}" y1="0" x2="${x}" y2="${ALTO}" stroke="${PALETA.hueso}" stroke-opacity="0.09" stroke-width="${1.2 * k}"/>`);
  }
  for (let lat = MUNDO.sur; lat <= MUNDO.norte + 1e-9; lat += 0.25) {
    const y = P(MUNDO.oeste, lat).py;
    s.push(`<line x1="0" y1="${y}" x2="${ANCHO}" y2="${y}" stroke="${PALETA.hueso}" stroke-opacity="0.09" stroke-width="${1.2 * k}"/>`);
  }
  // Grano de piedra sobre todo, y el marco de tocapu.
  // El grano de piedra se añade después con sharp: el filtro SVG triplica el tiempo.
  const marco = 10 * k;
  s.push(`<rect x="0" y="0" width="${ANCHO}" height="${marco}" fill="url(#tocapu)"/>`);
  s.push(`<rect x="0" y="${ALTO - marco}" width="${ANCHO}" height="${marco}" fill="url(#tocapu)"/>`);
  s.push(`<rect x="0" y="0" width="${marco}" height="${ALTO}" fill="${PALETA.tumbaga}"/>`);
  s.push(`<rect x="${ANCHO - marco}" y="0" width="${marco}" height="${ALTO}" fill="${PALETA.tumbaga}"/>`);
  s.push('</svg>');

  await mkdir(path.dirname(salida), { recursive: true });
  let imagen = sharp(Buffer.from(s.join('\n')), { limitInputPixels: false });
  if (grano) {
    // Ruido gaussiano en gris, mezclado en «overlay» con poca opacidad: grano de piedra.
    const ruido = await sharp({ create: { width: ANCHO, height: ALTO, channels: 3, noise: { type: 'gaussian', mean: 128, sigma: 22 } }, limitInputPixels: false })
      .joinChannel(Buffer.alloc(ANCHO * ALTO, 40), { raw: { width: ANCHO, height: ALTO, channels: 1 } })
      .png({ compressionLevel: 0 }).toBuffer();
    imagen = sharp(await imagen.png({ compressionLevel: 0 }).toBuffer(), { limitInputPixels: false })
      .composite([{ input: ruido, blend: 'overlay' }]);
  }
  await imagen.png({ compressionLevel: 6 }).toFile(salida);
  return salida;
}

const invocado = process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname;
if (invocado) {
  const i = process.argv.indexOf('--ancho');
  const ancho = i > 0 ? Number(process.argv[i + 1]) : 8192;
  const grano = !process.argv.includes('--sin-grano');
  for (const est of MUNDO.estaciones) {
    const t = Date.now();
    const salida = path.join('mapas', `grabado_${est}.png`);
    await generarGrabado(est, salida, { ancho, grano });
    console.log(`→ ${salida} (${ancho}×${ancho / 2}, ${((Date.now() - t) / 1000).toFixed(1)} s)`);
  }
}
