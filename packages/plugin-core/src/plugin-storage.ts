/**
 * Plugin Storage Implementation
 *
 * Provides namespaced key-value storage backed by SQLite.
 * Each plugin gets its own isolated namespace, preventing plugins
 * from reading or modifying each other's data.
 *
 * @module
 */

import type { PluginStorage } from './plugin-types.js';

// ============================================================================
// Database Interface
// ============================================================================

/**
 * Minimal database interface required by SQLitePluginStorage.
 * This matches the better-sqlite3 Database interface for the methods we need.
 *
 * Using a minimal interface allows plugin-core to remain database-agnostic
 * while still providing a concrete SQLite implementation.
 */
export interface PluginStorageDatabase {
  /**
   * Prepare a SQL statement for execution.
   */
  prepare<T = unknown>(sql: string): PluginStorageStatement<T>;
}

/**
 * Minimal prepared statement interface.
 */
export interface PluginStorageStatement<T = unknown> {
  /**
   * Execute the statement and return a single row.
   */
  get(...params: unknown[]): T | undefined;

  /**
   * Execute the statement and return all rows.
   */
  all(...params: unknown[]): T[];

  /**
   * Execute the statement for its side effects.
   */
  run(...params: unknown[]): { changes: number; lastInsertRowid: number | bigint };
}

// ============================================================================
// Storage Entry Types
// ============================================================================

/**
 * Raw row structure from the plugin_storage table.
 */
interface PluginStorageRow {
  key: string;
  value: string;
  created_at: string;
  updated_at: string;
}

// ============================================================================
// SQLitePluginStorage Implementation
// ============================================================================

/**
 * SQLite-backed implementation of PluginStorage.
 *
 * All keys are automatically prefixed with the plugin's namespace to provide
 * isolation between plugins. Values are JSON-serialized for storage.
 *
 * @example
 * ```typescript
 * const storage = new SQLitePluginStorage(db, 'scribe_plugin_todo');
 *
 * // Store a value
 * await storage.set('settings', { theme: 'dark' });
 *
 * // Retrieve a value
 * const settings = await storage.get<{ theme: string }>('settings');
 *
 * // List all keys
 * const keys = await storage.keys(); // ['settings']
 *
 * // Delete a value
 * await storage.delete('settings');
 * ```
 */
export class SQLitePluginStorage implements PluginStorage {
  /**
   * Create a new SQLitePluginStorage instance.
   *
   * @param db - The SQLite database connection
   * @param namespace - The namespace prefix for all keys (typically derived from plugin ID)
   */
  constructor(
    private readonly db: PluginStorageDatabase,
    private readonly namespace: string
  ) {}

  /**
   * Create the full key by prefixing with namespace.
   */
  private prefixKey(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Get a value from storage by key.
   * Returns undefined if the key doesn't exist.
   *
   * @param key - The key to look up (without namespace prefix)
   * @returns The stored value, or undefined if not found
   */
  async get<T>(key: string): Promise<T | undefined> {
    const stmt = this.db.prepare<PluginStorageRow>(
      'SELECT value FROM plugin_storage WHERE key = ?'
    );
    const row = stmt.get(this.prefixKey(key));

    if (!row) {
      return undefined;
    }

    return JSON.parse(row.value) as T;
  }

  /**
   * Set a value in storage.
   * The value is JSON-serialized before storage.
   * Uses upsert to handle both insert and update cases.
   *
   * @param key - The key to store under (without namespace prefix)
   * @param value - The value to store (must be JSON-serializable)
   */
  async set<T>(key: string, value: T): Promise<void> {
    const serialized = JSON.stringify(value);
    const stmt = this.db.prepare(
      `INSERT INTO plugin_storage (key, value, created_at, updated_at)
       VALUES (?, ?, datetime('now'), datetime('now'))
       ON CONFLICT(key) DO UPDATE SET
         value = excluded.value,
         updated_at = datetime('now')`
    );
    stmt.run(this.prefixKey(key), serialized);
  }

  /**
   * Delete a value from storage.
   *
   * @param key - The key to delete (without namespace prefix)
   */
  async delete(key: string): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM plugin_storage WHERE key = ?');
    stmt.run(this.prefixKey(key));
  }

