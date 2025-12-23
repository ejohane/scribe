/**
 * ReferencesWidget Component Tests
 *
 * Tests for extracting and displaying wiki-links and URLs from note content.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  ReferencesWidget,
  extractReferences,
  extractChildrenText,
  truncateUrl,
} from './ReferencesWidget';
import type { Note, EditorContent } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Helper to create mock note with specific content
function mockNote(contentChildren: unknown[]): Note {
  return {
    id: createNoteId('test-id'),
    title: 'Test Note',
    type: undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: {
      root: {
        type: 'root',
        children: contentChildren,
        format: '',
        indent: 0,
        version: 1,
      },
    } as EditorContent,
    metadata: { title: null, tags: [], links: [], mentions: [] },
  };
}

describe('ReferencesWidget', () => {
  describe('extractReferences', () => {
    it('extracts wiki-links from content', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'wiki-link',
              targetId: 'note-123',
              displayText: 'Project Alpha',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Project Alpha')).toBeInTheDocument();
    });

    it('uses noteTitle when displayText is not available', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'wiki-link',
              targetId: 'note-456',
              noteTitle: 'Fallback Title',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Fallback Title')).toBeInTheDocument();
    });

    it('shows "Untitled" when neither displayText nor noteTitle is available', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'wiki-link',
              targetId: 'note-789',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('extracts URLs from content', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'https://example.com/doc',
              title: 'Example Doc',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Example Doc')).toBeInTheDocument();
    });

    it('extracts both http and https URLs', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'http://example.com/http-doc',
              title: 'HTTP Doc',
            },
            {
              type: 'link',
              url: 'https://example.com/https-doc',
              title: 'HTTPS Doc',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('HTTP Doc')).toBeInTheDocument();
      expect(screen.getByText('HTTPS Doc')).toBeInTheDocument();
    });

    it('ignores non-http/https URLs', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'mailto:test@example.com',
              title: 'Email Link',
            },
            {
              type: 'link',
              url: 'ftp://files.example.com',
              title: 'FTP Link',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.queryByText('Email Link')).not.toBeInTheDocument();
      expect(screen.queryByText('FTP Link')).not.toBeInTheDocument();
      expect(screen.getByText('No references')).toBeInTheDocument();
    });

    it('shows empty state when no references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Just plain text' }],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('No references')).toBeInTheDocument();
    });

    it('truncates long URLs when no title is provided', () => {
      const longUrl = 'https://example.com/very/long/path/to/document/with/many/segments';
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: longUrl,
              // No title, so URL should be truncated
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Should be truncated and contain ellipsis
      const button = screen.getByRole('button');
      expect(button.textContent).toContain('example.com/very/long');
      expect(button.textContent).toContain('...');
    });

    it('deduplicates repeated wiki-link references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            { type: 'wiki-link', targetId: 'note-123', displayText: 'Project Alpha' },
            { type: 'text', text: ' some text ' },
            { type: 'wiki-link', targetId: 'note-123', displayText: 'Project Alpha' },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Should only appear once
      const items = screen.getAllByText('Project Alpha');
      expect(items).toHaveLength(1);
    });

    it('deduplicates repeated URL references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            { type: 'link', url: 'https://example.com', title: 'Example' },
            { type: 'text', text: ' text ' },
            { type: 'link', url: 'https://example.com', title: 'Example Again' },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Should only appear once (first occurrence wins)
      const items = screen.getAllByText('Example');
      expect(items).toHaveLength(1);
      expect(screen.queryByText('Example Again')).not.toBeInTheDocument();
    });

    it('extracts references from nested content', () => {
      const note = mockNote([
        {
          type: 'list',
          listType: 'bullet',
          children: [
            {
              type: 'listitem',
              children: [
                {
                  type: 'paragraph',
                  children: [
                    { type: 'wiki-link', targetId: 'note-nested', displayText: 'Nested Link' },
                  ],
                },
              ],
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('Nested Link')).toBeInTheDocument();
    });

    it('does NOT include person mentions in references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'person-mention',
              personId: 'person-123',
              personName: 'John Smith',
            },
            { type: 'wiki-link', targetId: 'note-123', displayText: 'Project' },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Wiki-link should be present
      expect(screen.getByText('Project')).toBeInTheDocument();
      // Person mention should NOT be in references
      expect(screen.queryByText('John Smith')).not.toBeInTheDocument();
    });

    it('ignores wiki-links without targetId', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'wiki-link',
              // No targetId
              displayText: 'Invalid Link',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.queryByText('Invalid Link')).not.toBeInTheDocument();
      expect(screen.getByText('No references')).toBeInTheDocument();
    });
  });

  describe('truncateUrl', () => {
    it('removes https protocol', () => {
      expect(truncateUrl('https://example.com')).toBe('example.com');
    });

    it('removes http protocol', () => {
      expect(truncateUrl('http://example.com')).toBe('example.com');
    });

    it('removes trailing slash', () => {
      expect(truncateUrl('https://example.com/')).toBe('example.com');
    });

    it('truncates long URLs with ellipsis', () => {
      const longUrl = 'https://example.com/very/long/path/to/document';
      const result = truncateUrl(longUrl, 30);
      expect(result.length).toBe(30);
      expect(result.endsWith('...')).toBe(true);
    });

    it('does not truncate short URLs', () => {
      expect(truncateUrl('https://example.com')).toBe('example.com');
    });

    it('respects custom maxLength parameter', () => {
      const url = 'https://example.com/path';
      expect(truncateUrl(url, 15)).toBe('example.com/...');
    });
  });

  describe('extractChildrenText', () => {
    it('extracts text from single TextNode child', () => {
      const node = {
        type: 'link',
        url: 'https://example.com',
        children: [{ type: 'text', text: 'My Link' }],
      };
      expect(extractChildrenText(node)).toBe('My Link');
    });

    it('concatenates multiple TextNode children', () => {
      const node = {
        type: 'link',
        url: 'https://example.com',
        children: [
          { type: 'text', text: 'Part 1 ' },
          { type: 'text', text: 'Part 2' },
        ],
      };
      expect(extractChildrenText(node)).toBe('Part 1 Part 2');
    });

    it('extracts text from nested formatting nodes', () => {
      // Simulates [**bold** text](url) structure
      const node = {
        type: 'link',
        url: 'https://example.com',
        children: [
          {
            type: 'text',
            text: 'bold',
            format: 1, // bold
          },
          {
            type: 'text',
            text: ' text',
          },
        ],
      };
      expect(extractChildrenText(node)).toBe('bold text');
    });

    it('handles deeply nested children', () => {
      const node = {
        type: 'link',
        children: [
          {
            type: 'container',
            children: [
              {
                type: 'inner',
                children: [{ type: 'text', text: 'Deep text' }],
              },
            ],
          },
        ],
      };
      expect(extractChildrenText(node)).toBe('Deep text');
    });

    it('returns empty string for empty children array', () => {
      const node = { type: 'link', children: [] };
      expect(extractChildrenText(node)).toBe('');
    });

    it('returns empty string for missing children property', () => {
      const node = { type: 'link' };
      expect(extractChildrenText(node)).toBe('');
    });

    it('returns empty string for null children', () => {
      const node = { type: 'link', children: null };
      expect(extractChildrenText(node)).toBe('');
    });
  });

  describe('autolink extraction', () => {
    it('extracts autolink nodes with truncated URL display', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'autolink',
                  url: 'https://example.com/auto-detected',
                  children: [], // AutoLinkNodes have empty children
                },
              ],
            },
          ],
        },
      };

      const refs = extractReferences(content);
      expect(refs).toHaveLength(1);
      expect(refs[0]).toEqual({
        type: 'url',
        displayText: 'example.com/auto-detected',
        url: 'https://example.com/auto-detected',
      });
    });

    it('extracts both link and autolink nodes from same content', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: 'https://example.com/manual',
                  children: [{ type: 'text', text: 'Manual Link' }],
                },
                { type: 'text', text: ' and ' },
                {
                  type: 'autolink',
                  url: 'https://auto.example.com',
                  children: [],
                },
              ],
            },
          ],
        },
      };

      const refs = extractReferences(content);
      expect(refs).toHaveLength(2);
      expect(refs[0].displayText).toBe('Manual Link');
      expect(refs[1].displayText).toBe('auto.example.com');
    });

    it('deduplicates across link and autolink types', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: 'https://example.com',
                  children: [{ type: 'text', text: 'First' }],
                },
                {
                  type: 'autolink',
                  url: 'https://example.com', // Same URL
                  children: [],
                },
              ],
            },
          ],
        },
      };

      const refs = extractReferences(content);
      expect(refs).toHaveLength(1);
      expect(refs[0].displayText).toBe('First'); // First one wins
    });
  });

  describe('extractReferences function', () => {
    it('returns empty array for empty content', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [],
        },
      };
      expect(extractReferences(content)).toEqual([]);
    });

    it('returns references with correct structure', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'wiki-link', targetId: 'note-1', displayText: 'Note One' },
                { type: 'link', url: 'https://example.com', title: 'Example' },
              ],
            },
          ],
        },
      };

      const refs = extractReferences(content);
      expect(refs).toHaveLength(2);
      expect(refs[0]).toEqual({
        type: 'wiki-link',
        displayText: 'Note One',
        targetId: 'note-1',
      });
      expect(refs[1]).toEqual({
        type: 'url',
        displayText: 'Example',
        url: 'https://example.com',
      });
    });
  });

  describe('click behavior', () => {
    it('calls onNavigate when clicking wiki-link', () => {
      const onNavigate = vi.fn();
      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'wiki-link', targetId: 'note-123', displayText: 'Project Alpha' }],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Project Alpha'));
      expect(onNavigate).toHaveBeenCalledWith('note-123');
    });

    it('opens URL in new tab when clicking URL reference', () => {
      const windowOpen = vi.spyOn(window, 'open').mockImplementation(() => null);
      const note = mockNote([
        {
          type: 'paragraph',
          children: [
            {
              type: 'link',
              url: 'https://example.com/doc',
              title: 'Example Doc',
            },
          ],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      fireEvent.click(screen.getByText('Example Doc'));

      expect(windowOpen).toHaveBeenCalledWith(
        'https://example.com/doc',
        '_blank',
        'noopener,noreferrer'
      );

      windowOpen.mockRestore();
    });

    it('does not call onNavigate when clicking URL reference', () => {
      const onNavigate = vi.fn();
      vi.spyOn(window, 'open').mockImplementation(() => null);

      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'link', url: 'https://example.com', title: 'Example' }],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={onNavigate} />);
      fireEvent.click(screen.getByText('Example'));
      expect(onNavigate).not.toHaveBeenCalled();
    });
  });

  describe('rendering', () => {
    it('renders the References header', () => {
      const note = mockNote([]);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      expect(screen.getByText('References')).toBeInTheDocument();
    });

    it('shows external link icon for URL references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'link', url: 'https://example.com', title: 'Example' }],
        },
      ]);

      render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Check for SVG icon presence (external link icon)
      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('does not show external link icon for wiki-link references', () => {
      const note = mockNote([
        {
          type: 'paragraph',
          children: [{ type: 'wiki-link', targetId: 'note-1', displayText: 'Note' }],
        },
      ]);

      const { container } = render(<ReferencesWidget note={note} onNavigate={() => {}} />);
      // Wiki-links should not have the external link icon in the button
      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).not.toBeInTheDocument();
    });
  });

  describe('collapse/expand behavior', () => {
    // Helper to create a note with many references
    function mockNoteWithManyRefs(count: number): Note {
      const children = Array.from({ length: count }, (_, i) => ({
        type: 'wiki-link',
        targetId: `note-${i}`,
        displayText: `Note ${i + 1}`,
      }));
      return mockNote([{ type: 'paragraph', children }]);
    }

    it('shows all references when there are 5 or fewer', () => {
      const note = mockNoteWithManyRefs(5);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);

      // All 5 references should be visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Note ${i}`)).toBeInTheDocument();
      }
      // No expand button should be shown
      expect(screen.queryByText(/Show \d+ more/)).not.toBeInTheDocument();
      expect(screen.queryByText('Show less')).not.toBeInTheDocument();
    });

    it('shows only first 5 references when there are more than 5', () => {
      const note = mockNoteWithManyRefs(10);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);

      // First 5 should be visible
      for (let i = 1; i <= 5; i++) {
        expect(screen.getByText(`Note ${i}`)).toBeInTheDocument();
      }
      // 6th and beyond should not be visible
      expect(screen.queryByText('Note 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Note 10')).not.toBeInTheDocument();
    });

    it('shows expand button with correct count when there are more than 5 references', () => {
      const note = mockNoteWithManyRefs(10);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);

      // Should show button with remaining count (5 more out of 10)
      expect(screen.getByText('Show 5 more')).toBeInTheDocument();
    });

    it('expands to show more references when clicking expand button', () => {
      const note = mockNoteWithManyRefs(10);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);

      // Click the expand button
      fireEvent.click(screen.getByText('Show 5 more'));

      // Now references 6-10 should be visible
      for (let i = 6; i <= 10; i++) {
        expect(screen.getByText(`Note ${i}`)).toBeInTheDocument();
      }
      // Button should now say "Show less"
      expect(screen.getByText('Show less')).toBeInTheDocument();
      expect(screen.queryByText('Show 5 more')).not.toBeInTheDocument();
    });

    it('collapses back when clicking Show less button', () => {
      const note = mockNoteWithManyRefs(10);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);

      // Expand first
      fireEvent.click(screen.getByText('Show 5 more'));
      // Then collapse
      fireEvent.click(screen.getByText('Show less'));

      // Should be back to first 5 only
      expect(screen.getByText('Note 5')).toBeInTheDocument();
      expect(screen.queryByText('Note 6')).not.toBeInTheDocument();
      // Button should be back to "Show more"
      expect(screen.getByText('Show 5 more')).toBeInTheDocument();
    });

    it('caps expanded view at 15 references', () => {
      const note = mockNoteWithManyRefs(20);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);

      // Expand
      fireEvent.click(screen.getByText('Show 10 more'));

      // References 1-15 should be visible
      for (let i = 1; i <= 15; i++) {
        expect(screen.getByText(`Note ${i}`)).toBeInTheDocument();
      }
      // References 16-20 should not be visible (capped at 15)
      expect(screen.queryByText('Note 16')).not.toBeInTheDocument();
      expect(screen.queryByText('Note 20')).not.toBeInTheDocument();
    });

    it('expand button has correct aria-expanded attribute', () => {
      const note = mockNoteWithManyRefs(10);
      render(<ReferencesWidget note={note} onNavigate={() => {}} />);

      const expandButton = screen.getByText('Show 5 more').closest('button');
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(expandButton!);
      expect(expandButton).toHaveAttribute('aria-expanded', 'true');
    });
  });
});
