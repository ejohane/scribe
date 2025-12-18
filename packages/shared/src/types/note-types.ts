/**
 * Note-related type definitions for Scribe
 *
 * This module contains types for notes, their identifiers, metadata, and variants.
 * Includes branded types for type-safe identifiers and the discriminated union
 * pattern for different note types.
 */

import type { EditorContent } from './editor-types.js';

// ============================================================================
// Branded Type Identifiers
// ============================================================================

/**
 * Unique identifier for a note
 *
 * This is a branded type to prevent accidental mixing with other string types.
 * Use createNoteId() to create instances.
 */
export type NoteId = string & { readonly __brand: 'NoteId' };

/**
 * Path to the vault directory
 *
 * This is a branded type to prevent accidental mixing with other string types.
 * Use createVaultPath() to create instances.
 */
export type VaultPath = string & { readonly __brand: 'VaultPath' };

/**
 * Create a NoteId from a string
 *
 * Use this function to convert raw strings to the NoteId type.
 * The function performs no validation - it simply brands the string.
 *
 * @param id - The raw string identifier to brand as a NoteId
 * @returns A branded NoteId that can be used throughout the application
 *
 * @example
 * ```typescript
 * const id = createNoteId('abc-123');
 * // id is now typed as NoteId, preventing accidental mixing with other strings
 * ```
 *
 * @since 1.0.0
 */
export function createNoteId(id: string): NoteId {
  return id as NoteId;
}

/**
 * Create a VaultPath from a string
 *
 * Use this function to convert raw strings to the VaultPath type.
 * The function performs no validation - it simply brands the string.
 *
 * @param path - The raw string path to brand as a VaultPath
 * @returns A branded VaultPath that can be used for vault operations
 *
 * @example
 * ```typescript
 * const vaultPath = createVaultPath('/Users/name/Documents/my-vault');
 * // vaultPath is now typed as VaultPath
 * ```
 *
 * @since 1.0.0
 */
export function createVaultPath(path: string): VaultPath {
  return path as VaultPath;
}

// ============================================================================
// Note Type Discriminator
// ============================================================================

/**
 * Note type discriminator
 * Used to distinguish special note types from regular notes.
 *
 * Current types:
 * - 'person': A person entity that can be mentioned with @name syntax
 * - undefined: A regular note (default)
 *
 * Future types to consider:
 * - 'project': A project note for organizing related work
 * - 'meeting': A meeting note with date/attendees
 * - 'daily': A daily journal note
 * - 'template': A template for creating new notes
 *
 * To add a new type:
 * 1. Add the string literal to this union type
 * 2. Update metadata extraction in packages/engine-core/src/metadata.ts
 * 3. Update the graph engine if the type has special relationships
 * 4. Add any UI components for the new type
 */
export type NoteType = 'person' | 'project' | 'meeting' | 'daily' | 'template' | 'system';

// ============================================================================
// Note Metadata
// ============================================================================

/**
 * Metadata derived from note content
 * This is always extracted by the engine, never set directly by the UI
 */
export interface NoteMetadata {
  /**
   * @deprecated Use Note.title instead. This field is derived from content
   * for backward compatibility with legacy notes only and will always be null
   * for new notes.
   */
  title: string | null;

  /**
   * Tags extracted from content using #tag conventions or custom nodes
   */
  tags: string[];

  /**
   * Outbound references to other notes (extracted from link nodes)
   */
  links: NoteId[];

  /**
   * People mentioned in this note (extracted from person-mention nodes)
   * Each entry is the NoteId of a person note
   */
  mentions: NoteId[];

  /**
   * Note type discriminator
   * - 'person': A person entity that can be mentioned with @name syntax
   * - undefined: A regular note (default)
   */
  type?: NoteType;
}

// ============================================================================
// System Notes
// ============================================================================

/**
 * System note IDs
 *
 * Reserved IDs for special system-level notes that render custom screens
 * instead of the standard note editor. These notes don't have content files
 * in the vault - they are virtual notes handled specially by the UI.
 *
 * @example
 * ```typescript
 * // Navigate to the tasks screen
 * navigateToNote(SYSTEM_NOTE_IDS.TASKS);
 * ```
 *
 * @since 1.0.0
 */
export const SYSTEM_NOTE_IDS = {
  /** Virtual note ID for the Tasks management screen */
  TASKS: 'system:tasks',
} as const;

/**
 * Check if a note ID is a system note
 *
 * System notes are identified by the 'system:' prefix and represent
 * virtual screens rather than actual note content.
 *
 * @param id - The note ID to check (can be null/undefined for safety)
 * @returns `true` if the ID represents a system note, `false` otherwise
 *
 * @example
 * ```typescript
 * isSystemNoteId('system:tasks');  // true
 * isSystemNoteId('abc-123');        // false
 * isSystemNoteId(null);             // false
 * ```
 *
 * @since 1.0.0
 */
export function isSystemNoteId(id: string | null | undefined): boolean {
  if (!id) return false;
  return id.startsWith('system:');
}

// ============================================================================
// Note Type-Specific Data
// ============================================================================

