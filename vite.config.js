import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // maplibre-gl resolves its web worker via new URL('./worker.mjs',
  // import.meta.url) — that breaks when optimizeDeps re-bundles it into
  // .vite/deps/. Excluding it keeps import.meta.url at the real dist path.
  // (mapbox-gl embeds its worker as a blob and pre-bundles fine.)
  optimizeDeps: {
    exclude: ['maplibre-gl'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // WebSocket support for /api/stream
        ws: true,
      },
    },
  },
});
