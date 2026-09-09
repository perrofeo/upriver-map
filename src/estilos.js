/**
 * estilos.js — sistema de estilos GLSL (post-proceso) de Upriver.
 *
 * Extraído del StyleManager de gods-eye-view (src/ui.js, 10.310 líneas), del
 * que conserva exactamente el motor: un `Cesium.PostProcessStage` por estilo
 * con un uniforme `intensity` que se funde en cruz al cambiar de estilo, un
 * uniforme `time` para los shaders animados, el bloom nativo de Cesium con la
 * misma curva de mapeo, y la máscara de enfoque propia.
 *
 * Además expone la fachada que consume el director de escenas
 * (src/scenes/director.js): getCameraState, getVisualState,
 * applyVisualState y setRecordingMode.
 */

import * as Cesium from 'cesium';
import { retroShader } from './styles/retro.js';
import { nightVisionShader } from './styles/surveillance.js';
import { thermalShader } from './styles/thermal.js';
import { animeShader } from './styles/anime.js';
import { noirShader } from './styles/noir.js';
import { snowShader } from './styles/snow.js';
import { governorRequestRender, holdContinuousRender, releaseContinuousRender } from './renderGovernor.js';
import {
  BLOOM_INTENSITY_DEFAULT,
  BLOOM_SCALE_VERSION,
  bloomStrengthFromIntensity,
  clampBloomIntensity,
  decodeBloomIntensity,
} from './bloom.js';

/** Estilos disponibles, por nombre interno (el shader dice cómo se llama). */
export const ESTILOS = Object.freeze({
  retro: retroShader,
  surveillance: nightVisionShader,
  thermal: thermalShader,
  anime: animeShader,
  noir: noirShader,
  snow: snowShader,
});

/** Etiquetas de la interfaz. La Fase 4 decide cuáles sobreviven y cómo se llaman. */
export const NOMBRES_ESTILO = Object.freeze({
  normal: 'Natural',
  retro: 'Rejilla',
  surveillance: 'Nocturna',
  thermal: 'Térmica',
  anime: 'Trazo',
  noir: 'Tinta',
  snow: 'Ceniza',
});

/** Duración del fundido entre estilos (ms). */
const DURACION_TRANSICION_MS = 500;
const NITIDEZ_DEFECTO = 49;

/** Máscara de enfoque 3×3 (unsharp mask), tal cual en gods-eye-view. */
const SHARPEN_SHADER = /* glsl */ `
  uniform sampler2D colorTexture;
  uniform vec2 colorTextureDimensions;
  uniform float amount;
  in vec2 v_textureCoordinates;

  void main() {
    vec2 uv = v_textureCoordinates;
    vec2 texel = 1.0 / colorTextureDimensions;
    vec4 center = texture(colorTexture, uv);
    vec4 blur = (
      texture(colorTexture, uv + vec2(-texel.x, -texel.y)) +
      texture(colorTexture, uv + vec2( 0.0,     -texel.y)) +
      texture(colorTexture, uv + vec2( texel.x, -texel.y)) +
      texture(colorTexture, uv + vec2(-texel.x,  0.0))     +
      center +
      texture(colorTexture, uv + vec2( texel.x,  0.0))     +
      texture(colorTexture, uv + vec2(-texel.x,  texel.y)) +
      texture(colorTexture, uv + vec2( 0.0,      texel.y)) +
      texture(colorTexture, uv + vec2( texel.x,  texel.y))
    ) / 9.0;
    vec4 sharpened = center + (center - blur) * amount;
    out_FragColor = vec4(clamp(sharpened.rgb, 0.0, 1.0), center.a);
  }
`;

export class GestorEstilos {
  /**
   * @param {Cesium.Viewer} viewer
   * @param {{ onChange?: (estado: object) => void }} [opciones]
   */
  constructor(viewer, { onChange = null } = {}) {
    this.viewer = viewer;
    this._onChange = onChange;
    /** @type {Record<string, Cesium.PostProcessStage>} */
    this.stages = {};
    this._stageEntries = [];
    this.transitions = new Map();
    this._animFrameId = null;
    this.startTime = Date.now();
    this.activeStyle = 'normal';
    this.bloomEnabled = false;
    this._bloomIntensity = BLOOM_INTENSITY_DEFAULT;
    this.sharpenEnabled = false;
    this._sharpenIntensity = NITIDEZ_DEFECTO;
    this._recordingMode = false;
    this._initStages();
    this._initBloomSharpen();
  }

  // ── Motor de estilos (gods-eye-view, ui.js) ─────────────────────────────

