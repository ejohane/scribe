/**
 * @scribe/shared
 *
 * Core type definitions and shared utilities for Scribe
 */

export type {
  NoteId,
  NoteType,
  VaultPath,
  // Abstract editor types
  EditorContent,
  EditorNode,
  NoteMetadata,
  // Note types (discriminated union)
  Note,
  BaseNote,
  RegularNote,
  PersonNote,
  ProjectNote,
  TemplateNote,
  SystemNote,
  DailyNote,
  MeetingNote,
  DailyNoteData,
  MeetingNoteData,
  GraphNode,
  GraphEdge,
  SearchResult,
  VaultConfig,
  // Task types
  TaskId,
  Task,
  TaskFilter,
  TaskChangeEvent,
} from './types.js';

export {
  createNoteId,
  createVaultPath,
  serializeTaskId,
  parseTaskId,
  SYSTEM_NOTE_IDS,
  isSystemNoteId,
  // Note type guards
  isRegularNote,
  isPersonNote,
  isProjectNote,
  isTemplateNote,
  isSystemNote,
  isDailyNote,
  isMeetingNote,
} from './types.js';

export {
  ErrorCode,
  ScribeError,
  ValidationError,
  isScribeError,
  isValidationError,
  // Error message extraction utilities
  getErrorMessage,
} from './errors.js';

export { DEFAULT_NOTE_TITLE } from './constants.js';

// AST Traversal Utilities
export {
  traverseNodes,
  traverseNodesWithAncestors,
  findNodeByKey,
  extractTextFromNodes,
  extractTextFromNode,
} from './ast-utils.js';

// Content Extractor - Markdown export functionality
export { extractMarkdown } from './content-extractor.js';
export type { MarkdownExportOptions } from './content-extractor.js';

// IPC Contract - single source of truth for preload/renderer API surface
export { IPC_CHANNELS } from './ipc-contract.js';
export type {
  SuccessResponse,
  DateBasedNoteResult,
  UpdateInfo,
  UpdateError,
  ExportResult,
  NotesAPI,
  SearchAPI,
  GraphAPI,
  ShellAPI,
  AppAPI,
  PeopleAPI,
  DailyAPI,
  MeetingAPI,
  DictionaryAPI,
  TasksAPI,
  UpdateAPI,
  ExportAPI,
  DialogAPI,
  FolderPickerOptions,
  VaultAPI,
  VaultSwitchResult,
  VaultCreateResult,
  VaultValidationResult,
  ScribeAPI,
} from './ipc-contract.js';

// Date Utilities - consolidated date formatting, parsing, and comparison
export {
  formatDate,
  formatDateYMD,
  formatDateTitle,
  getRelativeDateString,
  parseDate,
  parseDateToTimestamp,
  isToday,
  isYesterday,
  isSameDay,
  toDate,
  isValidDate,
} from './date-utils.js';
export type { DateFormatStyle } from './date-utils.js';

// Content Utilities - Lexical editor structure helpers
export {
  createEmptyContent,
  createDailyContent,
  createMeetingContent,
  createPersonContent,
} from './content.js';

// Validation Utilities - shared validation for CLI and other consumers
export { validatePaginationOptions } from './validation.js';
export type { PaginationOptions } from './validation.js';

// Fuzzy Search Utilities - lightweight text similarity scoring
export {
  levenshteinDistance,
  fuzzyMatchScore,
  exactSubstringMatch,
  fuzzySearch,
  FUZZY_MATCH_THRESHOLD,
  EXACT_MATCH_SCORE,
  SUBSTRING_MATCH_BASE,
  ALL_WORDS_MATCH_SCORE,
} from './fuzzy-search.js';
export type { FuzzyMatchResult } from './fuzzy-search.js';

// Logger - structured logging abstraction
export { logger, createLogger } from './logger.js';
export type { Logger, LogLevel, LogContext } from './logger.js';

// General Utilities
export { deepClone } from './utils.js';

// Hash Utilities - consistent text hashing across codebase
export { computeTextHash } from './hash-utils.js';

// Heading Extractor - extract document outline from editor content
export { extractHeadings } from './heading-extractor.js';
export type { HeadingItem } from './heading-extractor.js';
