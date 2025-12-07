import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { NavigationButtons } from './NavigationButtons';

describe('NavigationButtons', () => {
  const defaultProps = {
    canGoBack: false,
    canGoForward: false,
    onBack: vi.fn(),
    onForward: vi.fn(),
  };

  const renderComponent = (props = {}) => {
    const mergedProps = { ...defaultProps, ...props };
    // Reset mocks before each render
    if (mergedProps.onBack.mockClear) mergedProps.onBack.mockClear();
    if (mergedProps.onForward.mockClear) mergedProps.onForward.mockClear();
    return render(<NavigationButtons {...mergedProps} />);
  };

  describe('button states', () => {
    it('both buttons are disabled when canGoBack and canGoForward are false', () => {
      renderComponent({ canGoBack: false, canGoForward: false });

      const backButton = screen.getByRole('button', { name: /go back to previous note/i });
      const forwardButton = screen.getByRole('button', { name: /go forward to next note/i });

      expect(backButton).toBeDisabled();
      expect(forwardButton).toBeDisabled();
    });

    it('back button is enabled and forward button is disabled when canGoBack is true', () => {
      renderComponent({ canGoBack: true, canGoForward: false });

      const backButton = screen.getByRole('button', { name: /go back to previous note/i });
      const forwardButton = screen.getByRole('button', { name: /go forward to next note/i });

      expect(backButton).toBeEnabled();
      expect(forwardButton).toBeDisabled();
    });

    it('back button is disabled and forward button is enabled when canGoForward is true', () => {
      renderComponent({ canGoBack: false, canGoForward: true });

      const backButton = screen.getByRole('button', { name: /go back to previous note/i });
      const forwardButton = screen.getByRole('button', { name: /go forward to next note/i });

      expect(backButton).toBeDisabled();
      expect(forwardButton).toBeEnabled();
    });

    it('both buttons are enabled when canGoBack and canGoForward are true', () => {
      renderComponent({ canGoBack: true, canGoForward: true });

      const backButton = screen.getByRole('button', { name: /go back to previous note/i });
      const forwardButton = screen.getByRole('button', { name: /go forward to next note/i });

      expect(backButton).toBeEnabled();
      expect(forwardButton).toBeEnabled();
    });
  });

  describe('click handlers', () => {
    it('calls onBack when back button is clicked', async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();

      renderComponent({ canGoBack: true, canGoForward: false, onBack });

      const backButton = screen.getByRole('button', { name: /go back to previous note/i });
      await user.click(backButton);

      expect(onBack).toHaveBeenCalledTimes(1);
    });

    it('calls onForward when forward button is clicked', async () => {
      const onForward = vi.fn();
      const user = userEvent.setup();

      renderComponent({ canGoBack: false, canGoForward: true, onForward });

      const forwardButton = screen.getByRole('button', { name: /go forward to next note/i });
      await user.click(forwardButton);

      expect(onForward).toHaveBeenCalledTimes(1);
    });

    it('does not call onBack when disabled back button is clicked', async () => {
      const onBack = vi.fn();
      const user = userEvent.setup();

      renderComponent({ canGoBack: false, canGoForward: true, onBack });

      const backButton = screen.getByRole('button', { name: /go back to previous note/i });
      await user.click(backButton);

      expect(onBack).not.toHaveBeenCalled();
    });

    it('does not call onForward when disabled forward button is clicked', async () => {
      const onForward = vi.fn();
      const user = userEvent.setup();

      renderComponent({ canGoBack: true, canGoForward: false, onForward });

      const forwardButton = screen.getByRole('button', { name: /go forward to next note/i });
      await user.click(forwardButton);

      expect(onForward).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('back button has correct aria-label', () => {
      renderComponent();

      const backButton = screen.getByRole('button', { name: /go back to previous note/i });
      expect(backButton).toHaveAttribute('aria-label', 'Go back to previous note');
    });

    it('forward button has correct aria-label', () => {
      renderComponent();

      const forwardButton = screen.getByRole('button', { name: /go forward to next note/i });
      expect(forwardButton).toHaveAttribute('aria-label', 'Go forward to next note');
    });

    it('back button has correct title with keyboard shortcut', () => {
      renderComponent();

      const backButton = screen.getByRole('button', { name: /go back to previous note/i });
      expect(backButton).toHaveAttribute('title', 'Go back (Cmd+[)');
    });

    it('forward button has correct title with keyboard shortcut', () => {
      renderComponent();

      const forwardButton = screen.getByRole('button', { name: /go forward to next note/i });
      expect(forwardButton).toHaveAttribute('title', 'Go forward (Cmd+])');
    });

    it('renders two buttons with proper button roles', () => {
      renderComponent();

      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(2);
    });
  });
});
