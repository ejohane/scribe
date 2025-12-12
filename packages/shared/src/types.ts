/**
 * Core type definitions for Scribe
 *
 * These types define the foundational data structures used across all engine modules
 * and in communication between layers (renderer, preload, main).
 */

/**
 * Unique identifier for a note
 */
export type NoteId = string;

/**
 * Path to the vault directory
 */
export type VaultPath = string;

/**
 * Note type discriminator
 * Used to distinguish special note types from regular notes.
 *
 * Current types:
 * - 'person': A person entity that can be mentioned with @name syntax
 * - undefined: A regular note (default)
 *
 * Future types to consider:
 * - 'project': A project note for organizing related work
 * - 'meeting': A meeting note with date/attendees
 * - 'daily': A daily journal note
 * - 'template': A template for creating new notes
 *
 * To add a new type:
 * 1. Add the string literal to this union type
 * 2. Update metadata extraction in packages/engine-core/src/metadata.ts
 * 3. Update the graph engine if the type has special relationships
 * 4. Add any UI components for the new type
 */
export type NoteType = 'person' | 'project' | 'meeting' | 'daily' | 'template' | 'system';

/**
 * Lexical editor state serialized as JSON
 * This is the canonical representation of note content
 */
export interface LexicalState {
  root: {
    type: 'root';
    children: Array<LexicalNode>;
    format?: string | number;
    indent?: number;
    version?: number;
  };
  /**
   * Optional note type discriminator stored at the content root level.
   * Used to distinguish special note types (e.g., 'person') from regular notes.
   * undefined = regular note
   */
  type?: NoteType;
}

/**
 * Generic Lexical node structure
 */
export interface LexicalNode {
  type: string;
  version?: number;
  [key: string]: unknown;
}

/**
 * Metadata derived from note content
 * This is always extracted by the engine, never set directly by the UI
 */
export interface NoteMetadata {
  /**
   * @deprecated Use Note.title instead. This field is derived from content
   * for backward compatibility with legacy notes only and will always be null
   * for new notes.
   */
  title: string | null;

  /**
   * Tags extracted from content using #tag conventions or custom nodes
   */
  tags: string[];

  /**
   * Outbound references to other notes (extracted from link nodes)
   */
  links: NoteId[];

  /**
   * People mentioned in this note (extracted from person-mention nodes)
   * Each entry is the NoteId of a person note
   */
  mentions: NoteId[];

  /**
   * Note type discriminator
   * - 'person': A person entity that can be mentioned with @name syntax
   * - undefined: A regular note (default)
   */
  type?: NoteType;
}

/**
 * System note IDs
 * Reserved IDs for special system-level notes that render custom screens
 */
export const SYSTEM_NOTE_IDS = {
  TASKS: 'system:tasks',
} as const;

/**
 * Check if a note ID is a system note
 */
export function isSystemNoteId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id.startsWith('system:');
}

/**
 * Complete note structure
 * This is the single source of truth for note data
 */
export interface Note {
  /**
   * Immutable unique identifier
   */
  id: NoteId;

  /**
   * User-editable title for the note
   * This is the canonical title displayed in sidebar, search, etc.
   * Unlike metadata.title which is derived from content, this is explicitly set by the user.
   */
  title: string;

  /**
   * Timestamp when note was created (milliseconds)
   */
  createdAt: number;

  /**
   * Timestamp when note was last updated (milliseconds)
   * Managed by engine only
   */
  updatedAt: number;

  /**
   * Note type discriminator
   * Lifted to root level for easier access and explicit user control.
   * - 'person': A person entity that can be mentioned with @name syntax
   * - 'project': A project note for organizing related work
   * - 'meeting': A meeting note with date/attendees
   * - 'daily': A daily journal note
   * - 'template': A template for creating new notes
   * - undefined: A regular note (default)
   */
  type?: NoteType;

  /**
   * User-defined tags for the note
   * These are explicitly set by the user via the header UI.
   * Separate from metadata.tags which are extracted from inline #tag patterns in content.
   * Both are merged when displaying "all tags" for a note.
   */
  tags: string[];

  /**
   * Lexical editor state serialized as JSON
   */
  content: LexicalState;

  /**
   * Derived metadata (title, tags, links)
   * Always re-extracted from content by engine
   * Note: metadata.title and metadata.tags are derived from content,
   * while note.title and note.tags are user-editable explicit fields.
   */
  metadata: NoteMetadata;

  /**
   * Daily note specific data (only present for daily notes)
   * Present when note.type === 'daily'
   */
  daily?: {
    /** ISO date string "YYYY-MM-DD" */
    date: string;
  };

  /**
   * Meeting specific data (only present for meeting notes)
   * Present when note.type === 'meeting'
   */
  meeting?: {
    /** ISO date string "YYYY-MM-DD" */
    date: string;
    /** Associated daily note for this meeting */
    dailyNoteId: NoteId;
    /** Person note IDs of meeting attendees */
    attendees: NoteId[];
  };
}

/**
 * Graph node representation
 */
