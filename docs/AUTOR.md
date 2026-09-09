# Modo autor

Abre el mapa con `?autor` al final de la URL (en local: http://localhost:4173/?autor). Aparece la
tablilla «Modo autor» a la derecha. Nada de lo que hagas ahí lo ve el visitante: los cambios se
guardan en el navegador hasta que los exportas.

## Mover un lugar

Arrastra el punto sobre el globo. Al soltar, la coordenada nueva queda guardada y el recorrido
se rehace. El puntero muestra siempre la coordenada bajo el ratón, con «Copiar».

## Fijar cuándo aparece

1. Selecciona el lugar (pulsa sobre él).
2. Lleva el quipu al momento exacto del episodio (o pulsa «Ver el episodio aquí» para comprobarlo
   en YouTube y volver).
3. En la aparición de ese episodio, pulsa **Empieza aquí** o **Termina aquí**.

«Sin cámara» marca una aparición que cuenta para la ficha pero no mueve la cámara (una mención).
«Añadir aparición en el episodio actual» crea una nueva desde el momento del quipu.

## Fijar la cámara de un lugar

Coloca la vista como quieres que se vea ese lugar durante su parada y pulsa **Cámara aquí**. La
pose se guarda en `poses.json` al exportar. «Quitar cámara» vuelve a la pose por defecto.

El botón **Director** abre el director de escenas de gods-eye-view, que sigue ahí para capturar
secuencias de planos y exportarlas.

## Llevar los cambios al repo

**Exportar datos** descarga `upriver-datos-AAAA-MM-DD.json`. Después:

```bash
node scripts/importar_datos.mjs ~/Descargas/upriver-datos-2026-09-09.json
npm run teselas      # el placeholder se redibuja con la geografía nueva
npm test
git add -A && git commit -m "datos: ..." && git push
```

«Descartar cambios» borra lo guardado en el navegador y recarga.

## Lo que aún no se edita aquí

Los trazados de ríos y polígonos (vértices) y los textos de las fichas: esos se editan en los
GeoJSON de `src/data/upriver/`.
