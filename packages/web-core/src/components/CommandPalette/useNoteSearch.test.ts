/**
 * useNoteSearch Hook Tests
 *
 * Tests for the note search hook with FTS5 and debouncing.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createElement, type ReactNode } from 'react';
import { useNoteSearch } from './useNoteSearch';
import { NOTE_SEARCH_DEBOUNCE_MS, SEARCH_RESULTS_LIMIT } from './types';

// Mock the ScribeProvider hooks
const mockTrpcSearchQuery = vi.fn();

vi.mock('../../providers/ScribeProvider', () => ({
  useTrpc: () => ({
    search: {
      query: {
        query: mockTrpcSearchQuery,
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

describe('useNoteSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockTrpcSearchQuery.mockResolvedValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('query behavior', () => {
    it('does not search when disabled', () => {
      const wrapper = createWrapper();
      renderHook(() => useNoteSearch('test query', false), { wrapper });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      expect(mockTrpcSearchQuery).not.toHaveBeenCalled();
    });

    it('does not search when query is too short (1 char)', () => {
      const wrapper = createWrapper();
      renderHook(() => useNoteSearch('a', true), { wrapper });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      expect(mockTrpcSearchQuery).not.toHaveBeenCalled();
    });

    it('does not search when query is empty', () => {
      const wrapper = createWrapper();
      renderHook(() => useNoteSearch('', true), { wrapper });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      expect(mockTrpcSearchQuery).not.toHaveBeenCalled();
    });

    it('searches when query has 2 or more characters', () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([]);

      renderHook(() => useNoteSearch('te', true), { wrapper });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      expect(mockTrpcSearchQuery).toHaveBeenCalled();
    });

    it('defaults to enabled when no second argument provided', () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([]);

      renderHook(() => useNoteSearch('test'), { wrapper });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      expect(mockTrpcSearchQuery).toHaveBeenCalled();
    });
  });

  describe('debouncing', () => {
    it('debounces subsequent query changes', () => {
      // The useNoteSearch hook uses useDebouncedValue internally.
      // The initial query is available immediately, so the first search triggers right away.
      // Subsequent changes are debounced.

      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([]);

      // Render with initial query - useDebouncedValue returns initial value immediately
      const { rerender } = renderHook(({ query }) => useNoteSearch(query, true), {
        wrapper,
        initialProps: { query: 'initial' },
      });

      // The first query triggers immediately (useDebouncedValue returns initial value on mount)
      expect(mockTrpcSearchQuery).toHaveBeenCalledTimes(1);

      // Now change the query
      mockTrpcSearchQuery.mockClear();
      rerender({ query: 'changed' });

      // The search should not have been called again yet because of debounce
      expect(mockTrpcSearchQuery).not.toHaveBeenCalled();

      // Advance time past debounce
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 50);
      });

      // Now the search should have been called with the new query
      expect(mockTrpcSearchQuery).toHaveBeenCalledTimes(1);
      expect(mockTrpcSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'changed' })
      );
    });

    it('resets debounce timer on rapid changes', () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([]);

      const { rerender } = renderHook(({ query }) => useNoteSearch(query, true), {
        wrapper,
        initialProps: { query: 'initial' },
      });

      // Clear the initial call
      mockTrpcSearchQuery.mockClear();

      // Rapidly change the query
      rerender({ query: 'first' });
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS - 100);
      });

      rerender({ query: 'second' });
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS - 100);
      });

      rerender({ query: 'third' });

      // None of these should have triggered a search yet
      expect(mockTrpcSearchQuery).not.toHaveBeenCalled();

      // Now wait for the full debounce time after the last change
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 50);
      });

      // Only the final query should have been searched
      expect(mockTrpcSearchQuery).toHaveBeenCalledTimes(1);
      expect(mockTrpcSearchQuery).toHaveBeenCalledWith(expect.objectContaining({ text: 'third' }));
    });
  });

  describe('data transformation', () => {
    it('transforms search results to NoteItem format', async () => {
      const wrapper = createWrapper();
      const mockResults = [
        {
          note: {
            id: 'note-1',
            title: 'First Note',
            type: 'note' as const,
            updatedAt: '2024-01-15T10:00:00Z',
          },
          snippet: '...matching content...',
        },
        {
          note: {
            id: 'note-2',
            title: 'Second Note',
            type: 'daily' as const,
            updatedAt: '2024-01-14T09:00:00Z',
          },
          snippet: '...another match...',
        },
      ];
      mockTrpcSearchQuery.mockResolvedValue(mockResults);

      const { result } = renderHook(() => useNoteSearch('test', true), { wrapper });

      // Advance past debounce
      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      // Wait for promise resolution
      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data).toHaveLength(2);
      expect(result.current.data![0]).toEqual({
        type: 'note',
        id: 'note-1',
        label: 'First Note',
        noteType: 'note',
        updatedAt: '2024-01-15T10:00:00Z',
        snippet: '...matching content...',
        icon: 'FileText',
        description: '...matching content...',
      });

      expect(result.current.data![1]).toEqual({
        type: 'note',
        id: 'note-2',
        label: 'Second Note',
        noteType: 'daily',
        updatedAt: '2024-01-14T09:00:00Z',
        snippet: '...another match...',
        icon: 'Calendar',
        description: '...another match...',
      });
    });
  });

  describe('icon mapping', () => {
    it('returns Calendar icon for daily notes', async () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([
        { note: { id: '1', title: 'Daily', type: 'daily', updatedAt: '' }, snippet: '' },
      ]);

      const { result } = renderHook(() => useNoteSearch('test', true), { wrapper });

      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data![0].icon).toBe('Calendar');
    });

    it('returns Users icon for meeting notes', async () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([
        { note: { id: '1', title: 'Meeting', type: 'meeting', updatedAt: '' }, snippet: '' },
      ]);

      const { result } = renderHook(() => useNoteSearch('test', true), { wrapper });

      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data![0].icon).toBe('Users');
    });

    it('returns User icon for person notes', async () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([
        { note: { id: '1', title: 'Person', type: 'person', updatedAt: '' }, snippet: '' },
      ]);

      const { result } = renderHook(() => useNoteSearch('test', true), { wrapper });

      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data![0].icon).toBe('User');
    });

    it('returns FileText icon for regular notes', async () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([
        { note: { id: '1', title: 'Note', type: 'note', updatedAt: '' }, snippet: '' },
      ]);

      const { result } = renderHook(() => useNoteSearch('test', true), { wrapper });

      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data![0].icon).toBe('FileText');
    });
  });

  describe('search parameters', () => {
    it('uses correct limit from constants', () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([]);

      renderHook(() => useNoteSearch('test query', true), { wrapper });

      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      expect(mockTrpcSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            limit: SEARCH_RESULTS_LIMIT,
          }),
        })
      );
    });

    it('uses correct snippet length', () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([]);

      renderHook(() => useNoteSearch('test query', true), { wrapper });

      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      expect(mockTrpcSearchQuery).toHaveBeenCalledWith(
        expect.objectContaining({
          options: expect.objectContaining({
            snippetLength: 128,
          }),
        })
      );
    });
  });

  describe('empty results', () => {
    it('returns empty array when no matches found', async () => {
      const wrapper = createWrapper();
      mockTrpcSearchQuery.mockResolvedValue([]);

      const { result } = renderHook(() => useNoteSearch('no match query', true), { wrapper });

      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      await act(async () => {
        await vi.runAllTimersAsync();
      });

      expect(result.current.data).toEqual([]);
    });

    it('returns undefined data when query is empty', () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useNoteSearch('', true), { wrapper });

      act(() => {
        vi.advanceTimersByTime(NOTE_SEARCH_DEBOUNCE_MS + 100);
      });

      // The query should not execute, so data should be undefined
      expect(result.current.data).toBeUndefined();
    });
  });

  describe('loading and fetching states', () => {
    it('exposes isFetching state during search', async () => {
      const wrapper = createWrapper();

      // Make the mock return a delayed promise that we control
      let resolvePromise: (value: unknown[]) => void;
      mockTrpcSearchQuery.mockImplementation(
        () =>
          new Promise<unknown[]>((resolve) => {
            resolvePromise = resolve;
          })
      );

      const { result } = renderHook(() => useNoteSearch('test', true), { wrapper });

      // Since useDebouncedValue returns initial value immediately,
      // the query should start fetching right away
      expect(result.current.isFetching).toBe(true);

      // Resolve the promise
      await act(async () => {
        resolvePromise!([]);
        await vi.runAllTimersAsync();
      });

      // Now fetching should be complete
      expect(result.current.isFetching).toBe(false);
    });

    it('returns isFetching false when search is disabled', () => {
      const wrapper = createWrapper();

      const { result } = renderHook(() => useNoteSearch('test', false), { wrapper });

      // Should not be fetching when disabled
      expect(result.current.isFetching).toBe(false);
    });
  });
});
