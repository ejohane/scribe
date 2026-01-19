/**
 * useNoteSearch Hook
 *
 * Handles server-side FTS5 note search with debouncing.
 * Used by the command palette when in note search view.
 *
 * @module
 */

import { useQuery } from '@tanstack/react-query';
import { useTrpc } from '../../providers/ScribeProvider';
import { NOTE_SEARCH_DEBOUNCE_MS, SEARCH_RESULTS_LIMIT, type NoteItem } from './types';
import { useDebouncedValue } from './useDebouncedValue';

/**
 * Hook to search notes using FTS5 with debouncing.
 *
 * @param query - Search query string
 * @param enabled - Whether to enable the search
 * @returns Query result with search results and loading state
 *
 * @example
 * ```tsx
 * const { data: searchResults, isLoading } = useNoteSearch(query, isOpen);
 * ```
 */
export function useNoteSearch(query: string, enabled: boolean = true) {
  const trpc = useTrpc();
  const debouncedQuery = useDebouncedValue(query, NOTE_SEARCH_DEBOUNCE_MS);

  const shouldSearch = enabled && debouncedQuery.length >= 2;

  return useQuery({
    queryKey: ['search', 'notes', debouncedQuery],
    queryFn: async () => {
      if (!debouncedQuery) return [];

      const results = await trpc.search.query.query({
        text: debouncedQuery,
        options: {
          limit: SEARCH_RESULTS_LIMIT,
          snippetLength: 128,
        },
      });

      return results.map(
        (result): NoteItem => ({
          type: 'note',
          id: result.note.id,
          label: result.note.title,
          noteType: result.note.type,
          updatedAt: result.note.updatedAt,
          snippet: result.snippet,
          icon: getNoteIcon(result.note.type),
          description: result.snippet,
        })
      );
    },
    enabled: shouldSearch,
    staleTime: 60_000, // 1 minute
    gcTime: 5 * 60_000, // 5 minutes
  });
}

/**
 * Get the Lucide icon name for a note type.
 */
function getNoteIcon(noteType: 'note' | 'daily' | 'meeting' | 'person'): string {
  switch (noteType) {
    case 'daily':
      return 'Calendar';
    case 'meeting':
      return 'Users';
    case 'person':
      return 'User';
    case 'note':
    default:
      return 'FileText';
  }
}
