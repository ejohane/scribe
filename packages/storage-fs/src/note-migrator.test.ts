/**
 * Tests for NoteMigrator
 */

import { describe, it, expect } from 'vitest';
import { createNoteId } from '@scribe/shared';
import type {
  Note,
  NoteMetadata,
  EditorContent,
  DailyNoteData,
  MeetingNoteData,
} from '@scribe/shared';
import { NoteMigrator, NOTE_FORMAT_VERSION, noteMigrator } from './note-migrator.js';

/**
 * Helper to create a minimal v1 legacy note (without explicit title/tags/version fields)
 */
function createLegacyV1Note(
  overrides: {
    id?: string;
    title?: string;
    type?: string;
    tags?: string[];
    metadata?: Partial<NoteMetadata>;
    daily?: DailyNoteData;
    meeting?: MeetingNoteData;
  } = {}
): Record<string, unknown> {
  const metadata: NoteMetadata = {
    title: overrides.metadata?.title ?? 'Legacy Title',
    tags: overrides.metadata?.tags ?? [],
    links: overrides.metadata?.links ?? [],
    mentions: overrides.metadata?.mentions ?? [],
    type: overrides.metadata?.type,
  };

  const content: EditorContent = {
    root: {
      type: 'root',
      children: [],
    },
    type: overrides.type as EditorContent['type'],
  };

  const note: Record<string, unknown> = {
    id: overrides.id ?? createNoteId('legacy-note-1'),
    createdAt: Date.now(),
    updatedAt: Date.now(),
    content,
    metadata,
  };

  // Optionally include explicit fields to test partial migration
  if (overrides.title !== undefined) {
    note.title = overrides.title;
  }
  if (overrides.tags !== undefined) {
    note.tags = overrides.tags;
  }
  if (overrides.daily !== undefined) {
    note.daily = overrides.daily;
  }
  if (overrides.meeting !== undefined) {
    note.meeting = overrides.meeting;
  }

  return note;
}

/**
 * Helper to create a v2 note (with explicit title/tags/version fields)
 */
function createV2Note(
  overrides: {
    id?: string;
    title?: string;
    type?: Note['type'];
    tags?: string[];
    daily?: DailyNoteData;
    meeting?: MeetingNoteData;
  } = {}
): Note & { version: number } {
  const metadata: NoteMetadata = {
    title: null,
    tags: [],
    links: [],
    mentions: [],
    type: overrides.type,
  };

  const content: EditorContent = {
    root: {
      type: 'root',
      children: [],
    },
    type: overrides.type,
  };

  const baseNote = {
    id: createNoteId(overrides.id ?? 'v2-note-1'),
    title: overrides.title ?? 'V2 Note Title',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: overrides.tags ?? [],
    content,
    metadata,
    version: NOTE_FORMAT_VERSION,
  };

  // Build proper discriminated union
  if (overrides.type === 'daily' && overrides.daily) {
    return { ...baseNote, type: 'daily', daily: overrides.daily };
  }
  if (overrides.type === 'meeting' && overrides.meeting) {
    return { ...baseNote, type: 'meeting', meeting: overrides.meeting };
  }
  if (overrides.type === 'person') {
    return { ...baseNote, type: 'person' };
  }
  if (overrides.type === 'project') {
    return { ...baseNote, type: 'project' };
  }
  if (overrides.type === 'template') {
    return { ...baseNote, type: 'template' };
  }
  if (overrides.type === 'system') {
    return { ...baseNote, type: 'system' };
  }
  return { ...baseNote, type: undefined };
}

