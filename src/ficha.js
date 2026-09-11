/**
 * ficha.js — la tarjeta de una entidad seleccionada.
 *
 * gods-eye-view no tenía ficha DOM para capas estáticas (el click solo volaba
 * la cámara). Esta es nueva: nombre en la lengua que manda, el otro nombre
 * como secundario, facción, descripción, apariciones con su minutaje
 * (pulsables: llevan la línea de tiempo a ese momento) y notas.
 */

import { nombreMostrado } from './capas/ficcion.js';
import { enlaceYoutube, formatearTiempo, tramosDeEntidad } from './recorrido.js';
import { t as tr, texto } from './i18n.js';
import { avisar } from './telemetria.js';

const etiquetaTipo = (tipo) => tr(`tipo.${tipo}`);
const etiquetaFaccion = (f) => (f === 'ninguna' ? '—' : tr(`faccion.${f}`));

export class Ficha {
  /**
   * @param {HTMLElement} el
   * @param {{ episodios: object[], irA: (t: number) => void, alCerrar: () => void }} opciones
   */
  constructor(el, { episodios, irA, alCerrar, modoAutor = false }) {
    this.el = el;
    this.episodios = episodios;
    this._irA = irA;
    this._alCerrar = alCerrar;
    // Las notas de trabajo y la marca de «provisional» son cosa del autor, no del visitante.
    this.modoAutor = modoAutor;
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
    // En la disposición de móvil la ficha llega plegada, y un nombre con una × no dice que se
    // abre (Igor, 2026-09-11): la pista bajo el nombre y la flecha lo dicen. En escritorio, ocultas.
    const pista = document.createElement('span');
    pista.className = 'ficha-pista';
    pista.textContent = tr('ficha.abrir');
    const titulo = document.createElement('div');
    titulo.className = 'ficha-titulo';
    titulo.append(h, pista);
    cabecera.append(titulo);
    const plegar = document.createElement('button');
    plegar.type = 'button';
    plegar.className = 'ficha-plegar';
    plegar.setAttribute('aria-label', tr('ficha.plegar'));
    plegar.setAttribute('aria-expanded', 'true');
    cabecera.append(plegar);
    const cerrar = document.createElement('button');
    cerrar.type = 'button';
    cerrar.className = 'ficha-cerrar';
    cerrar.setAttribute('aria-label', tr('ficha.cerrar'));
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
    const faccion = etiquetaFaccion(props.faccion);
    const chips = [etiquetaTipo(props.tipo)];
    if (faccion && faccion !== '—') chips.push(faccion);
    if (props.estacion && props.estacion !== 'ambas') chips.push(tr('ficha.soloEn', { estacion: tr(`estacion.${props.estacion}`).toLowerCase() }));
    if (props.placeholder && this.modoAutor) chips.push(tr('ficha.provisional'));
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
      p.textContent = texto(props.descripcion);
      el.append(p);
    }

    if (tramos.length) {
      const t = document.createElement('div');
      t.className = 'ficha-apariciones';
      const titulo = document.createElement('h3');
      titulo.textContent = tr('ficha.enLaSerie');
      t.append(titulo);
      for (const tramo of tramos) {
        const ep = tramo.ep;
        const fila = document.createElement('div');
        fila.className = 'ficha-aparicion';
        fila.dataset.episodio = String(tramo.episodio);
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ficha-aparicion-ir';
        b.title = tr('ficha.ir');
        const tiempo = document.createElement('span');
        tiempo.className = 'ficha-tiempo';
        const entero = tramo.dentroDesde === 0 && tramo.dentroHasta >= ep.duracion;
        tiempo.textContent = entero ? tr('ficha.todoElEpisodio') : tr('ficha.tramo', { desde: formatearTiempo(tramo.dentroDesde), hasta: formatearTiempo(tramo.dentroHasta) });
        const linea = document.createElement('span');
        const nota = texto(tramo.nota);
        linea.textContent = tr('ficha.episodio', { n: tramo.episodio, titulo: texto(ep.titulo) }) + (nota ? `. ${nota[0].toUpperCase()}${nota.slice(1)}` : '');
        b.append(tiempo, linea);
        b.addEventListener('click', () => this._irA(tramo.desde));
        fila.append(b);
        const url = enlaceYoutube(ep, tramo.dentroDesde);
        if (url) {
          const a = document.createElement('a');
          a.className = 'ficha-ver';
          a.href = url;
          a.target = '_blank';
          a.rel = 'noopener';
          a.textContent = tr('ficha.ver');
          a.title = tr('ficha.ver.titulo');
          // La salida a YouTube desde la ficha de un lugar: es el mapa
          // devolviendo gente a la serie, que es para lo que está.
          a.addEventListener('click', () => avisar('mapa_ver_episodio', { episodio: String(tramo.episodio), origen: 'ficha' }));
          fila.append(a);
        }
        if (tramo.historia) {
          const h = document.createElement('p');
          h.className = 'ficha-historia';
          h.textContent = texto(tramo.historia);
          fila.append(h);
        }
        t.append(fila);
      }
      el.append(t);
    }

    if (props.notas && this.modoAutor) {
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
