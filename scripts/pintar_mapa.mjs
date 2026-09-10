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

async function esperar(key, ids, { cadaMs = 8000, maxMin = 30 } = {}) {
  const fin = Date.now() + maxMin * 60_000;
  const estado = {};
  while (Date.now() < fin) {
    let pendientes = 0;
    for (const id of ids) {
      if (estado[id] && /success|completed|failed|error|cancelled/.test(estado[id])) continue;
      const s = await api(key, 'GET', `/api/job/${id}/status`).catch(() => ({ status: '?' }));
      estado[id] = s.status;
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

export async function pintarMapa(estacion, { salida, prompt = PROMPT_CUENTO, semilla = SEMILLA, solo = null, log = console.log } = {}) {
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
  trozos = trozos.map((t, i) => ({ ...t, i }));
  if (solo) trozos = trozos.filter((t) => solo.includes(t.i));
  log(`${estacion}: ${trozos.length} trozos de ${TROZO} px (paso ${PASO_X}×${PASO_Y})`);

  // 2) subir y lanzar
  const ids = [];
  for (const [i, t] of trozos.entries()) {
    const png = await sharp(controlBuf).extract({ left: t.x, top: t.y, width: TROZO, height: TROZO }).resize(SALIDA_TROZO, SALIDA_TROZO, { kernel: 'lanczos3' }).png().toBuffer();
    const nombre = await subir(key, png, `upriver_${estacion}_${i}.png`);
    const grafo = JSON.parse(JSON.stringify(plantilla));
    grafo['58'].inputs.image = nombre;
    grafo['57'].inputs.low_threshold = 0.25; grafo['57'].inputs.high_threshold = 0.5;
    grafo['70:45'].inputs.text = prompt;
    grafo['70:44'].inputs.seed = semilla + (t.i ?? i); // una semilla por trozo: con la misma, los trozos de solo selva repiten el mismo dibujo
    grafo['9'].inputs.filename_prefix = `upriver_${estacion}_${i}`;
    const r = await api(key, 'POST', '/api/prompt', { body: { prompt: grafo } });
    if (r.node_errors && Object.keys(r.node_errors).length) throw new Error('errores de nodo: ' + JSON.stringify(r.node_errors).slice(0, 400));
    ids.push(r.prompt_id);
    log(`  trozo ${i} (${t.x},${t.y}) → ${r.prompt_id.slice(0, 8)}`);
  }

  // 3) esperar y bajar
  const estado = await esperar(key, ids);
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
  return destino;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const est = process.argv[2];
  const iSalida = process.argv.indexOf('--salida');
  const iSolo = process.argv.indexOf('--trozos');
  if (!est) { console.error('uso: node scripts/pintar_mapa.mjs <vaciante|creciente> [--salida fichero.png]'); process.exit(1); }
  await pintarMapa(est, { salida: iSalida > 0 ? process.argv[iSalida + 1] : undefined, solo: iSolo > 0 ? process.argv[iSolo + 1].split(',').map(Number) : null });
}
