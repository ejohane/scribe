import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSyncStatus, formatRelativeTime } from './useSyncStatus';
import type { SyncStatus, SyncConflict, ConflictResolution } from '@scribe/shared';

// Mock the window.scribe.sync API
const mockSyncAPI = {
  getStatus: vi.fn(),
  trigger: vi.fn(),
  getConflicts: vi.fn(),
  resolveConflict: vi.fn(),
  onStatusChange: vi.fn(),
  enable: vi.fn(),
  disable: vi.fn(),
};

// Store the status change callback for manual triggering
let statusChangeCallback: ((status: SyncStatus) => void) | null = null;

beforeEach(() => {
  // Reset mocks
  vi.resetAllMocks();

  // Setup default mock implementations
  mockSyncAPI.getStatus.mockResolvedValue({
    state: 'idle',
    pendingChanges: 0,
    conflictCount: 0,
  } satisfies SyncStatus);

  mockSyncAPI.getConflicts.mockResolvedValue([]);
  mockSyncAPI.trigger.mockResolvedValue({ pushed: 0, pulled: 0, conflicts: 0, errors: [] });
  mockSyncAPI.resolveConflict.mockResolvedValue({ success: true });

  // Capture the status change callback
  mockSyncAPI.onStatusChange.mockImplementation((callback) => {
    statusChangeCallback = callback;
    return vi.fn(); // Return unsubscribe function
  });

  // Setup window.scribe mock
  (window as unknown as { scribe: { sync: typeof mockSyncAPI } }).scribe = {
    sync: mockSyncAPI,
  };
});

afterEach(() => {
  statusChangeCallback = null;
});

