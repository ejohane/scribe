/**
 * Toast Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toast } from './Toast';
import type { Toast as ToastType } from '../../hooks/useToast';

describe('Toast', () => {
  const createToast = (overrides: Partial<ToastType> = {}): ToastType => ({
    id: 'toast-1',
    message: 'Test message',
    type: 'success',
    ...overrides,
  });

  describe('rendering', () => {
    it('renders message text correctly', () => {
      const toasts = [createToast({ message: 'Note deleted successfully' })];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      expect(screen.getByText('Note deleted successfully')).toBeInTheDocument();
    });

    it('does not render when toasts array is empty', () => {
      const { container } = render(<Toast toasts={[]} onDismiss={vi.fn()} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders multiple toasts stacked vertically', () => {
      const toasts = [
        createToast({ id: 'toast-1', message: 'First message' }),
        createToast({ id: 'toast-2', message: 'Second message' }),
        createToast({ id: 'toast-3', message: 'Third message' }),
      ];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      expect(screen.getByText('First message')).toBeInTheDocument();
      expect(screen.getByText('Second message')).toBeInTheDocument();
      expect(screen.getByText('Third message')).toBeInTheDocument();

      // Verify container has flex-direction: column for vertical stacking
      const container = screen.getByText('First message').parentElement;
      expect(container).toHaveClass('toast-container');
    });
  });

  describe('styling', () => {
    it('applies default (success) styling without error class', () => {
      const toasts = [createToast({ type: 'success' })];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      const toast = screen.getByText('Test message');
      expect(toast).toHaveClass('toast');
      expect(toast).not.toHaveClass('toast--error');
    });

    it('applies .toast--error class for error type', () => {
      const toasts = [createToast({ type: 'error', message: 'Error occurred' })];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      const toast = screen.getByText('Error occurred');
      expect(toast).toHaveClass('toast');
      expect(toast).toHaveClass('toast--error');
    });
  });

  describe('interactions', () => {
    it('click triggers onDismiss with correct ID', () => {
      const onDismiss = vi.fn();
      const toasts = [createToast({ id: 'test-toast-id' })];
      render(<Toast toasts={toasts} onDismiss={onDismiss} />);

      const toast = screen.getByText('Test message');
      fireEvent.click(toast);

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledWith('test-toast-id');
    });

    it('clicking one toast only dismisses that toast', () => {
      const onDismiss = vi.fn();
      const toasts = [
        createToast({ id: 'toast-1', message: 'First' }),
        createToast({ id: 'toast-2', message: 'Second' }),
      ];
      render(<Toast toasts={toasts} onDismiss={onDismiss} />);

      const secondToast = screen.getByText('Second');
      fireEvent.click(secondToast);

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onDismiss).toHaveBeenCalledWith('toast-2');
    });
  });

  describe('accessibility', () => {
    it('has role="alert" for screen reader announcements', () => {
      const toasts = [createToast()];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveTextContent('Test message');
    });

    it('each toast has role="alert" when multiple toasts exist', () => {
      const toasts = [
        createToast({ id: 'toast-1', message: 'First' }),
        createToast({ id: 'toast-2', message: 'Second' }),
      ];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      const alerts = screen.getAllByRole('alert');
      expect(alerts).toHaveLength(2);
    });
  });
});
