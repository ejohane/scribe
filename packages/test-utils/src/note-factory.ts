/**
 * Test Note Factory
 *
 * Unified factory functions for creating test notes across the Scribe codebase.
 * These utilities consolidate the various createTestNote implementations that were
 * scattered across different test files.
 *
 * @module @scribe/test-utils/note-factory
 */

import type {
  Note,
  NoteType,
  NoteMetadata,
  EditorContent,
  EditorNode,
  RegularNote,
  PersonNote,
  ProjectNote,
  TemplateNote,
  SystemNote,
  DailyNote,
  MeetingNote,
  DailyNoteData,
  MeetingNoteData,
} from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// ============================================================================
// Factory Input Types
// ============================================================================

/**
 * Options for creating a test note with the full options interface.
 * Used by createTestNote for detailed control over note properties.
 */
export interface TestNoteOptions {
  /** Unique identifier for the note (will be branded as NoteId) */
  id: string;
  /** Note title */
  title: string;
  /** Note type discriminator */
  type?: NoteType;
  /** User-defined tags */
  tags?: string[];
  /** Outbound links (note IDs) */
  links?: string[];
  /** Person mentions (person note IDs) */
  mentions?: string[];
  /** Rich text content */
  content?: EditorContent;
  /** Creation timestamp (defaults to Date.now()) */
  createdAt?: number;
  /** Update timestamp (defaults to Date.now()) */
  updatedAt?: number;
  /** Daily note data (required if type is 'daily') */
  daily?: DailyNoteData;
  /** Meeting note data (required if type is 'meeting') */
  meeting?: MeetingNoteData;
}

/**
 * Simplified input for creating mock notes in component tests.
 * Used by createMockNote for quick mock creation.
 */
export interface MockNoteInput {
  /** Unique identifier for the note */
  id: string;
  /** Note title (defaults to 'Untitled') */
  title?: string;
  /** Creation timestamp */
  createdAt?: number;
  /** Update timestamp */
  updatedAt?: number;
  /** Note type discriminator */
  type?: NoteType;
  /** User-defined tags */
  tags?: string[];
  /** Rich text content */
  content?: EditorContent;
  /** Partial metadata overrides */
  metadata?: Partial<NoteMetadata>;
  /** Daily note data */
  daily?: DailyNoteData;
  /** Meeting note data */
  meeting?: MeetingNoteData;
}

/**
 * Metadata input for graph engine tests.
 * Provides a convenient way to specify metadata with plain string arrays.
 */
export interface TestMetadataInput {
  /** Note title (null for untitled notes) */
  title: string | null;
  /** Inline #tags extracted from content */
  tags: string[];
  /** Outbound links (plain string IDs, will be converted to NoteId) */
  links: string[];
  /** Person mentions (plain string IDs, will be converted to NoteId) */
  mentions: string[];
  /** Note type discriminator */
  type?: NoteType;
}

// ============================================================================
// Content Helpers
// ============================================================================

/**
 * Create an empty editor content structure.
 */
export function createEmptyContent(): EditorContent {
  return {
    root: {
      type: 'root',
      children: [],
    },
  };
}

/**
 * Create a text node for use in editor content.
 */
export function createTextNode(text: string, format = 0): EditorNode {
  return {
    type: 'text',
    format,
    style: '',
    mode: 'normal',
    detail: 0,
    text,
  };
}

/**
 * Create a Lexical content structure from plain text.
 * Wraps the text in a paragraph node.
 */
export function createLexicalContent(text: string): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: text
        ? [
            {
              type: 'paragraph',
              format: '',
              indent: 0,
              children: [createTextNode(text)],
            },
          ]
        : [],
    },
  };
}

/**
 * Create a Lexical content with a checklist item (task).
 */
export function createLexicalContentWithTask(taskText: string, checked = false): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: [
        {
          type: 'listitem',
          format: '',
          indent: 0,
          value: 1,
          listType: 'check',
          checked,
          children: [createTextNode(taskText)],
        },
      ],
    },
  };
}

/**
 * Create a Lexical content with a heading.
 */
export function createLexicalContentWithHeading(
  headingText: string,
  level: 1 | 2 | 3 | 4 | 5 | 6 = 1
): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: [
        {
          type: 'heading',
          format: '',
          indent: 0,
          tag: `h${level}`,
          children: [createTextNode(headingText)],
        },
      ],
    },
  };
}

/**
 * Create a Lexical content with a wiki-link.
 */
export function createLexicalContentWithWikiLink(
  beforeText: string,
  targetTitle: string,
  targetId: string,
  afterText = ''
): EditorContent {
  const children: EditorNode[] = [];

  if (beforeText) {
    children.push(createTextNode(beforeText));
  }

  children.push({
    type: 'wiki-link',
    targetTitle,
    targetId,
  });

  if (afterText) {
    children.push(createTextNode(afterText));
  }

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          children,
        },
      ],
    },
  };
}

