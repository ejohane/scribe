/**
 * Vault Path Resolution
 *
 * Resolves the vault path using a configurable precedence order:
 * 1. --vault CLI flag (highest priority)
 * 2. SCRIBE_VAULT_PATH environment variable
 * 3. Config file (~/.config/scribe/config.json → vaultPath)
 * 4. Default: ~/Scribe/vault (lowest priority)
 */

import { existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { loadConfig } from './config';

/**
 * The source from which the vault path was resolved
 */
export type VaultSource = 'flag' | 'env' | 'config' | 'default';

/**
 * Result of vault path resolution
 */
export interface VaultResolutionResult {
  /** The resolved vault path (absolute) */
  path: string;
  /** The source that provided the path */
  source: VaultSource;
}

/**
 * Error thrown when a vault directory does not exist at the resolved path
 */
export class VaultNotFoundError extends Error {
  public readonly path: string;

  constructor(path: string) {
    super(`Vault not found at ${path}`);
    this.name = 'VaultNotFoundError';
    this.path = path;
  }
}

/**
 * Expand a path that starts with ~ to use the home directory
 *
 * @param path - The path to expand
 * @returns The expanded path with ~ replaced by the home directory
 */
function expandPath(path: string): string {
  if (path.startsWith('~')) {
    return join(homedir(), path.slice(1));
  }
  return path;
}

/**
 * Resolve the vault path based on configuration precedence.
 *
 * Resolution order (highest to lowest priority):
 * 1. CLI flag value (--vault)
 * 2. SCRIBE_VAULT_PATH environment variable
 * 3. Config file vaultPath (~/.config/scribe/config.json)
 * 4. Default path: ~/Scribe/vault
 *
 * @param flagValue - Optional vault path from --vault CLI flag
 * @returns The resolved vault path and its source
 */
export function resolveVaultPath(flagValue?: string): VaultResolutionResult {
  // 1. CLI flag takes highest precedence
  if (flagValue) {
    return { path: expandPath(flagValue), source: 'flag' };
  }

  // 2. Environment variable
  const envPath = process.env.SCRIBE_VAULT_PATH;
  if (envPath) {
    return { path: expandPath(envPath), source: 'env' };
  }

  // 3. Config file
  const config = loadConfig();
  if (config?.vaultPath) {
    return { path: expandPath(config.vaultPath), source: 'config' };
  }

  // 4. Default path
  return { path: join(homedir(), 'Scribe', 'vault'), source: 'default' };
}

/**
 * Validate that a vault path exists on the filesystem.
 *
 * @param path - The vault path to validate
 * @throws VaultNotFoundError if the path does not exist
 */
export function validateVaultPath(path: string): void {
  if (!existsSync(path)) {
    throw new VaultNotFoundError(path);
  }
}
