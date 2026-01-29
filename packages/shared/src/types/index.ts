/**
 * Type definitions for Scribe
 *
 * This module re-exports all domain-specific types from their respective modules.
 * Import from this index for convenient access to all types, or import from
 * specific modules for better tree-shaking and clarity.
 *
 * Domain modules:
 * - note-types: Note identifiers, metadata, and note type variants
 * - editor-types: Editor content abstraction (currently Lexical-based)
 * - graph-types: Knowledge graph visualization types
 * - search-types: Full-text search result types
 */

// Note types - identifiers, metadata, and note variants
export {
  // Branded types
  type NoteId,
  type VaultPath,

  // Factory functions
  createNoteId,
  createVaultPath,

  // Note type discriminator
  type NoteType,

  // Note metadata
  type NoteMetadata,
  isSystemNoteId,

  // Note type-specific data
  type DailyNoteData,
  type MeetingNoteData,

  // Note interfaces
  type BaseNote,
  type RegularNote,
  type PersonNote,
  type ProjectNote,
  type TemplateNote,
  type SystemNote,
  type DailyNote,
  type MeetingNote,

  // Note union type
  type Note,

  // Type guards
  isRegularNote,
  isPersonNote,
  isProjectNote,
  isTemplateNote,
  isSystemNote,
  isDailyNote,
  isMeetingNote,

  // Vault configuration
  type VaultConfig,
} from './note-types.js';

// Editor types - content abstraction layer
export { type EditorNode, type EditorContent } from './editor-types.js';

// Graph types - knowledge graph visualization
export { type GraphNode, type GraphEdge } from './graph-types.js';

// Search types - full-text search
export { type SearchResult } from './search-types.js';
