import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin';
import path from 'path';
import fs from 'fs';
// Import root package.json for version (semantic-release updates this one)
import pkg from '../../../package.json';

// Read release notes from repository root
const releaseNotesPath = path.resolve(__dirname, '../../../RELEASE_NOTES.md');
const releaseNotes = fs.existsSync(releaseNotesPath)
  ? fs.readFileSync(releaseNotesPath, 'utf-8')
  : '# Scribe Release Notes\n\nNo release notes available.';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), vanillaExtractPlugin()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
    __RELEASE_NOTES__: JSON.stringify(releaseNotes),
  },
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
