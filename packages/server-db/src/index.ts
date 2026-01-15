/**
 * @scribe/server-db
 *
 * SQLite database layer for Scribe daemon.
 * Provides persistent storage for documents, metadata, and search indices.
 */

export const VERSION = '0.1.0';

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
} from './types.js';

// Migration exports
export {
  migrations,
  getMigration,
  getLatestVersion,
  type MigrationDefinition,
} from './migrations/index.js';
