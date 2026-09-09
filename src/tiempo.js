/**
 * tiempo.js — la línea de tiempo de la película (0 → 40:43).
 *
 * Arrastrar el deslizador lleva la cámara a la pose que corresponde a ese
 * segundo (recorrido.js decide cuál); reproducir avanza `t` con un reloj
 * propio (rAF) a la velocidad elegida. Cualquier gesto del usuario sobre el
 * globo pausa la reproducción y deja la exploración libre.
 */

import * as Cesium from 'cesium';
import { construirRecorrido, enlaceYoutube, episodioEn, formatearTiempo, poseEn, segundoEnEpisodio } from './recorrido.js';
import { nombreMostrado } from './capas/ficcion.js';

const VELOCIDADES = [1, 5, 10, 30];

export class LineaTiempo {
  /**
   * @param {object} o
   * @param {Cesium.Viewer} o.viewer
   * @param {HTMLElement} o.el contenedor #linea-tiempo
   * @param {object[]} o.features todas las entidades
   * @param {object[]} o.episodios tabla de episodios
   * @param {number} o.duracion segundos de película
   * @param {Record<string, object>} [o.poses] poses capturadas por id
   * @param {(parada: object|null) => void} [o.alCambiarParada]
   * @param {() => void} [o.alCambiar]
   */
  constructor({ viewer, el, features, episodios, duracion, poses = {}, alCambiarParada = null, alCambiar = null }) {
    this.viewer = viewer;
    this.el = el;
    this.episodios = episodios;
    this.duracion = duracion;
    this.poses = poses;
    this._features = features;
    this.recorrido = construirRecorrido(features, episodios);
    this._alCambiarParada = alCambiarParada;
    this._alCambiar = alCambiar;
    this.t = 0;
    this.reproduciendo = false;
    this.velocidad = 10;
    this._raf = null;
    this._ultimoTick = 0;
    this._paradaId = null;
    this._construirDom();
    this._pausarConGesto();
  }

  _construirDom() {
    const el = this.el;
    el.replaceChildren();
    el.hidden = false;

    // El quipu: una cuerda con un nudo por cambio de episodio y un nudo mayor
    // como cabezal. El deslizador real va encima, transparente, para que el
    // arrastre y el teclado funcionen como en cualquier range.
    this._btnPlay = document.createElement('button');
    this._btnPlay.type = 'button';
    this._btnPlay.className = 'quipu-play';
    this._btnPlay.setAttribute('aria-label', 'Reproducir el recorrido de la película');
    this._btnPlay.addEventListener('click', () => (this.reproduciendo ? this.pausar() : this.reproducir()));

    const cuerda = document.createElement('div');
    cuerda.className = 'quipu-cuerda';
    this._progreso = document.createElement('div');
    this._progreso.className = 'quipu-recorrido';
    cuerda.append(this._progreso);
    for (const ep of this.episodios.slice(1)) {
      const nudo = document.createElement('button');
      nudo.type = 'button';
      nudo.className = 'quipu-nudo';
      nudo.style.left = `${(ep.inicio / this.duracion) * 100}%`;
      nudo.title = `Episodio ${ep.n}, ${ep.titulo}`;
      nudo.setAttribute('aria-label', nudo.title);
      nudo.addEventListener('click', () => { this.pausar({ silencioso: true }); this.setTiempo(ep.inicio); });
      cuerda.append(nudo);
    }
    this._cabezal = document.createElement('div');
    this._cabezal.className = 'quipu-cabezal';
    cuerda.append(this._cabezal);
    this._slider = document.createElement('input');
    this._slider.type = 'range';
    this._slider.className = 'quipu-slider';
    this._slider.min = '0';
    this._slider.max = String(this.duracion);
    this._slider.step = '0.25';
    this._slider.value = '0';
    this._slider.setAttribute('aria-label', 'Minuto de la película');
    this._slider.addEventListener('input', () => {
      this.pausar({ silencioso: true });
      this.setTiempo(Number(this._slider.value));
    });
    cuerda.append(this._slider);

    this._lectura = document.createElement('div');
    this._lectura.className = 'quipu-lectura';
    this._lecturaTiempo = document.createElement('span');
    this._lecturaTiempo.className = 'quipu-tiempo';
    this._lecturaEpisodio = document.createElement('span');
    this._lecturaEpisodio.className = 'quipu-episodio';
    this._lecturaLugar = document.createElement('span');
    this._lecturaLugar.className = 'quipu-lugar';
    this._verEnYoutube = document.createElement('a');
    this._verEnYoutube.className = 'quipu-ver';
    this._verEnYoutube.target = '_blank';
    this._verEnYoutube.rel = 'noopener';
    this._verEnYoutube.textContent = 'Ver el episodio aquí';
    this._verEnYoutube.title = 'Abre el episodio en YouTube en este segundo';
    this._lectura.append(this._lecturaTiempo, this._lecturaEpisodio, this._lecturaLugar, this._verEnYoutube);

    this._velocidad = document.createElement('select');
    this._velocidad.className = 'quipu-velocidad';
    this._velocidad.setAttribute('aria-label', 'Velocidad de reproducción');
    for (const v of VELOCIDADES) {
      const o = document.createElement('option');
      o.value = String(v);
      o.textContent = v === 1 ? 'tiempo real' : `${v} veces más rápido`;
      if (v === this.velocidad) o.selected = true;
      this._velocidad.append(o);
    }
    this._velocidad.addEventListener('change', () => { this.velocidad = Number(this._velocidad.value); });

    el.append(this._btnPlay, cuerda, this._lectura, this._velocidad);
    this._pintarCabezal();
  }

