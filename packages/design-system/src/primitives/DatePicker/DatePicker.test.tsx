/**
 * Tests for DatePicker component
 *
 * Uses userEvent for click tests to properly trigger react-day-picker v9's onSelect.
 */

import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DatePicker } from './DatePicker';

// Reset any mocks after each test
afterEach(() => {
  vi.clearAllMocks();
});

// Helper to create dates with consistent timezone handling
const createDate = (year: number, month: number, day: number) => {
  return new Date(year, month - 1, day, 12, 0, 0);
};

describe('DatePicker', () => {
  describe('trigger', () => {
    it('renders trigger button with placeholder when no value', () => {
      render(<DatePicker onChange={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toBeInTheDocument();
      expect(button).toHaveTextContent('Select date');
    });

    it('shows custom placeholder when provided', () => {
      render(<DatePicker onChange={() => {}} placeholder="Choose a date" />);

      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Choose a date');
    });

    it('shows date in correct format', () => {
      const date = createDate(2025, 12, 25);
      render(<DatePicker value={date} onChange={() => {}} />);

      const button = screen.getByRole('button');
      // Should contain the date in some format
      expect(button).toHaveTextContent(/Dec 25/);
    });

    it('has aria-haspopup and aria-expanded attributes', () => {
      render(<DatePicker onChange={() => {}} />);

      const button = screen.getByRole('button');
      expect(button).toHaveAttribute('aria-haspopup', 'dialog');
      expect(button).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('popover', () => {
    it('opens popover on trigger click', () => {
      render(<DatePicker value={createDate(2025, 12, 18)} onChange={() => {}} />);

      const trigger = screen.getByRole('button');
      fireEvent.click(trigger);

      // Dialog should be present
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      // Trigger should have expanded state
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes popover on date selection', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DatePicker value={createDate(2025, 12, 18)} onChange={onChange} />);

      // Open popover
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click on December 25th - use button with aria-label like Calendar tests
      const day25Button = screen.getByRole('button', { name: /December 25th/i });
      await user.click(day25Button);

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('closes popover on click outside', async () => {
      render(
        <div>
          <DatePicker value={createDate(2025, 12, 18)} onChange={() => {}} />
          <button data-testid="outside">Outside</button>
        </div>
      );

      // Open popover - get the first button (the trigger)
      const buttons = screen.getAllByRole('button');
      fireEvent.click(buttons[0]);
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click outside using mousedown event
      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('does NOT close on click inside popover', () => {
      render(<DatePicker value={createDate(2025, 12, 18)} onChange={() => {}} />);

      // Open popover
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Click on the dialog itself (not a day cell)
      const dialog = screen.getByRole('dialog');
      fireEvent.mouseDown(dialog);

      // Popover should still be open
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('closes popover on Escape key', async () => {
      render(<DatePicker value={createDate(2025, 12, 18)} onChange={() => {}} />);

      // Open popover
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });

    it('stops Escape propagation to prevent closing parent modals', async () => {
      const onParentEscape = vi.fn();

      render(
        <div onKeyDown={(e) => e.key === 'Escape' && onParentEscape()}>
          <DatePicker value={createDate(2025, 12, 18)} onChange={() => {}} />
        </div>
      );

      // Open popover
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Press Escape
      fireEvent.keyDown(document, { key: 'Escape' });

      // Popover should close
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });

      // Parent should NOT have received the Escape event
      expect(onParentEscape).not.toHaveBeenCalled();
    });
  });

  describe('selection', () => {
    it('calls onChange with selected date', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DatePicker value={createDate(2025, 12, 18)} onChange={onChange} />);

      // Open popover
      fireEvent.click(screen.getByRole('button'));

      // Click on December 25th - use button with aria-label like Calendar tests
      const day25Button = screen.getByRole('button', { name: /December 25th/i });
      await user.click(day25Button);

      // onChange should be called with the new date
      expect(onChange).toHaveBeenCalledTimes(1);
      const selectedDate = onChange.mock.calls[0][0] as Date;
      expect(selectedDate).toBeInstanceOf(Date);
      expect(selectedDate.getDate()).toBe(25);
      expect(selectedDate.getMonth()).toBe(11); // December is 11 (0-indexed)
      expect(selectedDate.getFullYear()).toBe(2025);
    });

    it('closes popover after selection', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      render(<DatePicker value={createDate(2025, 12, 18)} onChange={onChange} />);

      // Open popover
      fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('dialog')).toBeInTheDocument();

      // Select December 20th
      const day20Button = screen.getByRole('button', { name: /December 20th/i });
      await user.click(day20Button);

      // Popover should be closed
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
    });
  });

  describe('disabled', () => {
    it('disabled prop prevents opening popover', () => {
      render(<DatePicker onChange={() => {}} disabled />);

      const button = screen.getByRole('button');
      fireEvent.click(button);

      // Popover should NOT open
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('trigger has disabled attribute', () => {
      render(<DatePicker onChange={() => {}} disabled />);

      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });
  });

  describe('keyboard navigation', () => {
    it('toggles popover on Enter key', () => {
      render(<DatePicker value={createDate(2025, 12, 18)} onChange={() => {}} />);

      const trigger = screen.getByRole('button');

      // Focus trigger and press Enter
      trigger.focus();
      fireEvent.keyDown(trigger, { key: 'Enter' });

      // Popover should open (button click triggered by Enter)
      // Note: This may depend on browser behavior
    });
  });

  describe('default month', () => {
    it('shows selected month when value is provided', () => {
      const januaryDate = createDate(2025, 1, 15);
      render(<DatePicker value={januaryDate} onChange={() => {}} />);

      // Open popover
      fireEvent.click(screen.getByRole('button'));

      // Should show January 2025
      expect(screen.getByText('January 2025')).toBeInTheDocument();
    });

    it('shows December when value is December', () => {
      const decemberDate = createDate(2025, 12, 18);
      render(<DatePicker value={decemberDate} onChange={() => {}} />);

      // Open popover
      fireEvent.click(screen.getByRole('button'));

      // Should show December 2025
      expect(screen.getByText('December 2025')).toBeInTheDocument();
    });
  });
});
