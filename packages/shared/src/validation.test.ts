/**
 * Tests for validation utilities
 */

import { describe, it, expect } from 'vitest';
import {
  validatePaginationOptions,
  validateDateString,
  validatePositiveInteger,
  validateNonNegativeInteger,
  validateInRange,
} from './validation.js';
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

describe('validateDateString', () => {
  it('should accept valid YYYY-MM-DD dates', () => {
    expect(() => validateDateString('2024-01-15', 'since')).not.toThrow();
    expect(() => validateDateString('2023-12-31', 'until')).not.toThrow();
    expect(() => validateDateString('2000-06-01', 'date')).not.toThrow();
  });

  it('should throw for wrong format', () => {
    expect(() => validateDateString('01-15-2024', 'since')).toThrow(ValidationError);
    expect(() => validateDateString('2024/01/15', 'since')).toThrow(ValidationError);
    expect(() => validateDateString('2024-1-15', 'since')).toThrow(ValidationError);
    expect(() => validateDateString('January 15, 2024', 'since')).toThrow(ValidationError);
  });

  it('should throw for invalid dates', () => {
    expect(() => validateDateString('2024-13-01', 'since')).toThrow(ValidationError);
    expect(() => validateDateString('2024-02-30', 'since')).toThrow(ValidationError);
  });

  it('should include param name in error', () => {
    try {
      validateDateString('invalid', 'since');
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
      expect((e as ValidationError).field).toBe('since');
      expect((e as ValidationError).message).toContain('since');
    }
  });
});

describe('validatePositiveInteger', () => {
  it('should accept positive integers', () => {
    expect(() => validatePositiveInteger(1, 'count')).not.toThrow();
    expect(() => validatePositiveInteger(100, 'count')).not.toThrow();
    expect(() => validatePositiveInteger(999999, 'count')).not.toThrow();
  });

  it('should throw for zero', () => {
    expect(() => validatePositiveInteger(0, 'count')).toThrow(ValidationError);
  });

  it('should throw for negative numbers', () => {
    expect(() => validatePositiveInteger(-1, 'count')).toThrow(ValidationError);
    expect(() => validatePositiveInteger(-100, 'count')).toThrow(ValidationError);
  });

  it('should throw for non-integers', () => {
    expect(() => validatePositiveInteger(1.5, 'count')).toThrow(ValidationError);
    expect(() => validatePositiveInteger(0.1, 'count')).toThrow(ValidationError);
  });

  it('should throw for non-numbers', () => {
    expect(() => validatePositiveInteger('5', 'count')).toThrow(ValidationError);
    expect(() => validatePositiveInteger(null, 'count')).toThrow(ValidationError);
    expect(() => validatePositiveInteger(undefined, 'count')).toThrow(ValidationError);
  });

  it('should include param name in error', () => {
    try {
      validatePositiveInteger(-1, 'myParam');
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
      expect((e as ValidationError).field).toBe('myParam');
      expect((e as ValidationError).message).toContain('myParam');
    }
  });
});

describe('validateNonNegativeInteger', () => {
  it('should accept zero and positive integers', () => {
    expect(() => validateNonNegativeInteger(0, 'offset')).not.toThrow();
    expect(() => validateNonNegativeInteger(1, 'offset')).not.toThrow();
    expect(() => validateNonNegativeInteger(100, 'offset')).not.toThrow();
  });

  it('should throw for negative numbers', () => {
    expect(() => validateNonNegativeInteger(-1, 'offset')).toThrow(ValidationError);
  });

  it('should throw for non-integers', () => {
    expect(() => validateNonNegativeInteger(1.5, 'offset')).toThrow(ValidationError);
  });

  it('should throw for non-numbers', () => {
    expect(() => validateNonNegativeInteger('0', 'offset')).toThrow(ValidationError);
  });

  it('should include param name in error', () => {
    try {
      validateNonNegativeInteger(-1, 'offset');
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
      expect((e as ValidationError).field).toBe('offset');
    }
  });
});

describe('validateInRange', () => {
  it('should accept values within range', () => {
    expect(() => validateInRange(0, 0, 3, 'priority')).not.toThrow();
    expect(() => validateInRange(1, 0, 3, 'priority')).not.toThrow();
    expect(() => validateInRange(2, 0, 3, 'priority')).not.toThrow();
    expect(() => validateInRange(3, 0, 3, 'priority')).not.toThrow();
  });

  it('should throw for values below range', () => {
    expect(() => validateInRange(-1, 0, 3, 'priority')).toThrow(ValidationError);
  });

  it('should throw for values above range', () => {
    expect(() => validateInRange(4, 0, 3, 'priority')).toThrow(ValidationError);
    expect(() => validateInRange(100, 0, 3, 'priority')).toThrow(ValidationError);
  });

  it('should include range in error message', () => {
    try {
      validateInRange(5, 0, 3, 'priority');
    } catch (e) {
      expect(isValidationError(e)).toBe(true);
      expect((e as ValidationError).message).toContain('0');
      expect((e as ValidationError).message).toContain('3');
    }
  });
});
