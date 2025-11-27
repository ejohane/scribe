/**
 * PersonMentionAutocomplete Types
 *
 * Type definitions and utilities for person mention autocomplete.
 * The actual autocomplete UI is implemented inline in PersonMentionPlugin.tsx
 * as PersonMentionAutocompleteInternal.
 */

import type { NoteId } from '@scribe/shared';

/**
 * Represents a person result in the autocomplete dropdown
 */
export interface PersonResult {
  id: NoteId;
  name: string;
}

/**
 * Calculate total items count for keyboard navigation
 *
 * @param resultsCount - Number of search results
 * @param query - Current query string
 * @param hasExactMatch - Whether an exact match exists
 * @returns Total number of selectable items
 */
export function getPersonAutocompleteItemCount(
  resultsCount: number,
  query: string,
  hasExactMatch: boolean
): number {
  const showCreateOption = query.trim().length > 0 && !hasExactMatch;
  return resultsCount + (showCreateOption ? 1 : 0);
}
