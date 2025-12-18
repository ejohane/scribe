/**
 * @scribe/shared
 *
 * Core type definitions and shared utilities for Scribe
 */

export type {
  NoteId,
  NoteType,
  VaultPath,
  // Abstract editor types (preferred)
  EditorContent,
  EditorNode,
  // Lexical compatibility aliases (deprecated)
  LexicalState,
  LexicalNode,
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
  FileSystemError,
  NoteError,
  VaultError,
  EngineError,
  ValidationError,
  isScribeError,
  isFileSystemError,
  isNoteError,
  isVaultError,
  isEngineError,
  isValidationError,
} from './errors.js';
export type { EngineName } from './errors.js';

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
  ScribeAPI,
} from './ipc-contract.js';

// Date Utilities - consolidated date formatting, parsing, and comparison
export {
  formatDate,
  formatDateYMD,
  formatDateMMDDYYYY,
  formatDateTitle,
  getRelativeDateString,
  parseDate,
  parseDateToTimestamp,
  parseDateMMDDYYYY,
  isToday,
  isYesterday,
  isSameDay,
  getDaysBetween,
  startOfDay,
  endOfDay,
  toDate,
  isValidDate,
} from './date-utils.js';
export type { DateFormatStyle } from './date-utils.js';
