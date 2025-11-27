/**
 * WikiLinkAutocomplete Component Tests
 *
 * Tests the autocomplete popup UI for wiki-link suggestions.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WikiLinkAutocomplete } from './WikiLinkAutocomplete';
import type { SearchResult } from '@scribe/shared';

const mockResults: SearchResult[] = [
  { id: '1', title: 'Meeting Notes', snippet: '', score: 1, matches: [] },
  { id: '2', title: 'Project Plan', snippet: '', score: 0.8, matches: [] },
];

const defaultProps = {
  isOpen: true,
  query: 'meet',
  position: { top: 100, left: 200 },
  results: mockResults,
  selectedIndex: 0,
  onSelect: vi.fn(),
  onClose: vi.fn(),
  isLoading: false,
};

describe('WikiLinkAutocomplete', () => {
  describe('rendering', () => {
    it('renders nothing when isOpen=false', () => {
      const { container } = render(<WikiLinkAutocomplete {...defaultProps} isOpen={false} />);

      expect(container.firstChild).toBeNull();
    });

    it('renders popup when isOpen=true', () => {
      render(<WikiLinkAutocomplete {...defaultProps} />);

      expect(screen.getByRole('listbox')).toBeInTheDocument();
    });

    it('positions popup at specified coordinates', () => {
      render(<WikiLinkAutocomplete {...defaultProps} />);

      const popup = screen.getByRole('listbox');
      expect(popup).toHaveStyle({ top: '100px', left: '200px' });
    });

    it('shows loading state when isLoading=true', () => {
      render(<WikiLinkAutocomplete {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Searching...')).toBeInTheDocument();
    });
  });

  describe('results display', () => {
    it('renders all results', () => {
      render(<WikiLinkAutocomplete {...defaultProps} />);

      expect(screen.getByText('Meeting Notes')).toBeInTheDocument();
      expect(screen.getByText('Project Plan')).toBeInTheDocument();
    });

    it('shows "No matching notes" when results empty and query exists', () => {
      render(<WikiLinkAutocomplete {...defaultProps} results={[]} query="xyz" />);

      expect(screen.getByText('No matching notes')).toBeInTheDocument();
    });

    it('shows "Type to search notes" when results empty and no query', () => {
      render(<WikiLinkAutocomplete {...defaultProps} results={[]} query="" />);

      expect(screen.getByText('Type to search notes')).toBeInTheDocument();
    });

    it('shows "Untitled" for results with no title', () => {
      const resultsWithNoTitle: SearchResult[] = [
        { id: '1', title: '', snippet: '', score: 1, matches: [] },
      ];

      render(<WikiLinkAutocomplete {...defaultProps} results={resultsWithNoTitle} />);

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('shows "Untitled" for results with null title', () => {
      const resultsWithNullTitle: SearchResult[] = [
        { id: '1', title: null, snippet: '', score: 1, matches: [] },
      ];

      render(<WikiLinkAutocomplete {...defaultProps} results={resultsWithNullTitle} />);

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('highlights item at selectedIndex', () => {
      render(<WikiLinkAutocomplete {...defaultProps} selectedIndex={1} />);

      const items = screen.getAllByRole('option');
      expect(items[0]).toHaveAttribute('aria-selected', 'false');
      expect(items[1]).toHaveAttribute('aria-selected', 'true');
    });

    it('first item is selected by default (selectedIndex=0)', () => {
      render(<WikiLinkAutocomplete {...defaultProps} selectedIndex={0} />);

      const items = screen.getAllByRole('option');
      expect(items[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('sets aria-selected correctly on selected item', () => {
      render(<WikiLinkAutocomplete {...defaultProps} selectedIndex={1} />);

      const items = screen.getAllByRole('option');
      expect(items[0]).toHaveAttribute('aria-selected', 'false');
      expect(items[1]).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('interactions', () => {
    it('calls onSelect when item clicked', () => {
      const onSelect = vi.fn();
      render(<WikiLinkAutocomplete {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('Project Plan'));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith(mockResults[1]);
    });

    it('calls onSelect with correct result when first item clicked', () => {
      const onSelect = vi.fn();
      render(<WikiLinkAutocomplete {...defaultProps} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('Meeting Notes'));

      expect(onSelect).toHaveBeenCalledWith(mockResults[0]);
    });
  });

  describe('accessibility', () => {
    it('has aria-label on listbox', () => {
      render(<WikiLinkAutocomplete {...defaultProps} />);

      const listbox = screen.getByRole('listbox');
      expect(listbox).toHaveAttribute('aria-label', 'Note suggestions');
    });

    it('each result has role="option"', () => {
      render(<WikiLinkAutocomplete {...defaultProps} />);

      const options = screen.getAllByRole('option');
      expect(options).toHaveLength(2);
    });
  });
});
