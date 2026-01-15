/**
 * SQLite schema definitions for Scribe database.
 * These SQL statements define the complete database structure.
 */

/**
 * Database pragmas for optimal SQLite configuration
 */
export const PRAGMAS = `
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
`;

/**
 * Migrations tracking table - stores applied migration history
 */
export const MIGRATIONS_TABLE = `
CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`;

/**
 * Notes metadata table - indexed from JSON files
 */
export const NOTES_TABLE = `
CREATE TABLE IF NOT EXISTS notes (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('note', 'daily', 'meeting', 'person')),
    date TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    word_count INTEGER DEFAULT 0,
    file_path TEXT NOT NULL UNIQUE,
    content_hash TEXT
);
`;

/**
 * Notes table indexes for query performance
 */
export const NOTES_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_notes_type ON notes(type);
CREATE INDEX IF NOT EXISTS idx_notes_date ON notes(date);
CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON notes(updated_at DESC);
`;

/**
 * Links table - graph edges between notes
 */
export const LINKS_TABLE = `
CREATE TABLE IF NOT EXISTS links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    target_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    link_text TEXT,
    UNIQUE(source_id, target_id, link_text)
);
`;

/**
 * Links table indexes for graph traversal
 */
export const LINKS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_links_source ON links(source_id);
CREATE INDEX IF NOT EXISTS idx_links_target ON links(target_id);
`;

/**
 * Tags table - normalized tag storage
 */
export const TAGS_TABLE = `
CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL
);
`;

/**
 * Note-Tags junction table - many-to-many relationship
 */
export const NOTE_TAGS_TABLE = `
CREATE TABLE IF NOT EXISTS note_tags (
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (note_id, tag_id)
);
`;

/**
 * Note-Tags table index
 */
export const NOTE_TAGS_INDEX = `
CREATE INDEX IF NOT EXISTS idx_note_tags_tag ON note_tags(tag_id);
`;

/**
 * Full-text search virtual table using FTS5
 */
export const NOTES_FTS_TABLE = `
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
    title,
    content,
    tags,
    note_id UNINDEXED,
    tokenize='porter unicode61'
);
`;

/**
 * Yjs CRDT state persistence table
 */
export const YJS_STATE_TABLE = `
CREATE TABLE IF NOT EXISTS yjs_state (
    note_id TEXT PRIMARY KEY REFERENCES notes(id) ON DELETE CASCADE,
    state BLOB NOT NULL,
    updated_at TEXT NOT NULL
);
`;

/**
 * Content snapshots table for versioning
 */
export const SNAPSHOTS_TABLE = `
CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    note_id TEXT NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    trigger TEXT CHECK (trigger IN ('manual', 'auto', 'pre_edit'))
);
`;

/**
 * Snapshots table indexes
 */
export const SNAPSHOTS_INDEXES = `
CREATE INDEX IF NOT EXISTS idx_snapshots_note ON snapshots(note_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at DESC);
`;

/**
 * All table creation statements in order (respecting foreign key dependencies)
 */
export const ALL_TABLES = [
  MIGRATIONS_TABLE,
  NOTES_TABLE,
  LINKS_TABLE,
  TAGS_TABLE,
  NOTE_TAGS_TABLE,
  NOTES_FTS_TABLE,
  YJS_STATE_TABLE,
  SNAPSHOTS_TABLE,
];

/**
 * All index creation statements
 */
export const ALL_INDEXES = [NOTES_INDEXES, LINKS_INDEXES, NOTE_TAGS_INDEX, SNAPSHOTS_INDEXES];

/**
 * Complete schema SQL - combines all tables and indexes
 */
export const FULL_SCHEMA = `
${MIGRATIONS_TABLE}

${NOTES_TABLE}
${NOTES_INDEXES}

${LINKS_TABLE}
${LINKS_INDEXES}

${TAGS_TABLE}

${NOTE_TAGS_TABLE}
${NOTE_TAGS_INDEX}

${NOTES_FTS_TABLE}

${YJS_STATE_TABLE}

${SNAPSHOTS_TABLE}
${SNAPSHOTS_INDEXES}
`;

/**
 * Table names for programmatic access
 */
export const TABLE_NAMES = {
  migrations: '_migrations',
  notes: 'notes',
  links: 'links',
  tags: 'tags',
  noteTags: 'note_tags',
  notesFts: 'notes_fts',
  yjsState: 'yjs_state',
  snapshots: 'snapshots',
} as const;

/**
 * Column name mappings (snake_case to camelCase)
 */
export const COLUMN_MAPPINGS = {
  notes: {
    id: 'id',
    title: 'title',
    type: 'type',
    date: 'date',
    created_at: 'createdAt',
    updated_at: 'updatedAt',
    word_count: 'wordCount',
    file_path: 'filePath',
    content_hash: 'contentHash',
  },
  links: {
    id: 'id',
    source_id: 'sourceId',
    target_id: 'targetId',
    link_text: 'linkText',
  },
  tags: {
    id: 'id',
    name: 'name',
  },
  note_tags: {
    note_id: 'noteId',
    tag_id: 'tagId',
  },
  yjs_state: {
    note_id: 'noteId',
    state: 'state',
    updated_at: 'updatedAt',
  },
  snapshots: {
    id: 'id',
    note_id: 'noteId',
    title: 'title',
    content: 'content',
    created_at: 'createdAt',
    trigger: 'trigger',
  },
  _migrations: {
    id: 'id',
    name: 'name',
    applied_at: 'appliedAt',
  },
} as const;
