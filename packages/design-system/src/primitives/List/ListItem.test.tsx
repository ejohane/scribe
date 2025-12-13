/**
 * Tests for ListItem component accessibility attributes
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ListItem } from './ListItem';

describe('ListItem', () => {
  describe('accessibility attributes', () => {
    describe('role attribute', () => {
      it('should have role="option" by default', () => {
        render(<ListItem>Item</ListItem>);

        const item = screen.getByRole('option');
        expect(item).toBeInTheDocument();
      });

      it('should allow role="listitem" for standard list semantics', () => {
        render(<ListItem role="listitem">Item</ListItem>);

        const item = screen.getByRole('listitem');
        expect(item).toBeInTheDocument();
      });

      it('should allow role="menuitem" for menu contexts', () => {
        render(<ListItem role="menuitem">Item</ListItem>);

        const item = screen.getByRole('menuitem');
        expect(item).toBeInTheDocument();
      });
    });

    describe('aria-selected', () => {
      it('should set aria-selected="true" when selected', () => {
        render(<ListItem selected>Item</ListItem>);

        const item = screen.getByRole('option');
        expect(item).toHaveAttribute('aria-selected', 'true');
      });

      it('should set aria-selected="false" when not selected', () => {
        render(<ListItem selected={false}>Item</ListItem>);

        const item = screen.getByRole('option');
        expect(item).toHaveAttribute('aria-selected', 'false');
      });
    });

    describe('aria-disabled', () => {
      it('should set aria-disabled="true" when disabled', () => {
        render(<ListItem disabled>Item</ListItem>);

        const item = screen.getByRole('option');
        expect(item).toHaveAttribute('aria-disabled', 'true');
      });

      it('should set aria-disabled="false" when not disabled', () => {
        render(<ListItem disabled={false}>Item</ListItem>);

        const item = screen.getByRole('option');
        expect(item).toHaveAttribute('aria-disabled', 'false');
      });
    });
  });

  describe('keyboard navigation', () => {
    it('should be focusable when it has a click handler', () => {
      const handleClick = vi.fn();
      render(<ListItem onClick={handleClick}>Item</ListItem>);

      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('tabIndex', '0');
    });

    it('should not be focusable when disabled', () => {
      const handleClick = vi.fn();
      render(
        <ListItem onClick={handleClick} disabled>
          Item
        </ListItem>
      );

      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('tabIndex', '-1');
    });

    it('should trigger click on Enter key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<ListItem onClick={handleClick}>Item</ListItem>);

      const item = screen.getByRole('option');
      item.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should trigger click on Space key', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<ListItem onClick={handleClick}>Item</ListItem>);

      const item = screen.getByRole('option');
      item.focus();
      await user.keyboard(' ');

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not trigger click on Enter when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <ListItem onClick={handleClick} disabled>
          Item
        </ListItem>
      );

      const item = screen.getByRole('option');
      item.focus();
      await user.keyboard('{Enter}');

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not trigger click on Space when disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <ListItem onClick={handleClick} disabled>
          Item
        </ListItem>
      );

      const item = screen.getByRole('option');
      item.focus();
      await user.keyboard(' ');

      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should allow custom tabIndex', () => {
      render(<ListItem tabIndex={-1}>Item</ListItem>);

      const item = screen.getByRole('option');
      expect(item).toHaveAttribute('tabIndex', '-1');
    });

    it('should call onKeyDown handler', async () => {
      const user = userEvent.setup();
      const handleKeyDown = vi.fn();
      const handleClick = vi.fn();
      render(
        <ListItem onClick={handleClick} onKeyDown={handleKeyDown}>
          Item
        </ListItem>
      );

      const item = screen.getByRole('option');
      item.focus();
      await user.keyboard('{Enter}');

      expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });
  });

  describe('click behavior', () => {
    it('should call onClick when clicked', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(<ListItem onClick={handleClick}>Item</ListItem>);

      const item = screen.getByRole('option');
      await user.click(item);

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should not call onClick when clicked while disabled', async () => {
      const user = userEvent.setup();
      const handleClick = vi.fn();
      render(
        <ListItem onClick={handleClick} disabled>
          Item
        </ListItem>
      );

      const item = screen.getByRole('option');
      await user.click(item);

      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('basic functionality', () => {
    it('should render children', () => {
      render(<ListItem>Test content</ListItem>);

      expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('should forward ref to li element', () => {
      const ref = { current: null as HTMLLIElement | null };
      render(<ListItem ref={ref}>Item</ListItem>);

      expect(ref.current).toBeInstanceOf(HTMLLIElement);
    });
  });
});
