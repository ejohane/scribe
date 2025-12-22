/**
 * DateNavigator Component Tests
 */

import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DateNavigator } from './DateNavigator';

describe('DateNavigator', () => {
  const mockOnNavigate = vi.fn();
  const defaultDate = new Date('2024-12-21T12:00:00');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Rendering', () => {
    it('renders the formatted date with ordinal suffix', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);
      expect(screen.getByText('Dec 21st, 2024')).toBeInTheDocument();
    });

    it('renders date button with correct data-testid', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);
      expect(screen.getByTestId('date-nav-button')).toBeInTheDocument();
    });

    it('renders container with correct data-testid', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);
      expect(screen.getByTestId('date-navigator')).toBeInTheDocument();
    });

    it('renders chevrons when showNavigation is true', () => {
      render(
        <DateNavigator date={defaultDate} onNavigate={mockOnNavigate} showNavigation={true} />
      );
      expect(screen.getByTestId('date-nav-prev')).toBeInTheDocument();
      expect(screen.getByTestId('date-nav-next')).toBeInTheDocument();
    });

    it('hides chevrons when showNavigation is false', () => {
      render(
        <DateNavigator date={defaultDate} onNavigate={mockOnNavigate} showNavigation={false} />
      );
      expect(screen.queryByTestId('date-nav-prev')).not.toBeInTheDocument();
      expect(screen.queryByTestId('date-nav-next')).not.toBeInTheDocument();
    });

    it('renders with proper accessibility labels', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);
      expect(screen.getByLabelText('Navigate to previous day')).toBeInTheDocument();
      expect(screen.getByLabelText('Navigate to next day')).toBeInTheDocument();
      expect(screen.getByLabelText('Open calendar to select date')).toBeInTheDocument();
    });

    it('handles invalid dates gracefully', () => {
      const invalidDate = new Date(NaN);
      render(<DateNavigator date={invalidDate} onNavigate={mockOnNavigate} />);
      expect(screen.getByText('Invalid Date')).toBeInTheDocument();
    });
  });

  describe('Date formatting', () => {
    it('formats 1st correctly', () => {
      const date = new Date('2024-01-01T12:00:00');
      render(<DateNavigator date={date} onNavigate={mockOnNavigate} />);
      expect(screen.getByText('Jan 1st, 2024')).toBeInTheDocument();
    });

    it('formats 2nd correctly', () => {
      const date = new Date('2024-01-02T12:00:00');
      render(<DateNavigator date={date} onNavigate={mockOnNavigate} />);
      expect(screen.getByText('Jan 2nd, 2024')).toBeInTheDocument();
    });

    it('formats 3rd correctly', () => {
      const date = new Date('2024-01-03T12:00:00');
      render(<DateNavigator date={date} onNavigate={mockOnNavigate} />);
      expect(screen.getByText('Jan 3rd, 2024')).toBeInTheDocument();
    });

    it('formats 11th correctly (exception)', () => {
      const date = new Date('2024-01-11T12:00:00');
      render(<DateNavigator date={date} onNavigate={mockOnNavigate} />);
      expect(screen.getByText('Jan 11th, 2024')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('navigates to previous day on left chevron click', async () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const prevButton = screen.getByTestId('date-nav-prev');
      fireEvent.click(prevButton);

      // Advance past navigation debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
      const calledDate = mockOnNavigate.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(20); // Dec 20
    });

    it('navigates to next day on right chevron click', async () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const nextButton = screen.getByTestId('date-nav-next');
      fireEvent.click(nextButton);

      // Advance past navigation debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
      const calledDate = mockOnNavigate.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(22); // Dec 22
    });

    it('debounces rapid navigation clicks', async () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const nextButton = screen.getByTestId('date-nav-next');

      // Click 3 times rapidly
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);
      fireEvent.click(nextButton);

      // Advance past navigation debounce
      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      // Should only call once due to debounce
      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard navigation', () => {
    it('navigates to previous day on ArrowLeft', async () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const container = screen.getByTestId('date-navigator');
      fireEvent.keyDown(container, { key: 'ArrowLeft' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
      const calledDate = mockOnNavigate.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(20);
    });

    it('navigates to next day on ArrowRight', async () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const container = screen.getByTestId('date-navigator');
      fireEvent.keyDown(container, { key: 'ArrowRight' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(mockOnNavigate).toHaveBeenCalledTimes(1);
      const calledDate = mockOnNavigate.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(22);
    });

    it('does not respond to keyboard when showNavigation is false', async () => {
      render(
        <DateNavigator date={defaultDate} onNavigate={mockOnNavigate} showNavigation={false} />
      );

      const container = screen.getByTestId('date-navigator');
      fireEvent.keyDown(container, { key: 'ArrowLeft' });

      await act(async () => {
        await vi.advanceTimersByTimeAsync(250);
      });

      expect(mockOnNavigate).not.toHaveBeenCalled();
    });
  });

  describe('Calendar popover', () => {
    it('opens calendar on date button click when showNavigation is true', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const dateButton = screen.getByTestId('date-nav-button');
      fireEvent.click(dateButton);

      expect(screen.getByTestId('date-nav-calendar')).toBeInTheDocument();
    });

    it('does not show calendar when showNavigation is false', () => {
      render(
        <DateNavigator date={defaultDate} onNavigate={mockOnNavigate} showNavigation={false} />
      );

      const dateButton = screen.getByTestId('date-nav-button');
      fireEvent.click(dateButton);

      // Should not have calendar since navigation is disabled
      expect(screen.queryByTestId('date-nav-calendar')).not.toBeInTheDocument();
      // But should call onNavigate directly
      expect(mockOnNavigate).toHaveBeenCalledWith(defaultDate);
    });

    it('closes calendar on Escape key', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      // Open calendar
      const dateButton = screen.getByTestId('date-nav-button');
      fireEvent.click(dateButton);
      expect(screen.getByTestId('date-nav-calendar')).toBeInTheDocument();

      // Press Escape
      const container = screen.getByTestId('date-navigator');
      fireEvent.keyDown(container, { key: 'Escape' });

      // Calendar should be closed
      expect(screen.queryByTestId('date-nav-calendar')).not.toBeInTheDocument();
    });

    it('has correct aria-expanded state', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const dateButton = screen.getByTestId('date-nav-button');

      // Initially closed
      expect(dateButton).toHaveAttribute('aria-expanded', 'false');

      // Open calendar
      fireEvent.click(dateButton);
      expect(dateButton).toHaveAttribute('aria-expanded', 'true');
    });

    it('has aria-haspopup attribute', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const dateButton = screen.getByTestId('date-nav-button');
      expect(dateButton).toHaveAttribute('aria-haspopup', 'dialog');
    });
  });

  describe('Screen reader announcements', () => {
    it('has aria-live region for announcements', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);

      const announcement = document.querySelector('[role="status"][aria-live="polite"]');
      expect(announcement).toBeInTheDocument();
    });
  });

  describe('Props', () => {
    it('shows navigation by default', () => {
      render(<DateNavigator date={defaultDate} onNavigate={mockOnNavigate} />);
      expect(screen.getByTestId('date-nav-prev')).toBeInTheDocument();
    });

    it('displays different dates correctly', () => {
      const futureDate = new Date('2025-01-15T12:00:00');
      render(<DateNavigator date={futureDate} onNavigate={mockOnNavigate} />);
      expect(screen.getByText('Jan 15th, 2025')).toBeInTheDocument();
    });
  });
});
