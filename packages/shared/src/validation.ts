/**
 * Validation Utilities
 *
 * Shared validation functions for CLI commands and other consumers.
 * These utilities help reduce code duplication and provide consistent error messages.
 */

import { ValidationError } from './errors.js';

/**
 * Options for pagination validation
 */
export interface PaginationOptions {
  limit?: number;
  offset?: number;
}

/**
 * Validates pagination options (limit and offset).
 * @throws ValidationError if options are invalid
 *
 * @example
 * validatePaginationOptions({ limit: 10, offset: 0 }); // OK
 * validatePaginationOptions({ limit: -1 }); // throws
 */
export function validatePaginationOptions(options: PaginationOptions): void {
  if (options.limit !== undefined) {
    if (!Number.isInteger(options.limit) || options.limit < 0) {
      throw new ValidationError('--limit must be a non-negative integer', 'limit');
    }
  }
  if (options.offset !== undefined) {
    if (!Number.isInteger(options.offset) || options.offset < 0) {
      throw new ValidationError('--offset must be a non-negative integer', 'offset');
    }
  }
}
