import { build } from 'esbuild';

try {
  await build({
    entryPoints: ['src/main.ts'],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'esm',
    outfile: 'dist/main.js',
    sourcemap: true,
    external: ['electron'],
    minify: false,
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    banner: {
      js: `
        import { createRequire } from 'module';
        import { fileURLToPath } from 'url';
        import { dirname } from 'path';
        const require = createRequire(import.meta.url);
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = dirname(__filename);
      `,
    },
  });
  console.log('[main] Build complete');
} catch (error) {
  console.error('[main] Build failed:', error);
  process.exit(1);
}