/**
 * Create a Lexical content with a person mention.
 */
export function createLexicalContentWithMention(
  beforeText: string,
  personName: string,
  personId: string,
  afterText = ''
): EditorContent {
  const children: EditorNode[] = [];

  if (beforeText) {
    children.push(createTextNode(beforeText));
  }

  children.push({
    type: 'person-mention',
    personName,
    personId,
  });

  if (afterText) {
    children.push(createTextNode(afterText));
  }

  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children: [
        {
          type: 'paragraph',
          format: '',
          indent: 0,
          children,
        },
      ],
    },
  };
}

// ============================================================================
// Node Data Types (for test content structures)
// ============================================================================

/**
 * Type definition for a wiki-link node in Lexical content.
 * Used for creating type-safe wiki-link nodes in tests without `as any` assertions.
 */
export interface WikiLinkNodeData {
  type: 'wiki-link';
  noteTitle: string;
  displayText: string;
  targetId: string | null;
  version: number;
}

/**
 * Creates a typed wiki-link node for use in test content structures.
 *
 * @param noteTitle - The target note's title (used for resolution)
 * @param displayText - What to display (alias or title), defaults to noteTitle
 * @param targetId - Resolved note ID, or null if unresolved
 * @returns A typed WikiLinkNodeData object
 *
 * @example
 * ```ts
 * const unresolved = createWikiLinkNode('New Note');
 * const resolved = createWikiLinkNode('Target Note', 'Target Note', targetNote.id);
 * ```
 */
export function createWikiLinkNode(
  noteTitle: string,
  displayText: string = noteTitle,
  targetId: string | null = null
): WikiLinkNodeData {
  return { type: 'wiki-link', noteTitle, displayText, targetId, version: 1 };
}

/**
 * Type definition for a person-mention node in Lexical content.
 * Used for creating type-safe person-mention nodes in tests.
 */
export interface PersonMentionNodeData {
  type: 'person-mention';
  personId: string;
  personName: string;
  version: number;
}

/**
 * Creates a typed person-mention node for use in test content structures.
 *
 * @param personId - The ID of the person being mentioned
 * @param personName - The display name of the person
 * @returns A typed PersonMentionNodeData object
 */
export function createPersonMentionNode(
  personId: string,
  personName: string
): PersonMentionNodeData {
  return { type: 'person-mention', personId, personName, version: 1 };
}

/**
 * Creates Lexical content for a note that mentions a person.
 *
 * @param title - The note's title
 * @param personId - The ID of the person being mentioned
 * @param personName - The display name of the person
 * @returns EditorContent with person-mention node
 */
export function createNoteWithMention(
  title: string,
  personId: string,
  personName: string
): EditorContent {
  return {
    root: {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: title }] },
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Meeting with ' },
            createPersonMentionNode(personId, personName) as unknown as EditorNode,
          ],
        },
      ],
    },
  };
}

/**
 * Creates Lexical content for a note with multiple person mentions.
 *
 * @param title - The note's title
 * @param mentions - Array of person mentions with id and name
 * @returns EditorContent with multiple person-mention nodes
 */
export function createNoteWithMultipleMentions(
  title: string,
  mentions: Array<{ personId: string; personName: string }>
): EditorContent {
  const mentionNodes = mentions.flatMap((m, i) => {
    const nodes: EditorNode[] = [
      createPersonMentionNode(m.personId, m.personName) as unknown as EditorNode,
    ];
    if (i < mentions.length - 1) {
      nodes.push({ type: 'text', text: ' and ' } as EditorNode);
    }
    return nodes;
  });

  return {
    root: {
      type: 'root',
      children: [
        { type: 'paragraph', children: [{ type: 'text', text: title }] },
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Meeting with ' } as EditorNode, ...mentionNodes],
        },
      ],
    },
  };
}

// ============================================================================
// Metadata Helpers
// ============================================================================

/**
 * Create NoteMetadata with proper branded types.
 * Converts plain string arrays to branded NoteId arrays.
 */
export function createTestMetadata(input: TestMetadataInput): NoteMetadata {
  return {
    title: input.title,
    tags: input.tags,
    links: input.links.map(createNoteId),
    mentions: input.mentions.map(createNoteId),
    type: input.type,
  };
}

// ============================================================================
// Shared Type Variant Builder
// ============================================================================

/**
 * Internal interface for base note structure.
 * @internal
 */
interface BaseNoteShape {
  id: ReturnType<typeof createNoteId>;
  title: string;
  createdAt: number;
  updatedAt: number;
  tags: string[];
  content: EditorContent;
  metadata: NoteMetadata;
}

