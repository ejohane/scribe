/**
 * @scribe/server-db
 *
 * SQLite database layer for Scribe daemon.
 * Provides persistent storage for documents, metadata, and search indices.
 */

export const VERSION = '0.1.0';

// Database class and configuration exports
export { ScribeDatabase } from './database.js';
export {
  MigrationRunner,
  type AppliedMigration,
  type MigrationResult,
} from './migration-runner.js';
export {
  type DatabaseConfig,
  DEFAULT_CONFIG,
  DEFAULT_DB_FILENAME,
  DEFAULT_SCRIBE_DIR,
  getDefaultDatabasePath,
  validateConfig,
  mergeConfig,
} from './config.js';

// Error exports
export {
  DatabaseError,
  InitializationError,
  MigrationError,
  QueryError,
  isDatabaseError,
  wrapError,
  type DatabaseErrorCode,
} from './errors.js';

// Schema exports
export {
  PRAGMAS,
  MIGRATIONS_TABLE,
  NOTES_TABLE,
  NOTES_INDEXES,
  LINKS_TABLE,
  LINKS_INDEXES,
  TAGS_TABLE,
  NOTE_TAGS_TABLE,
  NOTE_TAGS_INDEX,
  NOTES_FTS_TABLE,
  YJS_STATE_TABLE,
  SNAPSHOTS_TABLE,
  SNAPSHOTS_INDEXES,
  ALL_TABLES,
  ALL_INDEXES,
  FULL_SCHEMA,
  TABLE_NAMES,
  COLUMN_MAPPINGS,
} from './schema.js';

// Type exports
export type {
  NoteType,
  SnapshotTrigger,
  Migration,
  Note,
  Link,
  Tag,
  NoteTag,
  NoteFtsRow,
  YjsState,
  Snapshot,
  CreateNoteInput,
  UpdateNoteInput,
  CreateLinkInput,
  CreateTagInput,
  CreateNoteTagInput,
  CreateYjsStateInput,
  CreateSnapshotInput,
  NoteWithTags,
  LinkWithTitles,
  SearchResult,
  GraphNode,
  GraphEdge,
  RecentNote,
} from './types.js';

// Migration exports
export {
  migrations,
  getMigration,
  getLatestVersion,
  type MigrationDefinition,
} from './migrations/index.js';

// Repository exports
export {
  NotesRepository,
  type NoteFilter,
  LinksRepository,
  type LinkWithTargetTitle,
  type LinkWithSourceTitle,
  TagsRepository,
  type TagWithCount,
  SearchRepository,
  type SearchOptions,
  YjsStateRepository,
  SnapshotsRepository,
  type SnapshotFilter,
} from './repositories/index.js';

// Utility exports
export { extractTextFromLexical, extractTextFromLexicalJson } from './utils.js';
