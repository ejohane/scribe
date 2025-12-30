import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SyncStatusIndicator } from './SyncStatusIndicator';
import type { SyncStatus, SyncConflict } from '@scribe/shared';

// Mock the useSyncStatus hook
vi.mock('../../hooks/useSyncStatus', () => ({
  useSyncStatus: vi.fn(),
  formatRelativeTime: (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    return `${Math.floor(diff / 3600000)} hours ago`;
  },
}));

import { useSyncStatus } from '../../hooks/useSyncStatus';

const mockUseSyncStatus = useSyncStatus as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

function createMockSyncStatus(overrides = {}) {
  return {
    isEnabled: true,
    state: 'synced' as const,
    status: null as SyncStatus | null,
    conflicts: [] as SyncConflict[],
    pendingCount: 0,
    lastSyncAt: null as number | null,
    error: null as string | null,
    isSyncing: false,
    syncNow: vi.fn(),
    resolveConflict: vi.fn(),
    refresh: vi.fn(),
    ...overrides,
  };
}

describe('SyncStatusIndicator', () => {
  describe('visibility', () => {
    it('should not render when sync is disabled', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          isEnabled: false,
          state: 'disabled',
        })
      );

      const { container } = render(<SyncStatusIndicator />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when sync is enabled', () => {
      mockUseSyncStatus.mockReturnValue(createMockSyncStatus());

      render(<SyncStatusIndicator />);
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('synced state', () => {
    it('should show checkmark and "Synced" label', () => {
      mockUseSyncStatus.mockReturnValue(createMockSyncStatus());

      render(<SyncStatusIndicator />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Synced');
      expect(button).toHaveTextContent('\u2713'); // Checkmark
    });

    it('should be disabled (not clickable)', () => {
      mockUseSyncStatus.mockReturnValue(createMockSyncStatus());

      render(<SyncStatusIndicator />);

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('syncing state', () => {
    it('should show spinner and "Syncing..." label', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'syncing',
          isSyncing: true,
        })
      );

      render(<SyncStatusIndicator />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Syncing...');
      expect(button).toHaveTextContent('\u21BB'); // Clockwise arrow
    });

    it('should be disabled while syncing', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'syncing',
          isSyncing: true,
        })
      );

      render(<SyncStatusIndicator />);

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('pending state', () => {
    it('should show pending count', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'pending',
          pendingCount: 5,
        })
      );

      render(<SyncStatusIndicator />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('5 pending');
      expect(button).toHaveTextContent('\u2191'); // Up arrow
    });

    it('should be disabled (not directly actionable)', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'pending',
          pendingCount: 3,
        })
      );

      render(<SyncStatusIndicator />);

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  describe('conflict state', () => {
    it('should show conflict count with badge', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'conflict',
          conflicts: [
            {
              noteId: 'note-1',
              localNote: {},
              remoteNote: {},
              localVersion: 2,
              remoteVersion: 3,
              detectedAt: Date.now(),
              type: 'edit',
            },
            {
              noteId: 'note-2',
              localNote: {},
              remoteNote: {},
              localVersion: 1,
              remoteVersion: 2,
              detectedAt: Date.now(),
              type: 'edit',
            },
          ] as SyncConflict[],
        })
      );

      render(<SyncStatusIndicator />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('2 conflicts');
      expect(button).toHaveTextContent('\u26A0'); // Warning triangle
    });

    it('should use singular "conflict" for count of 1', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'conflict',
          conflicts: [
            {
              noteId: 'note-1',
              localNote: {},
              remoteNote: {},
              localVersion: 2,
              remoteVersion: 3,
              detectedAt: Date.now(),
              type: 'edit',
            },
          ] as SyncConflict[],
        })
      );

      render(<SyncStatusIndicator />);

      expect(screen.getByRole('button')).toHaveTextContent('1 conflict');
    });

    it('should be clickable and call onOpenConflicts', () => {
      const onOpenConflicts = vi.fn();
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'conflict',
          conflicts: [{ noteId: 'note-1' }] as SyncConflict[],
        })
      );

      render(<SyncStatusIndicator onOpenConflicts={onOpenConflicts} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      expect(onOpenConflicts).toHaveBeenCalledTimes(1);
    });
  });

  describe('offline state', () => {
    it('should show "Offline" with X mark', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'offline',
        })
      );

      render(<SyncStatusIndicator />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Offline');
      expect(button).toHaveTextContent('\u2715'); // X mark
    });
  });

  describe('error state', () => {
    it('should show "Error" with warning icon', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'error',
          error: 'Server unavailable',
        })
      );

      render(<SyncStatusIndicator />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Error');
      expect(button).toHaveTextContent('\u26A0'); // Warning triangle
    });

    it('should be clickable and call onOpenSettings', () => {
      const onOpenSettings = vi.fn();
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'error',
          error: 'Server unavailable',
        })
      );

      render(<SyncStatusIndicator onOpenSettings={onOpenSettings} />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();

      fireEvent.click(button);
      expect(onOpenSettings).toHaveBeenCalledTimes(1);
    });

    it('should include error in tooltip', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'error',
          error: 'Server unavailable',
        })
      );

      render(<SyncStatusIndicator />);

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Sync error: Server unavailable');
    });
  });

  describe('tooltip', () => {
    it('should show last sync time when available', () => {
      const lastSyncAt = Date.now() - 300000; // 5 minutes ago
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          lastSyncAt,
        })
      );

      render(<SyncStatusIndicator />);

      expect(screen.getByRole('button')).toHaveAttribute('title', 'Last sync: 5 minutes ago');
    });

    it('should show appropriate message for conflict state', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'conflict',
          conflicts: [{ noteId: 'note-1' }] as SyncConflict[],
        })
      );

      render(<SyncStatusIndicator />);

      expect(screen.getByRole('button')).toHaveAttribute(
        'title',
        'Click to view and resolve conflicts'
      );
    });
  });

  describe('label visibility', () => {
    it('should hide label when showLabel is false', () => {
      mockUseSyncStatus.mockReturnValue(createMockSyncStatus());

      render(<SyncStatusIndicator showLabel={false} />);

      const button = screen.getByRole('button');
      // Should still have the icon
      expect(button).toHaveTextContent('\u2713');
      // But not the label text
      expect(button).not.toHaveTextContent('Synced');
    });
  });

  describe('accessibility', () => {
    it('should have appropriate aria-label', () => {
      mockUseSyncStatus.mockReturnValue(
        createMockSyncStatus({
          state: 'pending',
          pendingCount: 3,
        })
      );

      render(<SyncStatusIndicator />);

      expect(screen.getByRole('button')).toHaveAttribute('aria-label', 'Sync status: 3 pending');
    });

    it('should mark icon as aria-hidden', () => {
      mockUseSyncStatus.mockReturnValue(createMockSyncStatus());

      render(<SyncStatusIndicator />);

      const icon = screen.getByText('\u2713');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
