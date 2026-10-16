import { defineConfig } from 'vite';
export default defineConfig({
  esbuild: { jsx: 'automatic' },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/admin/api': { target: 'http://127.0.0.1:8788', changeOrigin: false },
    },
  },
});
