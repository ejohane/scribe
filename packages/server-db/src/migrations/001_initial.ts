/**
 * Initial database migration - creates the complete schema.
 *
 * This migration creates all tables, indexes, and the FTS5 virtual table
 * required for the Scribe database.
 */

import { FULL_SCHEMA, PRAGMAS, TABLE_NAMES } from '../schema.js';

/**
 * Migration name - used for tracking in _migrations table
 */
export const name = '001_initial';

/**
 * Migration version number
 */
export const version = 1;

/**
 * Human-readable description
 */
export const description = 'Create initial database schema with all tables and indexes';

/**
 * SQL statements to apply this migration (up)
 */
export const up = FULL_SCHEMA;

/**
 * SQL statements to rollback this migration (down)
 *
 * Note: Dropping FTS5 tables requires special handling.
 * Order matters - drop tables with foreign key references first.
 */
export const down = `
DROP TABLE IF EXISTS ${TABLE_NAMES.snapshots};
DROP TABLE IF EXISTS ${TABLE_NAMES.yjsState};
DROP TABLE IF EXISTS ${TABLE_NAMES.notesFts};
DROP TABLE IF EXISTS ${TABLE_NAMES.noteTags};
DROP TABLE IF EXISTS ${TABLE_NAMES.tags};
DROP TABLE IF EXISTS ${TABLE_NAMES.links};
DROP TABLE IF EXISTS ${TABLE_NAMES.notes};
DROP TABLE IF EXISTS ${TABLE_NAMES.migrations};
`;

/**
 * Database pragmas to set before running migration
 */
export const pragmas = PRAGMAS;

/**
 * Migration metadata
 */
export const migration = {
  name,
  version,
  description,
  up,
  down,
  pragmas,
};

export default migration;