  _initStages() {
    for (const [name, shader] of Object.entries(ESTILOS)) {
      const uniforms = { intensity: 0.0 };
      // Los shaders animados declaran `uniform float time` y reciben segundos.
      if (shader.fragmentShader.includes('uniform float time')) uniforms.time = 0.0;
      for (const [uName, uMeta] of Object.entries(shader.uniforms || {})) {
        uniforms[uName] = uMeta.default;
      }
      const stage = new Cesium.PostProcessStage({
        name: `upriver_${name}`,
        fragmentShader: shader.fragmentShader,
        uniforms,
      });
      // Una etapa a intensidad 0 va deshabilitada: no cuesta un pase.
      stage.enabled = false;
      this.viewer.scene.postProcessStages.add(stage);
      this.stages[name] = stage;
    }
    this._stageEntries = Object.entries(this.stages);
  }

  _initBloomSharpen() {
    this._bloomStage = this.viewer.scene.postProcessStages.bloom;
    this._bloomStage.enabled = false;
    this._bloomStage.uniforms.glowOnly = false;
    this._applyBloomIntensity(this._bloomIntensity);

    this._sharpenStage = new Cesium.PostProcessStage({
      name: 'upriver_sharpen',
      fragmentShader: SHARPEN_SHADER,
      uniforms: { amount: 1.3 },
    });
    this._sharpenStage.enabled = false;
    this.viewer.scene.postProcessStages.add(this._sharpenStage);
    this._applySharpenIntensity(this._sharpenIntensity / 100);
  }

  /** Único punto de escritura de la intensidad: mantiene `enabled` en sincronía. */
  _setStageIntensity(stage, value) {
    if (!stage) return;
    stage.uniforms.intensity = value;
    stage.enabled = value > 0.001;
    if (stage.enabled && stage.uniforms.time !== undefined) this._startAnimationLoop();
    governorRequestRender('style-stage');
  }

  _startTransition(styleName, fromValue, toValue) {
    this.transitions.set(styleName, { start: performance.now(), from: fromValue, to: toValue });
    this._startAnimationLoop();
  }

  _startAnimationLoop() {
    if (this._animFrameId) return;
    const update = () => {
      const now = performance.now();
      const elapsedSec = (Date.now() - this.startTime) / 1000.0;
      for (const [styleName, transition] of this.transitions) {
        const t = Math.min((now - transition.start) / DURACION_TRANSICION_MS, 1.0);
        const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this._setStageIntensity(this.stages[styleName], transition.from + (transition.to - transition.from) * eased);
        if (t >= 1.0) {
          this._setStageIntensity(this.stages[styleName], transition.to);
          this.transitions.delete(styleName);
        }
      }
      let animatedStageVisible = false;
      for (const [, stage] of this._stageEntries) {
        if (stage.enabled && stage.uniforms.time !== undefined) {
          stage.uniforms.time = elapsedSec;
          if (stage.uniforms.intensity > 0.001) animatedStageVisible = true;
        }
      }
      const needed = this.transitions.size > 0 || animatedStageVisible;
      if (needed) holdContinuousRender('style-anim');
      else releaseContinuousRender('style-anim');
      if (!needed) {
        this._animFrameId = null;
        return;
      }
      this._animFrameId = requestAnimationFrame(update);
    };
    this._animFrameId = requestAnimationFrame(update);
  }

  // ── API pública ─────────────────────────────────────────────────────────

  /** Cambia de estilo con fundido. `normal` apaga todos los shaders. */
  setStyle(styleName, { emit = true } = {}) {
    if (styleName !== 'normal' && !ESTILOS[styleName]) return false;
    if (styleName === this.activeStyle) return true;
    const previous = this.activeStyle;
    this.activeStyle = styleName;
    document.documentElement.dataset.estilo = styleName;
    if (previous !== 'normal' && this.stages[previous]) {
      this._startTransition(previous, this.stages[previous].uniforms.intensity, 0.0);
    }
    if (styleName !== 'normal' && this.stages[styleName]) {
      this._startTransition(styleName, this.stages[styleName].uniforms.intensity, 1.0);
    }
    if (emit) this._emit();
    return true;
  }

  /** Valores actuales de los uniformes editables de un estilo. */
  getStyleParams(styleName) {
    const shader = ESTILOS[styleName];
    const stage = this.stages[styleName];
    if (!shader?.uniforms || !stage) return null;
    const out = {};
    for (const key of Object.keys(shader.uniforms)) out[key] = stage.uniforms[key];
    return out;
  }

  setStyleParam(styleName, key, value, { emit = true } = {}) {
    const meta = ESTILOS[styleName]?.uniforms?.[key];
    const stage = this.stages[styleName];
    if (!meta || !stage) return false;
    const num = Number(value);
    if (!Number.isFinite(num)) return false;
    stage.uniforms[key] = Math.max(meta.min, Math.min(meta.max, num));
    governorRequestRender('style-param');
    if (emit) this._emit();
    return true;
  }

