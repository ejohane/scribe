/**
 * Error types for @scribe/server-core services.
 */

/**
 * Error codes for DocumentService operations.
 */
export type DocumentErrorCode =
  | 'NOTE_NOT_FOUND'
  | 'FILE_READ_ERROR'
  | 'FILE_WRITE_ERROR'
  | 'FILE_DELETE_ERROR'
  | 'INVALID_CONTENT'
  | 'INDEX_ERROR'
  | 'HASH_ERROR';

/**
 * Custom error class for document operations.
 */
export class DocumentError extends Error {
  constructor(
    message: string,
    public readonly code: DocumentErrorCode,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DocumentError';
  }
}

/**
 * Check if an error is a DocumentError.
 */
export function isDocumentError(error: unknown): error is DocumentError {
  return error instanceof DocumentError;
}

/**
 * Create a DocumentError with the appropriate code.
 */
export function createDocumentError(
  code: DocumentErrorCode,
  message: string,
  cause?: Error
): DocumentError {
  return new DocumentError(message, code, cause);
}
