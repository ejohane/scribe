/**
 * Core primitive types and identifiers used throughout the application.
 */

// Primitive identifier types
export type NoteId = string; // stable ID, usually derived from normalized file path
export type PersonId = string; // e.g. "Erik", but you can also use "people/Erik"
export type TagId = string; // e.g. "planning", normalized
export type FolderId = string; // e.g. "notes", "people", "notes/2025"
export type HeadingId = string; // unique within a note, e.g. `${NoteId}#normalized-heading`
export type EmbedId = string; // refers to a note or future attachment ID
export type FilePath = string; // OS path relative to vault root
export type NodeId = string; // usually prefixed by type, e.g. "note:notes/Plan.md"

// Entity types
export type EntityType = 'note' | 'person' | 'tag' | 'folder' | 'heading' | 'embed';

// Link target kinds
export type LinkTargetKind = 'note' | 'heading'; // resolved later

// Edge types for graph relationships
export type EdgeType =
  | 'note-links-note'
  | 'note-links-heading'
  | 'note-embeds-note'
  | 'note-has-tag'
  | 'note-mentions-person'
  | 'person-links-note'
  | 'folder-contains-note'
  | 'folder-contains-folder';
