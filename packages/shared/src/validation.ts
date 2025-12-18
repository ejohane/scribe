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

/**
 * Validates a date string in YYYY-MM-DD format.
 * @throws ValidationError if date is invalid
 *
 * @example
 * validateDateString('2024-01-15', 'since'); // OK
 * validateDateString('01-15-2024', 'since'); // throws - wrong format
 * validateDateString('2024-13-01', 'since'); // throws - invalid date
 */
export function validateDateString(date: string, paramName: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new ValidationError(`${paramName} must be in YYYY-MM-DD format`, paramName);
  }
  const parsed = new Date(date + 'T00:00:00');
  if (isNaN(parsed.getTime())) {
    throw new ValidationError(`${paramName} is not a valid date`, paramName);
  }
  // Verify the date wasn't normalized (e.g., 2024-02-30 becomes 2024-03-01)
  const [year, month, day] = date.split('-').map(Number);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() + 1 !== month ||
    parsed.getDate() !== day
  ) {
    throw new ValidationError(`${paramName} is not a valid date`, paramName);
  }
}

/**
 * Validates a positive integer.
 * @throws ValidationError if value is not a positive integer
 *
 * @example
 * validatePositiveInteger(5, 'count'); // OK
 * validatePositiveInteger(0, 'count'); // throws - must be positive
 * validatePositiveInteger(-1, 'count'); // throws
 * validatePositiveInteger(1.5, 'count'); // throws - not an integer
 */
export function validatePositiveInteger(
  value: unknown,
  paramName: string
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
    throw new ValidationError(`${paramName} must be a positive integer`, paramName);
  }
}

/**
 * Validates a non-negative integer (zero or greater).
 * @throws ValidationError if value is not a non-negative integer
 *
 * @example
 * validateNonNegativeInteger(0, 'offset'); // OK
 * validateNonNegativeInteger(5, 'offset'); // OK
 * validateNonNegativeInteger(-1, 'offset'); // throws
 */
export function validateNonNegativeInteger(
  value: unknown,
  paramName: string
): asserts value is number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${paramName} must be a non-negative integer`, paramName);
  }
}

/**
 * Validates that a value is within a specified range (inclusive).
 * @throws ValidationError if value is outside the range
 *
 * @example
 * validateInRange(2, 0, 3, 'priority'); // OK
 * validateInRange(5, 0, 3, 'priority'); // throws
 */
export function validateInRange(value: number, min: number, max: number, paramName: string): void {
  if (value < min || value > max) {
    throw new ValidationError(`${paramName} must be between ${min} and ${max}`, paramName);
  }
}
