/**
 * Error types for Scribe application
 *
 * This module provides a hierarchy of error classes for type-safe error handling:
 * - ScribeError: Base class for all Scribe errors
 * - FileSystemError: File system operation errors (with path)
 * - NoteError: Note-related errors (with noteId)
 * - VaultError: Vault-related errors (with vaultPath)
 * - EngineError: Engine-related errors (with engine name)
 * - ValidationError: Input validation errors
 *
 * Usage with instanceof:
 * ```typescript
 * try {
 *   await vault.load();
 * } catch (e) {
 *   if (e instanceof FileSystemError) {
 *     console.log(`File error at path: ${e.path}`);
 *   } else if (e instanceof NoteError) {
 *     console.log(`Note error for: ${e.noteId}`);
 *   }
 * }
 * ```
 */

import type { NoteId, VaultPath } from './types.js';

export enum ErrorCode {
  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_DELETE_ERROR = 'FILE_DELETE_ERROR',
  FILE_EXISTS = 'FILE_EXISTS',
  IS_DIRECTORY = 'IS_DIRECTORY',
  NOT_DIRECTORY = 'NOT_DIRECTORY',
  TOO_MANY_OPEN_FILES = 'TOO_MANY_OPEN_FILES',
  DIRECTORY_NOT_EMPTY = 'DIRECTORY_NOT_EMPTY',
  DISK_FULL = 'DISK_FULL',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Note errors
  NOTE_NOT_FOUND = 'NOTE_NOT_FOUND',
  INVALID_NOTE_FORMAT = 'INVALID_NOTE_FORMAT',
  NOTE_CORRUPT = 'NOTE_CORRUPT',

  // Vault errors
  VAULT_NOT_INITIALIZED = 'VAULT_NOT_INITIALIZED',
  VAULT_CORRUPTED = 'VAULT_CORRUPTED',

  // Engine errors
  GRAPH_NOT_INITIALIZED = 'GRAPH_NOT_INITIALIZED',
  SEARCH_NOT_INITIALIZED = 'SEARCH_NOT_INITIALIZED',
  ENGINE_ERROR = 'ENGINE_ERROR',

  // Validation errors
  VALIDATION_ERROR = 'VALIDATION_ERROR',

  // Task-related codes
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_INVALID = 'TASK_INVALID',

  // Sync-related codes
  SYNC_CONFLICT = 'SYNC_CONFLICT',
  SYNC_FAILED = 'SYNC_FAILED',
  /** Network error during sync (timeout, connection refused, etc.) */
  SYNC_NETWORK_ERROR = 'SYNC_NETWORK_ERROR',
  /** Authentication failed (invalid API key, expired token) */
  SYNC_AUTH_FAILED = 'SYNC_AUTH_FAILED',
  /** Version mismatch detected (conflict) */
  SYNC_VERSION_MISMATCH = 'SYNC_VERSION_MISMATCH',
  /** Rate limit exceeded */
  SYNC_RATE_LIMITED = 'SYNC_RATE_LIMITED',
  /** Sync is disabled for this vault */
  SYNC_DISABLED = 'SYNC_DISABLED',
  /** Invalid note received from server */
  SYNC_INVALID_NOTE = 'SYNC_INVALID_NOTE',
  /** Server error (5xx response) */
  SYNC_SERVER_ERROR = 'SYNC_SERVER_ERROR',
  /** Device ID conflict */
  SYNC_DEVICE_CONFLICT = 'SYNC_DEVICE_CONFLICT',

  // Migration codes
  MIGRATION_FAILED = 'MIGRATION_FAILED',
  MIGRATION_REQUIRED = 'MIGRATION_REQUIRED',

