import * as esbuild from 'esbuild';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isWatch = process.argv.includes('--watch');

// Find electron binary in workspace root
const electronPath = join(__dirname, '../../../../node_modules/.bin/electron');

if (!existsSync(electronPath) && isWatch) {
  console.error('❌ Electron binary not found. Please run: bun install');
  process.exit(1);
}

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
    // Start Electron from apps/desktop where package.json with "main" field lives
    const appRoot = join(__dirname, '../..');
    electronProcess = spawn(electronPath, [appRoot], {
      stdio: 'inherit',
    });

    electronProcess.on('error', (err) => {
      console.error('❌ Failed to start Electron:', err);
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