/**
 * Options for building typed note variants.
 * @internal
 */
interface TypeVariantOptions {
  daily?: DailyNoteData;
  meeting?: MeetingNoteData | { date: string; dailyNoteId: string; attendees: string[] };
}

/**
 * Builds a properly typed Note variant from a base note object.
 *
 * This internal helper eliminates the duplicated switch statements across
 * createTestNote, createMockNote, and createGraphTestNote by centralizing
 * the discriminated union variant logic.
 *
 * @internal
 * @param baseNote - The base note object with common properties
 * @param noteType - The note type discriminator (or undefined for RegularNote)
 * @param options - Type-specific data (daily, meeting)
 * @returns A properly typed Note based on noteType
 */
function buildTypedNote(
  baseNote: BaseNoteShape,
  noteType: NoteType | undefined,
  options?: TypeVariantOptions
): Note {
  const defaultDate = () => new Date().toISOString().split('T')[0];

  if (noteType === 'daily') {
    return {
      ...baseNote,
      type: 'daily',
      daily: options?.daily ?? { date: defaultDate() },
    } as DailyNote;
  }

  if (noteType === 'meeting') {
    const meetingData = options?.meeting;
    if (meetingData && 'dailyNoteId' in meetingData) {
      // Handle both branded NoteId and plain string formats
      const dailyNoteId =
        typeof meetingData.dailyNoteId === 'string'
          ? createNoteId(meetingData.dailyNoteId)
          : meetingData.dailyNoteId;
      const attendees = (meetingData.attendees as unknown[]).map((a) =>
        typeof a === 'string' ? createNoteId(a) : (a as ReturnType<typeof createNoteId>)
      );
      return {
        ...baseNote,
        type: 'meeting',
        meeting: { date: meetingData.date, dailyNoteId, attendees },
      } as MeetingNote;
    }
    return {
      ...baseNote,
      type: 'meeting',
      meeting: { date: defaultDate(), dailyNoteId: createNoteId(''), attendees: [] },
    } as MeetingNote;
  }

  if (noteType === 'person') {
    return { ...baseNote, type: 'person' } as PersonNote;
  }

  if (noteType === 'project') {
    return { ...baseNote, type: 'project' } as ProjectNote;
  }

  if (noteType === 'template') {
    return { ...baseNote, type: 'template' } as TemplateNote;
  }

  if (noteType === 'system') {
    return { ...baseNote, type: 'system' } as SystemNote;
  }

  // Regular note (no type)
  return { ...baseNote, type: undefined } as RegularNote;
}

// ============================================================================
// Note Factory Functions
// ============================================================================

/**
 * Create a test note with explicit options.
 *
 * This is the primary factory function for creating test notes with full control
 * over all properties. Use this when you need precise control over note structure.
 *
 * @param options - Note creation options
 * @returns A properly typed Note based on the type option
 *
 * @example
 * ```typescript
 * // Create a regular note
 * const note = createTestNote({
 *   id: 'note-1',
 *   title: 'My Note',
 *   tags: ['test'],
 *   links: ['note-2'],
 * });
 *
 * // Create a daily note
 * const daily = createTestNote({
 *   id: 'daily-2024-01-15',
 *   title: 'January 15, 2024',
 *   type: 'daily',
 *   daily: { date: '2024-01-15' },
 * });
 * ```
 */
export function createTestNote(options: TestNoteOptions): Note {
  const now = Date.now();
  const links = (options.links ?? []).map(createNoteId);
  const mentions = (options.mentions ?? []).map(createNoteId);

  const baseNote: BaseNoteShape = {
    id: createNoteId(options.id),
    title: options.title,
    createdAt: options.createdAt ?? now,
    updatedAt: options.updatedAt ?? now,
    tags: options.tags ?? [],
    content: options.content ?? createLexicalContent(''),
    metadata: {
      title: options.title,
      tags: options.tags ?? [],
      links,
      mentions,
      type: options.type,
    },
  };

  return buildTypedNote(baseNote, options.type, {
    daily: options.daily,
    meeting: options.meeting,
  });
}

/**
 * Create a mock note for component tests.
 *
 * This is a simplified factory for component tests where you need to quickly
 * create notes with minimal boilerplate. It uses sensible defaults.
 *
 * @param overrides - Properties to set on the mock note
 * @returns A properly typed Note based on the type override
 *
 * @example
 * ```typescript
 * // Create a simple mock note
 * const note = createMockNote({ id: 'note-1', title: 'Test' });
 *
 * // Create a person note
 * const person = createMockNote({ id: 'person-1', type: 'person', title: 'Alice' });
 * ```
 */
