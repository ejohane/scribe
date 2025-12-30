import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useRecentOpens } from './useFuzzySearch';
import type { Note, RecentOpenRecord } from '@scribe/shared';

// Mock window.scribe.recentOpens
let mockGetRecent: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockGetRecent = vi.fn();

  // Mock window.scribe API
  window.scribe = {
    recentOpens: {
      getRecent: mockGetRecent,
    },
  } as unknown as typeof window.scribe;
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Helper to create mock notes
function createMockNote(id: string, title: string): Note {
  return {
    id,
    title,
    content: { root: { children: [] } },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    metadata: {
      title: null,
      tags: [],
      links: [],
      mentions: [],
    },
  } as unknown as Note;
}

describe('useRecentOpens', () => {
  describe('orphan handling', () => {
    it('filters out records with no matching note', async () => {
      // Setup: records include an ID not in allNotes
      const allNotes = [createMockNote('note-1', 'Note 1'), createMockNote('note-2', 'Note 2')];

      const records: RecentOpenRecord[] = [
        { entityId: 'note-1', entityType: 'note', openedAt: 1000 },
        { entityId: 'orphan-id', entityType: 'note', openedAt: 900 }, // Orphan
        { entityId: 'note-2', entityType: 'note', openedAt: 800 },
      ];

      mockGetRecent.mockResolvedValue(records);

      const { result } = renderHook(() =>
        useRecentOpens({ allNotes, currentNoteId: null, limit: 10 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should only have valid notes, no orphan
      expect(result.current.recentItems).toHaveLength(2);
      expect(result.current.recentItems.map((n) => n.id)).toEqual(['note-1', 'note-2']);
    });

    it('returns empty array when all records are orphaned', async () => {
      const allNotes = [createMockNote('note-1', 'Note 1')];

      const records: RecentOpenRecord[] = [
        { entityId: 'orphan-1', entityType: 'note', openedAt: 1000 },
        { entityId: 'orphan-2', entityType: 'note', openedAt: 900 },
      ];

      mockGetRecent.mockResolvedValue(records);

      const { result } = renderHook(() =>
        useRecentOpens({ allNotes, currentNoteId: null, limit: 10 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.recentItems).toHaveLength(0);
      expect(result.current.error).toBeNull();
    });

    it('preserves order after filtering orphans', async () => {
      const allNotes = [
        createMockNote('note-a', 'Note A'),
        createMockNote('note-b', 'Note B'),
        createMockNote('note-c', 'Note C'),
      ];

      // Interleaved valid and orphan records
      const records: RecentOpenRecord[] = [
        { entityId: 'note-a', entityType: 'note', openedAt: 1000 },
        { entityId: 'orphan-1', entityType: 'note', openedAt: 950 },
        { entityId: 'note-b', entityType: 'note', openedAt: 900 },
        { entityId: 'orphan-2', entityType: 'note', openedAt: 850 },
        { entityId: 'note-c', entityType: 'note', openedAt: 800 },
      ];

      mockGetRecent.mockResolvedValue(records);

      const { result } = renderHook(() =>
        useRecentOpens({ allNotes, currentNoteId: null, limit: 10 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Order should be preserved: a, b, c (in recency order)
      expect(result.current.recentItems.map((n) => n.id)).toEqual(['note-a', 'note-b', 'note-c']);
    });

    it('filters out current note', async () => {
      const allNotes = [createMockNote('note-1', 'Note 1'), createMockNote('note-2', 'Note 2')];

      const records: RecentOpenRecord[] = [
        { entityId: 'note-1', entityType: 'note', openedAt: 1000 },
        { entityId: 'note-2', entityType: 'note', openedAt: 900 },
      ];

      mockGetRecent.mockResolvedValue(records);

      const { result } = renderHook(() =>
        useRecentOpens({ allNotes, currentNoteId: 'note-1', limit: 10 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // note-1 should be filtered out as it's the current note
      expect(result.current.recentItems).toHaveLength(1);
      expect(result.current.recentItems[0].id).toBe('note-2');
    });
  });

  describe('API integration', () => {
    it('fetches recent records on mount', async () => {
      const allNotes = [createMockNote('note-1', 'Note 1')];
      mockGetRecent.mockResolvedValue([]);

      renderHook(() => useRecentOpens({ allNotes, currentNoteId: null, limit: 5 }));

      expect(mockGetRecent).toHaveBeenCalledWith(5);
    });

    it('handles API errors gracefully', async () => {
      const allNotes = [createMockNote('note-1', 'Note 1')];
      mockGetRecent.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useRecentOpens({ allNotes, currentNoteId: null, limit: 10 })
      );

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.recentItems).toEqual([]);
    });
  });
});
