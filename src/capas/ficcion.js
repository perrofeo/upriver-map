/**
 * capas/ficcion.js — una capa de entidades de ficción desde un GeoJSON.
 *
 * Sigue el patrón de las capas estáticas de gods-eye-view (objeto plano con
 * init/enable/disable, datos empaquetados en el build) pero pinta con
 * entidades nativas de Cesium: puntos con etiqueta, polilíneas pegadas al
 * suelo y polígonos. Para una docena de lugares no compensa el canvas de
 * etiquetas con colisión del original.
 */

import * as Cesium from 'cesium';

/** Nombre que se muestra: el de la lengua declarada, con el otro como secundario. */
export function nombreMostrado(props) {
  const n = props?.nombre || {};
  const principal = n[props?.lengua] || n.es || n.qu || '';
  const secundario = props?.lengua === 'qu' ? n.es : n.qu;
  return { principal, secundario: secundario && secundario !== principal ? secundario : null };
}

/** ¿Existe la entidad en la estación dada? */
export function visibleEnEstacion(props, estacion) {
  const e = props?.estacion || 'ambas';
  return e === 'ambas' || e === estacion;
}

const COLOR_FACCION = {
  kukama: '#e8f2ea',
  imperio: '#e0b070',
  ninguna: '#bcd0c4',
  null: '#bcd0c4',
};

export function crearCapaFiccion({ id, nombre, icono, geojson, color, alSeleccionar = null }) {
  const features = (geojson.features || []).filter((f) => f.geometry && f.geometry.coordinates?.length);
  const porId = new Map(features.map((f) => [f.id, f]));
  let dataSource = null;
  let viewerRef = null;
  let estacionActiva = 'vaciante';
  const entidadesPorId = new Map();

  function colorDe(props) {
    return Cesium.Color.fromCssColorString(color || COLOR_FACCION[props.faccion] || COLOR_FACCION.null);
  }

  function crearEntidades(viewer) {
    dataSource = new Cesium.CustomDataSource(`upriver:${id}`);
    for (const f of features) {
      const props = f.properties || {};
      const c = colorDe(props);
      const { principal } = nombreMostrado(props);
      const g = f.geometry;
      const base = { id: `${id}:${f.id}`, name: principal, properties: { capa: id, fid: f.id } };
      let entidad;
      if (g.type === 'Point') {
        const esParte = !!props.parte_de;
        entidad = dataSource.entities.add({
          ...base,
          position: Cesium.Cartesian3.fromDegrees(g.coordinates[0], g.coordinates[1], 0),
          point: {
            pixelSize: esParte ? 7 : 11,
            color: c,
            outlineColor: Cesium.Color.fromCssColorString('#0d1512'),
            outlineWidth: 2,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: principal,
            font: `${esParte ? 12 : 14}px system-ui, sans-serif`,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: c,
            outlineColor: Cesium.Color.fromCssColorString('#0d1512'),
            outlineWidth: 4,
            pixelOffset: new Cesium.Cartesian2(12, esParte ? 2 : -2),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: esParte ? new Cesium.DistanceDisplayCondition(0, 60_000) : undefined,
            scaleByDistance: new Cesium.NearFarScalar(20_000, 1.0, 400_000, 0.7),
          },
        });
      } else if (g.type === 'LineString') {
        entidad = dataSource.entities.add({
          ...base,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(g.coordinates.flat()),
            width: 3,
            material: c.withAlpha(0.9),
            clampToGround: true,
          },
        });
      } else if (g.type === 'Polygon') {
        const anillo = Cesium.Cartesian3.fromDegreesArray(g.coordinates[0].flat());
        entidad = dataSource.entities.add({
          ...base,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(anillo),
            material: c.withAlpha(0.14),
          },
        });
        dataSource.entities.add({
          id: `${id}:${f.id}:borde`,
          properties: { capa: id, fid: f.id },
          polyline: { positions: anillo, width: 2, material: c.withAlpha(0.7), clampToGround: true },
        });
      }
      if (entidad) entidadesPorId.set(f.id, entidad);
    }
    aplicarEstacion();
    viewer.dataSources.add(dataSource);
  }

  function aplicarEstacion() {
    if (!dataSource) return;
    for (const e of dataSource.entities.values) {
      const fid = e.properties?.fid?.getValue?.() ?? e.properties?.fid;
      const f = porId.get(fid);
      if (f) e.show = visibleEnEstacion(f.properties, estacionActiva);
    }
    viewerRef?.scene.requestRender();
  }

  return {
    id,
    nombre,
    icono,
    tipo: 'ficcion',
    features,
    init(viewer) {
      viewerRef = viewer;
      crearEntidades(viewer);
      dataSource.show = false;
    },
    enable() {
      if (dataSource) dataSource.show = true;
      viewerRef?.scene.requestRender();
    },
    disable() {
      if (dataSource) dataSource.show = false;
      viewerRef?.scene.requestRender();
    },
    getStats() {
      return { count: features.length };
    },
    setEstacion(nombreEstacion) {
      estacionActiva = nombreEstacion;
      aplicarEstacion();
    },
    /** Feature por id, para la ficha y la selección. */
    buscar(fid) {
      return porId.get(fid) || null;
    },
    entidadDe(fid) {
      return entidadesPorId.get(fid) || null;
    },
    /** Resalta una entidad (o ninguna con null). */
    resaltar(fid) {
      for (const [k, e] of entidadesPorId) {
        if (!e.point) continue;
        const esParte = !!porId.get(k)?.properties?.parte_de;
        const activo = k === fid;
        e.point.pixelSize = activo ? 16 : (esParte ? 7 : 11);
        e.point.outlineWidth = activo ? 3 : 2;
        if (e.label) e.label.font = `${activo ? 16 : (esParte ? 12 : 14)}px system-ui, sans-serif`;
      }
      viewerRef?.scene.requestRender();
    },
    alSeleccionar,
  };
}
