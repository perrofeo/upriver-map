# El mapa: bbox, píxeles y coordenadas

## El mundo en grados

Todo sale de `src/mundo.js`:

| | valor |
|---|---|
| oeste | −77,5° |
| este | −73,5° |
| sur | −6,4° |
| norte | −4,4° |
| anchura | 4,0° ≈ 444 km |
| altura | 2,0° ≈ 222 km |
| relación | 2:1 |

Referencia real: Reserva Nacional Pacaya Samiria (Loreto, Perú), tratada con libertad. El bbox
se coloca sobre ella para que el globo tenga detrás una silueta de Tierra reconocible. Fuera del
bbox no hay teselas y el globo pinta su color base.

El río grande baja de los Andes hacia el nordeste y desemboca en el gran río del norte (el
Marañón, que corre por el borde norte del mundo) junto al poblado de Jeshuco. «Río arriba» es
hacia el suroeste, hacia el imperio; la ciudad queda al fondo, al pie de las colinas andinas, y
**es la frontera**: la puerta del imperio sobre el río (Igor, 2026-09-10). Jeshuco y los refugiados
viven fuera, en la llanura kukama, entre los grandes ríos del norte y del este (Marañón y Ucayali),
más allá de los cuales están los países hispanohablantes. La capital queda más adentro, en la sierra. El mundo mide unos 444 × 222 km, así que el viaje de ida ronda los 350 km de río.

## Cómo se corresponde la imagen con las coordenadas

La imagen del mapa es **equirrectangular** sobre el bbox: la esquina superior izquierda es
(oeste, norte) y la inferior derecha (este, sur). Dado un píxel `(px, py)` de una imagen de
`W × H`:

```
lon = oeste + (px / W) · 4,0
lat = norte − (py / H) · 2,0
```

Y al revés, para situar una entidad de coordenadas conocidas sobre la imagen:

```
px = (lon − oeste) / 4,0 · W
py = (norte − lat) / 2,0 · H
```

Las funciones `pixelACoordenada` y `coordenadaAPixel` de `src/mundo.js` hacen exactamente esto.

**La imagen debe tener relación 2:1.** Si difiere en más de un 1 %, el cortador avisa y la
estira igualmente. Resoluciones recomendadas: 8192×4096 (nivel máximo 4, ~54 m/px) o
16384×8192 (nivel máximo 5, ~27 m/px, unas 2.700 teselas por estación). En la latitud del mundo,
un grado son ~111 km.

## Teselas

`npm run teselas` corta `mapas/<estación>.png` en `public/tiles/<estación>/{z}/{x}/{y}.webp` con
`y` en orden TMS (0 = sur). La rejilla del nivel 0 es 2×1; el nivel `z` tiene 2·2^z × 2^z
teselas de 256 px. El proveedor de Cesium (`src/basemap.js`) usa un `GeographicTilingScheme`
restringido al bbox con esa misma rejilla, así que no hay reproyección.

| imagen | niveles | teselas por estación | metros por píxel |
|---|---|---|---|
| 4096×2048 (placeholder) | 0–3 | 170 | 108 |
| 8192×4096 | 0–4 | 682 | 54 |
| 16384×8192 | 0–5 | 2.730 | 27 |

Si `mapas/<estación>.png` no existe, `scripts/mapa_grabado.mjs` dibuja el mapa desde los datos en
`mapas/grabado_<estación>.png` (8192×4096, un minuto por estación): cartografía grabada en el estilo
de `docs/DISENO.md`, sin rótulos, que se redibuja sola cada vez que cambian los datos y por tanto
siempre cuadra con el globo. Los mapas generados no se versionan; un mapa pintado a mano sí, y
manda sobre el generado. `ANCHO_GRABADO=4096 npm run teselas` acelera el ciclo en desarrollo.

## Estaciones

Dos pilas de teselas, `vaciante` (base) y `creciente`, apiladas. El deslizador de estación
escribe la opacidad de la superior: 0 es vaciante, 1 es creciente. Las entidades declaran en
qué estación existen (`estacion: ambas | vaciante | creciente`) y se muestran u ocultan al cruzar
el punto medio.

## Escala del viaje

Medido sobre la red dibujada (2026-09-10): 584 km del palafito a la ciudad contando los desvíos,
con el río grande a sinuosidad 1,3 (530 km de cauce sobre 406 en línea recta); 481 km de vuelta
río abajo. Una canoa de remo contra corriente en río de llanura hace 15-25 km al día, y 40-60 río
abajo: unas cuatro semanas de subida y diez días de bajada. El arranque (poblado, palafito, caño,
túneles, peces muertos y barco) cabe en 14 km, que es lo que el episodio 1 recorre en una mañana.
Los meandros los genera `scripts/meandros.py` a partir de un trazado base suave; si se cambia el
trazado, se vuelve a ejecutar.

## Cómo cambiar el bbox

Editar `src/mundo.js` y volver a correr `npm run teselas`. Las coordenadas de los GeoJSON de
`src/data/upriver/` son absolutas (grados), así que si el bbox se mueve, se mueven ellas también.


## El mapa pintado (2026-09-10)

`mapas/vaciante.png` y `mapas/creciente.png` (4096×2048) son ilustraciones «de cuento» pintadas por
**Z-Image-Turbo + Fun Union ControlNet (canny)** en Comfy Cloud sobre un mapa de control que dibuja
`mapa_grabado.mjs` en modo `control` (solo agua, cochas, bosque inundado y colinas). Decisión de Igor:
«¿y si lo hacemos ilustración, como si fuera un cuento?» y, entre tres miradas, «vamos con la 2»
(tinta y acuarela sobre pergamino oscuro).

- `npm run pintar` (o `node scripts/pintar_mapa.mjs <estación>`): 24 trozos de 2048 con solape sobre el
  control con margen, a 1024 en la nube (~11 s cada uno), cosidos con fundido, tono igualado por trozo,
  una semilla por trozo, y el marco de tocapu del grabado encima. Necesita `COMFYUI_API_KEY` o el
  `.mcp.json` de AI_FILMS. Unos céntimos y diez minutos por estación.
- `teselas.mjs` corta estos PNG si existen (nivel máximo 3); si se borran, vuelve al grabado generativo.
- Cuando cambie la geografía (ríos, cochas), hay que volver a pintar: el control sale de los datos.
- Diario de las pruebas y las trampas encontradas: `mapas/pruebas/README.md`.
