/**
 * Note migration utilities
 *
 * Provides version-aware migration for legacy note formats.
 * Extracted from FileSystemVault for better separation of concerns.
 */

import type {
  Note,
  NoteId,
  NoteType,
  LexicalState,
  NoteMetadata,
  DailyNoteData,
  MeetingNoteData,
} from '@scribe/shared';

/**
 * Note format version history:
 * - v1 (initial): Notes without explicit title/type/tags fields (derived from metadata)
 * - v2 (current): Notes with explicit title, type, tags fields
 */
export const NOTE_FORMAT_VERSION = 2;

/**
 * Interface for note migration
 */
export interface INoteMigrator {
  /**
   * Check if a note needs migration to the current format version
   *
   * @param note - Note object (potentially legacy format)
   * @returns true if migration is needed
   */
  needsMigration(note: unknown): boolean;

  /**
   * Migrate a note to the current format version
   *
   * @param note - Note object (potentially legacy format)
   * @returns Migrated note in current format
   */
  migrate(note: unknown): Note;

  /**
   * Current note format version
   */
  readonly currentVersion: number;
}

/**
 * Raw note data structure that may be missing fields (legacy format)
 * Used internally for type-safe migration logic
 */
interface LegacyNoteData {
  id: NoteId;
  title?: string;
  createdAt: number;
  updatedAt: number;
  type?: NoteType;
  tags?: string[];
  content: LexicalState;
  metadata: NoteMetadata;
  daily?: DailyNoteData;
  meeting?: MeetingNoteData;
  /** Format version (added in v2, missing in v1) */
  version?: number;
}

/**
 * Handles migration of legacy note formats to the current version.
 *
 * Migration strategy:
 * - v1 → v2: Add explicit title (from metadata.title), type (from metadata.type or content.type),
 *            and tags (initialize as empty array). Preserve daily/meeting fields if present.
 *
 * The migrator is designed to be chainable: if additional format changes are made in the future,
 * migrations can be applied sequentially (v1 → v2 → v3, etc.)
 */
export class NoteMigrator implements INoteMigrator {
  /**
   * Current note format version
   */
  readonly currentVersion = NOTE_FORMAT_VERSION;

  /**
   * Check if a note needs migration to the current format version
   *
   * A note needs migration if:
   * - It lacks explicit version field (pre-v2 format)
   * - It lacks required fields that were added in v2 (title, tags)
   * - Its version is lower than the current version
   *
   * @param note - Note object (potentially legacy format)
   * @returns true if migration is needed
   */
  needsMigration(note: unknown): boolean {
    if (typeof note !== 'object' || note === null) {
      return false;
    }

    const n = note as Record<string, unknown>;

    // Check for explicit version field (added in v2)
    if (typeof n.version !== 'number') {
      // No version field means legacy v1 format
      return true;
    }

    // Check if version is lower than current
    if (n.version < this.currentVersion) {
      return true;
    }

    // Check for missing v2 fields (defensive check)
    if (typeof n.title !== 'string') {
      return true;
    }

    if (!Array.isArray(n.tags)) {
      return true;
    }

    return false;
  }

  /**
   * Migrate a note to the current format version
   *
   * Applies all necessary migrations in sequence to bring the note
   * up to the current format version.
   *
   * @param note - Note object (potentially legacy format)
   * @returns Migrated note in current format
   */
  migrate(note: unknown): Note {
    if (typeof note !== 'object' || note === null) {
      throw new Error('Cannot migrate: note must be a non-null object');
    }

    const legacyNote = note as LegacyNoteData;
    const noteVersion = legacyNote.version ?? 1;

    // Apply migrations in sequence
    let migratedNote = legacyNote;

    if (noteVersion < 2) {
      migratedNote = this.migrateV1toV2(migratedNote);
    }

    // Future migrations would be added here:
    // if (migratedNote.version < 3) {
    //   migratedNote = this.migrateV2toV3(migratedNote);
    // }

    return this.buildNote(migratedNote);
  }

  /**
   * Migrate from v1 to v2 format
   *
   * v1 → v2 changes:
   * - Add explicit title field (derived from metadata.title or 'Untitled')
   * - Add explicit type field (derived from metadata.type or content.type)
   * - Add tags array (initialized as empty, inline tags stay in metadata.tags)
   * - Add version field
   *
   * @param note - v1 format note
   * @returns v2 format note data
   */
  private migrateV1toV2(note: LegacyNoteData): LegacyNoteData {
    return {
      ...note,
      // Derive title from metadata if explicit title is missing
      title: note.title ?? note.metadata?.title ?? 'Untitled',
      // Derive type from metadata or content if explicit type is missing
      type: note.type ?? note.metadata?.type ?? note.content?.type,
      // Initialize tags as empty if missing (inline #tags stay in metadata.tags)
      tags: note.tags ?? [],
      // Preserve daily/meeting fields if present
      daily: note.daily,
      meeting: note.meeting,
      // Mark as v2 format
      version: 2,
    };
  }

  /**
   * Build a properly typed Note from migrated data.
   * Handles the discriminated union based on the type field.
   *
   * @param data - Migrated note data
   * @returns Properly typed Note
   */
  private buildNote(data: LegacyNoteData): Note {
    const baseNote = {
      id: data.id,
      title: data.title ?? 'Untitled',
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      tags: data.tags ?? [],
      content: data.content,
      metadata: data.metadata,
    };

    // Handle discriminated union based on type
    if (data.type === 'daily' && data.daily) {
      return { ...baseNote, type: 'daily', daily: data.daily };
    }
    if (data.type === 'meeting' && data.meeting) {
      return { ...baseNote, type: 'meeting', meeting: data.meeting };
    }
    if (data.type === 'person') {
      return { ...baseNote, type: 'person' };
    }
    if (data.type === 'project') {
      return { ...baseNote, type: 'project' };
    }
    if (data.type === 'template') {
      return { ...baseNote, type: 'template' };
    }
    if (data.type === 'system') {
      return { ...baseNote, type: 'system' };
    }
    // Regular note (no special type)
    return { ...baseNote, type: undefined };
  }
}

/**
 * Default migrator instance for convenience
 */
export const noteMigrator = new NoteMigrator();
