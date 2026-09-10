# Pruebas de mapa pintado (2026-09-10)

Idea de Igor: pintar el mapa base con un modelo en ComfyUI. Condición de diseño: **el modelo
pinta la tierra, no el agua**; el pipeline (`scripts/mapa_grabado.mjs`) sigue dibujando encima
el agua, la raya, la retícula y el marco, así la geometría no se desvía.

Primera prueba: un trozo de 2048×2048 del grabado (`trozo_ciudad_grabado.png`, la ciudad y la
frontera; recorte en x 55..2103, y 2048..4096 del mapa de 8192×4096) por Qwen Image Edit 2511
en Comfy Cloud a 1024×1024, tres prompts:

- A · «Turn the flat dark green land into dense rainforest canopy drawn as fine copperplate etching hatching, in the style of an antique engraved map.» (seed 11)
- B · «Paint the land as a hand-painted antique map illustration: tiny drawn trees covering the jungle, dark olive and sepia ink with gold accents on black stone.» (seed 22)
- C · «Render the land as an old engraved cartographic illustration: hatched forest texture, shaded riverbanks, small hill symbols on the hatched plateau, sepia and gold ink on dark stone.» (seed 33)

Qué se mira: si el río y la raya siguen en su sitio, y si el estilo aguanta el fondo de piedra
oscura sin irse a pergamino claro.

## Resultado (comparativa_ABC.png: original · A / B · C)

- **A** conserva la geometría entera: río, cochas, raya, retícula y marco en su sitio. Pero la selva
  sale de perfil (troncos y hojas a la altura del ojo), no en planta, y el color se va a cobre claro.
- **B** se inventa un mapa de pergamino con borde dorado y tira el río y la raya. Los arbolitos en
  planta sí son el estilo que buscamos.
- **C** mantiene la raya pero convierte el río en una banda rayada y las colinas en montañas de perfil;
  todo sepia y gris.

Conclusión: Qwen Edit respeta el trazado cuando la orden es «convierte la tierra en X textura» (A).
Siguiente paso: pedir la textura **en planta, vista desde arriba** y con la paleta (tinta verde
oscura sobre piedra), y en cualquier caso dejar que el pipeline redibuje el agua y las rayas encima.

## Segunda tanda: otros modelos (idea de Igor), mismo trozo

Plantillas oficiales de Comfy-Org/workflow_templates convertidas a formato API con
`comfyui-mcp/scripts/ui_a_api.py` (aplana los subgrafos usando el object_info de la nube):

- **Flux.2 Klein 9B distilled, edición** (`mapa_klein`, seed 41), prompt de edición en planta:
  «Turn the flat dark green land into dense rainforest canopy seen from directly above, drawn as fine
  copperplate etching hatching in dark green and sepia ink on black stone, antique engraved map style.»
- **Flux.1 Kontext dev, edición** (`mapa_kontext`, seed 42), mismo prompt.
- **Z-Image-Turbo + Fun Union ControlNet (canny)** (`mapa_zimage_canny`, seed 43): texto a imagen con
  los bordes del grabado como control (canny 0,15/0,40), describiendo el mapa entero.

### Resultado de la segunda tanda
- **Z-Image Turbo + canny** (11 s por trozo): geometría exacta en las dos variantes. La 1 se va a foto
  satélite con claros; la 2 (prompt de grabado) da copa uniforme en planta, oscura: el candidato.
  Pinta el río de arena, pero el agua la redibuja el pipeline encima.
- **Flux.2 Klein 9B**: trazado respetado, río convertido en banda parda con letras inventadas.
- **Flux.1 Kontext dev**: la plantilla pide `flux-2-klein-9b-fp8` que la nube no tiene (Klein, relanzado
  con `flux-2-klein-9b`); Kontext se quedó «executing» más de 8 min y se canceló (Igor: «seguimos sin el Kontext»).

## Tercera tanda: afinar Z-Image (textura de grabado, y un trozo del norte en creciente)
- v3 «grabado a cobre» (seed 45): copas como puntos grabados, verde con brillo; geometría exacta; el río queda como doble línea fina.
- v4 «xilografía» (seed 46): la más oscura y más cerca de la paleta (oliva sobre negro), patrón de arbolitos; geometría exacta.
- Norte en creciente (seed 47): geometría exacta (río con bandas de tahuampa y gran río arriba), pero al
  describir «islas y bancos de arena» pintó arena y claros beige. Lección: el prompt describe SOLO la
  textura de la tierra; la estructura ya la pone el canny, y el agua y el bosque inundado los redibuja el pipeline.
Comparativa: `comparativa_zimage.jpg`. Kontext cancelado a los 8 min (Igor: «seguimos sin el Kontext»).

## Cuarta tanda: con referencia de estilo (Igor: «no me convence ninguno»)

Referencias de dominio público bajadas a `referencias/` (Wikimedia Commons):
- **Samuel Fritz, «El Gran Río Marañón o Amazonas», Quito 1707** (BnF y copia WDL): el propio río de la
  frontera, grabado en la futura sierra del imperio, con cerros, arbolitos y misiones dibujados uno a uno. **La elegida.**
- La Condamine, «Carte du cours du Maragnon», 1745 (6473 px): trazo limpio pero tierra vacía.
- Guaman Poma, «Mapa Mundi de las Indias del Perú», 1615 (734 px, foto de libro): la mirada andina del imperio; sirve de idea, no de referencia de píxeles.

