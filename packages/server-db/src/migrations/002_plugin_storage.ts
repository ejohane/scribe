/**
 * Migration to add plugin_storage table.
 *
 * This table provides namespaced key-value storage for plugins.
 * Keys are prefixed with plugin namespaces to provide isolation.
 */

/**
 * Migration name - used for tracking in _migrations table
 */
export const name = '002_plugin_storage';

/**
 * Migration version number
 */
export const version = 2;

/**
 * Human-readable description
 */
export const description = 'Add plugin_storage table for plugin data persistence';

/**
 * SQL statements to apply this migration (up)
 */
export const up = `
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
 * SQL statements to rollback this migration (down)
 */
export const down = `
DROP INDEX IF EXISTS idx_plugin_storage_namespace;
DROP TABLE IF EXISTS plugin_storage;
`;

/**
 * Migration metadata
 */
export const migration = {
  name,
  version,
  description,
  up,
  down,
};

export default migration;