  _pintarCabezal() {
    const pct = (this.t / this.duracion) * 100;
    this._cabezal.style.left = `${pct}%`;
    this._progreso.style.width = `${pct}%`;
  }

  /** Rehace el recorrido tras editar datos (modo autor) y recoloca la cámara. */
  reconstruir({ features, poses } = {}) {
    if (features) this._features = features;
    if (poses) this.poses = poses;
    this.recorrido = construirRecorrido(this._features, this.episodios);
    this._paradaId = null;
    this.setTiempo(this.t);
  }

  /** Un gesto sobre el globo pausa la reproducción: exploración libre. */
  _pausarConGesto() {
    const canvas = this.viewer.scene.canvas;
    const parar = () => { if (this.reproduciendo) this.pausar(); };
    canvas.addEventListener('pointerdown', parar);
    canvas.addEventListener('wheel', parar, { passive: true });
  }

  /** Coloca la película en `t` y la cámara en su pose. */
  setTiempo(t, { moverCamara = true } = {}) {
    this.t = Math.max(0, Math.min(this.duracion, Number(t) || 0));
    this._slider.value = String(this.t);
    const { pose, parada, siguiente, progreso } = poseEn(this.recorrido, this.t, this.poses);
    if (pose && moverCamara) {
      this.viewer.camera.setView({
        destination: Cesium.Cartesian3.fromDegrees(pose.lon, pose.lat, pose.alt),
        orientation: {
          heading: Cesium.Math.toRadians(pose.heading),
          pitch: Cesium.Math.toRadians(pose.pitch),
          roll: Cesium.Math.toRadians(pose.roll || 0),
        },
      });
    }
    const ep = episodioEn(this.episodios, this.t);
    const destino = progreso > 0 && siguiente ? siguiente : parada;
    const lugar = destino ? nombreMostrado(destino.feature.properties).principal : '';
    // Se lee el minuto DEL EPISODIO, que es el que el visitante puede buscar en YouTube.
    const dentro = segundoEnEpisodio(this.episodios, this.t);
    this._lecturaTiempo.textContent = formatearTiempo(dentro);
    this._lecturaEpisodio.textContent = ep ? `Episodio ${ep.n}, ${ep.titulo}` : '';
    this._lecturaLugar.textContent = lugar ? (progreso > 0 ? `hacia ${lugar}` : lugar) : '';
    const url = ep ? enlaceYoutube(ep, dentro) : null;
    this._verEnYoutube.hidden = !url;
    if (url) this._verEnYoutube.href = url;
    this._pintarCabezal();
    const paradaId = parada?.id || null;
    if (paradaId !== this._paradaId) {
      this._paradaId = paradaId;
      this._alCambiarParada?.(parada);
    }
    this._alCambiar?.(this.t);
  }

  reproducir() {
    if (this.reproduciendo) return;
    if (this.t >= this.duracion - 0.01) this.t = 0;
    this.reproduciendo = true;
    this.el.classList.add('reproduciendo');
    this._btnPlay.setAttribute('aria-label', 'Pausar');
    this._ultimoTick = performance.now();
    const tick = (ahora) => {
      if (!this.reproduciendo) return;
      const dt = (ahora - this._ultimoTick) / 1000;
      this._ultimoTick = ahora;
      this.setTiempo(this.t + dt * this.velocidad);
      if (this.t >= this.duracion) { this.pausar(); return; }
      this._raf = requestAnimationFrame(tick);
    };
    this._raf = requestAnimationFrame(tick);
  }

  pausar({ silencioso = false } = {}) {
    if (!this.reproduciendo) return;
    this.reproduciendo = false;
    cancelAnimationFrame(this._raf);
    this._raf = null;
    this.el.classList.remove('reproduciendo');
    this._btnPlay.setAttribute('aria-label', 'Reproducir el recorrido de la película');
    if (!silencioso) this._alCambiar?.(this.t);
  }
}