  // CLI-specific codes
  CLI_INVALID_ARGUMENT = 'CLI_INVALID_ARGUMENT',
  CLI_MISSING_VAULT = 'CLI_MISSING_VAULT',
  CLI_INTERNAL_ERROR = 'CLI_INTERNAL_ERROR',
  CLI_HAS_BACKLINKS = 'CLI_HAS_BACKLINKS',
  CLI_WRITE_FAILED = 'CLI_WRITE_FAILED',

  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * System error interface for Node.js errors with code property
 */
interface SystemError extends Error {
  code?: string;
}

/**
 * Base error class for Scribe errors
 *
 * All domain-specific error classes extend this base class.
 * Use subclasses (FileSystemError, NoteError, etc.) for type-safe error handling.
 */
export class ScribeError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'ScribeError';
  }

  /**
   * Get a user-friendly error message
   */
  getUserMessage(): string {
    switch (this.code) {
      case ErrorCode.FILE_NOT_FOUND:
        return 'The requested file could not be found.';
      case ErrorCode.FILE_READ_ERROR:
        return 'Failed to read the file. Please check file permissions.';
      case ErrorCode.FILE_WRITE_ERROR:
        return 'Failed to save the file. Please check disk space and permissions.';
      case ErrorCode.FILE_DELETE_ERROR:
        return 'Failed to delete the file.';
      case ErrorCode.FILE_EXISTS:
        return 'A file with that name already exists.';
      case ErrorCode.IS_DIRECTORY:
        return 'Expected a file but found a directory.';
      case ErrorCode.NOT_DIRECTORY:
        return 'Expected a directory but found a file.';
      case ErrorCode.TOO_MANY_OPEN_FILES:
        return 'Too many files are open. Please close some applications and try again.';
      case ErrorCode.DIRECTORY_NOT_EMPTY:
        return 'The directory is not empty.';
      case ErrorCode.DISK_FULL:
        return 'Disk is full. Please free up some space and try again.';
      case ErrorCode.PERMISSION_DENIED:
        return 'Permission denied. Please check file permissions.';
      case ErrorCode.NOTE_NOT_FOUND:
        return 'The requested note could not be found.';
      case ErrorCode.INVALID_NOTE_FORMAT:
        return 'The note has an invalid format and cannot be loaded.';
      case ErrorCode.NOTE_CORRUPT:
        return 'The note file is corrupted and cannot be loaded.';
      case ErrorCode.VAULT_NOT_INITIALIZED:
        return 'The vault has not been initialized. Please restart the application.';
      case ErrorCode.VAULT_CORRUPTED:
        return 'The vault is corrupted. Please contact support.';
      case ErrorCode.GRAPH_NOT_INITIALIZED:
        return 'The graph engine has not been initialized. Please restart the application.';
      case ErrorCode.SEARCH_NOT_INITIALIZED:
        return 'The search engine has not been initialized. Please restart the application.';
      case ErrorCode.ENGINE_ERROR:
        return 'An engine error occurred. Please restart the application.';
      case ErrorCode.VALIDATION_ERROR:
        return this.message || 'Invalid input provided.';
      case ErrorCode.TASK_NOT_FOUND:
        return 'The requested task could not be found.';
      case ErrorCode.TASK_INVALID:
        return 'The task data is invalid.';
      case ErrorCode.SYNC_CONFLICT:
        return 'A sync conflict was detected. Please resolve the conflict manually.';
      case ErrorCode.SYNC_FAILED:
        return 'Failed to sync. Please check your connection and try again.';
      case ErrorCode.SYNC_NETWORK_ERROR:
        return 'Network error during sync. Please check your internet connection.';
      case ErrorCode.SYNC_AUTH_FAILED:
        return 'Authentication failed. Please sign in again.';
      case ErrorCode.SYNC_VERSION_MISMATCH:
        return 'A newer version of this note exists. Please refresh and try again.';
      case ErrorCode.SYNC_RATE_LIMITED:
        return 'Too many sync requests. Please wait a moment and try again.';
      case ErrorCode.SYNC_DISABLED:
        return 'Sync is disabled for this vault.';
      case ErrorCode.SYNC_INVALID_NOTE:
        return 'Received invalid note data from server.';
      case ErrorCode.SYNC_SERVER_ERROR:
        return 'Server error during sync. Please try again later.';
      case ErrorCode.SYNC_DEVICE_CONFLICT:
        return 'Device conflict detected. Please re-authenticate this device.';
      case ErrorCode.MIGRATION_FAILED:
        return 'Failed to migrate data. Please contact support.';
      case ErrorCode.MIGRATION_REQUIRED:
        return 'A data migration is required. Please update the application.';
      case ErrorCode.CLI_INVALID_ARGUMENT:
        return 'Invalid command line argument provided.';
      case ErrorCode.CLI_MISSING_VAULT:
        return 'No vault specified. Please provide a vault path.';
      case ErrorCode.CLI_INTERNAL_ERROR:
        return 'An internal CLI error occurred.';
      case ErrorCode.CLI_HAS_BACKLINKS:
        return 'Note has incoming links from other notes.';
      case ErrorCode.CLI_WRITE_FAILED:
        return 'Failed to save the note.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Determine error code from system error
   */
  static fromSystemError(error: SystemError, defaultCode: ErrorCode): ErrorCode {
    if (!error.code) return defaultCode;

    switch (error.code) {
      case 'ENOENT':
        return ErrorCode.FILE_NOT_FOUND;
      case 'EACCES':
      case 'EPERM':
        return ErrorCode.PERMISSION_DENIED;
      case 'ENOSPC':
        return ErrorCode.DISK_FULL;
      case 'EEXIST':
        return ErrorCode.FILE_EXISTS;
      case 'EISDIR':
        return ErrorCode.IS_DIRECTORY;
      case 'ENOTDIR':
        return ErrorCode.NOT_DIRECTORY;
      case 'EMFILE':
      case 'ENFILE':
        return ErrorCode.TOO_MANY_OPEN_FILES;
      case 'ENOTEMPTY':
        return ErrorCode.DIRECTORY_NOT_EMPTY;
      default:
        return defaultCode;
    }
  }
}

/**
 * Error class for file system operations
 *
 * Use this class for errors related to file I/O, paths, and disk operations.
 * The `path` property provides the affected file/directory path.
 *
 * @example
 * ```typescript
 * throw new FileSystemError(
 *   ErrorCode.FILE_NOT_FOUND,
 *   'File not found',
 *   '/path/to/file.json'
 * );
 * ```
 */
export class FileSystemError extends ScribeError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly path: string,
    cause?: Error
  ) {
    super(code, message, cause);
    this.name = 'FileSystemError';
  }

  /**
   * Create a FileSystemError from a system error
   */
  static create(
    error: SystemError,
    path: string,
    defaultCode: ErrorCode = ErrorCode.UNKNOWN_ERROR
  ): FileSystemError {
    const code = ScribeError.fromSystemError(error, defaultCode);
    return new FileSystemError(code, error.message, path, error);
  }
}

