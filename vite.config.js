/**
 * Configuración de Vite del mapa de Upriver.
 *
 * Sin proxies, sin claves, sin `define`: el build es estático y no habla con
 * ningún servicio en runtime. El plugin de Cesium copia sus assets (Workers,
 * texturas, widgets.css) a `dist/cesium/` y fija CESIUM_BASE_URL.
 */

import { defineConfig } from 'vite';
import cesium from 'vite-plugin-cesium';

export default defineConfig({
  plugins: [cesium()],
  server: {
    host: 'localhost',
    port: 4173,
  },
  preview: {
    port: 4174,
  },
  build: {
    chunkSizeWarningLimit: 1500,
  },
});
