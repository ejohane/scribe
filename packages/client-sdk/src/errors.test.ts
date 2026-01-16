/**
 * Tests for error handling utilities in the client SDK.
 *
 * Tests verify:
 * 1. ApiError construction and properties
 * 2. Error conversion from various sources
 * 3. Type guard functions
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  ApiError,
  isApiError,
  isNotFoundError,
  isNetworkError,
  type ApiErrorCode,
} from './errors.js';

describe('ApiError', () => {
  describe('constructor', () => {
    it('should create error with all properties', () => {
      const cause = new Error('Original error');
      const error = new ApiError('Test error', 'NOT_FOUND', 404, cause);

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.cause).toBe(cause);
      expect(error.name).toBe('ApiError');
    });

    it('should create error without optional properties', () => {
      const error = new ApiError('Test error', 'UNKNOWN');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('UNKNOWN');
      expect(error.statusCode).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('should be instanceof Error', () => {
      const error = new ApiError('Test', 'UNKNOWN');
      expect(error instanceof Error).toBe(true);
    });
  });

  describe('fromTRPCError', () => {
    it('should convert tRPC error with NOT_FOUND code', () => {
      const trpcError = Object.assign(new Error('Note not found'), {
        data: {
          code: 'NOT_FOUND',
          httpStatus: 404,
        },
      });

      const error = ApiError.fromTRPCError(trpcError);

      expect(error.message).toBe('Note not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
    });

    it('should convert tRPC error with BAD_REQUEST code', () => {
      const trpcError = Object.assign(new Error('Invalid input'), {
        data: {
          code: 'BAD_REQUEST',
          httpStatus: 400,
        },
      });

      const error = ApiError.fromTRPCError(trpcError);

      expect(error.code).toBe('BAD_REQUEST');
      expect(error.statusCode).toBe(400);
    });

    it('should convert tRPC error with VALIDATION_ERROR code to BAD_REQUEST', () => {
      const trpcError = Object.assign(new Error('Validation failed'), {
        data: {
          code: 'VALIDATION_ERROR',
          httpStatus: 400,
        },
      });

      const error = ApiError.fromTRPCError(trpcError);

      expect(error.code).toBe('BAD_REQUEST');
    });

    it('should handle tRPC error with missing data', () => {
      const trpcError = Object.assign(new Error('Unknown error'), {
        data: undefined,
      });

      const error = ApiError.fromTRPCError(trpcError);

      expect(error.code).toBe('UNKNOWN');
      expect(error.statusCode).toBeUndefined();
    });
  });

  describe('fromNetworkError', () => {
    it('should create network error', () => {
      const original = new Error('Connection refused');
      const error = ApiError.fromNetworkError(original);

      expect(error.message).toBe('Network error: Connection refused');
      expect(error.code).toBe('NETWORK_ERROR');
      expect(error.cause).toBe(original);
    });
  });

  describe('fromUnknown', () => {
    it('should return same ApiError if already ApiError', () => {
      const original = new ApiError('Test', 'NOT_FOUND');
      const error = ApiError.fromUnknown(original);

      expect(error).toBe(original);
    });

    it('should convert tRPC-like error', () => {
      const trpcLike = {
        message: 'tRPC error',
        data: { code: 'INTERNAL_SERVER_ERROR' },
      };
      Object.setPrototypeOf(trpcLike, Error.prototype);

      const error = ApiError.fromUnknown(trpcLike);

      expect(error.code).toBe('INTERNAL_SERVER_ERROR');
    });

    it('should detect network errors by message', () => {
      const networkError = new Error('fetch failed');
      const error = ApiError.fromUnknown(networkError);

      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('should detect ECONNREFUSED as network error', () => {
      const networkError = new Error('ECONNREFUSED');
      const error = ApiError.fromUnknown(networkError);

      expect(error.code).toBe('NETWORK_ERROR');
    });

    it('should convert generic Error to UNKNOWN', () => {
      const generic = new Error('Something went wrong');
      const error = ApiError.fromUnknown(generic);

      expect(error.code).toBe('UNKNOWN');
      expect(error.message).toBe('Something went wrong');
      expect(error.cause).toBe(generic);
    });

    it('should convert non-Error to UNKNOWN', () => {
      const error = ApiError.fromUnknown('string error');

      expect(error.code).toBe('UNKNOWN');
      expect(error.message).toBe('string error');
    });
  });
});

describe('isApiError', () => {
  it('should return true for ApiError', () => {
    const error = new ApiError('Test', 'NOT_FOUND');
    expect(isApiError(error)).toBe(true);
  });

  it('should return false for regular Error', () => {
    const error = new Error('Test');
    expect(isApiError(error)).toBe(false);
  });

  it('should return false for non-errors', () => {
    expect(isApiError('string')).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError(undefined)).toBe(false);
    expect(isApiError({})).toBe(false);
  });
});

describe('isNotFoundError', () => {
  it('should return true for NOT_FOUND ApiError', () => {
    const error = new ApiError('Not found', 'NOT_FOUND');
    expect(isNotFoundError(error)).toBe(true);
  });

  it('should return false for other ApiError codes', () => {
    const error = new ApiError('Bad request', 'BAD_REQUEST');
    expect(isNotFoundError(error)).toBe(false);
  });

  it('should return false for non-ApiError', () => {
    const error = new Error('Not found');
    expect(isNotFoundError(error)).toBe(false);
  });
});

describe('isNetworkError', () => {
  it('should return true for NETWORK_ERROR ApiError', () => {
    const error = new ApiError('Network error', 'NETWORK_ERROR');
    expect(isNetworkError(error)).toBe(true);
  });

  it('should return false for other ApiError codes', () => {
    const error = new ApiError('Server error', 'INTERNAL_SERVER_ERROR');
    expect(isNetworkError(error)).toBe(false);
  });

  it('should return false for non-ApiError', () => {
    const error = new Error('Network issue');
    expect(isNetworkError(error)).toBe(false);
  });
});

describe('ApiErrorCode type', () => {
  it('should include all expected codes', () => {
    // This test verifies compile-time type checking
    const codes: ApiErrorCode[] = [
      'NOT_FOUND',
      'BAD_REQUEST',
      'INTERNAL_SERVER_ERROR',
      'UNAUTHORIZED',
      'FORBIDDEN',
      'TIMEOUT',
      'PARSE_ERROR',
      'NETWORK_ERROR',
      'UNKNOWN',
    ];

    expect(codes).toHaveLength(9);
  });
});
