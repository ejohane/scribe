/**
 * ShareMenu Component Tests
 *
 * Tests for the ShareMenu dropdown component that provides export options.
 *
 * Test coverage:
 * - Rendering: button visibility, accessibility attributes
 * - Dropdown: open/close behavior, keyboard navigation
 * - Export: API calls, callbacks, loading states
 * - Edge cases: cancellation, error handling
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ShareMenu, type ShareMenuProps } from './ShareMenu';
import { createNoteId } from '@scribe/shared';
import type { NoteId } from '@scribe/shared';

// Mock the design system icons
vi.mock('@scribe/design-system', () => ({
  FileTextIcon: ({ size, className }: { size: number; className?: string }) => (
    <svg data-testid="file-text-icon" data-size={size} className={className} />
  ),
}));

// Mock scrollIntoView since it's not implemented in happy-dom
Element.prototype.scrollIntoView = vi.fn();

// Type for the mock export API
interface MockExportResult {
  success: boolean;
  filePath?: string;
  cancelled?: boolean;
  error?: string;
}

// Mock window.scribe.export API
const mockToMarkdown = vi.fn<(noteId: NoteId) => Promise<MockExportResult>>();

const mockScribeAPI = {
  export: {
    toMarkdown: mockToMarkdown,
  },
};

describe('ShareMenu', () => {
  const testNoteId = createNoteId('test-note-123');

  const defaultProps: ShareMenuProps = {
    noteId: testNoteId,
    onExportSuccess: vi.fn(),
    onExportError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementation - successful export
    mockToMarkdown.mockResolvedValue({
      success: true,
      filePath: '/Users/test/Documents/my-note.md',
    });

    // Mock window.scribe
    (window as unknown as { scribe: typeof mockScribeAPI }).scribe = mockScribeAPI;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders share button', () => {
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      expect(button).toBeInTheDocument();
    });

    it('renders button with aria-label', () => {
      render(<ShareMenu {...defaultProps} />);

      expect(screen.getByLabelText('Share note')).toBeInTheDocument();
    });

    it('renders button with title attribute', () => {
      render(<ShareMenu {...defaultProps} />);

      expect(screen.getByTitle('Share')).toBeInTheDocument();
    });

    it('renders button with correct aria attributes when closed', () => {
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      expect(button).toHaveAttribute('aria-haspopup', 'menu');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });

    it('button has type="button" to prevent form submission', () => {
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      expect(button).toHaveAttribute('type', 'button');
    });

    it('does not render dropdown when closed', () => {
      render(<ShareMenu {...defaultProps} />);

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('dropdown open/close', () => {
    it('opens dropdown on click', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('updates aria-expanded when dropdown opens', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      await user.click(button);

      expect(button).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes dropdown on second click', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      await user.click(button);
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.click(button);
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes dropdown on outside click', async () => {
      const user = userEvent.setup();
      render(
        <div>
          <ShareMenu {...defaultProps} />
          <button data-testid="outside-element">Outside</button>
        </div>
      );

      await user.click(screen.getByRole('button', { name: /share/i }));
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.click(screen.getByTestId('outside-element'));
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('closes dropdown on Escape key', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('returns focus to button after closing with Escape', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      await user.click(button);
      await user.keyboard('{Escape}');

      expect(button).toHaveFocus();
    });

    it('renders menu items when open', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      expect(screen.getByRole('menuitem', { name: /export to markdown/i })).toBeInTheDocument();
    });
  });

  describe('keyboard navigation', () => {
    it('opens dropdown with Enter key', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      button.focus();
      await user.keyboard('{Enter}');

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('opens dropdown with Space key', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      button.focus();
      await user.keyboard(' ');

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('opens dropdown with ArrowDown and focuses first item', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      button.focus();
      await user.keyboard('{ArrowDown}');

      expect(screen.getByRole('menu')).toBeInTheDocument();
      // First menu item should receive focus
      const menuItem = screen.getByRole('menuitem', { name: /export to markdown/i });
      await waitFor(() => {
        expect(menuItem).toHaveFocus();
      });
    });

    it('activates menu item with Enter key', async () => {
      const user = userEvent.setup();
      const onExportSuccess = vi.fn();
      render(<ShareMenu {...defaultProps} onExportSuccess={onExportSuccess} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      // Wait for menu item to be focused
      const menuItem = screen.getByRole('menuitem', { name: /export to markdown/i });
      await waitFor(() => {
        expect(menuItem).toHaveFocus();
      });

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(mockToMarkdown).toHaveBeenCalledWith(testNoteId);
      });
    });

    it('activates menu item with Space key', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      // Wait for menu item to be focused
      const menuItem = screen.getByRole('menuitem', { name: /export to markdown/i });
      await waitFor(() => {
        expect(menuItem).toHaveFocus();
      });

      await user.keyboard(' ');

      await waitFor(() => {
        expect(mockToMarkdown).toHaveBeenCalledWith(testNoteId);
      });
    });

    it('closes dropdown on Tab key', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      expect(screen.getByRole('menu')).toBeInTheDocument();

      await user.keyboard('{Tab}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('export API call', () => {
    it('calls export API when export option is clicked', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      expect(mockToMarkdown).toHaveBeenCalledWith(testNoteId);
    });

    it('calls export API with correct noteId', async () => {
      const user = userEvent.setup();
      const customNoteId = createNoteId('custom-note-456');
      render(<ShareMenu {...defaultProps} noteId={customNoteId} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      expect(mockToMarkdown).toHaveBeenCalledWith(customNoteId);
    });

    it('closes dropdown when export is initiated', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('disables button while exporting', async () => {
      // Create a never-resolving promise to keep the loading state
      let resolveExport: (value: MockExportResult) => void;
      mockToMarkdown.mockReturnValue(
        new Promise((resolve) => {
          resolveExport = resolve;
        })
      );

      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      const button = screen.getByRole('button', { name: /share/i });
      expect(button).toBeDisabled();

      // Cleanup: resolve the promise to allow test to complete
      resolveExport!({ success: true, filePath: '/test/file.md' });
    });

    it('re-enables button after export completes', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /share/i });
        expect(button).not.toBeDisabled();
      });
    });

    it('re-enables button after export fails', async () => {
      mockToMarkdown.mockResolvedValue({
        success: false,
        error: 'Export failed',
      });

      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /share/i });
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe('callbacks', () => {
    it('calls onExportSuccess with filename when export succeeds', async () => {
      mockToMarkdown.mockResolvedValue({
        success: true,
        filePath: '/Users/test/Documents/my-note.md',
      });

      const onExportSuccess = vi.fn();
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} onExportSuccess={onExportSuccess} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        expect(onExportSuccess).toHaveBeenCalledWith('my-note.md');
      });
    });

    it('extracts filename correctly from Unix path', async () => {
      mockToMarkdown.mockResolvedValue({
        success: true,
        filePath: '/home/user/notes/meeting-notes.md',
      });

      const onExportSuccess = vi.fn();
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} onExportSuccess={onExportSuccess} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        expect(onExportSuccess).toHaveBeenCalledWith('meeting-notes.md');
      });
    });

    it('extracts filename correctly from Windows path', async () => {
      mockToMarkdown.mockResolvedValue({
        success: true,
        filePath: 'C:\\Users\\test\\Documents\\notes\\my-note.md',
      });

      const onExportSuccess = vi.fn();
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} onExportSuccess={onExportSuccess} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        expect(onExportSuccess).toHaveBeenCalledWith('my-note.md');
      });
    });

    it('calls onExportError with error message when export fails', async () => {
      mockToMarkdown.mockResolvedValue({
        success: false,
        error: 'Permission denied',
      });

      const onExportError = vi.fn();
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} onExportError={onExportError} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        expect(onExportError).toHaveBeenCalledWith('Permission denied');
      });
    });

    it('calls onExportError when API throws exception', async () => {
      mockToMarkdown.mockRejectedValue(new Error('Network error'));

      const onExportError = vi.fn();
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} onExportError={onExportError} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        expect(onExportError).toHaveBeenCalledWith('Network error');
      });
    });

    it('handles non-Error exception gracefully', async () => {
      mockToMarkdown.mockRejectedValue('Unknown error');

      const onExportError = vi.fn();
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} onExportError={onExportError} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        expect(onExportError).toHaveBeenCalledWith('Export failed');
      });
    });

    it('does not call callbacks when user cancels dialog', async () => {
      mockToMarkdown.mockResolvedValue({
        success: true,
        cancelled: true,
      });

      const onExportSuccess = vi.fn();
      const onExportError = vi.fn();
      const user = userEvent.setup();
      render(
        <ShareMenu
          {...defaultProps}
          onExportSuccess={onExportSuccess}
          onExportError={onExportError}
        />
      );

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      // Wait for API call to complete
      await waitFor(() => {
        expect(mockToMarkdown).toHaveBeenCalled();
      });

      // Neither callback should be called
      expect(onExportSuccess).not.toHaveBeenCalled();
      expect(onExportError).not.toHaveBeenCalled();
    });

    it('works without optional callbacks', async () => {
      mockToMarkdown.mockResolvedValue({
        success: true,
        filePath: '/test/file.md',
      });

      const user = userEvent.setup();
      render(<ShareMenu noteId={testNoteId} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      // Should not throw
      await waitFor(() => {
        expect(mockToMarkdown).toHaveBeenCalled();
      });
    });
  });

  describe('focus management', () => {
    it('focuses first menu item when dropdown opens', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      await waitFor(() => {
        const menuItem = screen.getByRole('menuitem', { name: /export to markdown/i });
        expect(menuItem).toHaveFocus();
      });
    });

    it('returns focus to button after export completes', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));
      await user.click(screen.getByRole('menuitem', { name: /export to markdown/i }));

      await waitFor(() => {
        const button = screen.getByRole('button', { name: /share/i });
        expect(button).toHaveFocus();
      });
    });
  });

  describe('accessibility', () => {
    it('dropdown has role="menu"', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      expect(screen.getByRole('menu')).toBeInTheDocument();
    });

    it('dropdown has aria-label', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      expect(screen.getByLabelText('Share options')).toBeInTheDocument();
    });

    it('menu items have role="menuitem"', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      expect(screen.getByRole('menuitem', { name: /export to markdown/i })).toBeInTheDocument();
    });

    it('button has aria-controls when menu is open', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      const button = screen.getByRole('button', { name: /share/i });
      await user.click(button);

      expect(button).toHaveAttribute('aria-controls', 'share-menu-dropdown');
    });

    it('menu items have correct tabindex for roving focus', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      const menuItem = screen.getByRole('menuitem', { name: /export to markdown/i });
      expect(menuItem).toHaveAttribute('tabindex', '0');
    });
  });

  describe('menu item rendering', () => {
    it('renders Export to Markdown option with icon', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      expect(screen.getByRole('menuitem', { name: /export to markdown/i })).toBeInTheDocument();
      expect(screen.getByTestId('file-text-icon')).toBeInTheDocument();
    });

    it('menu items have type="button"', async () => {
      const user = userEvent.setup();
      render(<ShareMenu {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /share/i }));

      const menuItem = screen.getByRole('menuitem', { name: /export to markdown/i });
      expect(menuItem).toHaveAttribute('type', 'button');
    });
  });
});
