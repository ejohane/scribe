import { describe, test, expect } from 'bun:test';
import {
  normalizeText,
  normalizeHeading,
  normalizeTag,
  normalizePath,
  normalizePersonName,
  normalizeFolderPath,
  normalizeTitle,
  normalizeTitleForLookup,
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

  test('should handle tabs and newlines', () => {
    expect(normalizeText('hello\t\n world')).toBe('hello world');
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

  test('should handle complex headings', () => {
    expect(normalizeHeading('Goals & Scope (2025)')).toBe('goals-scope-2025');
  });

  test('should preserve underscores', () => {
    expect(normalizeHeading('some_heading_with_underscores')).toBe('some_heading_with_underscores');
  });

  test('should handle empty string', () => {
    expect(normalizeHeading('')).toBe('');
  });

  test('should handle multiple spaces', () => {
    expect(normalizeHeading('Multiple   Spaces   Here')).toBe('multiple-spaces-here');
  });
});

describe('normalizeTag', () => {
  test('should convert to lowercase', () => {
    expect(normalizeTag('JavaScript')).toBe('javascript');
  });

  test('should remove leading hash', () => {
    expect(normalizeTag('#javascript')).toBe('javascript');
  });

  test('should remove multiple leading hashes', () => {
    expect(normalizeTag('##javascript')).toBe('javascript');
  });

  test('should trim whitespace', () => {
    expect(normalizeTag('  javascript  ')).toBe('javascript');
  });

  test('should handle tag with hash and whitespace', () => {
    expect(normalizeTag('  #Planning  ')).toBe('planning');
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

  test('should handle mixed slashes', () => {
    expect(normalizePath('path\\to/file.md')).toBe('path/to/file.md');
  });

  test('should handle empty string', () => {
    expect(normalizePath('')).toBe('');
  });

  test('should handle just slashes', () => {
    expect(normalizePath('/')).toBe('');
  });
});

describe('normalizePersonName', () => {
  test('should trim whitespace', () => {
    expect(normalizePersonName('  John Doe  ')).toBe('John Doe');
  });

  test('should preserve case', () => {
    expect(normalizePersonName('John Doe')).toBe('John Doe');
  });

  test('should handle single name', () => {
    expect(normalizePersonName('Erik')).toBe('Erik');
  });

  test('should handle empty string', () => {
    expect(normalizePersonName('')).toBe('');
  });
});

describe('normalizeFolderPath', () => {
  test('should normalize folder path', () => {
    expect(normalizeFolderPath('notes/2025')).toBe('notes/2025');
  });

  test('should handle backslashes', () => {
    expect(normalizeFolderPath('notes\\2025')).toBe('notes/2025');
  });

  test('should remove trailing slashes', () => {
    expect(normalizeFolderPath('notes/2025/')).toBe('notes/2025');
  });

  test('should handle root folder', () => {
    expect(normalizeFolderPath('people')).toBe('people');
  });
});

describe('normalizeTitle', () => {
  test('should preserve case', () => {
    expect(normalizeTitle('My Note')).toBe('My Note');
  });

  test('should trim whitespace', () => {
    expect(normalizeTitle('  My Note  ')).toBe('My Note');
  });

  test('should collapse multiple spaces', () => {
    expect(normalizeTitle('My   Note')).toBe('My Note');
  });

  test('should handle empty string', () => {
    expect(normalizeTitle('')).toBe('');
  });

  test('should handle tabs and newlines', () => {
    expect(normalizeTitle('My\t\nNote')).toBe('My Note');
  });
});

describe('normalizeTitleForLookup', () => {
  test('should convert to lowercase', () => {
    expect(normalizeTitleForLookup('My Note')).toBe('my note');
  });

  test('should trim whitespace', () => {
    expect(normalizeTitleForLookup('  My Note  ')).toBe('my note');
  });

  test('should collapse spaces', () => {
    expect(normalizeTitleForLookup('My   Note')).toBe('my note');
  });

  test('should handle case-insensitive matching', () => {
    expect(normalizeTitleForLookup('My Note')).toBe(normalizeTitleForLookup('my note'));
    expect(normalizeTitleForLookup('My Note')).toBe(normalizeTitleForLookup('MY NOTE'));
  });
});
