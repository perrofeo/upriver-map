/**
 * capas/gestor.js — gestor mínimo de capas de ficción.
 *
 * Sustituye al DataLayerManager de gods-eye-view (2.288 líneas, pensado para
 * feeds en vivo con polling, epochs y estados degradados). Aquí las capas son
 * estáticas: se cargan una vez y se muestran u ocultan. Mantiene la fachada
 * que consume el director de escenas: getAll, getLayerParams, setEnabled y
 * setLayerParams.
 *
 * Contrato de una capa (objeto plano):
 *   id        string estable, [a-z0-9-]
 *   nombre    texto del panel
 *   icono     un carácter o emoji para la fila
 *   init(viewer)     una sola vez, antes del primer enable (opcional)
 *   enable(viewer)   mostrar
 *   disable(viewer)  ocultar
 *   getParams() / setParams(p)   opcionales (director)
 *   getStats()  → { count } opcional
 */

export class GestorCapas {
  constructor(viewer) {
    this.viewer = viewer;
    /** @type {Map<string, {modulo: object, enabled: boolean, inicializada: boolean}>} */
    this._capas = new Map();
    this._listeners = new Set();
    this._contenedor = null;
  }

  register(modulo) {
    if (!modulo || typeof modulo.id !== 'string' || !/^[a-z0-9-]+$/.test(modulo.id)) {
      throw new TypeError('La capa necesita un id [a-z0-9-]');
    }
    if (this._capas.has(modulo.id)) throw new Error(`Capa duplicada: ${modulo.id}`);
    this._capas.set(modulo.id, { modulo, enabled: false, inicializada: false });
    return modulo;
  }

  /** Fachada del director: [{ id, name, icon, enabled }]. */
  getAll() {
    return [...this._capas.values()].map(({ modulo, enabled }) => ({
      id: modulo.id,
      name: modulo.nombre,
      icon: modulo.icono || '·',
      enabled,
    }));
  }

  get(id) {
    return this._capas.get(id)?.modulo || null;
  }

  isEnabled(id) {
    return this._capas.get(id)?.enabled === true;
  }

  /**
   * Muestra u oculta una capa. Devuelve `undefined` si el id no existe,
   * `true` si el estado final es el pedido.
   */
  async setEnabled(id, enabled, { origin = 'user' } = {}) {
    const entrada = this._capas.get(id);
    if (!entrada) return undefined;
    const objetivo = !!enabled;
    if (entrada.enabled === objetivo) return true;
    const { modulo } = entrada;
    if (!entrada.inicializada) {
      await modulo.init?.(this.viewer);
      entrada.inicializada = true;
    }
    if (objetivo) await modulo.enable?.(this.viewer);
    else await modulo.disable?.(this.viewer);
    entrada.enabled = objetivo;
    this._emit({ type: 'visibility', id, enabled: objetivo, origin });
    this._pintarPanel();
    return true;
  }

  async toggle(id, opciones) {
    return this.setEnabled(id, !this.isEnabled(id), opciones);
  }

  getLayerParams(id) {
    const modulo = this.get(id);
    return modulo?.getParams ? modulo.getParams() : null;
  }

  setLayerParams(id, params) {
    const modulo = this.get(id);
    if (modulo?.setParams) {
      modulo.setParams(params);
      this._emit({ type: 'params', id, params });
    }
  }

  /** Estado serializable: ids de capas visibles. */
  getEnabledIds() {
    return [...this._capas.entries()].filter(([, e]) => e.enabled).map(([id]) => id);
  }


  /** Propaga la estación activa (nombre) a las capas que la entienden. */
  setEstacionActiva(nombreEstacion) {
    for (const { modulo } of this._capas.values()) modulo.setEstacion?.(nombreEstacion);
  }

  /** Busca una entidad por id en todas las capas: { capa, feature } o null. */
  buscar(fid) {
    for (const { modulo } of this._capas.values()) {
      const feature = modulo.buscar?.(fid);
      if (feature) return { capa: modulo, feature };
    }
    return null;
  }

  /** Resalta una entidad (o ninguna) en todas las capas. */
  resaltar(fid) {
    for (const { modulo } of this._capas.values()) modulo.resaltar?.(fid);
  }

  /** Todas las features de todas las capas. */
  todasLasFeatures() {
    return [...this._capas.values()].flatMap(({ modulo }) => modulo.features || []);
  }

  onChange(fn) {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }

  _emit(evento) {
    for (const fn of this._listeners) {
      try { fn(evento); } catch (e) { console.warn('[capas] listener', e); }
    }
  }

  /** Construye el panel de conmutadores dentro de `contenedor`. */
  buildTogglePanel(contenedor) {
    this._contenedor = contenedor;
    this._pintarPanel();
  }

  _pintarPanel() {
    const c = this._contenedor;
    if (!c) return;
    c.replaceChildren();
    for (const { modulo, enabled } of this._capas.values()) {
      if (modulo.ocultaEnPanel) continue;
      const fila = document.createElement('label');
      fila.className = 'capa-fila';
      fila.dataset.capaId = modulo.id;
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = enabled;
      check.addEventListener('change', () => { void this.setEnabled(modulo.id, check.checked, { origin: 'user' }); });
      const icono = document.createElement('span');
      icono.className = 'capa-icono';
      icono.textContent = modulo.icono || '·';
      const nombre = document.createElement('span');
      nombre.className = 'capa-nombre';
      nombre.textContent = modulo.nombre;
      const cuenta = document.createElement('span');
      cuenta.className = 'capa-cuenta';
      const stats = modulo.getStats?.();
      cuenta.textContent = stats?.count != null ? String(stats.count) : '';
      fila.append(check, icono, nombre, cuenta);
      c.append(fila);
    }
  }
}
