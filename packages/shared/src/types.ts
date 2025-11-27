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
 * - 'person': A person entity that can be mentioned with @name syntax
 * - undefined: A regular note (default)
 */
export type NoteType = 'person';

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
   * Title of the note (extracted from first text block or explicit metadata node)
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
   * Timestamp when note was created (milliseconds)
   */
  createdAt: number;

  /**
   * Timestamp when note was last updated (milliseconds)
   * Managed by engine only
   */
  updatedAt: number;

  /**
   * Lexical editor state serialized as JSON
   */
  content: LexicalState;

  /**
   * Derived metadata (title, tags, links)
   * Always re-extracted from content by engine
   */
  metadata: NoteMetadata;
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
