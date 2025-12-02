import { build } from 'esbuild';

try {
  await build({
    entryPoints: ['src/preload.ts'],
    bundle: true,
    platform: 'node',
    target: 'chrome120',
    format: 'cjs',
    outfile: 'dist/preload.js',
    sourcemap: true,
    external: ['electron'],
    minify: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
  });
  console.log('[preload] Build complete');
} catch (error) {
  console.error('[preload] Build failed:', error);
  process.exit(1);
}
