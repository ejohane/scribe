/**
 * Database module for Scribe sync server
 *
 * This module provides type-safe query helpers for interacting with the D1 database.
 * The schema is defined in ./migrations/001_initial.sql
 */

export {
  SyncQueries,
  createSyncQueries,
  type User,
  type Device,
  type Note,
  type ChangeLogEntry,
} from './queries.js';
