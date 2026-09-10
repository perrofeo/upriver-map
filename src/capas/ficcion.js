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
import { idioma } from '../i18n.js';

/**
 * Nombre que se muestra. Si la lengua que manda es el quechua, el principal es
 * el quechua (sin traducir) y el secundario la traducción en la lengua de la
 * interfaz; si manda el castellano, el principal es el nombre en la lengua de
 * la interfaz (con castellano de respaldo) y no hay secundario.
 */
export function nombreMostrado(props, lang = idioma) {
  const n = props?.nombre || {};
  const traducido = n[lang] || n.es || '';
  if (props?.lengua === 'qu' && n.qu) {
    return { principal: n.qu, secundario: traducido && traducido !== n.qu ? traducido : null };
  }
  const principal = traducido || n.qu || '';
  return { principal, secundario: null };
}

/** ¿Existe la entidad en la estación dada? */
export function visibleEnEstacion(props, estacion) {
  const e = props?.estacion || 'ambas';
  return e === 'ambas' || e === estacion;
}

/** Paleta de docs/DISENO.md: lo kukama es hueso, lo imperial tumbaga, el comercio cobre. */
const COLOR_FACCION = {
  kukama: '#e9dcc3',
  imperio: '#c99a3e',
  comerciantes: '#b8743f',
  ninguna: '#b9ad9a',
  null: '#b9ad9a',
};
const COLOR_AGUA = '#6f9ea8';
const COLOR_AGUA_NEGRA = '#3e5c66';
const COLOR_ARENA = '#cbb98a';
const COLOR_MONTE = '#4a5a34';
const COLOR_COLINA = '#6b5b3e';
const COLOR_PIEDRA = '#14110d';
const FUENTE = 'Alegreya, Georgia, serif';

/** Marcador cuadrado (tocapu) para el imperio y sus socios; el círculo queda para lo kukama. */
const cuadradosCache = new Map();
function imagenCuadrado(colorCss, lado) {
  const clave = `${colorCss}:${lado}`;
  if (cuadradosCache.has(clave)) return cuadradosCache.get(clave);
  const canvas = document.createElement('canvas');
  canvas.width = lado;
  canvas.height = lado;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLOR_PIEDRA;
  ctx.fillRect(0, 0, lado, lado);
  ctx.fillStyle = colorCss;
  ctx.fillRect(2, 2, lado - 4, lado - 4);
  ctx.fillStyle = COLOR_PIEDRA;
  const m = Math.round(lado * 0.32);
  ctx.fillRect(m, m, lado - 2 * m, lado - 2 * m);
  cuadradosCache.set(clave, canvas);
  return canvas;
}

