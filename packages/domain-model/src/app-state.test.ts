/**
 * Tests for AppState aggregation and read APIs.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import {
  createAppState,
  clearAppState,
  getAppStateStats,
  validateAppState,
  asReadOnly,
  AppStateQueries,
  type AppState,
} from './app-state.js';
import type { ParsedNote } from './note.js';
import type { NoteId } from './primitives.js';

/** Helper to create a minimal test note */
function createTestNote(id: string, path: string, title: string): ParsedNote {
  return {
    id: id as NoteId,
    path,
    fileName: path.split('/').pop() || '',
    resolvedTitle: title,
    frontmatterTitle: undefined,
    h1Title: title,
    frontmatterRaw: undefined,
    frontmatter: {},
    headings: [],
    inlineTags: [],
    fmTags: [],
    allTags: [],
    aliases: [],
    links: [],
    embeds: [],
    peopleMentions: [],
    plainText: 'Content',
  };
}

describe('AppState', () => {
  let state: AppState;

  beforeEach(() => {
    state = createAppState();
  });

  describe('createAppState', () => {
    it('should create an empty AppState with all indices initialized', () => {
      expect(state.noteRegistry).toBeDefined();
      expect(state.peopleIndex).toBeDefined();
      expect(state.tagIndex).toBeDefined();
      expect(state.folderIndex).toBeDefined();
      expect(state.headingIndex).toBeDefined();
      expect(state.embedIndex).toBeDefined();
      expect(state.graphIndex).toBeDefined();
      expect(state.unlinkedMentionIndex).toBeDefined();
    });

    it('should initialize all indices as empty', () => {
      const stats = getAppStateStats(state);
      expect(stats.notes).toBe(0);
      expect(stats.people).toBe(0);
      expect(stats.tags).toBe(0);
      expect(stats.folders).toBe(0);
      expect(stats.headings).toBe(0);
      expect(stats.embeds).toBe(0);
      expect(stats.graphNodes).toBe(0);
      expect(stats.unlinkedMentions).toBe(0);
    });
  });

  describe('clearAppState', () => {
    it('should clear all indices', () => {
      // Add a note
      const note = createTestNote('test/note', 'test/note.md', 'Test Note');
      state.noteRegistry.add(note);

      // Verify data exists
      expect(state.noteRegistry.size).toBe(1);

      // Clear all
      clearAppState(state);

      // Verify all cleared
      const stats = getAppStateStats(state);
      expect(stats.notes).toBe(0);
      expect(stats.graphNodes).toBe(0);
    });

    it('should clear all registries including tags, people, folders', () => {
      const note = createTestNote('note1', 'note1.md', 'Note 1');
      state.noteRegistry.add(note);
      state.tagIndex.addTagsForNote(note.id, ['test-tag']);
      state.peopleIndex.addPerson({
        id: 'Alice',
        noteId: 'people/Alice' as NoteId,
        path: 'people/Alice.md',
        name: 'Alice',
        metadata: {},
      });
      state.folderIndex.addFolderFromPath('folder/note.md');

      clearAppState(state);

      const stats = getAppStateStats(state);
      expect(stats.notes).toBe(0);
      expect(stats.tags).toBe(0);
      expect(stats.people).toBe(0);
      expect(stats.folders).toBe(0);
    });
  });

  describe('getAppStateStats', () => {
    it('should return zero counts for empty state', () => {
      const stats = getAppStateStats(state);
      expect(stats).toEqual({
        notes: 0,
        people: 0,
        tags: 0,
        folders: 0,
        headings: 0,
        embeds: 0,
        graphNodes: 0,
        unlinkedMentions: 0,
      });
    });

    it('should return accurate counts for populated state', () => {
      // Add notes
      const note1 = createTestNote('note1', 'note1.md', 'Note 1');
      const note2 = createTestNote('note2', 'note2.md', 'Note 2');
      state.noteRegistry.add(note1);
      state.noteRegistry.add(note2);

      // Add tags
      state.tagIndex.addTagsForNote(note1.id, ['tag1', 'tag2']);
      state.tagIndex.addTagsForNote(note2.id, ['tag2']);

      // Add person
      state.peopleIndex.addPerson({
        id: 'Alice',
        noteId: 'people/Alice' as NoteId,
        path: 'people/Alice.md',
        name: 'Alice',
        metadata: {},
      });

      const stats = getAppStateStats(state);
      expect(stats.notes).toBe(2);
      expect(stats.tags).toBe(2); // tag1, tag2
      expect(stats.people).toBe(1); // Alice
    });
  });

  describe('validateAppState', () => {
    it('should return empty array for consistent state', () => {
      const note = createTestNote('note1', 'note1.md', 'Note 1');
      state.noteRegistry.add(note);
      state.tagIndex.addTagsForNote(note.id, ['tag1']);

      const errors = validateAppState(state);
      expect(errors).toHaveLength(0);
    });

    it('should detect tag index referencing non-existent note', () => {
      state.tagIndex.addTagsForNote('non-existent' as NoteId, ['tag1']);

      const errors = validateAppState(state);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('Tag index') && e.includes('non-existent'))).toBe(true);
    });

    it('should detect folder index referencing non-existent note', () => {
      state.folderIndex.addNoteToFolder('non-existent' as NoteId, 'folder/note.md');

      const errors = validateAppState(state);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('Folder index') && e.includes('non-existent'))).toBe(
        true
      );
    });

    it('should detect heading index referencing non-existent note', () => {
      state.headingIndex.addHeadingsForNote('non-existent' as NoteId, [
        { text: 'Heading', level: 2, line: 1 },
      ]);

      const errors = validateAppState(state);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('Heading index') && e.includes('non-existent'))).toBe(
        true
      );
    });

    it('should detect people index referencing non-existent note', () => {
      state.peopleIndex.addPerson({
        id: 'Alice',
        noteId: 'people/Alice' as NoteId,
        path: 'people/Alice.md',
        name: 'Alice',
        metadata: {},
      });
      state.peopleIndex.addMentionsForNote('non-existent' as NoteId, ['Alice']);

      const errors = validateAppState(state);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('People index') && e.includes('non-existent'))).toBe(
        true
      );
    });

    it('should detect embed index referencing non-existent note', () => {
      state.embedIndex.addEmbedsForNote('non-existent' as NoteId, [
        { rawText: '![[Target]]', line: 1 },
      ]);

      const errors = validateAppState(state);
      expect(errors.length).toBeGreaterThan(0);
      expect(errors.some((e) => e.includes('Embed index') && e.includes('non-existent'))).toBe(
        true
      );
    });

    it('should detect unlinked mention index referencing non-existent note', () => {
      state.unlinkedMentionIndex.addMentionsForNote('non-existent' as NoteId, [
        {
          noteId: 'non-existent' as NoteId,
          candidateTargetId: 'mentioned' as NoteId,
          occurrences: [{ line: 1, startColumn: 0, endColumn: 7 }],
        },
      ]);

      const errors = validateAppState(state);
      expect(errors.length).toBeGreaterThan(0);
      expect(
        errors.some((e) => e.includes('Unlinked mention index') && e.includes('non-existent'))
      ).toBe(true);
    });

    it('should return multiple errors for multiple inconsistencies', () => {
      state.tagIndex.addTagsForNote('non-existent-1' as NoteId, ['tag1']);
      state.peopleIndex.addPerson({
        id: 'Alice',
        noteId: 'people/Alice' as NoteId,
        path: 'people/Alice.md',
        name: 'Alice',
        metadata: {},
      });
      state.peopleIndex.addMentionsForNote('non-existent-2' as NoteId, ['Alice']);

      const errors = validateAppState(state);
      expect(errors.length).toBe(2);
    });
  });

  describe('asReadOnly', () => {
    it('should return the same state object with readonly type', () => {
      const readOnly = asReadOnly(state);
      expect(readOnly).toBe(state);
    });

    it('should allow reading from readonly state', () => {
      const note = createTestNote('note1', 'note1.md', 'Note 1');
      state.noteRegistry.add(note);

      const readOnly = asReadOnly(state);
      expect(readOnly.noteRegistry.getNoteById(note.id)).toBeDefined();
    });
  });

  describe('AppStateQueries', () => {
    describe('getNoteWithRelationships', () => {
      it('should return undefined for non-existent note', () => {
        const result = AppStateQueries.getNoteWithRelationships(state, 'non-existent' as NoteId);
        expect(result).toBeUndefined();
      });

      it('should return note with empty relationships for minimal note', () => {
        const note = createTestNote('note1', 'note1.md', 'Note 1');
        state.noteRegistry.add(note);

        const result = AppStateQueries.getNoteWithRelationships(state, note.id);

        expect(result).toBeDefined();
        expect(result!.note).toEqual(note);
        expect(result!.tags).toHaveLength(0);
        expect(result!.headings).toHaveLength(0);
        expect(result!.embeds).toHaveLength(0);
        expect(result!.peopleMentioned).toHaveLength(0);
        expect(result!.unlinkedMentions).toHaveLength(0);
      });

      it('should include tags when present', () => {
        const note = createTestNote('note1', 'note1.md', 'Note 1');
        state.noteRegistry.add(note);
        state.tagIndex.addTagsForNote(note.id, ['tag1', 'tag2']);

        const result = AppStateQueries.getNoteWithRelationships(state, note.id);

        expect(result!.tags).toHaveLength(2);
      });

      it('should include headings when present', () => {
        const note = createTestNote('note1', 'note1.md', 'Note 1');
        state.noteRegistry.add(note);
        state.headingIndex.addHeadingsForNote(note.id, [
          { text: 'Heading 1', level: 2, line: 5 },
          { text: 'Heading 2', level: 3, line: 10 },
        ]);

        const result = AppStateQueries.getNoteWithRelationships(state, note.id);

        expect(result!.headings).toHaveLength(2);
      });

      it('should include embeds when present', () => {
        const note = createTestNote('note1', 'note1.md', 'Note 1');
        state.noteRegistry.add(note);
        state.embedIndex.addEmbedsForNote(note.id, [{ rawText: '![[Other Note]]', line: 20 }]);

        const result = AppStateQueries.getNoteWithRelationships(state, note.id);

        expect(result!.embeds).toHaveLength(1);
      });

      it('should include people mentions when present', () => {
        const note = createTestNote('note1', 'note1.md', 'Note 1');
        state.noteRegistry.add(note);
        state.peopleIndex.addPerson({
          id: 'Alice',
          noteId: 'people/Alice' as NoteId,
          path: 'people/Alice.md',
          name: 'Alice',
          metadata: {},
        });
        state.peopleIndex.addMentionsForNote(note.id, ['Alice']);

        const result = AppStateQueries.getNoteWithRelationships(state, note.id);

        expect(result!.peopleMentioned).toHaveLength(1);
      });

      it('should include unlinked mentions when present', () => {
        const note = createTestNote('note1', 'note1.md', 'Note 1');
        state.noteRegistry.add(note);
        state.unlinkedMentionIndex.addMentionsForNote(note.id, [
          {
            noteId: note.id,
            candidateTargetId: 'other' as NoteId,
            occurrences: [{ line: 1, startColumn: 0, endColumn: 5 }],
          },
        ]);

        const result = AppStateQueries.getNoteWithRelationships(state, note.id);

        expect(result!.unlinkedMentions).toHaveLength(1);
      });
    });

    describe('getBacklinks', () => {
      it('should return empty set for note with no backlinks', () => {
        const note = createTestNote('note1', 'note1.md', 'Note 1');
        state.noteRegistry.add(note);

        const backlinks = AppStateQueries.getBacklinks(state, note.id);
        expect(backlinks.size).toBe(0);
      });

      it('should include notes that embed the target note', () => {
        const targetNote = createTestNote('target', 'target.md', 'Target');
        const sourceNote = createTestNote('source', 'source.md', 'Source');

        state.noteRegistry.add(targetNote);
        state.noteRegistry.add(sourceNote);

        // Add embed and resolve it
        state.embedIndex.addEmbedsForNote(sourceNote.id, [{ rawText: '![[Target]]', line: 1 }]);
        const embedIds = state.embedIndex.getEmbedsFromNote(sourceNote.id);
        if (embedIds.length > 0) {
          state.embedIndex.resolveEmbed(embedIds[0]!, targetNote.id);
        }

        const backlinks = AppStateQueries.getBacklinks(state, targetNote.id);
        expect(backlinks.size).toBe(1);
        expect(backlinks.has(sourceNote.id)).toBe(true);
      });

      it('should include notes with unlinked mentions', () => {
        const targetNote = createTestNote('target', 'target.md', 'Target');
        const mentioningNote = createTestNote('mentioning', 'mentioning.md', 'Mentioning');

        state.noteRegistry.add(targetNote);
        state.noteRegistry.add(mentioningNote);

        state.unlinkedMentionIndex.addMentionsForNote(mentioningNote.id, [
          {
            noteId: mentioningNote.id,
            candidateTargetId: targetNote.id,
            occurrences: [{ line: 1, startColumn: 0, endColumn: 6 }],
          },
        ]);

        const backlinks = AppStateQueries.getBacklinks(state, targetNote.id);
        expect(backlinks.size).toBe(1);
        expect(backlinks.has(mentioningNote.id)).toBe(true);
      });
    });

    describe('getNotesInFolder', () => {
      it('should return empty array for non-existent folder', () => {
        const notes = AppStateQueries.getNotesInFolder(state, 'non-existent');
        expect(notes).toHaveLength(0);
      });

      it('should return direct notes in folder (non-recursive)', () => {
        const note1 = createTestNote('folder/note1', 'folder/note1.md', 'Note 1');
        const note2 = createTestNote('folder/note2', 'folder/note2.md', 'Note 2');

        state.noteRegistry.add(note1);
        state.noteRegistry.add(note2);

        state.folderIndex.addNoteToFolder(note1.id, note1.path);
        state.folderIndex.addNoteToFolder(note2.id, note2.path);

        const notes = AppStateQueries.getNotesInFolder(state, 'folder', false);
        expect(notes).toHaveLength(2);
        expect(notes.some((n) => n.id === note1.id)).toBe(true);
        expect(notes.some((n) => n.id === note2.id)).toBe(true);
      });

      it('should include subfolder notes when recursive=true', () => {
        const parentNote = createTestNote('parent/note', 'parent/note.md', 'Parent Note');
        const childNote = createTestNote('parent/child/note', 'parent/child/note.md', 'Child Note');

        state.noteRegistry.add(parentNote);
        state.noteRegistry.add(childNote);

        state.folderIndex.addNoteToFolder(parentNote.id, parentNote.path);
        state.folderIndex.addNoteToFolder(childNote.id, childNote.path);

        const notes = AppStateQueries.getNotesInFolder(state, 'parent', true);
        expect(notes).toHaveLength(2);
        expect(notes.some((n) => n.id === parentNote.id)).toBe(true);
        expect(notes.some((n) => n.id === childNote.id)).toBe(true);
      });

      it('should not include subfolder notes when recursive=false', () => {
        const parentNote = createTestNote('parent/note', 'parent/note.md', 'Parent Note');
        const childNote = createTestNote('parent/child/note', 'parent/child/note.md', 'Child Note');

        state.noteRegistry.add(parentNote);
        state.noteRegistry.add(childNote);

        state.folderIndex.addNoteToFolder(parentNote.id, parentNote.path);
        state.folderIndex.addNoteToFolder(childNote.id, childNote.path);

        const notes = AppStateQueries.getNotesInFolder(state, 'parent', false);
        expect(notes).toHaveLength(1);
        expect(notes[0]?.id).toBe(parentNote.id);
      });
    });
  });
});
