# Upriver · mapa del mundo

Mapa navegable del mundo de **Upriver** (*Río Arriba*), la serie y película de
[The Rendered](https://therenderedchannel.com). Globo CesiumJS con el mapa propio del mundo
servido desde el propio build, dos estaciones (vaciante y creciente), las localizaciones de la
película ordenadas por su minutaje, y una línea de tiempo que recorre la geografía en el orden
en que la película la atraviesa.

Es una pieza paratextual publicable: un build estático sin claves ni servicios de terceros,
que se embebe por iframe desde therenderedchannel.com.

## Origen y licencia

Fork de [gods-eye-view](https://github.com/bilawalsidhu/gods-eye-view), de Bilawal Sidhu,
publicado bajo licencia MIT. De él se conservan el sistema de estilos GLSL (`src/styles/`,
`src/bloom.js`), el director de escenas (`src/scenes/`), el gestor de render
(`src/renderGovernor.js`) y la órbita de cámara (`src/orbit.js`). Todo lo demás (capas en vivo,
voz, claves, proveedores de imágenes externos y los proxies de servidor) se ha retirado; el
detalle está en `docs/DESMONTAJE.md`. La licencia MIT original se mantiene en `LICENSE`.

## Requisitos

- Node 24.x o 26.x (`.nvmrc` fija 24).
- Nada más: las teselas se cortan con `sharp`, sin GDAL.

## Uso

```bash
npm ci
npm run teselas     # corta mapas/<estación>.png (o genera un placeholder) en public/tiles/
npm run dev         # http://localhost:4173
npm test
npm run build       # dist/ autónomo; prebuild corta las teselas si faltan
npm run peso        # tamaño del build por partes
```

`?autor` en la URL muestra el panel del director de escenas (captura y exportación de poses).

## Estructura

| Ruta | Qué es |
|---|---|
| `src/mundo.js` | bbox del mundo, rejilla de teselas, píxel ↔ coordenada |
| `src/basemap.js` | proveedor de teselas propio y fundido entre estaciones |
| `src/estilos.js` | motor de estilos GLSL extraído de gods-eye-view |
| `src/capas/` | gestor de capas y capas de ficción |
| `src/enlace.js` | enlaces compartibles (hash de la URL) |
| `src/data/upriver/` | datos de ficción (GeoJSON) y tabla de episodios; esquema en su README |
| `src/scenes/` | director de escenas (gods-eye-view, sin cambios salvo `recipes.js`) |
| `scripts/` | cortador de teselas, placeholder, peso del build |
| `mapas/` | imágenes fuente del mapa por estación |
| `docs/` | desmontaje, mapa y coordenadas, despliegue |

## Cómo se sitúa algo en el mapa

El mapa es una imagen equirrectangular sobre el bbox de `src/mundo.js`. La esquina superior
izquierda de la imagen es (oeste, norte) y la inferior derecha (este, sur); una coordenada se
obtiene por proporción. Ver `docs/MAPA.md`.
