/**
 * Error handling utilities for the Scribe client SDK.
 *
 * Provides custom error types and helpers for handling API errors.
 *
 * @module
 */

/**
 * Standard error codes returned by the Scribe API.
 */
export type ApiErrorCode =
  | 'NOT_FOUND'
  | 'BAD_REQUEST'
  | 'INTERNAL_SERVER_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'TIMEOUT'
  | 'PARSE_ERROR'
  | 'NETWORK_ERROR'
  | 'UNKNOWN';

/**
 * Shape of tRPC error data.
 * Used for duck typing tRPC errors.
 */
interface TRPCErrorData {
  code?: string;
  httpStatus?: number;
}

/**
 * Shape of a tRPC-like error.
 * Used for duck typing when converting errors.
 */
interface TRPCLikeError extends Error {
  data?: TRPCErrorData;
}

/**
 * Custom error class for Scribe API errors.
 *
 * Wraps tRPC errors with a consistent interface for error handling.
 *
 * @example
 * ```typescript
 * try {
 *   await api.notes.get.query('non-existent-id');
 * } catch (err) {
 *   if (err instanceof ApiError) {
 *     if (err.code === 'NOT_FOUND') {
 *       console.log('Note not found');
 *     }
 *   }
 * }
 * ```
 */
export class ApiError extends Error {
  /**
   * Create a new ApiError.
   *
   * @param message - Human-readable error message
   * @param code - Error code for programmatic handling
   * @param statusCode - HTTP status code if available
   * @param cause - Original error that caused this error
   */
  constructor(
    message: string,
    public readonly code: ApiErrorCode,
    public readonly statusCode?: number,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /**
   * Create an ApiError from a tRPC client error.
   *
   * Extracts error details from tRPC error shape.
   *
   * @param err - tRPC client error (or tRPC-like error shape)
   * @returns ApiError with extracted details
   */
  static fromTRPCError(err: TRPCLikeError): ApiError {
    const code = mapTRPCCode(err.data?.code);
    const statusCode = err.data?.httpStatus;

    return new ApiError(err.message, code, statusCode, err);
  }

  /**
   * Create an ApiError from a network error.
   *
   * @param err - Network error
   * @returns ApiError with NETWORK_ERROR code
   */
  static fromNetworkError(err: Error): ApiError {
    return new ApiError(`Network error: ${err.message}`, 'NETWORK_ERROR', undefined, err);
  }

  /**
   * Create an ApiError from any unknown error.
   *
   * @param err - Unknown error
   * @returns ApiError
   */
  static fromUnknown(err: unknown): ApiError {
    if (err instanceof ApiError) {
      return err;
    }

    if (err instanceof Error) {
      // Check if it's a tRPC error by duck typing
      if ('data' in err && typeof (err as { data?: unknown }).data === 'object') {
        return ApiError.fromTRPCError(err as TRPCLikeError);
      }

      // Check for network errors
      if (err.message.includes('fetch failed') || err.message.includes('ECONNREFUSED')) {
        return ApiError.fromNetworkError(err);
      }

      return new ApiError(err.message, 'UNKNOWN', undefined, err);
    }

    return new ApiError(String(err), 'UNKNOWN');
  }
}

/**
 * Map tRPC error codes to ApiErrorCode.
 *
 * @param code - tRPC error code
 * @returns Mapped ApiErrorCode
 */
function mapTRPCCode(code: string | undefined): ApiErrorCode {
  switch (code) {
    case 'NOT_FOUND':
      return 'NOT_FOUND';
    case 'BAD_REQUEST':
    case 'VALIDATION_ERROR':
      return 'BAD_REQUEST';
    case 'INTERNAL_SERVER_ERROR':
      return 'INTERNAL_SERVER_ERROR';
    case 'UNAUTHORIZED':
      return 'UNAUTHORIZED';
    case 'FORBIDDEN':
      return 'FORBIDDEN';
    case 'TIMEOUT':
      return 'TIMEOUT';
    case 'PARSE_ERROR':
      return 'PARSE_ERROR';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Check if an error is an ApiError.
 *
 * @param err - Error to check
 * @returns true if error is an ApiError
 */
export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}

/**
 * Check if an error indicates the resource was not found.
 *
 * @param err - Error to check
 * @returns true if error is a NOT_FOUND error
 */
export function isNotFoundError(err: unknown): boolean {
  return isApiError(err) && err.code === 'NOT_FOUND';
}

/**
 * Check if an error is a network connectivity error.
 *
 * @param err - Error to check
 * @returns true if error is a network error
 */
export function isNetworkError(err: unknown): boolean {
  return isApiError(err) && err.code === 'NETWORK_ERROR';
}