export function crearCapaFiccion({ id, nombre, icono, geojson, color, alSeleccionar = null }) {
  const features = (geojson.features || []).filter((f) => f.geometry && f.geometry.coordinates?.length);
  const porId = new Map(features.map((f) => [f.id, f]));
  // Lugares con partes (la ciudad y sus estratos): de cerca se rotulan las partes, de lejos el todo.
  const conPartes = new Set(features.map((f) => f.properties?.parte_de).filter(Boolean));
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
        const tienePartes = conPartes.has(f.id);
        const imperial = props.faccion === 'imperio' || props.faccion === 'comerciantes';
        const lado = esParte ? 10 : 16;
        const condicion = new Cesium.DistanceDisplayCondition(0, esParte ? 60_000 : 1_200_000);
        const condicionEtiqueta = tienePartes ? new Cesium.DistanceDisplayCondition(60_000, 1_200_000) : condicion;
        const marcador = imperial
          ? { billboard: { image: imagenCuadrado(color || COLOR_FACCION[props.faccion], lado * 2), width: lado, height: lado, disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: condicion } }
          : { point: { pixelSize: esParte ? 7 : 11, color: c, outlineColor: Cesium.Color.fromCssColorString(COLOR_PIEDRA), outlineWidth: 2, disableDepthTestDistance: Number.POSITIVE_INFINITY, distanceDisplayCondition: condicion } };
        entidad = dataSource.entities.add({
          ...base,
          position: Cesium.Cartesian3.fromDegrees(g.coordinates[0], g.coordinates[1], 0),
          ...marcador,
          label: {
            text: principal,
            font: `500 ${esParte ? 13 : 15}px ${FUENTE}`,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: c,
            outlineColor: Cesium.Color.fromCssColorString(COLOR_PIEDRA),
            outlineWidth: 4,
            pixelOffset: new Cesium.Cartesian2(12, esParte ? 2 : -2),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: condicionEtiqueta,
            scaleByDistance: new Cesium.NearFarScalar(20_000, 1.0, 400_000, 0.7),
          },
        });
      } else if (g.type === 'LineString' && (props.tipo === 'frontera' || props.tipo === 'gran-rio')) {
        // Los grandes ríos que cierran el mundo: agua ancha. La raya del imperio: tumbaga, discontinua, por tierra.
        const positions = Cesium.Cartesian3.fromDegreesArray(g.coordinates.flat());
        const condicion = new Cesium.DistanceDisplayCondition(0, 900_000);
        const esRio = props.tipo === 'gran-rio';
        entidad = dataSource.entities.add({
          ...base,
          polyline: esRio
            ? { positions, width: 6, material: Cesium.Color.fromCssColorString(COLOR_AGUA).withAlpha(0.95), clampToGround: true, distanceDisplayCondition: condicion }
            : {
              positions,
              width: 3,
              material: new Cesium.PolylineDashMaterialProperty({ color: c.withAlpha(0.95), gapColor: Cesium.Color.TRANSPARENT, dashLength: 24 }),
              clampToGround: true,
              distanceDisplayCondition: condicion,
            },
        });
        const medio = g.coordinates[Math.floor(g.coordinates.length / 2)];
        dataSource.entities.add({
          id: `${id}:${f.id}:nombre`,
          properties: { capa: id, fid: f.id },
          position: Cesium.Cartesian3.fromDegrees(medio[0], medio[1], 0),
          label: {
            text: principal,
            font: `italic 500 14px ${FUENTE}`,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: c,
            outlineColor: Cesium.Color.fromCssColorString(COLOR_PIEDRA),
            outlineWidth: 4,
            pixelOffset: new Cesium.Cartesian2(10, 0),
            horizontalOrigin: Cesium.HorizontalOrigin.LEFT,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 400_000),
          },
        });
      } else if (g.type === 'LineString') {
        const rango = props.rango || 'secundario';
        const cAgua = Cesium.Color.fromCssColorString(COLOR_AGUA);
        const ancho = { principal: 4, secundario: 2.5, oculto: 2 }[rango] || 2.5;
        const material = rango === 'oculto'
          ? new Cesium.PolylineDashMaterialProperty({ color: cAgua.withAlpha(0.9), dashLength: 14 })
          : cAgua.withAlpha(rango === 'principal' ? 0.95 : 0.8);
        entidad = dataSource.entities.add({
          ...base,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(g.coordinates.flat()),
            width: ancho,
            material,
            clampToGround: true,
          },
        });
      } else if (g.type === 'Polygon' && (props.tipo === 'hidrografia' || props.subtipo === 'colinas')) {
        // Textura del río: agua negra de las cochas, bosque inundado, islas, playas, colinas. Sin etiqueta.
        const anillo = Cesium.Cartesian3.fromDegreesArray(g.coordinates[0].flat());
        const relleno = {
          cocha: Cesium.Color.fromCssColorString(COLOR_AGUA_NEGRA).withAlpha(0.9),
          tahuampa: Cesium.Color.fromCssColorString(COLOR_AGUA).withAlpha(0.28),
          isla: Cesium.Color.fromCssColorString(COLOR_MONTE).withAlpha(0.95),
          playa: Cesium.Color.fromCssColorString(COLOR_ARENA).withAlpha(0.9),
          colinas: Cesium.Color.fromCssColorString(COLOR_COLINA).withAlpha(0.22),
        }[props.subtipo] || c.withAlpha(0.3);
        entidad = dataSource.entities.add({
          ...base,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(anillo),
            material: relleno,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 700_000),
          },
        });
        if (props.subtipo === 'colinas') {
          dataSource.entities.add({
            id: `${id}:${f.id}:borde`,
            properties: { capa: id, fid: f.id },
            polyline: { positions: anillo, width: 1.5, material: Cesium.Color.fromCssColorString(COLOR_COLINA).withAlpha(0.7), clampToGround: true, distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 700_000) },
          });
        }
      } else if (g.type === 'Polygon') {
        const anillo = Cesium.Cartesian3.fromDegreesArray(g.coordinates[0].flat());
        // El territorio continental solo se ve de lejos; el local, solo de cerca.
        const continental = props.escala === 'continental';
        const condicion = continental
          ? new Cesium.DistanceDisplayCondition(600_000, Number.POSITIVE_INFINITY)
          : new Cesium.DistanceDisplayCondition(0, 900_000);
        entidad = dataSource.entities.add({
          ...base,
          polygon: {
            hierarchy: new Cesium.PolygonHierarchy(anillo),
            material: c.withAlpha(continental ? 0.22 : 0.14),
            distanceDisplayCondition: condicion,
          },
        });
        dataSource.entities.add({
          id: `${id}:${f.id}:borde`,
          properties: { capa: id, fid: f.id },
          polyline: { positions: anillo, width: continental ? 3 : 2, material: c.withAlpha(0.8), clampToGround: true, distanceDisplayCondition: condicion },
        });
        const centro = g.coordinates[0].reduce((acc, [lon, lat]) => [acc[0] + lon / g.coordinates[0].length, acc[1] + lat / g.coordinates[0].length], [0, 0]);
        dataSource.entities.add({
          id: `${id}:${f.id}:nombre`,
          properties: { capa: id, fid: f.id },
          position: Cesium.Cartesian3.fromDegrees(centro[0], centro[1], 0),
          label: {
            text: principal,
            font: `500 ${continental ? 24 : 15}px ${FUENTE}`,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            fillColor: c,
            outlineColor: Cesium.Color.fromCssColorString(COLOR_PIEDRA),
            outlineWidth: 4,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            distanceDisplayCondition: condicion,
          },
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
    /**
     * Mueve una entidad puntual (modo autor): actualiza la geometría del
     * feature y la posición de la entidad en el globo.
     */
    moverEntidad(fid, lon, lat) {
      const f = porId.get(fid);
      const e = entidadesPorId.get(fid);
      if (!f || !e || f.geometry.type !== 'Point') return false;
      f.geometry.coordinates = [Number(lon.toFixed(5)), Number(lat.toFixed(5))];
      e.position = Cesium.Cartesian3.fromDegrees(lon, lat, 0);
      viewerRef?.scene.requestRender();
      return true;
    },
    /** Resalta una entidad (o ninguna con null). */
    resaltar(fid) {
      for (const [k, e] of entidadesPorId) {
        const esParte = !!porId.get(k)?.properties?.parte_de;
        const activo = k === fid;
        if (e.point) {
          e.point.pixelSize = activo ? 16 : (esParte ? 7 : 11);
          e.point.outlineWidth = activo ? 3 : 2;
        }
        if (e.billboard) {
          const lado = (activo ? 22 : (esParte ? 10 : 16));
          e.billboard.width = lado;
          e.billboard.height = lado;
        }
        if (e.label) {
          // No se toca la fuente: cambiarla rerasteriza los glifos y Cesium pierde letras.
          e.label.scale = activo ? 1.2 : 1;
          e.label.fillColor = activo ? Cesium.Color.fromCssColorString(COLOR_FACCION.imperio) : colorDe(porId.get(k)?.properties || {});
        }
      }
      viewerRef?.scene.requestRender();
    },
    alSeleccionar,
  };
}
