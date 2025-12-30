/**
 * Shared test utilities for CommandPalette tests
 *
 * This file contains:
 * - Mock note factory functions
 * - Default mock commands
 * - Shared constants
 * - Helper functions
 * - CSS class name exports for testing
 * - Test IDs for component selection
 */

import { vi } from 'vitest';
import type {
  Note,
  RegularNote,
  DailyNote,
  MeetingNote,
  NoteType,
  DailyNoteData,
  MeetingNoteData,
  ScribeAPI,
  RecentOpenRecord,
  RecentOpenEntityType,
} from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import type { Command } from '../../commands/types';
import type { MockScribeAPI } from '../../types/scribe';
import * as styles from './CommandPalette.css';

// Re-export styles for use in tests
export { styles };

// Test IDs for data-testid attributes - use these instead of placeholder text
export const TEST_IDS = {
  /** Main command palette container - also has data-mode attribute */
  container: 'command-palette',
  /** Search/filter input field */
  input: 'command-palette-input',
  /** Back button (visible in file-browse, delete-browse, person-browse modes) */
  backButton: 'command-palette-back-button',
  /** Results container */
  results: 'command-palette-results',
} as const;

// CSS class selector helpers for tests
export const CSS = {
  paletteItem: `.${styles.paletteItem}`,
  paletteItemSelected: `.${styles.paletteItemSelected}`,
  resultsContainer: `.${styles.resultsContainer}`,
  noResults: `.${styles.noResults}`,
  deleteIcon: `.${styles.deleteIcon}`,
  deleteConfirmation: `.${styles.deleteConfirmation}`,
  cancelButton: `.${styles.cancelButton}`,
  confirmButton: `.${styles.confirmButton}`,
  backButton: `.${styles.backButton}`,
  paletteInput: `.${styles.paletteInput}`,
  overlayPositioning: `.${styles.overlayPositioning}`,
};

// Base timestamps for creating ordered notes
export const BASE_TIME = Date.now();

/**
 * Input type for creating mock notes
 */
interface MockNoteInput {
  id: string;
  title?: string;
  createdAt?: number;
  updatedAt?: number;
  type?: NoteType;
  tags?: string[];
  content?: Note['content'];
  metadata?: Partial<Note['metadata']>;
  daily?: DailyNoteData;
  meeting?: MeetingNoteData;
}

/**
 * Helper to create mock notes with specific properties
 * Matches production note creation pattern from storage.ts
 * Properly constructs discriminated union variants based on type
 */
export function createMockNote(overrides: MockNoteInput): Note {
  const now = Date.now();
  // Use explicit title or fallback to 'Untitled' (matches production pattern)
  const title = overrides.title ?? overrides.metadata?.title ?? 'Untitled';

  const baseNote = {
    id: createNoteId(overrides.id),
    title,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    tags: overrides.tags ?? [],
    content: overrides.content ?? {
      root: {
        type: 'root' as const,
        children: [],
      },
    },
    metadata: {
      title: overrides.metadata?.title ?? null,
      tags: overrides.metadata?.tags ?? [],
      links: overrides.metadata?.links ?? [],
      mentions: overrides.metadata?.mentions ?? [],
    },
  };

  // Build proper discriminated union variant based on type
  if (overrides.type === 'daily') {
    return {
      ...baseNote,
      type: 'daily',
      daily: overrides.daily ?? { date: new Date().toISOString().split('T')[0] },
    } as DailyNote;
  }

  if (overrides.type === 'meeting') {
    return {
      ...baseNote,
      type: 'meeting',
      meeting: overrides.meeting ?? {
        date: new Date().toISOString().split('T')[0],
        dailyNoteId: createNoteId(''),
        attendees: [],
      },
    } as MeetingNote;
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

  // Regular note (no type)
  return baseNote as RegularNote;
}

/**
 * Default mock commands for tests
 */
export const mockCommands: Command[] = [
  {
    id: 'new-note',
    title: 'New Note',
    description: 'Create a new note',
    run: vi.fn(),
  },
  {
    id: 'open-note',
    title: 'Open Note',
    description: 'Open an existing note',
    run: vi.fn(),
  },
];

/**
 * Setup default window.scribe mock with type-safe partial mock.
 * Uses MockScribeAPI to allow partial mocking without `any`.
 *
 * @param overrides - Optional partial mock to merge with defaults
 */
export function setupScribeMock(overrides?: MockScribeAPI): void {
  const defaultMock: MockScribeAPI = {
    notes: {
      list: vi.fn().mockResolvedValue([]),
    },
    search: {
      query: vi.fn().mockResolvedValue([]),
    },
    recentOpens: {
      getRecent: vi.fn().mockResolvedValue([]),
      recordOpen: vi.fn().mockResolvedValue(undefined),
      removeTracking: vi.fn().mockResolvedValue(undefined),
    },
  };

  const mock: MockScribeAPI = overrides ? { ...defaultMock, ...overrides } : defaultMock;

  window.scribe = mock as ScribeAPI;
}

/**
 * Helper to wait for debounce (real timers)
 */
export const waitForDebounce = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 200)); // 150ms debounce + buffer

/**
 * Create a RecentOpenRecord from a note.
 * Determines entity type from note.type and uses updatedAt as openedAt.
 */
export function createRecentOpenRecord(note: Note): RecentOpenRecord {
  let entityType: RecentOpenEntityType = 'note';
  if (note.type === 'daily') entityType = 'daily';
  else if (note.type === 'meeting') entityType = 'meeting';
  else if (note.type === 'person') entityType = 'person';

  return {
    entityId: note.id,
    entityType,
    openedAt: note.updatedAt,
  };
}

/**
 * Create RecentOpenRecords from an array of notes.
 * Useful for setting up recentOpens.getRecent mock in tests.
 */
export function createRecentOpenRecords(notes: Note[]): RecentOpenRecord[] {
  return notes.map(createRecentOpenRecord);
}

/**
 * Setup notes with corresponding recent opens for file-browse mode tests.
 * This helper mocks both notes.list and recentOpens.getRecent in sync.
 *
 * @param notes - Notes to set up
 * @param recentLimit - Number of most recent notes to include in recent opens (default: 10)
 */
export function setupNotesWithRecentOpens(notes: Note[], recentLimit = 10): void {
  // Sort by updatedAt desc and take top N for recent opens
  const recentNotes = [...notes].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, recentLimit);
  const recentRecords = createRecentOpenRecords(recentNotes);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scribe = (window as any).scribe;
  scribe.notes.list = vi.fn().mockResolvedValue(notes);
  scribe.recentOpens.getRecent = vi.fn().mockResolvedValue(recentRecords);
}
