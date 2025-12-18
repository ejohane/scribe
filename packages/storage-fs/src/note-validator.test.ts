/**
 * Tests for note-validator module
 *
 * Tests the NoteValidator class which validates note structure with detailed error reporting.
 */

import { describe, it, expect } from 'vitest';
import { NoteValidator, noteValidator } from './note-validator.js';
import type { Note, EditorContent, NoteMetadata } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

/**
 * Helper to create a minimal valid note
 */
function createValidNote(overrides?: Partial<Note>): Note {
  const content: EditorContent = {
    root: {
      type: 'root',
      children: [],
    },
  };

  const metadata: NoteMetadata = {
    title: 'Test Note',
    tags: [],
    links: [],
    mentions: [],
  };

  return {
    id: createNoteId('test-note'),
    title: 'Test Note',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content,
    metadata,
    type: undefined,
    ...overrides,
  } as Note;
}

describe('NoteValidator', () => {
  describe('validate', () => {
    it('should return true for valid note', () => {
      const validator = new NoteValidator();
      const note = createValidNote();

      expect(validator.validate(note)).toBe(true);
    });

    it('should return false for null', () => {
      const validator = new NoteValidator();

      expect(validator.validate(null)).toBe(false);
    });

    it('should return false for undefined', () => {
      const validator = new NoteValidator();

      expect(validator.validate(undefined)).toBe(false);
    });

    it('should return false for non-object types', () => {
      const validator = new NoteValidator();

      expect(validator.validate('string')).toBe(false);
      expect(validator.validate(123)).toBe(false);
      expect(validator.validate(true)).toBe(false);
      expect(validator.validate([])).toBe(false);
    });

    it('should return false for note missing id', () => {
      const validator = new NoteValidator();
      const note = createValidNote();
      const invalidNote = { ...note } as Record<string, unknown>;
      delete invalidNote.id;

      expect(validator.validate(invalidNote)).toBe(false);
    });
  });

  describe('validateWithErrors', () => {
    describe('null/non-object handling', () => {
      it('should return error for null', () => {
        const validator = new NoteValidator();

        const result = validator.validateWithErrors(null);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Note must be a non-null object');
      });

      it('should return error for undefined', () => {
        const validator = new NoteValidator();

        const result = validator.validateWithErrors(undefined);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Note must be a non-null object');
      });

      it('should return error for primitive types', () => {
        const validator = new NoteValidator();

        expect(validator.validateWithErrors('string').errors).toContain(
          'Note must be a non-null object'
        );
        expect(validator.validateWithErrors(123).errors).toContain(
          'Note must be a non-null object'
        );
        expect(validator.validateWithErrors(true).errors).toContain(
          'Note must be a non-null object'
        );
      });
    });

    describe('core field validation', () => {
      it('should report error for missing id', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note } as Record<string, unknown>;
        delete invalidNote.id;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "id" must be a string');
      });

      it('should report error for non-string id', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, id: 123 } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "id" must be a string');
      });

      it('should report error for missing createdAt', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note } as Record<string, unknown>;
        delete invalidNote.createdAt;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "createdAt" must be a number (timestamp)');
      });

      it('should report error for non-number createdAt', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, createdAt: '2024-01-01' } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "createdAt" must be a number (timestamp)');
      });

      it('should report error for missing updatedAt', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note } as Record<string, unknown>;
        delete invalidNote.updatedAt;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "updatedAt" must be a number (timestamp)');
      });

      it('should report error for non-number updatedAt', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, updatedAt: new Date() } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "updatedAt" must be a number (timestamp)');
      });

      it('should report error for missing content', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note } as Record<string, unknown>;
        delete invalidNote.content;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Field "content" must be a non-null object (EditorContent)'
        );
      });

      it('should report error for null content', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, content: null } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Field "content" must be a non-null object (EditorContent)'
        );
      });

      it('should report error for missing metadata', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note } as Record<string, unknown>;
        delete invalidNote.metadata;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Field "metadata" must be a non-null object (NoteMetadata)'
        );
      });

      it('should report error for null metadata', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, metadata: null } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Field "metadata" must be a non-null object (NoteMetadata)'
        );
      });

      it('should collect multiple errors', () => {
        const validator = new NoteValidator();
        const invalidNote = {
          id: 123, // wrong type
          createdAt: 'today', // wrong type
          updatedAt: null, // wrong type
          content: null, // null not allowed
          metadata: undefined, // missing
        };

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors.length).toBeGreaterThanOrEqual(5);
      });
    });

    describe('optional title validation', () => {
      it('should accept note without title', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const noteWithoutTitle = { ...note } as Record<string, unknown>;
        delete noteWithoutTitle.title;

        const result = validator.validateWithErrors(noteWithoutTitle);

        // Title is optional, so should still be valid (or only fail for other reasons)
        expect(result.errors).not.toContain('Field "title" must be a string if present');
      });

      it('should accept note with string title', () => {
        const validator = new NoteValidator();
        const note = createValidNote({ title: 'My Title' });

        const result = validator.validateWithErrors(note);

        expect(result.valid).toBe(true);
      });

      it('should reject note with non-string title', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, title: 123 } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "title" must be a string if present');
      });

      it('should accept note with empty string title', () => {
        const validator = new NoteValidator();
        const note = createValidNote({ title: '' });

        const result = validator.validateWithErrors(note);

        // Empty string is valid for optional string field
        expect(result.errors).not.toContain('Field "title" must be a string if present');
      });
    });

    describe('optional tags validation', () => {
      it('should accept note without tags', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const noteWithoutTags = { ...note } as Record<string, unknown>;
        delete noteWithoutTags.tags;

        const result = validator.validateWithErrors(noteWithoutTags);

        expect(result.errors).not.toContain('Field "tags" must be an array if present');
      });

      it('should accept note with empty tags array', () => {
        const validator = new NoteValidator();
        const note = createValidNote({ tags: [] });

        const result = validator.validateWithErrors(note);

        expect(result.valid).toBe(true);
      });

      it('should accept note with string tags', () => {
        const validator = new NoteValidator();
        const note = createValidNote({ tags: ['work', 'important'] });

        const result = validator.validateWithErrors(note);

        expect(result.valid).toBe(true);
      });

      it('should reject note with non-array tags', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, tags: 'not-an-array' } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "tags" must be an array if present');
      });

      it('should reject note with non-string elements in tags', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, tags: ['valid', 123, null] } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "tags" must contain only strings');
      });
    });

    describe('optional daily field validation', () => {
      it('should accept note without daily field', () => {
        const validator = new NoteValidator();
        const note = createValidNote();

        const result = validator.validateWithErrors(note);

        expect(result.errors.filter((e) => e.includes('daily'))).toHaveLength(0);
      });

      it('should accept note with valid daily field', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const dailyNote = { ...note, daily: { date: '2024-12-18' } } as unknown;

        const result = validator.validateWithErrors(dailyNote);

        expect(result.errors.filter((e) => e.includes('daily'))).toHaveLength(0);
      });

      it('should reject note with null daily field', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, daily: null } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "daily" must be a non-null object if present');
      });

      it('should reject note with non-object daily field', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, daily: '2024-12-18' } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "daily" must be a non-null object if present');
      });

      it('should reject daily field without date', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, daily: {} } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Field "daily.date" must be a string (ISO date format YYYY-MM-DD)'
        );
      });

      it('should reject daily field with non-string date', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, daily: { date: 20241218 } } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Field "daily.date" must be a string (ISO date format YYYY-MM-DD)'
        );
      });
    });

    describe('optional meeting field validation', () => {
      it('should accept note without meeting field', () => {
        const validator = new NoteValidator();
        const note = createValidNote();

        const result = validator.validateWithErrors(note);

        expect(result.errors.filter((e) => e.includes('meeting'))).toHaveLength(0);
      });

      it('should accept note with valid meeting field', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const meetingNote = {
          ...note,
          meeting: {
            date: '2024-12-18',
            dailyNoteId: createNoteId('daily-1'),
            attendees: [createNoteId('person-1'), createNoteId('person-2')],
          },
        } as unknown;

        const result = validator.validateWithErrors(meetingNote);

        expect(result.errors.filter((e) => e.includes('meeting'))).toHaveLength(0);
      });

      it('should reject note with null meeting field', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = { ...note, meeting: null } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "meeting" must be a non-null object if present');
      });

      it('should reject meeting field without date', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = {
          ...note,
          meeting: { dailyNoteId: 'daily-1', attendees: [] },
        } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain(
          'Field "meeting.date" must be a string (ISO date format YYYY-MM-DD)'
        );
      });

      it('should reject meeting field without dailyNoteId', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = {
          ...note,
          meeting: { date: '2024-12-18', attendees: [] },
        } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "meeting.dailyNoteId" must be a string (NoteId)');
      });

      it('should reject meeting field without attendees', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = {
          ...note,
          meeting: { date: '2024-12-18', dailyNoteId: 'daily-1' },
        } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "meeting.attendees" must be an array of NoteIds');
      });

      it('should reject meeting field with non-array attendees', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const invalidNote = {
          ...note,
          meeting: { date: '2024-12-18', dailyNoteId: 'daily-1', attendees: 'person-1' },
        } as unknown;

        const result = validator.validateWithErrors(invalidNote);

        expect(result.valid).toBe(false);
        expect(result.errors).toContain('Field "meeting.attendees" must be an array of NoteIds');
      });
    });

    describe('valid note acceptance', () => {
      it('should accept minimal valid note', () => {
        const validator = new NoteValidator();
        const note = createValidNote();

        const result = validator.validateWithErrors(note);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept note with all optional fields', () => {
        const validator = new NoteValidator();
        const fullNote = createValidNote({
          title: 'Full Note',
          tags: ['tag1', 'tag2'],
        });

        const result = validator.validateWithErrors(fullNote);

        expect(result.valid).toBe(true);
        expect(result.errors).toHaveLength(0);
      });

      it('should accept daily note', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const dailyNote = {
          ...note,
          type: 'daily',
          daily: { date: '2024-12-18' },
        } as unknown;

        const result = validator.validateWithErrors(dailyNote);

        // Should only validate structure, not business rules about type/daily matching
        expect(result.errors.filter((e) => e.includes('daily'))).toHaveLength(0);
      });

      it('should accept meeting note', () => {
        const validator = new NoteValidator();
        const note = createValidNote();
        const meetingNote = {
          ...note,
          type: 'meeting',
          meeting: {
            date: '2024-12-18',
            dailyNoteId: createNoteId('daily-1'),
            attendees: [],
          },
        } as unknown;

        const result = validator.validateWithErrors(meetingNote);

        expect(result.errors.filter((e) => e.includes('meeting'))).toHaveLength(0);
      });
    });
  });

  describe('default instance', () => {
    it('should export a default noteValidator instance', () => {
      expect(noteValidator).toBeInstanceOf(NoteValidator);
    });

    it('should validate correctly using default instance', () => {
      const note = createValidNote();

      expect(noteValidator.validate(note)).toBe(true);
    });

    it('should provide errors using default instance', () => {
      const result = noteValidator.validateWithErrors(null);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Note must be a non-null object');
    });
  });
});
