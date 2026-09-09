# El mapa: bbox, píxeles y coordenadas

## El mundo en grados

Todo sale de `src/mundo.js`:

| | valor |
|---|---|
| oeste | −75,7° |
| este | −73,7° |
| sur | −5,4° |
| norte | −4,4° |
| anchura | 2,0° ≈ 222 km |
| altura | 1,0° ≈ 111 km |
| relación | 2:1 |

Referencia real: Reserva Nacional Pacaya Samiria (Loreto, Perú), tratada con libertad. El bbox
se coloca sobre ella para que el globo tenga detrás una silueta de Tierra reconocible. Fuera del
bbox no hay teselas y el globo pinta su color base.

El río fluye de oeste a este. «Río arriba» es hacia el oeste, hacia la ciudad del imperio; el
palafito del abuelo queda al este.

## Cómo se corresponde la imagen con las coordenadas

La imagen del mapa es **equirrectangular** sobre el bbox: la esquina superior izquierda es
(oeste, norte) y la inferior derecha (este, sur). Dado un píxel `(px, py)` de una imagen de
`W × H`:

```
lon = oeste + (px / W) · 2,0
lat = norte − (py / H) · 1,0
```

Y al revés, para situar una entidad de coordenadas conocidas sobre la imagen:

```
px = (lon − oeste) / 2,0 · W
py = (norte − lat) / 1,0 · H
```

Las funciones `pixelACoordenada` y `coordenadaAPixel` de `src/mundo.js` hacen exactamente esto.

**La imagen debe tener relación 2:1.** Si difiere en más de un 1 %, el cortador avisa y la
estira igualmente. Resoluciones recomendadas: 4096×2048 (nivel máximo 3, ~54 m/px) u
8192×4096 (nivel máximo 4, ~27 m/px). En la latitud del mundo, un grado son ~111 km, así que
un píxel de una imagen de 8192 de ancho mide ~27 m.

## Teselas

`npm run teselas` corta `mapas/<estación>.png` en `public/tiles/<estación>/{z}/{x}/{y}.webp` con
`y` en orden TMS (0 = sur). La rejilla del nivel 0 es 2×1; el nivel `z` tiene 2·2^z × 2^z
teselas de 256 px. El proveedor de Cesium (`src/basemap.js`) usa un `GeographicTilingScheme`
restringido al bbox con esa misma rejilla, así que no hay reproyección.

| imagen | niveles | teselas por estación |
|---|---|---|
| 4096×2048 | 0–3 | 170 |
| 8192×4096 | 0–4 | 682 |

Si `mapas/<estación>.png` no existe se genera un placeholder (retícula, río y nodos con nombre)
en `mapas/placeholder_<estación>.png`. Los placeholders no se versionan; los definitivos sí.

## Estaciones

Dos pilas de teselas, `vaciante` (base) y `creciente`, apiladas. El deslizador de estación
escribe la opacidad de la superior: 0 es vaciante, 1 es creciente. Las entidades declaran en
qué estación existen (`estacion: ambas | vaciante | creciente`) y se muestran u ocultan al cruzar
el punto medio.

## Cómo cambiar el bbox

Editar `src/mundo.js` y volver a correr `npm run teselas`. Las coordenadas de los GeoJSON de
`src/data/upriver/` son absolutas (grados), así que si el bbox se mueve, se mueven ellas también.
