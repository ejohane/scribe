/**
 * Notes Command Helpers
 *
 * Shared utilities for notes commands including fuzzy matching and formatting.
 */

import type { Note, NoteType } from '@scribe/shared';

// Re-export fuzzy search utilities from @scribe/shared for backwards compatibility
// These were previously defined here but are now centralized in the shared package
export { levenshteinDistance, fuzzyMatchScore, exactSubstringMatch } from '@scribe/shared';

// Re-export date parsing from @scribe/shared
// parseDateToTimestamp is equivalent to the old parseDate (returns number)
export { parseDateToTimestamp as parseDate } from '@scribe/shared';

// ============================================================================
// Types
// ============================================================================

/**
 * Note type filter values
 * Matches NoteType from @scribe/shared but includes 'regular' for undefined types
 */
export type NoteTypeFilter =
  | 'regular'
  | 'person'
  | 'project'
  | 'meeting'
  | 'daily'
  | 'template'
  | 'system';

/**
 * Sort field options for notes list
 */
export type SortField = 'created' | 'updated' | 'title';

/**
 * Sort order options
 */
export type SortOrder = 'asc' | 'desc';

/**
 * Valid note types for update command
 */
export const VALID_NOTE_TYPES = ['regular', 'person', 'meeting'] as const;
export type ValidNoteType = (typeof VALID_NOTE_TYPES)[number];

// ============================================================================
// Formatting Utilities
// ============================================================================

/**
 * Format a note for list output (subset of fields)
 */
export function formatNoteForList(note: Note) {
  return {
    id: note.id,
    title: note.title,
    type: note.type ?? 'regular',
    tags: note.tags || [],
    createdAt: new Date(note.createdAt).toISOString(),
    updatedAt: new Date(note.updatedAt).toISOString(),
    linkCount: note.metadata?.links?.length || 0,
  };
}

/**
 * Get a sort function based on field and order
 */
export function getSortFunction(field: SortField, order: SortOrder) {
  const multiplier = order === 'asc' ? 1 : -1;
  return (a: Note, b: Note): number => {
    switch (field) {
      case 'title':
        return multiplier * a.title.localeCompare(b.title);
      case 'created':
        return multiplier * (a.createdAt - b.createdAt);
      case 'updated':
      default:
        return multiplier * (a.updatedAt - b.updatedAt);
    }
  };
}

// ============================================================================
// Tag Utilities
// ============================================================================

/**
 * Normalize a tag to ensure it starts with #
 */
export function normalizeTag(tag: string): string {
  const trimmed = tag.trim();
  return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
}

/**
 * Parse comma-separated tags and normalize them
 */
export function parseTags(tagsStr: string): string[] {
  return tagsStr
    .split(',')
    .map((t) => normalizeTag(t))
    .filter((t) => t.length > 1); // Filter out empty tags (just '#')
}

/**
 * Map 'regular' type to undefined (regular notes have no type in the system)
 */
export function mapNoteType(type: string): NoteType | undefined {
  return type === 'regular' ? undefined : (type as NoteType);
}
