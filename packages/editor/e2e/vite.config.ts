import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname),
  build: {
    outDir: resolve(__dirname, '../dist-e2e'),
  },
  resolve: {
    alias: {
      '@scribe/editor': resolve(__dirname, '../src'),
    },
  },
});
