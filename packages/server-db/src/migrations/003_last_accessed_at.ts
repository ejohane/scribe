/**
 * Migration to add last_accessed_at column to notes table.
 *
 * This column tracks when a note was last opened/viewed, enabling
 * the 'recently opened' feature in the command palette.
 */

/**
 * Migration name - used for tracking in _migrations table
 */
export const name = '003_last_accessed_at';

/**
 * Migration version number
 */
export const version = 3;

/**
 * Human-readable description
 */
export const description = 'Add last_accessed_at column to notes table for recent access tracking';

/**
 * SQL statements to apply this migration (up)
 *
 * Design decisions:
 * - Nullable column: Existing notes start with NULL, set on first access
 * - Partial index: Only index non-NULL values for query efficiency
 * - DESC order: Optimizes 'most recent first' queries
 */
export const up = `
ALTER TABLE notes ADD COLUMN last_accessed_at TEXT;

CREATE INDEX IF NOT EXISTS idx_notes_last_accessed_at
ON notes(last_accessed_at DESC)
WHERE last_accessed_at IS NOT NULL;
`;

/**
 * SQL statements to rollback this migration (down)
 *
 * Note: SQLite doesn't support DROP COLUMN easily (requires table rebuild).
 * For simplicity, we drop only the index here. A full rollback would require
 * recreating the table without the column.
 */
export const down = `
DROP INDEX IF EXISTS idx_notes_last_accessed_at;
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
