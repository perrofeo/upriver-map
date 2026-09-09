# Identidad visual: cartografía imperial

Elegida por Igor el 2026-09-09 entre tres direcciones. La idea: un mapa es un instrumento de
imperio, y la película dice que quien envenena el río son los suyos. El mapa hereda la gramática
de consola de gods-eye-view y la vuelve del revés: es el instrumento con que el imperio mira el
río. Nada europeo ni colonial (canon: `UCRONIA_INTEGRACION.md` §NEGATIVE).

## Materiales → color

| Token | Hex | De dónde sale |
|---|---|---|
| `--piedra` | `#14110d` | piedra ahumada de la ciudad; fondo |
| `--adobe` | `#251c15` | adobe del Fango; superficie de los paneles |
| `--tumbaga` | `#c99a3e` | la aleación de oro y cobre de los templos de Hanan; acento principal, lo imperial |
| `--cobre` | `#9a5b2f` | la metalurgia chimú de la Fundición; acento secundario, los comerciantes |
| `--hueso` | `#e9dcc3` | totora y hueso; el texto y lo kukama |
| `--hollin` | `#8a7b6a` | hollín; texto secundario |
| `--rio` | `#6f9ea8` | el agua, solo para el agua |

## Tipografía

Una sola familia: **Alegreya** (Juan Pablo del Peral, Argentina, OFL), variable, servida desde
`public/fuentes/`. La cursiva no decora: **la cursiva es la traducción**. El nombre en la lengua
que manda va en redonda; el otro nombre, en cursiva. Sin versalitas ni mayúsculas sostenidas en
las etiquetas.

## Formas

- Los lugares kukama son **círculos**; los del imperio, **cuadrados** (tocapu); los comerciantes,
  cuadrados de cobre. La forma dice la facción antes que el color.
- Los paneles son tablillas de adobe planas, sin desenfoque ni sombra, con una **banda de tocapu**
  de 8 px en el borde superior.
- La línea de tiempo es un **quipu**: una cuerda con un nudo por cambio de episodio y un nudo
  mayor, de tumbaga, como cabezal. Es el único elemento al que se le permite llamar la atención.
- Un solo movimiento no pedido: la llegada, del continente al río, al abrir la página.

## Estilos GLSL

Se conservan los seis de gods-eye-view como «miradas» del instrumento imperial, con nombres
propios: Natural, Rejilla, Nocturna, Térmica, Trazo, Tinta y Ceniza (la nieve, sobre este mundo,
es ceniza de las chimeneas).
