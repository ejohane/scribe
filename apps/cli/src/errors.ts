/**
 * CLI Error Types
 *
 * This module provides CLI-specific error handling using error codes from @scribe/shared.
 * It maps CLI error scenarios to appropriate exit codes for shell scripting.
 */

import { ErrorCode } from '@scribe/shared';

// Re-export ErrorCode for convenience
export { ErrorCode };

/**
 * Map error codes to CLI exit codes.
 * Exit codes follow common Unix conventions:
 * - 0: Success
 * - 1: General error
 * - 2-125: Specific error codes
 */
export const EXIT_CODES: Partial<Record<ErrorCode, number>> = {
  // CLI-specific codes
  [ErrorCode.CLI_INTERNAL_ERROR]: 1,
  [ErrorCode.CLI_MISSING_VAULT]: 2,
  [ErrorCode.CLI_INVALID_ARGUMENT]: 4,
  [ErrorCode.CLI_WRITE_FAILED]: 5,
  [ErrorCode.CLI_HAS_BACKLINKS]: 3,

  // Shared codes that can occur in CLI
  [ErrorCode.NOTE_NOT_FOUND]: 3,
  [ErrorCode.PERMISSION_DENIED]: 6,
  [ErrorCode.VALIDATION_ERROR]: 4,
  [ErrorCode.FILE_NOT_FOUND]: 3,
  [ErrorCode.FILE_WRITE_ERROR]: 5,
  [ErrorCode.VAULT_NOT_INITIALIZED]: 2,
};

/**
 * Get exit code for an error code.
 * Defaults to 1 for unknown error codes.
 */
export function getExitCode(code: ErrorCode): number {
  return EXIT_CODES[code] ?? 1;
}

/**
 * CLI-specific error class.
 * Extends built-in Error with code, details, and hint.
 */
export class CLIError extends Error {
  constructor(
    message: string,
    public code: ErrorCode,
    public details?: Record<string, unknown>,
    public hint?: string
  ) {
    super(message);
    this.name = 'CLIError';
  }
}

export interface ErrorOutput {
  error: string;
  code: ErrorCode;
  details?: Record<string, unknown>;
  hint?: string;
}

export function formatError(err: CLIError): ErrorOutput {
  return {
    error: err.message,
    code: err.code,
    ...(err.details && { details: err.details }),
    ...(err.hint && { hint: err.hint }),
  };
}

// Convenience constructors using shared error codes

export function vaultNotFound(path: string): CLIError {
  return new CLIError(
    `Vault not found at ${path}`,
    ErrorCode.CLI_MISSING_VAULT,
    { path },
    'Specify vault with --vault flag or SCRIBE_VAULT_PATH environment variable'
  );
}

export function noteNotFound(id: string): CLIError {
  return new CLIError('Note not found', ErrorCode.NOTE_NOT_FOUND, { id });
}

export function invalidInput(message: string, field?: string, value?: unknown): CLIError {
  return new CLIError(message, ErrorCode.CLI_INVALID_ARGUMENT, {
    ...(field && { field }),
    ...(value !== undefined && { value }),
  });
}

export function hasBacklinks(
  noteId: string,
  backlinks: Array<{ id: string; title: string }>
): CLIError {
  return new CLIError(
    'Note has incoming links from other notes',
    ErrorCode.CLI_HAS_BACKLINKS,
    { noteId, backlinkCount: backlinks.length, backlinks },
    'Use --force to delete anyway (backlinks will become broken)'
  );
}

export function writeFailed(reason: string, path?: string): CLIError {
  return new CLIError('Failed to save note', ErrorCode.CLI_WRITE_FAILED, {
    reason,
    ...(path && { path }),
  });
}

export function internalError(message: string, cause?: Error): CLIError {
  return new CLIError(
    message,
    ErrorCode.CLI_INTERNAL_ERROR,
    cause ? { cause: cause.message } : undefined
  );
}
