import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // Optimize for Electron renderer
    target: 'esnext',
    minify: 'esbuild',
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  // Electron renderer environment
  base: './',
});
