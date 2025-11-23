import * as esbuild from 'esbuild';
import { spawn } from 'child_process';

const isWatch = process.argv.includes('--watch');

const config = {
  entryPoints: ['src/main.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'esm',
  outfile: 'dist/main.js',
  sourcemap: true,
  external: ['electron'],
  minify: !isWatch,
  define: {
    'process.env.NODE_ENV': isWatch ? '"development"' : '"production"',
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
};

if (isWatch) {
  const ctx = await esbuild.context(config);

  let electronProcess = null;

  await ctx.watch();

  // Simple watcher to restart Electron on rebuild
  console.log('[main] Watching for changes...');

  const startElectron = () => {
    if (electronProcess) {
      electronProcess.kill();
    }
    electronProcess = spawn('electron', ['.'], {
      stdio: 'inherit',
      cwd: process.cwd(),
    });
  };

  // Start electron on first build
  setTimeout(startElectron, 1000);

  process.on('SIGINT', () => {
    if (electronProcess) {
      electronProcess.kill();
    }
    process.exit();
  });
} else {
  await esbuild.build(config);
  console.log('[main] Build complete');
}
