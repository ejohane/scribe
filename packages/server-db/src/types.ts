/**
 * TypeScript types matching the SQLite schema.
 * These types represent the data structures stored in the database.
 */

/**
 * Note type enumeration - matches CHECK constraint in notes table
 */
export type NoteType = 'note' | 'daily' | 'meeting' | 'person';

/**
 * Snapshot trigger type - matches CHECK constraint in snapshots table
 */
export type SnapshotTrigger = 'manual' | 'auto' | 'pre_edit';

/**
 * Migration record - tracks applied database migrations
 */
export interface Migration {
  id: number;
  name: string;
  appliedAt: string; // ISO timestamp
}

/**
 * Note metadata - indexed from JSON files
 */
export interface Note {
  id: string; // UUID or nanoid
  title: string;
  type: NoteType;
  date: string | null; // ISO date for daily/meeting notes
  createdAt: string; // ISO timestamp
  updatedAt: string; // ISO timestamp
  wordCount: number;
  filePath: string; // Relative path from vault root
  contentHash: string | null; // MD5/SHA for change detection
}

/**
 * Link between notes - represents graph edges
 */
export interface Link {
  id: number;
  sourceId: string;
  targetId: string;
  linkText: string | null; // Display text of the link
}

/**
 * Tag (normalized) - represents a unique tag name
 */
export interface Tag {
  id: number;
  name: string;
}

/**
 * Note-Tag relationship - junction table for many-to-many relationship
 */
export interface NoteTag {
  noteId: string;
  tagId: number;
}

/**
 * Full-text search result from notes_fts
 */
export interface NoteFtsRow {
  title: string;
  content: string;
  tags: string;
  noteId: string;
}

/**
 * Yjs CRDT state persistence
 */
export interface YjsState {
  noteId: string;
  state: Buffer; // Encoded Y.Doc state
  updatedAt: string; // ISO timestamp
}

/**
 * Content snapshot - versioned content for history/recovery
 */
export interface Snapshot {
  id: number;
  noteId: string;
  title: string;
  content: string; // JSON content snapshot
  createdAt: string; // ISO timestamp
  trigger: SnapshotTrigger;
}

// ============================================================================
// Input types for creating/updating records
// ============================================================================

/**
 * Input for creating a new note (without auto-generated fields)
 */
export interface CreateNoteInput {
  id: string;
  title: string;
  type: NoteType;
  date?: string | null;
  createdAt: string;
  updatedAt: string;
  wordCount?: number;
  filePath: string;
  contentHash?: string | null;
}

/**
 * Input for updating an existing note
 */
export interface UpdateNoteInput {
  title?: string;
  type?: NoteType;
  date?: string | null;
  updatedAt: string;
  wordCount?: number;
  contentHash?: string | null;
}

/**
 * Input for creating a link
 */
export interface CreateLinkInput {
  sourceId: string;
  targetId: string;
  linkText?: string | null;
}

/**
 * Input for creating a tag
 */
export interface CreateTagInput {
  name: string;
}

/**
 * Input for creating a note-tag relationship
 */
export interface CreateNoteTagInput {
  noteId: string;
  tagId: number;
}

/**
 * Input for creating a Yjs state record
 */
export interface CreateYjsStateInput {
  noteId: string;
  state: Buffer;
  updatedAt: string;
}

/**
 * Input for creating a snapshot
 */
export interface CreateSnapshotInput {
  noteId: string;
  title: string;
  content: string;
  createdAt: string;
  trigger: SnapshotTrigger;
}

// ============================================================================
// Query result types
// ============================================================================

/**
 * Note with its associated tags
 */
export interface NoteWithTags extends Note {
  tags: string[];
}

/**
 * Link with resolved note titles
 */
export interface LinkWithTitles extends Link {
  sourceTitle: string;
  targetTitle: string;
}

/**
 * Search result with ranking information
 */
export interface SearchResult {
  noteId: string;
  title: string;
  snippet: string;
  rank: number;
}

/**
 * Graph node representation for visualization
 */
export interface GraphNode {
  id: string;
  title: string;
  type: NoteType;
}

/**
 * Graph edge representation for visualization
 */
export interface GraphEdge {
  source: string;
  target: string;
  label: string | null;
}

/**
 * Recently accessed note - minimal info for command palette
 */
export interface RecentNote {
  id: string;
  title: string;
  type: NoteType;
  lastAccessedAt: string; // ISO timestamp
}
