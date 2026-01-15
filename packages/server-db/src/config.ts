/**
 * Database configuration types and defaults.
 */

import { join } from 'node:path';

/**
 * Configuration options for the ScribeDatabase
 */
export interface DatabaseConfig {
  /**
   * Path to the SQLite database file.
   * For production, typically `.scribe/index.db` relative to vault root.
   * Use ':memory:' for in-memory databases (useful for testing).
   */
  path: string;

  /**
   * Enable verbose logging of SQL queries.
   * When true, all queries are logged to console.
   * Useful for development and debugging.
   * @default false
   */
  verbose?: boolean;

  /**
   * Open database in read-only mode.
   * When true, all write operations will fail.
   * @default false
   */
  readonly?: boolean;

  /**
   * Automatically create parent directories if they don't exist.
   * @default true
   */
  createParentDirs?: boolean;
}

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<Omit<DatabaseConfig, 'path'>> = {
  verbose: false,
  readonly: false,
  createParentDirs: true,
};

/**
 * Default database filename
 */
export const DEFAULT_DB_FILENAME = 'index.db';

/**
 * Default Scribe data directory name
 */
export const DEFAULT_SCRIBE_DIR = '.scribe';

/**
 * Get the default database path for a vault root directory
 */
export function getDefaultDatabasePath(vaultRoot: string): string {
  return join(vaultRoot, DEFAULT_SCRIBE_DIR, DEFAULT_DB_FILENAME);
}

/**
 * Validate database configuration
 * @throws Error if configuration is invalid
 */
export function validateConfig(config: DatabaseConfig): void {
  if (!config.path) {
    throw new Error('Database path is required');
  }

  if (config.path !== ':memory:' && config.path.trim() === '') {
    throw new Error('Database path cannot be empty');
  }
}

/**
 * Merge user config with defaults
 */
export function mergeConfig(config: DatabaseConfig): Required<DatabaseConfig> {
  return {
    ...DEFAULT_CONFIG,
    ...config,
  };
}
