/**
 * Sync configuration loading and saving utilities.
 *
 * This module handles reading and writing the sync configuration file
 * at {vault}/.scribe/sync.json. The config file controls whether sync
 * is enabled and contains vault-specific sync settings.
 *
 * @module sync-config
 * @since 1.0.0
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { SyncConfig } from '@scribe/shared';
import { SYNC_CONFIG_PATH, DEFAULT_SYNC_CONFIG } from '@scribe/shared';

/**
 * Result of loading a sync configuration.
 *
 * This discriminated union allows callers to distinguish between:
 * - Success with a valid config
 * - Disabled state (no config file or enabled: false)
 * - Error state (malformed config file)
 *
 * @since 1.0.0
 */
export type LoadSyncConfigResult =
  | { status: 'enabled'; config: SyncConfig }
  | { status: 'disabled'; reason: 'missing' | 'disabled' | 'malformed' }
  | { status: 'error'; error: Error };

/**
 * Load sync configuration from a vault.
 *
 * This function implements the "disabled by default" pattern:
 * - Missing config file = disabled
 * - Malformed JSON = disabled (with warning)
 * - enabled: false = disabled
 * - enabled: true with valid config = enabled
 *
 * @param vaultPath - Path to the vault directory
 * @returns LoadSyncConfigResult indicating the sync status
 *
 * @example
 * ```typescript
 * const result = await loadSyncConfig('/path/to/vault');
 *
 * if (result.status === 'enabled') {
 *   const engine = await createSyncEngine({
 *     vaultPath,
 *     config: result.config,
 *     // ... other options
 *   });
 * } else {
 *   console.log(`Sync disabled: ${result.reason}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export async function loadSyncConfig(vaultPath: string): Promise<LoadSyncConfigResult> {
  const configPath = join(vaultPath, SYNC_CONFIG_PATH);

  try {
    const content = await readFile(configPath, 'utf-8');
    const parsed = JSON.parse(content);

    // Validate that enabled is explicitly true (strict equality check)
    if (parsed.enabled !== true) {
      return { status: 'disabled', reason: 'disabled' };
    }

    // Validate required fields for a valid SyncConfig
    if (
      typeof parsed.serverUrl !== 'string' ||
      typeof parsed.deviceId !== 'string' ||
      typeof parsed.enabledAt !== 'number' ||
      typeof parsed.lastSyncSequence !== 'number' ||
      typeof parsed.syncIntervalMs !== 'number'
    ) {
      // Config file exists but is missing required fields
      // This could happen if the user manually edited the file incorrectly
      return { status: 'disabled', reason: 'malformed' };
    }

    const config: SyncConfig = {
      enabled: true,
      serverUrl: parsed.serverUrl,
      deviceId: parsed.deviceId,
      enabledAt: parsed.enabledAt,
      lastSyncSequence: parsed.lastSyncSequence,
      syncIntervalMs: parsed.syncIntervalMs,
    };

    return { status: 'enabled', config };
  } catch (error) {
    // Handle file not found
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return { status: 'disabled', reason: 'missing' };
    }

    // Handle JSON parse errors
    if (error instanceof SyntaxError) {
      return { status: 'disabled', reason: 'malformed' };
    }

    // Unexpected error
    return { status: 'error', error: error instanceof Error ? error : new Error(String(error)) };
  }
}

/**
 * Check if sync is enabled for a vault (simple boolean check).
 *
 * This is a convenience function for callers who only need to know
 * if sync is enabled, without needing the full config.
 *
 * @param vaultPath - Path to the vault directory
 * @returns true if sync is enabled, false otherwise
 *
 * @example
 * ```typescript
 * if (await isSyncEnabled('/path/to/vault')) {
 *   // Initialize sync engine
 * }
 * ```
 *
 * @since 1.0.0
 */
export async function isSyncEnabled(vaultPath: string): Promise<boolean> {
  const result = await loadSyncConfig(vaultPath);
  return result.status === 'enabled';
}

/**
 * Save sync configuration to a vault.
 *
 * Creates the .scribe directory if it doesn't exist.
 * Writes the config as formatted JSON for human readability.
 *
 * @param vaultPath - Path to the vault directory
 * @param config - The sync configuration to save
 *
 * @example
 * ```typescript
 * const config: SyncConfig = {
 *   enabled: true,
 *   serverUrl: DEFAULT_SYNC_CONFIG.serverUrl,
 *   deviceId: crypto.randomUUID(),
 *   enabledAt: Date.now(),
 *   lastSyncSequence: 0,
 *   syncIntervalMs: DEFAULT_SYNC_CONFIG.syncIntervalMs,
 * };
 *
 * await saveSyncConfig('/path/to/vault', config);
 * ```
 *
 * @since 1.0.0
 */
export async function saveSyncConfig(vaultPath: string, config: SyncConfig): Promise<void> {
  const configPath = join(vaultPath, SYNC_CONFIG_PATH);

  // Ensure .scribe directory exists
  await mkdir(dirname(configPath), { recursive: true });

  // Write config with pretty formatting for human readability
  await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

/**
 * Create a new sync configuration with defaults.
 *
 * Generates a new device ID and sets the enabledAt timestamp.
 * Uses DEFAULT_SYNC_CONFIG for server URL and sync interval.
 *
 * @param enabled - Whether sync should be enabled (default: true)
 * @returns A new SyncConfig with generated values
 *
 * @example
 * ```typescript
 * const config = createDefaultSyncConfig();
 * await saveSyncConfig('/path/to/vault', config);
 * ```
 *
 * @since 1.0.0
 */
export function createDefaultSyncConfig(enabled = true): SyncConfig {
  return {
    enabled,
    serverUrl: DEFAULT_SYNC_CONFIG.serverUrl,
    deviceId: crypto.randomUUID(),
    enabledAt: Date.now(),
    lastSyncSequence: DEFAULT_SYNC_CONFIG.lastSyncSequence,
    syncIntervalMs: DEFAULT_SYNC_CONFIG.syncIntervalMs,
  };
}
