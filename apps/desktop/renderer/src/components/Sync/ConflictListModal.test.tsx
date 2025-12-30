import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConflictListModal } from './ConflictListModal';
import type { SyncConflict, ConflictResolution } from '@scribe/shared';

// Mock the formatRelativeTime function
vi.mock('../../hooks/useSyncStatus', () => ({
  formatRelativeTime: (ts: number) => {
    const diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} minutes ago`;
    return `${Math.floor(diff / 3600000)} hours ago`;
  },
}));

function createMockConflict(overrides: Partial<SyncConflict> = {}): SyncConflict {
  return {
    noteId: 'note-1',
    localNote: {
      metadata: { title: 'Test Note' },
      updatedAt: Date.now() - 300000, // 5 minutes ago
    },
    remoteNote: {
      metadata: { title: 'Test Note' },
      updatedAt: Date.now() - 600000, // 10 minutes ago
    },
    localVersion: 2,
    remoteVersion: 3,
    detectedAt: Date.now(),
    type: 'edit',
    ...overrides,
  } as SyncConflict;
}

describe('ConflictListModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    conflicts: [] as SyncConflict[],
    onResolveConflict: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('visibility', () => {
    it('should not render when isOpen is false', () => {
      const { container } = render(<ConflictListModal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('should render when isOpen is true', () => {
      render(<ConflictListModal {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  describe('header', () => {
    it('should display title and warning icon', () => {
      render(<ConflictListModal {...defaultProps} />);
      expect(screen.getByText('Sync Conflicts')).toBeInTheDocument();
      expect(screen.getByText('\u26A0')).toBeInTheDocument(); // Warning triangle
    });

    it('should show correct count for single conflict', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[createMockConflict()]} />);
      expect(screen.getByText('1 note needs attention')).toBeInTheDocument();
    });

    it('should show correct count for multiple conflicts', () => {
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[
            createMockConflict({ noteId: 'note-1' }),
            createMockConflict({ noteId: 'note-2' }),
            createMockConflict({ noteId: 'note-3' }),
          ]}
        />
      );
      expect(screen.getByText('3 notes need attention')).toBeInTheDocument();
    });

    it('should show empty message when no conflicts', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[]} />);
      expect(screen.getByText('No conflicts to resolve')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show success message when conflicts array is empty', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[]} />);
      expect(screen.getByText('All conflicts resolved!')).toBeInTheDocument();
      expect(screen.getByText('\u2713')).toBeInTheDocument(); // Checkmark
    });

    it('should show Close button instead of Dismiss when empty', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[]} />);
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
      expect(screen.queryByText('Dismiss')).not.toBeInTheDocument();
    });
  });

  describe('conflict list', () => {
    it('should display note title from conflict', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[createMockConflict()]} />);
      expect(screen.getByText('Test Note')).toBeInTheDocument();
    });

    it('should display conflict type label for edit conflict', () => {
      render(
        <ConflictListModal {...defaultProps} conflicts={[createMockConflict({ type: 'edit' })]} />
      );
      expect(screen.getByText('Both edited')).toBeInTheDocument();
    });

    it('should display conflict type label for delete-edit conflict', () => {
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[createMockConflict({ type: 'delete-edit' })]}
        />
      );
      expect(screen.getByText('Deleted locally')).toBeInTheDocument();
    });

    it('should display conflict type label for edit-delete conflict', () => {
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[createMockConflict({ type: 'edit-delete' })]}
        />
      );
      expect(screen.getByText('Deleted remotely')).toBeInTheDocument();
    });

    it('should render Keep Local and Keep Remote buttons', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[createMockConflict()]} />);
      expect(screen.getByRole('button', { name: 'Keep Local' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Keep Remote' })).toBeInTheDocument();
    });

    it('should render Compare button when onViewConflict is provided', () => {
      const onViewConflict = vi.fn();
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[createMockConflict()]}
          onViewConflict={onViewConflict}
        />
      );
      expect(screen.getByRole('button', { name: 'Compare' })).toBeInTheDocument();
    });

    it('should not render Compare button when onViewConflict is not provided', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[createMockConflict()]} />);
      expect(screen.queryByRole('button', { name: 'Compare' })).not.toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('should call onResolveConflict with keep_local when Keep Local clicked', () => {
      const onResolveConflict = vi.fn();
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[createMockConflict({ noteId: 'note-123' })]}
          onResolveConflict={onResolveConflict}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Keep Local' }));

      expect(onResolveConflict).toHaveBeenCalledTimes(1);
      expect(onResolveConflict).toHaveBeenCalledWith('note-123', { type: 'keep_local' });
    });

    it('should call onResolveConflict with keep_remote when Keep Remote clicked', () => {
      const onResolveConflict = vi.fn();
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[createMockConflict({ noteId: 'note-456' })]}
          onResolveConflict={onResolveConflict}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Keep Remote' }));

      expect(onResolveConflict).toHaveBeenCalledTimes(1);
      expect(onResolveConflict).toHaveBeenCalledWith('note-456', { type: 'keep_remote' });
    });

    it('should call onViewConflict when Compare clicked', () => {
      const onViewConflict = vi.fn();
      const conflict = createMockConflict({ noteId: 'note-789' });
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[conflict]}
          onViewConflict={onViewConflict}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Compare' }));

      expect(onViewConflict).toHaveBeenCalledTimes(1);
      expect(onViewConflict).toHaveBeenCalledWith(conflict);
    });

    it('should call onClose when Dismiss button clicked', () => {
      const onClose = vi.fn();
      render(
        <ConflictListModal {...defaultProps} conflicts={[createMockConflict()]} onClose={onClose} />
      );

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));

      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('multiple conflicts', () => {
    it('should render all conflicts in the list', () => {
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[
            createMockConflict({
              noteId: 'note-1',
              localNote: { metadata: { title: 'First Note' } },
            }),
            createMockConflict({
              noteId: 'note-2',
              localNote: { metadata: { title: 'Second Note' } },
            }),
            createMockConflict({
              noteId: 'note-3',
              localNote: { metadata: { title: 'Third Note' } },
            }),
          ]}
        />
      );

      expect(screen.getByText('First Note')).toBeInTheDocument();
      expect(screen.getByText('Second Note')).toBeInTheDocument();
      expect(screen.getByText('Third Note')).toBeInTheDocument();
    });

    it('should resolve the correct conflict when multiple exist', () => {
      const onResolveConflict = vi.fn();
      render(
        <ConflictListModal
          {...defaultProps}
          conflicts={[
            createMockConflict({ noteId: 'note-1' }),
            createMockConflict({ noteId: 'note-2' }),
          ]}
          onResolveConflict={onResolveConflict}
        />
      );

      // Click Keep Local on the second conflict's button
      const keepLocalButtons = screen.getAllByRole('button', { name: 'Keep Local' });
      fireEvent.click(keepLocalButtons[1]);

      expect(onResolveConflict).toHaveBeenCalledWith('note-2', { type: 'keep_local' });
    });
  });

  describe('accessibility', () => {
    it('should have proper ARIA attributes on dialog', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[createMockConflict()]} />);

      const dialog = screen.getByRole('dialog');
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-labelledby', 'conflict-modal-title');
      expect(dialog).toHaveAttribute('aria-describedby', 'conflict-modal-description');
    });

    it('should have correct heading level', () => {
      render(<ConflictListModal {...defaultProps} />);
      expect(screen.getByRole('heading', { level: 2, name: 'Sync Conflicts' })).toBeInTheDocument();
    });
  });

  describe('footer', () => {
    it('should show hint text when there are conflicts', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[createMockConflict()]} />);
      expect(screen.getByText('Resolve conflicts to continue syncing')).toBeInTheDocument();
    });

    it('should not show hint text when no conflicts', () => {
      render(<ConflictListModal {...defaultProps} conflicts={[]} />);
      expect(screen.queryByText('Resolve conflicts to continue syncing')).not.toBeInTheDocument();
    });
  });
});
