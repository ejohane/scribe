/**
 * Toast Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Toast } from './Toast';
import * as styles from './Toast.css';
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

      // Verify container has proper styling class for vertical stacking
      const toastElement = screen.getByText('First message').closest(`.${styles.toast}`);
      const container = toastElement?.parentElement;
      expect(container).toHaveClass(styles.container);
    });
  });

  describe('styling', () => {
    it('applies default (success) styling without error class', () => {
      const toasts = [createToast({ type: 'success' })];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      const toastElement = screen.getByText('Test message').closest(`.${styles.toast}`);
      expect(toastElement).toHaveClass(styles.toast);
      expect(toastElement).toHaveClass(styles.toastVariants.success);
      expect(toastElement).not.toHaveClass(styles.toastVariants.error);
    });

    it('applies error variant class for error type', () => {
      const toasts = [createToast({ type: 'error', message: 'Error occurred' })];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      const toastElement = screen.getByText('Error occurred').closest(`.${styles.toast}`);
      expect(toastElement).toHaveClass(styles.toast);
      expect(toastElement).toHaveClass(styles.toastVariants.error);
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
    it('has role="status" for success toasts (polite announcements)', () => {
      const toasts = [createToast()];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      // Both container and toast have role="status", find the toast by its content
      const statusElements = screen.getAllByRole('status');
      const toast = statusElements.find((el) => el.textContent === 'Test message');
      expect(toast).toBeInTheDocument();
    });

    it('has role="alert" for error toasts (assertive announcements)', () => {
      const toasts = [createToast({ type: 'error' })];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      const toast = screen.getByRole('alert');
      expect(toast).toBeInTheDocument();
      expect(toast).toHaveTextContent('Test message');
    });

    it('each toast has appropriate role based on type', () => {
      const toasts = [
        createToast({ id: 'toast-1', message: 'Success', type: 'success' }),
        createToast({ id: 'toast-2', message: 'Error', type: 'error' }),
      ];
      render(<Toast toasts={toasts} onDismiss={vi.fn()} />);

      // Container and success toast have role="status"
      const statusElements = screen.getAllByRole('status');
      expect(statusElements.length).toBeGreaterThanOrEqual(1);

      // Error toast has role="alert"
      const alertElement = screen.getByRole('alert');
      expect(alertElement).toHaveTextContent('Error');
    });
  });
});
