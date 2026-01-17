/**
 * @scribe/server-core
 *
 * Core server services for Scribe daemon.
 * Provides document, graph, search, and collaboration services.
 */

export const VERSION = '0.1.0';

// Container exports
export {
  createServices,
  destroyServices,
  createTestServices,
  type ServiceConfig,
  type Services,
} from './container.js';

// Service exports
export {
  DocumentService,
  type DocumentServiceDeps,
  GraphService,
  type GraphServiceDeps,
  type GraphNode,
  type LinkInfo,
  type TagInfo,
  type GraphStats,
  SearchService,
  type SearchServiceDeps,
  type SearchQuery,
  type SearchFilters,
  type SearchOptions,
  type SearchResult,
  type SearchResultNote,
  type MatchLocation,
  type SearchSuggestion,
  type ReindexResult,
  CollaborationService,
  type CollaborationServiceDeps,
  type CollabSession,
  type CollabUpdate,
  type UpdateHandler,
} from './services/index.js';

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

// Router exports
export {
  appRouter,
  router,
  publicProcedure,
  procedure,
  createContextFactory,
  notesRouter,
  searchRouter,
  graphRouter,
  exportRouter,
  type AppRouter,
  type Context,
  type ExportRouter,
} from './routers/index.js';
