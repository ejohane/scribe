/**
 * Tests for Calendar component
 *
 * Uses fake timers to ensure consistent date-based tests.
 * Tests cover rendering, navigation, selection, disabled dates.
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Calendar } from './Calendar';

describe('Calendar', () => {
  // Use fake timers to ensure consistent date-based tests
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-12-18T12:00:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  describe('rendering', () => {
    it('renders with default props', () => {
      render(<Calendar />);

      // Should render the calendar structure (grid role)
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });

    it('shows current month by default', () => {
      render(<Calendar />);

      // December 2025 should be displayed
      expect(screen.getByText(/December 2025/i)).toBeInTheDocument();
    });

    it('displays day headers', () => {
      render(<Calendar />);

      // Check for day headers - react-day-picker uses abbreviated names
      expect(screen.getByText('Su')).toBeInTheDocument();
      expect(screen.getByText('Mo')).toBeInTheDocument();
      expect(screen.getByText('Tu')).toBeInTheDocument();
      expect(screen.getByText('We')).toBeInTheDocument();
      expect(screen.getByText('Th')).toBeInTheDocument();
      expect(screen.getByText('Fr')).toBeInTheDocument();
      expect(screen.getByText('Sa')).toBeInTheDocument();
    });

    it('renders day buttons for the current month', () => {
      render(<Calendar />);

      // Check some specific dates using their full aria-labels
      expect(screen.getByRole('button', { name: /December 1st/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /December 15th/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /December 25th/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /December 31st/i })).toBeInTheDocument();
    });

    it('applies additional className', () => {
      const { container } = render(<Calendar className="custom-class" />);

      // The root element should have the custom class
      const root = container.firstChild as HTMLElement;
      expect(root.className).toContain('custom-class');
    });
  });

  describe('navigation', () => {
    it('renders navigation buttons', () => {
      render(<Calendar />);

      // Check for navigation buttons using their aria-labels
      expect(screen.getByRole('button', { name: /previous month/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /next month/i })).toBeInTheDocument();
    });

    it('respects defaultMonth prop', () => {
      render(<Calendar defaultMonth={new Date(2025, 5, 15)} />);

      // Should show June 2025
      expect(screen.getByText(/June 2025/i)).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('calls onSelect when date is clicked', async () => {
      // Use real timers for click tests to avoid timeout issues
      vi.useRealTimers();
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Calendar onSelect={onSelect} />);

      // Click on December 25th using the full aria-label pattern
      const day25 = screen.getByRole('button', { name: /December 25th/i });
      await user.click(day25);

      // onSelect should be called
      expect(onSelect).toHaveBeenCalledTimes(1);

      // react-day-picker v9 passes Date | undefined
      const selectedDate = onSelect.mock.calls[0][0] as Date;
      expect(selectedDate).toBeInstanceOf(Date);
      expect(selectedDate.getFullYear()).toBe(2025);
      expect(selectedDate.getMonth()).toBe(11); // December is month 11
      expect(selectedDate.getDate()).toBe(25);

      // Restore fake timers
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-12-18T12:00:00'));
    });

    it('highlights the selected date with selected class', () => {
      const selectedDate = new Date(2025, 11, 25);
      render(<Calendar selected={selectedDate} />);

      // Find the selected day's button and check its parent cell
      const day25Button = screen.getByRole('button', { name: /December 25th/i });
      const dayCell = day25Button.parentElement;
      expect(dayCell?.className).toMatch(/daySelected/);
    });

    it('highlights today with today class', () => {
      render(<Calendar />);

      // Today is December 18, 2025 - it has "Today" prefix in aria-label
      const todayButton = screen.getByRole('button', { name: /Today/i });
      const todayCell = todayButton.parentElement;
      expect(todayCell?.className).toMatch(/dayToday/);
    });

    it('allows clicking a different date to change selection', async () => {
      // Use real timers for click tests to avoid timeout issues
      vi.useRealTimers();
      const user = userEvent.setup();
      const onSelect = vi.fn();
      render(<Calendar selected={new Date(2025, 11, 25)} onSelect={onSelect} />);

      // Click on a different date
      const day20 = screen.getByRole('button', { name: /December 20th/i });
      await user.click(day20);

      // onSelect should be called with a Date
      expect(onSelect).toHaveBeenCalled();
      const selectedDate = onSelect.mock.calls[0][0] as Date;
      expect(selectedDate).toBeInstanceOf(Date);
      expect(selectedDate.getDate()).toBe(20);

      // Restore fake timers
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-12-18T12:00:00'));
    });
  });

  describe('disabled dates', () => {
    it('applies disabled styling to dates in disabled array', () => {
      const disabledDates = [new Date(2025, 11, 25), new Date(2025, 11, 26)];
      render(<Calendar disabled={disabledDates} />);

      // Check that December 25 has disabled class
      const day25Button = screen.getByRole('button', { name: /December 25th/i });
      const day25Cell = day25Button.parentElement;
      expect(day25Cell?.className).toMatch(/dayDisabled/);

      // Check that December 26 has disabled class
      const day26Button = screen.getByRole('button', { name: /December 26th/i });
      const day26Cell = day26Button.parentElement;
      expect(day26Cell?.className).toMatch(/dayDisabled/);

      // Check that December 24 does NOT have disabled class
      const day24Button = screen.getByRole('button', { name: /December 24th/i });
      const day24Cell = day24Button.parentElement;
      expect(day24Cell?.className).not.toMatch(/dayDisabled/);
    });

    it('applies disabled styling when disabled function returns true', () => {
      // Disable all weekends
      const isWeekend = (date: Date) => {
        const day = date.getDay();
        return day === 0 || day === 6; // Sunday or Saturday
      };

      render(<Calendar disabled={isWeekend} />);

      // December 20, 2025 is Saturday - should be disabled
      const day20Button = screen.getByRole('button', { name: /December 20th/i });
      const day20Cell = day20Button.parentElement;
      expect(day20Cell?.className).toMatch(/dayDisabled/);

      // December 21, 2025 is Sunday - should be disabled
      const day21Button = screen.getByRole('button', { name: /December 21st/i });
      const day21Cell = day21Button.parentElement;
      expect(day21Cell?.className).toMatch(/dayDisabled/);

      // December 22, 2025 is Monday - should NOT be disabled
      const day22Button = screen.getByRole('button', { name: /December 22nd/i });
      const day22Cell = day22Button.parentElement;
      expect(day22Cell?.className).not.toMatch(/dayDisabled/);
    });

    it('does not call onSelect for disabled dates', async () => {
      // Use real timers for click tests to avoid timeout issues
      vi.useRealTimers();
      const user = userEvent.setup();
      const onSelect = vi.fn();
      const disabledDates = [new Date(2025, 11, 25)];

      render(<Calendar onSelect={onSelect} disabled={disabledDates} />);

      // Try to click on disabled date
      const day25Button = screen.getByRole('button', { name: /December 25th/i });
      await user.click(day25Button);

      // onSelect should NOT have been called
      expect(onSelect).not.toHaveBeenCalled();

      // Restore fake timers
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2025-12-18T12:00:00'));
    });
  });

  describe('outside days', () => {
    it('shows outside days by default', () => {
      render(<Calendar />);

      // December 2025 starts on Monday, so November 30 (Sunday) should be visible
      // as an "outside" day
      const outsideDays = screen.getByRole('button', { name: /November 30th/i });
      expect(outsideDays).toBeInTheDocument();
    });

    it('applies outside styling to days from adjacent months', () => {
      render(<Calendar />);

      // November 30 is an outside day for December
      const outsideDay = screen.getByRole('button', { name: /November 30th/i });
      const outsideCell = outsideDay.parentElement;
      expect(outsideCell?.className).toMatch(/dayOutside/);
    });
  });

  describe('keyboard navigation', () => {
    it('renders focusable day buttons', () => {
      render(<Calendar />);

      // Find day buttons - they should be buttons with specific aria-labels
      const dayButtons = screen
        .getAllByRole('button')
        .filter((btn) => btn.getAttribute('aria-label')?.includes('December'));

      // Each day should be a focusable button
      dayButtons.forEach((btn) => {
        expect(btn.tagName).toBe('BUTTON');
      });
    });
  });

  describe('multiple months', () => {
    it('can display multiple months', () => {
      render(<Calendar numberOfMonths={2} />);

      // Should show December 2025 and January 2026
      expect(screen.getByText(/December 2025/i)).toBeInTheDocument();
      expect(screen.getByText(/January 2026/i)).toBeInTheDocument();
    });
  });

  describe('fixed weeks', () => {
    it('can display with fixed weeks option', () => {
      render(<Calendar fixedWeeks={true} />);

      // The calendar should render successfully
      expect(screen.getByRole('grid')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper grid role for accessibility', () => {
      render(<Calendar />);

      const grid = screen.getByRole('grid');
      expect(grid).toHaveAttribute('aria-label', 'December 2025');
    });

    it('has proper gridcell roles for days', () => {
      render(<Calendar />);

      // Check that gridcells exist
      const gridcells = screen.getAllByRole('gridcell');
      expect(gridcells.length).toBeGreaterThan(0);
    });

    it('marks today with "Today" prefix in aria-label', () => {
      render(<Calendar />);

      // Today (Dec 18) should have "Today" in its aria-label
      const todayButton = screen.getByRole('button', { name: /^Today/i });
      expect(todayButton).toBeInTheDocument();
    });
  });
});
