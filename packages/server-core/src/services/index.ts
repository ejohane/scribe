/**
 * Service exports for @scribe/server-core
 */

export { DocumentService, type DocumentServiceDeps } from './document.service.js';
export {
  GraphService,
  type GraphServiceDeps,
  type GraphNode,
  type LinkInfo,
  type TagInfo,
  type GraphStats,
} from './graph.service.js';
export {
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
} from './search.service.js';
export {
  CollaborationService,
  type CollaborationServiceDeps,
  type CollabSession,
  type CollabUpdate,
  type UpdateHandler,
} from './collaboration.service.js';
export {
  createExportService,
  type ExportService,
  type ExportServiceDeps,
  type ExportMarkdownResult,
  type ExportMarkdownOptions,
} from './export.service.js';
