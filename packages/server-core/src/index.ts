/**
 * @scribe/server-core
 *
 * Core server services for Scribe daemon.
 * Provides document, graph, search, and collaboration services.
 */

export const VERSION = '0.1.0';

// Service exports
export { DocumentService, type DocumentServiceDeps } from './services/index.js';

// Error exports
export {
  DocumentError,
  isDocumentError,
  createDocumentError,
  type DocumentErrorCode,
} from './errors.js';

// Type exports
export type {
  LexicalNode,
  EditorContent,
  CreateNoteOptions,
  UpdateNoteOptions,
  NoteDocument,
  NoteFile,
  NoteMetadata,
  ExtractedLink,
  NoteListFilter,
} from './types/index.js';
