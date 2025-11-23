#!/usr/bin/env node

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let processes = [];

function cleanup() {
  console.log('\n🛑 Shutting down...');
  processes.forEach((p) => {
    try {
      p.kill();
    } catch (e) {
      // Ignore errors during cleanup
    }
  });
  process.exit();
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

async function main() {
  console.log('🚀 Starting Scribe development environment...\n');

  // Step 1: Build preload once (it doesn't change often)
  console.log('📦 Building preload script...');
  const preloadBuild = spawn('bun', ['run', 'build'], {
    cwd: join(__dirname, 'electron/preload'),
    stdio: 'inherit',
    shell: true,
  });

  await new Promise((resolve, reject) => {
    preloadBuild.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Preload build failed with code ${code}`));
      } else {
        console.log('✅ Preload built\n');
        resolve();
      }
    });
  });

  // Step 2: Start renderer dev server
  console.log('🎨 Starting renderer dev server...');
  const renderer = spawn('bun', ['run', 'dev'], {
    cwd: join(__dirname, 'renderer'),
    stdio: 'inherit',
    shell: true,
  });
  processes.push(renderer);

  // Wait for renderer to be ready
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // Step 3: Start main process in watch mode (this will start Electron)
  console.log('⚡ Starting Electron with hot reload...\n');
  const main = spawn('bun', ['run', 'dev'], {
    cwd: join(__dirname, 'electron/main'),
    stdio: 'inherit',
    shell: true,
    env: { ...process.env, NODE_ENV: 'development' },
  });
  processes.push(main);

  console.log('✨ Development environment ready!\n');
  console.log('📝 Renderer: http://localhost:5173');
  console.log('🔧 Main process: watching for changes');
  console.log('⚡ Electron: running with hot reload\n');
  console.log('Press Ctrl+C to stop\n');

  // Keep the script running
  await new Promise(() => {});
}

main().catch((err) => {
  console.error('❌ Error:', err.message);
  cleanup();
});
