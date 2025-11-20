/**
 * @scribe/core-engine
 *
 * Core Engine entrypoint - runs as a standalone process and communicates via JSON-RPC.
 */

import { CoreEngine } from './engine.js';

/**
 * Main entry point for the Core Engine.
 * Starts the JSON-RPC server and initializes all subsystems.
 */
async function main() {
  console.log('[Core Engine] Starting...');

  const engine = new CoreEngine();
  await engine.start();

  console.log('[Core Engine] Ready');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('[Core Engine] Shutting down...');
    await engine.stop();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('[Core Engine] Shutting down...');
    await engine.stop();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('[Core Engine] Fatal error:', error);
  process.exit(1);
});
