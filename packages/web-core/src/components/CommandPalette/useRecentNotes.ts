/**
 * useRecentNotes Hook
 *
 * Fetches and manages recently accessed notes for the command palette.
 * Uses tRPC to fetch from the server with React Query caching.
 *
 * @module
 */

import { useQuery } from '@tanstack/react-query';
import { useTrpc } from '../../providers/ScribeProvider';
import { RECENT_NOTES_LIMIT, type NoteItem } from './types';

/**
 * Hook to fetch recently accessed notes.
 *
 * @param enabled - Whether to enable the query
 * @returns Query result with recent notes
 *
 * @example
 * ```tsx
 * const { data: recentNotes, isLoading } = useRecentNotes(isOpen);
 * ```
 */
export function useRecentNotes(enabled: boolean = true) {
  const trpc = useTrpc();

  return useQuery({
    queryKey: ['notes', 'recentlyAccessed', RECENT_NOTES_LIMIT],
    queryFn: async () => {
      const notes = await trpc.notes.recentlyAccessed.query({ limit: RECENT_NOTES_LIMIT });
      return notes.map(
        (note): NoteItem => ({
          type: 'note',
          id: note.id,
          label: note.title,
          noteType: note.type,
          lastAccessedAt: note.lastAccessedAt ?? undefined,
          icon: getNoteIcon(note.type),
        })
      );
    },
    enabled,
    staleTime: 30_000, // 30 seconds
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