Imagen de estilo: `referencias/estilo_fritz_mapa.png` (recorte del WDL, 1024×768). Jobs:
- Qwen Edit 2511 con dos imágenes (grabado = estructura, Fritz = estilo), prompt A largo (seed 52) y B corto (seed 53).
- Flux.2 Klein 9B, rama de dos referencias (seed 51), mismo prompt A.

### Resultado de la cuarta tanda (`comparativa_fritz.jpg`)
Los tres hacen lo mismo y mal: **calcan el CONTENIDO de la referencia** (el Orinoco, Bogotá, el IHS,
hasta el sello de la biblioteca) debajo de nuestro río y nuestra raya. Qwen A lo tiñe de sepia, Qwen B
de verde, Klein lo funde en rojo. Ninguno transfiere el estilo sin el dibujo. Con dos imágenes, los
modelos de edición mezclan, no estilizan.

Lo que enseña la referencia de Fritz: el «estilo grabado» son SÍMBOLOS repetidos (cerritos de perfil,
arbolitos, casitas de misión) más trama fina y grano. Eso lo puede dibujar el pipeline en SVG, sin
modelo, sin costuras y en las dos estaciones.

## Quinta tanda: ilustración de cuento (idea de Igor: «de alguna manera es un cuento»)
Z-Image-Turbo + canny sobre el trozo de la ciudad, tres miradas: gouache de álbum infantil sobre papel
oscuro (`mapa_cuento1`, seed 61), tinta y acuarela sobre pergamino oscuro con bufeo y canoas
(`mapa_cuento2`, seed 62), arte popular visionario amazónico, fondo oscuro (`mapa_cuento3`, seed 63).
Aquí el agua la puede pintar el modelo: se decide después si el pipeline la redibuja encima.
Resultado (`comparativa_cuento.jpg`): los tres respetan río, raya y cochas, y los tres son ya «ilustración».
- Cuento 1: gouache naíf, copas redondas, palafitos; lee la meseta imperial como horizonte con ciudad y pirámide.
- Cuento 2: tinta y acuarela sobre pardo, árboles con sombra, pirámide en la meseta, bufeos en el agua; la más sobria y la que mejor casa con la paleta.
- Cuento 3: arte popular visionario, jaguares y garzas, ciudad de oro; la más «cuento» y la más viva.

## Sexta tanda: el mapa entero (Igor: «vamos con la 2»)
`scripts/pintar_mapa.mjs`: el grabado de 8192 se corta en trozos de 2048 con solape, cada uno va a
Z-Image + canny a 1024, y se cosen con fundido lineal en un lienzo de 4096×2048 (`mapas/<estación>.png`;
`teselas.mjs` lo corta hasta el nivel 3). Tres mapas enteros hasta dar con la receta:
1. `vaciante_cuento.png`: con el grabado tal cual como control, el modelo lee la retícula como caminos
   dorados y las tramas como cerros con pirámides; el octógono de las Gargantas sale como losa gris.
   → **mapa de control limpio** (`generarGrabado(..., { control: true })`): solo agua, cochas,
   bosque inundado y colinas; sin retícula, tramas, corrientes, marco ni grano. Canny 0,25/0,5.
2. `vaciante_cuento2.png`: ya sin inventos, pero (a) tono distinto por trozo → igualación de media y
   desviación por canal contra el trozo de la ciudad; (b) el octógono de colinas con borde sale como
   valla → mancha suave sin borde; (c) la raya de la frontera sale como carretera → fuera del control
   (el globo la dibuja); (d) «línea de árboles» oscura en el borde inferior → margen de 512 px de
   tierra alrededor del control, recortado al final.
3. `vaciante_cuento3.png`: limpio. Único resto: con la misma semilla, los trozos de solo selva repiten
   el mismo dibujo (tres charcas idénticas) → una semilla por trozo (62 + índice).
El prompt describe solo textura y agua, sin lagos ni colinas ni ciudades: «The whole land is one
unbroken dense Amazon jungle …, the same dark olive tone everywhere …».

## Séptima tanda: la ciudad (Igor: «la ciudad del imperio no se diferencia del resto»)
- Huella en el control (`mapa_grabado.mjs`, modo control): recinto de ~12 km con muralla, retícula de
  calles, tres pirámides escalonadas (Hanan la mayor; Urin sin pirámide) y tres muelles hacia el río.
- Con la huella dentro de un trozo normal, aun grande y con bordes marcados, el modelo pintaba allí un
  montículo con una choza y la ciudad la ponía donde le quedaba bonita (al final del río). Dos trozos con
  la ciudad = dos ciudades.
- **Solución: el recuadro de la ciudad** (`pintarRecuadroCiudad`): un trozo de control de 1024 px a
  escala 8192 (doble zoom) centrado en la ciudad, prompt de la ciudad (canon de UCRONIA_INTEGRACION:
  pirámides escalonadas, cúpulas de oro, torres troncocónicas de fundición con humo, muelles de piedra con
  máquinas de bronce oscuro), igualado de tono y fundido encima del mapa cosido con máscara radial. Así
  la colocación está garantizada. El prompt del recuadro nombra las cochas para que no las vuelva islotes.
- `esperar()` relanza los jobs que la nube deja «pending» más de 150 s (pasó dos veces hoy).
