import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy all api service routes to localhost:8080
      // (dashboard calls /status, /incidents, /chat etc. — no /api prefix)
      '/status':    { target: 'http://localhost:8080', changeOrigin: true },
      '/incidents': { target: 'http://localhost:8080', changeOrigin: true },
      '/chat':      { target: 'http://localhost:8080', changeOrigin: true },
      '/ingest':    { target: 'http://localhost:8080', changeOrigin: true },
      '/zerops':    { target: 'http://localhost:8080', changeOrigin: true },
      '/sandbox':   { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  define: {
    // Allow runtime override via VITE_API_URL env var (set in Zerops GUI)
    __API_URL__:      JSON.stringify(process.env.VITE_API_URL      || ''),
    // Public URL for demo-api (for TriggerPanel direct calls)
    __DEMO_API_URL__: JSON.stringify(process.env.VITE_DEMO_API_URL || 'http://localhost:3001'),
  },
});
