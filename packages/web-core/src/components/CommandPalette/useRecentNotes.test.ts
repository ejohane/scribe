/**
 * useRecentNotes Hook Tests
 *
 * Tests for the recent notes fetching hook used by the command palette.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useRecentNotes } from './useRecentNotes';
import { RECENT_NOTES_LIMIT } from './types';

// Mock the ScribeProvider hooks
const mockTrpcRecentlyAccessed = vi.fn();

vi.mock('../../providers/ScribeProvider', () => ({
  useTrpc: () => ({
    notes: {
      recentlyAccessed: {
        query: mockTrpcRecentlyAccessed,
      },
    },
  }),
}));

// Test wrapper with QueryClient
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
    },
  });

  return function Wrapper({ children }: { children: ReactNode }) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  };
}

describe('useRecentNotes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpcRecentlyAccessed.mockResolvedValue([]);
  });

  describe('query behavior', () => {
    it('does not fetch when disabled', async () => {
      const wrapper = createWrapper();
      renderHook(() => useRecentNotes(false), { wrapper });

      // Give time for any potential fetch
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockTrpcRecentlyAccessed).not.toHaveBeenCalled();
    });

    it('fetches when enabled', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([]);

      renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(mockTrpcRecentlyAccessed).toHaveBeenCalledWith({ limit: RECENT_NOTES_LIMIT });
      });
    });

    it('fetches with correct limit', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([]);

      renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(mockTrpcRecentlyAccessed).toHaveBeenCalledWith({ limit: RECENT_NOTES_LIMIT });
      });
    });

    it('defaults to enabled when no argument provided', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([]);

      renderHook(() => useRecentNotes(), { wrapper });

      await waitFor(() => {
        expect(mockTrpcRecentlyAccessed).toHaveBeenCalled();
      });
    });
  });

  describe('data transformation', () => {
    it('transforms note data to NoteItem format', async () => {
      const wrapper = createWrapper();
      const mockNotes = [
        {
          id: 'note-1',
          title: 'First Note',
          type: 'note' as const,
          lastAccessedAt: '2024-01-15T10:00:00Z',
        },
        {
          id: 'note-2',
          title: 'Second Note',
          type: 'daily' as const,
          lastAccessedAt: '2024-01-14T09:00:00Z',
        },
      ];
      mockTrpcRecentlyAccessed.mockResolvedValue(mockNotes);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(2);
      });

      expect(result.current.data![0]).toEqual({
        type: 'note',
        id: 'note-1',
        label: 'First Note',
        noteType: 'note',
        lastAccessedAt: '2024-01-15T10:00:00Z',
        icon: 'FileText',
      });

      expect(result.current.data![1]).toEqual({
        type: 'note',
        id: 'note-2',
        label: 'Second Note',
        noteType: 'daily',
        lastAccessedAt: '2024-01-14T09:00:00Z',
        icon: 'Calendar',
      });
    });

    it('handles null lastAccessedAt', async () => {
      const wrapper = createWrapper();
      const mockNotes = [
        {
          id: 'note-1',
          title: 'Note Without Access Time',
          type: 'note' as const,
          lastAccessedAt: null,
        },
      ];
      mockTrpcRecentlyAccessed.mockResolvedValue(mockNotes);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toHaveLength(1);
      });

      expect(result.current.data![0].lastAccessedAt).toBeUndefined();
    });
  });

  describe('icon mapping', () => {
    it('returns Calendar icon for daily notes', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([
        { id: '1', title: 'Daily', type: 'daily', lastAccessedAt: null },
      ]);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(result.current.data![0].icon).toBe('Calendar');
      });
    });

    it('returns Users icon for meeting notes', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([
        { id: '1', title: 'Meeting', type: 'meeting', lastAccessedAt: null },
      ]);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(result.current.data![0].icon).toBe('Users');
      });
    });

    it('returns User icon for person notes', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([
        { id: '1', title: 'Person', type: 'person', lastAccessedAt: null },
      ]);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(result.current.data![0].icon).toBe('User');
      });
    });

    it('returns FileText icon for regular notes', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([
        { id: '1', title: 'Note', type: 'note', lastAccessedAt: null },
      ]);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(result.current.data![0].icon).toBe('FileText');
      });
    });
  });

  describe('loading state', () => {
    it('returns isLoading true while fetching', async () => {
      const wrapper = createWrapper();
      // Make the mock return a promise that we control
      let resolvePromise: (value: unknown[]) => void;
      const pendingPromise = new Promise<unknown[]>((resolve) => {
        resolvePromise = resolve;
      });
      mockTrpcRecentlyAccessed.mockReturnValue(pendingPromise);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      // Initially loading
      expect(result.current.isLoading).toBe(true);

      // Resolve the promise
      resolvePromise!([]);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });
    });
  });

  describe('empty results', () => {
    it('returns empty array when no recent notes', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([]);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(result.current.data).toEqual([]);
      });
    });
  });

  describe('caching', () => {
    it('uses correct query key', async () => {
      const wrapper = createWrapper();
      mockTrpcRecentlyAccessed.mockResolvedValue([]);

      const { result } = renderHook(() => useRecentNotes(true), { wrapper });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // The query key includes the limit, which helps with cache invalidation
      expect(mockTrpcRecentlyAccessed).toHaveBeenCalledWith({ limit: RECENT_NOTES_LIMIT });
    });
  });
});
