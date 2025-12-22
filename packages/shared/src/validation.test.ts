/**
 * Tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import { validatePaginationOptions } from './validation.js';
import { ValidationError, isValidationError } from './errors.js';

describe('validatePaginationOptions', () => {
  it('should accept valid limit and offset', () => {
    expect(() => validatePaginationOptions({ limit: 10, offset: 0 })).not.toThrow();
    expect(() => validatePaginationOptions({ limit: 0, offset: 0 })).not.toThrow();
    expect(() => validatePaginationOptions({ limit: 100, offset: 50 })).not.toThrow();
  });

  it('should accept empty options', () => {
    expect(() => validatePaginationOptions({})).not.toThrow();
  });

  it('should accept undefined values', () => {
    expect(() => validatePaginationOptions({ limit: undefined, offset: undefined })).not.toThrow();
  });

  it('should throw for negative limit', () => {
    expect(() => validatePaginationOptions({ limit: -1 })).toThrow(ValidationError);
    try {
      validatePaginationOptions({ limit: -1 });
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
      expect((e as ValidationError).field).toBe('limit');
      expect((e as ValidationError).message).toBe('--limit must be a non-negative integer');
    }
  });

  it('should throw for negative offset', () => {
    expect(() => validatePaginationOptions({ offset: -1 })).toThrow(ValidationError);
    try {
      validatePaginationOptions({ offset: -1 });
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
      expect((e as ValidationError).field).toBe('offset');
      expect((e as ValidationError).message).toBe('--offset must be a non-negative integer');
    }
  });

  it('should throw for non-integer limit', () => {
    expect(() => validatePaginationOptions({ limit: 1.5 })).toThrow(ValidationError);
    expect(() => validatePaginationOptions({ limit: NaN })).toThrow(ValidationError);
  });

  it('should throw for non-integer offset', () => {
    expect(() => validatePaginationOptions({ offset: 1.5 })).toThrow(ValidationError);
    expect(() => validatePaginationOptions({ offset: NaN })).toThrow(ValidationError);
  });
});