describe('useSyncStatus', () => {
  describe('initial state', () => {
    it('should load initial status on mount', async () => {
      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(mockSyncAPI.getStatus).toHaveBeenCalledTimes(1);
        expect(mockSyncAPI.getConflicts).toHaveBeenCalledTimes(1);
      });

      expect(result.current.isEnabled).toBe(true);
      expect(result.current.state).toBe('synced');
    });

    it('should set isEnabled false when state is disabled', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'disabled',
        pendingChanges: 0,
        conflictCount: 0,
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.isEnabled).toBe(false);
        expect(result.current.state).toBe('disabled');
      });
    });

    it('should handle initial load error gracefully', async () => {
      mockSyncAPI.getStatus.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.error).toBe('Network error');
      });
    });
  });

  describe('state computation', () => {
    it('should return disabled when sync is not enabled', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'disabled',
        pendingChanges: 0,
        conflictCount: 0,
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.state).toBe('disabled');
      });
    });

    it('should return conflict when there are unresolved conflicts', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'idle',
        pendingChanges: 0,
        conflictCount: 1,
      });
      mockSyncAPI.getConflicts.mockResolvedValue([
        {
          noteId: 'note-1',
          localNote: {},
          remoteNote: {},
          localVersion: 2,
          remoteVersion: 3,
          detectedAt: Date.now(),
          type: 'edit',
        },
      ] as SyncConflict[]);

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.state).toBe('conflict');
        expect(result.current.conflicts).toHaveLength(1);
      });
    });

    it('should return error when sync has error', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'error',
        pendingChanges: 0,
        conflictCount: 0,
        error: 'Server unavailable',
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.state).toBe('error');
        expect(result.current.error).toBe('Server unavailable');
      });
    });

    it('should return syncing when sync is in progress', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'syncing',
        pendingChanges: 5,
        conflictCount: 0,
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.state).toBe('syncing');
        expect(result.current.isSyncing).toBe(true);
      });
    });

    it('should return pending when there are unsynced changes', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'idle',
        pendingChanges: 3,
        conflictCount: 0,
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.state).toBe('pending');
        expect(result.current.pendingCount).toBe(3);
      });
    });

    it('should return offline when network is unavailable', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'offline',
        pendingChanges: 0,
        conflictCount: 0,
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.state).toBe('offline');
      });
    });

    it('should return synced when all is well', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'idle',
        pendingChanges: 0,
        conflictCount: 0,
        lastSyncAt: Date.now(),
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.state).toBe('synced');
      });
    });
  });

  describe('status change subscription', () => {
    it('should subscribe to status changes on mount', async () => {
      renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(mockSyncAPI.onStatusChange).toHaveBeenCalledTimes(1);
      });
    });

    it('should update state when status changes', async () => {
      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.state).toBe('synced');
      });

      // Simulate status change
      act(() => {
        statusChangeCallback?.({
          state: 'syncing',
          pendingChanges: 2,
          conflictCount: 0,
        });
      });

      expect(result.current.state).toBe('syncing');
      expect(result.current.isSyncing).toBe(true);
    });

    it('should update lastSyncAt when status includes it', async () => {
      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.lastSyncAt).toBeNull();
      });

      const syncTime = Date.now();
      act(() => {
        statusChangeCallback?.({
          state: 'idle',
          pendingChanges: 0,
          conflictCount: 0,
          lastSyncAt: syncTime,
        });
      });

      expect(result.current.lastSyncAt).toBe(syncTime);
    });

    it('should clear error when state transitions from error', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'error',
        pendingChanges: 0,
        conflictCount: 0,
        error: 'Initial error',
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.error).toBe('Initial error');
      });

      act(() => {
        statusChangeCallback?.({
          state: 'idle',
          pendingChanges: 0,
          conflictCount: 0,
        });
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('syncNow', () => {
    it('should trigger sync when called', async () => {
      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.isEnabled).toBe(true);
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(mockSyncAPI.trigger).toHaveBeenCalledTimes(1);
    });

    it('should not trigger sync when disabled', async () => {
      mockSyncAPI.getStatus.mockResolvedValue({
        state: 'disabled',
        pendingChanges: 0,
        conflictCount: 0,
      });

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.isEnabled).toBe(false);
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(mockSyncAPI.trigger).not.toHaveBeenCalled();
    });

    it('should refresh conflicts after sync', async () => {
      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(mockSyncAPI.getConflicts).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.syncNow();
      });

      // Should be called twice: initial load + after sync
      expect(mockSyncAPI.getConflicts).toHaveBeenCalledTimes(2);
    });

    it('should set error on sync failure', async () => {
      mockSyncAPI.trigger.mockRejectedValue(new Error('Sync failed'));

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.isEnabled).toBe(true);
      });

      await act(async () => {
        await result.current.syncNow();
      });

      expect(result.current.error).toBe('Sync failed');
    });
  });

  describe('resolveConflict', () => {
    it('should resolve conflict and remove from list', async () => {
      mockSyncAPI.getConflicts.mockResolvedValue([
        {
          noteId: 'note-1',
          localNote: {},
          remoteNote: {},
          localVersion: 2,
          remoteVersion: 3,
          detectedAt: Date.now(),
          type: 'edit',
        },
      ] as SyncConflict[]);

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.conflicts).toHaveLength(1);
      });

      await act(async () => {
        await result.current.resolveConflict('note-1', { type: 'keep_local' });
      });

      expect(mockSyncAPI.resolveConflict).toHaveBeenCalledWith('note-1', { type: 'keep_local' });
      expect(result.current.conflicts).toHaveLength(0);
    });

    it('should handle resolve conflict error', async () => {
      mockSyncAPI.getConflicts.mockResolvedValue([
        {
          noteId: 'note-1',
          localNote: {},
          remoteNote: {},
          localVersion: 2,
          remoteVersion: 3,
          detectedAt: Date.now(),
          type: 'edit',
        },
      ] as SyncConflict[]);
      mockSyncAPI.resolveConflict.mockRejectedValue(new Error('Resolution failed'));

      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(result.current.conflicts).toHaveLength(1);
      });

      await act(async () => {
        await result.current.resolveConflict('note-1', { type: 'keep_remote' });
      });

      expect(result.current.error).toBe('Resolution failed');
      // Conflict should still be in list on error
      expect(result.current.conflicts).toHaveLength(1);
    });
  });

  describe('refresh', () => {
    it('should reload initial state', async () => {
      const { result } = renderHook(() => useSyncStatus());

      await waitFor(() => {
        expect(mockSyncAPI.getStatus).toHaveBeenCalledTimes(1);
      });

      await act(async () => {
        await result.current.refresh();
      });

      expect(mockSyncAPI.getStatus).toHaveBeenCalledTimes(2);
      expect(mockSyncAPI.getConflicts).toHaveBeenCalledTimes(2);
    });
  });
});

describe('formatRelativeTime', () => {
  it('should return "just now" for recent timestamps', () => {
    const now = Date.now();
    expect(formatRelativeTime(now)).toBe('just now');
    expect(formatRelativeTime(now - 30000)).toBe('just now'); // 30 seconds
  });

  it('should return minutes ago', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 60000)).toBe('1 minute ago');
    expect(formatRelativeTime(now - 120000)).toBe('2 minutes ago');
    expect(formatRelativeTime(now - 300000)).toBe('5 minutes ago');
  });

  it('should return hours ago', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 3600000)).toBe('1 hour ago');
    expect(formatRelativeTime(now - 7200000)).toBe('2 hours ago');
  });

  it('should return days ago', () => {
    const now = Date.now();
    expect(formatRelativeTime(now - 86400000)).toBe('1 day ago');
    expect(formatRelativeTime(now - 172800000)).toBe('2 days ago');
  });
});
