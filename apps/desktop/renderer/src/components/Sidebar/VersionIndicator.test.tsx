/**
 * VersionIndicator Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VersionIndicator } from './VersionIndicator';
import * as styles from './VersionIndicator.css';

// Mock the useUpdateStatus hook
vi.mock('../../hooks/useUpdateStatus', () => ({
  useUpdateStatus: vi.fn(),
}));

// Mock the UpdatePopover component
vi.mock('./UpdatePopover', () => ({
  UpdatePopover: vi.fn(({ version, onClose, onInstall }) => (
    <div data-testid="update-popover">
      <span data-testid="popover-version">Version {version} is ready to install.</span>
      <button onClick={onInstall}>Restart Now</button>
      <button onClick={onClose}>Close</button>
    </div>
  )),
}));

// Mock __APP_VERSION__ global
vi.stubGlobal('__APP_VERSION__', '1.0.0');

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

describe('VersionIndicator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('version display', () => {
    it('displays the current app version', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(createMockUpdateStatus());
      render(<VersionIndicator />);

      expect(screen.getByText('v1.0.0')).toBeInTheDocument();
    });
  });

  describe('update badge', () => {
    it('does not show badge when no update is available', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(createMockUpdateStatus({ hasUpdate: false }));
      render(<VersionIndicator />);

      // Badge should not exist
      const container = screen.getByText('v1.0.0').closest('button');
      const badge = container?.querySelector(`.${styles.updateBadge}`);
      expect(badge).not.toBeInTheDocument();
    });

    it('shows badge when update is ready', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0' })
      );
      render(<VersionIndicator />);

      // Badge should exist
      const container = screen.getByText('v1.0.0').closest('button');
      const badge = container?.querySelector(`.${styles.updateBadge}`);
      expect(badge).toBeInTheDocument();
    });

    it('button is disabled when no update is available', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(createMockUpdateStatus({ hasUpdate: false }));
      render(<VersionIndicator />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('button is enabled when update is available', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0' })
      );
      render(<VersionIndicator />);

      const button = screen.getByRole('button');
      expect(button).not.toBeDisabled();
    });
  });

  describe('popover interactions', () => {
    it('opens popover when clicked with update available', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0' })
      );
      render(<VersionIndicator />);

      // Initially popover should not be visible
      expect(screen.queryByTestId('update-popover')).not.toBeInTheDocument();

      // Click the button
      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Popover should now be visible
      expect(screen.getByTestId('update-popover')).toBeInTheDocument();
    });

    it('does not open popover when clicked without update available', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(createMockUpdateStatus({ hasUpdate: false }));
      render(<VersionIndicator />);

      // Try to click the disabled button
      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Popover should NOT be visible
      expect(screen.queryByTestId('update-popover')).not.toBeInTheDocument();
    });

    it('passes correct version to popover', () => {
      vi.mocked(useUpdateStatus).mockReturnValue(
        createMockUpdateStatus({ hasUpdate: true, version: '1.1.0' })
      );
      render(<VersionIndicator />);

      // Click to open popover
      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Verify version is displayed in popover
      expect(screen.getByTestId('popover-version')).toHaveTextContent(
        'Version 1.1.0 is ready to install.'
      );
    });
  });
});
