/**
 * UpdateToast Component Tests
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { UpdateToast } from './UpdateToast';

// Mock the useUpdateStatus hook
vi.mock('../../hooks/useUpdateStatus', () => ({
  useUpdateStatus: vi.fn(),
}));

import { useUpdateStatus } from '../../hooks/useUpdateStatus';

// Helper to create mock hook return values
const createMockUpdateStatus = (overrides: Partial<ReturnType<typeof useUpdateStatus>> = {}) => ({
  status: 'idle' as const,
  version: undefined,
  error: undefined,
  dismissed: false,
  hasUpdate: false,
  installUpdate: vi.fn(),
  dismiss: vi.fn(),
  ...overrides,
});

describe('UpdateToast', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('visibility', () => {
    it('does not render when no update is available', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(createMockUpdateStatus({ hasUpdate: false }));
      const { container } = render(<UpdateToast />);

      expect(container.firstChild).toBeNull();
    });

    it('does not render when update is dismissed', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0', dismissed: true })
      );
      const { container } = render(<UpdateToast />);

      expect(container.firstChild).toBeNull();
    });

    it('renders when update is available and not dismissed', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0', dismissed: false })
      );
      render(<UpdateToast />);

      expect(screen.getByText('Update Available')).toBeInTheDocument();
      expect(screen.getByText('Version 1.1.0 is ready to install.')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    it('displays the correct version number', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '2.0.0' })
      );
      render(<UpdateToast />);

      expect(screen.getByText('Version 2.0.0 is ready to install.')).toBeInTheDocument();
    });

    it('has a Restart Now button', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0' })
      );
      render(<UpdateToast />);

      expect(screen.getByRole('button', { name: 'Restart Now' })).toBeInTheDocument();
    });

    it('has a dismiss button', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0' })
      );
      render(<UpdateToast />);

      expect(
        screen.getByRole('button', { name: 'Dismiss update notification' })
      ).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls installUpdate when Restart Now is clicked', () => {
      const installUpdate = vi.fn();
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0', installUpdate })
      );
      render(<UpdateToast />);

      fireEvent.click(screen.getByRole('button', { name: 'Restart Now' }));

      expect(installUpdate).toHaveBeenCalledTimes(1);
    });

    it('calls dismiss after animation when dismiss button is clicked', () => {
      const dismiss = vi.fn();
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0', dismiss })
      );
      render(<UpdateToast />);

      fireEvent.click(screen.getByRole('button', { name: 'Dismiss update notification' }));

      // Dismiss should not be called immediately (waiting for animation)
      expect(dismiss).not.toHaveBeenCalled();

      // Fast-forward animation timeout
      act(() => {
        vi.advanceTimersByTime(200);
      });

      expect(dismiss).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('dismiss button has appropriate aria-label', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0' })
      );
      render(<UpdateToast />);

      const dismissButton = screen.getByRole('button', { name: 'Dismiss update notification' });
      expect(dismissButton).toHaveAttribute('aria-label', 'Dismiss update notification');
    });
  });
});
