import { describe, test, expect } from 'bun:test';
import {
  normalizeText,
  normalizeHeading,
  normalizeTag,
  normalizePath,
  normalizePersonName,
} from './normalize';

describe('normalizeText', () => {
  test('should convert to lowercase', () => {
    expect(normalizeText('Hello World')).toBe('hello world');
  });

  test('should trim whitespace', () => {
    expect(normalizeText('  hello  ')).toBe('hello');
  });

  test('should collapse multiple spaces', () => {
    expect(normalizeText('hello    world')).toBe('hello world');
  });

  test('should handle empty string', () => {
    expect(normalizeText('')).toBe('');
  });
});

describe('normalizeHeading', () => {
  test('should convert to lowercase and replace spaces with hyphens', () => {
    expect(normalizeHeading('Hello World')).toBe('hello-world');
  });

  test('should remove special characters', () => {
    expect(normalizeHeading('Hello, World!')).toBe('hello-world');
  });

  test('should collapse multiple hyphens', () => {
    expect(normalizeHeading('Hello --- World')).toBe('hello-world');
  });

  test('should remove leading and trailing hyphens', () => {
    expect(normalizeHeading('-Hello-')).toBe('hello');
  });

  test('should handle unicode characters', () => {
    expect(normalizeHeading('Café & Restaurant')).toBe('caf-restaurant');
  });
});

describe('normalizeTag', () => {
  test('should convert to lowercase', () => {
    expect(normalizeTag('JavaScript')).toBe('javascript');
  });

  test('should remove leading hash', () => {
    expect(normalizeTag('#javascript')).toBe('javascript');
  });

  test('should trim whitespace', () => {
    expect(normalizeTag('  javascript  ')).toBe('javascript');
  });
});

describe('normalizePath', () => {
  test('should convert backslashes to forward slashes', () => {
    expect(normalizePath('path\\to\\file.md')).toBe('path/to/file.md');
  });

  test('should remove leading slash', () => {
    expect(normalizePath('/path/to/file.md')).toBe('path/to/file.md');
  });

  test('should remove trailing slash', () => {
    expect(normalizePath('path/to/file.md/')).toBe('path/to/file.md');
  });

  test('should handle empty string', () => {
    expect(normalizePath('')).toBe('');
  });
});

describe('normalizePersonName', () => {
  test('should trim whitespace', () => {
    expect(normalizePersonName('  John Doe  ')).toBe('John Doe');
  });

  test('should preserve case', () => {
    expect(normalizePersonName('John Doe')).toBe('John Doe');
  });
});
