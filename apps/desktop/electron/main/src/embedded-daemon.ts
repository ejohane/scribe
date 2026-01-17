/**
 * Embedded Daemon - In-process daemon management for Electron.
 *
 * This module provides lifecycle management for an embedded Scribe daemon
 * running within the Electron main process. Instead of connecting to an
 * external daemon, the desktop app starts and manages its own daemon instance.
 *
 * Benefits:
 * - Single process startup (no external daemon needed)
 * - Auto-port assignment (avoids conflicts)
 * - Clean shutdown on app quit
 * - Simplified user experience
 *
 * @module electron/main/embedded-daemon
 */

import { app } from 'electron';
import { Daemon, type DaemonConfig, type DaemonInfo } from '@scribe/scribed';
import { mainLogger } from './logger';

/**
 * Information about the embedded daemon after startup.
 */
export interface EmbeddedDaemonInfo {
  /** The running daemon instance */
  daemon: Daemon;
  /** Port the daemon is listening on */
  port: number;
  /** Full daemon info including PID, vault path, etc. */
  info: DaemonInfo;
}

/**
 * Options for starting the embedded daemon.
 */
export interface EmbeddedDaemonOptions {
  /** Absolute path to the vault directory */
  vaultPath: string;
  /** Preferred port (0 = auto-assign, default) */
  port?: number;
}

/**
 * Start the embedded daemon.
 *
 * Creates and starts a Daemon instance configured for the specified vault.
 * Uses port 0 by default to let the OS assign an available port, avoiding
 * conflicts with other applications or multiple Scribe instances.
 *
 * @param options - Daemon startup options
 * @returns Information about the running daemon
 * @throws Error if daemon fails to start
 *
 * @example
 * ```typescript
 * const daemonInfo = await startEmbeddedDaemon({
 *   vaultPath: '/Users/me/Documents/vault',
 * });
 * console.log(`Daemon running on port ${daemonInfo.port}`);
 * ```
 */
export async function startEmbeddedDaemon(
  options: EmbeddedDaemonOptions
): Promise<EmbeddedDaemonInfo> {
  mainLogger.info('Starting embedded daemon', { vaultPath: options.vaultPath });

  const config: DaemonConfig = {
    vaultPath: options.vaultPath,
    // Use port 0 to let OS assign an available port
    // This avoids conflicts and allows multiple instances if needed
    port: options.port ?? 0,
  };

  const daemon = new Daemon(config);

  try {
    const info = await daemon.start();

    mainLogger.info('Embedded daemon started', {
      port: info.port,
      pid: info.pid,
      vaultPath: info.vaultPath,
    });

    return {
      daemon,
      port: info.port,
      info,
    };
  } catch (error) {
    mainLogger.error('Failed to start embedded daemon', { error });
    throw error;
  }
}

/**
 * Stop the embedded daemon gracefully.
 *
 * Ensures clean shutdown of all daemon resources:
 * - Closes database connections
 * - Disconnects WebSocket clients
 * - Persists any pending Yjs state
 *
 * @param daemonInfo - The daemon info returned from startEmbeddedDaemon
 *
 * @example
 * ```typescript
 * await stopEmbeddedDaemon(daemonInfo);
 * console.log('Daemon stopped');
 * ```
 */
export async function stopEmbeddedDaemon(daemonInfo: EmbeddedDaemonInfo): Promise<void> {
  mainLogger.info('Stopping embedded daemon');

  try {
    await daemonInfo.daemon.stop();
    mainLogger.info('Embedded daemon stopped successfully');
  } catch (error) {
    mainLogger.error('Error stopping embedded daemon', { error });
    throw error;
  }
}

/**
 * Show a native error dialog and quit the app.
 *
 * Used when the daemon fails to start - displays a user-friendly
 * error message before exiting.
 *
 * @param title - Dialog title
 * @param message - Error message to display
 */
export async function showErrorAndQuit(title: string, message: string): Promise<never> {
  mainLogger.error('Fatal error, showing dialog and quitting', { title, message });

  // Dynamic import to avoid circular dependencies
  const { dialog } = await import('electron');

  await dialog.showMessageBox({
    type: 'error',
    title,
    message,
    buttons: ['Quit'],
  });

  app.quit();

  // This ensures the function never returns
  // The app.quit() is async so we need to wait
  return new Promise(() => {
    // Never resolves - app will quit
  });
}