  _applyBloomIntensity(intensity) {
    if (!this._bloomStage) return;
    const rawStrength = bloomStrengthFromIntensity(intensity);
    const strength = rawStrength <= 0.06 ? 0.0 : ((rawStrength - 0.06) / 0.94);
    const eased = strength * strength * (3.0 - 2.0 * strength);
    this._bloomStage.uniforms.contrast = 255.0 - (eased * 168.0);
    this._bloomStage.uniforms.brightness = -0.5 + (eased * 0.36);
    this._bloomStage.uniforms.sigma = 0.28 + (eased * 6.3);
    this._bloomStage.uniforms.delta = 0.2 + (eased * 2.25);
    this._bloomStage.uniforms.stepSize = 1.0 + (eased * 1.25);
    this._bloomStage.enabled = this.bloomEnabled && strength > 0;
    governorRequestRender('bloom');
  }

  setBloom({ enabled, intensity } = {}, { emit = true } = {}) {
    if (typeof enabled === 'boolean') this.bloomEnabled = enabled;
    if (intensity !== undefined) this._bloomIntensity = clampBloomIntensity(intensity);
    this._applyBloomIntensity(this._bloomIntensity);
    if (emit) this._emit();
  }

  _applySharpenIntensity(val) {
    if (!this._sharpenStage) return;
    this._sharpenStage.uniforms.amount = 0.1 + val * 2.0;
    this._sharpenStage.enabled = this.sharpenEnabled;
    governorRequestRender('sharpen');
  }

  setSharpen({ enabled, intensity } = {}, { emit = true } = {}) {
    if (typeof enabled === 'boolean') this.sharpenEnabled = enabled;
    if (intensity !== undefined) {
      const n = Number(intensity);
      if (Number.isFinite(n)) this._sharpenIntensity = Math.max(0, Math.min(100, Math.round(n)));
    }
    this._applySharpenIntensity(this._sharpenIntensity / 100);
    if (emit) this._emit();
  }

  get bloomIntensity() { return this._bloomIntensity; }
  get sharpenIntensity() { return this._sharpenIntensity; }

  // ── Fachada del director de escenas ─────────────────────────────────────

  getCameraState() {
    const carto = this.viewer.camera.positionCartographic;
    if (!carto) return null;
    return {
      lat: Cesium.Math.toDegrees(carto.latitude),
      lon: Cesium.Math.toDegrees(carto.longitude),
      alt: carto.height,
      heading: Cesium.Math.toDegrees(this.viewer.camera.heading),
      pitch: Cesium.Math.toDegrees(this.viewer.camera.pitch),
      roll: Cesium.Math.toDegrees(this.viewer.camera.roll) % 360,
    };
  }

  getVisualState() {
    const styleParams = {};
    for (const styleName of Object.keys(ESTILOS)) {
      styleParams[styleName] = this.getStyleParams(styleName);
    }
    return {
      style: this.activeStyle,
      bloom: { enabled: this.bloomEnabled, intensity: this._bloomIntensity, version: BLOOM_SCALE_VERSION },
      sharpen: { enabled: this.sharpenEnabled, intensity: this._sharpenIntensity },
      hud: { visible: false, variant: 'minimal' },
      detection: { mode: 'OFF', density: 0 },
      styleParams,
    };
  }

  /**
   * Aplica un estado visual completo (plano del director o enlace).
   * @param {object} state como el que devuelve getVisualState
   * @param {{ isCurrent?: (() => boolean)|null }} [opciones] predicado de vigencia
   */
  async applyVisualState(state = {}, { isCurrent = null } = {}) {
    const superseded = () => typeof isCurrent === 'function' && !isCurrent();
    if (superseded()) return false;
    if (state.style) this.setStyle(state.style, { emit: false });
    if (state.bloom) {
      this.setBloom({
        enabled: !!state.bloom.enabled,
        intensity: decodeBloomIntensity(state.bloom.intensity, state.bloom.version ?? 1),
      }, { emit: false });
    }
    if (state.sharpen) {
      this.setSharpen({ enabled: !!state.sharpen.enabled, intensity: state.sharpen.intensity }, { emit: false });
    }
    if (state.styleParams && typeof state.styleParams === 'object') {
      for (const [styleName, params] of Object.entries(state.styleParams)) {
        if (!params) continue;
        for (const [key, value] of Object.entries(params)) {
          this.setStyleParam(styleName, key, value, { emit: false });
        }
      }
    }
    this._emit();
    return true;
  }

  /** Modo grabación del director: oculta los paneles. */
  setRecordingMode(enabled, { hidePanels = true } = {}) {
    this._recordingMode = !!enabled;
    document.body.classList.toggle('modo-grabacion', this._recordingMode && hidePanels);
  }

  get recordingMode() { return this._recordingMode; }

  _emit() {
    this._onChange?.(this.getVisualState());
  }
}
