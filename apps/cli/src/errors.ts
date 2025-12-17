export enum ErrorCode {
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  VAULT_NOT_FOUND = 'VAULT_NOT_FOUND',
  NOTE_NOT_FOUND = 'NOTE_NOT_FOUND',
  INVALID_INPUT = 'INVALID_INPUT',
  WRITE_FAILED = 'WRITE_FAILED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  HAS_BACKLINKS = 'HAS_BACKLINKS',
}

export const EXIT_CODES: Record<ErrorCode, number> = {
  INTERNAL_ERROR: 1,
  VAULT_NOT_FOUND: 2,
  NOTE_NOT_FOUND: 3,
  INVALID_INPUT: 4,
  WRITE_FAILED: 5,
  PERMISSION_DENIED: 6,
  HAS_BACKLINKS: 3,
};

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

// Convenience constructors
export function vaultNotFound(path: string): CLIError {
  return new CLIError(
    `Vault not found at ${path}`,
    ErrorCode.VAULT_NOT_FOUND,
    { path },
    'Specify vault with --vault flag or SCRIBE_VAULT_PATH environment variable'
  );
}

export function noteNotFound(id: string): CLIError {
  return new CLIError('Note not found', ErrorCode.NOTE_NOT_FOUND, { id });
}

export function invalidInput(message: string, field?: string, value?: unknown): CLIError {
  return new CLIError(message, ErrorCode.INVALID_INPUT, {
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
    ErrorCode.HAS_BACKLINKS,
    { noteId, backlinkCount: backlinks.length, backlinks },
    'Use --force to delete anyway (backlinks will become broken)'
  );
}

export function writeFailed(reason: string, path?: string): CLIError {
  return new CLIError('Failed to save note', ErrorCode.WRITE_FAILED, {
    reason,
    ...(path && { path }),
  });
}
