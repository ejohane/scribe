/**
 * @scribe/shared
 *
 * Core type definitions and shared utilities for Scribe
 */

export type {
  NoteId,
  NoteType,
  VaultPath,
  LexicalState,
  LexicalNode,
  NoteMetadata,
  Note,
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

export { serializeTaskId, parseTaskId, SYSTEM_NOTE_IDS, isSystemNoteId } from './types.js';

export { ErrorCode, ScribeError } from './errors.js';
