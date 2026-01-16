/**
 * Daemon Discovery - Find and verify running Scribe daemon.
 *
 * Provides utilities to:
 * - Discover if a daemon is running
 * - Verify the daemon is responsive
 * - Get connection info for clients
 *
 * @module
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { DaemonInfo, HealthResponse } from './daemon.js';

/** Get directory for daemon info file (computed at runtime to respect HOME changes) */
function getDaemonInfoDir(): string {
  return path.join(process.env.HOME ?? '', '.scribe');
}

/** Get path to daemon info file (computed at runtime to respect HOME changes) */
function getDaemonInfoFile(): string {
  return path.join(getDaemonInfoDir(), 'daemon.json');
}

/** Default timeout for health checks in milliseconds */
const DEFAULT_HEALTH_TIMEOUT = 5000;

/**
 * Options for daemon discovery.
 */
export interface DiscoverOptions {
  /** Timeout for health check in milliseconds (default: 5000) */
  timeout?: number;
  /** Whether to verify the daemon is responsive (default: true) */
  verifyHealth?: boolean;
}

/**
 * Result of daemon discovery.
 */
export interface DiscoveryResult {
  /** Whether a daemon was found */
  found: boolean;
  /** Daemon info if found */
  info?: DaemonInfo;
  /** Health response if verified */
  health?: HealthResponse;
  /** Error message if discovery failed */
  error?: string;
}

/**
 * Discover a running Scribe daemon.
 *
 * @param options - Discovery options
 * @returns Discovery result with daemon info and health status
 *
 * @example
 * ```typescript
 * const result = await discoverDaemon();
 * if (result.found && result.info) {
 *   console.log(`Found daemon on port ${result.info.port}`);
 *   // Connect to daemon...
 * } else {
 *   console.log('No daemon running');
 * }
 * ```
 */
export async function discoverDaemon(options: DiscoverOptions = {}): Promise<DiscoveryResult> {
  const { timeout = DEFAULT_HEALTH_TIMEOUT, verifyHealth = true } = options;

  // Read daemon info file
  let info: DaemonInfo;
  try {
    const content = await fs.readFile(getDaemonInfoFile(), 'utf-8');
    info = JSON.parse(content) as DaemonInfo;
  } catch {
    return { found: false, error: 'No daemon info file found' };
  }

  // Check if process is running
  try {
    process.kill(info.pid, 0);
  } catch {
    // Process not running - stale file
    await cleanupStaleFile();
    return { found: false, error: 'Daemon process not running (stale info file)' };
  }

  // Optionally verify health
  if (verifyHealth) {
    const health = await checkHealth(info.port, timeout);
    if (!health) {
      return {
        found: true,
        info,
        error: 'Daemon not responding to health check',
      };
    }
    return { found: true, info, health };
  }

  return { found: true, info };
}

/**
 * Get daemon connection URL for tRPC client.
 *
 * @param info - Daemon info
 * @returns URL string for tRPC endpoint
 *
 * @example
 * ```typescript
 * const result = await discoverDaemon();
 * if (result.found && result.info) {
 *   const url = getTrpcUrl(result.info);
 *   const client = createTRPCProxyClient<AppRouter>({
 *     links: [httpBatchLink({ url })],
 *   });
 * }
 * ```
 */
export function getTrpcUrl(info: DaemonInfo): string {
  return `http://127.0.0.1:${info.port}/trpc`;
}

/**
 * Get daemon WebSocket URL for Yjs sync.
 *
 * @param info - Daemon info
 * @returns WebSocket URL string
 *
 * @example
 * ```typescript
 * const result = await discoverDaemon();
 * if (result.found && result.info) {
 *   const wsUrl = getWebSocketUrl(result.info);
 *   const ws = new WebSocket(wsUrl);
 * }
 * ```
 */
export function getWebSocketUrl(info: DaemonInfo): string {
  return `ws://127.0.0.1:${info.port}/ws`;
}

/**
 * Get daemon health endpoint URL.
 *
 * @param info - Daemon info
 * @returns URL string for health endpoint
 */
export function getHealthUrl(info: DaemonInfo): string {
  return `http://127.0.0.1:${info.port}/health`;
}

/**
 * Check if daemon is healthy.
 *
 * @param port - Port to check
 * @param timeout - Request timeout in milliseconds
 * @returns Health response if healthy, null otherwise
 */
async function checkHealth(port: number, timeout: number): Promise<HealthResponse | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    const response = await fetch(`http://127.0.0.1:${port}/health`, {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return (await response.json()) as HealthResponse;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Clean up stale daemon info file.
 */
async function cleanupStaleFile(): Promise<void> {
  try {
    await fs.unlink(getDaemonInfoFile());
  } catch {
    // Ignore errors
  }
}

/**
 * Wait for daemon to become available.
 *
 * @param options - Wait options
 * @returns Discovery result when daemon is available or timeout
 *
 * @example
 * ```typescript
 * // After starting daemon in background
 * const result = await waitForDaemon({ maxAttempts: 30, intervalMs: 100 });
 * if (result.found) {
 *   console.log('Daemon is ready');
 * }
 * ```
 */
export async function waitForDaemon(
  options: {
    /** Maximum number of attempts (default: 50) */
    maxAttempts?: number;
    /** Interval between attempts in milliseconds (default: 100) */
    intervalMs?: number;
    /** Timeout for each health check in milliseconds (default: 1000) */
    healthTimeout?: number;
  } = {}
): Promise<DiscoveryResult> {
  const { maxAttempts = 50, intervalMs = 100, healthTimeout = 1000 } = options;

  for (let i = 0; i < maxAttempts; i++) {
    const result = await discoverDaemon({ timeout: healthTimeout });
    if (result.found && result.health) {
      return result;
    }
    await sleep(intervalMs);
  }

  return { found: false, error: 'Timeout waiting for daemon' };
}

/**
 * Sleep for specified milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
