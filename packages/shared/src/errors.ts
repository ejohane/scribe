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
export type EngineName = 'graph' | 'search' | 'storage' | 'metadata';

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
