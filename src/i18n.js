/**
 * i18n.js — idioma de la interfaz y de los datos.
 *
 * El idioma sale de `?lang=es|en|eu` (lo pasa el iframe de la web), si no
 * del navegador, y si no es castellano. Todo texto de datos puede ser una
 * cadena (castellano) o un objeto `{ es, en, eu }`; `texto()` devuelve la
 * lengua activa con el castellano como respaldo. El diccionario de interfaz
 * está completo en castellano; las otras lenguas se rellenan al final,
 * cuando el contenido esté cerrado (decisión de Igor, 2026-09-09).
 */

export const IDIOMAS = ['es', 'en', 'eu'];

function detectar() {
  const param = new URLSearchParams(window.location.search).get('lang');
  if (IDIOMAS.includes(param)) return param;
  const nav = (navigator.language || 'es').slice(0, 2).toLowerCase();
  return IDIOMAS.includes(nav) ? nav : 'es';
}

export const idioma = typeof window !== 'undefined' ? detectar() : 'es';

const DICC = {
  es: {
    titulo: 'Upriver',
    subtitulo: 'El mapa del mundo',
    'vista.imperio': 'El imperio',
    'vista.rio': 'El río',
    'panel.capas': 'Qué se ve',
    'panel.estacion': 'Estación',
    'estacion.vaciante': 'Vaciante',
    'estacion.creciente': 'Creciente',
    'estacion.aria': 'Estación: vaciante a creciente',
    'panel.mirada': 'Mirada',
    'mirada.brillo': 'Brillo',
    'mirada.nitidez': 'Nitidez',
    'mirada.brillo.aria': 'Intensidad del brillo',
    'mirada.nitidez.aria': 'Intensidad de la nitidez',
    'estilo.normal': 'Natural',
    'estilo.retro': 'Rejilla',
    'estilo.surveillance': 'Nocturna',
    'estilo.thermal': 'Térmica',
    'estilo.anime': 'Trazo',
    'estilo.noir': 'Tinta',
    'estilo.snow': 'Ceniza',
    'enlace.copiar': 'Copiar enlace',
    'enlace.copiado': 'Enlace copiado',
    'enlace.fallo': 'No se pudo copiar el enlace',
    'movil.panel': 'Capas y mirada',
    'movil.cerrar': 'Cerrar',
    'carga.globo': 'Preparando el globo…',
    'carga.configurando': 'Configurando el globo…',
    'carga.mapa': 'Cargando el mapa…',
    'carga.restaurando': 'Restaurando la vista compartida…',
    'carga.error': 'Error',
    'quipu.play': 'Reproducir el recorrido de la serie',
    'quipu.pausa': 'Pausar',
    'quipu.minuto': 'Minuto del episodio',
    'quipu.velocidad': 'Velocidad de reproducción',
    'quipu.tiempoReal': 'tiempo real',
    'quipu.veces': '{n} veces más rápido',
    'quipu.ver': 'Ver el episodio aquí',
    'quipu.ver.titulo': 'Abre el episodio en YouTube en este segundo',
    'quipu.hacia': 'hacia {lugar}',
    'quipu.episodio': 'Episodio {n}, {titulo}',
    'ficha.cerrar': 'Cerrar ficha',
    'ficha.enLaSerie': 'En la serie',
    'ficha.ir': 'Llevar el mapa a este momento',
    'ficha.todoElEpisodio': 'Todo el episodio',
    'ficha.tramo': '{desde} a {hasta}',
    'ficha.episodio': 'Episodio {n}, {titulo}',
    'ficha.ver': 'Ver',
    'ficha.ver.titulo': 'Ver este momento en YouTube',
    'ficha.soloEn': 'solo en {estacion}',
    'ficha.provisional': 'sitio provisional',
    'tipo.asentamiento': 'Asentamiento',
    'tipo.avanzada': 'Avanzada',
    'tipo.territorio': 'Territorio',
    'tipo.frontera': 'Frontera',
    'tipo.accidente': 'Accidente geográfico',
    'tipo.localizacion': 'Localización',
    'tipo.ruta': 'Ruta fluvial',
    'tipo.hidrografia': 'Agua',
    'faccion.kukama': 'kukama',
    'faccion.imperio': 'imperio',
    'faccion.comerciantes': 'comerciantes hispanohablantes',
    'faccion.null': 'sin determinar',
    'capa.hidrografia': 'Cochas, islas y bosque inundado',
    'capa.rutas': 'El río',
    'capa.imperio': 'El imperio',
    'capa.asentamientos': 'Asentamientos',
    'capa.accidentes': 'Accidentes geográficos',
    'capa.localizaciones': 'Localizaciones',
  },
  // Pendientes: se rellenan cuando el contenido esté cerrado. Lo que falte cae al castellano.
  en: {},
  eu: {},
};

/** Cadena de interfaz en la lengua activa, con castellano de respaldo y {parámetros}. */
export function t(clave, params = {}) {
  let s = DICC[idioma]?.[clave] ?? DICC.es[clave] ?? clave;
  for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

/** Texto de datos: cadena, o `{ es, en, eu }`; castellano de respaldo. */
export function texto(valor, lang = idioma) {
  if (valor == null) return '';
  if (typeof valor === 'string') return valor;
  if (typeof valor === 'object') return valor[lang] || valor.es || Object.values(valor).find((v) => typeof v === 'string' && v) || '';
  return String(valor);
}

/** Traduce los elementos con data-i18n / data-i18n-attr del documento. */
export function aplicarDom(raiz = document) {
  document.documentElement.lang = idioma;
  for (const el of raiz.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of raiz.querySelectorAll('[data-i18n-attr]')) {
    // data-i18n-attr="aria-label:clave;title:clave2"
    for (const par of el.dataset.i18nAttr.split(';')) {
      const [attr, clave] = par.split(':').map((x) => x.trim());
      if (attr && clave) el.setAttribute(attr, t(clave));
    }
  }
}

/** Dirección del mapa en otra lengua, conservando el estado del hash. */
export function urlEnIdioma(lang) {
  const url = new URL(window.location.href);
  url.searchParams.set('lang', lang);
  return url.href;
}
