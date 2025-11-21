/**
 * Tests for NoteRegistry
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { NoteRegistry } from './registry.js';
import type { ParsedNote } from './note.js';
import type { NoteId, FilePath } from './primitives.js';

describe('NoteRegistry', () => {
  let registry: NoteRegistry;

  // Helper to create test notes
  function createNote(
    id: NoteId,
    path: FilePath,
    title: string,
    aliases: string[] = []
  ): ParsedNote {
    return {
      id,
      path,
      fileName: path.split('/').pop() || '',
      resolvedTitle: title,
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases,
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: '',
    };
  }

  beforeEach(() => {
    registry = new NoteRegistry();
  });

  describe('add()', () => {
    it('should add a note to the registry', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);

      expect(registry.size).toBe(1);
      expect(registry.getNoteById('notes/plan' as NoteId)).toBe(note);
    });

    it('should add note to path index', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);

      expect(registry.getNoteByPath('notes/Plan.md' as FilePath)).toBe(note);
    });

    it('should add note to title index', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'My Plan');
      registry.add(note);

      const matches = registry.getNotesByTitle('My Plan');
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(note);
    });

    it('should add note to alias index', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'Planning',
        'ToDo',
      ]);
      registry.add(note);

      const planningMatches = registry.getNotesByAlias('Planning');
      expect(planningMatches).toHaveLength(1);
      expect(planningMatches[0]).toBe(note);

      const todoMatches = registry.getNotesByAlias('ToDo');
      expect(todoMatches).toHaveLength(1);
      expect(todoMatches[0]).toBe(note);
    });

    it('should support case-insensitive title lookups', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'My Plan');
      registry.add(note);

      expect(registry.getNotesByTitle('my plan')).toHaveLength(1);
      expect(registry.getNotesByTitle('MY PLAN')).toHaveLength(1);
      expect(registry.getNotesByTitle('My Plan')).toHaveLength(1);
    });

    it('should support case-insensitive alias lookups', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'Planning',
      ]);
      registry.add(note);

      expect(registry.getNotesByAlias('planning')).toHaveLength(1);
      expect(registry.getNotesByAlias('PLANNING')).toHaveLength(1);
      expect(registry.getNotesByAlias('Planning')).toHaveLength(1);
    });

    it('should handle multiple notes with same title', () => {
      const note1 = createNote('notes/plan-a' as NoteId, 'notes/PlanA.md' as FilePath, 'Plan');
      const note2 = createNote('notes/plan-b' as NoteId, 'notes/PlanB.md' as FilePath, 'Plan');
      registry.add(note1);
      registry.add(note2);

      const matches = registry.getNotesByTitle('Plan');
      expect(matches).toHaveLength(2);
      expect(matches).toContain(note1);
      expect(matches).toContain(note2);
    });

    it('should handle multiple notes with same alias', () => {
      const note1 = createNote('notes/plan-a' as NoteId, 'notes/PlanA.md' as FilePath, 'Plan A', [
        'Work',
      ]);
      const note2 = createNote('notes/plan-b' as NoteId, 'notes/PlanB.md' as FilePath, 'Plan B', [
        'Work',
      ]);
      registry.add(note1);
      registry.add(note2);

      const matches = registry.getNotesByAlias('Work');
      expect(matches).toHaveLength(2);
      expect(matches).toContain(note1);
      expect(matches).toContain(note2);
    });

    it('should throw if note ID already exists', () => {
      const note1 = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      const note2 = createNote('notes/plan' as NoteId, 'notes/Other.md' as FilePath, 'Other');
      registry.add(note1);

      expect(() => registry.add(note2)).toThrow('already exists');
    });

    it('should throw if note path already exists', () => {
      const note1 = createNote('notes/plan-a' as NoteId, 'notes/Plan.md' as FilePath, 'Plan A');
      const note2 = createNote('notes/plan-b' as NoteId, 'notes/Plan.md' as FilePath, 'Plan B');
      registry.add(note1);

      expect(() => registry.add(note2)).toThrow('already exists');
    });

    it('should normalize whitespace in titles', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'My   Plan');
      registry.add(note);

      expect(registry.getNotesByTitle('My Plan')).toHaveLength(1);
      expect(registry.getNotesByTitle('My   Plan')).toHaveLength(1);
    });

    it('should normalize whitespace in aliases', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'My   Planning',
      ]);
      registry.add(note);

      expect(registry.getNotesByAlias('My Planning')).toHaveLength(1);
      expect(registry.getNotesByAlias('My   Planning')).toHaveLength(1);
    });
  });

  describe('update()', () => {
    it('should update a note in the registry', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);

      const updatedNote = { ...note, resolvedTitle: 'Updated Plan' };
      registry.update(updatedNote);

      expect(registry.getNoteById('notes/plan' as NoteId)?.resolvedTitle).toBe('Updated Plan');
    });

    it('should update title index when title changes', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Old Title');
      registry.add(note);

      const updatedNote = { ...note, resolvedTitle: 'New Title' };
      registry.update(updatedNote);

      expect(registry.getNotesByTitle('Old Title')).toHaveLength(0);
      expect(registry.getNotesByTitle('New Title')).toHaveLength(1);
    });

    it('should update alias index when aliases change', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'Old Alias',
      ]);
      registry.add(note);

      const updatedNote = { ...note, aliases: ['New Alias'] };
      registry.update(updatedNote);

      expect(registry.getNotesByAlias('Old Alias')).toHaveLength(0);
      expect(registry.getNotesByAlias('New Alias')).toHaveLength(1);
    });

    it('should update path index when path changes', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);

      const updatedNote = { ...note, path: 'notes/NewPlan.md' as FilePath };
      registry.update(updatedNote);

      expect(registry.getNoteByPath('notes/Plan.md' as FilePath)).toBeUndefined();
      expect(registry.getNoteByPath('notes/NewPlan.md' as FilePath)).toBe(updatedNote);
    });

    it('should handle adding new aliases', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', []);
      registry.add(note);

      const updatedNote = { ...note, aliases: ['New Alias'] };
      registry.update(updatedNote);

      expect(registry.getNotesByAlias('New Alias')).toHaveLength(1);
    });

    it('should handle removing all aliases', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'Old Alias',
      ]);
      registry.add(note);

      const updatedNote = { ...note, aliases: [] };
      registry.update(updatedNote);

      expect(registry.getNotesByAlias('Old Alias')).toHaveLength(0);
    });

    it('should throw if note does not exist', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      expect(() => registry.update(note)).toThrow('not found');
    });

    it('should clean up empty title sets', () => {
      const note1 = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Shared');
      const note2 = createNote('notes/other' as NoteId, 'notes/Other.md' as FilePath, 'Other');
      registry.add(note1);
      registry.add(note2);

      // Update note1 to have a different title
      const updatedNote1 = { ...note1, resolvedTitle: 'Different' };
      registry.update(updatedNote1);

      // The "Shared" title should be removed from the index
      expect(registry.getNotesByTitle('Shared')).toHaveLength(0);
    });

    it('should clean up empty alias sets', () => {
      const note1 = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'Shared',
      ]);
      const note2 = createNote('notes/other' as NoteId, 'notes/Other.md' as FilePath, 'Other', []);
      registry.add(note1);
      registry.add(note2);

      // Remove the alias from note1
      const updatedNote1 = { ...note1, aliases: [] };
      registry.update(updatedNote1);

      // The "Shared" alias should be removed from the index
      expect(registry.getNotesByAlias('Shared')).toHaveLength(0);
    });
  });

  describe('remove()', () => {
    it('should remove a note from the registry', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);
      registry.remove('notes/plan' as NoteId);

      expect(registry.size).toBe(0);
      expect(registry.getNoteById('notes/plan' as NoteId)).toBeUndefined();
    });

    it('should remove note from path index', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);
      registry.remove('notes/plan' as NoteId);

      expect(registry.getNoteByPath('notes/Plan.md' as FilePath)).toBeUndefined();
    });

    it('should remove note from title index', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);
      registry.remove('notes/plan' as NoteId);

      expect(registry.getNotesByTitle('Plan')).toHaveLength(0);
    });

    it('should remove note from alias index', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'Planning',
      ]);
      registry.add(note);
      registry.remove('notes/plan' as NoteId);

      expect(registry.getNotesByAlias('Planning')).toHaveLength(0);
    });

    it('should not affect other notes with same title', () => {
      const note1 = createNote('notes/plan-a' as NoteId, 'notes/PlanA.md' as FilePath, 'Plan');
      const note2 = createNote('notes/plan-b' as NoteId, 'notes/PlanB.md' as FilePath, 'Plan');
      registry.add(note1);
      registry.add(note2);

      registry.remove('notes/plan-a' as NoteId);

      const matches = registry.getNotesByTitle('Plan');
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(note2);
    });

    it('should not affect other notes with same alias', () => {
      const note1 = createNote('notes/plan-a' as NoteId, 'notes/PlanA.md' as FilePath, 'Plan A', [
        'Work',
      ]);
      const note2 = createNote('notes/plan-b' as NoteId, 'notes/PlanB.md' as FilePath, 'Plan B', [
        'Work',
      ]);
      registry.add(note1);
      registry.add(note2);

      registry.remove('notes/plan-a' as NoteId);

      const matches = registry.getNotesByAlias('Work');
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(note2);
    });

    it('should throw if note does not exist', () => {
      expect(() => registry.remove('notes/plan' as NoteId)).toThrow('not found');
    });
  });

  describe('getNoteById()', () => {
    it('should return note by ID', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);

      expect(registry.getNoteById('notes/plan' as NoteId)).toBe(note);
    });

    it('should return undefined for non-existent ID', () => {
      expect(registry.getNoteById('notes/missing' as NoteId)).toBeUndefined();
    });
  });

  describe('getNoteByPath()', () => {
    it('should return note by path', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      registry.add(note);

      expect(registry.getNoteByPath('notes/Plan.md' as FilePath)).toBe(note);
    });

    it('should return undefined for non-existent path', () => {
      expect(registry.getNoteByPath('notes/Missing.md' as FilePath)).toBeUndefined();
    });
  });

  describe('getNotesByTitle()', () => {
    it('should return notes by title', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'My Plan');
      registry.add(note);

      const matches = registry.getNotesByTitle('My Plan');
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(note);
    });

    it('should return empty array for non-existent title', () => {
      expect(registry.getNotesByTitle('Missing')).toEqual([]);
    });

    it('should return all notes with matching title', () => {
      const note1 = createNote('notes/plan-a' as NoteId, 'notes/PlanA.md' as FilePath, 'Plan');
      const note2 = createNote('notes/plan-b' as NoteId, 'notes/PlanB.md' as FilePath, 'Plan');
      registry.add(note1);
      registry.add(note2);

      const matches = registry.getNotesByTitle('Plan');
      expect(matches).toHaveLength(2);
    });
  });

  describe('getNotesByAlias()', () => {
    it('should return notes by alias', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'Planning',
      ]);
      registry.add(note);

      const matches = registry.getNotesByAlias('Planning');
      expect(matches).toHaveLength(1);
      expect(matches[0]).toBe(note);
    });

    it('should return empty array for non-existent alias', () => {
      expect(registry.getNotesByAlias('Missing')).toEqual([]);
    });

    it('should return all notes with matching alias', () => {
      const note1 = createNote('notes/plan-a' as NoteId, 'notes/PlanA.md' as FilePath, 'Plan A', [
        'Work',
      ]);
      const note2 = createNote('notes/plan-b' as NoteId, 'notes/PlanB.md' as FilePath, 'Plan B', [
        'Work',
      ]);
      registry.add(note1);
      registry.add(note2);

      const matches = registry.getNotesByAlias('Work');
      expect(matches).toHaveLength(2);
    });
  });

  describe('getAllNotes()', () => {
    it('should return all notes', () => {
      const note1 = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan');
      const note2 = createNote('notes/other' as NoteId, 'notes/Other.md' as FilePath, 'Other');
      registry.add(note1);
      registry.add(note2);

      const all = registry.getAllNotes();
      expect(all).toHaveLength(2);
      expect(all).toContain(note1);
      expect(all).toContain(note2);
    });

    it('should return empty array when registry is empty', () => {
      expect(registry.getAllNotes()).toEqual([]);
    });
  });

  describe('size', () => {
    it('should return the number of notes', () => {
      expect(registry.size).toBe(0);

      registry.add(createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan'));
      expect(registry.size).toBe(1);

      registry.add(createNote('notes/other' as NoteId, 'notes/Other.md' as FilePath, 'Other'));
      expect(registry.size).toBe(2);
    });
  });

  describe('clear()', () => {
    it('should clear all notes', () => {
      registry.add(createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan'));
      registry.add(createNote('notes/other' as NoteId, 'notes/Other.md' as FilePath, 'Other'));

      registry.clear();

      expect(registry.size).toBe(0);
      expect(registry.getAllNotes()).toEqual([]);
      expect(registry.byTitle.size).toBe(0);
      expect(registry.byAlias.size).toBe(0);
      expect(registry.byPath.size).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle notes with no aliases', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', []);
      registry.add(note);

      expect(registry.size).toBe(1);
      expect(registry.getNotesByAlias('anything')).toHaveLength(0);
    });

    it('should handle empty title gracefully', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, '');
      registry.add(note);

      expect(registry.getNotesByTitle('')).toHaveLength(1);
    });

    it('should handle special characters in titles', () => {
      const note = createNote(
        'notes/plan' as NoteId,
        'notes/Plan.md' as FilePath,
        'Plan: 2025 (Q1)'
      );
      registry.add(note);

      expect(registry.getNotesByTitle('Plan: 2025 (Q1)')).toHaveLength(1);
    });

    it('should handle special characters in aliases', () => {
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', [
        'Q1-2025',
      ]);
      registry.add(note);

      expect(registry.getNotesByAlias('Q1-2025')).toHaveLength(1);
    });

    it('should handle very long titles', () => {
      const longTitle = 'A'.repeat(1000);
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, longTitle);
      registry.add(note);

      expect(registry.getNotesByTitle(longTitle)).toHaveLength(1);
    });

    it('should handle many aliases on a single note', () => {
      const aliases = Array.from({ length: 100 }, (_, i) => `Alias${i}`);
      const note = createNote('notes/plan' as NoteId, 'notes/Plan.md' as FilePath, 'Plan', aliases);
      registry.add(note);

      expect(registry.getNotesByAlias('Alias0')).toHaveLength(1);
      expect(registry.getNotesByAlias('Alias99')).toHaveLength(1);
    });
  });
});
