/**
 * Error types for Scribe application
 */

export enum ErrorCode {
  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  FILE_READ_ERROR = 'FILE_READ_ERROR',
  FILE_WRITE_ERROR = 'FILE_WRITE_ERROR',
  FILE_DELETE_ERROR = 'FILE_DELETE_ERROR',
  DISK_FULL = 'DISK_FULL',
  PERMISSION_DENIED = 'PERMISSION_DENIED',

  // Note errors
  NOTE_NOT_FOUND = 'NOTE_NOT_FOUND',
  INVALID_NOTE_FORMAT = 'INVALID_NOTE_FORMAT',
  NOTE_CORRUPT = 'NOTE_CORRUPT',

  // Vault errors
  VAULT_NOT_INITIALIZED = 'VAULT_NOT_INITIALIZED',
  VAULT_CORRUPTED = 'VAULT_CORRUPTED',

  // Generic errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}

/**
 * Base error class for Scribe errors
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
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  /**
   * Determine error code from system error
   */
  static fromSystemError(error: Error & { code?: string }, defaultCode: ErrorCode): ErrorCode {
    if (!error.code) return defaultCode;

    switch (error.code) {
      case 'ENOENT':
        return ErrorCode.FILE_NOT_FOUND;
      case 'EACCES':
      case 'EPERM':
        return ErrorCode.PERMISSION_DENIED;
      case 'ENOSPC':
        return ErrorCode.DISK_FULL;
      default:
        return defaultCode;
    }
  }
}
