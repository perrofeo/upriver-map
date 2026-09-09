# Desmontaje de gods-eye-view

Punto de partida: `bilawalsidhu/gods-eye-view` en el commit `7596522` (2026-09-05), 92.000 líneas
de JavaScript. Resultado: unas 3.500 líneas.

## Lo que se conserva

| Módulo | Estado |
|---|---|
| `src/styles/*.js` (6 estilos GLSL) | sin cambios |
| `src/bloom.js` | sin cambios |
| `src/renderGovernor.js` (+ test) | sin cambios |
| `src/orbit.js` | sin cambios |
| `src/scenes/director.js` (+ test) | sin cambios; el test deja de pinear `ui.js` y pinea `estilos.js`; fuera los tres tests de modos de contexto |
| `src/scenes/scenePolicy.js` (+ test) | sin el import de `contextModePolicy`; `sceneRequiresContextModeExit` devuelve `false` |
| `src/scenes/recipes.js` | reescrito: una receta sobre el bbox de Upriver |
| motor de estilos de `src/ui.js` | extraído a `src/estilos.js` (~150 líneas de las 10.310) |
| codec de cámara y estilo de `src/sharelink.js` | reescrito en `src/enlace.js` con los mismos nombres de parámetro |
| `LICENSE` | MIT original, intacta |

## Lo que se retira, y qué se rompía al quitarlo

El análisis completo, con fichero:línea, está en el vault:
`el_chico_del_futuro/refs/gods-eye-view/03_runtime_y_desmontaje.md`. Resumen:

| Grupo | Ficheros | Qué se rompía |
|---|---|---|
| Capas en vivo (vuelos, militar, barcos, satélites, terremotos, tráfico, CCTV, radio, bikeshare, incendios, lanzamientos) | `src/data/*` salvo `upriver/`, `src/overlays/`, `src/cockpit*`, `src/context*`, `public/models/` | `main.js` las registra y `layerState.js` exige correspondencia exacta del registro; `ui.js` las importa por nombre; `detection`, `worldOverlay` y `celestialRing` se importan en cadena |
| Voz y OpenAI | `src/voice/`, `src/annotations/`, `src/cameraVerbs.js`, `src/hudSummaryResponse.js`, proxies `/api/realtime/*`, `/api/openai/*` | `hud.js` importa `gevActions`; `locations.js` importa el resolver de anotaciones; `ui.js` importa `interruptCameraMotion` |
| Claves (POWER UP) | `src/keySetup*.mjs`, endpoint `/api/setup/*`, `scripts/setup-doctor.mjs`, `dev-fresh.sh`, `pinokio/` | `mapStackController` y `mapStackChips` importan `keySetupRequirement`; la CI corría `npm run doctor` |
| Proveedores de imágenes (Esri, Google 3D, Bing/ion, OSM, terreno Re:Earth) | `src/mapStartup.js`, `src/mapStackController.js`, `src/mapStackChips.js`, `define:` de claves en `vite.config.js` | `main.js`, `sharelink` (`map=`), `applyVisualState` (`mapStack`), oyentes de `gev:map-stack-changed` |
| Proxies de servidor | 20 plugins en `vite.config.js` (7.798 líneas → 24) | 10 tests importaban `vite.config.js` |
| Tooling | `scripts/qa-*.mjs` (43), `tools/`, `docs/media` (68 MB), `.github/` | ninguno en runtime |
| Recursos externos no-imagen | Google Fonts, Material Symbols | todo el markup usaba los iconos; el `index.html` nuevo no usa ninguno |

### Lo que costó de verdad

1. **`ui.js` no se poda: se reescribe.** Constructor, `attachDataManager`, `dispose` y
   `resetToGlobeView` mezclan cockpit, radio, CCTV y contexto con estilos y paneles.
2. **`layerState.js` revienta al importarse con registro vacío** y `normalizeLayerState`
   asume `options.flights` y `options.satellites`. Fuera entero; el gestor de capas nuevo
   (`src/capas/gestor.js`) tiene 130 líneas.
3. **Unos 20 tests pineaban `ui.js`, `index.html` y `style.css` por regex.** Se van con sus
   módulos; el runner exigía además dos microbenchmarks de asignación (Node 24) que ya no existen.
4. **La ficha de entidad no existía** para capas estáticas: el click solo volaba la cámara.
5. **El director no hace scrub**: solo play encadenado con `flyTo`. La línea de tiempo es un
   módulo nuevo; el director queda como herramienta de autoría (`?autor`).

## Peso

| | gods-eye-view | Upriver |
|---|---|---|
| `dist/` | 28 MB (12 MB app, 13 MB Cesium, 3,2 MB modelos) | ver `npm run peso` |
