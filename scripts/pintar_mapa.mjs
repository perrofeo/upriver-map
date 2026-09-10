#!/usr/bin/env node
/**
 * pintar_mapa.mjs — pinta el mapa base como ilustración de cuento con Z-Image-Turbo +
 * Fun Union ControlNet (canny) en Comfy Cloud, a partir del mapa grabado que dibuja
 * `mapa_grabado.mjs`. El canny fija la geometría (río, cochas, raya, retícula) y el
 * prompt pone el estilo. Decisión de Igor (2026-09-10): «vamos con la 2», tinta y acuarela.
 *
 * Uso:
 *   node scripts/pintar_mapa.mjs vaciante            # → mapas/vaciante.png (4096×2048)
 *   node scripts/pintar_mapa.mjs creciente
 *   node scripts/pintar_mapa.mjs vaciante --salida mapas/pruebas/vaciante_cuento.png
 *   node scripts/pintar_mapa.mjs vaciante --trozos 3,12     # prueba: trozos sueltos en mapas/pruebas/
 *   node scripts/pintar_mapa.mjs vaciante --ciudad          # prueba: solo el recuadro de la ciudad
 *   node scripts/pintar_mapa.mjs creciente --armonizar      # solo la mezcla vaciante→creciente, sin nube
 *   node scripts/pintar_mapa.mjs creciente --intermedias    # crecida_33 y crecida_66 desde las dos pinturas, sin nube
 *
 * Cómo: el grabado de 8192×4096 se corta en 5×3 trozos de 2048 con solape (paso 1536 / 1024),
 * cada trozo se reduce a 1024 (lo que procesa el grafo), se manda a la nube y las 15 salidas
 * se cosen en un lienzo de 4096×2048 con fundido lineal en los solapes. Encima se vuelve a
 * poner el marco de tocapu del grabado. `teselas.mjs` corta el resultado si existe
 * `mapas/<estación>.png` (nivel máximo 3 para 4096 px).
 *
 * Clave: variable COMFYUI_API_KEY o `.mcp.json` de AI_FILMS (mcpServers.comfyui-cloud.env).
 * La plantilla del grafo es `scripts/plantillas/zimage_fun_controlnet_api.json`.
 */
