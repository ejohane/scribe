/**
 * CommandPaletteSection Component Tests
 *
 * Tests for the section header component of the command palette.
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CommandPaletteSection } from './CommandPaletteSection';

describe('CommandPaletteSection', () => {
  describe('rendering', () => {
    it('renders section label', () => {
      render(
        <CommandPaletteSection label="Notes">
          <div>Content</div>
        </CommandPaletteSection>
      );

      expect(screen.getByText('Notes')).toBeInTheDocument();
    });

    it('renders children', () => {
      render(
        <CommandPaletteSection label="Notes">
          <div data-testid="child">Item 1</div>
          <div data-testid="child">Item 2</div>
        </CommandPaletteSection>
      );

      const children = screen.getAllByTestId('child');
      expect(children).toHaveLength(2);
    });
  });

  describe('accessibility', () => {
    it('has role="group"', () => {
      render(
        <CommandPaletteSection label="Notes">
          <div>Content</div>
        </CommandPaletteSection>
      );

      expect(screen.getByRole('group')).toBeInTheDocument();
    });

    it('has aria-label matching label prop', () => {
      render(
        <CommandPaletteSection label="Recent Notes">
          <div>Content</div>
        </CommandPaletteSection>
      );

      const group = screen.getByRole('group');
      expect(group).toHaveAttribute('aria-label', 'Recent Notes');
    });
  });

  describe('styling', () => {
    it('applies custom className', () => {
      render(
        <CommandPaletteSection label="Notes" className="custom-section">
          <div>Content</div>
        </CommandPaletteSection>
      );

      const group = screen.getByRole('group');
      expect(group).toHaveClass('custom-section');
    });
  });

  describe('content', () => {
    it('renders complex children', () => {
      render(
        <CommandPaletteSection label="Commands">
          <ul>
            <li>Command 1</li>
            <li>Command 2</li>
          </ul>
        </CommandPaletteSection>
      );

      expect(screen.getByText('Command 1')).toBeInTheDocument();
      expect(screen.getByText('Command 2')).toBeInTheDocument();
    });

    it('renders with no children', () => {
      render(<CommandPaletteSection label="Empty" children={null} />);

      expect(screen.getByText('Empty')).toBeInTheDocument();
    });
  });
});
