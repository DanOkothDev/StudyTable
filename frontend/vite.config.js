import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The proxy sends /api/... to Flask, so the browser sees one site and the login cookie just works.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://localhost:5000' } },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'pdfjs': ['pdfjs-dist'],
        },
      },
    },
  },
});