import { readFile, writeFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { generarGrabado } from './mapa_grabado.mjs';
import { coordenadaAPixel, MUNDO } from '../src/mundo.js';
const MUNDO_PASOS = MUNDO.pasosCrecida;

const BASE = 'https://cloud.comfy.org';
const RAIZ = new URL('..', import.meta.url);
const TROZO = 2048, PASO_X = 1536, PASO_Y = 1024, ANCHO = 8192, ALTO = 4096;
const SALIDA_TROZO = 1024; // el grafo reduce a 1024 y devuelve 1024
// Margen de tierra alrededor del control: sin él, el modelo pinta una «línea de árboles» oscura
// en el borde de los trozos del borde, como si el mapa acabara ahí. Se recorta al final.
const MARGEN = 512, TIERRA = '#33402a';
const ESCALA = SALIDA_TROZO / TROZO;

// El prompt describe SOLO textura y agua: la estructura la pone el canny del mapa de control.
// Nada de colinas, ciudades ni caminos: con retícula y tramas el modelo se los inventaba por todo el mapa.
export const PROMPT_CUENTO = 'Storybook map illustration in ink and watercolour on dark parchment, top-down view. The whole land is one unbroken dense Amazon jungle drawn as clusters of little hand-drawn trees, palms and ferns with soft wash shading, the same dark olive tone everywhere, the canopy covering everything. A meandering river in dusty blue with a few tiny canoes and a pink river dolphin peeking out of the water. Whimsical, hand-drawn feel, muted earthy palette, dark background.';
const SEMILLA = 62;
// Los trozos donde cae la ciudad llevan además la ciudad en el prompt (canon: UCRONIA_INTEGRACION.md).
export const PROMPT_CIUDAD = PROMPT_CUENTO.replace('Whimsical,', 'Small oxbow lakes of dark black water. On the river bank, inside its walls, a walled Andean city seen from above: stepped stone pyramids with gleaming golden domes, terraces and plazas, tall conical adobe smelting towers with thin plumes of smoke, stone docks with dark bronze machines, drawn in the same ink and watercolour. Whimsical,');

async function clave() {
  if (process.env.COMFYUI_API_KEY) return process.env.COMFYUI_API_KEY;
  const mcp = JSON.parse(await readFile(new URL('../../.mcp.json', RAIZ), 'utf8'));
  return mcp.mcpServers['comfyui-cloud'].env.COMFYUI_API_KEY;
}

async function api(key, metodo, ruta, { body, form, redirect } = {}) {
  const r = await fetch(BASE + ruta, {
    method: metodo,
    headers: { 'X-API-Key': key, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: form || (body ? JSON.stringify(body) : undefined),
    redirect: redirect ? 'manual' : 'follow',
  });
  if (redirect) return r.headers.get('location');
  if (!r.ok) throw new Error(`${metodo} ${ruta}: ${r.status} ${(await r.text()).slice(0, 300)}`);
  return r.json();
}

async function subir(key, png, nombre) {
  const form = new FormData();
  form.append('file', new Blob([png], { type: 'image/png' }), nombre);
  form.append('overwrite', 'true');
  form.append('type', 'input');
  const r = await api(key, 'POST', '/api/upload/image', { form });
  return r.name;
}

/**
 * Espera a que todos los jobs acaben. Un job que sigue «pending» más de `pendienteMaxS` segundos
 * (la nube a veces no lo asigna nunca) se cancela y se relanza con `relanzar(id)`, que devuelve el
 * id nuevo; `ids` se actualiza en sitio para que el que llama baje la salida del id bueno.
 */
async function esperar(key, ids, { cadaMs = 8000, maxMin = 30, pendienteMaxS = 150, relanzar = null, log = console.log } = {}) {
  const fin = Date.now() + maxMin * 60_000;
  const estado = {}, desde = {};
  while (Date.now() < fin) {
    let pendientes = 0;
    for (let j = 0; j < ids.length; j++) {
      const id = ids[j];
      if (estado[id] && /success|completed|failed|error|cancelled/.test(estado[id])) continue;
      const s = await api(key, 'GET', `/api/job/${id}/status`).catch(() => ({ status: '?' }));
      estado[id] = s.status;
      if (s.status === 'pending' || s.status === 'queued') {
        desde[id] ??= Date.now();
        if (relanzar && Date.now() - desde[id] > pendienteMaxS * 1000) {
          log(`  ⟳ ${id.slice(0, 8)} lleva ${Math.round((Date.now() - desde[id]) / 1000)} s sin asignar: se cancela y se relanza`);
          await api(key, 'POST', `/api/job/${id}/cancel`, { body: {} }).catch(() => api(key, 'DELETE', `/api/job/${id}`).catch(() => null));
          const nuevo = await relanzar(id);
          estado[id] = 'cancelled';
          ids[j] = nuevo;
          pendientes++;
          continue;
        }
      }
      if (!/success|completed|failed|error|cancelled/.test(s.status)) pendientes++;
      if (/failed|error/.test(s.status)) console.error(`  ✖ ${id.slice(0, 8)}: ${String(s.error_message || '').slice(0, 200)}`);
    }
    if (!pendientes) return estado;
    await new Promise((r) => setTimeout(r, cadaMs));
  }
  throw new Error('tiempo agotado esperando a la nube');
}

async function bajarSalida(key, id) {
  const job = await api(key, 'GET', `/api/jobs/${id}`);
  const imagen = Object.values(job.outputs || {}).flatMap((o) => o.images || []).find((i) => i.type === 'output');
  if (!imagen) throw new Error(`job ${id} sin salida`);
  const url = await api(key, 'GET', `/api/view?filename=${encodeURIComponent(imagen.filename)}&type=output`, { redirect: true });
  const r = await fetch(url);
  if (!r.ok) throw new Error(`descarga ${imagen.filename}: ${r.status}`);
  return Buffer.from(await r.arrayBuffer());
}

/**
 * El recuadro de la ciudad: un trozo de control de 1024 px (a escala 8192, ~55 km) centrado en la
 * ciudad, sin reducir, con el prompt de la ciudad. Al doble de zoom la muralla y las pirámides son
 * grandes y el modelo las obedece; con la huella pequeña dentro de un trozo normal, pintaba la ciudad
 * donde le apetecía. Devuelve el PNG de 1024 px pintado.
 */
async function pintarRecuadroCiudad(key, controlBuf, plantilla, cpx, prompt, semilla, log) {
  const L = 1024;
  const left = Math.round(cpx.px + MARGEN - L / 2), top = Math.round(cpx.py + MARGEN - L / 2);
  const png = await sharp(controlBuf, { limitInputPixels: false }).extract({ left, top, width: L, height: L }).png().toBuffer();
  const nombre = await subir(key, png, 'upriver_ciudad.png');
  const grafo = JSON.parse(JSON.stringify(plantilla));
  grafo['58'].inputs.image = nombre;
  grafo['57'].inputs.low_threshold = 0.2; grafo['57'].inputs.high_threshold = 0.45;
  grafo['70:45'].inputs.text = prompt;
  grafo['70:44'].inputs.seed = semilla;
  grafo['9'].inputs.filename_prefix = 'upriver_ciudad';
  const lanzar = async () => {
    const r = await api(key, 'POST', '/api/prompt', { body: { prompt: grafo } });
    if (r.node_errors && Object.keys(r.node_errors).length) throw new Error('errores de nodo (ciudad): ' + JSON.stringify(r.node_errors).slice(0, 400));
    return r.prompt_id;
  };
  const ids = [await lanzar()];
  log(`  recuadro de la ciudad → ${ids[0].slice(0, 8)}`);
  const estado = await esperar(key, ids, { relanzar: lanzar, log });
  if (!/success|completed/.test(estado[ids[0]])) throw new Error('el recuadro de la ciudad falló');
  return { png: await bajarSalida(key, ids[0]), left, top, L };
}

/**
 * Armoniza la creciente con la vaciante: las dos estaciones se pintan por separado y el modelo se
 * inventa cosas distintas en cada una (una laguna que existe en una y no en la otra: aviso de Igor,
 * 2026-09-10). La creciente definitiva es la pintura de vaciante salvo donde el agua cambia de verdad
 * (río más ancho, bosque inundado), que se toma de la pintura de creciente con un borde fundido.
 * La máscara sale de la diferencia entre los dos mapas de control, dilatada y suavizada.
 */
export async function armonizarCreciente({ log = console.log } = {}) {
  const vac = new URL('mapas/vaciante.png', RAIZ).pathname, cre = new URL('mapas/creciente.png', RAIZ).pathname;
  const cVac = new URL('mapas/control_vaciante.png', RAIZ).pathname, cCre = new URL('mapas/control_creciente.png', RAIZ).pathname;
  for (const f of [vac, cre, cVac, cCre]) await access(f).catch(() => { throw new Error(`falta ${f}`); });
  const meta = await sharp(vac).metadata();
  const W = meta.width, H = meta.height;
  const raw = (f) => sharp(f, { limitInputPixels: false }).resize(W, H).removeAlpha().raw().toBuffer();
  const [a, b, ca, cb] = await Promise.all([raw(vac), raw(cre), raw(cVac), raw(cCre)]);
  // 1) diferencia de controles → máscara binaria
  const dif = Buffer.alloc(W * H);
  for (let k = 0; k < W * H; k++) {
    const d = Math.abs(ca[k * 3] - cb[k * 3]) + Math.abs(ca[k * 3 + 1] - cb[k * 3 + 1]) + Math.abs(ca[k * 3 + 2] - cb[k * 3 + 2]);
    dif[k] = d > 30 ? 255 : 0;
  }
  // 2) dilatar (desenfoque + umbral) y suavizar el borde
  const dil = await sharp(dif, { raw: { width: W, height: H, channels: 1 } }).blur(6).threshold(40).blur(5).raw().toBuffer();
  // 3) mezcla
  const out = Buffer.alloc(W * H * 3);
  let cambiados = 0;
  for (let k = 0; k < W * H; k++) {
    const al = dil[k] / 255;
    if (al > 0.5) cambiados++;
    for (let c = 0; c < 3; c++) out[k * 3 + c] = a[k * 3 + c] * (1 - al) + b[k * 3 + c] * al;
  }
  await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 9 }).toFile(cre);
  log(`→ ${cre} armonizada con la vaciante (${(100 * cambiados / (W * H)).toFixed(1)} % del mapa viene de la pintura de creciente)`);
  return cre;
}

