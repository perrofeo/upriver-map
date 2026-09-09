/**
 * ficha.js — la tarjeta de una entidad seleccionada.
 *
 * gods-eye-view no tenía ficha DOM para capas estáticas (el click solo volaba
 * la cámara). Esta es nueva: nombre en la lengua que manda, el otro nombre
 * como secundario, facción, descripción, apariciones con su minutaje
 * (pulsables: llevan la línea de tiempo a ese momento) y notas.
 */

import { nombreMostrado } from './capas/ficcion.js';
import { formatearTiempo, tramosDeEntidad } from './recorrido.js';

const ETIQUETA_TIPO = {
  asentamiento: 'Asentamiento',
  avanzada: 'Avanzada',
  territorio: 'Territorio',
  frontera: 'Frontera',
  hidrografia: 'Agua',
  accidente: 'Accidente geográfico',
  localizacion: 'Localización',
  ruta: 'Ruta fluvial',
};
const ETIQUETA_FACCION = { kukama: 'kukama', imperio: 'imperio', comerciantes: 'comerciantes hispanohablantes', ninguna: '—', null: 'sin determinar' };

export class Ficha {
  /**
   * @param {HTMLElement} el
   * @param {{ episodios: object[], irA: (t: number) => void, alCerrar: () => void }} opciones
   */
  constructor(el, { episodios, irA, alCerrar }) {
    this.el = el;
    this.episodios = episodios;
    this._irA = irA;
    this._alCerrar = alCerrar;
    this.feature = null;
  }

  mostrar(feature) {
    this.feature = feature;
    const props = feature.properties || {};
    const { principal, secundario } = nombreMostrado(props);
    const tramos = tramosDeEntidad(feature, this.episodios);
    const el = this.el;
    el.replaceChildren();

    const cabecera = document.createElement('div');
    cabecera.className = 'ficha-cabecera';
    const h = document.createElement('h2');
    h.textContent = principal;
    if (props.lengua === 'qu') h.lang = 'qu';
    cabecera.append(h);
    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'ficha-cerrar';
    cerrar.setAttribute('aria-label', 'Cerrar ficha');
    cerrar.textContent = '×';
    cerrar.addEventListener('click', () => this.ocultar());
    cabecera.append(cerrar);
    el.append(cabecera);

    if (secundario) {
      const sub = document.createElement('div');
      sub.className = 'ficha-secundario';
      sub.textContent = secundario;
      el.append(sub);
    }

    const meta = document.createElement('div');
    meta.className = 'ficha-meta';
    const faccion = ETIQUETA_FACCION[props.faccion] ?? props.faccion;
    const chips = [ETIQUETA_TIPO[props.tipo] || props.tipo];
    if (faccion && faccion !== '—') chips.push(faccion);
    if (props.estacion && props.estacion !== 'ambas') chips.push(`solo en ${props.estacion}`);
    if (props.placeholder) chips.push('sitio provisional');
    for (const c of chips) {
      const s = document.createElement('span');
      s.className = 'ficha-chip';
      s.textContent = c;
      meta.append(s);
    }
    el.append(meta);

    if (props.descripcion) {
      const p = document.createElement('p');
      p.className = 'ficha-descripcion';
      p.textContent = props.descripcion;
      el.append(p);
    }

    if (tramos.length) {
      const t = document.createElement('div');
      t.className = 'ficha-apariciones';
      const titulo = document.createElement('h3');
      titulo.textContent = 'En la película';
      t.append(titulo);
      for (const tramo of tramos) {
        const ep = this.episodios.find((e) => e.n === tramo.episodio);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ficha-aparicion';
        const tiempo = document.createElement('span');
        tiempo.className = 'ficha-tiempo';
        tiempo.textContent = `${formatearTiempo(tramo.desde)} a ${formatearTiempo(tramo.hasta)}`;
        const texto = document.createElement('span');
        texto.textContent = `Episodio ${tramo.episodio}, ${ep?.titulo || ''}${tramo.nota ? `. ${tramo.nota[0].toUpperCase()}${tramo.nota.slice(1)}` : ''}`;
        b.append(tiempo, texto);
        b.addEventListener('click', () => this._irA(tramo.desde));
        t.append(b);
      }
      el.append(t);
    }

    if (props.notas) {
      const n = document.createElement('p');
      n.className = 'ficha-notas';
      n.textContent = props.notas;
      el.append(n);
    }
    el.hidden = false;
  }

  ocultar() {
    if (this.el.hidden) return;
    this.el.hidden = true;
    this.feature = null;
    this._alCerrar?.();
  }
}
