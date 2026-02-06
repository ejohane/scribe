#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Scribe Daemon CLI - Manage the Scribe daemon process.
 *
 * Commands:
 * - scribed start [--vault /path] [--port N]  - Start daemon for vault
 * - scribed stop                               - Stop running daemon
 * - scribed status                             - Show daemon status
 *
 * @module
 */

import { Command } from 'commander';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { Daemon, getExistingDaemon, type DaemonInfo } from './daemon.js';
import { discoverDaemon, type DiscoveryResult } from './discovery.js';
import { VERSION } from './index.js';

const program = new Command();

program.name('scribed').description('Scribe daemon management').version(VERSION);

// scribed start
program
  .command('start')
  .description('Start the Scribe daemon')
  .option('-v, --vault <path>', 'Path to vault directory', process.cwd())
  .option('-p, --port <number>', 'Port to listen on', '47900')
  .action(async (options: { vault: string; port: string }) => {
    const vaultPath = path.resolve(options.vault);

    // Validate vault path
    if (!fs.existsSync(vaultPath)) {
      console.error(`Vault path does not exist: ${vaultPath}`);
      process.exit(1);
    }

    // Check for .scribe directory (valid vault indicator)
    const scribeDir = path.join(vaultPath, '.scribe');
    if (!fs.existsSync(scribeDir)) {
      console.log('Creating .scribe directory...');
      fs.mkdirSync(scribeDir, { recursive: true });
    }

    // Check if daemon is already running
    const existing = await getExistingDaemon();
    if (existing) {
      console.error(`Daemon already running`);
      console.error(`  PID:   ${existing.pid}`);
      console.error(`  Port:  ${existing.port}`);
      console.error(`  Vault: ${existing.vaultPath}`);
      process.exit(1);
    }

    try {
      const daemon = new Daemon({
        vaultPath,
        port: parseInt(options.port, 10),
      });

      const info = await daemon.start();
      console.log(`Daemon started`);
      console.log(`  PID:   ${info.pid}`);
      console.log(`  Port:  ${info.port}`);
      console.log(`  Vault: ${info.vaultPath}`);

      // Keep process running - signal handlers will handle shutdown
      // The daemon.start() sets up signal handlers for graceful shutdown
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to start daemon: ${message}`);
      process.exit(1);
    }
  });

// scribed stop
program
  .command('stop')
  .description('Stop the Scribe daemon')
  .action(async () => {
    const info = await getExistingDaemon();

    if (!info) {
      console.log('No daemon running');
      process.exit(0);
    }

    try {
      // Send SIGTERM to daemon process
      process.kill(info.pid, 'SIGTERM');
      console.log(`Sent stop signal to daemon (PID: ${info.pid})`);

      // Wait for daemon to stop
      await waitForDaemonStop(info.pid, 5000);
      console.log('Daemon stopped');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`Failed to stop daemon: ${message}`);
      process.exit(1);
    }
  });

// scribed status
program
  .command('status')
  .description('Show daemon status')
  .action(async () => {
    const result: DiscoveryResult = await discoverDaemon({ timeout: 2000 });

    if (!result.found || !result.info) {
      console.log('Status: Not running');
      process.exit(0);
    }

    const info: DaemonInfo = result.info;

    if (result.health) {
      console.log('Status: Running');
      console.log(`  PID:       ${info.pid}`);
      console.log(`  Port:      ${info.port}`);
      console.log(`  Vault:     ${info.vaultPath}`);
      console.log(`  Started:   ${info.startedAt}`);
      console.log(`  Uptime:    ${formatUptime(result.health.uptime)}`);
      console.log(`  Version:   ${info.version}`);
    } else {
      console.log('Status: Running (unresponsive)');
      console.log(`  PID:       ${info.pid}`);
      console.log(`  Port:      ${info.port}`);
      console.log(`  Vault:     ${info.vaultPath}`);
      if (result.error) {
        console.log(`  Error:     ${result.error}`);
      }
    }
  });

/**
 * Wait for a daemon process to stop.
 *
 * @param pid - Process ID to wait for
 * @param timeout - Maximum wait time in milliseconds
 * @throws Error if daemon doesn't stop within timeout
 */
async function waitForDaemonStop(pid: number, timeout: number): Promise<void> {
  const start = Date.now();

  while (Date.now() - start < timeout) {
    try {
      // Signal 0 checks if process exists without sending a signal
      process.kill(pid, 0);
      // Still running, wait
      await new Promise((r) => setTimeout(r, 100));
    } catch {
      // Process gone
      return;
    }
  }

  throw new Error('Daemon did not stop within timeout');
}

/**
 * Format uptime seconds to human-readable string.
 *
 * @param seconds - Uptime in seconds
 * @returns Formatted string like "2h 15m" or "30s"
 */
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${mins}m`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

// Parse and execute
program.parse();
