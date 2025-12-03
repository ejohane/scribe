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
export type NoteType = 'person' | 'project' | 'meeting' | 'daily' | 'template';

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
