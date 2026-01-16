/**
 * Daemon Discovery - Find and verify running Scribe daemon.
 *
 * This module provides utilities to discover and connect to a running Scribe daemon:
 * - Auto-discovery by reading ~/.scribe/daemon.json (Node.js)
 * - Health check verification before returning daemon info
 * - Manual configuration for browser contexts
 *
 * @module
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Information about a running daemon.
 * Matches the structure written by the daemon to ~/.scribe/daemon.json
 */
export interface DaemonInfo {
  /** Process ID of the daemon */
  pid: number;
  /** Port the daemon is listening on */
  port: number;
  /** Absolute path to the vault directory */
  vaultPath: string;
  /** ISO timestamp of when the daemon started */
  startedAt: string;
  /** Package version of the daemon */
  version: string;
}

/**
 * Options for daemon discovery.
 */
export interface DiscoveryOptions {
  /** Health check timeout in milliseconds (default: 3000) */
  timeout?: number;
  /** Override default config path for testing */
  configPath?: string;
}

/**
 * Health check response from daemon.
 */
export interface HealthResponse {
  /** Status of the daemon */
  status: 'ok';
  /** Uptime in seconds */
  uptime: number;
  /** Package version */
  version: string;
}

/**
 * Get the default daemon config path.
 * @internal
 */
export function getDefaultConfigPath(): string {
  return path.join(process.env.HOME ?? '', '.scribe', 'daemon.json');
}

/**
 * Check if the daemon is healthy by calling its health endpoint.
 *
 * @param port - Port to check
 * @param timeout - Request timeout in milliseconds
 * @returns true if daemon responds with 200 OK, false otherwise
 */
async function checkHealth(port: number, timeout: number): Promise<boolean> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });

    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Discover a running Scribe daemon.
 *
 * Reads the daemon info file at ~/.scribe/daemon.json and verifies
 * that the daemon is responsive via health check.
 *
 * @param options - Discovery options
 * @returns Daemon info if found and responsive, null otherwise
 *
 * @example
 * ```typescript
 * const info = await discoverDaemon();
 * if (!info) {
 *   throw new Error('No daemon running. Start with: scribe daemon start');
 * }
 * console.log(`Found daemon on port ${info.port}`);
 * ```
 */
export async function discoverDaemon(options: DiscoveryOptions = {}): Promise<DaemonInfo | null> {
  const configPath = options.configPath ?? getDefaultConfigPath();
  const timeout = options.timeout ?? 3000;

  try {
    // 1. Read daemon info file
    const content = await fs.readFile(configPath, 'utf-8');
    const info = JSON.parse(content) as DaemonInfo;

    // 2. Verify daemon is responsive via health check
    const isHealthy = await checkHealth(info.port, timeout);

    if (isHealthy) {
      return info;
    }

    // Daemon not responsive - stale file
    return null;
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'code' in err && err.code === 'ENOENT') {
      // No daemon info file - not running
      return null;
    }
    // Re-throw unexpected errors (permissions, invalid JSON, etc.)
    throw err;
  }
}

/**
 * Wait for daemon to become available.
 *
 * Polls for daemon availability, useful for tests or startup sequences
 * where the daemon may take a moment to initialize.
 *
 * @param options - Wait options
 * @returns Daemon info when available
 * @throws Error if daemon not found within timeout
 *
 * @example
 * ```typescript
 * // After starting daemon in background
 * try {
 *   const info = await waitForDaemon({ timeout: 10000 });
 *   console.log('Daemon is ready');
 * } catch (err) {
 *   console.error('Daemon did not start in time');
 * }
 * ```
 */
export async function waitForDaemon(
  options: {
    /** Total timeout in milliseconds (default: 10000) */
    timeout?: number;
    /** Interval between poll attempts in milliseconds (default: 200) */
    pollInterval?: number;
    /** Override default config path for testing */
    configPath?: string;
  } = {}
): Promise<DaemonInfo> {
  const timeout = options.timeout ?? 10000;
  const pollInterval = options.pollInterval ?? 200;

  const start = Date.now();

  while (Date.now() - start < timeout) {
    const info = await discoverDaemon({ configPath: options.configPath });
    if (info) {
      return info;
    }

    await new Promise((r) => setTimeout(r, pollInterval));
  }

  throw new Error(`Daemon not found within ${timeout}ms`);
}

// -----------------------------------------------------------------------------
// Browser Compatibility
// -----------------------------------------------------------------------------

/**
 * Manual daemon configuration for browser contexts.
 *
 * In browsers, we cannot read the daemon.json file from the filesystem.
 * Users must provide the connection info manually.
 */
export interface ManualDaemonConfig {
  /** Host address (default: '127.0.0.1') */
  host?: string;
  /** Port the daemon is listening on (required) */
  port: number;
}

/**
 * Create daemon info from manual configuration.
 *
 * For browser contexts where auto-discovery is not available,
 * this function creates a DaemonInfo object from user-provided config.
 *
 * @param config - Manual daemon configuration
 * @returns DaemonInfo with placeholders for unknown fields
 *
 * @example
 * ```typescript
 * // Browser usage - user provides port from daemon CLI output
 * const info = createManualDaemonInfo({ port: 47832 });
 * const trpcUrl = `http://${info.host ?? '127.0.0.1'}:${info.port}/trpc`;
 * ```
 */
export function createManualDaemonInfo(config: ManualDaemonConfig): DaemonInfo {
  return {
    pid: 0, // Unknown in browser context
    port: config.port,
    vaultPath: '', // Unknown in browser context
    startedAt: '', // Unknown in browser context
    version: '', // Unknown in browser context
  };
}

// -----------------------------------------------------------------------------
// URL Helpers
// -----------------------------------------------------------------------------

/**
 * Get the tRPC endpoint URL for the daemon.
 *
 * @param info - Daemon info or port number
 * @returns URL string for tRPC endpoint
 *
 * @example
 * ```typescript
 * const info = await discoverDaemon();
 * if (info) {
 *   const url = getTrpcUrl(info);
 *   // url: 'http://127.0.0.1:47832/trpc'
 * }
 * ```
 */
export function getTrpcUrl(info: DaemonInfo | { port: number }): string {
  return `http://127.0.0.1:${info.port}/trpc`;
}

/**
 * Get the WebSocket URL for Yjs sync.
 *
 * @param info - Daemon info or port number
 * @returns WebSocket URL string
 *
 * @example
 * ```typescript
 * const info = await discoverDaemon();
 * if (info) {
 *   const wsUrl = getWebSocketUrl(info);
 *   const ws = new WebSocket(wsUrl);
 * }
 * ```
 */
export function getWebSocketUrl(info: DaemonInfo | { port: number }): string {
  return `ws://127.0.0.1:${info.port}/ws`;
}

/**
 * Get the health check URL for the daemon.
 *
 * @param info - Daemon info or port number
 * @returns URL string for health endpoint
 */
export function getHealthUrl(info: DaemonInfo | { port: number }): string {
  return `http://127.0.0.1:${info.port}/health`;
}
