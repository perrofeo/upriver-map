/**
 * i18n.js — idioma de la interfaz y de los datos.
 *
 * El idioma sale de `?lang=es|en|eu` (lo pasa el iframe de la web), si no
 * del navegador, y si no es castellano. Todo texto de datos puede ser una
 * cadena (castellano) o un objeto `{ es, en, eu }`; `texto()` devuelve la
 * lengua activa con el castellano como respaldo. El diccionario de interfaz
 * está en las tres lenguas (2026-09-10; el euskera lo revisa Igor). Lo que
 * falte en una lengua cae al castellano.
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
    'pagina.titulo': 'Upriver · mapa del mundo',
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
    'tipo.gran-rio': 'Gran río',
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
  en: {
    titulo: 'Upriver',
    subtitulo: 'The map of the world',
    'pagina.titulo': 'Upriver · map of the world',
    'vista.imperio': 'The empire',
    'vista.rio': 'The river',
    'panel.capas': 'What is shown',
    'panel.estacion': 'Season',
    'estacion.vaciante': 'Low water',
    'estacion.creciente': 'High water',
    'estacion.aria': 'Season: low water to high water',
    'panel.mirada': 'View',
    'mirada.brillo': 'Glow',
    'mirada.nitidez': 'Sharpness',
    'mirada.brillo.aria': 'Glow intensity',
    'mirada.nitidez.aria': 'Sharpness intensity',
    'estilo.normal': 'Natural',
    'estilo.retro': 'Grid',
    'estilo.surveillance': 'Night',
    'estilo.thermal': 'Thermal',
    'estilo.anime': 'Line',
    'estilo.noir': 'Ink',
    'estilo.snow': 'Ash',
    'enlace.copiar': 'Copy link',
    'enlace.copiado': 'Link copied',
    'enlace.fallo': 'The link could not be copied',
    'movil.panel': 'Layers and view',
    'movil.cerrar': 'Close',
    'carga.globo': 'Preparing the globe…',
    'carga.configurando': 'Setting up the globe…',
    'carga.mapa': 'Loading the map…',
    'carga.restaurando': 'Restoring the shared view…',
    'carga.error': 'Error',
    'quipu.play': 'Play the journey of the series',
    'quipu.pausa': 'Pause',
    'quipu.minuto': 'Minute of the episode',
    'quipu.velocidad': 'Playback speed',
    'quipu.tiempoReal': 'real time',
    'quipu.veces': '{n}× faster',
    'quipu.ver': 'Watch the episode here',
    'quipu.ver.titulo': 'Opens the episode on YouTube at this second',
    'quipu.hacia': 'towards {lugar}',
    'quipu.episodio': 'Episode {n}, {titulo}',
    'ficha.cerrar': 'Close card',
    'ficha.enLaSerie': 'In the series',
    'ficha.ir': 'Take the map to this moment',
    'ficha.todoElEpisodio': 'Whole episode',
    'ficha.tramo': '{desde} to {hasta}',
    'ficha.episodio': 'Episode {n}, {titulo}',
    'ficha.ver': 'Watch',
    'ficha.ver.titulo': 'Watch this moment on YouTube',
    'ficha.soloEn': 'only at {estacion}',
    'ficha.provisional': 'provisional site',
    'tipo.asentamiento': 'Settlement',
    'tipo.avanzada': 'Outpost',
    'tipo.territorio': 'Territory',
    'tipo.frontera': 'Frontier',
    'tipo.gran-rio': 'Great river',
    'tipo.accidente': 'Landform',
    'tipo.localizacion': 'Location',
    'tipo.ruta': 'River route',
    'tipo.hidrografia': 'Water',
    'faccion.kukama': 'Kukama',
    'faccion.imperio': 'empire',
    'faccion.comerciantes': 'Spanish-speaking traders',
    'faccion.null': 'undetermined',
    'capa.hidrografia': 'Cochas, islands and flooded forest',
    'capa.rutas': 'The river',
    'capa.imperio': 'The empire',
    'capa.asentamientos': 'Settlements',
    'capa.accidentes': 'Landforms',
    'capa.localizaciones': 'Locations',
  },
  // Euskera: escrito por mí con el vocabulario de los subtítulos y de la página del embed; Igor revisa.
  eu: {
    titulo: 'Upriver',
    subtitulo: 'Munduaren mapa',
    'pagina.titulo': 'Upriver · munduaren mapa',
    'vista.imperio': 'Inperioa',
    'vista.rio': 'Ibaia',
    'panel.capas': 'Zer ikusten den',
    'panel.estacion': 'Sasoia',
    'estacion.vaciante': 'Ur-behera',
    'estacion.creciente': 'Ur-goraldia',
    'estacion.aria': 'Sasoia: ur-beheratik ur-goraldira',
    'panel.mirada': 'Begirada',
    'mirada.brillo': 'Distira',
    'mirada.nitidez': 'Zorroztasuna',
    'mirada.brillo.aria': 'Distiraren intentsitatea',
    'mirada.nitidez.aria': 'Zorroztasunaren intentsitatea',
    'estilo.normal': 'Naturala',
    'estilo.retro': 'Sareta',
    'estilo.surveillance': 'Gauekoa',
    'estilo.thermal': 'Termikoa',
    'estilo.anime': 'Trazua',
    'estilo.noir': 'Tinta',
    'estilo.snow': 'Errautsa',
    'enlace.copiar': 'Kopiatu esteka',
    'enlace.copiado': 'Esteka kopiatuta',
    'enlace.fallo': 'Ezin izan da esteka kopiatu',
    'movil.panel': 'Geruzak eta begirada',
    'movil.cerrar': 'Itxi',
    'carga.globo': 'Globoa prestatzen…',
    'carga.configurando': 'Globoa konfiguratzen…',
    'carga.mapa': 'Mapa kargatzen…',
    'carga.restaurando': 'Partekatutako ikuspegia berreskuratzen…',
    'carga.error': 'Errorea',
    'quipu.play': 'Erreproduzitu seriearen ibilbidea',
    'quipu.pausa': 'Pausatu',
    'quipu.minuto': 'Atalaren minutua',
    'quipu.velocidad': 'Erreprodukzio-abiadura',
    'quipu.tiempoReal': 'denbora erreala',
    'quipu.veces': '{n} aldiz azkarrago',
    'quipu.ver': 'Ikusi atala hemen',
    'quipu.ver.titulo': 'Atala YouTuben irekitzen du segundo honetan',
    'quipu.hacia': '{lugar} aldera',
    'quipu.episodio': '{n}. atala, {titulo}',
    'ficha.cerrar': 'Itxi fitxa',
    'ficha.enLaSerie': 'Seriean',
    'ficha.ir': 'Eraman mapa une honetara',
    'ficha.todoElEpisodio': 'Atal osoa',
    'ficha.tramo': '{desde} – {hasta}',
    'ficha.episodio': '{n}. atala, {titulo}',
    'ficha.ver': 'Ikusi',
    'ficha.ver.titulo': 'Ikusi une hau YouTuben',
    'ficha.soloEn': 'soilik {estacion}',
    'ficha.provisional': 'behin-behineko lekua',
    'tipo.asentamiento': 'Kokalekua',
    'tipo.avanzada': 'Aurrerapostua',
    'tipo.territorio': 'Lurraldea',
    'tipo.frontera': 'Muga',
    'tipo.gran-rio': 'Ibai handia',
    'tipo.accidente': 'Lur-forma',
    'tipo.localizacion': 'Kokapena',
    'tipo.ruta': 'Ibai-bidea',
    'tipo.hidrografia': 'Ura',
    'faccion.kukama': 'kukama',
    'faccion.imperio': 'inperioa',
    'faccion.comerciantes': 'merkatari gaztelaniadunak',
    'faccion.null': 'zehaztu gabe',
    'capa.hidrografia': 'Cochak, uharteak eta baso urpetua',
    'capa.rutas': 'Ibaia',
    'capa.imperio': 'Inperioa',
    'capa.asentamientos': 'Kokalekuak',
    'capa.accidentes': 'Lur-formak',
    'capa.localizaciones': 'Kokapenak',
  },
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
  document.title = t('pagina.titulo');
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
