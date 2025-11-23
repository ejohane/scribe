import * as esbuild from 'esbuild';

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/preload.ts'],
  bundle: true,
  platform: 'node',
  target: 'chrome120',
  format: 'cjs',
  outfile: 'dist/preload.js',
  sourcemap: true,
  external: ['electron'],
  minify: !isWatch,
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
  },
};

if (isWatch) {
  const ctx = await esbuild.context(config);
  await ctx.watch();
  console.log('[preload] Watching for changes...');
} else {
  await esbuild.build(config);
  console.log('[preload] Build complete');
}
