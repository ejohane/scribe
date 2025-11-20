import { describe, test, expect } from 'bun:test';
import {
  generateNoteId,
  generateHeadingId,
  generatePersonId,
  generateTagId,
  generateFolderId,
  generateEmbedId,
  generateNodeId,
} from './id-generation';

describe('generateNoteId', () => {
  test('should generate note ID from path', () => {
    expect(generateNoteId('notes/daily/2024-01-01.md')).toBe('note:notes/daily/2024-01-01.md');
  });

  test('should normalize backslashes', () => {
    expect(generateNoteId('notes\\daily\\2024-01-01.md')).toBe('note:notes/daily/2024-01-01.md');
  });

  test('should remove leading slash', () => {
    expect(generateNoteId('/notes/daily/2024-01-01.md')).toBe('note:notes/daily/2024-01-01.md');
  });
});

describe('generateHeadingId', () => {
  test('should generate heading ID from note ID and text', () => {
    const noteId = 'note:notes/meeting.md';
    expect(generateHeadingId(noteId, 'Action Items')).toBe('note:notes/meeting.md#action-items');
  });

  test('should handle special characters', () => {
    const noteId = 'note:notes/meeting.md';
    expect(generateHeadingId(noteId, 'Q&A Session')).toBe('note:notes/meeting.md#qa-session');
  });
});

describe('generatePersonId', () => {
  test('should generate person ID from name', () => {
    expect(generatePersonId('John Doe')).toBe('John Doe');
  });

  test('should trim whitespace', () => {
    expect(generatePersonId('  Jane Smith  ')).toBe('Jane Smith');
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
});

describe('generateFolderId', () => {
  test('should generate folder ID from path', () => {
    expect(generateFolderId('notes/daily')).toBe('notes/daily');
  });

  test('should normalize path', () => {
    expect(generateFolderId('notes\\daily')).toBe('notes/daily');
  });
});

describe('generateEmbedId', () => {
  test('should generate embed ID from note ID and index', () => {
    expect(generateEmbedId('note:notes/test.md', 0)).toBe('embed:note:notes/test.md:0');
  });

  test('should handle multiple embeds', () => {
    expect(generateEmbedId('note:notes/test.md', 5)).toBe('embed:note:notes/test.md:5');
  });
});

describe('generateNodeId', () => {
  test('should generate node ID from entity type and ref ID', () => {
    expect(generateNodeId('note', 'notes/test.md')).toBe('note:notes/test.md');
  });

  test('should handle different entity types', () => {
    expect(generateNodeId('person', 'John Doe')).toBe('person:John Doe');
    expect(generateNodeId('tag', 'javascript')).toBe('tag:javascript');
  });
});
