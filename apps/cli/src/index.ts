#!/usr/bin/env node
/**
 * Scribe CLI - Command-line interface for note-taking
 *
 * This is the entry point for the Scribe CLI application.
 * It bootstraps the CLI framework and registers available commands.
 */

import { createCLI } from './cli';
import { setupSignalHandlers } from './signals';

// Set up signal handlers early for graceful shutdown
setupSignalHandlers();

const cli = createCLI();
cli.parseAsync(process.argv).catch((err) => {
  console.error(JSON.stringify({ error: err.message, code: 'INTERNAL_ERROR' }));
  process.exit(1);
});