/**
 * Error class for note-related operations
 *
 * Use this class for errors involving specific notes.
 * The `noteId` property identifies the affected note.
 *
 * @example
 * ```typescript
 * throw new NoteError(
 *   ErrorCode.NOTE_NOT_FOUND,
 *   'Note not found',
 *   createNoteId('abc-123')
 * );
 * ```
 */
export class NoteError extends ScribeError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly noteId: NoteId,
    cause?: Error
  ) {
    super(code, message, cause);
    this.name = 'NoteError';
  }
}

/**
 * Error class for vault-related operations
 *
 * Use this class for errors involving the vault as a whole.
 * The `vaultPath` property identifies the affected vault.
 *
 * @example
 * ```typescript
 * throw new VaultError(
 *   ErrorCode.VAULT_NOT_INITIALIZED,
 *   'Vault not initialized',
 *   createVaultPath('/path/to/vault')
 * );
 * ```
 */
export class VaultError extends ScribeError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly vaultPath: VaultPath,
    cause?: Error
  ) {
    super(code, message, cause);
    this.name = 'VaultError';
  }
}

/**
 * Engine type for EngineError
 */
export type EngineName = 'graph' | 'search' | 'storage' | 'metadata' | 'sync';

/**
 * Error class for engine-related operations
 *
 * Use this class for errors from the various Scribe engines.
 * The `engine` property identifies the affected engine.
 *
 * @example
 * ```typescript
 * throw new EngineError(
 *   ErrorCode.GRAPH_NOT_INITIALIZED,
 *   'Graph engine not initialized',
 *   'graph'
 * );
 * ```
 */
export class EngineError extends ScribeError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly engine: EngineName,
    cause?: Error
  ) {
    super(code, message, cause);
    this.name = 'EngineError';
  }
}

/**
 * Error class for validation errors
 *
 * Use this class for input validation failures.
 * The `field` property optionally identifies the invalid field.
 *
 * @example
 * ```typescript
 * throw new ValidationError(
 *   'Title cannot be empty',
 *   'title'
 * );
 * ```
 */
export class ValidationError extends ScribeError {
  constructor(
    message: string,
    public readonly field?: string,
    cause?: Error
  ) {
    super(ErrorCode.VALIDATION_ERROR, message, cause);
    this.name = 'ValidationError';
  }
}

/**
 * Error thrown when a task is not found.
 */
export class TaskNotFoundError extends ScribeError {
  constructor(taskId: string) {
    super(ErrorCode.TASK_NOT_FOUND, `Task not found: ${taskId}`);
    this.name = 'TaskNotFoundError';
  }
}

/**
 * Error thrown when sync encounters a conflict.
 */
