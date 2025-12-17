/**
 * Scribe CLI Configuration
 *
 * Handles loading and parsing of user configuration from ~/.config/scribe/config.json
 */

import { existsSync, readFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const CONFIG_PATH = join(homedir(), '.config', 'scribe', 'config.json');

export interface ScribeConfig {
  vaultPath?: string;
  defaultFormat?: 'json' | 'text';
  defaultLimit?: number;
}

/**
 * Load user configuration from the config file.
 *
 * Config file location: ~/.config/scribe/config.json
 *
 * @returns The parsed configuration or null if no config file exists
 */
export function loadConfig(): ScribeConfig | null {
  if (!existsSync(CONFIG_PATH)) {
    return null;
  }

  try {
    const content = readFileSync(CONFIG_PATH, 'utf-8');
    return JSON.parse(content) as ScribeConfig;
  } catch (err) {
    // Invalid JSON or read error - log warning to stderr, continue with null
    if (process.env.DEBUG) {
      console.error(`Warning: Could not load config from ${CONFIG_PATH}: ${err}`);
    }
    return null;
  }
}

/**
 * Get the path to the config file.
 *
 * @returns The absolute path to the config file
 */
export function getConfigPath(): string {
  return CONFIG_PATH;
}
