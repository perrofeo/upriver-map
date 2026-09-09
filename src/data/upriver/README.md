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
| `episodios.json` | entrada y salida de cada episodio en la película (segundos) | — |

## Propiedades de cada Feature

| Campo | Tipo | Significado |
|---|---|---|
| `id` (raíz del Feature) | slug | identificador estable; se usa en `sel=` del enlace y en `paradas` |
| `tipo` | `asentamiento · ruta · territorio · avanzada · accidente · localizacion` | |
| `faccion` | `kukama · imperio · ninguna · null` | `null` = sin determinar en la obra |
| `nombre` | `{ es, qu }` | topónimo en castellano y en quechua imperial (cuzco-collao, MINEDU 2013). `qu: null` si no existe |
| `lengua` | `es · qu` | cuál se muestra como principal. Regla de la obra: el quechua es la lengua del imperio y no se traduce, así que los lugares imperiales con nombre quechua llevan `qu` |
| `descripcion` | texto | ficha (castellano) |
| `apariciones` | `[{ episodio, desde?, hasta?, nota?, lugar? }]` | minutaje: si faltan `desde`/`hasta`, vale el tramo entero del episodio según `episodios.json`. `desde`/`hasta` van en **segundos de película**. `lugar` indica que la aparición ocurre en otra entidad (el barco en la ciudad) |
| `estacion` | `ambas · vaciante · creciente` | en qué estación existe o es accesible |
| `orden` | entero | posición en el eje del río, aguas abajo → arriba (solo nodos del viaje) |
| `parte_de` | id | para los estratos de la ciudad |
| `notas`, `fuente` | texto | procedencia en el vault |
| `placeholder` | bool | geometría provisional |

## Lo que la obra no da

- **Casi no hay topónimos.** En pantalla solo se nombra Las Tres Gargantas. Chimor Yaku,
  Hanan, Chaupin y Urin vienen de la biblia y se declaran aquí como material extendido.
- **No hay coordenadas.** Las de estos ficheros son placeholder sobre el bbox de
  `src/mundo.js` (referencia real: Pacaya Samiria).
- **El minutaje de `episodios.json` es provisional** (ver su comentario).