/**
 * Daily note specific data
 *
 * Contains the date-specific metadata for daily journal notes.
 * This data is stored in the `daily` field of DailyNote.
 *
 * @example
 * ```typescript
 * const dailyData: DailyNoteData = {
 *   date: '2024-01-15'
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface DailyNoteData {
  /**
   * ISO date string in "YYYY-MM-DD" format.
   * Used to associate the note with a specific calendar date.
   */
  date: string;
}

/**
 * Meeting note specific data
 *
 * Contains metadata specific to meeting notes, including the date,
 * linked daily note, and attendee references.
 *
 * @example
 * ```typescript
 * const meetingData: MeetingNoteData = {
 *   date: '2024-01-15',
 *   dailyNoteId: createNoteId('daily-2024-01-15'),
 *   attendees: [
 *     createNoteId('person-alice'),
 *     createNoteId('person-bob')
 *   ]
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface MeetingNoteData {
  /**
   * ISO date string in "YYYY-MM-DD" format.
   * The date when the meeting occurred.
   */
  date: string;
  /**
   * Reference to the daily note for this meeting's date.
   * Creates a bidirectional link between meeting and daily notes.
   */
  dailyNoteId: NoteId;
  /**
   * List of person note IDs representing meeting attendees.
   * Each ID references a PersonNote in the vault.
   */
  attendees: NoteId[];
}

// ============================================================================
// Note Discriminated Union
// ============================================================================

/**
 * Base note structure containing fields common to all note types.
 * This is combined with type-specific discriminated union variants.
 */
export interface BaseNote {
  /**
   * Immutable unique identifier
   */
  id: NoteId;

  /**
   * User-editable title for the note
   * This is the canonical title displayed in sidebar, search, etc.
   * Unlike metadata.title which is derived from content, this is explicitly set by the user.
   */
  title: string;

  /**
   * Timestamp when note was created (milliseconds)
   */
  createdAt: number;

  /**
   * Timestamp when note was last updated (milliseconds)
   * Managed by engine only
   */
  updatedAt: number;

  /**
   * User-defined tags for the note
   * These are explicitly set by the user via the header UI.
   * Separate from metadata.tags which are extracted from inline #tag patterns in content.
   * Both are merged when displaying "all tags" for a note.
   */
  tags: string[];

  /**
   * Rich text content in abstract editor format
   * Currently uses Lexical JSON format internally
   */
  content: EditorContent;

  /**
   * Derived metadata (title, tags, links)
   * Always re-extracted from content by engine
   * Note: metadata.title and metadata.tags are derived from content,
   * while note.title and note.tags are user-editable explicit fields.
   */
  metadata: NoteMetadata;
}

/**
 * Regular note (no special type)
 *
 * The default note type with no special behavior or metadata.
 * Most notes in a vault are regular notes.
 *
 * @since 1.0.0
 */
export interface RegularNote extends BaseNote {
  /** Explicitly undefined to mark as regular note in discriminated union */
  type?: undefined;
}

/**
 * Person note - a person entity that can be mentioned with @name syntax
 *
 * Person notes represent people in your network. They can be mentioned
 * in other notes using @name syntax, which creates a link and adds the
 * person to that note's mentions metadata.
 *
 * @example
 * ```typescript
 * // In another note's content, type "@Alice" to mention this person
 * ```
 *
 * @since 1.0.0
 */
export interface PersonNote extends BaseNote {
  /** Discriminant for person notes */
  type: 'person';
}

/**
 * Project note - for organizing related work
 *
 * Project notes serve as organizational hubs for grouping related notes.
 * They can be linked from other notes to establish project membership.
 *
 * @since 1.0.0
 */
export interface ProjectNote extends BaseNote {
  /** Discriminant for project notes */
  type: 'project';
}

/**
 * Template note - a template for creating new notes
 *
 * Template notes contain predefined structure that can be used as a
 * starting point when creating new notes. The template's content is
 * copied to the new note.
 *
 * @since 1.0.0
 */
export interface TemplateNote extends BaseNote {
  /** Discriminant for template notes */
  type: 'template';
}

/**
 * System note - reserved for special system-level functionality
 *
 * System notes are virtual notes that don't have content files.
 * They represent special screens or functionality in the app.
 *
 * @see SYSTEM_NOTE_IDS for predefined system note identifiers
 * @since 1.0.0
 */
export interface SystemNote extends BaseNote {
  /** Discriminant for system notes */
  type: 'system';
}

/**
 * Daily note - a daily journal note with date-specific data
 *
 * Daily notes are journal entries tied to a specific calendar date.
 * They include additional metadata in the `daily` field.
 *
 * @example
 * ```typescript
 * if (isDailyNote(note)) {
 *   console.log(`Journal for ${note.daily.date}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export interface DailyNote extends BaseNote {
  /** Discriminant for daily notes */
  type: 'daily';
  /** Date-specific metadata for this daily note */
  daily: DailyNoteData;
}

