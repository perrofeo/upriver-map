# Despliegue

## Dónde vive

| | |
|---|---|
| Repo | `perrofeo/upriver-map` (fork público de `bilawalsidhu/gods-eye-view`), rama `main` |
| Sitio Netlify | `upriver-mapa` (equipo `igor-fuvhjxw`), id `c4cb66d9-f70c-4e4b-9bba-0ad35a2a3049` |
| URL | https://mapa.therenderedchannel.com (alias: https://upriver-mapa.netlify.app) |
| DNS | zona `therenderedchannel.com` en Netlify DNS; el registro `mapa` lo creó Netlify al asignar el dominio |
| Build | `npm run build` → `dist/`; Node 24 (`netlify.toml`). `prebuild` corta las teselas si faltan |

Creado el 2026-09-09 por la API de Netlify con la GitHub App ya instalada en la cuenta
(`installation_id` 452563). **Despliegue continuo:** cada push a `main` construye y publica.

## Cómo publicar un cambio

```bash
git push origin main
```

Nada más. En dos o tres minutos está en producción. Para ver el estado: https://app.netlify.com/projects/upriver-mapa

## Cómo publicar el mapa definitivo

1. Guardar `mapas/vaciante.png` y `mapas/creciente.png` (2:1, ver `docs/MAPA.md`).
2. `npm run teselas` en local para comprobarlas.
3. Commit de los dos PNG y push. El build de Netlify corta las teselas él solo.

Los PNG fuente van al repo (se cambian pocas veces); las teselas no (se generan en el build).

## Embebido en therenderedchannel.com

La página `pages/upriver/map.vue` de `the-rendered-channel/web` carga
`https://mapa.therenderedchannel.com/` en un iframe. El `netlify.toml` del mapa permite el
embebido solo desde `therenderedchannel.com`, `www.therenderedchannel.com` y `*.netlify.app`
(cabecera `Content-Security-Policy: frame-ancestors`). Para embeberlo en otro sitio, añadirlo ahí.

## Sin red en runtime

El build no hace ninguna petición externa: Cesium, sus workers y texturas, las teselas, la fuente
y los datos van dentro de `dist/`. Verificado con Playwright sobre `vite preview` (cero peticiones
fuera del origen). Si alguna vez aparece una, es una regresión.

## Peso

| Parte | |
|---|---|
| JS y CSS propios | ~0,14 MB |
| Cesium (motor, workers, texturas, Natural Earth II) | 12,5 MB |
| Fuente Alegreya (dos ficheros) | 0,09 MB |
| Teselas placeholder, dos estaciones | 0,45 MB |

Con el mapa definitivo a 8192×4096 las teselas rondarán 10-20 MB por estación (WebP, calidad 82).
Solo se descargan las que se ven: el visitante no paga el total.
