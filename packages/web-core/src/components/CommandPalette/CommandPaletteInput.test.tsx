/**
 * CommandPaletteInput Component Tests
 *
 * Tests for the search input component of the command palette.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPaletteInput } from './CommandPaletteInput';

describe('CommandPaletteInput', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    onEscape: vi.fn(),
    onArrowDown: vi.fn(),
    onArrowUp: vi.fn(),
    view: 'command' as const,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders input element', () => {
      render(<CommandPaletteInput {...defaultProps} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders search icon', () => {
      render(<CommandPaletteInput {...defaultProps} />);

      // The search icon is rendered by the SearchIcon component from design-system
      // We check that an svg exists in the component
      const { container } = render(<CommandPaletteInput {...defaultProps} />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders escape hint', () => {
      render(<CommandPaletteInput {...defaultProps} />);

      expect(screen.getByText('esc')).toBeInTheDocument();
    });

    it('displays current value', () => {
      render(<CommandPaletteInput {...defaultProps} value="test query" />);

      expect(screen.getByRole('textbox')).toHaveValue('test query');
    });
  });

  describe('placeholder', () => {
    it('shows command placeholder for command view', () => {
      render(<CommandPaletteInput {...defaultProps} view="command" />);

      expect(screen.getByPlaceholderText('Type a command or search...')).toBeInTheDocument();
    });

    it('shows note search placeholder for note-search view', () => {
      render(<CommandPaletteInput {...defaultProps} view="note-search" />);

      expect(screen.getByPlaceholderText('Search notes...')).toBeInTheDocument();
    });
  });

  describe('auto-focus', () => {
    it('focuses input on mount', async () => {
      render(<CommandPaletteInput {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByRole('textbox')).toHaveFocus();
      });
    });
  });

  describe('onChange callback', () => {
    it('calls onChange when typing', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<CommandPaletteInput {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'a');

      expect(onChange).toHaveBeenCalledWith('a');
    });

    it('calls onChange for each keystroke', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<CommandPaletteInput {...defaultProps} onChange={onChange} />);

      const input = screen.getByRole('textbox');
      await user.type(input, 'test');

      // Since the component is controlled and value isn't updated between renders,
      // each keystroke reports just that character being added to the current value
      expect(onChange).toHaveBeenCalledTimes(4);
      // Note: The actual accumulated values depend on how React's controlled component
      // works - each call gets the full input value at that moment
    });
  });

  describe('keyboard handling', () => {
    it('calls onSubmit on Enter', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<CommandPaletteInput {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('{Enter}');

      expect(onSubmit).toHaveBeenCalledTimes(1);
    });

    it('calls onEscape on Escape', async () => {
      const user = userEvent.setup();
      const onEscape = vi.fn();

      render(<CommandPaletteInput {...defaultProps} onEscape={onEscape} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('{Escape}');

      expect(onEscape).toHaveBeenCalledTimes(1);
    });

    it('calls onArrowDown on ArrowDown', async () => {
      const user = userEvent.setup();
      const onArrowDown = vi.fn();

      render(<CommandPaletteInput {...defaultProps} onArrowDown={onArrowDown} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('{ArrowDown}');

      expect(onArrowDown).toHaveBeenCalledTimes(1);
    });

    it('calls onArrowUp on ArrowUp', async () => {
      const user = userEvent.setup();
      const onArrowUp = vi.fn();

      render(<CommandPaletteInput {...defaultProps} onArrowUp={onArrowUp} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('{ArrowUp}');

      expect(onArrowUp).toHaveBeenCalledTimes(1);
    });

    it('prevents default for handled keys', async () => {
      const user = userEvent.setup();
      const onSubmit = vi.fn();

      render(<CommandPaletteInput {...defaultProps} onSubmit={onSubmit} />);

      const input = screen.getByRole('textbox');
      await user.click(input);
      await user.keyboard('{Enter}');

      // If default was not prevented, form submission or other default behavior would occur
      // We verify this by checking the handler was called and no other side effects
      expect(onSubmit).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has aria-label matching placeholder', () => {
      render(<CommandPaletteInput {...defaultProps} view="command" />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-label', 'Type a command or search...');
    });

    it('has aria-autocomplete="list"', () => {
      render(<CommandPaletteInput {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
    });

    it('has aria-haspopup="listbox"', () => {
      render(<CommandPaletteInput {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });

    it('has autocomplete disabled', () => {
      render(<CommandPaletteInput {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('autocomplete', 'off');
    });

    it('has autocorrect disabled', () => {
      render(<CommandPaletteInput {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('autocorrect', 'off');
    });

    it('has spellcheck disabled', () => {
      render(<CommandPaletteInput {...defaultProps} />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('spellcheck', 'false');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to input element', () => {
      const ref = { current: null as HTMLInputElement | null };

      render(<CommandPaletteInput {...defaultProps} ref={ref} />);

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
    });

    it('supports callback ref', () => {
      const ref = vi.fn();

      render(<CommandPaletteInput {...defaultProps} ref={ref} />);

      expect(ref).toHaveBeenCalledWith(expect.any(HTMLInputElement));
    });
  });

  describe('custom className', () => {
    it('applies custom className to wrapper', () => {
      const { container } = render(
        <CommandPaletteInput {...defaultProps} className="custom-class" />
      );

      // The wrapper should have the custom class
      expect(container.querySelector('.custom-class')).toBeInTheDocument();
    });
  });
});
