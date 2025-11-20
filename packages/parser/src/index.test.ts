import { describe, test, expect } from 'bun:test';
import { parseNote } from './index';
import type { RawFile } from '@scribe/domain-model';

describe('parseNote', () => {
  test('should parse a basic note', () => {
    const file: RawFile = {
      path: 'notes/test.md',
      content: 'Hello world',
      lastModified: Date.now(),
    };

    const result = parseNote(file);

    expect(result.id).toBe('note:notes/test.md');
    expect(result.path).toBe('notes/test.md');
    expect(result.fileName).toBe('test.md');
    expect(result.resolvedTitle).toBe('test');
    expect(result.plainText).toBe('Hello world');
  });

  test('should extract file name from path', () => {
    const file: RawFile = {
      path: 'deep/nested/path/document.md',
      content: 'Content',
      lastModified: Date.now(),
    };

    const result = parseNote(file);

    expect(result.fileName).toBe('document.md');
    expect(result.resolvedTitle).toBe('document');
  });

  test('should handle path without extension', () => {
    const file: RawFile = {
      path: 'notes/readme',
      content: 'Content',
      lastModified: Date.now(),
    };

    const result = parseNote(file);

    expect(result.fileName).toBe('readme');
    expect(result.resolvedTitle).toBe('readme');
  });

  test('should initialize empty arrays and objects', () => {
    const file: RawFile = {
      path: 'test.md',
      content: 'Test',
      lastModified: Date.now(),
    };

    const result = parseNote(file);

    expect(result.frontmatter).toEqual({});
    expect(result.inlineTags).toEqual([]);
    expect(result.fmTags).toEqual([]);
    expect(result.allTags).toEqual([]);
    expect(result.aliases).toEqual([]);
    expect(result.headings).toEqual([]);
    expect(result.links).toEqual([]);
    expect(result.embeds).toEqual([]);
    expect(result.peopleMentions).toEqual([]);
  });
});
