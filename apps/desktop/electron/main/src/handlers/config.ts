/**
 * App Configuration Module
 *
 * Provides functions for loading and saving app configuration.
 * Configuration is stored in ~/Scribe/config.json.
 *
 * @module handlers/config
 */

import * as fs from 'node:fs/promises';
import path from 'path';
import { homedir } from 'node:os';
import type { AppConfig } from './types';

/** Directory containing app configuration */
export const CONFIG_DIR = path.join(homedir(), 'Scribe');

/** Path to the config file */
export const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

/** Default vault path if none configured */
export const DEFAULT_VAULT_PATH = path.join(homedir(), 'Scribe', 'vault');

/**
 * Load app configuration from disk.
 *
 * @returns The loaded config, or an empty object if no config exists
 */
export async function loadConfig(): Promise<AppConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

/**
 * Save app configuration to disk.
 *
 * @param config - The configuration to save
 */
export async function saveConfig(config: AppConfig): Promise<void> {
  await fs.mkdir(CONFIG_DIR, { recursive: true });
  await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get the configured vault path, or the default if none configured.
 *
 * @returns The vault path to use
 */
export async function getVaultPath(): Promise<string> {
  const config = await loadConfig();
  return config.vaultPath || DEFAULT_VAULT_PATH;
}
