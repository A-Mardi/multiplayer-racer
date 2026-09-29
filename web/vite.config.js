import { defineConfig } from 'vite';
export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5179,
    strictPort: true,
    proxy: { '/api': 'http://127.0.0.1:8093', '/ws': { target: 'ws://127.0.0.1:8093', ws: true } },
  },
});
