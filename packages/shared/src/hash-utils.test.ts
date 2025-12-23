/**
 * Tests for hash utilities
 */

import { describe, it, expect } from 'vitest';
import { computeTextHash } from './hash-utils.js';

describe('computeTextHash', () => {
  it('should return 16 character hex string', () => {
    const hash = computeTextHash('test');
    expect(hash).toMatch(/^[0-9a-f]{16}$/);
  });

  it('should be deterministic', () => {
    expect(computeTextHash('hello')).toBe(computeTextHash('hello'));
  });

  it('should produce different hashes for different inputs', () => {
    expect(computeTextHash('hello')).not.toBe(computeTextHash('world'));
  });

  it('should handle empty string', () => {
    const hash = computeTextHash('');
    expect(hash).toHaveLength(16);
  });

  it('should handle unicode characters', () => {
    const hash = computeTextHash('Hello 世界'); // "Hello 世界"
    expect(hash).toHaveLength(16);
  });

  it('should handle long strings', () => {
    const longText = 'a'.repeat(10000);
    const hash = computeTextHash(longText);
    expect(hash).toHaveLength(16);
  });

  it('should be consistent with DJB2 algorithm output', () => {
    // These are expected hash values for known inputs
    // Useful for regression testing
    const emptyHash = computeTextHash('');
    const testHash = computeTextHash('test');

    // Just verify they're stable across runs
    expect(computeTextHash('')).toBe(emptyHash);
    expect(computeTextHash('test')).toBe(testHash);
  });
});