/**
 * Estados intermedios de la crecida (mapas/crecida_33.png, crecida_66.png) para que el deslizador
 * haga crecer el agua desde el cauce: la máscara de diferencia entre controles se desenfoca mucho y
 * se umbraliza alto (solo el corazón del agua) para el paso bajo, y más bajo para el paso alto.
 * Salen de las dos pinturas, sin nube; se regeneran en el build (teselas.mjs) y no se versionan.
 */
export async function generarIntermedias({ log = console.log } = {}) {
  const vac = new URL('mapas/vaciante.png', RAIZ).pathname, cre = new URL('mapas/creciente.png', RAIZ).pathname;
  const cVac = new URL('mapas/control_vaciante.png', RAIZ).pathname, cCre = new URL('mapas/control_creciente.png', RAIZ).pathname;
  for (const f of [vac, cre, cVac, cCre]) await access(f).catch(() => { throw new Error(`falta ${f}`); });
  const meta = await sharp(vac).metadata();
  const W = meta.width, H = meta.height;
  const raw = (f) => sharp(f, { limitInputPixels: false }).resize(W, H).removeAlpha().raw().toBuffer();
  const [a, b, ca, cb] = await Promise.all([raw(vac), raw(cre), raw(cVac), raw(cCre)]);
  const dif = Buffer.alloc(W * H);
  for (let k = 0; k < W * H; k++) {
    const d = Math.abs(ca[k * 3] - cb[k * 3]) + Math.abs(ca[k * 3 + 1] - cb[k * 3 + 1]) + Math.abs(ca[k * 3 + 2] - cb[k * 3 + 2]);
    dif[k] = d > 30 ? 255 : 0;
  }
  // «profundidad»: 255 en el corazón del agua nueva, cayendo hacia fuera
  const prof = await sharp(dif, { raw: { width: W, height: H, channels: 1 } }).blur(18).raw().toBuffer();
  const salidas = [];
  for (const paso of MUNDO_PASOS.filter((p) => p.v < 1)) {
    const umbral = Math.round(255 * (1 - paso.v) * 0.9);
    const bin = Buffer.alloc(W * H);
    for (let k = 0; k < W * H; k++) bin[k] = prof[k] >= umbral ? 255 : 0;
    const al = await sharp(bin, { raw: { width: W, height: H, channels: 1 } }).blur(4).raw().toBuffer();
    const out = Buffer.alloc(W * H * 3);
    for (let k = 0; k < W * H; k++) { const t = al[k] / 255; for (let c = 0; c < 3; c++) out[k * 3 + c] = a[k * 3 + c] * (1 - t) + b[k * 3 + c] * t; }
    const destino = new URL(`mapas/${paso.id}.png`, RAIZ).pathname;
    await sharp(out, { raw: { width: W, height: H, channels: 3 } }).png({ compressionLevel: 6 }).toFile(destino);
    log(`→ ${destino} (crecida al ${Math.round(paso.v * 100)} %)`);
    salidas.push(destino);
  }
  return salidas;
}

