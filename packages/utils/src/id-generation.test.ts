import { describe, test, expect } from 'bun:test';
import {
  generateNoteId,
  generateHeadingId,
  generatePersonId,
  generateTagId,
  generateFolderId,
  generateEmbedId,
  generateNodeId,
  parseNodeId,
  parseHeadingId,
} from './id-generation';

describe('generateNoteId', () => {
  test('should generate note ID from path', () => {
    expect(generateNoteId('notes/daily/2024-01-01.md')).toBe('notes/daily/2024-01-01.md');
  });

  test('should normalize backslashes', () => {
    expect(generateNoteId('notes\\daily\\2024-01-01.md')).toBe('notes/daily/2024-01-01.md');
  });

  test('should remove leading slash', () => {
    expect(generateNoteId('/notes/daily/2024-01-01.md')).toBe('notes/daily/2024-01-01.md');
  });

  test('should remove trailing slash', () => {
    expect(generateNoteId('notes/daily/2024-01-01.md/')).toBe('notes/daily/2024-01-01.md');
  });

  test('should handle people notes', () => {
    expect(generateNoteId('people/Erik.md')).toBe('people/Erik.md');
  });

  test('should be deterministic', () => {
    const path = 'notes/test.md';
    expect(generateNoteId(path)).toBe(generateNoteId(path));
  });
});

describe('generateHeadingId', () => {
  test('should generate heading ID from note ID and text', () => {
    const noteId = 'notes/meeting.md';
    expect(generateHeadingId(noteId, 'Action Items')).toBe('notes/meeting.md#action-items');
  });

  test('should handle special characters', () => {
    const noteId = 'notes/meeting.md';
    expect(generateHeadingId(noteId, 'Q&A Session')).toBe('notes/meeting.md#qa-session');
  });

  test('should handle complex headings', () => {
    const noteId = 'notes/plan.md';
    expect(generateHeadingId(noteId, 'Goals & Scope (2025)')).toBe('notes/plan.md#goals-scope-2025');
  });

  test('should handle multiple spaces', () => {
    const noteId = 'notes/test.md';
    expect(generateHeadingId(noteId, 'Multiple   Spaces')).toBe('notes/test.md#multiple-spaces');
  });

  test('should preserve underscores', () => {
    const noteId = 'notes/test.md';
    expect(generateHeadingId(noteId, 'some_heading')).toBe('notes/test.md#some_heading');
  });
});

describe('generatePersonId', () => {
  test('should generate person ID from name', () => {
    expect(generatePersonId('John Doe')).toBe('John Doe');
  });

  test('should trim whitespace', () => {
    expect(generatePersonId('  Jane Smith  ')).toBe('Jane Smith');
  });

  test('should preserve case', () => {
    expect(generatePersonId('Erik')).toBe('Erik');
  });

  test('should handle single-word names', () => {
    expect(generatePersonId('Alice')).toBe('Alice');
  });
});

describe('generateTagId', () => {
  test('should generate tag ID from name', () => {
    expect(generateTagId('javascript')).toBe('javascript');
  });

  test('should convert to lowercase', () => {
    expect(generateTagId('JavaScript')).toBe('javascript');
  });

  test('should remove leading hash', () => {
    expect(generateTagId('#javascript')).toBe('javascript');
  });

  test('should remove multiple leading hashes', () => {
    expect(generateTagId('##planning')).toBe('planning');
  });

  test('should trim whitespace', () => {
    expect(generateTagId('  planning  ')).toBe('planning');
  });

  test('should be deterministic', () => {
    expect(generateTagId('#Planning')).toBe(generateTagId('planning'));
  });
});

describe('generateFolderId', () => {
  test('should generate folder ID from path', () => {
    expect(generateFolderId('notes/daily')).toBe('notes/daily');
  });

  test('should normalize path', () => {
    expect(generateFolderId('notes\\daily')).toBe('notes/daily');
  });

  test('should handle root folders', () => {
    expect(generateFolderId('people')).toBe('people');
  });

  test('should remove trailing slashes', () => {
    expect(generateFolderId('notes/2025/')).toBe('notes/2025');
  });
});

describe('generateEmbedId', () => {
  test('should generate embed ID from note ID and index', () => {
    expect(generateEmbedId('notes/test.md', 0)).toBe('embed:notes/test.md:0');
  });

  test('should handle multiple embeds', () => {
    expect(generateEmbedId('notes/test.md', 5)).toBe('embed:notes/test.md:5');
  });

  test('should handle people notes', () => {
    expect(generateEmbedId('people/Erik.md', 0)).toBe('embed:people/Erik.md:0');
  });
});

describe('generateNodeId', () => {
  test('should generate node ID from entity type and ref ID', () => {
    expect(generateNodeId('note', 'notes/test.md')).toBe('note:notes/test.md');
  });

  test('should handle different entity types', () => {
    expect(generateNodeId('person', 'John Doe')).toBe('person:John Doe');
    expect(generateNodeId('tag', 'javascript')).toBe('tag:javascript');
    expect(generateNodeId('folder', 'notes/2025')).toBe('folder:notes/2025');
    expect(generateNodeId('heading', 'notes/test.md#intro')).toBe('heading:notes/test.md#intro');
  });
});

describe('parseNodeId', () => {
  test('should parse note node ID', () => {
    const result = parseNodeId('note:notes/test.md');
    expect(result).toEqual({
      entityType: 'note',
      refId: 'notes/test.md',
    });
  });

  test('should parse person node ID', () => {
    const result = parseNodeId('person:Erik');
    expect(result).toEqual({
      entityType: 'person',
      refId: 'Erik',
    });
  });

  test('should parse tag node ID', () => {
    const result = parseNodeId('tag:planning');
    expect(result).toEqual({
      entityType: 'tag',
      refId: 'planning',
    });
  });

  test('should parse heading node ID', () => {
    const result = parseNodeId('heading:notes/test.md#intro');
    expect(result).toEqual({
      entityType: 'heading',
      refId: 'notes/test.md#intro',
    });
  });

  test('should handle colons in refId', () => {
    const result = parseNodeId('embed:notes/test.md:0');
    expect(result).toEqual({
      entityType: 'embed',
      refId: 'notes/test.md:0',
    });
  });

  test('should return null for invalid node ID', () => {
    expect(parseNodeId('invalid')).toBeNull();
    expect(parseNodeId('')).toBeNull();
  });
});

describe('parseHeadingId', () => {
  test('should parse heading ID', () => {
    const result = parseHeadingId('notes/test.md#introduction');
    expect(result).toEqual({
      noteId: 'notes/test.md',
      headingAnchor: 'introduction',
    });
  });

  test('should handle complex heading anchors', () => {
    const result = parseHeadingId('notes/plan.md#goals-and-scope');
    expect(result).toEqual({
      noteId: 'notes/plan.md',
      headingAnchor: 'goals-and-scope',
    });
  });

  test('should handle multiple hashes', () => {
    const result = parseHeadingId('notes/test.md#heading-with-#-char');
    expect(result).toEqual({
      noteId: 'notes/test.md',
      headingAnchor: 'heading-with-#-char',
    });
  });

  test('should return null for invalid heading ID', () => {
    expect(parseHeadingId('notes/test.md')).toBeNull();
    expect(parseHeadingId('')).toBeNull();
  });
});
