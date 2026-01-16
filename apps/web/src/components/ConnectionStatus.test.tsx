/**
 * Tests for ConnectionStatus component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionStatus } from './ConnectionStatus';

// Mock useScribe hook
const mockUseScribe = vi.fn();

vi.mock('../providers/ScribeProvider', () => ({
  useScribe: () => mockUseScribe(),
}));

// Store original reload function
const originalReload = window.location.reload;

beforeEach(() => {
  vi.clearAllMocks();

  // Mock location.reload
  Object.defineProperty(window.location, 'reload', {
    value: vi.fn(),
    writable: true,
    configurable: true,
  });
});

afterEach(() => {
  // Restore original reload
  Object.defineProperty(window.location, 'reload', {
    value: originalReload,
    writable: true,
    configurable: true,
  });
});

describe('ConnectionStatus', () => {
  describe('connecting state', () => {
    beforeEach(() => {
      mockUseScribe.mockReturnValue({
        status: 'connecting',
        error: null,
      });
    });

    it('renders connecting message', () => {
      render(<ConnectionStatus />);

      expect(screen.getByText('Connecting to Scribe daemon...')).toBeInTheDocument();
    });

    it('has correct status role for accessibility', () => {
      render(<ConnectionStatus />);

      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveClass('connection-status', 'connecting');
    });

    it('renders spinner', () => {
      render(<ConnectionStatus />);

      const spinner = document.querySelector('.connection-status-spinner');
      expect(spinner).toBeInTheDocument();
      expect(spinner).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('error state', () => {
    beforeEach(() => {
      mockUseScribe.mockReturnValue({
        status: 'error',
        error: new Error('Connection refused'),
      });
    });

    it('renders error message', () => {
      render(<ConnectionStatus />);

      expect(screen.getByText(/Connection failed:/)).toBeInTheDocument();
      expect(screen.getByText(/Connection refused/)).toBeInTheDocument();
    });

    it('has alert role for accessibility', () => {
      render(<ConnectionStatus />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
    });

    it('renders retry button', () => {
      render(<ConnectionStatus />);

      const button = screen.getByRole('button', { name: /retry/i });
      expect(button).toBeInTheDocument();
    });

    it('calls onRetry when retry button clicked', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(<ConnectionStatus onRetry={onRetry} />);

      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('reloads page when retry clicked without onRetry prop', async () => {
      const user = userEvent.setup();

      render(<ConnectionStatus />);

      await user.click(screen.getByRole('button', { name: /retry/i }));

      expect(window.location.reload).toHaveBeenCalledTimes(1);
    });

    it('renders error icon', () => {
      render(<ConnectionStatus />);

      const icon = document.querySelector('.connection-status-icon');
      expect(icon).toBeInTheDocument();
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });
  });

  describe('error state with error but non-error status', () => {
    beforeEach(() => {
      mockUseScribe.mockReturnValue({
        status: 'disconnected',
        error: new Error('Some error occurred'),
      });
    });

    it('renders error UI when error exists even if status is not error', () => {
      render(<ConnectionStatus />);

      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText(/Connection failed:/)).toBeInTheDocument();
    });
  });

  describe('error state with null error message', () => {
    beforeEach(() => {
      mockUseScribe.mockReturnValue({
        status: 'error',
        error: null,
      });
    });

    it('shows unknown error message when error is null', () => {
      render(<ConnectionStatus />);

      expect(screen.getByText(/Unknown error/)).toBeInTheDocument();
    });
  });

  describe('disconnected state', () => {
    beforeEach(() => {
      mockUseScribe.mockReturnValue({
        status: 'disconnected',
        error: null,
      });
    });

    it('renders disconnected message', () => {
      render(<ConnectionStatus />);

      expect(screen.getByText('Disconnected from daemon')).toBeInTheDocument();
    });

    it('has status role for accessibility', () => {
      render(<ConnectionStatus />);

      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(status).toHaveClass('connection-status', 'disconnected');
    });

    it('renders reconnect button', () => {
      render(<ConnectionStatus />);

      const button = screen.getByRole('button', { name: /reconnect/i });
      expect(button).toBeInTheDocument();
    });

    it('calls onRetry when reconnect button clicked', async () => {
      const user = userEvent.setup();
      const onRetry = vi.fn();

      render(<ConnectionStatus onRetry={onRetry} />);

      await user.click(screen.getByRole('button', { name: /reconnect/i }));

      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('reloads page when reconnect clicked without onRetry prop', async () => {
      const user = userEvent.setup();

      render(<ConnectionStatus />);

      await user.click(screen.getByRole('button', { name: /reconnect/i }));

      expect(window.location.reload).toHaveBeenCalledTimes(1);
    });
  });

  describe('connected state', () => {
    beforeEach(() => {
      mockUseScribe.mockReturnValue({
        status: 'connected',
        error: null,
      });
    });

    it('renders nothing when connected', () => {
      const { container } = render(<ConnectionStatus />);

      expect(container).toBeEmptyDOMElement();
    });
  });
});