export class SyncConflictError extends ScribeError {
  constructor(noteId: string, details?: string) {
    super(
      ErrorCode.SYNC_CONFLICT,
      `Sync conflict for note ${noteId}${details ? `: ${details}` : ''}`
    );
    this.name = 'SyncConflictError';
  }
}

/**
 * Error class for sync-related operations
 *
 * Use this class for errors from the sync engine.
 * The `noteId` property optionally identifies the affected note.
 *
 * @example
 * ```typescript
 * throw new SyncError(
 *   ErrorCode.SYNC_NETWORK_ERROR,
 *   'Connection timed out',
 *   'note-abc-123'
 * );
 * ```
 */
export class SyncError extends ScribeError {
  constructor(
    code: ErrorCode,
    message: string,
    public readonly noteId?: string,
    cause?: Error
  ) {
    super(code, message, cause);
    this.name = 'SyncError';
  }
}

/**
 * Error thrown when note migration fails.
 */
export class MigrationError extends ScribeError {
  constructor(noteId: string, fromVersion: number, toVersion: number, reason: string) {
    super(
      ErrorCode.MIGRATION_FAILED,
      `Failed to migrate note ${noteId} from v${fromVersion} to v${toVersion}: ${reason}`
    );
    this.name = 'MigrationError';
  }
}

/**
 * Type guard to check if an error is a ScribeError
 */
export function isScribeError(error: unknown): error is ScribeError {
  return error instanceof ScribeError;
}

/**
 * Type guard to check if an error is a FileSystemError
 */
export function isFileSystemError(error: unknown): error is FileSystemError {
  return error instanceof FileSystemError;
}

/**
 * Type guard to check if an error is a NoteError
 */
export function isNoteError(error: unknown): error is NoteError {
  return error instanceof NoteError;
}

/**
 * Type guard to check if an error is a VaultError
 */
export function isVaultError(error: unknown): error is VaultError {
  return error instanceof VaultError;
}

/**
 * Type guard to check if an error is an EngineError
 */
export function isEngineError(error: unknown): error is EngineError {
  return error instanceof EngineError;
}

/**
 * Type guard to check if an error is a ValidationError
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Type guard to check if an error is a TaskNotFoundError
 */
export function isTaskNotFoundError(error: unknown): error is TaskNotFoundError {
  return error instanceof TaskNotFoundError;
}

/**
 * Type guard to check if an error is a SyncConflictError
 */
export function isSyncConflictError(error: unknown): error is SyncConflictError {
  return error instanceof SyncConflictError;
}

/**
 * Type guard to check if an error is a SyncError
 */
export function isSyncError(error: unknown): error is SyncError {
  return error instanceof SyncError;
}

/**
 * Type guard to check if an error is a MigrationError
 */
export function isMigrationError(error: unknown): error is MigrationError {
  return error instanceof MigrationError;
}

// ============================================================================
// Error Message Extraction Utilities
// ============================================================================

/**
 * Safely extract an error message from an unknown caught value.
 *
 * This utility standardizes error message extraction across the codebase,
 * replacing inconsistent inline patterns like:
 * ```typescript
 * const msg = err instanceof Error ? err.message : 'Unknown error';
 * ```
 *
 * @param error - The caught value (could be Error, string, or anything)
 * @param fallback - Default message if error is not an Error instance
 * @returns Human-readable error message
 *
 * @example
 * ```typescript
 * try {
 *   await riskyOperation();
 * } catch (error) {
 *   const message = getErrorMessage(error, 'Operation failed');
 *   showToast(message, 'error');
 * }
 * ```
 */
export function getErrorMessage(error: unknown, fallback = 'An error occurred'): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return fallback;
}

/**
 * Extract error message with context prefix.
 *
 * Use this when you want to provide context about what operation failed,
 * combined with the actual error message.
 *
 * @param error - The caught value
 * @param context - Context message describing the operation that failed
 * @returns Combined context and error message, or just context if no message
 *
 * @example
 * ```typescript
 * try {
 *   await saveNote(note);
 * } catch (error) {
 *   const message = getErrorMessageWithContext(error, 'Failed to save note');
 *   // Returns: "Failed to save note: Network timeout" or "Failed to save note"
 *   showToast(message, 'error');
 * }
 * ```
 */
export function getErrorMessageWithContext(error: unknown, context: string): string {
  const message = getErrorMessage(error);
  // Only append the message if it's not the default fallback
  if (message !== 'An error occurred' && message) {
    return `${context}: ${message}`;
  }
  return context;
}