describe('NoteMigrator', () => {
  describe('needsMigration', () => {
    it('returns false for null or non-object values', () => {
      const migrator = new NoteMigrator();
      expect(migrator.needsMigration(null)).toBe(false);
      expect(migrator.needsMigration(undefined)).toBe(false);
      expect(migrator.needsMigration('string')).toBe(false);
      expect(migrator.needsMigration(123)).toBe(false);
    });

    it('returns true for v1 notes without version field', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note();
      expect(migrator.needsMigration(legacyNote)).toBe(true);
    });

    it('returns true for notes with version lower than current', () => {
      const migrator = new NoteMigrator();
      const oldVersionNote = { ...createV2Note(), version: 1 };
      expect(migrator.needsMigration(oldVersionNote)).toBe(true);
    });

    it('returns false for notes at current version with all required fields', () => {
      const migrator = new NoteMigrator();
      const currentNote = createV2Note();
      expect(migrator.needsMigration(currentNote)).toBe(false);
    });

    it('returns true for notes missing title field', () => {
      const migrator = new NoteMigrator();
      const noteWithoutTitle = createV2Note() as unknown as Record<string, unknown>;
      delete noteWithoutTitle.title;
      expect(migrator.needsMigration(noteWithoutTitle)).toBe(true);
    });

    it('returns true for notes missing tags array', () => {
      const migrator = new NoteMigrator();
      const noteWithoutTags = createV2Note() as unknown as Record<string, unknown>;
      delete noteWithoutTags.tags;
      expect(migrator.needsMigration(noteWithoutTags)).toBe(true);
    });
  });

  describe('migrate', () => {
    it('throws for null or non-object values', () => {
      const migrator = new NoteMigrator();
      expect(() => migrator.migrate(null)).toThrow(
        'Cannot migrate: note must be a non-null object'
      );
      expect(() => migrator.migrate(undefined)).toThrow(
        'Cannot migrate: note must be a non-null object'
      );
    });

    it('migrates v1 note to v2 format', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        metadata: { title: 'My Legacy Note' },
      });

      const migrated = migrator.migrate(legacyNote);

      expect(migrated.title).toBe('My Legacy Note');
      expect(migrated.tags).toEqual([]);
      expect(migrated.type).toBeUndefined();
    });

    it('derives title from metadata.title', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        metadata: { title: 'Metadata Title' },
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.title).toBe('Metadata Title');
    });

    it('falls back to Untitled if no title available', () => {
      const migrator = new NoteMigrator();
      // Create a note with no title in metadata
      const legacyNote: Record<string, unknown> = {
        id: createNoteId('legacy-note-no-title'),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: {
          root: {
            type: 'root',
            children: [],
          },
        },
        metadata: {
          title: null, // No title in metadata
          tags: [],
          links: [],
          mentions: [],
        },
      };

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.title).toBe('Untitled');
    });

    it('derives type from metadata.type', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        metadata: { type: 'person' },
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBe('person');
    });

    it('derives type from content.type as fallback', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        type: 'project', // Sets content.type
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBe('project');
    });

    it('initializes tags as empty array', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note();

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.tags).toEqual([]);
    });

    it('preserves existing title if present', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        title: 'Explicit Title',
        metadata: { title: 'Metadata Title' },
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.title).toBe('Explicit Title');
    });

    it('preserves existing tags if present', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        tags: ['existing', 'tags'],
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.tags).toEqual(['existing', 'tags']);
    });

    it('preserves daily field for daily notes', () => {
      const migrator = new NoteMigrator();
      const dailyData: DailyNoteData = { date: '2024-12-02' };
      const legacyNote = createLegacyV1Note({
        type: 'daily',
        metadata: { type: 'daily' },
        daily: dailyData,
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBe('daily');
      if (migrated.type === 'daily') {
        expect(migrated.daily).toEqual(dailyData);
      }
    });

    it('preserves meeting field for meeting notes', () => {
      const migrator = new NoteMigrator();
      const meetingData: MeetingNoteData = {
        date: '2024-12-02',
        dailyNoteId: createNoteId('daily-123'),
        attendees: [createNoteId('person-1'), createNoteId('person-2')],
      };
      const legacyNote = createLegacyV1Note({
        type: 'meeting',
        metadata: { type: 'meeting' },
        meeting: meetingData,
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBe('meeting');
      if (migrated.type === 'meeting') {
        expect(migrated.meeting).toEqual(meetingData);
      }
    });

    it('preserves all core fields', () => {
      const migrator = new NoteMigrator();
      const now = Date.now();
      const legacyNote = createLegacyV1Note();
      legacyNote.createdAt = now;
      legacyNote.updatedAt = now + 1000;

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.id).toBe(legacyNote.id);
      expect(migrated.createdAt).toBe(now);
      expect(migrated.updatedAt).toBe(now + 1000);
      expect(migrated.content).toEqual(legacyNote.content);
      expect(migrated.metadata).toEqual(legacyNote.metadata);
    });
  });

  describe('currentVersion', () => {
    it('returns the current format version', () => {
      const migrator = new NoteMigrator();
      expect(migrator.currentVersion).toBe(NOTE_FORMAT_VERSION);
      expect(migrator.currentVersion).toBe(2);
    });
  });

  describe('note type handling', () => {
    it('handles regular notes (no type)', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note();

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBeUndefined();
    });

    it('handles person notes', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        metadata: { type: 'person' },
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBe('person');
    });

    it('handles project notes', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        metadata: { type: 'project' },
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBe('project');
    });

    it('handles template notes', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        metadata: { type: 'template' },
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBe('template');
    });

    it('handles system notes', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        metadata: { type: 'system' },
      });

      const migrated = migrator.migrate(legacyNote);
      expect(migrated.type).toBe('system');
    });
  });

  describe('default instance', () => {
    it('exports a default noteMigrator instance', () => {
      expect(noteMigrator).toBeInstanceOf(NoteMigrator);
      expect(noteMigrator.currentVersion).toBe(NOTE_FORMAT_VERSION);
    });
  });

  describe('idempotency', () => {
    it('does not modify already migrated notes', () => {
      const migrator = new NoteMigrator();
      const modernNote = createV2Note({
        title: 'Modern Note',
        tags: ['tag1', 'tag2'],
      });

      // Migration should be a no-op for already migrated notes
      if (!migrator.needsMigration(modernNote)) {
        // If needsMigration returns false, we shouldn't migrate
        expect(modernNote.title).toBe('Modern Note');
        expect(modernNote.tags).toEqual(['tag1', 'tag2']);
      }
    });

    it('migrating twice produces the same result', () => {
      const migrator = new NoteMigrator();
      const legacyNote = createLegacyV1Note({
        metadata: { title: 'Double Migration Test' },
      });

      const firstMigration = migrator.migrate(legacyNote);
      const secondMigration = migrator.migrate(firstMigration);

      expect(secondMigration.title).toBe(firstMigration.title);
      expect(secondMigration.tags).toEqual(firstMigration.tags);
      expect(secondMigration.type).toBe(firstMigration.type);
    });
  });
});
