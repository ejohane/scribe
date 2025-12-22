/**
 * Tests for SelectionToolbar component
 *
 * Tests cover:
 * - Toolbar visibility based on position prop
 * - Format button rendering and active states
 * - Format button click callbacks
 * - mouseDown preventDefault behavior (to preserve selection)
 * - Accessibility attributes
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SelectionToolbar, type SelectionToolbarProps } from './SelectionToolbar';

// Mock the design system icons
vi.mock('@scribe/design-system', () => ({
  BoldIcon: ({ size, strokeWidth }: { size: number; strokeWidth: number }) => (
    <svg data-testid="bold-icon" data-size={size} data-stroke-width={strokeWidth} />
  ),
  ItalicIcon: ({ size, strokeWidth }: { size: number; strokeWidth: number }) => (
    <svg data-testid="italic-icon" data-size={size} data-stroke-width={strokeWidth} />
  ),
  UnderlineIcon: ({ size, strokeWidth }: { size: number; strokeWidth: number }) => (
    <svg data-testid="underline-icon" data-size={size} data-stroke-width={strokeWidth} />
  ),
  StrikethroughIcon: ({ size, strokeWidth }: { size: number; strokeWidth: number }) => (
    <svg data-testid="strikethrough-icon" data-size={size} data-stroke-width={strokeWidth} />
  ),
  Heading1Icon: ({ size, strokeWidth }: { size: number; strokeWidth: number }) => (
    <svg data-testid="heading1-icon" data-size={size} data-stroke-width={strokeWidth} />
  ),
  Heading2Icon: ({ size, strokeWidth }: { size: number; strokeWidth: number }) => (
    <svg data-testid="heading2-icon" data-size={size} data-stroke-width={strokeWidth} />
  ),
  HighlightIcon: ({ size, strokeWidth }: { size: number; strokeWidth: number }) => (
    <svg data-testid="highlight-icon" data-size={size} data-stroke-width={strokeWidth} />
  ),
}));

describe('SelectionToolbar', () => {
  const defaultActiveFormats = {
    bold: false,
    italic: false,
    underline: false,
    strikethrough: false,
    h1: false,
    h2: false,
    highlight: false,
    link: false,
  };

  const defaultProps: SelectionToolbarProps = {
    position: { top: 100, left: 200 },
    activeFormats: defaultActiveFormats,
    onFormat: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('renders when position is provided', () => {
      render(<SelectionToolbar {...defaultProps} />);

      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });

    it('does not render when position is null', () => {
      render(<SelectionToolbar {...defaultProps} position={null} />);

      expect(screen.queryByRole('toolbar')).not.toBeInTheDocument();
    });
  });

  describe('positioning', () => {
    it('applies position styles from props', () => {
      render(<SelectionToolbar {...defaultProps} position={{ top: 150, left: 250 }} />);

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveStyle({ top: '150px', left: '250px' });
    });

    it('applies different position values correctly', () => {
      render(<SelectionToolbar {...defaultProps} position={{ top: 50, left: 100 }} />);

      const toolbar = screen.getByRole('toolbar');
      expect(toolbar).toHaveStyle({ top: '50px', left: '100px' });
    });
  });

  describe('accessibility', () => {
    it('has role="toolbar"', () => {
      render(<SelectionToolbar {...defaultProps} />);

      expect(screen.getByRole('toolbar')).toBeInTheDocument();
    });

    it('has aria-label for text formatting', () => {
      render(<SelectionToolbar {...defaultProps} />);

      expect(screen.getByLabelText('Text formatting')).toBeInTheDocument();
    });

    it('all format buttons have title attributes', () => {
      render(<SelectionToolbar {...defaultProps} />);

      expect(screen.getByTitle('Bold')).toBeInTheDocument();
      expect(screen.getByTitle('Italic')).toBeInTheDocument();
      expect(screen.getByTitle('Underline')).toBeInTheDocument();
      expect(screen.getByTitle('Strikethrough')).toBeInTheDocument();
      expect(screen.getByTitle('Heading 1')).toBeInTheDocument();
      expect(screen.getByTitle('Heading 2')).toBeInTheDocument();
      expect(screen.getByTitle('Highlight')).toBeInTheDocument();
    });
  });

  describe('format buttons', () => {
    describe('rendering', () => {
      it('renders all text formatting buttons', () => {
        render(<SelectionToolbar {...defaultProps} />);

        expect(screen.getByTestId('bold-icon')).toBeInTheDocument();
        expect(screen.getByTestId('italic-icon')).toBeInTheDocument();
        expect(screen.getByTestId('underline-icon')).toBeInTheDocument();
        expect(screen.getByTestId('strikethrough-icon')).toBeInTheDocument();
      });

      it('renders all block formatting buttons', () => {
        render(<SelectionToolbar {...defaultProps} />);

        expect(screen.getByTestId('heading1-icon')).toBeInTheDocument();
        expect(screen.getByTestId('heading2-icon')).toBeInTheDocument();
        expect(screen.getByTestId('highlight-icon')).toBeInTheDocument();
      });
    });

    describe('click handling', () => {
      it('calls onFormat with "bold" when bold button is clicked', () => {
        const onFormat = vi.fn();
        render(<SelectionToolbar {...defaultProps} onFormat={onFormat} />);

        fireEvent.click(screen.getByTitle('Bold'));

        expect(onFormat).toHaveBeenCalledTimes(1);
        expect(onFormat).toHaveBeenCalledWith('bold');
      });

      it('calls onFormat with "italic" when italic button is clicked', () => {
        const onFormat = vi.fn();
        render(<SelectionToolbar {...defaultProps} onFormat={onFormat} />);

        fireEvent.click(screen.getByTitle('Italic'));

        expect(onFormat).toHaveBeenCalledTimes(1);
        expect(onFormat).toHaveBeenCalledWith('italic');
      });

      it('calls onFormat with "underline" when underline button is clicked', () => {
        const onFormat = vi.fn();
        render(<SelectionToolbar {...defaultProps} onFormat={onFormat} />);

        fireEvent.click(screen.getByTitle('Underline'));

        expect(onFormat).toHaveBeenCalledTimes(1);
        expect(onFormat).toHaveBeenCalledWith('underline');
      });

      it('calls onFormat with "strikethrough" when strikethrough button is clicked', () => {
        const onFormat = vi.fn();
        render(<SelectionToolbar {...defaultProps} onFormat={onFormat} />);

        fireEvent.click(screen.getByTitle('Strikethrough'));

        expect(onFormat).toHaveBeenCalledTimes(1);
        expect(onFormat).toHaveBeenCalledWith('strikethrough');
      });

      it('calls onFormat with "h1" when heading 1 button is clicked', () => {
        const onFormat = vi.fn();
        render(<SelectionToolbar {...defaultProps} onFormat={onFormat} />);

        fireEvent.click(screen.getByTitle('Heading 1'));

        expect(onFormat).toHaveBeenCalledTimes(1);
        expect(onFormat).toHaveBeenCalledWith('h1');
      });

      it('calls onFormat with "h2" when heading 2 button is clicked', () => {
        const onFormat = vi.fn();
        render(<SelectionToolbar {...defaultProps} onFormat={onFormat} />);

        fireEvent.click(screen.getByTitle('Heading 2'));

        expect(onFormat).toHaveBeenCalledTimes(1);
        expect(onFormat).toHaveBeenCalledWith('h2');
      });

      it('calls onFormat with "highlight" when highlight button is clicked', () => {
        const onFormat = vi.fn();
        render(<SelectionToolbar {...defaultProps} onFormat={onFormat} />);

        fireEvent.click(screen.getByTitle('Highlight'));

        expect(onFormat).toHaveBeenCalledTimes(1);
        expect(onFormat).toHaveBeenCalledWith('highlight');
      });
    });

    describe('active states', () => {
      it('shows bold as active when activeFormats.bold is true', () => {
        render(
          <SelectionToolbar
            {...defaultProps}
            activeFormats={{ ...defaultActiveFormats, bold: true }}
          />
        );

        // The active button should have the active class
        const boldButton = screen.getByTitle('Bold');
        expect(boldButton.className).toContain('buttonActive');
      });

      it('shows italic as active when activeFormats.italic is true', () => {
        render(
          <SelectionToolbar
            {...defaultProps}
            activeFormats={{ ...defaultActiveFormats, italic: true }}
          />
        );

        const italicButton = screen.getByTitle('Italic');
        expect(italicButton.className).toContain('buttonActive');
      });

      it('shows underline as active when activeFormats.underline is true', () => {
        render(
          <SelectionToolbar
            {...defaultProps}
            activeFormats={{ ...defaultActiveFormats, underline: true }}
          />
        );

        const underlineButton = screen.getByTitle('Underline');
        expect(underlineButton.className).toContain('buttonActive');
      });

      it('shows strikethrough as active when activeFormats.strikethrough is true', () => {
        render(
          <SelectionToolbar
            {...defaultProps}
            activeFormats={{ ...defaultActiveFormats, strikethrough: true }}
          />
        );

        const strikethroughButton = screen.getByTitle('Strikethrough');
        expect(strikethroughButton.className).toContain('buttonActive');
      });

      it('shows h1 as active when activeFormats.h1 is true', () => {
        render(
          <SelectionToolbar
            {...defaultProps}
            activeFormats={{ ...defaultActiveFormats, h1: true }}
          />
        );

        const h1Button = screen.getByTitle('Heading 1');
        expect(h1Button.className).toContain('buttonActive');
      });

      it('shows h2 as active when activeFormats.h2 is true', () => {
        render(
          <SelectionToolbar
            {...defaultProps}
            activeFormats={{ ...defaultActiveFormats, h2: true }}
          />
        );

        const h2Button = screen.getByTitle('Heading 2');
        expect(h2Button.className).toContain('buttonActive');
      });

      it('shows highlight as active when activeFormats.highlight is true', () => {
        render(
          <SelectionToolbar
            {...defaultProps}
            activeFormats={{ ...defaultActiveFormats, highlight: true }}
          />
        );

        const highlightButton = screen.getByTitle('Highlight');
        expect(highlightButton.className).toContain('buttonActive');
      });

      it('can show multiple formats as active simultaneously', () => {
        render(
          <SelectionToolbar
            {...defaultProps}
            activeFormats={{
              ...defaultActiveFormats,
              bold: true,
              italic: true,
              underline: true,
            }}
          />
        );

        expect(screen.getByTitle('Bold').className).toContain('buttonActive');
        expect(screen.getByTitle('Italic').className).toContain('buttonActive');
        expect(screen.getByTitle('Underline').className).toContain('buttonActive');
        expect(screen.getByTitle('Strikethrough').className).not.toContain('buttonActive');
      });

      it('shows no formats as active when all are false', () => {
        render(<SelectionToolbar {...defaultProps} activeFormats={defaultActiveFormats} />);

        expect(screen.getByTitle('Bold').className).not.toContain('buttonActive');
        expect(screen.getByTitle('Italic').className).not.toContain('buttonActive');
        expect(screen.getByTitle('Underline').className).not.toContain('buttonActive');
        expect(screen.getByTitle('Strikethrough').className).not.toContain('buttonActive');
        expect(screen.getByTitle('Heading 1').className).not.toContain('buttonActive');
        expect(screen.getByTitle('Heading 2').className).not.toContain('buttonActive');
        expect(screen.getByTitle('Highlight').className).not.toContain('buttonActive');
      });
    });
  });

  describe('selection preservation', () => {
    it('prevents default on mousedown to preserve text selection', () => {
      render(<SelectionToolbar {...defaultProps} />);

      const toolbar = screen.getByRole('toolbar');
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true });
      const preventDefaultSpy = vi.spyOn(mouseDownEvent, 'preventDefault');

      toolbar.dispatchEvent(mouseDownEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });
  });

  describe('toolbar structure', () => {
    it('renders dividers between sections', () => {
      const { container } = render(<SelectionToolbar {...defaultProps} />);

      // The toolbar has 1 divider separating the 2 sections
      const dividers = container.querySelectorAll('[class*="divider"]');
      expect(dividers.length).toBe(1);
    });

    it('renders pointer elements for visual design', () => {
      const { container } = render(<SelectionToolbar {...defaultProps} />);

      // Should have pointer and pointerBorder elements
      const pointer = container.querySelector('[class*="pointer"]');
      const pointerBorder = container.querySelector('[class*="pointerBorder"]');

      expect(pointer).toBeInTheDocument();
      expect(pointerBorder).toBeInTheDocument();
    });
  });

  describe('button types', () => {
    it('all buttons have type="button" to prevent form submission', () => {
      render(<SelectionToolbar {...defaultProps} />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).toHaveAttribute('type', 'button');
      });
    });
  });
});
