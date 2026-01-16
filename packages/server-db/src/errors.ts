/**
 * Custom error types for database operations.
 * Provides structured error handling with codes and causes.
 */

/**
 * Error codes for database operations
 */
export type DatabaseErrorCode =
  | 'INIT_FAILED'
  | 'OPEN_FAILED'
  | 'CLOSE_FAILED'
  | 'QUERY_FAILED'
  | 'MIGRATION_FAILED'
  | 'PRAGMA_FAILED'
  | 'CONSTRAINT_VIOLATION'
  | 'NOT_FOUND'
  | 'ALREADY_EXISTS'
  | 'INVALID_CONFIG'
  | 'MKDIR_FAILED';

/**
 * Base database error class.
 * Provides structured error information including a code and optional cause.
 */
export class DatabaseError extends Error {
  override readonly name: string = 'DatabaseError';

  constructor(
    message: string,
    public readonly code: DatabaseErrorCode,
    public readonly cause?: Error
  ) {
    super(message);

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseError);
    }
  }

  /**
   * Returns a string representation of the error including code
   */
  toString(): string {
    let str = `${this.name} [${this.code}]: ${this.message}`;
    if (this.cause) {
      str += `\nCaused by: ${this.cause.message}`;
    }
    return str;
  }

  /**
   * Returns a JSON representation of the error
   */
  toJSON(): { name: string; code: DatabaseErrorCode; message: string; cause?: string } {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      cause: this.cause?.message,
    };
  }
}

/**
 * Error thrown when database initialization fails
 */
export class InitializationError extends DatabaseError {
  override readonly name = 'InitializationError';

  constructor(message: string, cause?: Error) {
    super(message, 'INIT_FAILED', cause);
  }
}

/**
 * Error thrown when a migration fails
 */
export class MigrationError extends DatabaseError {
  override readonly name = 'MigrationError';

  constructor(
    message: string,
    public readonly migrationName: string,
    cause?: Error
  ) {
    super(message, 'MIGRATION_FAILED', cause);
  }
}

/**
 * Error thrown when a query fails
 */
export class QueryError extends DatabaseError {
  override readonly name = 'QueryError';

  constructor(
    message: string,
    public readonly query?: string,
    cause?: Error
  ) {
    super(message, 'QUERY_FAILED', cause);
  }
}

/**
 * Type guard to check if an error is a DatabaseError
 */
export function isDatabaseError(error: unknown): error is DatabaseError {
  return error instanceof DatabaseError;
}

/**
 * Wraps an unknown error in a DatabaseError if it isn't already one
 */
export function wrapError(error: unknown, code: DatabaseErrorCode, message: string): DatabaseError {
  if (error instanceof DatabaseError) {
    return error;
  }
  const cause = error instanceof Error ? error : new Error(String(error));
  return new DatabaseError(message, code, cause);
}
