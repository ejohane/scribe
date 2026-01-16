/**
 * Note-related types for DocumentService.
 *
 * These types define the shapes for creating, updating, and representing notes.
 * Notes are stored as JSON files (source of truth) with metadata indexed in SQLite.
 */

import type { NoteType } from '@scribe/server-db';

/**
 * Lexical editor node interface (simplified for extraction).
 * The actual Lexical types are more complex, but we only need
 * these properties for text extraction and link/tag parsing.
 */
export interface LexicalNode {
  type?: string;
  text?: string;
  tag?: string; // For hashtag nodes
  noteId?: string; // For note link nodes
  children?: LexicalNode[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any;
}

/**
 * Lexical editor content structure.
 * Represents the serialized state of a Lexical editor.
 */
export interface EditorContent {
  root: {
    children: LexicalNode[];
    direction?: 'ltr' | 'rtl' | null;
    format?: string;
    indent?: number;
    type: 'root';
    version: number;
  };
}

/**
 * Options for creating a new note.
 */
export interface CreateNoteOptions {
  /** Title of the note */
  title: string;
  /** Type of note (affects file organization and display) */
  type: NoteType;
  /** ISO date string for daily/meeting notes */
  date?: string;
  /** Initial Lexical editor content */
  content?: EditorContent;
}

/**
 * Options for updating an existing note.
 * All fields are optional - only provided fields will be updated.
 */
export interface UpdateNoteOptions {
  /** New title for the note */
  title?: string;
  /** New Lexical editor content */
  content?: EditorContent;
}

/**
 * Complete note representation including file content and metadata.
 * This is what's returned from read operations.
 */
export interface NoteDocument {
  /** Unique note identifier (nanoid) */
  id: string;
  /** Note title */
  title: string;
  /** Note type */
  type: NoteType;
  /** ISO date for daily/meeting notes, null otherwise */
  date: string | null;
  /** ISO timestamp when note was created */
  createdAt: string;
  /** ISO timestamp when note was last updated */
  updatedAt: string;
  /** Lexical editor content */
  content: EditorContent;
  /** Word count calculated from content */
  wordCount: number;
}

/**
 * JSON file structure stored on disk.
 * Slightly different from NoteDocument - doesn't include computed fields.
 */
export interface NoteFile {
  id: string;
  title: string;
  type: NoteType;
  date: string | null;
  createdAt: string;
  updatedAt: string;
  content: EditorContent;
}

/**
 * Metadata for listing notes (from SQLite index).
 * Used for quick queries without reading full files.
 */
export interface NoteMetadata {
  id: string;
  title: string;
  type: NoteType;
  date: string | null;
  createdAt: string;
  updatedAt: string;
  wordCount: number;
  filePath: string;
}

/**
 * Parsed link extracted from content.
 */
export interface ExtractedLink {
  targetId: string;
  text: string | null;
}

/**
 * Filter options for listing notes.
 */
export interface NoteListFilter {
  /** Filter by note type */
  type?: NoteType;
  /** Filter notes created/dated on or after this ISO date */
  dateFrom?: string;
  /** Filter notes created/dated on or before this ISO date */
  dateTo?: string;
  /** Maximum number of results */
  limit?: number;
  /** Skip this many results (for pagination) */
  offset?: number;
  /** Sort field */
  orderBy?: 'created_at' | 'updated_at' | 'title' | 'date';
  /** Sort direction */
  orderDir?: 'asc' | 'desc';
}