/**
 * Meeting note - a meeting note with attendees and daily note link
 *
 * Meeting notes capture meeting information including date, attendees,
 * and a link to the associated daily note. They include additional
 * metadata in the `meeting` field.
 *
 * @example
 * ```typescript
 * if (isMeetingNote(note)) {
 *   console.log(`Meeting on ${note.meeting.date}`);
 *   console.log(`Attendees: ${note.meeting.attendees.length}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export interface MeetingNote extends BaseNote {
  /** Discriminant for meeting notes */
  type: 'meeting';
  /** Meeting-specific metadata including date and attendees */
  meeting: MeetingNoteData;
}

/**
 * Complete note structure using discriminated union.
 * This is the single source of truth for note data.
 *
 * The union uses `type` as the discriminant:
 * - Regular notes: type is undefined
 * - Person notes: type === 'person'
 * - Project notes: type === 'project'
 * - Template notes: type === 'template'
 * - System notes: type === 'system'
 * - Daily notes: type === 'daily', includes `daily` field
 * - Meeting notes: type === 'meeting', includes `meeting` field
 *
 * Use type guards (isDailyNote, isMeetingNote, etc.) to narrow the type
 * and access type-specific fields with full type safety.
 */
export type Note =
  | RegularNote
  | PersonNote
  | ProjectNote
  | TemplateNote
  | SystemNote
  | DailyNote
  | MeetingNote;

// ============================================================================
// Note Type Guards
// ============================================================================

/**
 * Type guard for regular notes (no special type)
 *
 * Regular notes are the default note type with no special behavior or data.
 *
 * @param note - The note to check
 * @returns `true` if the note is a regular note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isRegularNote(note)) {
 *   // note is now typed as RegularNote
 *   console.log('This is a standard note');
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isRegularNote(note: Note): note is RegularNote {
  return note.type === undefined;
}

/**
 * Type guard for person notes
 *
 * Person notes represent people who can be mentioned in other notes using @name syntax.
 *
 * @param note - The note to check
 * @returns `true` if the note is a person note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isPersonNote(note)) {
 *   // note is now typed as PersonNote
 *   console.log(`Person: ${note.title}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isPersonNote(note: Note): note is PersonNote {
  return note.type === 'person';
}

/**
 * Type guard for project notes
 *
 * Project notes are used for organizing related work and grouping notes.
 *
 * @param note - The note to check
 * @returns `true` if the note is a project note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isProjectNote(note)) {
 *   // note is now typed as ProjectNote
 *   console.log(`Project: ${note.title}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isProjectNote(note: Note): note is ProjectNote {
  return note.type === 'project';
}

/**
 * Type guard for template notes
 *
 * Template notes serve as templates for creating new notes with predefined structure.
 *
 * @param note - The note to check
 * @returns `true` if the note is a template note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isTemplateNote(note)) {
 *   // note is now typed as TemplateNote
 *   // Use this template to create a new note
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isTemplateNote(note: Note): note is TemplateNote {
  return note.type === 'template';
}

/**
 * Type guard for system notes
 *
 * System notes are reserved for special system-level functionality.
 * They typically don't have user-editable content.
 *
 * @param note - The note to check
 * @returns `true` if the note is a system note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isSystemNote(note)) {
 *   // note is now typed as SystemNote
 *   // Handle system-specific behavior
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isSystemNote(note: Note): note is SystemNote {
  return note.type === 'system';
}

/**
 * Type guard for daily notes
 *
 * Daily notes are journal entries tied to a specific date, with additional
 * date-related metadata in the `daily` field.
 *
 * @param note - The note to check
 * @returns `true` if the note is a daily note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isDailyNote(note)) {
 *   // note is now typed as DailyNote
 *   console.log(`Daily note for: ${note.daily.date}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isDailyNote(note: Note): note is DailyNote {
  return note.type === 'daily';
}

/**
 * Type guard for meeting notes
 *
 * Meeting notes are tied to a specific date and daily note, with attendee information
 * in the `meeting` field.
 *
 * @param note - The note to check
 * @returns `true` if the note is a meeting note, with TypeScript narrowing applied
 *
 * @example
 * ```typescript
 * if (isMeetingNote(note)) {
 *   // note is now typed as MeetingNote
 *   console.log(`Meeting attendees: ${note.meeting.attendees.length}`);
 * }
 * ```
 *
 * @since 1.0.0
 */
export function isMeetingNote(note: Note): note is MeetingNote {
  return note.type === 'meeting';
}

// ============================================================================
// Vault Configuration
// ============================================================================

/**
 * Vault configuration
 *
 * Configuration settings for a vault (the directory containing all notes).
 * Stored in the vault's configuration file and used for initialization.
 *
 * @example
 * ```typescript
 * const config: VaultConfig = {
 *   path: createVaultPath('/Users/name/Documents/my-vault'),
 *   version: '1.0.0'
 * };
 * ```
 *
 * @since 1.0.0
 */
export interface VaultConfig {
  /** Absolute path to the vault directory */
  path: VaultPath;
  /**
   * Schema version for the vault format.
   * Used for migration when vault format changes.
   */
  version: string;
}