export function createMockNote(overrides: MockNoteInput): Note {
  const now = Date.now();
  const title = overrides.title ?? overrides.metadata?.title ?? 'Untitled';

  const baseNote: BaseNoteShape = {
    id: createNoteId(overrides.id),
    title,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    tags: overrides.tags ?? [],
    content: overrides.content ?? createEmptyContent(),
    metadata: {
      title: overrides.metadata?.title ?? null,
      tags: overrides.metadata?.tags ?? [],
      links: overrides.metadata?.links ?? [],
      mentions: overrides.metadata?.mentions ?? [],
    },
  };

  return buildTypedNote(baseNote, overrides.type, {
    daily: overrides.daily,
    meeting: overrides.meeting,
  });
}

/**
 * Create a test note for graph engine tests.
 *
 * This is a specialized factory for graph-engine tests that matches the
 * existing test patterns with metadata-first API.
 *
 * @param id - Note ID (plain string, will be branded)
 * @param metadata - Metadata with plain string IDs for links/mentions
 * @param options - Additional options for typed notes
 * @returns A properly typed Note
 *
 * @example
 * ```typescript
 * const note = createGraphTestNote('note-1', {
 *   title: 'My Note',
 *   tags: ['test'],
 *   links: ['note-2', 'note-3'],
 *   mentions: [],
 * });
 * ```
 */
export function createGraphTestNote(
  id: string,
  metadata: TestMetadataInput,
  options?: {
    type?: NoteType;
    meeting?: { date: string; dailyNoteId: string; attendees: string[] };
    daily?: { date: string };
  }
): Note {
  const typedMetadata = createTestMetadata(metadata);
  const noteType = options?.type ?? metadata.type;

  const baseNote: BaseNoteShape = {
    id: createNoteId(id),
    title: metadata.title ?? 'Untitled',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: noteType
      ? { root: { type: 'root' as const, children: [] }, type: noteType }
      : { root: { type: 'root' as const, children: [] } },
    metadata: typedMetadata,
  };

  return buildTypedNote(baseNote, noteType, {
    daily: options?.daily,
    meeting: options?.meeting,
  });
}

/**
 * Create a test note from EditorContent.
 *
 * This is a specialized factory for content-extractor tests that create
 * notes from content structures.
 *
 * @param content - The EditorContent to use
 * @param overrides - Optional overrides for other note properties
 * @returns A Note with the provided content
 *
 * @example
 * ```typescript
 * const content: EditorContent = {
 *   root: {
 *     type: 'root',
 *     children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] }],
 *   },
 * };
 * const note = createContentTestNote(content, { title: 'Test Note' });
 * ```
 */
export function createContentTestNote(
  content: EditorContent,
  overrides?: Partial<Omit<Note, 'content'>>
): Note {
  return {
    id: createNoteId('test-note'),
    title: 'Test Note',
    type: undefined,
    tags: [],
    content,
    metadata: {
      title: 'Test Note',
      tags: [],
      links: [],
      mentions: [],
    },
    createdAt: 1702650000000, // Fixed timestamp for reproducible tests
    updatedAt: 1702650000000,
    ...overrides,
  } as RegularNote;
}

// ============================================================================
// Note Utilities
// ============================================================================

/**
 * Override timestamps on a note for deterministic testing.
 *
 * This utility eliminates the need for `as any` casts when setting timestamps
 * on notes for testing time-based behavior.
 *
 * @param note - The note to modify
 * @param timestamp - The timestamp to set for both createdAt and updatedAt
 * @returns The same note object (mutated)
 *
 * @example
 * ```ts
 * const note = await vault.create({ title: 'Test' });
 * const savedNote = vault.read(note.id);
 * withTimestamp(savedNote, Date.now() - 86400000); // Yesterday
 * ```
 */
export function withTimestamp<T extends { createdAt: number; updatedAt: number }>(
  note: T,
  timestamp: number
): T {
  // Use Object.assign for type-safe property assignment
  return Object.assign(note, { createdAt: timestamp, updatedAt: timestamp });
}

/**
 * Override individual timestamps on a note.
 *
 * @param note - The note to modify
 * @param options - Timestamp options
 * @returns The same note object (mutated)
 *
 * @example
 * ```ts
 * withTimestamps(note, { createdAt: yesterday, updatedAt: today });
 * ```
 */
export function withTimestamps<T extends { createdAt: number; updatedAt: number }>(
  note: T,
  options: { createdAt?: number; updatedAt?: number }
): T {
  if (options.createdAt !== undefined) {
    Object.assign(note, { createdAt: options.createdAt });
  }
  if (options.updatedAt !== undefined) {
    Object.assign(note, { updatedAt: options.updatedAt });
  }
  return note;
}
