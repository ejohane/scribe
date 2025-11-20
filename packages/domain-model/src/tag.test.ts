/**
 * Tests for TagRegistry.
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { TagRegistry } from './tag.js';
import type { NoteId } from './primitives.js';

describe('TagRegistry', () => {
  let registry: TagRegistry;

  beforeEach(() => {
    registry = new TagRegistry();
  });

  test('should add tags for a note', () => {
    const noteId = 'note:test.md' as NoteId;
    const tagNames = ['#Planning', '#urgent'];

    registry.addTagsForNote(noteId, tagNames);

    expect(registry.size).toBe(2);
    expect(registry.getTag('planning')).toBeDefined();
    expect(registry.getTag('urgent')).toBeDefined();
    expect(registry.getTagsForNote(noteId)).toEqual(new Set(['planning', 'urgent']));
  });

  test('should normalize tag names', () => {
    const noteId = 'note:test.md' as NoteId;
    registry.addTagsForNote(noteId, ['#Planning', 'PLANNING', '  planning  ']);

    // All should normalize to 'planning'
    expect(registry.size).toBe(1);
    const tag = registry.getTag('planning');
    expect(tag).toBeDefined();
    expect(tag!.usageCount).toBe(3);
  });

  test('should track usage count', () => {
    const note1 = 'note:note1.md' as NoteId;
    const note2 = 'note:note2.md' as NoteId;

    registry.addTagsForNote(note1, ['#planning']);
    registry.addTagsForNote(note2, ['#planning']);

    const tag = registry.getTag('planning');
    expect(tag!.usageCount).toBe(2);
  });

  test('should update tags for a note', () => {
    const noteId = 'note:test.md' as NoteId;

    registry.addTagsForNote(noteId, ['#planning', '#urgent']);
    expect(registry.size).toBe(2);

    registry.updateTagsForNote(noteId, ['#planning', '#research']);

    expect(registry.size).toBe(2);
    expect(registry.getTag('planning')).toBeDefined();
    expect(registry.getTag('research')).toBeDefined();
    expect(registry.getTag('urgent')).toBeUndefined();
  });

  test('should remove tags when note is removed', () => {
    const noteId = 'note:test.md' as NoteId;

    registry.addTagsForNote(noteId, ['#planning', '#urgent']);
    expect(registry.size).toBe(2);

    registry.removeTagsForNote(noteId);

    expect(registry.size).toBe(0);
    expect(registry.getTagsForNote(noteId)).toEqual(new Set());
  });

  test('should maintain bidirectional mappings', () => {
    const note1 = 'note:note1.md' as NoteId;
    const note2 = 'note:note2.md' as NoteId;

    registry.addTagsForNote(note1, ['#planning', '#urgent']);
    registry.addTagsForNote(note2, ['#planning']);

    // Check notesByTag
    expect(registry.getNotesForTag('planning')).toEqual(new Set([note1, note2]));
    expect(registry.getNotesForTag('urgent')).toEqual(new Set([note1]));

    // Check tagsByNote
    expect(registry.getTagsForNote(note1)).toEqual(new Set(['planning', 'urgent']));
    expect(registry.getTagsForNote(note2)).toEqual(new Set(['planning']));
  });

  test('should clean up tags with zero usage', () => {
    const note1 = 'note:note1.md' as NoteId;
    const note2 = 'note:note2.md' as NoteId;

    registry.addTagsForNote(note1, ['#planning']);
    registry.addTagsForNote(note2, ['#planning']);

    expect(registry.getTag('planning')!.usageCount).toBe(2);

    registry.removeTagsForNote(note1);
    expect(registry.getTag('planning')!.usageCount).toBe(1);

    registry.removeTagsForNote(note2);
    expect(registry.getTag('planning')).toBeUndefined();
    expect(registry.size).toBe(0);
  });

  test('should get all tags sorted by usage', () => {
    const note1 = 'note:note1.md' as NoteId;
    const note2 = 'note:note2.md' as NoteId;
    const note3 = 'note:note3.md' as NoteId;

    registry.addTagsForNote(note1, ['#planning', '#urgent']);
    registry.addTagsForNote(note2, ['#planning', '#research']);
    registry.addTagsForNote(note3, ['#planning']);

    const allTags = registry.getAllTags();
    expect(allTags).toHaveLength(3);
    expect(allTags[0].id).toBe('planning'); // usage: 3
    expect(allTags[0].usageCount).toBe(3);
  });

  test('should preserve original tag casing in name field', () => {
    const noteId = 'note:test.md' as NoteId;
    registry.addTagsForNote(noteId, ['#Planning']);

    const tag = registry.getTag('planning');
    expect(tag!.name).toBe('#Planning'); // Original casing preserved
  });

  test('should clear all tags', () => {
    const noteId = 'note:test.md' as NoteId;
    registry.addTagsForNote(noteId, ['#planning', '#urgent']);

    registry.clear();

    expect(registry.size).toBe(0);
    expect(registry.getAllTags()).toHaveLength(0);
  });
});