  /**
   * Check if a key exists in storage.
   *
   * @param key - The key to check (without namespace prefix)
   * @returns true if the key exists, false otherwise
   */
  async has(key: string): Promise<boolean> {
    const stmt = this.db.prepare<{ count: number }>(
      'SELECT COUNT(*) as count FROM plugin_storage WHERE key = ?'
    );
    const row = stmt.get(this.prefixKey(key));
    return (row?.count ?? 0) > 0;
  }

  /**
   * List all keys in this plugin's namespace.
   * Returns keys without the namespace prefix.
   *
   * @returns Array of keys belonging to this plugin
   */
  async keys(): Promise<string[]> {
    const prefix = `${this.namespace}:`;
    const stmt = this.db.prepare<{ key: string }>(
      'SELECT key FROM plugin_storage WHERE key LIKE ?'
    );
    const rows = stmt.all(`${prefix}%`);
    return rows.map((row) => row.key.slice(prefix.length));
  }

  /**
   * Delete all keys in this plugin's namespace.
   * Useful for plugin uninstall or reset.
   */
  async clear(): Promise<void> {
    const stmt = this.db.prepare('DELETE FROM plugin_storage WHERE key LIKE ?');
    stmt.run(`${this.namespace}:%`);
  }
}

// ============================================================================
// PluginStorageFactory
// ============================================================================

/**
 * Factory for creating namespaced PluginStorage instances.
 *
 * The factory sanitizes plugin IDs to create safe namespace prefixes
 * and ensures each plugin gets its own isolated storage space.
 *
 * @example
 * ```typescript
 * const factory = new PluginStorageFactory(db);
 *
 * // Create storage for a plugin
 * const storage = factory.createForPlugin('@scribe/plugin-todo');
 *
 * // The namespace will be sanitized: 'scribe_plugin_todo'
 * await storage.set('tasks', [{ id: 1, title: 'Buy milk' }]);
 * ```
 */
export class PluginStorageFactory {
  /**
   * Create a new PluginStorageFactory.
   *
   * @param db - The SQLite database connection to use for all storage instances
   */
  constructor(private readonly db: PluginStorageDatabase) {}

  /**
   * Create a storage instance for a specific plugin.
   *
   * @param pluginId - The plugin's unique identifier (e.g., '@scribe/plugin-todo')
   * @returns A PluginStorage instance scoped to the plugin's namespace
   */
  createForPlugin(pluginId: string): PluginStorage {
    const namespace = this.sanitizeNamespace(pluginId);
    return new SQLitePluginStorage(this.db, namespace);
  }

  /**
   * Sanitize a plugin ID to create a safe namespace.
   *
   * Converts npm-style scoped packages to valid namespace strings:
   * - '@scribe/plugin-todo' -> 'scribe_plugin_todo'
   * - 'my-plugin' -> 'my_plugin'
   *
   * @param pluginId - The plugin ID to sanitize
   * @returns A safe namespace string
   */
  private sanitizeNamespace(pluginId: string): string {
    return pluginId.replace(/^@/, '').replace(/[^a-zA-Z0-9]/g, '_');
  }
}

// ============================================================================
// SQL Schema Constants
// ============================================================================

/**
 * SQL to create the plugin_storage table.
 * This should be used in a migration to set up the table.
 */
export const PLUGIN_STORAGE_SCHEMA = `
CREATE TABLE IF NOT EXISTS plugin_storage (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_plugin_storage_namespace
ON plugin_storage(key);
`;

/**
 * SQL to drop the plugin_storage table.
 * This should be used in a migration rollback.
 */
export const PLUGIN_STORAGE_DROP = `
DROP INDEX IF EXISTS idx_plugin_storage_namespace;
DROP TABLE IF EXISTS plugin_storage;
`;
