/**
 * Tests for Button component accessibility attributes
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './Button';

describe('Button', () => {
  describe('accessibility attributes', () => {
    describe('aria-pressed (toggle buttons)', () => {
      it('should apply aria-pressed="true" when pressed', () => {
        render(<Button aria-pressed={true}>Bold</Button>);

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-pressed', 'true');
      });

      it('should apply aria-pressed="false" when not pressed', () => {
        render(<Button aria-pressed={false}>Bold</Button>);

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-pressed', 'false');
      });

      it('should not have aria-pressed when not a toggle button', () => {
        render(<Button>Submit</Button>);

        const button = screen.getByRole('button');
        expect(button).not.toHaveAttribute('aria-pressed');
      });
    });

    describe('aria-expanded (disclosure buttons)', () => {
      it('should apply aria-expanded="true" when expanded', () => {
        render(<Button aria-expanded={true}>Show more</Button>);

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-expanded', 'true');
      });

      it('should apply aria-expanded="false" when collapsed', () => {
        render(<Button aria-expanded={false}>Show more</Button>);

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-expanded', 'false');
      });

      it('should not have aria-expanded when not a disclosure button', () => {
        render(<Button>Submit</Button>);

        const button = screen.getByRole('button');
        expect(button).not.toHaveAttribute('aria-expanded');
      });
    });

    describe('aria-disabled', () => {
      it('should set aria-disabled="true" when disabled prop is true', () => {
        render(<Button disabled>Submit</Button>);

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).toHaveAttribute('disabled');
      });

      it('should allow explicit aria-disabled to override disabled prop', () => {
        // Use case: disabled button that still needs to be focusable (e.g., for tooltips)
        render(
          <Button disabled aria-disabled={false}>
            Submit
          </Button>
        );

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-disabled', 'false');
        expect(button).toHaveAttribute('disabled');
      });

      it('should set aria-disabled without disabled attribute when only aria-disabled is provided', () => {
        // This allows the button to remain focusable while appearing disabled
        render(<Button aria-disabled={true}>Submit</Button>);

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-disabled', 'true');
        expect(button).not.toHaveAttribute('disabled');
      });

      it('should not set aria-disabled when neither disabled nor aria-disabled is provided', () => {
        render(<Button>Submit</Button>);

        const button = screen.getByRole('button');
        expect(button).not.toHaveAttribute('aria-disabled');
        expect(button).not.toHaveAttribute('disabled');
      });
    });

    describe('combined accessibility attributes', () => {
      it('should support multiple accessibility attributes together', () => {
        render(
          <Button aria-pressed={true} aria-expanded={true} aria-disabled={false}>
            Menu Toggle
          </Button>
        );

        const button = screen.getByRole('button');
        expect(button).toHaveAttribute('aria-pressed', 'true');
        expect(button).toHaveAttribute('aria-expanded', 'true');
        expect(button).toHaveAttribute('aria-disabled', 'false');
      });
    });
  });

  describe('basic functionality', () => {
    it('should render with default props', () => {
      render(<Button>Click me</Button>);

      const button = screen.getByRole('button', { name: 'Click me' });
      expect(button).toBeInTheDocument();
    });

    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);

      const button = screen.getByRole('button');
      await user.click(button);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should forward ref to button element', () => {
      const ref = { current: null as HTMLButtonElement | null };
      render(<Button ref={ref}>Click me</Button>);

      expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    });
  });
});
