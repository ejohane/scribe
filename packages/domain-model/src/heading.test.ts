/**
 * Tests for HeadingRegistry.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { HeadingRegistry } from './heading.js';
import type { NoteId } from './primitives.js';
import type { ParsedHeading } from './heading.js';

describe('HeadingRegistry', () => {
  let registry: HeadingRegistry;

  beforeEach(() => {
    registry = new HeadingRegistry();
  });

  test('should add headings for a note', () => {
    const noteId = 'note:Plan.md' as NoteId;
    const headings: ParsedHeading[] = [
      { level: 1, text: 'Goals & Scope', line: 1 },
      { level: 2, text: 'Technical Overview', line: 10 },
    ];

    registry.addHeadingsForNote(noteId, headings);

    expect(registry.size).toBe(2);
    expect(registry.getHeadingsForNote(noteId)).toHaveLength(2);
  });

  test('should normalize heading text for IDs', () => {
    const noteId = 'note:Plan.md' as NoteId;
    const headings: ParsedHeading[] = [{ level: 1, text: 'Goals & Scope', line: 1 }];

    registry.addHeadingsForNote(noteId, headings);

    const heading = registry.getHeading('note:Plan.md#goals-scope');
    expect(heading).toBeDefined();
    expect(heading!.normalized).toBe('goals-scope');
    expect(heading!.text).toBe('Goals & Scope'); // Original preserved
  });

  test('should maintain heading order', () => {
    const noteId = 'note:Plan.md' as NoteId;
    const headings: ParsedHeading[] = [
      { level: 1, text: 'First', line: 1 },
      { level: 2, text: 'Second', line: 5 },
      { level: 2, text: 'Third', line: 10 },
    ];

    registry.addHeadingsForNote(noteId, headings);

    const headingIds = registry.getHeadingsForNote(noteId);
    expect(headingIds).toEqual(['note:Plan.md#first', 'note:Plan.md#second', 'note:Plan.md#third']);
  });

  test('should update headings for a note', () => {
    const noteId = 'note:Plan.md' as NoteId;

    const oldHeadings: ParsedHeading[] = [{ level: 1, text: 'Old Heading', line: 1 }];
    registry.addHeadingsForNote(noteId, oldHeadings);

    const newHeadings: ParsedHeading[] = [
      { level: 1, text: 'New Heading', line: 1 },
      { level: 2, text: 'Another', line: 5 },
    ];
    registry.updateHeadingsForNote(noteId, newHeadings);

    expect(registry.size).toBe(2);
    expect(registry.getHeading('note:Plan.md#old-heading')).toBeUndefined();
    expect(registry.getHeading('note:Plan.md#new-heading')).toBeDefined();
    expect(registry.getHeading('note:Plan.md#another')).toBeDefined();
  });

  test('should remove headings for a note', () => {
    const noteId = 'note:Plan.md' as NoteId;
    const headings: ParsedHeading[] = [{ level: 1, text: 'Heading', line: 1 }];

    registry.addHeadingsForNote(noteId, headings);
    expect(registry.size).toBe(1);

    registry.removeHeadingsForNote(noteId);
    expect(registry.size).toBe(0);
    expect(registry.getHeadingsForNote(noteId)).toEqual([]);
  });

  test('should find heading by normalized text', () => {
    const noteId = 'note:Plan.md' as NoteId;
    const headings: ParsedHeading[] = [{ level: 1, text: 'Goals & Scope', line: 1 }];

    registry.addHeadingsForNote(noteId, headings);

    const heading = registry.findHeadingByNormalized(noteId, 'goals-scope');
    expect(heading).toBeDefined();
    expect(heading!.text).toBe('Goals & Scope');
  });

  test('should store heading properties correctly', () => {
    const noteId = 'note:Plan.md' as NoteId;
    const headings: ParsedHeading[] = [{ level: 2, text: 'Technical Overview', line: 42 }];

    registry.addHeadingsForNote(noteId, headings);

    const heading = registry.getHeading('note:Plan.md#technical-overview');
    expect(heading).toBeDefined();
    expect(heading!.noteId).toBe(noteId);
    expect(heading!.level).toBe(2);
    expect(heading!.text).toBe('Technical Overview');
    expect(heading!.normalized).toBe('technical-overview');
    expect(heading!.line).toBe(42);
  });

  test('should handle multiple notes with same heading text', () => {
    const note1 = 'note:Plan1.md' as NoteId;
    const note2 = 'note:Plan2.md' as NoteId;

    const headings: ParsedHeading[] = [{ level: 1, text: 'Introduction', line: 1 }];

    registry.addHeadingsForNote(note1, headings);
    registry.addHeadingsForNote(note2, headings);

    expect(registry.size).toBe(2);
    expect(registry.getHeading('note:Plan1.md#introduction')).toBeDefined();
    expect(registry.getHeading('note:Plan2.md#introduction')).toBeDefined();
  });

  test('should get all headings', () => {
    const note1 = 'note:Plan1.md' as NoteId;
    const note2 = 'note:Plan2.md' as NoteId;

    registry.addHeadingsForNote(note1, [{ level: 1, text: 'H1', line: 1 }]);
    registry.addHeadingsForNote(note2, [{ level: 1, text: 'H2', line: 1 }]);

    const allHeadings = registry.getAllHeadings();
    expect(allHeadings).toHaveLength(2);
  });

  test('should clear all headings', () => {
    const noteId = 'note:Plan.md' as NoteId;
    registry.addHeadingsForNote(noteId, [{ level: 1, text: 'Heading', line: 1 }]);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAllHeadings()).toHaveLength(0);
  });
});