/** Máscara de fundido lineal en los bordes que solapan (no en los bordes del mapa). */
function pesos(w, h, bordes, solapeX, solapeY) {
  const p = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let py = 1;
    if (!bordes.arriba && y < solapeY) py = Math.min(py, (y + 1) / solapeY);
    if (!bordes.abajo && y >= h - solapeY) py = Math.min(py, (h - y) / solapeY);
    for (let x = 0; x < w; x++) {
      let px = 1;
      if (!bordes.izq && x < solapeX) px = Math.min(px, (x + 1) / solapeX);
      if (!bordes.der && x >= w - solapeX) px = Math.min(px, (w - x) / solapeX);
      p[y * w + x] = px * py;
    }
  }
  return p;
}

export async function pintarMapa(estacion, { salida, prompt = PROMPT_CUENTO, semilla = SEMILLA, solo = null, soloCiudad = false, log = console.log } = {}) {
  const key = await clave();
  const grabado = new URL(`mapas/grabado_${estacion}.png`, RAIZ);
  await access(grabado).catch(() => { throw new Error(`falta ${grabado.pathname}: genera el grabado antes (node scripts/mapa_grabado.mjs)`); });
  // Mapa de control limpio (solo formas), siempre regenerado desde los datos.
  const controlPng = new URL(`mapas/control_${estacion}.png`, RAIZ).pathname;
  log(`${estacion}: dibujando el mapa de control…`);
  await generarGrabado(estacion, controlPng, { ancho: ANCHO, control: true });
  const plantilla = JSON.parse(await readFile(new URL('plantillas/zimage_fun_controlnet_api.json', import.meta.url), 'utf8'));
  const meta = await sharp(controlPng).metadata();
  if (meta.width !== ANCHO || meta.height !== ALTO) throw new Error(`el grabado debe ser ${ANCHO}×${ALTO}, es ${meta.width}×${meta.height}`);
  const WP = ANCHO + 2 * MARGEN, HP = ALTO + 2 * MARGEN;
  const controlBuf = await sharp(controlPng).extend({ top: MARGEN, bottom: MARGEN, left: MARGEN, right: MARGEN, background: TIERRA }).png().toBuffer();

  // 1) trozos sobre el control con margen: el primero en 0, el último a ras del final, paso ≤ PASO
  const posiciones = (total, paso) => { const n = Math.ceil((total - TROZO) / paso) + 1; return Array.from({ length: n }, (_, i) => Math.round(i * (total - TROZO) / (n - 1))); };
  let trozos = [];
  for (const y of posiciones(HP, PASO_Y)) for (const x of posiciones(WP, PASO_X)) trozos.push({ x, y });
  // ¿En qué trozos cae la ciudad? Esos llevan el prompt con la ciudad.
  const asent = JSON.parse(await readFile(new URL('src/data/upriver/asentamientos.geojson', RAIZ), 'utf8'));
  const ciudad = asent.features.find((f) => f.properties.tipo === 'asentamiento' && f.properties.lengua === 'qu' && !f.properties.parte_de);
  const cpx = ciudad ? coordenadaAPixel(ciudad.geometry.coordinates[0], ciudad.geometry.coordinates[1], ANCHO, ALTO) : null;
  const holgura = 220; // px a 8192: que la ciudad no quede cortada por el borde del trozo
  trozos = trozos.map((t, i) => ({ ...t, i, ciudad: false }));
  if (soloCiudad) {
    if (!cpx) throw new Error('no hay ciudad en los datos');
    const rc = await pintarRecuadroCiudad(key, controlBuf, plantilla, cpx, PROMPT_CIUDAD, semilla + 100, log);
    const destino = new URL('mapas/pruebas/recuadro_ciudad.png', RAIZ).pathname;
    await mkdir(path.dirname(destino), { recursive: true });
    await writeFile(destino, rc.png);
    await sharp(controlBuf, { limitInputPixels: false }).extract({ left: rc.left, top: rc.top, width: rc.L, height: rc.L }).png().toFile(destino.replace('.png', '_control.png'));
    log(`→ ${destino}`);
    return null;
  }
  if (solo) trozos = trozos.filter((t) => solo.includes(t.i));
  log(`${estacion}: ${trozos.length} trozos de ${TROZO} px (paso ${PASO_X}×${PASO_Y})`);

  // 2) subir y lanzar
  const ids = [], grafos = {};
  const lanzar = async (grafo) => {
    const r = await api(key, 'POST', '/api/prompt', { body: { prompt: grafo } });
    if (r.node_errors && Object.keys(r.node_errors).length) throw new Error('errores de nodo: ' + JSON.stringify(r.node_errors).slice(0, 400));
    grafos[r.prompt_id] = grafo;
    return r.prompt_id;
  };
  const relanzar = (id) => lanzar(grafos[id]);
  for (const [i, t] of trozos.entries()) {
    const png = await sharp(controlBuf).extract({ left: t.x, top: t.y, width: TROZO, height: TROZO }).resize(SALIDA_TROZO, SALIDA_TROZO, { kernel: 'lanczos3' }).png().toBuffer();
    const nombre = await subir(key, png, `upriver_${estacion}_${i}.png`);
    const grafo = JSON.parse(JSON.stringify(plantilla));
    grafo['58'].inputs.image = nombre;
    grafo['57'].inputs.low_threshold = 0.25; grafo['57'].inputs.high_threshold = 0.5;
    grafo['70:45'].inputs.text = t.ciudad ? PROMPT_CIUDAD : prompt;
    grafo['70:44'].inputs.seed = semilla + (t.i ?? i); // una semilla por trozo: con la misma, los trozos de solo selva repiten el mismo dibujo
    grafo['9'].inputs.filename_prefix = `upriver_${estacion}_${i}`;
    const id = await lanzar(grafo);
    ids.push(id);
    log(`  trozo ${i} (${t.x},${t.y}) → ${id.slice(0, 8)}`);
  }

  // 3) esperar y bajar
  const estado = await esperar(key, ids, { relanzar, log });
  const fallidos = ids.filter((id) => !/success|completed/.test(estado[id]));
  if (fallidos.length) throw new Error(`${fallidos.length} trozos fallidos: ${fallidos.map((x) => x.slice(0, 8)).join(', ')}`);

  if (solo) {
    // Prueba: solo se guardan los trozos sueltos, sin coser.
    for (const [j, t] of trozos.entries()) {
      const destino = new URL(`mapas/pruebas/trozo_${estacion}_${t.i}.png`, RAIZ).pathname;
      await mkdir(path.dirname(destino), { recursive: true });
      await writeFile(destino, await bajarSalida(key, ids[j]));
      log(`→ ${destino}`);
    }
    return null;
  }

  // 4) coser con fundido
  const W = WP * ESCALA, H = HP * ESCALA, w = SALIDA_TROZO;
  const xs = [...new Set(trozos.map((t) => t.x))].sort((a, b) => a - b), ys = [...new Set(trozos.map((t) => t.y))].sort((a, b) => a - b);
  const solX = Math.round((TROZO - (xs[1] - xs[0])) * ESCALA), solY = Math.round((TROZO - (ys[1] - ys[0])) * ESCALA);
  const acum = new Float32Array(W * H * 3), suma = new Float32Array(W * H);
  // Igualación de tono: media y desviación por canal de cada trozo llevadas a las del trozo de
  // referencia (la ciudad, índice REF), para que el mosaico no cambie de luz de un trozo a otro.
  const REF = Math.min(10, trozos.length - 1);
  const estad = (d) => { const m = [0, 0, 0], v = [0, 0, 0], n = d.length / 3; for (let k = 0; k < d.length; k += 3) { m[0] += d[k]; m[1] += d[k + 1]; m[2] += d[k + 2]; } m[0] /= n; m[1] /= n; m[2] /= n; for (let k = 0; k < d.length; k += 3) { v[0] += (d[k] - m[0]) ** 2; v[1] += (d[k + 1] - m[1]) ** 2; v[2] += (d[k + 2] - m[2]) ** 2; } return { m, s: v.map((x) => Math.sqrt(x / n) || 1) }; };
  const crudos = [];
  for (const [i] of trozos.entries()) {
    const png = await bajarSalida(key, ids[i]);
    crudos.push(await sharp(png).resize(w, w).removeAlpha().raw().toBuffer({ resolveWithObject: true }));
  }
  const ref = estad(crudos[REF].data);
  for (const [i, t] of trozos.entries()) {
    const { data, info } = crudos[i];
    const e = estad(data);
    for (let k = 0; k < data.length; k += 3) for (let c = 0; c < 3; c++) data[k + c] = Math.max(0, Math.min(255, (data[k + c] - e.m[c]) / e.s[c] * ref.s[c] + ref.m[c]));
    const bordes = { izq: t.x === 0, der: t.x + TROZO >= WP, arriba: t.y === 0, abajo: t.y + TROZO >= HP };
    const p = pesos(info.width, info.height, bordes, solX, solY);
    const ox = Math.round(t.x * ESCALA), oy = Math.round(t.y * ESCALA);
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      const k = y * info.width + x, K = (oy + y) * W + (ox + x);
      acum[K * 3] += data[k * 3] * p[k]; acum[K * 3 + 1] += data[k * 3 + 1] * p[k]; acum[K * 3 + 2] += data[k * 3 + 2] * p[k];
      suma[K] += p[k];
    }
    log(`  cosido trozo ${i}`);
  }
  const out = Buffer.alloc(W * H * 3);
  for (let K = 0; K < W * H; K++) { const s = suma[K] || 1; out[K * 3] = acum[K * 3] / s; out[K * 3 + 1] = acum[K * 3 + 1] / s; out[K * 3 + 2] = acum[K * 3 + 2] / s; }
  // El recuadro de la ciudad, fundido encima con máscara radial (lleno hasta 0,55 del radio, se apaga en el borde).
  if (cpx) {
    const rc = await pintarRecuadroCiudad(key, controlBuf, plantilla, cpx, PROMPT_CIUDAD, semilla + 100, log);
    const l = Math.round(rc.L * ESCALA), ox = Math.round(rc.left * ESCALA), oy = Math.round(rc.top * ESCALA);
    const { data } = await sharp(rc.png).resize(l, l).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const e = estad(data);
    for (let k = 0; k < data.length; k += 3) for (let ch = 0; ch < 3; ch++) data[k + ch] = Math.max(0, Math.min(255, (data[k + ch] - e.m[ch]) / e.s[ch] * ref.s[ch] + ref.m[ch]));
    const c = l / 2, R = l / 2;
    for (let y = 0; y < l; y++) for (let x = 0; x < l; x++) {
      const d = Math.hypot(x - c, y - c) / R;
      const a = d < 0.55 ? 1 : d > 1 ? 0 : 1 - (d - 0.55) / 0.45;
      if (a <= 0) continue;
      const K = ((oy + y) * W + (ox + x)) * 3, k = (y * l + x) * 3;
      for (let ch = 0; ch < 3; ch++) out[K + ch] = out[K + ch] * (1 - a) + data[k + ch] * a;
    }
    log('  recuadro de la ciudad fundido');
  }

  // 5) el marco de tocapu del grabado, encima (arriba y abajo)
  const marco = Math.round(40 * ESCALA); // 10 * k con k = 4 a 8192 px
  const banda = (top) => sharp(grabado.pathname).extract({ left: 0, top, width: ANCHO, height: 40 }).resize(Math.round(ANCHO * ESCALA), marco).png().toBuffer();
  const destino = salida || new URL(`mapas/${estacion}.png`, RAIZ).pathname;
  await mkdir(path.dirname(destino), { recursive: true });
  const m = Math.round(MARGEN * ESCALA), WF = Math.round(ANCHO * ESCALA), HF = Math.round(ALTO * ESCALA);
  const recortado = await sharp(out, { raw: { width: W, height: H, channels: 3 } }).extract({ left: m, top: m, width: WF, height: HF }).png().toBuffer();
  await sharp(recortado)
    .composite([{ input: await banda(0), top: 0, left: 0 }, { input: await banda(ALTO - 40), top: HF - marco, left: 0 }])
    .png({ compressionLevel: 9 }).toFile(destino);
  log(`→ ${destino} (${WF}×${HF})`);
  if (estacion === 'creciente' && !salida) await armonizarCreciente({ log });
  return destino;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const est = process.argv[2];
  const iSalida = process.argv.indexOf('--salida');
  const iSolo = process.argv.indexOf('--trozos');
  const soloCiudad = process.argv.includes('--ciudad');
  if (process.argv.includes('--armonizar')) { await armonizarCreciente(); process.exit(0); }
  if (process.argv.includes('--intermedias')) { await generarIntermedias(); process.exit(0); }
  if (!est) { console.error('uso: node scripts/pintar_mapa.mjs <vaciante|creciente> [--salida fichero.png]'); process.exit(1); }
  await pintarMapa(est, { salida: iSalida > 0 ? process.argv[iSalida + 1] : undefined, solo: iSolo > 0 ? process.argv[iSolo + 1].split(',').map(Number) : null, soloCiudad });
}
