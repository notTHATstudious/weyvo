import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Same-origin /api in development so the httpOnly session cookie needs no CORS.
    proxy: {
      '/api': 'http://localhost:8080',
      '/s/': { target: 'http://localhost:8080', rewrite: (p) => p.replace(/^\/s\//, '/api/share/') },
    },
  },
});
