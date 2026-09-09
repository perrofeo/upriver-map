# Datos de ficción de Upriver

Cinco colecciones GeoJSON (WGS84, `[lon, lat]`) y una tabla de episodios. El canon está
cerrado: no hay estados «por revelar». Lo que sí hay es **placeholder**: toda geometría
lleva `placeholder: true` hasta que Igor sitúe cada entidad sobre el mapa definitivo.

| Fichero | Contenido | Geometría |
|---|---|---|
| `asentamientos.geojson` | palafito, comunidad, ciudad y sus tres estratos | Point |
| `rutas.geojson` | el río y el viaje (paradas ordenadas) | LineString |
| `imperio.geojson` | territorio del imperio y avanzadas | Polygon, Point |
| `accidentes.geojson` | accidentes geográficos con nombre propio | Point |
| `localizaciones.geojson` | lugares de escena que no son asentamiento ni accidente | Point |
| `hidrografia.geojson` | textura del río sin nombre: cochas, islas, playas, bosque inundado (`subtipo`) | Polygon |
| `episodios.json` | los diez episodios de la serie publicada: duración, inicio en la concatenación, id de YouTube | — |

## Propiedades de cada Feature

| Campo | Tipo | Significado |
|---|---|---|
| `id` (raíz del Feature) | slug | identificador estable; se usa en `sel=` del enlace y en `paradas` |
| `tipo` | `asentamiento · ruta · territorio · frontera · avanzada · accidente · localizacion · hidrografia` | `frontera`: el río de la raya del imperio (LineString) |
| `subtipo` | `cocha · isla · playa · tahuampa · colinas` | solo hidrografía y relieve |
| `etiqueta` | bool | `false` = no se rotula en el globo (texturas sin nombre) |
| `faccion` | `kukama · imperio · comerciantes · ninguna · null` | `comerciantes` = hispanohablantes ajenos al imperio que comercian con él (el barco). `null` = sin determinar |
| `nombre` | `{ es, qu }` | topónimo en castellano y en quechua imperial (cuzco-collao, MINEDU 2013). `qu: null` si no existe |
| `lengua` | `es · qu` | cuál se muestra como principal. Regla de la obra: el quechua es la lengua del imperio y no se traduce, así que los lugares imperiales con nombre quechua llevan `qu` |
| `descripcion` | texto | ficha (castellano) |
| `apariciones` | `[{ episodio, desde?, hasta?, nota?, lugar? }]` | minutaje: si faltan `desde`/`hasta`, vale el episodio entero. `desde`/`hasta` van en **segundos dentro del episodio**, que es lo que enlaza al vídeo de YouTube en ese instante. `lugar` indica que la aparición ocurre en otra entidad (el barco en la ciudad) |
| `estacion` | `ambas · vaciante · creciente` | en qué estación existe o es accesible |
| `orden` | entero | posición en el eje del río, aguas abajo → arriba (solo nodos del viaje) |
| `rango` (rutas) | `principal · secundario · oculto · viaje` | el río grande es la autopista; los secundarios son desvíos y caños; los ocultos no se ven desde el río grande |
| `escala` (territorios) | `local · continental` | el polígono continental muestra el tamaño del imperio sobre el globo |
| `parte_de` | id | para los estratos de la ciudad |
| `notas`, `fuente` | texto | procedencia en el vault |
| `placeholder` | bool | geometría provisional |

## La red fluvial (Igor, 2026-09-09)

El viaje no es lineal por un solo río. El río grande, contaminado, baja de los Andes hacia el
nordeste y es la autopista del imperio; desemboca en el río de la frontera (el Marañón), en cuya
orilla vive Jeshuco. Subirlo es adentrarse en el imperio. Jeshuco se desvía: el palafito está en un
caño a las afueras del poblado; los túneles naturales lo llevan al río grande (EP1); un brazo baja
con la corriente hasta los rápidos y el campamento (EP4); Las Tres Gargantas están al final de un
caño escondido que sube a las únicas colinas de la llanura (EP5). La ciudad queda al fondo, al pie
de los Andes. Cochas, islas, playas y bosque inundado dan textura y cambian con la estación. Todo
ello está trazado como placeholder.

## Lo que la obra no da

- **Casi no hay topónimos.** En pantalla solo se nombra Las Tres Gargantas. Chimor Yaku,
  Hanan, Chaupin y Urin vienen de la biblia y se declaran aquí como material extendido.
- **No hay coordenadas.** Las de estos ficheros son placeholder sobre el bbox de
  `src/mundo.js` (referencia real: Pacaya Samiria).
- **El minutaje es el de la serie publicada**, no el de la película de festivales (otro montaje, 40:43). Las duraciones de los episodios están medidas; los subtramos dentro de un episodio son provisionales.

## Apariciones y cámara

- `apariciones[].camara: false` marca una aparición que **no mueve la cámara** (una mención, o
  algo que ocurre en otro lugar): cuenta para la ficha pero no para el recorrido.
- `apariciones[].provisional: true` marca un tramo con `desde`/`hasta` estimados dentro del
  episodio. `medido` dice de dónde sale un tramo comprobado (hoja de fotogramas del episodio).
- `apariciones[].historia`: dos o tres frases con lo que pasa en ese lugar en ese episodio, escritas a partir de las sinopsis de los guiones. Se muestran en la ficha bajo la aparición.
- `apariciones[].estacion: creciente | vaciante` dice en qué estación está el mundo mientras dura
  esa parada: el deslizador de estación se mueve solo al llegar (la crecida del EP10).
- `apariciones[].posicion: [lon, lat]` ancla la cámara de esa parada en otro punto (un tramo de río).
- `properties.camara` fija la pose de cámara de una entidad (`lon`, `lat`, `alt`, `heading`,
  `pitch`); sin ella se usa una pose por defecto según el tipo. Las poses capturadas con el
  director (`?autor`, CAPTURAR PLANO → EXPORTAR) van a `poses.json`, indexadas por id, y
  tienen prioridad.
