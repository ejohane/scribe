import { useState, useEffect, useCallback } from 'react';
import type { NoteId } from '@scribe/shared';
import type { HistoryEntry } from '../components/Sidebar';

/**
 * Custom hook for fetching history entries with their titles
 *
 * Provides:
 * - History entries with titles for sidebar display
 * - Auto-fetch when sidebar opens or history changes
 *
 * @param historyStack - Array of note IDs in the history stack
 * @param shouldFetch - Whether to fetch titles (e.g., when sidebar is open)
 */
export function useHistoryEntries(historyStack: NoteId[], shouldFetch: boolean): HistoryEntry[] {
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>([]);

  const fetchHistoryEntries = useCallback(async () => {
    if (historyStack.length === 0) {
      setHistoryEntries([]);
      return;
    }

    try {
      // Fetch all notes to get titles
      const notes = await window.scribe.notes.list();
      const noteMap = new Map(notes.map((note) => [note.id, note.title]));

      // Build history entries with titles
      const entries: HistoryEntry[] = historyStack.map((noteId) => ({
        id: noteId,
        title: noteMap.get(noteId),
      }));

      setHistoryEntries(entries);
    } catch (error) {
      console.error('Failed to fetch history entries:', error);
    }
  }, [historyStack]);

  useEffect(() => {
    if (shouldFetch) {
      fetchHistoryEntries();
    }
  }, [shouldFetch, fetchHistoryEntries]);

  return historyEntries;
}