export interface GraphNode {
  id: NoteId;
  title: string | null;
  tags: string[];
  /**
   * Note type discriminator for filtering in graph views
   * - 'person': A person entity
   * - undefined: A regular note
   */
  type?: NoteType;
}

/**
 * Graph edge representation
 */
export interface GraphEdge {
  from: NoteId;
  to: NoteId;
  type: 'link' | 'tag';
}

/**
 * Search result
 */
export interface SearchResult {
  id: NoteId;
  title: string | null;
  snippet: string;
  score: number;
  matches: Array<{
    field: 'title' | 'tags' | 'content';
    positions: number[];
  }>;
}

/**
 * Vault configuration
 */
export interface VaultConfig {
  path: VaultPath;
  version: string;
}

// ============================================================================
// Task Types
// ============================================================================

/**
 * Composite identifier for a task
 *
 * Tasks are identified by a combination of:
 * - noteId: The source document containing the task
 * - nodeKey: Lexical node key for the checklist item (primary anchor)
 * - textHash: SHA-256 hash of task text (first 16 chars) for fallback matching
 *
 * Serialized as: "{noteId}:{nodeKey}:{textHash}"
 * Example: "abc123:node_1a2b:a1b2c3d4e5f6a7b8"
 */
export interface TaskId {
  noteId: NoteId;
  nodeKey: string;
  textHash: string;
}

/**
 * Serialize a TaskId to its string representation
 */
export function serializeTaskId(taskId: TaskId): string {
  return `${taskId.noteId}:${taskId.nodeKey}:${taskId.textHash}`;
}

/**
 * Parse a serialized TaskId string back to a TaskId object
 * Returns null if the format is invalid
 */
export function parseTaskId(id: string): TaskId | null {
  const parts = id.split(':');
  if (parts.length !== 3) {
    return null;
  }
  const [noteId, nodeKey, textHash] = parts;
  if (!noteId || !nodeKey || !textHash) {
    return null;
  }
  return { noteId, nodeKey, textHash };
}

/**
 * A task extracted from a note's checklist items
 *
 * Tasks use a hybrid storage model:
 * - Source of truth: Markdown checkboxes in Lexical content
 * - Index for fast queries: TaskIndex stored in-memory and persisted to JSONL
 */
export interface Task {
  /**
   * Serialized TaskId: "{noteId}:{nodeKey}:{textHash}"
   */
  id: string;

  /**
   * Source document ID containing this task
   */
  noteId: NoteId;

  /**
   * Source document title (denormalized for display)
   */
  noteTitle: string;

  /**
   * Lexical node key for the checklist item (primary anchor for navigation)
   */
  nodeKey: string;

  /**
   * List item block ordinal (best-effort, recomputed on extraction)
   * Used for fallback navigation when nodeKey cannot be found
   */
  lineIndex: number;

  /**
   * Task text content (without checkbox syntax)
   */
  text: string;

  /**
   * SHA-256 hash of task text (first 16 hex chars)
   * Used for identity matching when nodeKey changes (e.g., after paste/import)
   */
  textHash: string;

  /**
   * Current completion state (derived from source checkbox)
   */
  completed: boolean;

  /**
   * Timestamp when task was last completed (undefined if never completed or unchecked)
   */
  completedAt?: number;

  /**
   * User-defined priority (0 = highest)
   * Managed via drag-and-drop reordering
   */
  priority: number;

  /**
   * Timestamp when task was first indexed
   */
  createdAt: number;

  /**
   * Timestamp when task was last reconciled with source
   */
  updatedAt: number;
}

/**
 * Filter options for querying tasks
 */
export interface TaskFilter {
  /**
   * Filter by completion status
   * - true: only completed tasks
   * - false: only incomplete tasks
   * - undefined: all tasks
   */
  completed?: boolean;

  /**
   * Filter by source note ID
   */
  noteId?: NoteId;

  /**
   * Filter by creation date (inclusive lower bound)
   */
  createdAfter?: number;

  /**
   * Filter by creation date (inclusive upper bound)
   */
  createdBefore?: number;

  /**
   * Filter by completion date (inclusive lower bound)
   * Only applies to completed tasks
   */
  completedAfter?: number;

  /**
   * Filter by completion date (inclusive upper bound)
   * Only applies to completed tasks
   */
  completedBefore?: number;

  /**
   * Sort field
   * - 'priority': User-defined priority order
   * - 'createdAt': Creation timestamp
   */
  sortBy?: 'priority' | 'createdAt';

  /**
   * Sort direction
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * Maximum number of tasks to return
   * Default: 100 for Tasks screen, 20 for panel
   */
  limit?: number;

  /**
   * Opaque cursor for pagination
   * Returned from previous query when more results are available
   */
  cursor?: string;
}

/**
 * Event emitted when tasks change
 *
 * Used for real-time sync between main process and renderer:
 * - Panel/Screen subscribe to 'tasks:changed' channel
 * - Events are batched and sent as TaskChangeEvent[]
 */
export type TaskChangeEvent =
  | { type: 'added'; task: Task }
  | { type: 'updated'; task: Task }
  | { type: 'removed'; taskId: string }
  | { type: 'reordered'; taskIds: string[] };
